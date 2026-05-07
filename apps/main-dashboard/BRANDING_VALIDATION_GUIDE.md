# Guide d'intégration de la validation du branding

## Approche simplifiée

**Chaque page vérifie le branding au chargement (`ngOnInit`)** et affiche un blocker si incomplet. Pas de vérification dans la sidebar.

## Pages concernées

Les pages suivantes doivent vérifier que le branding est complet avant d'afficher leur contenu :

- ✅ **Business Plan** (`show-business-plan`) - FAIT
- ✅ **Identité de marque** (`show-branding`) - FAIT (affiche banner, pas blocker)
- ✅ **Communication** (`show-communication`) - FAIT
- ✅ **Pitch Deck** (`show-pitch-deck`) - FAIT
- ✅ **Documents juridiques** (`legal-docs`) - FAIT
- ✅ **Développement** (`development/show-development`) - FAIT
- ⏳ **Diagrammes** (`show-diagrams`) - À FAIRE (optionnel)

## Étapes d'intégration

### 1. Modifier le fichier TypeScript (.ts)

#### Imports à ajouter

```typescript
import { BrandingValidationService } from '../../services/branding-validation.service';
import { BrandingRequiredBlockerComponent } from '../../components/branding-required-blocker/branding-required-blocker';
import { ProjectService } from '../../services/project.service';
```

#### Dans les imports du composant

```typescript
imports: [..., BrandingRequiredBlockerComponent]
```

#### Services à injecter

```typescript
private readonly brandingValidation = inject(BrandingValidationService);
private readonly projectService = inject(ProjectService);
```

#### Signaux à ajouter

```typescript
// Branding validation
protected readonly isBrandingComplete = signal<boolean>(false);
protected readonly brandingMissingElements = signal<string[]>([]);
```

#### Modifier ngOnInit

```typescript
ngOnInit(): void {
  const projectId = this.cookieService.get('projectId');
  this.projectIdFromCookie.set(projectId);

  if (projectId) {
    // First check branding completion
    this.checkBrandingCompletion(projectId);
  } else {
    this.isLoading.set(false);
  }
}
```

#### Ajouter la méthode de vérification

```typescript
/**
 * Check if project branding is complete before loading content
 */
private checkBrandingCompletion(projectId: string): void {
  this.projectService.getProjectById(projectId).subscribe({
    next: (project) => {
      const { isComplete, missingElements } = this.brandingValidation.checkBrandingCompletion(project);

      this.isBrandingComplete.set(isComplete);
      this.brandingMissingElements.set(missingElements);

      // Only load content if branding is complete
      if (isComplete) {
        this.loadContent(projectId); // Remplacer par la méthode de chargement appropriée
      } else {
        this.isLoading.set(false);
      }
    },
    error: (error) => {
      console.error('Error checking branding completion:', error);
      this.isLoading.set(false);
      this.hasError.set(true);
      this.errorMessage.set('Erreur lors de la vérification du projet');
    }
  });
}
```

### 2. Modifier le template HTML (.html)

Ajouter la condition juste après le loading state :

**⚠️ IMPORTANT : Ajouter `!isLoading()` pour éviter d'afficher le blocker pendant le chargement**

```html
<div class="w-full min-h-screen md:p-6 rounded-2xl relative">
  @if (isLoading()) {
  <!-- Loading State -->
  ... } @else if (!isLoading() && !isBrandingComplete()) {
  <!-- Branding Required Blocker -->
  <app-branding-required-blocker
    [missingElements]="brandingMissingElements()"
    [featureName]="'[NOM DE LA FONCTIONNALITÉ]'"
  />
  } @else if (...) {
  <!-- Contenu normal de la page -->
  ... }
</div>
```

### 3. Noms de fonctionnalités pour chaque page

- Business Plan: `'le Business Plan'`
- Communication: `'la Communication'`
- Pitch Deck: `'le Pitch Deck'`
- Documents juridiques: `'les Documents juridiques'`
- Diagrammes: `'les Diagrammes'`
- Développement: `'le Développement'`

## Comportement attendu

### Au chargement de la page (accès direct via URL ou clic sidebar)

1. Affiche le loader
2. Vérifie si le projet a :
   - Un logo
   - Des couleurs
   - Des typographies
3. Si **complet** : Affiche le contenu normal
4. Si **incomplet** : Affiche le composant de blocage avec les éléments manquants

### Avantages de cette approche

- ✅ Fonctionne pour l'accès direct via URL
- ✅ Fonctionne pour les clics sur la sidebar
- ✅ Pas de logique complexe dans la sidebar
- ✅ Chaque page gère sa propre validation

## Exemple complet : Business Plan

Voir les fichiers :

- `src/app/modules/dashboard/pages/show-business-plan/show-business-plan.ts`
- `src/app/modules/dashboard/pages/show-business-plan/show-business-plan.html`
