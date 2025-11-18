# Scripts Utilitaires USM Tournois (TypeScript)

Ce dossier contient des scripts utilitaires TypeScript pour faciliter le développement et les tests de l'application. Ces scripts sont conçus pour fonctionner dans l'environnement Docker du serveur.

## 🐳 Utilisation avec Docker

Tous les scripts peuvent être exécutés depuis le conteneur Docker :

```bash
# Format général
docker exec -it usm-tournois-server npm run <script-name> -- [arguments]

# Exemples
docker exec -it usm-tournois-server npm run dummy-players -- tournament123 10
docker exec -it usm-tournois-server npm run delete-dummy -- --all --dry-run
docker exec -it usm-tournois-server npm run test-tournament -- --type king
```

Ou depuis l'intérieur du conteneur :

```bash
# Entrer dans le conteneur
docker exec -it usm-tournois-server sh

# Puis exécuter directement
npm run dummy-players -- tournament123 10
npm run delete-dummy -- --all
npm run test-tournament
```

## 🚀 Résumé Rapide

| Script | Commande | Description |
|--------|----------|-------------|
| **Scénario Complet** | `npm run scenario -- --simulate` | ⭐ Crée TOUT en une commande (tournoi + équipes + matchs) |
| **Nettoyage Global** | `npm run clean-test -- --all` | 🧹 Nettoie tous les tournois de test et joueurs factices |
| **Réinitialiser** | `npm run reset-tournament -- <id> --all` | 🔄 Vide un tournoi (garde la config) |
| **Créer Tournoi** | `npm run test-tournament` | 🏆 Crée un tournoi de test vide |
| **Créer Joueurs** | `npm run dummy-players -- <id> <n>` | 👥 Ajoute N joueurs à un tournoi |
| **Supprimer Joueurs** | `npm run delete-dummy -- --all` | 🗑️ Supprime les joueurs factices |

**Commande la plus utile pour démarrer :**
```bash
docker exec -it usm-tournois-server npm run scenario -- --simulate
```

---

## 📋 Scripts Disponibles

### 1. `create-dummy-players.ts` - Créer des joueurs factices

Crée des joueurs de test avec des comptes Firebase Authentication et les ajoute à un tournoi.

#### Usage

```bash
# Via Docker
docker exec -it usm-tournois-server npm run dummy-players -- <tournamentId> <numberOfPlayers> [options]

# Depuis le conteneur
npm run dummy-players -- <tournamentId> <numberOfPlayers> [options]
```

#### Arguments

- `tournamentId` : ID du tournoi dans lequel ajouter les joueurs
- `numberOfPlayers` : Nombre de joueurs factices à créer

#### Options

- `--prefix <text>` : Préfixe pour les noms des joueurs (défaut: "JoueurFactice")
- `--password <pwd>` : Mot de passe pour les comptes (défaut: "password123")
- `--help, -h` : Affiche l'aide

#### Exemples

```bash
# Créer 10 joueurs pour un tournoi
docker exec -it usm-tournois-server npm run dummy-players -- abc123 10

# Avec un préfixe personnalisé
docker exec -it usm-tournois-server npm run dummy-players -- abc123 5 --prefix "TestPlayer"

# Depuis le conteneur
npm run dummy-players -- abc123 10 --prefix "Dev"
```

#### Caractéristiques

- ✅ Crée des comptes Firebase Authentication
- ✅ Ajoute les utilisateurs à Firestore avec le flag `isDummy: true`
- ✅ Ajoute les joueurs à la collection `unassignedPlayers` du tournoi
- ✅ Génère des niveaux aléatoires (Débutant, Intermédiaire, Confirmé, Expert)
- ✅ Gestion des erreurs et retry automatique
- ✅ TypeScript avec types stricts

---

### 2. `delete-dummy-players.ts` - Supprimer des joueurs factices

Supprime les joueurs factices de Firebase Authentication, Firestore et des tournois.

#### Usage

```bash
# Via Docker
docker exec -it usm-tournois-server npm run delete-dummy -- [options]

# Depuis le conteneur
npm run delete-dummy -- [options]
```

