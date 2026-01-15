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
│   │   ├── components/     # Composants React
│   │   │   ├── admin/      # Composants admin (MatchScoreModal, etc.)
│   │   │   ├── common/     # Composants réutilisables (BaseModal, etc.)
│   │   │   └── layout/     # Layout (Header, Footer)
│   │   ├── contexts/       # AuthContext, TournamentContext
│   │   ├── pages/          # Pages (public/, admin/)
│   │   ├── services/       # Couche API (auth, tournament, team, admin)
│   │   ├── hooks/          # Custom hooks réutilisables ⭐
│   │   │   ├── useAsyncData.ts    # Gestion async data fetching
│   │   │   ├── useModal.ts        # Gestion état des modaux
│   │   │   ├── useForm.ts         # Gestion formulaires
│   │   │   ├── useTableData.ts    # Search/filter/sort
│   │   │   └── README.md          # Documentation complète
│   │   └── types/          # Types locaux
├── server/                 # Backend Express
│   ├── src/
│   │   ├── controllers/    # Handlers de requêtes ⭐
│   │   │   ├── admin.tournament.controller.ts    # Gestion tournois
│   │   │   ├── admin.pool.controller.ts          # Gestion poules
│   │   │   ├── admin.elimination.controller.ts   # Phase éliminatoire
│   │   │   ├── admin.team.controller.ts          # Gestion équipes
│   │   │   ├── admin.user.controller.ts          # Gestion utilisateurs
│   │   │   ├── admin.unassigned-players.controller.ts
│   │   │   ├── admin.virtual-users.controller.ts
│   │   │   ├── admin.dashboard.controller.ts
│   │   │   └── admin.helpers.ts                  # Helpers partagés
│   │   ├── routes/         # Définitions des routes API
│   │   ├── services/       # Logique métier
│   │   ├── middlewares/    # Middlewares Express
│   │   ├── utils/          # Utilitaires ⭐
│   │   │   ├── error.utils.ts       # Gestion d'erreurs standardisée
│   │   │   └── firestore.utils.ts   # Utilitaires Firestore
│   │   ├── config/         # Configuration Firebase
│   │   └── scripts/        # Scripts de données de test
├── shared/                 # Types partagés client/serveur
│   └── types/              # Interfaces TypeScript communes
├── public/                 # Assets statiques et uploads
├── REFACTORING_SUMMARY.md  # Documentation du refactoring ⭐
└── claude.md               # Ce fichier - contexte pour Claude
```

⭐ = Nouveaux éléments créés lors du refactoring (Jan 2026)

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
# Gestion des services
docker compose up -d              # Démarrer les services
docker compose down               # Arrêter les services
docker compose logs -f            # Voir les logs
docker compose logs -f server     # Logs server uniquement
docker compose logs -f client     # Logs client uniquement

# Client
docker compose run --rm client npm run build        # Build production
docker compose run --rm client npm run lint         # ESLint
docker compose run --rm client npm run type-check   # Vérification TypeScript

# Server
docker compose run --rm server npm run build        # Compilation TypeScript
docker compose run --rm server npm run lint         # ESLint

# Scripts de test (via Docker)
docker compose run --rm server npm run scenario -- --simulate    # Scénario complet
docker compose run --rm server npm run dummy-players -- <id> 10  # Ajouter joueurs test
docker compose run --rm server npm run test-tournament           # Créer tournoi test
docker compose run --rm server npm run clean-test -- --all       # Nettoyer données test
docker compose run --rm server npm run reset-tournament -- <id>  # Réinitialiser tournoi
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

### Gestion des Erreurs (Server) - NOUVEAU ⭐
```typescript
// Nouvelle approche standardisée (Jan 2026)
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';

