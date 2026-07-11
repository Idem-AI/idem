import {
  Component,
  input,
  output,
  signal,
  computed,
  OnInit,
  OnDestroy,
  inject,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafeHtmlPipe } from '../../../projects-list/safehtml.pipe';
import { LogoModel, LogoPreferencesModel } from '../../../../models/logo.model';
import { CarouselComponent } from '../../../../../../shared/components/carousel/carousel.component';
import { LogoPreferences } from '../logo-preferences/logo-preferences';
import { LogoEditorChat } from '../logo-editor-chat/logo-editor-chat';
import { LogoCreationSimulatorComponent } from '../logo-creation-simulator/logo-creation-simulator';

import { Subject, takeUntil } from 'rxjs';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';
import { SSEStepEvent } from '../../../../../../shared/models/sse-step.model';

/** Avis de l'agent critique, affiché en temps réel à l'utilisateur */
export interface LogoCritiqueView {
  verdict: 'pass' | 'fail';
  score: number;
  summary: string;
  remarks: { criterion: string; issue: string }[];
}

export type ConceptSlotStatus =
  | 'pending'
  | 'generating'
  | 'generated'
  | 'critiquing'
  | 'revising'
  | 'final'
  | 'cancelled'
  | 'error';

/** État live d'un des 3 concepts pendant la génération streamée */
export interface ConceptSlot {
  index: number;
  status: ConceptSlotStatus;
  logo: LogoModel | null;
  critique: LogoCritiqueView | null;
  /** true si l'agent de révision a corrigé le logo après une critique négative */
  revised?: boolean;
}

@Component({
  selector: 'app-logo-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SafeHtmlPipe,
    CarouselComponent,
    LogoPreferences,
    LogoEditorChat,
    LogoCreationSimulatorComponent,
    TranslateModule,
  ],
  templateUrl: './logo-selection.html',
  styleUrl: './logo-selection.css',
})
export class LogoSelectionComponent implements OnInit, OnDestroy {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly destroy$ = new Subject<void>();
  private readonly translate = inject(TranslateService);

  @ViewChild(LogoCreationSimulatorComponent) simulator?: LogoCreationSimulatorComponent;

  // Inputs
  readonly projectId = input<string>();
  readonly logos = input<LogoModel[]>();
  readonly selectedLogo = input<string>();
  readonly project = input<ProjectModel>();
  readonly initialPreferences = input<LogoPreferencesModel | null | undefined>(null);

  // Outputs
  readonly logoSelected = output<string>();
  readonly logosGenerated = output<LogoModel[]>();
  readonly projectUpdate = output<ProjectModel>();
  readonly nextStep = output<void>();

  // Internal state
  protected readonly isGenerating = signal(false);
  protected readonly generatedLogos = signal<LogoModel[]>([]);
  protected readonly generationProgress = signal(0);
  protected readonly currentStep = signal('');
  protected readonly estimatedTime = signal('2-3 minutes');
  protected readonly hasStartedGeneration = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedLogoId = signal<string | null>(null);
  protected readonly showPreferences = signal(true);
  protected readonly logoPreferences = signal<LogoPreferencesModel | null>(null);

  // Edit logo state - replaced by chat
  protected readonly showEditorChat = signal(false);
  protected readonly showSimulator = signal(false);

  // Live generation state (SSE) : un slot par concept, statut + critique visibles
  protected readonly liveMode = signal(false);
  protected readonly conceptSlots = signal<ConceptSlot[]>([]);

  /** Tableau de bord live affiché pendant la génération streamée */
  protected readonly showLiveBoard = computed(() => this.liveMode() && this.isGenerating());

  // Computed properties
  protected readonly shouldShowLoader = computed(() => {
    return (
      this.isGenerating() &&
      this.generatedLogos().length === 0 &&
      !this.showSimulator() &&
      !this.liveMode()
    );
  });

  protected readonly shouldShowSimulator = computed(() => {
    return this.showSimulator() && this.isGenerating();
  });

  protected readonly shouldShowLogos = computed(() => {
    if (this.showLiveBoard()) return false;
    const inputLogos = this.logos();
    const generatedLogos = this.generatedLogos();
    return (inputLogos && inputLogos.length > 0) || generatedLogos.length > 0;
  });

  protected readonly displayedLogos = computed(() => {
    const inputLogos = this.logos();
    const generatedLogos = this.generatedLogos();
    return inputLogos && inputLogos.length > 0 ? inputLogos : generatedLogos;
  });

  // Computed property for template binding
  protected readonly selectedLogoComputed = computed(() => {
    return this.selectedLogoId();
  });

