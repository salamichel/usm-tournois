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
- ET liste d'attente activée (`waitingListEnabled = true`)
- ET taille maximale de liste d'attente > 0 (`waitingListSize > 0`)
- ET liste d'attente pas pleine (`waitingListCurrentSize < waitingListSize`)

### 5. Complet
- Tournoi complet
- ET (liste d'attente non activée OU liste d'attente pleine)

### 6. Ouvert
- Inscriptions ouvertes (ou pas de dates définies)
- ET pas encore complet

---

## Définition : Tournoi "Complet"

Un tournoi est considéré complet si l'une de ces conditions est vraie :

| Variable | Condition |
|----------|-----------|
| `isFullByCompleteTeams` | Nombre d'équipes **complètes** >= `maxTeams` |
| `isFullByTotalTeams` | Nombre **total** d'équipes (même incomplètes) >= `maxTeams` |
| `isFullByPlayers` | Nombre total de joueurs >= `maxTeams × playersPerTeam` |

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
│      Liste d'attente activée ET taille > 0 ?                │
│                         NON → Complet                       │
│                         OUI ↓                               │
├─────────────────────────────────────────────────────────────┤
│      Liste d'attente pleine ?                               │
│                         OUI → Complet                       │
│                         NON → Liste d'attente               │
└─────────────────────────────────────────────────────────────┘
```

---

## Fichiers Concernés

- **Serveur** : `server/src/utils/tournament.status.utils.ts` - Calcul du statut
- **Client** : `client/src/pages/public/TournamentDetailPage.tsx` - Affichage des boutons d'inscription
