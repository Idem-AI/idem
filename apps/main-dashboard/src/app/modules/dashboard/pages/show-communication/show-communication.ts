import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { ProjectModel } from '@idem/shared-models';
import { CookieService } from '../../../../shared/services/cookie.service';
import { CommunicationService } from '../../services/ai-agents/communication.service';
import {
  CommunicationModel,
  CommunicationPlan,
  CommunicationStrategy,
  ContentChannel,
  Flyer,
  Publication,
} from '../../models/communication.model';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { FontHints } from '../document-editor/models/editor.types';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { ProjectService } from '../../services/project.service';
import { BrandVoicePanel } from './components/brand-voice-panel/brand-voice-panel';
import { LibraryPanel } from './components/library-panel/library-panel';
import { PlanPanel } from './components/plan-panel/plan-panel';
import { StudioPanel } from './components/studio-panel/studio-panel';

type Screen = 'studio' | 'plans' | 'library';

/**
 * Module Communication — la coquille.
 *
 * Trois écrans nommés par ce qu'on y fait, là où il y avait quatre onglets de
 * vocabulaire interne (« Moments », « signaux de tendance », « stratégie » en
 * blocs de textarea) :
 *
 *   CRÉER        on décrit ce qu'on veut, le visuel sort à la charte
 *   MON PLANNING ce qu'il y a à publier, et quand — avec des dates réelles
 *   MES VISUELS  tout ce qui a été produit, atteignable quoi qu'il arrive
 *   + MA FAÇON DE COMMUNIQUER, en panneau : définie une fois, relue rarement
 *
 * Aucun de ces noms ne demande de connaître le marketing. C'était le premier
 * obstacle : « Atelier », « Périodes », « Bibliothèque » et « la boussole »
 * décrivaient des métaphores, pas des actions.
 *
 * CRÉER est l'écran par défaut. C'est le seul qui donne un résultat sans rien
 * comprendre au vocabulaire du métier — et l'ordre imposé par la V1 (stratégie,
 * puis calendrier, puis visuel : 55 crédits avant de voir quoi que ce soit) était
 * la première raison pour laquelle le module n'était pas utilisé.
 *
 * Cette coquille détient le modèle et le distribue ; les écrans lui renvoient
 * leurs modifications. Un seul chargement, une seule source de vérité.
 */
