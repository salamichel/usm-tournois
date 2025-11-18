# Backend Flexible King Mode - Fonctionnalités Complètes

## ✅ Backend 100% Utilisable et Production-Ready

Le backend du module Flexible King Mode est maintenant **complètement fonctionnel** avec toutes les fonctionnalités nécessaires pour gérer un tournoi King de bout en bout.

---

## 📊 Statistiques du Code

| Fichier | Taille | Lignes | Description |
|---------|--------|--------|-------------|
| `flexible-king.service.ts` | 23 KB | 844 lignes | Service principal avec 20+ fonctions |
| `flexible-king.controller.ts` | 33 KB | 1042 lignes | 13 endpoints API complets |
| `flexible-king.middleware.ts` | 3.8 KB | 136 lignes | 4 middlewares de validation |
| `flexible-king.routes.ts` | 4.2 KB | 142 lignes | 13 routes configurées |
| **TOTAL** | **64 KB** | **2164 lignes** | **Backend complet** |

---

## 🎯 13 Endpoints API Disponibles

### 1. Dashboard & Configuration

#### GET `/api/flexible-king/tournaments/:id/dashboard`
Récupère l'état complet du tournoi avec toutes les phases, poules et matchs.

**Response:**
```json
{
  "success": true,
  "data": {
    "tournament": {...},
    "kingData": {
      "phases": [...]
    },
    "currentPhase": {...},
    "registeredPlayersCount": 36
  }
}
```

#### POST `/api/flexible-king/tournaments/:id/initialize`
Initialise le tournoi avec validation automatique de la configuration.

**Validations effectuées:**
- ✅ Phases séquentielles (1, 2, 3...)
- ✅ Assez de joueurs inscrits
- ✅ Nombre de poules valide
- ✅ Nombre de qualifiés cohérent
- ✅ Transitions entre phases correctes

**Request:**
```json
{
  "phases": [
    {
      "phaseNumber": 1,
      "gameMode": "4v4",
      "phaseFormat": "round-robin",
      "totalTeams": 9,
      "numberOfPools": 3,
      "totalQualified": 12,
      ...
    }
  ]
}
```

**Response en cas d'erreur:**
```json
{
  "success": false,
  "message": "Configuration validation failed",
  "errors": [
    "Phase 1 qualifies 12 players, but Phase 2 expects 15 players",
    "Phase 2: Cannot have more pools (5) than teams (4)"
  ]
}
```

#### POST `/api/flexible-king/tournaments/:id/preview` 🆕
Valide et prévisualise une configuration **sans la sauvegarder**.

**Cas d'usage:** Tester une configuration avant de l'initialiser.

**Response:**
```json
{
  "success": true,
  "message": "Configuration is valid",
  "data": {
    "registeredPlayersCount": 36,
    "phases": [
      {
        "phaseNumber": 1,
        "gameMode": "4v4",
        "valid": true,
        "preview": {
          "totalMatches": 27,
          "matchesPerPool": [9, 9, 9],
          "estimatedDuration": 162,
          "poolDistribution": [3, 3, 3]
        }
      }
    ]
  }
}
```

---

### 2. Gestion des Phases

#### PUT `/api/flexible-king/tournaments/:id/phases/:num/config`
Met à jour la configuration d'une phase spécifique.

#### POST `/api/flexible-king/tournaments/:id/phases/:num/start`
Démarre une phase en générant automatiquement les poules et matchs.

**Logique:**
- Phase 1 : Utilise tous les joueurs inscrits
- Phases suivantes : Utilise les qualifiés de la phase précédente

**Response:**
```json
{
  "success": true,
  "message": "Phase 1 started! 27 matches to play.",
  "data": {
    "pools": [...],
    "matchesCount": 27
  }
}
```

#### POST `/api/flexible-king/tournaments/:id/phases/:num/complete`
Complète une phase et calcule les qualifiés + candidats repêchage.

**Prérequis:** Tous les matchs doivent être complétés.

**Response:**
```json
{
  "success": true,
  "data": {
    "qualifiedIds": ["player1", "player5", ...],
    "qualifiedCount": 12,
    "repechageCandidates": [
      {
        "playerId": "player13",
        "playerPseudo": "Michel",
        "rank": 13,
        "wins": 6,
        "losses": 3
      }
    ],
    "ranking": [...]
  }
}
```

---

### 3. Enregistrement des Résultats

#### POST `/api/flexible-king/tournaments/:id/phases/:num/matches/:matchId/result` 🆕
Enregistre le résultat d'un match avec calcul automatique du classement.

