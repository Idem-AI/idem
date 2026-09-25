import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';
import { environment } from '../../../environments/environment';

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
        { path: base, label: 'shell.nav.appOverview', icon: 'pi pi-gauge' },
        { path: `${base}/deployments`, label: 'shell.nav.appDeployments', icon: 'pi pi-send' },
        { path: `${base}/pipeline`, label: 'shell.nav.appPipeline', icon: 'pi pi-sitemap' },
        { path: `${base}/security`, label: 'shell.nav.appFirewall', icon: 'pi pi-shield' },
        { path: `${base}/insights`, label: 'shell.nav.appInsights', icon: 'pi pi-chart-line' },
        { path: `${base}/terminal`, label: 'shell.nav.appTerminal', icon: 'pi pi-code' },
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
  host: { '(document:click)': 'userMenuOpen.set(false)' },
  template: `
    <div class="fixed top-0 left-0 right-0 z-50 h-16 glass" style="border:0;border-bottom:1px solid var(--glass-border-subtle);">
      <div class="flex items-center justify-between h-16 px-6">
        <a routerLink="/dashboard" class="flex items-center shrink-0">
          <img src="/assets/logos/Ideploy%20logo%20light.png" alt="iDeploy" class="h-7 w-auto dark:hidden" />
          <img src="/assets/logos/Ideploy%20logo%20dark.png" alt="" aria-hidden="true" class="h-7 w-auto hidden dark:block" />
        </a>

        <div class="flex items-center gap-3">
          @if (isInstanceAdmin()) {
            <!-- The badge doubles as the way in: it was previously inert. -->
            <a routerLink="/admin"
               class="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:opacity-80"
               style="background:color-mix(in srgb, var(--color-danger) 12%, transparent);color:var(--color-danger);border:1px solid color-mix(in srgb, var(--color-danger) 28%, transparent);">
              <i class="pi pi-shield text-xs"></i>
              <span style="font-size:11px;font-weight:700;letter-spacing:.05em;">{{ 'shell.admin' | translate }}</span>
            </a>
          }
          <a routerLink="/subscription"
             data-tour="ideploy-plan"
             class="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:opacity-80"
             style="background:color-mix(in srgb, var(--color-primary-500) 12%, transparent);color:var(--color-primary-400);border:1px solid color-mix(in srgb, var(--color-primary-500) 28%, transparent);">
            <i class="pi pi-star text-[10px]"></i>
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;">{{ plan() }}</span>
          </a>
          <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md" style="background:var(--glass-bg-subtle);">
            <i class="pi pi-box text-[10px]" style="color:var(--color-primary-400);"></i>
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
            <i class="pi pi-server text-[10px]" style="color:var(--color-success);"></i>
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
          <!-- Everything that belongs to the person — profile, display settings,
               sign-out — lives behind their avatar, so the bar carries status and
               nothing else. -->
          <div class="relative">
            <button type="button" class="flex items-center rounded-full"
                    [attr.aria-expanded]="userMenuOpen()"
                    [attr.aria-label]="'shell.userMenu' | translate"
                    [title]="authUser()?.email ?? ''"
                    (click)="toggleUserMenu($event)">
              @if (photoUrl()) {
                <img [src]="photoUrl()!" class="w-8 h-8 rounded-full object-cover" alt=""
                     style="border:1px solid var(--glass-border);" />
              } @else {
                <span class="w-8 h-8 rounded-full flex items-center justify-center gradient-primary text-xs font-bold text-white">{{ initial() }}</span>
              }
            </button>

            @if (userMenuOpen()) {
              <div class="absolute right-0 mt-3 w-64 overflow-hidden modal-panel" (click)="$event.stopPropagation()">
                <div class="px-4 py-3" style="border-bottom:1px solid var(--glass-border-subtle);">
                  <p class="text-sm font-bold truncate">{{ me()?.name || authUser()?.email }}</p>
                  <p class="font-mono text-xs truncate" style="color:var(--color-text-tertiary);">{{ authUser()?.email }}</p>
                </div>

                <a [href]="profileUrl" class="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold"
                   style="color:var(--color-text-secondary);">
                  <i class="pi pi-user text-sm"></i>{{ 'shell.profile' | translate }}
                </a>
                <a routerLink="/settings" class="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold"
                   style="color:var(--color-text-secondary);" (click)="userMenuOpen.set(false)">
                  <i class="pi pi-cog text-sm"></i>{{ 'shell.nav.settings' | translate }}
                </a>

                <div class="px-4 py-3 flex flex-col gap-2" style="border-top:1px solid var(--glass-border-subtle);">
                  <span class="text-[10px] font-bold uppercase" style="color:var(--color-text-tertiary);">{{ 'shell.display' | translate }}</span>
                  <div class="flex items-center gap-2">
                    <app-language-selector />
                    <app-theme-toggle />
                  </div>
                </div>

                <button type="button" class="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm font-semibold"
                        style="color:var(--color-danger);border-top:1px solid var(--glass-border-subtle);"
                        (click)="logout()">
                  <i class="pi pi-sign-out text-sm"></i>{{ 'shell.logout' | translate }}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <aside class="fixed top-16 bottom-0 left-0 z-40 w-64 flex flex-col glass"
           style="border:0;border-right:1px solid var(--glass-border);">
      <nav class="flex flex-col flex-1 custom-scrollbar overflow-y-auto">
        <div style="padding:16px 12px; border-bottom:1px solid var(--glass-border-subtle);">
          @if (appContext(); as app) {
            <!-- In an application's own context: this header names the application,
                 not the team — a back arrow is the way out, same as Vercel's own
                 project sidebar reads "‹ project-name" instead of the team switcher. -->
            <a routerLink="/dashboard" class="flex items-center gap-2 px-1 group" [title]="'shell.backToOverview' | translate">
              <i class="pi pi-chevron-left text-xs" style="color:var(--color-text-tertiary);"></i>
              <i class="pi pi-box text-xs" style="color:var(--color-primary-400);"></i>
              <span class="truncate text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">{{ app.name }}</span>
            </a>
          } @else {
            <div class="flex items-center gap-2 px-1">
              <i class="pi pi-users" style="color:var(--color-primary-400);"></i>
              <span class="text-sm font-semibold text-white">{{ me()?.team?.name ?? ('shell.myTeam' | translate) }}</span>
            </div>
          }
        </div>
        <ul role="list" class="flex flex-col flex-1 px-3 py-5 gap-y-0.5">
          @for (section of topNav(); track section.title || 'main') {
            @if (section.title) {
              <li style="padding-top:20px; padding-bottom:5px;"><span class="block px-3 text-[10px] font-bold uppercase" style="color:color-mix(in srgb, var(--color-text-tertiary) 65%, transparent);">{{ section.title! | translate }}</span></li>
            }
            @for (item of section.items; track item.path) {
              <li>
                <a [routerLink]="item.path" routerLinkActive="bg-primary/15 text-primary border-primary/30"
                   [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' || item.path === appOverviewPath() }"
                   class="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent text-text-secondary hover:bg-primary hover:text-white">
                  <i [class]="item.icon" class="text-lg shrink-0 w-5 text-center"></i>
                  <span class="text-sm font-medium">{{ item.label | translate }}</span>
                </a>
              </li>
            }
          }
          @if (isInstanceAdmin()) {
            <li style="padding-top:20px; padding-bottom:5px;"><span class="block px-3 text-[10px] font-bold uppercase" style="color:color-mix(in srgb, var(--color-text-tertiary) 65%, transparent);">{{ 'shell.nav.sectionAdmin' | translate }}</span></li>
            <li>
              <a routerLink="/admin" routerLinkActive="bg-primary/15 text-primary border-primary/30" class="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent text-text-secondary hover:bg-primary hover:text-white">
                <i class="pi pi-shield text-lg shrink-0 w-5 text-center"></i>
                <span class="text-sm font-medium">{{ 'shell.nav.admin' | translate }}</span>
              </a>
            </li>
          }
          <li>
            <div class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-not-allowed"
                 style="color:var(--color-text-disabled);">
              <div class="flex items-center gap-3">
                <i class="pi pi-sparkles text-lg shrink-0 w-5 text-center"></i>
                <span class="text-sm font-medium">{{ 'shell.aiSmartDeploy' | translate }}</span>
              </div>
              <span class="tag text-[9px] uppercase">{{ 'shell.soon' | translate }}</span>
            </div>
          </li>

          <!-- Always the account's own — never scoped to whichever application is open. -->
          <li style="padding-top:20px; padding-bottom:5px;"><span class="block px-3 text-[10px] font-bold uppercase" style="color:color-mix(in srgb, var(--color-text-tertiary) 65%, transparent);">{{ 'shell.nav.sectionConfiguration' | translate }}</span></li>
          @for (item of bottomNav; track item.path) {
            <li>
              <a [routerLink]="item.path" routerLinkActive="bg-primary/15 text-primary border-primary/30" class="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent text-text-secondary hover:bg-primary hover:text-white">
                <i [class]="item.icon" class="text-lg shrink-0 w-5 text-center"></i>
                <span class="text-sm font-medium">{{ item.label | translate }}</span>
              </a>
            </li>
          }
        </ul>
      </nav>
    </aside>

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
  protected readonly userMenuOpen = signal(false);
  /** The account lives in the central app; iDeploy links out to it. */
  protected readonly profileUrl = `${environment.services.console.url}/account/profile`;

  protected toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.update((open) => !open);
  }

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
    { items: [{ path: '/dashboard', label: 'shell.nav.dashboard', icon: 'pi pi-home' }] },
    {
      title: 'shell.nav.sectionDeploy',
      items: [
        { path: '/workspaces', label: 'shell.nav.workspaces', icon: 'pi pi-clone' },
        { path: '/templates', label: 'shell.nav.templates', icon: 'pi pi-sparkles' },
      ],
    },
    {
      title: 'shell.nav.sectionResources',
      items: [
        { path: '/servers', label: 'shell.nav.servers', icon: 'pi pi-server' },
        { path: '/applications', label: 'shell.nav.applications', icon: 'pi pi-box' },
        { path: '/databases', label: 'shell.nav.databases', icon: 'pi pi-database' },
        { path: '/services', label: 'shell.nav.services', icon: 'pi pi-th-large' },
        { path: '/sources', label: 'shell.nav.sources', icon: 'pi pi-sitemap' },
        { path: '/destinations', label: 'shell.nav.destinations', icon: 'pi pi-sitemap' },
        { path: '/storages', label: 'shell.nav.storages', icon: 'pi pi-inbox' },
        { path: '/tags', label: 'shell.nav.tags', icon: 'pi pi-tags' },
      ],
    },
  ];

  /** Unconditionally account-wide — the "bottom" half the top section never touches. */
  protected readonly bottomNav: NavItem[] = [
    { path: '/settings', label: 'shell.nav.settings', icon: 'pi pi-cog' },
    { path: '/shared-variables', label: 'shell.nav.sharedVariables', icon: 'pi pi-code' },
    { path: '/notifications', label: 'shell.nav.notifications', icon: 'pi pi-bell' },
    { path: '/security/keys', label: 'shell.nav.sshKeys', icon: 'pi pi-key' },
    { path: '/security/tokens', label: 'shell.nav.apiTokens', icon: 'pi pi-id-card' },
    { path: '/team', label: 'shell.nav.team', icon: 'pi pi-users' },
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
