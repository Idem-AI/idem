# Guide - Fichiers i18n Séparés

## 📁 Structure des Fichiers

Les traductions sont maintenant organisées en fichiers séparés pour une meilleure maintenabilité:

```
src/locale/
├── messages.json (généré automatiquement - NE PAS ÉDITER)
├── messages.fr.json (généré automatiquement - NE PAS ÉDITER)
├── en/
│   ├── common.json (601 clés) - Header, Footer, Navigation
│   ├── pages.json (785 clés) - Toutes les pages publiques
│   ├── privacy.json (115 clés) - Privacy Policy
│   ├── beta.json (99 clés) - Beta Policy
│   └── terms.json (130 clés) - Terms of Service
└── fr/
    ├── common.json (601 clés) - À traduire
    ├── pages.json (785 clés) - À traduire
    ├── privacy.json (115 clés) - À traduire
    ├── beta.json (99 clés) - À traduire
    └── terms.json (130 clés) - À traduire
```

## 🔄 Workflow Complet

### 1. Extraction des Traductions (Après modification du code)

```bash
npm run i18n:workflow
```

Cette commande:

1. Extrait toutes les traductions depuis le code TypeScript/HTML
2. Génère `messages.json`
3. Divise automatiquement en fichiers séparés dans `en/` et `fr/`

**OU** étape par étape:

```bash
# Extraire les traductions
npm run i18n:extract:json

# Diviser en fichiers séparés
npm run i18n:split
```

### 2. Traduction des Fichiers Français

Ouvrez les fichiers dans `src/locale/fr/` et traduisez:

**Exemple - `fr/privacy.json`:**

```json
{
  "locale": "fr",
  "translations": {
    "privacy.title": "IDEM Légal",
    "privacy.subtitle": "Les informations fournies ici sont destinées...",
    "privacy.nav.about": "1. À PROPOS",
    "privacy.about.title": "1. À PROPOS",
    "privacy.about.content": "IDEM, Inc. et ses filiales..."
  }
}
```

**Fichiers à traduire par priorité:**

1. **`common.json`** (601 clés) - PRIORITÉ HAUTE
   - Header, Footer, Navigation
   - Éléments visibles sur toutes les pages

2. **`pages.json`** (785 clés) - PRIORITÉ MOYENNE
   - Home, About, Pricing, Solutions
   - Architecture, Deployment, Open Source
   - African Market, Premium Beta Access

3. **`privacy.json`** (115 clés) - PRIORITÉ BASSE
   - Privacy Policy complète

4. **`beta.json`** (99 clés) - PRIORITÉ BASSE
   - Beta Policy complète

5. **`terms.json`** (130 clés) - PRIORITÉ BASSE
   - Terms of Service complets

### 3. Fusion et Build

Avant de builder, fusionnez les fichiers séparés:

```bash
# Fusionner tous les fichiers en messages.json et messages.fr.json
npm run i18n:merge

# Builder toutes les locales
npm run build:all-locales
```

## 🛠️ Scripts Disponibles

| Script                      | Description                              |
| --------------------------- | ---------------------------------------- |
| `npm run i18n:extract:json` | Extrait les traductions du code          |
| `npm run i18n:split`        | Divise messages.json en fichiers séparés |
| `npm run i18n:merge`        | Fusionne les fichiers séparés            |
| `npm run i18n:workflow`     | Extract + Split (workflow complet)       |
| `npm run build:all-locales` | Merge + Build EN + Build FR              |

## 📝 Règles Importantes

### ✅ À FAIRE

1. **Toujours éditer les fichiers dans `en/` et `fr/`**
   - `src/locale/en/common.json`
   - `src/locale/fr/privacy.json`
   - etc.

2. **Exécuter `i18n:merge` avant de builder**

   ```bash
   npm run i18n:merge
   npm run build:all-locales
   ```

3. **Utiliser `i18n:workflow` après modification du code**
   ```bash
   npm run i18n:workflow
   ```

### ❌ À NE PAS FAIRE

1. **NE JAMAIS éditer directement:**
   - `src/locale/messages.json`
   - `src/locale/messages.fr.json`

   Ces fichiers sont générés automatiquement!

2. **NE PAS oublier de merger avant de builder**
   - Sinon les traductions ne seront pas à jour

## 🎯 Cas d'Usage

### Ajouter une nouvelle traduction

1. Ajouter `$localize` dans le code:

   ```typescript
   protected title = $localize`:@@mypage.title:My Title`;
   ```

2. Extraire et diviser:

   ```bash
   npm run i18n:workflow
   ```

3. Traduire dans `fr/` correspondant

4. Merger et builder:
   ```bash
   npm run build:all-locales
   ```

### Modifier une traduction existante

1. Trouver le fichier approprié dans `en/` ou `fr/`
2. Modifier la traduction
3. Merger et builder:
   ```bash
   npm run build:all-locales
   ```

### Traduire un nouveau fichier complet

1. Ouvrir `fr/privacy.json` (par exemple)
2. Traduire toutes les clés
3. Sauvegarder
4. Merger et builder:
   ```bash
   npm run build:all-locales
   ```

## 📊 Statistiques

| Fichier      | Clés     | Description                |
| ------------ | -------- | -------------------------- |
| common.json  | 601      | Navigation, Header, Footer |
| pages.json   | 785      | Toutes les pages publiques |
| privacy.json | 115      | Privacy Policy             |
| beta.json    | 99       | Beta Policy                |
| terms.json   | 130      | Terms of Service           |
| **TOTAL**    | **1730** | **Toutes les traductions** |

## 🔍 Vérification

Pour vérifier que tout fonctionne:

```bash
# Développement en français
npm run start:fr

# Développement en anglais
npm run start:en

# Build production
npm run build:all-locales
```

## 🚀 Workflow Recommandé pour la Traduction

### Phase 1: Common (Priorité Haute)

```bash
# Traduire src/locale/fr/common.json
# Tester
npm run i18n:merge && npm run start:fr
```

### Phase 2: Pages (Priorité Moyenne)

```bash
# Traduire src/locale/fr/pages.json
# Tester
npm run i18n:merge && npm run start:fr
```

### Phase 3: Documents Légaux (Priorité Basse)

```bash
# Traduire src/locale/fr/privacy.json
# Traduire src/locale/fr/beta.json
# Traduire src/locale/fr/terms.json
# Tester
npm run i18n:merge && npm run start:fr
```

## 💡 Astuces

1. **Traduction progressive**: Vous pouvez traduire fichier par fichier
2. **Recherche rapide**: Utilisez Ctrl+F pour trouver une clé spécifique
3. **Validation**: Les clés vides dans `fr/` seront affichées en anglais
4. **Organisation**: Un fichier = un domaine = plus facile à maintenir

## 🐛 Dépannage

### Les traductions ne s'affichent pas

```bash
# 1. Vérifier que les fichiers fr/ sont bien traduits
# 2. Fusionner les fichiers
npm run i18n:merge

# 3. Vérifier que messages.fr.json est généré
ls -la src/locale/messages.fr.json

# 4. Rebuild
npm run build:all-locales
```

### Nouvelles clés manquantes après extraction

```bash
# 1. Extraire et diviser
npm run i18n:workflow

# 2. Les nouvelles clés apparaissent dans en/ et fr/
# 3. Traduire les nouvelles clés dans fr/
# 4. Merger et builder
npm run build:all-locales
```

## 📚 Ressources

- [Angular Localize Documentation](https://angular.io/guide/i18n-overview)
- [Guide i18n Complet](./I18N_GUIDE.md)
- [Exemples de Migration](./I18N_EXAMPLES.md)
