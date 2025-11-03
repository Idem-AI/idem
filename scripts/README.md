# Scripts Idem

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
   - `landing-page` - Application publique (port 4201)
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

1. `landing-page` et `main-dashboard` dépendent de :
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
- **Utilisé par :** landing-page, main-dashboard, api

#### @idem/shared-auth-client

- **Localisation :** `packages/shared-auth-client/`
- **Contenu :** Service d'authentification Angular
- **Build :** `tsc` (TypeScript Compiler)
- **Utilisé par :** landing-page, main-dashboard

#### @idem/shared-styles

- **Localisation :** `packages/shared-styles/`
- **Contenu :** Design system (Tailwind CSS, classes glass)
- **Build :** Aucun (CSS pur)
- **Utilisé par :** landing-page, main-dashboard

### 🚀 Applications

#### landing-page

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

### 🔧 Dépannage

#### Erreur "Project idem does not exist"

**Cause :** Cache Angular CLI obsolète

**Solution :**

```bash
# Nettoyer complètement
find . -name "node_modules" -type d -prune -exec rm -rf {} +
find . -name ".angular" -type d -prune -exec rm -rf {} +
find . -name "package-lock.json" -type f -delete
npm cache clean --force

# Réinstaller
./scripts/setup.sh
```

#### Erreur de dépendances manquantes

**Cause :** Packages partagés non buildés

**Solution :**

```bash
# Rebuilder les packages
npm run build:shared
npm run build:shared-auth

# Puis réinstaller les apps
cd apps/landing-page && npm install
cd apps/main-dashboard && npm install
```

#### Erreur de permissions

**Cause :** Certaines commandes utilisent `sudo`

**Solution :**

- Supprimer `sudo` des commandes npm dans le script
- Ou exécuter le script avec les bonnes permissions

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
- `sudo` est utilisé pour certaines installations (peut être supprimé)
- Le script utilise npm workspaces (pas Nx)
- Les couleurs dans le terminal facilitent le suivi
- La vérification finale valide la configuration

### 🎉 Résultat

Après exécution réussie du script :

- ✅ Tous les packages partagés sont buildés
- ✅ Toutes les applications ont leurs dépendances
- ✅ Le workspace est prêt pour le développement
- ✅ Les commandes npm sont disponibles
