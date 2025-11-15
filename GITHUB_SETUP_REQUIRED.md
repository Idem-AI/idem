# Configuration GitHub Requise - Multi-environnement

## ✅ Travail Accompli sur le Serveur

### 1. Branches Préparées
- ✅ **main** : Mise à jour avec toute la config multi-environnement
- ✅ **dev** : Synchronisée avec main, prête pour staging

### 2. Commits Effectués
```
main (e802ec35):
  feat: Multi-environment deployment setup (prod/staging) + Redis integration
  - 43 files changed, 2509 insertions(+), 101 deletions(-)

dev (62fd5ab1):
  chore: Merge main into dev - Multi-environment setup
  - Conflit .gitignore résolu
```

### 3. Fichiers Exclus du Git (Sécurité)
✅ Scripts letsencrypt exclus (`*-letsencrypt*.sh`)
✅ Dossier `data/` exclu (certificats SSL)
✅ Fichiers temporaires Docker exclus

## 🔧 Actions Requises sur GitHub

### ÉTAPE 1: Créer les Environnements GitHub

Vous devez créer deux environnements dans les settings du repo GitHub :

#### A. Créer l'environnement "production"
1. Aller sur : `https://github.com/Idem-AI/idem/settings/environments`
2. Cliquer sur "New environment"
3. Nom : `production`
4. Configurer les variables d'environnement :

**Variables d'environnement à ajouter :**
```
SERVER_HOST=<votre-ip-serveur>
SERVER_USER=root
SSH_PRIVATE_KEY=<votre-clé-ssh-privée>
```

5. Sauvegarder

#### B. Créer l'environnement "staging"
1. Cliquer sur "New environment"
2. Nom : `staging`
3. Configurer les MÊMES variables :

**Variables d'environnement à ajouter :**
```
SERVER_HOST=<votre-ip-serveur>
SERVER_USER=root
SSH_PRIVATE_KEY=<votre-clé-ssh-privée>
```

4. Sauvegarder

### ÉTAPE 2: Configurer les Secrets du Repository (si pas déjà fait)

Si les secrets n'existent pas encore au niveau du repository :

1. Aller sur : `https://github.com/Idem-AI/idem/settings/secrets/actions`
2. Ajouter ces secrets :

```
SERVER_HOST=<votre-ip-serveur>
SERVER_USER=root
SSH_PRIVATE_KEY=<votre-clé-ssh-privée-complète>
```

### ÉTAPE 3: Vérifier les Workflows

Les workflows suivants sont configurés pour le multi-environnement :

✅ `.github/workflows/deploy-api.yml`
- Trigger: push sur `dev` → déploiement staging
- Trigger: merge PR dans `main` → déploiement production

✅ `.github/workflows/deploy-main-dashboard.yml`
- Trigger: push sur `dev` → déploiement staging
- Trigger: merge PR dans `main` → déploiement production

✅ `.github/workflows/deploy-landing.yml`
- Trigger: push sur `dev` → déploiement staging
- Trigger: merge PR dans `main` → déploiement production

✅ `.github/workflows/deploy-appgen.yml`
- Trigger: push sur `dev` → déploiement staging
- Trigger: merge PR dans `main` → déploiement production

✅ `.github/workflows/deploy-chart.yml`
- Trigger: push sur `dev` → déploiement staging
- Trigger: merge PR dans `main` → déploiement production

## 📝 Workflow de Développement

### Pour Staging (Environnement de Test)
```bash
# 1. Travailler sur dev
git checkout dev

# 2. Faire vos modifications
git add .
git commit -m "feat: nouvelle fonctionnalité"

# 3. Pusher
git push origin dev

# ✅ Le workflow GitHub Actions déploie automatiquement sur staging
```

### Pour Production
```bash
# 1. S'assurer que dev est testé et stable

# 2. Créer une Pull Request de dev vers main sur GitHub

# 3. Review et merge de la PR

# ✅ Le workflow GitHub Actions déploie automatiquement sur production
```

## 🚀 Commandes de Push

Une fois les environnements GitHub créés, exécutez :

```bash
# Push de la branche main
git push origin main

# Push de la branche dev
git push origin dev
```

## ⚠️ Important

1. **NE PAS pusher avant d'avoir créé les environnements GitHub**
   - Les workflows vont échouer sans les environnements configurés

2. **Vérifier les secrets**
   - SSH_PRIVATE_KEY doit être la clé COMPLÈTE (avec BEGIN et END)
   - SERVER_HOST doit être l'IP ou le domaine du serveur
   - SERVER_USER doit avoir les droits Docker

3. **Protection des branches**
   - Considérez activer la protection de branche pour `main`
   - Requérir des reviews avant merge

## 📊 Architecture de Déploiement

```
GitHub Repository
│
├── Branch: main (Production)
│   └── Push/Merge → deploy-*.yml workflows
│       └── Déploiement automatique sur Production
│           ├── Docker Compose: docker-compose.prod.yml
│           ├── Redis: redis-prod (port 6379)
│           └── Services: idem-api, idem, idem-landing, etc.
│
└── Branch: dev (Staging)
    └── Push → deploy-*.yml workflows
        └── Déploiement automatique sur Staging
            ├── Docker Compose: docker-compose.staging.yml
            ├── Redis: redis-staging (port 6380)
            └── Services: idem-api-staging, idem-staging, etc.
```

## ✅ Checklist Finale

Avant de pusher, vérifiez :

- [ ] Environnement "production" créé sur GitHub
- [ ] Environnement "staging" créé sur GitHub
- [ ] Variables d'environnement configurées pour les deux
- [ ] Secrets du repository configurés
- [ ] Branches main et dev synchronisées localement
- [ ] Tests effectués sur staging

Une fois tout vérifié :
```bash
git push origin main
git push origin dev
```

## 🎯 Prochaines Étapes Après le Push

1. Vérifier que les workflows s'exécutent sans erreur
2. Tester le déploiement staging (push sur dev)
3. Tester le déploiement production (merge PR)
4. Surveiller les logs des conteneurs

## 📞 Support

En cas de problème lors du push :
- Vérifier les logs des GitHub Actions
- Vérifier la connectivité SSH au serveur
- Vérifier que Docker fonctionne sur le serveur
