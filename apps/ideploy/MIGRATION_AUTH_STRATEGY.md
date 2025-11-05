# 🔐 Stratégie de Migration - Authentification Ideploy vers Système Centralisé

## 📋 Contexte

**Objectif :** Remplacer le système d'authentification local d'Ideploy par le système d'authentification centralisé basé sur Firebase Auth utilisé par tous les autres services Idem.

### Architecture Actuelle

**Ideploy (Laravel/PHP)**

- Authentification locale avec JWT custom
- Gestion des utilisateurs dans sa propre base de données
- Système de teams local
- Middleware `SharedJwtAuth` pour valider les JWT

**API Centrale (Node.js/Express)**

- Firebase Authentication
- Session cookies (14 jours)
- Refresh tokens (30 jours)
- Gestion centralisée des users, teams, permissions

**Package Partagé (`@idem/shared-auth-client`)**

- Client TypeScript pour frontends (React, Angular, Svelte)
- Non applicable directement à Laravel

---

## 🎯 Stratégie de Migration

### Phase 1: Créer un Middleware Firebase pour Laravel

**Objectif :** Créer un middleware Laravel qui valide les tokens Firebase (session cookies ou Bearer tokens).

**Fichier à créer :** `app/Http/Middleware/FirebaseAuth.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Auth as FirebaseAuth;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class FirebaseAuthMiddleware
{
    private FirebaseAuth $firebaseAuth;

    public function __construct()
    {
        $factory = (new Factory)
            ->withServiceAccount(config('firebase.credentials.file'));

        $this->firebaseAuth = $factory->createAuth();
    }

    public function handle(Request $request, Closure $next): Response
    {
        $sessionCookie = $request->cookie('session');
        $authHeader = $request->header('Authorization');

        // 1. Priorité au session cookie
        if ($sessionCookie) {
            try {
                $verifiedToken = $this->firebaseAuth->verifySessionCookie($sessionCookie, true);
                $user = $this->syncUser($verifiedToken);

                if ($user) {
                    Auth::login($user);
                    $request->setUserResolver(fn() => $user);
                    return $next($request);
                }
            } catch (\Exception $e) {
                Log::error('Firebase session cookie verification failed: ' . $e->getMessage());
            }
        }

        // 2. Fallback sur Bearer token
        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            $idToken = substr($authHeader, 7);

            try {
                $verifiedToken = $this->firebaseAuth->verifyIdToken($idToken);
                $user = $this->syncUser($verifiedToken);

                if ($user) {
                    Auth::login($user);
                    $request->setUserResolver(fn() => $user);
                    return $next($request);
                }
            } catch (\Exception $e) {
                Log::error('Firebase ID token verification failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Unauthorized: Invalid or missing authentication credentials'
        ], 401);
    }

    private function syncUser($firebaseToken): ?User
    {
        $uid = $firebaseToken->claims()->get('sub');
        $email = $firebaseToken->claims()->get('email');
        $name = $firebaseToken->claims()->get('name') ?? $email;

        // Trouver ou créer l'utilisateur
        $user = User::where('email', $email)->first();

        $userData = [
            'email' => $email,
            'name' => $name,
            'firebase_uid' => $uid,
            'email_verified_at' => now(),
        ];

        if ($user) {
            $user->update($userData);
        } else {
            $userData['password'] = bcrypt(bin2hex(random_bytes(32)));
            $userData['idem_role'] = 'member'; // Rôle par défaut
            $user = User::create($userData);
        }

        return $user;
    }
}
```

**Dépendances à installer :**

```bash
composer require kreait/firebase-php
```

**Configuration Firebase :**

```php
// config/firebase.php
return [
    'credentials' => [
        'file' => env('FIREBASE_CREDENTIALS', storage_path('app/firebase-credentials.json')),
    ],
];
```

---

### Phase 2: Synchroniser les Teams avec l'API Centrale

**Objectif :** Utiliser les teams de l'API centrale au lieu des teams locales.

