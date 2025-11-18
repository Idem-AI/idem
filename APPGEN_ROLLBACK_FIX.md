# 🔧 Fix AppGen Service - Rollback to Stable Version

## ❌ Problème Détecté

**Date**: Nov 17, 2025 23:55 UTC

**Symptômes** :
- `idem-webgen` en état **"Restarting"** (crash en boucle)
- Service inaccessible
- Redémarre toutes les 30 secondes

**Logs d'erreur** :
```
Error: Cannot find config file
    at getConfigHash (fumadocs-mdx/.../chunk-766EAFX6.js:83:9)
```

---

## 🔍 Analyse

### Images Affectées

Toutes les builds depuis **Nov 17, 2025 12:20 UTC** sont cassées :

| Image Tag | Date | Status |
|-----------|------|--------|
| `daccd729` | 23:36 UTC | ❌ Crash |
| `08401a08` | 23:36 UTC | ❌ Crash |
| `425a7427` | 23:36 UTC | ❌ Crash |
| `28d44d3e` | 12:20 UTC | ❌ Crash |
| `v1.0` | Oct 22, 2025 | ✅ Stable |

### Cause Racine

Les builds récents manquent un **fichier de configuration** requis par `fumadocs-mdx`.

Le fichier de config devrait être généré au build mais n'est pas présent dans l'image finale.

---

## ✅ Solution Appliquée

### 1. Arrêt du Service Cassé

```bash
docker stop idem-webgen
docker rm idem-webgen
```

### 2. Rollback vers Version Stable

**Modification** : `docker-compose.prod.yml`

```yaml
# AVANT (cassé)
idem-webgen:
  image: ghcr.io/idem-ai/idem-appgen:28d44d3e  # ❌

# APRÈS (stable)
idem-webgen:
  image: ghcr.io/idem-ai/idem-appgen:v1.0  # ✅
```

### 3. Redémarrage

```bash
docker-compose -f docker-compose.prod.yml up -d idem-webgen
```

### 4. Vérification

```bash
docker ps | grep idem-webgen
# idem-webgen   Up 2 minutes   ghcr.io/idem-ai/idem-appgen:v1.0

docker logs idem-webgen --tail 5
# ➜  Local:   http://localhost:4173/
# ➜  Network: http://172.18.0.8:4173/
```

✅ **Service fonctionne correctement**

---

## 📝 Commit

**Branch** : `main`  
**Commit** : `5a7900e3`  
**Message** : `fix: Rollback idem-webgen to stable v1.0`

```
Problem: Recent builds crash with 'Cannot find config file'
Solution: Use stable v1.0 (Oct 22) that works correctly
Status: Service now UP and running
```

---

## 🚨 Action Requise

### Pour les Développeurs

**Ne pas merger les changements AppGen tant que le problème de config n'est pas résolu.**

#### Debug Steps

1. Vérifier le fichier de config fumadocs dans le build :
   ```bash
   # Dans le Dockerfile.appgen
   # S'assurer que la config est copiée/générée
   ```

2. Vérifier les dépendances :
   ```bash
   # package.json doit inclure fumadocs-mdx avec la bonne version
   ```

3. Tester le build localement :
   ```bash
   docker build -f Dockerfile.appgen -t test-appgen .
   docker run test-appgen
   # Vérifier les logs pour l'erreur de config
   ```

4. Une fois fixé, créer un nouveau tag :
   ```bash
   # Après fix et test
   git tag appgen-v1.1
   git push origin appgen-v1.1
   ```

---

## 📊 État Actuel des Services

| Service | Container | Status | Image |
|---------|-----------|--------|-------|
| **WebGen (Prod)** | `idem-webgen` | ✅ UP | `v1.0` |
| **AppGen Server** | `appgen-server` | ✅ UP | `2.0` |

---

## 🔄 Procédure de Restauration Future

Si le problème se reproduit après un déploiement :

1. **Identifier la version stable** :
   ```bash
   docker images ghcr.io/idem-ai/idem-appgen
   # Chercher une version qui fonctionne
   ```

2. **Modifier docker-compose** :
   ```bash
   vim docker-compose.prod.yml
   # Changer l'image vers la version stable
   ```

3. **Redémarrer** :
   ```bash
   docker-compose -f docker-compose.prod.yml up -d idem-webgen
   ```

4. **Vérifier** :
   ```bash
   docker ps | grep idem-webgen
   docker logs idem-webgen
   ```

5. **Commit** :
   ```bash
   git add docker-compose.prod.yml
   git commit -m "fix: Rollback idem-webgen to working version"
   git push origin main
   ```

---

## ✅ Résultat

- ✅ **Service AppGen restauré**
- ✅ **Production stable avec v1.0**
- ✅ **Commit pushé sur main**
- ⚠️ **Builds récents à débugger avant prochain déploiement**

---

**Date de résolution** : Nov 17, 2025 23:58 UTC  
**Status** : 🟢 Résolu
