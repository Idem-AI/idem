# Scripts Idem

## 📚 Scripts Disponibles

### Scripts de développement
- **setup.sh** - Configuration automatique du workspace
- **clean-all.sh** - Nettoyage complet du workspace
- **check-packages.sh** - Vérification des package.json

### Scripts de déploiement multi-environnements
- **setup-environments.sh** - Configuration initiale des environnements prod/staging
- **deploy-staging.sh** - Déploiement de l'environnement de staging
- **migrate-to-multi-env.sh** - Migration vers l'architecture multi-environnements

### Scripts de monitoring
- **health-check.sh** - Vérification de santé des services
- **logs.sh** - Consultation centralisée des logs

---

## setup.sh

Script de configuration automatique du workspace Idem.

### 🎯 Fonctionnalités

Le script effectue les opérations suivantes dans l'ordre :

1. **Vérification des prérequis**
   - Node.js >= 18.0.0
   - npm
   - pnpm (installation automatique si absent)

2. **Nettoyage**
   - Suppression de `node_modules/`
   - Suppression de `package-lock.json`

3. **Installation des dépendances workspace**
   - Installation depuis la racine avec `npm install`

4. **📦 Build des packages partagés (PRIORITÉ)**
   - `@idem/shared-models` - Modèles TypeScript partagés
   - `@idem/shared-auth-client` - Client d'authentification partagé
   - `@idem/shared-styles` - Styles partagés (Tailwind CSS)

5. **🚀 Installation des applications**
   - `landing` - Application publique (port 4201)
   - `main-dashboard` - Application dashboard (port 4200)
   - `api` - API backend
   - `chart` - Éditeur de diagrammes
   - `appgen` - Générateur d'applications

6. **Vérification**
   - Validation de la configuration npm workspaces

### 📋 Utilisation

```bash
# Depuis la racine du projet
./scripts/setup.sh

# Ou
bash scripts/setup.sh
```

### 🔄 Ordre d'Installation

**Important :** Les packages partagés sont buildés **AVANT** les applications car :

1. `landing` et `main-dashboard` dépendent de :
   - `@idem/shared-models`
   - `@idem/shared-auth-client`
   - `@idem/shared-styles`

2. Les packages doivent être compilés pour que les applications puissent les importer

3. L'ordre garantit qu'il n'y a pas d'erreurs de dépendances manquantes

### 📦 Packages Partagés

#### @idem/shared-models

- **Localisation :** `packages/shared-models/`
- **Contenu :** Modèles TypeScript, interfaces, types
- **Build :** `tsc` (TypeScript Compiler)
- **Utilisé par :** landing, main-dashboard, api

#### @idem/shared-auth-client

- **Localisation :** `packages/shared-auth-client/`
- **Contenu :** Service d'authentification Angular
- **Build :** `tsc` (TypeScript Compiler)
- **Utilisé par :** landing, main-dashboard

#### @idem/shared-styles

- **Localisation :** `packages/shared-styles/`
- **Contenu :** Design system (Tailwind CSS, classes glass)
- **Build :** Aucun (CSS pur)
- **Utilisé par :** landing, main-dashboard

### 🚀 Applications

#### landing

- **Port :** 4201
- **SSR :** Activé
- **i18n :** @angular/localize
- **Commande :** `npm run dev:landing`

#### main-dashboard

- **Port :** 4200
- **SSR :** Désactivé
- **i18n :** ngx-translate
- **Commande :** `npm run dev:dashboard`

### ⚙️ Commandes Disponibles

Après l'installation, vous pouvez utiliser :

```bash
# Développement
npm run dev:landing      # Landing page (port 4201)
npm run dev:dashboard    # Dashboard (port 4200)
npm run dev:chart        # Chart editor
npm run dev:appgen       # App generator
npm run dev:api          # API backend

# Build
npm run build:all        # Build tout
npm run build:landing    # Build landing page
npm run build:dashboard  # Build dashboard

# Build packages
npm run build:shared     # Build @idem/shared-models
npm run build:shared-auth # Build @idem/shared-auth-client

# Tests et Qualité
npm run test:all         # Tests
npm run lint:all         # Linting
```

---

## clean-all.sh

Script de nettoyage complet du workspace.

### 🧹 Fonctionnalités

- Supprime tous les `node_modules/`
- Supprime tous les `package-lock.json` et `pnpm-lock.yaml`
- Supprime tous les dossiers de build (`dist/`, `.angular/`, `.next/`, etc.)
- Nettoie la racine et tous les packages/apps

### 📋 Utilisation

```bash
./scripts/clean-all.sh
```

**Quand l'utiliser :**

