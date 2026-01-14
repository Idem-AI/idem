# Quick Start - IDEM Authentication Integration

## 🚀 Installation rapide (5 minutes)

### 1. Configuration de l'environnement

Ajoutez cette ligne dans votre fichier `.env` :

```env
IDEM_API_URL=http://localhost:3001
```

**Production :**

```env
IDEM_API_URL=https://api.idem.africa
```

### 2. Migration de la base de données

```bash
php artisan migrate
```

Cela ajoute la colonne `idem_uid` à la table `users`.

### 3. Nettoyage (optionnel)

Si vous voulez supprimer les utilisateurs existants :

```bash
php artisan idem:delete-all-users
```

### 4. Test

1. Connectez-vous sur l'application IDEM principale (dashboard, landing, etc.)
2. Accédez à ideploy avec le même navigateur
3. Vous êtes automatiquement authentifié ! ✅

## 📋 Ce qui a changé

### ✅ Ce qui fonctionne toujours

- Toutes les routes protégées par `auth` middleware
- `Auth::check()`, `Auth::user()`, `Auth::id()`
- Système de teams et permissions
- Toutes les fonctionnalités existantes

### ❌ Ce qui ne fonctionne plus

- Authentification par email/mot de passe local
- Création de compte locale
- Reset de mot de passe local

### ✨ Nouveautés

- **Single Sign-On** : Connexion automatique entre toutes les apps IDEM
- **Synchronisation automatique** : Les utilisateurs sont créés/mis à jour automatiquement
- **Sécurité renforcée** : Firebase Admin SDK + session cookies HttpOnly

## 🔍 Vérification

### Vérifier les logs

```bash
tail -f storage/logs/laravel.log | grep "IDEM Auth"
```

Vous devriez voir :

```
[IDEM Auth] Starting authentication process
[IDEM Auth] Session verified successfully
[IDEM Auth] User authenticated successfully
```

### Vérifier un utilisateur

```bash
php artisan tinker
```

```php
>>> User::whereNotNull('idem_uid')->first();
```

## 🛠️ Commandes utiles

```bash
# Supprimer tous les utilisateurs
php artisan idem:delete-all-users

# Supprimer sans confirmation (attention !)
php artisan idem:delete-all-users --force

# Voir les logs en temps réel
tail -f storage/logs/laravel.log | grep "IDEM Auth"
```

## 🐛 Dépannage

### Problème : L'utilisateur n'est pas authentifié

1. Vérifiez que l'API IDEM est démarrée
2. Vérifiez le cookie `session` dans le navigateur (DevTools > Application > Cookies)
3. Vérifiez `IDEM_API_URL` dans `.env`
4. Vérifiez les logs

### Problème : Erreur de connexion à l'API

```bash
# Testez l'API directement
curl http://localhost:3001/auth/profile
```

Si l'API ne répond pas, démarrez-la :

```bash
cd apps/api
npm run dev
```

## 📚 Documentation complète

Pour plus de détails, consultez `IDEM_AUTH_INTEGRATION.md`.

## 🎯 Architecture simplifiée

```
Browser (Cookie: session)
    ↓
Ideploy Laravel App
    ↓
IdemAuthMiddleware (extrait le cookie)
    ↓
IdemAuthService (appelle l'API)
    ↓
IDEM API (vérifie avec Firebase)
    ↓
User synchronisé dans DB locale
    ↓
Auth::login($user)
    ↓
✅ Utilisateur authentifié
```

## ✅ C'est tout !

L'authentification est maintenant centralisée. Tous les utilisateurs qui se connectent via l'écosystème IDEM seront automatiquement authentifiés dans ideploy.