export const myController = async (req: Request, res: Response) => {
  try {
    // Validation
    if (!data) {
      ErrorHandlers.validation('Data is required');
    }

    // Not Found
    if (!item) {
      ErrorHandlers.notFound('Item', id);
    }

    // Business logic...
    res.json({ success: true, data });
  } catch (error) {
    handleControllerError(error, 'doing something', 'Failed to do something');
  }
};
```

**Avantages:**
- Logging automatique avec contexte
- Préserve les AppError existantes
- Handlers sémantiques pour erreurs courantes
- Code plus propre et cohérent

### Ancienne Approche (toujours valide)
```typescript
import { AppError } from '../middlewares/error.middleware';
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

### Custom Hooks React - NOUVEAU ⭐

Ces hooks éliminent les patterns répétitifs. Documentation complète: `client/src/hooks/README.md`

#### useAsyncData - Chargement de données
```typescript
import { useAsyncData } from '@/hooks';

const { data, loading, error, refetch } = useAsyncData({
  fetchFn: () => adminService.getAllTournaments(),
  errorMessage: 'Failed to load tournaments',
  dependencies: [], // Re-fetch when these change
});

// Élimine: useState(loading), useState(data), useEffect, try/catch, toast.error
```

#### useModal - Gestion des modaux
```typescript
import { useModal } from '@/hooks';

const editModal = useModal<Tournament>();

// Usage:
<button onClick={() => editModal.open(tournament)}>Edit</button>
<Modal isOpen={editModal.isOpen} onClose={editModal.close} data={editModal.data} />

// Élimine: useState(isOpen), useState(selectedItem), open/close handlers
```

#### useForm - Gestion de formulaires
```typescript
import { useForm } from '@/hooks';

const form = useForm({
  initialValues: { name: '', email: '' },
  validate: (values) => {
    const errors: any = {};
    if (!values.name) errors.name = 'Required';
    return errors;
  },
  onSubmit: async (values) => { await api.create(values); }
});

// Usage dans JSX:
<input value={form.values.name} onChange={form.handleChange('name')} />
{form.touched.name && form.errors.name && <span>{form.errors.name}</span>}

// Élimine: values state, errors state, touched state, change handlers, validation
```

#### useTableData - Search/Filter/Sort
```typescript
import { useTableData } from '@/hooks';

const table = useTableData({
  data: tournaments,
  searchFields: (t) => [t.name, t.location],
  filterFn: (t, filter) => filter === 'all' || t.status === filter,
});

// Usage:
<input value={table.searchQuery} onChange={(e) => table.setSearchQuery(e.target.value)} />
<select value={table.filterValue} onChange={(e) => table.setFilterValue(e.target.value)} />
{table.filteredData.map(...)}

// Élimine: search state, filter state, sort state, filtering logic, sorting logic
```

#### useAsyncSubmit - Soumission de formulaires
```typescript
import { useAsyncSubmit } from '@/hooks';

const { loading, submit } = useAsyncSubmit({
  submitFn: (data) => adminService.createTournament(data),
  successMessage: 'Tournament created!',
  onSuccess: () => navigate('/admin/tournaments'),
});

// Usage:
<button onClick={() => submit(formData)} disabled={loading}>
  {loading ? 'Creating...' : 'Create'}
</button>

// Élimine: loading state, try/catch, toast success/error, navigation
```

### BaseModal - Composant Modal Réutilisable ⭐
```typescript
import BaseModal from '@/components/common/BaseModal';

<BaseModal
  isOpen={isOpen}
  onClose={onClose}
  title="Edit Tournament"
  size="2xl"
  footer={<>
    <button onClick={onClose}>Cancel</button>
    <button onClick={handleSave}>Save</button>
  </>}
>
  {/* Content */}
</BaseModal>

// Features: overlay click, ESC key, body scroll lock, accessibility
// Élimine: ~50 lignes de boilerplate modal
```

### Middlewares d'Authentification
- `isAuthenticated` - Vérifie la session utilisateur
- `isAdmin` - Vérifie le rôle admin
- `isCaptain` - Vérifie le rôle capitaine

### Contrôleurs Admin Spécialisés - NOUVEAU ⭐

