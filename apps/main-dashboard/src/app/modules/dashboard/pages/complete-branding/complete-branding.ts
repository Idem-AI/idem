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
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../services/project.service';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LogoChoiceComponent } from '../create-project/components/logo-choice/logo-choice';
import { ColorSelectionComponent } from '../create-project/components/color-selection/color-selection';
import { TypographySelectionComponent } from '../create-project/components/typography-selection/typography-selection';
import { LogoVariationsComponent } from '../create-project/components/logo-variations/logo-variations';
import { LogoSelectionComponent } from '../create-project/components/logo-selection/logo-selection';
import { LogoPreferences } from '../create-project/components/logo-preferences/logo-preferences';
import { SafeHtmlPipe } from '../projects-list/safehtml.pipe';

import { LogoModel, LogoPreferencesModel } from '../../models/logo.model';
import { ColorModel, TypographyModel } from '../../models/brand-identity.model';

/**
 * Workflow de complétion de la marque.
 *
 * Workflow A — Import :
 *   logo-choice → colors → typography → overview → dashboard
 *
 * Workflow B — IA :
 *   logo-choice → colors → typography → logo-preferences → logo-selection → logo-variations → overview → dashboard
 *
 * Un aperçu (overview) est présent dans les deux workflows avec le bouton "Terminer".
 */