#### Options

- `--all` : Supprime TOUS les joueurs marqués comme `isDummy: true`
- `--prefix <text>` : Supprime uniquement les joueurs avec ce préfixe
- `--tournament <id>` : Supprime les joueurs d'un tournoi spécifique
- `--dry-run` : Mode simulation (affiche ce qui serait supprimé sans supprimer)
- `--help, -h` : Affiche l'aide

#### Exemples

```bash
# Mode simulation (TOUJOURS commencer par ça)
docker exec -it usm-tournois-server npm run delete-dummy -- --all --dry-run

# Supprimer tous les joueurs factices
docker exec -it usm-tournois-server npm run delete-dummy -- --all

# Supprimer les joueurs avec un préfixe spécifique
docker exec -it usm-tournois-server npm run delete-dummy -- --prefix "JoueurFactice"

# Depuis le conteneur
npm run delete-dummy -- --tournament abc123
```

#### Caractéristiques

- ⚠️ Suppression permanente des comptes Firebase Auth
- ⚠️ Suppression des données Firestore
- ⚠️ Suppression des références dans tous les tournois
- ✅ Mode dry-run pour tester avant suppression
- ✅ Délai de sécurité de 3 secondes avant suppression réelle
- ✅ TypeScript avec validation des types

---

### 3. `create-test-tournament.ts` - Créer un tournoi de test

Crée un tournoi de test complet avec toutes les configurations nécessaires.

#### Usage

```bash
# Via Docker
docker exec -it usm-tournois-server npm run test-tournament -- [options]

# Depuis le conteneur
npm run test-tournament -- [options]
```

#### Options

- `--name <text>` : Nom du tournoi (défaut: "Tournoi Test {date}")
- `--type <type>` : Type de tournoi: `king`, `elimination`, `pool`, `classic` (défaut: classic)
- `--teams <number>` : Nombre maximum d'équipes (défaut: 8)
- `--players <number>` : Joueurs par équipe (défaut: 2)
- `--format <format>` : Format: `aller`, `aller-retour` (défaut: aller)
- `--future` : Crée un tournoi futur avec inscriptions ouvertes
- `--past` : Crée un tournoi passé (fermé)
- `--with-players <n>` : Crée aussi N joueurs factices pour ce tournoi
- `--help, -h` : Affiche cette aide

#### Exemples

```bash
# Créer un tournoi simple
docker exec -it usm-tournois-server npm run test-tournament

# Tournoi de type King avec 20 joueurs
docker exec -it usm-tournois-server npm run test-tournament -- --type king --with-players 20

# Tournoi complet avec tout configuré
docker exec -it usm-tournois-server npm run test-tournament -- \
  --name "Test Complet" --type classic --teams 12 --players 4 --with-players 30

# Depuis le conteneur
npm run test-tournament -- --type elimination --teams 16 --future
```

#### Caractéristiques

- ✅ Crée un tournoi avec toutes les configurations nécessaires
- ✅ Gère automatiquement les dates selon le timing (passé/futur)
- ✅ Configure les inscriptions automatiquement
- ✅ Peut créer des joueurs factices automatiquement
- ✅ Marqué avec `isTestTournament: true` pour identification
- ✅ Support de tous les formats de tournoi
- ✅ TypeScript avec types stricts

---

### 4. `clean-test-data.ts` - Nettoyer toutes les données de test

Supprime en masse tous les tournois de test et/ou tous les joueurs factices en une seule commande.

#### Usage

```bash
# Via Docker
docker exec -it usm-tournois-server npm run clean-test -- [options]

# Depuis le conteneur
npm run clean-test -- [options]
```

#### Options

- `--all` : Nettoie TOUT (tournois de test + joueurs factices)
- `--tournaments` : Nettoie uniquement les tournois de test
- `--players` : Nettoie uniquement les joueurs factices
- `--older-than <days>` : Nettoie uniquement les données plus vieilles que N jours
- `--dry-run` : Mode simulation
- `--help, -h` : Affiche l'aide

#### Exemples

