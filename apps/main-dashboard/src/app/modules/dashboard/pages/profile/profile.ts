import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { QuotaService } from '../../../../shared/services/quota.service';
import { AuthService } from '../../../auth/services/auth.service';
import {
  QuotaInfoResponse,
  QuotaDisplayData,
  BetaRestrictions,
  QuotaStatus,
} from '../../../../shared/models/quota.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
})
export class ProfileComponent implements OnInit {
  private readonly quotaService = inject(QuotaService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  // Signals for reactive state management
  protected readonly quotaInfo = signal<QuotaInfoResponse | null>(null);
  protected readonly quotaDisplay = signal<QuotaDisplayData | null>(null);
  protected readonly isBeta = signal<boolean>(false);
  protected readonly betaRestrictions = signal<BetaRestrictions | null>(null);
  protected readonly userInfo = signal<any>(null);
  protected readonly isLoading = signal<boolean>(true);

  protected readonly QuotaStatus = QuotaStatus;

  ngOnInit(): void {
    this.loadUserData();
    this.loadQuotaData();
  }

  private loadUserData(): void {
    // Subscribe to Firebase Auth user observable
    this.authService.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (firebaseUser) => {
        if (firebaseUser) {
          // Map Firebase user to our user info format
          const userInfo = {
            name: firebaseUser.displayName || this.translate.instant('common.notSpecified'),
            email: firebaseUser.email || this.translate.instant('common.notSpecified'),
            accountType: this.translate.instant('dashboard.profile.accountTypes.free'), // Default to free, could be enhanced with backend call
            createdAt: firebaseUser.metadata.creationTime
              ? new Date(firebaseUser.metadata.creationTime)
              : new Date(),
            photoURL: firebaseUser.photoURL,
            uid: firebaseUser.uid,
            emailVerified: firebaseUser.emailVerified,
            provider: firebaseUser.providerData[0]?.providerId || 'email',
          };
          this.userInfo.set(userInfo);
        } else {
          this.userInfo.set(null);
        }
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.userInfo.set(null);
      },
    });
  }

  private loadQuotaData(): void {
    this.isLoading.set(true);

    // Load quota information
    this.quotaService
      .getQuotaInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (info: QuotaInfoResponse) => {
          this.quotaInfo.set(info);
          this.processQuotaDisplayData(info);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });

    // Load beta information
    this.quotaService
      .getBetaInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (betaInfo: any) => {
          this.isBeta.set(betaInfo.isBeta || false);
          this.betaRestrictions.set(betaInfo.restrictions || null);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

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
  }

  private getQuotaStatus(percentage: number): QuotaStatus {
    if (percentage >= 100) return QuotaStatus.EXCEEDED;
    if (percentage >= 80) return QuotaStatus.WARNING;
    return QuotaStatus.AVAILABLE;
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  }

  protected getDailyPercentage(): number {
    const quota = this.quotaInfo();
    if (!quota) return 0;
    return (quota.dailyUsage / quota.dailyLimit) * 100;
  }

  protected getWeeklyPercentage(): number {
    const quota = this.quotaInfo();
    if (!quota) return 0;
    return (quota.weeklyUsage / quota.weeklyLimit) * 100;
  }

  protected getDailyStatusClass(): string {
    const display = this.quotaDisplay();
    if (!display) return 'text-gray-400';

    switch (display.dailyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'text-red-400 font-medium';
      case QuotaStatus.WARNING:
        return 'text-yellow-400 font-medium';
      default:
        return 'text-green-400';
    }
  }

  protected getWeeklyStatusClass(): string {
    const display = this.quotaDisplay();
    if (!display) return 'text-gray-400';

    switch (display.weeklyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'text-red-400 font-medium';
      case QuotaStatus.WARNING:
        return 'text-yellow-400 font-medium';
      default:
        return 'text-green-400';
    }
  }

  protected getDailyProgressClass(): string {
    const display = this.quotaDisplay();
    if (!display) return 'bg-gray-600';

    switch (display.dailyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'bg-red-500';
      case QuotaStatus.WARNING:
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  }

  protected getWeeklyProgressClass(): string {
    const display = this.quotaDisplay();
    if (!display) return 'bg-gray-600';

    switch (display.weeklyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'bg-red-500';
      case QuotaStatus.WARNING:
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  }
}
