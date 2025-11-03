# Guide d'internationalisation (i18n) - Main Dashboard

## Configuration

L'application **main-dashboard** utilise **ngx-translate** pour l'internationalisation.

### Langues supportées

- **Anglais (en)** - Langue par défaut
- **Français (fr)**

### Fichiers de traduction

Les fichiers de traduction se trouvent dans `src/assets/i18n/`:

- `en.json` - Traductions anglaises
- `fr.json` - Traductions françaises

## Utilisation dans les composants

### 1. Importer TranslateModule

```typescript
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-example',
  imports: [CommonModule, TranslateModule],
  templateUrl: './example.html',
})
export class ExampleComponent {}
```

### 2. Utiliser le pipe translate dans les templates

```html
<!-- Traduction simple -->
<h1>{{ 'dashboard.welcome' | translate }}</h1>

<!-- Traduction avec paramètres -->
<p>{{ 'common.greeting' | translate: {name: userName} }}</p>

<!-- Attributs -->
<button [title]="'common.save' | translate">{{ 'common.save' | translate }}</button>
```

### 3. Utiliser TranslateService dans le code TypeScript

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

  // Avec paramètres
  showGreeting(name: string): void {
    this.translate.get('common.greeting', { name }).subscribe((text: string) => {
      console.log(text);
    });
  }
}
```

## Changer de langue

### Utiliser le LanguageService

```typescript
import { inject } from '@angular/core';
import { LanguageService } from './shared/services/language.service';

export class LanguageSwitcher {
  private readonly languageService = inject(LanguageService);

  switchToFrench(): void {
    this.languageService.setLanguage('fr');
  }

  switchToEnglish(): void {
    this.languageService.setLanguage('en');
  }

  getCurrentLanguage(): string {
    return this.languageService.getCurrentLanguage();
  }
}
```

## Structure des fichiers de traduction

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "projects": "Projects"
  },
  "dashboard": {
    "welcome": "Welcome to your dashboard"
  }
}
```

### Conventions de nommage

- Utiliser **camelCase** pour les clés
- Organisation hiérarchique : `section.subsection.key`
- Sections principales :
  - `common` : Actions et éléments communs
  - `navigation` : Menu et navigation
  - `dashboard` : Tableau de bord
  - `projects` : Projets
  - `teams` : Équipes
  - `errors` : Messages d'erreur

## Fonctionnalités automatiques

### Détection de la langue

Le service `LanguageService` détecte automatiquement la langue :

1. Langue sauvegardée dans localStorage (`idem_dashboard_language`)
2. Langue du navigateur
3. Langue par défaut (en)

### Persistance

La langue sélectionnée est automatiquement sauvegardée dans localStorage.

## Différences avec landing

| Fonctionnalité         | main-dashboard          | landing (main-app) |
| ---------------------- | ----------------------- | ------------------ |
| Système i18n           | ngx-translate           | @angular/localize  |
| Changement de langue   | Dynamique (sans reload) | Nécessite reload   |
| SSR                    | Non                     | Oui                |
| Fichiers de traduction | JSON runtime            | XLIFF compilé      |
| Performance            | Chargement JSON         | Pré-compilé        |
| SEO                    | N/A (dashboard privé)   | Optimal            |

## Commandes utiles

```bash
# Démarrer le serveur de développement
npm start

# Build de production
npm run build

# Tests
npm test
```

## Ajouter une nouvelle langue

1. Créer le fichier `src/assets/i18n/[code].json`
2. Ajouter le code langue dans `SUPPORTED_LANGUAGES` du `LanguageService`
3. Ajouter les traductions dans le nouveau fichier JSON

## Bonnes pratiques

1. ✅ Toujours utiliser des clés descriptives
2. ✅ Organiser les traductions par section
3. ✅ Utiliser des paramètres pour les valeurs dynamiques
4. ✅ Tester avec toutes les langues supportées
5. ❌ Ne pas hardcoder de texte dans les templates
6. ❌ Ne pas utiliser de clés génériques comme `text1`, `label2`