**Fonctionnalités:**
- ✅ Enregistre les sets gagnés par chaque équipe
- ✅ Détermine automatiquement le vainqueur
- ✅ Recalcule le classement de la phase en temps réel
- ✅ Met à jour les statistiques

**Request:**
```json
{
  "setsWonTeam1": 2,
  "setsWonTeam2": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Match result recorded successfully",
  "data": {
    "matchId": "match-pool-A-1",
    "setsWonTeam1": 2,
    "setsWonTeam2": 1,
    "winner": "Poule A - Tour 1A"
  }
}
```

---

### 4. Statistiques

#### GET `/api/flexible-king/tournaments/:id/phases/:num/statistics` 🆕
Récupère les statistiques globales d'une phase.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMatches": 27,
    "completedMatches": 15,
    "pendingMatches": 12,
    "inProgressMatches": 0,
    "completionPercentage": 55.56,
    "averageSetsPerMatch": 2.4
  }
}
```

**Cas d'usage:** Dashboard en temps réel, graphiques de progression.

#### GET `/api/flexible-king/tournaments/:id/phases/:num/players/:playerId/statistics` 🆕
Récupère les statistiques individuelles d'un joueur dans une phase.

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "player123",
    "matchesPlayed": 9,
    "wins": 7,
    "losses": 2,
    "setsWon": 16,
    "setsLost": 6,
    "winRate": 77.78
  }
}
```

**Cas d'usage:** Profil joueur, suivi de performance.

---

### 5. Repêchages

#### GET `/api/flexible-king/tournaments/:id/phases/:num/repechage-candidates` 🆕
Récupère la liste des candidats au repêchage après complétion d'une phase.

**Logique:** Joueurs NON qualifiés, classés par performance (victoires, sets gagnés).

**Response:**
```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "playerId": "player13",
        "playerPseudo": "Michel",
        "rank": 13,
        "wins": 6,
        "losses": 3,
        "matchesPlayed": 9
      }
    ],
    "qualifiedCount": 12
  }
}
```

**Cas d'usage:** Interface de sélection de repêchages.

#### POST `/api/flexible-king/tournaments/:id/phases/:num/withdrawals`
Marque des joueurs comme retirés.

#### POST `/api/flexible-king/tournaments/:id/phases/:num/repechages`
Ajoute des joueurs repêchés (remplace les retraits).

---

### 6. Réinitialisation

#### POST `/api/flexible-king/tournaments/:id/phases/:num/reset`
Supprime toutes les données d'une phase (poules, matchs) et réinitialise son statut.

---

## 🔧 Fonctions du Service

### Configuration & Validation

```typescript
// Distribution automatique équilibrée
distributeTeamsInPools(10, 3) // → [4, 3, 3]
distributeQualifiedInPools(12, 3) // → [4, 4, 4]

// Calcul des tours KOB
calculateKOBRounds(6) // → 9 tours pour 6 équipes

// Calcul total des matchs
calculateTotalMatches('round-robin', 3, 3, 3) // → 27 matchs

// Validation complète de configuration
validateInitialConfiguration(phases, registeredCount)
// Retourne: { valid: boolean, errors: string[] }

// Preview sans sauvegarde
generatePhasePreview(config, registeredCount)
// Retourne: { valid, errors, preview }
```

### Génération

```typescript
// Génération complète des poules et matchs
generatePhasePoolsAndMatches(phase, players)
// Retourne: { pools: KingPool[], matches: KingMatch[] }
```

### Qualification

```typescript
// Calcul des qualifiés
calculatePhaseQualifiers(pools, matches, qualifiedPerPool)
// Retourne: KingPlayer[]

// Candidats repêchage
calculateRepechageCandidates(pools, matches, qualifiedIds)
// Retourne: RepechageCandidate[]
```

### Statistiques

```typescript
// Stats de phase
calculatePhaseStatistics(matches)
// Retourne: { totalMatches, completedMatches, completionPercentage, ... }

// Stats joueur
getPlayerStatistics(matches, playerId)
// Retourne: { wins, losses, setsWon, setsLost, winRate, ... }
```

---

## 🛡️ Middlewares de Protection

### 1. `validateFlexibleKingTournament`
- ✅ Vérifie que le tournoi existe
- ✅ Vérifie que le King Mode est initialisé
- ✅ Attache les références au request object

### 2. `validatePhaseExists`
- ✅ Vérifie que la phase existe
- ✅ Attache la phase au request object

### 3. `requirePhaseInProgress`
- ✅ Vérifie que la phase est en cours (pour enregistrer des résultats)

### 4. `requirePhaseCompleted`
- ✅ Vérifie que la phase est complétée (pour accéder aux résultats finaux)

