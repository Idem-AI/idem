# 🧪 Guide de Test - Package shared-auth-php

## ✅ Prérequis

- [x] Package installé (`composer show idem/shared-auth-php`)
- [x] Configuration publiée (`config/idem-auth.php`)
- [x] Routes de test créées (`routes/test-auth.php`)
- [x] API centrale accessible

---

## 🚀 Étape 1: Démarrer les Services

### 1.1 Démarrer l'API Centrale

```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/api
npm run dev
```

Vérifier que l'API démarre sur `http://localhost:3001`

### 1.2 Démarrer Ideploy

```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/ideploy
php artisan serve
```

Vérifier que Ideploy démarre sur `http://localhost:8000`

---

## 🧪 Étape 2: Tests Sans Authentification

### Test 1: Health Check Ideploy

```bash
curl http://localhost:8000/test/health
```

**Résultat attendu :**

```json
{
  "success": true,
  "message": "Ideploy is running",
  "timestamp": "2025-01-05T..."
}
```

### Test 2: Health Check API Centrale

```bash
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

✅ Si `api_accessible: true`, l'API centrale est accessible !

---

## 🔐 Étape 3: Obtenir un Token d'Authentification

### Option A: Avec un Vrai Compte Firebase

Si vous avez un compte Firebase configuré :

1. Aller sur le frontend (landing ou dashboard)
2. Se connecter avec Firebase
3. Ouvrir les DevTools > Application > Cookies
4. Copier le cookie `session`

### Option B: Avec l'API Centrale (Test)

```bash
# Créer un session cookie de test
curl -X POST http://localhost:3001/auth/sessionLogin \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test-firebase-token",
    "user": {
      "uid": "test-user-123",
      "email": "test@idem.africa",
      "displayName": "Test User"
    }
  }' \
  -c cookies.txt \
  -v
```

**Note :** Cela nécessite que l'API centrale accepte les tokens de test en développement.

---

## 🔒 Étape 4: Tests Avec Authentification

### Test 3: Profil Utilisateur

```bash
# Avec le cookie
curl http://localhost:8000/test/auth/me \
  -b cookies.txt \
  -H "Accept: application/json"
```

**Résultat attendu :**

```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": 1,
    "email": "test@idem.africa",
    "name": "Test User",
    "firebase_uid": "test-user-123"
  }
}
```

✅ Si vous voyez ceci, l'authentification fonctionne !

### Test 4: Récupérer les Teams

```bash
curl http://localhost:8000/test/auth/teams \
  -b cookies.txt \
  -H "Accept: application/json"
```

**Résultat attendu :**

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "test@idem.africa"
  },
  "teams": [
    {
      "id": "team-1",
      "name": "My Team",
      "description": "Team description",
      "members_count": 3
    }
  ]
}
```

### Test 5: Récupérer une Team Spécifique

```bash
# Remplacer TEAM_ID par un ID de team réel
curl http://localhost:8000/test/auth/teams/TEAM_ID \
  -b cookies.txt \
  -H "Accept: application/json"
```

---

## 📊 Étape 5: Vérifier les Logs

### Logs Ideploy

```bash
tail -f storage/logs/laravel.log
```

**Logs attendus :**

```
[INFO] User authenticated via API
[INFO] User synchronized from API
```

### Logs API Centrale

```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/api
# Vérifier les logs dans la console
```

---

## 🔍 Étape 6: Tests Avancés

### Test 6: Vérifier la Synchronisation Utilisateur

```bash
php artisan tinker
```

```php
// Vérifier qu'un utilisateur a été créé
$user = User::where('email', 'test@idem.africa')->first();
dd($user);

// Vérifier le firebase_uid
echo $user->firebase_uid;
// Devrait afficher: test-user-123
```

### Test 7: Tester l'AuthClient Directement

```php
use Idem\SharedAuth\AuthClient;

$client = app(AuthClient::class);

// Configurer un token de test
$client->setAuthToken('session_cookie_value');

// Tester la récupération du profil
$profile = $client->getUserProfile();
dd($profile);

// Tester la récupération des teams
$teams = $client->getMyTeams();
dd($teams);
```

### Test 8: Tester le Cache

```php
use Illuminate\Support\Facades\Cache;

// Vérifier le cache d'un utilisateur
$cached = Cache::get('user_profile_test-user-123');
dd($cached);

// Le cache devrait contenir le UserModel
```

---

## ✅ Checklist de Validation

### Configuration

- [ ] Package installé (`composer show idem/shared-auth-php`)
- [ ] Configuration publiée (`config/idem-auth.php` existe)
- [ ] Variable `IDEM_API_URL` configurée dans `.env`
- [ ] API centrale accessible (`test/api-health` retourne `true`)

### Authentification

- [ ] Test sans auth fonctionne (`test/health`)
- [ ] Test avec auth fonctionne (`test/auth/me`)
- [ ] Utilisateur créé dans la base de données
- [ ] `firebase_uid` correctement renseigné

### Fonctionnalités

- [ ] Récupération des teams fonctionne
- [ ] Récupération d'une team spécifique fonctionne
- [ ] Cache fonctionne (vérifier avec `Cache::get()`)
- [ ] Logs propres (pas d'erreurs)

### Performance

- [ ] Temps de réponse < 200ms
- [ ] Cache utilisé (pas de requête API à chaque fois)
- [ ] Pas de requêtes redondantes

---

## 🚨 Dépannage

### Erreur: "api_accessible: false"

**Cause :** L'API centrale n'est pas accessible

**Solution :**

```bash
# Vérifier que l'API est démarrée
curl http://localhost:3001/health

# Vérifier la configuration
php artisan config:show idem-auth.api_url
```

### Erreur: "Unauthorized"

**Cause :** Token invalide ou expiré

**Solution :**

1. Vérifier que le cookie `session` est présent
2. Obtenir un nouveau token
3. Vérifier les logs : `tail -f storage/logs/laravel.log`

### Erreur: "Class 'Idem\SharedAuth\AuthClient' not found"

**Cause :** Autoload pas à jour

**Solution :**

```bash
composer dump-autoload
php artisan config:clear
php artisan cache:clear
```

### Erreur: "User not synchronized"

**Cause :** Problème de communication avec l'API

**Solution :**

1. Vérifier les logs API centrale
2. Vérifier que l'endpoint `/auth/profile` existe
3. Tester manuellement :

```bash
curl http://localhost:3001/auth/profile \
  -H "Authorization: Bearer session_cookie"
```

---

## 📈 Prochaines Étapes

Une fois tous les tests validés :

1. **Migrer les Routes Existantes**
   - Remplacer `auth:sanctum` par `idem.auth`
   - Tester chaque route

2. **Mettre à Jour les Controllers**
   - Injecter `AuthClient` où nécessaire
   - Utiliser les méthodes du package

3. **Supprimer l'Ancien Code**
   - Supprimer `SharedJwtAuth`
   - Supprimer les routes d'auth locale
   - Nettoyer les dépendances

4. **Documentation**
   - Documenter les changements
   - Mettre à jour le README
   - Former l'équipe

---

## 📚 Ressources

- [Quick Start](/apps/ideploy/QUICK_START.md)
- [Guide d'Intégration](/apps/ideploy/INTEGRATION_SHARED_AUTH.md)
- [Package README](/packages/shared-auth-php/README.md)
- [Architecture](/packages/shared-auth-php/ARCHITECTURE.md)

---

## 🆘 Support

Pour toute question :

- Vérifier les logs : `storage/logs/laravel.log`
- Vérifier l'API : `curl http://localhost:3001/health`
- Consulter la documentation
- Contacter dev@idem.africa
