import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import {
  ProxyStatus,
  Server,
  ServerCheck,
  ServerReadiness,
} from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-servers-list',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">{{ 'servers.title' | translate }}</h1>
      <a class="button" routerLink="/servers/new">{{ 'servers.addServerButton' | translate }}</a>
    </div>

    @if (loading()) {
      <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'servers.loading' | translate }}</p>
    } @else if (servers().length === 0) {
      <div class="box">{{ 'servers.empty' | translate }}</div>
    } @else {
      <div class="space-y-3">
        @for (server of servers(); track server.uuid) {
          <div class="box flex items-center justify-between">
            <div>
              <div class="font-semibold">{{ server.name }}</div>
              <div class="text-sm" style="color: var(--color-text-secondary)">
                {{ server.user }}&#64;{{ server.ip }}:{{ server.port }}
              </div>
              @if (readiness()[server.uuid]; as r) {
                <div class="mt-2 text-xs">
                  <span
                    class="font-semibold"
                    [class.text-green-400]="r.ready"
                    [class.text-red-400]="!r.ready"
                  >
                    {{ (r.ready ? 'servers.ready' : 'servers.notReady') | translate }}
                  </span>
                  <ul class="mt-1 space-y-1">
                    @for (check of r.checks; track check.id) {
                      @if (check.status !== 'skipped') {
                        <li class="flex gap-2">
                          <span
                            [class.text-green-400]="check.status === 'ok'"
                            [class.text-amber-400]="check.status === 'warning'"
                            [class.text-red-400]="check.status === 'failed'"
                            >{{ statusMark(check.status) }}</span
                          >
                          <span>
                            {{ check.label }}
                            @if (check.detail) {
                              <span style="color: var(--color-text-secondary)"> — {{ check.detail }}</span>
                            }
                            @if (check.remedy) {
                              <span class="block text-amber-300">{{ check.remedy }}</span>
                            }
                          </span>
                        </li>
                      }
                    }
                  </ul>
                </div>
              }
              @if (proxies()[server.uuid]; as p) {
                <div class="mt-1 text-xs">{{ 'servers.proxyStatus' | translate:{ status: p.status } }}</div>
              }
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="button-secondary" (click)="validate(server)" [disabled]="busy()[server.uuid]">
                {{ 'servers.validate' | translate }}
              </button>
              <button class="button-secondary" (click)="setUp(server)" [disabled]="busy()[server.uuid]">
                {{ (busy()[server.uuid] ? 'servers.settingUp' : 'servers.setUp') | translate }}
              </button>
              <button class="button-secondary" (click)="proxyStatus(server)">{{ 'servers.proxyStatusButton' | translate }}</button>
              <button class="button-secondary" (click)="startProxy(server)">{{ 'servers.startProxy' | translate }}</button>
              <button class="button-secondary" (click)="installCrowdSec(server)">{{ 'servers.installCrowdSec' | translate }}</button>
              <button class="text-xs text-red-400" (click)="remove(server)">{{ 'servers.delete' | translate }}</button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ServersListComponent implements OnInit {
  private api = inject(ApiService);

  protected readonly servers = signal<Server[]>([]);
  protected readonly loading = signal(true);
  protected readonly readiness = signal<Record<string, ServerReadiness>>({});
  protected readonly proxies = signal<Record<string, ProxyStatus>>({});
  /** Per-server in-flight flag: setup takes minutes and must not be re-triggered. */
  protected readonly busy = signal<Record<string, boolean>>({});

  ngOnInit(): void {
    this.api.listServers().subscribe({
      next: (servers) => {
        this.servers.set(servers);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusMark(status: ServerCheck['status']): string {
    return status === 'ok' ? '✓' : status === 'warning' ? '!' : '✕';
  }

  protected validate(server: Server): void {
    this.api.validateServer(server.uuid).subscribe((report) => {
      this.readiness.update((map) => ({ ...map, [server.uuid]: report }));
    });
  }

  /** Setup already re-checks readiness, so we display its report directly. */
  protected setUp(server: Server): void {
    this.busy.update((map) => ({ ...map, [server.uuid]: true }));
    this.api.setUpServer(server.uuid).subscribe({
      next: (result) => {
        this.readiness.update((map) => ({ ...map, [server.uuid]: result.readiness }));
        this.busy.update((map) => ({ ...map, [server.uuid]: false }));
      },
      error: () => this.busy.update((map) => ({ ...map, [server.uuid]: false })),
    });
  }

  protected proxyStatus(server: Server): void {
    this.api.getProxyStatus(server.uuid).subscribe((p) => {
      this.proxies.update((map) => ({ ...map, [server.uuid]: p }));
    });
  }

  protected startProxy(server: Server): void {
    this.api.startProxy(server.uuid).subscribe(() => this.proxyStatus(server));
  }

  protected installCrowdSec(server: Server): void {
    this.api.installCrowdSec(server.uuid).subscribe();
  }

  protected remove(server: Server): void {
    this.api.deleteServer(server.uuid).subscribe(() => {
      this.servers.update((list) => list.filter((s) => s.uuid !== server.uuid));
    });
  }
}
