import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { ProxyStatus, Server, ServerValidation } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-servers-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Servers</h1>
      <a class="button" routerLink="/servers/new">+ Add server</a>
    </div>

    @if (loading()) {
      <p class="text-sm" style="color: var(--color-text-secondary)">Loading…</p>
    } @else if (servers().length === 0) {
      <div class="box">No servers yet. Add one to get started.</div>
    } @else {
      <div class="space-y-3">
        @for (server of servers(); track server.uuid) {
          <div class="box flex items-center justify-between">
            <div>
              <div class="font-semibold">{{ server.name }}</div>
              <div class="text-sm" style="color: var(--color-text-secondary)">
                {{ server.user }}&#64;{{ server.ip }}:{{ server.port }}
              </div>
              @if (validations()[server.uuid]; as v) {
                <div class="mt-1 text-xs">
                  <span [class.text-green-400]="v.reachable" [class.text-red-400]="!v.reachable">
                    {{ v.reachable ? 'reachable' : 'unreachable' }}
                  </span>
                  · Docker: {{ v.dockerInstalled ? 'installed' : 'missing' }}
                </div>
              }
              @if (proxies()[server.uuid]; as p) {
                <div class="mt-1 text-xs">Proxy: {{ p.status }}</div>
              }
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="button-secondary" (click)="validate(server)">Validate</button>
              <button class="button-secondary" (click)="install(server)">Install Docker</button>
              <button class="button-secondary" (click)="proxyStatus(server)">Proxy status</button>
              <button class="button-secondary" (click)="startProxy(server)">Start proxy</button>
              <button class="button" (click)="installCrowdSec(server)">Install CrowdSec</button>
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
  protected readonly validations = signal<Record<string, ServerValidation>>({});
  protected readonly proxies = signal<Record<string, ProxyStatus>>({});

  ngOnInit(): void {
    this.api.listServers().subscribe({
      next: (servers) => {
        this.servers.set(servers);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected validate(server: Server): void {
    this.api.validateServer(server.uuid).subscribe((v) => {
      this.validations.update((map) => ({ ...map, [server.uuid]: v }));
    });
  }

  protected install(server: Server): void {
    this.api.installDocker(server.uuid).subscribe(() => this.validate(server));
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
}
