# IDEM Authentication Integration

## Vue d'ensemble

Ce document décrit l'intégration de l'authentification centralisée IDEM dans l'application ideploy. L'authentification est désormais gérée par l'API centrale IDEM via des session cookies, éliminant le besoin d'authentification locale par email/mot de passe.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Client Browser │────────▶│  Ideploy (PHP)   │────────▶│  IDEM API       │
│  (Session Cookie)│         │  Laravel App     │         │  (Node.js)      │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │                            │
                                     │                            │
                                     ▼                            ▼
                            ┌──────────────────┐         ┌─────────────────┐
                            │                  │         │                 │
                            │  Local Database  │         │  Firebase Auth  │
                            │  (Users synced)  │         │  (Source of     │
                            │                  │         │   truth)        │
                            └──────────────────┘         └─────────────────┘
```

## Flux d'authentification

### 1. Requête initiale

```
1. L'utilisateur accède à ideploy avec un cookie de session IDEM
2. Le middleware IdemAuthMiddleware intercepte la requête
3. Le cookie 'session' est extrait de la requête
```

### 2. Vérification avec l'API

```
4. IdemAuthService appelle GET /auth/profile de l'API IDEM
5. Le cookie est envoyé dans l'en-tête Cookie: session={value}
6. L'API IDEM vérifie le cookie avec Firebase Admin SDK
7. L'API retourne les données utilisateur (uid, email, displayName, etc.)
```

### 3. Synchronisation locale

```
8. IdemAuthService synchronise l'utilisateur dans la base de données locale
9. Si l'utilisateur existe (par idem_uid), il est mis à jour
10. Sinon, un nouvel utilisateur est créé
11. L'utilisateur est connecté via Auth::login()
```

### 4. Accès à l'application

```
12. L'utilisateur est maintenant authentifié dans Laravel
13. Toutes les fonctionnalités d'ideploy fonctionnent normalement
14. Les vérifications d'authentification utilisent Auth::check()
```

## Fichiers créés/modifiés

### Nouveaux fichiers

#### 1. Migration

**`database/migrations/2025_11_09_150000_add_idem_uid_to_users_table.php`**

- Ajoute la colonne `idem_uid` (string, unique, nullable)
- Rend la colonne `password` nullable
- Ajoute un index sur `idem_uid`

#### 2. Service d'authentification

**`app/Services/IdemAuthService.php`**

Méthodes principales :

- `verifySession(?string $sessionCookie): ?array` - Vérifie le cookie avec l'API
- `syncUser(array $userData): ?User` - Synchronise l'utilisateur localement
- `authenticateUser(?string $sessionCookie): ?User` - Flux complet d'authentification
- `check(?string $sessionCookie): bool` - Vérifie si l'utilisateur est authentifié

#### 3. Middleware

**`app/Http/Middleware/IdemAuthMiddleware.php`**

- Intercepte toutes les requêtes web
- Extrait le cookie de session
- Appelle `IdemAuthService::authenticateUser()`
- Connecte l'utilisateur automatiquement

#### 4. Commande Artisan

**`app/Console/Commands/DeleteAllUsers.php`**

```bash
php artisan idem:delete-all-users [--force]
```

- Supprime tous les utilisateurs de la base de données
- Double confirmation requise (sauf avec --force)
- Logs détaillés de chaque suppression

### Fichiers modifiés

#### 1. Kernel HTTP

**`app/Http/Kernel.php`**

- Ajout de `IdemAuthMiddleware` au groupe 'web'
- Ajout de l'alias `idem.admin` pour le middleware admin

#### 2. Configuration IDEM

**`config/idem.php`**

```php
'api_url' => env('IDEM_API_URL', 'http://localhost:3001'),
'jwt_secret' => env('JWT_SECRET', env('APP_KEY')),
'jwt_expiration' => env('JWT_EXPIRATION', 1440),
```

## Configuration

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```env
# IDEM API Configuration
IDEM_API_URL=http://localhost:3001

# JWT Configuration (optionnel, pour compatibilité future)
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRATION=1440
```

### Environnements

#### Développement

```env
IDEM_API_URL=http://localhost:3001
```

#### Production

```env
IDEM_API_URL=https://api.idem.africa
```

## Utilisation

### 1. Migration de la base de données

```bash
php artisan migrate
```

Cela ajoutera la colonne `idem_uid` à la table `users`.

### 2. Nettoyage des utilisateurs existants (optionnel)

Si vous souhaitez repartir de zéro :

```bash
# Avec confirmation
php artisan idem:delete-all-users

