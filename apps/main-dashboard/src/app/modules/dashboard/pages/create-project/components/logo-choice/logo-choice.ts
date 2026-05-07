import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LogoImportComponent } from '../logo-import/logo-import';
import { ProjectModel } from '@idem/shared-models';
import { BrandingService } from '../../../../services/ai-agents/branding.service';

/**
 * Logo choice step in the create-project wizard.
 * Lets the user choose between importing an existing logo or generating one with AI.
 * If "import" is chosen, shows the LogoImportComponent inline.
 * After import, triggers AI generation of colors (primary from logo) and typography.
 */
@Component({
  selector: 'app-logo-choice',
  standalone: true,
  imports: [CommonModule, TranslateModule, LogoImportComponent],
  templateUrl: './logo-choice.html',
  styleUrl: './logo-choice.css',
})
export class LogoChoiceComponent {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly destroy$ = new Subject<void>();

  // Inputs
  readonly project = input<ProjectModel>();

  // Outputs
  readonly nextStep = output<void>();
  readonly previousStep = output<void>();
  readonly projectUpdate = output<Partial<ProjectModel>>();
  readonly logoChoiceMade = output<'import' | 'ai'>();
  readonly logoImportComplete = output<boolean>();

  // State
  protected readonly choice = signal<'import' | 'ai' | null>(null);
  protected readonly importedSvg = signal<string | null>(null);
  protected readonly importedColors = signal<string[]>([]);
  protected readonly isGeneratingBranding = signal(false);
  protected readonly generationError = signal<string | null>(null);

  // Computed: logo import is complete when we have both SVG and at least 2 colors
  protected readonly isLogoImportComplete = computed(() => {
    return !!this.importedSvg() && this.importedColors().length >= 2;
  });

  /**
   * User selects "I already have a logo"
   */
  protected selectImport(): void {
    this.choice.set('import');
    this.logoChoiceMade.emit('import');
  }

  /**
   * User selects "Create with AI"
   */
  protected selectAI(): void {
    this.choice.set('ai');
    this.logoChoiceMade.emit('ai');
    // Proceed to next step immediately — the AI logo generation step handles the rest
    this.nextStep.emit();
  }

  /**
   * Called when the LogoImportComponent emits a processed SVG
   */
  protected onSvgImported(svg: string): void {
    this.importedSvg.set(svg);
    // Emit completion status to parent
    this.logoImportComplete.emit(this.isLogoImportComplete());
    // Ne PAS déclencher automatiquement la génération - attendre le clic sur Next
  }

  /**
   * Called when the LogoImportComponent emits extracted colors
   */
  protected onColorsExtracted(colors: string[]): void {
    this.importedColors.set(colors);
    // Emit completion status to parent
    this.logoImportComplete.emit(this.isLogoImportComplete());
    // Ne PAS déclencher automatiquement la génération - attendre le clic sur Next
  }

  /**
   * Sauvegarde le logo importé dans le projet (sans navigation)
   */
  public saveImportedLogo(): void {
    const svg = this.importedSvg();
    const colors = this.importedColors();
    const currentProject = this.project();

    if (!svg || !currentProject || colors.length === 0) {
      console.warn('Cannot save logo - missing data');
      return;
    }

    // Sauvegarder le logo importé et les couleurs extraites dans le projet
    const projectUpdate = {
      analysisResultModel: {
        ...currentProject.analysisResultModel,
        branding: {
          ...currentProject.analysisResultModel?.branding,
          logo: {
            id: `imported-${Date.now()}`,
            name: 'Imported Logo',
            svg: svg,
            concept: 'User-imported logo',
            colors: colors,
            fonts: [],
          },
          // Marquer qu'on vient du workflow import
          importedLogoColors: colors,
        },
      },
    } as Partial<ProjectModel>;

    console.log('🔵 Saving imported logo:', projectUpdate);
    this.projectUpdate.emit(projectUpdate);
  }

  /**
   * Appelé quand l'utilisateur clique sur Next après avoir importé le logo.
   * Sauvegarde le logo et les couleurs dans le projet, puis passe à l'étape suivante.
   * La génération des couleurs sera faite dans color-selection.
   */
  public continueWithImportedLogo(): void {
    this.saveImportedLogo();
    // Passer à l'étape de sélection des couleurs
    console.log('🔵 Emitting nextStep');
    this.nextStep.emit();
  }

  /**
   * Go back to choice selection
   */
  protected backToChoice(): void {
    this.choice.set(null);
    this.importedSvg.set(null);
    this.importedColors.set([]);
    this.generationError.set(null);
  }

  protected goToPreviousStep(): void {
    this.previousStep.emit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
