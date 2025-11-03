# Guide de Migration - Division des Applications

## Vue d'ensemble

L'application monolithique `main-app` a été divisée en deux applications Angular distinctes :

1. **main-app (Landing Page)** - Application publique avec SSR et @angular/localize
2. **main-dashboard** - Application privée sans SSR avec ngx-translate

## Architecture

```
apps/
├── main-app/              # Landing Page (SSR + @angular/localize)
│   ├── src/
│   │   ├── app/
│   │   │   ├── modules/
│   │   │   │   └── landing/     # Pages publiques uniquement
│   │   │   ├── shared/          # Composants partagés (footer, header, etc.)
│   │   │   └── layouts/         # Layout public uniquement
│   │   └── locale/              # Fichiers XLIFF pour traductions
│   └── angular.json             # Configuration SSR activé
│
└── main-dashboard/        # Dashboard (Sans SSR + ngx-translate)
    ├── src/
    │   ├── app/
    │   │   ├── modules/
    │   │   │   ├── dashboard/   # Toutes les pages dashboard
    │   │   │   └── auth/        # Pages d'authentification
    │   │   ├── shared/          # Services et composants dashboard
    │   │   ├── layouts/         # Layouts global et dashboard
    │   │   └── guards/          # Guards d'authentification
    │   └── assets/
    │       └── i18n/            # Fichiers JSON pour traductions
    └── angular.json             # Configuration sans SSR
```

## Différences Clés

| Aspect                | main-app (Landing)        | main-dashboard       |
| --------------------- | ------------------------- | -------------------- |
| **SSR**               | ✅ Activé                 | ❌ Désactivé         |
| **i18n**              | @angular/localize (XLIFF) | ngx-translate (JSON) |
| **Changement langue** | Nécessite reload          | Dynamique            |
| **SEO**               | Optimisé                  | N/A (privé)          |
| **Routes**            | Pages publiques           | Console + Dashboard  |
| **Build**             | Séparé par locale         | Build unique         |
| **Performance**       | Pré-compilé               | Runtime              |

## Configuration i18n

### main-app (Landing Page)

**Système :** @angular/localize avec fichiers XLIFF

**Fichiers :**

- `src/locale/messages.fr.xlf` - Traductions françaises
- `src/app/shared/utils/i18n.helper.ts` - Helper TypeScript

**Utilisation dans les templates :**

```html
<!-- Texte simple -->
<h1 i18n="@@home_title">Welcome to Idem</h1>

<!-- Avec contexte -->
<p i18n="@@home_description|Description de la page d'accueil">Build your projects faster</p>

<!-- Attributs -->
<button i18n-title="@@button_save_title" title="Save">
  <span i18n="@@button_save">Save</span>
</button>
```

**Utilisation dans le code TypeScript :**

```typescript
import { $localize } from '@angular/localize/init';

const message = $localize`:@@error_message:An error occurred`;
```

**Scripts npm :**

```bash
npm run i18n:extract    # Extraire les traductions
npm run start:fr        # Servir en français
npm run build:fr        # Build français
```

### main-dashboard

**Système :** ngx-translate avec fichiers JSON

**Fichiers :**

- `src/assets/i18n/en.json` - Traductions anglaises
- `src/assets/i18n/fr.json` - Traductions françaises
- `src/app/shared/services/language.service.ts` - Service de langue

**Utilisation dans les templates :**

```html
<!-- Texte simple -->
<h1>{{ 'dashboard.welcome' | translate }}</h1>

<!-- Avec paramètres -->
<p>{{ 'common.greeting' | translate: {name: userName} }}</p>

<!-- Attributs -->
<button [title]="'common.save' | translate">{{ 'common.save' | translate }}</button>
```

**Utilisation dans le code TypeScript :**

```typescript
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export class ExampleComponent {
  private readonly translate = inject(TranslateService);

  showMessage(): void {
    this.translate.get('common.loading').subscribe((text: string) => {
      console.log(text);
    });
  }
}
```

**Changer de langue :**

```typescript
import { LanguageService } from './shared/services/language.service';

export class LanguageSwitcher {
  private readonly languageService = inject(LanguageService);

  switchToFrench(): void {
    this.languageService.setLanguage('fr');
  }
}
```

## Routes

### main-app (Landing Page)

Routes publiques uniquement :

- `/` → Redirect vers `/home`
- `/home` - Page d'accueil
- `/deployment` - Page déploiement
- `/african-market` - Marché africain
- `/open-source` - Open source
- `/architecture` - Architecture
- `/pricing` - Tarification
- `/solutions` - Solutions
- `/about` - À propos
- `/premium-beta` - Accès beta premium
- `/privacy-policy` - Politique de confidentialité
- `/terms-of-service` - Conditions d'utilisation
- `/beta-policy` - Politique beta

### main-dashboard

Routes privées (console) :

- `/` → Redirect vers `/console`
- `/login` - Connexion
- `/console` - Dashboard global
- `/console/projects` - Liste des projets
- `/console/teams` - Équipes
- `/console/project/*` - Routes spécifiques au projet
  - `/dashboard` - Tableau de bord projet
  - `/branding` - Branding
  - `/business-plan` - Plan d'affaires
  - `/diagrams` - Diagrammes
  - `/tests` - Tests
  - `/development` - Développement
  - `/deployments` - Déploiements
  - `/teams` - Équipes du projet
  - `/profile` - Profil

