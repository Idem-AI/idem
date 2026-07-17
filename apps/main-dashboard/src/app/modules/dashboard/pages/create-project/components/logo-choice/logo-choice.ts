import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LogoImportComponent } from '../logo-import/logo-import';
import { ProjectModel } from '@idem/shared-models';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { LogoImportService } from '../../../../services/logo-import.service';
import { LogoVariations, LogoPreferencesModel } from '../../../../models/logo.model';

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
  private readonly logoImportService = inject(LogoImportService);
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
  protected readonly importedVariations = signal<LogoVariations | null>(null);
  protected readonly isGeneratingBranding = signal(false);
  protected readonly generationError = signal<string | null>(null);

  /** Analyse IA du logo importé (voie « améliorer mon logo ») */
  protected readonly isAnalyzing = signal(false);
  protected readonly analysisFailed = signal(false);

  /**
   * Sous-étape du workflow import :
   * 'upload' — import du fichier + couleurs extraites ;
   * 'decision' — écran de choix dédié « tel quel / améliorer » (plein écran,
   * comme le choix initial upload/IA).
   */
  protected readonly importStep = signal<'upload' | 'decision'>('upload');

  // Computed: logo import is complete when we have the SVG and at least 1 color.
  // Un logo mono-couleur est valide : la génération de palette utilise alors
  // cette couleur comme primaire et secondaire.
  protected readonly isLogoImportComplete = computed(() => {
    return !!this.importedSvg() && this.importedColors().length >= 1;
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

  /** Called when the LogoImportComponent emits extracted colors */
  protected onColorsExtracted(colors: string[]): void {
    this.importedColors.set(colors);
    this.logoImportComplete.emit(this.isLogoImportComplete());
  }

  /** Called when the LogoImportComponent emits programmatic variations */
  protected onVariationsReceived(variations: LogoVariations): void {
    this.importedVariations.set(variations);
  }

  /**
   * Construit le patch branding du logo importé (logo + couleurs extraites).
   * Retourne null si les données sont incomplètes.
   */
  private buildImportedLogoBranding(): Record<string, unknown> | null {
    const svg = this.importedSvg();
    const colors = this.importedColors();
    const variations = this.importedVariations();

    if (!svg || colors.length === 0) {
      return null;
    }

    return {
      logo: {
        id: `imported-${Date.now()}`,
        name: 'Imported Logo',
        svg: svg,
        iconSvg: svg,
        concept: 'User-imported logo',
        colors: colors,
        fonts: [],
        // Include programmatic variations if available
        ...(variations ? { variations } : {}),
      },
      importedLogoColors: colors,
    };
  }

  /**
   * Sauvegarde le logo importé dans le projet (sans navigation)
   */
  public saveImportedLogo(): void {
    const currentProject = this.project();
    const brandingPatch = this.buildImportedLogoBranding();

    if (!currentProject || !brandingPatch) {
      console.warn('Cannot save logo - missing data');
      return;
    }

    this.projectUpdate.emit({
      analysisResultModel: {
        ...currentProject.analysisResultModel,
        branding: {
          ...currentProject.analysisResultModel?.branding,
          ...brandingPatch,
        },
      },
    } as Partial<ProjectModel>);
  }

  /**
   * Appelé quand l'utilisateur clique sur Next après avoir importé le logo.
   * Premier clic : bascule sur l'écran de décision « tel quel / améliorer ».
   * Depuis l'écran de décision, Next équivaut à « utiliser tel quel ».
   */
  public continueWithImportedLogo(): void {
    if (this.importStep() === 'upload') {
      this.importStep.set('decision');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.useLogoAsIs();
  }

  /**
   * « Utiliser mon logo tel quel » : sauvegarde le logo et les couleurs dans le
   * projet puis passe à l'étape suivante (les déclinaisons ont déjà été
   * générées par le moteur hybride à l'import). La génération des couleurs
   * sera faite dans color-selection.
   */
  protected useLogoAsIs(): void {
    if (this.isAnalyzing()) return;
    this.saveImportedLogo();
    this.nextStep.emit();
  }

  /** Retour de l'écran de décision vers l'import */
  protected backToUpload(): void {
    if (this.isAnalyzing()) return;
    this.analysisFailed.set(false);
    this.importStep.set('upload');
  }

  /**
   * Sous-choix « Améliorer mon logo avec l'IA » :
   * 1. Analyse vision du logo importé (type, formes, couleurs, faiblesses, brief).
   * 2. Injection du brief dans logoPreferences (customDescription est HIGH PRIORITY
   *    dans le pipeline de génération existant).
   * 3. Bascule sur le workflow IA — la génération proposera des concepts
   *    ressemblants mais plus professionnels.
   */
  protected improveLogoWithAI(): void {
    const svg = this.importedSvg();
    if (!svg || this.isAnalyzing()) return;

    this.isAnalyzing.set(true);
    this.analysisFailed.set(false);

    this.logoImportService.analyzeLogo(svg).subscribe({
      next: (analysis) => {
        const reference =
          `Original logo reference — shapes: ${analysis.shapes}; ` +
          `colors: ${analysis.colors.join(', ')}; symbolism: ${analysis.symbolism}; ` +
          `weaknesses to fix: ${analysis.weaknesses}`;

        const preferences: LogoPreferencesModel = {
          type: analysis.logoType,
          useAIGeneration: true,
          customDescription: `${analysis.improvementBrief}\n\n${reference}`,
        };

        // Un SEUL patch combiné (logo importé en référence + préférences IA) :
        // deux émissions successives déclenchaient deux updateProject concurrents
        // dont l'ordre d'arrivée pouvait écraser l'un ou l'autre.
        const currentProject = this.project();
        const importedBranding = this.buildImportedLogoBranding() ?? {};

        this.projectUpdate.emit({
          analysisResultModel: {
            ...currentProject?.analysisResultModel,
            branding: {
              ...currentProject?.analysisResultModel?.branding,
              ...importedBranding,
              logoPreferences: preferences,
            },
          },
        } as unknown as Partial<ProjectModel>);

        this.isAnalyzing.set(false);
        this.logoChoiceMade.emit('ai');
        this.nextStep.emit();
      },
      error: (err) => {
        console.error('Logo analysis failed:', err);
        this.isAnalyzing.set(false);
        this.analysisFailed.set(true);
      },
    });
  }

  /**
   * Go back to choice selection
   */
  protected backToChoice(): void {
    this.choice.set(null);
    this.importedSvg.set(null);
    this.importedColors.set([]);
    this.generationError.set(null);
    this.importStep.set('upload');
    this.analysisFailed.set(false);
  }

  protected goToPreviousStep(): void {
    this.previousStep.emit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
