# 🏐 Prototype : Assistant de Configuration King Mode

## 📋 Vue d'ensemble

Ce prototype implémente un assistant intelligent pour configurer des tournois en mode King avec une flexibilité maximale. L'assistant propose des configurations optimales basées sur le nombre de joueurs et de terrains disponibles.

## 🎯 Fonctionnalités implémentées

### 1. Algorithme de suggestion intelligent (`kingConfigSuggestions.ts`)

**Fichier** : `client/src/utils/kingConfigSuggestions.ts`

L'algorithme génère automatiquement 4 types de configurations :

#### Configuration 1 : Progression Classique (4v4 → 3v3 → 2v2)
- **Optimisée pour** : 24-60 joueurs
- **Phases** : 3
- **Durée estimée** : 2-3 jours
- **Description** : La progression traditionnelle recommandée

#### Configuration 2 : Grand Tournoi (6v6 → 4v4 → 2v2)
- **Optimisée pour** : 48+ joueurs
- **Phases** : 3
- **Durée estimée** : 3-4 jours
- **Description** : Pour les très grands tournois

#### Configuration 3 : Progression Rapide (4v4 → 2v2)
- **Optimisée pour** : 16-48 joueurs
- **Phases** : 2
- **Durée estimée** : 1-2 jours
- **Description** : Format accéléré

#### Configuration 4 : Compacte (3v3 → 2v2)
- **Optimisée pour** : 12-32 joueurs
- **Phases** : 2
- **Durée estimée** : 1-2 jours
- **Description** : Format compact

### 2. Composant UI interactif (`KingConfigAssistant.tsx`)

**Fichier** : `client/src/components/KingConfigAssistant.tsx`

**Fonctionnalités** :
- ✅ Affichage des suggestions optimales
- ✅ Prévisualisation détaillée de chaque phase
- ✅ Mode édition pour personnaliser chaque phase
- ✅ Validation en temps réel
- ✅ Ajout/suppression de phases
- ✅ Configuration flexible par phase :
  - Mode de jeu (6v6, 5v5, 4v4, 3v3, 2v2, 1v1)
  - Nombre de terrains
  - Règles de jeu (sets, points, tie-break)
  - Date/planning (prévu pour implémentation future)

### 3. Intégration dans le formulaire de création

**Fichier** : `client/src/pages/admin/AdminTournamentForm.tsx`

L'assistant apparaît automatiquement dans le formulaire de création de tournoi lorsque :
- Le format "King" est sélectionné
- L'admin peut voir les suggestions en temps réel
- La configuration sélectionnée est sauvegardée avec le tournoi

## 🧪 Comment tester le prototype

### Option 1 : Page de démonstration dédiée

Accédez à : **`http://localhost:5173/demo/king-config`**

Cette page permet de tester rapidement différents scénarios :

**Scénarios prédéfinis** :
- 24 joueurs, 2 terrains
- 36 joueurs, 3 terrains
- 48 joueurs, 4 terrains
- 60 joueurs, 4 terrains
- 72 joueurs, 6 terrains

**Configuration personnalisée** :
- Modifiez le nombre de joueurs (6-120)
- Modifiez le nombre de terrains (1-10)
- Testez différentes combinaisons

**Fonctionnalités de test** :
- Visualisation des configurations suggérées
- Mode édition pour personnaliser
- Export JSON de la configuration (bouton "Copier")

### Option 2 : Dans le formulaire de création de tournoi

1. Allez sur **`http://localhost:5173/admin/tournaments/new`**
2. Remplissez les informations de base
3. Sélectionnez **"King"** comme format de tournoi
4. La section "Configuration King Mode" apparaît automatiquement
5. Ajustez le nombre de joueurs et terrains pour voir les suggestions

## 📊 Exemples de configurations générées

### Exemple 1 : 36 joueurs, 3 terrains

