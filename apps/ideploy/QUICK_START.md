# 🚀 Quick Start - Package shared-auth-php dans Ideploy

## ✅ Installation Complétée

Le package `idem/shared-auth-php` est maintenant installé !

```bash
composer show idem/shared-auth-php
# ✅ idem/shared-auth-php dev-main
```

---

## ⚙️ Configuration

### 1. Variables d'Environnement

Ajouter dans `.env` :

```env
# ============================================
# API Centrale (OBLIGATOIRE)
# ============================================
IDEM_API_URL=http://localhost:3001

# En production
# IDEM_API_URL=https://api.idem.africa

# ============================================
# Cache (Optionnel)
# ============================================
IDEM_AUTH_CACHE_ENABLED=true
IDEM_AUTH_CACHE_TTL=300

# ============================================
# Logging (Optionnel)
# ============================================
IDEM_AUTH_LOGGING_ENABLED=true
```

**Note :** Pas besoin de Firebase credentials ! L'API centrale gère Firebase.

### 2. Vérifier la Configuration

```bash
php artisan config:show idem-auth
```

---

## 🔧 Utilisation

### 1. Protéger des Routes

Éditer `routes/api.php` :

```php
use Illuminate\Support\Facades\Route;

// Remplacer auth:sanctum par idem.auth
Route::middleware(['idem.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'teams']);
    Route::get('/projects', [ProjectController::class, 'projects']);
    Route::get('/servers', [ServerController::class, 'index']);
});
```

### 2. Utiliser AuthClient dans les Controllers

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
        $this->middleware('idem.auth');
    }

    public function teams(Request $request)
    {
        try {
            // L'utilisateur est déjà authentifié par le middleware
            $user = auth()->user();

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
}
```

---

## 🧪 Test

### 1. Démarrer l'API Centrale

```bash
cd ../../api
npm run dev
# API démarre sur http://localhost:3001
```

### 2. Démarrer Ideploy

```bash
cd ../../apps/ideploy
php artisan serve
# Ideploy démarre sur http://localhost:8000
```

### 3. Tester l'Authentification

#### Option A : Avec Session Cookie

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

#### Option B : Avec Bearer Token

```bash
# Utiliser un ID token Firebase directement
curl -X GET http://localhost:8000/api/v1/teams \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN" \
  -H "Accept: application/json"
```

### 4. Vérifier les Logs

```bash
tail -f storage/logs/laravel.log
```

Vous devriez voir :

```
User authenticated via API
User synchronized from API
```

---

## 🔍 Vérification

### Vérifier que le Middleware est Enregistré

```bash
php artisan route:list --name=idem
```

### Vérifier l'AuthClient

```bash
php artisan tinker
```

```php
use Idem\SharedAuth\AuthClient;

$client = app(AuthClient::class);
dd($client);
// Devrait afficher l'instance AuthClient
```

### Tester la Connexion à l'API

```php
use Idem\SharedAuth\AuthClient;

$client = app(AuthClient::class);
$isHealthy = $client->healthCheck();
echo $isHealthy ? "✅ API accessible" : "❌ API non accessible";
```

---

## 📊 Prochaines Étapes

### 1. Migrer les Routes

Remplacer progressivement `auth:sanctum` par `idem.auth` dans :

- `routes/api.php`
- `routes/web.php`

### 2. Mettre à Jour les Controllers

Injecter `AuthClient` dans les controllers qui gèrent les teams/permissions.

### 3. Tester Toutes les Routes

Vérifier que toutes les routes protégées fonctionnent avec le nouveau middleware.

### 4. Supprimer l'Ancien Code

Une fois que tout fonctionne :

- Supprimer `SharedJwtAuth` middleware
- Supprimer les routes d'auth locale
- Nettoyer les dépendances inutilisées

---

## 🚨 Dépannage

### Erreur: "Class 'Idem\SharedAuth\AuthClient' not found"

```bash
composer dump-autoload
php artisan config:clear
php artisan cache:clear
```

### Erreur: "Central API not accessible"

Vérifier que l'API centrale est démarrée :

```bash
curl http://localhost:3001/health
```

### Erreur: "User not authenticated"

Vérifier les logs :

```bash
tail -f storage/logs/laravel.log | grep -i auth
```

---

## 📚 Documentation

- [Package README](/packages/shared-auth-php/README.md)
- [Architecture](/packages/shared-auth-php/ARCHITECTURE.md)
- [Guide d'Intégration](/apps/ideploy/INTEGRATION_SHARED_AUTH.md)
- [Architecture Globale](/documentation/SHARED_AUTH_ARCHITECTURE.md)

---

## 🆘 Support

Pour toute question :

- Vérifier les logs : `storage/logs/laravel.log`
- Vérifier l'API centrale : `curl http://localhost:3001/health`
- Consulter la documentation
- Contacter dev@idem.africa
