# Quick Reference - Authentification Centralisée

## 🚀 Démarrage Rapide

### Express API

```bash
cd apps/api
npm install
npm run dev
# API disponible sur http://localhost:3001
```

### Laravel

```bash
cd apps/ideploy
composer install
php artisan migrate
php artisan serve
# App disponible sur http://localhost:8000
```

## 🔑 Configuration Minimale

### Express `.env`

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com
INTERNAL_API_KEY=your-secure-api-key-32-chars-minimum
CORS_ALLOWED_ORIGINS="http://localhost:8000"
PORT=3001
```

### Laravel `.env`

```env
IDEM_API_URL=http://localhost:3001
EXPRESS_API_KEY=same-as-express-INTERNAL_API_KEY
```

## 📡 Endpoints Express

| Méthode | Endpoint                     | Protection | Description          |
| ------- | ---------------------------- | ---------- | -------------------- |
| POST    | `/auth/sessionLogin`         | Public     | Créer session cookie |
| POST    | `/auth/verify-session`       | API Key    | Vérifier session     |
| GET     | `/auth/profile`              | Cookie     | Profil utilisateur   |
| POST    | `/auth/logout`               | Cookie     | Déconnexion          |
| GET     | `/api/teams/user/:userId`    | Cookie     | Teams utilisateur    |
| GET     | `/api/teams/:teamId`         | Cookie     | Détails team         |
| POST    | `/api/teams`                 | Cookie     | Créer team           |
| POST    | `/api/teams/:teamId/members` | Cookie     | Ajouter membre       |

## 💻 Utilisation Laravel

### Service ExpressApiClient

```php
use App\Services\ExpressApiClient;

$client = app(ExpressApiClient::class);
$sessionCookie = request()->cookie('session');

// Vérifier session
$user = $client->verifySession($sessionCookie);

// Récupérer teams
$teams = $client->getUserTeams($userId, $sessionCookie);

// Récupérer une team
$team = $client->getTeam($teamId, $sessionCookie);

// Créer team
$team = $client->createTeam([
    'name' => 'Team Name',
    'description' => 'Description'
], $sessionCookie);

// Ajouter membre
$team = $client->addTeamMember($teamId, [
    'email' => 'member@example.com',
    'displayName' => 'Member Name',
    'role' => 'member'
], $sessionCookie);
```

### Middleware

```php
// Dans routes/web.php
Route::middleware(['express.auth'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});

// Dans un controller
public function index(Request $request)
{
    $user = auth()->user(); // User synchronisé depuis Express
    $sessionCookie = $request->cookie('session');

    // Utiliser ExpressApiClient pour les teams
    $client = app(ExpressApiClient::class);
    $teams = $client->getUserTeams($user->firebase_uid, $sessionCookie);

    return view('dashboard', compact('teams'));
}
```

## 🧪 Tests Rapides

### Tester Express API

```bash
# Health check
curl http://localhost:3001/

# Verify session (nécessite API key et session cookie)
curl -X POST http://localhost:3001/auth/verify-session \
  -H "X-API-Key: your-api-key" \
  -H "Cookie: session=your-session-cookie"
```

### Tester Laravel

```bash
# Route protégée
curl http://localhost:8000/test-auth \
  -H "Cookie: session=your-session-cookie"
```

## 🔒 Sécurité

### Headers Requis

**Inter-service (Laravel → Express):**

```
X-API-Key: your-internal-api-key
Cookie: session=session-cookie-value
```

**Client → Express:**

```
Cookie: session=session-cookie-value
```

### Cookies

```javascript
{
  httpOnly: true,      // Protection XSS
  secure: true,        // HTTPS uniquement (prod)
  sameSite: 'none',    // Cross-site (prod)
  maxAge: 1209600000   // 14 jours
}
```

## 📊 Logs

### Express

```bash
# Tous les logs
tail -f apps/api/logs/combined.log

# Erreurs uniquement
tail -f apps/api/logs/error.log

# Filtrer auth
tail -f apps/api/logs/combined.log | grep "Session"
```

### Laravel

```bash
# Tous les logs
tail -f apps/ideploy/storage/logs/laravel.log

