import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../services/project.service';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LogoChoiceComponent } from '../create-project/components/logo-choice/logo-choice';
import { ColorSelectionComponent } from '../create-project/components/color-selection/color-selection';
import { TypographySelectionComponent } from '../create-project/components/typography-selection/typography-selection';
import { LogoVariationsComponent } from '../create-project/components/logo-variations/logo-variations';
import { LogoModel } from '../../models/logo.model';
import { ColorModel, TypographyModel } from '../../models/brand-identity.model';

/**
 * Workflow de complétion de la marque (depuis le branding-required-blocker).
 *
 * Si l'utilisateur importe son logo :
 *   logo-choice → colors → typography → Dashboard
 *
 * Si l'utilisateur génère avec l'IA :
 *   logo-choice → colors → typography → logo-variations → Dashboard
 */
@Component({
  selector: 'app-complete-branding',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LogoChoiceComponent,
    ColorSelectionComponent,
    TypographySelectionComponent,
    LogoVariationsComponent,
  ],
  templateUrl: './complete-branding.html',
  styleUrl: './complete-branding.css',
})
export class CompleteBrandingPage implements OnInit {
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);

  @ViewChild(LogoChoiceComponent) logoChoiceComponent?: LogoChoiceComponent;
  @ViewChild(TypographySelectionComponent)
  typographyComponent?: TypographySelectionComponent;

  // ─── State ──────────────────────────────────────────────────────────────────

  protected readonly currentStepIndex = signal<number>(0);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isLoading = signal<boolean>(true);

  /** 'import' | 'ai' | null — défini quand l'utilisateur fait son choix */
  protected readonly logoChoice = signal<'import' | 'ai' | null>(null);

  /** true dès que le logo importé est prêt (SVG + couleurs extraites) */
  protected readonly logoImportComplete = signal<boolean>(false);

  /** true dès qu'une typographie est sélectionnée */
  protected readonly typographySelectionValid = signal<boolean>(false);

  // ─── Steps (dynamiques selon le choix logo) ─────────────────────────────────

  /**
   * La liste des steps dépend du workflow choisi :
   * - import  : logo-choice | colors | typography
   * - ai      : logo-choice | colors | typography | logo-variations
   * - inconnu : logo-choice seulement
   */
  protected get steps(): { id: string; label: string }[] {
    const base = [
      {
        id: 'logo-choice',
        label: this.translate.instant('dashboard.completeBranding.steps.logoChoice'),
      },
      {
        id: 'colors',
        label: this.translate.instant('dashboard.completeBranding.steps.colors'),
      },
      {
        id: 'typography',
        label: this.translate.instant('dashboard.completeBranding.steps.typography'),
      },
    ];

    if (this.logoChoice() === 'ai') {
      base.push({
        id: 'logo-variations',
        label: this.translate.instant('dashboard.completeBranding.steps.logoVariations'),
      });
    }

    return base;
  }

  // ─── Computed ───────────────────────────────────────────────────────────────

  protected readonly currentStep = computed(() => this.steps[this.currentStepIndex()]);
  protected readonly canGoPrevious = computed(() => this.currentStepIndex() > 0);
  protected readonly isLastStep = computed(
    () => this.currentStepIndex() === this.steps.length - 1,
  );
  protected readonly canGoNext = computed(() => this.isCurrentStepValid());

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadProject();
  }

  private loadProject(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.router.navigate(['/project/dashboard']);
      return;
    }

    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.router.navigate(['/project/dashboard']);
      },
    });
  }

  // ─── Step Validation ────────────────────────────────────────────────────────

  private isCurrentStepValid(): boolean {
    switch (this.currentStep()?.id) {
      case 'logo-choice':
        // Valide si import complet OU choix IA fait
        return this.logoImportComplete() || this.logoChoice() === 'ai';
      case 'colors':
        // La color-selection gère elle-même la génération ; on laisse toujours passer
        return true;
      case 'typography':
        return this.typographySelectionValid();
      case 'logo-variations':
        // Dernier step IA : on finalize manuellement
        return true;
      default:
        return true;
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  protected navigateToStep(index: number): void {
    if (index >= 0 && index < this.steps.length) {
      this.currentStepIndex.set(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected goToNextStep(): void {
    // Sur l'étape logo-choice avec import, on déclenche le save du logo d'abord
    if (this.currentStep()?.id === 'logo-choice' && this.logoChoice() === 'import') {
      this.logoChoiceComponent?.continueWithImportedLogo();
      return;
    }

    // Sur l'étape typography, on sauvegarde la sélection
    if (this.currentStep()?.id === 'typography') {
      this.saveTypographySelection();
    }

    if (this.isLastStep()) {
      this.finalize();
      return;
    }

    this.navigateToStep(this.currentStepIndex() + 1);
  }

  protected goToPreviousStep(): void {
    if (this.canGoPrevious()) {
      this.navigateToStep(this.currentStepIndex() - 1);
    }
  }

  protected readonly isFinalizing = signal<boolean>(false);

  protected finalize(): void {
    const current = this.project();
    if (!current?.id || this.isFinalizing()) return;

    // ── 1. Sauvegarder la typo si pas encore fait ──
    if (!current.analysisResultModel?.branding?.typography) {
      const data = this.typographyComponent?.prepareTypographyData();
      if (data) {
        this.onProjectUpdate(data);
      }
    }

    // ── 2. Récupérer le projet mis à jour après l'éventuel update ci-dessus ──
    const proj = this.project()!;
    const branding = proj.analysisResultModel?.branding;

    // ── 3. Auto-sélectionner la première couleur si aucune n'est choisie ──
    const missingColor = !branding?.colors && branding?.generatedColors?.length;
    const autoColor = missingColor ? branding!.generatedColors![0] : null;

    // ── 4. Auto-sélectionner la première typographie si aucune n'est choisie ──
    const missingTypo = !branding?.typography && branding?.generatedTypography?.length;
    const autoTypo = missingTypo ? branding!.generatedTypography![0] : null;

    // ── 5. Construire le patch final ──
    const brandingPatch: Record<string, unknown> = {};
    if (autoColor) brandingPatch['colors'] = autoColor;
    if (autoTypo) brandingPatch['typography'] = autoTypo;

    const hasPatch = Object.keys(brandingPatch).length > 0;

    this.isFinalizing.set(true);

    if (hasPatch) {
      // Mettre à jour le signal local
      this.project.set({
        ...proj,
        analysisResultModel: {
          ...proj.analysisResultModel,
          branding: {
            ...branding,
            ...brandingPatch,
          },
        },
      } as ProjectModel);

      const patch: Partial<ProjectModel> = {
        analysisResultModel: {
          ...proj.analysisResultModel,
          branding: {
            ...branding,
            ...brandingPatch,
          },
        },
      };

      this.projectService.updateProject(proj.id!, patch).subscribe({
        next: () => {
          this.isFinalizing.set(false);
          this.router.navigate(['/project/dashboard']);
        },
        error: (err) => {
          console.error('Failed to finalize branding:', err);
          this.isFinalizing.set(false);
          // On redirige quand même pour ne pas bloquer l'utilisateur
          this.router.navigate(['/project/dashboard']);
        },
      });
    } else {
      // Rien à patcher, on redirige directement
      this.isFinalizing.set(false);
      this.router.navigate(['/project/dashboard']);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private saveTypographySelection(): void {
    const data = this.typographyComponent?.prepareTypographyData();
    if (data) {
      this.onProjectUpdate(data);
    }
  }

  protected isStepActive(id: string): boolean {
    return this.currentStep()?.id === id;
  }

  protected get selectedLogo(): LogoModel | null {
    return this.project()?.analysisResultModel?.branding?.logo ?? null;
  }

  // ─── Child component handlers ───────────────────────────────────────────────

  /** Appelé par logo-choice quand l'utilisateur clique sur une des deux cartes */
  protected onLogoChoiceMade(choice: 'import' | 'ai'): void {
    this.logoChoice.set(choice);

    if (choice === 'ai') {
      // Choix IA : aller directement à la step suivante (colors)
      this.navigateToStep(1);
    }
    // Choix import : l'utilisateur doit uploader son logo, on reste sur l'étape
  }

  /** Appelé par logo-choice quand le logo importé est prêt (SVG + couleurs) */
  protected onLogoImportComplete(isComplete: boolean): void {
    this.logoImportComplete.set(isComplete);
  }

  /**
   * Appelé par logo-choice quand il émet nextStep (après continueWithImportedLogo).
   * On avance manuellement vers colors.
   */
  protected onLogoChoiceNextStep(): void {
    this.navigateToStep(1);
  }

  /** Appelé par logo-variations quand les variations sont générées */
  protected onVariationsGenerated(): void {
    // On laisse l'utilisateur voir les variations, le bouton "Terminer" est visible
  }

  /** Mise à jour du projet depuis n'importe quel step enfant */
  protected onProjectUpdate(updates: Partial<ProjectModel>): void {
    const current = this.project();
    if (!current) return;

    const updated: ProjectModel = {
      ...current,
      ...updates,
      analysisResultModel: {
        ...current.analysisResultModel,
        ...updates.analysisResultModel,
        branding: {
          ...current.analysisResultModel?.branding,
          ...updates.analysisResultModel?.branding,
        },
      },
    };
    this.project.set(updated);

    if (current.id) {
      this.projectService.updateProject(current.id, updates).subscribe({
        error: (err) => console.error('Failed to update project branding:', err),
      });
    }
  }

  protected onProjectFullUpdate(updated: ProjectModel): void {
    this.project.set(updated);
    if (updated.id) {
      this.projectService.updateProject(updated.id, updated).subscribe({
        error: (err) => console.error('Failed to update project:', err),
      });
    }
  }

  protected onColorSelected(_colorId: string): void {
    // optionnel : tracking local
  }

  protected onTypographySelectionChanged(isValid: boolean): void {
    this.typographySelectionValid.set(isValid);
  }
}
