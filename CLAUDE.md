# Documentation Technique - USM Tournois

## Règles des Statuts de Tournoi

Les statuts sont calculés dans `server/src/utils/tournament.status.utils.ts` et évalués dans cet ordre de priorité :

### 1. Terminé
- Classement figé (`isRankingFrozen = true`)
- OU date du tournoi dépassée (`now > tournamentDate`)

### 2. En cours
- Il y a des matchs (`hasMatches = true`)
- ET (inscriptions fermées OU complet par équipes complètes)

### 3. Avenir
- Dates d'inscription définies
- ET on est avant la date de début des inscriptions (`now < registrationStartDateTime`)

### 4. Liste d'attente
- Tournoi complet (voir définition ci-dessous)
- ET taille de liste d'attente > 0 (`waitingListSize > 0`)
- ET liste d'attente pas pleine (`waitingListCurrentSize < waitingListSize`)

### 5. Complet
- Tournoi complet
- ET (liste d'attente désactivée (`waitingListSize = 0`) OU liste d'attente pleine)

### 6. Ouvert
- Inscriptions ouvertes (ou pas de dates définies)
- ET pas encore complet

---

## Définition : Tournoi "Complet"

Un tournoi est considéré complet si l'une de ces conditions est vraie :

| Variable | Condition |
|----------|-----------|
| `isFullByCompleteTeams` | Nombre d'équipes **complètes** (>= `minPlayersPerTeam` joueurs) >= `maxTeams` |
| `isFullByPlayers` | Nombre total de joueurs >= `maxTeams × playersPerTeam` |

**Note** : Les équipes vides ou incomplètes ne comptent pas comme "places prises".

---

## Définition : Inscriptions Ouvertes

Les inscriptions sont ouvertes si :
- `now >= registrationStartDateTime` ET `now <= registrationEndDateTime`
- OU pas de dates d'inscription définies (considéré comme toujours ouvert)

---

## Schéma de Décision

```
┌─────────────────────────────────────────────────────────────┐
│                    Classement figé ?                        │
│                         OUI → Terminé                       │
│                         NON ↓                               │
├─────────────────────────────────────────────────────────────┤
│                  Date tournoi dépassée ?                    │
│                         OUI → Terminé                       │
│                         NON ↓                               │
├─────────────────────────────────────────────────────────────┤
│         Matchs commencés + (fermé OU complet) ?             │
│                         OUI → En cours                      │
│                         NON ↓                               │
├─────────────────────────────────────────────────────────────┤
│              Avant début des inscriptions ?                 │
│                         OUI → Avenir                        │
│                         NON ↓                               │
├─────────────────────────────────────────────────────────────┤
│                    Tournoi complet ?                        │
│                         NON → Ouvert                        │
│                         OUI ↓                               │
├─────────────────────────────────────────────────────────────┤
│            Liste d'attente taille > 0 ?                     │
│                         NON → Complet                       │
│                         OUI ↓                               │
├─────────────────────────────────────────────────────────────┤
│      Liste d'attente pleine ?                               │
│                         OUI → Complet                       │
│                         NON → Liste d'attente               │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration du Tournoi

| Champ | Description |
|-------|-------------|
| `maxTeams` | Nombre maximum d'équipes |
| `playersPerTeam` | Nombre de joueurs par équipe |
| `minPlayersPerTeam` | Minimum de joueurs pour qu'une équipe soit "complète" |
| `waitingListSize` | Taille de la liste d'attente (0 = désactivée) |

**Capacité max** = `maxTeams × playersPerTeam`

---

## Architecture Client/Serveur

**Important** : Le statut est calculé **uniquement côté serveur** dans `tournament.status.utils.ts`. Le client utilise directement le `status` retourné par l'API, sans recalcul local.

```
Serveur                              Client
┌─────────────────────┐              ┌─────────────────────┐
│ calculateTournament │              │ tournament.status   │
│ Status()            │ ──────────►  │ (utilisé tel quel)  │
│ → status            │   API        │                     │
└─────────────────────┘              └─────────────────────┘
```

---

## Fichiers Concernés

- **Serveur** : `server/src/utils/tournament.status.utils.ts` - Calcul du statut (source de vérité)
- **Client** : `client/src/pages/public/TournamentDetailPage.tsx` - Affichage basé sur `tournament.status`

---

## Phase d'Élimination - Double Tableau

### Types de Tableaux

| Type | Description |
|------|-------------|
| `single` | Tableau d'élimination directe classique |
| `double` | Deux tableaux parallèles : Principal + Consolante |

### Configuration

Le champ `bracketType` dans la configuration du tournoi détermine le type de tableau :
- `'single'` (défaut) : Élimination directe classique
- `'double'` : Double tableau basé sur le classement des poules

### Fonctionnement du Double Tableau

```
Phase de Poules                    Phase d'Élimination
┌─────────────────┐               ┌─────────────────────┐
│    Poule A      │               │  TABLEAU PRINCIPAL  │
│  1. Équipe A1 ──┼──── Top ────► │  (places 1 à N)     │
│  2. Équipe A2 ──┼──── moitié    │                     │
│  3. Équipe A3 ──┼──── Bottom ─► ├─────────────────────┤
│  4. Équipe A4 ──┼──── moitié    │  TABLEAU CONSOLANTE │
└─────────────────┘               │  (places N+1 à 2N)  │
                                  └─────────────────────┘
```

### Répartition des Équipes

1. **Moitié haute** de chaque poule → Tableau Principal
2. **Moitié basse** de chaque poule → Tableau Consolante
3. Croisement des poules pour éviter les rematches précoces (algorithme snake draft)

### Classement Unifié

Le classement final combine les deux tableaux :

| Position | Source |
|----------|--------|
| 1er - Nème | Résultats du Tableau Principal |
| (N+1)ème - 2Nème | Résultats du Tableau Consolante |

**Exemple avec 12 équipes (3 poules de 4)** :
- Tableau Principal : 6 équipes (top 2 de chaque poule) → places 1-6
- Tableau Consolante : 6 équipes (bottom 2 de chaque poule) → places 7-12
- Vainqueur consolante = 7ème au classement général

### Fichiers Concernés (Double Bracket)

- **Types** : `shared/types/match.types.ts` - `BracketType`, `BracketSide`
- **Service** : `server/src/services/elimination.service.ts` - `generateDoubleBracket()`
- **Contrôleur** : `server/src/controllers/admin.controller.ts` - Génération et classement
- **UI Admin** : `client/src/pages/admin/AdminPoolsManagement.tsx` - Sélection du type
- **UI Admin** : `client/src/pages/admin/AdminEliminationManagement.tsx` - Affichage côte à côte
- **UI Public** : `client/src/components/TournamentBracket.tsx` - Affichage public
