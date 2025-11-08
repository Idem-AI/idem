# Intégration Authentification Express - Laravel Ideploy

## 📋 Fichiers Créés/Modifiés

### ✅ Fichiers Créés

1. **`app/Services/ExpressApiClient.php`**
   - Client HTTP pour communiquer avec l'API Express
   - Méthodes: `verifySession()`, `getUserTeams()`, `getTeam()`, `createTeam()`, `addTeamMember()`
   - Cache user profile (5 minutes)
   - Logs détaillés avec préfixe `[Express API]`

2. **`app/Http/Middleware/VerifyExpressSession.php`**
   - Middleware d'authentification via Express
   - Remplace l'authentification locale Laravel
   - Vérifie session avec Express API
   - Synchronise user local (create/update)
   - `Auth::login($user)` automatique
   - Logs détaillés avec préfixe `[Express Auth]`

3. **`app/Providers/ExpressApiServiceProvider.php`**
   - Service Provider pour enregistrer ExpressApiClient comme singleton
   - Garantit une seule instance du client HTTP

4. **`database/migrations/2024_01_08_000001_add_firebase_uid_to_users_table.php`**
   - Ajoute colonne `firebase_uid` (nullable, unique, indexed)
   - Permet de lier users Laravel avec Firebase

### ✅ Fichiers Modifiés

1. **`app/Http/Kernel.php`**
   - Ajout middleware alias: `'express.auth' => \App\Http\Middleware\VerifyExpressSession::class`
   - Permet d'utiliser `Route::middleware(['express.auth'])`

2. **`app/Models/User.php`**
   - Ajout `firebase_uid` dans `$fillable`
   - Permet mass assignment pour synchronisation

3. **`config/idem.php`**
   - Ajout `api_url` et `api_key` pour Express API
   - Configuration centralisée

4. **`config/app.php`**
   - Enregistrement `ExpressApiServiceProvider` dans providers

## ⚙️ Configuration Requise

### Variables d'Environnement (.env)

```env
# Express API Configuration (OBLIGATOIRE)
IDEM_API_URL=http://localhost:3001
EXPRESS_API_KEY=your-secure-api-key-32-chars-minimum

# Note: EXPRESS_API_KEY doit être identique à INTERNAL_API_KEY de l'API Express
```

### Générer API Key Sécurisée

```bash
openssl rand -hex 32
```

## 🚀 Utilisation

### 1. Exécuter la Migration

```bash
php artisan migrate
```

Cela ajoute la colonne `firebase_uid` à la table `users`.

### 2. Utiliser le Middleware

#### Dans routes/web.php

```php
// Protéger une route
Route::middleware(['express.auth'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/profile', [ProfileController::class, 'show']);
});
```

#### Dans un Controller

```php
use App\Services\ExpressApiClient;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        // User déjà authentifié par le middleware
        $user = auth()->user();

        // Récupérer le session cookie
        $sessionCookie = $request->cookie('session');

        // Utiliser ExpressApiClient pour les teams
        $client = app(ExpressApiClient::class);
        $teams = $client->getUserTeams($user->firebase_uid, $sessionCookie);

        return view('dashboard', compact('user', 'teams'));
    }
}
```

### 3. Utiliser ExpressApiClient

```php
use App\Services\ExpressApiClient;

$client = app(ExpressApiClient::class);
$sessionCookie = request()->cookie('session');

// Vérifier une session
$user = $client->verifySession($sessionCookie);

// Récupérer les teams d'un utilisateur
$teams = $client->getUserTeams($userId, $sessionCookie);

// Récupérer une team
$team = $client->getTeam($teamId, $sessionCookie);

// Créer une team
$team = $client->createTeam([
    'name' => 'Team Name',
    'description' => 'Description'
], $sessionCookie);

// Ajouter un membre
$team = $client->addTeamMember($teamId, [
    'email' => 'member@example.com',
    'displayName' => 'Member Name',
    'role' => 'member'
], $sessionCookie);

// Invalider le cache user
$client->clearUserCache($uid);
```

## 🔒 Sécurité

### Headers Envoyés à Express

```
X-API-Key: your-express-api-key
Cookie: session=session-cookie-value
```

### Cookies Attendus

Le frontend doit envoyer un cookie `session` créé par Express:

```javascript
// Cookie créé par Express après login
{
  name: 'session',
  value: 'firebase-session-cookie',
  httpOnly: true,
  secure: true, // en production
  sameSite: 'lax',
  maxAge: 1209600000 // 14 jours
}
```

## 📊 Flux d'Authentification

```
1. User fait une requête à Laravel avec cookie session
2. Middleware VerifyExpressSession intercepte
3. Middleware extrait cookie session
4. Middleware appelle Express POST /auth/verify-session
   - Header: X-API-Key: {EXPRESS_API_KEY}
   - Cookie: session={sessionCookie}
5. Express vérifie avec Firebase Admin SDK
6. Express retourne user data
7. Middleware synchronise user local:
   - Si user n'existe pas: User::create()
   - Si user existe: User::update()
   - Stocke firebase_uid
8. Middleware: Auth::login($user)
9. Requête continue normalement
```

