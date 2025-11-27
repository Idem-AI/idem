# 🔄 CI/CD Workflows Configuration

**Date**: 26 Nov 2025  
**Status**: ✅ Optimisé et Testé

---

## 📋 Vue d'ensemble

Les workflows CI/CD sont configurés pour **ne se déclencher que lorsque les fichiers spécifiques de chaque application sont modifiés**, évitant ainsi les builds inutiles.

---

## 🎯 Workflows Configurés

### 1. **AppGen Client** (`deploy-appgen.yml`)

**Déclencheurs** :
```yaml
paths:
  - 'apps/appgen/apps/we-dev-client/**'  # Code source AppGen Client
  - 'Dockerfile.appgen-client'            # Dockerfile spécifique
  - 'packages/shared-styles/**'           # Dépendance partagée
  - '.github/workflows/deploy-appgen.yml' # Workflow lui-même
```

**Build** :
```bash
docker build -f Dockerfile.appgen-client -t ghcr.io/idem-ai/idem-appgen:$COMMIT_ID .
```

**Déploiement** :
- **Production** : `idem-webgen` dans `docker-compose.prod.yml`
- **Staging** : `idem-webgen-staging` dans `docker-compose.staging.yml`

**Image** : `ghcr.io/idem-ai/idem-appgen:$COMMIT_ID`

---

### 2. **Main Dashboard** (`deploy-main-dashboard.yml`)

**Déclencheurs** :
```yaml
paths:
  - 'apps/main-dashboard/**'                  # Code source Dashboard
  - 'Dockerfile.main-dashboard'               # Dockerfile production
  - 'Dockerfile.main-dashboard.staging'       # Dockerfile staging
  - 'packages/shared-models/**'               # Dépendance partagée
  - '.github/workflows/deploy-main-dashboard.yml'
```

**Build** :
```bash
docker build -f Dockerfile.main-dashboard -t ghcr.io/idem-ai/idem-main-dashboard:$COMMIT_ID .
```

**Déploiement** :
- **Production** : `idem` dans `docker-compose.prod.yml`
- **Staging** : `idem-staging` dans `docker-compose.staging.yml`

**Image** : `ghcr.io/idem-ai/idem-main-dashboard:$COMMIT_ID`

---

### 3. **API** (`deploy-api.yml`)

**Déclencheurs** :
```yaml
paths:
  - 'apps/api/**'                        # Code source API
  - 'Dockerfile.api'                     # Dockerfile spécifique
  - 'packages/shared-models/**'          # Dépendance partagée
  - '.github/workflows/deploy-api.yml'
```

**Build** :
```bash
docker build -f Dockerfile.api -t ghcr.io/idem-ai/idem-api:$COMMIT_ID .
```

**Déploiement** :
- **Production** : `idem-api` dans `docker-compose.prod.yml`
- **Staging** : `idem-api-staging` dans `docker-compose.staging.yml`

**Image** : `ghcr.io/idem-ai/idem-api:$COMMIT_ID`

---

### 4. **Landing** (`deploy-landing.yml`)

**Déclencheurs** :
```yaml
paths:
  - 'apps/landing/**'
  - 'Dockerfile.landing'
  - 'packages/shared-models/**'
  - '.github/workflows/deploy-landing.yml'
```

**Build** :
```bash
docker build -f Dockerfile.landing -t ghcr.io/idem-ai/idem-landing:$COMMIT_ID .
```

**Image** : `ghcr.io/idem-ai/idem-landing:$COMMIT_ID`

---

### 5. **Chart** (`deploy-chart.yml`)

**Déclencheurs** :
```yaml
paths:
  - 'apps/chart/**'
  - 'Dockerfile.chart'
  - '.github/workflows/deploy-chart.yml'
```

**Build** :
```bash
docker build -f Dockerfile.chart -t ghcr.io/idem-ai/idem-chart:$COMMIT_ID .
```

**Image** : `ghcr.io/idem-ai/idem-chart:$COMMIT_ID`

---

## 🔧 Corrections Appliquées

### ❌ Problème Initial