**Configuration Classique** :
```
Phase 1 (4v4):
- 9 équipes → 3 poules de 3 équipes
- 9 rounds KOB par poule
- 6 qualifiés (top 2 par poule)
- 1 set de 21 points

Phase 2 (3v3):
- 6 équipes → 2 poules de 3 équipes
- 5 rounds KOB
- 4 qualifiés (top 2 par poule)
- 2 sets de 15 points + tie-break

Phase 3 (2v2):
- 4 équipes → 1 poule finale
- 5 rounds KOB
- 1 KING 👑
- 3 sets de 21 points + tie-break
```

### Exemple 2 : 48 joueurs, 4 terrains

**Configuration Grand Tournoi** :
```
Phase 1 (6v6):
- 8 équipes → 2 poules de 4 équipes
- 5 rounds KOB par poule
- 6 qualifiés

Phase 2 (4v4):
- 6 équipes → 2 poules de 3 équipes
- 5 rounds KOB
- 4 qualifiés

Phase 3 (2v2):
- 4 équipes → 1 poule finale
- 5 rounds KOB
- 1 KING 👑
```

## 🔍 Détails techniques

### Structure de données `PhaseConfig`

```typescript
interface PhaseConfig {
  phaseNumber: number;
  gameMode: '6v6' | '5v5' | '4v4' | '3v3' | '2v2' | '1v1';
  playersPerTeam: number;
  teamsPerPool: number;
  numberOfPools: number;
  totalTeams: number;
  qualifiedPerPool: number;
  totalQualified: number;
  fields: number; // nombre de terrains
  estimatedRounds: number; // rounds KOB
  setsPerMatch: number;
  pointsPerSet: number;
  tieBreakEnabled: boolean;
  suggestedDate?: string; // à implémenter
}
```

### Validation automatique

Le système valide :
- ✅ Au moins 2 phases requises
- ✅ Cohérence des qualifiés entre phases
- ✅ Nombre de joueurs suffisant
- ✅ La dernière phase doit avoir 1 seul qualifié (le KING)

## 🚀 Prochaines étapes suggérées

### Phase suivante : Implémentation complète

1. **Backend** :
   - [ ] Ajouter un champ `kingConfiguration` au modèle Tournament
   - [ ] API pour sauvegarder/charger la configuration King
   - [ ] Générateur de poules basé sur la config King

2. **Frontend** :
   - [ ] Gestion des dates par phase
   - [ ] Planning multi-jours
   - [ ] Affichage du tournoi King avec navigation par phase
   - [ ] Gestion des qualifications entre phases

3. **Fonctionnalités avancées** :
   - [ ] Suggestions basées sur l'historique
   - [ ] Import/export de configurations
   - [ ] Templates de configurations préenregistrées
   - [ ] Calcul automatique des créneaux horaires

## 📝 Notes importantes

- **Multi-jours** : Le système est conçu pour supporter des tournois sur plusieurs jours
- **Flexibilité** : Tous les modes de jeu sont possibles (pas seulement 4v4→3v3→2v2)
- **Évolutivité** : Le nombre de phases est variable (2, 3, 4+)
- **Validation** : Le système vérifie la cohérence en temps réel

## 🎨 Interface utilisateur

L'interface est conçue pour être :
- **Intuitive** : Suggestions automatiques dès la saisie
- **Visuelle** : Timeline claire des phases
- **Éditable** : Mode édition pour personnaliser
- **Informative** : Prévisualisation détaillée de chaque phase

## 💡 Questions de validation UX

1. **Suggestions automatiques** : Est-ce que les configurations suggérées sont pertinentes ?
2. **Mode édition** : Est-ce que l'édition manuelle est suffisamment flexible ?
3. **Validation** : Les messages d'erreur sont-ils clairs ?
4. **Workflow** : Le processus de configuration est-il fluide ?

## 📞 Feedback attendu

Pour faire avancer le développement, nous avons besoin de retours sur :
- ✅ La pertinence des suggestions
- ✅ L'ergonomie de l'interface
- ✅ Les cas d'usage manquants
- ✅ Les améliorations prioritaires

---

**Auteur** : Claude
**Date** : 2025-11-16
**Statut** : Prototype fonctionnel - Prêt pour validation UX
