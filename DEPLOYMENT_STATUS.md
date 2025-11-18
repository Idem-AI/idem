# 🚀 Deployment Status - Production CI/CD Test

## ✅ Étapes Complétées

### 1️⃣ Merge dev → main
- ✅ Branche dev mergée vers main
- ✅ `docker-compose.staging.yml` retiré de main
- ✅ `docker-compose.prod.yml` conservé sur main
- ✅ Push vers `origin/main` effectué

### 2️⃣ Configuration des Branches

**Branch `main` (Production)**
- Contient: `docker-compose.prod.yml`
- Utilisé pour: Déploiements production
- CI/CD: Déclenché sur push vers main

**Branch `dev` (Staging)**
- Contient: `docker-compose.staging.yml`
- Utilisé pour: Déploiements staging
- CI/CD: Déclenché sur push vers dev

### 3️⃣ Déploiement Production Lancé

**Commit**: `18001c56`
**Branch**: `main`
**Date**: Nov 17, 2025

## 🚀 Workflows de Production en Cours

Les 5 services sont en cours de déploiement avec les nouvelles images:

| Service | Image Tag | Container |
|---------|-----------|-----------|
| **API** | `ghcr.io/idem-ai/idem-api:18001c56` | `idem-api` |
| **Dashboard** | `ghcr.io/idem-ai/idem-main-dashboard:18001c56` | `idem` |
| **Landing** | `ghcr.io/idem-ai/idem-landing:18001c56` | `idem-landing` |
| **AppGen** | `ghcr.io/idem-ai/idem-appgen:18001c56` | `idem-webgen` |
| **Chart** | `ghcr.io/idem-ai/idem-chart:18001c56` | `idem-chart` |

## 📊 Différences entre Staging et Production

### Tags d'Images

**Production (main)**:
```
ghcr.io/idem-ai/idem-xxx:COMMIT_ID
```

**Staging (dev)**:
```
ghcr.io/idem-ai/idem-xxx:COMMIT_ID-staging
```

### Environnements

**Production**:
- Network: `idem`
- Containers: `idem-api`, `idem`, `idem-landing`, etc.
- Redis: `redis-prod` (port 6379)

**Staging**:
- Network: `idem-staging`
- Containers: `idem-api-staging`, `idem-staging`, etc.
- Redis: `redis-staging` (port 6380)

## 🔍 Vérification

### Sur GitHub Actions
```
https://github.com/Idem-AI/idem/actions
```

Surveillez les 5 workflows:
- ✅ Deploy API
- ✅ Deploy Main Dashboard
- ✅ Deploy Landing
- ✅ Deploy AppGen
- ✅ Deploy Chart

### Sur le Serveur

```bash
# Vérifier les images buildées
docker images | grep 18001c56

# Vérifier les conteneurs
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "(idem|redis)"

# Vérifier les logs
docker logs idem-api --tail 50
docker logs idem --tail 50
```

## 🎯 Prochaines Étapes

1. **Surveiller les workflows** sur GitHub Actions
2. **Vérifier les déploiements** une fois les workflows terminés
3. **Tester les services** en production
4. **Vérifier les logs** pour toute erreur

## 📝 Notes

- Les workflows utilisent un **mécanisme de retry** (5 tentatives)
- Délai aléatoire entre les retries (1-3 secondes)
- `git checkout -f` pour éviter les conflits d'index
- Les docker-compose restent sur le serveur (non versionnés différemment)

---

**Status**: 🟢 Déploiement en cours
**Last Update**: Nov 17, 2025 23:25 UTC
