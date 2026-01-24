# 📚 Guide des Scripts i18n

## 🎯 Vue d'ensemble

Les scripts i18n permettent de diviser et fusionner les fichiers de traduction pour faciliter la gestion des traductions par composant.

## 📁 Structure des fichiers

```
src/locale/
├── messages.json           # Fichier principal anglais (source)
├── messages.fr.json        # Fichier principal français
├── en/                     # Fichiers divisés anglais
│   ├── components/
│   │   ├── header.json
│   │   ├── footer.json
│   │   └── ...
│   ├── pages/
│   │   ├── home.json
│   │   └── ...
│   ├── shared/
│   │   └── components/
│   └── common.json
└── fr/                     # Fichiers divisés français
    ├── components/
    ├── pages/
    ├── shared/
    └── common.json
```

## 🔧 Scripts disponibles

### 1. `organize-i18n-by-components.js` - Division

**Fonction** : Divise `messages.json` et `messages.fr.json` en fichiers par composant/page.

**Commande** :

```bash
node scripts/organize-i18n-by-components.js
```

**Comportement intelligent** :

#### Pour l'anglais (EN)

- Lit `messages.json`
- Crée les fichiers divisés dans `src/locale/en/`
- Utilise toujours les valeurs de `messages.json`

#### Pour le français (FR)

- **Si `messages.fr.json` existe** :
  - Charge les traductions existantes
  - Préserve toutes les traductions françaises déjà faites
  - Utilise les valeurs anglaises uniquement pour les nouvelles clés
- **Si `messages.fr.json` n'existe pas** :
  - Crée les fichiers avec les valeurs anglaises comme base
  - Permet de commencer la traduction à partir de l'anglais

**Exemple** :

```javascript
// messages.json (anglais)
{
  "locale": "en",
  "translations": {
    "header.nav.home": "Home",
    "header.nav.about": "About"
  }
}

// messages.fr.json (français existant)
{
  "locale": "fr",
  "translations": {
    "header.nav.home": "Accueil"
    // "header.nav.about" n'est pas traduit
  }
}

// Résultat après division dans fr/components/header.json
{
  "locale": "fr",
  "translations": {
    "header.nav.home": "Accueil",      // ✅ Préservé
    "header.nav.about": "About"        // ✅ Valeur anglaise utilisée
  }
}
```

### 2. `merge-i18n-components.js` - Fusion

**Fonction** : Fusionne les fichiers divisés en `messages.json` et `messages.fr.json`.

**Commande** :

```bash
node scripts/merge-i18n-components.js
```

**Comportement** :

- Lit tous les fichiers JSON dans `en/` et `fr/`
- Fusionne les traductions de chaque locale
- Crée/met à jour `messages.json` et `messages.fr.json`
- Affiche des statistiques détaillées

**Output** :

```
🔄 Merging i18n component files...

📝 Merging English (en):
✅ Merged en:
   - 35 files processed
   - 1735 keys merged
   - 1735 total translations

📝 Merging French (fr):
✅ Merged fr:
   - 35 files processed
   - 1735 keys merged
   - 1735 total translations

✅ All locales merged successfully!
```

## 🔄 Workflow recommandé

### Scénario 1 : Première utilisation

```bash
# 1. Diviser les fichiers
node scripts/organize-i18n-by-components.js

# 2. Traduire les fichiers dans src/locale/fr/
# Éditer : fr/components/header.json, fr/pages/home.json, etc.

# 3. Fusionner pour créer messages.fr.json
node scripts/merge-i18n-components.js

# 4. Tester
npm run start:fr
```

### Scénario 2 : Ajout de nouvelles traductions

```bash
# 1. Ajouter les clés dans messages.json (anglais)
# Éditer : src/locale/messages.json

# 2. Diviser (préserve les traductions françaises existantes)
node scripts/organize-i18n-by-components.js

# 3. Traduire uniquement les nouvelles clés dans fr/
# Les anciennes traductions sont préservées !

# 4. Fusionner
node scripts/merge-i18n-components.js
```

### Scénario 3 : Modification de traductions existantes

```bash
# 1. Diviser les fichiers
node scripts/organize-i18n-by-components.js

# 2. Modifier directement dans les fichiers divisés
# Éditer : fr/components/header.json

# 3. Fusionner pour mettre à jour messages.fr.json
node scripts/merge-i18n-components.js
```

## ✅ Avantages de cette approche

### 1. **Préservation des traductions**

