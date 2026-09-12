# 🔧 Configuration Variables d'Environnement - Main Dashboard

## 🚀 Démarrage Rapide

### 1. Créer les fichiers .env

```bash
# Copier les templates
cp .env.example .env
cp .env.development.example .env.development
```

### 2. Remplir les valeurs

Éditez `.env` et `.env.development` et remplacez toutes les valeurs `your_*_here` par vos vraies clés.

**Variables CRITIQUES :**

```bash
# Firebase (OBLIGATOIRE)
FIREBASE_API_KEY=votre_nouvelle_cle_firebase
FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
FIREBASE_PROJECT_ID=votre-projet-id
FIREBASE_STORAGE_BUCKET=votre-projet.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
FIREBASE_APP_ID=votre_app_id

# iDeploy (OBLIGATOIRE)
IDEPLOY_API_TOKEN=votre_nouveau_token_ideploy
```

### 3. Lancer l'application

```bash
# Development (génère automatiquement environment.development.ts)
npm start

# Production (génère automatiquement environment.ts)
npm run build
```

## 🔄 Comment ça fonctionne

### Fichier mynode.js

Le fichier `mynode.js` à la racine du projet :
1. Lit les variables depuis `.env` ou `.env.development`
2. Valide que toutes les variables requises sont présentes
3. Génère `src/environments/environment.ts` ou `environment.development.ts`

### Workflow automatique

```bash
npm start
# ↓
# 1. Exécute: npm run env:dev (prestart hook)
# 2. Lance: node mynode.js
# 3. Génère: src/environments/environment.development.ts
# 4. Lance: ng serve
```

```bash
npm run build
# ↓
# 1. Exécute: npm run env:prod (prebuild hook)
# 2. Lance: NODE_ENV=production node mynode.js
# 3. Génère: src/environments/environment.ts
# 4. Lance: ng build
```

## 📁 Structure des fichiers

```
apps/main-dashboard/
├── .env.example              ✅ Committé (template)
├── .env.development.example  ✅ Committé (template)
├── .env                      ❌ NON committé (vos vraies clés prod)
├── .env.development          ❌ NON committé (vos vraies clés dev)
├── mynode.js                 ✅ Committé (générateur)
└── src/environments/
    ├── environment.ts              ❌ NON committé (généré auto)
    └── environment.development.ts  ❌ NON committé (généré auto)
```

## 🛠️ Commandes disponibles

```bash
# Générer environment.development.ts manuellement
npm run env:dev

# Générer environment.ts manuellement
npm run env:prod

# Démarrer en dev (génère auto puis lance)
npm start

# Build production (génère auto puis build)
npm run build
```

## ⚠️ Règles Importantes

### ✅ À FAIRE

- ✅ Créer `.env` et `.env.development` depuis les templates
- ✅ Remplir avec vos vraies clés (pas les valeurs `your_*_here`)
- ✅ Utiliser des clés différentes pour dev et prod
- ✅ Vérifier que `git status` n'affiche pas les fichiers `.env`

### ❌ À NE JAMAIS FAIRE

- ❌ **JAMAIS** committer `.env` ou `.env.development`
- ❌ **JAMAIS** committer `src/environments/environment*.ts`
- ❌ **JAMAIS** mettre de vraies clés dans `.env.example`
- ❌ **JAMAIS** modifier manuellement `environment.ts` (il sera écrasé)

## 🔍 Vérification

### Vérifier que .env est ignoré

```bash
git status
# .env et .env.development ne doivent PAS apparaître
```

### Vérifier que environment.ts est généré

```bash
npm run env:dev
cat src/environments/environment.development.ts
# Doit contenir vos vraies clés et le commentaire "GÉNÉRÉ AUTOMATIQUEMENT"
```

## 🆘 Dépannage

### Erreur : "Fichier .env introuvable"

```bash
# Solution
cp .env.development.example .env.development
nano .env.development  # Remplir avec vos vraies clés
```

### Erreur : "Variables d'environnement manquantes"

```bash
# Vérifier le contenu
cat .env.development

# Assurez-vous que TOUTES les variables sont remplies
# et ne contiennent pas "your_*_here"
```

### Les clés ne sont pas chargées

```bash
# Régénérer
npm run env:dev

# Vérifier
cat src/environments/environment.development.ts
```

## 📝 Variables disponibles

Voir `.env.example` pour la liste complète avec descriptions.

**Principales variables :**
- `FIREBASE_*` : Configuration Firebase (7 variables)
- `IDEPLOY_API_TOKEN` : Token Laravel Sanctum pour iDeploy
- `SERVICES_*_URL` : URLs des différents services
- `WAITLIST_URL` : URL du formulaire waitlist
- `IS_BETA` : Mode beta (true/false)
- `ANALYTICS_ENABLED` : Analytics activé (true/false)

## 🔐 Sécurité

### Obtenir de nouvelles clés Firebase

1. https://console.firebase.google.com
2. Créer un nouveau projet (ou sélectionner existant)
3. Project Settings → General → Your apps
4. Ajouter une Web App ou copier les clés existantes

### Obtenir un nouveau token iDeploy

```bash
cd ../ideploy
php artisan tinker

>>> $user = User::where('email', 'votre@email.com')->first();
>>> $token = $user->createToken('dashboard-dev')->plainTextToken;
>>> echo $token;
# Copier le token affiché
```

## ✅ Checklist

Avant de démarrer :

- [ ] Fichiers `.env` et `.env.development` créés
- [ ] Toutes les variables remplies (pas de `your_*_here`)
- [ ] Clés Firebase valides
- [ ] Token iDeploy valide
- [ ] `git status` ne montre pas `.env`
- [ ] `npm run env:dev` fonctionne sans erreur
- [ ] `npm start` démarre correctement

## 📚 Documentation

- `../../SECURITY_FIX_GUIDE.md` - Guide complet sécurisation
- `../../ENV_SETUP_README.md` - Guide général
- `../../ACTIONS_IMMEDIATES.md` - Actions urgentes
- `.env.example` - Template avec toutes les variables
- `mynode.js` - Code source du générateur
