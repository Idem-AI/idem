import { Component, input, output, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColorModel, TypographyModel } from '../../../../models/brand-identity.model';
import { ProjectModel } from '@idem/shared-models';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../../auth/services/auth.service';
import { LoginCardComponent } from '../../../../../auth/components/login-card/login-card';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ColorCustomizerComponent } from '../color-customizer/color-customizer.component';
import { ErrorStateComponent } from '../../../../../../shared/components/error-state/error-state';

@Component({
  selector: 'app-color-selection',
  standalone: true,
  imports: [
    ErrorStateComponent,
    CommonModule,
    DialogModule,
    LoginCardComponent,
    ColorCustomizerComponent,
    TranslateModule],
  templateUrl: './color-selection.html',
  styleUrl: './color-selection.css',
})
export class ColorSelectionComponent implements OnInit, OnDestroy {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();
  private readonly translate = inject(TranslateService);

  // Inputs
  readonly project = input.required<ProjectModel>();
  readonly selectedColor = input<string>();

  // Outputs
  readonly colorSelected = output<string>();
  readonly colorsGenerated = output<ColorModel[]>();
  readonly typographyGenerated = output<TypographyModel[]>();
  readonly colorsAndTypographyGenerated = output<{
    colors: ColorModel[];
    typography: TypographyModel[];
    project: ProjectModel;
  }>();
  readonly projectUpdate = output<Partial<ProjectModel>>();
  readonly nextStep = output<void>();
  readonly previousStep = output<void>();
  readonly generatingStateChanged = output<boolean>();

  // State management
  protected isGenerating = signal(false);
  protected generationProgress = signal(0);
  protected currentStep = signal('');
  protected colorPalettes = signal<ColorModel[]>([]);
  protected typographyOptions = signal<TypographyModel[]>([]);
  protected error = signal<string | null>(null);
  protected hasGenerated = signal(false);
  protected selectedColorId = signal<string | null>(null);

  // Authentication modal state
  protected showLoginModal = signal(false);

  // Color customization state
  protected showColorCustomizer = signal(false);
  protected customizedColor = signal<ColorModel | null>(null);

  private setGeneratingState(generating: boolean): void {
    this.isGenerating.set(generating);
    this.generatingStateChanged.emit(generating);
  }