**Service à créer :** `app/Services/IdemTeamService.php`

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IdemTeamService
{
    private string $apiBaseUrl;

    public function __construct()
    {
        $this->apiBaseUrl = config('idem.api_url');
    }

    /**
     * Récupérer les teams d'un utilisateur depuis l'API centrale
     */
    public function getUserTeams(string $firebaseUid): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->getFirebaseToken(),
            ])->get("{$this->apiBaseUrl}/teams/my-teams");

            if ($response->successful()) {
                return $response->json('teams', []);
            }

            Log::error('Failed to fetch user teams from central API', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [];
        } catch (\Exception $e) {
            Log::error('Error fetching user teams: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupérer une team spécifique
     */
    public function getTeam(string $teamId): ?array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->getFirebaseToken(),
            ])->get("{$this->apiBaseUrl}/teams/{$teamId}");

            if ($response->successful()) {
                return $response->json('team');
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Error fetching team: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Vérifier les permissions d'un utilisateur sur un projet
     */
    public function checkProjectPermissions(string $projectId): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->getFirebaseToken(),
            ])->get("{$this->apiBaseUrl}/project-teams/{$projectId}/permissions");

            if ($response->successful()) {
                return $response->json('permissions', []);
            }

            return [];
        } catch (\Exception $e) {
            Log::error('Error checking project permissions: ' . $e->getMessage());
            return [];
        }
    }

    private function getFirebaseToken(): string
    {
        // Récupérer le token Firebase de la requête courante
        return request()->cookie('session') ?? request()->bearerToken() ?? '';
    }
}
```

---

### Phase 3: Migrer les Routes et Controllers

**Routes à mettre à jour :**

```php
// routes/api.php

use App\Http\Middleware\FirebaseAuthMiddleware;

// Remplacer 'auth:sanctum' par 'firebase.auth'
Route::middleware(['firebase.auth'])->group(function () {

    // Teams - Proxy vers API centrale
    Route::get('/teams', [TeamController::class, 'teams']);
    Route::get('/teams/current', [TeamController::class, 'current_team']);
    Route::get('/teams/{id}', [TeamController::class, 'team_by_id']);
    Route::get('/teams/{id}/members', [TeamController::class, 'members_by_id']);

    // Autres routes protégées...
});
```

**Enregistrer le middleware :**

```php
// app/Http/Kernel.php

protected $middlewareAliases = [
    // ...
    'firebase.auth' => \App\Http\Middleware\FirebaseAuthMiddleware::class,
];
```

---

### Phase 4: Adapter le Modèle User

**Migration à créer :**

```php
// database/migrations/2025_01_XX_add_firebase_uid_to_users.php

public function up()
{
    Schema::table('users', function (Blueprint $table) {
        $table->string('firebase_uid')->nullable()->unique()->after('id');
        $table->index('firebase_uid');
    });
}
```

**Modifier le modèle User :**

```php
// app/Models/User.php

protected $fillable = [
    'name',
    'email',
    'password',
    'firebase_uid', // Ajouter
    'idem_role',
    // ...
];
```

---

### Phase 5: Nettoyer l'Ancien Système

**Fichiers à supprimer :**

- `app/Http/Middleware/SharedJwtAuth.php` (remplacé par FirebaseAuthMiddleware)
- `app/Http/Controllers/Api/AuthController.php` (login local)
- Routes d'authentification locale dans `routes/api.php`

**Fichiers à conserver :**

- `app/Models/Team.php` (pour compatibilité, mais utiliser API centrale)
- `app/Models/User.php` (modifié pour Firebase)

**Configuration à ajouter :**

```env
# .env
FIREBASE_CREDENTIALS=/path/to/firebase-credentials.json
IDEM_API_URL=https://api.idem.africa
```

---

## 🔄 Flux d'Authentification Final

```
┌─────────────────┐
│  Frontend       │
│  (Angular/React)│
└────────┬────────┘
         │
         │ 1. Login Firebase
         ▼
