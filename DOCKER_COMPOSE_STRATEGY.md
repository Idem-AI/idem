# 🎯 Stratégie Docker Compose - Séparation Staging/Production

## ❌ Problème Résolu

### Situation Avant

**Problème** : Les images de production restaient sur des tags initiaux (comme `1.0`) au lieu d'utiliser les versions à jour.

**Cause** :
- `docker-compose.prod.yml` était versionné sur **dev** ET **main**
- La version sur **dev** était obsolète (images avec tags `1.0`)
- Lors du merge `dev → main`, la version obsolète écrasait la version à jour
- Résultat : Retour en arrière non voulu sur les images de production

**Exemple du problème** :
```yaml
# Sur main (à jour)
idem:
  image: ghcr.io/idem-ai/idem-main-dashboard:80e3250e  ✅

# Sur dev (obsolète)  
idem:
  image: ghcr.io/idem-ai/idem-main-dashboard:1.0  ❌

# Après merge dev → main
idem:
  image: ghcr.io/idem-ai/idem-main-dashboard:1.0  ❌ RÉGRESSION !
```

---

## ✅ Solution Implémentée

### Architecture de Branches

Chaque branche gère son propre fichier docker-compose :

| Branche | Fichier Versionné | Environnement |
|---------|-------------------|---------------|
| **main** | `docker-compose.prod.yml` | Production |
| **dev** | `docker-compose.staging.yml` | Staging |

### Configuration .gitignore

#### Sur `main` :
```gitignore
# Ignore staging compose (géré par dev)
docker-compose.staging.yml
```

#### Sur `dev` :
```gitignore
# Ignore production compose (géré par main)
docker-compose.prod.yml
```

### Résultat

- ✅ **Main** gère uniquement la production
- ✅ **Dev** gère uniquement le staging
- ✅ Plus de régression lors des merges
- ✅ Chaque environnement est isolé

---

## 📁 Structure des Fichiers

### Sur le Serveur

```
/root/idem/
├── docker-compose.prod.yml      # Existe physiquement
├── docker-compose.staging.yml   # Existe physiquement
└── .gitignore                   # Ignore selon la branche
```

**Important** : Les deux fichiers existent **physiquement** sur le serveur, mais sont versionnés différemment selon la branche.

### Dans Git

#### Branch `main` :
```bash
git ls-files | grep docker-compose
# docker-compose.prod.yml  ✅ Versionné
# (docker-compose.staging.yml ignoré)
```

#### Branch `dev` :
```bash
git ls-files | grep docker-compose
# docker-compose.staging.yml  ✅ Versionné
# (docker-compose.prod.yml ignoré)
```

---

## 🔄 Workflow de Déploiement

### Déploiement Staging (dev)

```bash
# Sur dev
git checkout dev
vim apps/api/src/some-file.ts
git commit -m "feat: nouvelle feature"
git push origin dev

# CI/CD se déclenche
# ✅ Build image avec tag: commit-id-staging
# ✅ Update docker-compose.staging.yml
# ✅ Deploy sur environnement staging
```

### Déploiement Production (main)

```bash
# Merge dev vers main
git checkout main
git merge dev  # ✅ Ne touche PAS docker-compose.prod.yml
git push origin main

# CI/CD se déclenche
# ✅ Build image avec tag: commit-id
# ✅ Update docker-compose.prod.yml
# ✅ Deploy sur environnement production
```

**Point clé** : Le merge `dev → main` **ne modifie pas** `docker-compose.prod.yml` car ce fichier n'est pas versionné sur dev !

---

## 🎯 Avantages

### 1. Isolation des Environnements

- Staging et Production sont complètement séparés
- Pas de confusion entre les configurations
- Chaque branche est responsable de son environnement

### 2. Pas de Régression

- Les merges `dev → main` ne peuvent plus écraser `docker-compose.prod.yml`
- Les images de production restent à jour
- Pas de retour en arrière accidentel

### 3. Clarté

- Un fichier par environnement
- Un fichier par branche
- Facile à comprendre et maintenir

### 4. Déploiements Indépendants

- Staging peut être déployé sans affecter production
- Production peut être hotfixée sans toucher staging
- Chaque environnement a son propre cycle

---

## 📝 Commandes Utiles

### Vérifier les fichiers versionnés

```bash
# Sur main
git checkout main
git ls-files | grep docker-compose
# Résultat: docker-compose.prod.yml

# Sur dev
git checkout dev
git ls-files | grep docker-compose
# Résultat: docker-compose.staging.yml
```

### Vérifier les fichiers physiques

```bash
# Les deux existent toujours sur le serveur
ls -la docker-compose*.yml
# docker-compose.prod.yml     ✅
# docker-compose.staging.yml  ✅
```

### Déployer manuellement

```bash
# Production
docker-compose -f docker-compose.prod.yml up -d

# Staging
docker-compose -f docker-compose.staging.yml up -d
```

---

## ⚠️ Important : Ne PAS...

### ❌ Versionner docker-compose.prod.yml sur dev

```bash
# Sur dev - NE PAS FAIRE
git add docker-compose.prod.yml  # ❌
git commit -m "update prod"      # ❌
```

**Pourquoi** : Cela recréerait le problème de régression lors des merges.

### ❌ Versionner docker-compose.staging.yml sur main

```bash
# Sur main - NE PAS FAIRE
git add docker-compose.staging.yml  # ❌
git commit -m "update staging"      # ❌
```

**Pourquoi** : Main ne gère que la production, dev gère le staging.

### ❌ Modifier .gitignore pour retirer les ignores

Les lignes dans `.gitignore` sont **essentielles** pour la stratégie de séparation.

---

## 🔍 Vérification de la Configuration

### Check 1 : .gitignore sur main

```bash
git checkout main
cat .gitignore | grep docker-compose
# Doit contenir: docker-compose.staging.yml
```

### Check 2 : .gitignore sur dev

```bash
git checkout dev
cat .gitignore | grep docker-compose
# Doit contenir: docker-compose.prod.yml
```

### Check 3 : Fichiers versionnés

```bash
# Main
git checkout main
git ls-files | grep docker-compose.prod.yml
# Doit afficher: docker-compose.prod.yml

# Dev
git checkout dev
git ls-files | grep docker-compose.staging.yml
# Doit afficher: docker-compose.staging.yml
```

---

## 📊 Résumé de la Configuration

| Aspect | Main | Dev |
|--------|------|-----|
| **Fichier versionné** | `docker-compose.prod.yml` | `docker-compose.staging.yml` |
| **Fichier ignoré** | `docker-compose.staging.yml` | `docker-compose.prod.yml` |
| **Environnement** | Production | Staging |
| **Images** | `commit-id` | `commit-id-staging` |
| **Merge** | ✅ Safe (pas de régression) | N/A |

---

## ✅ Commits de Configuration

**Main** :
- Commit : `7f94a824`
- Message : `chore: Ignore docker-compose.staging.yml on main branch`

**Dev** :
- Commit : `33dd7a97`
- Message : `chore: Ignore docker-compose.prod.yml on dev branch`

---

**Date** : Nov 18, 2025 00:20 UTC  
**Status** : 🟢 Configuration Active et Testée