  protected readonly shouldShowInitialPrompt = computed(() => {
    return false; // Always show preferences first
  });

  protected readonly shouldShowPreferences = computed(() => {
    return this.showPreferences() && !this.logoPreferences();
  });

  protected readonly selectedLogoForEdit = computed(() => {
    const logoId = this.selectedLogoId();
    if (!logoId) return null;
    return this.displayedLogos().find((l) => l.id === logoId) || null;
  });

  // Track function for carousel
  protected readonly trackLogo = (index: number, logo: LogoModel): string => {
    return logo.id || `logo-${index}`;
  };

  // Track function for skeleton loading
  protected readonly trackSkeleton = (index: number, item: number): string => {
    return `skeleton-${index}`;
  };

  ngOnInit(): void {
    const hasNoLogos = !this.logos() || this.logos()?.length === 0;

    if (hasNoLogos && !this.hasStartedGeneration()) {
      // Fallback : préférences stockées dans le projet (ex. voie « améliorer mon logo »
      // où l'analyse IA les a persistées avant d'arriver ici)
      const initialPrefs =
        this.initialPreferences() ??
        this.project()?.analysisResultModel?.branding?.logoPreferences ??
        null;
      if (initialPrefs) {
        // Parent provided preferences, auto-start generation
        this.logoPreferences.set(initialPrefs);
        this.showPreferences.set(false);
        // Start generation slightly delayed to ensure component is fully initialized
        setTimeout(() => this.startLogoGeneration(), 100);
      } else {
        // No preferences provided, show internal preferences form
        this.showPreferences.set(true);
      }
    } else if (this.logos() && this.logos()!.length > 0) {
      this.showPreferences.set(false);
      this.generatedLogos.set(this.logos()!);

      // Try to extract preferences from existing logos
      const firstLogo = this.logos()![0];
      if (firstLogo.type) {
        this.logoPreferences.set({
          type: firstLogo.type,
          useAIGeneration: !firstLogo.customDescription,
          customDescription: firstLogo.customDescription,
        });
      }

      // Sélectionner automatiquement le logo existant s'il y en a un déjà sauvegardé
      const currentSelectedLogo = this.project()?.analysisResultModel?.branding?.logo;
      if (currentSelectedLogo && currentSelectedLogo.id) {
        this.selectedLogoId.set(currentSelectedLogo.id);
      }
      // Ne PAS auto-sélectionner le premier logo si aucun n'a été choisi :
      // l'utilisateur doit cliquer explicitement pour sélectionner un logo
    }
  }

  ngOnDestroy(): void {
    // Fermer le flux SSE ; le serveur annule la génération à la déconnexion
    this.brandingService.closeLogoConceptsStream();
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected selectLogo(logoId: string): void {
    // Sélection pendant la génération streamée : annuler les concepts restants
    // côté serveur pour économiser les tokens
    if (this.isGenerating() && this.liveMode()) {
      this.conceptSlots.update((slots) =>
        slots.map((slot) =>
          slot.status === 'final' || slot.logo?.id === logoId
            ? slot
            : { ...slot, status: 'cancelled' as const },
        ),
      );
      this.brandingService
        .cancelLogoConceptsGeneration(this.projectId()!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => console.log('Remaining logo concepts cancelled'),
          error: (err) => console.warn('Cancel request failed (non-blocking):', err),
        });
      this.finishLiveGeneration();
    }

    // Update selected logo state
    this.selectedLogoId.set(logoId);
    this.logoSelected.emit(logoId);

    // Find the selected logo and update the project
    const selectedLogo = this.displayedLogos().find((logo) => logo.id === logoId);
    if (selectedLogo) {
      const currentProject = this.project();
      const currentBranding = currentProject?.analysisResultModel?.branding;

      // Ensure all required BrandIdentityModel properties are present
      const updatedBranding = {
        id: currentBranding?.id,
        createdAt: currentBranding?.createdAt,
        updatedAt: currentBranding?.updatedAt,
        logo: selectedLogo,
        generatedLogos: this.displayedLogos(),
        colors: currentBranding?.colors!,
        generatedColors: currentBranding?.generatedColors || [],
        typography: currentBranding?.typography!,
        generatedTypography: currentBranding?.generatedTypography || [],
        sections: currentBranding?.sections || [],
        pdfBlob: currentBranding?.pdfBlob,
      };

      this.projectUpdate.emit({
        ...currentProject,
        analysisResultModel: {
          ...currentProject?.analysisResultModel,
          branding: updatedBranding,
        },
      } as ProjectModel);
    }
  }

