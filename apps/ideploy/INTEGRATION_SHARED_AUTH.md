# 🔗 Guide d'Intégration - Package Shared Auth PHP dans Ideploy

## 📋 Vue d'ensemble

Ce guide explique comment intégrer le package `idem/shared-auth-php` dans Ideploy pour remplacer complètement le système d'authentification local par le système centralisé.

---

## 🎯 Objectifs

1. ✅ Remplacer l'authentification JWT locale par Firebase Auth
2. ✅ Utiliser l'API centrale pour les teams et permissions
3. ✅ Synchroniser les utilisateurs automatiquement
4. ✅ Supprimer le code d'authentification redondant
5. ✅ Utiliser les modèles partagés

---

## 📦 Étape 1: Installation du Package

### 1.1 Ajouter le Repository Local

Éditer `composer.json` d'Ideploy :

```json
{
  "repositories": [
    {
      "type": "path",
      "url": "../../packages/shared-auth-php",
      "options": {
        "symlink": true
      }
    }
  ],
  "require": {
    "idem/shared-auth-php": "*"
  }
}
```

### 1.2 Installer le Package

```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/ideploy
composer require idem/shared-auth-php
```

### 1.3 Vérifier l'Installation

```bash
composer show idem/shared-auth-php
```

---

## ⚙️ Étape 2: Configuration

### 2.1 Publier la Configuration

```bash
php artisan vendor:publish --tag=idem-auth-config
```

Cela crée le fichier `config/idem-auth.php`.

### 2.2 Configurer les Variables d'Environnement

Mettre à jour `.env` :

```env
# ============================================
# Firebase Authentication
# ============================================
FIREBASE_CREDENTIALS=/absolute/path/to/storage/app/firebase-credentials.json
FIREBASE_PROJECT_ID=lexis-ia
FIREBASE_DATABASE_URL=https://lexis-ia.firebaseio.com
FIREBASE_STORAGE_BUCKET=lexis-ia.appspot.com

# ============================================
# Central API Integration
# ============================================
IDEM_API_URL=http://localhost:3001

# En production
# IDEM_API_URL=https://api.idem.africa

# ============================================
# Cache Configuration
# ============================================
IDEM_AUTH_CACHE_ENABLED=true
IDEM_AUTH_CACHE_TTL=300

# ============================================
# Logging
# ============================================
IDEM_AUTH_LOGGING_ENABLED=true
IDEM_AUTH_LOG_SUCCESS=true
IDEM_AUTH_LOG_FAILURES=true
```

### 2.3 Télécharger les Credentials Firebase

1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionner le projet `lexis-ia`
3. **Project Settings** > **Service Accounts**
4. **Generate New Private Key**
5. Télécharger et placer dans `storage/app/firebase-credentials.json`

```bash
chmod 600 storage/app/firebase-credentials.json
```

---

## 🗄️ Étape 3: Migration de la Base de Données

### 3.1 Créer la Migration

La migration existe déjà : `database/migrations/2025_01_05_000000_add_firebase_uid_to_users_table.php`

### 3.2 Exécuter la Migration

```bash
php artisan migrate
```

Cette migration ajoute :

- `firebase_uid` (string, unique, indexed)
- `firebase_custom_claims` (json, nullable)

### 3.3 Vérifier la Migration

```bash
php artisan tinker
```

```php
Schema::hasColumn('users', 'firebase_uid');
// true

DB::select("SHOW INDEX FROM users WHERE Column_name = 'firebase_uid'");
// Affiche l'index
```

---

## 🔧 Étape 4: Enregistrer le Service Provider

### 4.1 Laravel 11+ (Auto-découverte)

Le Service Provider est automatiquement découvert. Rien à faire !

### 4.2 Laravel 10 (Manuel)

Ajouter dans `config/app.php` :

```php
'providers' => [
    // ...
    Idem\SharedAuth\Laravel\IdemAuthServiceProvider::class,
],
```

### 4.3 Vérifier l'Enregistrement

```bash
php artisan route:list --name=firebase
```

Le middleware `firebase.auth` devrait être disponible.

---

## 🔄 Étape 5: Remplacer les Middlewares

### 5.1 Identifier les Routes à Migrer

```bash
grep -r "auth:sanctum" routes/
grep -r "SharedJwtAuth" app/Http/
```

### 5.2 Remplacer dans `routes/api.php`

**AVANT :**

```php
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/teams', [TeamController::class, 'teams']);
    Route::get('/projects', [ProjectController::class, 'projects']);
    // ...
});
```

**APRÈS :**

```php
Route::middleware(['firebase.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'teams']);
    Route::get('/projects', [ProjectController::class, 'projects']);
    // ...
});
```

