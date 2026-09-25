import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';

/**
 * Git sources.
 *
 * A source is not created by filling in a form: it is the result of authorising
 * iDeploy on the provider. So this screen owns the connect and disconnect
 * actions and otherwise reports what the authorisation produced — rather than
 * offering a CRUD the provider would not honour.
 */
@Component({
  selector: 'app-sources-list',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
        {{ 'sources.title' | translate }}
      </h1>
      @if (githubUser(); as user) {
        <div class="flex items-center gap-3">
          <span class="text-sm" style="color:var(--color-text-secondary);">
            <i class="pi pi-github mr-1.5"></i>{{ user }}
          </span>
          <button class="outer-button" (click)="disconnect()" [disabled]="busy()">
            {{ 'sources.disconnect' | translate }}
          </button>
        </div>
      } @else {
        <button class="inner-button" (click)="connect()" [disabled]="busy()">
          <i class="pi pi-github mr-2"></i>{{ 'sources.connectGithub' | translate }}
        </button>
      }
    </div>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    @if (sources().length === 0) {
      <div class="glass-card p-4">
        <p>{{ 'sources.empty' | translate }}</p>
        <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'sources.emptyHint' | translate }}</p>
      </div>
    } @else {
      <div class="space-y-3">
        @for (s of sources(); track s.uuid) {
          <div class="glass-card p-4 flex items-center gap-3">
            <i
              class="pi"
              [class.pi-github]="s.provider === 'github'"
              [class.pi-sitemap]="s.provider === 'gitlab'"
              aria-hidden="true"
            ></i>
            <div>
              <div class="font-semibold">{{ s.name }}</div>
              <div class="text-sm" style="color: var(--color-text-secondary)">
                @if (s.organization) {
                  {{ s.organization }} ·
                }
                <a class="hover:underline" [href]="s.html_url" target="_blank" rel="noopener noreferrer">
                  {{ s.html_url }}
                </a>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class SourcesListComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  protected readonly sources = signal<
    { uuid: string; name: string; provider: string; organization: string | null; html_url: string }[]
  >([]);
  protected readonly githubUser = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listSources().subscribe({
      next: (s) => this.sources.set(s),
      error: (e) => this.report(e, 'sources.loadError'),
    });
    // A failure here only means "not connected"; it is not worth an error banner.
    this.api.githubStatus().subscribe({
      next: (user) => this.githubUser.set(user),
      error: () => this.githubUser.set(null),
    });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  /** Hands off to GitHub; the provider redirects back once authorised. */
  protected connect(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.githubAuthUrl().subscribe({
      next: (url) => (window.location.href = url),
      error: (e) => {
        this.report(e, 'sources.connectError');
        this.busy.set(false);
      },
    });
  }

  protected disconnect(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.githubDisconnect().subscribe({
      next: () => {
        this.githubUser.set(null);
        this.busy.set(false);
        this.load();
      },
      error: (e) => {
        this.report(e, 'sources.disconnectError');
        this.busy.set(false);
      },
    });
  }
}
