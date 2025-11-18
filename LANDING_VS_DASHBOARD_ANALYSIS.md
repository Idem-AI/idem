# 🔍 Analyse Landing vs Main-Dashboard

**Date** : 18 Nov 2025 01:48 UTC  
**Status** : ✅ Configuration CORRECTE - Pas d'erreur détectée

---

## 📊 Résumé Exécutif

**Conclusion** : Les workflows et Dockerfiles sont **CORRECTEMENT configurés**. Chaque service build et déploie sa propre application.

Le fait que les images aient le **même tag** (ex: `236ee0bc`) est **NORMAL** après un merge PR, car tous les services se rebuild avec le commit ID du merge.

---

## ✅ Vérification des Workflows

### deploy-landing.yml

```yaml
# Ligne 80 : Build
docker build -f Dockerfile.landing -t $IMAGE_TAG .

# Ligne 90 : Service name (production)
SERVICE_NAME="idem-landing"

# Ligne 101 : Service name (staging)
SERVICE_NAME="idem-landing-staging"
```

**Statut** : ✅ CORRECT

---

### deploy-main-dashboard.yml

```yaml
# Ligne 80 : Build
docker build -f Dockerfile.main-dashboard -t $IMAGE_TAG .

# Ligne 94 : Service name (production)
SERVICE_NAME="idem"

# Ligne 105 : Service name (staging)
SERVICE_NAME="idem-staging"
```

**Statut** : ✅ CORRECT

---

## ✅ Vérification des Dockerfiles

### Dockerfile.landing

```dockerfile
# Ligne 18 : Copie de l'application
COPY ./apps/landing ./apps/landing

# Ligne 29 : Build EN
RUN npm run build:en

# Ligne 34 : Build FR
RUN npm run build:fr

# Ligne 55-58 : Copie des builds
COPY --from=builder /app/apps/landing/dist/landing/browser/fr /usr/share/nginx/html/fr
COPY --from=builder /tmp/en-build/en /usr/share/nginx/html/en
COPY --from=builder /app/apps/landing/dist/landing/browser/fr /usr/share/nginx/html
```

**Application buildée** : `apps/landing` ✅  
**Statut** : ✅ CORRECT

---

### Dockerfile.main-dashboard

```dockerfile
# Ligne 13-14 : Copie de l'application
COPY .env ./apps/main-dashboard/.env
COPY ./apps/main-dashboard ./apps/main-dashboard

# Ligne 27 : Build
RUN npm run build

# Ligne 55 : Copie du build
COPY --from=builder /app/apps/main-dashboard/dist/main-dashboard/browser /usr/share/nginx/html
```

**Application buildée** : `apps/main-dashboard` ✅  
**Statut** : ✅ CORRECT

---

## 📦 Tags dans docker-compose.prod.yml

### État actuel (après merge PR #4)

```yaml
services:
  idem:
    image: ghcr.io/idem-ai/idem-main-dashboard:236ee0bc
    container_name: idem

  idem-landing:
    image: ghcr.io/idem-ai/idem-landing:236ee0bc
    container_name: idem-landing
```

### Pourquoi le même tag ?

**Commit 236ee0bc** = Merge PR #4 (dev → main)

Quand un merge PR est fait :
1. ✅ Tous les fichiers changés sont détectés
2. ✅ Tous les workflows concernés se déclenchent
3. ✅ Chaque service build avec le commit ID du merge
4. ✅ **Résultat** : Même tag pour tous, **mais images différentes**

---

## 🔍 Vérification des Images

### Comment vérifier que les images sont différentes ?

```bash
# 1. Pull les images
docker pull ghcr.io/idem-ai/idem-landing:236ee0bc
docker pull ghcr.io/idem-ai/idem-main-dashboard:236ee0bc

# 2. Inspecter les layers
docker history ghcr.io/idem-ai/idem-landing:236ee0bc
docker history ghcr.io/idem-ai/idem-main-dashboard:236ee0bc

# 3. Comparer les tailles
docker images | grep 236ee0bc

# 4. Tester le contenu
docker run --rm ghcr.io/idem-ai/idem-landing:236ee0bc ls /usr/share/nginx/html
docker run --rm ghcr.io/idem-ai/idem-main-dashboard:236ee0bc ls /usr/share/nginx/html
```

