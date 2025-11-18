# 🏗️ Architecture King Mode Flexible - Document Technique

## 📋 Contexte

Extension du système King existant (hardcodé 4v4→3v3→2v2) vers un système flexible permettant :
- Nombre de phases variable (2, 3, 4+)
- Configuration personnalisée par phase
- Gestion multi-jours
- Repêchages manuels
- Preview dynamique

## 🎯 Workflow utilisateur

```
┌─────────────────────────────────────────────────────────────┐
│ CRÉATION TOURNOI (Format: King)                             │
│ - Preview dynamique selon inscriptions                      │
│ - Pas de configuration sauvegardée                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ PÉRIODE D'INSCRIPTION                                       │
│ - Joueurs s'inscrivent normalement                          │
│ - Preview se met à jour automatiquement                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ DASHBOARD KING (/admin/tournaments/:id/king)                │
│ [Bouton: Configurer Phase 1] (actif quand inscriptions OK)  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ MODALE CONFIG PHASE 1                                       │
│ - 42 inscrits détectés                                      │
│ - Suggestions: 6v6, 4v4, etc.                               │
│ - Config: terrains, règles, date                            │
│ [Sauvegarder] → Génère les poules                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1 EN COURS                                            │
│ - Matchs joués                                              │
│ - Qualifications automatiques                               │
│ - [Option: Marquer désistements]                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1 TERMINÉE                                            │
│ - 12 qualifiés automatiquement détectés                     │
│ [Bouton: Configurer Phase 2] (actif)                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ MODALE CONFIG PHASE 2                                       │
│ - 12 qualifiés (liste affichée)                             │
│ - Admin marque manuellement: 3 désistements                 │
│ - [Bouton: Gérer repêchages] → Sélection manuelle           │
│ - Suggestions recalculées pour 9 joueurs                    │
│ [Sauvegarder] → Génère les poules                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
                          ...
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE FINALE TERMINÉE                                       │
│ - 1 KING déterminé 👑                                       │
└─────────────────────────────────────────────────────────────┘
```

## 🗄️ Structure de données

### 1. Extension des types existants

```typescript
// Nouveaux types (ajout à king.types.ts)

export type GameMode = '6v6' | '5v5' | '4v4' | '3v3' | '2v2' | '1v1';

export type FlexiblePhaseStatus =
  | 'not_configured'   // Pas encore configurée
  | 'configured'       // Configurée, prête à démarrer
  | 'in_progress'      // En cours
  | 'completed';       // Terminée

export interface FlexiblePhaseConfig {
  phaseNumber: number;
  gameMode: GameMode;
  playersPerTeam: number;
  teamsPerPool: number;
  numberOfPools: number;
  totalParticipants: number;  // Nombre total de joueurs dans cette phase
  qualifiedPerPool: number;
  totalQualified: number;     // Nombre total de qualifiés vers phase suivante
  fields: number;
  estimatedRounds: number;

  // Règles de jeu
  setsPerMatch: number;
  pointsPerSet: number;
  tieBreakEnabled: boolean;

  // Planning
  scheduledDate?: string;     // Date prévue au format ISO
}

export interface FlexibleKingPhase {
  id: string;                 // ID unique de la phase
  tournamentId: string;
  phaseNumber: number;
  status: FlexiblePhaseStatus;
  config: FlexiblePhaseConfig;

  // Participants
  participantIds: string[];   // IDs des joueurs participants
  qualifiedIds: string[];     // IDs des qualifiés (rempli après completion)
  withdrawnIds: string[];     // IDs des joueurs désistés (marqués manuellement)
  repechedIds: string[];      // IDs des joueurs repêchés (sélection manuelle)

  // Données générées
  pools?: KingPool[];         // Poules générées (si status >= 'configured')
  matches?: KingMatch[];      // Matchs générés
  ranking?: KingPlayerRanking[];

  // Métadonnées
  createdAt: Date;
  configuredAt?: Date;        // Quand la phase a été configurée
  startedAt?: Date;           // Quand la phase a démarré
  completedAt?: Date;         // Quand la phase s'est terminée
}

export interface FlexibleKingTournamentData {
  phases: FlexibleKingPhase[];
  currentPhaseNumber: number | null;  // null si aucune phase en cours
  winner?: {
    playerId: string;
    playerPseudo: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Structure Firestore

```
tournaments/{tournamentId}/
  └── kingData (document unique)
      ├── phases: FlexibleKingPhase[]
      ├── currentPhaseNumber: number | null
      ├── winner: { playerId, playerPseudo } | null
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp

  └── kingPhases (collection) [Alternative: sous-collection pour scalabilité]
      └── {phaseId} (document)
          ├── ... (champs de FlexibleKingPhase)
          └── pools (collection)
              └── {poolId}
                  └── matches (collection)
                      └── {matchId}
