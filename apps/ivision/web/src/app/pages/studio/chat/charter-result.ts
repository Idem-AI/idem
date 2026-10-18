import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemDocumentPreviewComponent } from '@idem/shared-document-editor/angular';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription, timer } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { charterPage, idemLinks } from '../../../core/charter';
import { Charter } from '../../../core/models';
import { Illustration } from '../../../shared/components/illustration';

/** Les pages montrées dans le fil ; la charte entière s'ouvre dans sa page. */
const SHOWN = 3;

/**
 * LA CHARTE GRAPHIQUE dans la conversation : pendant sa création, l'avancement réel (pages prêtes) ; une
 * fois prête, ses premières pages, rendues par l'aperçu partagé d'IDEM, et trois gestes — la voir en
 * entier ici, la modifier dans IDEM (sa page de charte), ouvrir le projet dans IDEM.
 */
@Component({
  selector: 'iv-charter-result',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, IdemDocumentPreviewComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-3 flex flex-col gap-3">
      @switch (charter()?.status) {
        @case ('running') {
          <div class="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]" role="status">
            <iv-illustration class="h-12 w-12 flex-none" kind="kente" />
            <span class="flex flex-col gap-1">
              <span class="flex items-center gap-2 text-[var(--color-text-primary)]"><idem-loader size="xs" /> {{ 'charter.creating' | translate }}</span>
              <span>{{ (charter()!.done ? 'charter.pagesDone' : 'charter.starting') | translate: { count: charter()!.done } }}</span>
            </span>
          </div>
        }
        @case ('ready') {
          @if (pagesLoading()) {
            <div class="flex gap-2">
              @for (i of skeletons; track i) { <div class="skeleton h-28 w-48 rounded-lg"></div> }
            </div>
          } @else {
            <ul [class]="full() ? 'flex flex-col gap-6' : 'flex gap-2 overflow-x-auto pb-1'" [attr.aria-label]="'charter.pages' | translate">
              @for (p of shown(); track p.id; let i = $index) {
                <li [class]="full() ? 'overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]' : 'w-56 flex-none overflow-hidden rounded-lg border border-[var(--glass-border-subtle)]'">
                  <idem-document-preview
                    [html]="p.html"
                    [section]="p"
                    [pageFormat]="page()"
                    [fonts]="charter()!.fonts || {}"
                    [fitRoot]="false"
                    [maxHeight]="full() ? 620 : 126"
                    [showHint]="false"
                    (editRequested)="openIdem()"
                  />
                </li>
              }
            </ul>
          }
          <div class="flex flex-wrap gap-2" [class.order-first]="full()">
            @if (!full()) {
              <a class="inner-button button-sm" [routerLink]="['/studio/charter', brandId()]">
                <i class="pi pi-eye" aria-hidden="true"></i> {{ 'charter.view' | translate: { count: total() } }}
              </a>
            }
            @if (project(); as id) {
              <a class="outer-button button-sm" [href]="editUrl(id)" target="_blank" rel="noopener">
                <i class="pi pi-pencil" aria-hidden="true"></i> {{ 'charter.edit' | translate }}
              </a>
              <a class="button-ghost button-sm" [href]="projectUrl(id)" target="_blank" rel="noopener">
                <i class="pi pi-external-link" aria-hidden="true"></i> {{ 'charter.openProject' | translate }}
              </a>
            }
          </div>
        }
        @case ('failed') {
          <div class="flex items-center gap-3 text-sm" role="alert">
            <iv-illustration class="h-10 w-10 flex-none text-[var(--color-text-secondary)]" kind="cracked" />
            <span class="flex-1">{{ 'charter.failed' | translate }}</span>
            <button type="button" class="outer-button button-sm" [disabled]="starting()" (click)="start()">
              @if (starting()) { <idem-loader size="xs" /> }
              {{ 'charter.retry' | translate }}
            </button>
          </div>
        }
        @case ('none') {
          <p class="text-sm text-[var(--color-text-secondary)]">{{ 'charter.offer' | translate }}</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inner-button button-sm" [disabled]="starting()" (click)="start()">
              @if (starting()) { <idem-loader size="xs" /> } @else { <i class="pi pi-book" aria-hidden="true"></i> }
              {{ 'charter.create' | translate }}
            </button>
            @if (project(); as id) {
              <a class="button-ghost button-sm" [href]="projectUrl(id)" target="_blank" rel="noopener">
                <i class="pi pi-external-link" aria-hidden="true"></i> {{ 'charter.openProject' | translate }}
              </a>
            }
          </div>
        }
        @default {
          <div class="skeleton h-12 w-64 rounded-lg"></div>
        }
      }
      @if (refused()) {
        <p class="text-sm text-[var(--color-text-secondary)]" role="alert">{{ 'charter.refused' | translate }}</p>
      }
    </div>
  `,
})
export class CharterResult implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly brandId = input.required<string>();
  /** Le projet IDEM de la marque (lien « Modifier » et « Ouvrir le projet »). */
  readonly projectId = input<string | undefined>(undefined);
  /** La page de la charte : toutes les pages, en grand (sinon : les premières, dans le fil). */
  readonly full = input(false);

  protected readonly charter = signal<Charter | null>(null);
  protected readonly pagesLoading = signal(false);
  protected readonly starting = signal(false);
  protected readonly refused = signal(false);
  protected readonly skeletons = [0, 1, 2];
  protected readonly page = computed(() => charterPage(this.charter()?.pdfFormat));
  protected readonly shown = computed(() => (this.charter()?.pages ?? []).slice(0, this.full() ? undefined : SHOWN));
  protected readonly total = computed(() => this.charter()?.pages?.length ?? 0);
  private poll: Subscription | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  /** Le projet connu par la marque quand la conversation ne l'a pas donné. */
  protected readonly project = computed(() => this.projectId() || this.charter()?.projectId);

  protected editUrl(projectId: string): string {
    return idemLinks.charter(projectId);
  }

  protected projectUrl(projectId: string): string {
    return idemLinks.project(projectId);
  }

  /** Cliquer une page de la charte : sa page dans IDEM, où « Modifier » mène à l'éditeur. */
  protected openIdem(): void {
    const id = this.project();
    if (id) window.open(idemLinks.charter(id), '_blank', 'noopener');
  }

  protected start(): void {
    this.starting.set(true);
    this.refused.set(false);
    this.api.startCharter(this.brandId()).subscribe({
      next: (c) => {
        this.starting.set(false);
        this.charter.set(c);
        this.watch();
      },
      error: (e: { status?: number }) => {
        this.starting.set(false);
        if (e?.status === 402 || e?.status === 429) this.refused.set(true);
        else this.charter.update((c) => (c ? { ...c, status: 'failed' } : c));
      },
    });
  }

  private refresh(): void {
    this.api.charter(this.brandId()).subscribe({
      next: (c) => {
        this.charter.set(c);
        if (c.status === 'running') this.watch();
        else if (c.status === 'ready') this.loadPages();
      },
      error: () => this.charter.set({ brandId: this.brandId(), status: 'failed', done: 0 }),
    });
  }

  /** L'avancement, toutes les 4 s, jusqu'à la fin de la création. */
  private watch(): void {
    if (this.poll) return;
    this.poll = timer(4000, 4000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.api.charter(this.brandId()).subscribe({
          next: (c) => {
            this.charter.set(c);
            if (c.status === 'running') return;
            this.poll?.unsubscribe();
            this.poll = null;
            if (c.status === 'ready') this.loadPages();
          },
          error: () => undefined,
        })
      );
  }

  private loadPages(): void {
    this.pagesLoading.set(true);
    this.api.charter(this.brandId(), true).subscribe({
      next: (c) => {
        this.pagesLoading.set(false);
        this.charter.set(c);
      },
      error: () => this.pagesLoading.set(false),
    });
  }
}
