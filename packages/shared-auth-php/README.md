# @idem/shared-auth-php

Package PHP partagé pour l'authentification et l'autorisation dans l'écosystème Idem.

## 📋 Vue d'ensemble

Ce package fournit une intégration complète avec Firebase Authentication et l'API centrale Idem pour les applications PHP/Laravel.

**Équivalent PHP du package TypeScript `@idem/shared-auth-client`**

## 🎯 Fonctionnalités

- ✅ Authentification via l'API centrale (session cookies + Bearer tokens)
- ✅ Synchronisation automatique des utilisateurs
- ✅ Gestion des teams et permissions
- ✅ Client HTTP pour l'API centrale
- ✅ Middleware Laravel prêt à l'emploi
- ✅ Modèles partagés (UserModel, TeamModel, etc.)
- ✅ Cache intégré pour les performances
- ✅ Logging complet
- ✅ **Pas de dépendance Firebase** (géré par l'API centrale)

## 📦 Installation

### 1. Via Composer (Local)

```bash
# Dans votre application Laravel (ex: Ideploy)
composer require idem/shared-auth-php --prefer-source
```

### 2. Configuration Composer (Monorepo)

Ajouter dans le `composer.json` de votre application :

```json
{
  "repositories": [
    {
      "type": "path",
      "url": "../../packages/shared-auth-php"
    }
  ],
  "require": {
    "idem/shared-auth-php": "*"
  }
}
```

## 🔧 Configuration

### 1. Publier la Configuration

```bash
php artisan vendor:publish --tag=idem-auth-config
```

### 2. Variables d'Environnement

Ajouter dans `.env` :

```env
# API Centrale (OBLIGATOIRE)
IDEM_API_URL=http://localhost:3001

# En production
# IDEM_API_URL=https://api.idem.africa

# Cache (optionnel)
IDEM_AUTH_CACHE_ENABLED=true
IDEM_AUTH_CACHE_TTL=300

# Logging (optionnel)
IDEM_AUTH_LOGGING_ENABLED=true
```

**Note :** Pas besoin de Firebase credentials ! L'API centrale gère Firebase en interne.

### 3. Enregistrer le Service Provider

Dans `config/app.php` :

```php
'providers' => [
    // ...
    Idem\SharedAuth\Laravel\IdemAuthServiceProvider::class,
],
```

**Note:** Avec Laravel 11+, le service provider est auto-découvert.

## 🚀 Utilisation

### Middleware API Auth

Le middleware `idem.auth` est automatiquement enregistré.

#### Dans les Routes

```php
// routes/api.php

use Illuminate\Support\Facades\Route;

// Protéger des routes avec l'authentification API
Route::middleware(['idem.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'index']);
    Route::get('/profile', [UserController::class, 'profile']);
    Route::get('/projects', [ProjectController::class, 'index']);
});
```

#### Dans les Controllers

```php
// app/Http/Controllers/Controller.php

class Controller extends BaseController
{
    public function __construct()
    {
        $this->middleware('idem.auth');
    }
}
```

### Utiliser AuthClient

#### Injection de Dépendance

```php
use Idem\SharedAuth\AuthClient;

class TeamController extends Controller
{
    public function __construct(
        private AuthClient $authClient
    ) {}

    public function index()
    {
        // Récupérer les teams de l'utilisateur
        $teams = $this->authClient->getMyTeams();

        return response()->json([
            'teams' => array_map(fn($team) => $team->toArray(), $teams)
        ]);
    }

    public function show(string $teamId)
    {
        $team = $this->authClient->getTeam($teamId);

        if (!$team) {
            return response()->json(['error' => 'Team not found'], 404);
        }

        return response()->json(['team' => $team->toArray()]);
    }
}
```

#### Via Facade

```php
use Illuminate\Support\Facades\App;
use Idem\SharedAuth\AuthClient;

$authClient = App::make(AuthClient::class);
$teams = $authClient->getMyTeams();
```

### Accéder à l'Utilisateur Authentifié

```php
use Illuminate\Support\Facades\Auth;

class ProfileController extends Controller
{
    public function show()
    {
        $user = Auth::user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'firebase_uid' => $user->firebase_uid,
            ]
        ]);
    }
}
```

## 📚 API Reference

### AuthClient

#### Users

```php
// Obtenir le profil de l'utilisateur courant
$profile = $authClient->getUserProfile();

// Obtenir un utilisateur par ID
$user = $authClient->getUserById($userId);
```

#### Teams

```php
// Obtenir mes teams
$teams = $authClient->getMyTeams();

// Obtenir une team
$team = $authClient->getTeam($teamId);

// Créer une team
$team = $authClient->createTeam('Team Name', 'Description');

// Obtenir les membres d'une team
$members = $authClient->getTeamMembers($teamId);

// Ajouter un membre
$authClient->addTeamMember($teamId, 'user@example.com', 'John Doe', 'member');

// Mettre à jour le rôle
$authClient->updateMemberRole($teamId, $userId, 'admin');

// Retirer un membre
$authClient->removeMember($teamId, $memberId);
```

#### Project Teams & Permissions

```php
// Obtenir les teams d'un projet
$teams = $authClient->getProjectTeams($projectId);

// Ajouter une team à un projet
$authClient->addTeamToProject($projectId, $teamId, ['developer', 'designer']);

// Retirer une team d'un projet
$authClient->removeTeamFromProject($projectId, $teamId);

// Obtenir les permissions sur un projet
$permissions = $authClient->getProjectPermissions($projectId);
// ['canEdit' => true, 'canDelete' => false, ...]

// Vérifier l'accès à un projet
$hasAccess = $authClient->checkProjectAccess($projectId);
```

#### Invitations

```php
// Créer une invitation
$invitation = $authClient->createInvitation([
    'email' => 'newuser@example.com',
    'displayName' => 'New User',
    'invitationType' => 'team',
    'teamId' => $teamId,
    'teamRole' => 'member',
]);

// Obtenir une invitation par token
$invitation = $authClient->getInvitationByToken($token);

// Accepter une invitation
$authClient->acceptInvitation($token, $tempPassword, $newPassword);

// Renvoyer une invitation
$authClient->resendInvitation($invitationId);
```

### Modèles

#### UserModel

```php
use Idem\SharedAuth\Models\UserModel;

$user = new UserModel([
    'uid' => 'firebase-uid',
    'email' => 'user@example.com',
    'displayName' => 'John Doe',
]);

// Convertir en tableau
$array = $user->toArray();

// Créer depuis un tableau
$user = UserModel::fromArray($data);
```

#### TeamModel

```php
use Idem\SharedAuth\Models\TeamModel;
use Idem\SharedAuth\Models\TeamRole;

$team = new TeamModel([
    'name' => 'My Team',
    'description' => 'Team description',
    'ownerId' => 'user-id',
]);

// Vérifier si un utilisateur est membre
$isMember = $team->hasMember($userId);

// Obtenir le rôle d'un utilisateur
$role = $team->getMemberRole($userId);

// Vérifier si admin ou owner
$isAdmin = $team->isAdminOrOwner($userId);
```

## 🔐 Flux d'Authentification

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
│  - Vérifie      │
│    Firebase     │
│  - Crée session │
└────────┬────────┘
         │
         │ 3. Session Cookie (14j)
         ▼
┌─────────────────┐
│  Backend PHP    │
│  (Ideploy)      │
│  + Middleware   │
│    idem.auth    │
└────────┬────────┘
         │
         │ 4. GET /auth/profile (avec session cookie)
         ▼
┌─────────────────┐
│  API Centrale   │
│  - Vérifie      │
│    session      │
│  - Retourne     │
│    UserModel    │
└────────┬────────┘
         │
         │ 5. Sync User Localement
         ▼
┌─────────────────┐
│  Database       │
│  Locale         │
└─────────────────┘
```

**Points clés :**

- ✅ Le package PHP ne contacte **JAMAIS** Firebase directement
- ✅ Toute la logique Firebase est dans l'API centrale
- ✅ Le package PHP utilise uniquement l'API centrale
- ✅ Même architecture que le package TypeScript

## 🧪 Tests

```bash
# Exécuter les tests
composer test

# Avec coverage
composer test:coverage
```

## 📖 Documentation Complète

- [Architecture d'Authentification](/documentation/AUTHORIZATION_SYSTEM.md)
- [API Centrale](/apps/api/README.md)
- [Package TypeScript](/packages/shared-auth-client/README.md)

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 License

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🆘 Support

Pour toute question ou problème :

- Consulter la [documentation complète](/documentation/)
- Ouvrir une issue sur GitHub
- Contacter l'équipe dev@idem.africa
