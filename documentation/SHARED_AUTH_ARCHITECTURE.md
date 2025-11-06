# 🏗️ Architecture d'Authentification Partagée - Écosystème Idem

## 📋 Vue d'ensemble

Ce document décrit l'architecture complète du système d'authentification et d'autorisation partagé dans l'écosystème Idem.

---

## 🎯 Objectifs

1. **Centralisation** : Un seul système d'authentification pour tous les services
2. **Sécurité** : Firebase Authentication + API centrale
3. **Réutilisabilité** : Packages partagés pour frontends et backends
4. **Synchronisation** : Données utilisateur et teams synchronisées
5. **Performance** : Cache et optimisations

---

## 🏛️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────────┐
│                         FIREBASE AUTH                            │
│                  (Source de vérité pour l'identité)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ ID Tokens / Session Cookies
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API CENTRALE                             │
│                      (Node.js/Express)                           │
│  - Gestion des sessions                                          │
│  - Gestion des teams                                             │
│  - Gestion des permissions                                       │
│  - Gestion des invitations                                       │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
             │ HTTP/REST                     │ HTTP/REST
             ▼                               ▼
┌────────────────────────┐      ┌───────────────────────────────┐
│   FRONTENDS            │      │   BACKENDS                    │
│   (TypeScript)         │      │   (PHP/Laravel)               │
│                        │      │                               │
│  - landing (Angular)   │      │  - ideploy (Laravel)          │
│  - main-dashboard      │      │  - Autres backends PHP        │
│  - appgen (React)      │      │                               │
│  - chart (Svelte)      │      │                               │
│                        │      │                               │
│  📦 @idem/             │      │  📦 idem/                     │
│     shared-auth-client │      │     shared-auth-php           │
└────────────────────────┘      └───────────────────────────────┘
```

---

## 📦 Packages Partagés

### 1. `@idem/shared-models` (TypeScript)

**Localisation :** `/packages/shared-models`

**Contenu :**

- Modèles de données TypeScript
- Interfaces partagées
- Types d'authentification et d'autorisation

**Modèles principaux :**

- `UserModel` : Utilisateur avec quota, intégrations, etc.
- `TeamModel` : Équipe avec membres et rôles
- `ProjectTeamModel` : Association projet-team
- `InvitationModel` : Invitations utilisateur

**Utilisation :**

```typescript
import { UserModel, TeamModel, TeamRole } from '@idem/shared-models';
```

---

### 2. `@idem/shared-auth-client` (TypeScript)

**Localisation :** `/packages/shared-auth-client`

**Contenu :**

- Client HTTP pour l'API centrale
- Hooks React (`useAuth`, `useProjectPermissions`)
- Stores Svelte (`createAuthStore`)
- Services Angular (`AuthService`, `ProjectPermissionsService`)

**Architecture :**

```
shared-auth-client/
├── src/
│   ├── core/
│   │   └── AuthClient.ts          # Client HTTP vanilla
│   ├── react/
│   │   ├── useAuth.ts             # Hook React
│   │   └── useProjectPermissions.ts
│   ├── svelte/
│   │   └── stores.ts              # Stores Svelte
│   ├── angular/
│   │   ├── auth.service.ts        # Service Angular
│   │   └── project-permissions.service.ts
│   └── index.ts
```

**Utilisation :**

**React :**

```typescript
import { useAuth } from '@idem/shared-auth-client';

function MyComponent() {
  const { teams, loading, createTeam } = useAuth(authClient);
  // ...
}
```

**Svelte :**

```typescript
import { createAuthStore } from '@idem/shared-auth-client';

export const authStore = createAuthStore(authClient);
```

**Angular :**

```typescript
import { AuthService } from '@idem/shared-auth-client';

export class MyComponent {
  teams$ = this.authService.teams$;

  constructor(private authService: AuthService) {}
}
```

---

### 3. `idem/shared-auth-php` (PHP) 🆕

**Localisation :** `/packages/shared-auth-php`

**Contenu :**

- Client HTTP pour l'API centrale (équivalent AuthClient TypeScript)
- Modèles PHP (UserModel, TeamModel, etc.)
- Middleware Laravel pour Firebase Auth
- Service Provider Laravel

**Architecture :**

```
shared-auth-php/
├── src/
│   ├── Models/
│   │   ├── UserModel.php
│   │   ├── TeamModel.php
│   │   └── ...
│   ├── AuthClient.php             # Client HTTP
│   ├── Exceptions/
│   │   └── AuthException.php
│   └── Laravel/
│       ├── Middleware/
│       │   └── FirebaseAuthMiddleware.php
│       └── IdemAuthServiceProvider.php
├── config/
│   └── idem-auth.php
├── composer.json
└── README.md
```

**Utilisation :**

```php
use Idem\SharedAuth\AuthClient;
use Idem\SharedAuth\Models\TeamModel;

class TeamController extends Controller
{
    public function __construct(
        private AuthClient $authClient
    ) {}

    public function index()
    {
        $teams = $this->authClient->getMyTeams();
        return response()->json(['teams' => $teams]);
    }
}
```

**Middleware :**

```php
// routes/api.php
Route::middleware(['firebase.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'index']);
});
```

---

## 🔐 Flux d'Authentification Complet

### 1. Login Initial (Frontend)

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ 1. Login (email/password ou OAuth)
       ▼
┌─────────────┐
│  Firebase   │
│   Auth      │
└──────┬──────┘
       │ 2. ID Token
       ▼
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ 3. POST /auth/sessionLogin { token, user }
       ▼
┌─────────────┐
│ API Central │
└──────┬──────┘
       │ 4. Session Cookie (14j) + Refresh Token (30j)
       ▼
┌─────────────┐
│  Frontend   │
│  (cookies)  │
└─────────────┘
```

### 2. Requêtes Authentifiées (Frontend → API Centrale)

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ GET /teams/my-teams
       │ Cookie: session=xxx
       ▼
┌─────────────┐
│ API Central │
│  Middleware │
│  authenticate│
└──────┬──────┘
       │ Verify session cookie
       │ Attach user to request
       ▼
┌─────────────┐
│  Controller │
│  Return data│
└─────────────┘
```

### 3. Requêtes Authentifiées (Frontend → Backend PHP)

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ GET /api/teams
       │ Cookie: session=xxx
       ▼
┌─────────────┐
│  Ideploy    │
│  (Laravel)  │
│  Middleware │
│  firebase.  │
│  auth       │
└──────┬──────┘
       │ 1. Verify session cookie (Firebase Admin SDK)
       │ 2. Sync user localement
       │ 3. Fetch profile from API centrale
       │ 4. Auth::login($user)
       ▼
┌─────────────┐
│  Controller │
│  Return data│
└─────────────┘
```

### 4. Backend PHP → API Centrale

```
┌─────────────┐
│  Ideploy    │
│  Controller │
└──────┬──────┘
       │ $authClient->getMyTeams()
       ▼
┌─────────────┐
│ AuthClient  │
│  (PHP)      │
└──────┬──────┘
       │ GET /teams/my-teams
       │ Authorization: Bearer session_cookie
       ▼
┌─────────────┐
│ API Central │
└──────┬──────┘
       │ Return teams data
       ▼
┌─────────────┐
│  Ideploy    │
│  (cache 5m) │
└─────────────┘
```

---

## 🔄 Synchronisation des Données

### Utilisateurs

**Source de vérité :** Firebase Auth + API Centrale

**Synchronisation :**

1. Firebase Auth : Identité (uid, email, emailVerified)
2. API Centrale : Profil complet (quota, subscription, teams)
3. Backends locaux : Cache local pour performance

**Flux :**

```
Firebase Auth
    ↓
API Centrale (UserModel complet)
    ↓
Backend PHP (User local + firebase_uid)
```

### Teams

**Source de vérité :** API Centrale

**Synchronisation :**

- Backends PHP récupèrent les teams via AuthClient
- Cache local (5 minutes par défaut)
- Invalidation du cache lors des modifications

---

## 🚀 Intégration dans une Nouvelle Application

### Frontend TypeScript

**1. Installer le package :**

```bash
npm install @idem/shared-auth-client @idem/shared-models
```

**2. Configurer Firebase :**

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: '...',
  authDomain: 'lexis-ia.firebaseapp.com',
  projectId: 'lexis-ia',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

**3. Utiliser AuthClient :**

```typescript
import { AuthClient } from '@idem/shared-auth-client';

const authClient = new AuthClient({
  apiBaseUrl: 'https://api.idem.africa',
  getAuthToken: async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  },
});
```

**4. Utiliser les hooks/stores/services :**

```typescript
// React
import { useAuth } from '@idem/shared-auth-client';
const { teams, loading } = useAuth(authClient);

// Svelte
import { createAuthStore } from '@idem/shared-auth-client';
const authStore = createAuthStore(authClient);

// Angular
import { AuthService } from '@idem/shared-auth-client';
// Injecter dans le composant
```

---

### Backend PHP/Laravel

**1. Installer le package :**

```bash
composer require idem/shared-auth-php
```

**2. Publier la configuration :**

```bash
php artisan vendor:publish --tag=idem-auth-config
```

**3. Configurer `.env` :**

```env
IDEM_API_URL=https://api.idem.africa
FIREBASE_CREDENTIALS=/path/to/firebase-credentials.json
FIREBASE_PROJECT_ID=lexis-ia
```

**4. Utiliser le middleware :**

```php
// routes/api.php
Route::middleware(['firebase.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'index']);
});
```

**5. Utiliser AuthClient :**

```php
use Idem\SharedAuth\AuthClient;

class TeamController extends Controller
{
    public function __construct(
        private AuthClient $authClient
    ) {}

    public function index()
    {
        $teams = $this->authClient->getMyTeams();
        return response()->json(['teams' => $teams]);
    }
}
```

---

## 📊 Comparaison des Packages

| Fonctionnalité               | TypeScript       | PHP            |
| ---------------------------- | ---------------- | -------------- |
| **Client HTTP**              | ✅ AuthClient    | ✅ AuthClient  |
| **Modèles**                  | ✅ Interfaces TS | ✅ Classes PHP |
| **React Hooks**              | ✅               | ❌             |
| **Svelte Stores**            | ✅               | ❌             |
| **Angular Services**         | ✅               | ❌             |
| **Laravel Middleware**       | ❌               | ✅             |
| **Laravel Service Provider** | ❌               | ✅             |
| **Firebase Admin SDK**       | ❌               | ✅             |
| **Cache intégré**            | ❌               | ✅             |

---

## 🔒 Sécurité

### Tokens et Cookies

**Session Cookie (API Centrale) :**

- Durée : 14 jours
- HttpOnly : true
- Secure : true (production)
- SameSite : none (cross-domain)

**Refresh Token :**

- Durée : 30 jours
- Stocké dans cookie HttpOnly
- Permet de renouveler le session cookie

**ID Token Firebase :**

- Durée : 1 heure
- Utilisé pour créer le session cookie
- Peut être utilisé directement (fallback)

### Validation

**Frontend → API Centrale :**

1. Vérifier session cookie (Firebase Admin SDK)
2. Ou vérifier ID token (Firebase Admin SDK)
3. Auto-refresh si refresh token valide

**Backend PHP → API Centrale :**

1. Vérifier session cookie (Firebase Admin SDK)
2. Synchroniser utilisateur localement
3. Utiliser session cookie pour appels API

---

## 📈 Performance et Cache

### Cache dans AuthClient PHP

**Données cachées :**

- Profil utilisateur : 5 minutes
- Teams utilisateur : 5 minutes
- Team spécifique : 5 minutes
- Membres d'une team : 5 minutes
- Permissions projet : 5 minutes

**Configuration :**

```env
IDEM_AUTH_CACHE_ENABLED=true
IDEM_AUTH_CACHE_TTL=300
```

**Invalidation :**

```php
// Invalider le cache utilisateur
Cache::forget("user_profile_{$uid}");

// Invalider le cache d'une team
Cache::forget("team_{$teamId}");
```

---

## 🧪 Tests

### Frontend TypeScript

```bash
# Dans le package shared-auth-client
npm test
```

### Backend PHP

```bash
# Dans le package shared-auth-php
composer test
```

---

## 📚 Documentation Complète

- [API Centrale - Routes Auth](/apps/api/api/routes/auth.routes.ts)
- [Package TypeScript](/packages/shared-auth-client/README.md)
- [Package PHP](/packages/shared-auth-php/README.md)
- [Système d'Autorisation](/documentation/AUTHORIZATION_SYSTEM.md)
- [Migration Ideploy](/apps/ideploy/MIGRATION_AUTH_STRATEGY.md)

---

## 🆘 Support

Pour toute question :

- Consulter la documentation
- Ouvrir une issue GitHub
- Contacter dev@idem.africa
