import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CookieService } from '../../../../shared/services/cookie.service';
import { CommunicationService } from '../../services/ai-agents/communication.service';
import {
  CommunicationModel,
  CommunicationStrategy,
  ContentChannel,
  ContentFormat,
  ContentIdea,
  EditorialCalendar,
  Flyer,
  FlyerFormat,
  MomentIdea,
  MomentSuggestion,
  Publication,
  PublicationStatus,
  SocialNetwork,
  StrategyBlock,
  VisualIntent,
} from '../../models/communication.model';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '@idem/shared-models';

type Tab = 'strategy' | 'calendar' | 'moments' | 'publishing';

@Component({
  selector: 'app-show-communication',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, IncompleteProjectBannerComponent],
  templateUrl: './show-communication.html',
  styleUrls: ['./show-communication.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowCommunication implements OnInit {
  private readonly communication = inject(CommunicationService);
  private readonly cookies = inject(CookieService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);

  // ---------------- state
  protected readonly projectId = signal<string | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly isGeneratingStrategy = signal<boolean>(false);
  protected readonly isGeneratingCalendar = signal<boolean>(false);
  protected readonly isGeneratingFlyer = signal<boolean>(false);
  protected readonly isDownloadingImage = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');

  protected readonly model = signal<CommunicationModel | null>(null);
  protected readonly activeTab = signal<Tab>('strategy');

  // SSE status
  protected readonly streamStatus = signal<string>('');

  // Branding validation
  protected readonly isBrandingComplete = signal<boolean>(false);
  protected readonly brandingMissingElements = signal<string[]>([]);
  protected readonly project = signal<ProjectModel | null>(null);

  // Content selection + flyer preview
  protected readonly selectedContent = signal<ContentIdea | null>(null);
  protected readonly selectedFormat = signal<FlyerFormat>('square');
  protected readonly currentFlyer = signal<Flyer | null>(null);
  protected readonly isFlyerModalOpen = signal<boolean>(false);

  // Calendar filters
  protected readonly filterChannel = signal<ContentChannel | 'all'>('all');
  protected readonly filterFormat = signal<ContentFormat | 'all'>('all');

  // UI options
  protected readonly flyerFormats: FlyerFormat[] = ['square', 'story', 'banner', 'post', 'a4'];
  protected readonly channels: ContentChannel[] = [
    'instagram',
    'linkedin',
    'facebook',
    'tiktok',
    'x',
    'youtube',
    'blog',
    'email',
    'other',
  ];
  protected readonly formats: ContentFormat[] = [
    'post',
    'carousel',
    'short-video',
    'article',
    'newsletter',
    'story',
    'reel',
  ];

  /** Segmented navigation. `soon` tabs are placeholders wired in phases 2 & 3. */
  protected readonly navTabs: { id: Tab; icon: string; labelKey: string; soon: boolean }[] = [
    { id: 'strategy', icon: 'pi pi-compass', labelKey: 'dashboard.showCommunication.tabs.strategy', soon: false },
    { id: 'calendar', icon: 'pi pi-calendar', labelKey: 'dashboard.showCommunication.tabs.calendar', soon: false },
    { id: 'moments', icon: 'pi pi-star', labelKey: 'dashboard.showCommunication.tabs.moments', soon: false },
    { id: 'publishing', icon: 'pi pi-send', labelKey: 'dashboard.showCommunication.tabs.publishing', soon: false },
  ];

  /** Tailwind classes for the content status pill in the calendar. */
  protected statusPillClass(status: ContentIdea['status']): string {
    switch (status) {
      case 'published':
        return 'text-[var(--color-success)] border-[var(--color-success)]/40 bg-[var(--color-success)]/10';
      case 'scheduled':
        return 'text-[var(--color-accent-500)] border-[var(--color-accent-500)]/40 bg-[var(--color-accent-500)]/10';
      case 'approved':
        return 'text-[var(--color-primary-400)] border-[var(--color-primary-500)]/40 bg-[var(--color-primary-500)]/10';
      default:
        return 'text-[var(--color-text-tertiary)] border-[var(--glass-border)] bg-transparent';
    }
  }

  protected readonly strategy = computed(() => this.model()?.strategy ?? null);
  protected readonly calendar = computed(() => this.model()?.calendar ?? null);
  protected readonly trends = computed(() => this.model()?.trends ?? []);
  protected readonly context = computed(() => this.model()?.context ?? null);

  // ---------------- Moments (timely one-off content)
  protected readonly moments = computed(() => this.model()?.moments ?? []);
  protected readonly momentSuggestions = computed(() => this.model()?.momentSuggestions ?? []);
  protected readonly isLoadingSuggestions = signal<boolean>(false);
  protected readonly suggestionsLoaded = signal<boolean>(false);
  protected readonly creatingSuggestionId = signal<string | null>(null);
  protected readonly isCreatingMoment = signal<boolean>(false);
  protected readonly showMomentForm = signal<boolean>(false);
  protected readonly momentOccasion = signal<string>('');
  protected readonly momentDate = signal<string>('');
  protected readonly momentMessage = signal<string>('');
  protected readonly momentIntent = signal<VisualIntent | ''>('');
  protected readonly momentIntents: VisualIntent[] = [
    'awareness',
    'celebration',
    'promotion',
    'recruitment',
    'announcement',
  ];

  // ---------------- Publishing (assisted)
  protected readonly networks: SocialNetwork[] = ['linkedin', 'x'];
  protected readonly preparingKey = signal<string | null>(null);
  protected readonly publications = computed(() =>
    [...(this.model()?.publications ?? [])].reverse(),
  );

  /** Content ideas + moments that already have a visual, ready to publish. */
  protected readonly publishableItems = computed(() => {
    const model = this.model();
    const flyers = model?.flyers ?? [];
    const latestFlyer = (contentId: string): Flyer | undefined =>
      flyers.filter((f) => f.contentId === contentId).slice(-1)[0];
    const list: { content: ContentIdea; flyer?: Flyer }[] = [];
    for (const it of model?.calendar?.items ?? []) {
      if (it.flyerIds && it.flyerIds.length > 0) {
        list.push({ content: it, flyer: latestFlyer(it.id) });
      }
    }
    for (const m of model?.moments ?? []) {
      if (m.flyerIds && m.flyerIds.length > 0) {
        list.push({ content: m, flyer: latestFlyer(m.id) });
      }
    }
    return list;
  });

  protected readonly calendarWeeks = computed(() => {
    const cal = this.calendar();
    if (!cal) return [] as { week: number; items: ContentIdea[] }[];
    const filter = (item: ContentIdea) => {
      const ch = this.filterChannel();
      const fm = this.filterFormat();
      if (ch !== 'all' && item.channel !== ch) return false;
      if (fm !== 'all' && item.format !== fm) return false;
      return true;
    };
    const byWeek = new Map<number, ContentIdea[]>();
    for (const item of cal.items.filter(filter)) {
      const list = byWeek.get(item.week) ?? [];
      list.push(item);
      byWeek.set(item.week, list);
    }
    return Array.from(byWeek.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, items]) => ({ week, items }));
  });

  ngOnInit(): void {
    const projectId = this.cookies.get('projectId');
    this.projectId.set(projectId || null);
    if (!projectId) {
      this.isLoading.set(false);
      return;
    }
    this.checkBrandingCompletion(projectId);
  }

  /**
   * Check if project branding is complete before loading content
   */
  private checkBrandingCompletion(projectId: string): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        const { isComplete, missingElements } =
          this.brandingValidation.checkBrandingCompletion(project);

        this.isBrandingComplete.set(isComplete);
        this.brandingMissingElements.set(missingElements);

        // Only load communication if branding is complete
        if (isComplete) {
          this.loadModel();
        } else {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Error checking branding completion:', error);
        this.isLoading.set(false);
        this.errorMessage.set('Erreur lors de la vérification du projet');
      },
    });
  }

  // ---------------- loaders
  private loadModel(): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.communication.getCommunication(projectId).subscribe({
      next: (data) => {
        this.model.set(data || {});
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to load communication data');
      },
    });
  }

  // ---------------- actions: strategy
  protected generateStrategy(force: boolean = false): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.isGeneratingStrategy.set(true);
    this.streamStatus.set('Starting context extraction…');
    this.errorMessage.set('');
    this.communication.streamStrategy(projectId, { force }).subscribe({
      next: (event) => {
        if (event.type === 'step-start') {
          this.streamStatus.set(`Generating ${event.step}…`);
        } else if (event.type === 'step-complete') {
          this.streamStatus.set(`Completed ${event.step}`);
          if (event.step === 'strategy' && event.payload) {
            this.patchModel({ strategy: event.payload as CommunicationStrategy });
          } else if (event.step === 'context' && event.payload) {
            this.patchModel({ context: event.payload });
          } else if (event.step === 'trends' && event.payload) {
            this.patchModel({ trends: event.payload });
          }
        } else if (event.type === 'complete') {
          if (event.payload?.strategy) {
            this.patchModel({ strategy: event.payload.strategy });
          }
          this.streamStatus.set('Strategy ready');
          this.isGeneratingStrategy.set(false);
        } else if (event.type === 'error') {
          this.errorMessage.set(event.message || 'Strategy generation failed');
          this.isGeneratingStrategy.set(false);
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.message || 'Strategy generation failed');
        this.isGeneratingStrategy.set(false);
      },
      complete: () => this.isGeneratingStrategy.set(false),
    });
  }

  protected updateStrategySummary(summary: string): void {
    const strategy = this.strategy();
    if (!strategy) return;
    this.patchModel({ strategy: { ...strategy, summary } });
  }

  protected updateStrategyBlock(id: string, patch: Partial<StrategyBlock>): void {
    const strategy = this.strategy();
    if (!strategy) return;
    const nextBlocks = strategy.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
    this.patchModel({ strategy: { ...strategy, blocks: nextBlocks } });
  }

  protected saveStrategy(): void {
    const projectId = this.projectId();
    const strategy = this.strategy();
    if (!projectId || !strategy) return;
    this.communication.updateStrategy(projectId, strategy).subscribe({
      next: (updated) => this.model.set(updated),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to save strategy'),
    });
  }

  // ---------------- actions: calendar
  protected generateCalendar(force: boolean = false): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.isGeneratingCalendar.set(true);
    this.streamStatus.set('Building calendar…');
    this.errorMessage.set('');
    this.communication
      .streamCalendar(projectId, { force, rhythm: 'weekly', horizonWeeks: 4 })
      .subscribe({
        next: (event) => {
          if (event.type === 'step-start') {
            this.streamStatus.set(`Generating ${event.step}…`);
          } else if (event.type === 'step-complete' && event.step === 'calendar') {
            this.patchModel({ calendar: event.payload as EditorialCalendar });
            this.streamStatus.set('Calendar ready');
          } else if (event.type === 'complete') {
            if (event.payload?.calendar) {
              this.patchModel({ calendar: event.payload.calendar });
            }
            this.isGeneratingCalendar.set(false);
          } else if (event.type === 'error') {
            this.errorMessage.set(event.message || 'Calendar generation failed');
            this.isGeneratingCalendar.set(false);
          }
        },
        error: (err) => {
          this.errorMessage.set(err?.message || 'Calendar generation failed');
          this.isGeneratingCalendar.set(false);
        },
        complete: () => this.isGeneratingCalendar.set(false),
      });
  }

  protected patchContent(contentId: string, patch: Partial<ContentIdea>): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.communication.updateCalendarItem(projectId, contentId, patch).subscribe({
      next: (updated) => this.model.set(updated),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Failed to update content'),
    });
  }

  // ---------------- actions: flyer (ON-DEMAND)
  protected openFlyerModal(content: ContentIdea): void {
    this.selectedContent.set(content);
    this.selectedFormat.set('square');
    const flyer = this.findExistingFlyer(content, 'square');
    this.currentFlyer.set(flyer);
    this.isFlyerModalOpen.set(true);
    if (flyer) {
      this.loadFlyerImage(flyer);
    }
  }

  protected closeFlyerModal(): void {
    this.isFlyerModalOpen.set(false);
    this.selectedContent.set(null);
    this.currentFlyer.set(null);
    this.isDownloadingImage.set(false);
  }

  protected setFlyerFormat(format: FlyerFormat): void {
    this.selectedFormat.set(format);
    const content = this.selectedContent();
    if (!content) return;
    const flyer = this.findExistingFlyer(content, format);
    this.currentFlyer.set(flyer);
    if (flyer) {
      this.loadFlyerImage(flyer);
    }
  }

  /** CRITICAL: only call LLM when user clicks. */
  protected triggerFlyerGeneration(regenerate: boolean = false): void {
    const projectId = this.projectId();
    const content = this.selectedContent();
    if (!projectId || !content) return;
    this.isGeneratingFlyer.set(true);
    this.errorMessage.set('');

    const call$ = regenerate
      ? this.communication.regenerateFlyer(projectId, content.id, this.selectedFormat())
      : this.communication.generateFlyer(projectId, content.id, this.selectedFormat());

    call$.subscribe({
      next: (flyer) => {
        this.currentFlyer.set(flyer);
        this.pushFlyerToModel(flyer);
        this.isGeneratingFlyer.set(false);
        this.loadFlyerImage(flyer);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Flyer generation failed');
        this.isGeneratingFlyer.set(false);
      },
    });
  }

  /**
   * Ouvre le visuel dans l'éditeur WYSIWYG (même éditeur que le business plan,
   * le pitch deck et la charte). Le visuel est désigné par son id dans l'URL :
   * un projet en compte autant que de contenus programmés.
   */
  protected editFlyer(flyerId?: string): void {
    const id = flyerId ?? this.currentFlyer()?.id;
    if (!id) return;
    this.router.navigate(['/project/communication/flyer/edit'], { queryParams: { flyerId: id } });
  }

  protected flyerSafeHtml(flyer: Flyer | null): SafeHtml | null {
    if (!flyer?.html) return null;
    return this.sanitizer.bypassSecurityTrustHtml(flyer.html);
  }

  private loadFlyerImage(flyer: Flyer): void {
    const projectId = this.projectId();
    if (!projectId || !flyer.id) return;

    // Check if it's already an object URL (starts with blob:) or is a base64
    if (
      flyer.imageUrl &&
      (flyer.imageUrl.startsWith('blob:') || flyer.imageUrl.startsWith('data:'))
    ) {
      return;
    }

    this.isDownloadingImage.set(true);
    this.communication.downloadFlyerImage(projectId, flyer.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const updatedFlyer = { ...flyer, imageUrl: url };
        this.currentFlyer.set(updatedFlyer);
        this.pushFlyerToModel(updatedFlyer);
        this.isDownloadingImage.set(false);
      },
      error: (err) => {
        console.error('Failed to load flyer image blob', err);
        this.isDownloadingImage.set(false);
      },
    });
  }

  // ---------------- nav
  protected goToProjects(): void {
    this.router.navigate(['/projects']);
  }

  protected setActiveTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'moments' && !this.suggestionsLoaded() && this.momentSuggestions().length === 0) {
      this.loadMomentSuggestions(false);
    }
  }

  // ---------------- actions: moments
  protected loadMomentSuggestions(force = false): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.isLoadingSuggestions.set(true);
    this.errorMessage.set('');
    this.communication.getMomentSuggestions(projectId, { force }).subscribe({
      next: (suggestions) => {
        this.patchModel({ momentSuggestions: suggestions });
        this.suggestionsLoaded.set(true);
        this.isLoadingSuggestions.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load moment suggestions');
        this.isLoadingSuggestions.set(false);
      },
    });
  }

  protected createFromSuggestion(suggestion: MomentSuggestion): void {
    const projectId = this.projectId();
    if (!projectId || this.creatingSuggestionId()) return;
    this.creatingSuggestionId.set(suggestion.id);
    this.errorMessage.set('');
    this.communication
      .createMoment(projectId, {
        occasion: suggestion.occasion,
        occasionDate: suggestion.date,
        message: suggestion.angle,
        intent: suggestion.intent,
        source: 'suggestion',
      })
      .subscribe({
        next: (moment) => {
          this.addMomentToModel(moment);
          this.creatingSuggestionId.set(null);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Moment generation failed');
          this.creatingSuggestionId.set(null);
        },
      });
  }

  protected submitCustomMoment(): void {
    const projectId = this.projectId();
    const occasion = this.momentOccasion().trim();
    if (!projectId || !occasion) return;
    this.isCreatingMoment.set(true);
    this.errorMessage.set('');
    const intent = this.momentIntent();
    this.communication
      .createMoment(projectId, {
        occasion,
        occasionDate: this.momentDate() || undefined,
        message: this.momentMessage() || undefined,
        intent: intent || undefined,
        source: 'custom',
      })
      .subscribe({
        next: (moment) => {
          this.addMomentToModel(moment);
          this.isCreatingMoment.set(false);
          this.showMomentForm.set(false);
          this.momentOccasion.set('');
          this.momentDate.set('');
          this.momentMessage.set('');
          this.momentIntent.set('');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Moment generation failed');
          this.isCreatingMoment.set(false);
        },
      });
  }

  protected toggleMomentForm(): void {
    this.showMomentForm.update((v) => !v);
  }

  protected readonly copiedId = signal<string | null>(null);

  /** Copy arbitrary text (a caption) to the clipboard with transient feedback. */
  protected copyToClipboard(text: string, id: string): void {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.copiedId.set(id);
        setTimeout(() => this.copiedId.set(null), 2000);
      })
      .catch(() => {
        /* clipboard unavailable — ignore */
      });
  }

  // ---------------- actions: publishing (assisted)
  protected prepareAndPublish(content: ContentIdea, network: SocialNetwork): void {
    const projectId = this.projectId();
    if (!projectId) return;
    const key = `${content.id}:${network}`;
    if (this.preparingKey()) return;
    this.preparingKey.set(key);
    this.errorMessage.set('');
    this.communication.preparePublication(projectId, { contentId: content.id, network }).subscribe({
      next: ({ publication, share }) => {
        this.addPublicationToModel(publication);
        this.preparingKey.set(null);
        // Assisted flow: copy the caption then open the network composer.
        this.copyToClipboard(share.caption, publication.id);
        this.openComposer(share.shareUrl);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Publishing failed');
        this.preparingKey.set(null);
      },
    });
  }

  protected assistedPublish(pub: Publication): void {
    if (pub.caption) this.copyToClipboard(pub.caption, pub.id);
    if (pub.shareUrl) this.openComposer(pub.shareUrl);
  }

  protected openComposer(url?: string): void {
    if (url) window.open(url, '_blank', 'noopener');
  }

  protected markPublished(pub: Publication): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.communication.updatePublication(projectId, pub.id, { status: 'published' }).subscribe({
      next: (updated) => this.replacePublicationInModel(updated),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Publishing failed'),
    });
  }

  protected pubPillClass(status: PublicationStatus): string {
    switch (status) {
      case 'published':
        return 'text-[var(--color-success)] border-[var(--color-success)]/40 bg-[var(--color-success)]/10';
      case 'scheduled':
        return 'text-[var(--color-accent-500)] border-[var(--color-accent-500)]/40 bg-[var(--color-accent-500)]/10';
      default:
        return 'text-[var(--color-text-tertiary)] border-[var(--glass-border)] bg-transparent';
    }
  }

  protected networkIcon(network: SocialNetwork): string {
    return network === 'linkedin' ? 'pi pi-linkedin' : 'pi pi-twitter';
  }

  private addPublicationToModel(pub: Publication): void {
    const existing = this.model() ?? {};
    this.patchModel({ publications: [...(existing.publications || []), pub] });
  }

  private replacePublicationInModel(pub: Publication): void {
    const existing = this.model() ?? {};
    const pubs = (existing.publications || []).map((p) => (p.id === pub.id ? pub : p));
    this.patchModel({ publications: pubs });
  }

  private addMomentToModel(moment: MomentIdea): void {
    const existing = this.model() ?? {};
    const without = (existing.moments || []).filter((m) => m.id !== moment.id);
    this.patchModel({ moments: [...without, moment] });
  }

  protected setFilterChannel(value: string): void {
    this.filterChannel.set(value as ContentChannel | 'all');
  }

  protected setFilterFormat(value: string): void {
    this.filterFormat.set(value as ContentFormat | 'all');
  }

  // ---------------- internals
  private patchModel(patch: Partial<CommunicationModel>): void {
    const existing = this.model() ?? {};
    this.model.set({ ...existing, ...patch });
  }

  private findExistingFlyer(content: ContentIdea, format: FlyerFormat): Flyer | null {
    const flyers = this.model()?.flyers || [];
    return flyers.find((f) => f.contentId === content.id && f.format === format) || null;
  }

  private pushFlyerToModel(flyer: Flyer): void {
    const existing = this.model() ?? {};
    const flyers = existing.flyers || [];
    const without = flyers.filter((f) => f.id !== flyer.id);
    const nextFlyers = [...without, flyer];
    // Also attach the flyer id to the owning content, whether it is a calendar
    // item or a moment.
    const linkFlyer = <T extends ContentIdea>(item: T): T =>
      item.id === flyer.contentId
        ? { ...item, flyerIds: Array.from(new Set([...(item.flyerIds || []), flyer.id])) }
        : item;
    const calendar = existing.calendar
      ? { ...existing.calendar, items: existing.calendar.items.map(linkFlyer) }
      : existing.calendar;
    const moments = existing.moments ? existing.moments.map(linkFlyer) : existing.moments;
    this.model.set({ ...existing, flyers: nextFlyers, calendar, moments });
  }
}