```bash
# Mode simulation (TOUJOURS commencer par ça)
docker exec -it usm-tournois-server npm run clean-test -- --all --dry-run

# Nettoyer TOUT
docker exec -it usm-tournois-server npm run clean-test -- --all

# Nettoyer uniquement les tournois de plus de 7 jours
docker exec -it usm-tournois-server npm run clean-test -- --tournaments --older-than 7

# Nettoyer uniquement les joueurs
docker exec -it usm-tournois-server npm run clean-test -- --players

# Depuis le conteneur
npm run clean-test -- --all --dry-run
```

#### Caractéristiques

- ✅ Nettoie les tournois marqués `isTestTournament: true`
- ✅ Nettoie les joueurs marqués `isDummy: true`
- ✅ Supprime toutes les sous-collections (équipes, matchs, poules, etc.)
- ✅ Filtrage par âge avec `--older-than`
- ✅ Mode dry-run pour vérifier avant suppression
- ✅ Compteurs et rapports détaillés

---

### 5. `create-complete-scenario.ts` - Créer un scénario complet

Crée un tournoi complet avec équipes, joueurs et optionnellement matchs simulés. Parfait pour tester rapidement l'application avec des données réalistes.

#### Usage

```bash
# Via Docker
docker exec -it usm-tournois-server npm run scenario -- [options]

# Depuis le conteneur
npm run scenario -- [options]
```

#### Options

- `--name <text>` : Nom du tournoi (défaut: "Scénario Complet {date}")
- `--type <type>` : Type: king, elimination, pool, classic (défaut: classic)
- `--teams <number>` : Nombre d'équipes (défaut: 8)
- `--players <number>` : Joueurs par équipe (défaut: 2)
- `--with-matches` : Créer les poules et matchs
- `--simulate` : Simuler les résultats des matchs
- `--help, -h` : Affiche l'aide

#### Exemples

```bash
# Scénario simple (tournoi + équipes + joueurs)
docker exec -it usm-tournois-server npm run scenario

# Scénario complet avec matchs simulés
docker exec -it usm-tournois-server npm run scenario -- --simulate

# Scénario personnalisé
docker exec -it usm-tournois-server npm run scenario -- \
  --name "Tournoi Complet" --type classic --teams 12 --players 4 --simulate

# Scénario King avec matchs
docker exec -it usm-tournois-server npm run scenario -- \
  --type king --teams 16 --with-matches

# Depuis le conteneur
npm run scenario -- --teams 8 --simulate
```

#### Caractéristiques

- ✅ Crée un tournoi complet configuré
- ✅ Génère automatiquement tous les joueurs nécessaires
- ✅ Crée les équipes avec répartition automatique
- ✅ Optionnel: génère les poules et matchs
- ✅ Optionnel: simule des résultats réalistes
- ✅ Tout en une seule commande
- ✅ Données cohérentes et réalistes

**Ce qu'il crée:**

1. **Tournoi** avec toutes les configurations
2. **Joueurs** (nombre = équipes × joueurs par équipe)
3. **Équipes** avec capitaines et membres
4. **Poules** (si --with-matches) avec répartition automatique
5. **Matchs** (si --with-matches) round-robin par poule
6. **Résultats** (si --simulate) scores aléatoires réalistes

---

### 6. `reset-tournament.ts` - Réinitialiser un tournoi

Réinitialise un tournoi existant en supprimant équipes, matchs et/ou joueurs libres, tout en conservant le tournoi lui-même.

#### Usage

```bash
# Via Docker
docker exec -it usm-tournois-server npm run reset-tournament -- <tournamentId> [options]

# Depuis le conteneur
npm run reset-tournament -- <tournamentId> [options]
```

#### Arguments

- `tournamentId` : ID du tournoi à réinitialiser

#### Options

- `--all` : Réinitialise tout (équipes, matchs, joueurs)
- `--teams` : Supprime uniquement les équipes
- `--matches` : Supprime uniquement les matchs
- `--players` : Supprime uniquement les joueurs libres
- `--dry-run` : Mode simulation
- `--help, -h` : Affiche l'aide