**AppGen Workflow** :
- ✗ `paths` incluait `'apps/appgen/**'` (trop large, incluait server)
- ✗ `paths` référençait `Dockerfile.appgen` mais build utilisait `Dockerfile.appgen-client`
- ✗ Manquait la dépendance `packages/shared-styles/**`

**Résultat** : Builds déclenchés inutilement pour des modifications non liées

---

### ✅ Solution Appliquée

**AppGen Workflow** :
- ✓ `paths` = `'apps/appgen/apps/we-dev-client/**'` (précis)
- ✓ `Dockerfile.appgen-client` partout (cohérent)
- ✓ Ajout de `'packages/shared-styles/**'` (dépendance)

**Résultat** : CI ne se déclenche que pour les modifications pertinentes

---

## 📊 Matrice de Déclenchement

| Modification                                  | AppGen | Dashboard | API | Landing | Chart |
|-----------------------------------------------|--------|-----------|-----|---------|-------|
| `apps/appgen/apps/we-dev-client/src/App.tsx` | ✅     | ❌        | ❌  | ❌      | ❌    |
| `apps/main-dashboard/src/app/app.component.ts` | ❌     | ✅        | ❌  | ❌      | ❌    |
| `apps/api/api/services/branding.service.ts`   | ❌     | ❌        | ✅  | ❌      | ❌    |
| `apps/landing/src/app/home/home.component.ts` | ❌     | ❌        | ❌  | ✅      | ❌    |
| `apps/chart/src/routes/+page.svelte`         | ❌     | ❌        | ❌  | ❌      | ✅    |
| `packages/shared-models/src/project.model.ts` | ❌     | ✅        | ✅  | ✅      | ❌    |
| `packages/shared-styles/styles.css`           | ✅     | ❌        | ❌  | ❌      | ❌    |
| `Dockerfile.appgen-client`                    | ✅     | ❌        | ❌  | ❌      | ❌    |
| `Dockerfile.main-dashboard`                   | ❌     | ✅        | ❌  | ❌      | ❌    |
| `Dockerfile.api`                              | ❌     | ❌        | ✅  | ❌      | ❌    |
| `docker-compose.prod.yml`                     | ❌     | ❌        | ❌  | ❌      | ❌    |
| `README.md`                                   | ❌     | ❌        | ❌  | ❌      | ❌    |

---

## 🚀 Workflow Standard

Tous les workflows suivent le même pattern :

### 1. **Déclenchement**
```yaml
on:
  push:
    branches: [ dev, main ]
    paths: [ ... ]  # Fichiers spécifiques
  pull_request:
    types: [ closed ]
    branches: [ main ]
    paths: [ ... ]
  workflow_dispatch:  # Déclenchement manuel
```

### 2. **Build**
```bash
# Sur le serveur via SSH
cd /root/idem
git checkout -f $BRANCH
git pull origin $BRANCH
docker build -f Dockerfile.$APP -t $IMAGE_TAG .
docker push $IMAGE_TAG
```

### 3. **Déploiement**
```bash
# Production (main)
docker-compose -f docker-compose.prod.yml pull $SERVICE
docker-compose -f docker-compose.prod.yml up -d $SERVICE

# Staging (dev)
docker-compose -f docker-compose.staging.yml pull $SERVICE
docker-compose -f docker-compose.staging.yml up -d $SERVICE
```

### 4. **Cleanup**
```bash
docker image prune -f
```

---

## 🔐 Secrets Requis

Les workflows nécessitent ces secrets GitHub :

- `SERVER_HOST` : IP/hostname du serveur de déploiement
- `SERVER_USER` : Utilisateur SSH (généralement `root`)
- `SSH_PRIVATE_KEY` : Clé SSH privée pour l'authentification

---

## 📝 Bonnes Pratiques

### ✅ À Faire

1. **Paths précis** : Utiliser des paths spécifiques pour éviter les déclenchements inutiles
2. **Dockerfile cohérent** : Le même Dockerfile dans `paths` et dans `docker build`
3. **Dépendances** : Inclure les packages partagés utilisés par l'app
4. **Tests locaux** : Tester le build Docker localement avant de push

