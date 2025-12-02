# Configuration Google Analytics

Ce projet utilise Google Analytics 4 (GA4) pour suivre l'utilisation de l'application.

## Configuration

### 1. Obtenir votre Measurement ID

1. Connectez-vous à [Google Analytics](https://analytics.google.com/)
2. Accédez à **Admin** (icône d'engrenage en bas à gauche)
3. Dans la colonne **Propriété**, cliquez sur **Flux de données**
4. Sélectionnez votre flux de données web ou créez-en un nouveau
5. Copiez le **Measurement ID** (format: `G-XXXXXXXXXX`)

### 2. Configurer l'application

Créez un fichier `.env` dans le dossier `client/` avec le contenu suivant:

```bash
VITE_API_URL=/api
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Remplacez `G-XXXXXXXXXX` par votre véritable Measurement ID.

## Fonctionnalités

### Tracking automatique des pages

Le tracking des pages est automatique. Chaque fois qu'un utilisateur navigue vers une nouvelle page, un événement de page vue est envoyé à Google Analytics.

### Tracking personnalisé d'événements

Vous pouvez utiliser le service `analyticsService` pour tracker des événements personnalisés:

```typescript
import { analyticsService } from '@services/analytics.service';

// Événement générique
analyticsService.trackEvent('Category', 'Action', 'Label', 123);

// Interaction utilisateur
analyticsService.trackUserInteraction('Button Click', 'Subscribe Button');

// Événement de tournoi
analyticsService.trackTournamentEvent('View Details', tournamentId);

// Événement d'authentification
analyticsService.trackAuthEvent('Login Success');
```

## Fichiers ajoutés

- `src/services/analytics.service.ts` - Service principal pour Google Analytics
- `src/hooks/usePageTracking.ts` - Hook personnalisé pour le tracking automatique des pages
- Modifications dans `src/App.tsx` - Initialisation de GA et tracking des pages

## Confidentialité

Le service Analytics est configuré avec `anonymizeIp: true` pour anonymiser les adresses IP des utilisateurs, conformément aux bonnes pratiques de confidentialité (RGPD).

## Désactivation en développement

Si vous ne souhaitez pas envoyer de données de tracking en développement, ne définissez simplement pas la variable `VITE_GA_MEASUREMENT_ID` dans votre fichier `.env` local. L'application fonctionnera normalement mais n'enverra pas de données à Google Analytics.