#### Exemples

```bash
# Mode simulation (TOUJOURS commencer par ça)
docker exec -it usm-tournois-server npm run reset-tournament -- tournament123 --all --dry-run

# Réinitialiser complètement
docker exec -it usm-tournois-server npm run reset-tournament -- tournament123 --all

# Supprimer uniquement les équipes et matchs
docker exec -it usm-tournois-server npm run reset-tournament -- tournament123 --teams --matches

# Supprimer uniquement les matchs
docker exec -it usm-tournois-server npm run reset-tournament -- tournament123 --matches

# Depuis le conteneur
npm run reset-tournament -- tournament123 --all
```

#### Caractéristiques

- ✅ Garde le tournoi intact (nom, dates, configuration)
- ✅ Supprime les équipes
- ✅ Supprime les poules et leurs matchs
- ✅ Supprime les matchs d'élimination
- ✅ Supprime le classement final
- ✅ Supprime les joueurs libres
- ✅ Mode dry-run pour tester
- ✅ Permet de réutiliser un tournoi

---

## 🎯 Cas d'Usage Courants

### Créer un scénario complet pour les tests (RECOMMANDÉ)

```bash
# Méthode la plus rapide : tout en une seule commande !
docker exec -it usm-tournois-server npm run scenario -- --simulate

# Cela crée :
# - 1 tournoi complet
# - 8 équipes de 2 joueurs (16 joueurs)
# - Toutes les poules et matchs
# - Résultats simulés

# Variante personnalisée
docker exec -it usm-tournois-server npm run scenario -- \
  --name "Mon Tournoi" --teams 12 --players 4 --simulate
```

### Tester un nouveau tournoi vide (méthode classique)

```bash
# 1. Créer un tournoi avec des joueurs
docker exec -it usm-tournois-server npm run test-tournament -- \
  --type classic --teams 8 --with-players 20

# 2. Récupérer l'ID du tournoi créé (affiché dans la console)

# 3. Ajouter plus de joueurs si nécessaire
docker exec -it usm-tournois-server npm run dummy-players -- <tournamentId> 10
```

### Réinitialiser un tournoi pour recommencer

```bash
# Vérifier ce qui sera supprimé
docker exec -it usm-tournois-server npm run reset-tournament -- tournament123 --all --dry-run

# Réinitialiser (garde le tournoi, supprime tout le reste)
docker exec -it usm-tournois-server npm run reset-tournament -- tournament123 --all

# Le tournoi est maintenant vierge et prêt à être réutilisé
```

### Nettoyer toutes les données de test

```bash
# 1. Voir ce qui sera supprimé
docker exec -it usm-tournois-server npm run clean-test -- --all --dry-run

# 2. Tout supprimer (tournois + joueurs)
docker exec -it usm-tournois-server npm run clean-test -- --all

# 3. Ou uniquement les vieux tournois (> 7 jours)
docker exec -it usm-tournois-server npm run clean-test -- --tournaments --older-than 7
```

### Workflow complet depuis le conteneur

```bash
# Entrer dans le conteneur
docker exec -it usm-tournois-server sh

# Créer un scénario complet
npm run scenario -- --teams 8 --simulate

# Ou créer juste un tournoi
npm run test-tournament -- --type king --with-players 15

# Ajouter des joueurs supplémentaires
npm run dummy-players -- <tournamentId> 5

# Réinitialiser un tournoi
npm run reset-tournament -- <tournamentId> --all --dry-run
npm run reset-tournament -- <tournamentId> --all

# Nettoyer tout (dry-run d'abord)
npm run clean-test -- --all --dry-run
npm run clean-test -- --all

# Sortir du conteneur
exit
```

### Workflow de développement quotidien

```bash
# 🌅 Début de journée : créer environnement de test
docker exec -it usm-tournois-server npm run scenario -- --simulate

# 💻 Pendant le dev : tester des features
docker exec -it usm-tournois-server npm run dummy-players -- tournamentId 5
docker exec -it usm-tournois-server npm run reset-tournament -- tournamentId --matches

# 🌙 Fin de journée : nettoyer
docker exec -it usm-tournois-server npm run clean-test -- --all --dry-run
docker exec -it usm-tournois-server npm run clean-test -- --all
```

