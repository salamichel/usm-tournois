# Configuration Google Analytics

Ce projet utilise Google Analytics 4 (GA4) pour suivre l'utilisation de l'application avec un tracking complet de tous les événements.

## Configuration

### 1. Obtenir votre Measurement ID

#### Via Firebase Console (recommandé si vous utilisez déjà Firebase)
1. Connectez-vous à la [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet
3. Cliquez sur l'icône d'engrenage > **Project settings**
4. Dans l'onglet **General**, trouvez votre **Measurement ID** (format: `G-XXXXXXXXXX`)

#### Via Google Analytics
1. Connectez-vous à [Google Analytics](https://analytics.google.com/)
2. Accédez à **Admin** (icône d'engrenage en bas à gauche)
3. Dans la colonne **Propriété**, cliquez sur **Flux de données**
4. Sélectionnez votre flux de données web ou créez-en un nouveau
5. Copiez le **Measurement ID** (format: `G-XXXXXXXXXX`)

### 2. Configurer l'application

Créez un fichier `.env` dans le dossier `client/` avec le contenu suivant:

```bash
VITE_API_URL=/api
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

Remplacez `G-XXXXXXXXXX` par votre véritable Measurement ID.

**Exemple avec votre ID actuel:**
```bash
VITE_FIREBASE_MEASUREMENT_ID=G-4G55RK9XXS
```

## Événements trackés

### 📊 Tracking automatique

#### Pages vues
- Toutes les navigations de page sont automatiquement trackées via `usePageTracking()`

### 🔐 Authentification

| Événement | Méthode | Description |
|-----------|---------|-------------|
| Login | `trackLogin()` | Connexion utilisateur (email ou virtual account) |
| Signup | `trackSignup()` | Inscription utilisateur (nouveau ou avec compte virtuel) |
| Logout | `trackLogout()` | Déconnexion utilisateur |
| Password Reset Request | `trackPasswordResetRequest()` | Demande de réinitialisation de mot de passe |
| Password Reset Complete | `trackPasswordResetComplete()` | Réinitialisation de mot de passe terminée |
| Password Change | `trackPasswordChange()` | Changement de mot de passe |
| Virtual Account Claim | `trackVirtualAccountClaim()` | Récupération d'un compte virtuel |

### 🏆 Tournois

| Événement | Méthode | Description |
|-----------|---------|-------------|
| View | `trackTournamentView()` | Consultation d'un tournoi |
| List View | `trackTournamentListView()` | Consultation de la liste des tournois |
| Search | `trackTournamentSearch()` | Recherche de tournois |
| Filter | `trackTournamentFilter()` | Filtrage des tournois (type, statut) |
| Share | `trackTournamentShare()` | Partage d'un tournoi (native ou clipboard) |
| Register as Player | `trackTournamentRegisterPlayer()` | Inscription comme joueur |
| Leave | `trackTournamentLeave()` | Désinscription d'un tournoi |
| Join Waiting List | `trackWaitingListJoin()` | Inscription sur liste d'attente |
| Create | `trackTournamentCreate()` | Création de tournoi (admin) |
| Edit | `trackTournamentEdit()` | Modification de tournoi (admin) |
| Delete | `trackTournamentDelete()` | Suppression de tournoi (admin) |
| View Switch | `trackTournamentViewSwitch()` | Changement de vue (détails/résultats) |
| Results Tab | `trackTournamentResultsTab()` | Changement d'onglet résultats (poules/finales/classement) |

### 👥 Équipes

| Événement | Méthode | Description |
|-----------|---------|-------------|
| Create | `trackTeamCreate()` | Création d'équipe |
| Join | `trackTeamJoin()` | Rejoindre une équipe |
| Leave | `trackTeamLeave()` | Quitter une équipe |
| Management View | `trackTeamManagementView()` | Accès à la gestion d'équipe |
| Edit | `trackTeamEdit()` | Modification d'équipe |
| Delete | `trackTeamDelete()` | Suppression d'équipe |
| Add Player | `trackTeamPlayerAdd()` | Ajout d'un joueur |
| Remove Player | `trackTeamPlayerRemove()` | Retrait d'un joueur |
| Toggle Recruitment | `trackTeamRecruitmentToggle()` | Activation/désactivation du recrutement |

### ⚽ Matches

| Événement | Méthode | Description |
|-----------|---------|-------------|
| View | `trackMatchView()` | Consultation d'un match |
| Submit Score | `trackMatchScoreSubmit()` | Soumission d'un score |
| Edit Score | `trackMatchScoreEdit()` | Modification d'un score |

### 👤 Profil & Utilisateur

| Événement | Méthode | Description |
|-----------|---------|-------------|
| Profile View | `trackProfileView()` | Consultation du profil |
| Profile Edit Start | `trackProfileEditStart()` | Début de modification du profil |
| Profile Update | `trackProfileUpdate()` | Mise à jour du profil |
| Dashboard View | `trackDashboardView()` | Consultation du dashboard |

### 🏅 Classement Joueurs

| Événement | Méthode | Description |
|-----------|---------|-------------|
| View | `trackPlayerRankingView()` | Consultation du classement |
| Filter | `trackPlayerRankingFilter()` | Filtrage du classement |
| Sort | `trackPlayerRankingSort()` | Tri du classement |

### 👨‍💼 Administration

| Événement | Méthode | Description |
|-----------|---------|-------------|
| Dashboard View | `trackAdminDashboardView()` | Accès au dashboard admin |
| Tournament List | `trackAdminTournamentListView()` | Liste des tournois admin |
| Tournament Form | `trackAdminTournamentFormView()` | Formulaire tournoi (create/edit) |
| Pools View | `trackAdminPoolsView()` | Gestion des poules |
| Pools Generate | `trackAdminPoolsGenerate()` | Génération des poules |
| Elimination View | `trackAdminEliminationView()` | Gestion des phases éliminatoires |
| User Management | `trackAdminUserManagement()` | Gestion des utilisateurs (list/create/edit/delete) |
| Team Management | `trackAdminTeamManagement()` | Gestion des équipes (list/create/edit/delete) |
| Club Management | `trackAdminClubManagement()` | Gestion des clubs (list/create/edit/delete) |
| Season Management | `trackAdminSeasonManagement()` | Gestion des saisons (list/create/edit/delete) |

### 👑 King & Flexible King

| Événement | Méthode | Description |
|-----------|---------|-------------|
| King Dashboard | `trackKingDashboardView()` | Accès au dashboard King |
| Flexible King Dashboard | `trackFlexibleKingDashboardView()` | Accès au dashboard Flexible King |
| King Configuration | `trackKingConfiguration()` | Configuration King (create/update) |
| Flexible King Configuration | `trackFlexibleKingConfiguration()` | Configuration Flexible King (create/update) |

### 🖱️ Interactions UI

| Événement | Méthode | Description |
|-----------|---------|-------------|
| Button Click | `trackButtonClick()` | Clic sur un bouton |
| Form Submit | `trackFormSubmit()` | Soumission de formulaire (success/error) |
| Modal Open | `trackModalOpen()` | Ouverture de modal |
| Modal Close | `trackModalClose()` | Fermeture de modal |
| Tab Switch | `trackTabSwitch()` | Changement d'onglet |
| Navigation | `trackNavigation()` | Navigation entre pages |

### ❌ Erreurs

| Événement | Méthode | Description |
|-----------|---------|-------------|
| Error | `trackError()` | Erreur applicative |
| API Error | `trackApiError()` | Erreur API (endpoint, status code, message) |

## Utilisation dans le code

### Exemple basique

```typescript
import { analyticsService } from '@services/analytics.service';

// Login
analyticsService.trackLogin('email');

// Création d'équipe
analyticsService.trackTeamCreate(tournamentId, teamName);

// Soumission de score
analyticsService.trackMatchScoreSubmit(matchId, 'pool');
```

### Exemple avec contexte

```typescript
// Bouton avec contexte
<button onClick={() => {
  analyticsService.trackButtonClick('Create Team', 'Tournament Detail');
  handleCreateTeam();
}}>
  Créer une équipe
</button>

// Changement d'onglet
<button onClick={() => {
  analyticsService.trackTabSwitch('teams', 'Tournament Detail');
  setActiveTab('teams');
}}>
  Équipes
</button>
```

### Exemple de tracking de filtres

```typescript
// Track automatique des filtres avec useEffect
useEffect(() => {
  if (searchQuery) {
    analyticsService.trackTournamentSearch(searchQuery);
  }
}, [searchQuery]);

useEffect(() => {
  if (selectedType !== 'all') {
    analyticsService.trackTournamentFilter('type', selectedType);
  }
}, [selectedType]);
```

## Pages avec tracking implémenté

### ✅ Pages publiques
- **LoginPage** : Login, Signup, Forgot Password, Virtual Account Claim
- **ResetPasswordPage** : Password Reset Complete
- **ChangePasswordPage** : Password Change
- **HomePage** : Tournament List View, Search, Filters
- **TournamentDetailPage** : View, Register, Team Join/Create, Waiting List, Share, Match Scores, View Switches, Tabs
- **ProfilePage** : View, Edit Start, Update
- **AuthContext** : Logout

### 🔄 À implémenter (pages restantes)
- **DashboardPage** : Dashboard View
- **PlayerRankingPage** : View, Filters, Sort
- **TeamManagementPage** : Team Management, Player Add/Remove, Recruitment Toggle
- **Toutes les pages Admin** : Dashboard, Forms, Lists, Management

## Fichiers modifiés

### Services
- `client/src/services/analytics.service.ts` - Service complet avec toutes les méthodes de tracking

### Contexts
- `client/src/contexts/AuthContext.tsx` - Tracking logout

### Pages publiques
- `client/src/pages/public/LoginPage.tsx` - Tracking auth complet
- `client/src/pages/public/ResetPasswordPage.tsx` - Tracking reset password
- `client/src/pages/public/ChangePasswordPage.tsx` - Tracking change password
- `client/src/pages/public/HomePage.tsx` - Tracking list, search, filters
- `client/src/pages/public/TournamentDetailPage.tsx` - Tracking complet
- `client/src/pages/public/ProfilePage.tsx` - Tracking profil

## Structure des événements dans Google Analytics

### Format des événements

Tous les événements suivent la structure standard de GA4:

```javascript
{
  category: 'Catégorie',  // Ex: Tournament, Team, Match, Authentication
  action: 'Action',       // Ex: View, Create, Edit, Delete
  label: 'Label',         // Détails supplémentaires (IDs, noms, contexte)
  value: number          // Valeur optionnelle
}
```

### Catégories principales

1. **Authentication** - Tous les événements d'authentification
2. **Tournament** - Événements liés aux tournois
3. **Team** - Événements liés aux équipes
4. **Match** - Événements liés aux matches
5. **Profile** - Événements liés au profil utilisateur
6. **User** - Événements utilisateur généraux
7. **Player Ranking** - Événements de classement
8. **Admin** - Événements d'administration
9. **King** - Événements King
10. **Flexible King** - Événements Flexible King
11. **UI** - Interactions interface utilisateur
12. **Navigation** - Navigations entre pages
13. **Error** - Erreurs
14. **API Error** - Erreurs API

## Confidentialité

Le service Analytics est configuré avec `anonymizeIp: true` pour anonymiser les adresses IP des utilisateurs, conformément aux bonnes pratiques de confidentialité (RGPD).

## Désactivation en développement

Si vous ne souhaitez pas envoyer de données de tracking en développement, ne définissez simplement pas la variable `VITE_FIREBASE_MEASUREMENT_ID` dans votre fichier `.env` local. L'application fonctionnera normalement mais n'enverra pas de données à Google Analytics.

## Rapports Google Analytics

### Rapports suggérés

1. **Engagement utilisateurs**
   - Pages les plus consultées
   - Temps passé par page
   - Taux de rebond

2. **Comportement tournois**
   - Tournois les plus consultés
   - Taux d'inscription
   - Utilisation de la liste d'attente

3. **Comportement équipes**
   - Taux de création d'équipes
   - Taux de rejointe d'équipes existantes
   - Utilisation du recrutement

4. **Activité administrative**
   - Utilisations des fonctionnalités admin
   - Générations de poules
   - Gestion des tournois

5. **Erreurs**
   - Erreurs API les plus fréquentes
   - Erreurs applicatives
   - Taux d'échec des actions

### Événements personnalisés recommandés

Créez des événements personnalisés dans GA4 pour:
- Conversions (inscription tournoi, création équipe)
- Engagement (partage, consultation résultats)
- Parcours utilisateur (inscription -> création équipe -> match)

## Support

Pour toute question sur l'implémentation du tracking, consultez:
- `client/src/services/analytics.service.ts` - Toutes les méthodes disponibles
- Ce document - Documentation complète
- Google Analytics Documentation - [https://developers.google.com/analytics/devguides/collection/ga4](https://developers.google.com/analytics/devguides/collection/ga4)
