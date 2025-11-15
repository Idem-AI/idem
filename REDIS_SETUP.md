# Configuration Redis - Multi-environnement

## 📋 Vue d'ensemble

Deux instances Redis séparées ont été configurées pour les environnements staging et production.

## 🔧 Configuration

### Redis Staging
- **Container**: `redis-staging`
- **Port externe**: `6380` (mappé sur 6379 interne)
- **Network**: `idem-staging`
- **Volume**: `redis-staging-data` (persistance des données)
- **Mot de passe**: Défini via `REDIS_PASSWORD_STAGING`
- **Host pour l'API**: `redis-staging`

### Redis Production
- **Container**: `redis-prod`
- **Port externe**: `6379`
- **Network**: `idem`
- **Volume**: `redis-prod-data` (persistance des données)
- **Mot de passe**: Défini via `REDIS_PASSWORD`
- **Host pour l'API**: `redis-prod`

## 🔐 Variables d'environnement requises

### Pour Production (`.env`)
```bash
REDIS_PASSWORD=your_secure_redis_password_here
```

### Pour Staging (`.env.staging`)
```bash
REDIS_PASSWORD_STAGING=staging_redis_pass_2024
REDIS_HOST=redis-staging
REDIS_PORT=6379
```

## 🚀 Démarrage des instances Redis

### Staging
```bash
docker-compose -f docker-compose.staging.yml up -d redis-staging
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d redis-prod
```

## 🔍 Vérification de l'état

### Vérifier que Redis fonctionne
```bash
# Staging
docker logs redis-staging

# Production
docker logs redis-prod
```

### Tester la connexion Redis
```bash
# Staging (depuis l'hôte)
redis-cli -h localhost -p 6380 -a staging_redis_pass_2024 ping

# Production (depuis l'hôte)
redis-cli -h localhost -p 6379 -a your_password ping
```

### Voir les logs de l'API
```bash
# Staging
docker logs idem-api-staging --tail 50

# Production
docker logs idem-api --tail 50
```

## 📊 Fonctionnalités Redis

- **Persistance des données**: AOF (Append-Only File) activé
- **Health checks**: Vérification automatique toutes les 30 secondes
- **Restart policy**: `unless-stopped` pour un redémarrage automatique
- **Sécurité**: Authentification par mot de passe requise

## 🔄 Connexion de l'API à Redis

Les APIs (staging et production) sont automatiquement connectées à leur instance Redis respective via les variables d'environnement :

- `REDIS_HOST`: Nom du container Redis
- `REDIS_PORT`: Port interne (6379)
- `REDIS_PASSWORD`: Mot de passe d'authentification

## 📝 Notes importantes

1. **Séparation des données**: Les deux environnements utilisent des volumes séparés, garantissant l'isolation complète des données.

2. **Ports différents**: Redis staging utilise le port 6380 sur l'hôte pour éviter les conflits avec Redis production (port 6379).

3. **Sécurité**: Assurez-vous d'utiliser des mots de passe forts en production.

4. **Backup**: Les données sont persistées dans des volumes Docker. Pensez à mettre en place une stratégie de backup.

## ✅ Statut actuel

- ✅ Redis Staging: **En cours d'exécution**
- ✅ Connexion API Staging → Redis Staging: **Fonctionnelle**
- ⏳ Redis Production: **À démarrer lors du prochain déploiement**
- ⏳ Connexion API Production → Redis Production: **À tester**
