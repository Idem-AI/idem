# 🏗️ Architecture du Package shared-auth-php

## 📋 Principe Fondamental

**Le package PHP ne contacte JAMAIS Firebase directement.**

Toute la logique Firebase est gérée par l'API centrale. Le package PHP fonctionne **exactement comme le package TypeScript** : il communique uniquement avec l'API centrale.

---

## 🔄 Flux d'Authentification

### 1. Login Initial (Frontend)

```
User → Firebase Auth → Frontend
                          ↓
                    POST /auth/sessionLogin
                    { token: "firebase_id_token", user: {...} }
                          ↓
                    API Centrale
                    - Vérifie le token Firebase
                    - Crée un session cookie (14j)
                    - Crée un refresh token (30j)
                          ↓
                    Frontend reçoit les cookies
```

### 2. Requête Authentifiée (Backend PHP → API Centrale)

```
Request avec session cookie
         ↓
ApiAuthMiddleware (PHP)
         ↓
Extrait le token (cookie ou Bearer)
         ↓
AuthClient::getUserProfile()
         ↓
GET /auth/profile
Authorization: Bearer {session_cookie}
         ↓
API Centrale
- Vérifie le session cookie (Firebase Admin SDK)
- Retourne le UserModel complet
         ↓
Middleware PHP
- Synchronise l'utilisateur localement
- Auth::login($user)
         ↓
Controller peut accéder à auth()->user()
```

---

## 🎯 Comparaison avec le Package TypeScript

| Aspect               | Package TypeScript       | Package PHP               |
| -------------------- | ------------------------ | ------------------------- |
| **Communication**    | API Centrale uniquement  | API Centrale uniquement   |
| **Firebase**         | ❌ Pas de contact direct | ❌ Pas de contact direct  |
| **AuthClient**       | ✅ Classe avec fetch()   | ✅ Classe avec Guzzle     |
| **Authentification** | Via getAuthToken()       | Via session cookie/Bearer |
| **Modèles**          | Interfaces TypeScript    | Classes PHP               |
| **Framework**        | React/Angular/Svelte     | Laravel                   |

---

## 📦 Structure du Package

```
shared-auth-php/
├── src/
│   ├── Models/
│   │   ├── UserModel.php          # Modèle utilisateur
│   │   └── TeamModel.php          # Modèle team
│   ├── AuthClient.php             # Client HTTP (comme TS)
│   ├── Exceptions/
│   │   └── AuthException.php
│   └── Laravel/
│       ├── Middleware/
│       │   └── ApiAuthMiddleware.php  # Middleware Laravel
│       └── IdemAuthServiceProvider.php
├── config/
│   └── idem-auth.php
└── composer.json
```

---

## 🔑 Composants Principaux

### 1. AuthClient (src/AuthClient.php)

**Rôle :** Client HTTP pour communiquer avec l'API centrale

**Méthodes :**

- `getUserProfile()` : Récupère le profil utilisateur
- `getMyTeams()` : Récupère les teams
- `getTeam($id)` : Récupère une team
- `createTeam($name)` : Crée une team
- `addTeamMember()` : Ajoute un membre
- `getProjectPermissions()` : Récupère les permissions

**Exemple :**

```php
$authClient = new AuthClient('http://localhost:3001');
$authClient->setAuthToken($sessionCookie);

$profile = $authClient->getUserProfile();
$teams = $authClient->getMyTeams();
```

### 2. ApiAuthMiddleware (src/Laravel/Middleware/ApiAuthMiddleware.php)

**Rôle :** Middleware Laravel pour authentifier les requêtes

**Flux :**

1. Extrait le token (cookie `session` ou header `Authorization`)
2. Configure AuthClient avec le token
3. Appelle `AuthClient::getUserProfile()`
4. L'API centrale vérifie le token Firebase
5. Synchronise l'utilisateur localement
6. `Auth::login($user)`

**Utilisation :**

```php
Route::middleware(['idem.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'index']);
});
```

### 3. Modèles (src/Models/)

**Rôle :** Représentation PHP des modèles TypeScript

**UserModel :**

- Propriétés : uid, email, displayName, subscription, quota, etc.
- Méthodes : `toArray()`, `fromArray()`

**TeamModel :**

- Propriétés : name, ownerId, members, projectIds
- Méthodes : `hasMember()`, `getMemberRole()`, `isAdminOrOwner()`

---

## 🚫 Ce que le Package NE FAIT PAS

❌ **Ne contacte PAS Firebase directement**

- Pas de Firebase Admin SDK
- Pas de vérification de token Firebase
- Pas de création de session cookie Firebase

