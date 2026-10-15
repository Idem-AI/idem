import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { StudioState } from '../../../core/studio.state';
import { TourService } from '../../../core/tour.service';
import { MotionVideo } from '../../../core/models';

const RATIOS: Record<string, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };

/** Au-delà, la lecture est proposée même si l'aperçu n'a pas dit que ses sons étaient chargés (ancien moteur). */
const PLAYABLE_FALLBACK_MS = 45000;

interface DownloadOption {
  format: string;
  ready: boolean;
  busy: boolean;
  cost: number;
}

/**
 * Une vidéo produite dans la conversation. Dès qu'elle arrive à l'écran, son aperçu s'affiche
 * aux proportions du format : le MP4 à jour s'il existe (lecteur natif), sinon le lecteur du
 * moteur (le même que le rendu). Le lecteur du moteur télécharge d'abord TOUS les sons (musique,
 * effets, voix off) : « Voir la vidéo » n'apparaît qu'une fois chacun en mémoire.
 *
 * « Télécharger » propose les formats ; le format principal est rendu d'avance par le serveur
 * (souvent prêt au premier clic), un autre format est rendu à la demande puis enregistré.
 */
@Component({
  selector: 'iv-video-result',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'menuOpen.set(false)' },
  styles: `
    .frame:fullscreen {
      width: 100vw;
      height: 100vh;
      max-width: none;
      aspect-ratio: auto !important;
      border: 0;
      border-radius: 0;
      background: var(--color-bg-dark);
    }
    .frame:fullscreen video {
      object-fit: contain;
    }
    .veil {
      background: var(--glass-bg-intense, var(--glass-bg));
      backdrop-filter: blur(6px);
    }
  `,
  template: `
    <div class="mt-3 flex flex-col items-start gap-3">
      <div #frame class="frame relative w-full overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]" [style.aspect-ratio]="ratio()" [style.max-width]="maxWidth()">
        @if (mp4(); as file) {
          <video class="h-full w-full bg-[var(--color-bg-dark)]" [src]="file.url" [poster]="file.posterUrl || ''" controls playsinline preload="auto"></video>
        } @else if (html(); as h) {
          <iframe #player class="h-full w-full border-0" sandbox="allow-scripts" allow="autoplay; fullscreen" [srcdoc]="h" [attr.title]="'chat.result.previewTitle' | translate"></iframe>
          @if (!started()) {
            <!-- Rien ne se lit tant que les sons (musique, effets, voix off) ne sont pas tous chargés. -->
            <div class="veil absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center" aria-live="polite">
              @if (playable()) {
                <button type="button" class="inner-button" (click)="watch()">
                  <i class="pi pi-play" aria-hidden="true"></i> {{ 'chat.result.watchVideo' | translate }}
                </button>
              } @else {
                <idem-loader size="sm" />
                <p class="text-sm text-[var(--color-text-secondary)]">{{ 'chat.result.preparing' | translate: { percent: loadPercent() } }}</p>
              }
            </div>
          }
        } @else {
          <div class="skeleton flex h-full w-full items-center justify-center">
            @if (loading()) {
              <idem-loader size="sm" />
            } @else if (failed()) {
              <button type="button" class="outer-button button-sm" (click)="loadPreview()">
                <i class="pi pi-refresh" aria-hidden="true"></i> {{ 'chat.result.watch' | translate }}
              </button>
            }
          </div>
        }
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="outer-button button-sm" (click)="toggleFullscreen()" [disabled]="!mp4() && !html()">
          <i class="pi pi-expand" aria-hidden="true"></i> {{ 'chat.result.fullscreen' | translate }}
        </button>
        <div class="relative">
          <button
            type="button"
            data-tour="iv-result-download"
            class="outer-button button-sm"
            aria-haspopup="menu"
            [attr.aria-expanded]="menuOpen()"
            (click)="toggleMenu()"
            [disabled]="!!downloading()"
          >
            @if (downloading()) {
              <idem-loader size="xs" />
              {{ 'chat.result.downloadPreparing' | translate: { percent: downloadPercent() } }}
            } @else {
              <i class="pi pi-download" aria-hidden="true"></i>
              {{ 'chat.result.download' | translate }}
            }
          </button>
          @if (menuOpen()) {
            <div class="glass-card absolute left-0 top-full z-20 mt-2 flex min-w-[15rem] flex-col gap-1 p-2" role="menu" [attr.aria-label]="'chat.result.downloadFormat' | translate">
              <p class="px-2 py-1 text-xs text-[var(--color-text-tertiary)]">{{ 'chat.result.downloadFormat' | translate }}</p>
              @if (!options()) {
                <idem-loader size="xs" class="self-center py-2" />
              } @else {
                @for (o of options(); track o.format) {
                  <button type="button" role="menuitem" class="flex items-center justify-between gap-4 rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--glass-bg-light)]" (click)="download(o.format)">
                    <span>{{ 'formats.' + o.format | translate }}</span>
                    <span class="text-xs text-[var(--color-text-tertiary)]">
                      @if (o.ready) {
                        <i class="pi pi-check" aria-hidden="true"></i> {{ 'chat.result.downloadReady' | translate }}
                      } @else if (o.cost === 0) {
                        {{ 'chat.result.downloadIncluded' | translate }}
                      } @else {
                        {{ 'chat.result.downloadPrice' | translate: { cost: o.cost } }}
                      }
                    </span>
                  </button>
                }
              }
            </div>
          }
        </div>
        <a data-tour="iv-result-edit" class="inner-button button-sm" [routerLink]="['/studio/video', brandId(), videoId()]">
          <i class="pi pi-pencil" aria-hidden="true"></i> {{ 'chat.result.edit' | translate }}
        </a>
      </div>
      @if (needCredits()) {
        <p class="text-sm" role="alert">{{ 'chat.payment.short' | translate }} <a class="text-[var(--color-primary-500)] underline" [href]="accountUrl">{{ 'chat.payment.cta' | translate }}</a></p>
      } @else if (downloadFailed()) {
        <p class="text-sm" role="alert">{{ 'chat.result.downloadFailed' | translate }}</p>
      }
      @if (video()?.film?.reference) {
        <p class="text-xs text-[var(--color-text-tertiary)]">{{ 'chat.result.fromReference' | translate: { shots: video()?.film?.scenes?.length ?? 0 } }}</p>
      }
      @if (broken() > 0) {
        <p class="flex items-start gap-1.5 text-xs text-[var(--color-danger)]" role="alert"><i class="pi pi-exclamation-triangle mt-0.5" aria-hidden="true"></i><span>{{ 'chat.result.broken' | translate: { count: broken() } }}</span></p>
      }
      @if (fidelity().length) {
        <ul class="flex max-w-[34rem] flex-col gap-1 text-xs text-[var(--color-text-tertiary)]" [attr.aria-label]="'chat.result.fidelityTitle' | translate">
          @for (note of fidelity(); track $index) {
            <li class="flex items-start gap-1.5"><i class="pi pi-info-circle mt-0.5" aria-hidden="true"></i><span>{{ note }}</span></li>
          }
        </ul>
      }
    </div>
  `,
})
export class VideoResult implements OnInit {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly tours = inject(TourService);
  private readonly studio = inject(StudioState);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;
  readonly brandId = input.required<string>();
  readonly videoId = input.required<string>();
  readonly video = input<MotionVideo | undefined>();
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly player = viewChild<ElementRef<HTMLIFrameElement>>('player');

  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  /** Tous les sons de l'aperçu sont chargés : la lecture peut être proposée. */
  protected readonly playable = signal(false);
  protected readonly loadPercent = signal(0);
  /** L'utilisateur a lancé la lecture (le voile disparaît). */
  protected readonly started = signal(false);

