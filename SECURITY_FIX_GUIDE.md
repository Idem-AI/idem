# 🔒 Guide de Sécurisation - Clés Sensibles

## ⚠️ PROBLÈME IDENTIFIÉ

Les clés sensibles suivantes étaient **exposées publiquement** dans le code source :

1. **Firebase API Key** : `AIzaSyCsUpHmK5-o4hp8_HldvlaLU2gLOUVeHgY`
2. **iDeploy API Token (Production)** : `2|TnIL6qO9dO6tcK7mpMlEnnICgNKwTCcsH6Pm4rHKdc0ace86`
3. **iDeploy API Token (Development)** : `4|G0hqQBCi1NJ16OYJjEy9HLP1vBlgR2EK6cx1Fa0v5bfb689e`

**Fichiers modifiés :**

- `apps/main-dashboard/mynode.js` : Générateur de fichiers environment.ts
- `apps/landing/scripts/set-env.js` : Générateur pour landing page
- Fichiers environment.ts générés automatiquement depuis .env
- `apps/main-dashboard/src/environments/environment.ts`
- `apps/main-dashboard/src/environments/environment.development.ts`
- `apps/landing/src/environments/environment.ts`
- `apps/landing/src/environments/environment.development.ts`
- Builds compilés dans `dist/` (SUPPRIMÉS)

## ✅ SOLUTION MISE EN PLACE

### 1. Configuration avec Variables d'Environnement

Les fichiers `environment.ts` sont maintenant **générés automatiquement** depuis des fichiers `.env` qui ne sont **JAMAIS commités**.

### 2. Structure des Fichiers

```
apps/main-dashboard/
├── .env.example              # Template (committé)
├── .env.development.example  # Template dev (committé)
├── .env                      # RÉEL - NON COMMITTÉ
├── .env.development          # RÉEL - NON COMMITTÉ
└── scripts/set-env.js        # Générateur

apps/landing/
├── .env.example              # Template (committé)
├── .env.development.example  # Template dev (committé)
├── .env                      # RÉEL - NON COMMITTÉ
├── .env.development          # RÉEL - NON COMMITTÉ
└── scripts/set-env.js        # Générateur
```

### 3. Workflow Automatique

Les scripts npm génèrent automatiquement les fichiers `environment.ts` :

```bash
# Development
npm run env:dev    # Génère environment.development.ts depuis .env.development
npm start          # Appelle automatiquement env:dev

# Production
npm run env:prod   # Génère environment.ts depuis .env
npm run build      # Appelle automatiquement env:prod
```

## 🚨 ACTIONS IMMÉDIATES REQUISES

### 1. Révoquer les Tokens iDeploy

**CRITIQUE** - Les tokens Laravel Sanctum exposés doivent être révoqués immédiatement :

```bash
# Connectez-vous à votre serveur iDeploy
cd apps/ideploy

# Révoquer les tokens
php artisan tinker
>>> PersonalAccessToken::where('token', 'LIKE', '2|TnIL6qO9dO6tcK7mpMlEnnICgNKwTCcsH6Pm4rHKdc0ace86%')->delete();
>>> PersonalAccessToken::where('token', 'LIKE', '4|G0hqQBCi1NJ16OYJjEy9HLP1vBlgR2EK6cx1Fa0v5bfb689e%')->delete();

# Générer de nouveaux tokens
>>> $user = User::find(1); // Votre utilisateur
>>> $token = $user->createToken('dashboard-prod')->plainTextToken;
>>> echo $token; // Copiez ce nouveau token
```

### 2. Créer un Nouveau Projet Firebase (RECOMMANDÉ)

**Option A - Nouveau Projet (RECOMMANDÉ)** :

1. Créer un nouveau projet Firebase
2. Configurer Firebase Authentication
3. Configurer les règles de sécurité
4. Migrer les utilisateurs si nécessaire

**Option B - Rotation des Clés** :

1. Firebase Console → Project Settings
2. Supprimer l'ancienne Web App
3. Créer une nouvelle Web App
4. Récupérer les nouvelles clés

### 3. Configurer Firebase App Check

Pour protéger votre API Firebase contre les abus :

1. Firebase Console → App Check
2. Activer App Check pour votre Web App
3. Configurer reCAPTCHA v3
4. Mettre à jour le code :

```typescript
// app.config.ts
import { initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAppCheck(() =>
      initializeAppCheck(getApp(), {
        provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
        isTokenAutoRefreshEnabled: true,
      })
    ),
    // ...
  ],
};
```