  protected onNextStep(): void {
    if (this.selectedLogoId()) {
      this.nextStep.emit();
    }
  }

  protected goToNextStep(): void {
    this.nextStep.emit();
  }

  protected onPreferencesSelected(preferences: LogoPreferencesModel): void {
    console.log('Logo preferences selected:', preferences);
    this.logoPreferences.set(preferences);
    this.showPreferences.set(false);
    this.startLogoGeneration();
  }

  /**
   * Génération streamée (SSE) avec boucle qualité : chaque concept apparaît dès
   * qu'il est généré, l'avis de l'agent critique s'affiche, et la révision se
   * fait sous les yeux de l'utilisateur. Sélectionner un logo pendant la
   * génération annule les concepts restants (économie de tokens).
   */
  protected startLogoGeneration(force = false): void {
    if (this.isGenerating()) {
      return;
    }

    const project = this.project();
    const selectedColor = project?.analysisResultModel?.branding?.colors;
    const selectedTypography = project?.analysisResultModel?.branding?.typography;

    if (!selectedColor || !selectedTypography) {
      this.error.set(
        this.translate.instant('dashboard.logoSelection.errors.colorAndTypographyRequired'),
      );
      return;
    }

    this.hasStartedGeneration.set(true);
    this.isGenerating.set(true);
    this.liveMode.set(true);
    this.showSimulator.set(false);
    this.error.set(null);
    this.generationProgress.set(0);
    this.currentStep.set(this.translate.instant('dashboard.logoSelection.progress.initializing'));
    this.conceptSlots.set(
      [0, 1, 2].map((index) => ({ index, status: 'pending' as const, logo: null, critique: null })),
    );

    this.brandingService
      .generateLogoConceptsStream(this.projectId()!, force, this.logoPreferences())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => this.handleLogoStreamEvent(event),
        error: (error) => {
          console.error('Error in streamed logo generation:', error);
          this.finishLiveGeneration();
          if (this.generatedLogos().length === 0) {
            this.error.set(
              this.translate.instant('dashboard.logoSelection.errors.generationFailed'),
            );
          }
        },
        complete: () => this.finishLiveGeneration(),
      });
  }

  /** Route un événement SSE vers le slot de concept concerné */
  private handleLogoStreamEvent(event: SSEStepEvent): void {
    let payload: {
      conceptIndex?: number;
      logo?: LogoModel;
      critique?: LogoCritiqueView;
      message?: string;
    } = {};
    try {
      payload = event.data ? JSON.parse(event.data) : {};
    } catch {
      return;
    }
    const index = payload.conceptIndex ?? -1;
    if (index < 0) return;

    switch (event.stepName) {
      case 'concept_started':
        this.updateSlot(index, { status: 'generating' });
        break;
      case 'concept_generated':
        this.updateSlot(index, { status: 'generated', logo: this.normalizeLogo(payload.logo!, index) });
        break;
      case 'critique_started':
        this.updateSlot(index, { status: 'critiquing' });
        break;
      case 'critique_result':
        this.updateSlot(index, { critique: payload.critique ?? null });
        break;
      case 'revision_started':
        this.updateSlot(index, { status: 'revising' });
        break;
      case 'concept_updated':
        this.updateSlot(index, { logo: this.normalizeLogo(payload.logo!, index), revised: true });
        break;
      case 'concept_finalized': {
        const logo = this.normalizeLogo(payload.logo!, index);
        this.updateSlot(index, { status: 'final', logo });
        this.mergeFinalLogo(logo);
        this.generationProgress.set(
          Math.round((this.conceptSlots().filter((s) => s.status === 'final').length / 3) * 100),
        );
        break;
      }
      case 'concept_cancelled':
        this.updateSlot(index, { status: 'cancelled' });
        break;
      case 'concept_error':
        this.updateSlot(index, { status: 'error' });
        break;
    }
  }

  private updateSlot(index: number, patch: Partial<ConceptSlot>): void {
    this.conceptSlots.update((slots) =>
      slots.map((slot) => (slot.index === index ? { ...slot, ...patch } : slot)),
    );
  }

  /** Garantit id/type/description sur un logo reçu du flux */
  private normalizeLogo(logo: LogoModel, index: number): LogoModel {
    const preferences = this.logoPreferences();
    return {
      ...logo,
      id: logo.id || `concept-${index + 1}`,
      type: logo.type ?? preferences?.type,
      customDescription: logo.customDescription ?? preferences?.customDescription,
    };
  }

  /** Ajoute ou remplace un logo finalisé dans la liste sélectionnable */
  private mergeFinalLogo(logo: LogoModel): void {
    this.generatedLogos.update((logos) => {
      const existingIndex = logos.findIndex((l) => l.id === logo.id);
      if (existingIndex !== -1) {
        const next = [...logos];
        next[existingIndex] = logo;
        return next;
      }
      return [...logos, logo];
    });
    this.logosGenerated.emit(this.generatedLogos());
  }

  /** Fin (ou interruption) du flux : bascule du tableau live vers la sélection */
  private finishLiveGeneration(): void {
    this.isGenerating.set(false);
    this.liveMode.set(false);
    this.generationProgress.set(100);
    this.currentStep.set(this.translate.instant('dashboard.logoSelection.progress.completed'));
  }

  /**
   * Sélection depuis le tableau live : on choisit ce logo et on annule la
   * génération des concepts restants pour économiser les tokens.
   */
  protected selectFromSlot(slot: ConceptSlot): void {
    if (!slot.logo || slot.status === 'cancelled' || slot.status === 'error') {
      return;
    }
    this.mergeFinalLogo(slot.logo);
    this.selectLogo(slot.logo.id);
  }

  /** Libellé i18n du statut d'un slot */
  protected slotStatusKey(status: ConceptSlotStatus): string {
    return `dashboard.logoSelection.live.status.${status}`;
  }

  // Ancienne méthode de simulation remplacée par LogoCreationSimulatorComponent

  protected onCarouselItemChanged(logo: LogoModel): void {
    // Auto-select the logo when carousel navigation changes on mobile
    if (logo && logo.id) {
      this.selectLogo(logo.id);
    }
  }

  protected retryGeneration(): void {
    this.error.set(null);
    this.hasStartedGeneration.set(false);
    this.generatedLogos.set([]);
    this.generationProgress.set(0);
    this.showSimulator.set(false);
    // Don't reset preferences - keep them for retry
    // this.logoPreferences.set(null);

    // If preferences exist, restart generation immediately
    if (this.logoPreferences()) {
      this.startLogoGeneration();
    } else {
      // Show preferences form again
      this.showPreferences.set(true);
    }
  }

  protected openEditorChat(): void {
    if (!this.selectedLogoId()) {
      return;
    }
    this.showEditorChat.set(true);
  }

  protected closeEditorChat(): void {
    this.showEditorChat.set(false);
  }

  protected onLogoSelectedFromChat(logo: LogoModel): void {
    const logoId = this.selectedLogoId();
    if (!logoId) {
      this.closeEditorChat();
      return;
    }

    // Keep the same ID so the logo stays selected
    const updatedLogo: LogoModel = {
      ...logo,
      id: logoId, // Keep the original ID
    };

    // Update the logo in the list - replace the old one with the new one
    const updatedLogos = this.generatedLogos().map((l) => (l.id === logoId ? updatedLogo : l));
    this.generatedLogos.set(updatedLogos);

    // Emit the updated logos to parent component
    this.logosGenerated.emit(updatedLogos);

    // Update the project with the new logo
    const currentProject = this.project();
    if (currentProject) {
      const currentBranding = currentProject.analysisResultModel?.branding;

      const updatedBranding = {
        ...currentBranding,
        logo: updatedLogo, // Set the edited logo as the selected one
        generatedLogos: updatedLogos,
      };

      this.projectUpdate.emit({
        ...currentProject,
        analysisResultModel: {
          ...currentProject.analysisResultModel,
          branding: updatedBranding,
        },
      } as ProjectModel);
    }

    this.closeEditorChat();
  }

  protected onSimulatorCompleted(): void {
    // Le simulateur est terminé, mais on continue d'attendre la vraie génération
    console.log('Simulator completed, waiting for actual generation...');
  }

  protected regenerateAllLogos(): void {
    const preferences = this.logoPreferences() || this.initialPreferences();
    console.log('🔄 Regenerate clicked. Current preferences:', preferences);

    if (!preferences) {
      console.error('❌ No preferences found. Showing error message.');
      this.error.set(this.translate.instant('dashboard.logoSelection.errors.preferencesNotFound'));
      return;
    }

    console.log('✅ Preferences found. Starting regeneration...');

    // Reset state
    this.error.set(null);
    this.generatedLogos.set([]);
    this.generationProgress.set(0);
    this.selectedLogoId.set(null);
    this.hasStartedGeneration.set(false);
    this.showSimulator.set(false);

    // Restart generation with same preferences, forcing full regeneration
    this.startLogoGeneration(true);
  }
}
