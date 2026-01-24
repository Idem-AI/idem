# Architecture d'Authentification Centralisée

## Vue d'ensemble

Cette architecture centralise l'authentification et la gestion des utilisateurs/équipes dans l'API Express (Node.js + Firebase), tandis que Laravel (Ideploy) devient un client pur qui consomme ces services.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Firebase Auth                            │
│              (Source unique de vérité)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Express API (Node.js)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Firebase Admin SDK                                   │   │
│  │  - Vérification des sessions                         │   │
│  │  - Gestion des utilisateurs                          │   │
│  │  - Création de tokens                                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Firestore                                            │   │
│  │  - users collection                                   │   │
│  │  - teams collection                                   │   │
│  │  - invitations collection                            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Endpoints                                        │   │
│  │  POST /auth/sessionLogin                             │   │
│  │  POST /auth/verify-session (API Key protected)       │   │
│  │  GET  /auth/profile                                   │   │
│  │  POST /auth/logout                                    │   │
│  │  GET  /api/teams/user/:userId                        │   │
│  │  GET  /api/teams/:teamId                             │   │
│  │  POST /api/teams                                      │   │
│  │  POST /api/teams/:teamId/members                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP + API Key
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Laravel (Ideploy)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ExpressApiClient Service                            │   │
│  │  - verifySession()                                    │   │
│  │  - getUserTeams()                                     │   │
│  │  - getTeam()                                          │   │
│  │  - createTeam()                                       │   │
│  │  - addTeamMember()                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  VerifyExpressSession Middleware                     │   │
│  │  1. Extrait cookie session                           │   │
│  │  2. Appelle Express API verify-session               │   │
│  │  3. Synchronise user local                           │   │
│  │  4. Auth::login($user)                               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Local)                                   │   │
│  │  - users (synchronisé depuis Express)                │   │
│  │  - Données métiers uniquement                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Flux d'Authentification

### 1. Login Initial (Frontend → Express)

```
1. User se connecte via Firebase (Google/GitHub/Email)
2. Frontend obtient ID Token de Firebase
3. POST /auth/sessionLogin avec {token, user}
4. Express crée session cookie (14 jours)
5. Express crée refresh token (30 jours)
6. Cookies renvoyés au client (HttpOnly, Secure)
```

### 2. Requête Laravel avec Session

```
1. User fait une requête à Laravel avec cookie session
2. VerifyExpressSession middleware intercepte
3. Middleware appelle Express POST /auth/verify-session
   - Header: X-API-Key: {INTERNAL_API_KEY}
   - Cookie: session={sessionCookie}
4. Express vérifie avec Firebase Admin SDK
5. Express retourne user data
6. Laravel synchronise user local (create/update)
7. Laravel Auth::login($user)
8. Requête continue normalement
```

### 3. Gestion des Teams

```
Laravel → Express API
├── GET /api/teams/user/:userId → Récupère teams de l'utilisateur
├── GET /api/teams/:teamId → Récupère détails team
├── POST /api/teams → Crée nouvelle team
├── POST /api/teams/:teamId/members → Ajoute membre
├── PUT /api/teams/:teamId/members/:userId → Change rôle
└── DELETE /api/teams/:teamId/members/:userId → Retire membre
```

## Configuration

### Express API (.env)

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-client-email@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Inter-Service Authentication
INTERNAL_API_KEY=your-secure-api-key-here-change-in-production

# CORS
CORS_ALLOWED_ORIGINS="https://idem.africa,https://ideploy.idem.africa,http://localhost:8000"

# Server
PORT=3001
NODE_ENV=production
```

### Laravel (.env)

```env
# Express API Configuration
IDEM_API_URL=http://localhost:3001
EXPRESS_API_KEY=your-secure-api-key-here-change-in-production

