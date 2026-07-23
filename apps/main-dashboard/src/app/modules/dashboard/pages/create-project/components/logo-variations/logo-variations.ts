import {
  Component,
  input,
  output,
  signal,
  computed,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafeHtmlPipe } from '../../../projects-list/safehtml.pipe';
import { LogoModel, LogoVariations } from '../../../../models/logo.model';
import { ProjectModel } from '@idem/shared-models';
import { CarouselComponent } from '../../../../../../shared/components/carousel/carousel.component';

import { Subject, takeUntil } from 'rxjs';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface DisplayVariation {
  id: string;
  background: 'lightBackground' | 'darkBackground' | 'monochrome';
  label: string;
  svgContent: string;
  description: string;
  backgroundColor: string;
}

type VariationKind = 'lightBackground' | 'darkBackground' | 'monochrome';

type VariationSlotStatus =
  | 'pending'
  | 'generating'
  | 'generated'
  | 'critiquing'
  | 'revising'
  | 'final'
  | 'cancelled'
  | 'error';

/** Avis de l'agent critique sur une déclinaison, affiché en temps réel */
interface VariationCritiqueView {
  verdict: 'pass' | 'fail';
  score: number;
  summary: string;
  remarks: { criterion: string; issue: string }[];
}

/** État live d'une déclinaison pendant la génération streamée */
interface VariationSlot {
  kind: VariationKind;
  status: VariationSlotStatus;
  svg: string | null;
  critique: VariationCritiqueView | null;
  revised?: boolean;
}

const VARIATION_DISPLAY: Record<VariationKind, { backgroundColor: string }> = {
  lightBackground: { backgroundColor: '#ffffff' },
  darkBackground: { backgroundColor: '#1f2937' },
  monochrome: { backgroundColor: '#f3f4f6' },
};

@Component({
  selector: 'app-logo-variations',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeHtmlPipe, CarouselComponent, TranslateModule],
  templateUrl: './logo-variations.html',
  styleUrl: './logo-variations.css',
})
export class LogoVariationsComponent implements OnInit, OnDestroy {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly destroy$ = new Subject<void>();
  private readonly translate = inject(TranslateService);

  // Inputs
  readonly selectedLogo = input.required<LogoModel>();
  readonly project = input.required<ProjectModel>();

  // Outputs
  readonly variationsGenerated = output<LogoVariations>();
  readonly projectUpdate = output<ProjectModel>();
  readonly nextStep = output<void>();

  // Internal state
  protected readonly isGenerating = signal(false);
  protected readonly generatedVariations = signal<DisplayVariation[]>([]);
  protected readonly generationProgress = signal(0);
  protected readonly currentStep = signal('');
  protected readonly estimatedTime = signal('1-2 minutes');
  protected readonly hasStartedGeneration = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isCompleted = signal(false);

  // Live generation state (SSE) : un slot par déclinaison
  protected readonly liveMode = signal(false);
  protected readonly variationSlots = signal<VariationSlot[]>([]);

  /** Signal true si une ou plusieurs déclinaisons ont échoué ou ne sont pas terminées */
  protected readonly hasFailedSlots = computed(() => {
    const slots = this.variationSlots();
    return slots.length > 0 && slots.some((s) => s.status === 'error' || (s.status !== 'final' && !this.isGenerating()));
  });

  /** Tableau de bord live affiché pendant la génération streamée ou en cas de reprise/échec */
  protected readonly showLiveBoard = computed(() => {
    return this.liveMode() || (this.hasStartedGeneration() && !this.isCompleted());
  });

  // Computed properties
  protected readonly shouldShowLoader = computed(() => {
    return this.isGenerating() && this.generatedVariations().length === 0 && !this.liveMode();
  });

  protected readonly shouldShowVariations = computed(() => {
    return this.generatedVariations().length === 3 && !this.showLiveBoard();
  });

  protected readonly shouldShowInitialPrompt = computed(() => {
    return !this.shouldShowLoader() && !this.shouldShowVariations() && !this.hasStartedGeneration() && !this.showLiveBoard();
  });

  protected readonly canProceed = computed(() => {
    return this.isCompleted() && this.generatedVariations().length === 3;
  });

  // Track function for carousel
  protected readonly trackVariation = (index: number, variation: DisplayVariation): string => {
    return variation.id;
  };

  // Track function for skeleton loading
  protected readonly trackSkeleton = (index: number, item: number): string => {
    return `skeleton-${index}`;
  };