### 4. Configurer les Fichiers .env

**Pour main-dashboard :**

```bash
cd apps/main-dashboard
cp .env.development.example .env.development
cp .env.example .env

# Éditez .env.development et .env avec vos NOUVELLES clés
nano .env.development
nano .env
```

**Pour landing :**

```bash
cd apps/landing
cp .env.development.example .env.development
cp .env.example .env

# Éditez .env.development et .env avec vos NOUVELLES clés
nano .env.development
nano .env
```

### 5. Nettoyer l'Historique Git (IMPORTANT)

Les clés sont dans l'historique Git. Vous devez les supprimer :

**Option A - BFG Repo-Cleaner (RECOMMANDÉ)** :

```bash
# Installer BFG
brew install bfg  # macOS
# ou télécharger depuis https://reps-cleaner.github.io/bfg-repo-cleaner/

# Créer un fichier avec les secrets à supprimer
cat > secrets.txt << EOF
AIzaSyCsUpHmK5-o4hp8_HldvlaLU2gLOUVeHgY
2|TnIL6qO9dO6tcK7mpMlEnnICgNKwTCcsH6Pm4rHKdc0ace86
4|G0hqQBCi1NJ16OYJjEy9HLP1vBlgR2EK6cx1Fa0v5bfb689e
EOF

# Nettoyer le repo
bfg --replace-text secrets.txt

# Force push (ATTENTION : coordonnez avec votre équipe)
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
```

**Option B - git-filter-repo** :

```bash
# Installer git-filter-repo
pip install git-filter-repo

# Supprimer les fichiers sensibles de l'historique
git filter-repo --path apps/main-dashboard/src/environments/environment.ts --invert-paths
git filter-repo --path apps/landing/src/environments/environment.ts --invert-paths

# Force push
git push --force --all
```

### 6. Configurer les Secrets GitHub Actions

Si vous utilisez CI/CD, configurez les secrets :

1. GitHub → Settings → Secrets and variables → Actions
2. Ajouter les secrets :
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - etc.

3. Mettre à jour `.github/workflows/*.yml` :

```yaml
- name: Generate environment files
  run: |
    echo "FIREBASE_API_KEY=${{ secrets.FIREBASE_API_KEY }}" >> .env
    echo "FIREBASE_AUTH_DOMAIN=${{ secrets.FIREBASE_AUTH_DOMAIN }}" >> .env
    # ... autres secrets
  working-directory: apps/main-dashboard
```

## 📋 Checklist de Sécurité

- [ ] Révoquer les tokens iDeploy exposés
- [ ] Créer un nouveau projet Firebase OU rotation des clés
- [ ] Configurer Firebase App Check
- [ ] Créer les fichiers `.env` et `.env.development` pour main-dashboard
- [ ] Créer les fichiers `.env` et `.env.development` pour landing
- [ ] Remplir les fichiers `.env` avec les NOUVELLES clés
- [ ] Tester en développement : `npm start`
- [ ] Tester en production : `npm run build`
- [ ] Nettoyer l'historique Git avec BFG ou git-filter-repo
- [ ] Force push (coordonner avec l'équipe)
- [ ] Configurer les secrets GitHub Actions
- [ ] Vérifier que les builds ne contiennent plus les anciennes clés
- [ ] Monitorer Firebase Console pour détecter des abus

## 🔐 Bonnes Pratiques

1. **JAMAIS** committer de fichiers `.env` (sauf `.env.example`)
2. **TOUJOURS** utiliser des variables d'environnement pour les secrets
3. **TOUJOURS** révoquer les clés exposées immédiatement
4. **TOUJOURS** utiliser Firebase App Check pour les apps publiques
5. **TOUJOURS** configurer des règles de sécurité Firebase strictes
6. **TOUJOURS** monitorer l'utilisation de vos APIs

## 📞 Support

Si vous avez des questions ou besoin d'aide :

1. Consultez la documentation Firebase : https://firebase.google.com/docs/web/setup
2. Consultez la documentation Laravel Sanctum : https://laravel.com/docs/sanctum
3. Contactez l'équipe de sécurité

## 🎯 Résultat Attendu

Après avoir suivi ce guide :

✅ Aucune clé sensible dans le code source
✅ Fichiers `.env` ignorés par Git
✅ Fichiers `environment.ts` générés automatiquement
✅ Anciennes clés révoquées
✅ Nouvelles clés sécurisées
✅ Historique Git nettoyé
✅ CI/CD configuré avec secrets
✅ Firebase App Check activé
✅ Projet Google Cloud réactivé
