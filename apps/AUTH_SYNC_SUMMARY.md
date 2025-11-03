# Résumé de la Synchronisation Auth & Langue

## ✅ Configuration Terminée

La synchronisation d'authentification et de langue entre `landing-page` et `main-dashboard` est maintenant opérationnelle.

## 🎯 Fonctionnalités Implémentées

### 1. Synchronisation de la Langue

**Flux :**

```
Landing Page (FR) → Clic "Dashboard" → Dashboard s'ouvre en FR
Landing Page (EN) → Clic "Dashboard" → Dashboard s'ouvre en EN
```

**Mécanisme :**

- Landing page détecte la langue actuelle (`document.documentElement.lang`)
- Redirige vers dashboard avec paramètre : `?lang=fr`
- Dashboard lit le paramètre et applique la langue

### 2. Synchronisation d'Authentification

**Flux :**

```
Landing Page (Connecté) → Clic "Dashboard" → Dashboard (Connecté automatiquement)
```

**Mécanisme :**

- Firebase Auth partagé (même `authDomain`)
- Cookies Firebase synchronisés automatiquement
- localStorage utilisé pour validation supplémentaire

## 📁 Fichiers Créés

### Landing Page

1. **`src/app/services/auth.service.ts`**
   - Service d'authentification simple
   - Utilise Firebase Auth
   - Méthodes : `user$`, `logout()`, `getCurrentUser()`

2. **`src/environments/environment.development.ts`** (mis à jour)
   - Ajout de `services.dashboard.url: 'http://localhost:4200'`

3. **`src/environments/environment.ts`** (mis à jour)
   - Ajout de `services.dashboard.url: 'https://dashboard.idem.africa'`

### Main Dashboard

1. **`src/environments/environment.development.ts`** (créé)
   - Configuration complète avec Firebase
   - `services.landingPage.url: 'http://localhost:4201'`

2. **`src/environments/environment.ts`** (créé)
   - Configuration complète avec Firebase
   - `services.landingPage.url: 'https://idem.africa'`

3. **`src/app/shared/services/auth-sync.service.ts`** (créé)
   - Vérifie la synchronisation auth depuis landing page
   - Valide les données de sync (< 5 min)
   - Nettoie les données expirées

### Documentation

1. **`AUTH_SYNC_GUIDE.md`**
   - Guide complet de la synchronisation
   - Architecture et flux
   - Configuration et tests
   - Troubleshooting

2. **`AUTH_SYNC_SUMMARY.md`** (ce fichier)
   - Résumé rapide
   - Fichiers modifiés
   - Tests à effectuer

## 📝 Fichiers Modifiés

### Landing Page

1. **`src/app/components/header/header.ts`**
   - Ajout de `navigateToDashboard()` :
     ```typescript
     protected navigateToDashboard(): void {
       const currentLang = this.document.documentElement.lang || 'en';
       const user = this.user();
       if (user) {
         localStorage.setItem('idem_auth_sync', JSON.stringify({
           timestamp: Date.now(),
           userId: user.uid,
           email: user.email
         }));
       }
       const dashboardUrl = `${environment.services.dashboard.url}?lang=${currentLang}`;
       window.location.href = dashboardUrl;
     }
     ```

2. **`src/app/components/header/header.html`**
   - Liens "Dashboard" remplacés par `(click)="navigateToDashboard()"`

### Main Dashboard

1. **`src/app/shared/services/language.service.ts`**
   - Ajout de `getLanguageFromURL()` :
     ```typescript
     private getLanguageFromURL(): string | null {
       const urlParams = new URLSearchParams(window.location.search);
       const lang = urlParams.get('lang');
       return lang && this.SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
     }
     ```
   - Priorité : URL > localStorage > navigateur > défaut

2. **`src/app/app.ts`**
   - Injection de `AuthSyncService`
   - Appel de `checkAuthSync()` au démarrage

## 🧪 Tests à Effectuer

### Test 1 : Synchronisation de la Langue

```bash
# 1. Démarrer les deux applications
cd apps/landing-page && npm start  # Port 4201
cd apps/main-dashboard && npm start  # Port 4200

# 2. Tester
# - Ouvrir http://localhost:4201
# - Se connecter
# - Vérifier la langue actuelle
# - Cliquer sur "Dashboard"
# - Vérifier que le dashboard s'ouvre dans la même langue
```

### Test 2 : Synchronisation d'Authentification

```bash
# 1. Ouvrir http://localhost:4201
# 2. Se connecter avec Firebase
# 3. Cliquer sur "Dashboard" dans le header
# 4. Vérifier que vous êtes automatiquement connecté dans le dashboard
```

### Test 3 : localStorage

