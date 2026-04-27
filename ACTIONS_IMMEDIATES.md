# 🚨 ACTIONS IMMÉDIATES REQUISES

## ⏰ À FAIRE MAINTENANT (URGENT)

### 1. Révoquer les Tokens iDeploy Exposés (5 min)

```bash
cd apps/ideploy
php artisan tinker
```

```php
// Dans tinker
use Laravel\Sanctum\PersonalAccessToken;

// Révoquer le token de production
PersonalAccessToken::where('token', 'LIKE', '2|TnIL6qO9dO6tcK7mpMlEnnICgNKwTCcsH6Pm4rHKdc0ace86%')->delete();

// Révoquer le token de développement
PersonalAccessToken::where('token', 'LIKE', '4|G0hqQBCi1NJ16OYJjEy9HLP1vBlgR2EK6cx1Fa0v5bfb689e%')->delete();

// Générer un nouveau token pour production
$user = User::where('email', 'votre@email.com')->first();
$prodToken = $user->createToken('dashboard-prod')->plainTextToken;
echo "Production Token: " . $prodToken . "\n";

// Générer un nouveau token pour développement
$devToken = $user->createToken('dashboard-dev')->plainTextToken;
echo "Development Token: " . $devToken . "\n";

// Copier ces tokens, vous en aurez besoin à l'étape 3
exit
```

### 2. Créer un Nouveau Projet Firebase (15 min)

**Option A - Nouveau Projet (RECOMMANDÉ)** :

1. Aller sur https://console.firebase.google.com
2. Cliquer sur "Add project"
3. Nom du projet : `idem-production` (ou autre)
4. Activer Google Analytics (optionnel)
5. Créer le projet

**Configurer Authentication** :
1. Dans le nouveau projet → Authentication → Get started
2. Sign-in method → Activer Google
3. Sign-in method → Activer Email/Password (si nécessaire)
4. Authorized domains → Ajouter `idem.africa` et `console.idem.africa`

**Créer une Web App** :
1. Project Settings → General
2. Scroll vers "Your apps"
3. Cliquer sur l'icône Web (</>)
4. App nickname : `idem-web-prod`
5. Cocher "Also set up Firebase Hosting" (optionnel)
6. Register app
7. **COPIER TOUTES LES CLÉS DE CONFIGURATION**

**Répéter pour Development** :
1. Créer un deuxième projet : `idem-development`
2. Même configuration
3. Copier les clés de configuration

### 3. Configurer les Fichiers .env (10 min)

**Main Dashboard - Production** :

```bash
cd apps/main-dashboard
cp .env.example .env
nano .env
```

Remplir avec les clés du projet Firebase **PRODUCTION** :

```bash
FIREBASE_API_KEY=VOTRE_NOUVELLE_CLE_PROD
FIREBASE_AUTH_DOMAIN=idem-production.firebaseapp.com
FIREBASE_PROJECT_ID=idem-production
FIREBASE_STORAGE_BUCKET=idem-production.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=VOTRE_SENDER_ID
FIREBASE_APP_ID=VOTRE_APP_ID
FIREBASE_MEASUREMENT_ID=VOTRE_MEASUREMENT_ID

IDEPLOY_API_TOKEN=NOUVEAU_TOKEN_PROD_ETAPE_1

SERVICES_DOMAIN=https://idem.africa
SERVICES_DASHBOARD_URL=https://console.idem.africa
SERVICES_API_URL=https://api.idem.africa
SERVICES_WEBGEN_URL=https://appgen.idem.africa
SERVICES_DIAGEN_URL=http://chart.idem.africa
SERVICES_IDEPLOY_URL=https://ideploy.idem.africa

WAITLIST_URL=https://forms.gle/gP7fr8te9qMUovad6
IS_BETA=true
ANALYTICS_ENABLED=true
```

**Main Dashboard - Development** :

```bash
cp .env.development.example .env.development
nano .env.development
```

