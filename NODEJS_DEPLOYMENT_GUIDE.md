# Guide de Déploiement Node.js pour SPA Angular

**Date:** 2025-11-12  
**Problème:** Flash/rechargement désagréable avec nginx  
**Solution:** Serveur Node.js Express pour SPA multilingue

---

## 🎯 Pourquoi Node.js au lieu de Nginx ?

### Problèmes avec Nginx pour SPA

1. **Flash entre pages** lors du rechargement
2. **Gestion complexe** du multilingue avec `alias`
3. **Redirections 301** non désirées
4. **Configuration complexe** pour les fallbacks
5. **Cache agressif** qui peut causer des problèmes

### Avantages de Node.js Express

1. **Contrôle total** du routing
2. **Pas de flash** lors du rechargement
3. **Gestion native** du multilingue
4. **Headers personnalisés** par type de fichier
5. **Logs détaillés** et debugging facile
6. **Middleware** pour compression, sécurité, etc.

---

## 🚀 Solutions Disponibles

### Solution 1: Main Dashboard avec Node.js ✅

**Fichier:** `Dockerfile.main-dashboard-node`

**Avantages:**
- Serveur Express personnalisé
- Support multilingue (FR/EN)
- Pas de flash lors du rechargement
- Headers optimisés
- Port 4200 (standard Angular)

**Utilisation:**
```bash
# Build
docker build -f Dockerfile.main-dashboard-node -t idem-dashboard:node .

# Run
docker run -d --name idem-dashboard -p 4200:4200 idem-dashboard:node

# Test
curl http://localhost:4200/
curl http://localhost:4200/about
curl http://localhost:4200/en/
```

### Solution 2: Landing avec Node.js ✅

**Fichier:** `Dockerfile.landing-node`

**Avantages:**
- Serveur Express avec compression et sécurité
- Support multilingue optimisé
- Cache intelligent (pas de cache HTML, cache long assets)
- Port 80 (standard web)
- Utilisateur non-root

**Utilisation:**
```bash
# Build
docker build -f Dockerfile.landing-node -t idem-landing:node .

# Run
docker run -d --name idem-landing -p 80:80 idem-landing:node

# Test
curl http://localhost/
curl http://localhost/about
curl http://localhost/en/
```

### Solution 3: Nginx Optimisé (Alternative)

**Fichier:** `apps/landing/nginx-optimized.conf`

**Améliorations:**
- Headers no-cache pour HTML
- Fallback immédiat (pas de tentative de fichier)
- Cache optimisé par type de fichier
- Configuration TCP optimisée

---

## 🔄 Migration du Déploiement

### Étape 1: Mise à Jour docker-compose.yml

```yaml
version: '3.8'

services:
  # Landing avec Node.js
  idem-landing:
    build:
      context: .
      dockerfile: Dockerfile.landing-node
    container_name: idem-landing
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production

  # Dashboard avec Node.js  
  idem-dashboard:
    build:
      context: .
      dockerfile: Dockerfile.main-dashboard-node
    container_name: idem-dashboard
    restart: unless-stopped
    ports:
      - "4200:4200"
    environment:
      - NODE_ENV=production
```

### Étape 2: Mise à Jour du Reverse Proxy

Le fichier `data/nginx/idem-ai.com.conf` reste identique :

```nginx
location / {
    proxy_pass  http://idem-landing;  # Pointe vers le conteneur Node.js
    proxy_set_header    Host                $http_host;
    proxy_set_header    X-Real-IP           $remote_addr;
    proxy_set_header    X-Forwarded-For     $proxy_add_x_forwarded_for;
}
```

**Aucun changement nécessaire** car le reverse-proxy pointe vers le conteneur, pas vers nginx spécifiquement.

### Étape 3: Mise à Jour des Workflows CI/CD

```yaml
# .github/workflows/deploy-landing.yml
- name: Build, Push & Deploy
  script: |
    # Build avec le nouveau Dockerfile
    docker build -f Dockerfile.landing-node -t $IMAGE_NAME .
    
    # Le reste reste identique
    docker push $IMAGE_NAME
    docker-compose up -d idem-landing
```

