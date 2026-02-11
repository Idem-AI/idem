import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LogoImportComponent } from '../logo-import/logo-import';
import { ProjectModel } from '../../../../models/project.model';
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

  // State
  protected readonly choice = signal<'import' | 'ai' | null>(null);
  protected readonly importedSvg = signal<string | null>(null);
  protected readonly importedColors = signal<string[]>([]);
  protected readonly isGeneratingBranding = signal(false);
  protected readonly generationError = signal<string | null>(null);

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
  }

  /**
   * Called when the LogoImportComponent emits extracted colors
   */
  protected onColorsExtracted(colors: string[]): void {
    this.importedColors.set(colors);
  }

  /**
   * After importing, trigger AI generation of colors and typography from logo,
   * then proceed to the colors selection step.
   */
  protected continueWithImportedLogo(): void {
    const svg = this.importedSvg();
    const colors = this.importedColors();
    const currentProject = this.project();

    if (!svg || !currentProject) return;

    // First, update the project with the imported logo
    const importedLogo = {
      id: `imported-${Date.now()}`,
      name: 'Imported Logo',
      svg: svg,
      concept: 'User-imported logo',
      colors: colors,
      fonts: [],
    };

    this.projectUpdate.emit({
      analysisResultModel: {
        ...currentProject?.analysisResultModel,
        branding: {
          ...currentProject?.analysisResultModel?.branding,
          logo: importedLogo,
          generatedLogos: [importedLogo],
        },
      },
    } as Partial<ProjectModel>);

    // Then trigger AI generation of colors and typography from logo colors
    this.isGeneratingBranding.set(true);
    this.generationError.set(null);

    this.brandingService
      .generateColorsAndTypographyFromLogo(currentProject, svg, colors)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Colors and typography from logo generated:', response);

          // Use the full project from the API response (includes logo with variations, colors, typography)
          this.projectUpdate.emit({
            id: response.project.id,
            analysisResultModel: response.project.analysisResultModel,
          } as Partial<ProjectModel>);

          this.isGeneratingBranding.set(false);
          // Proceed to the colors selection step
          this.nextStep.emit();
        },
        error: (error) => {
          console.error('Error generating colors from logo:', error);
          this.isGeneratingBranding.set(false);
          this.generationError.set('Failed to generate colors and typography. Please try again.');
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
  }

  protected goToPreviousStep(): void {
    this.previousStep.emit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