Remplir avec les clés du projet Firebase **DEVELOPMENT** :

```bash
FIREBASE_API_KEY=VOTRE_NOUVELLE_CLE_DEV
FIREBASE_AUTH_DOMAIN=idem-development.firebaseapp.com
FIREBASE_PROJECT_ID=idem-development
FIREBASE_STORAGE_BUCKET=idem-development.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=VOTRE_SENDER_ID
FIREBASE_APP_ID=VOTRE_APP_ID
FIREBASE_MEASUREMENT_ID=VOTRE_MEASUREMENT_ID

IDEPLOY_API_TOKEN=NOUVEAU_TOKEN_DEV_ETAPE_1

SERVICES_DOMAIN=https://idem.africa
SERVICES_DASHBOARD_URL=http://localhost:4200
SERVICES_API_URL=http://localhost:3001
SERVICES_WEBGEN_URL=http://localhost:5173
SERVICES_DIAGEN_URL=http://localhost:3002
SERVICES_IDEPLOY_URL=http://localhost:8000

WAITLIST_URL=https://forms.gle/YourDevGoogleFormUrlHere
IS_BETA=true
ANALYTICS_ENABLED=false
```

**Landing Page - Même chose** :

```bash
cd apps/landing
cp .env.example .env
cp .env.development.example .env.development
# Éditer avec les mêmes clés Firebase
nano .env
nano .env.development
```

### 4. Tester la Configuration (5 min)

```bash
# Main Dashboard
cd apps/main-dashboard
npm run env:dev
cat src/environments/environment.development.ts
# Vérifier que les nouvelles clés sont présentes

npm start
# Doit démarrer sans erreur

# Landing Page
cd apps/landing
npm run env:dev
npm start
# Doit démarrer sans erreur
```

### 5. Mettre à Jour l'API Backend (5 min)

Si votre API utilise Firebase Admin SDK, mettez à jour les credentials :

```bash
cd apps/api
# Télécharger le nouveau service account key depuis Firebase Console
# Project Settings → Service accounts → Generate new private key
# Sauvegarder comme firebase-credentials.json

# Mettre à jour .env
nano .env
```

```bash
FIREBASE_PROJECT_ID=idem-production
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
```

## ⏰ À FAIRE AUJOURD'HUI (IMPORTANT)

### 6. Nettoyer l'Historique Git (30 min)

**ATTENTION** : Coordonnez avec votre équipe avant de faire un force push !

```bash
# Installer BFG Repo-Cleaner
brew install bfg  # macOS
# ou télécharger depuis https://reps-cleaner.github.io/bfg-repo-cleaner/

# Créer un fichier avec les secrets à supprimer
cat > /tmp/secrets.txt << 'EOF'
AIzaSyCsUpHmK5-o4hp8_HldvlaLU2gLOUVeHgY
2|TnIL6qO9dO6tcK7mpMlEnnICgNKwTCcsH6Pm4rHKdc0ace86
4|G0hqQBCi1NJ16OYJjEy9HLP1vBlgR2EK6cx1Fa0v5bfb689e
EOF

# Sauvegarder une copie du repo
cd ..
cp -r idem idem-backup

# Nettoyer le repo
cd idem
bfg --replace-text /tmp/secrets.txt

# Nettoyer Git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Vérifier que les secrets sont supprimés
git log --all --full-history --source --pretty=format:'%h %s' -- '**/environment*.ts' | head -20

# Force push (ATTENTION : prévenir l'équipe)
git push --force --all
git push --force --tags
```

### 7. Configurer Firebase App Check (15 min)

**Firebase Console** :
1. Votre projet → App Check
2. Cliquer sur "Get started"
3. Sélectionner votre Web App
4. Provider : reCAPTCHA v3
5. Aller sur https://www.google.com/recaptcha/admin
6. Créer une nouvelle clé reCAPTCHA v3
7. Domaines : `idem.africa`, `console.idem.africa`
8. Copier la clé du site

