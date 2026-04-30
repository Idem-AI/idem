import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  StrategyBlock,
} from '../../models/communication.model';

type Tab = 'strategy' | 'calendar';

@Component({
  selector: 'app-show-communication',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './show-communication.html',
  styleUrls: ['./show-communication.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowCommunication implements OnInit {
  private readonly communication = inject(CommunicationService);
  private readonly cookies = inject(CookieService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

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

  protected readonly strategy = computed(() => this.model()?.strategy ?? null);
  protected readonly calendar = computed(() => this.model()?.calendar ?? null);
  protected readonly trends = computed(() => this.model()?.trends ?? []);
  protected readonly context = computed(() => this.model()?.context ?? null);

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
    this.loadModel();
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

  protected flyerSafeHtml(flyer: Flyer | null): SafeHtml | null {
    if (!flyer?.html) return null;
    return this.sanitizer.bypassSecurityTrustHtml(flyer.html);
  }

  private loadFlyerImage(flyer: Flyer): void {
    const projectId = this.projectId();
    if (!projectId || !flyer.id) return;
    
    // Check if it's already an object URL (starts with blob:) or is a base64
    if (flyer.imageUrl && (flyer.imageUrl.startsWith('blob:') || flyer.imageUrl.startsWith('data:'))) {
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
      }
    });
  }

  // ---------------- nav
  protected goToProjects(): void {
    this.router.navigate(['/projects']);
  }

  protected setActiveTab(tab: Tab): void {
    this.activeTab.set(tab);
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
    return (
      flyers.find((f) => f.contentId === content.id && f.format === format) || null
    );
  }

  private pushFlyerToModel(flyer: Flyer): void {
    const existing = this.model() ?? {};
    const flyers = existing.flyers || [];
    const without = flyers.filter((f) => f.id !== flyer.id);
    const nextFlyers = [...without, flyer];
    // Also attach flyer id to the content idea's flyerIds.
    const calendar = existing.calendar
      ? {
          ...existing.calendar,
          items: existing.calendar.items.map((item) =>
            item.id === flyer.contentId
              ? {
                  ...item,
                  flyerIds: Array.from(new Set([...(item.flyerIds || []), flyer.id])),
                }
              : item,
          ),
        }
      : existing.calendar;
    this.model.set({ ...existing, flyers: nextFlyers, calendar });
  }
}
