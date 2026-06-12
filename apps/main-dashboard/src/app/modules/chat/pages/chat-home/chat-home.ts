import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MarkdownModule } from 'ngx-markdown';
import { firstValueFrom } from 'rxjs';

import { Loader } from '../../../../shared/components/loader/loader';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { AdvisorService } from '../../../dashboard/services/ai-agents/advisor.service';
import { ChatSessionService } from '../../services/chat-session.service';
import { ChatConversationStoreService } from '../../services/chat-conversation-store.service';
import { ChatIntentService, ChatIntent } from '../../services/chat-intent.service';
import { ChatDeliverablesService } from '../../services/chat-deliverables.service';
import { ChatOnboardingService } from '../../services/chat-onboarding.service';
import { DeliverableCardComponent } from '../../components/deliverable-card/deliverable-card';
import { RecapCardComponent } from '../../components/recap-card/recap-card';
import { SuggestionChipsComponent } from '../../components/suggestion-chips/suggestion-chips';
import { PreviewPanelComponent } from '../../components/preview-panel/preview-panel';
import {
  ChatChip,
  ChatMessageModel,
  DeliverableKind,
  OnboardingPolicyAcceptances,
  OnboardingState,
} from '../../models/chat.model';

interface PreviewState {
  kind: DeliverableKind;
  title: string;
  url: string | null;
  isLoading: boolean;
  error: string | null;
}

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
    PreviewPanelComponent,
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
  private readonly advisor = inject(AdvisorService);
  private readonly intents = inject(ChatIntentService);
  private readonly onboarding = inject(ChatOnboardingService);

  protected readonly session = inject(ChatSessionService);
  protected readonly store = inject(ChatConversationStoreService);
  protected readonly deliverables = inject(ChatDeliverablesService);

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  protected readonly mode = signal<'project' | 'onboarding'>('project');
  protected readonly draft = signal('');
  protected readonly pendingAssistant = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isInitializing = signal(true);
  protected readonly isCreatingProject = signal(false);
  protected readonly cardBusy = signal(false);
  protected readonly preview = signal<PreviewState | null>(null);

  private onboardingState: OnboardingState | null = null;
  private loadedProjectId: string | null = null;
  private previewBlob: Blob | null = null;

  protected readonly messages = this.store.messages;
  protected readonly isEmpty = computed(() => this.messages().length === 0);
  protected readonly lastMessageId = computed(() => {
    const msgs = this.messages();
    return msgs.length > 0 ? msgs[msgs.length - 1].id : null;
  });

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
  }

  async ngOnInit(): Promise<void> {
    const isOnboardingRoute = this.route.snapshot.data['onboarding'] === true;
    await this.session.loadProjects();

    if (isOnboardingRoute) {
      this.enterOnboarding();
    } else if (!this.session.activeProjectId()) {
      // Aucun projet : l'onboarding conversationnel prend le relais
      this.router.navigate(['/chat/new'], { replaceUrl: true });
      this.enterOnboarding();
    } else {
      await this.enterProjectMode(this.session.activeProjectId()!);
    }
    this.isInitializing.set(false);
  }

  ngAfterViewChecked(): void {
    this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  // ─────────────────────────────────────────────── Modes

  private async enterProjectMode(projectId: string): Promise<void> {
    this.mode.set('project');
    this.loadedProjectId = projectId;
    await this.store.load(projectId);
    // Rafraîchit le détail du projet (sections des livrables) en arrière-plan
    void this.session.fetchActiveProjectDetails();
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
    this.draft.set('');
    this.errorMessage.set(null);

    if (this.mode() === 'onboarding') {
      this.handleOnboardingInput(content, content, false);
      return;
    }

    if (!this.session.activeProjectId()) return;
    this.appendUser(content);

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
    }
  }

  private respondWithCard(kind: DeliverableKind): void {
    const project = this.session.activeProject();
    const card = this.deliverables.buildCard(kind, project);
    const title = this.translate.instant(card.titleKey);
    this.appendAssistant({
      content: this.translate.instant(
        card.available ? 'chat.responses.showCard' : 'chat.responses.showCardMissing',
        { title },
      ),
      card,
      chips: this.buildCardChips(kind, card.available, card.pdfSupported),
    });
  }

  private buildCardChips(
    kind: DeliverableKind,
    available: boolean,
    pdfSupported: boolean,
  ): ChatChip[] {
    const chips: ChatChip[] = [];
    if (available && pdfSupported) {
      chips.push({
        labelKey: 'chat.chips.downloadPdf',
        icon: 'pi pi-download',
        action: 'download',
        payload: kind,
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

  private genericChips(): ChatChip[] {
    return [
      { labelKey: 'chat.chips.show.businessPlan', icon: 'pi pi-calendar', action: 'show', payload: 'businessPlan' },
      { labelKey: 'chat.chips.status', icon: 'pi pi-compass', action: 'status' },
      { labelKey: 'chat.chips.show.pitchDeck', icon: 'pi pi-desktop', action: 'show', payload: 'pitchDeck' },
    ];
  }

  private async respondWithDownload(kind: DeliverableKind): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    const project = this.session.activeProject();
    const config = this.deliverables.config(kind);
    const title = this.translate.instant(config.titleKey);

    if (!config.pdfSupported) {
      const card = this.deliverables.buildCard(kind, project);
      this.appendAssistant({
        content: this.translate.instant('chat.responses.noPdf', { title }),
        card,
        chips: this.buildCardChips(kind, card.available, card.pdfSupported),
      });
      return;
    }

    this.pendingAssistant.set(true);
    const ok = await this.deliverables.download(kind, projectId, project?.name);
    this.pendingAssistant.set(false);

    if (ok) {
      this.appendAssistant({
        content: this.translate.instant('chat.responses.downloadStarted', { title }),
        chips: this.genericChips(),
      });
    } else {
      const card = this.deliverables.buildCard(kind, project);
      this.appendAssistant({
        content: this.translate.instant('chat.responses.downloadUnavailable', { title }),
        card,
        chips: this.buildCardChips(kind, card.available, card.pdfSupported),
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
        this.respondWithCard(chip.payload as DeliverableKind);
        break;
      case 'download':
        this.appendUser(this.chipLabel(chip));
        void this.respondWithDownload(chip.payload as DeliverableKind);
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
        this.router.navigate(['/chat/new']);
        break;
    }
  }

  // ─────────────────────────────────────────────── Cartes : actions

  protected openEditor(editorRoute: string): void {
    this.uiMode.openInEditor(editorRoute);
  }

  protected openGenerate(route: string | undefined, fallback: string): void {
    this.uiMode.openInEditor(route ?? fallback);
  }

  protected async downloadFromCard(kind: DeliverableKind): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.cardBusy()) return;
    this.cardBusy.set(true);
    try {
      const ok = await this.deliverables.download(
        kind,
        projectId,
        this.session.activeProject()?.name,
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

  // ─────────────────────────────────────────────── Prévisualisation

  protected async openPreview(kind: DeliverableKind): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId) return;
    const title = this.translate.instant(this.deliverables.config(kind).titleKey);
    this.revokePreviewUrl();
    this.preview.set({ kind, title, url: null, isLoading: true, error: null });

    try {
      const blob = await firstValueFrom(this.deliverables.fetchPdf(kind, projectId));
      const current = this.preview();
      if (!current || current.kind !== kind) return;
      if (!blob || blob.size === 0) {
        this.preview.set({ ...current, isLoading: false, error: this.translate.instant('chat.preview.notAvailable') });
        return;
      }
      this.previewBlob = blob;
      const url = URL.createObjectURL(blob);
      this.preview.set({ ...current, url, isLoading: false });
    } catch {
      const current = this.preview();
      if (!current || current.kind !== kind) return;
      this.preview.set({ ...current, isLoading: false, error: this.translate.instant('chat.preview.notAvailable') });
    }
  }

  protected closePreview(): void {
    this.revokePreviewUrl();
    this.preview.set(null);
  }

  protected downloadFromPreview(): void {
    const current = this.preview();
    if (!current || !this.previewBlob) return;
    this.deliverables.triggerDownload(
      this.previewBlob,
      this.deliverables.downloadFilename(current.kind, this.session.activeProject()?.name),
    );
  }

  private revokePreviewUrl(): void {
    const current = this.preview();
    if (current?.url) {
      URL.revokeObjectURL(current.url);
    }
    this.previewBlob = null;
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
      this.appendAssistant({
        content: this.translate.instant('chat.onboarding.success', {
          name: state.answers.name ?? '',
        }),
        chips: [
          { labelKey: 'chat.chips.show.businessPlan', icon: 'pi pi-calendar', action: 'show', payload: 'businessPlan' },
          { labelKey: 'chat.chips.status', icon: 'pi pi-compass', action: 'status' },
        ],
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
