# 🧹 Nettoyage de l'Authentification Locale - Ideploy

## 🎯 Objectif

Transformer Ideploy en **backend pur** qui utilise uniquement l'authentification centralisée via le package `shared-auth-php`. Plus de pages de login/signup - tout passe par le dashboard.

---

## 📋 Fichiers à Supprimer

### 1. Vues d'Authentification

```bash
rm -rf resources/views/auth/
```

Contient :

- `login.blade.php`
- `register.blade.php`
- `forgot-password.blade.php`
- `reset-password.blade.php`
- `confirm-password.blade.php`
- `two-factor-challenge.blade.php`
- `verify-email.blade.php`

### 2. Controller d'Authentification Local

```bash
rm app/Http/Controllers/Api/AuthController.php
```

### 3. Middleware d'Authentification Local (si existe)

```bash
# Déjà supprimé
# rm app/Http/Middleware/SharedJwtAuth.php
```

### 4. Tests d'Authentification

```bash
rm tests/Browser/LoginTest.php
```

---

## 🔧 Modifications à Faire

### 1. Routes Web (`routes/web.php`)

**AVANT :**

```php
Route::middleware(['throttle:login'])->group(function () {
    Route::get('/auth/link', [Controller::class, 'link'])->name('auth.link');
});

// Catch-all route
return redirect()->route('login');
```

**APRÈS :**

```php
// Rediriger vers le dashboard si non authentifié
Route::get('/', function () {
    return redirect(config('idem.dashboard_url', 'http://localhost:4200'));
});

// Catch-all route - rediriger vers le dashboard
Route::fallback(function () {
    return redirect(config('idem.dashboard_url', 'http://localhost:4200'));
});
```

### 2. Routes API (`routes/api.php`)

**SUPPRIMER :**

```php
// IDEM Authentication routes (JWT)
Route::prefix('v1/auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout']);
});
```

**GARDER :**

```php
// Routes de test pour le package shared-auth-php
require __DIR__ . '/test-auth.php';
```

### 3. Configuration (`config/idem.php`)

**AJOUTER :**

```php
'dashboard_url' => env('IDEM_DASHBOARD_URL', 'http://localhost:4200'),
```

### 4. Variables d'Environnement (`.env`)

**AJOUTER :**

```env
# Dashboard URL pour redirection
IDEM_DASHBOARD_URL=http://localhost:4200

# En production
# IDEM_DASHBOARD_URL=https://dashboard.idem.africa
```

---

## 🔐 Middleware à Utiliser

### Remplacer Partout

**AVANT :**

```php
Route::middleware(['auth:sanctum'])->group(function () {
    // ...
});
```

**APRÈS :**

```php
Route::middleware(['idem.auth'])->group(function () {
    // ...
});
```

### Exemple de Migration

**Fichier : `routes/api.php`**

```php
// ❌ ANCIEN
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/teams', [TeamController::class, 'teams']);
    Route::get('/projects', [ProjectController::class, 'projects']);
});

// ✅ NOUVEAU
Route::middleware(['idem.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'teams']);
    Route::get('/projects', [ProjectController::class, 'projects']);
});
```

---

## 🚀 Flux d'Authentification Final

```
1. User visite http://localhost:8000
   ↓
2. Pas de session cookie
   ↓
3. Redirection vers http://localhost:4200 (dashboard)
   ↓
4. User se connecte sur le dashboard (Firebase)
   ↓
5. Dashboard obtient session cookie de l'API centrale
   ↓
6. User fait une requête API vers Ideploy avec le cookie
   ↓
7. Middleware idem.auth vérifie le cookie via l'API centrale
   ↓
8. User authentifié, requête traitée
```

---

## ✅ Checklist de Nettoyage

### Fichiers

- [ ] Supprimer `resources/views/auth/`
- [ ] Supprimer `app/Http/Controllers/Api/AuthController.php`
- [ ] Supprimer `tests/Browser/LoginTest.php`

### Routes

- [ ] Supprimer routes `/auth/login` et `/auth/logout` dans `routes/api.php`
- [ ] Supprimer route `/auth/link` dans `routes/web.php`
- [ ] Ajouter redirection vers dashboard dans `routes/web.php`

### Configuration

- [ ] Ajouter `dashboard_url` dans `config/idem.php`
- [ ] Ajouter `IDEM_DASHBOARD_URL` dans `.env`

### Middlewares

- [ ] Remplacer `auth:sanctum` par `idem.auth` dans toutes les routes
- [ ] Vérifier qu'aucun middleware local d'auth n'est utilisé

### Tests

- [ ] Tester la redirection vers le dashboard
- [ ] Tester l'authentification avec session cookie
- [ ] Tester les routes API protégées

---

## 🧪 Tests Après Nettoyage

### Test 1: Redirection Dashboard

```bash
curl -I http://localhost:8000/
```

**Résultat attendu :**

```
HTTP/1.1 302 Found
Location: http://localhost:4200
```

### Test 2: API Protégée Sans Auth

```bash
curl http://localhost:8000/api/v1/teams
```

**Résultat attendu :**

```json
{
  "success": false,
  "message": "Unauthorized: No authentication credentials provided"
}
```

### Test 3: API Protégée Avec Session Cookie

```bash
# Obtenir un cookie depuis le dashboard
curl http://localhost:8000/api/v1/teams \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

**Résultat attendu :**

```json
{
  "success": true,
  "teams": [...]
}
```

---

## 📚 Documentation

Après le nettoyage, mettre à jour :

- [ ] README.md - Supprimer les références au login local
- [ ] INTEGRATION_SHARED_AUTH.md - Confirmer que c'est la seule méthode
- [ ] API documentation - Supprimer les endpoints d'auth locale

---

## 🆘 En Cas de Problème

### "Page not found" au lieu de redirection

Vérifier que la route fallback est bien configurée dans `routes/web.php`

### "Unauthorized" même avec un cookie valide

1. Vérifier que l'API centrale est accessible
2. Vérifier les logs : `tail -f storage/logs/laravel.log`
3. Tester manuellement : `curl http://localhost:3001/health`

### Anciennes routes encore accessibles

```bash
# Vider le cache des routes
php artisan route:clear
php artisan config:clear
php artisan cache:clear
```

---

## 🎉 Résultat Final

Après le nettoyage, Ideploy sera :

- ✅ Un backend pur (API uniquement)
- ✅ Sans pages de login/signup
- ✅ Authentification 100% centralisée
- ✅ Redirection automatique vers le dashboard
- ✅ Utilisation du package `shared-auth-php`
