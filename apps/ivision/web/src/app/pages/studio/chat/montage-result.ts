import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { Montage, MontageStage } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { RouterLink } from '@angular/router';

const RATIOS: Record<string, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };
const STAGES: MontageStage[] = ['prepare', 'transcribe', 'cut', 'plan', 'media'];
const ORDER: MontageStage[] = ['upload', 'prepare', 'transcribe', 'cut', 'plan', 'media', 'ready'];
const SUGGESTIONS = ['addIntro', 'noMusic', 'soberCaptions', 'square'];

/**
 * Le MONTAGE dans la conversation vidéo : son avancement réel, puis la vidéo telle qu'elle
 * sortira (aperçu), « Télécharger » en un clic, des idées de changements (envoyées comme un
 * message), et « Ajuster les détails » pour qui veut aller plus loin.
 */
@Component({
  selector: 'iv-montage-result',
  imports: [TranslateModule, IdemLoaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-3 flex flex-col gap-3">
      @if (montage(); as m) {
        @if (m.status === 'failed') {
          <p class="text-sm" role="alert">{{ (m.error === 'no_speech' ? 'montage.chat.noSpeech' : 'montage.chat.failed') | translate: { cost: m.paidCredits } }}</p>
        } @else if (m.status === 'processing' && !m.edit) {
          <ol class="flex flex-col gap-2" aria-live="polite">
            @for (s of stages; track s) {
              <li class="flex items-center gap-3 text-sm" [class]="stageState(s) === 'todo' ? 'text-[var(--color-text-tertiary)]' : ''">
                <span class="flex h-5 w-5 flex-none items-center justify-center">
                  @switch (stageState(s)) {
                    @case ('done') { <i class="pi pi-check text-[var(--color-primary-500)]" aria-hidden="true"></i> }
                    @case ('running') { <idem-loader size="xs" /> }
                    @default { <span class="status-dot" aria-hidden="true"></span> }
                  }
                </span>
                <span>{{ 'montage.stages.' + s | translate }}</span>
                @if (stageState(s) === 'running' && s === 'transcribe' && m.progress) {
                  <span class="ml-auto text-[var(--color-text-secondary)]">{{ (m.progress * 100).toFixed(0) }} %</span>
                }
              </li>
            }
          </ol>
        } @else {
          <div class="w-full" [style.max-width]="m.format === 'landscape' ? '100%' : '320px'">
            <div class="relative w-full overflow-hidden rounded-xl bg-[var(--glass-bg-light)]" [style.aspect-ratio]="ratio()">
              @if (m.status === 'processing') {
                <idem-loader overlay [label]="'montage.recutting' | translate" />
              }
              @if (html(); as h) {
                <iframe #frame class="absolute inset-0 h-full w-full border-0" [srcdoc]="h" sandbox="allow-scripts" [title]="'montage.previewTitle' | translate"></iframe>
              } @else if (m.status === 'ready') {
                <idem-loader block [label]="'edit.preparingPreview' | translate" />
              }
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="inner-button button-sm" [disabled]="m.status !== 'ready' || exporting() || rendering() || downloading()" (click)="getVideo()">
              @if (exporting() || rendering() || downloading()) { <idem-loader size="xs" /> } @else { <i class="pi pi-download" aria-hidden="true"></i> }
              {{ (rendering() ? 'montage.chat.rendering' : 'montage.download') | translate: { percent: renderPercent() } }}
            </button>
            <a class="outer-button button-sm" [routerLink]="['/studio/montage', m.id]">
              <i class="pi pi-pencil" aria-hidden="true"></i> {{ 'chat.result.edit' | translate }}
            </a>
          </div>
          @if (rendering()) {
            <progress class="w-full max-w-xs" max="100" [value]="renderPercent()"></progress>
          }
          @if (needCredits()) {
            <p class="text-sm" role="alert">{{ 'chat.payment.short' | translate }} <a class="text-[var(--color-primary-500)] underline" [href]="accountUrl">{{ 'chat.payment.cta' | translate }}</a></p>
          }
          @if (m.status === 'ready' && latest()) {
            <div class="flex flex-wrap gap-2" [attr.aria-label]="'montage.chat.ideas' | translate">
              @for (s of suggestions; track s) {
                <button type="button" class="tag" (click)="say.emit(s)">{{ 'montage.suggestions.' + s | translate }}</button>
              }
            </div>
          }
          @if (m.status === 'ready' && latest()) {
            <p class="text-xs text-[var(--color-text-tertiary)]">{{ 'montage.chat.sayHint' | translate }}</p>
          }
        }
      } @else {
        <div class="skeleton h-72 w-40 rounded-xl"></div>
      }
    </div>
  `,
})
export class MontageResult {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly state = inject(StudioState);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  readonly montageId = input.required<string>();
  /** Le montage déjà connu (événement du tour), pour un affichage immédiat. */
  readonly initial = input<Montage | null>(null);
  /** Le montage a changé côté serveur (on recharge l'aperçu). */
  readonly version = input(0);
  /** La carte est la plus récente du fil (les idées de changements n'y sont proposées qu'une fois). */
  readonly latest = input(true);
  /** Une idée de changement choisie : la conversation l'envoie (clé de traduction). */
  readonly say = output<string>();

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  protected readonly stages = STAGES;
  protected readonly suggestions = SUGGESTIONS;
  protected readonly montage = signal<Montage | null>(null);
  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly time = signal(0);
  protected readonly exporting = signal(false);
  protected readonly downloading = signal(false);
  protected readonly needCredits = signal(false);
  private autoDownload = false;
  private poll: Subscription | null = null;

  protected readonly ratio = computed(() => RATIOS[this.montage()?.format ?? 'story'] ?? '9 / 16');
  protected readonly rendering = computed(() => (this.montage()?.renders ?? []).some((r) => r.status === 'rendering'));
  protected readonly renderFresh = computed(() => {
    const m = this.montage();
    const r = (m?.renders ?? []).find((x) => x.status === 'done' && x.url);
    return !!m && !!r?.renderedAt && new Date(r.renderedAt).getTime() >= new Date(m.updatedAt).getTime() - 5000;
  });

  private onMessage = (event: MessageEvent) => {
    const frame = this.frame()?.nativeElement;
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; t?: number };
    if (data?.type === 'montage:time' && typeof data.t === 'number') this.time.set(data.t);
  };

  constructor() {
    effect(() => {
      const id = this.montageId();
      const initial = this.initial();
      this.version();
      untracked(() => {
        if (initial && initial.id === id && !this.montage()) this.apply(initial, true);
        this.api.montage(id).subscribe({ next: (m) => this.apply(m, true), error: () => undefined });
      });
    });
    window.addEventListener('message', this.onMessage);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('message', this.onMessage);
      this.poll?.unsubscribe();
    });
  }

  protected apply(m: Montage, reloadPreview: boolean): void {
    const before = this.montage();
    this.montage.set(m);
    const becameReady = m.status === 'ready' && before?.status !== 'ready';
    if (m.status === 'ready' && (reloadPreview || becameReady)) {
      this.api.montagePreview(m.id).subscribe({ next: ({ html }) => this.html.set(this.sanitizer.bypassSecurityTrustHtml(html)), error: () => undefined });
    }
    if (m.status === 'processing' || m.renders.some((r) => r.status === 'rendering')) this.watch();
    if (this.autoDownload && m.renders.some((r) => r.status === 'done') && !m.renders.some((r) => r.status === 'rendering')) {
      this.autoDownload = false;
      this.download();
    }
  }

  private watch(): void {
    if (this.poll) return;
    this.poll = timer(2500, 2500).subscribe(() => {
      const m = this.montage();
      if (!m) return;
      this.api.montage(m.id).subscribe({
        next: (next) => {
          if (next.status !== 'processing' && !next.renders.some((r) => r.status === 'rendering')) {
            this.poll?.unsubscribe();
            this.poll = null;
            this.state.refreshCredits();
          }
          this.apply(next, m.status === 'processing' && next.status === 'ready');
        },
        error: () => undefined,
      });
    });
  }

  protected stageState(stage: MontageStage): 'done' | 'running' | 'todo' {
    const a = ORDER.indexOf(stage);
    const b = ORDER.indexOf(this.montage()?.stage ?? 'prepare');
    return a < b ? 'done' : a === b ? 'running' : 'todo';
  }

  /** « Télécharger » : le MP4 s'il est à jour, sinon il est rendu puis enregistré tout seul. */
  protected getVideo(): void {
    const m = this.montage();
    if (!m) return;
    if (this.renderFresh()) return this.download();
    this.exporting.set(true);
    this.needCredits.set(false);
    this.api.exportMontage(m.id).subscribe({
      next: (next) => {
        this.exporting.set(false);
        this.autoDownload = true;
        this.apply(next, false);
        this.watch();
        this.state.refreshCredits();
      },
      error: (err) => {
        this.exporting.set(false);
        if (err?.status === 402) this.needCredits.set(true);
      },
    });
  }

  protected download(): void {
    const m = this.montage();
    if (!m) return;
    this.downloading.set(true);
    this.api.saveFile(`/montages/${m.id}/file`, 'ivision-montage.mp4').subscribe({ next: () => this.downloading.set(false), error: () => this.downloading.set(false) });
  }

  protected renderPercent(): number {
    const r = (this.montage()?.renders ?? [])[0];
    return r ? Math.round((r.status === 'done' ? 1 : r.progress || 0) * 100) : 0;
  }
}