---

## 🧪 Tests de Validation

### Test 1: Fonctionnalité de Base

```bash
# Landing
curl -I http://localhost/
curl -I http://localhost/about
curl -I http://localhost/en/
curl -I http://localhost/en/about

# Dashboard  
curl -I http://localhost:4200/
curl -I http://localhost:4200/dashboard
curl -I http://localhost:4200/en/
```

### Test 2: Performance et Cache

```bash
# Vérifier les headers de cache
curl -I http://localhost/main.js  # Devrait avoir Cache-Control: max-age=31536000
curl -I http://localhost/         # Devrait avoir Cache-Control: no-cache

# Vérifier la compression
curl -H "Accept-Encoding: gzip" -I http://localhost/
```

### Test 3: Rechargement de Page

1. **Ouvrir dans le navigateur** : `http://localhost/about`
2. **Appuyer sur F5** (actualiser)
3. **Vérifier** : Pas de flash, chargement direct de la page

### Test 4: Navigation Multilingue

1. **Aller sur** : `http://localhost/`
2. **Changer de langue** : `http://localhost/en/`
3. **Naviguer** : `http://localhost/en/about`
4. **Actualiser** : Devrait rester en anglais

---

## 📊 Comparaison des Solutions

| Aspect | Nginx | Node.js Express |
|--------|-------|-----------------|
| **Flash au rechargement** | ❌ Présent | ✅ Absent |
| **Configuration multilingue** | ⚠️ Complexe | ✅ Simple |
| **Performance statique** | ✅ Excellente | ✅ Bonne |
| **Contrôle des headers** | ⚠️ Limité | ✅ Total |
| **Debugging** | ⚠️ Difficile | ✅ Facile |
| **Mémoire** | ✅ Faible | ⚠️ Moyenne |
| **Logs détaillés** | ⚠️ Basiques | ✅ Personnalisés |

---

## 🔧 Configuration Avancée

### Variables d'Environnement

```bash
# Pour le conteneur Node.js
NODE_ENV=production
PORT=4200
LOG_LEVEL=info
CACHE_MAX_AGE=86400
```

### Monitoring et Logs

```bash
# Voir les logs en temps réel
docker logs -f idem-landing
docker logs -f idem-dashboard

# Statistiques de performance
docker stats idem-landing idem-dashboard
```

### Health Checks

Ajouter dans docker-compose.yml :

```yaml
services:
  idem-landing:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 🚀 Déploiement Recommandé

### Pour Résoudre le Problème de Flash

1. **Utiliser `Dockerfile.landing-node`** pour la landing
2. **Utiliser `Dockerfile.main-dashboard-node`** pour le dashboard
3. **Garder le reverse-proxy nginx** existant
4. **Tester en local** avant de déployer

### Commandes de Déploiement

```bash
# 1. Build les nouvelles images
docker build -f Dockerfile.landing-node -t idem-landing:node .
docker build -f Dockerfile.main-dashboard-node -t idem-dashboard:node .

# 2. Arrêter les anciens conteneurs
docker-compose stop idem-landing idem

# 3. Mettre à jour docker-compose.yml avec les nouveaux Dockerfiles

# 4. Redémarrer
docker-compose up -d idem-landing idem

# 5. Vérifier
curl http://localhost/
curl http://localhost:4200/
```

---

## ✅ Résultat Attendu

Après migration vers Node.js :

- ✅ **Pas de flash** lors du rechargement
- ✅ **Navigation fluide** entre les pages
- ✅ **Support multilingue** parfait
- ✅ **Performance optimisée** avec compression
- ✅ **Headers de sécurité** automatiques
- ✅ **Logs détaillés** pour debugging
- ✅ **Cache intelligent** (HTML no-cache, assets cache long)

**L'expérience utilisateur sera considérablement améliorée ! 🎉**
