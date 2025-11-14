# USM Tournois - Gestion de Tournois de Volleyball

Application moderne de gestion de tournois de volleyball, refactorisée avec **React**, **TypeScript**, **Vite** et **Express**.

## 🏗️ Architecture

Le projet suit une architecture **client-server** moderne et maintenable :

```
usm-tournois/
├── client/             # Application React (Frontend)
│   ├── src/
│   │   ├── assets/     # Images, fonts, etc.
│   │   ├── components/ # Composants réutilisables
│   │   │   ├── common/ # Boutons, modals, etc.
│   │   │   ├── layout/ # Header, Footer, Sidebar
│   │   │   ├── tournament/
│   │   │   ├── team/
│   │   │   └── admin/
│   │   ├── contexts/   # React Context (Auth, Tournament)
│   │   ├── hooks/      # Custom hooks
│   │   ├── pages/      # Pages/routes
│   │   │   ├── public/
│   │   │   └── admin/
│   │   ├── services/   # API calls
│   │   ├── types/      # TypeScript types
│   │   ├── utils/      # Fonctions utilitaires
│   │   └── styles/     # CSS global
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/             # API Express (Backend)
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middlewares/
│   │   ├── types/
│   │   ├── config/
│   │   └── app.ts
│   ├── package.json
│   └── tsconfig.json
│
├── shared/             # Types partagés client/serveur
│   └── types/
│       ├── user.types.ts
│       ├── tournament.types.ts
│       ├── team.types.ts
│       ├── match.types.ts
│       └── index.ts
│
└── docker-compose.yml
```

## 🚀 Technologies

### Frontend
- **React 18** - Framework UI
- **TypeScript** - Typage statique
- **Vite** - Build tool rapide
- **TailwindCSS** - Framework CSS utilitaire
- **React Router v6** - Routing
- **Axios** - Client HTTP
- **React Hot Toast** - Notifications
- **Lucide React** - Icônes
- **date-fns** - Manipulation de dates

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **TypeScript** - Typage statique
- **Firebase Admin SDK** - Authentification & Firestore
- **Helmet** - Sécurité HTTP headers
- **CORS** - Cross-Origin Resource Sharing
- **Express Session** - Gestion de sessions

### Base de données
- **Firebase Firestore** - Base de données NoSQL

### DevOps
- **Docker & Docker Compose** - Containerisation
- **ESLint & Prettier** - Qualité de code
- **tsx** - Exécution TypeScript

## 📋 Prérequis

- **Node.js** >= 18.x
- **Docker & Docker Compose** (optionnel)
- **Firebase Project** avec Firestore activé
- **serviceAccountKey.json** - Clé de compte de service Firebase

## ⚙️ Installation

### 1. Cloner le repository

```bash
git clone <repository-url>
cd usm-tournois
```

### 2. Configuration Firebase

