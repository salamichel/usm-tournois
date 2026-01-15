# USM Tournois - Claude Code Context

## Description du Projet

Application de gestion de tournois de volleyball (beach/indoor) avec inscription des joueurs, gestion des équipes, phases de poules, phases éliminatoires et classements.

## Stack Technique

### Frontend (client/)
- **React 18** + **TypeScript 5.6** + **Vite 5.4**
- **TailwindCSS 3.4** pour le styling
- **React Router v6** pour le routing
- **Axios** pour les appels API
- **Firebase SDK** pour l'authentification côté client
- **@hello-pangea/dnd** pour le drag-and-drop
- **Lucide React** pour les icônes

### Backend (server/)
- **Express 4.19** + **TypeScript 5.6**
- **Firebase Admin SDK** pour Firestore et authentification
- **express-session** avec cookies HTTPOnly
- **Helmet**, **CORS**, **express-rate-limit** pour la sécurité

### Base de données
- **Firebase Firestore** (NoSQL)

## Structure du Projet

```
usm-tournois/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Composants React (admin/, common/, layout/)
│   │   ├── contexts/       # AuthContext, TournamentContext
│   │   ├── pages/          # Pages (public/, admin/)
│   │   ├── services/       # Couche API (auth, tournament, team, admin)
│   │   ├── hooks/          # Custom hooks
│   │   └── types/          # Types locaux
├── server/                 # Backend Express
│   ├── src/
│   │   ├── controllers/    # Handlers de requêtes
│   │   ├── routes/         # Définitions des routes API
│   │   ├── services/       # Logique métier
│   │   ├── middlewares/    # Middlewares Express
│   │   ├── config/         # Configuration Firebase
│   │   └── scripts/        # Scripts de données de test
├── shared/                 # Types partagés client/serveur
│   └── types/              # Interfaces TypeScript communes
└── public/                 # Assets statiques et uploads
```

## Commandes Utiles

### Client
```bash
cd client
npm run dev          # Serveur de développement Vite
npm run build        # Build production
npm run lint         # ESLint
npm run type-check   # Vérification TypeScript
```

### Server
```bash
cd server
npm run dev          # Serveur Express avec hot reload (tsx watch)
npm run build        # Compilation TypeScript
npm run lint         # ESLint

# Scripts de test
npm run scenario -- --simulate    # Créer un scénario complet avec résultats
npm run dummy-players -- <id> 10  # Ajouter 10 joueurs test
npm run test-tournament           # Créer un tournoi test
npm run clean-test -- --all       # Nettoyer les données de test
npm run reset-tournament -- <id>  # Réinitialiser un tournoi
```

### Docker
```bash
docker-compose up -d              # Démarrer les services
docker-compose logs -f            # Voir les logs
```

## Conventions de Code

### Nommage
- **Fichiers**: camelCase avec suffixes `.service.ts`, `.controller.ts`, `.routes.ts`
- **Composants React**: PascalCase (ex: `AdminDashboard.tsx`)
- **Types/Interfaces**: PascalCase descriptif
- **Constantes**: UPPER_SNAKE_CASE

### Path Aliases
- Client: `@components`, `@services`, `@contexts`, `@hooks`, `@types`, `@utils`
- Server: `@controllers`, `@routes`, `@services`, `@middlewares`, `@config`
- Commun: `@shared`

### Architecture
- **Routes → Controllers → Services** (separation of concerns)
- **asyncHandler** wrapper pour les routes async
- **Context API** pour l'état global (auth, tournaments)
- **Services** pour tous les appels API

## Patterns Importants

### Gestion des Erreurs (Server)
```typescript
import { AppError } from '../utils/appError';
import { asyncHandler } from '../middlewares/error.middleware';

export const myController = asyncHandler(async (req, res) => {
  throw new AppError('Message d\'erreur', 400);
});
```

### Format de Réponse API
```typescript
{
  success: boolean,
  data?: T,
  error?: { message: string, stack?: string }
}
```

### Middlewares d'Authentification
- `isAuthenticated` - Vérifie la session utilisateur
- `isAdmin` - Vérifie le rôle admin
- `isCaptain` - Vérifie le rôle capitaine

### Collections Firestore Principales
- `users` - Profils utilisateurs
- `events` - Tournois (avec sous-collections: teams, pools, matches)
- `clubs` - Clubs
- `seasons` - Saisons

## Formats de Tournoi

1. **Standard**: Phases de poules → Phases éliminatoires
2. **King Format**: Phases progressives (4v4 → 3v3 → 2v2) avec éliminations
3. **Flexible King**: Phases personnalisables avec modes de jeu configurables

## Rôles Utilisateur

- **Player**: Joueur standard
- **Captain**: Capitaine d'équipe (peut enregistrer les résultats)
- **Admin**: Accès complet au dashboard admin

## Endpoints API Principaux

- `POST /api/auth/login` - Connexion
- `GET /api/tournaments` - Liste des tournois
- `GET /api/tournaments/:id` - Détails d'un tournoi
- `POST /api/tournaments/:id/register-player` - Inscription joueur
- `POST /api/admin/tournaments` - Créer un tournoi (admin)
- `GET /api/king/tournaments/:id/dashboard` - Dashboard format King
- `GET /api/flexible-king/tournaments/:id/dashboard` - Dashboard Flexible King

## Configuration Requise

### Variables d'environnement (.env)
```
# Firebase
FIREBASE_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_AUTH_DOMAIN=
# etc.

# Server
PORT=3000
NODE_ENV=development
SESSION_SECRET=
CLIENT_URL=http://localhost:5173
```

### Client (.env)
```
VITE_API_URL=/api
VITE_FIREBASE_MEASUREMENT_ID=
```

## Notes de Développement

- Les types partagés sont dans `/shared/types/` - modifier ici pour client ET server
- Le fichier `serviceAccountKey.json` est requis pour Firebase Admin (non versionné)
- Les uploads sont stockés dans `/public/uploads/`
- Les flags `isDummy` et `isTestTournament` marquent les données de test
- `isRankingFrozen` empêche les modifications après la fin d'un tournoi

## Tests

Pas de framework de test automatisé. Utiliser les scripts de seeding:
- `npm run scenario` pour un scénario complet
- `npm run clean-test` pour nettoyer

## Sécurité

- Sessions HTTPOnly avec expiration 7 jours (rolling)
- Rate limiting: 500 req/15min (dev), 100 req/15min (prod)
- CORS configuré avec whitelist
- Firestore rules avec contrôle d'accès par rôle
