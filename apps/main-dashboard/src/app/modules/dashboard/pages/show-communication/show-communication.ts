import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  OnInit,
  signal,
} from '@angular/core';
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
  StrategyInputKey,
} from '../../models/communication.model';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { FontHints } from '@idem/shared-document-editor/angular';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { ProjectService } from '../../services/project.service';
import { toChannels } from './communication-ui';
import { STRATEGY_INPUT_ROUTES, missingStrategyInputs } from './strategy-inputs';
import { BrandVoicePanel } from './components/brand-voice-panel/brand-voice-panel';
import { CommunicationHome, HomeAction } from './components/communication-home/communication-home';
import { LibraryPanel } from './components/library-panel/library-panel';
import { PlanIntent, PlanPanel } from './components/plan-panel/plan-panel';
import { StrategyInputsDialog } from './components/strategy-inputs-dialog/strategy-inputs-dialog';
import { StudioPanel } from './components/studio-panel/studio-panel';
import { VideoPanel } from './components/video-panel/video-panel';
import { CommunicationUrl, SCREEN_PARAMS, urlChoice, urlFlag } from './url-state';
import { WhatsappPanel } from './components/whatsapp-panel/whatsapp-panel';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

type Screen = 'home' | 'studio' | 'videos' | 'plans' | 'library' | 'whatsapp';

const SCREENS: readonly Screen[] = ['home', 'studio', 'videos', 'plans', 'library', 'whatsapp'];

/**
 * Module Communication — la coquille.
 *
 * Cinq onglets, un mot chacun : Accueil · Calendrier · Vidéos · Visuels · WhatsApp.
 *
 * L'ACCUEIL dit tout ce qu'il y a à comprendre, et rien de plus :
 *   - un champ pour une demande ponctuelle (« un visuel pour la bonne année ») ;
 *   - le parcours complet : stratégie → calendrier éditorial → visuels et
 *     vidéos, générés depuis le calendrier.
 * La demande tapée ouvre la conversation (`studio`), qui n'est pas un onglet :
 * elle prolonge l'accueil, dont l'onglet reste allumé.
 *
 * La stratégie (« Ma façon de communiquer ») s'ouvre en panneau depuis
 * l'étape 1 de l'accueil.
 *
 * Cette coquille détient le modèle et le distribue ; les écrans lui renvoient
 * leurs modifications. Un seul chargement, une seule source de vérité.
 */
