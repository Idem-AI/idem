# Guide de Migration vers l'Authentification Centralisée

Ce guide vous accompagne étape par étape pour migrer de l'authentification locale Laravel vers l'authentification centralisée Express/Firebase.

## Prérequis

- ✅ Express API fonctionnelle avec Firebase configuré
- ✅ Laravel avec PostgreSQL
- ✅ Accès aux deux applications
- ✅ Clé API partagée générée

## Étape 1: Configuration Express API

### 1.1 Variables d'environnement

Créez ou mettez à jour `apps/api/.env`:

```env
# Firebase Configuration (depuis Firebase Console)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-client-email@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Générer une clé API sécurisée (32+ caractères)
INTERNAL_API_KEY=$(openssl rand -hex 32)

# CORS - Ajouter l'URL de Laravel
CORS_ALLOWED_ORIGINS="https://idem.africa,https://ideploy.idem.africa,http://localhost:8000"

# Server
PORT=3001
NODE_ENV=development
```

### 1.2 Vérifier les endpoints

```bash
cd apps/api
npm install
npm run dev

# Dans un autre terminal, tester:
curl http://localhost:3001/
# Devrait retourner: {"message":"API is running","status":"ok"}
```

### 1.3 Tester Swagger

Ouvrez http://localhost:3001/api-docs et vérifiez que vous voyez:

- Section "Authentication"
- Section "Teams"
- Endpoint POST /auth/verify-session

## Étape 2: Configuration Laravel

### 2.1 Ajouter les variables d'environnement

Ajoutez à `apps/ideploy/.env`:

```env
# Express API Configuration
IDEM_API_URL=http://localhost:3001
EXPRESS_API_KEY=same-value-as-INTERNAL_API_KEY-from-express
```

**⚠️ IMPORTANT**: `EXPRESS_API_KEY` doit être identique à `INTERNAL_API_KEY` d'Express.

### 2.2 Exécuter la migration

```bash
cd apps/ideploy
php artisan migrate
```

Cela ajoute la colonne `firebase_uid` à la table `users`.

### 2.3 Vérifier la configuration

```bash
php artisan tinker

# Dans tinker:
config('idem.api_url')
# Devrait retourner: "http://localhost:3001"

config('idem.api_key')
# Devrait retourner votre clé API
```

## Étape 3: Tester l'Intégration

### 3.1 Obtenir un session cookie valide

Depuis votre frontend Angular ou via Postman:

```bash
# 1. Se connecter via Firebase (frontend)
# 2. Récupérer l'ID token
# 3. Appeler sessionLogin

curl -X POST http://localhost:3001/auth/sessionLogin \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-firebase-id-token",
    "user": {
      "uid": "test-uid",
      "email": "test@example.com",
      "displayName": "Test User"
    }
  }'

# Copier le cookie session de la réponse
```

### 3.2 Tester verify-session

```bash
curl -X POST http://localhost:3001/auth/verify-session \
  -H "X-API-Key: your-api-key" \
  -H "Cookie: session=your-session-cookie"

# Devrait retourner:
# {
#   "success": true,
#   "user": {
#     "uid": "test-uid",
#     "email": "test@example.com",
#     ...
#   }
# }
```

### 3.3 Tester le service Laravel

Créez un fichier de test `apps/ideploy/tests/Feature/ExpressApiTest.php`:

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Services\ExpressApiClient;

class ExpressApiTest extends TestCase
{
    public function test_verify_session()
    {
        $client = new ExpressApiClient();

        // Remplacez par un vrai session cookie
        $sessionCookie = 'your-test-session-cookie';

        $user = $client->verifySession($sessionCookie);

        $this->assertNotNull($user);
        $this->assertArrayHasKey('uid', $user);
        $this->assertArrayHasKey('email', $user);
    }
}
```

Exécutez:

```bash
php artisan test --filter=ExpressApiTest
```

## Étape 4: Activer le Middleware

### 4.1 Enregistrer le middleware

Dans `app/Http/Kernel.php`, ajoutez:

```php
protected $middlewareAliases = [
    // ... autres middlewares
    'express.auth' => \App\Http\Middleware\VerifyExpressSession::class,
];
```

### 4.2 Tester sur une route protégée

Créez une route de test dans `routes/web.php`:

```php
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