  protected readonly menuOpen = signal(false);
  protected readonly options = signal<DownloadOption[] | null>(null);
  /** Format en cours de préparation / d'enregistrement. */
  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadPercent = signal(0);
  protected readonly downloadFailed = signal(false);
  protected readonly needCredits = signal(false);
  private poll: Subscription | null = null;
  private fallback: ReturnType<typeof setTimeout> | null = null;

  private readonly format = computed(() => this.video()?.scope.formats[0] ?? 'story');
  protected readonly ratio = computed(() => RATIOS[this.format()] ?? '9 / 16');
  /** Au plus 26rem de haut : un format vertical reste étroit, un paysage prend la largeur. */
  protected readonly maxWidth = computed(() => {
    const [w, h] = (this.ratio() || '9 / 16').split('/').map((n) => Number(n.trim()));
    return `min(100%, 34rem, calc(26rem * ${(w / h).toFixed(4)}))`;
  });
  /** Ce que la vidéo n'a pas pu suivre de la demande (4K, plans filmés non générés…), dit à l'utilisateur. */
  protected readonly fidelity = computed(() => this.video()?.film?.fidelity?.notes ?? []);
  /** Scènes dont le code ne s'exécute pas : à corriger dans l'éditeur avant l'export. */
  protected readonly broken = computed(() => (this.video()?.film?.scenes ?? []).filter((s) => s.status === 'error').length);
  /** Le MP4 du format principal, s'il reflète la dernière retouche et qu'il est déjà un export. */
  protected readonly mp4 = computed(() => {
    const v = this.video();
    if (!v) return null;
    return v.renders.find((r) => r.status === 'done' && r.url && r.format === this.format() && !r.prerender && (r.stale === undefined ? !v.dirty : !r.stale)) ?? null;
  });