**Code (main-dashboard et landing)** :

```bash
# Installer App Check
npm install @angular/fire
```

Ajouter dans `.env` et `.env.development` :

```bash
RECAPTCHA_SITE_KEY=votre_cle_recaptcha_v3
```

Mettre à jour `scripts/set-env.js` pour inclure :

```javascript
recaptcha: {
  siteKey: '${env.RECAPTCHA_SITE_KEY || ''}',
},
```

Mettre à jour `app.config.ts` :

```typescript
import { initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAppCheck(() => {
      const appCheck = initializeAppCheck(undefined, {
        provider: new ReCaptchaV3Provider(environment.recaptcha.siteKey),
        isTokenAutoRefreshEnabled: true
      });
      return appCheck;
    }),
    // ... autres providers
  ]
};
```

### 8. Déployer en Production (10 min)

```bash
# Main Dashboard
cd apps/main-dashboard
npm run build
# Déployer dist/main-dashboard vers votre serveur

# Landing Page
cd apps/landing
npm run build
# Déployer dist/landing vers votre serveur
```

## 📋 Checklist de Vérification

Avant de considérer que c'est terminé :

- [ ] ✅ Tokens iDeploy révoqués (étape 1)
- [ ] ✅ Nouveaux tokens iDeploy générés (étape 1)
- [ ] ✅ Nouveau projet Firebase créé (étape 2)
- [ ] ✅ Firebase Authentication configuré (étape 2)
- [ ] ✅ Fichiers `.env` créés pour main-dashboard (étape 3)
- [ ] ✅ Fichiers `.env` créés pour landing (étape 3)
- [ ] ✅ Toutes les variables remplies avec nouvelles clés (étape 3)
- [ ] ✅ Tests en développement réussis (étape 4)
- [ ] ✅ API backend mise à jour (étape 5)
- [ ] ✅ Historique Git nettoyé (étape 6)
- [ ] ✅ Force push effectué (étape 6)
- [ ] ✅ Firebase App Check configuré (étape 7)
- [ ] ✅ Build production réussi (étape 8)
- [ ] ✅ Déploiement production effectué (étape 8)

## 🎯 Résultat Attendu

Après avoir complété toutes ces étapes :

✅ Anciennes clés révoquées et inutilisables
✅ Nouvelles clés Firebase sécurisées
✅ Nouveaux tokens iDeploy sécurisés
✅ Aucune clé dans le code source
✅ Aucune clé dans l'historique Git
✅ Firebase App Check protège contre les abus
✅ Projet Google Cloud devrait être réactivé
✅ Applications fonctionnelles en dev et prod

## 📞 Support

Si vous rencontrez des problèmes :

1. Consultez `ENV_SETUP_README.md` pour l'utilisation quotidienne
2. Consultez `SECURITY_FIX_GUIDE.md` pour les détails complets
3. Vérifiez Firebase Console pour les erreurs
4. Vérifiez les logs de votre serveur

## ⚠️ IMPORTANT

**NE PAS** :
- ❌ Committer les fichiers `.env`
- ❌ Partager les nouveaux tokens/clés
- ❌ Utiliser les anciennes clés
- ❌ Skip le nettoyage de l'historique Git

**FAIRE** :
- ✅ Révoquer immédiatement les anciennes clés
- ✅ Utiliser des clés différentes pour dev/prod
- ✅ Monitorer Firebase Console pour détecter des abus
- ✅ Configurer Firebase App Check
- ✅ Nettoyer l'historique Git

## 🔐 Sécurité Continue

Après avoir résolu ce problème :

1. Configurer des alertes Firebase pour détecter les abus
2. Réviser régulièrement les règles de sécurité Firebase
3. Monitorer l'utilisation des APIs
4. Faire des audits de sécurité réguliers
5. Former l'équipe aux bonnes pratiques

---

**Temps total estimé : 1h30**

**Priorité : CRITIQUE - À faire immédiatement**
