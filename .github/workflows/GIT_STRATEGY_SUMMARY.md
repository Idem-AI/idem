# Stratégie Git pour les Déploiements - Résumé

**Date:** 2025-11-12  
**Stratégie:** Réinitialisation souple (préserve les fichiers locaux)

---

## 🎯 Commandes Utilisées

```bash
cd /root/idem
git fetch origin
git reset --hard origin/main    # ✅ Reset UNIQUEMENT les fichiers trackés
git checkout main
git pull origin main
```

---

## ✅ Ce qui est PRÉSERVÉ

Tous les fichiers **non trackés** par Git sont gardés :

| Type de Fichier | Exemple | Status |
|----------------|---------|--------|
| Certificats SSL | `*.pem`, `*.crt`, `*.key` | ✅ GARDÉ |
| Configs locales | `.env.local`, `config.local.js` | ✅ GARDÉ |
| Scripts personnels | `backup.sh`, `deploy.sh` | ✅ GARDÉ |
| Logs | `*.log`, `logs/*` | ✅ GARDÉ |
| Données utilisateur | `uploads/*`, `storage/*` | ✅ GARDÉ |
| Cache | `.cache/*`, `tmp/*` | ✅ GARDÉ |
| Fichiers build locaux | `dist.local/*` | ✅ GARDÉ |

---

## ⚠️ Ce qui est RÉINITIALISÉ

Tous les fichiers **trackés** par Git sont écrasés :

| Type de Fichier | Exemple | Status |
|----------------|---------|--------|
| Code source modifié | `*.ts`, `*.js`, `*.html` | ⚠️ ÉCRASÉ |
| Configs versionnées | `docker-compose.yml` | ⚠️ ÉCRASÉ |
| Fichiers de build | `tsconfig.json`, `package.json` | ⚠️ ÉCRASÉ |
| Fichiers supprimés | `scripts/old-script.sh` | ⚠️ RESTAURÉ |

---

## 🔄 Comparaison des Approches

### Approche 1 : Stricte (❌ Non utilisée)

```bash
git reset --hard HEAD
git clean -fd              # ❌ SUPPRIME les fichiers non trackés
```

**Problème :** Supprime TOUS les fichiers locaux (certificats, configs, etc.)

### Approche 2 : Souple (✅ UTILISÉE)

```bash
git reset --hard origin/main    # ✅ Reset UNIQUEMENT les trackés
# Pas de git clean             # ✅ GARDE les fichiers non trackés
```

**Avantage :** Préserve les fichiers locaux importants

---

## 📋 Exemples Concrets

### Exemple 1 : Certificats SSL

```bash
# Sur le serveur, vous avez :
/root/idem/
├── ssl/
│   ├── cert.pem           # ✅ NON tracké → GARDÉ
│   └── key.pem            # ✅ NON tracké → GARDÉ
└── docker-compose.yml     # ⚠️ Tracké → ÉCRASÉ si modifié
```

**Résultat après déploiement :**
- `ssl/cert.pem` → ✅ Toujours présent
- `ssl/key.pem` → ✅ Toujours présent  
- `docker-compose.yml` → ⚠️ Version de GitHub

### Exemple 2 : Configuration locale

```bash
# Sur le serveur, vous avez :
/root/idem/
├── .env.local             # ✅ NON tracké → GARDÉ
├── backup.sh              # ✅ NON tracké → GARDÉ
└── apps/api/src/config.ts # ⚠️ Tracké → ÉCRASÉ si modifié
```

**Résultat après déploiement :**
- `.env.local` → ✅ Toujours présent
- `backup.sh` → ✅ Toujours présent
- `config.ts` → ⚠️ Version de GitHub

### Exemple 3 : Modifications temporaires

```bash
# Vous modifiez temporairement sur le serveur :
vim docker-compose.yml      # ⚠️ Tracké
vim deploy-local.sh         # ✅ NON tracké
```

**Résultat après déploiement :**
- `docker-compose.yml` → ⚠️ ÉCRASÉ (version GitHub)
- `deploy-local.sh` → ✅ GARDÉ (vos modifications préservées)

---

## 🛡️ Bonnes Pratiques

### ✅ À FAIRE

1. **Fichiers locaux** → Garder HORS de Git
   ```bash
   # Ajouter à .gitignore
   echo "*.local.*" >> .gitignore
   echo "ssl/" >> .gitignore
   echo "backup.sh" >> .gitignore
   ```

2. **Configs spécifiques serveur** → Nommer différemment
   ```bash
   # ❌ PAS BON
   config.js              # Tracké par Git

   # ✅ BON
   config.local.js        # Non tracké
   ```

3. **Scripts personnels** → Stocker ailleurs
   ```bash
   # Option 1: Dossier séparé
   /root/scripts/backup.sh

   # Option 2: Dans le repo mais gitignored
   /root/idem/local-scripts/  # Ajouté à .gitignore
   ```

### ❌ À NE PAS FAIRE

1. ❌ Modifier le code source directement sur le serveur
2. ❌ Modifier `docker-compose.yml` sans commit
3. ❌ Supprimer des fichiers trackés sans commit
4. ❌ S'attendre à garder des modifications de fichiers versionnés

---

## 🚀 Workflow Recommandé

### Pour Modifier du Code

```bash
# 1. En local
git checkout -b feature/ma-modification
vim apps/api/src/config.ts
git commit -am "Update config"
git push origin feature/ma-modification

# 2. Sur GitHub
# Créer une PR et merger

# 3. Le serveur se met à jour automatiquement
# ou déclencher manuellement le workflow
```

### Pour Ajouter des Fichiers Locaux

```bash
# Sur le serveur
ssh root@SERVER_HOST
cd /root/idem

# Créer votre fichier
vim backup.sh
chmod +x backup.sh

# S'assurer qu'il n'est PAS tracté
git status  # Ne devrait PAS apparaître

# Si il apparaît, ajouter à .gitignore
echo "backup.sh" >> .gitignore
```

---

## 📊 Matrice de Décision

| Scénario | Fichier Tracké ? | Sera Écrasé ? | Action |
|----------|------------------|---------------|--------|
| Certificat SSL ajouté | Non | ❌ Non | ✅ Garder sur serveur |
| Script backup personnel | Non | ❌ Non | ✅ Garder sur serveur |
| .env.local créé | Non | ❌ Non | ✅ Garder sur serveur |
| docker-compose.yml modifié | Oui | ✅ Oui | ⚠️ Commit ou perdre |
| config.ts modifié | Oui | ✅ Oui | ⚠️ Commit ou perdre |
| Fichier supprimé dans Git | Oui | ✅ Oui | ⚠️ Sera restauré |

---

## ✅ Résumé

**Stratégie actuelle :**
```bash
git reset --hard origin/$BRANCH
# Pas de git clean -fd
```

**Résultat :**
- ✅ Fichiers **versionnés** → Version de GitHub
- ✅ Fichiers **non versionnés** → Préservés
- ✅ Équilibre entre stabilité et flexibilité

**Cette approche permet :**
1. De garder vos certificats SSL
2. De garder vos configs locales
3. De garder vos scripts personnels
4. Tout en garantissant que le code source est à jour

**🎯 C'est la meilleure approche pour un environnement de production !**
