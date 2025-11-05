# Scripts de Traduction

Ce dossier contient les scripts pour gérer les fichiers de traduction de l'application main-dashboard.

## 📜 Scripts disponibles

### `split-i18n.js`

Divise les fichiers de traduction monolithiques (`en.json`, `fr.json`) en plusieurs fichiers organisés par composant.

**Usage :**

```bash
node scripts/split-i18n.js
# ou
npm run i18n:split
```

**Entrée :**

- `public/assets/i18n/en.json`
- `public/assets/i18n/fr.json`

**Sortie :**

- `public/assets/i18n/split/` (dossier avec tous les fichiers divisés)
- `public/assets/i18n/split/index.en.json` (index des composants)
- `public/assets/i18n/split/index.fr.json` (index des composants)

**Exemple de sortie :**

```
📦 Traitement de la langue: en
  ✅ shared/common/en.json
  ✅ shared/validation/en.json
  ✅ modules/dashboard/components/sidebar-dashboard/en.json
  ...
✨ 35 fichiers créés pour en
```

### `merge-i18n.js`

Fusionne tous les fichiers de traduction divisés en un seul fichier par langue.

**Usage :**

```bash
node scripts/merge-i18n.js
# ou
npm run i18n:merge
```

**Entrée :**

- `public/assets/i18n/split/` (tous les fichiers divisés)

**Sortie :**

- `public/assets/i18n/en.json` (fichier fusionné)
- `public/assets/i18n/fr.json` (fichier fusionné)

**Exemple de sortie :**

```
📦 Fusion de la langue: en
  📄 35 fichiers trouvés
  ✅ shared/common → common
  ✅ shared/validation → validation
  ✅ modules/dashboard/components/sidebar-dashboard → dashboard.sidebar
  ...
✨ Fichier fusionné créé: en.json
```

## 🚀 Commandes npm

```bash
# Diviser les fichiers
npm run i18n:split

# Fusionner les fichiers
npm run i18n:merge

# Diviser puis fusionner (pour tester)
npm run i18n:split-merge
```

## 📖 Workflow

### Développement avec fichiers divisés

```bash
# 1. Diviser les fichiers au début
npm run i18n:split

# 2. Modifier les fichiers dans public/assets/i18n/split/
# Exemple : éditer modules/dashboard/components/sidebar-dashboard/en.json

# 3. Fusionner avant le commit
npm run i18n:merge

# 4. Commit
git add public/assets/i18n/*.json
git commit -m "feat: update translations"
```

### Développement avec fichiers monolithiques

```bash
# 1. Modifier directement en.json et fr.json
# Éditer : public/assets/i18n/en.json

# 2. (Optionnel) Diviser pour l'organisation
npm run i18n:split

# 3. Commit
git add public/assets/i18n/*.json
git commit -m "feat: update translations"
```

## 🗺️ Mapping des composants

Le mapping entre les clés JSON et les chemins de fichiers est défini dans les deux scripts :

**`split-i18n.js` - componentMapping :**

```javascript
{
  'common': 'shared/common',
  'dashboard.sidebar': 'modules/dashboard/components/sidebar-dashboard',
  'dashboard.createProject': 'modules/dashboard/pages/create-project',
  // ...
}
```

**`merge-i18n.js` - pathToKeyMapping :**

```javascript
{
  'shared/common': 'common',
  'modules/dashboard/components/sidebar-dashboard': 'dashboard.sidebar',
  'modules/dashboard/pages/create-project': 'dashboard.createProject',
  // ...
}
```

## ➕ Ajouter un nouveau composant

1. **Créer le composant Angular**

2. **Ajouter les traductions dans `en.json` et `fr.json` :**

```json
{
  "dashboard": {
    "newComponent": {
      "title": "New Component",
      "description": "Description"
    }
  }
}
```

3. **Mettre à jour le mapping dans les deux scripts :**

Dans `split-i18n.js` :

```javascript
componentMapping: {
  // ...
  'dashboard.newComponent': 'modules/dashboard/components/new-component',
}
```

Dans `merge-i18n.js` :

```javascript
pathToKeyMapping: {
  // ...
  'modules/dashboard/components/new-component': 'dashboard.newComponent',
}
```

4. **Diviser les fichiers :**

```bash
npm run i18n:split
```

## 🔍 Structure des fichiers générés

```
public/assets/i18n/split/
├── shared/
│   ├── common/
│   │   ├── en.json          # Traductions communes (save, cancel, etc.)
│   │   └── fr.json
│   ├── validation/
│   │   ├── en.json          # Messages de validation
│   │   └── fr.json
│   ├── navigation/
│   │   ├── en.json          # Navigation (dashboard, projects, etc.)
│   │   └── fr.json
│   └── errors/
│       ├── en.json          # Messages d'erreur
│       └── fr.json
├── modules/
│   ├── projects/
│   │   ├── en.json          # Module projets
│   │   └── fr.json
│   ├── teams/
│   │   ├── en.json          # Module équipes
│   │   └── fr.json
│   └── dashboard/
│       ├── components/      # Composants du dashboard
│       │   ├── add-team-member-modal/
│       │   ├── add-team-to-project-modal/
│       │   ├── project-card/
│       │   ├── sidebar-dashboard/
│       │   └── sidebar-global/
│       └── pages/           # Pages du dashboard
│           ├── create-project/
│           │   ├── components/
│           │   │   ├── color-customizer/
│           │   │   ├── color-selection/
│           │   │   ├── logo-editor-chat/
│           │   │   └── ...
│           │   ├── en.json
│           │   └── fr.json
│           ├── create-team/
│           ├── deployment/
│           └── dashboard/
├── index.en.json            # Index de tous les composants (EN)
└── index.fr.json            # Index de tous les composants (FR)
```

## 📝 Conventions

### Nommage des clés

- **camelCase** : `addMember`, `projectHome`
- **Hiérarchie** : `section.subsection.key`
- **Descriptif** : Utiliser des noms explicites

### Organisation

- **shared/** : Traductions communes à toute l'application
- **modules/** : Traductions spécifiques aux modules
- **components/** : Traductions des composants
- **pages/** : Traductions des pages

## 🐛 Dépannage

### Erreur : "Fichier source non trouvé"

Vérifiez que vous êtes dans le bon dossier :

```bash
cd apps/main-dashboard
pwd  # Doit afficher : .../apps/main-dashboard
```

### Erreur : "Dossier split non trouvé"

Exécutez d'abord le script de division :

```bash
npm run i18n:split
```

### Avertissement : "Aucune clé trouvée"

Ajoutez le mapping dans les deux scripts (`split-i18n.js` et `merge-i18n.js`).

## 📚 Documentation complète

Pour plus de détails, consultez [I18N_SPLIT_GUIDE.md](../I18N_SPLIT_GUIDE.md).

## 🤝 Contribution

Pour modifier les scripts :

1. Testez avec `npm run i18n:split-merge`
2. Vérifiez que les fichiers fusionnés sont identiques aux originaux
3. Mettez à jour la documentation si nécessaire

---

**Dernière mise à jour :** Janvier 2025