L'ancien fichier `admin.controller.ts` (3,879 lignes) a été divisé en contrôleurs spécialisés:

| Contrôleur | Lignes | Fonctions | Responsabilité |
|-----------|--------|-----------|----------------|
| `admin.tournament.controller.ts` | 406 | 6 | CRUD tournois, clonage |
| `admin.pool.controller.ts` | 996 | 13 | Poules, matches, planning |
| `admin.elimination.controller.ts` | 1,086 | 6 | Phase éliminatoire, classement |
| `admin.team.controller.ts` | 456 | 6 | Gestion équipes, génération aléatoire |
| `admin.user.controller.ts` | 242 | 6 | Gestion utilisateurs |
| `admin.unassigned-players.controller.ts` | 136 | 3 | Joueurs non assignés |
| `admin.virtual-users.controller.ts` | 328 | 3 | Comptes virtuels, liaison |
| `admin.dashboard.controller.ts` | 72 | 1 | Statistiques dashboard |
| `admin.helpers.ts` | 32 | helpers | Fonctions helper partagées |

**Avantages:**
- Fichiers plus petits (~417 lignes en moyenne vs 3,879)
- Séparation claire par domaine
- Plus facile à maintenir et tester
- Navigation simplifiée

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

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Profil utilisateur

### Tournois (Public)
- `GET /api/tournaments` - Liste des tournois
- `GET /api/tournaments/:id` - Détails d'un tournoi
- `POST /api/tournaments/:id/register-player` - Inscription joueur
- `POST /api/tournaments/:id/create-team` - Créer une équipe
- `POST /api/tournaments/:id/join-team` - Rejoindre une équipe

### Admin - Tournois
- `GET /api/admin/tournaments` - Liste admin
- `POST /api/admin/tournaments` - Créer un tournoi
- `GET /api/admin/tournaments/:id` - Détails admin
- `PUT /api/admin/tournaments/:id` - Modifier un tournoi
- `DELETE /api/admin/tournaments/:id` - Supprimer un tournoi
- `POST /api/admin/tournaments/:id/clone` - Cloner un tournoi

### Admin - Poules
- `GET /api/admin/tournaments/:id/pools` - Liste des poules
- `POST /api/admin/tournaments/:id/pools` - Créer une poule
- `POST /api/admin/tournaments/:id/pools/:poolId/generate-matches` - Générer matches
- `POST /api/admin/tournaments/:id/pools/distribute-teams` - Distribuer équipes

### Admin - Élimination
- `GET /api/admin/tournaments/:id/elimination` - Matches éliminatoires
- `POST /api/admin/tournaments/:id/generate-elimination` - Générer bracket
- `POST /api/admin/tournaments/:id/freeze-ranking` - Figer classement poules
- `POST /api/admin/tournaments/:id/freeze-elimination-ranking` - Figer classement final

### Admin - Équipes
- `GET /api/admin/tournaments/:id/teams` - Liste des équipes
- `POST /api/admin/tournaments/:id/teams` - Créer une équipe
- `PUT /api/admin/tournaments/:id/teams/:teamId` - Modifier une équipe
- `DELETE /api/admin/tournaments/:id/teams/:teamId` - Supprimer une équipe

### Admin - Utilisateurs
- `GET /api/admin/users` - Liste des utilisateurs
- `POST /api/admin/users` - Créer un utilisateur
- `PUT /api/admin/users/:id` - Modifier un utilisateur
- `DELETE /api/admin/users/:id` - Supprimer un utilisateur

### Formats Spéciaux
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

## Refactoring & Best Practices (Jan 2026) ⭐

### Documentation du Refactoring
Consultez `REFACTORING_SUMMARY.md` pour un récapitulatif complet du refactoring effectué en janvier 2026:
- Division du contrôleur admin massif (3,879 → 9 fichiers)
- Standardisation de la gestion d'erreurs
- Création de hooks React réutilisables
- Composant BaseModal réutilisable
- **Impact total:** ~609 lignes de code dupliqué éliminées