```

**Choix d'architecture** : Document unique `kingData` contenant toutes les phases SAUF si >10 phases prévisibles → sous-collection.
**Décision** : Document unique (suffit pour 99% des cas, max 5-6 phases réaliste).

## 🔧 API Endpoints

### Endpoints existants (à conserver)
```
GET    /api/tournaments/:id/king                    // Dashboard King
POST   /api/tournaments/:id/king/start-phase        // Démarrer phase (ancien système)
POST   /api/tournaments/:id/king/record-result      // Enregistrer résultat
POST   /api/tournaments/:id/king/reset-phase        // Réinitialiser phase
```

### Nouveaux endpoints (système flexible)
```
# Gestion des phases
POST   /api/tournaments/:id/king/phases/configure   // Configurer une nouvelle phase
GET    /api/tournaments/:id/king/phases             // Liste toutes les phases
GET    /api/tournaments/:id/king/phases/:phaseNum   // Détails d'une phase
PUT    /api/tournaments/:id/king/phases/:phaseNum   // Modifier config phase
DELETE /api/tournaments/:id/king/phases/:phaseNum   // Supprimer une phase

# Génération des poules
POST   /api/tournaments/:id/king/phases/:phaseNum/generate-pools

# Gestion des désistements et repêchages
POST   /api/tournaments/:id/king/phases/:phaseNum/mark-withdrawals
        Body: { withdrawnPlayerIds: string[] }

POST   /api/tournaments/:id/king/phases/:phaseNum/manage-repechages
        Body: { repechedPlayerIds: string[] }

# Qualification
POST   /api/tournaments/:id/king/phases/:phaseNum/complete
        → Calcule automatiquement les qualifiés
        → Crée la liste des repêchages possibles

# Preview
GET    /api/tournaments/:id/king/preview
        Query: ?registeredCount=42
        → Retourne suggestions de configuration
```

## 💻 Implémentation Frontend

### 1. Composants à créer

```
client/src/components/king/
├── KingPhaseDashboard.tsx          // Liste des phases avec statuts
├── PhaseConfigModal.tsx            // Modale de configuration de phase
├── PhaseStatusCard.tsx             // Card d'une phase (statut, actions)
├── WithdrawalManager.tsx           // Gestion des désistements
├── RepechageManager.tsx            // Gestion des repêchages
└── PreviewConfigPanel.tsx          // Preview public
```

### 2. Pages modifiées

```
client/src/pages/admin/AdminKingDashboard.tsx
  → Remplacer par système de phases flexibles
  → Afficher liste des phases
  → Boutons d'action selon statut

client/src/pages/admin/AdminTournamentForm.tsx
  → Mode preview only (déjà fait)
  → Message: "Configuration détaillée après inscriptions"

client/src/pages/public/TournamentDetailPage.tsx
  → Ajouter section "Phases King" (si tournamentFormat === 'king')
  → Afficher preview dynamique
