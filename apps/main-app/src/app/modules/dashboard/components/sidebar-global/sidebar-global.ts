import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../auth/services/auth.service';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BetaBadgeComponent } from '../../../../shared/components/beta-badge/beta-badge';
import { QuotaDisplayComponent } from '../../../../shared/components/quota-display/quota-display';
import { QuotaService } from '../../../../shared/services/quota.service';
import {
  QuotaInfoResponse,
  QuotaDisplayData,
  BetaRestrictions,
  QuotaStatus,
} from '../../../../shared/models/quota.model';

@Component({
  selector: 'app-sidebar-global',
  templateUrl: './sidebar-global.html',
  styleUrls: ['./sidebar-global.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, BetaBadgeComponent, QuotaDisplayComponent],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)' }),
        animate('300ms ease-in', style({ transform: 'translateY(0%)' })),
      ]),
      transition(':leave', [animate('300ms ease-out', style({ transform: 'translateY(-100%)' }))]),
    ]),
    trigger('mobileDrawerSlide', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate(
          '350ms cubic-bezier(0.25, 0.8, 0.25, 1)',
          style({ transform: 'translateX(0%)', opacity: 1 })
        ),
      ]),
      transition(':leave', [
        style({ transform: 'translateX(0%)', opacity: 1 }),
        animate(
          '300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ transform: 'translateX(-100%)', opacity: 0 })
        ),
      ]),
    ]),
    trigger('backdropFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('200ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('sidebarExpand', [
      state(
        'expanded',
        style({
          width: '260px',
        })
      ),
      state(
        'collapsed',
        style({
          width: '80px',
        })
      ),
      transition('expanded <=> collapsed', [animate('300ms ease-in-out')]),
    ]),
    trigger('fadeInOut', [
      state('visible', style({ opacity: 1 })),
      state('hidden', style({ opacity: 0, display: 'none' })),
      transition('visible <=> hidden', [animate('200ms ease-in-out')]),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarGlobal {
  // Services
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly quotaService = inject(QuotaService);
  private readonly destroyRef = inject(DestroyRef);

  // Navigation items for global dashboard
  protected readonly navigationItems = signal([
    {
      label: 'Dashboard',
      icon: 'pi pi-th-large',
      route: '/console',
      isActive: false,
    },
    {
      label: 'Projects',
      icon: 'pi pi-folder',
      route: '/console/projects',
      isActive: false,
    },
    {
      label: 'Teams',
      icon: 'pi pi-users',
      route: '/console/teams',
      isActive: false,
    },
  ]);

  // Signals for UI State
  protected readonly isDropdownOpen = signal(false);
  protected readonly isSidebarCollapsed = signal(false);
  protected readonly isMobileDrawerOpen = signal(false);
  protected readonly currentRoute = signal<string>('');

  // Quota Signals
  protected readonly quotaInfo = signal<QuotaInfoResponse | null>(null);
  protected readonly quotaDisplay = signal<QuotaDisplayData | null>(null);
  protected readonly isBeta = signal<boolean>(false);
  protected readonly betaRestrictions = signal<BetaRestrictions | null>(null);
  protected readonly isQuotaLoading = signal<boolean>(true);

  // Computed values
  protected readonly sidebarState = computed(() =>
    this.isSidebarCollapsed() ? 'collapsed' : 'expanded'
  );

  protected readonly textVisibility = computed(() =>
    this.isSidebarCollapsed() ? 'hidden' : 'visible'
  );

  // Output event
  @Output() sidebarCollapsedChange = new EventEmitter<boolean>();

  // User data
  protected readonly user = toSignal(this.auth.user$);

  constructor() {
    // Initialize sidebar collapsed state from localStorage
    const savedSidebarState = localStorage.getItem('globalSidebarCollapsed');
    if (savedSidebarState) {
      this.isSidebarCollapsed.set(savedSidebarState === 'true');
    }

    // Track current route
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute.set(event.urlAfterRedirects);
        this.updateActiveStates();
      }
    });

    // Load quota info
    this.loadQuotaInfo();
  }

  /**
   * Loads quota information
   */
  private loadQuotaInfo(): void {
    this.isQuotaLoading.set(true);

    this.quotaService
      .getQuotaInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (info: QuotaInfoResponse) => {
          this.quotaInfo.set(info);
          this.isBeta.set(info.isBeta || false);
          this.processQuotaDisplayData(info);
          this.isQuotaLoading.set(false);
        },
        error: (error) => {
          console.warn('Failed to load quota info:', error);
          this.quotaInfo.set(null);
          this.isBeta.set(false);
          this.quotaDisplay.set(null);
          this.isQuotaLoading.set(false);
        },
      });
  }

  /**
   * Processes quota info into display data
   */
  private processQuotaDisplayData(info: QuotaInfoResponse): void {
    if (!info) return;

    const dailyPercentage = (info.dailyUsage / info.dailyLimit) * 100;
    const weeklyPercentage = (info.weeklyUsage / info.weeklyLimit) * 100;

    const displayData: QuotaDisplayData = {
      dailyPercentage,
      weeklyPercentage,
      dailyStatus: this.getQuotaStatus(dailyPercentage),
      weeklyStatus: this.getQuotaStatus(weeklyPercentage),
      canUseFeature: info.remainingDaily > 0 && info.remainingWeekly > 0,
    };

    this.quotaDisplay.set(displayData);

    if (info.isBeta) {
      this.betaRestrictions.set({
        maxStyles: 3,
        maxResolution: '1024x1024',
        maxOutputTokens: 2000,
        restrictedPrompts: [],
        allowedFeatures: ['basic'],
      });
    }
  }

  /**
   * Determines quota status based on percentage
   */
  private getQuotaStatus(percentage: number): QuotaStatus {
    if (percentage >= 100) return QuotaStatus.EXCEEDED;
    if (percentage >= 80) return QuotaStatus.WARNING;
    return QuotaStatus.AVAILABLE;
  }

  /**
   * Updates active states for navigation items
   */
  private updateActiveStates(): void {
    const currentPath = this.currentRoute();
    const items = this.navigationItems();

    const updatedItems = items.map((item) => ({
      ...item,
      isActive: currentPath === item.route || currentPath.startsWith(item.route + '/'),
    }));

    this.navigationItems.set(updatedItems);
  }

  toggleMobileDrawer() {
    this.isMobileDrawerOpen.update((open) => !open);
    if (this.isMobileDrawerOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  toggleDropdown() {
    this.isDropdownOpen.update((open) => !open);
  }

  navigateTo(path: string) {
    this.isDropdownOpen.set(false);
    this.isMobileDrawerOpen.set(false);
    const url = path.startsWith('/') ? path : `/${path}`;
    this.router.navigateByUrl(url);
  }

  logout() {
    this.isDropdownOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Toggles the sidebar between expanded and collapsed states
   */
  toggleSidebar() {
    this.isSidebarCollapsed.update((collapsed) => !collapsed);
    localStorage.setItem('globalSidebarCollapsed', String(this.isSidebarCollapsed()));
    this.sidebarCollapsedChange.emit(this.isSidebarCollapsed());
  }
}