### Best Practices - Server

#### ✅ Utiliser les Utilitaires d'Erreur
```typescript
// ✅ BON
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';

try {
  if (!data) ErrorHandlers.validation('Data required');
  // logic...
} catch (error) {
  handleControllerError(error, 'creating item', 'Failed to create item');
}

// ❌ ÉVITER (old pattern, toujours fonctionnel mais moins bon)
try {
  if (!data) throw new AppError('Data required', 400);
} catch (error) {
  console.error('Error:', error);
  if (error instanceof AppError) throw error;
  throw new AppError('Failed to create', 500);
}
```

#### ✅ Garder les Contrôleurs Focalisés
- Un contrôleur = un domaine fonctionnel
- Viser ~400-600 lignes max par fichier
- Extraire la logique métier dans des services
- Utiliser `admin.helpers.ts` pour les helpers partagés

#### ✅ Import Correct de convertTimestamps
```typescript
// ✅ BON
import { convertTimestamps } from '../utils/firestore.utils';

// ❌ MAUVAIS
import { convertTimestamps } from '../services/match.service'; // N'existe pas ici
```

### Best Practices - Client

#### ✅ Utiliser les Custom Hooks
```typescript
// ✅ BON - Utilise useAsyncData
import { useAsyncData } from '@/hooks';

const { data, loading, refetch } = useAsyncData({
  fetchFn: () => adminService.getAllTournaments(),
  errorMessage: 'Failed to load tournaments'
});

// ❌ ÉVITER - Boilerplate répétitif
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      const response = await adminService.getAllTournaments();
      setData(response);
    } catch (err) {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };
  load();
}, []);
```

#### ✅ Utiliser BaseModal pour Cohérence
```typescript
// ✅ BON
import BaseModal from '@/components/common/BaseModal';

<BaseModal isOpen={isOpen} onClose={onClose} title="Edit Item">
  {/* content */}
</BaseModal>

// ❌ ÉVITER - Dupliquer la structure modal
<div className="fixed inset-0 bg-black bg-opacity-50...">
  <div className="bg-white rounded-lg...">
    <div className="border-b p-4...">
      <h2>Edit Item</h2>
      <button onClick={onClose}><X /></button>
    </div>
    {/* Duplication de ~50 lignes */}
  </div>
</div>
```

#### ✅ Utiliser useModal pour Gestion d'État
```typescript
// ✅ BON
const editModal = useModal<Tournament>();
editModal.open(tournament);

// ❌ ÉVITER
const [editModalOpen, setEditModalOpen] = useState(false);
const [selectedTournament, setSelectedTournament] = useState(null);
const openEditModal = (t) => {
  setSelectedTournament(t);
  setEditModalOpen(true);
};
```

#### ✅ Utiliser useForm pour Formulaires Complexes
```typescript
// ✅ BON - Pour formulaires avec validation
const form = useForm({
  initialValues: { name: '', email: '' },
  validate: (values) => {...},
  onSubmit: async (values) => {...}
});

// ⚠️ OK - Pour formulaires très simples sans validation
const [name, setName] = useState('');
```

### Où Trouver Plus d'Info

- **Hooks React:** `client/src/hooks/README.md` (documentation complète avec exemples)
- **Refactoring:** `REFACTORING_SUMMARY.md` (récapitulatif détaillé, métriques, migration)
- **Gestion d'erreurs:** `server/src/utils/error.utils.ts` (docs inline)
- **BaseModal:** `client/src/components/common/BaseModal.tsx` (JSDoc détaillé)

### Métriques du Refactoring

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Plus gros fichier | 3,879 lignes | 1,086 lignes | -72% |
| Contrôleurs admin | 1 fichier | 9 fichiers | +800% organisation |
| Code dupliqué éliminé | - | ~609 lignes | Net reduction |
| Custom hooks créés | 0 | 5 hooks | Réutilisabilité |
| Documentation ajoutée | - | ~936 lignes | Meilleure DX |