# Sans confirmation (attention !)
php artisan idem:delete-all-users --force
```

### 3. Test de l'authentification

1. Connectez-vous sur l'application principale IDEM (dashboard, landing, etc.)
2. Un cookie `session` sera créé
3. Accédez à ideploy avec le même navigateur
4. Vous serez automatiquement authentifié

## Logs

Tous les événements d'authentification sont loggés avec le préfixe `[IDEM Auth]` :

```
[IDEM Auth] Starting authentication process
[IDEM Auth] Attempting to verify session with API
[IDEM Auth] Session verified successfully
[IDEM Auth] Synchronizing user from API
[IDEM Auth] User authenticated successfully
```

Vérifiez les logs dans `storage/logs/laravel.log`.

## Compatibilité

### Ce qui continue de fonctionner

✅ Toutes les routes protégées par `auth` middleware
✅ `Auth::check()`, `Auth::user()`, `Auth::id()`
✅ Vérification des rôles et permissions
✅ Système de teams
✅ Toutes les fonctionnalités existantes d'ideploy

### Ce qui change

❌ Plus d'authentification par email/mot de passe local
❌ Plus de création de compte locale
❌ Plus de reset de mot de passe local

✅ Authentification centralisée via IDEM API
✅ Utilisateurs synchronisés automatiquement
✅ Single Sign-On (SSO) entre toutes les applications IDEM

## Modèle User

### Nouveaux champs

```php
class User extends Authenticatable
{
    protected $fillable = [
        // ... champs existants
        'idem_uid',  // UID Firebase de l'utilisateur
    ];
}
```

### Relation avec IDEM API

- `idem_uid` : Identifiant unique Firebase (source de vérité)
- `email` : Synchronisé depuis IDEM API
- `name` : Synchronisé depuis IDEM API (displayName)
- `password` : Nullable, non utilisé pour l'authentification IDEM

## Sécurité

### Session Cookies

Les cookies de session sont :

- **HttpOnly** : Non accessibles via JavaScript
- **Secure** : Transmis uniquement en HTTPS (production)
- **SameSite** : Protection CSRF
- **Durée** : 14 jours

### Vérification

Chaque requête :

1. Extrait le cookie de session
2. Vérifie avec l'API IDEM
3. Valide avec Firebase Admin SDK
4. Synchronise l'utilisateur

### Logs

Tous les événements d'authentification sont loggés pour audit et debugging.

## Dépannage

### L'utilisateur n'est pas authentifié

1. Vérifiez que le cookie `session` existe dans le navigateur
2. Vérifiez les logs : `tail -f storage/logs/laravel.log | grep "IDEM Auth"`
3. Vérifiez que `IDEM_API_URL` est correctement configuré
4. Testez l'API directement :
   ```bash
   curl -X GET http://localhost:3001/auth/profile \
     -H "Cookie: session=YOUR_SESSION_COOKIE"
   ```

### Erreur de connexion à l'API

1. Vérifiez que l'API IDEM est démarrée
2. Vérifiez l'URL dans `.env`
3. Vérifiez les logs de l'API IDEM

### Utilisateur créé mais pas synchronisé

1. Vérifiez que `idem_uid` est bien rempli
2. Vérifiez les logs pour les erreurs de synchronisation
3. Vérifiez que la migration a bien été exécutée

## API Endpoints utilisés

### GET /auth/profile

**Requête :**

```http
GET /auth/profile HTTP/1.1
Host: localhost:3001
Cookie: session=<session_cookie>
Accept: application/json
```

**Réponse (succès) :**

```json
{
  "uid": "firebase-uid-123",
  "email": "user@example.com",
  "displayName": "John Doe",
  "photoURL": "https://...",
  "emailVerified": true,
  "quota": {
    "dailyUsage": 0,
    "weeklyUsage": 0,
    "dailyLimit": 10,
    "weeklyLimit": 50
  },
  "roles": ["user"],
  "subscription": "free"
}
```

**Réponse (échec) :**

```json
{
  "success": false,
  "message": "Invalid or expired session"
}
```

## Commandes utiles

```bash
# Migrer la base de données
php artisan migrate

# Supprimer tous les utilisateurs
php artisan idem:delete-all-users

# Vérifier les logs en temps réel
tail -f storage/logs/laravel.log | grep "IDEM Auth"

# Lister les utilisateurs avec idem_uid
php artisan tinker
>>> User::whereNotNull('idem_uid')->get(['id', 'email', 'idem_uid']);
```

## Diagramme de séquence

```
┌────────┐          ┌──────────┐          ┌─────────────┐          ┌──────────┐
│Browser │          │ Ideploy  │          │ IdemAuth    │          │ IDEM API │
│        │          │ Laravel  │          │ Service     │          │          │
└───┬────┘          └────┬─────┘          └──────┬──────┘          └────┬─────┘
    │                    │                       │                      │
    │  GET /dashboard    │                       │                      │
    │  Cookie: session   │                       │                      │
    ├───────────────────▶│                       │                      │
    │                    │                       │                      │
    │                    │ Extract cookie        │                      │
    │                    ├──────────────────────▶│                      │
    │                    │                       │                      │
    │                    │                       │ GET /auth/profile    │
    │                    │                       │ Cookie: session      │
    │                    │                       ├─────────────────────▶│
    │                    │                       │                      │
    │                    │                       │                      │ Verify
    │                    │                       │                      │ Firebase
    │                    │                       │                      │
    │                    │                       │   User data          │
    │                    │                       │◀─────────────────────┤
    │                    │                       │                      │
    │                    │  Sync user to DB      │                      │
    │                    │◀──────────────────────┤                      │
    │                    │                       │                      │
    │                    │  Auth::login($user)   │                      │
    │                    │◀──────────────────────┤                      │
    │                    │                       │                      │
    │   Dashboard page   │                       │                      │
    │◀───────────────────┤                       │                      │
    │                    │                       │                      │
```

## Conclusion

L'intégration de l'authentification IDEM dans ideploy permet :

✅ **Authentification centralisée** : Un seul système d'authentification pour tout l'écosystème
✅ **Single Sign-On** : Connexion automatique entre les applications
✅ **Synchronisation automatique** : Les utilisateurs sont créés/mis à jour automatiquement
✅ **Sécurité renforcée** : Firebase Admin SDK + session cookies HttpOnly
✅ **Compatibilité totale** : Aucun changement dans le code métier d'ideploy
✅ **Logs détaillés** : Traçabilité complète pour le debugging

Le système continue de fonctionner normalement, seule la source d'authentification change.
