# Main Dashboard - Idem Platform (Test)

Application de dashboard privée pour la plateforme Idem. Cette application gère toutes les fonctionnalités du console utilisateur, incluant la gestion de projets, équipes, déploiements, et plus.

## 🚀 Caractéristiques

- **Sans SSR** - Application client-side uniquement pour performance optimale
- **ngx-translate** - Internationalisation dynamique (EN/FR)
- **Angular 20** - Dernière version avec standalone components
- **PrimeNG** - Composants UI riches
- **Tailwind CSS 4** - Design system moderne
- **Lazy Loading** - Chargement optimisé des modules

## 📁 Structure

```
src/
├── app/
│   ├── modules/
│   │   ├── dashboard/        # Pages du dashboard
│   │   │   ├── pages/
│   │   │   │   ├── global-dashboard/      # Dashboard global
│   │   │   │   ├── projects-list/         # Liste des projets
│   │   │   │   ├── my-teams/              # Mes équipes
│   │   │   │   ├── dashboard/             # Dashboard projet
│   │   │   │   ├── show-branding/         # Branding
│   │   │   │   ├── show-business-plan/    # Plan d'affaires
│   │   │   │   ├── show-diagrams/         # Diagrammes
│   │   │   │   ├── development/           # Développement
│   │   │   │   └── deployment/            # Déploiements
│   │   └── auth/             # Authentification
│   ├── shared/               # Services et composants partagés
│   │   ├── services/         # Services (API, Language, etc.)
│   │   └── components/       # Composants réutilisables
│   ├── layouts/              # Layouts (global, dashboard, empty)
│   ├── guards/               # Guards d'authentification
│   └── app.routes.ts         # Configuration des routes
└── assets/
    └── i18n/                 # Fichiers de traduction JSON
        ├── en.json
        └── fr.json
```

## 🛠️ Installation

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm start

# Build de production
npm run build
```

## 🌍 Internationalisation

Cette application utilise **ngx-translate** pour l'internationalisation.

### Langues supportées

- **Anglais (en)** - Langue par défaut
- **Français (fr)**

### Utilisation dans les templates

```html
<!-- Traduction simple -->
<h1>{{ 'dashboard.welcome' | translate }}</h1>

<!-- Avec paramètres -->
<p>{{ 'common.greeting' | translate: {name: userName} }}</p>
```

### Changer de langue

```typescript
import { inject } from '@angular/core';
import { LanguageService } from './shared/services/language.service';

export class Component {
  private readonly languageService = inject(LanguageService);

  switchToFrench(): void {
    this.languageService.setLanguage('fr');
  }
}
```

Voir `I18N_GUIDE.md` pour plus de détails.

## 🔐 Routes

### Routes publiques

- `/login` - Page de connexion

### Routes protégées (console)

- `/console` - Dashboard global
- `/console/projects` - Liste des projets
- `/console/teams` - Gestion des équipes
- `/console/project/*` - Routes spécifiques au projet
  - `/dashboard` - Tableau de bord
  - `/branding` - Branding
  - `/business-plan` - Plan d'affaires
  - `/diagrams` - Diagrammes
  - `/tests` - Tests
  - `/development` - Développement
  - `/deployments` - Déploiements
  - `/teams` - Équipes
  - `/profile` - Profil

## 🎨 Design System

Cette application utilise le design system partagé `@idem/shared-styles`.

### Classes principales

**Boutons :**

```html
<button class="inner-button">Action primaire</button>
<button class="outer-button">Action secondaire</button>
```

**Glass effects :**

```html
<div class="glass">Contenu avec effet glass</div>
<div class="glass-dark">Contenu glass sombre</div>
<div class="glass-card">Carte avec effet glass</div>
```

**Inputs :**

```html
<input type="text" class="input" />
```

## 📦 Dépendances principales

- `@angular/core` ^20.0.0
- `@angular/fire` ^20.0.0 - Firebase integration
- `@ngx-translate/core` ^17.0.0 - Internationalisation
- `primeng` ^20.1.1 - Composants UI
- `tailwindcss` ^4.0.15 - Styling
- `@idem/shared-styles` - Design system
- `ngx-markdown` ^20.0.0 - Rendu Markdown
- `mermaid` ^11.6.0 - Diagrammes
- `html2canvas` ^1.4.1 - Export PDF
- `jspdf` ^3.0.1 - Génération PDF

## 🔧 Scripts disponibles

```bash
npm start          # Démarrer le serveur de développement
npm run build      # Build de production
npm run watch      # Build en mode watch
npm test           # Exécuter les tests
```

## 🚦 Développement

### Créer un nouveau composant

```bash
ng generate component modules/dashboard/pages/my-component
```

### Ajouter une nouvelle traduction

1. Ajouter les clés dans `src/assets/i18n/en.json`
2. Ajouter les traductions dans `src/assets/i18n/fr.json`
3. Utiliser dans le template : `{{ 'section.key' | translate }}`

### Règles importantes

1. ✅ Toujours utiliser `inject()` au lieu de constructor injection
2. ✅ Utiliser des standalone components
3. ✅ Utiliser le nouveau control flow (@if, @for, @else)
4. ✅ Utiliser `[ngClass]` pour les classes avec opacité Tailwind
5. ❌ Ne jamais utiliser `[class.bg-primary/20]` (utiliser `[ngClass]`)
6. ❌ Ne pas utiliser `p-button` de PrimeNG (utiliser inner-button/outer-button)

## 🔗 Liens avec landing

Cette application est séparée de la landing page (`main-app`).

**Navigation vers la landing page :**

```html
<a href="http://localhost:4201">Retour au site</a>
```

En production :

```html
<a href="https://idem.africa">Retour au site</a>
```

## 📚 Documentation

- `I18N_GUIDE.md` - Guide d'internationalisation
- `../MIGRATION_GUIDE.md` - Guide de migration entre les applications
- `../main-app/MIGRATION_I18N.md` - Migration i18n de la landing page

## 🐛 Troubleshooting

### Erreurs TypeScript

Si vous voyez des erreurs de modules manquants :

```bash
npm install
```

### Traductions manquantes

Ajouter les clés dans `src/assets/i18n/en.json` et `fr.json`

### Problèmes de build

```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📄 Licence

Propriétaire - Idem Platform