### ❌ À Éviter

1. **Paths trop larges** : `apps/**` déclenche tous les workflows
2. **Dockerfile incohérent** : `paths: Dockerfile.A` mais `build -f Dockerfile.B`
3. **Oublier les dépendances** : Ne pas inclure `packages/shared-*/**`
4. **Build sans test** : Push sans vérifier que le Dockerfile fonctionne

---

## 🧪 Tester un Workflow

### Méthode 1 : Modification de fichier

```bash
# Modifier un fichier dans le path du workflow
echo "// Version bump" >> apps/main-dashboard/package.json
git add apps/main-dashboard/package.json
git commit -m "chore: bump dashboard version"
git push origin main
```

### Méthode 2 : Déclenchement manuel

1. Aller sur GitHub Actions
2. Sélectionner le workflow
3. Cliquer sur "Run workflow"
4. Choisir la branche (dev ou main)

---

## 📊 Monitoring

### Vérifier les Workflows

```bash
# Voir les workflows actifs
gh workflow list

# Voir les runs récents
gh run list --limit 10

# Voir les détails d'un run
gh run view <run-id>

# Voir les logs
gh run view <run-id> --log
```

### Sur GitHub

🔍 **URL** : https://github.com/Idem-AI/idem/actions

**Statuts** :
- 🟢 **Success** : Build et déploiement réussis
- 🟡 **In Progress** : Workflow en cours
- 🔴 **Failed** : Erreur (vérifier les logs)
- ⚪ **Cancelled** : Annulé manuellement

---

## 🐛 Dépannage

### Workflow ne se déclenche pas

**Causes possibles** :
1. Les fichiers modifiés ne correspondent pas aux `paths`
2. La branche n'est pas `dev` ou `main`
3. Le workflow est désactivé

**Solution** :
```bash
# Vérifier les paths du workflow
cat .github/workflows/deploy-$APP.yml | grep -A 10 "paths:"

# Déclencher manuellement
gh workflow run deploy-$APP.yml --ref main
```

### Build échoue

**Causes possibles** :
1. Dockerfile incorrect
2. Dépendances manquantes
3. Erreur de syntaxe dans le code

**Solution** :
```bash
# Tester le build localement
docker build -f Dockerfile.$APP -t test-$APP .

# Vérifier les logs
gh run view --log
```

### Déploiement échoue

**Causes possibles** :
1. Service name incorrect dans docker-compose
2. Image non pushée au registry
3. Problème de connexion SSH

**Solution** :
```bash
# Vérifier le service dans docker-compose
grep -A 5 "$SERVICE_NAME:" docker-compose.prod.yml

# Vérifier l'image
docker pull ghcr.io/idem-ai/$APP:$TAG

# Tester SSH
ssh $SERVER_USER@$SERVER_HOST "docker ps"
```

---

## 📚 Ressources

- **GitHub Actions Docs** : https://docs.github.com/en/actions
- **Docker Build Docs** : https://docs.docker.com/engine/reference/commandline/build/
- **Docker Compose Docs** : https://docs.docker.com/compose/

---

## ✅ Checklist de Vérification

Avant de modifier un workflow :

- [ ] Les `paths` sont précis et correspondent aux fichiers de l'app
- [ ] Le Dockerfile dans `paths` correspond à celui dans `docker build`
- [ ] Les dépendances partagées sont incluses dans `paths`
- [ ] Le `SERVICE_NAME` correspond à celui dans docker-compose
- [ ] Le workflow a été testé localement (build Docker)
- [ ] Les secrets GitHub sont configurés
- [ ] La documentation est à jour

---

## 🎯 Résumé

✅ **Workflows optimisés** : Ne se déclenchent que pour les modifications pertinentes  
✅ **Dockerfiles cohérents** : Même fichier dans paths et build  
✅ **Dépendances trackées** : Packages partagés inclus  
✅ **Tests effectués** : Main-Dashboard et API CI déclenchés  

**Les workflows sont maintenant configurés pour éviter les builds inutiles !** 🚀