# Auth uniquement
tail -f apps/ideploy/storage/logs/laravel.log | grep "Express Auth"

# API calls
tail -f apps/ideploy/storage/logs/laravel.log | grep "Express API"
```

## 🐛 Debugging

### Vérifier la configuration

```bash
# Express
cd apps/api
node -e "require('dotenv').config(); console.log(process.env.INTERNAL_API_KEY)"

# Laravel
cd apps/ideploy
php artisan tinker
>>> config('idem.api_key')
```

### Vérifier la connexion

```bash
# Depuis Laravel vers Express
curl -X POST http://localhost:3001/auth/verify-session \
  -H "X-API-Key: $(grep EXPRESS_API_KEY .env | cut -d '=' -f2)"
```

### Vérifier Firebase

```bash
# Test session cookie
curl http://localhost:3001/auth/profile \
  -H "Cookie: session=your-session-cookie"
```

## 🔄 Flux d'Authentification

```
1. Frontend → Firebase Auth → ID Token
2. Frontend → Express /auth/sessionLogin → Session Cookie
3. Browser stocke cookie (HttpOnly)
4. Browser → Laravel (avec cookie)
5. Laravel Middleware → Express /auth/verify-session
6. Express → Firebase Admin SDK → Vérifie token
7. Express → Laravel → User data
8. Laravel → Sync user local → Auth::login()
9. Laravel → Continue request
```

## 📝 Commandes Utiles

```bash
# Générer API key sécurisée
openssl rand -hex 32

# Vérifier les routes Laravel
php artisan route:list | grep express.auth

# Nettoyer cache Laravel
php artisan cache:clear
php artisan config:clear

# Redémarrer Express en dev
cd apps/api && npm run dev

# Voir les logs en temps réel
# Terminal 1: Express
tail -f apps/api/logs/combined.log
# Terminal 2: Laravel
tail -f apps/ideploy/storage/logs/laravel.log
```

## ⚡ Performance

### Cache Laravel

```php
// Le service utilise déjà le cache (5 min)
// Pour forcer un refresh:
$client = app(ExpressApiClient::class);
$client->clearUserCache($uid);
```

### Optimisations

- Cache user profile: 5 minutes
- Connexion persistante HTTP/2
- Timeout: 30 secondes
- Retry automatique: Non (à implémenter si besoin)

## 🚨 Erreurs Courantes

| Erreur                        | Cause                  | Solution                         |
| ----------------------------- | ---------------------- | -------------------------------- |
| "Invalid API key"             | Clés différentes       | Vérifier `.env` des deux apps    |
| "Session verification failed" | Cookie invalide/expiré | Renouveler session               |
| "User not synced"             | Erreur DB Laravel      | Vérifier logs Laravel            |
| "CORS error"                  | Origin non autorisée   | Ajouter à `CORS_ALLOWED_ORIGINS` |
| "Connection refused"          | Express non démarré    | `cd apps/api && npm run dev`     |

## 📚 Documentation Complète

- **Architecture**: `CENTRALIZED_AUTH_ARCHITECTURE.md`
- **Migration**: `MIGRATION_GUIDE_CENTRALIZED_AUTH.md`
- **API Docs**: http://localhost:3001/api-docs

## 🎯 Checklist Rapide

Avant de démarrer:

- [ ] Express API configurée et démarrée
- [ ] Firebase credentials configurées
- [ ] API key générée et partagée
- [ ] Laravel `.env` configuré
- [ ] Migration database exécutée
- [ ] Middleware enregistré
- [ ] Tests passent

## 💡 Tips

1. **Toujours vérifier les logs** en cas de problème
2. **Utiliser Swagger** pour tester les endpoints Express
3. **Cache activé** par défaut (5 min) pour les performances
4. **Session cookies** valides 14 jours
5. **Refresh tokens** valides 30 jours

## 🔗 Liens Rapides

- Express API: http://localhost:3001
- Swagger: http://localhost:3001/api-docs
- Laravel: http://localhost:8000
- Logs Express: `apps/api/logs/`
- Logs Laravel: `apps/ideploy/storage/logs/`

---

**Besoin d'aide?** Consultez `MIGRATION_GUIDE_CENTRALIZED_AUTH.md` pour un guide détaillé.
