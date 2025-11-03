# 🚀 Quick Start - Internationalisation

Guide rapide pour commencer à utiliser l'i18n sur la landing page.

## ⚡ En 5 minutes

### 1. Marquer un texte

```html
<!-- Avant -->
<h1>Welcome to IDEM</h1>

<!-- Après -->
<h1 i18n="@@home.hero.title">Welcome to IDEM</h1>
```

### 2. Extraire

```bash
npm run i18n:extract:json
```

### 3. Traduire

Ouvrir `src/locale/messages.fr.json` :

```json
{
  "locale": "fr",
  "translations": {
    "home.hero.title": "Bienvenue sur IDEM"
  }
}
```

### 4. Tester

```bash
npm run start:fr
```

### 5. Voir le résultat

Ouvrir http://localhost:4201 → Le titre est maintenant en français !

## 📚 Documentation complète

- **[I18N_README.md](./I18N_README.md)** - Documentation principale
- **[I18N_GUIDE.md](./I18N_GUIDE.md)** - Guide technique complet
- **[I18N_EXAMPLES.md](./I18N_EXAMPLES.md)** - Exemples concrets
- **[I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md)** - Plan de migration
- **[I18N_SETUP_COMPLETE.md](./I18N_SETUP_COMPLETE.md)** - État de la configuration

## 🎯 Syntaxe essentielle

### Texte simple

```html
<p i18n="@@section.element">Text</p>
```

### Attributs

```html
<img i18n-alt="@@logo.alt" alt="Logo" />
<input i18n-placeholder="@@input.placeholder" placeholder="Email" />
```

### Variables

```html
<p i18n="@@welcome">Hello, {{name}}!</p>
```

### Pluriels

```html
<span i18n="@@count"> {count, plural, =0 {No items} =1 {One item} other {{{count}} items}} </span>
```

### Dans TypeScript

```typescript
title = $localize`:@@page.title:Page Title`;
```

## 🔧 Commandes

```bash
# Développement
npm run start:fr        # Français
npm run start:en        # Anglais

# Extraction
npm run i18n:extract:json

# Build
npm run build:fr        # Build français
npm run build:en        # Build anglais
npm run build:all-locales  # Build toutes les locales

# Vérification
./scripts/check-i18n.sh
```

## 💡 Convention de nommage

```
page.section.element
```

Exemples :

- `home.hero.title`
- `about.mission.description`
- `navigation.home`
- `footer.copyright`

## ✅ Checklist par composant

- [ ] Marquer tous les textes avec `i18n="@@id"`
- [ ] Marquer tous les attributs avec `i18n-attribute`
- [ ] Extraire : `npm run i18n:extract:json`
- [ ] Traduire dans `messages.fr.json`
- [ ] Tester en FR : `npm run start:fr`
- [ ] Tester en EN : `npm run start:en`

## 🎓 Apprendre plus

1. Lire [I18N_README.md](./I18N_README.md) pour la vue d'ensemble
2. Consulter [I18N_EXAMPLES.md](./I18N_EXAMPLES.md) pour des exemples
3. Suivre [I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md) pour la migration

## 🆘 Problèmes courants

### Texte non traduit

- Vérifier que l'ID existe dans `messages.fr.json`
- Vérifier l'orthographe de l'ID
- Relancer le serveur

### Erreur d'extraction

```bash
# Vérifier la syntaxe i18n
npm run i18n:extract:json
```

### Build échoue

```bash
# Vérifier que toutes les traductions sont présentes
cat src/locale/messages.fr.json
```

## 🚀 Commencer maintenant

```bash
# 1. Choisir un composant simple (ex: Footer)
# 2. Éditer le template HTML
# 3. Ajouter i18n="@@id" sur chaque texte
# 4. Extraire
npm run i18n:extract:json

# 5. Traduire
code src/locale/messages.fr.json

# 6. Tester
npm run start:fr
```

Bon courage ! 🎉
