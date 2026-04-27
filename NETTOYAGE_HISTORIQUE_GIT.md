# 🧹 Nettoyage de l'Historique Git

## ✅ Ce qui a été fait

1. ✅ Fichiers `src/environments/environment*.ts` supprimés de l'index Git
2. ✅ `.gitignore` mis à jour pour ignorer ces fichiers
3. ✅ Script de nettoyage créé : `scripts/clean-environments-from-git.sh`

## 🚨 IMPORTANT - À faire maintenant

Les fichiers ont été supprimés de l'index Git actuel, mais ils sont **toujours présents dans l'historique Git**.

Pour les supprimer complètement de l'historique sur toutes les branches :

### Option 1 : Script Automatique (Recommandé)

```bash
# Depuis la racine du projet
./scripts/clean-environments-from-git.sh
```

Le script va :
1. ✅ Créer une sauvegarde automatique
2. ✅ Supprimer les fichiers de tout l'historique
3. ✅ Nettoyer les références Git
4. ✅ Vous guider pour le force push

### Option 2 : Manuel avec git-filter-repo

```bash
# Installer git-filter-repo
brew install git-filter-repo  # macOS
# ou
pip install git-filter-repo   # Linux/Windows

# Créer une sauvegarde
cp -r . ../idem-backup

# Nettoyer l'historique
git filter-repo --force \
  --path apps/main-dashboard/src/environments/environment.ts --invert-paths \
  --path apps/main-dashboard/src/environments/environment.development.ts --invert-paths \
  --path apps/landing/src/environments/environment.ts --invert-paths \
  --path apps/landing/src/environments/environment.development.ts --invert-paths

# Nettoyer les références
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Option 3 : Manuel avec BFG Repo-Cleaner

```bash
# Installer BFG
brew install bfg  # macOS

# Créer une sauvegarde
cp -r . ../idem-backup

# Créer un fichier avec les chemins à supprimer
cat > /tmp/files-to-delete.txt << 'EOF'
apps/main-dashboard/src/environments/environment.ts
apps/main-dashboard/src/environments/environment.development.ts
apps/landing/src/environments/environment.ts
apps/landing/src/environments/environment.development.ts
EOF

# Nettoyer avec BFG
bfg --delete-files environment.ts
bfg --delete-files environment.development.ts

# Nettoyer les références
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## 📋 Après le Nettoyage

### 1. Vérifier que les fichiers sont supprimés

```bash
# Ne devrait rien afficher
git log --all --full-history -- '**/environments/environment*.ts'
```

### 2. Commit les changements actuels

```bash
git add -A
git commit -m "security: Remove environment files from Git and configure .env system

- Remove src/environments/*.ts from Git tracking
- Add .env.example templates for main-dashboard and landing
- Update mynode.js to generate environment files from .env
- Add comprehensive security documentation
- Configure automatic environment file generation in npm scripts

BREAKING CHANGE: Environment files are now generated from .env files.
Developers must create .env and .env.development from templates."
```

### 3. Force Push (⚠️ COORDONNER AVEC L'ÉQUIPE)

```bash
# Push sur toutes les branches
git push --force --all

# Push les tags
git push --force --tags
```

### 4. Informer l'Équipe

Envoyez ce message à votre équipe :

```
🚨 IMPORTANT - Historique Git réécrit

L'historique Git a été nettoyé pour supprimer les clés sensibles exposées.

Actions requises pour chaque développeur :

1. Sauvegarder vos changements locaux non commités
2. Récupérer le nouvel historique :
   git fetch --all
   git reset --hard origin/dev  # ou votre branche
3. Créer les fichiers .env :
   cd apps/main-dashboard
   cp .env.development.example .env.development
   # Éditer .env.development avec vos clés
4. Tester :
   npm start

Documentation : voir SECURITE_CORRIGEE.md
```

## 🔍 Vérifications Post-Nettoyage

### Vérifier qu'aucun fichier sensible n'est tracké

```bash
# Ne devrait pas afficher de fichiers .env ou environment*.ts
git ls-files | grep -E '(\.env$|environment\..*\.ts$)'
```

### Vérifier le gitignore

```bash
# Devrait afficher les règles d'ignorance
cat .gitignore | grep -A5 "Environment files"
```

### Tester la génération des fichiers

```bash
cd apps/main-dashboard
cp .env.development.example .env.development
# Éditer .env.development
npm run env:dev
# Vérifier que environment.development.ts est créé
ls -la src/environments/
```

## ⚠️ Avertissements

### AVANT le force push

- [ ] ✅ Créer une sauvegarde du repo
- [ ] ✅ Informer toute l'équipe
- [ ] ✅ Choisir un moment où personne ne travaille
- [ ] ✅ Vérifier que le nettoyage a fonctionné
- [ ] ✅ Tester localement que tout fonctionne

### APRÈS le force push

- [ ] ✅ Vérifier que le push a réussi
- [ ] ✅ Confirmer avec l'équipe qu'ils ont récupéré
- [ ] ✅ Vérifier les CI/CD pipelines
- [ ] ✅ Tester le déploiement

## 🎯 Résultat Attendu

Après le nettoyage complet :

✅ Aucun fichier `environment*.ts` dans l'historique Git
✅ Aucune clé sensible dans l'historique Git
✅ Fichiers `.env` ignorés par Git
✅ Fichiers `environment*.ts` générés automatiquement
✅ Équipe informée et synchronisée
✅ Applications fonctionnelles

## 📞 Support

En cas de problème :

1. Restaurer depuis la sauvegarde : `cp -r ../idem-backup/* .`
2. Consulter `SECURITE_CORRIGEE.md`
3. Consulter `ACTIONS_IMMEDIATES.md`
4. Vérifier les logs Git : `git reflog`

## 📚 Documentation Associée

- `SECURITE_CORRIGEE.md` - Résumé des corrections
- `ACTIONS_IMMEDIATES.md` - Actions urgentes
- `SECURITY_FIX_GUIDE.md` - Guide complet
- `ENV_SETUP_README.md` - Utilisation quotidienne
- `scripts/clean-environments-from-git.sh` - Script automatique

---

**⏰ Temps estimé : 15-30 minutes**

**⚠️ Priorité : HAUTE - À faire avant le prochain push**
