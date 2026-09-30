import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton/list-skeleton';

/**
 * Git sources.
 *
 * A source is not created by filling in a form: it is the result of authorising
 * iDeploy on the provider. So this screen leads with the connection itself —
 * who is connected, or the one button that connects — and then lists what the
 * authorisation produced, rather than offering a CRUD the provider would not honour.
 */
@Component({
  selector: 'app-sources-list',
  imports: [TranslateModule, IdemLoaderComponent, EmptyStateComponent, PageHeaderComponent, ListSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'sources.title' | translate" [subtitle]="'sources.subtitle' | translate" />

    <!-- The connection is the page's real subject: say plainly whether it exists. -->
    <section class="glass-card mb-6 flex flex-wrap items-center gap-4 p-5">
      <span class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style="background:var(--glass-bg-subtle);">
        <i class="pi pi-github text-xl text-text-primary"></i>
      </span>
      <div class="min-w-0 flex-1">
        <div class="font-semibold text-text-primary">GitHub</div>
        @if (githubUser(); as user) {
          <p class="text-sm" style="color:var(--color-text-secondary);">
            <i class="pi pi-check-circle mr-1 text-xs" style="color:var(--color-success);"></i>{{ 'sources.connectedAs' | translate: { user: user } }}
          </p>
        } @else {
          <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'sources.emptyHint' | translate }}</p>
        }
      </div>
      @if (githubUser()) {
        <button type="button" class="outer-button button-sm" (click)="disconnect()" [disabled]="busy()">
          @if (busy()) { <idem-loader size="xs" /> }
          {{ 'sources.disconnect' | translate }}
        </button>
      } @else {
        <button type="button" class="inner-button" (click)="connect()" [disabled]="busy()">
          @if (busy()) { <idem-loader size="xs" /> } @else { <i class="pi pi-github mr-2"></i> }
          {{ 'sources.connectGithub' | translate }}
        </button>
      }
    </section>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <h2 class="mb-3 text-sm font-semibold" style="color:var(--color-text-secondary);">{{ 'sources.listTitle' | translate }}</h2>
    @if (loading()) {
      <app-list-skeleton [count]="2" />
    } @else if (sources().length === 0) {
      <div class="glass-card">
        <app-empty-state kind="code" [title]="'sources.empty' | translate" [body]="'sources.emptyBody' | translate" />
      </div>
    } @else {
      <div class="glass-card overflow-hidden">
        @for (s of sources(); track s.uuid; let last = $last) {
          <div class="flex items-center gap-4 px-5 py-4" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
            <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--glass-bg-subtle);">
              <i class="pi" [class.pi-github]="s.provider === 'github'" [class.pi-code]="s.provider !== 'github'" style="color:var(--color-text-secondary);" aria-hidden="true"></i>
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-text-primary">{{ s.name }}</span>
                <span class="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize" style="background:var(--glass-bg-subtle);color:var(--color-text-secondary);">{{ s.provider }}</span>
              </div>
              <div class="truncate text-xs" style="color:var(--color-text-secondary);">
                @if (s.organization) { {{ s.organization }} · }
                <a class="hover:underline" [href]="s.html_url" target="_blank" rel="noopener noreferrer">{{ s.html_url }}</a>
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
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listSources().subscribe({
      next: (s) => {
        this.sources.set(s);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.report(e, 'sources.loadError');
      },
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