```

## 🔄 Logique métier

### 1. Calcul automatique des qualifiés

```typescript
async function completePhase(tournamentId: string, phaseNumber: number) {
  // 1. Récupérer tous les matchs de la phase
  const matches = await getPhaseMatches(tournamentId, phaseNumber);

  // 2. Calculer le ranking
  const ranking = calculateKingRanking(matches);

  // 3. Déterminer les qualifiés selon config
  const phase = await getPhase(tournamentId, phaseNumber);
  const qualifiedIds = ranking
    .slice(0, phase.config.totalQualified)
    .map(r => r.playerId);

  // 4. Créer liste des repêchages possibles (non-qualifiés)
  const repechageCandidates = ranking
    .slice(phase.config.totalQualified)
    .map(r => ({ playerId: r.playerId, rank: r.rank }));

  // 5. Sauvegarder
  await updatePhase(tournamentId, phaseNumber, {
    status: 'completed',
    qualifiedIds,
    completedAt: new Date(),
  });

  return { qualifiedIds, repechageCandidates };
}
```

### 2. Gestion des désistements et repêchages

```typescript
async function handleWithdrawalsAndRepechages(
  tournamentId: string,
  phaseNumber: number,
  withdrawnIds: string[],
  repechedIds: string[]
) {
  const prevPhase = await getPhase(tournamentId, phaseNumber - 1);

  // 1. Retirer les désistés des qualifiés
  const activeQualified = prevPhase.qualifiedIds.filter(
    id => !withdrawnIds.includes(id)
  );

  // 2. Ajouter les repêchés
  const nextPhaseParticipants = [...activeQualified, ...repechedIds];

  // 3. Valider qu'on a assez de joueurs
  if (nextPhaseParticipants.length < MIN_PLAYERS_FOR_PHASE) {
    throw new Error('Pas assez de joueurs pour la phase suivante');
  }

  return nextPhaseParticipants;
}
```

### 3. Suggestions dynamiques

```typescript
function getDynamicSuggestions(
  participantsCount: number,
  availableFields: number
): FlexiblePhaseConfig[] {
  // Réutiliser l'algorithme de kingConfigSuggestions.ts
  const configs = suggestKingConfigurations(participantsCount, availableFields);

  // Convertir vers le format FlexiblePhaseConfig
  return configs.flatMap(config =>
    config.phases.map(phase => convertToFlexibleConfig(phase))
  );
}
```

## 📊 États et transitions

### Diagramme d'états d'une phase

```
not_configured
      ↓ [Admin configure la phase]
configured
      ↓ [Admin génère les poules]
in_progress
      ↓ [Tous les matchs terminés]
completed
```

### Conditions de transition

- **not_configured → configured** :
  - Config complète fournie
  - Participants disponibles

- **configured → in_progress** :
  - Poules générées
  - Au moins 1 match créé

- **in_progress → completed** :
  - Tous les matchs status='completed'
  - Classement calculé
  - Qualifiés déterminés

## 🎨 UX/UI

### Dashboard King - Vue Admin

```
┌──────────────────────────────────────────────────────────┐
│ 🏐 King Mode - Tournoi Beach Volley 2025                │
├──────────────────────────────────────────────────────────┤
│ Inscrits: 42 joueurs                                     │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ✅ Phase 1 - Terminée                               │  │
│ │ 6v6 • 42 joueurs → 12 qualifiés                    │  │
│ │ Date: 15/12/2024 • 3 terrains                      │  │
│ │ [Voir résultats] [Modifier]                        │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 🔧 Phase 2 - Non configurée                        │  │
│ │ 12 qualifiés de Phase 1                            │  │
│ │ ⚠️ 3 joueurs désistés                              │  │
│ │ [Gérer désistements] [🔧 Configurer Phase 2]      │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 🔒 Phase 3 - Verrouillée                           │  │
│ │ (Disponible après Phase 2)                         │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ [+ Ajouter une phase]                                   │
└──────────────────────────────────────────────────────────┘
```

## 📱 Responsive

- Desktop : Vue en colonne avec sidebar
- Mobile : Vue en liste accordéon

## ⚡ Performance

- Cache côté client des configurations
- Pagination des matchs (> 100 matchs)
- Lazy loading des poules

## 🔐 Sécurité

- Seuls les admins peuvent configurer les phases
- Validation côté serveur de toutes les configs
- Logs d'audit des modifications de phases

---

**Prochaine étape** : Implémentation backend puis frontend selon cette architecture.