❌ **Ne gère PAS l'authentification initiale**

- C'est le rôle du frontend + API centrale
- Le package reçoit un token déjà valide

❌ **Ne stocke PAS les credentials Firebase**

- Pas de fichier `firebase-credentials.json`
- Pas de configuration Firebase

---

## ✅ Ce que le Package FAIT

✅ **Communique avec l'API centrale**

- Envoie le token (session cookie ou Bearer)
- Récupère les données utilisateur
- Récupère les teams et permissions

✅ **Synchronise les utilisateurs localement**

- Crée ou met à jour l'utilisateur dans la DB locale
- Mappe les données du UserModel API vers le User Laravel

✅ **Fournit un middleware Laravel**

- Authentifie automatiquement les requêtes
- Injecte l'utilisateur dans `auth()->user()`

✅ **Fournit un client HTTP**

- Méthodes pour toutes les opérations (teams, permissions, etc.)
- Cache intégré pour les performances

---

## 🔐 Sécurité

### Validation des Tokens

**Frontend → API Centrale :**

```
Firebase ID Token → API Centrale vérifie avec Firebase Admin SDK
```

**Backend PHP → API Centrale :**

```
Session Cookie → API Centrale vérifie avec Firebase Admin SDK
```

**Le package PHP ne fait AUCUNE validation de token.**  
Il délègue tout à l'API centrale.

### Avantages

✅ **Centralisation** : Une seule source de vérité (API centrale)  
✅ **Sécurité** : Firebase Admin SDK uniquement dans l'API centrale  
✅ **Simplicité** : Le package PHP n'a pas besoin de credentials Firebase  
✅ **Cohérence** : Même architecture que le package TypeScript

---

## 📊 Comparaison Avant/Après

### ❌ Ancienne Approche (INCORRECTE)

```
Backend PHP
    ↓
Firebase Admin SDK (dans le package)
    ↓
Vérifie le token directement
```

**Problèmes :**

- Dépendance Firebase dans le package
- Credentials Firebase nécessaires
- Duplication de la logique de vérification
- Différent du package TypeScript

### ✅ Nouvelle Approche (CORRECTE)

```
Backend PHP
    ↓
AuthClient (package)
    ↓
API Centrale
    ↓
Firebase Admin SDK (dans l'API)
    ↓
Retourne UserModel
```

**Avantages :**

- Pas de dépendance Firebase
- Pas de credentials nécessaires
- Logique centralisée
- Identique au package TypeScript

---

## 🎯 Utilisation dans Ideploy

### Configuration Minimale

```env
# .env
IDEM_API_URL=http://localhost:3001
```

**C'est tout !** Pas besoin de Firebase credentials.

### Routes Protégées

```php
// routes/api.php
Route::middleware(['idem.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'teams']);
    Route::get('/projects', [ProjectController::class, 'projects']);
});
```

### Utilisation dans les Controllers

```php
use Idem\SharedAuth\AuthClient;

class TeamController extends Controller
{
    public function __construct(
        private AuthClient $authClient
    ) {}

    public function teams()
    {
        // L'utilisateur est déjà authentifié par le middleware
        $user = auth()->user();

        // Récupérer les teams depuis l'API centrale
        $teams = $this->authClient->getMyTeams();

        return response()->json(['teams' => $teams]);
    }
}
```

---

## 🧪 Tests

### Test du Middleware

```bash
# Obtenir un session cookie depuis l'API centrale
curl -X POST http://localhost:3001/auth/sessionLogin \
  -H "Content-Type: application/json" \
  -d '{"token":"FIREBASE_ID_TOKEN","user":{...}}' \
  -c cookies.txt

# Tester sur Ideploy
curl -X GET http://localhost:8000/api/teams \
  -b cookies.txt
```

### Test de l'AuthClient

```php
php artisan tinker

use Idem\SharedAuth\AuthClient;

$client = app(AuthClient::class);
$client->setAuthToken('session_cookie_value');

$profile = $client->getUserProfile();
dd($profile);
```

---

## 📚 Documentation Complète

- [README du Package](/packages/shared-auth-php/README.md)
- [Architecture Globale](/documentation/SHARED_AUTH_ARCHITECTURE.md)
- [Package TypeScript](/packages/shared-auth-client/README.md)
- [API Centrale](/apps/api/README.md)

---

## 🆘 Support

Pour toute question sur l'architecture :

- Consulter ce document
- Comparer avec le package TypeScript
- Vérifier que l'API centrale est accessible
- Contacter dev@idem.africa
