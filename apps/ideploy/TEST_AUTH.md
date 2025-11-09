# Test de l'authentification IDEM

## 🔍 Étapes de diagnostic

### 1. Vérifier les logs Laravel

```bash
# Dans le terminal, depuis apps/ideploy
tail -f storage/logs/laravel.log | grep "IDEM Auth"
```

### 2. Vérifier que le cookie existe

Ouvrez les DevTools du navigateur :

1. Onglet **Application** (ou **Storage**)
2. Section **Cookies**
3. Cherchez le cookie `session`
4. Vérifiez qu'il a une valeur

### 3. Tester manuellement l'API

```bash
# Remplacez YOUR_SESSION_COOKIE par la valeur du cookie
curl -X GET http://localhost:3001/auth/profile \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -v
```

### 4. Vérifier que l'API IDEM est démarrée

```bash
# Depuis apps/api
npm run dev
```

### 5. Vérifier la configuration

```bash
# Dans apps/ideploy
php artisan tinker
```

Puis dans tinker :

```php
>>> config('idem.api_url')
// Devrait afficher: "http://localhost:3001"

>>> \App\Models\User::count()
// Nombre d'utilisateurs actuels

>>> \App\Models\User::whereNotNull('idem_uid')->count()
// Nombre d'utilisateurs IDEM
```

## 🐛 Problèmes courants

### Problème 1 : Pas de logs "[IDEM Auth]"

**Cause :** Le middleware ne s'exécute pas

**Solution :**

```bash
# Vider le cache
php artisan config:clear
php artisan cache:clear
php artisan route:clear
```

### Problème 2 : "No session cookie found"

**Cause :** Le cookie n'est pas envoyé depuis le navigateur

**Solutions :**

1. Vérifiez que vous êtes connecté sur l'application IDEM principale
2. Vérifiez que les domaines sont compatibles (localhost pour les deux)
3. Vérifiez les paramètres du cookie (SameSite, Secure)

### Problème 3 : "Error verifying session with API"

**Cause :** L'API IDEM n'est pas accessible

**Solutions :**

1. Vérifiez que l'API est démarrée : `cd apps/api && npm run dev`
2. Vérifiez `IDEM_API_URL` dans `.env`
3. Testez l'API manuellement (voir étape 3)

### Problème 4 : Redirection vers login

**Cause :** L'utilisateur n'est pas authentifié dans Laravel

**Solutions :**

1. Vérifiez les logs pour voir où ça bloque
2. Vérifiez que la migration a été exécutée : `php artisan migrate:status`
3. Vérifiez que le service peut créer des utilisateurs

## 📝 Logs attendus

Quand tout fonctionne, vous devriez voir :

```
[IDEM Auth Middleware] Processing request
[IDEM Auth Middleware] Session cookie found, verifying with API
[IDEM Auth] Starting authentication process
[IDEM Auth] Attempting to verify session with API
[IDEM Auth] Session verified successfully
[IDEM Auth] Synchronizing user from API
[IDEM Auth] User authenticated successfully
[IDEM Auth Middleware] User authenticated successfully
```

## 🔧 Commandes de debug

```bash
# Voir tous les logs en temps réel
tail -f storage/logs/laravel.log

# Voir uniquement les logs IDEM
tail -f storage/logs/laravel.log | grep "IDEM"

# Vérifier les routes
php artisan route:list | grep dashboard

# Vérifier les middlewares
php artisan route:list --columns=uri,name,middleware

# Tester la connexion à l'API
curl http://localhost:3001/health

# Vérifier les utilisateurs
php artisan tinker
>>> \App\Models\User::all(['id', 'email', 'idem_uid']);
```

## ✅ Test complet

1. **Démarrer l'API IDEM**

   ```bash
   cd apps/api
   npm run dev
   ```

2. **Démarrer ideploy**

   ```bash
   cd apps/ideploy
   php artisan serve
   ```

3. **Ouvrir les logs**

   ```bash
   # Nouveau terminal
   cd apps/ideploy
   tail -f storage/logs/laravel.log | grep "IDEM"
   ```

4. **Se connecter sur l'app principale IDEM**
   - Ouvrez http://localhost:4200 (dashboard) ou http://localhost:4201 (landing)
   - Connectez-vous avec Google/GitHub

5. **Accéder à ideploy**
   - Ouvrez http://localhost:8000
   - Vous devriez être automatiquement authentifié

6. **Vérifier les logs**
   - Vous devriez voir les logs "[IDEM Auth]" dans le terminal