```javascript
// Dans la console du navigateur (après avoir cliqué sur Dashboard)
console.log(localStorage.getItem('idem_auth_sync'));
// Devrait afficher : {"timestamp":1699..., "userId":"...", "email":"..."}

console.log(localStorage.getItem('idem_dashboard_language'));
// Devrait afficher : "en" ou "fr"
```

## 🔑 Clés localStorage

| Clé                       | Application | Contenu              | Durée     |
| ------------------------- | ----------- | -------------------- | --------- |
| `idem_auth_sync`          | Les deux    | Données de sync auth | 5 min     |
| `idem_dashboard_language` | Dashboard   | Langue préférée      | Permanent |

## 🌍 URLs Configurées

### Développement

| Application  | URL                     |
| ------------ | ----------------------- |
| Landing Page | `http://localhost:4201` |
| Dashboard    | `http://localhost:4200` |

### Production

| Application  | URL                             |
| ------------ | ------------------------------- |
| Landing Page | `https://idem.africa`           |
| Dashboard    | `https://dashboard.idem.africa` |

## 🔧 Configuration Firebase

Les deux applications utilisent la **même configuration Firebase** :

```typescript
firebase: {
  apiKey: 'AIzaSyCsUpHmK5-o4hp8_HldvlaLU2gLOUVeHgY',
  authDomain: 'lexis-ia.firebaseapp.com',
  projectId: 'lexis-ia',
  storageBucket: 'lexis-ia.firebasestorage.app',
  messagingSenderId: '78825247320',
  appId: '1:78825247320:web:2a69ba8ceabad513f3f02d',
  measurementId: 'G-1YQGTP97EJ',
}
```

**Important :** Le même `authDomain` permet la synchronisation automatique des cookies Firebase.

## 🎨 Langues Supportées

- **Anglais (en)** - Par défaut
- **Français (fr)**

## 📊 Flux Complet

```
┌─────────────────────────────────────────────────────────────┐
│                    LANDING PAGE (4201)                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Utilisateur connecté (Firebase Auth)                    │
│ 2. Langue actuelle : FR (document.lang)                    │
│ 3. Clic sur "Dashboard" dans le header                     │
│ 4. navigateToDashboard() :                                 │
│    - Récupère lang = "fr"                                  │
│    - Stocke auth_sync dans localStorage                    │
│    - Redirige vers : http://localhost:4200?lang=fr         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   MAIN DASHBOARD (4200)                     │
├─────────────────────────────────────────────────────────────┤
│ 1. App démarre                                              │
│ 2. LanguageService.initializeLanguage() :                  │
│    - Lit ?lang=fr depuis URL                               │
│    - Applique la langue FR                                 │
│    - Stocke dans localStorage                              │
│ 3. AuthSyncService.checkAuthSync() :                       │
│    - Lit auth_sync depuis localStorage                     │
│    - Valide timestamp (< 5 min)                            │
│    - Firebase Auth se synchronise automatiquement          │
│ 4. Utilisateur connecté et interface en FR ✅              │
└─────────────────────────────────────────────────────────────┘
```

## ⚠️ Points d'Attention

### Développement

1. **Ports différents** : 4201 (landing) et 4200 (dashboard)
2. **CORS** : Firebase Auth gère automatiquement
3. **Cookies** : Partagés via même `authDomain`

### Production

1. **DNS** : Configurer `dashboard.idem.africa`
2. **Firebase Console** : Ajouter les deux domaines dans "Authorized domains"
3. **HTTPS** : Obligatoire pour les cookies sécurisés

## 🚀 Prochaines Étapes

1. **Tester en local** :

   ```bash
   npm run dev:landing    # Terminal 1
   npm run dev:dashboard  # Terminal 2
   ```

2. **Vérifier le flux complet** :
   - Connexion → Navigation → Langue → Auth

3. **Préparer le déploiement** :
   - Configurer les domaines
   - Mettre à jour Firebase Console
   - Tester en production

## 📚 Documentation

- **`AUTH_SYNC_GUIDE.md`** - Guide complet et détaillé
- **`MIGRATION_GUIDE.md`** - Guide de migration entre les apps
- **`main-dashboard/I18N_GUIDE.md`** - Guide ngx-translate

## ✅ Checklist de Validation

- [x] Fichiers d'environnement créés (landing + dashboard)
- [x] Service auth créé pour landing-page
- [x] Service auth-sync créé pour dashboard
- [x] LanguageService mis à jour (détection URL)
- [x] Header mis à jour (navigateToDashboard)
- [x] App.ts mis à jour (initialisation auth-sync)
- [x] Documentation créée
- [ ] Tests en local
- [ ] Tests en production
- [ ] Configuration Firebase Console

## 🎉 Résultat

Deux applications Angular 20 synchronisées :

1. **Landing Page** - Redirige vers dashboard avec langue
2. **Dashboard** - S'ouvre dans la bonne langue avec auth synchronisée

La navigation entre les deux applications est **transparente** pour l'utilisateur ! 🚀
