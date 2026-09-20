import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MarkdownModule } from 'ngx-markdown';
import { firstValueFrom, Observable } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';

import { Loader } from '../../../../shared/components/loader/loader';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { TourService } from '../../../../shared/services/tour.service';
import { GenerationService } from '../../../../shared/services/generation.service';
import {
  SSEGenerationState,
  SSEServiceEventType,
  SSEStepEvent,
} from '../../../../shared/models/sse-step.model';
import { AdvisorService } from '../../../dashboard/services/ai-agents/advisor.service';
import { BusinessPlanService } from '../../../dashboard/services/ai-agents/business-plan.service';
import { BrandingService } from '../../../dashboard/services/ai-agents/branding.service';
import { PitchDeckService } from '../../../dashboard/services/ai-agents/pitch-deck.service';
import { DiagramsService } from '../../../dashboard/services/ai-agents/diagrams.service';
import { LegalDocsService } from '../../../dashboard/services/ai-agents/legal-docs.service';
import { CommunicationService } from '../../../dashboard/services/ai-agents/communication.service';
import { FinanceService } from '../../../dashboard/services/finance.service';
import { LegalDocumentType, LegalDocsModel } from '../../../dashboard/models/legalDocs.model';
import {
  BusinessCardOrientation,
  BusinessCardHolder,
} from '../../../dashboard/models/business-card.model';
import { BusinessCardService } from '../../../dashboard/services/ai-agents/business-card.service';
import { FinanceSectionKey } from '../../../dashboard/models/finance.model';
import { PreviewDocumentType } from '../../../dashboard/components/document-preview/document-preview';
import { SectionCompletionItem } from '../../../dashboard/models/generation-completeness';
import { CommunicationStreamEvent } from '../../../dashboard/models/communication.model';
import { ChatSessionService } from '../../services/chat-session.service';
import { ChatConversationStoreService } from '../../services/chat-conversation-store.service';
import { ChatIntentService, ChatIntent } from '../../services/chat-intent.service';
import { ChatDeliverablesService } from '../../services/chat-deliverables.service';
import { ChatOnboardingService } from '../../services/chat-onboarding.service';
import { ChatBrandingService } from '../../services/chat-branding.service';
import {
  ChatDocumentsService,
  ChatDocumentSummary,
  MultiDocumentKind,
  PreviewableKind,
} from '../../services/chat-documents.service';
import {
  AdditionalInfos,
  ChatAdditionalInfoService,
} from '../../services/chat-additional-info.service';
import { DeliverableCardComponent } from '../../components/deliverable-card/deliverable-card';
import { RecapCardComponent } from '../../components/recap-card/recap-card';
import { SuggestionChipsComponent } from '../../components/suggestion-chips/suggestion-chips';
import { DocumentPreviewPanelComponent } from '../../components/document-preview-panel/document-preview-panel';
import { DocumentListCardComponent } from '../../components/document-list-card/document-list-card';
import { ColorOptionsCardComponent } from '../../components/color-options-card/color-options-card';
import { TypographyOptionsCardComponent } from '../../components/typography-options-card/typography-options-card';
import { LogoOptionsCardComponent } from '../../components/logo-options-card/logo-options-card';
import { BrandingWarningBannerComponent } from '../../components/branding-warning-banner/branding-warning-banner';
import { InfoFormCardComponent } from '../../components/info-form-card/info-form-card';
import {
  FeatureLauncherComponent,
  FeatureSelection,
} from '../../components/feature-launcher/feature-launcher';
import { GenerationProgressCardComponent } from '../../components/generation-progress-card/generation-progress-card';
import {
  ChartePdfFormat,
  FormatChoiceCardComponent,
} from '../../components/format-choice-card/format-choice-card';
import { BpStructureCardComponent } from '../../components/bp-structure-card/bp-structure-card';
import { ColorModel, TypographyModel } from '../../../dashboard/models/brand-identity.model';
import { LogoModel, LogoType } from '../../../dashboard/models/logo.model';
import {
  ChatChip,
  ChatConversationCategory,
  ChatMessageModel,
  DeliverableCardData,
  DeliverableKind,
  GenerationProgressData,
  OnboardingPolicyAcceptances,
  OnboardingState,
} from '../../models/chat.model';

/**
 * Document ouvert dans le tiroir de lecture.
 *
 * Ce n'est plus un PDF : le tiroir rend les sections du document, comme la
 * page d'affichage du mode Avancé et comme l'éditeur. Le PDF n'est demandé à
 * l'API qu'au téléchargement.
 */
interface PreviewState {
  kind: PreviewableKind;
  /** Document visé, quand le projet en garde plusieurs. */
  documentId: string | null;
  documentType: PreviewDocumentType;
  title: string;
  /** Pages attendues et leur état, dans l'ordre du document. */
  outline: SectionCompletionItem[];
  sectionLabelPrefix: string;
}

/** Options d'une génération lancée depuis le fil. */
interface SseGenOptions {
  /** Informations complémentaires du business plan. */
  infos?: AdditionalInfos;
  /** Format de la charte graphique (portrait / paysage). */
  pdfFormat?: ChartePdfFormat;
  /** Types de documents juridiques à rédiger. */
  legalTypes?: LegalDocumentType[];
  /** Business plan ou pitch deck visé, parmi ceux du projet. */
  documentId?: string | null;
  /** Sections à régénérer ; vide, la génération complète ce qui manque. */
  sections?: string[];
  /** Tout régénérer, y compris les sections déjà écrites. */
  force?: boolean;
}

/** Livrables générés in-chat via le moteur SSE partagé (GenerationService). */
type SseGenKind = 'businessPlan' | 'branding' | 'pitchDeck' | 'diagrams' | 'finance' | 'legalDocs';

let chatMessageCounter = 0;

/**
 * Page principale du mode Chat : fil de conversation, composer, cartes de
 * livrables, chips de suggestions et onboarding conversationnel.
 */
