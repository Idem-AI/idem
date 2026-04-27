# 🔧 Configuration des Variables d'Environnement

## 🚀 Démarrage Rapide

### 1. Première Installation

```bash
# Main Dashboard
cd apps/main-dashboard
cp .env.development.example .env.development
cp .env.example .env

# Landing Page
cd apps/landing
cp .env.development.example .env.development
cp .env.example .env
```

### 2. Remplir les Valeurs

Éditez les fichiers `.env` et `.env.development` et remplacez les valeurs `your_*_here` par vos vraies clés.

**Variables CRITIQUES à configurer :**

```bash
# Firebase (OBLIGATOIRE)
FIREBASE_API_KEY=votre_nouvelle_cle_firebase
FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
FIREBASE_PROJECT_ID=votre-projet-id
FIREBASE_STORAGE_BUCKET=votre-projet.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
FIREBASE_APP_ID=votre_app_id

# iDeploy (OBLIGATOIRE pour main-dashboard)
IDEPLOY_API_TOKEN=votre_nouveau_token_ideploy
```

### 3. Lancer l'Application

```bash
# Development (génère automatiquement environment.development.ts)
npm start

# Production (génère automatiquement environment.ts)
npm run build
```

## 📁 Structure des Fichiers

```
apps/main-dashboard/
├── .env.example              ✅ Committé (template)
├── .env.development.example  ✅ Committé (template)
├── .env                      ❌ NON committé (production)
├── .env.development          ❌ NON committé (development)
├── src/environments/
│   ├── environment.ts              ❌ NON committé (généré auto)
│   └── environment.development.ts  ❌ NON committé (généré auto)
└── mynode.js                 ✅ Committé (générateur)
```

## 🔄 Workflow

### Development

```bash
npm start
# 1. Exécute automatiquement: npm run env:dev
# 2. Génère: src/environments/environment.development.ts depuis .env.development
# 3. Lance: ng serve
```

### Production

```bash
npm run build
# 1. Exécute automatiquement: npm run env:prod
# 2. Génère: src/environments/environment.ts depuis .env
# 3. Lance: ng build
```

### Génération Manuelle

```bash
# Générer environment.development.ts
npm run env:dev

# Générer environment.ts
npm run env:prod
```

## ⚠️ Règles Importantes

### ✅ À FAIRE

- ✅ Copier `.env.example` vers `.env` pour chaque environnement
- ✅ Remplir les valeurs réelles dans `.env` et `.env.development`
- ✅ Garder `.env.example` à jour avec les nouvelles variables
- ✅ Utiliser des clés différentes pour dev et prod
- ✅ Révoquer immédiatement toute clé exposée

### ❌ À NE JAMAIS FAIRE

- ❌ **JAMAIS** committer les fichiers `.env` (sauf `.env.example`)
- ❌ **JAMAIS** committer les fichiers `environment.ts`
- ❌ **JAMAIS** mettre de vraies clés dans `.env.example`
- ❌ **JAMAIS** partager vos fichiers `.env` par email/Slack
- ❌ **JAMAIS** copier-coller des clés dans le code source

## 🔍 Vérification

### Vérifier que .env est ignoré par Git

```bash
git status
# .env et .env.development ne doivent PAS apparaître
```

### Vérifier que environment.ts est généré

```bash
# Development
npm run env:dev
ls -la src/environments/environment.development.ts
# Doit afficher le fichier avec un commentaire "GÉNÉRÉ AUTOMATIQUEMENT"

# Production
npm run env:prod
ls -la src/environments/environment.ts
# Doit afficher le fichier avec un commentaire "GÉNÉRÉ AUTOMATIQUEMENT"
```

### Vérifier le contenu

```bash
# Vérifier que les clés sont bien chargées
cat src/environments/environment.development.ts
# Doit contenir vos vraies clés (pas "your_*_here")
```

## 🆘 Dépannage

### Erreur : "Fichier .env introuvable"

```bash
# Solution : Créer le fichier depuis le template
cp .env.development.example .env.development
# Puis éditez .env.development avec vos vraies clés
```

### Erreur : "Variables d'environnement manquantes"

```bash
# Solution : Vérifier que toutes les variables requises sont remplies
cat .env.development
# Remplacez toutes les valeurs "your_*_here" par vos vraies clés
```

### Les clés ne sont pas chargées

```bash
# Solution : Régénérer les fichiers environment
npm run env:dev
# Vérifier le contenu
cat src/environments/environment.development.ts
```

## 📝 Variables Disponibles

### Firebase (Toutes les apps)

```bash
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_MEASUREMENT_ID=  # Optionnel
```

### Services (Toutes les apps)

```bash
SERVICES_DOMAIN=https://idem.africa
SERVICES_DASHBOARD_URL=https://console.idem.africa  # ou http://localhost:4200
SERVICES_API_URL=https://api.idem.africa            # ou http://localhost:3001
```

### iDeploy (main-dashboard uniquement)

```bash
IDEPLOY_API_TOKEN=  # Token Laravel Sanctum
```

### Autres

```bash
WAITLIST_URL=https://forms.gle/votre_form_id
IS_BETA=true
ANALYTICS_ENABLED=true  # ou false pour dev
```

## 🔐 Sécurité

### Obtenir de Nouvelles Clés Firebase

1. Firebase Console : https://console.firebase.google.com
2. Sélectionner votre projet (ou créer un nouveau)
3. Project Settings → General
4. Scroll vers "Your apps"
5. Cliquer sur l'icône Web (</>) pour créer une nouvelle app
6. Copier les clés de configuration

### Obtenir un Nouveau Token iDeploy

```bash
cd apps/ideploy
php artisan tinker

# Générer un nouveau token
>>> $user = User::where('email', 'votre@email.com')->first();
>>> $token = $user->createToken('dashboard-prod')->plainTextToken;
>>> echo $token;
# Copier le token affiché
```

## 📚 Documentation Complète

Pour plus de détails, consultez :

- `SECURITY_FIX_GUIDE.md` - Guide complet de sécurisation
- `.env.example` - Template avec toutes les variables
- `mynode.js` - Code du générateur (main-dashboard)
- `scripts/set-env.js` - Code du générateur (landing)

## ✅ Checklist Quotidienne

Avant de commencer à travailler :

- [ ] Fichiers `.env` et `.env.development` existent
- [ ] Toutes les variables requises sont remplies
- [ ] Les clés sont différentes entre dev et prod
- [ ] `git status` ne montre pas de fichiers `.env`
- [ ] `npm start` fonctionne sans erreur

## 🎯 Résultat

Après configuration :

✅ Variables d'environnement sécurisées
✅ Fichiers `.env` non commités
✅ Fichiers `environment.ts` générés automatiquement
✅ Workflow de développement fluide
✅ Aucune clé sensible dans le code source
