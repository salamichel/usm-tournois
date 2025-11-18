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

## 🎯 Cas d'Usage Courants

### Tester un nouveau tournoi complet (depuis Docker)

```bash
# 1. Créer un tournoi avec des joueurs
docker exec -it usm-tournois-server npm run test-tournament -- \
  --type classic --teams 8 --with-players 20

# 2. Récupérer l'ID du tournoi créé (affiché dans la console)

# 3. Ajouter plus de joueurs si nécessaire
docker exec -it usm-tournois-server npm run dummy-players -- <tournamentId> 10
```

### Nettoyer après les tests

```bash
# 1. Vérifier ce qui sera supprimé
docker exec -it usm-tournois-server npm run delete-dummy -- --all --dry-run

# 2. Supprimer tous les joueurs factices
docker exec -it usm-tournois-server npm run delete-dummy -- --all
```

### Workflow complet depuis le conteneur

```bash
# Entrer dans le conteneur
docker exec -it usm-tournois-server sh

# Créer un tournoi de test
npm run test-tournament -- --type king --with-players 15

# Ajouter des joueurs supplémentaires
npm run dummy-players -- <tournamentId> 5

# Nettoyer (dry-run d'abord)
npm run delete-dummy -- --all --dry-run
npm run delete-dummy -- --all

# Sortir du conteneur
exit
```

---

## 🏗️ Architecture

### Structure des fichiers

```
server/src/scripts/
├── create-dummy-players.ts   # Création de joueurs factices
├── delete-dummy-players.ts   # Suppression de joueurs factices
├── create-test-tournament.ts # Création de tournois de test
└── README.md                 # Cette documentation
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
