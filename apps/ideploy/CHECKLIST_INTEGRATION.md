# Checklist d'Intégration - Authentification Express

## ✅ Fichiers Créés (Tous présents)

- [x] `app/Services/ExpressApiClient.php` - Client HTTP Express
- [x] `app/Http/Middleware/VerifyExpressSession.php` - Middleware auth
- [x] `app/Providers/ExpressApiServiceProvider.php` - Service Provider
- [x] `database/migrations/2024_01_08_000001_add_firebase_uid_to_users_table.php` - Migration
- [x] `EXPRESS_AUTH_INTEGRATION.md` - Documentation

## ✅ Fichiers Modifiés (Tous à jour)

- [x] `app/Http/Kernel.php` - Middleware `express.auth` enregistré
- [x] `app/Models/User.php` - `firebase_uid` ajouté au fillable
- [x] `config/idem.php` - `api_url` et `api_key` configurés
- [x] `config/app.php` - `ExpressApiServiceProvider` enregistré

## 🔧 Configuration Requise

### 1. Variables d'Environnement

Ajouter dans `.env`:

```env
# Express API Configuration
IDEM_API_URL=http://localhost:3001
EXPRESS_API_KEY=your-secure-api-key-here

# Note: Cette clé doit être identique à INTERNAL_API_KEY dans apps/api/.env
```

**Générer une clé sécurisée:**

```bash
openssl rand -hex 32
```

### 2. Exécuter la Migration

```bash
php artisan migrate
```

Cette commande ajoute la colonne `firebase_uid` à la table `users`.

### 3. Vérifier la Configuration

```bash
php artisan tinker

# Vérifier l'URL
config('idem.api_url')
# Devrait retourner: "http://localhost:3001"

# Vérifier la clé API
config('idem.api_key')
# Devrait retourner votre clé API

# Quitter tinker
exit
```

## 🧪 Tests de Validation

### Test 1: Service ExpressApiClient

```bash
php artisan tinker
```

```php
$client = app(\App\Services\ExpressApiClient::class);
// Devrait retourner une instance de ExpressApiClient
```

### Test 2: Middleware Enregistré

```bash
php artisan route:list | grep express.auth
```

Devrait afficher les routes utilisant le middleware `express.auth`.

### Test 3: Migration Exécutée

```bash
php artisan tinker
```

```php
use Illuminate\Support\Facades\Schema;
Schema::hasColumn('users', 'firebase_uid')
// Devrait retourner: true
```

### Test 4: Route de Test

Créer une route de test dans `routes/web.php`:

```php
Route::middleware(['express.auth'])->group(function () {
    Route::get('/test-express-auth', function () {
        return response()->json([
            'success' => true,
            'user' => auth()->user(),
            'message' => 'Authenticated via Express!',
            'firebase_uid' => auth()->user()->firebase_uid ?? null,
        ]);
    });
});
```

Tester:

```bash
curl http://localhost:8000/test-express-auth \
  -H "Cookie: session=your-valid-session-cookie"
```

## 📋 Checklist Complète

### Prérequis

- [ ] Express API démarrée (`cd apps/api && npm run dev`)
- [ ] Express API accessible sur http://localhost:3001
- [ ] Session cookie Firebase valide disponible

### Configuration Laravel

- [ ] Variables `.env` configurées (`IDEM_API_URL`, `EXPRESS_API_KEY`)
- [ ] Clé API identique entre Laravel et Express
- [ ] Migration exécutée (`php artisan migrate`)
- [ ] Cache config vidé (`php artisan config:clear`)

### Validation

- [ ] Service ExpressApiClient instanciable
- [ ] Middleware `express.auth` enregistré
- [ ] Colonne `firebase_uid` existe dans table `users`
- [ ] Route de test fonctionne avec session cookie

### Tests Fonctionnels

- [ ] Login via frontend → Cookie session créé
- [ ] Requête Laravel → Middleware vérifie avec Express
- [ ] User synchronisé dans PostgreSQL
- [ ] `Auth::user()` retourne le bon utilisateur
- [ ] Teams récupérables via ExpressApiClient

### Documentation

- [ ] Équipe informée de la nouvelle architecture
- [ ] Documentation lue (`EXPRESS_AUTH_INTEGRATION.md`)
- [ ] Guide de migration consulté (`/MIGRATION_GUIDE_CENTRALIZED_AUTH.md`)

## 🚀 Démarrage Rapide

```bash
# 1. Configurer .env
echo "IDEM_API_URL=http://localhost:3001" >> .env
echo "EXPRESS_API_KEY=$(openssl rand -hex 32)" >> .env

# 2. Exécuter migration
php artisan migrate

# 3. Vider cache
php artisan config:clear

# 4. Démarrer serveur
php artisan serve

# 5. Tester
curl http://localhost:8000/test-express-auth \
  -H "Cookie: session=your-session-cookie"
```

## 🐛 Dépannage

### Problème: "Class ExpressApiClient not found"

**Solution:**

```bash
composer dump-autoload
php artisan config:clear
```

### Problème: "Middleware express.auth not found"

**Solution:**

```bash
php artisan config:clear
php artisan route:clear
```

### Problème: "Column firebase_uid not found"

**Solution:**

```bash
php artisan migrate
```

### Problème: "Invalid API key"

**Solution:**

```bash
# Vérifier que les clés correspondent
grep EXPRESS_API_KEY .env
grep INTERNAL_API_KEY ../api/.env
# Doivent être identiques!
```

## 📞 Support

En cas de problème:

1. **Vérifier les logs**:

   ```bash
   tail -f storage/logs/laravel.log | grep "Express"
   ```

2. **Vérifier Express API**:

   ```bash
   curl http://localhost:3001/
   ```

3. **Consulter la documentation**:
   - `EXPRESS_AUTH_INTEGRATION.md` (ce dossier)
   - `/MIGRATION_GUIDE_CENTRALIZED_AUTH.md` (racine)
   - `/QUICK_REFERENCE_CENTRALIZED_AUTH.md` (racine)

## ✨ Résumé

**Tout est en place côté Laravel!** 🎉

Les fichiers suivants ont été créés/modifiés:

- ✅ 4 nouveaux fichiers
- ✅ 4 fichiers modifiés
- ✅ 1 migration
- ✅ 1 service provider
- ✅ 1 middleware
- ✅ 1 service HTTP client

**Prochaines étapes:**

1. Configurer les variables d'environnement
2. Exécuter la migration
3. Tester l'intégration
4. Migrer progressivement les routes

**Status**: ✅ **PRÊT POUR CONFIGURATION ET TESTS**
