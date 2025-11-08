# Authentification Centralisée IDEM

> **Système d'authentification centralisé avec Express (Node.js + Firebase) et Laravel comme client**

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Démarrage Rapide](#démarrage-rapide)
- [Documentation](#documentation)
- [Architecture](#architecture)
- [Fichiers Créés](#fichiers-créés)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Support](#support)

## 🎯 Vue d'ensemble

Cette implémentation centralise l'authentification et la gestion des utilisateurs/équipes dans l'API Express (Node.js + Firebase), tandis que Laravel (Ideploy) devient un client pur qui consomme ces services.

### Objectifs Atteints

✅ **Authentification centralisée** via Firebase et Express  
✅ **Gestion users/teams** dans Firestore (source unique de vérité)  
✅ **Laravel devient client** de l'API Express  
✅ **Sécurité renforcée** avec API keys et session cookies  
✅ **Documentation complète** et guides de migration

### Avantages

- 🔒 **Sécurité**: Firebase Admin SDK + API keys + session cookies HttpOnly
- 📈 **Scalabilité**: Firestore NoSQL + architecture stateless
- 🔄 **Cohérence**: Même auth pour tous les services (Angular, Laravel, futurs)
- 🛠️ **Maintenabilité**: Source unique de vérité, code centralisé
- ⚡ **Performance**: Cache local (5 min) dans Laravel

## 🚀 Démarrage Rapide

### Prérequis

- Node.js >= 18
- PHP >= 8.1
- PostgreSQL >= 13
- Compte Firebase avec projet configuré

### Installation Express API

```bash
cd apps/api
npm install
cp .env.example .env
# Configurer .env (voir section Configuration)
npm run dev
```

### Installation Laravel

```bash
cd apps/ideploy
composer install
# Ajouter IDEM_API_URL et EXPRESS_API_KEY au .env
php artisan migrate
php artisan serve
```

### Vérification

```bash
# Express API
curl http://localhost:3001/
# Devrait retourner: {"message":"API is running","status":"ok"}

# Swagger
open http://localhost:3001/api-docs

# Laravel
curl http://localhost:8000/
```

## 📚 Documentation

### Guides Complets

| Document                                                                         | Description                                 | Lignes |
| -------------------------------------------------------------------------------- | ------------------------------------------- | ------ |
| **[CENTRALIZED_AUTH_ARCHITECTURE.md](./CENTRALIZED_AUTH_ARCHITECTURE.md)**       | Architecture complète, diagrammes, sécurité | 5000+  |
| **[MIGRATION_GUIDE_CENTRALIZED_AUTH.md](./MIGRATION_GUIDE_CENTRALIZED_AUTH.md)** | Guide de migration étape par étape          | 3000+  |
| **[QUICK_REFERENCE_CENTRALIZED_AUTH.md](./QUICK_REFERENCE_CENTRALIZED_AUTH.md)** | Référence rapide, commandes, exemples       | 1000+  |
| **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)**                     | Résumé de l'implémentation                  | 1500+  |

### Swagger API

Documentation interactive disponible sur:

- **Dev**: http://localhost:3001/api-docs
- **Prod**: https://api.idem.africa/api-docs

## 🏗️ Architecture

```
┌─────────────┐
│   Firebase  │ ← Source unique de vérité
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│      Express API (Node.js)      │
│  • Firebase Admin SDK           │
│  • Firestore (users, teams)     │
│  • REST API                     │
│  • Session cookies              │
└────────────┬────────────────────┘
             │ HTTP + API Key
             ▼
┌─────────────────────────────────┐
│      Laravel (Ideploy)          │
│  • ExpressApiClient Service     │
│  • VerifyExpressSession         │
│  • PostgreSQL (sync local)      │
│  • Logique métier               │
└─────────────────────────────────┘
```

### Flux d'Authentification

1. User se connecte via Firebase (Google/GitHub/Email)
2. Frontend obtient ID Token
3. POST `/auth/sessionLogin` → Session cookie (14 jours)
4. Browser stocke cookie (HttpOnly, Secure)
5. Requête Laravel avec cookie
6. Middleware → Express `/auth/verify-session`
7. Express → Firebase Admin SDK
8. Laravel synchronise user local
9. `Auth::login($user)`
10. Requête continue

## 📦 Fichiers Créés

### Express API (`apps/api/`)

```
api/
├── routes/
│   └── teams.routes.ts          # Routes REST teams
├── controllers/
│   └── teams.controller.ts      # Logique métier teams
├── middleware/
│   └── verifyApiKey.ts          # Vérification API key
└── services/authorization/
    └── team.service.ts          # Service teams (modifié)
```

### Laravel (`apps/ideploy/`)

```
app/
├── Services/
│   └── ExpressApiClient.php    # Client HTTP Express
├── Http/Middleware/
│   └── VerifyExpressSession.php # Middleware auth
└── database/migrations/
    └── 2024_01_08_000001_add_firebase_uid_to_users_table.php
```

### Documentation

```
/
├── CENTRALIZED_AUTH_ARCHITECTURE.md
├── MIGRATION_GUIDE_CENTRALIZED_AUTH.md
├── QUICK_REFERENCE_CENTRALIZED_AUTH.md
├── IMPLEMENTATION_SUMMARY.md
└── README_CENTRALIZED_AUTH.md (ce fichier)
```

## ⚙️ Configuration

### Express API (`.env`)

```env
# Firebase Configuration (obligatoire)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=https://...
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Inter-Service Authentication (obligatoire)
INTERNAL_API_KEY=your-secure-api-key-32-chars-minimum

# CORS (obligatoire)
CORS_ALLOWED_ORIGINS="https://idem.africa,https://ideploy.idem.africa,http://localhost:8000"

# Server
PORT=3001
NODE_ENV=development
```

### Laravel (`.env`)

```env
# Express API Configuration (obligatoire)
IDEM_API_URL=http://localhost:3001
EXPRESS_API_KEY=same-as-express-INTERNAL_API_KEY

# Database (existant)
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ideploy
DB_USERNAME=postgres
DB_PASSWORD=your-password
```

### Générer API Key Sécurisée

```bash
openssl rand -hex 32
```

## 💻 Utilisation

### Express API - Endpoints

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

### Laravel - Service ExpressApiClient

```php
use App\Services\ExpressApiClient;

$client = app(ExpressApiClient::class);
$sessionCookie = request()->cookie('session');

// Vérifier session
$user = $client->verifySession($sessionCookie);

// Récupérer teams
$teams = $client->getUserTeams($userId, $sessionCookie);

// Créer team
$team = $client->createTeam([
    'name' => 'Team Name',
    'description' => 'Description'
], $sessionCookie);
```

### Laravel - Middleware

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

    $client = app(ExpressApiClient::class);
    $teams = $client->getUserTeams($user->firebase_uid, $sessionCookie);

    return view('dashboard', compact('teams'));
}
```

## 🧪 Tests

### Tests Express API

```bash
cd apps/api
npm test

# Test manuel
curl -X POST http://localhost:3001/auth/verify-session \
  -H "X-API-Key: your-api-key" \
  -H "Cookie: session=your-session-cookie"
```

### Tests Laravel

```bash
cd apps/ideploy
php artisan test

# Test manuel
curl http://localhost:8000/test-auth \
  -H "Cookie: session=your-session-cookie"
```

### Tests d'Intégration

1. Login via frontend → Session cookie créé
2. Requête Laravel → Middleware vérifie avec Express
3. User synchronisé → `Auth::login()`
4. Créer team → Stockée dans Firestore
5. Logout → Cookie supprimé

## 🚀 Déploiement

### Production Express API

```bash
cd apps/api
npm run build
NODE_ENV=production npm start
```

### Production Laravel

```bash
cd apps/ideploy
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Variables d'Environnement Production

**Express:**

```env
NODE_ENV=production
INTERNAL_API_KEY=<nouvelle-clé-sécurisée>
CORS_ALLOWED_ORIGINS="https://idem.africa,https://ideploy.idem.africa"
```

**Laravel:**

```env
APP_ENV=production
IDEM_API_URL=https://api.idem.africa
EXPRESS_API_KEY=<même-clé-que-express>
```

### Checklist Déploiement

- [ ] HTTPS activé partout
- [ ] Cookies Secure=true
- [ ] API key différente de dev
- [ ] CORS configuré correctement
- [ ] Firewall entre services
- [ ] Monitoring configuré
- [ ] Logs centralisés
- [ ] Alertes configurées
- [ ] Plan de rollback prêt

## 📊 Monitoring

### Logs Express

```bash
# Tous les logs
tail -f apps/api/logs/combined.log

# Erreurs uniquement
tail -f apps/api/logs/error.log

# Filtrer auth
tail -f apps/api/logs/combined.log | grep "Session"
```

### Logs Laravel

```bash
# Tous les logs
tail -f apps/ideploy/storage/logs/laravel.log

# Auth uniquement
tail -f apps/ideploy/storage/logs/laravel.log | grep "Express Auth"
```

### Métriques à Surveiller

- Taux d'erreur authentification
- Latence appels Express
- Taux de cache hit/miss
- Nombre de sessions actives
- Erreurs de synchronisation

## 🐛 Troubleshooting

### Erreur: "Invalid API key"

```bash
# Vérifier que les clés correspondent
grep INTERNAL_API_KEY apps/api/.env
grep EXPRESS_API_KEY apps/ideploy/.env
# Doivent être identiques!
```

### Erreur: "Session verification failed"

```bash
# Vérifier les logs Express
tail -f apps/api/logs/combined.log

# Tester directement
curl http://localhost:3001/auth/profile \
  -H "Cookie: session=your-session-cookie"
```

### Erreur: "CORS error"

```bash
# Ajouter origin Laravel dans Express .env
CORS_ALLOWED_ORIGINS="...,http://localhost:8000"

# Redémarrer Express
cd apps/api && npm run dev
```

## 📞 Support

### Documentation

- **Architecture**: [CENTRALIZED_AUTH_ARCHITECTURE.md](./CENTRALIZED_AUTH_ARCHITECTURE.md)
- **Migration**: [MIGRATION_GUIDE_CENTRALIZED_AUTH.md](./MIGRATION_GUIDE_CENTRALIZED_AUTH.md)
- **Référence**: [QUICK_REFERENCE_CENTRALIZED_AUTH.md](./QUICK_REFERENCE_CENTRALIZED_AUTH.md)

### Liens Utiles

- Express API: http://localhost:3001
- Swagger: http://localhost:3001/api-docs
- Laravel: http://localhost:8000
- Firebase Console: https://console.firebase.google.com

### En Cas de Problème

1. Vérifier les logs (Express + Laravel)
2. Vérifier la configuration (API keys, URLs)
3. Tester endpoints individuellement
4. Consulter la documentation
5. Contacter l'équipe technique

## 🎯 Prochaines Étapes

### Immédiat

- [ ] Tester l'intégration complète
- [ ] Migrer les routes Laravel existantes
- [ ] Supprimer l'auth locale Laravel

### Court Terme

- [ ] Ajouter tests unitaires complets
- [ ] Implémenter monitoring
- [ ] Configurer alertes

### Moyen Terme

- [ ] Déployer en staging
- [ ] Tests de charge
- [ ] Déployer en production

## 📄 Licence

Propriétaire - IDEM Africa

## 👥 Équipe

- **Architecture**: Équipe technique IDEM
- **Implémentation**: Express + Laravel
- **Documentation**: Complète et détaillée

---

**Version**: 1.0.0  
**Date**: 8 Janvier 2024  
**Status**: ✅ Implémentation complète - Prêt pour tests

Pour commencer, consultez le [Guide de Migration](./MIGRATION_GUIDE_CENTRALIZED_AUTH.md).
