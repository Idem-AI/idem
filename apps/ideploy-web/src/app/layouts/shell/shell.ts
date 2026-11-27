import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { SharedSpaceService } from '../../shared/services/shared-space.service';
import { MeterService } from '../../shared/services/meter.service';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../shared/services/auth.service';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';
import { TourService } from '../../shared/services/tour.service';
import { environment } from '../../../environments/environment';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** A tab of the application page (`?tab=`), matched exactly with its query. */
  tab?: string;
}
interface NavSection {
  title?: string;
  /** Ancre de la visite guidée, posée sur tout le groupe. */
  tour?: string;
  items: NavItem[];
}

const APP_ROUTE = /^\/applications\/([^/?#]+)/;

/** The application-scoped nav shown while inside one app, Vercel's own project sidebar. */
function appNav(uuid: string): NavSection[] {
  const base = `/applications/${uuid}`;
  return [
    {
      items: [
        { path: base, label: 'shell.nav.appOverview', icon: 'pi pi-gauge', tab: '' },
        { path: base, label: 'shell.nav.appDomain', icon: 'pi pi-globe', tab: 'domain' },
        { path: base, label: 'shell.nav.appDeployments', icon: 'pi pi-send', tab: 'deployments' },
        { path: base, label: 'shell.nav.appFirewall', icon: 'pi pi-shield', tab: 'security' },
        { path: base, label: 'shell.nav.appInsights', icon: 'pi pi-chart-line', tab: 'insights' },
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
    DecimalPipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    LanguageSelectorComponent,
    ThemeToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'userMenuOpen.set(false)',
    '(document:keydown.escape)': 'closeOverlays()',
  },
  template: `
    <div class="fixed top-0 left-0 right-0 z-50 h-16 glass" style="border:0;border-bottom:1px solid var(--glass-border-subtle);">
      <div class="flex items-center justify-between gap-2 h-16 px-3 sm:px-6">
        <div class="flex items-center gap-1 min-w-0">
        <!-- Sous 1024 px la barre latérale devient un tiroir : ce bouton l'ouvre. -->
        <button type="button" class="button-icon lg:hidden shrink-0"
                aria-controls="ideploy-sidebar"
                [attr.aria-expanded]="navOpen()"
                [attr.aria-label]="(navOpen() ? 'shell.closeMenu' : 'shell.openMenu') | translate"
                (click)="toggleNav($event)">
          <i class="pi text-lg" [class.pi-bars]="!navOpen()" [class.pi-times]="navOpen()" aria-hidden="true"></i>
        </button>
        <a routerLink="/dashboard" class="flex items-center shrink-0">
          <img src="/assets/logos/Ideploy%20logo%20light.png" alt="iDeploy" class="h-7 w-auto dark:hidden" />
          <img src="/assets/logos/Ideploy%20logo%20dark.png" alt="" aria-hidden="true" class="h-7 w-auto hidden dark:block" />
        </a>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          @if (isInstanceAdmin()) {
            <!-- The badge doubles as the way in: it was previously inert. -->
            <a routerLink="/admin"
               [attr.aria-label]="'shell.admin' | translate"
               class="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md hover:opacity-80 shrink-0"
               style="background:color-mix(in srgb, var(--color-danger) 12%, transparent);color:var(--color-danger);border:1px solid color-mix(in srgb, var(--color-danger) 28%, transparent);">
              <i class="pi pi-shield text-xs"></i>
              <span class="hidden sm:inline" style="font-size:11px;font-weight:700;letter-spacing:.05em;">{{ 'shell.admin' | translate }}</span>
            </a>
          }
          @if (!shared.isShared()) {
          <a routerLink="/subscription"
             data-tour="ideploy-plan"
             class="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:opacity-80 min-w-0"
             style="background:color-mix(in srgb, var(--color-primary-500) 12%, transparent);color:var(--color-primary-400);border:1px solid color-mix(in srgb, var(--color-primary-500) 28%, transparent);">
            <i class="pi pi-wallet text-[10px]"></i>
            <span class="truncate" style="font-size:10px;font-weight:700;">
              @if (meters.walletXaf() !== null) {
                {{ 'meters.chip' | translate: { amount: (meters.walletXaf() | number: '1.0-0') } }}
              } @else {
                {{ 'meters.title' | translate }}
              }
            </span>
          </a>
          }
          <div class="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md" style="background:var(--glass-bg-subtle);">
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
          <div class="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md" style="background:var(--glass-bg-subtle);">
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
          <div class="relative shrink-0">
            <button type="button" class="flex items-center rounded-full"
                    data-tour="ideploy-user-menu"
                    [attr.aria-expanded]="userMenuOpen()"
                    [attr.aria-label]="'shell.userMenu' | translate"
                    [title]="authUser()?.email ?? ''"
                    (click)="toggleUserMenu($event)">
              @if (photoUrl()) {
                <img [src]="photoUrl()!" class="w-8 h-8 rounded-full object-cover" alt=""
                     style="border:1px solid var(--glass-border);" />
              } @else {
                <span class="w-8 h-8 rounded-full flex items-center justify-center gradient-primary text-xs font-bold text-text-primary">{{ initial() }}</span>
              }
            </button>

            @if (userMenuOpen()) {
              <div class="absolute right-0 mt-3 w-64 max-w-[calc(100vw-1.5rem)] overflow-hidden modal-panel" (click)="$event.stopPropagation()">
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
                <button type="button" class="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm font-semibold"
                        style="color:var(--color-text-secondary);" (click)="replayTour()">
                  <i class="pi pi-compass text-sm"></i>{{ 'shell.replayTour' | translate }}
                </button>

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

    @if (navOpen()) {
      <!-- Voile du tiroir (mobile seulement) : un toucher à côté le referme. -->
      <div class="fixed inset-0 top-16 z-30 lg:hidden" style="background:rgb(0 0 0 / .45);"
           aria-hidden="true" (click)="navOpen.set(false)"></div>
    }

    <aside id="ideploy-sidebar"
           class="fixed top-16 bottom-0 left-0 z-40 w-72 max-w-[85vw] lg:w-64 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0"
           [class.-translate-x-full]="!navOpen()"
           [class.glass]="isDesktop()"
           [class.modal-drawer]="!isDesktop()"
           [attr.inert]="!isDesktop() && !navOpen() ? '' : null"
           [attr.aria-label]="'shell.navigation' | translate"
           style="border:0;border-right:1px solid var(--glass-border);">
      <nav class="flex flex-col flex-1 custom-scrollbar overflow-y-auto">
        <div style="padding:16px 12px; border-bottom:1px solid var(--glass-border-subtle);">
          @if (appContext(); as app) {
            <!-- In an application's own context: this header names the application,
                 not the team — a back arrow is the way out, same as Vercel's own
                 project sidebar reads "‹ project-name" instead of the team switcher. -->
            <a routerLink="/dashboard" data-tour="ideploy-app-back" class="flex items-center gap-2 px-1 group" [title]="'shell.backToOverview' | translate">
              <i class="pi pi-chevron-left text-xs" style="color:var(--color-text-tertiary);"></i>
              <i class="pi pi-box text-xs" style="color:var(--color-primary-400);"></i>
              <span class="truncate text-sm font-semibold text-text-primary group-hover:text-primary-400 transition-colors">{{ app.name }}</span>
            </a>
          } @else if (shared.spaces().length > 0) {
            <!-- Projets IDEM partagés avec moi : choisir l'espace où l'on travaille. -->
            <label for="ideploy-space" class="mb-1.5 block px-1 text-[10px] font-bold uppercase text-text-tertiary">{{ 'shell.space.label' | translate }}</label>
            <select id="ideploy-space" class="!w-full" [value]="shared.activeTeamId() ?? ''" (change)="switchSpace($event)">
              <option value="">{{ 'shell.space.mine' | translate }}</option>
              @for (space of shared.spaces(); track space.projectId) {
                <option [value]="space.teamId">{{ 'shell.space.shared' | translate: { project: space.projectName, owner: space.ownerName } }}</option>
              }
            </select>
            @if (shared.active(); as space) {
              <p class="mt-2 flex items-start gap-1.5 px-1 text-xs text-text-tertiary">
                <i [class]="space.level === 'write' ? 'pi pi-pencil mt-0.5' : 'pi pi-eye mt-0.5'" aria-hidden="true"></i>
                {{ (space.level === 'write' ? 'shell.space.canEdit' : 'shell.space.canView') | translate }}
              </p>
            }
          } @else {
            <div class="flex items-center gap-2 px-1">
              <i class="pi pi-users" style="color:var(--color-primary-400);"></i>
              <span class="text-sm font-semibold text-text-primary">{{ me()?.team?.name ?? ('shell.myTeam' | translate) }}</span>
            </div>
          }
        </div>
        <ul role="list" class="flex flex-col flex-1 px-3 py-5 gap-y-0.5">
          @for (section of topNav(); track section.title || 'main') {
            <!-- Un groupe par section : la visite guidée l'éclaire d'un bloc. -->
            <li [attr.data-tour]="section.tour ?? null">
              <ul role="list" class="flex flex-col gap-y-0.5">
                @if (section.title) {
                  <li style="padding-top:20px; padding-bottom:5px;"><span class="block px-3 text-[10px] font-bold uppercase" style="color:color-mix(in srgb, var(--color-text-tertiary) 65%, transparent);">{{ section.title! | translate }}</span></li>
                }
                @for (item of section.items; track item.label) {
                  <li>
                    <a [routerLink]="item.path" [queryParams]="item.tab !== undefined ? { tab: item.tab || null } : null" routerLinkActive="bg-primary/15 text-primary border-primary/30"
                       [routerLinkActiveOptions]="item.tab !== undefined ? tabMatch : { exact: item.path === '/dashboard' || item.path === appOverviewPath() }"
                       class="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent text-text-secondary hover:bg-primary hover:text-[var(--color-on-primary)]">
                      <i [class]="item.icon" class="text-lg shrink-0 w-5 text-center"></i>
                      <span class="text-sm font-medium">{{ item.label | translate }}</span>
                    </a>
                  </li>
                }
              </ul>
            </li>
          }
          @if (isInstanceAdmin()) {
            <li style="padding-top:20px; padding-bottom:5px;"><span class="block px-3 text-[10px] font-bold uppercase" style="color:color-mix(in srgb, var(--color-text-tertiary) 65%, transparent);">{{ 'shell.nav.sectionAdmin' | translate }}</span></li>
            <li>
              <a routerLink="/admin" routerLinkActive="bg-primary/15 text-primary border-primary/30" class="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent text-text-secondary hover:bg-primary hover:text-[var(--color-on-primary)]">
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

          @if (!shared.isShared()) {
          <!-- Always the account's own — never scoped to whichever application is open. -->
          <li data-tour="ideploy-nav-configuration">
            <ul role="list" class="flex flex-col gap-y-0.5">
              <li style="padding-top:20px; padding-bottom:5px;"><span class="block px-3 text-[10px] font-bold uppercase" style="color:color-mix(in srgb, var(--color-text-tertiary) 65%, transparent);">{{ 'shell.nav.sectionConfiguration' | translate }}</span></li>
              @for (item of bottomNav; track item.path) {
                <li>
                  <a [routerLink]="item.path" routerLinkActive="bg-primary/15 text-primary border-primary/30" class="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border border-transparent text-text-secondary hover:bg-primary hover:text-[var(--color-on-primary)]">
                    <i [class]="item.icon" class="text-lg shrink-0 w-5 text-center"></i>
                    <span class="text-sm font-medium">{{ item.label | translate }}</span>
                  </a>
                </li>
              }
            </ul>
          </li>
          }
        </ul>
      </nav>
    </aside>

    <main class="pt-16 lg:pl-64 min-w-0">
      <div class="px-4 py-5 sm:px-6 lg:px-8 lg:py-6 min-w-0 max-w-full">
        <router-outlet />
      </div>
    </main>
  `,
})
export class ShellComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private tour = inject(TourService);
  protected readonly shared = inject(SharedSpaceService);

  protected readonly authUser = toSignal(this.auth.user$, { initialValue: null });
  protected readonly userMenuOpen = signal(false);
  /** The account lives in the central app; iDeploy links out to it. */
  protected readonly profileUrl = `${environment.services.console.url}/account/profile`;

  /** Tiroir de navigation, utilisé sous 1024 px (`lg`) ; au-delà la barre latérale est toujours là. */
  protected readonly navOpen = signal(false);
  private readonly desktopQuery = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null;
  protected readonly isDesktop = signal(this.desktopQuery?.matches ?? true);

  protected toggleNav(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.set(false);
    this.navOpen.update((open) => !open);
  }

  protected closeOverlays(): void {
    this.userMenuOpen.set(false);
    this.navOpen.set(false);
  }

  protected toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.navOpen.set(false);
    this.userMenuOpen.update((open) => !open);
  }

  /** Kept in step with INSTANCE_ADMIN_ROLES in the API and the route guard. */
  protected isInstanceAdmin(): boolean {
    const role = this.me()?.idemRole?.toLowerCase();
    return role === 'admin' || role === 'owner' || role === 'root' || role === 'superadmin';
  }

  protected readonly me = signal<{ name: string; email: string; photoUrl: string | null; idemRole: string | null; team: { id: number; name: string } | null } | null>(null);
  protected readonly plan = signal('free');
  protected readonly meters = inject(MeterService);
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
      tour: 'ideploy-nav-deploy',
      items: [
        { path: '/workspaces', label: 'shell.nav.workspaces', icon: 'pi pi-clone' },
        { path: '/templates', label: 'shell.nav.templates', icon: 'pi pi-sparkles' },
      ],
    },
    {
      title: 'shell.nav.sectionResources',
      tour: 'ideploy-nav-resources',
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
    if (app) return appNav(app.uuid);
    // Espace partagé : seules les applications du projet sont ouvertes.
    if (this.shared.isShared()) return [{ items: [{ path: '/applications', label: 'shell.nav.applications', icon: 'pi pi-box' }] }];
    return this.globalNav;
  });

  /** An application tab is active only on its own `?tab=`. */
  protected readonly tabMatch = { paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored' } as const;

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
  /**
   * Rejoue la visite du lieu où l'on se trouve : celle de l'application
   * ouverte, sinon celle du tableau de bord — qu'on rejoint d'abord, puisque
   * c'est là que vivent les éléments qu'elle montre.
   */
  protected replayTour(): void {
    this.userMenuOpen.set(false);
    if (this.appContext()) {
      this.tour.start('application');
      return;
    }
    void this.router.navigateByUrl('/dashboard').then(() => this.tour.start('main'));
  }

  protected logout(): void {
    void this.auth.logout();
  }

  protected switchSpace(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.shared.switchTo(value ? Number(value) : null);
  }

  ngOnInit(): void {
    this.shared.load();
    if (this.shared.isShared()) {
      // Dans l'espace d'un projet partagé, tout le reste appartient au propriétaire.
      this.keepInSharedScope(this.router.url);
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => this.keepInSharedScope((e as NavigationEnd).urlAfterRedirects));
      this.syncAppContext(this.router.url);
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
        this.syncAppContext((e as NavigationEnd).urlAfterRedirects);
        this.navOpen.set(false);
      });
      this.api.me().subscribe({ next: (m) => this.me.set(m), error: () => undefined });
      return;
    }
    this.api.me().subscribe((m) => this.me.set(m));
    // Le portefeuille IDEM paie les compteurs : son solde remplace l'ancien nom de forfait.
    this.meters.list().subscribe({ error: () => undefined });
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
      this.navOpen.set(false);
    });
    this.desktopQuery?.addEventListener('change', (q) => {
      this.isDesktop.set(q.matches);
      if (q.matches) this.navOpen.set(false);
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

  /** Un espace partagé n'ouvre que les applications : toute autre page y ramène. */
  private keepInSharedScope(url: string): void {
    if (!url.startsWith('/applications')) void this.router.navigateByUrl('/applications', { replaceUrl: true });
  }
}
