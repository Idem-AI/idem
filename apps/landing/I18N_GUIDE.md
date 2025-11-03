# Guide d'Internationalisation avec @angular/localize

## 📋 Vue d'ensemble

Ce guide explique comment utiliser `@angular/localize` pour gérer l'internationalisation (i18n) de la landing page avec des fichiers de traduction au format **JSON**.

## 🎯 Configuration

### Locales supportées

- **en** (Anglais) - Langue source par défaut
- **fr** (Français) - Traduction

### Format des fichiers

- Format : **JSON** (simple et lisible)
- Emplacement : `src/locale/`
- Fichiers :
  - `messages.fr.json` - Traductions françaises

## 🚀 Scripts npm disponibles

```bash
# Extraire les messages i18n au format JSON
npm run i18n:extract:json

# Développement en français
npm run start:fr

# Développement en anglais
npm run start:en

# Build production français
npm run build:fr

# Build production anglais
npm run build:en

# Build toutes les locales
npm run build:all-locales
```

## 📝 Syntaxe i18n dans les templates

### 1. Texte simple

```html
<!-- Avant -->
<h1>Welcome to IDEM</h1>

<!-- Après -->
<h1 i18n="@@home.hero.title">Welcome to IDEM</h1>
```

### 2. Texte avec description et signification

```html
<button i18n="Button to start free trial|Call to action@@cta.start.trial">Start Free Trial</button>
```

Format : `meaning|description@@id`

### 3. Attributs

```html
<img src="logo.png" i18n-alt="Logo alt text@@logo.alt" alt="IDEM Logo" />

<button i18n-title="Tooltip for help button@@help.tooltip" title="Get help">Help</button>
```

### 4. Pluriels

```html
<span i18n="@@users.count">
  {count, plural, =0 {No users} =1 {One user} other {{{count}} users} }
</span>
```

### 5. Variables

```html
<p i18n="@@welcome.message">Welcome, {{userName}}!</p>
```

### 6. Select (conditions)

```html
<span i18n="@@user.gender">
  {gender, select, male {He} female {She} other {They} } will receive an email.
</span>
```

## 🔧 Workflow de traduction

### Étape 1 : Marquer les textes dans les templates

Ajoutez l'attribut `i18n` avec un ID unique :

```html
<h1 i18n="@@about.title">About IDEM</h1>
<p i18n="@@about.description">Africa's first sovereign AI platform</p>
```

### Étape 2 : Extraire les messages

```bash
npm run i18n:extract:json
```

Cela génère/met à jour `src/locale/messages.json` avec tous les textes marqués.

### Étape 3 : Traduire

Ouvrez `src/locale/messages.fr.json` et ajoutez les traductions :

```json
{
  "locale": "fr",
  "translations": {
    "about.title": "À propos d'IDEM",
    "about.description": "La première plateforme d'IA souveraine d'Afrique"
  }
}
```

### Étape 4 : Tester

```bash
# Tester en français
npm run start:fr

# Tester en anglais
npm run start:en
```

### Étape 5 : Build production

```bash
# Build toutes les locales
npm run build:all-locales
```

Les builds seront dans :

- `dist/landing/browser/en/` - Version anglaise
- `dist/landing/browser/fr/` - Version française

## 📁 Structure des fichiers JSON

### Format du fichier de traduction

```json
{
  "locale": "fr",
  "translations": {
    "home.hero.title": "Bienvenue sur IDEM",
    "home.hero.subtitle": "La plateforme d'IA pour l'Afrique",
    "navigation.home": "Accueil",
    "navigation.about": "À propos",
    "navigation.pricing": "Tarifs",
    "cta.start.trial": "Commencer l'essai gratuit",
    "footer.copyright": "© 2024 IDEM. Tous droits réservés."
  }
}
```

## 🎨 Conventions de nommage des IDs

Utilisez une structure hiérarchique avec des points :

```
section.component.element
```

Exemples :

- `home.hero.title`
- `home.hero.subtitle`
- `home.features.title`
- `about.mission.title`
- `pricing.plan.basic.name`
- `navigation.home`
- `footer.copyright`