@Component({
  selector: 'app-complete-branding',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    SafeHtmlPipe,
    LogoChoiceComponent,
    ColorSelectionComponent,
    TypographySelectionComponent,
    LogoVariationsComponent,
    LogoSelectionComponent,
    LogoPreferences,
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
  @ViewChild(TypographySelectionComponent) typographyComponent?: TypographySelectionComponent;

  // ─── State ──────────────────────────────────────────────────────────────────

  protected readonly currentStepIndex = signal<number>(0);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly isFinalizing = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);

  /** 'import' | 'ai' | null — défini dès le premier choix */
  protected readonly logoChoice = signal<'import' | 'ai' | null>(null);

  /** true dès que le logo importé est prêt (SVG + couleurs) */
  protected readonly logoImportComplete = signal<boolean>(false);

  /** true dès qu'une couleur est sélectionnée */
  protected readonly colorSelected = signal<boolean>(false);

  /** true pendant la génération des couleurs */
  protected readonly colorGenerating = signal<boolean>(true);

  /** true dès qu'une typographie est sélectionnée */
  protected readonly typographySelected = signal<boolean>(false);

  /** Préférences IA (stockées avant de passer à la génération) */
  protected readonly aiLogoPreferences = signal<LogoPreferencesModel | null>(null);

  /**
   * File de sauvegarde séquentielle : les updateProject partent dans l'ordre
   * d'émission, une requête à la fois. Sans cela, plusieurs écritures
   * concurrentes (logo importé, couleurs générées, préférences…) arrivaient
   * dans un ordre aléatoire et la dernière pouvait écraser les autres.
   */
  private saveQueue: Promise<void> = Promise.resolve();

  // ─── Steps dynamiques selon le workflow ─────────────────────────────────────

  protected get steps(): { id: string; label: string }[] {
    const choice = this.logoChoice();

    if (choice === 'import') {
      return [
        { id: 'logo-choice',  label: this.t('steps.logoChoice') },
        { id: 'colors',       label: this.t('steps.colors') },
        { id: 'typography',   label: this.t('steps.typography') },
        { id: 'overview',     label: this.t('steps.overview') },
      ];
    }

    if (choice === 'ai') {
      return [
        { id: 'logo-choice',       label: this.t('steps.logoChoice') },
        { id: 'colors',            label: this.t('steps.colors') },
        { id: 'typography',        label: this.t('steps.typography') },
        { id: 'logo-preferences',  label: this.t('steps.logoPreferences') },
        { id: 'logo-selection',    label: this.t('steps.logoSelection') },
        { id: 'logo-variations',   label: this.t('steps.logoVariations') },
        { id: 'overview',          label: this.t('steps.overview') },
      ];
    }

    // Avant le choix : une seule étape
    return [{ id: 'logo-choice', label: this.t('steps.logoChoice') }];
  }

  private t(key: string): string {
    return this.translate.instant(`dashboard.completeBranding.${key}`);
  }

  // ─── Computed ───────────────────────────────────────────────────────────────

  protected readonly currentStep = computed(() => this.steps[this.currentStepIndex()]);
  protected readonly canGoPrevious = computed(() => this.currentStepIndex() > 0);
  protected readonly isLastStep = computed(() => this.currentStepIndex() === this.steps.length - 1);
  protected readonly isOverviewStep = computed(() => this.currentStep()?.id === 'overview');
  protected readonly canGoNext = computed(() => this.isCurrentStepValid());

  /** Logo sélectionné (import ou IA) */
  protected get selectedLogo(): LogoModel | null {
    return this.project()?.analysisResultModel?.branding?.logo ?? null;
  }

  /**
   * Logos générés par l'IA uniquement — exclut le logo importé qui a pu être
   * historiquement recopié dans generatedLogos, pour que logo-selection ne
   * l'affiche pas comme un concept IA (ce qui bloquait la vraie génération).
   */
  protected get aiGeneratedLogos(): LogoModel[] {
    const logos = this.project()?.analysisResultModel?.branding?.generatedLogos ?? [];
    return logos.filter((l: LogoModel) => !l.id?.startsWith('imported-'));
  }

  /** Couleur sélectionnée */
  protected get selectedColor(): ColorModel | null {
    return this.project()?.analysisResultModel?.branding?.colors ?? null;
  }

  /** Typographie sélectionnée */
  protected get selectedTypography(): TypographyModel | null {
    return this.project()?.analysisResultModel?.branding?.typography ?? null;
  }

  /** SVG du logo — détecte si inline ou URL */
  protected readonly logoIsInline = computed(() => {
    const svg = this.selectedLogo?.svg;
    return !!svg && svg.trimStart().startsWith('<');
  });

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

        // Restaurer l'étape et l'état en fonction des données existantes
        const branding = project?.analysisResultModel?.branding;
        if (branding) {
          const hasAiPreferences = !!branding.logoPreferences;
          // Ne compter que les VRAIS logos générés par l'IA : d'anciennes données
          // pouvaient contenir le logo importé dans generatedLogos, ce qui basculait
          // à tort un utilisateur « tel quel » dans le workflow IA à la reprise.
          const aiLogos = (branding.generatedLogos ?? []).filter(
            (l: LogoModel) => !l.id?.startsWith('imported-'),
          );
          const hasGeneratedLogos = aiLogos.length > 0;

          if (hasAiPreferences || hasGeneratedLogos) {
            this.logoChoice.set('ai');
            if (branding.logoPreferences) {
              this.aiLogoPreferences.set(branding.logoPreferences);
            }
          } else if (branding.logo) {
            this.logoChoice.set('import');
            this.logoImportComplete.set(true);
          }

          if (branding.generatedColors && branding.generatedColors.length > 0) {
            this.colorGenerating.set(false);
          }

          let targetStepIndex = 0;
          const choice = this.logoChoice();

          if (choice === 'import') {
            if (branding.colors) this.colorSelected.set(true);
            if (branding.typography) this.typographySelected.set(true);

            if (branding.logo && branding.colors && branding.typography) {
              targetStepIndex = 3; // overview
            } else if (branding.logo && branding.colors) {
              targetStepIndex = 2; // typography
            } else if (branding.logo) {
              targetStepIndex = 1; // colors
            }
          } else if (choice === 'ai') {
            if (branding.colors) this.colorSelected.set(true);
            if (branding.typography) this.typographySelected.set(true);

            // Voie « améliorer mon logo » : le logo importé sert de référence à
            // l'analyse mais ne compte pas comme un logo généré par l'IA
            const logoIsImported = !!branding.logo?.id?.startsWith('imported-');
            const hasLogo = !!branding.logo && !logoIsImported;
            const v = branding.logo?.variations?.withText;
            const hasAllVariations = hasLogo && !!v && !!v.lightBackground && !!v.darkBackground && !!v.monochrome;

            if (hasLogo && hasAllVariations) {
              targetStepIndex = 6; // overview
            } else if (hasLogo && !hasAllVariations) {
              // Logo sélectionné mais 3 déclinaisons non entièrement générées
              // → aller à logo-variations pour générer ou réessayer les déclinaisons manquantes
              targetStepIndex = 5; // logo-variations
            } else if (hasGeneratedLogos && !hasLogo) {
              // Des logos ont été générés mais aucun n'a été sélectionné
              // → aller directement à logo-selection avec les logos déjà générés
              targetStepIndex = 4; // logo-selection
            } else if (branding.logoPreferences) {
              targetStepIndex = 4; // logo-selection
            } else if (branding.typography) {
              targetStepIndex = 3; // logo-preferences
            } else if (branding.colors) {
              targetStepIndex = 2; // typography
            } else {
              targetStepIndex = 1; // colors
            }
          }

          this.currentStepIndex.set(targetStepIndex);
        }
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
        return this.logoImportComplete() || this.logoChoice() === 'ai';
      case 'colors':
        return (this.colorSelected() || !!this.selectedColor) && !this.colorGenerating();
      case 'typography':
        return this.typographySelected();
      case 'logo-preferences':
        return true; // logo-preferences se valide en émettant preferencesSelected
      case 'logo-selection':
        return !!this.selectedLogo;
      case 'logo-variations': {
        const v = this.selectedLogo?.variations?.withText;
        return !!v && !!v.lightBackground && !!v.darkBackground && !!v.monochrome;
      }
      case 'overview':
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
    const stepId = this.currentStep()?.id;

    if (stepId === 'logo-choice' && this.logoChoice() === 'import') {
      // Sauvegarder le logo + variations importés avant d'avancer
      this.logoChoiceComponent?.continueWithImportedLogo();
      return; // La navigation est déclenchée par l'event (nextStep) de logo-choice
    }

    if (stepId === 'typography') {
      this.saveTypographySelection();
    }

    this.navigateToStep(this.currentStepIndex() + 1);
  }

  protected goToPreviousStep(): void {
    if (this.canGoPrevious()) {
      this.navigateToStep(this.currentStepIndex() - 1);
    }
  }

  // ─── Finalization ────────────────────────────────────────────────────────────

  protected finalize(): void {
    const proj = this.project();
    if (!proj?.id || this.isFinalizing()) return;

    const branding = proj.analysisResultModel?.branding;

    // Auto-sélectionner la première couleur si aucune
    const autoColor = !branding?.colors && branding?.generatedColors?.length
      ? branding.generatedColors[0]
      : null;

    // Auto-sélectionner la première typo si aucune
    const autoTypo = !branding?.typography && branding?.generatedTypography?.length
      ? branding.generatedTypography[0]
      : null;

    const patch: Record<string, unknown> = {
      isComplete: true
    };
    if (autoColor) patch['colors'] = autoColor;
    if (autoTypo) patch['typography'] = autoTypo;

    this.isFinalizing.set(true);

    const updated = {
      ...proj,
      analysisResultModel: {
        ...proj.analysisResultModel,
        branding: { ...branding, ...patch },
      },
    } as ProjectModel;
    this.project.set(updated);

    const doNavigate = () => {
      this.isFinalizing.set(false);
      this.router.navigate(['/project/dashboard']);
    };

    // Passe par la file séquentielle : la finalisation (isComplete) ne doit pas
    // pouvoir être doublée puis écrasée par une écriture précédente en vol.
    this.persistProject(proj.id!, { analysisResultModel: updated.analysisResultModel }, doNavigate);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  protected isStepActive(id: string): boolean {
    return this.currentStep()?.id === id;
  }

  private saveTypographySelection(): void {
    const data = this.typographyComponent?.prepareTypographyData();
    if (data) this.onProjectUpdate(data);
  }

  /**
   * Persiste le projet via la file séquentielle. `onDone` (optionnel) est
   * appelé une fois la requête terminée (succès ou échec).
   */
  private persistProject(projectId: string, data: Partial<ProjectModel>, onDone?: () => void): void {
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        await firstValueFrom(this.projectService.updateProject(projectId, data));
      } catch (err) {
        console.error('Failed to update project:', err);
      } finally {
        onDone?.();
      }
    });
  }

  // ─── Child component handlers ────────────────────────────────────────────────

  /** Utilisateur choisit import ou IA */
  protected onLogoChoiceMade(choice: 'import' | 'ai'): void {
    this.logoChoice.set(choice);
    if (choice === 'ai') {
      // Voie « améliorer mon logo » : les préférences issues de l'analyse
      // ont déjà été poussées dans le projet par logo-choice
      const analysisPrefs = this.project()?.analysisResultModel?.branding?.logoPreferences;
      if (analysisPrefs && !this.aiLogoPreferences()) {
        this.aiLogoPreferences.set(analysisPrefs);
      }
      // Pour l'IA, on avance directement vers colors
      this.navigateToStep(1);
    }
  }

  /** Import complet (SVG + couleurs prêts) */
  protected onLogoImportComplete(complete: boolean): void {
    this.logoImportComplete.set(complete);
  }

  /** logo-choice émet nextStep après continueWithImportedLogo */
  protected onLogoChoiceNextStep(): void {
    this.navigateToStep(1);
  }

  /** Couleur choisie */
  protected onColorSelected(_colorId: string): void {
    this.colorSelected.set(true);
  }

  /** État de génération des couleurs */
  protected onColorGeneratingStateChanged(generating: boolean): void {
    this.colorGenerating.set(generating);
  }

  /** Typographie valide / invalide */
  protected onTypographySelectionChanged(valid: boolean): void {
    this.typographySelected.set(valid);
  }

  /** Préférences logo AI sélectionnées → avancer automatiquement après sauvegarde */
  protected onLogoPreferencesSelected(prefs: LogoPreferencesModel): void {
    this.aiLogoPreferences.set(prefs);
    
    // Sauvegarder les préférences dans le projet pour que le backend puisse les lire
    const current = this.project();
    if (!current || !current.id) {
      this.navigateToStep(this.currentStepIndex() + 1);
      return;
    }

    const updates: Partial<ProjectModel> = {
      analysisResultModel: {
        branding: {
          logoPreferences: prefs
        } as any
      }
    };

    // Mettre à jour l'état local immédiatement
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

    // Persister et attendre la fin de la requête avant de naviguer
    // pour éviter les conditions de course avec la génération
    this.isSaving.set(true);
    this.persistProject(current.id, updated, () => {
      this.isSaving.set(false);
      this.navigateToStep(this.currentStepIndex() + 1);
    });
  }

  /** Logo AI généré et sélectionné */
  protected onLogoSelected(_logoId: string): void {
    // Le projet est mis à jour via onProjectFullUpdate depuis logo-selection
  }

  /** Variations générées */
  protected onVariationsGenerated(): void {
    // Le composant logo-variations appelle (nextStep) → finalize() ou avancer
  }

  /** Mise à jour partielle du projet (branding patch) */
  protected onProjectUpdate(updates: Partial<ProjectModel>): void {
    const current = this.project();
    if (!current) return;

    const updated: ProjectModel = {
      ...current,
      ...updates,
      // Ne jamais laisser une réponse API remplacer l'id du projet en cours
      id: current.id,
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
      this.persistProject(current.id, updated);
    }
  }

  /** Mise à jour complète du projet (depuis logo-selection / logo-variations) */
  protected onProjectFullUpdate(updated: ProjectModel): void {
    this.project.set(updated);
    if (updated.id) {
      this.persistProject(updated.id, updated);
    }
  }
}
