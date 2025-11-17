# Configuration GitLab CI/CD pour USM Tournois

Ce document explique comment configurer et utiliser le pipeline GitLab CI/CD pour le projet USM Tournois.

## 📋 Vue d'ensemble du Pipeline

Le pipeline comprend 4 stages principaux :

1. **Test** : Validation du code (lint, type-check, tests)
2. **Build** : Compilation des applications client et serveur
3. **Docker** : Construction des images Docker
4. **Deploy** : Déploiement en staging et production

## 🔧 Configuration Initiale

### 1. Variables CI/CD à configurer dans GitLab

Allez dans **Settings > CI/CD > Variables** de votre projet GitLab et ajoutez les variables suivantes :

#### Variables Docker Registry (optionnelles si vous utilisez GitLab Registry)

- `CI_REGISTRY` : URL du registry Docker (ex: `registry.gitlab.com`)
- `CI_REGISTRY_USER` : Nom d'utilisateur du registry
- `CI_REGISTRY_PASSWORD` : Mot de passe ou token du registry
- `CI_REGISTRY_IMAGE` : Chemin de l'image (ex: `registry.gitlab.com/username/usm-tournois`)

> **Note**: Si vous utilisez le GitLab Container Registry, ces variables sont automatiquement fournies.

#### Variables de Déploiement Staging

- `STAGING_SERVER` : Adresse IP ou nom de domaine du serveur staging (ex: `staging.example.com`)
- `STAGING_USER` : Nom d'utilisateur SSH pour le serveur staging (ex: `deploy`)
- `SSH_PRIVATE_KEY` : Clé SSH privée pour se connecter au serveur (voir section SSH)

#### Variables de Déploiement Production

- `PROD_SERVER` : Adresse IP ou nom de domaine du serveur production
- `PROD_USER` : Nom d'utilisateur SSH pour le serveur production
- `SSH_PRIVATE_KEY` : Même clé SSH ou clé différente selon votre configuration

### 2. Configuration SSH pour le Déploiement

#### Générer une paire de clés SSH (si vous n'en avez pas)

```bash
ssh-keygen -t ed25519 -C "gitlab-ci-deploy" -f ~/.ssh/gitlab_deploy
```

#### Copier la clé publique sur vos serveurs

```bash
# Pour staging
ssh-copy-id -i ~/.ssh/gitlab_deploy.pub user@staging-server

# Pour production
ssh-copy-id -i ~/.ssh/gitlab_deploy.pub user@prod-server
```

#### Ajouter la clé privée à GitLab

1. Copiez le contenu de la clé privée :
   ```bash
   cat ~/.ssh/gitlab_deploy
   ```

2. Dans GitLab : **Settings > CI/CD > Variables**
   - Key: `SSH_PRIVATE_KEY`
   - Value: Collez le contenu de la clé privée
   - Type: `File` ou `Variable`
   - Protected: ✓ (recommandé)
   - Masked: ✗ (ne peut pas être masqué car trop long)

### 3. Configuration des Serveurs de Déploiement

Sur chaque serveur (staging et production), assurez-vous que :

#### Docker et Docker Compose sont installés

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### Le projet est cloné dans le bon répertoire

```bash
# Exemple pour staging
cd /path/to/staging
git clone https://gitlab.com/your-username/usm-tournois.git
cd usm-tournois

# Configurer les fichiers d'environnement
cp .env.example .env
# Éditez .env avec vos variables de production/staging
```

#### Les fichiers d'environnement sont configurés

Créez un fichier `.env` sur le serveur avec les variables nécessaires :

```env
# Firebase
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
# ... autres variables

# Session
SESSION_SECRET=your_session_secret

# Environment
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-domain.com
```

### 4. Personnalisation du Pipeline

#### Modifier les chemins de déploiement

Dans `.gitlab-ci.yml`, mettez à jour les chemins dans les jobs `deploy:staging` et `deploy:production` :

```yaml
cd /path/to/staging/usm-tournois  # Remplacez par votre chemin réel
```

#### Modifier les URLs des environnements

Mettez à jour les URLs dans les sections `environment` :

```yaml
environment:
  name: production
  url: https://your-actual-domain.com  # Votre domaine réel
```