┌─────────────────┐
│  Firebase Auth  │
└────────┬────────┘
         │
         │ 2. ID Token
         ▼
┌─────────────────┐
│  API Centrale   │
│  (Node.js)      │
└────────┬────────┘
         │
         │ 3. Session Cookie
         ▼
┌─────────────────┐
│  Ideploy        │
│  (Laravel)      │
│  + Firebase     │
│    Middleware   │
└─────────────────┘
```

**Étapes :**

1. L'utilisateur se connecte via Firebase (frontend)
2. Le frontend obtient un ID token Firebase
3. L'API centrale crée un session cookie (14 jours)
4. Ideploy valide le session cookie via Firebase Admin SDK
5. Ideploy synchronise l'utilisateur localement
6. Ideploy récupère les teams/permissions depuis l'API centrale

---

## ✅ Checklist de Migration

### Configuration

- [ ] Installer `kreait/firebase-php`
- [ ] Créer `config/firebase.php`
- [ ] Ajouter `FIREBASE_CREDENTIALS` dans `.env`
- [ ] Télécharger les credentials Firebase

### Middleware

- [ ] Créer `FirebaseAuthMiddleware`
- [ ] Enregistrer le middleware dans `Kernel.php`
- [ ] Tester la validation des tokens

### Base de Données

- [ ] Créer migration `add_firebase_uid_to_users`
- [ ] Exécuter la migration
- [ ] Mettre à jour le modèle `User`

### Services

- [ ] Créer `IdemTeamService`
- [ ] Créer `IdemPermissionService`
- [ ] Tester les appels à l'API centrale

### Routes & Controllers

- [ ] Remplacer `auth:sanctum` par `firebase.auth`
- [ ] Adapter les controllers pour utiliser Firebase UID
- [ ] Tester toutes les routes protégées

### Nettoyage

- [ ] Supprimer `SharedJwtAuth`
- [ ] Supprimer routes d'auth locale
- [ ] Supprimer `AuthController` local
- [ ] Mettre à jour la documentation

### Tests

- [ ] Tester login avec session cookie
- [ ] Tester login avec Bearer token
- [ ] Tester synchronisation utilisateur
- [ ] Tester récupération des teams
- [ ] Tester les permissions

---

## 🚨 Points d'Attention

### 1. Compatibilité Descendante

- Conserver les utilisateurs existants
- Migrer progressivement les comptes vers Firebase
- Prévoir une période de transition

### 2. Gestion des Rôles

- Mapper les rôles Firebase vers `idem_role`
- Conserver la logique de permissions existante
- Synchroniser les rôles avec l'API centrale

### 3. Sessions et Cookies

- Les session cookies Firebase expirent après 14 jours
- Les refresh tokens permettent de renouveler automatiquement
- Configurer CORS correctement pour les cookies cross-domain

### 4. Performance

- Mettre en cache les informations des teams
- Éviter les appels répétés à l'API centrale
- Utiliser Redis pour le cache si nécessaire

---

## 📚 Documentation de Référence

- [Firebase Admin PHP SDK](https://firebase-php.readthedocs.io/)
- [API Centrale - Routes Auth](/apps/api/api/routes/auth.routes.ts)
- [Package Shared Auth Client](/packages/shared-auth-client/README.md)
- [Documentation Authorization System](/documentation/AUTHORIZATION_SYSTEM.md)

---

## 🔧 Commandes Utiles

```bash
# Installer les dépendances
composer require kreait/firebase-php

# Créer la migration
php artisan make:migration add_firebase_uid_to_users

# Exécuter les migrations
php artisan migrate

# Vider le cache
php artisan config:clear
php artisan cache:clear

# Tester l'authentification
curl -X GET http://localhost:8000/api/v1/teams \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN"
```

---

## 📞 Support

Pour toute question sur la migration, consulter :

- `/documentation/AUTHORIZATION_SYSTEM.md`
- `/apps/api/CLAUDE.md`
- `/apps/ideploy/JWT.md`
