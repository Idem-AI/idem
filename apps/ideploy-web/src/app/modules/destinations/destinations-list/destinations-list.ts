import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { Destination, Server } from '../../../shared/models/ideploy.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton/list-skeleton';

interface ServerDestinations {
  server: Server;
  /** Null while this server's networks are still loading. */
  destinations: Destination[] | null;
}

/**
 * Destinations — the private Docker networks on each server, grouped by
 * server. A destination is where containers land and find each other by
 * name; most people never need a second one, so adding is folded behind a
 * button per server rather than a form open on every card.
 */
@Component({
  selector: 'app-destinations-list',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule, IdemLoaderComponent, EmptyStateComponent, PageHeaderComponent, ListSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'destinations.title' | translate" [subtitle]="'destinations.subtitle' | translate" />

    @if (loading()) {
      <app-list-skeleton [count]="2" />
    } @else if (rows().length === 0) {
      <div class="glass-card">
        <app-empty-state kind="net" [title]="'destinations.emptyTitle' | translate" [body]="'destinations.empty' | translate">
          <a class="inner-button mt-5" routerLink="/servers/new">{{ 'servers.addServerButton' | translate }}</a>
        </app-empty-state>
      </div>
    } @else {
      <div class="space-y-4">
        @for (row of rows(); track row.server.uuid) {
          <section class="glass-card overflow-hidden">
            <header class="flex flex-wrap items-center gap-3 px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
              <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--glass-bg-subtle);">
                <i class="pi pi-server text-sm" style="color:var(--color-text-secondary);"></i>
              </span>
              <div class="min-w-0 flex-1">
                <a class="font-semibold text-text-primary hover:underline" [routerLink]="['/servers', row.server.uuid]">{{ row.server.name }}</a>
                <div class="font-mono text-xs" style="color:var(--color-text-tertiary);">{{ row.server.ip }}</div>
              </div>
              @if (adding() !== row.server.uuid) {
                <button type="button" class="outer-button button-sm" (click)="adding.set(row.server.uuid)">
                  <i class="pi pi-plus mr-1.5 text-xs"></i>{{ 'destinations.addDestination' | translate }}
                </button>
              }
            </header>

            @if (row.destinations === null) {
              <div class="px-5 py-4"><div class="skeleton h-4 w-1/3 rounded" aria-hidden="true"></div></div>
            } @else if (row.destinations.length === 0) {
              <p class="px-5 py-4 text-sm" style="color:var(--color-text-secondary);">{{ 'destinations.noDestinations' | translate }}</p>
            } @else {
              @for (d of row.destinations; track d.uuid; let last = $last) {
                <div class="flex items-center gap-3 px-5 py-3" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
                  <i class="pi pi-sitemap text-xs" style="color:var(--color-primary-500);"></i>
                  <span class="min-w-0 flex-1 truncate text-sm text-text-primary">{{ d.name }}</span>
                  <code class="rounded-md px-2 py-0.5 text-xs" style="background:var(--glass-bg-subtle);color:var(--color-text-secondary);">{{ d.network }}</code>
                </div>
              }
            }

            @if (adding() === row.server.uuid) {
              <form class="flex flex-wrap items-end gap-2 px-5 py-4" style="background:var(--glass-bg-light);border-top:1px solid var(--glass-border-subtle);" [formGroup]="formFor(row.server.uuid)" (ngSubmit)="create(row.server.uuid)">
                <div class="min-w-[200px] flex-1">
                  <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" [for]="'net-' + row.server.uuid">{{ 'destinations.networkLabel' | translate }}</label>
                  <input type="text" [id]="'net-' + row.server.uuid" class="font-mono text-sm" [placeholder]="'destinations.networkPlaceholder' | translate" [formControl]="formFor(row.server.uuid).controls.network" />
                </div>
                <button type="button" class="outer-button" (click)="adding.set(null)">{{ 'destinations.cancel' | translate }}</button>
                <button class="inner-button" type="submit" [disabled]="formFor(row.server.uuid).invalid || saving()">
                  @if (saving()) { <idem-loader size="xs" /> }
                  {{ 'destinations.create' | translate }}
                </button>
                @if (error()) {
                  <p class="w-full text-sm" style="color:var(--color-danger);">{{ error() }}</p>
                }
              </form>
            }
          </section>
        }
      </div>
    }
  `,
})
export class DestinationsListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly rows = signal<ServerDestinations[]>([]);
  protected readonly loading = signal(true);
  /** The server whose "add a network" form is open — one at a time. */
  protected readonly adding = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private forms = new Map<string, ReturnType<DestinationsListComponent['build']>>();

  private build() {
    return this.fb.nonNullable.group({ network: ['ideploy', Validators.required] });
  }
  protected formFor(uuid: string) {
    let f = this.forms.get(uuid);
    if (!f) {
      f = this.build();
      this.forms.set(uuid, f);
    }
    return f;
  }

  ngOnInit(): void {
    this.api.listServers().subscribe({
      next: (servers) => {
        this.rows.set(servers.map((server) => ({ server, destinations: null })));
        this.loading.set(false);
        for (const server of servers) this.refresh(server.uuid);
      },
      error: () => this.loading.set(false),
    });
  }

  private refresh(serverUuid: string): void {
    this.api.listDestinations(serverUuid).subscribe({
      next: (destinations) => this.setDestinations(serverUuid, destinations),
      error: () => this.setDestinations(serverUuid, []),
    });
  }

  private setDestinations(serverUuid: string, destinations: Destination[]): void {
    this.rows.update((current) => current.map((r) => (r.server.uuid === serverUuid ? { ...r, destinations } : r)));
  }

  protected create(serverUuid: string): void {
    const form = this.formFor(serverUuid);
    if (form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.createDestination(serverUuid, { network: form.getRawValue().network }).subscribe({
      next: () => {
        form.reset({ network: 'ideploy' });
        this.saving.set(false);
        this.adding.set(null);
        this.refresh(serverUuid);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('destinations.createError'));
      },
    });
  }
}
