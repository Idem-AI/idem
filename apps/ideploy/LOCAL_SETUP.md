# Guide d'installation locale de Coolify (sans Docker)

Ce guide vous permet d'exécuter Coolify directement sur macOS sans utiliser Docker.

## 📋 Prérequis

### Installer les dépendances avec Homebrew

```bash
# Installer toutes les dépendances nécessaires
brew install php@8.4 postgresql@15 redis composer node
```

### Vérifier les installations

```bash
php --version      # Doit afficher PHP 8.4.x
composer --version # Doit afficher Composer 2.x
psql --version     # Doit afficher PostgreSQL 15.x
redis-cli --version # Doit afficher Redis 7.x
node --version     # Doit afficher Node 18+ ou 20+
npm --version      # Doit afficher npm 9+ ou 10+
```

## 🚀 Installation rapide

### Méthode 1 : Script automatique (recommandé)

```bash
# Exécuter le script d'installation
./scripts/run-local.sh
```

Ce script va :

- ✅ Vérifier toutes les dépendances
- ✅ Démarrer PostgreSQL et Redis
- ✅ Créer la base de données
- ✅ Installer les dépendances PHP et Node.js
- ✅ Générer la clé d'application
- ✅ Exécuter les migrations
- ✅ Compiler les assets frontend

### Méthode 2 : Installation manuelle

```bash
# 1. Copier le fichier de configuration
cp .env.local .env

# 2. Démarrer les services
brew services start postgresql@15
brew services start redis

# 3. Créer la base de données
createdb -U postgres ideploy

# 4. Installer les dépendances PHP
composer install

# 5. Installer les dépendances Node.js
npm install

# 6. Générer la clé d'application
php artisan key:generate

# 7. Exécuter les migrations
php artisan migrate --seed

# 8. Créer le lien symbolique storage
php artisan storage:link

# 9. Compiler les assets
npm run build
```

## 🎯 Démarrage de l'application

### Option A : Démarrage automatique (tous les services)

```bash
# Démarrer tous les services en arrière-plan
./scripts/start-all.sh

# Avec Vite dev server (hot reload)
./scripts/start-all.sh --dev

# Arrêter tous les services
./scripts/stop-all.sh
```

### Option B : Démarrage manuel (contrôle total)

Ouvrez **4 terminaux** et exécutez dans chacun :

**Terminal 1 - Serveur Web Laravel**

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

**Terminal 2 - Queue Worker**

```bash
php artisan queue:work --tries=3
```

**Terminal 3 - Laravel Horizon (gestion des queues)**

```bash
php artisan horizon
```

**Terminal 4 - Vite Dev Server (optionnel, pour le hot reload)**

```bash
npm run dev
```

## 🌐 Accès à l'application

Une fois démarré, accédez à :

- **Application principale** : http://localhost:8000
- **Laravel Horizon** : http://localhost:8000/horizon
- **Laravel Telescope** : http://localhost:8000/telescope (si activé)

## 📊 Logs et debugging

### Voir les logs en temps réel

```bash
# Logs Laravel
tail -f storage/logs/laravel.log

# Logs des services (si démarrage automatique)
tail -f storage/logs/services/web.log
tail -f storage/logs/services/queue.log
tail -f storage/logs/services/horizon.log
```

### Activer Laravel Telescope

Dans le fichier `.env`, modifiez :

```env
TELESCOPE_ENABLED=true
```

Puis accédez à : http://localhost:8000/telescope

## 🔧 Commandes utiles

### Base de données

```bash
# Réinitialiser la base de données
php artisan migrate:fresh --seed

# Créer un nouvel utilisateur
php artisan tinker
>>> User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => bcrypt('password')])
```

### Cache

```bash
# Vider tous les caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Optimiser pour la production
php artisan optimize
```

### Assets

```bash
# Mode développement (avec hot reload)
npm run dev

# Build pour production
npm run build
```

## 🛑 Arrêter les services

### Si démarrage automatique

```bash
./scripts/stop-all.sh
```

### Si démarrage manuel

Appuyez sur `Ctrl+C` dans chaque terminal.

### Arrêter PostgreSQL et Redis

```bash
brew services stop postgresql@15
brew services stop redis
```

## ⚠️ Limitations en mode local

Coolify est conçu pour gérer des conteneurs Docker sur des serveurs distants. En mode local sans Docker :

- ❌ **Déploiement d'applications** : Non fonctionnel (nécessite Docker)
- ❌ **Gestion de serveurs distants** : Limitée
- ❌ **Bases de données managées** : Non disponibles
- ✅ **Interface utilisateur** : Fonctionnelle
- ✅ **API REST** : Fonctionnelle
- ✅ **Authentification** : Fonctionnelle
- ✅ **Gestion des équipes** : Fonctionnelle

## 🐛 Résolution de problèmes

### Erreur : "Connection refused" pour PostgreSQL

```bash
# Vérifier que PostgreSQL est démarré
brew services list | grep postgresql

# Démarrer PostgreSQL
brew services start postgresql@15
```

### Erreur : "Connection refused" pour Redis

```bash
# Vérifier que Redis est démarré
brew services list | grep redis

# Démarrer Redis
brew services start redis
```

### Erreur : "Class not found"

```bash
# Régénérer l'autoload
composer dump-autoload
```

### Erreur de permissions sur storage/

```bash
# Donner les bonnes permissions
chmod -R 775 storage bootstrap/cache
```

## 📚 Ressources

- [Documentation Laravel](https://laravel.com/docs)
- [Documentation Coolify](https://ideploy.io/docs)
- [Livewire Documentation](https://livewire.laravel.com/docs)

## 🆘 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs : `storage/logs/laravel.log`
2. Consultez la documentation officielle
3. Ouvrez une issue sur GitHub