#### Activer/Désactiver des stages

Pour désactiver le build Docker (si vous n'utilisez pas Docker) :

1. Commentez ou supprimez le stage `docker` dans la liste des stages
2. Commentez ou supprimez les jobs `docker:client` et `docker:server`

## 🚀 Utilisation du Pipeline

### Workflow Recommandé

1. **Développement** : Travaillez sur des branches de feature
   ```bash
   git checkout -b feature/ma-nouvelle-fonctionnalite
   # ... développement ...
   git push origin feature/ma-nouvelle-fonctionnalite
   ```

2. **Merge Request** : Créez une MR vers `develop`
   - Les tests (lint, type-check) s'exécutent automatiquement
   - Le pipeline doit passer au vert avant de merger

3. **Staging** : Merge vers `develop`
   - Le pipeline complet s'exécute
   - Déploiement manuel en staging disponible

4. **Production** : Merge vers `main` ou créez un tag
   - Le pipeline complet s'exécute
   - Déploiement manuel en production disponible

### Déclenchement des Jobs

#### Jobs Automatiques

- **Tests** : S'exécutent sur toutes les MR et les branches `main`/`develop`
- **Build** : S'exécutent sur `main`, `develop` et les tags
- **Docker Build** : S'exécutent sur `main`, `develop` et les tags

#### Jobs Manuels

- **Déploiement Staging** : Manuel, disponible sur la branche `develop`
- **Déploiement Production** : Manuel, disponible sur `main` et les tags

Pour déclencher un déploiement manuel :
1. Allez dans **CI/CD > Pipelines**
2. Cliquez sur le pipeline souhaité
3. Cliquez sur le bouton "Play" (▶️) à côté du job de déploiement

## 📊 Monitoring du Pipeline

### Visualiser les Pipelines

- **Liste des pipelines** : CI/CD > Pipelines
- **Détails d'un pipeline** : Cliquez sur un pipeline pour voir tous les jobs
- **Logs d'un job** : Cliquez sur un job pour voir ses logs

### Notifications

Configurez les notifications dans **Settings > Integrations** :
- Email
- Slack
- Discord
- etc.

## 🔍 Troubleshooting

### Le job Docker échoue

**Erreur** : `Cannot connect to the Docker daemon`

**Solution** : Vérifiez que le runner GitLab a accès à Docker et que le service `docker:dind` est bien configuré.

### Le déploiement SSH échoue

**Erreur** : `Permission denied (publickey)`

**Solutions** :
1. Vérifiez que la clé SSH est correctement configurée dans les variables CI/CD
2. Vérifiez que la clé publique est bien dans `~/.ssh/authorized_keys` sur le serveur
3. Testez la connexion SSH manuellement

### Les tests échouent

**Erreur** : Erreurs de lint ou type-check

**Solutions** :
1. Exécutez les tests localement : `npm run lint` et `npm run type-check`
2. Corrigez les erreurs dans votre code
3. Committez et poussez les corrections

### Cache npm lent

Pour nettoyer le cache GitLab CI :
1. Allez dans **CI/CD > Pipelines**
2. Cliquez sur "Clear runner caches"

## 🔐 Sécurité

### Bonnes Pratiques

1. **Variables sensibles** : Utilisez toujours les variables CI/CD de GitLab, jamais en dur dans le code
2. **Protected variables** : Activez "Protected" pour les variables de production
3. **Protected branches** : Protégez les branches `main` et `develop`
4. **審査** : Exigez des revues de code avant les merges

### Scan de Sécurité

Le pipeline inclut un job `security:npm-audit` qui vérifie les vulnérabilités dans les dépendances npm.

## 📚 Ressources

- [Documentation GitLab CI/CD](https://docs.gitlab.com/ee/ci/)
- [GitLab Container Registry](https://docs.gitlab.com/ee/user/packages/container_registry/)
- [GitLab Environments](https://docs.gitlab.com/ee/ci/environments/)
- [Docker Documentation](https://docs.docker.com/)

## 🆘 Support

Pour toute question ou problème :
1. Consultez les logs du pipeline dans GitLab
2. Vérifiez la configuration des variables CI/CD
3. Contactez l'équipe DevOps

---

**Dernière mise à jour** : Novembre 2025