## 🐛 Debugging

### Vérifier la Configuration

```bash
php artisan tinker

# Vérifier l'URL de l'API
config('idem.api_url')
# Devrait retourner: "http://localhost:3001"

# Vérifier la clé API
config('idem.api_key')
# Devrait retourner votre clé API
```

### Logs

```bash
# Voir tous les logs
tail -f storage/logs/laravel.log

# Filtrer auth Express
tail -f storage/logs/laravel.log | grep "Express Auth"

# Filtrer appels API
tail -f storage/logs/laravel.log | grep "Express API"
```

### Tester le Service

```php
// Dans tinker
$client = app(\App\Services\ExpressApiClient::class);
$user = $client->verifySession('your-test-session-cookie');
dd($user);
```

## ⚠️ Erreurs Courantes

### "Invalid API key"

**Cause**: Les clés API ne correspondent pas entre Laravel et Express

**Solution**:

```bash
# Vérifier Laravel
grep EXPRESS_API_KEY .env

# Vérifier Express
grep INTERNAL_API_KEY apps/api/.env

# Doivent être identiques!
```

### "Session verification failed"

**Cause**: Cookie session invalide ou expiré

**Solution**:

```bash
# Vérifier les logs Express
tail -f apps/api/logs/combined.log

# Tester directement
curl http://localhost:3001/auth/profile \
  -H "Cookie: session=your-session-cookie"
```

### "User not synced"

**Cause**: Erreur lors de la création/mise à jour du user

**Solution**:

```bash
# Vérifier les logs Laravel
tail -f storage/logs/laravel.log | grep "Express Auth"

# Vérifier la table users
php artisan tinker
User::where('email', 'test@example.com')->first()
```

### "Connection refused"

**Cause**: Express API non démarrée

**Solution**:

```bash
cd apps/api
npm run dev
```

## 🧪 Tests

### Test Manuel

```bash
# 1. Démarrer Express
cd apps/api
npm run dev

# 2. Démarrer Laravel
cd apps/ideploy
php artisan serve

# 3. Tester avec un cookie session valide
curl http://localhost:8000/test-auth \
  -H "Cookie: session=your-session-cookie"
```

### Test Unitaire

Créer `tests/Feature/ExpressAuthTest.php`:

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Services\ExpressApiClient;

class ExpressAuthTest extends TestCase
{
    public function test_verify_session()
    {
        $client = new ExpressApiClient();
        $sessionCookie = 'your-test-session-cookie';

        $user = $client->verifySession($sessionCookie);

        $this->assertNotNull($user);
        $this->assertArrayHasKey('uid', $user);
        $this->assertArrayHasKey('email', $user);
    }
}
```

Exécuter:

```bash
php artisan test --filter=ExpressAuthTest
```

## 📝 Migration Progressive

### Étape 1: Tester sur une Route

```php
// routes/web.php
Route::middleware(['express.auth'])->group(function () {
    Route::get('/test-auth', function () {
        return response()->json([
            'success' => true,
            'user' => auth()->user(),
            'message' => 'Authenticated via Express!'
        ]);
    });
});
```

### Étape 2: Migrer Routes Existantes

```php
// ❌ AVANT
Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});

// ✅ APRÈS
Route::middleware(['express.auth'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});
```

### Étape 3: Remplacer Appels Teams

```php
// ❌ AVANT (Auth locale)
$teams = auth()->user()->teams;

// ✅ APRÈS (Express API)
$client = app(ExpressApiClient::class);
$sessionCookie = request()->cookie('session');
$teams = $client->getUserTeams(auth()->user()->firebase_uid, $sessionCookie);
```

## 📚 Documentation Complète

Pour plus de détails, consultez:

- **Architecture**: `/CENTRALIZED_AUTH_ARCHITECTURE.md`
- **Migration**: `/MIGRATION_GUIDE_CENTRALIZED_AUTH.md`
- **Référence**: `/QUICK_REFERENCE_CENTRALIZED_AUTH.md`

## ✅ Checklist d'Intégration

- [x] ExpressApiClient créé
- [x] VerifyExpressSession middleware créé
- [x] ExpressApiServiceProvider créé
- [x] Migration firebase_uid créée
- [x] Middleware enregistré dans Kernel.php
- [x] User model mis à jour (fillable)
- [x] Config idem.php mise à jour
- [x] Service Provider enregistré
- [ ] Variables d'environnement configurées
- [ ] Migration exécutée
- [ ] Tests effectués

## 🎯 Prochaines Étapes

1. Configurer `.env` avec `IDEM_API_URL` et `EXPRESS_API_KEY`
2. Exécuter `php artisan migrate`
3. Tester sur une route de test
4. Migrer progressivement les routes existantes
5. Supprimer l'auth locale (optionnel)

---

**Status**: ✅ Intégration complète - Prêt pour configuration et tests