## 💡 Bonnes pratiques

### 1. Toujours utiliser des IDs uniques

```html
<!-- ✅ BON -->
<h1 i18n="@@home.hero.title">Welcome</h1>

<!-- ❌ MAUVAIS (pas d'ID) -->
<h1 i18n>Welcome</h1>
```

### 2. Descriptions claires

```html
<!-- ✅ BON -->
<button i18n="Primary call to action button@@cta.signup">Sign Up</button>

<!-- ❌ MAUVAIS (pas de description) -->
<button i18n="@@cta.signup">Sign Up</button>
```

### 3. Grouper les traductions par page/section

```json
{
  "locale": "fr",
  "translations": {
    "home.hero.title": "...",
    "home.hero.subtitle": "...",
    "home.features.title": "...",
    "about.mission.title": "...",
    "about.team.title": "..."
  }
}
```

### 4. Ne pas traduire les noms propres

```html
<!-- ✅ BON -->
<h1 i18n="@@company.name">IDEM</h1>
<!-- Le nom reste "IDEM" dans toutes les langues -->

<!-- ✅ BON -->
<p i18n="@@location.country">Cameroon 🇨🇲</p>
<!-- Le nom du pays peut être traduit -->
```

### 5. Utiliser $localize pour les traductions dans le code TypeScript

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-example',
  template: '...',
})
export class ExampleComponent {
  // Traduction simple
  message = $localize`:@@welcome.message:Welcome to IDEM`;

  // Avec variable
  userName = 'John';
  greeting = $localize`:@@greeting:Hello, ${this.userName}!`;

  // Dans une méthode
  showAlert() {
    alert($localize`:@@alert.success:Operation successful!`);
  }
}
```

## 🔍 Débogage

### Vérifier les messages extraits

Après `npm run i18n:extract:json`, vérifiez `src/locale/messages.json` pour voir tous les messages extraits.

### Tester une locale spécifique

```bash
# Servir en français
npm run start:fr

# Servir en anglais
npm run start:en
```

### Messages manquants

Si une traduction manque dans `messages.fr.json`, le texte anglais (source) sera affiché.

## 📦 Déploiement

### Structure de déploiement

```
dist/landing/
├── browser/
│   ├── en/           # Version anglaise
│   │   ├── index.html
│   │   └── ...
│   └── fr/           # Version française
│       ├── index.html
│       └── ...
└── server/
    └── server.mjs    # Serveur SSR
```

### Configuration du serveur

Configurez votre serveur pour servir la bonne locale selon l'URL :

- `https://idem.africa/` → Version anglaise
- `https://idem.africa/fr/` → Version française

Ou selon l'en-tête `Accept-Language` du navigateur.

## 🆚 Différences avec ngx-translate

| Aspect                   | @angular/localize     | ngx-translate |
| ------------------------ | --------------------- | ------------- |
| **Performance**          | ✅ Compilation AOT    | ❌ Runtime    |
| **Bundle size**          | ✅ Plus petit         | ❌ Plus grand |
| **SEO**                  | ✅ Excellent          | ⚠️ Moyen      |
| **SSR**                  | ✅ Natif              | ⚠️ Complexe   |
| **Changement de langue** | ❌ Nécessite reload   | ✅ Dynamique  |
| **Format**               | JSON, XLIFF, ARB, XMB | JSON          |
| **Support officiel**     | ✅ Angular team       | ❌ Communauté |

## 📚 Ressources

- [Documentation officielle Angular i18n](https://angular.dev/guide/i18n)
- [API @angular/localize](https://angular.dev/api/localize)
- [Format JSON pour i18n](https://angular.dev/guide/i18n/translation-files)

## 🎯 Checklist de migration

- [ ] Marquer tous les textes avec `i18n` dans les templates
- [ ] Extraire les messages : `npm run i18n:extract:json`
- [ ] Traduire dans `src/locale/messages.fr.json`
- [ ] Tester en français : `npm run start:fr`
- [ ] Tester en anglais : `npm run start:en`
- [ ] Vérifier le SSR
- [ ] Build production : `npm run build:all-locales`
- [ ] Configurer le déploiement multi-locale