@Component({
  selector: 'app-show-communication',
  imports: [
    TranslateModule,
    IncompleteProjectBannerComponent,
    BrandVoicePanel,
    LibraryPanel,
    PlanPanel,
    StudioPanel,
  ],
  templateUrl: './show-communication.html',
  styleUrls: ['./show-communication.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowCommunication implements OnInit {
  private readonly communication = inject(CommunicationService);
  private readonly cookies = inject(CookieService);
  private readonly router = inject(Router);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly model = signal<CommunicationModel | null>(null);
  protected readonly activeScreen = signal<Screen>('studio');
  protected readonly isVoiceOpen = signal(false);

  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isBrandingComplete = signal(false);

  protected readonly plans = computed<CommunicationPlan[]>(() => this.model()?.plans ?? []);
  protected readonly visuals = computed<Flyer[]>(() => this.model()?.visuals ?? []);
  protected readonly publications = computed<Publication[]>(
    () => this.model()?.publications ?? [],
  );
  protected readonly strategy = computed(() => this.model()?.strategy ?? null);

  /** Réseaux déjà priorisés pour cette marque — présélection à la création d'un planning. */
  protected readonly suggestedChannels = computed<ContentChannel[]>(
    () => (this.model()?.context?.channels ?? []) as ContentChannel[],
  );

  /** Vrai tant que rien n'existe : on montre alors les trois façons de démarrer. */
  protected readonly isFirstVisit = computed(
    () => !this.strategy() && this.plans().length === 0 && this.visuals().length === 0,
  );

  protected readonly screens: { id: Screen; icon: string; labelKey: string }[] = [
    { id: 'studio', icon: 'pi pi-sparkles', labelKey: 'dashboard.showCommunication.tabs.studio' },
    { id: 'plans', icon: 'pi pi-calendar', labelKey: 'dashboard.showCommunication.tabs.plans' },
    { id: 'library', icon: 'pi pi-images', labelKey: 'dashboard.showCommunication.tabs.library' },
  ];

  /**
   * Polices de la marque, transmises aux aperçus.
   *
   * Sans elles, l'aperçu d'un visuel retombe sur la police système : on
   * modifierait une composition qui n'est pas celle du PNG livré.
   */
  protected readonly fonts = computed<FontHints>(() => {
    const branding = this.model()?.context?.branding;
    return {
      primaryFont: branding?.primaryFont,
      secondaryFont: branding?.secondaryFont,
      fontUrl: branding?.fontUrl,
    };
  });

  ngOnInit(): void {
    const projectId = this.cookies.get('projectId');
    this.projectId.set(projectId || null);
    if (!projectId) {
      this.isLoading.set(false);
      return;
    }
    this.checkBranding(projectId);
  }

  /**
   * La charte doit être complète avant de commencer.
   *
   * C'est la seule dépendance légitime du module : sans couleurs, polices et
   * logo, un visuel « à la charte » n'a aucun sens. Elle est vérifiée AVANT le
   * chargement du modèle pour ne pas afficher un atelier qu'on ne pourrait pas
   * utiliser.
   */
  private checkBranding(projectId: string): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        const { isComplete } = this.brandingValidation.checkBrandingCompletion(project);
        this.isBrandingComplete.set(isComplete);
        if (isComplete) {
          this.loadModel(projectId);
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('dashboard.showCommunication.errors.project');
      },
    });
  }

  private loadModel(projectId: string): void {
    this.isLoading.set(true);
    this.communication.getCommunication(projectId).subscribe({
      next: (model) => {
        this.model.set(model || {});
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'dashboard.showCommunication.errors.load');
      },
    });
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  protected setScreen(screen: Screen): void {
    this.activeScreen.set(screen);
    this.errorMessage.set('');
  }

  protected openVoice(): void {
    this.isVoiceOpen.set(true);
  }

  protected closeVoice(): void {
    this.isVoiceOpen.set(false);
  }

  protected goToProjects(): void {
    this.router.navigate(['/projects']);
  }

  protected goToBilling(): void {
    this.router.navigate(['/billing']);
  }

  // ── Remontées des écrans ─────────────────────────────────────────────────

  protected onPlansChange(plans: CommunicationPlan[]): void {
    this.patch({ plans });
  }

  protected onStrategyChange(strategy: CommunicationStrategy): void {
    this.patch({ strategy });
  }

  /**
   * Un visuel vient d'être produit, d'où qu'il vienne.
   *
   * Remplacé et non ajouté à l'aveugle : une retouche renvoie le MÊME id, et un
   * simple `push` aurait fait apparaître deux fois le même visuel dans la
   * bibliothèque.
   */
  protected onVisualCreated(visual: Flyer): void {
    const existing = this.visuals().filter((item) => item.id !== visual.id);
    this.patch({ visuals: [...existing, visual] });
  }

  protected onPublicationCreated(publication: Publication): void {
    this.patch({ publications: [...this.publications(), publication] });
  }

  protected onError(message: string): void {
    this.errorMessage.set(message);
  }

  /** Crédits insuffisants dans l'atelier : le refus voyage dans le flux SSE. */
  protected onNeedsCredits(detail: { cost: number; balance: number }): void {
    this.errorMessage.set('dashboard.showCommunication.errors.credits');
    this.creditsNeeded.set(detail);
  }

  protected readonly creditsNeeded = signal<{ cost: number; balance: number } | null>(null);

  protected dismissError(): void {
    this.errorMessage.set('');
    this.creditsNeeded.set(null);
  }

  private patch(patch: Partial<CommunicationModel>): void {
    this.model.set({ ...(this.model() ?? {}), ...patch });
  }
}