  ngOnInit() {
    const branding = this.project().analysisResultModel?.branding;
    const generatedColors = branding?.generatedColors;

    if (!generatedColors || generatedColors.length === 0) {
      this.checkAuthAndGenerate();
    } else {
      // Reprise : réémettre l'état déjà généré (typographie pas forcément présente)
      const generatedTypography = branding?.generatedTypography ?? [];

      this.colorPalettes.set(generatedColors);
      this.typographyOptions.set(generatedTypography);

      if (branding?.colors?.id) {
        this.selectColor(branding.colors.id);
      } else if (generatedColors.length > 0) {
        this.selectColor(generatedColors[0].id);
      }

      this.colorsGenerated.emit(generatedColors);
      this.typographyGenerated.emit(generatedTypography);
      this.colorsAndTypographyGenerated.emit({
        colors: generatedColors,
        typography: generatedTypography,
        project: this.project(),
      });

      this.hasGenerated.set(true);
      this.setGeneratingState(false);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected async generateColors(): Promise<void> {
    this.setGeneratingState(true);
    this.error.set(null);
    this.generationProgress.set(0);

    try {
      // Workflow import logo : uniquement si le SVG ET les couleurs extraites sont
      // réellement disponibles. Sinon (donnée partielle, course de sauvegarde…),
      // repli sur la génération normale au lieu d'un appel API voué au 400.
      const branding = this.project().analysisResultModel?.branding;
      const logoSvg = branding?.logo?.svg;
      const logoColors = branding?.importedLogoColors;
      const isFromImport = !!logoSvg && !!logoColors && logoColors.length > 0;

      if (isFromImport) {
        console.log('Generating colors from imported logo:', logoColors);

        this.brandingService
          .generateColorsAndTypographyFromLogo(this.project(), logoSvg, logoColors)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              console.log('Colors and typography from logo generated:', response);
              this.handleGenerationResponse(response);
            },
            error: (error) => {
              console.error('Error generating colors from logo:', error);
              this.error.set(
                this.translate.instant('dashboard.colorSelection.errors.generationFailed'),
              );
              this.setGeneratingState(false);
            },
          });
      } else {
        // Workflow normal : utiliser generateColorsAndTypography
        console.log('Generating colors normally');

        this.brandingService
          .generateColorsAndTypography(this.project())
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              console.log('Colors and typography generated:', response);
              this.handleGenerationResponse(response);
            },
            error: (error) => {
              console.error('Error generating colors and typography:', error);
              this.error.set(
                this.translate.instant('dashboard.colorSelection.errors.generationFailed'),
              );
              this.setGeneratingState(false);
            },
          });
      }
    } catch (error) {
      console.error('Error in color generation:', error);
      this.error.set(this.translate.instant('dashboard.colorSelection.errors.generationFailed'));
      this.setGeneratingState(false);
    }
  }

  /**
   * Gère la réponse de génération (commune aux deux workflows)
   */
  private handleGenerationResponse(response: {
    colors: ColorModel[];
    typography: TypographyModel[];
    project?: ProjectModel;
  }): void {
    const colors = Array.isArray(response.colors) ? response.colors : [];
    const typography = Array.isArray(response.typography) ? response.typography : [];

    // Réponse malformée : afficher l'erreur (avec retry) plutôt qu'une palette vide
    if (colors.length === 0) {
      this.error.set(this.translate.instant('dashboard.colorSelection.errors.generationFailed'));
      this.setGeneratingState(false);
      return;
    }

    this.colorPalettes.set(colors);
    this.typographyOptions.set(typography);
    this.colorsGenerated.emit(colors);

    // Emit typography as well
    this.typographyGenerated.emit(typography);

    // Emit both colors and typography together
    this.colorsAndTypographyGenerated.emit({
      colors,
      typography,
      project: this.project(),
    });

    // Update project with both colors and typography
    this.projectUpdate.emit({
      analysisResultModel: {
        ...this.project().analysisResultModel,
        branding: {
          ...this.project().analysisResultModel?.branding,
          generatedColors: colors,
          generatedTypography: typography,
        },
      },
    });

    this.hasGenerated.set(true);
    this.setGeneratingState(false);

    // Auto-select the first palette if none selected
    if (colors.length > 0 && !this.selectedColorId()) {
      this.selectColor(colors[0].id);
    }
  }

  protected selectColor(colorId: string): void {
    this.selectedColorId.set(colorId);
    this.colorSelected.emit(colorId);

    // Find the selected color and update the project
    const selectedColor = this.colorPalettes().find((color) => color.id === colorId);
    if (selectedColor) {
      // Save the selected color for potential customization
      this.customizedColor.set(null); // Reset customization when selecting new color

      this.projectUpdate.emit({
        analysisResultModel: {
          ...this.project().analysisResultModel,
          branding: {
            ...this.project().analysisResultModel?.branding,
            generatedColors: this.colorPalettes(),
            colors: selectedColor,
            generatedTypography: this.typographyOptions(),
          },
        },
      });
    }
  }

  protected openColorCustomizer(): void {
    const selectedColor = this.colorPalettes().find((color) => color.id === this.selectedColorId());
    if (selectedColor) {
      this.showColorCustomizer.set(true);
    }
  }

  protected onColorsCustomized(updatedColor: ColorModel): void {
    console.log('Colors customized:', updatedColor);
    this.customizedColor.set(updatedColor);
    this.showColorCustomizer.set(false);

    // Update the palette in the list with the customized colors
    const updatedPalettes = this.colorPalettes().map((palette) =>
      palette.id === updatedColor.id ? updatedColor : palette,
    );
    this.colorPalettes.set(updatedPalettes);

    // Update the project with customized colors
    this.projectUpdate.emit({
      analysisResultModel: {
        ...this.project().analysisResultModel,
        branding: {
          ...this.project().analysisResultModel?.branding,
          generatedColors: updatedPalettes,
          colors: updatedColor,
          generatedTypography: this.typographyOptions(),
        },
      },
    });
  }

  protected closeColorCustomizer(): void {
    this.showColorCustomizer.set(false);
  }

  protected getSelectedColor(): ColorModel | undefined {
    return this.colorPalettes().find((color) => color.id === this.selectedColorId());
  }

  protected async retryGeneration(): Promise<void> {
    await this.checkAuthAndGenerate();
  }

  /**
   * Check if user is authenticated before generating colors
   */
  protected checkAuthAndGenerate(): void {
    const user = this.authService.getCurrentUser();

    if (!user) {
      // User is not authenticated, show login modal
      this.showLoginModal.set(true);
    } else {
      // User is authenticated, proceed with generation
      this.generateColors();
    }
  }

  /**
   * Handle successful login from modal
   */
  protected onLoginSuccess(): void {
    this.showLoginModal.set(false);

    this.generateColors();
  }

  /**
   * Close login modal
   */
  protected closeLoginModal(): void {
    this.showLoginModal.set(false);
  }

  protected goToPreviousStep(): void {
    this.previousStep.emit();
  }

  /**
   * Bandes de nuancier sous la couleur principale, dans l'ordre d'usage.
   * Le poids règle la largeur : la secondaire et l'accent dominent, le texte
   * n'a besoin que d'une tranche.
   */
  protected readonly bands = [
    { key: 'secondary', label: 'dashboard.colorSelection.swatches.secondary', weight: 1.2 },
    { key: 'accent', label: 'dashboard.colorSelection.swatches.accent', weight: 1 },
    { key: 'background', label: 'dashboard.colorSelection.swatches.background', weight: 1 },
    { key: 'text', label: 'dashboard.colorSelection.swatches.text', weight: 0.7 },
  ] as const;

  /** Trois cartes squelettes pendant la génération (l'IA propose trois palettes). */
  protected readonly skeletonCards = [0, 1, 2];

  /**
   * Encre lisible posée sur une couleur de la marque (le bouton de l'aperçu) :
   * sombre sur une couleur claire, blanche sur une couleur foncée, d'après la
   * luminance relative WCAG.
   */
  protected readableOn(hex: string): string {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex?.trim() ?? '');
    if (!m) return '#ffffff';
    const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    const [r, g, b] = [0, 2, 4].map((i) => {
      const v = parseInt(full.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.4 ? '#111111' : '#ffffff';
  }
}
