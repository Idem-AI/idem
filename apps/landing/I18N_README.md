# Internationalisation (i18n) - Landing Page IDEM

## 📋 Vue d'ensemble

L'internationalisation de la landing page IDEM utilise **@angular/localize** avec des fichiers de traduction au format **JSON** pour une meilleure lisibilité et facilité de maintenance.

## 🌍 Langues supportées

- **en** (Anglais) - Langue source par défaut
- **fr** (Français) - Traduction complète

## 🚀 Démarrage rapide

### Développement

```bash
# Servir en anglais (défaut)
npm start
# ou
npm run start:en

# Servir en français
npm run start:fr
```

### Extraction des messages

```bash
# Extraire tous les messages i18n au format JSON
npm run i18n:extract:json
```

Cela génère/met à jour `src/locale/messages.json` avec tous les textes marqués.

### Build production

```bash
# Build version anglaise
npm run build:en

# Build version française
npm run build:fr

# Build toutes les locales
npm run build:all-locales
```

## 📁 Structure des fichiers

```
apps/landing/
├── src/
│   ├── locale/                    # Fichiers de traduction
│   │   ├── messages.fr.json       # Traductions françaises
│   │   └── .gitkeep
│   └── app/
│       └── ...                    # Composants avec i18n
├── angular.json                   # Configuration i18n
├── package.json                   # Scripts npm
├── I18N_GUIDE.md                  # Guide complet d'utilisation
├── I18N_EXAMPLES.md               # Exemples concrets
├── I18N_MIGRATION_PLAN.md         # Plan de migration
└── I18N_README.md                 # Ce fichier
```

## 📚 Documentation

### 1. [I18N_GUIDE.md](./I18N_GUIDE.md)

Guide complet pour utiliser @angular/localize :

- Syntaxe i18n dans les templates
- Utilisation de $localize dans TypeScript
- Workflow de traduction
- Format des fichiers JSON
- Conventions de nommage
- Bonnes pratiques
- Débogage
- Déploiement

### 2. [I18N_EXAMPLES.md](./I18N_EXAMPLES.md)

Exemples concrets avant/après :

- Hero sections
- Navigation
- Stats avec variables
- Pluriels
- Attributs (alt, title, placeholder)
- Listes avec @for
- Formulaires
- Select/Switch
- Dates et nombres
- Workflow complet

### 3. [I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md)

Plan de migration détaillé :

- État actuel
- Composants à migrer
- Ordre de migration
- Processus par composant
- Métriques de progression
- Checklist finale

## 🎯 Syntaxe de base

### Dans les templates HTML

```html
<!-- Texte simple -->
<h1 i18n="@@home.hero.title">Welcome to IDEM</h1>

<!-- Avec description -->
<button i18n="Call to action button@@cta.start">Start Free Trial</button>

<!-- Attributs -->
<img i18n-alt="@@logo.alt" alt="IDEM Logo" src="logo.png" />

<!-- Pluriels -->
<span i18n="@@users.count">
  {count, plural, =0 {No users} =1 {One user} other {{{count}} users}}
</span>

<!-- Variables -->
<p i18n="@@welcome.message">Welcome, {{userName}}!</p>
```

### Dans le code TypeScript

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-example',
  template: '...',
})
export class ExampleComponent {
  // Traduction simple
  title = $localize`:@@page.title:Page Title`;