@Component({
  selector: 'app-chat-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    MarkdownModule,
    Loader,
    DeliverableCardComponent,
    RecapCardComponent,
    SuggestionChipsComponent,
    DocumentPreviewPanelComponent,
    DocumentListCardComponent,
    ColorOptionsCardComponent,
    TypographyOptionsCardComponent,
    LogoOptionsCardComponent,
    BrandingWarningBannerComponent,
    InfoFormCardComponent,
    GenerationProgressCardComponent,
    FormatChoiceCardComponent,
    BpStructureCardComponent,
    FeatureLauncherComponent,
  ],
  templateUrl: './chat-home.html',
  // Réutilise les styles markdown de l'advisor (classe .advisor-message)
  styleUrls: ['./chat-home.css', '../../../dashboard/pages/advisor/advisor-markdown.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatHomePage implements OnInit, AfterViewChecked, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly uiMode = inject(UiModeService);
  private readonly tour = inject(TourService);
  private readonly advisor = inject(AdvisorService);
  private readonly intents = inject(ChatIntentService);
  private readonly onboarding = inject(ChatOnboardingService);
  private readonly branding = inject(ChatBrandingService);
  private readonly additionalInfoService = inject(ChatAdditionalInfoService);
  private readonly generationService = inject(GenerationService);
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly brandingApiService = inject(BrandingService);
  private readonly pitchDeckService = inject(PitchDeckService);
  private readonly diagramsService = inject(DiagramsService);
  private readonly legalDocsService = inject(LegalDocsService);
  private readonly communicationService = inject(CommunicationService);
  private readonly financeService = inject(FinanceService);
  private readonly businessCardService = inject(BusinessCardService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly session = inject(ChatSessionService);
  protected readonly store = inject(ChatConversationStoreService);
  protected readonly deliverables = inject(ChatDeliverablesService);
  protected readonly documents = inject(ChatDocumentsService);

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  protected readonly mode = signal<'project' | 'onboarding'>('project');
  protected readonly draft = signal('');
  protected readonly pendingAssistant = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isInitializing = signal(true);
  protected readonly isCreatingProject = signal(false);
  protected readonly cardBusy = signal(false);
  protected readonly preview = signal<PreviewState | null>(null);
  /** Sélection branding en cours de persistance */
  protected readonly brandingBusy = signal(false);
  /** La prochaine saisie texte répond à « décrivez votre logo » */
  protected readonly awaitingLogoDescription = signal(false);
  /** Flux branding en cours dans le fil (masque le bandeau d'avertissement) */
  protected readonly brandingFlowEngaged = signal(false);
  /** La prochaine saisie texte = infos supplémentaires du business plan */
  protected readonly awaitingBpInfoText = signal(false);
  /** Génération SSE en cours (business plan / charte graphique) */
  protected readonly isGenerating = signal(false);
  /** Choix du format de la charte en attente : le composer est bloqué */
  protected readonly awaitingFormatChoice = signal(false);
  /**
   * Choix de structure en attente : l'envoi de message reste bloqué jusqu'au
   * clic, comme pour le format de charte. Laisser l'utilisateur relancer une
   * conversation au milieu d'un choix enregistrerait la structure par défaut
   * sans qu'il l'ait vue.
   */
  protected readonly awaitingBpStructure = signal(false);

  private onboardingState: OnboardingState | null = null;
  private loadedProjectId: string | null = null;
  private pendingLogoType: LogoType | null = null;
  private pendingBpInfos: AdditionalInfos | null = null;
  /** Plan créé sur la structure choisie dans le fil, généré ensuite. */
  private pendingBpDocumentId: string | null = null;
  /** Générations déjà reprises dans ce fil (une seule carte par génération). */
  private readonly adoptedGenerations = new Set<SSEServiceEventType>();

  protected readonly messages = this.store.messages;
  protected readonly isEmpty = computed(() => this.messages().length === 0);
  protected readonly lastMessageId = computed(() => {
    const msgs = this.messages();
    return msgs.length > 0 ? msgs[msgs.length - 1].id : null;
  });

  /** Éléments d'identité de marque manquants sur le projet actif */
  protected readonly brandingMissing = computed(() => {
    if (this.mode() !== 'project') return [];
    const project = this.session.activeProject();
    // On attend le détail complet du projet pour éviter un faux positif
    if (!project?.analysisResultModel) return [];
    return this.branding.missingParts(project);
  });

  /** Bandeau « identité incomplète » : visible hors flux branding actif */
  protected readonly showBrandingBanner = computed(
    () =>
      !this.isInitializing() &&
      !this.store.isLoading() &&
      this.brandingMissing().length > 0 &&
      !this.brandingFlowEngaged(),
  );

  /** Suggestions du démarrage à froid (fil vide en mode projet) */
  protected readonly heroChips: ChatChip[] = [
    { labelKey: 'chat.chips.show.businessPlan', icon: 'pi pi-calendar', action: 'show', payload: 'businessPlan' },
    { labelKey: 'chat.chips.status', icon: 'pi pi-compass', action: 'status' },
    { labelKey: 'chat.chips.show.branding', icon: 'pi pi-palette', action: 'show', payload: 'branding' },
    { labelKey: 'chat.chips.exportAll', icon: 'pi pi-download', action: 'export-all' },
  ];

  constructor() {
    // Changement de projet depuis la sidebar (même route, pas de re-création)
    effect(() => {
      const projectId = this.session.activeProjectId();
      if (!projectId) return;
      untracked(() => {
        if (this.mode() === 'project' && !this.isInitializing() && projectId !== this.loadedProjectId) {
          void this.enterProjectMode(projectId);
        }
      });
    });

    // Changement de conversation : on réinitialise les états transitoires
    // (saisie de description de logo, flux branding, infos BP, erreurs)
    effect(() => {
      this.store.activeConversationId();
      untracked(() => {
        this.awaitingLogoDescription.set(false);
        this.awaitingBpInfoText.set(false);
        this.awaitingFormatChoice.set(false);
        this.awaitingBpStructure.set(false);
        this.brandingFlowEngaged.set(false);
        this.pendingLogoType = null;
        this.pendingBpInfos = null;
        this.errorMessage.set(null);
      });
    });

    // Fige la sidebar pendant les opérations en cours (une réponse arrivée
    // après un changement de conversation atterrirait au mauvais endroit)
    effect(() => {
      this.store.busy.set(
        this.pendingAssistant() ||
          this.brandingBusy() ||
          this.isCreatingProject() ||
          this.isGenerating(),
      );
    });
  }

  async ngOnInit(): Promise<void> {
    const isOnboardingRoute = this.route.snapshot.data['onboarding'] === true;
    // Attend le chargement des traductions (loader HTTP asynchrone) : les
    // messages du fil sont construits avec translate.instant().
    await firstValueFrom(this.translate.get('chat.onboarding.welcome'));
    await this.session.loadProjects();

    // La création de projet est unifiée sur /create-project (mode conversation).
    if (isOnboardingRoute || !this.session.activeProjectId()) {
      this.router.navigate(['/create-project'], { replaceUrl: true });
      return;
    }

    await this.enterProjectMode(this.session.activeProjectId()!);
    this.isInitializing.set(false);

    // Le fil est en place : on peut présenter les lieux sans pointer le vide.
    void this.tour.maybeStart('chat');
  }

  ngAfterViewChecked(): void {
    this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  ngOnDestroy(): void {
    // La génération en cours n'est PAS annulée en quittant le chat : elle
    // appartient au projet, pas à l'écran, elle est déjà facturée, et le mode
    // Avancé la laisse vivre de la même façon. Quitter le fil pour aller
    // vérifier autre chose ne doit pas coûter le travail en cours — le chat
    // la reprend à son retour (`reconcileRunningGenerations`).
  }

  // ─────────────────────────────────────────────── Modes

  private async enterProjectMode(projectId: string): Promise<void> {
    this.mode.set('project');
    this.loadedProjectId = projectId;
    this.brandingFlowEngaged.set(false);
    this.awaitingLogoDescription.set(false);
    this.awaitingFormatChoice.set(false);
    this.awaitingBpStructure.set(false);
    await this.store.load(projectId);
    this.reconcileRunningGenerations();
    // Rafraîchit le détail du projet (sections des livrables) en arrière-plan
    void this.session.fetchActiveProjectDetails();
  }

  /** Livrable correspondant à chaque flux SSE de l'application. */
  private static readonly KIND_BY_SERVICE: Partial<Record<SSEServiceEventType, SseGenKind>> = {
    'business-plan': 'businessPlan',
    'pitch-deck': 'pitchDeck',
    branding: 'branding',
    diagram: 'diagrams',
    'finance-fill': 'finance',
    'legal-docs': 'legalDocs',
  };

  /**
   * Remet le fil d'accord avec les générations réellement en cours.
   *
   * Une génération appartient à l'application : lancée depuis le tableau de
   * bord ou depuis une autre conversation, elle continue. Le fil doit donc
   * distinguer deux cartes qui se ressemblent — celle dont la génération a été
   * coupée par un rechargement (en échec), et celle dont la génération tourne
   * encore (reprise). Sans cette distinction, l'utilisateur relançait une
   * génération déjà payée.
   */
  private reconcileRunningGenerations(): void {
    const live = new Map<string, { serviceType: SSEServiceEventType; kind: SseGenKind }>();
    for (const [serviceType, kind] of Object.entries(ChatHomePage.KIND_BY_SERVICE) as Array<
      [SSEServiceEventType, SseGenKind]
    >) {
      if (!this.generationService.observeGeneration(serviceType)) continue;
      live.set(this.translate.instant(this.deliverables.config(kind).titleKey), {
        serviceType,
        kind,
      });
    }

    for (const message of this.store.messages()) {
      const generation = message.generation;
      if (generation?.status !== 'running') continue;
      const running = live.get(generation.title);
      if (running && !this.adoptedGenerations.has(running.serviceType)) {
        live.delete(generation.title);
        this.followGeneration(running.kind, running.serviceType, message.id, generation.title);
      } else {
        this.store.patch(message.id, {
          generation: { ...generation, status: 'error', stepsInProgress: [] },
        });
      }
    }

    // Génération lancée ailleurs : elle n'a pas encore de carte dans ce fil.
    for (const [title, running] of live) {
      if (this.adoptedGenerations.has(running.serviceType)) continue;
      const progressId = this.nextId();
      this.store.append({
        id: progressId,
        role: 'assistant',
        content: this.translate.instant('chat.generation.resumed', { title }),
        createdAt: new Date().toISOString(),
        generation: { title, status: 'running', completedSteps: [], stepsInProgress: [] },
      });
      this.followGeneration(running.kind, running.serviceType, progressId, title);
    }
  }

  /** Suit une génération déjà en cours et met sa carte à jour jusqu'au bout. */
  private followGeneration(
    kind: SseGenKind,
    serviceType: SSEServiceEventType,
    progressId: string,
    title: string,
  ): void {
    const running = this.generationService.observeGeneration(serviceType);
    if (!running) return;
    this.adoptedGenerations.add(serviceType);
    this.isGenerating.set(true);

    let finished = false;
    const release = () => {
      finished = true;
      this.adoptedGenerations.delete(serviceType);
    };

    running.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (state: SSEGenerationState) => {
        if (finished) return;
        this.store.patch(progressId, { generation: this.toProgressData(title, state) });
        if (state.completed) {
          release();
          void this.finishGeneration(kind, progressId, title, state);
        } else if (state.error) {
          release();
          this.failGeneration(kind, progressId, title, state);
        }
      },
      error: () => {
        if (finished) return;
        release();
        this.failGeneration(kind, progressId, title, null);
      },
    });
  }

  private enterOnboarding(): void {
    this.mode.set('onboarding');
    this.loadedProjectId = null;
    const existing = this.onboarding.load();
    const resumed =
      !!existing && (existing.stepId !== 'description' || !!existing.answers.description);
    const state = existing ?? this.onboarding.start();
    this.onboardingState = state;
    this.store.setTransient(this.onboarding.buildThread(state, resumed));
  }

  // ─────────────────────────────────────────────── Composer

  protected updateDraft(value: string): void {
    this.draft.set(value);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(): void {
    const content = this.draft().trim();
    if (!content || this.pendingAssistant() || this.isCreatingProject()) return;
    // Choix de format ou de structure en attente : l'envoi reste bloqué
    // jusqu'au clic.
    if (this.awaitingFormatChoice() || this.awaitingBpStructure()) return;
    this.draft.set('');
    this.errorMessage.set(null);

    if (this.mode() === 'onboarding') {
      this.handleOnboardingInput(content, content, false);
      return;
    }

    if (!this.session.activeProjectId()) return;
    this.appendUser(content);

    // Réponse à « décrivez le logo que vous imaginez » (flux branding)
    if (this.awaitingLogoDescription()) {
      void this.finalizeLogoPreferences(content);
      return;
    }

    // Infos supplémentaires du business plan en texte libre : l'IA formate
    if (this.awaitingBpInfoText()) {
      void this.handleBpFreeText(content);
      return;
    }

    const intent = this.intents.detect(content);
    if (intent) {
      void this.handleIntent(intent);
    } else {
      void this.askAdvisor(content);
    }
  }

  // ─────────────────────────────────────────────── Messages

  private nextId(): string {
    chatMessageCounter += 1;
    return `chat-${Date.now()}-${chatMessageCounter}`;
  }

  private appendUser(content: string): string {
    const message: ChatMessageModel = {
      id: this.nextId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    if (this.mode() === 'onboarding') {
      this.store.appendTransient(message);
    } else {
      this.store.append(message);
    }
    return message.id;
  }

  private appendAssistant(partial: Omit<ChatMessageModel, 'id' | 'role' | 'createdAt'>): void {
    const message: ChatMessageModel = {
      id: this.nextId(),
      role: 'assistant',
      createdAt: new Date().toISOString(),
      ...partial,
    };
    if (this.mode() === 'onboarding') {
      this.store.appendTransient(message);
    } else {
      this.store.append(message);
    }
  }

  private chipLabel(chip: ChatChip): string {
    return chip.labelKey ? this.translate.instant(chip.labelKey) : (chip.label ?? '');
  }

  // ─────────────────────────────────────────────── Intentions livrables

  private async handleIntent(intent: ChatIntent): Promise<void> {
    // Toute intention hors branding interrompt le flux : le bandeau réapparaît
    if (intent.type !== 'complete-branding') {
      this.brandingFlowEngaged.set(false);
    }
    switch (intent.type) {
      case 'show':
        this.respondWithCard(intent.kind!);
        break;
      case 'download':
        await this.respondWithDownload(intent.kind!);
        break;
      case 'status':
        this.respondWithStatus();
        break;
      case 'export-all':
        await this.respondWithExportAll();
        break;
      case 'complete-branding':
        await this.advanceBrandingFlow();
        break;
      case 'generate':
        await this.startGeneration(intent.kind!);
        break;
      case 'documents':
        await this.respondWithDocuments(intent.kind as MultiDocumentKind);
        break;
    }
  }

  /** Sélection d'une fonctionnalité depuis le lanceur (état vide du chat). */
  protected onFeatureSelected(sel: FeatureSelection): void {
    if (this.pendingAssistant() || this.isGenerating() || this.brandingBusy()) return;
    const title = this.translate.instant(this.deliverables.config(sel.kind).titleKey);
    if (sel.state === 'ready') {
      this.appendUser(this.translate.instant('chat.launcher.askShow', { title }));
      this.respondWithCard(sel.kind);
    } else {
      this.appendUser(this.translate.instant('chat.launcher.askGenerate', { title }));
      void this.startGeneration(sel.kind);
    }
  }

  private respondWithCard(kind: DeliverableKind, documentId?: string | null): void {
    const project = this.session.activeProject();
    const card = this.deliverables.buildCard(kind, project, documentId);
    const title = this.translate.instant(card.titleKey);
    this.appendAssistant({
      content: this.translate.instant(
        card.available ? 'chat.responses.showCard' : 'chat.responses.showCardMissing',
        { title },
      ),
      card,
      chips: this.buildCardChips(kind, card.available, card.pdfSupported, documentId),
    });
  }

  private buildCardChips(
    kind: DeliverableKind,
    available: boolean,
    pdfSupported: boolean,
    documentId?: string | null,
  ): ChatChip[] {
    const chips: ChatChip[] = [];
    if (kind === 'branding' && !this.branding.isComplete(this.session.activeProject())) {
      chips.push({
        labelKey: 'chat.branding.chips.complete',
        icon: 'pi pi-sparkles',
        action: 'branding-start',
      });
    } else if (kind === 'finance') {
      // Finance n'expose pas son état réel dans la carte : on propose toujours
      // de (re)compléter les prévisions directement dans le chat.
      chips.push({
        labelKey: 'chat.chips.generate.finance',
        icon: 'pi pi-sparkles',
        action: 'generate',
        payload: 'finance',
      });
    } else if (kind !== 'branding' && !available) {
      // Livrable pas encore généré : proposer de le générer directement ici.
      chips.push({
        labelKey: `chat.chips.generate.${kind}`,
        icon: 'pi pi-sparkles',
        action: 'generate',
        payload: kind,
      });
    }
    // Lire le document sans quitter la conversation : c'est l'aperçu complet
    // (pages, régénération, édition), pas un aperçu PDF.
    if (available && this.documents.isPreviewable(kind)) {
      chips.push({
        labelKey: 'chat.card.actions.preview',
        icon: 'pi pi-eye',
        action: 'preview',
        payload: kind,
        documentId: documentId ?? undefined,
      });
    }
    if (available && pdfSupported) {
      chips.push({
        labelKey: 'chat.chips.downloadPdf',
        icon: 'pi pi-download',
        action: 'download',
        payload: kind,
        documentId: documentId ?? undefined,
      });
    }
    // Les livrables que le projet garde en plusieurs exemplaires : la liste
    // est le seul endroit d'où l'on ouvre, renomme ou supprime les autres.
    if (kind === 'businessPlan' || kind === 'pitchDeck') {
      chips.push({
        labelKey: `chat.documents.${kind}.list`,
        icon: 'pi pi-list',
        action: 'documents',
        payload: kind,
      });
    }
    if (kind === 'legalDocs' && available) {
      chips.push({
        labelKey: 'chat.legal.chips.list',
        icon: 'pi pi-list',
        action: 'legal-list',
      });
    }
    chips.push({
      labelKey: 'chat.chips.openEditor',
      icon: 'pi pi-arrow-up-right',
      action: 'editor',
      payload: kind,
    });
    const crossSell: Record<DeliverableKind, DeliverableKind> = {
      businessPlan: 'pitchDeck',
      pitchDeck: 'finance',
      branding: 'businessPlan',
      diagrams: 'businessPlan',
      legalDocs: 'finance',
      finance: 'businessPlan',
      communication: 'pitchDeck',
      businessCards: 'communication',
      simulations: 'finance',
      development: 'deployment',
      deployment: 'diagrams',
    };
    const next = crossSell[kind];
    chips.push({
      labelKey: `chat.chips.show.${next}`,
      icon: 'pi pi-eye',
      action: 'show',
      payload: next,
    });
    return chips;
  }

  /** Livrables prioritaires selon la catégorie de la conversation */
  private static readonly CATEGORY_KINDS: Record<ChatConversationCategory, DeliverableKind[]> = {
    business: ['businessPlan', 'pitchDeck'],
    marketing: ['pitchDeck', 'branding'],
    finance: ['finance', 'businessPlan'],
    legal: ['legalDocs', 'businessPlan'],
    branding: ['branding', 'pitchDeck'],
    tech: ['diagrams', 'businessPlan'],
    general: ['businessPlan', 'branding'],
  };

  private activeConversationCategory(): ChatConversationCategory {
    const id = this.store.activeConversationId();
    return this.store.conversations().find((c) => c.id === id)?.category ?? 'general';
  }

  /**
   * Raccourcis contextuels : selon la catégorie de la conversation et l'état
   * réel du projet, propose d'afficher un livrable existant ou de générer
   * un livrable manquant (ex. charte graphique).
   */
  private genericChips(): ChatChip[] {
    const project = this.session.activeProject();
    const kinds = ChatHomePage.CATEGORY_KINDS[this.activeConversationCategory()];
    const chips = kinds.slice(0, 2).map((kind) => this.deliverableChip(kind, project));
    chips.push({ labelKey: 'chat.chips.status', icon: 'pi pi-compass', action: 'status' });
    return chips;
  }

  /** Chip « Voir X » si le livrable existe, « Générer X » sinon. */
  private deliverableChip(kind: DeliverableKind, project: ProjectModel | null): ChatChip {
    if (kind === 'branding') {
      if (!this.branding.isComplete(project)) {
        return {
          labelKey: 'chat.branding.chips.complete',
          icon: 'pi pi-sparkles',
          action: 'branding-start',
        };
      }
      if (!this.branding.hasCharte(project)) {
        return {
          labelKey: 'chat.chips.generate.branding',
          icon: 'pi pi-sparkles',
          action: 'generate',
          payload: 'branding',
        };
      }
      return {
        labelKey: 'chat.chips.show.branding',
        icon: 'pi pi-eye',
        action: 'show',
        payload: 'branding',
      };
    }
    const available = this.deliverables.buildCard(kind, project).available;
    return available
      ? { labelKey: `chat.chips.show.${kind}`, icon: 'pi pi-eye', action: 'show', payload: kind }
      : {
          labelKey: `chat.chips.generate.${kind}`,
          icon: 'pi pi-sparkles',
          action: 'generate',
          payload: kind,
        };
  }

  private async respondWithDownload(
    kind: DeliverableKind,
    documentId?: string | null,
  ): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    const project = this.session.activeProject();
    const config = this.deliverables.config(kind);
    const title = this.translate.instant(config.titleKey);

    if (!config.pdfSupported) {
      const card = this.deliverables.buildCard(kind, project, documentId);
      this.appendAssistant({
        content: this.translate.instant('chat.responses.noPdf', { title }),
        card,
        chips: this.buildCardChips(kind, card.available, card.pdfSupported, documentId),
      });
      return;
    }

    this.pendingAssistant.set(true);
    const ok = await this.deliverables.download(kind, projectId, project?.name, documentId);
    this.pendingAssistant.set(false);

    if (ok) {
      this.appendAssistant({
        content: this.translate.instant('chat.responses.downloadStarted', { title }),
        chips: this.genericChips(),
      });
    } else {
      const card = this.deliverables.buildCard(kind, project, documentId);
      this.appendAssistant({
        content: this.translate.instant('chat.responses.downloadUnavailable', { title }),
        card,
        chips: this.buildCardChips(kind, card.available, card.pdfSupported, documentId),
      });
    }
  }

  private respondWithStatus(): void {
    const project = this.session.activeProject();
    this.appendAssistant({
      content: this.deliverables.buildStatusSummary(project),
      chips: this.genericChips(),
    });
  }

  private async respondWithExportAll(): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    this.pendingAssistant.set(true);
    const count = await this.deliverables.exportAll(projectId, this.session.activeProject()?.name);
    this.pendingAssistant.set(false);
    this.appendAssistant({
      content:
        count > 0
          ? this.translate.instant('chat.responses.exportDone', { count })
          : this.translate.instant('chat.responses.exportNothing'),
      chips: this.genericChips(),
    });
  }

  // ─────────────────────────────────────────────── Réponse IA libre (advisor)

  private async askAdvisor(content: string): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    this.brandingFlowEngaged.set(false);
    this.pendingAssistant.set(true);
    try {
      const result = await firstValueFrom(this.advisor.sendMessage(projectId, content));
      this.appendAssistant({
        content: result.assistantMessage.content,
        chips: this.genericChips(),
      });
    } catch (error) {
      console.error('Chat: advisor error', error);
      this.errorMessage.set(this.translate.instant('chat.errors.send'));
      this.draft.set(content);
    } finally {
      this.pendingAssistant.set(false);
    }
  }

  // ─────────────────────────────────────────────── Chips

  protected onChipSelected(chip: ChatChip): void {
    if (this.pendingAssistant() || this.isCreatingProject()) return;
    switch (chip.action) {
      case 'send':
        this.draft.set(chip.payload ?? this.chipLabel(chip));
        this.send();
        break;
      case 'show':
        this.appendUser(this.chipLabel(chip));
        this.respondWithCard(chip.payload as DeliverableKind, chip.documentId);
        break;
      case 'download':
        this.appendUser(this.chipLabel(chip));
        void this.respondWithDownload(chip.payload as DeliverableKind, chip.documentId);
        break;
      case 'documents':
        this.appendUser(this.chipLabel(chip));
        void this.respondWithDocuments(chip.payload as MultiDocumentKind);
        break;
      case 'status':
        this.appendUser(this.chipLabel(chip));
        this.respondWithStatus();
        break;
      case 'export-all':
        this.appendUser(this.chipLabel(chip));
        void this.respondWithExportAll();
        break;
      case 'editor': {
        const config = this.deliverables.config(chip.payload as DeliverableKind);
        this.uiMode.openInEditor(config.editorRoute);
        break;
      }
      case 'answer':
        this.handleOnboardingInput(chip.payload ?? '', this.chipLabel(chip), false);
        break;
      case 'skip':
        this.handleOnboardingInput('', '', true);
        break;
      case 'new-project':
        this.router.navigate(['/create-project']);
        break;
      case 'branding-start':
      case 'branding-ai':
        this.appendUser(this.chipLabel(chip));
        void this.advanceBrandingFlow();
        break;
      case 'branding-import':
        this.appendUser(this.chipLabel(chip));
        this.appendAssistant({ content: this.translate.instant('chat.branding.importRedirect') });
        this.uiMode.openInEditor('/project/complete-branding');
        break;
      case 'branding-later':
        this.appendUser(this.chipLabel(chip));
        this.appendAssistant({
          content: this.translate.instant('chat.branding.laterOk'),
          chips: this.genericChips(),
        });
        break;
      case 'branding-logo-type':
        this.appendUser(this.chipLabel(chip));
        this.pendingLogoType = (chip.payload as LogoType) ?? 'icon';
        this.awaitingLogoDescription.set(true);
        this.appendAssistant({
          content: this.translate.instant('chat.branding.describeLogo'),
          chips: [
            {
              labelKey: 'chat.branding.chips.skipDescription',
              icon: 'pi pi-forward',
              action: 'branding-skip-description',
            },
          ],
        });
        break;
      case 'branding-skip-description':
        this.appendUser(this.translate.instant('chat.onboarding.actions.skipped'));
        void this.finalizeLogoPreferences(undefined);
        break;
      case 'generate':
        this.appendUser(this.chipLabel(chip));
        void this.startGeneration(chip.payload as DeliverableKind);
        break;
      case 'bp-fill-form':
        this.appendUser(this.chipLabel(chip));
        this.awaitingBpInfoText.set(false);
        this.appendAssistant({
          content: this.translate.instant('chat.bp.formIntro'),
          infoForm: true,
        });
        break;
      case 'bp-free-text':
        this.appendUser(this.chipLabel(chip));
        this.awaitingBpInfoText.set(true);
        this.appendAssistant({
          content: this.translate.instant('chat.bp.freeTextPrompt'),
          chips: [
            {
              labelKey: 'chat.bp.chips.skipInfos',
              icon: 'pi pi-forward',
              action: 'bp-generate',
              payload: 'skip',
            },
          ],
        });
        break;
      case 'bp-generate': {
        this.appendUser(this.chipLabel(chip));
        this.awaitingBpInfoText.set(false);
        const infos = chip.payload === 'with-infos' ? this.pendingBpInfos : null;
        void this.runSseGeneration('businessPlan', { infos: infos ?? undefined });
        break;
      }
      case 'download-logos-zip': {
        this.appendUser(this.chipLabel(chip));
        void this.downloadLogosZip();
        break;
      }
      case 'preview':
        void this.openPreview(chip.payload as DeliverableKind, chip.documentId);
        break;
      case 'regenerate-section': {
        // `payload` = « livrable:Nom de section » (nom canonique côté API).
        const [kind, ...rest] = (chip.payload ?? '').split(':');
        const sectionName = rest.join(':');
        if (!kind || !sectionName) break;
        this.appendUser(this.chipLabel(chip));
        void this.runSseGeneration(kind as SseGenKind, {
          documentId: chip.documentId,
          sections: [sectionName],
        });
        break;
      }
      case 'generate-now':
        // Lance la génération telle quelle, sans repasser par le parcours de
        // choix (format, structure, section…) qui l'a proposée.
        this.appendUser(this.chipLabel(chip));
        void this.runSseGeneration(chip.payload as SseGenKind, { documentId: chip.documentId });
        break;
      case 'legal-list':
        this.appendUser(this.chipLabel(chip));
        void this.respondWithLegalDocs();
        break;
      case 'legal-download':
        void this.downloadLegalDocument(chip.payload ?? '');
        break;
      case 'legal-delete':
        void this.deleteLegalDocument(chip.payload ?? '');
        break;
      case 'finance-section':
        this.appendUser(this.chipLabel(chip));
        void this.fillFinanceSection(chip.payload as FinanceSectionKey);
        break;
      case 'cards-generate':
        this.appendUser(this.chipLabel(chip));
        void this.generateBusinessCards((chip.payload as BusinessCardOrientation) ?? 'landscape');
        break;
      case 'charte-regenerate':
        this.appendUser(this.chipLabel(chip));
        this.askCharteFormat();
        break;
      case 'legal-type':
        this.appendUser(this.chipLabel(chip));
        this.generateLegalDocs(chip.payload ?? '');
        break;
      case 'comm-strategy':
        this.appendUser(this.chipLabel(chip));
        this.runCommunicationGeneration('strategy');
        break;
      case 'comm-calendar':
        this.appendUser(this.chipLabel(chip));
        this.runCommunicationGeneration('calendar');
        break;
      case 'deck-type':
        this.appendUser(this.chipLabel(chip));
        void this.createAndGeneratePitchDeck(chip.payload ?? '');
        break;
      case 'open-route':
        this.uiMode.openInEditor(chip.payload ?? '/project/dashboard');
        break;
    }
  }

  private async downloadLogosZip(): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    this.pendingAssistant.set(true);
    const ok = await this.branding.downloadLogosZip(
      projectId,
      this.session.activeProject()?.name,
    );
    this.pendingAssistant.set(false);
    this.appendAssistant({
      content: this.translate.instant(
        ok ? 'chat.branding.zipStarted' : 'chat.branding.zipUnavailable',
      ),
      chips: this.genericChips(),
    });
  }

  // ─────────────────────────────────────────────── Cartes : actions

  protected openEditor(editorRoute: string): void {
    this.uiMode.openInEditor(editorRoute);
  }

  protected openGenerateFor(card: DeliverableCardData): void {
    // Chaque livrable est généré / guidé directement dans le chat.
    void this.startGeneration(card.kind);
  }

  protected async downloadFromCard(
    kind: DeliverableKind,
    documentId?: string | null,
  ): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.cardBusy()) return;
    this.cardBusy.set(true);
    try {
      const ok = await this.deliverables.download(
        kind,
        projectId,
        this.session.activeProject()?.name,
        documentId,
      );
      if (!ok) {
        const title = this.translate.instant(this.deliverables.config(kind).titleKey);
        this.appendAssistant({
          content: this.translate.instant('chat.responses.downloadUnavailable', { title }),
        });
      }
    } finally {
      this.cardBusy.set(false);
    }
  }

  // ─────────────────────────────────────────────── Lecture d'un document

  /**
   * Ouvre un document dans le tiroir de lecture.
   *
   * Le tiroir rend les sections du document — mêmes pages que l'éditeur, pages
   * manquantes signalées à leur place, régénération page par page. Les
   * livrables qui n'ont pas de document rendu (diagrammes, juridique, finance)
   * retombent sur leur PDF ou sur leur module.
   */
  protected async openPreview(
    kind: DeliverableKind,
    documentId?: string | null,
  ): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    if (!this.documents.isPreviewable(kind)) {
      await this.respondWithDownload(kind);
      return;
    }

    this.cardBusy.set(true);
    try {
      // L'aperçu lit les sections depuis l'API ; le fil, lui, a besoin de
      // l'état à jour pour savoir ce qui manque encore.
      const project = (await this.session.fetchActiveProjectDetails()) ?? this.session.activeProject();
      let targetId = documentId ?? null;
      let expectedSectionNames: string[] | undefined;

      if (kind !== 'branding') {
        const summaries = await this.documents.list(kind, projectId);
        const target = summaries.find((doc) => doc.id === targetId) ?? summaries[0];
        targetId = target?.id ?? null;
        expectedSectionNames = target?.expectedSectionNames;
      }

      const config = this.documents.previewConfig(kind);
      const fallbackTitle = this.translate.instant(this.deliverables.config(kind).titleKey);
      this.preview.set({
        kind,
        documentId: targetId,
        documentType: config.documentType,
        sectionLabelPrefix: config.sectionLabelPrefix,
        title: this.documents.heading(kind, project, targetId, fallbackTitle),
        outline: this.documents.outline(kind, project, targetId, expectedSectionNames),
      });
    } finally {
      this.cardBusy.set(false);
    }
  }

  protected closePreview(): void {
    this.preview.set(null);
  }

  /** Nom lisible d'une section (le fil parle de « Plan financier », pas de `Financial Plan`). */
  private sectionLabel(prefix: string, name: string): string {
    if (!prefix) return name;
    const label: unknown = this.translate.instant(prefix + name);
    return typeof label === 'string' && label !== prefix + name ? label : name;
  }

  /**
   * Régénérer une page depuis le tiroir.
   *
   * La génération repart dans la conversation plutôt que dans le tiroir : elle
   * dure, elle est facturée, et l'utilisateur doit pouvoir la suivre — et la
   * retrouver — au même endroit que toutes les autres.
   */
  protected onPreviewRegenerateSection(sectionName: string): void {
    const current = this.preview();
    if (!current || this.isGenerating()) return;
    const label = this.sectionLabel(current.sectionLabelPrefix, sectionName);
    this.closePreview();
    this.appendUser(this.translate.instant('chat.preview.askRegenerateSection', { section: label }));
    void this.runSseGeneration(current.kind, {
      documentId: current.documentId,
      sections: [sectionName],
    });
  }

  /** Compléter : seules les pages manquantes ou en échec sont générées. */
  protected onPreviewResume(): void {
    const current = this.preview();
    if (!current || this.isGenerating()) return;
    this.closePreview();
    this.appendUser(this.translate.instant('chat.preview.askResume'));
    void this.runSseGeneration(current.kind, { documentId: current.documentId });
  }

  protected onPreviewRegenerateAll(): void {
    const current = this.preview();
    if (!current || this.isGenerating()) return;
    this.closePreview();
    this.appendUser(this.translate.instant('chat.preview.askRegenerateAll'));
    void this.runSseGeneration(current.kind, { documentId: current.documentId, force: true });
  }

  // ─────────────────────────────────────────────── Documents d'un livrable

  /**
   * Liste les business plans (ou les pitch decks) du projet dans le fil.
   *
   * Un projet en garde plusieurs — dossier bancaire et plan investisseur, deck
   * de levée et présentation commerciale. Sans cette liste, le chat agissait
   * toujours sur le plus récent.
   */
  private async respondWithDocuments(kind: MultiDocumentKind): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    this.pendingAssistant.set(true);
    const documents = await this.documents.list(kind, projectId);
    this.pendingAssistant.set(false);
    this.appendAssistant({
      content: this.translate.instant(
        documents.length > 0 ? `chat.documents.${kind}.intro` : `chat.documents.${kind}.none`,
        { count: documents.length },
      ),
      documentList: { kind, documents },
    });
  }

  /** Rafraîchit la liste posée dans un message après une action. */
  private async refreshDocumentList(messageId: string, kind: MultiDocumentKind): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    const documents = await this.documents.list(kind, projectId);
    this.store.patch(messageId, { documentList: { kind, documents } });
  }

  protected onDocumentOpened(kind: MultiDocumentKind, documentId: string): void {
    void this.openPreview(kind, documentId);
  }

  protected async onDocumentDownloaded(
    kind: MultiDocumentKind,
    documentId: string,
  ): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.cardBusy()) return;
    this.cardBusy.set(true);
    try {
      const ok = await this.deliverables.download(
        kind,
        projectId,
        this.session.activeProject()?.name,
        documentId,
      );
      if (!ok) {
        const title = this.translate.instant(this.deliverables.config(kind).titleKey);
        this.appendAssistant({
          content: this.translate.instant('chat.responses.downloadUnavailable', { title }),
        });
      }
    } finally {
      this.cardBusy.set(false);
    }
  }

  protected async onDocumentRenamed(
    messageId: string,
    kind: MultiDocumentKind,
    change: { id: string; name: string },
  ): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.cardBusy()) return;
    this.cardBusy.set(true);
    try {
      await firstValueFrom(this.documents.rename(kind, projectId, change.id, change.name));
      await this.refreshDocumentList(messageId, kind);
      await this.session.fetchActiveProjectDetails();
    } catch (error) {
      console.error('Chat documents: rename failed', error);
      this.appendAssistant({ content: this.translate.instant('chat.documents.renameFailed') });
    } finally {
      this.cardBusy.set(false);
    }
  }

  protected async onDocumentRemoved(
    messageId: string,
    kind: MultiDocumentKind,
    documentId: string,
  ): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.cardBusy()) return;
    this.cardBusy.set(true);
    try {
      await firstValueFrom(this.documents.remove(kind, projectId, documentId));
      // Le document ouvert vient peut-être d'être supprimé.
      if (this.preview()?.documentId === documentId) this.closePreview();
      await this.refreshDocumentList(messageId, kind);
      await this.session.fetchActiveProjectDetails();
    } catch (error) {
      console.error('Chat documents: delete failed', error);
      this.appendAssistant({ content: this.translate.instant('chat.documents.deleteFailed') });
    } finally {
      this.cardBusy.set(false);
    }
  }

  /** « Créer un autre document » : le parcours de création, dans le fil. */
  protected onDocumentCreateRequested(kind: MultiDocumentKind): void {
    if (this.isGenerating() || this.pendingAssistant()) return;
    this.appendUser(this.translate.instant(`chat.documents.${kind}.create`));
    void this.startGeneration(kind);
  }

  // ─────────────────────────────────────────────── Identité de marque (flux conversationnel)

  /** Chips d'invitation à compléter l'identité de marque. */
  private brandingInviteChips(): ChatChip[] {
    return [
      { labelKey: 'chat.branding.chips.ai', icon: 'pi pi-sparkles', action: 'branding-ai' },
      { labelKey: 'chat.branding.chips.import', icon: 'pi pi-upload', action: 'branding-import' },
      { labelKey: 'chat.branding.chips.later', icon: 'pi pi-clock', action: 'branding-later' },
    ];
  }

  private brandingRetryChips(): ChatChip[] {
    return [
      { labelKey: 'chat.branding.chips.retry', icon: 'pi pi-refresh', action: 'branding-start' },
    ];
  }

  /** CTA du bandeau d'avertissement : lance la complétion dans le fil. */
  protected startBrandingFromBanner(): void {
    if (this.pendingAssistant() || this.brandingBusy()) return;
    this.appendUser(this.translate.instant('chat.branding.chips.complete'));
    void this.advanceBrandingFlow();
  }

  /**
   * Avance le flux de complétion d'identité : l'étape est dérivée de l'état
   * réel du projet, le flux reprend donc toujours exactement où il en est.
   */
  private async advanceBrandingFlow(): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    this.brandingFlowEngaged.set(true);

    let project = this.session.activeProject();
    if (!project?.analysisResultModel) {
      project = await this.session.fetchActiveProjectDetails();
    }
    if (!project) return;

    const step = this.branding.nextStep(project);

    switch (step) {
      case 'colors-generate': {
        this.appendAssistant({
          content: this.translate.instant('chat.branding.generatingPalettes'),
        });
        this.pendingAssistant.set(true);
        try {
          project = await this.branding.generateColorsAndTypography(project);
          this.appendAssistant({
            content: this.translate.instant('chat.branding.choosePalette'),
            colorOptions: this.branding.generatedColors(project),
          });
        } catch (error) {
          console.error('Chat branding: colors generation failed', error);
          this.appendAssistant({
            content: this.translate.instant('chat.branding.errors.generation'),
            chips: this.brandingRetryChips(),
          });
        } finally {
          this.pendingAssistant.set(false);
        }
        break;
      }
      case 'colors-pick':
        this.appendAssistant({
          content: this.translate.instant('chat.branding.choosePalette'),
          colorOptions: this.branding.generatedColors(project),
        });
        break;
      case 'typography-pick':
        this.appendAssistant({
          content: this.translate.instant('chat.branding.chooseTypography'),
          typographyOptions: this.branding.generatedTypography(project),
        });
        break;
      case 'logo-type':
        this.appendAssistant({
          content: this.translate.instant('chat.branding.chooseLogoType'),
          chips: [
            { labelKey: 'chat.branding.logoTypes.icon', icon: 'pi pi-star', action: 'branding-logo-type', payload: 'icon' },
            { labelKey: 'chat.branding.logoTypes.name', icon: 'pi pi-pencil', action: 'branding-logo-type', payload: 'name' },
            { labelKey: 'chat.branding.logoTypes.initial', icon: 'pi pi-bookmark', action: 'branding-logo-type', payload: 'initial' },
          ],
        });
        break;
      case 'logos-generate':
        await this.generateLogoConcepts(project);
        break;
      case 'logos-pick':
        this.appendAssistant({
          content: this.translate.instant('chat.branding.chooseLogo'),
          logoOptions: this.branding.generatedLogos(project),
        });
        break;
      case 'variations-generate': {
        this.appendAssistant({
          content: this.translate.instant('chat.branding.generatingVariations'),
        });
        this.pendingAssistant.set(true);
        try {
          const updated = await this.branding.generateVariations(project);
          this.pendingAssistant.set(false);
          this.brandingFlowEngaged.set(false);
          const card = this.deliverables.buildCard('branding', updated);
          this.appendAssistant({
            content: this.translate.instant('chat.branding.complete'),
            card,
            chips: [
              {
                labelKey: 'chat.branding.chips.downloadZip',
                icon: 'pi pi-download',
                action: 'download-logos-zip',
              },
              {
                labelKey: 'chat.chips.generate.branding',
                icon: 'pi pi-sparkles',
                action: 'generate',
                payload: 'branding',
              },
              {
                labelKey: 'chat.chips.show.businessPlan',
                icon: 'pi pi-calendar',
                action: 'show',
                payload: 'businessPlan',
              },
            ],
          });
        } catch (error) {
          console.error('Chat branding: variations generation failed', error);
          this.pendingAssistant.set(false);
          this.appendAssistant({
            content: this.translate.instant('chat.branding.errors.generation'),
            chips: this.brandingRetryChips(),
          });
        }
        break;
      }
      case 'complete': {
        this.brandingFlowEngaged.set(false);
        const card = this.deliverables.buildCard('branding', project);
        this.appendAssistant({
          content: this.translate.instant('chat.branding.alreadyComplete'),
          card,
          chips: this.buildCardChips('branding', card.available, card.pdfSupported),
        });
        break;
      }
    }
  }

  /** Persiste les préférences logo puis lance la génération des concepts. */
  private async finalizeLogoPreferences(description: string | undefined): Promise<void> {
    this.awaitingLogoDescription.set(false);
    const project = this.session.activeProject();
    if (!project) return;

    this.pendingAssistant.set(true);
    try {
      const updated = await this.branding.saveLogoPreferences(project, {
        type: this.pendingLogoType ?? 'icon',
        useAIGeneration: true,
        customDescription: description?.trim() || undefined,
      });
      this.pendingAssistant.set(false);
      await this.generateLogoConcepts(updated);
    } catch (error) {
      console.error('Chat branding: saving logo preferences failed', error);
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.branding.errors.generation'),
        chips: this.brandingRetryChips(),
      });
    }
  }

  private async generateLogoConcepts(project: ProjectModel): Promise<void> {
    this.appendAssistant({ content: this.translate.instant('chat.branding.generatingLogos') });
    this.pendingAssistant.set(true);
    try {
      const updated = await this.branding.generateLogos(project);
      this.appendAssistant({
        content: this.translate.instant('chat.branding.chooseLogo'),
        logoOptions: this.branding.generatedLogos(updated),
      });
    } catch (error) {
      console.error('Chat branding: logo generation failed', error);
      this.appendAssistant({
        content: this.translate.instant('chat.branding.errors.generation'),
        chips: this.brandingRetryChips(),
      });
    } finally {
      this.pendingAssistant.set(false);
    }
  }

  protected async onColorPicked(messageId: string, color: ColorModel): Promise<void> {
    const project = this.session.activeProject();
    if (!project || this.brandingBusy()) return;
    this.brandingBusy.set(true);
    this.store.patch(messageId, { selectedOptionId: color.id });
    this.appendUser(color.name || this.translate.instant('chat.branding.thisPalette'));
    try {
      await this.branding.selectColor(project, color);
      await this.advanceBrandingFlow();
    } catch (error) {
      console.error('Chat branding: color selection failed', error);
      this.appendAssistant({
        content: this.translate.instant('chat.branding.errors.save'),
        chips: this.brandingRetryChips(),
      });
    } finally {
      this.brandingBusy.set(false);
    }
  }

  protected async onTypographyPicked(messageId: string, typography: TypographyModel): Promise<void> {
    const project = this.session.activeProject();
    if (!project || this.brandingBusy()) return;
    this.brandingBusy.set(true);
    this.store.patch(messageId, { selectedOptionId: typography.id });
    this.appendUser(typography.name || this.translate.instant('chat.branding.thisTypography'));
    try {
      await this.branding.selectTypography(project, typography);
      await this.advanceBrandingFlow();
    } catch (error) {
      console.error('Chat branding: typography selection failed', error);
      this.appendAssistant({
        content: this.translate.instant('chat.branding.errors.save'),
        chips: this.brandingRetryChips(),
      });
    } finally {
      this.brandingBusy.set(false);
    }
  }

  protected async onLogoPicked(messageId: string, logo: LogoModel): Promise<void> {
    const project = this.session.activeProject();
    if (!project || this.brandingBusy()) return;
    this.brandingBusy.set(true);
    this.store.patch(messageId, { selectedOptionId: logo.id });
    this.appendUser(logo.name || this.translate.instant('chat.branding.thisLogo'));
    try {
      await this.branding.selectLogo(project, logo);
      // Enchaîne sur la génération des déclinaisons du logo
      await this.advanceBrandingFlow();
    } catch (error) {
      console.error('Chat branding: logo selection failed', error);
      this.appendAssistant({
        content: this.translate.instant('chat.branding.errors.save'),
        chips: this.brandingRetryChips(),
      });
    } finally {
      this.brandingBusy.set(false);
    }
  }

  // ─────────────────────────────────────────────── Génération depuis le chat

  /** Point d'entrée « générer X » (chips contextuelles et intentions). */
  private async startGeneration(kind: DeliverableKind): Promise<void> {
    const project = this.session.activeProject();

    switch (kind) {
      case 'branding':
        // Identité incomplète → flux de complétion ; sinon charte graphique
        if (!this.branding.isComplete(project)) {
          await this.advanceBrandingFlow();
        } else if (this.branding.hasCharte(project)) {
          this.respondCharteAlreadyExists();
        } else {
          this.askCharteFormat();
        }
        break;
      case 'businessPlan':
        this.startBusinessPlanFlow();
        break;
      case 'pitchDeck':
        await this.startPitchDeckFlow();
        break;
      case 'diagrams':
        await this.runSseGeneration('diagrams');
        break;
      case 'finance':
        this.startFinanceFlow();
        break;
      case 'legalDocs':
        this.startLegalDocsFlow();
        break;
      case 'communication':
        this.startCommunicationFlow();
        break;
      case 'businessCards':
        this.startBusinessCardsFlow();
        break;
      case 'simulations':
        this.openSimulationsGuide();
        break;
      case 'development':
        this.openDevelopmentGuide();
        break;
      case 'deployment':
        this.openDeploymentGuide();
        break;
    }
  }

  // ─────────────────────────────────────────────── Documents juridiques

  /** Propose de choisir le(s) type(s) de document juridique à générer. */
  private startLegalDocsFlow(): void {
    this.appendAssistant({
      content: this.translate.instant('chat.legal.intro'),
      chips: [
        {
          labelKey: 'chat.legal.chips.essentials',
          icon: 'pi pi-star',
          action: 'legal-type',
          payload: 'cgu,cgv,privacy_policy,legal_mentions',
        },
        { labelKey: 'chat.legal.chips.cgu', icon: 'pi pi-file', action: 'legal-type', payload: 'cgu' },
        { labelKey: 'chat.legal.chips.cgv', icon: 'pi pi-file', action: 'legal-type', payload: 'cgv' },
        { labelKey: 'chat.legal.chips.privacy', icon: 'pi pi-shield', action: 'legal-type', payload: 'privacy_policy' },
        { labelKey: 'chat.legal.chips.statutes', icon: 'pi pi-building', action: 'legal-type', payload: 'statuts_sas' },
        { labelKey: 'chat.legal.chips.nda', icon: 'pi pi-lock', action: 'legal-type', payload: 'nda' },
        {
          labelKey: 'chat.legal.chips.editor',
          icon: 'pi pi-arrow-up-right',
          action: 'open-route',
          payload: '/project/legal-docs',
        },
      ],
    });
  }

  private generateLegalDocs(rawTypes: string): void {
    const types = rawTypes.split(',').filter(Boolean) as LegalDocumentType[];
    if (types.length === 0) return;
    void this.runSseGeneration('legalDocs', { legalTypes: types });
  }

  /**
   * Les documents juridiques déjà rédigés, avec de quoi les télécharger ou
   * les retirer un par un — ce que seule la page du mode Avancé permettait.
   */
  private async respondWithLegalDocs(): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    this.pendingAssistant.set(true);
    try {
      const legal = await firstValueFrom(this.legalDocsService.getLegalDocs(projectId));
      this.pendingAssistant.set(false);
      this.appendLegalDocsMessage(legal);
    } catch (error) {
      console.error('Chat legal: loading the documents failed', error);
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.legal.loadFailed'),
        chips: [{ labelKey: 'chat.legal.chips.list', icon: 'pi pi-refresh', action: 'legal-list' }],
      });
    }
  }

  /** Un document juridique = deux chips (télécharger, supprimer), dans le fil. */
  private appendLegalDocsMessage(legal: LegalDocsModel | null): void {
    const documents = (legal?.documents ?? []).filter((doc) => !!doc.id);
    if (documents.length === 0) {
      this.appendAssistant({
        content: this.translate.instant('chat.legal.emptyList'),
        chips: [
          { labelKey: 'chat.chips.generate.legalDocs', icon: 'pi pi-sparkles', action: 'generate', payload: 'legalDocs' },
        ],
      });
      return;
    }

    const chips: ChatChip[] = [];
    for (const doc of documents) {
      chips.push({
        label: this.translate.instant('chat.legal.downloadOne', { name: doc.name }),
        icon: 'pi pi-download',
        action: 'legal-download',
        payload: doc.id!,
      });
    }
    chips.push({
      labelKey: 'chat.chips.generate.legalDocs',
      icon: 'pi pi-sparkles',
      action: 'generate',
      payload: 'legalDocs',
    });
    chips.push({
      labelKey: 'chat.legal.chips.editor',
      icon: 'pi pi-arrow-up-right',
      action: 'open-route',
      payload: '/project/legal-docs',
    });

    const lines = [this.translate.instant('chat.legal.listIntro', { count: documents.length }), ''];
    for (const doc of documents) {
      lines.push(`- **${doc.name}**`);
    }
    this.appendAssistant({ content: lines.join('\n'), chips });
  }

  private async downloadLegalDocument(documentId: string): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || !documentId || this.cardBusy()) return;
    this.cardBusy.set(true);
    try {
      const blob = await firstValueFrom(
        this.legalDocsService.downloadDocumentPdf(projectId, documentId),
      );
      if (!blob || blob.size === 0) throw new Error('empty');
      const name = (this.session.activeProject()?.name || 'idem')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-');
      this.deliverables.triggerDownload(blob, `${name}-${documentId}.pdf`);
    } catch (error) {
      console.error('Chat legal: download failed', error);
      this.appendAssistant({ content: this.translate.instant('chat.legal.downloadFailed') });
    } finally {
      this.cardBusy.set(false);
    }
  }

  private async deleteLegalDocument(documentId: string): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || !documentId || this.cardBusy()) return;
    this.cardBusy.set(true);
    try {
      const legal = await firstValueFrom(
        this.legalDocsService.deleteDocument(projectId, documentId),
      );
      await this.session.fetchActiveProjectDetails();
      this.appendAssistant({ content: this.translate.instant('chat.legal.deleted') });
      this.appendLegalDocsMessage(legal);
    } catch (error) {
      console.error('Chat legal: delete failed', error);
      this.appendAssistant({ content: this.translate.instant('chat.legal.deleteFailed') });
    } finally {
      this.cardBusy.set(false);
    }
  }

  // ─────────────────────────────────────────────── Finance

  /**
   * Sections du module Finance remplissables une par une, comme en mode
   * Avancé. La clé technique et la clé de libellé diffèrent : les libellés de
   * la barre latérale sont ceux que l'utilisateur lit déjà ailleurs.
   */
  private static readonly FINANCE_SECTIONS: Array<{
    key: FinanceSectionKey;
    labelKey: string;
  }> = [
    { key: 'products', labelKey: 'dashboard.finance.sections.products' },
    { key: 'salesObjectives', labelKey: 'dashboard.finance.sections.sales' },
    { key: 'variableCharges', labelKey: 'dashboard.finance.sections.charges' },
    { key: 'fixedCharges', labelKey: 'dashboard.finance.sections.fixedCharges' },
    { key: 'investments', labelKey: 'dashboard.finance.sections.investments' },
    { key: 'financing', labelKey: 'dashboard.finance.sections.financing' },
  ];

  /**
   * Propose de remplir tout le modèle financier, ou une seule section.
   *
   * Le tout-en-un rejoue chaque section : quand une seule est à revoir, le
   * faire coûte le prix du modèle entier pour un résultat identique ailleurs.
   */
  private startFinanceFlow(): void {
    const chips: ChatChip[] = [
      {
        labelKey: 'chat.finance.chips.fillAll',
        icon: 'pi pi-sparkles',
        action: 'generate-now',
        payload: 'finance',
      },
      ...ChatHomePage.FINANCE_SECTIONS.map((section) => ({
        labelKey: section.labelKey,
        icon: 'pi pi-pencil',
        action: 'finance-section' as const,
        payload: section.key,
      })),
      {
        labelKey: 'chat.card.actions.openEditor',
        icon: 'pi pi-arrow-up-right',
        action: 'open-route' as const,
        payload: '/project/finance',
      },
    ];
    this.appendAssistant({ content: this.translate.instant('chat.finance.intro'), chips });
  }

  /** Remplissage IA d'une section du modèle financier. */
  private async fillFinanceSection(sectionKey: FinanceSectionKey): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.pendingAssistant()) return;
    const label = this.translate.instant(
      ChatHomePage.FINANCE_SECTIONS.find((section) => section.key === sectionKey)?.labelKey ??
        `dashboard.finance.sections.${sectionKey}`,
    );
    this.pendingAssistant.set(true);
    try {
      await firstValueFrom(this.financeService.autoFillSection(projectId, sectionKey));
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.finance.sectionDone', { section: label }),
        chips: [
          {
            labelKey: 'chat.chips.downloadPdf',
            icon: 'pi pi-download',
            action: 'download',
            payload: 'finance',
          },
          {
            labelKey: 'chat.card.actions.openEditor',
            icon: 'pi pi-arrow-up-right',
            action: 'open-route',
            payload: '/project/finance',
          },
        ],
      });
    } catch (error) {
      console.error(`Chat finance: filling ${sectionKey} failed`, error);
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.finance.sectionFailed', { section: label }),
        chips: [
          {
            labelKey: 'chat.generation.chips.retry',
            icon: 'pi pi-refresh',
            action: 'finance-section',
            payload: sectionKey,
          },
        ],
      });
    }
  }

  // ─────────────────────────────────────────────── Cartes de visite

  /** Le modèle de carte se dessine depuis la charte : il faut donc une charte. */
  private startBusinessCardsFlow(): void {
    if (!this.branding.isComplete(this.session.activeProject())) {
      this.appendAssistant({
        content: this.translate.instant('chat.cards.needsBranding'),
        chips: this.brandingInviteChips(),
      });
      return;
    }
    this.appendAssistant({
      content: this.translate.instant('chat.cards.orientationQuestion'),
      chips: [
        {
          labelKey: 'chat.cards.chips.landscape',
          icon: 'pi pi-credit-card',
          action: 'cards-generate',
          payload: 'landscape',
        },
        {
          labelKey: 'chat.cards.chips.portrait',
          icon: 'pi pi-id-card',
          action: 'cards-generate',
          payload: 'portrait',
        },
        {
          labelKey: 'chat.card.actions.openEditor',
          icon: 'pi pi-arrow-up-right',
          action: 'open-route',
          payload: '/project/business-cards',
        },
      ],
    });
  }

  private async generateBusinessCards(orientation: BusinessCardOrientation): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.pendingAssistant()) return;
    this.pendingAssistant.set(true);
    try {
      const card = await firstValueFrom(
        this.businessCardService.generateTemplate(projectId, { orientation }),
      );
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.cards.done'),
        chips: this.businessCardChips(card.holders ?? []),
      });
    } catch (error) {
      console.error('Chat cards: template generation failed', error);
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.cards.failed'),
        chips: [
          {
            labelKey: 'chat.generation.chips.retry',
            icon: 'pi pi-refresh',
            action: 'cards-generate',
            payload: orientation,
          },
        ],
      });
    }
  }

  /**
   * Le modèle est dessiné ; les personnes (et donc les cartes à imprimer) se
   * gèrent sur leur page, où chaque carte se relit avant d'être exportée.
   */
  private businessCardChips(holders: BusinessCardHolder[]): ChatChip[] {
    return [
      {
        labelKey: holders.length > 0 ? 'chat.cards.chips.openHolders' : 'chat.cards.chips.addHolder',
        icon: 'pi pi-users',
        action: 'open-route',
        payload: '/project/business-cards',
      },
      {
        labelKey: 'chat.cards.chips.edit',
        icon: 'pi pi-pencil',
        action: 'open-route',
        payload: '/project/business-cards/edit',
      },
    ];
  }

  // ─────────────────────────────────────────────── Communication

  /** Propose de générer la stratégie ou le calendrier de communication. */
  private startCommunicationFlow(): void {
    const brandComplete = this.branding.isComplete(this.session.activeProject());
    const content = brandComplete
      ? this.translate.instant('chat.comm.intro')
      : this.translate.instant('chat.comm.introNeedsBranding');
    this.appendAssistant({
      content,
      chips: [
        { labelKey: 'chat.comm.chips.strategy', icon: 'pi pi-compass', action: 'comm-strategy' },
        { labelKey: 'chat.comm.chips.calendar', icon: 'pi pi-calendar', action: 'comm-calendar' },
        // Composer un visuel se fait à l'atelier : le fil y mène directement
        // plutôt que de déposer l'utilisateur sur le premier onglet venu.
        {
          labelKey: 'chat.comm.chips.studio',
          icon: 'pi pi-sparkles',
          action: 'open-route',
          payload: '/project/communication?screen=studio',
        },
        {
          labelKey: 'chat.comm.chips.library',
          icon: 'pi pi-images',
          action: 'open-route',
          payload: '/project/communication?screen=library',
        },
        {
          labelKey: 'chat.comm.chips.plans',
          icon: 'pi pi-list',
          action: 'open-route',
          payload: '/project/communication?screen=plans',
        },
      ],
    });
  }

  /**
   * Génération SSE de la communication (stratégie ou calendrier). Le flux
   * utilise son propre transport (CommunicationStreamEvent), on met donc à jour
   * la carte de progression à la main.
   */
  private runCommunicationGeneration(step: 'strategy' | 'calendar'): void {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.isGenerating()) return;

    const title = this.translate.instant(
      step === 'strategy' ? 'chat.comm.strategyTitle' : 'chat.comm.calendarTitle',
    );
    const progressId = this.nextId();
    this.store.append({
      id: progressId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      generation: { title, status: 'running', completedSteps: [], stepsInProgress: [] },
    });
    this.isGenerating.set(true);

    const completed: string[] = [];
    const stream =
      step === 'strategy'
        ? this.communicationService.streamStrategy(projectId, { force: true })
        : this.communicationService.streamCalendar(projectId, { force: true });

    let finished = false;
    stream.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event: CommunicationStreamEvent) => {
        if (finished) return;
        const stepLabel = event.step ? this.translate.instant(`chat.comm.steps.${event.step}`) : '';
        if (event.type === 'step-start' && stepLabel) {
          this.store.patch(progressId, {
            generation: { title, status: 'running', completedSteps: [...completed], stepsInProgress: [stepLabel] },
          });
        } else if (event.type === 'step-complete' && stepLabel) {
          if (!completed.includes(stepLabel)) completed.push(stepLabel);
          this.store.patch(progressId, {
            generation: { title, status: 'running', completedSteps: [...completed], stepsInProgress: [] },
          });
        } else if (event.type === 'complete') {
          finished = true;
          this.finishCommunication(step, progressId, title, completed);
        } else if (event.type === 'error') {
          finished = true;
          this.failCommunication(step, progressId, title, completed);
        }
      },
      error: (error) => {
        if (finished) return;
        finished = true;
        console.error(`Chat: communication ${step} generation failed`, error);
        this.failCommunication(step, progressId, title, completed);
      },
      complete: () => {
        if (!finished) {
          finished = true;
          this.finishCommunication(step, progressId, title, completed);
        }
      },
    });
  }

  private finishCommunication(
    step: 'strategy' | 'calendar',
    progressId: string,
    title: string,
    completed: string[],
  ): void {
    this.isGenerating.set(false);
    this.store.patch(progressId, {
      generation: { title, status: 'done', completedSteps: completed, stepsInProgress: [] },
    });
    const chips: ChatChip[] =
      step === 'strategy'
        ? [
            { labelKey: 'chat.comm.chips.calendar', icon: 'pi pi-calendar', action: 'comm-calendar' },
            {
              labelKey: 'chat.card.actions.openEditor',
              icon: 'pi pi-arrow-up-right',
              action: 'open-route',
              payload: '/project/communication',
            },
          ]
        : [
            {
              labelKey: 'chat.card.actions.openEditor',
              icon: 'pi pi-arrow-up-right',
              action: 'open-route',
              payload: '/project/communication',
            },
          ];
    this.appendAssistant({
      content: this.translate.instant(
        step === 'strategy' ? 'chat.comm.strategyDone' : 'chat.comm.calendarDone',
      ),
      chips,
    });
  }

  private failCommunication(
    step: 'strategy' | 'calendar',
    progressId: string,
    title: string,
    completed: string[],
  ): void {
    this.isGenerating.set(false);
    this.store.patch(progressId, {
      generation: { title, status: 'error', completedSteps: completed, stepsInProgress: [] },
    });
    this.appendAssistant({
      content: this.translate.instant('chat.generation.retryHint'),
      chips: [
        {
          labelKey: 'chat.generation.chips.retry',
          icon: 'pi pi-refresh',
          action: step === 'strategy' ? 'comm-strategy' : 'comm-calendar',
        },
      ],
    });
  }

  // ─────────────────────────────────────────────── Développement / Déploiement

  /** Guide vers l'atelier de développement (config app générée dans l'éditeur). */
  private openDevelopmentGuide(): void {
    const hasConfig = this.deliverables.buildCard('development', this.session.activeProject()).available;
    const chips: ChatChip[] = [
      {
        labelKey: 'chat.dev.chips.open',
        icon: 'pi pi-bolt',
        action: 'open-route',
        payload: '/project/development/create',
      },
    ];
    if (hasConfig) {
      chips.push({
        labelKey: 'chat.dev.chips.view',
        icon: 'pi pi-arrow-up-right',
        action: 'open-route',
        payload: '/project/development',
      });
    }
    this.appendAssistant({ content: this.translate.instant('chat.dev.intro'), chips });
  }

  /**
   * Simulations : le récapitulatif vit dans le tableau de bord, la simulation
   * elle-même dans l'application dédiée (même session IDEM). Le chat mène aux
   * deux plutôt que de prétendre simuler dans le fil.
   */
  private openSimulationsGuide(): void {
    this.appendAssistant({
      content: this.translate.instant('chat.simulations.intro'),
      chips: [
        {
          labelKey: 'chat.simulations.chips.open',
          icon: 'pi pi-chart-bar',
          action: 'open-route',
          payload: '/project/simulations',
        },
      ],
    });
  }

  /** Guide vers l'assistant de déploiement (Terraform / infrastructure). */
  private openDeploymentGuide(): void {
    this.appendAssistant({
      content: this.translate.instant('chat.deploy.intro'),
      chips: [
        {
          labelKey: 'chat.deploy.chips.start',
          icon: 'pi pi-bolt',
          action: 'open-route',
          payload: '/project/deployments/create',
        },
        {
          labelKey: 'chat.deploy.chips.list',
          icon: 'pi pi-list',
          action: 'open-route',
          payload: '/project/deployments',
        },
      ],
    });
  }

  /** La charte existe déjà : on le dit et on propose prévisualiser / télécharger. */
  private respondCharteAlreadyExists(): void {
    this.appendAssistant({
      content: this.translate.instant('chat.branding.charteExists'),
      chips: [
        { labelKey: 'chat.card.actions.preview', icon: 'pi pi-eye', action: 'preview', payload: 'branding' },
        { labelKey: 'chat.chips.downloadPdf', icon: 'pi pi-download', action: 'download', payload: 'branding' },
        { labelKey: 'chat.branding.chips.regenerate', icon: 'pi pi-refresh', action: 'charte-regenerate' },
      ],
    });
  }

  /** Demande le format (portrait / paysage) avant de générer la charte. */
  private askCharteFormat(): void {
    this.awaitingFormatChoice.set(true);
    this.appendAssistant({
      content: this.translate.instant('chat.branding.format.question'),
      formatChoice: true,
    });
  }

  protected onFormatPicked(messageId: string, format: ChartePdfFormat): void {
    this.store.patch(messageId, { selectedOptionId: format });
    this.awaitingFormatChoice.set(false);
    this.appendUser(
      this.translate.instant(
        format === 'A4_PORTRAIT' ? 'chat.branding.format.portrait' : 'chat.branding.format.landscape',
      ),
    );
    void this.runSseGeneration('branding', { pdfFormat: format });
  }

  protected onFormatCancelled(messageId: string): void {
    this.store.patch(messageId, { selectedOptionId: 'cancelled' });
    this.awaitingFormatChoice.set(false);
    this.appendAssistant({
      content: this.translate.instant('chat.branding.format.cancelledOk'),
      chips: this.genericChips(),
    });
  }

  /**
   * Rédaction du business plan : on demande d'abord le SOMMAIRE.
   *
   * Il vient avant les informations complémentaires parce qu'il décide de ce
   * qui sera écrit : une banque accepte ou renvoie un dossier sur sa table des
   * matières, et un plan généré au mauvais format doit être refait en entier,
   * pas corrigé.
   */
  private startBusinessPlanFlow(): void {
    this.pendingBpInfos = null;
    this.pendingBpDocumentId = null;
    this.awaitingBpStructure.set(true);
    this.appendAssistant({
      content: this.translate.instant('chat.bp.structure.question'),
      bpStructureChoice: true,
    });
  }

  /** Étape suivante : les informations complémentaires, puis la génération. */
  private startBusinessPlanInfosFlow(): void {
    this.appendAssistant({
      content: this.translate.instant('chat.bp.intro'),
      chips: [
        { labelKey: 'chat.bp.chips.fillForm', icon: 'pi pi-list', action: 'bp-fill-form' },
        { labelKey: 'chat.bp.chips.freeText', icon: 'pi pi-pencil', action: 'bp-free-text' },
        { labelKey: 'chat.bp.chips.skipInfos', icon: 'pi pi-forward', action: 'bp-generate', payload: 'skip' },
      ],
    });
  }

  /**
   * Structure choisie : un NOUVEAU plan est créé sur elle avant de continuer —
   * les plans déjà rédigés restent intacts.
   *
   * L'enregistrement est bloquant à dessein. La génération lit la structure
   * depuis le projet ; enchaîner sans attendre la réponse ferait partir un plan
   * au format précédent, et ce plan-là ne se rattrape pas.
   */
  protected onBpStructurePicked(messageId: string, templateId: string): void {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;

    this.store.patch(messageId, { selectedOptionId: templateId });
    this.awaitingBpStructure.set(false);
    this.appendUser(
      this.translate.instant(`dashboard.businessPlanStructure.templates.${templateId}.name`),
    );
    this.pendingAssistant.set(true);

    const name = this.translate.instant(`dashboard.businessPlanStructure.templates.${templateId}.name`);
    this.businessPlanService.createBusinessPlan(projectId, { templateId, name }).subscribe({
      next: (plan) => {
        this.pendingBpDocumentId = plan.id;
        this.pendingAssistant.set(false);
        this.startBusinessPlanInfosFlow();
      },
      error: (error) => {
        console.error('Chat BP: saving the plan structure failed', error);
        this.pendingAssistant.set(false);
        // La carte est rendue à l'utilisateur plutôt que de continuer sur une
        // structure qu'on n'a pas réussi à poser.
        this.store.patch(messageId, { selectedOptionId: undefined });
        this.awaitingBpStructure.set(true);
        this.appendAssistant({ content: this.translate.instant('chat.bp.structure.saveFailed') });
      },
    });
  }

  /** Composition libre du sommaire : l'atelier est fait pour ça, pas le fil. */
  protected onBpStructureCustomise(messageId: string): void {
    this.store.patch(messageId, { selectedOptionId: 'customise' });
    this.awaitingBpStructure.set(false);
    this.appendUser(this.translate.instant('chat.bp.structure.customise'));
    this.appendAssistant({
      content: this.translate.instant('chat.bp.structure.customiseOk'),
      chips: [
        {
          labelKey: 'chat.bp.structure.chips.openAtelier',
          icon: 'pi pi-external-link',
          action: 'open-route',
          payload: '/project/business-plan/generate',
        },
      ],
    });
  }

  protected onBpStructureCancelled(messageId: string): void {
    this.store.patch(messageId, { selectedOptionId: 'cancelled' });
    this.awaitingBpStructure.set(false);
    this.appendAssistant({
      content: this.translate.instant('chat.bp.structure.cancelledOk'),
      chips: this.genericChips(),
    });
  }

  /** Soumission du mini-formulaire d'infos supplémentaires. */
  protected onInfoFormSubmitted(messageId: string, infos: AdditionalInfos): void {
    this.store.patch(messageId, { selectedOptionId: 'submitted' });
    this.appendUser(this.translate.instant('chat.infoForm.submittedAs'));
    void this.runSseGeneration('businessPlan', { infos });
  }

  protected onInfoFormSkipped(messageId: string): void {
    this.store.patch(messageId, { selectedOptionId: 'submitted' });
    this.appendUser(this.translate.instant('chat.bp.chips.skipInfos'));
    void this.runSseGeneration('businessPlan');
  }

  /** Texte libre : l'IA reformate en données structurées puis demande validation. */
  private async handleBpFreeText(rawText: string): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    this.awaitingBpInfoText.set(false);
    this.pendingAssistant.set(true);
    try {
      const infos = await this.additionalInfoService.formatViaAI(projectId, rawText);
      this.pendingAssistant.set(false);
      if (!infos || !this.additionalInfoService.hasContent(infos)) {
        this.appendAssistant({
          content: this.translate.instant('chat.bp.parseFailed'),
          chips: [
            { labelKey: 'chat.bp.chips.fillForm', icon: 'pi pi-list', action: 'bp-fill-form' },
            { labelKey: 'chat.bp.chips.skipInfos', icon: 'pi pi-forward', action: 'bp-generate', payload: 'skip' },
          ],
        });
        return;
      }
      this.pendingBpInfos = infos;
      this.appendAssistant({
        content: this.buildInfosSummary(infos),
        chips: [
          { labelKey: 'chat.bp.chips.generateNow', icon: 'pi pi-check', action: 'bp-generate', payload: 'with-infos' },
          { labelKey: 'chat.bp.chips.fixForm', icon: 'pi pi-list', action: 'bp-fill-form' },
        ],
      });
    } catch (error) {
      console.error('Chat BP: free text formatting failed', error);
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.bp.parseFailed'),
        chips: [{ labelKey: 'chat.bp.chips.fillForm', icon: 'pi pi-list', action: 'bp-fill-form' }],
      });
    }
  }

  /** Récapitulatif markdown des infos extraites par l'IA. */
  private buildInfosSummary(infos: AdditionalInfos): string {
    const lines: string[] = [this.translate.instant('chat.bp.parsedSummary'), ''];
    const contact = [infos.email, infos.phone, [infos.city, infos.country].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' · ');
    if (contact) lines.push(`- **${this.translate.instant('chat.infoForm.contact')}** : ${contact}`);
    for (const member of infos.teamMembers ?? []) {
      lines.push(`- **${member.name}**${member.role ? ` — ${member.role}` : ''}`);
    }
    return lines.join('\n');
  }

  /**
   * « Générer un pitch deck » : le type d'abord. Un deck de levée et une
   * présentation commerciale n'ont ni les mêmes slides ni le même lecteur.
   */
  private async startPitchDeckFlow(): Promise<void> {
    const compareChip = {
      labelKey: 'chat.deck.chips.compare',
      icon: 'pi pi-external-link',
      action: 'open-route' as const,
      payload: '/project/pitch-deck/new',
    };
    this.pendingAssistant.set(true);
    try {
      const catalog = await firstValueFrom(this.pitchDeckService.getPitchDeckTypes());
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.deck.typeQuestion'),
        chips: [
          ...catalog.types.map((type) => ({
            labelKey: `dashboard.pitchDeckTypes.types.${type.id}.name`,
            icon: 'pi pi-desktop',
            action: 'deck-type' as const,
            payload: type.id,
          })),
          compareChip,
        ],
      });
    } catch (error) {
      console.error('Chat deck: loading the deck types failed', error);
      this.pendingAssistant.set(false);
      this.appendAssistant({
        content: this.translate.instant('chat.deck.typesFailed'),
        chips: [compareChip],
      });
    }
  }

  /** Type choisi : le deck est créé, puis généré dans le fil. */
  private async createAndGeneratePitchDeck(typeId: string): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || !typeId || this.isGenerating()) return;
    try {
      const deck = await firstValueFrom(
        this.pitchDeckService.createPitchDeck(projectId, {
          type: typeId,
          name: this.translate.instant(`dashboard.pitchDeckTypes.types.${typeId}.name`),
        }),
      );
      await this.runSseGeneration('pitchDeck', { documentId: deck.id });
    } catch (error) {
      console.error('Chat deck: creating the pitch deck failed', error);
      this.appendAssistant({
        content: this.translate.instant('chat.deck.createFailed'),
        chips: this.genericChips(),
      });
    }
  }

  /**
   * Génération SSE directement dans le chat : un message de progression est
   * mis à jour à chaque étape.
   *
   * `options.sections` cible des sections précises et `options.force` reprend
   * tout à zéro : ce sont les mêmes paramètres que ceux du mode Avancé, si
   * bien que régénérer une page depuis le tiroir de lecture coûte exactement
   * ce qu'elle coûte là-bas — une section, pas un document entier.
   */
  private async runSseGeneration(kind: SseGenKind, options: SseGenOptions = {}): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.isGenerating()) return;

    // Le plan créé par le parcours « rédiger un business plan » ne vaut que
    // pour le business plan : le passer à une autre génération viserait un
    // document d'un autre livrable.
    const documentId =
      options.documentId ?? (kind === 'businessPlan' ? this.pendingBpDocumentId : null);
    const sections = options.sections ?? [];
    const force = options.force ?? false;
    const title = this.translate.instant(this.deliverables.config(kind).titleKey);
    const progressId = this.nextId();
    const progressMessage: ChatMessageModel = {
      id: progressId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      generation: {
        title,
        status: 'running',
        completedSteps: [],
        stepsInProgress: [],
      },
    };
    this.store.append(progressMessage);
    this.isGenerating.set(true);

    let connection: Observable<SSEStepEvent>;
    let serviceType: SSEServiceEventType;
    switch (kind) {
      case 'businessPlan':
        connection = this.businessPlanService.createBusinessplanItem(
          projectId,
          options.infos,
          force,
          sections,
          documentId,
        );
        serviceType = 'business-plan';
        break;
      case 'pitchDeck':
        connection = this.pitchDeckService.generatePitchDeck(projectId, force, sections, documentId);
        serviceType = 'pitch-deck';
        break;
      case 'branding':
        connection = this.brandingApiService.createBrandIdentityModel(
          projectId,
          // Régénérer une page d'une charte existante ne doit pas en changer
          // le format : les autres pages ont déjà été rendues dans l'ancien.
          options.pdfFormat ?? this.storedCharteFormat() ?? 'SLIDE_16_9',
          force,
          sections,
        );
        serviceType = 'branding';
        break;
      case 'diagrams':
        connection = this.diagramsService.createDiagramModel(projectId);
        serviceType = 'diagram';
        break;
      case 'finance':
        connection = this.financeService.autoFillAllStream(projectId);
        serviceType = 'finance-fill';
        break;
      case 'legalDocs':
        connection = this.legalDocsService.generate(projectId, options.legalTypes ?? [], {});
        serviceType = 'legal-docs';
        break;
    }

    let finished = false;
    this.generationService
      .startGeneration(serviceType, connection)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state: SSEGenerationState) => {
          if (finished) return;
          this.store.patch(progressId, {
            generation: this.toProgressData(title, state),
          });
          if (state.completed) {
            finished = true;
            void this.finishGeneration(kind, progressId, title, state, documentId);
          } else if (state.error) {
            finished = true;
            this.failGeneration(kind, progressId, title, state, options);
          }
        },
        error: (error) => {
          if (finished) return;
          finished = true;
          console.error(`Chat: ${kind} generation failed`, error);
          this.failGeneration(kind, progressId, title, null, options);
        },
        complete: () => {
          if (!finished) {
            finished = true;
            void this.finishGeneration(kind, progressId, title, null, documentId);
          }
        },
      });
  }

  /** Format dans lequel la charte a déjà été rendue, s'il y en a un. */
  private storedCharteFormat(): ChartePdfFormat | null {
    const branding = this.session.activeProject()?.analysisResultModel?.branding as
      | { pdfFormat?: string }
      | undefined;
    return (branding?.pdfFormat as ChartePdfFormat) ?? null;
  }

  private toProgressData(
    title: string,
    state: SSEGenerationState,
    status: GenerationProgressData['status'] = 'running',
  ): GenerationProgressData {
    return {
      title,
      status,
      completedSteps: state.completedSteps ?? [],
      stepsInProgress: state.stepsInProgress ?? [],
      totalSteps: state.totalSteps || undefined,
    };
  }

  private async finishGeneration(
    kind: SseGenKind,
    progressId: string,
    title: string,
    state: SSEGenerationState | null,
    documentId?: string | null,
  ): Promise<void> {
    this.isGenerating.set(false);
    this.store.patch(progressId, {
      generation: {
        title,
        status: 'done',
        completedSteps: state?.completedSteps ?? [],
        stepsInProgress: [],
        totalSteps: state?.totalSteps || undefined,
      },
    });
    const project = await this.session.fetchActiveProjectDetails();
    const card = this.deliverables.buildCard(kind, project, documentId);
    this.appendAssistant({
      content: this.translate.instant('chat.responses.showCard', { title }),
      card,
      chips: this.buildCardChips(kind, card.available, card.pdfSupported, documentId),
    });
  }

  private failGeneration(
    kind: SseGenKind,
    progressId: string,
    title: string,
    state: SSEGenerationState | null,
    options: SseGenOptions = {},
  ): void {
    this.isGenerating.set(false);
    this.store.patch(progressId, {
      generation: {
        title,
        status: 'error',
        completedSteps: state?.completedSteps ?? [],
        stepsInProgress: [],
      },
    });
    // La reprise vise ce qui a échoué : une section précise reste une section.
    const retry: ChatChip =
      options.sections?.length === 1
        ? {
            labelKey: 'chat.generation.chips.retrySection',
            icon: 'pi pi-refresh',
            action: 'regenerate-section',
            payload: `${kind}:${options.sections[0]}`,
            documentId: options.documentId ?? undefined,
          }
        : {
            labelKey: 'chat.generation.chips.retry',
            icon: 'pi pi-refresh',
            action: 'generate',
            payload: kind,
          };
    this.appendAssistant({
      content: this.translate.instant('chat.generation.retryHint'),
      chips: [retry],
    });
  }

  // ─────────────────────────────────────────────── Onboarding conversationnel

  private handleOnboardingInput(value: string, displayText: string, viaSkip: boolean): void {
    const state = this.onboardingState;
    if (!state) return;

    if (state.stepId === 'recap') {
      if (displayText) this.appendUser(displayText);
      this.appendAssistant({ content: this.translate.instant('chat.onboarding.confirmHint') });
      return;
    }

    this.appendUser(viaSkip ? this.translate.instant('chat.onboarding.actions.skipped') : displayText);

    const result = this.onboarding.submitAnswer(state, value, viaSkip);
    if (result.error) {
      this.appendAssistant({ content: result.error });
      return;
    }
    this.onboardingState = result.state;
    for (const message of result.messages) {
      this.store.appendTransient(message);
    }
  }

  protected async onRecapConfirmed(acceptances: OnboardingPolicyAcceptances): Promise<void> {
    const state = this.onboardingState;
    if (!state || this.isCreatingProject()) return;
    this.isCreatingProject.set(true);
    this.pendingAssistant.set(true);

    try {
      const projectId = await this.onboarding.createProject(state.answers, acceptances);
      await this.session.loadProjects(true);
      this.session.selectProject(projectId);

      this.mode.set('project');
      this.loadedProjectId = projectId;
      this.onboardingState = null;
      await this.store.load(projectId);
      // Enchaîne directement sur la complétion de l'identité de marque :
      // les chips restent actionnables après le rechargement de la route.
      this.appendAssistant({
        content:
          this.translate.instant('chat.onboarding.success', {
            name: state.answers.name ?? '',
          }) +
          '\n\n' +
          this.translate.instant('chat.branding.invite'),
        chips: this.brandingInviteChips(),
      });
      this.router.navigate(['/chat'], { replaceUrl: true });
    } catch (error) {
      console.error('Chat onboarding: creation failed', error);
      this.mode.set('onboarding');
      this.appendAssistant({
        content: this.translate.instant('chat.onboarding.errors.createFailed'),
      });
    } finally {
      this.pendingAssistant.set(false);
      this.isCreatingProject.set(false);
    }
  }

  protected onRecapRestart(): void {
    this.onboarding.clear();
    this.enterOnboarding();
  }
}
