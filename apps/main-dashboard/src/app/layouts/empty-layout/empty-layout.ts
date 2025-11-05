import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BetaBadgeComponent } from '../../shared/components/beta-badge/beta-badge';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector';
import { QuotaDisplayComponent } from '../../shared/components/quota-display/quota-display';
import { AuthService } from '../../modules/auth/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuotaService } from '../../shared/services/quota.service';
import {
  QuotaInfoResponse,
  QuotaDisplayData,
  BetaRestrictions,
  QuotaStatus,
} from '../../shared/models/quota.model';

@Component({
  selector: 'app-empty-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    RouterLink,
    BetaBadgeComponent,
    QuotaDisplayComponent,
    LanguageSelectorComponent,
  ],
  templateUrl: './empty-layout.html',
  styleUrl: './empty-layout.css',
})
export class EmptyLayout implements OnInit {
  // Services
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly quotaService = inject(QuotaService);
  private readonly destroyRef = inject(DestroyRef);

  // UI State Signals
  protected readonly isMobileDrawerOpen = signal(false);
  protected readonly isDropdownOpen = signal(false);

  // Quota Signals
  protected readonly quotaInfo = signal<QuotaInfoResponse | null>(null);
  protected readonly quotaDisplay = signal<QuotaDisplayData | null>(null);
  protected readonly isBeta = signal<boolean>(false);
  protected readonly betaRestrictions = signal<BetaRestrictions | null>(null);
  protected readonly isQuotaLoading = signal<boolean>(true);

  // User Data Signal
  protected readonly user = toSignal(this.auth.user$);

  ngOnInit() {
    this.loadQuotaInfo();
  }

  /**
   * Loads quota information from the QuotaService
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
          // Set default values instead of failing
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

    // Set beta restrictions if user is in beta
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
   * Toggles mobile drawer open/closed
   */
  toggleMobileDrawer(): void {
    this.isMobileDrawerOpen.update((open) => !open);
    // Prevent body scroll when drawer is open
    if (this.isMobileDrawerOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  /**
   * Toggles user dropdown open/closed
   */
  toggleDropdown(): void {
    this.isDropdownOpen.update((open) => !open);
  }

  /**
   * Navigates to a specified path
   */
  navigateTo(path: string): void {
    this.isDropdownOpen.set(false);
    this.isMobileDrawerOpen.set(false); // Close mobile drawer on navigation
    // Normalize to absolute URL and navigate reliably
    const url = path.startsWith('/') ? path : `/${path}`;
    this.router.navigateByUrl(url);
  }

  /**
   * Logs out the user
   */
  logout(): void {
    this.isDropdownOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
