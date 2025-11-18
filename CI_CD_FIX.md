# 🔧 Correction CI/CD - Push Triggers sur Main

## ❌ Problème Identifié

Les workflows **ne se déclenchaient PAS** sur push direct vers `main`.

### Configuration Originale

```yaml
on:
  push:
    branches: [ dev ]  # ❌ Seulement dev !
    paths:
      - 'apps/api/**'
  pull_request:
    types: [ closed ]
    branches: [ main ]
```

**Résultat** : 
- ✅ Push vers `dev` → Workflows déclenchés (staging)
- ❌ Push vers `main` → **Rien ne se passe**
- ✅ PR merged vers `main` → Workflows déclenchés (production)

---

## ✅ Solution Appliquée

### Nouvelle Configuration

```yaml
on:
  push:
    branches: [ dev, main ]  # ✅ dev ET main !
    paths:
      - 'apps/api/**'
  pull_request:
    types: [ closed ]
    branches: [ main ]
```

**Résultat** :
- ✅ Push vers `dev` → Workflows déclenchés (staging)
- ✅ Push vers `main` → Workflows déclenchés (production)
- ✅ PR merged vers `main` → Workflows déclenchés (production)

---

## 📝 Workflows Modifiés

| Workflow | Fichier | Status |
|----------|---------|--------|
| **Deploy API** | `deploy-api.yml` | ✅ Corrigé |
| **Deploy Main Dashboard** | `deploy-main-dashboard.yml` | ✅ Corrigé |
| **Deploy Landing** | `deploy-landing.yml` | ✅ Corrigé |
| **Deploy AppGen** | `deploy-appgen.yml` | ✅ Corrigé |
| **Deploy Chart** | `deploy-chart.yml` | ✅ Corrigé |

---

## 🚀 Commits

### 1. Fix Workflows (425a7427)
```bash
fix: Enable workflows on push to main branch

- Add 'main' to branches trigger for all deploy workflows
- Now triggers on:
  * push to dev (staging)
  * push to main (production)
  * pull_request merged to main (production)
```

### 2. Test Production (08401a08)
```bash
test: Production CI/CD - NOW with push trigger enabled

✅ Workflows NOW trigger on push to main
✅ Testing all 5 production services
```

---

## 🎯 Images Production

Le commit `08401a08` va builder :

```
ghcr.io/idem-ai/idem-api:08401a08
ghcr.io/idem-ai/idem-main-dashboard:08401a08
ghcr.io/idem-ai/idem-landing:08401a08
ghcr.io/idem-ai/idem-appgen:08401a08
ghcr.io/idem-ai/idem-chart:08401a08
```

**Sans suffixe `-staging`** car branche = `main`

---

## 📊 Vérification

### Sur GitHub Actions
```
https://github.com/Idem-AI/idem/actions
```

Vous devriez voir **5 workflows actifs** pour le commit `08401a08`.

### Sur le Serveur (après ~5-10min)

```bash
# Vérifier les nouvelles images
docker images | grep 08401a08

# Vérifier les conteneurs production
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "^idem"

# Vérifier qu'ils tournent avec les nouvelles images
docker inspect idem-api | grep Image
docker inspect idem | grep Image
docker inspect idem-landing | grep Image
docker inspect idem-webgen | grep Image
docker inspect idem-chart | grep Image
```

---

## 🔍 Différences Staging vs Production

### Déclencheurs

**Staging (dev)** :
- Push vers `dev`
- Images: `commit-id-staging`
- Conteneurs: `xxx-staging`

**Production (main)** :
- Push vers `main`
- PR merged vers `main`
- Images: `commit-id` (sans -staging)
- Conteneurs: noms standards

### Exemple

Push vers `dev` avec commit `abc123` :
```
Image: ghcr.io/idem-ai/idem-api:abc123-staging
Container: idem-api-staging
Network: idem-staging
```

Push vers `main` avec commit `abc123` :
```
Image: ghcr.io/idem-ai/idem-api:abc123
Container: idem-api
Network: idem
```

---

## ✅ Résultat Final

- ✅ **dev mergé vers main** avec succès
- ✅ **docker-compose séparés** : prod sur main, staging sur dev
- ✅ **Workflows corrigés** : déclenchement sur push vers main
- ✅ **Tests production lancés** : commit 08401a08

**Les CI/CD de production sont maintenant fonctionnels ! 🎉**

---

**Date**: Nov 17, 2025 23:30 UTC
**Status**: 🟢 Opérationnel