  ngOnInit(): void {
    const existingVariations = this.project().analysisResultModel?.branding?.logo?.variations;
    if (existingVariations?.withText) {
      console.log('Using existing logo variations:', existingVariations);
      const withText = existingVariations.withText;
      const variations: DisplayVariation[] = [];

      if (withText.lightBackground) {
        variations.push({
          id: 'lightBackground',
          background: 'lightBackground',
          label: this.translate.instant('dashboard.logoVariations.labels.lightBackground'),
          svgContent: withText.lightBackground,
          description: this.translate.instant('dashboard.logoVariations.descriptions.lightBackground'),
          backgroundColor: '#ffffff',
        });
      }
      if (withText.darkBackground) {
        variations.push({
          id: 'darkBackground',
          background: 'darkBackground',
          label: this.translate.instant('dashboard.logoVariations.labels.darkBackground'),
          svgContent: withText.darkBackground,
          description: this.translate.instant('dashboard.logoVariations.descriptions.darkBackground'),
          backgroundColor: '#1f2937',
        });
      }
      if (withText.monochrome) {
        variations.push({
          id: 'monochrome',
          background: 'monochrome',
          label: this.translate.instant('dashboard.logoVariations.labels.monochrome'),
          svgContent: withText.monochrome,
          description: this.translate.instant('dashboard.logoVariations.descriptions.monochrome'),
          backgroundColor: '#f3f4f6',
        });
      }

      this.generatedVariations.set(variations);

      // N'est considéré comme complété QUE si les 3 déclinaisons sont toutes présentes !
      if (variations.length === 3) {
        this.isCompleted.set(true);
        this.liveMode.set(false);
        this.variationsGenerated.emit(existingVariations);
      } else {
        this.isCompleted.set(false);
        this.liveMode.set(true);
        if (this.selectedLogo()) {
          this.startVariationGeneration();
        }
      }
    } else if (this.selectedLogo()) {
      this.startVariationGeneration();
    }
  }