  // Avec variable
  userName = 'John';
  greeting = $localize`:@@greeting:Hello, ${this.userName}!`;
}
```

## 📝 Format du fichier de traduction

`src/locale/messages.fr.json` :

```json
{
  "locale": "fr",
  "translations": {
    "home.hero.title": "Bienvenue sur IDEM",
    "home.hero.subtitle": "La plateforme d'IA pour l'Afrique",
    "navigation.home": "Accueil",
    "navigation.about": "À propos",
    "cta.start": "Commencer l'essai gratuit",
    "footer.copyright": "© 2024 IDEM. Tous droits réservés."
  }
}
```

## 🔧 Configuration

### angular.json

```json
{
  "projects": {
    "landing": {
      "i18n": {
        "sourceLocale": "en",
        "locales": {
          "fr": {
            "translation": "src/locale/messages.fr.json"
          }
        }
      }
    }
  }
}
```

### Scripts npm (package.json)

```json
{
  "scripts": {
    "i18n:extract": "ng extract-i18n",
    "i18n:extract:json": "ng extract-i18n --format=json --output-path=src/locale",
    "start:fr": "ng serve --configuration=fr --host 0.0.0.0 --port 4201",
    "start:en": "ng serve --configuration=en --host 0.0.0.0 --port 4201",
    "build:fr": "ng build --configuration=production-fr",
    "build:en": "ng build --configuration=production-en",
    "build:all-locales": "npm run build:en && npm run build:fr"
  }
}
```

## 🎨 Conventions de nommage

Structure hiérarchique avec points :

```
page.section.element
```

**Exemples :**

- `home.hero.title`
- `about.mission.description`
- `pricing.plan.basic.name`
- `navigation.home`
- `footer.copyright`
- `common.button.learn_more`

## 💡 Bonnes pratiques

### ✅ À faire

1. **Toujours utiliser des IDs uniques**

   ```html
   <h1 i18n="@@home.hero.title">Welcome</h1>
   ```

2. **Descriptions claires**

   ```html
   <button i18n="Primary call to action@@cta.signup">Sign Up</button>
   ```

3. **Grouper par section**

   ```json
   {
     "home.hero.title": "...",
     "home.hero.subtitle": "...",
     "home.features.title": "..."
   }
   ```

4. **Utiliser $localize pour le code TypeScript**
   ```typescript
   message = $localize`:@@welcome:Welcome to IDEM`;
   ```

### ❌ À éviter

1. **Pas d'ID**

   ```html
   <h1 i18n>Welcome</h1>
   <!-- ❌ -->
   ```

2. **Textes en dur dans le TypeScript**

   ```typescript
   title = 'Welcome';  <!-- ❌ -->
   ```

3. **Traduction des noms propres**
   ```json
   {
     "brand.name": "IDEM" // ✅ Garder IDEM
   }
   ```

## 🔍 Workflow de traduction

1. **Marquer les textes** dans les templates avec `i18n`
2. **Extraire** : `npm run i18n:extract:json`
3. **Traduire** dans `src/locale/messages.fr.json`
4. **Tester** : `npm run start:fr`
5. **Build** : `npm run build:all-locales`

## 📦 Déploiement

### Structure de build

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

### Configuration serveur

Servir la bonne locale selon :

- **URL** : `idem.africa/` (en) vs `idem.africa/fr/` (fr)
- **Header** : `Accept-Language` du navigateur

## 🆚 Avantages vs ngx-translate

| Aspect            | @angular/localize   | ngx-translate |
| ----------------- | ------------------- | ------------- |
| Performance       | ✅ AOT compilation  | ❌ Runtime    |
| Bundle size       | ✅ Plus petit       | ❌ Plus grand |
| SEO               | ✅ Excellent        | ⚠️ Moyen      |
| SSR               | ✅ Natif            | ⚠️ Complexe   |
| Changement langue | ❌ Reload requis    | ✅ Dynamique  |
| Support           | ✅ Officiel Angular | ❌ Communauté |

## 🐛 Débogage

### Messages manquants

Si une traduction manque, le texte anglais (source) sera affiché.

### Vérifier les extractions

```bash
npm run i18n:extract:json
cat src/locale/messages.json
```

### Tester une locale

```bash
npm run start:fr  # Français
npm run start:en  # Anglais
```

## 📊 État actuel

- ✅ Infrastructure configurée
- ✅ Scripts npm ajoutés
- ✅ Documentation complète
- ⏳ Migration des composants en cours

## 🎯 Prochaines étapes

1. Migrer les composants globaux (Header, Footer)
2. Migrer la page d'accueil
3. Migrer les pages importantes (About, Pricing, Solutions)
4. Migrer les pages secondaires
5. Compléter les traductions françaises
6. Tests et validation
7. Déploiement

## 📞 Support

Pour toute question sur l'internationalisation :

1. Consulter [I18N_GUIDE.md](./I18N_GUIDE.md)
2. Voir les exemples dans [I18N_EXAMPLES.md](./I18N_EXAMPLES.md)
3. Suivre le plan dans [I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md)
4. Documentation officielle : https://angular.dev/guide/i18n

## 📚 Ressources

- [Documentation Angular i18n](https://angular.dev/guide/i18n)
- [API @angular/localize](https://angular.dev/api/localize)
- [Format JSON pour i18n](https://angular.dev/guide/i18n/translation-files)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