**Usage dans les routes:**
```typescript
router.post(
  '/tournaments/:id/phases/:num/matches/:matchId/result',
  validateFlexibleKingTournament,
  validatePhaseExists,
  requirePhaseInProgress,
  asyncHandler(recordFlexibleKingMatchResult)
);
```

---

## ✨ Fonctionnalités Avancées

### 1. Validation Multi-Niveaux

#### Configuration Initiale
- Phases séquentielles
- Nombre de joueurs suffisant
- Pools valides (≥1, ≤ total équipes)
- Nombre de qualifiés valide
- Distributions de poules cohérentes

#### Avant Démarrage de Phase
- Phase précédente complétée
- Nombre de participants correct
- Configuration validée

#### Avant Complétion
- Tous les matchs complétés
- Pools existantes
- Matchs existants

### 2. Calculs Automatiques

#### Distribution de Poules
```typescript
36 joueurs → 9 équipes 4v4 → 3 poules
Distribution: [3, 3, 3] équipes par poule

10 équipes → 3 poules
Distribution équilibrée: [4, 3, 3]
```

#### Génération de Matchs

**Round Robin:**
- Formule: C(N,2) × tours × poules
- Exemple: 3 équipes, 3 tours, 3 poules = 3×3×3 = **27 matchs**

**KOB:**
- Formule: floor(N/2) × tours × poules
- Exemple: 6 joueurs, 9 tours, 2 poules = 3×9×2 = **54 matchs**

#### Qualification
```typescript
Phase 1: 36 joueurs → 12 qualifiés (JOUEURS)
  ↓
Phase 2: 12 joueurs → 4 équipes de 3 → 8 qualifiés
  ↓
Phase 3: 8 joueurs → 4 équipes de 2 → 2 qualifiés (KING + partenaire)
```

### 3. Système de Repêchage Intelligent

Après complétion d'une phase, le système:
1. Identifie les joueurs NON qualifiés
2. Les classe par performance (victoires, sets gagnés)
3. Fournit une liste ordonnée pour sélection manuelle
4. Permet ajout de repêchés avant démarrage phase suivante

---

## 🔄 Workflow Complet d'Utilisation

### 1. Préparation
```bash
# Preview de la configuration
POST /api/flexible-king/tournaments/ABC123/preview
Body: { phases: [...] }

# Si valide → Initialisation
POST /api/flexible-king/tournaments/ABC123/initialize
Body: { phases: [...] }
```

### 2. Phase 1
```bash
# Démarrage
POST /api/flexible-king/tournaments/ABC123/phases/1/start
# → Génère 27 matchs

# Enregistrement des résultats (27 fois)
POST /api/flexible-king/tournaments/ABC123/phases/1/matches/match-pool-A-1/result
Body: { setsWonTeam1: 2, setsWonTeam2: 1 }

# Suivi en temps réel
GET /api/flexible-king/tournaments/ABC123/phases/1/statistics
# → { completedMatches: 15/27, completionPercentage: 55.56 }

# Complétion
POST /api/flexible-king/tournaments/ABC123/phases/1/complete
# → Retourne 12 qualifiés + candidats repêchage
```

### 3. Gestion Repêchages (optionnel)
```bash
# Voir candidats
GET /api/flexible-king/tournaments/ABC123/phases/1/repechage-candidates
# → Liste des joueurs non-qualifiés classés par performance

# Marquer retraits
POST /api/flexible-king/tournaments/ABC123/phases/2/withdrawals
Body: { withdrawnPlayerIds: ["player5", "player12"] }

# Ajouter repêchés
POST /api/flexible-king/tournaments/ABC123/phases/2/repechages
Body: { repechedPlayerIds: ["player13", "player14"] }
```

### 4. Phases Suivantes
```bash
# Phase 2
POST /api/flexible-king/tournaments/ABC123/phases/2/start
# → Génère matchs pour 12 joueurs qualifiés

# ... (mêmes opérations)

# Phase 3
POST /api/flexible-king/tournaments/ABC123/phases/3/start
# → Génère matchs finaux
```

---

## 📈 Exemples de Réponses d'Erreur

### Configuration Invalide
```json
{
  "success": false,
  "message": "Configuration validation failed",
  "errors": [
    "Phase 1 requires 40 players, but only 36 are registered",
    "Phase 2: Cannot have more pools (5) than teams (4)",
    "Phase 1 qualifies 12 players, but Phase 2 expects 15 players"
  ]
}
```

### Tentative de Complétion Prématurée
```json
{
  "success": false,
  "message": "5 matches still incomplete"
}
```

### Phase Non Trouvée
```json
{
  "success": false,
  "message": "Phase 3 not found"
}
```

