# 🐳 Instructions de Démarrage Docker - USM Tournois

## Problèmes Résolus
✅ Vite configuré pour écouter sur toutes les interfaces (0.0.0.0) dans Docker
✅ Proxy API configuré pour utiliser le nom du service Docker
✅ Domaine `usm-tournois.moka-web.net` autorisé
✅ Serveur Express écoute sur 0.0.0.0 (accessible depuis l'extérieur)
✅ Client utilise le proxy Vite (`/api`) au lieu de `localhost:3000`

## Démarrage Rapide

### 1. Arrêter les conteneurs actuels
```bash
cd /root/usm/tournois-react
docker-compose down
```

### 2. Reconstruire et redémarrer
```bash
docker-compose up --build
```

Ou en mode détaché (arrière-plan):
```bash
docker-compose up --build -d
```

### 3. Vérifier les logs
```bash
# Logs du client
docker logs -f usm-tournois-client

# Logs du serveur
docker logs -f usm-tournois-server

# Tous les logs
docker-compose logs -f
```

## Accès aux Services

- **Frontend React**: http://localhost:5173 ou http://usm-tournois.moka-web.net:5173
- **API Backend**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health

**Note**: Le client React utilise le proxy Vite pour accéder à l'API. Les requêtes à `/api/*` sont automatiquement redirigées vers le serveur Express.

## Changements Effectués

### 1. client/vite.config.ts
```typescript
server: {
  host: true, // ✅ Écoute sur 0.0.0.0 (accessible depuis l'hôte)
  port: 5173,
  strictPort: true,
  allowedHosts: ['usm-tournois.moka-web.net', '.moka-web.net'], // ✅ Autorise l'accès via nom de domaine
  watch: {
    usePolling: true, // ✅ Nécessaire pour Docker
  },
  proxy: {
    '/api': {
      target: 'http://server:3000', // ✅ Utilise le nom du service Docker (réseau interne)
      changeOrigin: true,
    },
  },
}
```

### 2. docker-compose.yml
```yaml
environment:
  - VITE_API_URL=/api  # ✅ Utilise le proxy Vite au lieu de localhost:3000
```

### 3. server/src/app.ts
```typescript
app.listen(PORT, '0.0.0.0', () => {  // ✅ Écoute sur toutes les interfaces
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
```

**Comment ça fonctionne:**
1. Le navigateur accède au frontend via `http://usm-tournois.moka-web.net:5173`
2. Le client React fait des requêtes à `/api/*` (chemin relatif)
3. Le serveur Vite (dans le conteneur client) reçoit ces requêtes
4. Le proxy Vite redirige vers `http://server:3000/api/*` (réseau Docker interne)
5. Le serveur Express répond à la requête

## Dépannage

### Si le port 5173 est déjà utilisé
```bash
# Vérifier les processus utilisant le port
sudo lsof -i :5173
# Arrêter les conteneurs
docker-compose down
# Vérifier qu'aucun conteneur ne tourne
docker ps
```

### Si "Cannot connect to API"
```bash
# Vérifier que le serveur est bien démarré
docker logs usm-tournois-server

# Vérifier la connectivité réseau
docker exec usm-tournois-client ping server
```

### Reconstruction complète (si problèmes persistent)
```bash
# Arrêter tout
docker-compose down -v

# Supprimer les images
docker-compose rm -f

# Nettoyer les volumes
docker volume prune -f

# Reconstruire from scratch
docker-compose build --no-cache
docker-compose up
```

## Vérifications de Santé

### Client (Vite)
Le log devrait afficher:
```
VITE v5.4.21  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: http://172.x.x.x:5173/
```

### Serveur (Express)
Le log devrait afficher:
```
🚀 Server running on http://0.0.0.0:3000
📝 Environment: development
```

## Notes Importantes

1. **Hot Reload**: Les modifications de code devraient se recharger automatiquement grâce à `usePolling: true`

2. **Volumes**: Les dossiers sont montés en volumes, donc les changements dans votre code local seront reflétés dans les conteneurs

3. **Network**: Les services communiquent via le réseau Docker `usm-network`

4. **Proxy API**: Les requêtes `/api/*` du client sont proxifiées vers `http://server:3000/api/*`