  ngOnDestroy(): void {
    // Fermer le flux SSE ; le serveur annule la génération à la déconnexion
    this.brandingService.closeLogoVariationsStream();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Génération streamée (SSE) avec boucle qualité : chaque déclinaison apparaît
   * dès qu'elle est générée, l'avis de l'agent de vérification s'affiche
   * (fidélité géométrique + lisibilité mesurée sur le fond cible), et la
   * recoloration corrective se fait sous les yeux de l'utilisateur.
   */
  protected startVariationGeneration(force = false): void {
    if (this.isGenerating()) {
      return;
    }

    this.hasStartedGeneration.set(true);
    this.isGenerating.set(true);
    this.liveMode.set(true);
    this.error.set(null);
    this.isCompleted.set(false);
    this.generationProgress.set(0);
    this.currentStep.set(this.translate.instant('dashboard.logoVariations.progress.initializing'));

    const existingWithText = this.project()?.analysisResultModel?.branding?.logo?.variations?.withText || {};

    this.variationSlots.set(
      (['lightBackground', 'darkBackground', 'monochrome'] as VariationKind[]).map((kind) => {
        const svg = existingWithText[kind];
        if (!force && svg) {
          return {
            kind,
            status: 'final' as const,
            svg,
            critique: null,
          };
        }
        return {
          kind,
          status: 'pending' as const,
          svg: null,
          critique: null,
        };
      })
    );

    this.brandingService
      .generateLogoVariationsStream(this.project().id!, force)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => this.handleVariationStreamEvent(event),
        error: (error) => {
          console.error('Error in streamed variation generation:', error);
          this.finishLiveGeneration();
        },
        complete: () => this.finishLiveGeneration(),
      });
  }

  /** Route un événement SSE vers le slot de déclinaison concerné */
  private handleVariationStreamEvent(event: {
    stepName: string;
    data: string;
  }): void {
    let payload: {
      variant?: VariationKind;
      svg?: string;
      critique?: VariationCritiqueView;
      message?: string;
    } = {};
    try {
      payload = event.data ? JSON.parse(event.data) : {};
    } catch {
      return;
    }
    const kind = payload.variant;
    if (!kind) return;

    switch (event.stepName) {
      case 'variation_started':
        this.updateSlot(kind, { status: 'generating' });
        break;
      case 'variation_generated':
        this.updateSlot(kind, { status: 'generated', svg: payload.svg ?? null });
        break;
      case 'critique_started':
        this.updateSlot(kind, { status: 'critiquing' });
        break;
      case 'critique_result':
        this.updateSlot(kind, { critique: payload.critique ?? null });
        break;
      case 'revision_started':
        this.updateSlot(kind, { status: 'revising' });
        break;
      case 'variation_updated':
        this.updateSlot(kind, { svg: payload.svg ?? null, revised: true });
        break;
      case 'variation_finalized':
        this.updateSlot(kind, { status: 'final', svg: payload.svg ?? null });
        this.generationProgress.set(
          Math.round(
            (this.variationSlots().filter((s) => s.status === 'final').length / 3) * 100,
          ),
        );
        break;
      case 'variation_cancelled':
        this.updateSlot(kind, { status: 'cancelled' });
        break;
      case 'variation_error':
        this.updateSlot(kind, { status: 'error' });
        break;
    }
  }

  private updateSlot(kind: VariationKind, patch: Partial<VariationSlot>): void {
    this.variationSlots.update((slots) =>
      slots.map((slot) => (slot.kind === kind ? { ...slot, ...patch } : slot)),
    );
  }

  /** Fin du flux : assemble les déclinaisons finalisées et bascule sur l'affichage classique si les 3 sont prêtes */
  private finishLiveGeneration(): void {
    this.isGenerating.set(false);
    this.currentStep.set(this.translate.instant('dashboard.logoVariations.progress.completed'));

    const finalSlots = this.variationSlots().filter((s) => s.status === 'final' && s.svg);

    if (finalSlots.length < 3) {
      this.isCompleted.set(false);
      this.liveMode.set(true);
      this.error.set(
        this.translate.instant('dashboard.logoVariations.errors.generationFailed')
      );
      return;
    }

    this.liveMode.set(false);
    this.error.set(null);

    const variationSet: Record<string, string> = {};
    const displayVariations: DisplayVariation[] = [];
    for (const slot of finalSlots) {
      variationSet[slot.kind] = slot.svg!;
      displayVariations.push({
        id: slot.kind,
        background: slot.kind,
        label: this.translate.instant(`dashboard.logoVariations.labels.${slot.kind}`),
        svgContent: slot.svg!,
        description: this.translate.instant(`dashboard.logoVariations.descriptions.${slot.kind}`),
        backgroundColor: VARIATION_DISPLAY[slot.kind].backgroundColor,
      });
    }

    const variations: LogoVariations = {
      withText: { ...variationSet },
      iconOnly: { ...variationSet },
    };

    this.generatedVariations.set(displayVariations);
    this.variationsGenerated.emit(variations);
    this.autoAcceptVariations(variations);
  }

  /** Couleur de fond d'affichage d'un slot */
  protected slotBackground(kind: VariationKind): string {
    return VARIATION_DISPLAY[kind].backgroundColor;
  }

  /** Libellé i18n du statut d'un slot */
  protected slotStatusKey(status: VariationSlotStatus): string {
    return `dashboard.logoVariations.live.status.${status}`;
  }

  /** Libellé i18n d'une déclinaison */
  protected slotLabelKey(kind: VariationKind): string {
    return `dashboard.logoVariations.labels.${kind}`;
  }

  // Simplified: return all variations since we only have 3 now
  protected getAllVariations(): DisplayVariation[] {
    return this.generatedVariations();
  }

  /**
   * Auto-accept all generated variations and update project
   */
  private autoAcceptVariations(variations: LogoVariations): void {
    const currentProject = this.project();
    const currentBranding = currentProject?.analysisResultModel?.branding;

    // Update the logo with all variations
    const updatedLogo: LogoModel = {
      ...this.selectedLogo(),
      variations: variations,
    };

    const updatedBranding = {
      ...currentBranding,
      logo: updatedLogo,
    };

    // Update project immediately
    this.projectUpdate.emit({
      ...currentProject,
      analysisResultModel: {
        ...currentProject?.analysisResultModel,
        branding: updatedBranding,
      },
    } as ProjectModel);

    // Mark as completed - user can now proceed manually
    this.isCompleted.set(true);
  }

  protected onNextStep(): void {
    if (this.canProceed()) {
      this.nextStep.emit();
    }
  }

  /**
   * Method to retry variation generation in case of failure
   */
  protected retryGeneration(force = false): void {
    this.error.set(null);
    this.hasStartedGeneration.set(false);
    this.isCompleted.set(false);
    this.startVariationGeneration(force);
  }
}
