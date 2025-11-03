# Guide de Synchronisation d'Authentification

## Vue d'ensemble

Les applications `landing-page` et `main-dashboard` partagent l'authentification Firebase et synchronisent la langue de l'utilisateur lors de la navigation entre les deux applications.

## Architecture

```
┌─────────────────┐                    ┌──────────────────┐
│  Landing Page   │                    │  Main Dashboard  │
│  (Port 4201)    │                    │  (Port 4200)     │
├─────────────────┤                    ├──────────────────┤
│                 │                    │                  │
│  Firebase Auth  │◄──────────────────►│  Firebase Auth   │
│                 │   Shared Domain    │                  │
│                 │                    │                  │
│  @angular/      │                    │  ngx-translate   │
│  localize       │                    │                  │
│                 │                    │                  │
│  localStorage:  │                    │  localStorage:   │
│  - auth_sync    │────────────────────►│  - auth_sync    │
│                 │   Sync Data        │  - language      │
└─────────────────┘                    └──────────────────┘
```

## Flux d'Authentification

### 1. Connexion depuis Landing Page

1. L'utilisateur se connecte via Firebase Auth
2. Firebase stocke le token dans les cookies (domaine partagé)
3. L'utilisateur clique sur "Dashboard" dans le header
4. Landing page :
   - Récupère la langue actuelle (`document.documentElement.lang`)
   - Stocke les données de sync dans `localStorage` :
     ```json
     {
       "timestamp": 1699000000000,
       "userId": "firebase-uid",
       "email": "user@example.com"
     }
     ```
   - Redirige vers : `http://localhost:4200?lang=fr`

### 2. Arrivée sur Dashboard

1. Main-dashboard démarre
2. `LanguageService` s'initialise :
   - Vérifie le paramètre URL `?lang=fr`
   - Si présent, définit la langue à `fr`
   - Sinon, utilise localStorage ou langue du navigateur
3. `AuthSyncService` s'initialise :
   - Vérifie `localStorage.idem_auth_sync`
   - Si présent et valide (< 5 min), attend la synchronisation Firebase
   - Firebase Auth se synchronise automatiquement via les cookies partagés

## Configuration des Environnements

### Landing Page

**`src/environments/environment.development.ts` :**

```typescript
export const environment = {
  services: {
    dashboard: {
      url: 'http://localhost:4200', // URL du dashboard en dev
    },
    // ... autres services
  },
};
```

**`src/environments/environment.ts` (Production) :**

```typescript
export const environment = {
  services: {
    dashboard: {
      url: 'https://dashboard.idem.africa', // URL du dashboard en prod
    },
    // ... autres services
  },
};
```

### Main Dashboard

**`src/environments/environment.development.ts` :**

```typescript
export const environment = {
  services: {
    landingPage: {
      url: 'http://localhost:4201', // URL de la landing en dev
    },
    // ... autres services
  },
};
```

**`src/environments/environment.ts` (Production) :**

```typescript
export const environment = {
  services: {
    landingPage: {
      url: 'https://idem.africa', // URL de la landing en prod
    },
    // ... autres services
  },
};
```

## Fichiers Modifiés

### Landing Page

1. **`src/app/components/header/header.ts`**
   - Ajout de `navigateToDashboard()` :
     - Récupère la langue actuelle
     - Stocke les données de sync
     - Redirige vers le dashboard avec paramètre `?lang=`

2. **`src/app/components/header/header.html`**
   - Remplacement des liens `/console/dashboard` par `(click)="navigateToDashboard()"`

3. **`src/app/services/auth.service.ts`** (créé)
   - Service simple utilisant Firebase Auth
   - Méthodes : `user$`, `logout()`, `getCurrentUser()`

4. **`src/environments/environment*.ts`**
   - Ajout de `services.dashboard.url`

### Main Dashboard

1. **`src/app/shared/services/language.service.ts`**
   - Ajout de `getLanguageFromURL()` :
     - Lit le paramètre `?lang=` de l'URL
     - Priorité : URL > localStorage > navigateur > défaut

2. **`src/app/shared/services/auth-sync.service.ts`** (créé)
   - Vérifie `localStorage.idem_auth_sync`
   - Valide que les données ne sont pas expirées (< 5 min)
   - Attend la synchronisation Firebase

3. **`src/app/app.ts`**
   - Injection de `AuthSyncService`
   - Appel de `checkAuthSync()` dans `ngOnInit()`

4. **`src/environments/environment*.ts`** (créés)
   - Configuration complète avec Firebase
   - Ajout de `services.landingPage.url`

## Synchronisation de la Langue

### Langues Supportées

- **Anglais (en)** - Par défaut
- **Français (fr)**

### Priorité de Détection (Main Dashboard)