Testez:

```bash
curl http://localhost:8000/test-auth \
  -H "Cookie: session=your-session-cookie"

# Devrait retourner les infos de l'utilisateur
```

## Étape 5: Migration Progressive

### 5.1 Identifier les routes à migrer

Listez toutes les routes utilisant l'ancien middleware `auth`:

```bash
php artisan route:list --columns=uri,middleware | grep auth
```

### 5.2 Migrer route par route

Pour chaque route:

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

### 5.3 Remplacer les appels User/Team

#### Récupérer les teams d'un utilisateur

```php
// ❌ AVANT
$teams = auth()->user()->teams;

// ✅ APRÈS
$expressClient = app(\App\Services\ExpressApiClient::class);
$sessionCookie = request()->cookie('session');
$teams = $expressClient->getUserTeams(auth()->id(), $sessionCookie);
```

#### Récupérer une team

```php
// ❌ AVANT
$team = Team::find($teamId);

// ✅ APRÈS
$expressClient = app(\App\Services\ExpressApiClient::class);
$sessionCookie = request()->cookie('session');
$team = $expressClient->getTeam($teamId, $sessionCookie);
```

#### Créer une team

```php
// ❌ AVANT
$team = Team::create([
    'name' => $request->name,
    'description' => $request->description,
]);

// ✅ APRÈS
$expressClient = app(\App\Services\ExpressApiClient::class);
$sessionCookie = request()->cookie('session');
$team = $expressClient->createTeam([
    'name' => $request->name,
    'description' => $request->description,
], $sessionCookie);
```

## Étape 6: Nettoyage

### 6.1 Supprimer les routes d'auth locales

Commentez ou supprimez dans `routes/web.php`:

```php
// ❌ À SUPPRIMER
// Auth::routes();
// Route::post('/login', [LoginController::class, 'login']);
// Route::post('/register', [RegisterController::class, 'register']);
```

### 6.2 Supprimer les controllers d'auth

```bash
# Sauvegarder d'abord (au cas où)
mv app/Http/Controllers/Auth app/Http/Controllers/Auth.backup

# Ou supprimer définitivement
rm -rf app/Http/Controllers/Auth
```

### 6.3 Supprimer les vues d'auth

```bash
# Sauvegarder
mv resources/views/auth resources/views/auth.backup

# Ou supprimer
rm -rf resources/views/auth
```

### 6.4 Nettoyer les migrations

Les migrations users/teams locales peuvent être conservées pour la structure PostgreSQL, mais ne sont plus utilisées pour l'auth.

### 6.5 Mettre à jour le middleware par défaut

Dans `app/Http/Kernel.php`:

```php
protected $middlewareAliases = [
    'auth' => \App\Http\Middleware\VerifyExpressSession::class, // ✅ Nouveau par défaut
    // 'auth' => \App\Http\Middleware\Authenticate::class, // ❌ Ancien
    // ... autres middlewares
];
```

## Étape 7: Tests Complets

### 7.1 Tests unitaires

```bash
php artisan test
```

### 7.2 Tests manuels

Testez les scénarios suivants:

1. **Login**
   - Se connecter via le frontend
   - Vérifier que le cookie session est créé
   - Vérifier que l'utilisateur est synchronisé dans PostgreSQL

2. **Navigation**
   - Accéder aux pages protégées
   - Vérifier que l'auth fonctionne
   - Vérifier les logs Laravel (`[Express Auth]`)

3. **Teams**
   - Créer une team
   - Ajouter des membres
   - Vérifier dans Firestore

4. **Logout**
   - Se déconnecter
   - Vérifier que le cookie est supprimé
   - Vérifier que l'accès est refusé

### 7.3 Tests de charge

Utilisez Apache Bench ou k6:

```bash
# Test simple
ab -n 100 -c 10 \
  -H "Cookie: session=your-session-cookie" \
  http://localhost:8000/test-auth
```

## Étape 8: Déploiement Production

### 8.1 Variables d'environnement production

**Express API:**

```env
NODE_ENV=production
PORT=3001
INTERNAL_API_KEY=<générer-une-nouvelle-clé-sécurisée>
CORS_ALLOWED_ORIGINS="https://idem.africa,https://ideploy.idem.africa"
```

