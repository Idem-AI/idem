# Guide de Migration Redis - Multi-environnement

## 🎯 Objectif

Configuration de deux instances Redis séparées pour les environnements staging et production afin d'assurer l'isolation complète des données.

## ✅ Changements effectués

### 1. Docker Compose - Staging (`docker-compose.staging.yml`)
- ✅ Ajout du service `redis-staging`
- ✅ Configuration du port externe 6380
- ✅ Volume de persistance `redis-staging-data`
- ✅ Connexion de `idem-api-staging` à Redis
- ✅ Variables d'environnement Redis ajoutées

### 2. Docker Compose - Production (`docker-compose.prod.yml`)
- ✅ Ajout du service `redis-prod`
- ✅ Configuration du port externe 6379
- ✅ Volume de persistance `redis-prod-data`
- ✅ Connexion de `idem-api` à Redis
- ✅ Variables d'environnement Redis ajoutées

### 3. Configuration environnement
- ✅ Fichier `.env.staging` mis à jour avec les variables Redis
- ✅ Fichier `.env.redis.example` créé pour référence
- ✅ Documentation `REDIS_SETUP.md` créée

## 🔧 Actions requises pour la production

### 1. Ajouter les variables d'environnement

Dans votre fichier `.env` de production, ajoutez :

```bash
# Redis Configuration - Production
REDIS_PASSWORD=votre_mot_de_passe_securise_ici
```

**Important** : Utilisez un mot de passe fort et différent de celui de staging.

### 2. Démarrer Redis en production

Avant de déployer l'API en production :

```bash
docker-compose -f docker-compose.prod.yml up -d redis-prod
```

### 3. Vérifier la connexion

```bash
# Vérifier que Redis fonctionne
docker logs redis-prod

# Tester la connexion (depuis l'hôte)
redis-cli -h localhost -p 6379 -a votre_mot_de_passe ping
# Doit retourner: PONG
```

### 4. Déployer/Redémarrer l'API

```bash
docker-compose -f docker-compose.prod.yml up -d idem-api
```

### 5. Vérifier les logs de l'API

```bash
docker logs idem-api --tail 50
```

Vous devriez voir :
```
Redis connected successfully
Redis ready to receive commands
Redis connection test successful
Redis connection established successfully
```

## 📊 Comparaison Avant/Après

### Avant
- ❌ Pas de cache Redis
- ❌ Pas de gestion de sessions
- ❌ Pas de file d'attente

### Après
- ✅ Cache Redis actif
- ✅ Sessions utilisateur persistantes
- ✅ File d'attente pour les tâches asynchrones
- ✅ Isolation complète staging/production
- ✅ Persistance des données
- ✅ Health checks automatiques

## 🔐 Sécurité

### Mots de passe
- **Staging** : Mot de passe actuel dans `.env.staging`
- **Production** : À définir dans `.env` (non commité)

### Ports
- **Staging** : 6380 (externe) → 6379 (interne)
- **Production** : 6379 (externe et interne)

### Réseaux
- **Staging** : `idem-staging` (isolé)
- **Production** : `idem` (isolé)

## 🔄 Rollback

Si vous devez revenir en arrière :

```bash
# Arrêter Redis
docker-compose -f docker-compose.staging.yml stop redis-staging
docker-compose -f docker-compose.prod.yml stop redis-prod

# Supprimer les conteneurs
docker rm redis-staging redis-prod

# L'API continuera de fonctionner sans Redis (avec logs d'erreur)
```

## 📝 Notes importantes

1. **Données persistantes** : Les données Redis sont stockées dans des volumes Docker. Elles survivent aux redémarrages des conteneurs.

2. **Backup** : Mettez en place une stratégie de backup pour les données Redis critiques.

3. **Monitoring** : Surveillez l'utilisation mémoire de Redis en production.

4. **Performance** : Redis améliore significativement les performances de l'API en cachant les réponses fréquentes.

## 🚨 Dépannage

### Redis ne démarre pas
```bash
# Vérifier les logs
docker logs redis-staging  # ou redis-prod

# Vérifier la configuration
docker inspect redis-staging
```

### L'API ne se connecte pas à Redis
```bash
# Vérifier les variables d'environnement
docker exec idem-api-staging env | grep REDIS

# Vérifier la connectivité réseau
docker exec idem-api-staging ping redis-staging
```

### Erreur de mot de passe
Vérifiez que la variable `REDIS_PASSWORD_STAGING` (ou `REDIS_PASSWORD`) est correctement définie dans le fichier `.env` correspondant.

## ✨ Statut actuel

### Staging
- ✅ Redis déployé et fonctionnel
- ✅ API connectée avec succès
- ✅ Tests de connexion passés

### Production
- ⏳ Redis configuré, en attente de déploiement
- ⏳ Variables d'environnement à définir
- ⏳ Tests de connexion à effectuer

## 📞 Support

En cas de problème, vérifiez :
1. Les logs des conteneurs
2. Les variables d'environnement
3. La connectivité réseau
4. La documentation dans `REDIS_SETUP.md`
