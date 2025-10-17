import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  QuotaStatus,
  QuotaDisplayData,
  QuotaInfoResponse,
  BetaRestrictions,
} from '../../models/quota.model';

@Component({
  selector: 'app-quota-display',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isLoading && quotaDisplay) {
    <div
      class="navbar-quota-display flex items-center space-x-2 px-2 py-1 glass rounded-2xl"
    >
      <!-- Beta badge (if applicable) -->
      @if (isBeta) {
      <span
        class="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30"
      >
        <span class="w-1 h-1 bg-orange-400 rounded-full mr-0.5"></span>BETA
      </span>
      }

      <!-- Daily quota indicator -->
      <div class="flex-grow flex items-center space-x-1 max-w-[120px]">
        <div class="relative w-full bg-gray-700 rounded-full h-1.5">
          <div
            class="h-1.5 rounded-full transition-all duration-300"
            [class]="getDailyProgressClass()"
            [style.width.%]="quotaDisplay.dailyPercentage"
          ></div>
        </div>
        <span class="sm:text-lg text-xs whitespace-nowrap text-white">Credits</span>
        <span class="sm:text-lg text-xs whitespace-nowrap" [class]="getDailyStatusClass()">
          {{ quotaInfo?.remainingDaily || 0 }}/{{ quotaInfo?.dailyLimit || 0 }}
        </span>
      </div>

      <!-- Warning icon if needed -->
      @if (quotaDisplay.dailyStatus === QuotaStatus.WARNING ||
      quotaDisplay.weeklyStatus === QuotaStatus.WARNING) {
      <svg
        class="w-4 h-4 text-yellow-400"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z"
          clip-rule="evenodd"
        ></path>
      </svg>
      } @else if (quotaDisplay.dailyStatus === QuotaStatus.EXCEEDED ||
      quotaDisplay.weeklyStatus === QuotaStatus.EXCEEDED) {
      <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        ></path>
      </svg>
      }
    </div>
    } @else if (isLoading) {
    <div
      class="navbar-quota-display flex items-center space-x-2 px-2 py-1 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700"
    >
      <div class="animate-pulse flex-grow">
        <div class="h-1.5 bg-gray-700 rounded w-full"></div>
      </div>
      <div class="animate-pulse">
        <div class="h-3 w-8 bg-gray-700 rounded"></div>
      </div>
    </div>
    }
  `,
})
export class QuotaDisplayComponent {
  @Input() quotaInfo: QuotaInfoResponse | null = null;
  @Input() quotaDisplay: QuotaDisplayData | null = null;
  @Input() isBeta: boolean = false;
  @Input() betaRestrictions: BetaRestrictions | null = null;
  @Input() isLoading: boolean = true;

  protected readonly QuotaStatus = QuotaStatus;

  protected getDailyStatusClass(): string {
    if (!this.quotaDisplay) return 'text-gray-400';

    switch (this.quotaDisplay.dailyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'text-red-400 font-medium';
      case QuotaStatus.WARNING:
        return 'text-yellow-400 font-medium';
      default:
        return 'text-green-400';
    }
  }

  protected getWeeklyStatusClass(): string {
    if (!this.quotaDisplay) return 'text-gray-400';

    switch (this.quotaDisplay.weeklyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'text-red-400 font-medium';
      case QuotaStatus.WARNING:
        return 'text-yellow-400 font-medium';
      default:
        return 'text-green-400';
    }
  }

  protected getDailyProgressClass(): string {
    if (!this.quotaDisplay) return 'bg-gray-600';

    switch (this.quotaDisplay.dailyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'bg-red-500';
      case QuotaStatus.WARNING:
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  }

  protected getWeeklyProgressClass(): string {
    if (!this.quotaDisplay) return 'bg-gray-600';

    switch (this.quotaDisplay.weeklyStatus) {
      case QuotaStatus.EXCEEDED:
        return 'bg-red-500';
      case QuotaStatus.WARNING:
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  }
}
