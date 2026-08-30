import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}
interface NavSection {
  title?: string;
  items: NavItem[];
}

const APP_ROUTE = /^\/applications\/([^/]+)/;

/** The application-scoped nav shown while inside one app, Vercel's own project sidebar. */
function appNav(uuid: string): NavSection[] {
  const base = `/applications/${uuid}`;
  return [
    {
      items: [
        { path: base, label: 'shell.nav.appOverview', icon: 'fa-solid fa-gauge' },
        { path: `${base}/deployments`, label: 'shell.nav.appDeployments', icon: 'fa-solid fa-rocket' },
        { path: `${base}/pipeline`, label: 'shell.nav.appPipeline', icon: 'fa-solid fa-diagram-project' },
        { path: `${base}/security`, label: 'shell.nav.appFirewall', icon: 'fa-solid fa-shield-halved' },
        { path: `${base}/insights`, label: 'shell.nav.appInsights', icon: 'fa-solid fa-chart-line' },
        { path: `${base}/terminal`, label: 'shell.nav.appTerminal', icon: 'fa-solid fa-terminal' },
      ],
    },
  ];
}

/**
 * Authenticated app shell — topbar (logo, plan/usage badges, user menu) + dark
 * glass sidebar, Vercel-style: the sidebar's top section is context-sensitive
 * (the account-wide nav on every global page, one application's own nav —
 * Overview/Deployments/Pipeline/Firewall/Insights/Terminal — the moment the
 * URL is inside `/applications/:uuid`), while the bottom "Configuration"
 * section (settings, keys, team, …) never changes: those are account-wide no
 * matter which application you are looking at.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    LanguageSelectorComponent,
    ThemeToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-0 left-0 right-0 z-50 h-16 topbar-shell">
      <div class="flex items-center justify-between h-16 px-6">
        <a routerLink="/dashboard" class="flex items-center gap-3">
          <img src="/ideploy-logo.svg" alt="iDeploy" class="h-8 w-auto object-contain"
               onerror="this.onerror=null;this.src='/ideploy-logo.png';" />
        </a>

        <div class="flex items-center gap-3">
          @if (isInstanceAdmin()) {
            <!-- The badge doubles as the way in: it was previously inert. -->
            <a routerLink="/admin"
               class="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:opacity-80"
               style="background:color-mix(in srgb, var(--color-danger) 12%, transparent);color:var(--color-danger);border:1px solid color-mix(in srgb, var(--color-danger) 28%, transparent);">
              <i class="fa-solid fa-shield-halved text-xs"></i>
              <span style="font-size:11px;font-weight:700;letter-spacing:.05em;">{{ 'shell.admin' | translate }}</span>
            </a>
          }
          <a routerLink="/subscription"
             class="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:opacity-80"
             style="background:color-mix(in srgb, var(--color-primary-500) 12%, transparent);color:var(--color-primary-400);border:1px solid color-mix(in srgb, var(--color-primary-500) 28%, transparent);">
            <i class="fa-solid fa-star text-[10px]"></i>
            <span style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">{{ plan() }}</span>
          </a>
          <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md" style="background:var(--glass-bg-subtle);">
            <i class="fa-solid fa-cube text-[10px]" style="color:var(--color-primary-400);"></i>
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span style="font-size:9px;color:var(--color-text-tertiary);text-transform:uppercase;">{{ 'shell.apps' | translate }}</span>
                <span style="font-size:9px;font-weight:700;color:var(--color-text-primary);">{{ appsUsed() }}/{{ appsLimit() }}</span>
              </div>
              <div class="w-14 h-0.5 rounded-full overflow-hidden" style="background:var(--glass-border);">
                <div class="h-full rounded-full" [style.width.%]="appsPercent()" style="background:var(--color-primary-500);"></div>
              </div>
            </div>
          </div>
          <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md" style="background:var(--glass-bg-subtle);">
            <i class="fa-solid fa-server text-[10px]" style="color:var(--color-success);"></i>
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span style="font-size:9px;color:var(--color-text-tertiary);text-transform:uppercase;">{{ 'shell.srv' | translate }}</span>
                <span style="font-size:9px;font-weight:700;color:var(--color-text-primary);">{{ serversUsed() }}/{{ serversLimit() }}</span>
              </div>
              <div class="w-14 h-0.5 rounded-full overflow-hidden" style="background:var(--glass-border);">
                <div class="h-full rounded-full" [style.width.%]="serversPercent()" style="background:var(--color-success);"></div>
              </div>
            </div>
          </div>
          <app-language-selector />
          <app-theme-toggle />
          <div class="flex items-center gap-2">
            <a routerLink="/settings" class="flex items-center gap-2 p-1.5 rounded-lg" [title]="authUser()?.email ?? ''" [attr.aria-label]="'shell.userMenu' | translate">
              @if (photoUrl()) {
                <img [src]="photoUrl()!" class="w-8 h-8 rounded-full object-cover" alt="" />
              } @else {
                <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6);">
                  <span class="text-xs font-bold text-white">{{ initial() }}</span>
                </div>
              }
            </a>
            <button class="p-1.5 rounded-lg" [title]="'shell.logout' | translate" (click)="logout()">
              <i class="fa-solid fa-arrow-right-from-bracket text-xs" style="color:var(--color-text-tertiary);"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="fixed top-16 bottom-0 left-0 z-40 w-64 flex flex-col">
      <nav class="flex flex-col flex-1 sidebar-scroll sidebar-shell overflow-y-auto">
        <div style="padding:16px 12px; border-bottom:1px solid var(--glass-border-subtle);">
          @if (appContext(); as app) {
            <!-- In an application's own context: this header names the application,
                 not the team — a back arrow is the way out, same as Vercel's own
                 project sidebar reads "‹ project-name" instead of the team switcher. -->
            <a routerLink="/dashboard" class="flex items-center gap-2 px-1 group" [title]="'shell.backToOverview' | translate">
              <i class="fa-solid fa-chevron-left text-xs" style="color:var(--color-text-tertiary);"></i>
              <i class="fa-solid fa-cube text-xs" style="color:var(--color-primary-400);"></i>
              <span class="truncate text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">{{ app.name }}</span>
            </a>
          } @else {
            <div class="flex items-center gap-2 px-1">
              <i class="fa-solid fa-users-rectangle" style="color:var(--color-primary-400);"></i>
              <span class="text-sm font-semibold text-white">{{ me()?.team?.name ?? ('shell.myTeam' | translate) }}</span>
            </div>
          }
        </div>
        <ul role="list" class="flex flex-col flex-1 px-3 py-5 gap-y-0.5">
          @for (section of topNav(); track section.title || 'main') {
            @if (section.title) {
              <li style="padding-top:20px; padding-bottom:5px;"><span class="sbi-section">{{ section.title! | translate }}</span></li>
            }
            @for (item of section.items; track item.path) {
              <li>
                <a class="sbi" [routerLink]="item.path" routerLinkActive="active"
                   [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' || item.path === appOverviewPath() }">
                  <i class="sbi-icon" [class]="item.icon"></i>
                  <span>{{ item.label | translate }}</span>
                </a>
              </li>
            }
          }
          @if (isInstanceAdmin()) {
            <li style="padding-top:20px; padding-bottom:5px;"><span class="sbi-section">{{ 'shell.nav.sectionAdmin' | translate }}</span></li>
            <li>
              <a class="sbi" routerLink="/admin" routerLinkActive="active">
                <i class="sbi-icon fa-solid fa-shield-halved"></i>
                <span>{{ 'shell.nav.admin' | translate }}</span>
              </a>
            </li>
          }
          <li>
            <div class="sbi-disabled" style="justify-content:space-between;">
              <div class="flex items-center gap-3">
                <i class="fa-solid fa-wand-magic-sparkles" style="width:18px;text-align:center;"></i>
                <span>{{ 'shell.aiSmartDeploy' | translate }}</span>
              </div>
              <span class="sbi-badge-soon">{{ 'shell.soon' | translate }}</span>
            </div>
          </li>

          <!-- Always the account's own — never scoped to whichever application is open. -->
          <li style="padding-top:20px; padding-bottom:5px;"><span class="sbi-section">{{ 'shell.nav.sectionConfiguration' | translate }}</span></li>
          @for (item of bottomNav; track item.path) {
            <li>
              <a class="sbi" [routerLink]="item.path" routerLinkActive="active">
                <i class="sbi-icon" [class]="item.icon"></i>
                <span>{{ item.label | translate }}</span>
              </a>
            </li>
          }
        </ul>
      </nav>
    </div>

    <main class="pl-64 pt-16">
      <div class="p-4 sm:px-6 lg:px-8 lg:py-6">
        <router-outlet />
      </div>
    </main>
  `,
})
export class ShellComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly authUser = toSignal(this.auth.user$, { initialValue: null });
  /** Kept in step with INSTANCE_ADMIN_ROLES in the API and the route guard. */
  protected isInstanceAdmin(): boolean {
    const role = this.me()?.idemRole?.toLowerCase();
    return role === 'admin' || role === 'owner' || role === 'root' || role === 'superadmin';
  }

  protected readonly me = signal<{ name: string; email: string; photoUrl: string | null; idemRole: string | null; team: { id: number; name: string } | null } | null>(null);
  protected readonly plan = signal('free');
  protected readonly appsUsed = signal(0);
  protected readonly appsLimit = signal(0);
  protected readonly serversUsed = signal(0);
  protected readonly serversLimit = signal(0);

  /** Which application's own nav (if any) the sidebar's top section is currently showing. */
  protected readonly appContext = signal<{ uuid: string; name: string } | null>(null);

  protected readonly globalNav: NavSection[] = [
    { items: [{ path: '/dashboard', label: 'shell.nav.dashboard', icon: 'fa-solid fa-house' }] },
    {
      title: 'shell.nav.sectionDeploy',
      items: [
        { path: '/workspaces', label: 'shell.nav.workspaces', icon: 'fa-solid fa-layer-group' },
        { path: '/templates', label: 'shell.nav.templates', icon: 'fa-solid fa-wand-magic-sparkles' },
      ],
    },
    {
      title: 'shell.nav.sectionResources',
      items: [
        { path: '/servers', label: 'shell.nav.servers', icon: 'fa-solid fa-server' },
        { path: '/applications', label: 'shell.nav.applications', icon: 'fa-solid fa-cube' },
        { path: '/databases', label: 'shell.nav.databases', icon: 'fa-solid fa-database' },
        { path: '/services', label: 'shell.nav.services', icon: 'fa-solid fa-cubes' },
        { path: '/sources', label: 'shell.nav.sources', icon: 'fa-brands fa-git-alt' },
        { path: '/destinations', label: 'shell.nav.destinations', icon: 'fa-solid fa-network-wired' },
        { path: '/storages', label: 'shell.nav.storages', icon: 'fa-solid fa-box-archive' },
        { path: '/tags', label: 'shell.nav.tags', icon: 'fa-solid fa-tags' },
      ],
    },
  ];

  /** Unconditionally account-wide — the "bottom" half the top section never touches. */
  protected readonly bottomNav: NavItem[] = [
    { path: '/settings', label: 'shell.nav.settings', icon: 'fa-solid fa-gear' },
    { path: '/shared-variables', label: 'shell.nav.sharedVariables', icon: 'fa-solid fa-code' },
    { path: '/notifications', label: 'shell.nav.notifications', icon: 'fa-regular fa-bell' },
    { path: '/security/keys', label: 'shell.nav.sshKeys', icon: 'fa-solid fa-key' },
    { path: '/security/tokens', label: 'shell.nav.apiTokens', icon: 'fa-solid fa-id-badge' },
    { path: '/team', label: 'shell.nav.team', icon: 'fa-solid fa-users' },
  ];

  protected readonly topNav = computed<NavSection[]>(() => {
    const app = this.appContext();
    return app ? appNav(app.uuid) : this.globalNav;
  });

  /** The one app-nav item (Overview) that needs exact matching — every sub-page's path is also its prefix. */
  protected readonly appOverviewPath = computed(() => {
    const app = this.appContext();
    return app ? `/applications/${app.uuid}` : null;
  });

  protected photoUrl(): string | null {
    return this.authUser()?.photoURL ?? this.me()?.photoUrl ?? null;
  }
  protected initial(): string {
    const name = this.authUser()?.displayName || this.authUser()?.email || this.me()?.name || 'U';
    return name.charAt(0).toUpperCase();
  }
  protected appsPercent(): number {
    const l = this.appsLimit();
    return l ? Math.min(100, Math.round((this.appsUsed() / l) * 100)) : 0;
  }
  protected serversPercent(): number {
    const l = this.serversLimit();
    return l ? Math.min(100, Math.round((this.serversUsed() / l) * 100)) : 0;
  }
  protected logout(): void {
    void this.auth.logout();
  }

  ngOnInit(): void {
    this.api.me().subscribe((m) => this.me.set(m));
    this.api.getSubscription().subscribe((s) => {
      this.plan.set(s.plan);
      this.appsLimit.set(s.appLimit);
      this.serversLimit.set(s.serverLimit);
    });
    this.api.getQuota().subscribe((q) => {
      this.appsUsed.set(q.apps.used);
      this.serversUsed.set(q.servers.used);
      this.appsLimit.set(q.apps.limit);
      this.serversLimit.set(q.servers.limit);
    });

    this.syncAppContext(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.syncAppContext((e as NavigationEnd).urlAfterRedirects);
    });
  }

  /** Switch the sidebar's top section in or out of an application's own nav, based on the URL alone. */
  private syncAppContext(url: string): void {
    const match = APP_ROUTE.exec(url);
    const uuid = match?.[1];
    if (!uuid) {
      if (this.appContext()) this.appContext.set(null);
      return;
    }
    if (this.appContext()?.uuid === uuid) return; // Already showing this application's nav.
    this.appContext.set({ uuid, name: uuid }); // Placeholder while the real name loads.
    this.api.getApplication(uuid).subscribe({
      next: (app) => {
        if (this.appContext()?.uuid === uuid) this.appContext.set({ uuid, name: app.name });
      },
      error: () => {
        // Not this team's application (or it was deleted) — fall back to the global nav
        // rather than pin the sidebar to a name that will never resolve.
        if (this.appContext()?.uuid === uuid) this.appContext.set(null);
      },
    });
  }
}