## Installation et Démarrage

### main-app (Landing Page)

```bash
cd apps/main-app
npm install
npm start              # Servir en anglais (défaut)
npm run start:fr       # Servir en français
npm run build          # Build production (toutes locales)
```

### main-dashboard

```bash
cd apps/main-dashboard
npm install
npm start              # Servir sur http://localhost:4200
npm run build          # Build production
```

## Dépendances

### Communes aux deux applications

- `@angular/core` ^20.0.0
- `@angular/common` ^20.0.0
- `@angular/router` ^20.0.0
- `@angular/forms` ^20.0.0
- `@idem/shared-styles` - Design system partagé
- `primeng` ^20.1.1
- `tailwindcss` ^4.0.15

### Spécifiques à main-app

- `@angular/ssr` ^20.0.0
- `@angular/platform-server` ^20.0.0
- `@angular/localize` (pour i18n)
- `express` ^4.18.2 (pour SSR)

### Spécifiques à main-dashboard

- `@ngx-translate/core` ^17.0.0
- `@ngx-translate/http-loader` ^17.0.0
- `@google/generative-ai` ^0.24.0
- `ngx-markdown` ^20.0.0
- `ngx-sse-client` ^20.0.0
- `html2canvas` ^1.4.1
- `jspdf` ^3.0.1
- `mermaid` ^11.6.0

## Liens entre les applications

Pour naviguer entre les deux applications :

### De la landing page vers le dashboard

```html
<!-- Dans main-app -->
<a href="http://localhost:4200/console">Accéder au dashboard</a>
```

En production, utilisez les URLs appropriées :

```html
<a href="https://dashboard.idem.africa/console">Accéder au dashboard</a>
```

### Du dashboard vers la landing page

```html
<!-- Dans main-dashboard -->
<a href="http://localhost:4201">Retour au site</a>
```

En production :

```html
<a href="https://idem.africa">Retour au site</a>
```

## Migration des composants existants

Si vous devez migrer un composant d'une application à l'autre :

### De main-app vers main-dashboard

1. Copier le composant dans main-dashboard
2. Remplacer les traductions i18n par ngx-translate :

   ```html
   <!-- Avant -->
   <h1 i18n="@@title">Title</h1>

   <!-- Après -->
   <h1>{{ 'section.title' | translate }}</h1>
   ```

3. Ajouter les traductions dans `src/assets/i18n/en.json` et `fr.json`
4. Importer `TranslateModule` dans le composant

### De main-dashboard vers main-app

1. Copier le composant dans main-app
2. Remplacer ngx-translate par i18n :

   ```html
   <!-- Avant -->
   <h1>{{ 'section.title' | translate }}</h1>

   <!-- Après -->
   <h1 i18n="@@section_title">Title</h1>
   ```

3. Exécuter `npm run i18n:extract`
4. Traduire dans `src/locale/messages.fr.xlf`

## Bonnes Pratiques

### main-app (Landing Page)

1. ✅ Toujours utiliser i18n pour les textes
2. ✅ Optimiser pour le SEO (meta tags, structured data)
3. ✅ Tester avec SSR activé
4. ✅ Vérifier les deux locales (en, fr)
5. ❌ Ne pas utiliser de services avec état côté serveur

### main-dashboard

1. ✅ Utiliser ngx-translate pour tous les textes
2. ✅ Protéger les routes avec des guards
3. ✅ Gérer l'authentification
4. ✅ Optimiser les bundles (lazy loading)
5. ❌ Ne pas se soucier du SEO (application privée)

## Déploiement

### main-app (Landing Page)

```bash
# Build pour toutes les locales
npm run build

# Fichiers générés dans dist/
dist/
├── browser/
│   ├── en/          # Version anglaise
│   └── fr/          # Version française
└── server/
    └── server.mjs   # Serveur SSR
```

Démarrer le serveur SSR :

```bash
npm run serve:ssr:idem
```

### main-dashboard

```bash
# Build production
npm run build

# Fichiers générés dans dist/main-dashboard/browser/
```

Servir avec un serveur web standard (nginx, Apache, etc.)

## Troubleshooting

### Erreurs TypeScript dans main-dashboard

Si vous voyez des erreurs "Cannot find module", exécutez :

```bash
cd apps/main-dashboard
npm install
```

### Traductions manquantes

**main-app :**

```bash
npm run i18n:extract
# Éditer src/locale/messages.fr.xlf
```

**main-dashboard :**
Ajouter les clés manquantes dans `src/assets/i18n/en.json` et `fr.json`

### SSR ne fonctionne pas (main-app)

Vérifier que le serveur Express est démarré :

```bash
npm run build
npm run serve:ssr:idem
```

## Documentation Supplémentaire

- **main-app :** Voir `MIGRATION_I18N.md`, `I18N_GUIDE.md`
- **main-dashboard :** Voir `I18N_GUIDE.md`
- **Design System :** Voir `packages/shared-styles/README.md`

## Support

Pour toute question ou problème :

1. Vérifier la documentation spécifique à chaque application
2. Consulter les mémoires système pour les règles critiques
3. Tester en local avant de déployer
