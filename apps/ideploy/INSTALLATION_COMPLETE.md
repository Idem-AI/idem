# ✅ Installation Complète - Package shared-auth-php

## 🎉 Statut : Installation Réussie !

Le package `idem/shared-auth-php` est maintenant installé et configuré dans Ideploy.

---

## ✅ Ce qui a été fait

### 1. Package Installé

```bash
composer show idem/shared-auth-php
# ✅ idem/shared-auth-php dev-main
```

### 2. Configuration Créée

- ✅ `config/idem-auth.php` - Configuration du package
- ✅ Routes de test créées : `routes/test-auth.php`
- ✅ Documentation complète

### 3. Fichiers de Documentation

- ✅ `QUICK_START.md` - Guide de démarrage rapide
- ✅ `TEST_GUIDE.md` - Guide de test complet
- ✅ `INTEGRATION_SHARED_AUTH.md` - Guide d'intégration détaillé
- ✅ `MIGRATION_AUTH_STRATEGY.md` - Stratégie de migration

---

## 🚀 Prochaines Étapes

### 1. Configurer les Variables d'Environnement

Ajouter dans `.env` :

```env
# API Centrale (OBLIGATOIRE)
IDEM_API_URL=http://localhost:3001

# En production
# IDEM_API_URL=https://api.idem.africa
```

### 2. Démarrer les Services

**Terminal 1 - API Centrale :**

```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/api
npm run dev
```

**Terminal 2 - Ideploy :**

```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/ideploy
php artisan serve
```

### 3. Tester l'Installation

```bash
# Test 1: Health check
curl http://localhost:8000/test/health

# Test 2: API centrale accessible
curl http://localhost:8000/test/api-health
```

**Résultat attendu :**

```json
{
  "success": true,
  "api_accessible": true,
  "api_url": "http://localhost:3001"
}
```

✅ Si `api_accessible: true`, tout fonctionne !

---

## 📚 Documentation Disponible

### Guides de Démarrage

1. **[QUICK_START.md](./QUICK_START.md)** - Démarrage rapide (5 min)
2. **[TEST_GUIDE.md](./TEST_GUIDE.md)** - Tests complets (15 min)

### Guides d'Intégration

3. **[INTEGRATION_SHARED_AUTH.md](./INTEGRATION_SHARED_AUTH.md)** - Intégration détaillée
4. **[MIGRATION_AUTH_STRATEGY.md](./MIGRATION_AUTH_STRATEGY.md)** - Stratégie de migration

### Documentation du Package

5. **[Package README](/packages/shared-auth-php/README.md)** - Documentation complète
6. **[Architecture](/packages/shared-auth-php/ARCHITECTURE.md)** - Architecture du package

---

## 🔧 Routes de Test Disponibles

### Sans Authentification

- `GET /test/health` - Health check Ideploy
- `GET /test/api-health` - Vérifier l'API centrale

### Avec Authentification (middleware `idem.auth`)

- `GET /test/auth/me` - Profil utilisateur
- `GET /test/auth/teams` - Liste des teams
- `GET /test/auth/teams/{teamId}` - Team spécifique

---

## 🎯 Utilisation dans les Controllers

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Idem\SharedAuth\AuthClient;

class TeamController extends Controller
{
    public function __construct(
        private AuthClient $authClient
    ) {
        $this->middleware('idem.auth');
    }

    public function teams()
    {
        // L'utilisateur est déjà authentifié
        $user = auth()->user();

        // Récupérer les teams depuis l'API centrale
        $teams = $this->authClient->getMyTeams();

        return response()->json([
            'success' => true,
            'teams' => $teams,
        ]);
    }
}
```

---

## 🔐 Middleware Disponible

Le middleware `idem.auth` est automatiquement enregistré.

**Utilisation dans les routes :**

```php
Route::middleware(['idem.auth'])->group(function () {
    Route::get('/teams', [TeamController::class, 'index']);
    Route::get('/projects', [ProjectController::class, 'index']);
});
```

---

## 🏗️ Architecture

```
Request avec session cookie
         ↓
ApiAuthMiddleware (idem.auth)
         ↓
Extrait le token (cookie ou Bearer)
         ↓
AuthClient::getUserProfile()
         ↓
GET /auth/profile (API Centrale)
         ↓
API Centrale vérifie Firebase
         ↓
Retourne UserModel
         ↓
Middleware synchronise l'utilisateur
         ↓
Auth::login($user)
         ↓
Controller accède à auth()->user()
```

**Points clés :**

- ✅ Pas de Firebase dans Ideploy
- ✅ Tout passe par l'API centrale
- ✅ Même architecture que le package TypeScript

---

## 🚨 Note Importante

Il y a actuellement un problème avec la configuration Sentry dans Ideploy (`logs_channel_level` non défini). Ce problème est **indépendant** du package shared-auth-php.

Pour contourner temporairement :

1. Désactiver Sentry dans `.env` : `SENTRY_LARAVEL_DSN=`
2. Ou corriger la configuration Sentry dans `config/sentry.php`

---

## ✅ Checklist de Validation

### Installation

- [x] Package installé (`composer show idem/shared-auth-php`)
- [x] Configuration créée (`config/idem-auth.php`)
- [x] Routes de test créées (`routes/test-auth.php`)
- [x] Documentation complète

### Configuration

- [ ] Variable `IDEM_API_URL` ajoutée dans `.env`
- [ ] API centrale démarrée
- [ ] Ideploy démarré

### Tests

- [ ] Test health check réussi
- [ ] Test API centrale accessible
- [ ] Test authentification (avec token)
- [ ] Test récupération teams

---

## 🆘 Support

### Problèmes Courants

**1. "api_accessible: false"**

- Vérifier que l'API centrale est démarrée
- Vérifier `IDEM_API_URL` dans `.env`

**2. "Class not found"**

```bash
composer dump-autoload
php artisan config:clear
```

**3. Erreur Sentry**

- Désactiver Sentry temporairement
- Ou corriger `config/sentry.php`

### Ressources

- Documentation : Voir les fichiers `.md` ci-dessus
- Logs : `tail -f storage/logs/laravel.log`
- API : `curl http://localhost:3001/health`

### Contact

- Email : dev@idem.africa
- Documentation : `/documentation/`

---

## 🎉 Félicitations !

Le package shared-auth-php est maintenant prêt à être utilisé dans Ideploy !

**Prochaine étape :** Suivre le [QUICK_START.md](./QUICK_START.md) pour commencer à l'utiliser.