  constructor() {
    const onMessage = (event: MessageEvent) => this.onPlayerMessage(event);
    const onClick = (event: MouseEvent) => {
      if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) this.menuOpen.set(false);
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
      this.poll?.unsubscribe();
      if (this.fallback) clearTimeout(this.fallback);
    });
  }

  ngOnInit(): void {
    // Le composant n'est créé qu'une fois visible (`@defer (on viewport)` dans la conversation).
    if (!this.mp4() && !this.video()?.legacy) this.loadPreview();
    // La première création prête : le guide montre comment la changer et la télécharger.
    void this.tours.maybeStart('result');
  }

  protected loadPreview(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.playable.set(false);
    this.started.set(false);
    this.loadPercent.set(0);
    this.api.preview(this.brandId(), this.videoId()).subscribe({
      next: ({ html }) => {
        // Page composée par l'API (textes échappés), jouée dans un iframe isolé (`allow-scripts` seul).
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.loading.set(false);
        if (this.fallback) clearTimeout(this.fallback);
        this.fallback = setTimeout(() => this.playable.set(true), PLAYABLE_FALLBACK_MS);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /** Messages du lecteur : progression du chargement des sons, puis « jouable ». */
  private onPlayerMessage(event: MessageEvent): void {
    const frame = this.player()?.nativeElement;
    if (!frame || event.source !== frame.contentWindow) return;
    const m = event.data as { type?: string; loaded?: number; total?: number };
    if (m?.type === 'ivision:loading' && typeof m.total === 'number') {
      this.loadPercent.set(m.total ? Math.round(((m.loaded ?? 0) / m.total) * 100) : 100);
    } else if (m?.type === 'ivision:playable') {
      this.loadPercent.set(100);
      this.playable.set(true);
      if (this.fallback) clearTimeout(this.fallback);
    }
  }

  protected watch(): void {
    this.started.set(true);
    this.player()?.nativeElement.contentWindow?.postMessage({ type: 'ivision:play' }, '*');
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.frame().nativeElement.requestFullscreen?.().catch(() => undefined);
  }

  protected toggleMenu(): void {
    const open = !this.menuOpen();
    this.menuOpen.set(open);
    if (!open) return;
    this.options.set(null);
    this.api.videoDownloads(this.brandId(), this.videoId()).subscribe({
      next: ({ formats }) => {
        // Le format de la vidéo d'abord.
        const main = this.format();
        this.options.set([...formats].sort((a, b) => Number(b.format === main) - Number(a.format === main)));
      },
      error: () => this.options.set([]),
    });
  }

  /** Le format choisi : enregistré tout de suite s'il est prêt, sinon rendu puis enregistré. */
  protected download(format: string): void {
    this.menuOpen.set(false);
    this.downloading.set(format);
    this.downloadPercent.set(0);
    this.downloadFailed.set(false);
    this.needCredits.set(false);
    this.poll?.unsubscribe();
    // Une seule demande à la fois : deux demandes croisées pourraient lancer (et facturer) deux fois.
    let inFlight = false;
    const ask = () => {
      if (inFlight) return;
      inFlight = true;
      this.api.requestVideoDownload(this.brandId(), this.videoId(), format).subscribe({
        complete: () => (inFlight = false),
        next: (res) => {
          if (res.ready) {
            this.poll?.unsubscribe();
            this.poll = null;
            this.studio.refreshCredits();
            this.save(format);
          } else {
            this.downloadPercent.set(Math.round((res.progress ?? 0) * 100));
            this.studio.refreshCredits();
          }
        },
        error: (err) => {
          inFlight = false;
          this.poll?.unsubscribe();
          this.poll = null;
          this.downloading.set(null);
          if (err?.status === 402) this.needCredits.set(true);
          else this.downloadFailed.set(true);
        },
      });
    };
    // La route ne facture qu'au lancement : on la rappelle jusqu'à ce que le fichier soit prêt.
    this.poll = timer(0, 2500).subscribe(() => ask());
  }

  private save(format: string): void {
    this.api.saveFile(`/brands/${this.brandId()}/videos/${this.videoId()}/file?format=${format}`, `ivision-${format}.mp4`).subscribe({
      next: () => this.downloading.set(null),
      error: () => {
        this.downloading.set(null);
        this.downloadFailed.set(true);
      },
    });
  }
}
