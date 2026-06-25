import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from './shared/services/api.service';
import { AuthService } from './shared/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  match?: string[];
}
interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * App shell — faithful Angular port of the Laravel layout (navbar-topbar +
 * navbar-modern): a 64px top bar (logo, plan/usage badges, user menu) and a
 * 256px dark glass sidebar with Dashboard / Deploy / Resources / Configuration
 * sections, using the same icons, classes and colors.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Topbar -->
    <div class="fixed top-0 left-0 right-0 z-50 h-16 topbar-shell">
      <div class="flex items-center justify-between h-16 px-6">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-md flex items-center justify-center"
               style="background: linear-gradient(135deg, #3b82f6, #8b5cf6);">
            <span class="text-[10px] font-black text-white">ID</span>
          </div>
          <span class="text-sm font-bold text-white">iDeploy</span>
        </div>

        <div class="flex items-center gap-3">
          @if (me()?.idemRole === 'admin') {
            <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
                 style="background:rgba(255,180,171,0.12);color:#ffb4ab;border:1px solid rgba(255,180,171,0.28);">
              <i class="fa-solid fa-shield-halved text-xs"></i>
              <span style="font-size:11px;font-weight:700;letter-spacing:.05em;">ADMIN</span>
            </div>
          }

          <a routerLink="/subscription"
             class="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:opacity-80"
             style="background:rgba(37,99,235,0.12);color:#60a5fa;border:1px solid rgba(37,99,235,0.28);">
            <i class="fa-solid fa-star text-[10px]"></i>
            <span style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">{{ plan() }}</span>
          </a>

          <!-- Apps meter -->
          <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md"
               style="background:rgba(255,255,255,0.04);">
            <i class="fa-solid fa-cube text-[10px]" style="color:#60a5fa;"></i>
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span style="font-size:9px;color:#8d919a;text-transform:uppercase;">Apps</span>
                <span style="font-size:9px;font-weight:700;color:#e3e1e6;">{{ appsUsed() }}/{{ appsLimit() }}</span>
              </div>
              <div class="w-14 h-0.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1);">
                <div class="h-full rounded-full" [style.width.%]="appsPercent()" style="background:#2563eb;"></div>
              </div>
            </div>
          </div>

          <!-- Servers meter -->
          <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md"
               style="background:rgba(255,255,255,0.04);">
            <i class="fa-solid fa-server text-[10px]" style="color:#4ade80;"></i>
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span style="font-size:9px;color:#8d919a;text-transform:uppercase;">Srv</span>
                <span style="font-size:9px;font-weight:700;color:#e3e1e6;">{{ serversUsed() }}/{{ serversLimit() }}</span>
              </div>
              <div class="w-14 h-0.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1);">
                <div class="h-full rounded-full" [style.width.%]="serversPercent()" style="background:#4ade80;"></div>
              </div>
            </div>
          </div>

          <!-- User -->
          <div class="flex items-center gap-2">
            <a routerLink="/settings" class="flex items-center gap-2 p-1.5 rounded-lg" [title]="authUser()?.email ?? ''">
              @if (photoUrl()) {
                <img [src]="photoUrl()!" class="w-8 h-8 rounded-full object-cover" alt="" />
              } @else {
                <div class="w-8 h-8 rounded-full flex items-center justify-center"
                     style="background: linear-gradient(135deg, #3b82f6, #8b5cf6);">
                  <span class="text-xs font-bold text-white">{{ initial() }}</span>
                </div>
              }
            </a>
            <button class="p-1.5 rounded-lg" title="Log out" (click)="logout()">
              <i class="fa-solid fa-arrow-right-from-bracket text-xs" style="color:#8d919a;"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="fixed top-16 bottom-0 left-0 z-40 w-64 flex flex-col">
      <nav class="flex flex-col flex-1 sidebar-scroll sidebar-shell overflow-y-auto">
        <div style="padding:16px 12px; border-bottom:1px solid rgba(255,255,255,0.06);">
          <div class="flex items-center gap-2 px-1">
            <i class="fa-solid fa-users-rectangle" style="color:#60a5fa;"></i>
            <span class="text-sm font-semibold text-white">{{ me()?.team?.name ?? 'My Team' }}</span>
          </div>
        </div>

        <ul role="list" class="flex flex-col flex-1 px-3 py-5 gap-y-0.5">
          @for (section of nav; track section.title || 'main') {
            @if (section.title) {
              <li style="padding-top:20px; padding-bottom:5px;"><span class="sbi-section">{{ section.title }}</span></li>
            }
            @for (item of section.items; track item.path) {
              <li>
                <a class="sbi" [routerLink]="item.path" routerLinkActive="active"
                   [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }">
                  <i class="sbi-icon" [class]="item.icon"></i>
                  <span>{{ item.label }}</span>
                </a>
              </li>
            }
          }
          <!-- Disabled / soon -->
          <li>
            <div class="sbi-disabled" style="justify-content:space-between;">
              <div class="flex items-center gap-3">
                <i class="fa-solid fa-wand-magic-sparkles" style="width:18px;text-align:center;"></i>
                <span>AI Smart Deploy</span>
              </div>
              <span class="sbi-badge-soon">SOON</span>
            </div>
          </li>
        </ul>
      </nav>
    </div>

    <!-- Content -->
    <main class="pl-64 pt-16">
      <div class="p-4 sm:px-6 lg:px-8 lg:py-6">
        <router-outlet />
      </div>
    </main>
  `,
})
export class App implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  // Canonical identity comes from the global Idem API (like landing).
  protected readonly authUser = toSignal(this.auth.user$, { initialValue: null });
  // iDeploy-specific context (team, role) from the iDeploy API.
  protected readonly me = signal<{ name: string; email: string; photoUrl: string | null; idemRole: string | null; team: { id: number; name: string } | null } | null>(null);
  protected readonly plan = signal('free');
  protected readonly appsUsed = signal(0);
  protected readonly appsLimit = signal(0);
  protected readonly serversUsed = signal(0);
  protected readonly serversLimit = signal(0);

  protected readonly nav: NavSection[] = [
    { items: [{ path: '/dashboard', label: 'Dashboard', icon: 'fa-solid fa-house' }] },
    {
      title: 'Deploy',
      items: [{ path: '/projects', label: 'Projects', icon: 'fa-solid fa-layer-group' }],
    },
    {
      title: 'Resources',
      items: [
        { path: '/servers', label: 'Servers', icon: 'fa-solid fa-server' },
        { path: '/applications', label: 'Applications', icon: 'fa-solid fa-cube' },
        { path: '/databases', label: 'Databases', icon: 'fa-solid fa-database' },
        { path: '/services', label: 'Services', icon: 'fa-solid fa-cubes' },
        { path: '/sources', label: 'Sources', icon: 'fa-brands fa-git-alt' },
        { path: '/destinations', label: 'Destinations', icon: 'fa-solid fa-network-wired' },
        { path: '/storages', label: 'S3 Storages', icon: 'fa-solid fa-box-archive' },
        { path: '/tags', label: 'Tags', icon: 'fa-solid fa-tags' },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { path: '/settings', label: 'Settings', icon: 'fa-solid fa-gear' },
        { path: '/shared-variables', label: 'Shared Variables', icon: 'fa-solid fa-code' },
        { path: '/notifications', label: 'Notifications', icon: 'fa-regular fa-bell' },
        { path: '/security/keys', label: 'Keys & Tokens', icon: 'fa-solid fa-key' },
        { path: '/team', label: 'Team', icon: 'fa-solid fa-users' },
      ],
    },
  ];

  protected photoUrl(): string | null {
    return this.authUser()?.photoURL ?? this.me()?.photoUrl ?? null;
  }
  protected initial(): string {
    const name = this.authUser()?.displayName || this.authUser()?.email || this.me()?.name || 'U';
    return name.charAt(0).toUpperCase();
  }
  protected logout(): void {
    void this.auth.logout();
  }
  protected appsPercent(): number {
    const l = this.appsLimit();
    return l ? Math.min(100, Math.round((this.appsUsed() / l) * 100)) : 0;
  }
  protected serversPercent(): number {
    const l = this.serversLimit();
    return l ? Math.min(100, Math.round((this.serversUsed() / l) * 100)) : 0;
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
  }
}