- Avant une réinstallation complète
- Après des erreurs de dépendances
- Pour libérer de l'espace disque
- Avant de changer de branche

---

## check-packages.sh

Script de vérification des fichiers package.json.

### 🔍 Fonctionnalités

- Vérifie la validité JSON de tous les package.json
- Détecte les versions invalides (espaces, vides)
- Vérifie les champs obligatoires (name, version)
- Scanne tous les packages et applications

### 📋 Utilisation

```bash
./scripts/check-packages.sh
```

**Prérequis :** `jq` doit être installé

```bash
# macOS
brew install jq

# Linux
apt-get install jq  # ou yum install jq
```

**Sortie :**

- ✅ Aucun problème trouvé
- ❌ Liste des erreurs avec fichiers concernés

---

## TROUBLESHOOTING.md

Guide de dépannage complet avec solutions détaillées.

### 📖 Contenu

1. **"npm error Invalid Version"**
   - Cause et solution
   - Correction manuelle

2. **Dépendances des packages partagés non trouvées**
   - Ordre d'installation correct
   - Commandes de rebuild

3. **Erreurs lors de npm install**
   - Nettoyage des caches
   - Options --legacy-peer-deps

4. **pnpm vs npm**
   - Applications par gestionnaire
   - Installation de pnpm

5. **Permissions refusées**
   - Correction des permissions
   - Éviter sudo

6. **Builds échouent**
   - Par package (shared-models, shared-auth-client, shared-styles)
   - Par application (Angular, Svelte, Next.js, Vite)

7. **Commandes utiles**
   - Vérification
   - Nettoyage
   - Build
   - Développement

8. **Workflow recommandé**
   - Installation initiale
   - Après modification d'un package
   - Avant de commit

### 📋 Utilisation

```bash
# Lire le guide
cat scripts/TROUBLESHOOTING.md

# Ou ouvrir dans un éditeur
code scripts/TROUBLESHOOTING.md
```

---

## 🔧 Dépannage Rapide

### Problème : "npm error Invalid Version"

```bash
./scripts/check-packages.sh  # Identifier le problème
./scripts/clean-all.sh       # Nettoyer
./scripts/setup.sh           # Réinstaller
```

### Problème : Dépendances manquantes

```bash
npm run build:shared
npm run build:shared-auth
cd apps/landing && npm install
```

### Problème : Tout est cassé

```bash
./scripts/clean-all.sh
./scripts/setup.sh
```

**Pour plus de détails, consultez `scripts/TROUBLESHOOTING.md`**

### 📚 Documentation Associée

- `README.md` - Documentation principale
- `documentation/NPM_WORKSPACES_GUIDE.md` - Guide npm workspaces
- `MIGRATION_NX_TO_NPM_WORKSPACES.md` - Migration depuis Nx
- `apps/AUTH_SYNC_GUIDE.md` - Synchronisation auth entre apps
- `apps/CLEANUP_SUMMARY.md` - Résumé du nettoyage

### 🎯 Workflow Recommandé

1. **Première installation :**

   ```bash
   ./scripts/setup.sh
   ```

2. **Développement quotidien :**

   ```bash
   # Terminal 1 - Landing page
   npm run dev:landing

   # Terminal 2 - Dashboard
   npm run dev:dashboard
   ```

3. **Après modification des packages :**

   ```bash
   npm run build:shared
   npm run build:shared-auth
   ```

4. **Avant un commit :**
   ```bash
   npm run lint:all
   npm run test:all
   ```

### ⚡ Optimisations

Le script est optimisé pour :

- ✅ Installer les dépendances dans le bon ordre
- ✅ Éviter les erreurs de dépendances circulaires
- ✅ Minimiser le temps d'installation
- ✅ Vérifier les prérequis avant de commencer
- ✅ Fournir des messages clairs et colorés

### 🔄 Mise à Jour du Script

Pour mettre à jour le script après ajout d'une nouvelle application :

1. Ajouter la section dans la partie "Installing application dependencies"
2. Suivre le pattern existant
3. Mettre à jour la liste des commandes disponibles
4. Tester le script complet

### 📝 Notes

- Les packages sont buildés **avant** les apps (ordre critique)
- ❌ `sudo` a été supprimé (pas nécessaire)
- Le script utilise npm workspaces (pas Nx)
- Les couleurs dans le terminal facilitent le suivi
- La vérification finale valide la configuration
- Utilise npm pour Angular/Node.js, pnpm pour Svelte/Next.js/Vite

### 🎉 Résultat

Après exécution réussie du script :

- ✅ Tous les packages partagés sont buildés
- ✅ Toutes les applications ont leurs dépendances
- ✅ Le workspace est prêt pour le développement
- ✅ Les commandes npm sont disponibles