# Database (PostgreSQL - données métiers uniquement)
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ideploy
DB_USERNAME=postgres
DB_PASSWORD=your-password
```

## Sécurité

### 1. API Key Protection

- Toutes les requêtes inter-services utilisent `X-API-Key` header
- API key partagée entre Express et Laravel (INTERNAL_API_KEY)
- Endpoint `/auth/verify-session` protégé par `verifyApiKey` middleware

### 2. Session Cookies

- HttpOnly: true (protection XSS)
- Secure: true en production (HTTPS uniquement)
- SameSite: 'none' en production, 'lax' en dev
- Durée: 14 jours
- Vérifiés par Firebase Admin SDK

### 3. Refresh Tokens

- Stockés dans Firestore (users.refreshTokens)
- Durée: 30 jours
- Maximum 5 tokens par utilisateur
- Révocables individuellement ou en masse

## Migration depuis Auth Local

### Étape 1: Ajouter firebase_uid aux users

```bash
cd apps/ideploy
php artisan migrate
```

### Étape 2: Configurer les variables d'environnement

```bash
# Express API
cp apps/api/.env.example apps/api/.env
# Configurer FIREBASE_* et INTERNAL_API_KEY

# Laravel
# Ajouter à .env:
IDEM_API_URL=http://localhost:3001
EXPRESS_API_KEY=same-as-express-INTERNAL_API_KEY
```

### Étape 3: Remplacer le middleware auth

Dans `app/Http/Kernel.php`:

```php
protected $middlewareAliases = [
    // 'auth' => \App\Http\Middleware\Authenticate::class, // ❌ Ancien
    'auth' => \App\Http\Middleware\VerifyExpressSession::class, // ✅ Nouveau
    // ... autres middlewares
];
```

### Étape 4: Supprimer les routes d'auth locales

Commentez ou supprimez:

- Routes de login/register locales
- Controllers d'auth locales
- Vues d'auth locales

### Étape 5: Remplacer les appels User/Team

```php
// ❌ AVANT (Auth locale)
$user = User::find($id);
$teams = $user->teams;