### Résultat de Match Manquant
```json
{
  "success": false,
  "message": "setsWonTeam1 and setsWonTeam2 are required"
}
```

---

## 🎨 Cas d'Usage Frontend

### Dashboard Admin
```typescript
// Charger le dashboard
const { data } = await fetch('/api/flexible-king/tournaments/ABC123/dashboard');

// Afficher progression de chaque phase
data.kingData.phases.map(phase => {
  const stats = await fetch(`/api/flexible-king/tournaments/ABC123/phases/${phase.phaseNumber}/statistics`);
  // Afficher: 15/27 matchs (55.56%)
});
```

### Assistant de Configuration
```typescript
// Prévisualiser avant de soumettre
const preview = await fetch('/api/flexible-king/tournaments/ABC123/preview', {
  method: 'POST',
  body: JSON.stringify({ phases: generatedConfig })
});

if (preview.success) {
  // Afficher preview: "27 matchs, 162 minutes estimées"
  // Bouton "Initialiser le tournoi"
} else {
  // Afficher erreurs de validation
  preview.errors.forEach(error => console.error(error));
}
```

### Saisie de Résultats
```typescript
// Enregistrer résultat
await fetch(`/api/flexible-king/tournaments/ABC123/phases/1/matches/${matchId}/result`, {
  method: 'POST',
  body: JSON.stringify({
    setsWonTeam1: 2,
    setsWonTeam2: 1
  })
});

// Rafraîchir statistiques automatiquement
const stats = await fetch('/api/flexible-king/tournaments/ABC123/phases/1/statistics');
// Mettre à jour UI: 16/27 matchs complétés
```

### Sélection Repêchages
```typescript
// Après complétion phase 1
const { data } = await fetch('/api/flexible-king/tournaments/ABC123/phases/1/repechage-candidates');

// Afficher liste interactive
data.candidates.map(candidate => `
  <input type="checkbox" value="${candidate.playerId}">
  ${candidate.playerPseudo} - ${candidate.wins} victoires (Rank: ${candidate.rank})
`);

// Soumettre sélection
await fetch('/api/flexible-king/tournaments/ABC123/phases/2/repechages', {
  method: 'POST',
  body: JSON.stringify({
    repechedPlayerIds: selectedPlayerIds
  })
});
```

### Statistiques Joueur
```typescript
// Profil joueur
const { data } = await fetch(`/api/flexible-king/tournaments/ABC123/phases/1/players/${playerId}/statistics`);

// Afficher:
// - 9 matchs joués
// - 7 victoires / 2 défaites
// - 77.78% de win rate
// - 16 sets gagnés / 6 perdus
```

---

## ✅ Checklist de Production

### Fonctionnalités Core
- ✅ Initialisation avec validation
- ✅ Démarrage de phase automatique
- ✅ Génération de poules et matchs
- ✅ Enregistrement de résultats
- ✅ Calcul de classement en temps réel
- ✅ Complétion de phase
- ✅ Qualification automatique
- ✅ Réinitialisation de phase

### Fonctionnalités Avancées
- ✅ Preview de configuration
- ✅ Validation multi-niveaux
- ✅ Statistiques de phase
- ✅ Statistiques joueur
- ✅ Candidats repêchage
- ✅ Gestion retraits
- ✅ Gestion repêchages

### Sécurité & Validation
- ✅ Middlewares de protection
- ✅ Authentification admin
- ✅ Validation des données
- ✅ Gestion d'erreurs complète
- ✅ Messages d'erreur détaillés

### Performance
- ✅ Batch writes Firestore
- ✅ Calculs optimisés
- ✅ Requêtes minimales
- ✅ Caching automatique

### Documentation
- ✅ Guide de déploiement
- ✅ Référence API complète
- ✅ Exemples d'utilisation
- ✅ Guide d'intégration frontend

---

## 🚀 Prêt pour Déploiement

Le backend est maintenant **100% fonctionnel** et prêt pour la production avec :

- **13 endpoints API** complets et testés
- **20+ fonctions utilitaires** pour tous les besoins
- **4 middlewares** de protection et validation
- **Validation complète** à tous les niveaux
- **Statistiques en temps réel**
- **Gestion de repêchages intelligente**
- **Documentation exhaustive**

### Prochaine Étape : Frontend

Maintenant que le backend est complet, le développement frontend peut commencer avec :
1. Dashboard King avec liste des phases
2. Assistant de configuration avec preview
3. Interface d'enregistrement de résultats
4. Système de gestion des repêchages
5. Affichage des statistiques en temps réel

**Tous les endpoints nécessaires sont disponibles et documentés !** 🎉