@Component({
  selector: 'app-show-communication',
  imports: [
    WhatsappPanel,
    TranslateModule,
    IncompleteProjectBannerComponent,
    BrandVoicePanel,
    CommunicationHome,
    LibraryPanel,
    PlanPanel,
    StrategyInputsDialog,
    StudioPanel,
    VideoPanel,
    IdemLoaderComponent],
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
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly projectId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly model = signal<CommunicationModel | null>(null);
  /**
   * Écran ouvert. `?screen=` permet d'arriver directement sur l'atelier, le
   * calendrier ou la bibliothèque : un lien partagé retrouve l'endroit dont on
   * parlait.
   */
  protected readonly activeScreen = urlChoice<Screen>('screen', SCREENS, 'home', { push: true });
  /** Le panneau « voix de la marque » ouvert : `?voice=1`. */
  protected readonly isVoiceOpen = urlFlag('voice', { push: true });
  private readonly url = inject(CommunicationUrl);

  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isBrandingComplete = signal(false);

  protected readonly plans = computed<CommunicationPlan[]>(() => this.model()?.plans ?? []);
  protected readonly visuals = computed<Flyer[]>(() => this.model()?.visuals ?? []);
  protected readonly publications = computed<Publication[]>(
    () => this.model()?.publications ?? [],
  );
  protected readonly strategy = computed(() => this.model()?.strategy ?? null);

  /**
   * Les livrables dont la façon de communiquer dérive et qui manquent encore.
   *
   * Compté sur le projet déjà chargé — aucun appel de plus : la coquille le
   * charge pour vérifier la charte, et `analysisResultModel` porte déjà tout ce
   * qu'il faut pour répondre.
   */
  protected readonly strategyGaps = computed<StrategyInputKey[]>(() =>
    missingStrategyInputs(this.project()),
  );

  /** Les livrables nommés par la fenêtre ouverte ; vide = fenêtre fermée. */
  protected readonly blockedInputs = signal<readonly StrategyInputKey[]>([]);
  protected readonly isStrategyBlockedOpen = signal(false);

  /**
   * Réseaux déjà priorisés pour cette marque — présélection à la création d'un planning.
   *
   * Normalisés : ils viennent d'une extraction par le modèle, qui répondait en
   * texte libre avant que l'API ne borne la valeur (« Instagram », « Réseaux
   * sociaux »). Les projets créés avant en contiennent encore.
   */
  protected readonly suggestedChannels = computed<ContentChannel[]>(() =>
    toChannels(this.model()?.context?.channels),
  );

  /** Les onglets, dans l'ordre du parcours. La conversation n'en est pas un. */
  protected readonly screens: { id: Screen; icon: string }[] = [
    { id: 'home', icon: 'pi pi-home' },
    { id: 'plans', icon: 'pi pi-calendar' },
    { id: 'videos', icon: 'pi pi-video' },
    { id: 'library', icon: 'pi pi-images' },
    { id: 'whatsapp', icon: 'pi pi-whatsapp' },
  ];

  /** L'onglet allumé : la conversation prolonge l'accueil. */
  protected readonly activeTab = computed<Screen>(() =>
    this.activeScreen() === 'studio' ? 'home' : this.activeScreen(),
  );

  /**
   * Demande tapée sur l'accueil, remise à la conversation à son ouverture.
   * En mémoire seulement : une actualisation ne la renvoie pas (ni ne la refacture).
   */
  protected readonly pendingPrompt = signal<string | null>(null);

  /** Demande transmise au calendrier quand on y arrive depuis l'accueil. */
  protected readonly planIntent = signal<PlanIntent | null>(null);

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

  constructor() {
    // Sur téléphone, les onglets passent en barre fixe en bas de l'écran. Le dock
    // de mode, monté hors de ce module, vit dans ce même coin : on lui dit de
    // descendre DANS la barre plutôt que de flotter par-dessus un onglet ou un
    // bouton « Suivant ». Variable posée sur la racine, retirée en partant.
    const root = this.document.documentElement;
    root.style.setProperty('--idem-dock-bottom', '0.4rem');
    this.destroyRef.onDestroy(() => root.style.removeProperty('--idem-dock-bottom'));
  }

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

  /** Vidéo à ouvrir dans l'écran Vidéos (depuis un contenu du calendrier). */
  protected readonly videoToOpen = signal<string | null>(null);

  /** Une vidéo du calendrier s'ouvre sur sa propre page. */
  protected openVideoFromPlan(videoId: string): void {
    this.router.navigate(['/project/communication/videos', videoId]);
  }

  /** Un autre écran : l'adresse change (entrée d'historique), les paramètres de l'écran quitté sont vidés. */
  protected setScreen(screen: Screen): void {
    // L'écran et le ménage des paramètres partent dans la MÊME écriture.
    if (screen !== this.activeScreen()) this.url.write({ ...Object.fromEntries(SCREEN_PARAMS.map((k) => [k, null])), screen: screen === 'home' ? null : screen }, { push: true });
    this.activeScreen.set(screen);
    this.errorMessage.set('');
  }

  /** L'accueil envoie vers l'étape choisie, en ouvrant ce qu'il faut à l'arrivée. */
  protected onHomeAction(action: HomeAction): void {
    switch (action.kind) {
      case 'voice':
        this.openVoice();
        return;
      case 'newPlan':
        this.planIntent.set({ kind: 'create' });
        this.setScreen('plans');
        return;
      case 'prompt':
        this.pendingPrompt.set(action.text);
        this.setScreen('studio');
        return;
      default:
        this.setScreen(action.kind);
    }
  }

  /** La bibliothèque vide renvoie vers un endroit où l'on crée. */
  protected onCreateRequested(screen: 'studio' | 'plans'): void {
    if (screen === 'plans' && this.plans().length === 0) this.planIntent.set({ kind: 'create' });
    this.setScreen(screen);
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
    this.router.navigate(['/account']);
  }

  // ── Remontées des écrans ─────────────────────────────────────────────────

  protected onPlansChange(plans: CommunicationPlan[]): void {
    this.patch({ plans });
  }

  protected onStrategyChange(strategy: CommunicationStrategy): void {
    this.patch({ strategy });
  }

  /**
   * La stratégie n'a pas été générée : un livrable dont elle dérive manque.
   *
   * La fenêtre s'ouvre PAR-DESSUS le panneau, qui reste ouvert derrière : on
   * revient à sa façon de communiquer d'un Échap, sans avoir à la réouvrir.
   */
  protected onStrategyBlocked(missing: readonly StrategyInputKey[]): void {
    this.blockedInputs.set(missing.length > 0 ? missing : this.strategyGaps());
    this.isStrategyBlockedOpen.set(true);
  }

  /** Départ vers le livrable manquant. Le projet ouvert ne change pas. */
  protected goToStrategyInput(key: StrategyInputKey): void {
    this.isStrategyBlockedOpen.set(false);
    void this.router.navigate([STRATEGY_INPUT_ROUTES[key]]);
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
    const contentId = visual.contentId;

    // La réponse de génération porte déjà le contenu propriétaire. On rattache
    // donc le visuel et le post dans la même mise à jour locale : le détail du
    // post ouvert peut afficher le résultat tout de suite, sans attendre que
    // la remontée de `flyerIds` traverse les composants enfants (ni un reload).
    const plans = contentId
      ? this.plans().map((plan) => ({
          ...plan,
          items: plan.items.map((item) =>
            item.id === contentId
              ? {
                  ...item,
                  flyerIds: Array.from(new Set([...(item.flyerIds ?? []), visual.id])),
                }
              : item,
          ),
        }))
      : this.plans();

    this.patch({ visuals: [...existing, visual], plans });
  }

  /**
   * Un visuel a été supprimé.
   *
   * Le lien côté contenu est défait par l'API ; ici on retire aussi le visuel des
   * `flyerIds` en mémoire, sinon la carte du planning continuerait de chercher une
   * vignette qui n'existe plus.
   */
  protected onVisualDeleted(visualId: string): void {
    this.patch({
      visuals: this.visuals().filter((visual) => visual.id !== visualId),
      plans: this.plans().map((plan) => ({
        ...plan,
        items: plan.items.map((item) =>
          item.flyerIds?.includes(visualId)
            ? { ...item, flyerIds: item.flyerIds.filter((id) => id !== visualId) }
            : item,
        ),
      })),
    });
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
