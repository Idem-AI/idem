import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import {
  AdminServerRow,
  AdminTeamRow,
  AdminUserRow,
  InstanceOverview,
  PrivateKey,
  ServerFleetStats,
} from '../../../shared/models/ideploy.models';

/**
 * Instance administration — the whole deployment, across teams.
 *
 * Read-only by design. An admin panel is where destructive cross-team actions
 * tend to accumulate; none are offered here because nothing yet needs them,
 * and the safest version of "delete another team's data" is the one that does
 * not exist.
 */
@Component({
  selector: 'app-admin-page',
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
        {{ 'admin.title' | translate }}
      </h1>
      <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'admin.subtitle' | translate }}</p>
    </div>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    @if (overview(); as o) {
      <div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        @for (stat of stats(o); track stat.key) {
          <div class="glass-card p-4">
            <div
              class="text-2xl font-semibold"
              style="font-variant-numeric:tabular-nums;"
              [style.color]="stat.alert ? 'var(--color-danger)' : 'var(--color-text-primary)'"
            >
              {{ stat.value }}
            </div>
            <div class="mt-0.5 text-xs" style="color:var(--color-text-secondary);">
              {{ 'admin.stat.' + stat.key | translate }}
            </div>
          </div>
        }
      </div>
    }

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="glass-card p-4">
        <h2 class="mb-3 text-sm font-semibold">
          {{ 'admin.teams' | translate }}
          <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ teams().length }})</span>
        </h2>
        @if (teams().length === 0) {
          <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'admin.noTeams' | translate }}</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr style="color:var(--color-text-secondary);">
                  <th class="py-1.5 pr-3 text-left font-medium">{{ 'admin.name' | translate }}</th>
                  <th class="py-1.5 pr-3 text-right font-medium">{{ 'admin.members' | translate }}</th>
                  <th class="py-1.5 text-right font-medium">{{ 'admin.servers' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (t of teams(); track t.id) {
                  <tr style="border-top:1px solid var(--color-surface-2);">
                    <td class="py-1.5 pr-3">{{ t.name }}</td>
                    <td class="py-1.5 pr-3 text-right" style="font-variant-numeric:tabular-nums;">{{ t.members }}</td>
                    <td class="py-1.5 text-right" style="font-variant-numeric:tabular-nums;">{{ t.servers }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="glass-card p-4">
        <h2 class="mb-3 text-sm font-semibold">
          {{ 'admin.users' | translate }}
          <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ users().length }})</span>
        </h2>
        @if (users().length === 0) {
          <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'admin.noUsers' | translate }}</p>
        } @else {
          <div class="max-h-96 overflow-auto">
            <table class="w-full text-sm">
              <thead>
                <tr style="color:var(--color-text-secondary);">
                  <th class="py-1.5 pr-3 text-left font-medium">{{ 'admin.name' | translate }}</th>
                  <th class="py-1.5 pr-3 text-left font-medium">{{ 'admin.role' | translate }}</th>
                  <th class="py-1.5 text-right font-medium">{{ 'admin.teamCount' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr style="border-top:1px solid var(--color-surface-2);">
                    <td class="py-1.5 pr-3">
                      {{ u.name }}
                      <span class="block text-xs" style="color:var(--color-text-secondary);">{{ u.email }}</span>
                    </td>
                    <td class="py-1.5 pr-3" style="color:var(--color-text-secondary);">{{ u.instanceRole || '—' }}</td>
                    <td class="py-1.5 text-right" style="font-variant-numeric:tabular-nums;">{{ u.teams }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    <section class="glass-card p-4 mt-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">
          {{ 'admin.servers.title' | translate }}
          <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ servers().length }})</span>
        </h2>
        @if (fleetStats(); as s) {
          <div class="flex gap-3 text-xs" style="color:var(--color-text-secondary);">
            <span>{{ 'admin.servers.managed' | translate }}: {{ s.managed }}</span>
            <span>{{ 'admin.servers.client' | translate }}: {{ s.client }}</span>
            <span>{{ 'admin.servers.reachable' | translate }}: {{ s.reachable }}/{{ s.total }}</span>
          </div>
        }
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div>
          @if (servers().length === 0) {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'admin.servers.empty' | translate }}</p>
          } @else {
            <div class="max-h-96 overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr style="color:var(--color-text-secondary);">
                    <th class="py-1.5 pr-3 text-left font-medium">{{ 'admin.servers.name' | translate }}</th>
                    <th class="py-1.5 pr-3 text-left font-medium">{{ 'admin.servers.fleet' | translate }}</th>
                    <th class="py-1.5 pr-3 text-left font-medium">{{ 'admin.servers.location' | translate }}</th>
                    <th class="py-1.5 text-right font-medium">{{ 'admin.servers.status' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of servers(); track s.uuid) {
                    <tr style="border-top:1px solid var(--color-surface-2);">
                      <td class="py-1.5 pr-3">
                        {{ s.name }}
                        <span class="block text-xs" style="color:var(--color-text-secondary);">{{ s.ip }} · {{ s.team }}</span>
                      </td>
                      <td class="py-1.5 pr-3">
                        @if (s.idemManaged) {
                          <span class="rounded-full px-2 py-0.5 text-xs" style="background:color-mix(in srgb, var(--color-primary-500) 15%, transparent);color:var(--color-primary-400);">
                            {{ 'admin.servers.idemFleet' | translate }}
                          </span>
                          <button class="ml-2 text-xs hover:underline" style="color:var(--color-text-secondary);" (click)="toggleManaged(s)">
                            {{ 'admin.servers.demote' | translate }}
                          </button>
                        } @else {
                          <span class="text-xs" style="color:var(--color-text-secondary);">{{ 'admin.servers.clientOwned' | translate }}</span>
                          <button class="ml-2 text-xs hover:underline" style="color:var(--color-primary-400);" (click)="toggleManaged(s)">
                            {{ 'admin.servers.promote' | translate }}
                          </button>
                        }
                      </td>
                      <td class="py-1.5 pr-3 text-xs" style="color:var(--color-text-secondary);">
                        {{ s.city ? s.city + ', ' : '' }}{{ s.countryCode || '—' }}
                      </td>
                      <td class="py-1.5 text-right">
                        <span
                          class="inline-block h-2 w-2 rounded-full"
                          [style.background]="s.isReachable ? 'var(--color-success)' : 'var(--color-danger)'"
                          [title]="(s.isReachable ? 'admin.servers.reachableTitle' : 'admin.servers.unreachableTitle') | translate"
                        ></span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <form class="space-y-3" [formGroup]="serverForm" (ngSubmit)="createServer()">
          <h3 class="text-sm font-semibold">{{ 'admin.servers.addTitle' | translate }}</h3>
          <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'admin.servers.addHint' | translate }}</p>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm" for="srv-name">{{ 'admin.servers.name' | translate }}</label>
              <input type="text" id="srv-name"  formControlName="name" autocomplete="off" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="srv-ip">{{ 'admin.servers.ip' | translate }}</label>
              <input type="text" id="srv-ip" class="font-mono" formControlName="ip" autocomplete="off" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="srv-port">{{ 'admin.servers.port' | translate }}</label>
              <input id="srv-port"  type="number" formControlName="port" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="srv-user">{{ 'admin.servers.user' | translate }}</label>
              <input type="text" id="srv-user" class="font-mono" formControlName="user" />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm" for="srv-key">{{ 'admin.servers.privateKey' | translate }}</label>
            @if (privateKeys().length === 0) {
              <p class="text-sm" style="color:var(--color-text-secondary);">
                {{ 'admin.servers.noKeys' | translate }}
                <a routerLink="/security/keys" style="color:var(--color-primary-400);">{{ 'admin.servers.createKeyLink' | translate }}</a>
              </p>
            } @else {
              <select id="srv-key"  formControlName="private_key_id">
                <option [ngValue]="0" disabled>{{ 'admin.servers.choosePrivateKey' | translate }}</option>
                @for (key of privateKeys(); track key.id) {
                  <option [ngValue]="key.id">{{ key.name }}</option>
                }
              </select>
            }
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-sm" for="srv-country">{{ 'admin.servers.countryCode' | translate }}</label>
              <input type="text" id="srv-country" class="font-mono uppercase" formControlName="country_code" maxlength="2" placeholder="DE" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="srv-region">{{ 'admin.servers.region' | translate }}</label>
              <input type="text" id="srv-region"  formControlName="region" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="srv-city">{{ 'admin.servers.city' | translate }}</label>
              <input type="text" id="srv-city"  formControlName="city" />
            </div>
          </div>

          @if (serverError()) {
            <p class="text-sm" style="color:var(--color-danger);">{{ serverError() }}</p>
          }

          <button class="inner-button" type="submit" [disabled]="serverForm.invalid || creatingServer()">
            {{ (creatingServer() ? 'admin.servers.creating' : 'admin.servers.addSubmit') | translate }}
          </button>
        </form>
      </div>
    </section>
  `,
})
export class AdminPageComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly overview = signal<InstanceOverview | null>(null);
  protected readonly teams = signal<AdminTeamRow[]>([]);
  protected readonly users = signal<AdminUserRow[]>([]);
  protected readonly error = signal<string | null>(null);

  protected readonly servers = signal<AdminServerRow[]>([]);
  protected readonly fleetStats = signal<ServerFleetStats | null>(null);
  protected readonly privateKeys = signal<PrivateKey[]>([]);
  protected readonly creatingServer = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly serverForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    ip: ['', Validators.required],
    port: [22, Validators.required],
    user: ['root', Validators.required],
    private_key_id: [0, Validators.required],
    country_code: [''],
    region: [''],
    city: [''],
  });

  ngOnInit(): void {
    this.api.adminOverview().subscribe({
      next: (o) => this.overview.set(o),
      error: (e) => this.report(e),
    });
    this.api.adminTeams().subscribe({ next: (t) => this.teams.set(t), error: (e) => this.report(e) });
    this.api.adminUsers().subscribe({ next: (u) => this.users.set(u), error: (e) => this.report(e) });
    this.loadServers();
    this.api.listPrivateKeys().subscribe({ next: (k) => this.privateKeys.set(k), error: () => undefined });
  }

  private loadServers(): void {
    this.api.adminServers().subscribe({
      next: ({ servers, stats }) => {
        this.servers.set(servers);
        this.fleetStats.set(stats);
      },
      error: (e) => this.report(e),
    });
  }

  private report(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant('admin.loadError'));
  }

  protected createServer(): void {
    if (this.serverForm.invalid) return;
    this.creatingServer.set(true);
    this.serverError.set(null);
    const raw = this.serverForm.getRawValue();
    this.api
      .adminCreateManagedServer({
        name: raw.name,
        ip: raw.ip,
        port: raw.port,
        user: raw.user,
        private_key_id: raw.private_key_id,
        country_code: raw.country_code || undefined,
        region: raw.region || undefined,
        city: raw.city || undefined,
      })
      .subscribe({
        next: () => {
          this.creatingServer.set(false);
          this.serverForm.reset({ name: '', ip: '', port: 22, user: 'root', private_key_id: 0, country_code: '', region: '', city: '' });
          this.loadServers();
        },
        error: (e) => {
          this.creatingServer.set(false);
          this.serverError.set(
            (e as { error?: { error?: { message?: string } } })?.error?.error?.message ??
              this.translate.instant('admin.servers.addError')
          );
        },
      });
  }

  /** Toggling never touches an existing server's geography — only its fleet membership. */
  protected toggleManaged(server: AdminServerRow): void {
    this.api.adminUpdateServerFleet(server.uuid, { idem_managed: !server.idemManaged }).subscribe({
      next: () => this.loadServers(),
      error: (e) => this.report(e),
    });
  }

  /** Unreachable servers are the one figure worth colouring — it needs acting on. */
  protected stats(o: InstanceOverview): { key: string; value: number; alert: boolean }[] {
    return [
      { key: 'teams', value: o.teams, alert: false },
      { key: 'users', value: o.users, alert: false },
      { key: 'servers', value: o.servers, alert: false },
      { key: 'applications', value: o.applications, alert: false },
      { key: 'databases', value: o.databases, alert: false },
      { key: 'unreachable', value: o.unreachableServers, alert: o.unreachableServers > 0 },
    ];
  }
}