---

## 🏗️ Architecture

### Structure des fichiers

```
server/src/scripts/
├── create-dummy-players.ts      # Création de joueurs factices
├── delete-dummy-players.ts      # Suppression de joueurs factices
├── create-test-tournament.ts    # Création de tournois de test
├── clean-test-data.ts           # Nettoyage global des données de test
├── create-complete-scenario.ts  # Création de scénarios complets
├── reset-tournament.ts          # Réinitialisation d'un tournoi
└── README.md                    # Cette documentation
```

### Imports et dépendances

Tous les scripts utilisent :
- `firebase-admin` pour l'authentification et Firestore
- Configuration centralisée depuis `../config/firebase.config.ts`
- TypeScript avec types stricts
- ESM modules (import/export)

### Exécution avec `tsx`

Les scripts sont exécutés avec `tsx` qui permet :
- Exécution directe de TypeScript sans compilation
- Support des ESM modules
- Hot reload en développement (via `tsx watch`)

---

## ⚠️ Avertissements

### Sécurité

- Ces scripts utilisent Firebase Admin SDK avec des privilèges élevés
- Les suppressions sont **DÉFINITIVES** et **IRRÉVERSIBLES**
- Toujours utiliser `--dry-run` avant une suppression massive
- Ne jamais exécuter ces scripts en production sans confirmation

### Docker

- Les scripts s'exécutent dans le contexte du conteneur Docker
- Les fichiers de configuration (`.env`, `serviceAccountKey.json`) doivent être correctement montés
- Le conteneur doit avoir accès à Firebase

### Bonnes Pratiques

1. **Utiliser des préfixes clairs** pour identifier facilement les données de test
2. **Nettoyer régulièrement** les joueurs factices pour éviter la pollution de la base
3. **Toujours tester avec --dry-run** avant une suppression
4. **Documenter les tournois de test** créés pour l'équipe

### Limitations

- Les joueurs factices ont des emails du domaine `@dummy.example.com`
- Les tournois de test sont marqués avec `isTestTournament: true`
- La suppression de joueurs peut prendre du temps si beaucoup de tournois existent
- Nécessite une connexion Firebase configurée

---

## 🔧 Développement

### Ajouter un nouveau script

1. Créer le fichier TypeScript dans `src/scripts/`
2. Ajouter une commande npm dans `package.json`
3. Utiliser les imports depuis `../config/firebase.config`
4. Documenter dans ce README
5. Tester avec `--help` et `--dry-run` si applicable

### Structure recommandée d'un script

```typescript
import { adminAuth, adminDb } from '../config/firebase.config';

interface ScriptOptions {
  // Types des options
}

function showHelp(): void {
  console.log('...');
}

function parseArgs(args: string[]): ScriptOptions {
  // Parse des arguments
}

async function mainFunction(options: ScriptOptions): Promise<void> {
  // Logique principale
}

// Point d'entrée
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  mainFunction(options).catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { mainFunction };
```

### Tester localement (hors Docker)

```bash
cd server
npm run dummy-players -- tournamentId 5
npm run delete-dummy -- --all --dry-run
npm run test-tournament
```

---

## 📞 Support

Pour toute question ou problème :

1. Vérifier la documentation de chaque script avec `--help`
2. Consulter ce README
3. Vérifier les logs Docker avec `docker logs usm-tournois-server`
4. Contacter l'équipe de développement

---

## 🔄 Différences avec les scripts JavaScript (racine)

Ces scripts TypeScript sont :
- ✅ Natifs au serveur Docker
- ✅ Avec types stricts TypeScript
- ✅ Utilisant la configuration centralisée
- ✅ Exécutables directement dans le conteneur
- ✅ Avec meilleure intégration IDE

Les scripts JavaScript à la racine restent disponibles pour l'application legacy.

---

**Dernière mise à jour** : 2025-01-18