1. Créez un projet Firebase sur [https://console.firebase.google.com](https://console.firebase.google.com)
2. Activez **Firestore** et **Authentication**
3. Téléchargez le fichier `serviceAccountKey.json` depuis **Paramètres du projet → Comptes de service**
4. Placez le fichier à la racine du projet

### 3. Variables d'environnement

Créez un fichier `.env` à la racine :

```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id

# Optional: Named Firestore database
FIREBASE_DB_FIRESTORE=default

# Server Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_super_secret_session_key_change_this

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173
```

### 4. Installation avec Docker (Recommandé)

```bash
# Lancer tous les services
docker-compose up -d

# Accéder à l'application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000
```

### 5. Installation manuelle

#### Client

```bash
cd client
npm install
npm run dev
```

#### Server

```bash
cd server
npm install
npm run dev
```

## 📚 API Routes

### Authentication
- `POST /api/auth/signup` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `POST /api/auth/logout` - Se déconnecter
- `GET /api/auth/me` - Obtenir l'utilisateur courant
- `PUT /api/auth/change-password` - Changer le mot de passe

### Tournaments
- `GET /api/tournaments` - Liste des tournois
- `GET /api/tournaments/:id` - Détails d'un tournoi
- `POST /api/tournaments/:id/register-player` - S'inscrire comme joueur libre
- `POST /api/tournaments/:id/register-team` - Inscrire une équipe
- `POST /api/tournaments/:id/create-team` - Créer une équipe
- `POST /api/tournaments/:id/join-team` - Rejoindre une équipe
- `POST /api/tournaments/:id/leave-team` - Quitter une équipe

### Teams
- `GET /api/teams/:id` - Détails d'une équipe
- `PUT /api/teams/:id/settings` - Modifier les paramètres
- `POST /api/teams/:id/members` - Ajouter un membre
- `DELETE /api/teams/:id/members/:userId` - Retirer un membre

### Admin
- `GET /api/admin/tournaments` - Gérer les tournois
- `POST /api/admin/tournaments` - Créer un tournoi
- `PUT /api/admin/tournaments/:id` - Modifier un tournoi
- `DELETE /api/admin/tournaments/:id` - Supprimer un tournoi
- `POST /api/admin/tournaments/:id/clone` - Cloner un tournoi
- ... (voir server/src/routes/admin.routes.ts)

### King Format (Nouveau !)
- `GET /api/king/tournaments/:tournamentId/dashboard` - Dashboard King
- `POST /api/king/tournaments/:tournamentId/phase1/start` - Démarrer Phase 1 (4v4)
- `POST /api/king/tournaments/:tournamentId/phase2/start` - Démarrer Phase 2 (3v3)
- `POST /api/king/tournaments/:tournamentId/phase3/start` - Démarrer Phase 3 (2v2 Finale)
- `POST /api/king/matches/:matchId/result` - Enregistrer résultat de match
- `POST /api/king/tournaments/:tournamentId/phase{1,2,3}/reset` - Réinitialiser une phase

## 👑 Format King

Le **format King** est un nouveau type de tournoi avec un système de phases progressives :

### Structure du Tournoi King

**Phase 1 - Filtrage (4v4)**
- 36 joueurs divisés en 3 poules de 12
- 3 tournées par poule
- Équipes formées aléatoirement à chaque tournée
- Top 4 de chaque poule se qualifient (12 qualifiés)

**Phase 2 - Demi-finales (3v3)**
- 12 qualifiés divisés en 2 poules de 6
- Format King of the Beach (KOB) - 5 tours
- Équipes formées pour maximiser la rotation
- Top 4 de chaque poule se qualifient (8 finalistes)

**Phase 3 - Finale (2v2)**
- 8 finalistes en 1 poule unique
- Format KOB - 7 tours
- Chaque joueur joue avec chaque autre exactement 1 fois
- 1 champion est couronné

### Classement King

Le classement est basé sur les performances individuelles :
- Victoires / Défaites
- Sets gagnés / perdus
- Points marqués / encaissés
- Différentiel de sets et points

### API King TypeScript

Tous les types pour le format King sont définis dans `shared/types/king.types.ts` :
- `KingPhase` - Structure d'une phase
- `KingMatch` - Match King avec équipes aléatoires
- `KingPlayerRanking` - Classement individuel
- `KingTournamentData` - Données complètes du tournoi

## 🎨 Composants principaux

### Context Providers
- **AuthContext** - Gestion de l'authentification
- **TournamentContext** - Gestion des tournois

### Pages publiques
- **HomePage** - Liste des tournois
- **TournamentDetailPage** - Détails d'un tournoi
- **LoginPage** - Connexion / Inscription
- **DashboardPage** - Tableau de bord utilisateur
- **ProfilePage** - Profil utilisateur
- **TeamManagementPage** - Gestion d'équipe

### Pages admin
- **AdminDashboard** - Vue d'ensemble admin
- **AdminTournamentsList** - Gestion des tournois
- **AdminTeamsList** - Gestion des équipes
- **AdminUsersList** - Gestion des utilisateurs
- **AdminPoolsManagement** - Gestion des poules
- **AdminEliminationManagement** - Gestion des phases éliminatoires

## 🔒 Sécurité

- **Helmet** - Protection des headers HTTP
- **CORS** - Configuration stricte des origines
- **Rate Limiting** - Protection contre les abus
- **Session-based auth** - Authentification sécurisée
- **Firebase Security Rules** - Contrôle d'accès Firestore
- **Role-based access** - Contrôle basé sur les rôles (player, captain, admin)

## 🧪 Scripts disponibles

### Client
```bash
npm run dev        # Démarrer le serveur de développement
npm run build      # Build pour la production
npm run preview    # Prévisualiser le build
npm run lint       # Linter le code
npm run type-check # Vérifier les types TypeScript
```

### Server
```bash
npm run dev        # Démarrer le serveur de développement
npm run build      # Compiler TypeScript
npm run start      # Démarrer en production
npm run lint       # Linter le code
npm run type-check # Vérifier les types TypeScript
```

## 🌐 Déploiement

### Production Build

```bash
# Build client
cd client
npm run build

# Build server
cd ../server
npm run build

# Démarrer en production
NODE_ENV=production npm start
```

### Docker Production

Créez un `docker-compose.prod.yml` pour la production avec les optimisations nécessaires.

## 📝 Modèles de données

Tous les types TypeScript sont définis dans `/shared/types/` et partagés entre le client et le serveur.

### Principales entités
- **User** - Utilisateur (player, captain, admin)
- **Tournament** - Tournoi avec configuration complète
- **Team** - Équipe avec membres
- **Pool** - Poule de tournoi
- **Match** - Match avec scores
- **EliminationMatch** - Match éliminatoire
- **FinalRanking** - Classement final

## 🛠️ Développement

### Conventions de code
- **TypeScript strict** activé
- **ESLint** configuré pour React et TypeScript
- **Prettier** pour le formatage
- **Imports organisés** avec alias de chemins (@components, @services, etc.)

### Structure des commits
Utilisez des messages de commit clairs et descriptifs :
```
feat: Ajouter la page de détails du tournoi
fix: Corriger le bug d'authentification
refactor: Restructurer les services API
docs: Mettre à jour le README
```

## 📞 Support

Pour toute question ou problème, créez une issue sur GitHub.

## 📄 Licence

MIT

---

**Développé avec ❤️ pour USM Tournois**