### 5.3 Remplacer dans les Controllers

**AVANT :**

```php
class TeamController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }
}
```

**APRÈS :**

```php
class TeamController extends Controller
{
    public function __construct()
    {
        $this->middleware('firebase.auth');
    }
}
```

---

## 🔌 Étape 6: Utiliser AuthClient

### 6.1 Injection dans les Controllers

**Créer un nouveau controller ou modifier l'existant :**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Idem\SharedAuth\AuthClient;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function __construct(
        private AuthClient $authClient
    ) {
        $this->middleware('firebase.auth');
    }

    /**
     * Obtenir les teams de l'utilisateur
     */
    public function teams(Request $request)
    {
        try {
            // Récupérer les teams depuis l'API centrale
            $teams = $this->authClient->getMyTeams();

            return response()->json([
                'success' => true,
                'teams' => array_map(fn($team) => $team->toArray(), $teams),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch teams',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtenir une team spécifique
     */
    public function team_by_id(Request $request)
    {
        $teamId = $request->id;

        try {
            $team = $this->authClient->getTeam($teamId);

            if (!$team) {
                return response()->json([
                    'success' => false,
                    'message' => 'Team not found',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'team' => $team->toArray(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch team',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtenir les membres d'une team
     */
    public function members_by_id(Request $request)
    {
        $teamId = $request->id;

        try {
            $members = $this->authClient->getTeamMembers($teamId);

            return response()->json([
                'success' => true,
                'members' => $members,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch team members',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
```

### 6.2 Utiliser les Modèles Partagés

```php
use Idem\SharedAuth\Models\TeamModel;
use Idem\SharedAuth\Models\TeamRole;
use Idem\SharedAuth\Models\UserModel;

// Créer une team
$team = new TeamModel([
    'name' => 'My Team',
    'description' => 'Team description',
    'ownerId' => auth()->user()->firebase_uid,
]);

// Vérifier le rôle d'un utilisateur
$role = $team->getMemberRole($userId);
if ($role === TeamRole::ADMIN || $role === TeamRole::OWNER) {
    // Autoriser l'action
}
```

---

## 🧹 Étape 7: Nettoyage du Code Existant

### 7.1 Supprimer les Fichiers Obsolètes

**⚠️ ATTENTION : Faire des backups avant de supprimer !**

```bash
# Sauvegarder
cp app/Http/Middleware/SharedJwtAuth.php app/Http/Middleware/SharedJwtAuth.php.backup
cp app/Http/Controllers/Api/AuthController.php app/Http/Controllers/Api/AuthController.php.backup

# Supprimer (après avoir vérifié que tout fonctionne)
rm app/Http/Middleware/SharedJwtAuth.php
rm app/Http/Controllers/Api/AuthController.php
```

### 7.2 Nettoyer les Routes

Dans `routes/api.php`, supprimer ou commenter :

```php
// ANCIEN - À SUPPRIMER
// Route::post('/auth/login', [AuthController::class, 'login']);
// Route::post('/auth/register', [AuthController::class, 'register']);
```

### 7.3 Mettre à Jour le Modèle User

Éditer `app/Models/User.php` :

```php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'firebase_uid',           // ✅ Nouveau
        'firebase_custom_claims', // ✅ Nouveau
        'idem_role',
        'email_verified_at',
        // ... autres champs
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'firebase_custom_claims' => 'array', // ✅ Nouveau
    ];

    /**
     * Vérifier si l'utilisateur est admin
     */
    public function isAdmin(): bool
    {
        return $this->idem_role === 'admin' || $this->idem_role === 'owner';
    }

    /**
     * Vérifier si l'utilisateur est owner
     */
    public function isOwner(): bool
    {
        return $this->idem_role === 'owner';
    }
}
```

---

## 🧪 Étape 8: Tests

### 8.1 Test d'Authentification avec Session Cookie

```bash
# 1. Obtenir un session cookie depuis l'API centrale
curl -X POST http://localhost:3001/auth/sessionLogin \
  -H "Content-Type: application/json" \
  -d '{
    "token": "FIREBASE_ID_TOKEN",
    "user": {
      "uid": "test-user-id",
      "email": "test@example.com",
      "displayName": "Test User"
    }
  }' \
  -c cookies.txt

# 2. Tester sur Ideploy
curl -X GET http://localhost:8000/api/v1/teams \
  -b cookies.txt \
  -H "Accept: application/json"
```

### 8.2 Test d'Authentification avec Bearer Token

```bash
# Utiliser un ID token Firebase directement
curl -X GET http://localhost:8000/api/v1/teams \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN" \
  -H "Accept: application/json"
```

### 8.3 Test de Synchronisation Utilisateur

```bash
php artisan tinker
```

```php
// Vérifier qu'un utilisateur Firebase a été créé
$user = User::where('firebase_uid', 'test-user-id')->first();
dd($user);

// Devrait afficher :
// - email: test@example.com
// - firebase_uid: test-user-id
// - name: Test User
// - email_verified_at: DateTime
```

### 8.4 Test des Teams depuis l'API

```bash
php artisan tinker
```

```php
use Idem\SharedAuth\AuthClient;

$authClient = app(AuthClient::class);

// Configurer un token de test (obtenu depuis Firebase)
$authClient->setAuthToken('FIREBASE_ID_TOKEN');

// Tester la récupération des teams
$teams = $authClient->getMyTeams();
dd($teams);

// Tester la santé de l'API
$isHealthy = $authClient->healthCheck();
echo $isHealthy ? "✅ API accessible" : "❌ API non accessible";
```

---

## 📊 Étape 9: Monitoring et Logs

### 9.1 Vérifier les Logs d'Authentification

```bash
# Logs en temps réel
tail -f storage/logs/laravel.log

# Filtrer les authentifications réussies
grep "User authenticated" storage/logs/laravel.log

# Filtrer les échecs
grep "Authentication failed" storage/logs/laravel.log

# Filtrer les erreurs Firebase
grep "Firebase" storage/logs/laravel.log | grep -i error
```

### 9.2 Vérifier le Cache

```bash
php artisan tinker
```

```php
use Illuminate\Support\Facades\Cache;

// Vérifier le cache d'un utilisateur
$cached = Cache::get('user_profile_test-user-id');
dd($cached);

// Vérifier le cache d'une team
$cached = Cache::get('team_team-id');
dd($cached);

// Invalider le cache
Cache::forget('user_profile_test-user-id');
```

---

## 🚨 Dépannage

### Erreur: "Firebase credentials file not found"

```bash
# Vérifier le chemin
ls -la storage/app/firebase-credentials.json

# Vérifier les permissions
chmod 600 storage/app/firebase-credentials.json

# Vérifier la variable d'environnement
php artisan config:show idem-auth.firebase.credentials
```

### Erreur: "Failed to verify session cookie"

**Causes possibles :**

1. Session cookie expiré (14 jours)
2. Mauvais projet Firebase
3. Credentials Firebase invalides

**Solution :**

```bash
# Vérifier les logs
tail -f storage/logs/laravel.log | grep Firebase

# Obtenir un nouveau session cookie
# Depuis l'API centrale: POST /auth/sessionLogin
```

### Erreur: "Central API not accessible"

```bash
# Vérifier l'URL
php artisan config:show idem-auth.api_url

# Tester manuellement
curl http://localhost:3001/health

# Vérifier que l'API centrale est démarrée
cd ../../api
npm run dev
```

### Erreur: "Class 'Idem\SharedAuth\AuthClient' not found"

```bash
# Vérifier l'installation du package
composer show idem/shared-auth-php

# Réinstaller si nécessaire
composer remove idem/shared-auth-php
composer require idem/shared-auth-php

# Vider le cache
composer dump-autoload
php artisan config:clear
php artisan cache:clear
```

---

## ✅ Checklist de Validation

- [ ] Package `idem/shared-auth-php` installé
- [ ] Configuration publiée (`config/idem-auth.php`)
- [ ] Variables d'environnement configurées
- [ ] Firebase credentials téléchargés et placés
- [ ] Migration exécutée (`firebase_uid` ajouté)
- [ ] Service Provider enregistré
- [ ] Middleware `firebase.auth` disponible
- [ ] Routes migrées vers `firebase.auth`
- [ ] Controllers utilisent `AuthClient`
- [ ] Test d'authentification avec session cookie réussi
- [ ] Test d'authentification avec Bearer token réussi
- [ ] Synchronisation utilisateur fonctionne
- [ ] Récupération des teams depuis l'API fonctionne
- [ ] Cache configuré et fonctionnel
- [ ] Logs vérifiés et propres
- [ ] Ancien code d'authentification supprimé

---

## 📚 Ressources

- [Package shared-auth-php](/packages/shared-auth-php/README.md)
- [Architecture d'Authentification](/documentation/SHARED_AUTH_ARCHITECTURE.md)
- [API Centrale - Routes Auth](/apps/api/api/routes/auth.routes.ts)
- [Système d'Autorisation](/documentation/AUTHORIZATION_SYSTEM.md)

---

## 🆘 Support

Pour toute question :

- Consulter la documentation complète
- Vérifier les logs : `storage/logs/laravel.log`
- Ouvrir une issue GitHub
- Contacter dev@idem.africa