// ✅ APRÈS (Express API)
$expressClient = app(ExpressApiClient::class);
$sessionCookie = request()->cookie('session');
$teams = $expressClient->getUserTeams($userId, $sessionCookie);
```

## Endpoints Express API

### Authentication

#### POST /auth/sessionLogin

Crée une session cookie à partir d'un ID token Firebase.

**Request:**

```json
{
  "token": "firebase-id-token",
  "user": {
    "uid": "user-uid",
    "email": "user@example.com",
    "displayName": "User Name",
    "photoURL": "https://..."
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Session cookie created successfully",
  "refreshToken": "refresh-token",
  "refreshTokenExpiresAt": "2024-02-08T00:00:00.000Z"
}
```

#### POST /auth/verify-session (Protected by API Key)

Vérifie un session cookie et retourne les données utilisateur.

**Headers:**

```
X-API-Key: your-internal-api-key
Cookie: session=session-cookie-value
```

**Response:**

```json
{
  "success": true,
  "user": {
    "uid": "user-uid",
    "email": "user@example.com",
    "displayName": "User Name",
    "photoURL": "https://...",
    "subscription": "free",
    "quota": {
      "dailyUsage": 0,
      "weeklyUsage": 0,
      "dailyLimit": 10,
      "weeklyLimit": 50
    },
    "roles": ["user"]
  }
}
```

#### GET /auth/profile

Récupère le profil de l'utilisateur authentifié.

**Headers:**

```
Cookie: session=session-cookie-value
```

**Response:**

```json
{
  "uid": "user-uid",
  "email": "user@example.com",
  "displayName": "User Name",
  "subscription": "free",
  "quota": {...},
  "roles": ["user"]
}
```

#### POST /auth/logout

Déconnecte l'utilisateur et révoque le refresh token.

**Headers:**

```
Cookie: session=session-cookie-value
Cookie: refreshToken=refresh-token-value
```

**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Teams Management

#### GET /api/teams/user/:userId

Récupère toutes les équipes d'un utilisateur.

**Headers:**

```
Cookie: session=session-cookie-value
```

**Response:**

```json
{
  "success": true,
  "teams": [
    {
      "id": "team-id",
      "name": "Team Name",
      "description": "Team description",
      "ownerId": "owner-uid",
      "members": [
        {
          "userId": "user-uid",
          "email": "user@example.com",
          "displayName": "User Name",
          "role": "owner",
          "isActive": true,
          "addedAt": "2024-01-08T00:00:00.000Z"
        }
      ],
      "projectIds": [],
      "isActive": true,
      "createdAt": "2024-01-08T00:00:00.000Z",
      "updatedAt": "2024-01-08T00:00:00.000Z"
    }
  ]
}
```

#### GET /api/teams/:teamId

Récupère les détails d'une équipe.

**Response:**

```json
{
  "success": true,
  "team": {
    "id": "team-id",
    "name": "Team Name",
    "description": "Team description",
    "ownerId": "owner-uid",
    "members": [...],
    "projectIds": [],
    "isActive": true
  }
}
```

#### POST /api/teams

Crée une nouvelle équipe.

**Request:**

```json
{
  "name": "Team Name",
  "description": "Team description",
  "members": [
    {
      "email": "member@example.com",
      "displayName": "Member Name",
      "role": "member"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "team": {
    "id": "new-team-id",
    "name": "Team Name",
    ...
  }
}
```

#### POST /api/teams/:teamId/members

Ajoute un membre à une équipe.

**Request:**

```json
{
  "email": "new-member@example.com",
  "displayName": "New Member",
  "role": "member"
}
```

**Response:**

```json
{
  "success": true,
  "team": {
    "id": "team-id",
    "members": [...]
  }
}
```

## Avantages de cette Architecture

### ✅ Centralisation

- **Source unique de vérité**: Firebase + Express pour auth et données utilisateurs
- **Cohérence**: Même logique d'auth partout (Angular, Laravel, autres services)
- **Maintenance simplifiée**: Un seul endroit pour gérer users/teams

### ✅ Sécurité

- **Firebase Admin SDK**: Vérification robuste des tokens
- **API Key**: Protection des endpoints inter-services
- **Session cookies**: HttpOnly, Secure, protection XSS/CSRF
- **Refresh tokens**: Révocables, limités par utilisateur

### ✅ Scalabilité

- **Firestore**: Base NoSQL scalable automatiquement
- **Stateless**: Laravel n'a pas besoin de gérer les sessions
- **Cache**: Données utilisateur cachées (5 min) dans Laravel

### ✅ Flexibilité

- **Multi-clients**: Angular, Laravel, futurs services
- **Indépendance**: Laravel peut être redéployé sans affecter l'auth
- **Migration progressive**: Possibilité de migrer service par service

## Limitations et Considérations

### ⚠️ Dépendance réseau

- Laravel dépend d'Express pour chaque requête authentifiée
- Nécessite une connexion fiable entre services
- **Solution**: Cache local (5 min) pour réduire les appels

### ⚠️ Latence

- Ajout d'un appel HTTP par requête authentifiée
- **Solution**: Cache + optimisation réseau (même datacenter)

### ⚠️ Point de défaillance unique

- Si Express tombe, Laravel ne peut pas authentifier
- **Solution**: Monitoring, redondance, fallback sur cache

### ⚠️ Synchronisation

- Users synchronisés dans PostgreSQL (Laravel)
- Possibilité de désynchronisation
- **Solution**: Cache TTL court, endpoint de resync

## Tests

### Test Express API

```bash
# Vérifier que l'API fonctionne
curl http://localhost:3001/

# Tester verify-session (nécessite API key et session cookie)
curl -X POST http://localhost:3001/auth/verify-session \
  -H "X-API-Key: your-api-key" \
  -H "Cookie: session=your-session-cookie"
```

### Test Laravel Integration

```bash
# Démarrer Laravel
cd apps/ideploy
php artisan serve

# Tester avec un cookie session valide
curl http://localhost:8000/api/user \
  -H "Cookie: session=your-session-cookie"
```

## Monitoring et Logs

### Express API

- Logs Winston dans `apps/api/logs/`
- Logs de vérification de session
- Logs d'erreurs Firebase

### Laravel

- Logs dans `storage/logs/laravel.log`
- Préfixe `[Express API]` pour les appels API
- Préfixe `[Express Auth]` pour le middleware

## Support et Documentation

- **Express API Swagger**: http://localhost:3001/api-docs
- **Code source**: `/apps/api` et `/apps/ideploy`
- **Documentation**: Ce fichier + commentaires dans le code

## Prochaines Étapes

1. ✅ Créer endpoints Express pour users/teams
2. ✅ Créer middleware Laravel VerifyExpressSession
3. ✅ Créer service ExpressApiClient
4. ⏳ Tester l'intégration complète
5. ⏳ Migrer les routes Laravel existantes
6. ⏳ Supprimer l'auth locale Laravel
7. ⏳ Déployer en production

## Conclusion

Cette architecture centralise l'authentification dans Express/Firebase tout en permettant à Laravel de se concentrer sur sa logique métier. Elle offre une base solide, sécurisée et scalable pour l'écosystème IDEM.
