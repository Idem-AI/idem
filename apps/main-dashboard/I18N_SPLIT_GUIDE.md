# Guide de Division des Fichiers de Traduction

Ce guide explique comment utiliser les scripts de division et fusion des fichiers de traduction pour le projet main-dashboard.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Structure des fichiers](#structure-des-fichiers)
- [Scripts disponibles](#scripts-disponibles)
- [Utilisation](#utilisation)
- [Workflow recommandé](#workflow-recommandé)
- [Mapping des composants](#mapping-des-composants)
- [Ajout de nouveaux composants](#ajout-de-nouveaux-composants)

## 🎯 Vue d'ensemble

Les fichiers de traduction `en.json` et `fr.json` contiennent toutes les traductions de l'application. Pour faciliter la maintenance et l'organisation, ces scripts permettent de :

1. **Diviser** les fichiers monolithiques en plusieurs fichiers par composant
2. **Fusionner** les fichiers divisés en un seul fichier pour la production

### Avantages de la division

✅ **Organisation** : Chaque composant a son propre fichier de traduction  
✅ **Maintenance** : Plus facile de trouver et modifier les traductions  
✅ **Collaboration** : Moins de conflits Git lors du travail en équipe  
✅ **Arborescence** : Suit la structure des dossiers de l'application

## 📁 Structure des fichiers

### Avant (fichiers monolithiques)

```
public/assets/i18n/
├── en.json (820 lignes)
└── fr.json (820 lignes)
```

### Après (fichiers divisés)

```
public/assets/i18n/split/
├── shared/
│   ├── common/
│   │   ├── en.json
│   │   └── fr.json
│   ├── validation/
│   │   ├── en.json
│   │   └── fr.json
│   ├── navigation/
│   │   ├── en.json
│   │   └── fr.json
│   └── errors/
│       ├── en.json
│       └── fr.json
├── modules/
│   ├── projects/
│   │   ├── en.json
│   │   └── fr.json
│   ├── teams/
│   │   ├── en.json
│   │   └── fr.json
│   └── dashboard/
│       ├── components/
│       │   ├── add-team-member-modal/
│       │   │   ├── en.json
│       │   │   └── fr.json
│       │   ├── add-team-to-project-modal/
│       │   │   ├── en.json
│       │   │   └── fr.json
│       │   ├── project-card/
│       │   │   ├── en.json
│       │   │   └── fr.json
│       │   ├── sidebar-dashboard/
│       │   │   ├── en.json
│       │   │   └── fr.json
│       │   └── sidebar-global/
│       │       ├── en.json
│       │       └── fr.json
│       └── pages/
│           ├── create-project/
│           │   ├── components/
│           │   │   ├── color-customizer/
│           │   │   ├── color-selection/
│           │   │   ├── logo-editor-chat/
│           │   │   ├── logo-preferences/
│           │   │   ├── logo-selection/
│           │   │   ├── logo-variations/
│           │   │   ├── project-description/
│           │   │   ├── project-details/
│           │   │   ├── project-summary/
│           │   │   └── typography-selection/
│           │   ├── en.json
│           │   └── fr.json
│           ├── create-team/
│           ├── deployment/
│           │   └── components/
│           │       ├── ai-assistant/
│           │       ├── expert-deployment/
│           │       ├── mode-selector/
│           │       ├── quick-deployment/
│           │       ├── template-deployment/
│           │       └── terraform-files/
│           └── dashboard/
├── index.en.json
└── index.fr.json
```

## 🛠️ Scripts disponibles

### 1. `split-i18n.js` - Division des fichiers

Divise les fichiers `en.json` et `fr.json` en plusieurs fichiers par composant.

```bash
node scripts/split-i18n.js
```

**Sortie :**

- Crée le dossier `public/assets/i18n/split/`
- Génère un fichier de traduction pour chaque composant
- Crée des fichiers d'index (`index.en.json`, `index.fr.json`)

### 2. `merge-i18n.js` - Fusion des fichiers

Fusionne tous les fichiers divisés en un seul fichier par langue.

```bash
node scripts/merge-i18n.js
```

**Sortie :**

- Lit tous les fichiers dans `public/assets/i18n/split/`
- Génère `public/assets/i18n/en.json` et `fr.json`

## 📖 Utilisation

### Première utilisation

1. **Diviser les fichiers existants :**

```bash
cd apps/main-dashboard
node scripts/split-i18n.js
```

2. **Vérifier les fichiers générés :**

```bash
ls -R public/assets/i18n/split/
```

### Modifier une traduction

1. **Trouver le composant :**

```bash
# Exemple : modifier les traductions du sidebar
cd public/assets/i18n/split/modules/dashboard/components/sidebar-dashboard
```

2. **Éditer le fichier :**

```json
// en.json
{
  "projectHome": "Project Home",
  "teams": "Teams",
  "branding": "Branding"
}
```

3. **Fusionner les modifications :**

```bash
node scripts/merge-i18n.js
```

### Ajouter une nouvelle traduction

1. **Éditer le fichier du composant :**

```json
// public/assets/i18n/split/modules/dashboard/components/sidebar-dashboard/en.json
{
  "projectHome": "Project Home",
  "teams": "Teams",
  "branding": "Branding",
  "newFeature": "New Feature" // ← Nouvelle traduction
}
```

2. **Ajouter la traduction française :**

```json
// public/assets/i18n/split/modules/dashboard/components/sidebar-dashboard/fr.json
{
  "projectHome": "Accueil du projet",
  "teams": "Équipes",
  "branding": "Image de marque",
  "newFeature": "Nouvelle fonctionnalité" // ← Nouvelle traduction
}
```

3. **Fusionner :**

```bash
node scripts/merge-i18n.js
```

## 🔄 Workflow recommandé

### Pour le développement

**Option 1 : Travailler avec les fichiers divisés**

```bash
# 1. Diviser au début du sprint
node scripts/split-i18n.js

# 2. Modifier les fichiers divisés pendant le développement
# Éditer : public/assets/i18n/split/modules/...

# 3. Fusionner avant le commit
node scripts/merge-i18n.js
git add public/assets/i18n/*.json
git commit -m "feat: update translations"
```

**Option 2 : Travailler avec les fichiers monolithiques**

```bash
# 1. Modifier directement en.json et fr.json
# Éditer : public/assets/i18n/en.json

# 2. Diviser après les modifications (optionnel)
node scripts/split-i18n.js

# 3. Commit
git add public/assets/i18n/*.json
git commit -m "feat: update translations"
```

### Pour la production

L'application utilise les fichiers **monolithiques** (`en.json`, `fr.json`).

**Avant le build :**

```bash
# Si vous avez modifié les fichiers divisés
node scripts/merge-i18n.js

# Build
npm run build
```

### Intégration CI/CD

Ajoutez dans votre pipeline :

```yaml
# .github/workflows/build.yml
- name: Merge translations
  run: |
    cd apps/main-dashboard
    node scripts/merge-i18n.js

- name: Build application
  run: npm run build
```

## 🗺️ Mapping des composants

Le mapping entre les clés JSON et les chemins de composants est défini dans `scripts/split-i18n.js` :

```javascript
componentMapping: {
  // Shared
  'common': 'shared/common',
  'validation': 'shared/validation',
  'navigation': 'shared/navigation',
  'errors': 'shared/errors',

  // Modules
  'projects': 'modules/projects',
  'teams': 'modules/teams',

  // Dashboard components
  'dashboard.addMemberModal': 'modules/dashboard/components/add-team-member-modal',
  'dashboard.sidebar': 'modules/dashboard/components/sidebar-dashboard',

  // Dashboard pages
  'dashboard.createProject': 'modules/dashboard/pages/create-project',
  'dashboard.colorSelection': 'modules/dashboard/pages/create-project/components/color-selection',
  // ...
}
```

### Structure des clés

**Format :** `section.subsection.key`

**Exemples :**

- `common.save` → `shared/common/en.json`
- `dashboard.sidebar.teams` → `modules/dashboard/components/sidebar-dashboard/en.json`
- `dashboard.colorSelection.title` → `modules/dashboard/pages/create-project/components/color-selection/en.json`

## ➕ Ajout de nouveaux composants

### 1. Créer le composant

```bash
# Exemple : nouveau composant user-profile
mkdir -p src/app/modules/dashboard/components/user-profile
```

### 2. Ajouter les traductions dans le fichier monolithique

```json
// public/assets/i18n/en.json
{
  "dashboard": {
    "userProfile": {
      "title": "User Profile",
      "edit": "Edit Profile",
      "save": "Save Changes"
    }
  }
}
```

### 3. Mettre à jour le mapping

Éditer `scripts/split-i18n.js` :

```javascript
componentMapping: {
  // ... autres mappings
  'dashboard.userProfile': 'modules/dashboard/components/user-profile',
}
```

Éditer `scripts/merge-i18n.js` :

```javascript
pathToKeyMapping: {
  // ... autres mappings
  'modules/dashboard/components/user-profile': 'dashboard.userProfile',
}
```

### 4. Diviser les fichiers

```bash
node scripts/split-i18n.js
```

Le fichier sera créé automatiquement :

- `public/assets/i18n/split/modules/dashboard/components/user-profile/en.json`
- `public/assets/i18n/split/modules/dashboard/components/user-profile/fr.json`

## 📝 Conventions

### Nommage des clés

- **camelCase** pour les clés : `userProfile`, `addMember`
- **Hiérarchie** : `section.subsection.key`
- **Descriptif** : `dashboard.sidebar.projectHome` (pas `dashboard.sidebar.ph`)

### Organisation des fichiers

- **Shared** : Traductions communes à toute l'application
- **Modules** : Traductions spécifiques à un module
- **Components** : Traductions d'un composant spécifique
- **Pages** : Traductions d'une page complète

### Fichiers d'index

Les fichiers `index.en.json` et `index.fr.json` contiennent la liste de tous les composants :

```json
{
  "language": "en",
  "components": [
    "shared/common",
    "shared/validation",
    "modules/dashboard/components/sidebar-dashboard"
    // ...
  ]
}
```

## 🔍 Dépannage

### Erreur : "Fichier source non trouvé"

```bash
❌ Fichier source non trouvé: public/assets/i18n/en.json
```

**Solution :** Vérifiez que vous êtes dans le bon dossier :

```bash
cd apps/main-dashboard
node scripts/split-i18n.js
```

### Erreur : "Dossier split non trouvé"

```bash
❌ Dossier split non trouvé: public/assets/i18n/split
```

**Solution :** Exécutez d'abord le script de division :

```bash
node scripts/split-i18n.js
```

### Avertissement : "Aucune clé trouvée pour"

```bash
⚠️  Aucune clé trouvée pour: modules/dashboard/components/new-component
```

**Solution :** Ajoutez le mapping dans `scripts/split-i18n.js` et `scripts/merge-i18n.js`.

## 🚀 Scripts npm

Ajoutez ces scripts dans `package.json` :

```json
{
  "scripts": {
    "i18n:split": "node scripts/split-i18n.js",
    "i18n:merge": "node scripts/merge-i18n.js",
    "i18n:split-merge": "npm run i18n:split && npm run i18n:merge"
  }
}
```

**Utilisation :**

```bash
npm run i18n:split        # Diviser les fichiers
npm run i18n:merge        # Fusionner les fichiers
npm run i18n:split-merge  # Diviser puis fusionner (test)
```

## 📚 Ressources

- [ngx-translate Documentation](https://github.com/ngx-translate/core)
- [Angular i18n Guide](https://angular.io/guide/i18n)
- [I18N_GUIDE.md](./I18N_GUIDE.md) - Guide d'internationalisation complet

## 🤝 Contribution

Pour ajouter un nouveau composant au mapping :

1. Créez une issue décrivant le composant
2. Ajoutez le mapping dans les deux scripts
3. Testez avec `npm run i18n:split-merge`
4. Créez une pull request

---

**Dernière mise à jour :** Janvier 2025  
**Version :** 1.0.0  
**Auteur :** Équipe IDEM