- ✅ Les traductions françaises ne sont jamais perdues
- ✅ Pas besoin de re-traduire à chaque division
- ✅ Fusion intelligente des nouvelles clés

### 2. **Organisation par composant**

- ✅ Fichiers plus petits et faciles à gérer
- ✅ Traductions groupées par contexte
- ✅ Facilite le travail en équipe

### 3. **Flexibilité**

- ✅ Possibilité de travailler sur `messages.fr.json` directement
- ✅ Ou de travailler sur les fichiers divisés
- ✅ Les deux approches sont compatibles

## 🎨 Structure des fichiers divisés

### Composants (`components/`)

Fichiers pour les composants réutilisables :

- `header.json` - Navigation, menu
- `footer.json` - Pied de page
- `hero.json` - Section hero
- `features.json` - Fonctionnalités
- etc.

### Pages (`pages/`)

Fichiers pour les pages complètes :

- `home.json` - Page d'accueil
- `about-page.json` - À propos
- `pricing-page.json` - Tarification
- etc.

### Shared (`shared/components/`)

Fichiers pour les composants partagés :

- `privacy-policy.json` - Politique de confidentialité
- `terms-of-service.json` - Conditions d'utilisation
- `beta-policy.json` - Politique beta
- etc.

### Common (`common.json`)

Clés qui ne correspondent à aucun composant spécifique.

## 📝 Format des fichiers

Chaque fichier JSON suit ce format :

```json
{
  "locale": "fr",
  "translations": {
    "component.section.key": "Traduction",
    "component.section.key2": "Autre traduction"
  }
}
```

## 🚨 Points d'attention

### ❌ À éviter

- Ne pas modifier `messages.json` ET les fichiers divisés en même temps
- Ne pas supprimer `messages.fr.json` si vous avez des traductions

### ✅ Bonnes pratiques

- Toujours diviser avant de traduire
- Toujours fusionner après avoir traduit
- Tester avec `npm run start:fr` après fusion
- Commiter `messages.fr.json` ET les fichiers divisés

## 🔍 Dépannage

### Problème : Traductions perdues après division

**Cause** : `messages.fr.json` n'existait pas ou était vide.

**Solution** :

1. Vérifier que `messages.fr.json` existe
2. Vérifier que le fichier contient des traductions
3. Re-diviser avec `node scripts/organize-i18n-by-components.js`

### Problème : Nouvelles clés non traduites

**Cause** : Normal ! Les nouvelles clés utilisent l'anglais par défaut.

**Solution** :

1. Identifier les nouvelles clés (valeur = texte anglais)
2. Traduire dans les fichiers divisés
3. Fusionner avec `node scripts/merge-i18n-components.js`

### Problème : Fichiers divisés et messages.fr.json désynchronisés

**Cause** : Modifications directes dans `messages.fr.json` sans re-division.

**Solution** :

```bash
# Re-diviser pour synchroniser
node scripts/organize-i18n-by-components.js
```

## 📊 Statistiques

Lors de la division, vous verrez :

```
📝 Creating English (en) files:
✅ en/components/header.json (25 keys)
✅ en/pages/home.json (50 keys)
...

📝 Creating French (fr) files:
✅ Loaded 1500 existing French translations
✅ fr/components/header.json (25 keys)
✅ fr/pages/home.json (50 keys)
...
```

Lors de la fusion, vous verrez :

```
📝 Merging French (fr):
✅ Merged fr:
   - 35 files processed
   - 1735 keys merged
   - 1735 total translations
```

## 🎯 Résumé

| Action        | Script                           | Résultat                                        |
| ------------- | -------------------------------- | ----------------------------------------------- |
| **Diviser**   | `organize-i18n-by-components.js` | Crée `en/` et `fr/` avec fichiers par composant |
| **Fusionner** | `merge-i18n-components.js`       | Crée `messages.json` et `messages.fr.json`      |
| **Tester**    | `npm run start:fr`               | Lance l'app en français                         |
| **Build**     | `npm run build:all-locales`      | Build toutes les locales                        |

## 💡 Conseils

1. **Workflow itératif** : Diviser → Traduire → Fusionner → Tester
2. **Traductions partielles** : OK d'avoir des traductions incomplètes (valeurs anglaises par défaut)
3. **Collaboration** : Les fichiers divisés facilitent le travail en équipe
4. **Versioning** : Commiter les deux formats (divisé et fusionné)

---

**Dernière mise à jour** : Novembre 2024
**Version** : 2.0 (avec préservation des traductions)
