# Étape 1: Utiliser une image Node.js officielle comme base
# 'alpine' est une version très légère, idéale pour la production
FROM node:18-alpine

# Étape 2: Définir le répertoire de travail à l'intérieur du conteneur
WORKDIR /app

# Étape 3: Copier les fichiers de dépendances
# L'utilisation de '*' permet de copier package.json et package-lock.json (s'il existe)
# C'est la correction clé pour votre erreur.
COPY package*.json ./

# Étape 4: Installer les dépendances de production
# --production ignore les dépendances de développement (devDependencies)
ARG CACHEBUST=1
RUN npm cache clean --force && npm install

# Étape 5: Copier le reste du code de l'application dans le conteneur
COPY . .

# Étape 6: Exposer le port sur lequel l'application va tourner
# La valeur vient du fichier .env, avec 3000 comme valeur par défaut
EXPOSE ${PORT:-3000}

# Étape 7: Nettoyer le cache de module Node.js pour s'assurer que les dernières modifications sont prises en compte
RUN rm -rf /app/node_modules/.cache

# Étape 8: La commande pour démarrer l'application
CMD [ "node", "app.js" ]