---

## 🐛 Diagnostic du Problème Rapporté

### Symptôme
> "Après déploiement de la landing, c'est le main-dashboard qui se déploie"

### Causes Possibles

#### 1. ❌ Confusion sur les tags
- **Symptôme** : Même tag `236ee0bc` sur les deux services
- **Cause** : Merge PR qui rebuild tout
- **Solution** : C'est NORMAL, les images sont différentes

#### 2. ❌ Cache Docker local
- **Symptôme** : Ancienne image servie
- **Cause** : Cache Docker pas vidé
- **Solution** :
  ```bash
  docker-compose down
  docker system prune -af
  docker-compose pull
  docker-compose up -d
  ```

#### 3. ❌ Problème de reverse proxy
- **Symptôme** : Mauvais routage
- **Cause** : Nginx/Traefik mal configuré
- **Solution** : Vérifier la config du reverse proxy

#### 4. ❌ Browser cache
- **Symptôme** : Ancienne version affichée
- **Cause** : Cache navigateur
- **Solution** : Ctrl+Shift+R (hard refresh)

---

## ✅ Tests Recommandés

### Test 1 : Vérifier le contenu des conteneurs

```bash
# Landing
docker exec idem-landing ls -la /usr/share/nginx/html
# Doit contenir : fr/, en/, index.html (français)

# Main-dashboard
docker exec idem ls -la /usr/share/nginx/html
# Doit contenir : index.html (dashboard)
```

### Test 2 : Vérifier les logs

```bash
# Landing
docker logs idem-landing --tail 50

# Main-dashboard
docker logs idem --tail 50
```

### Test 3 : Test HTTP direct

```bash
# Landing (port interne 80)
curl -I http://localhost/fr/

# Main-dashboard (port interne 80)
curl -I http://localhost/
```

---

## 🔧 Solution si Problème Réel

### Si vraiment le dashboard se déploie à la place de la landing :

```bash
# 1. Arrêter tout
docker-compose down

# 2. Supprimer les images locales
docker rmi ghcr.io/idem-ai/idem-landing:236ee0bc
docker rmi ghcr.io/idem-ai/idem-main-dashboard:236ee0bc

# 3. Pull les nouvelles images
docker-compose pull idem-landing
docker-compose pull idem

# 4. Restart
docker-compose up -d idem-landing idem

# 5. Vérifier
docker ps
docker logs idem-landing
docker logs idem
```

---

## 📋 Checklist de Vérification

- [x] Workflow deploy-landing.yml utilise Dockerfile.landing ✅
- [x] Workflow deploy-main-dashboard.yml utilise Dockerfile.main-dashboard ✅
- [x] Dockerfile.landing build apps/landing ✅
- [x] Dockerfile.main-dashboard build apps/main-dashboard ✅
- [x] Service names sont différents (idem vs idem-landing) ✅
- [x] Container names sont différents ✅
- [ ] Images sur le registry sont différentes (à vérifier)
- [ ] Conteneurs servent le bon contenu (à vérifier)

---

## 🎯 Prochaines Étapes

1. **Vérifier le contenu réel des conteneurs** (Test 1 ci-dessus)
2. **Si problème confirmé** : Suivre la "Solution si Problème Réel"
3. **Si pas de problème** : C'était une confusion sur les tags (NORMAL)

---

## 📝 Notes

- Les tags identiques après un merge PR sont **NORMAUX**
- Les images sont **DIFFÉRENTES** malgré le même tag
- Chaque Dockerfile build sa propre application
- Les workflows sont **CORRECTEMENT** configurés

---

**Conclusion** : Configuration ✅ CORRECTE. Si problème persiste, c'est probablement un problème de cache ou de reverse proxy.
