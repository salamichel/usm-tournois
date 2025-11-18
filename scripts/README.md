# Scripts Utilitaires USM Tournois

Ce dossier contient des scripts utilitaires pour faciliter le développement et les tests de l'application de gestion de tournois.

## 📋 Scripts Disponibles

### 1. `create-dummy-players.js` - Créer des joueurs factices

Crée des joueurs de test avec des comptes Firebase Authentication et les ajoute à un tournoi.

#### Usage

```bash
# Via npm (recommandé)
npm run dummy-players -- <tournamentId> <numberOfPlayers> [options]

# Ou directement
node scripts/create-dummy-players.js <tournamentId> <numberOfPlayers> [options]
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
npm run dummy-players -- abc123 10

# Avec un préfixe personnalisé
npm run dummy-players -- abc123 5 --prefix "TestPlayer"

# Avec un mot de passe personnalisé
npm run dummy-players -- abc123 5 --password "Test2024!"
```

#### Caractéristiques

- ✅ Crée des comptes Firebase Authentication
- ✅ Ajoute les utilisateurs à Firestore avec le flag `isDummy: true`
- ✅ Ajoute les joueurs à la collection `unassignedPlayers` du tournoi
- ✅ Génère des niveaux aléatoires (Débutant, Intermédiaire, Confirmé, Expert)
- ✅ Gestion des erreurs et retry automatique
- ✅ Affichage de progression détaillé

---

### 2. `delete-dummy-players.js` - Supprimer des joueurs factices

Supprime les joueurs factices de Firebase Authentication, Firestore et des tournois.

#### Usage

```bash
# Via npm (recommandé)
npm run delete-dummy -- [options]

# Ou directement
node scripts/delete-dummy-players.js [options]
```

#### Options

- `--all` : Supprime TOUS les joueurs marqués comme `isDummy: true`
- `--prefix <text>` : Supprime uniquement les joueurs avec ce préfixe
- `--tournament <id>` : Supprime les joueurs d'un tournoi spécifique
- `--dry-run` : Mode simulation (affiche ce qui serait supprimé sans supprimer)
- `--help, -h` : Affiche l'aide

#### Exemples

```bash
# Supprimer tous les joueurs factices (avec confirmation)
npm run delete-dummy -- --all

# Mode simulation (voir ce qui serait supprimé)
npm run delete-dummy -- --all --dry-run

# Supprimer les joueurs avec un préfixe spécifique
npm run delete-dummy -- --prefix "JoueurFactice"

# Supprimer tous les joueurs d'un tournoi
npm run delete-dummy -- --tournament abc123
```

#### Caractéristiques

- ⚠️ Suppression permanente des comptes Firebase Auth
- ⚠️ Suppression des données Firestore
- ⚠️ Suppression des références dans tous les tournois
- ✅ Mode dry-run pour tester avant suppression
- ✅ Délai de sécurité de 3 secondes avant suppression réelle
- ✅ Affichage détaillé des joueurs à supprimer

---

### 3. `create-test-tournament.js` - Créer un tournoi de test

Crée un tournoi de test complet avec toutes les configurations nécessaires.

#### Usage

```bash
# Via npm (recommandé)
npm run test-tournament -- [options]

# Ou directement
node scripts/create-test-tournament.js [options]
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
- `--help, -h` : Affiche l'aide

#### Exemples

```bash
# Créer un tournoi simple
npm run test-tournament

# Tournoi de type King avec 20 joueurs
npm run test-tournament -- --type king --with-players 20

# Tournoi futur avec 16 équipes
npm run test-tournament -- --name "Tournoi d'été" --teams 16 --future

# Tournoi passé pour tester l'historique
npm run test-tournament -- --past

# Tournoi complet avec tout configuré
npm run test-tournament -- --name "Test Complet" --type classic --teams 12 --players 4 --with-players 30
```

#### Caractéristiques

- ✅ Crée un tournoi avec toutes les configurations nécessaires
- ✅ Gère automatiquement les dates selon le timing (passé/futur)
- ✅ Configure les inscriptions automatiquement
- ✅ Peut créer des joueurs factices automatiquement
- ✅ Marqué avec `isTestTournament: true` pour identification
- ✅ Support de tous les formats de tournoi

---

## 🎯 Cas d'Usage Courants

### Tester un nouveau tournoi complet

```bash
# 1. Créer un tournoi avec des joueurs
npm run test-tournament -- --type classic --teams 8 --with-players 20

# 2. Récupérer l'ID du tournoi créé (affiché dans la console)

# 3. Ajouter plus de joueurs si nécessaire
npm run dummy-players -- <tournamentId> 10
```

### Nettoyer après les tests

```bash
# 1. Vérifier ce qui sera supprimé
npm run delete-dummy -- --all --dry-run

# 2. Supprimer tous les joueurs factices
npm run delete-dummy -- --all

# 3. Supprimer manuellement les tournois de test via l'interface admin
```

### Créer un environnement de test rapide

```bash
# Créer 3 tournois différents avec des joueurs
npm run test-tournament -- --name "Tournoi King" --type king --with-players 15
npm run test-tournament -- --name "Tournoi Classic" --type classic --with-players 20
npm run test-tournament -- --name "Tournoi Élimination" --type elimination --teams 16 --with-players 30
```

---

## ⚠️ Avertissements

### Sécurité

- Ces scripts utilisent Firebase Admin SDK avec des privilèges élevés
- Les suppressions sont **DÉFINITIVES** et **IRRÉVERSIBLES**
- Toujours utiliser `--dry-run` avant une suppression massive
- Ne jamais exécuter ces scripts en production sans confirmation

### Bonnes Pratiques

1. **Utiliser des préfixes clairs** pour identifier facilement les données de test
2. **Nettoyer régulièrement** les joueurs factices pour éviter la pollution de la base
3. **Documenter les tournois de test** créés pour l'équipe
4. **Ne pas partager** les mots de passe de test en clair

### Limitations

- Les joueurs factices ont des emails du domaine `@dummy.example.com`
- Les tournois de test sont marqués avec `isTestTournament: true`
- La suppression de joueurs peut prendre du temps si beaucoup de tournois existent
- Les scripts nécessitent une connexion Firebase configurée

---

## 🔧 Développement

### Ajouter un nouveau script

1. Créer le fichier dans `scripts/`
2. Ajouter une commande npm dans `package.json`
3. Documenter dans ce README
4. Tester avec `--help` et `--dry-run` si applicable

### Structure recommandée

```javascript
// 1. Imports
const { adminAuth, adminDb } = require('../services/firebase');

// 2. Fonction showHelp()
function showHelp() { /* ... */ }

// 3. Fonction parseArgs()
function parseArgs(args) { /* ... */ }

// 4. Fonction principale
async function mainFunction(options) { /* ... */ }

// 5. Point d'entrée
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    mainFunction(options).catch(error => {
        console.error('❌ Erreur fatale:', error);
        process.exit(1);
    });
}

// 6. Export pour réutilisation
module.exports = { mainFunction };
```

---

## 📞 Support

Pour toute question ou problème :

1. Vérifier la documentation de chaque script avec `--help`
2. Consulter ce README
3. Contacter l'équipe de développement

---

**Dernière mise à jour** : 2025-01-18