**Laravel:**

```env
APP_ENV=production
IDEM_API_URL=https://api.idem.africa
EXPRESS_API_KEY=<même-clé-que-express>
```

### 8.2 Vérifications de sécurité

- [ ] HTTPS activé partout
- [ ] Cookies Secure=true
- [ ] API key différente de dev
- [ ] CORS configuré correctement
- [ ] Firewall entre services (si applicable)

### 8.3 Monitoring

Configurez des alertes pour:

- Échecs d'authentification Express
- Erreurs de synchronisation Laravel
- Latence des appels API
- Taux d'erreur > 1%

### 8.4 Rollback plan

En cas de problème:

1. **Rollback Laravel:**

   ```php
   // Dans Kernel.php
   'auth' => \App\Http\Middleware\Authenticate::class, // Revenir à l'ancien
   ```

2. **Rollback routes:**

   ```bash
   git checkout HEAD~1 routes/web.php
   ```

3. **Réactiver auth locale:**
   ```bash
   mv app/Http/Controllers/Auth.backup app/Http/Controllers/Auth
   mv resources/views/auth.backup resources/views/auth
   ```

## Étape 9: Documentation et Formation

### 9.1 Documenter les changements

Créez un fichier `CHANGELOG.md`:

```markdown
# Changelog

## [2.0.0] - 2024-01-08

### Changed

- Migration vers authentification centralisée Express/Firebase
- Suppression de l'auth locale Laravel
- Ajout du middleware VerifyExpressSession
- Ajout du service ExpressApiClient

### Removed

- Controllers Auth locaux
- Routes auth locales
- Vues auth locales
```

### 9.2 Former l'équipe

Points clés à communiquer:

- L'auth est maintenant gérée par Express
- Les users/teams sont dans Firestore
- Laravel synchronise localement pour les données métiers
- Utiliser ExpressApiClient pour les opérations teams

## Troubleshooting

### Problème: "Invalid API key"

**Solution:**

```bash
# Vérifier que les clés correspondent
# Express:
grep INTERNAL_API_KEY apps/api/.env

# Laravel:
grep EXPRESS_API_KEY apps/ideploy/.env

# Doivent être identiques!
```

### Problème: "Session verification failed"

**Solution:**

```bash
# Vérifier les logs Express
tail -f apps/api/logs/combined.log

# Vérifier que Firebase est configuré
curl http://localhost:3001/auth/profile \
  -H "Cookie: session=your-session-cookie"
```

### Problème: "User not synced"

**Solution:**

```bash
# Vérifier les logs Laravel
tail -f apps/ideploy/storage/logs/laravel.log | grep "Express Auth"

# Vérifier la table users
php artisan tinker
User::where('email', 'test@example.com')->first()
```

### Problème: "CORS error"

**Solution:**

```bash
# Ajouter l'origin Laravel dans Express .env
CORS_ALLOWED_ORIGINS="...,http://localhost:8000"

# Redémarrer Express
cd apps/api
npm run dev
```

## Checklist Finale

Avant de considérer la migration terminée:

- [ ] Express API fonctionne et répond
- [ ] Firebase configuré correctement
- [ ] API key partagée configurée
- [ ] Migration database exécutée
- [ ] Middleware VerifyExpressSession activé
- [ ] Toutes les routes migrées
- [ ] Tests unitaires passent
- [ ] Tests manuels réussis
- [ ] Logs configurés et fonctionnels
- [ ] Documentation à jour
- [ ] Équipe formée
- [ ] Plan de rollback prêt
- [ ] Monitoring en place

## Support

En cas de problème:

1. Consultez les logs (Express + Laravel)
2. Vérifiez la configuration (API keys, URLs)
3. Testez les endpoints individuellement
4. Consultez `CENTRALIZED_AUTH_ARCHITECTURE.md`
5. Contactez l'équipe technique

## Conclusion

Cette migration centralise l'authentification et simplifie l'architecture. Laravel devient un client pur qui se concentre sur sa logique métier, tandis qu'Express gère toute la complexité de l'authentification Firebase.

Bonne migration! 🚀
