import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';

/** One line of `docker logs --timestamps`: its time, and what the application printed. */
interface LogLine {
  time: string;
  text: string;
}

/** How often the logs are read again while following them. */
const FOLLOW_INTERVAL_MS = 3000;

/**
 * What the running application prints — its container's output, live. The
 * deployment log says how it was built; this says what it does now (requests,
 * errors, its framework's own log).
 */
@Component({
  selector: 'app-logs-tab',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card overflow-hidden">
      <header class="flex flex-wrap items-center gap-3 px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
        <div class="mr-auto">
          <h2 class="font-semibold text-text-primary">{{ 'applications.detail.logs.title' | translate }}</h2>
          <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
            @if (container(); as c) {
              {{ 'applications.detail.logs.hint' | translate }} <code class="font-mono text-xs">{{ c }}</code>
            } @else {
              {{ 'applications.detail.logs.hint' | translate }}
            }
          </p>
        </div>
        <label class="sr-only" for="logs-filter">{{ 'applications.detail.logs.filter' | translate }}</label>
        <input id="logs-filter" type="search" class="font-mono text-sm" style="max-width:220px;" [placeholder]="'applications.detail.logs.filter' | translate" [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
        <label class="sr-only" for="logs-tail">{{ 'applications.detail.logs.lines' | translate }}</label>
        <select id="logs-tail" [ngModel]="tail()" (ngModelChange)="setTail($event)">
          @for (n of tails; track n) {
            <option [ngValue]="n">{{ 'applications.detail.logs.lastLines' | translate: { count: n } }}</option>
          }
        </select>
        <button type="button" class="outer-button" [attr.aria-pressed]="follow()" (click)="toggleFollow()">
          <i class="pi mr-1.5 text-xs" [class.pi-pause]="follow()" [class.pi-play]="!follow()" aria-hidden="true"></i>
          {{ (follow() ? 'applications.detail.logs.pause' : 'applications.detail.logs.follow') | translate }}
        </button>
      </header>

      @if (error() !== null) {
        <p class="px-5 py-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() || ('applications.detail.logs.failed' | translate) }}</p>
      } @else if (loaded() && !container()) {
        <p class="px-5 py-6 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.logs.notRunning' | translate }}</p>
      } @else if (loaded() && lines().length === 0) {
        <p class="px-5 py-6 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.logs.empty' | translate }}</p>
      } @else {
        <div #scroller class="overflow-auto px-5 py-3 font-mono text-xs leading-relaxed" style="max-height:65vh;background:#000;" role="log" aria-live="polite">
          @for (line of shown(); track $index) {
            <div class="whitespace-pre-wrap break-all"><span style="color:var(--color-text-tertiary);">{{ line.time }}</span> {{ line.text }}</div>
          }
        </div>
      }
    </section>
  `,
})
export class AppLogsTabComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly uuid = input.required<string>();

  protected readonly tails = [200, 500, 2000];
  protected readonly tail = signal(500);
  protected readonly follow = signal(true);
  protected readonly filter = signal('');
  protected readonly container = signal<string | null>(null);
  protected readonly lines = signal<LogLine[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly shown = computed(() => {
    const f = this.filter().trim().toLowerCase();
    return f ? this.lines().filter((l) => l.text.toLowerCase().includes(f)) : this.lines();
  });

  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');
  private timer?: ReturnType<typeof setInterval>;
  private inFlight = false;

  ngOnInit(): void {
    this.load();
    this.startFollowing();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected setTail(n: number): void {
    this.tail.set(n);
    this.load();
  }

  protected toggleFollow(): void {
    this.follow.set(!this.follow());
    if (this.follow()) {
      this.load();
      this.startFollowing();
    } else {
      clearInterval(this.timer);
    }
  }

  private startFollowing(): void {
    clearInterval(this.timer);
    if (this.follow()) this.timer = setInterval(() => this.load(), FOLLOW_INTERVAL_MS);
  }

  private load(): void {
    if (this.inFlight) return;
    this.inFlight = true;
    this.api.appLogs(this.uuid(), this.tail()).subscribe({
      next: (r) => {
        this.inFlight = false;
        this.error.set(null);
        this.container.set(r.container);
        this.lines.set(parseLines(r.logs));
        this.loaded.set(true);
        // Following: the newest line stays in view.
        if (this.follow()) setTimeout(() => this.scroller()?.nativeElement.scrollTo({ top: 1e9 }));
      },
      error: (e) => {
        this.inFlight = false;
        this.loaded.set(true);
        this.error.set((e as { error?: { error?: { message?: string } } })?.error?.error?.message ?? '');
      },
    });
  }
}

/** `2026-10-17T22:34:23.123456789Z text` → its local time and its text. */
function parseLines(raw: string): LogLine[] {
  return raw
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => {
      const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s?(.*)$/.exec(l);
      if (!m) return { time: '', text: l };
      const d = new Date(m[1]);
      return { time: Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(), text: m[2] };
    });
}
