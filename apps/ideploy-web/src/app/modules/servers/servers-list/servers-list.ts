import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { environment } from '../../../../environments/environment';
import {
  ProxyStatus,
  Server,
  ServerCheck,
  ServerReadiness,
} from '../../../shared/models/ideploy.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton/list-skeleton';

type Busy = 'validate' | 'setup' | 'proxy' | 'crowdsec' | 'delete';

/**
 * The machines applications can land on.
 *
 * Each row answers "which machine, and can it take a deploy?" — the readiness
 * check is the one action worth a button. The maintenance actions (proxy,
 * CrowdSec, setup, delete) are rarer and live in the row's menu, so the list
 * reads as a list rather than a toolbar per line. Delete asks twice.
 */
@Component({
  selector: 'app-servers-list',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, EmptyStateComponent, PageHeaderComponent, ListSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'servers.title' | translate" [subtitle]="'servers.subtitle' | translate" [count]="loading() ? null : servers().length">
      @if (!loading() && servers().length > 0) {
        @if (!isProd) {
          <button type="button" class="outer-button" [disabled]="addingLocal()" (click)="useLocalMachine()">
            @if (addingLocal()) { <idem-loader size="xs" /> }
            {{ (addingLocal() ? 'servers.addingLocal' : 'servers.useLocalButton') | translate }}
          </button>
        }
        <a class="outer-button" routerLink="/servers/new/cloud"><i class="pi pi-cloud mr-2 text-xs"></i>{{ 'servers.provisionButton' | translate }}</a>
        <a class="inner-button" routerLink="/servers/new"><i class="pi pi-plus mr-2 text-xs"></i>{{ 'servers.addServerButton' | translate }}</a>
      }
    </app-page-header>

    @if (localError()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ localError() }}</p>
    }

    @if (loading()) {
      <app-list-skeleton />
    } @else if (servers().length === 0) {
      <div class="glass-card">
        <app-empty-state kind="server" [title]="'servers.empty' | translate" [body]="'servers.emptyHint' | translate">
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <a class="outer-button" routerLink="/servers/new/cloud"><i class="pi pi-cloud mr-2 text-xs"></i>{{ 'servers.provisionButton' | translate }}</a>
            <a class="inner-button" routerLink="/servers/new">{{ 'servers.addServerButton' | translate }}</a>
            @if (!isProd) {
              <button type="button" class="outer-button" [disabled]="addingLocal()" (click)="useLocalMachine()">
                @if (addingLocal()) { <idem-loader size="xs" /> }
                {{ (addingLocal() ? 'servers.addingLocal' : 'servers.useLocalButton') | translate }}
              </button>
            }
          </div>
        </app-empty-state>
      </div>
    } @else {
      <div class="glass-card">
        @for (server of servers(); track server.uuid; let last = $last) {
          <div class="px-5 py-4" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
            <div class="flex flex-wrap items-center gap-4">
              <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--glass-bg-subtle);">
                <i class="pi pi-server" style="color:var(--color-text-secondary);"></i>
              </span>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <a class="truncate font-semibold text-text-primary hover:underline" [routerLink]="['/servers', server.uuid]">{{ server.name }}</a>
                  @if (readiness()[server.uuid]; as r) {
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      [style.color]="r.ready ? 'var(--color-success)' : 'var(--color-danger)'"
                      style="background:color-mix(in srgb, currentColor 10%, transparent);">
                      <i class="pi text-[10px]" [class.pi-check-circle]="r.ready" [class.pi-times-circle]="!r.ready"></i>
                      {{ (r.ready ? 'servers.ready' : 'servers.notReady') | translate }}
                    </span>
                  }
                  @if (proxies()[server.uuid]; as p) {
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      [style.color]="p.status === 'running' ? 'var(--color-success)' : 'var(--color-text-tertiary)'"
                      style="background:color-mix(in srgb, currentColor 10%, transparent);">
                      <i class="pi pi-sitemap text-[10px]"></i>{{ 'servers.proxyStatus' | translate: { status: p.status } }}
                    </span>
                  }
                </div>
                <div class="mt-0.5 font-mono text-xs" style="color:var(--color-text-secondary);">{{ server.user }}&#64;{{ server.ip }}:{{ server.port }}</div>
              </div>

              <div class="flex items-center gap-2">
                <button type="button" class="outer-button button-sm" [disabled]="!!busy()[server.uuid]" (click)="validate(server)">
                  @if (busy()[server.uuid] === 'validate') { <idem-loader size="xs" /> } @else { <i class="pi pi-verified mr-1.5 text-xs"></i> }
                  {{ 'servers.validate' | translate }}
                </button>
                <a class="outer-button button-sm" [routerLink]="['/servers', server.uuid]">{{ 'servers.manage' | translate }}</a>

                <div class="relative">
                  <button type="button" class="outer-button button-sm" [attr.aria-label]="'servers.moreActions' | translate" [attr.aria-expanded]="menuFor() === server.uuid" (click)="toggleMenu(server.uuid)">
                    @if (busy()[server.uuid] && busy()[server.uuid] !== 'validate') { <idem-loader size="xs" /> } @else { <i class="pi pi-ellipsis-h text-xs"></i> }
                  </button>
                  @if (menuFor() === server.uuid) {
                    <div class="fixed inset-0 z-10" (click)="closeMenu()"></div>
                    <div class="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border shadow-glass" style="background:var(--color-surface-1);border-color:var(--glass-border);" role="menu">
                      <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="setUp(server)">
                        <i class="pi pi-wrench w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'servers.setUp' | translate }}
                      </button>
                      <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="proxyStatus(server)">
                        <i class="pi pi-info-circle w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'servers.proxyStatusButton' | translate }}
                      </button>
                      <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="startProxy(server)">
                        <i class="pi pi-play w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'servers.startProxy' | translate }}
                      </button>
                      <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-smooth hover:bg-[var(--glass-bg-subtle)]" (click)="installCrowdSec(server)">
                        <i class="pi pi-shield w-4 text-center text-xs" style="color:var(--color-text-secondary);"></i>{{ 'servers.installCrowdSec' | translate }}
                      </button>
                      <div class="border-t" style="border-color:var(--glass-border-subtle);"></div>
                      <button type="button" role="menuitem" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-smooth hover:bg-[var(--glass-bg-subtle)]" style="color:var(--color-danger);" (click)="remove(server)">
                        <i class="pi pi-trash w-4 text-center text-xs"></i>{{ (confirmDelete() === server.uuid ? 'servers.confirmDelete' : 'servers.delete') | translate }}
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>

            @if (readiness()[server.uuid]; as r) {
              <ul class="mt-3 space-y-1.5 rounded-xl border p-3 text-xs sm:ml-14" style="border-color:var(--glass-border-subtle);background:var(--glass-bg-subtle);">
                @for (check of r.checks; track check.id) {
                  @if (check.status !== 'skipped') {
                    <li class="flex gap-2">
                      <i class="pi mt-0.5 text-[11px]" [class]="checkIcon(check.status)" [style.color]="checkColor(check.status)"></i>
                      <span>
                        <span class="text-text-primary">{{ check.label }}</span>
                        @if (check.detail) { <span style="color:var(--color-text-secondary);"> — {{ check.detail }}</span> }
                        @if (check.remedy) { <span class="mt-0.5 block" style="color:var(--color-warning);">{{ check.remedy }}</span> }
                      </span>
                    </li>
                  }
                }
              </ul>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ServersListComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  protected readonly isProd = environment.production;

  protected readonly servers = signal<Server[]>([]);
  protected readonly loading = signal(true);
  protected readonly readiness = signal<Record<string, ServerReadiness>>({});
  protected readonly proxies = signal<Record<string, ProxyStatus>>({});
  /** Per-server in-flight action: setup takes minutes and must not be re-triggered. */
  protected readonly busy = signal<Record<string, Busy | undefined>>({});
  protected readonly menuFor = signal<string | null>(null);
  protected readonly confirmDelete = signal<string | null>(null);
  protected readonly addingLocal = signal(false);
  protected readonly localError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listServers().subscribe({
      next: (servers) => {
        this.servers.set(servers);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * "This machine" — the host running Docker Compose, reached without SSH via
   * a docker.sock bind mount (see docker-compose.dev.yml). Idempotent server-
   * side: re-clicking after it already exists just re-confirms Docker works.
   */
  protected useLocalMachine(): void {
    this.addingLocal.set(true);
    this.localError.set(null);
    this.api.createLocalServer().subscribe({
      next: (r) => {
        this.addingLocal.set(false);
        if (!r.dockerOk) {
          this.localError.set(this.translate.instant('servers.localDockerUnreachable'));
        }
        this.load();
      },
      error: (e) => {
        this.addingLocal.set(false);
        this.localError.set(
          (e as { error?: { error?: { message?: string } } })?.error?.error?.message ??
            this.translate.instant('servers.localError')
        );
      },
    });
  }

  protected toggleMenu(uuid: string): void {
    this.confirmDelete.set(null);
    this.menuFor.set(this.menuFor() === uuid ? null : uuid);
  }

  protected closeMenu(): void {
    this.menuFor.set(null);
    this.confirmDelete.set(null);
  }

  protected checkIcon(status: ServerCheck['status']): string {
    return status === 'ok' ? 'pi pi-check-circle' : status === 'warning' ? 'pi pi-exclamation-triangle' : 'pi pi-times-circle';
  }

  protected checkColor(status: ServerCheck['status']): string {
    return status === 'ok' ? 'var(--color-success)' : status === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)';
  }

  private setBusy(uuid: string, action: Busy | undefined): void {
    this.busy.update((map) => ({ ...map, [uuid]: action }));
  }

  protected validate(server: Server): void {
    this.setBusy(server.uuid, 'validate');
    this.api.validateServer(server.uuid).subscribe({
      next: (report) => {
        this.readiness.update((map) => ({ ...map, [server.uuid]: report }));
        this.setBusy(server.uuid, undefined);
      },
      error: () => this.setBusy(server.uuid, undefined),
    });
  }

  /** Setup already re-checks readiness, so we display its report directly. */
  protected setUp(server: Server): void {
    this.closeMenu();
    this.setBusy(server.uuid, 'setup');
    this.api.setUpServer(server.uuid).subscribe({
      next: (result) => {
        this.readiness.update((map) => ({ ...map, [server.uuid]: result.readiness }));
        this.setBusy(server.uuid, undefined);
      },
      error: () => this.setBusy(server.uuid, undefined),
    });
  }

  protected proxyStatus(server: Server): void {
    this.closeMenu();
    this.setBusy(server.uuid, 'proxy');
    this.api.getProxyStatus(server.uuid).subscribe({
      next: (p) => {
        this.proxies.update((map) => ({ ...map, [server.uuid]: p }));
        this.setBusy(server.uuid, undefined);
      },
      error: () => this.setBusy(server.uuid, undefined),
    });
  }

  protected startProxy(server: Server): void {
    this.closeMenu();
    this.setBusy(server.uuid, 'proxy');
    this.api.startProxy(server.uuid).subscribe({
      next: () => this.proxyStatus(server),
      error: () => this.setBusy(server.uuid, undefined),
    });
  }

  protected installCrowdSec(server: Server): void {
    this.closeMenu();
    this.setBusy(server.uuid, 'crowdsec');
    this.api.installCrowdSec(server.uuid).subscribe({
      next: () => this.setBusy(server.uuid, undefined),
      error: () => this.setBusy(server.uuid, undefined),
    });
  }

  /** First click arms, second click deletes — a server takes its applications with it. */
  protected remove(server: Server): void {
    if (this.confirmDelete() !== server.uuid) {
      this.confirmDelete.set(server.uuid);
      return;
    }
    this.closeMenu();
    this.setBusy(server.uuid, 'delete');
    this.api.deleteServer(server.uuid).subscribe({
      next: () => this.servers.update((list) => list.filter((s) => s.uuid !== server.uuid)),
      error: () => this.setBusy(server.uuid, undefined),
    });
  }
}
