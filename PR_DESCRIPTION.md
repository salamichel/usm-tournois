# Pull Request: Add tournament random player mode with level-balanced team generation

## 🎯 Description

Cette PR ajoute un nouveau mode de tournoi où les joueurs s'inscrivent individuellement et l'admin génère les équipes de manière équilibrée selon les niveaux des joueurs.

## ✨ Fonctionnalités ajoutées

### 1. Nouveau mode d'inscription `registrationMode`
- **Mode 'teams'** : Mode classique où les joueurs créent leurs propres équipes
- **Mode 'random'** : Nouveau mode où l'admin génère les équipes automatiquement

### 2. Algorithme d'équilibrage par niveau (Snake Draft)
- Les joueurs sont triés par niveau : Expert → Confirmé → Moyen → Intermédiaire → Débutant
- Distribution en serpent pour garantir des équipes équilibrées
- Le meilleur joueur de chaque équipe devient capitaine automatiquement
- Support des formats 2v2, 3v3, 4v4, 6v6

**Exemple de distribution Snake Draft:**
```
Tour 1: Équipe 1 (J1-Expert), Équipe 2 (J2-Confirmé), Équipe 3 (J3-Moyen)
Tour 2: Équipe 3 (J4-Moyen), Équipe 2 (J5-Inter), Équipe 1 (J6-Inter) ← sens inverse
Tour 3: Équipe 1 (J7-Débutant), Équipe 2 (J8-Débutant), Équipe 3 (J9-Débutant)
```

### 3. Interface Admin améliorée
- Nouveau bouton **"Joueurs non assignés"** (icône Users 👥) dans la liste des tournois
- Bouton **"Générer les équipes équilibrées"** dans la page joueurs non assignés
- Nouvelle colonne **"Mode"** affichant le type de tournoi
- Badge visuel : 🟣 violet pour mode "Aléatoire", ⚪ gris pour mode "Équipes"

### 4. Sécurité & Validation
- Blocage de la création d'équipes côté serveur en mode 'random'
- Validation du nombre minimum de joueurs
- Messages d'erreur appropriés

### 5. UI utilisateur adaptée
- Masquage du bouton "Créer une équipe" pour les tournois en mode random
- Messages informatifs sur la génération automatique des équipes
- Affichage du nombre de joueurs inscrits

## 🔧 Corrections techniques

### Fix API `/api/admin/tournaments/:id/unassigned-players`
- **Avant**: Retournait `{ data: { unassignedPlayers } }`
- **Après**: Retourne `{ data: { players } }`
- **Impact**: Les joueurs dans Firestore sont maintenant correctement affichés dans l'interface

## 📝 Commits inclus

1. `699476a` - Add random team generation mode for tournaments
   - Ajout du type `RegistrationMode`
   - Formulaire admin avec sélecteur de mode
   - Logique de génération aléatoire initiale
   - Blocage création d'équipes en mode random

2. `a8d9f43` - Implement level-balanced team generation using snake draft
   - Remplacement de l'algorithme aléatoire par snake draft
   - Système de ranking des niveaux
   - Distribution équilibrée

3. `3701402` - Fix unassigned players API and add UI navigation button
   - Correction de la réponse API
   - Ajout bouton navigation dans liste tournois
   - Ajout colonne "Mode"

## 📊 Exemple d'équilibrage

**Avec 8 joueurs pour un tournoi 4v4 :**
- 1 Expert, 1 Confirmé, 2 Moyens, 2 Intermédiaires, 2 Débutants

**Résultat :**
- **Équipe 1**: Expert (capitaine) + Moyen + Intermédiaire + Débutant
- **Équipe 2**: Confirmé (capitaine) + Moyen + Intermédiaire + Débutant

✅ Équipes parfaitement équilibrées !

## 🚀 Comment tester

### Étape 1: Créer un tournoi en mode random
1. Admin > Tournois > Nouveau Tournoi
2. Sélectionner **"Mode d'inscription: Joueurs aléatoires"**
3. Choisir le format (2v2, 3v3, 4v4 ou 6v6)
4. Sauvegarder

### Étape 2: Inscription des joueurs
1. Les joueurs vont sur la page publique du tournoi
2. Cliquent sur **"S'inscrire comme joueur"**
3. ⚠️ Le bouton "Créer une équipe" n'est PAS visible (normal)

### Étape 3: Génération des équipes (Admin)
1. Admin > Tournois
2. Cliquer sur l'icône 👥 (Users) - violet pour mode random
3. Voir la liste des joueurs avec leurs niveaux
4. Cliquer sur **"Générer les équipes équilibrées"**
5. Confirmer
6. ✅ Les équipes sont créées automatiquement !

## 📁 Fichiers modifiés

### Backend (3 fichiers)
- `server/src/controllers/admin.controller.ts`
  - Fonction `generateRandomTeams()` avec snake draft
  - Fix `getUnassignedPlayers()` response
- `server/src/controllers/tournament.controller.ts`
  - Blocage création équipes en mode random
- `server/src/routes/admin.routes.ts`
  - Route POST `/generate-random-teams`

### Frontend (4 fichiers)
- `client/src/pages/admin/AdminTournamentForm.tsx`
  - Sélecteur mode d'inscription
- `client/src/pages/admin/AdminTournamentsList.tsx`
  - Bouton navigation + colonne mode
- `client/src/pages/admin/AdminUnassignedPlayers.tsx`
  - Bouton génération équipes
- `client/src/pages/public/TournamentDetailPage.tsx`
  - UI adaptée (masquage création équipe)
- `client/src/services/admin.service.ts`
  - Service API `generateRandomTeams()`

### Shared (1 fichier)
- `shared/types/tournament.types.ts`
  - Type `RegistrationMode = 'teams' | 'random'`

## 🔒 Impact sur l'existant

✅ **Rétrocompatibilité totale**
- Les tournois existants continuent de fonctionner normalement
- Mode par défaut: `'teams'` (comportement actuel)
- Aucun changement breaking

## ✅ Tests manuels effectués

- ✅ Création de tournoi en mode 'random'
- ✅ Inscription de joueurs individuels
- ✅ Impossibilité de créer des équipes en mode random (API + UI)
- ✅ Génération d'équipes équilibrées avec différents niveaux
- ✅ Affichage correct des joueurs non assignés (fix API)
- ✅ Navigation via bouton dans liste tournois
- ✅ Tournois en mode 'teams' non affectés

## 📸 Screenshots suggérés

1. Liste des tournois avec colonne "Mode" et bouton 👥
2. Page "Joueurs non assignés" avec bouton génération
3. Résultat : équipes équilibrées créées
4. Page publique : pas de bouton "Créer une équipe"

---

**Branch**: `claude/add-tournament-mode-01QasZiPSCsDejDat7bJ3X2t`
**Base**: `main`
