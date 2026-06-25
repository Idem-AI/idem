import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';
import { Project, Server, ServiceTemplate } from '../../../shared/models/ideploy.models';

/**
 * Vercel-style dashboard: a Usage panel + a Projects panel with one-click
 * "Deploy" cards. The deploy flow is designed for non-technical users — pick a
 * template or paste a Git URL and iDeploy auto-creates the project, picks a
 * server/destination and deploys (see /quick-deploy).
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header -->
    <div class="mb-6 flex items-center gap-3">
      <div class="relative flex-1">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs" style="color:#8d919a;"></i>
        <input class="input" style="padding-left:32px;" placeholder="Search Projects…"
               [ngModel]="query()" (ngModelChange)="query.set($event)" />
      </div>
      <button class="button" (click)="showDeploy.set(!showDeploy())">
        <i class="fa-solid fa-plus mr-2"></i> Add New
      </button>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Usage column -->
      <div class="lg:col-span-1 space-y-6">
        <div class="db-glass p-5">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-semibold">Usage</h2>
            <a routerLink="/subscription" class="text-xs" style="color:#60a5fa;">Upgrade</a>
          </div>
          <div class="space-y-4">
            <div>
              <div class="mb-1 flex items-center justify-between text-sm">
                <span><i class="fa-solid fa-cube mr-2" style="color:#60a5fa;"></i>Applications</span>
                <span>{{ quota().apps.used }} / {{ quota().apps.limit || '∞' }}</span>
              </div>
              <div class="h-1.5 w-full rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1);">
                <div class="h-full rounded-full" [style.width.%]="pct(quota().apps)" style="background:#2563eb;"></div>
              </div>
            </div>
            <div>
              <div class="mb-1 flex items-center justify-between text-sm">
                <span><i class="fa-solid fa-server mr-2" style="color:#4ade80;"></i>Servers</span>
                <span>{{ quota().servers.used }} / {{ quota().servers.limit || '∞' }}</span>
              </div>
              <div class="h-1.5 w-full rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1);">
                <div class="h-full rounded-full" [style.width.%]="pct(quota().servers)" style="background:#4ade80;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="db-glass p-5">
          <h2 class="mb-2 font-semibold">Get started</h2>
          <p class="text-sm" style="color:#8d919a;">
            New here? Add a server, then deploy your first app from a template or a Git repository — no config needed.
          </p>
          <a routerLink="/servers/new" class="button-secondary mt-3 inline-flex">Add a server</a>
        </div>
      </div>

      <!-- Projects column -->
      <div class="lg:col-span-2">
        <div class="db-glass p-6">
          @if (showDeploy() || projects().length === 0) {
            <div class="text-center mb-6">
              <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style="background:rgba(255,255,255,0.05);">
                <i class="fa-solid fa-cloud-arrow-up text-xl" style="color:#60a5fa;"></i>
              </div>
              <h2 class="text-lg font-semibold">Deploy your first project</h2>
              <p class="text-sm" style="color:#8d919a;">Start from a template or import a Git repository.</p>
            </div>

            @if (error()) {
              <div class="box mb-4" style="border-color:rgba(239,68,68,0.4);">
                <p class="text-sm text-red-400">{{ error() }}</p>
                @if (error()!.includes('server')) {
                  <a routerLink="/servers/new" class="text-xs" style="color:#60a5fa;">→ Add a server</a>
                }
              </div>
            }

            <!-- Import from Git -->
            <div class="box mb-3 flex items-center gap-3">
              <i class="fa-solid fa-code-branch text-lg" style="color:#60a5fa;"></i>
              <div class="flex-1">
                <div class="font-semibold">Import Project</div>
                <div class="text-sm" style="color:#8d919a;">Deploy from a public Git repository URL.</div>
                <div class="mt-2 flex gap-2">
                  <input class="input flex-1" placeholder="App name" [(ngModel)]="gitName" />
                  <input class="input flex-[2]" placeholder="https://github.com/org/repo" [(ngModel)]="gitUrl" />
                </div>
              </div>
              <button class="button" [disabled]="!gitName || !gitUrl || busy()" (click)="deployGit()">
                {{ busy() ? '…' : 'Import' }}
              </button>
            </div>

            <!-- One-click templates -->
            @for (tpl of templates(); track tpl.name) {
              <div class="box mb-3 flex items-center justify-between">
                <div>
                  <div class="font-semibold capitalize">{{ tpl.name }}</div>
                  <div class="text-sm" style="color:#8d919a;">{{ tpl.slogan }}</div>
                </div>
                <button class="button-secondary" [disabled]="busy()" (click)="deployTemplate(tpl)">Deploy</button>
              </div>
            }
          } @else {
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-semibold">Projects</h2>
              <button class="button-secondary" (click)="showDeploy.set(true)">+ New</button>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              @for (p of filteredProjects(); track p.uuid) {
                <a class="box block hover:border-white/20" [routerLink]="['/projects', p.uuid]">
                  <div class="flex items-center gap-2">
                    <i class="fa-solid fa-layer-group" style="color:#2563eb;"></i>
                    <span class="font-semibold">{{ p.name }}</span>
                  </div>
                  @if (p.description) {
                    <p class="mt-1 text-sm" style="color:#8d919a;">{{ p.description }}</p>
                  }
                </a>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  protected readonly projects = signal<Project[]>([]);
  protected readonly servers = signal<Server[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly quota = signal<{ apps: { used: number; limit: number }; servers: { used: number; limit: number } }>({
    apps: { used: 0, limit: 0 },
    servers: { used: 0, limit: 0 },
  });
  protected readonly showDeploy = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly query = signal('');
  protected gitName = '';
  protected gitUrl = '';

  protected readonly filteredProjects = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.projects().filter((p) => p.name.toLowerCase().includes(q)) : this.projects();
  });

  ngOnInit(): void {
    this.api.listProjects().subscribe((p) => this.projects.set(p));
    this.api.listServers().subscribe((s) => this.servers.set(s));
    this.api.getQuota().subscribe((q) => this.quota.set(q));
    this.api.listServiceTemplates().subscribe((t) => this.templates.set(t.slice(0, 6)));
  }

  protected pct(x: { used: number; limit: number }): number {
    return x.limit ? Math.min(100, Math.round((x.used / x.limit) * 100)) : 0;
  }

  protected deployGit(): void {
    this.run({ name: this.gitName, git_repository: this.gitUrl });
  }

  protected deployTemplate(tpl: ServiceTemplate): void {
    this.run({ name: tpl.name, template: tpl.name });
  }

  private run(body: { name: string; git_repository?: string; template?: string }): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.quickDeploy(body).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.deploymentUuid) {
          void this.router.navigate(['/deployments', res.deploymentUuid]);
        } else {
          void this.router.navigate(['/services']);
        }
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.error?.message ?? 'Deployment failed');
      },
    });
  }
}