1. **Paramètre URL** : `?lang=fr` (depuis landing page)
2. **localStorage** : `idem_dashboard_language`
3. **Navigateur** : `navigator.language`
4. **Défaut** : `en`

### Exemple de Flux

```
Landing Page (FR) → Clic Dashboard → Dashboard (FR)
     ↓                    ↓                ↓
document.lang=fr    ?lang=fr      setLanguage('fr')
```

## Données de Synchronisation

### localStorage Keys

| Clé                       | Application | Contenu                      | Durée     |
| ------------------------- | ----------- | ---------------------------- | --------- |
| `idem_auth_sync`          | Les deux    | `{timestamp, userId, email}` | 5 min     |
| `idem_dashboard_language` | Dashboard   | `"en"` ou `"fr"`             | Permanent |

### Format de `idem_auth_sync`

```typescript
interface AuthSyncData {
  timestamp: number; // Date.now()
  userId: string; // Firebase UID
  email: string | null; // Email de l'utilisateur
}
```

## Configuration Firebase

Les deux applications utilisent la **même configuration Firebase** pour permettre la synchronisation automatique via les cookies.

**Configuration partagée :**

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

## Déconnexion

### Depuis Landing Page

```typescript
// header.ts
protected logout(): void {
  this.auth.logout();  // Appelle signOut(auth)
  // Nettoie localStorage.idem_auth_sync
  this.router.navigate(['/login']);
}
```

### Depuis Dashboard

```typescript
// Utiliser le service auth approprié
await this.authService.logout();
// AuthSyncService.clearAuthSync() si nécessaire
```

## Tests

### Test de Synchronisation

1. **Démarrer les deux applications :**

   ```bash
   # Terminal 1 - Landing Page
   cd apps/landing-page
   npm start  # Port 4201

   # Terminal 2 - Dashboard
   cd apps/main-dashboard
   npm start  # Port 4200
   ```

2. **Tester le flux :**
   - Ouvrir `http://localhost:4201`
   - Se connecter
   - Changer la langue en français (si disponible)
   - Cliquer sur "Dashboard"
   - Vérifier que le dashboard s'ouvre en français
   - Vérifier que l'utilisateur est authentifié

3. **Vérifier localStorage :**
   ```javascript
   // Dans la console du navigateur
   console.log(localStorage.getItem('idem_auth_sync'));
   console.log(localStorage.getItem('idem_dashboard_language'));
   ```

## Troubleshooting

### L'utilisateur n'est pas authentifié dans le dashboard

**Causes possibles :**

1. Domaines Firebase différents
2. Cookies bloqués par le navigateur
3. Données de sync expirées (> 5 min)

**Solutions :**

- Vérifier que les deux apps utilisent la même config Firebase
- Vérifier les cookies dans DevTools
- Réduire le délai entre les navigations

### La langue n'est pas synchronisée

**Causes possibles :**

1. Paramètre URL manquant
2. Langue non supportée

**Solutions :**

- Vérifier l'URL : `?lang=fr` doit être présent
- Vérifier que la langue est dans `SUPPORTED_LANGUAGES`
- Vérifier la console pour les logs

### Erreur CORS

**Cause :** Ports différents en développement

**Solution :** Firebase Auth gère automatiquement CORS pour l'authentification

## Production

### Configuration DNS

```
idem.africa           → Landing Page
dashboard.idem.africa → Main Dashboard
```

### Domaine Firebase Auth

Configurer dans Firebase Console :

- **Authorized domains** :
  - `idem.africa`
  - `dashboard.idem.africa`

### URLs à mettre à jour

1. **Landing Page** : `environment.services.dashboard.url`
2. **Dashboard** : `environment.services.landingPage.url`

## Sécurité

### Données Sensibles

❌ **Ne JAMAIS stocker dans localStorage :**

- Tokens d'authentification
- Mots de passe
- Données sensibles

✅ **OK pour stocker :**

- Préférences utilisateur (langue)
- Données de synchronisation temporaires (< 5 min)
- Métadonnées non sensibles

### Firebase Auth

Firebase gère automatiquement :

- Stockage sécurisé des tokens (httpOnly cookies)
- Refresh automatique des tokens
- Synchronisation cross-domain (même authDomain)

## Maintenance

### Ajouter une nouvelle langue

1. Ajouter dans `SUPPORTED_LANGUAGES` des deux apps
2. Créer les fichiers de traduction :
   - Landing : `src/locale/messages.{lang}.xlf`
   - Dashboard : `src/assets/i18n/{lang}.json`
3. Tester le flux complet

### Modifier le timeout de sync

```typescript
// auth-sync.service.ts
private readonly SYNC_TIMEOUT = 10 * 60 * 1000; // 10 minutes
```

## Ressources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Angular i18n](https://angular.dev/guide/i18n)
- [ngx-translate](https://github.com/ngx-translate/core)
