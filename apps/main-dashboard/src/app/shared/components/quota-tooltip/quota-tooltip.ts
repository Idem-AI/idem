import { Component, Input, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { QuotaService } from '../../services/quota.service';

@Component({
  selector: 'app-quota-tooltip',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block group">
      <!-- Trigger element -->
      <ng-content></ng-content>

      <!-- Tooltip -->
      <div
        class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--color-surface-1)] text-text-primary text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 min-w-max"
      >
        @if (tooltipContent(); as content) {
          <div class="text-center">
            <!-- Title -->
            <div class="font-medium mb-1">{{ content.title }}</div>

            <!-- Main message -->
            <div class="text-text-secondary mb-2">{{ content.message }}</div>

            <!-- Quota information -->
            @if (content.quotaInfo) {
              <div class="border-t border-[var(--glass-border)] pt-2 space-y-1">
                <div class="flex justify-between text-xs space-x-4">
                  <span>{{ 'dashboard.dashboard.quotaWarning.daily' | translate }}</span>
                  <span [class]="content.quotaInfo.dailyStatus">
                    {{ content.quotaInfo.remainingDaily }}/{{ content.quotaInfo.dailyLimit }}
                  </span>
                </div>
                <div class="flex justify-between text-xs space-x-4">
                  <span>{{ 'dashboard.dashboard.quotaWarning.weekly' | translate }}</span>
                  <span [class]="content.quotaInfo.weeklyStatus">
                    {{ content.quotaInfo.remainingWeekly }}/{{ content.quotaInfo.weeklyLimit }}
                  </span>
                </div>
              </div>
            }

            <!-- Beta restrictions -->
            @if (content.betaRestrictions) {
              <div class="border-t border-[var(--glass-border)] pt-2 text-xs">
                <div class="text-orange-300 font-medium mb-1">
                  {{ 'dashboard.dashboard.quotaWarning.tooltip.betaLimitations' | translate }}
                </div>
                <ul class="text-left space-y-1">
                  @for (restriction of content.betaRestrictions; track restriction) {
                    <li>• {{ restriction }}</li>
                  }
                </ul>
              </div>
            }
          </div>
        }

        <!-- Tooltip arrow -->
        <div
          class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"
        ></div>
      </div>
    </div>
  `,
})
export class QuotaTooltipComponent {
  @Input() featureName: string = '';
  @Input() customMessage: string = '';

  private readonly quotaService = inject(QuotaService);
  private readonly translate = inject(TranslateService);

  // Track language changes to update computed signal
  private readonly langChange = signal<string>(this.translate.currentLang);

  constructor() {
    this.translate.onLangChange.subscribe((event) => {
      this.langChange.set(event.lang);
    });
  }

  protected readonly tooltipContent = computed(() => {
    // Establish dependency on langChange
    this.langChange();

    const quotaInfo = this.quotaService.quotaInfo();
    const quotaDisplay = this.quotaService.quotaDisplay();
    const isBeta = this.quotaService.isBeta();
    const betaRestrictions = this.quotaService.betaRestrictions();

    if (!quotaInfo) return null;

    // Determine title and main message
    let title = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.title');
    let message = this.customMessage;

    if (!message) {
      if (!quotaDisplay?.canUseFeature) {
        title = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.exceededTitle');
        message = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.exceededMessage');
      } else if (
        isBeta &&
        this.featureName &&
        !this.quotaService.isFeatureAllowedInBeta(this.featureName)
      ) {
        title = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.limitedTitle');
        message = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.limitedMessage');
      } else if (
        quotaDisplay?.dailyStatus === 'warning' ||
        quotaDisplay?.weeklyStatus === 'warning'
      ) {
        title = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.nearlyReachedTitle');
        message = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.nearlyReachedMessage');
      } else {
        message = this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.availableMessage');
      }
    }

    // Quota information with colored status
    const quotaInfoFormatted = {
      dailyLimit: quotaInfo.dailyLimit,
      remainingDaily: quotaInfo.remainingDaily,
      weeklyLimit: quotaInfo.weeklyLimit,
      remainingWeekly: quotaInfo.remainingWeekly,
      dailyStatus: this.getStatusClass(quotaDisplay?.dailyStatus || 'available'),
      weeklyStatus: this.getStatusClass(quotaDisplay?.weeklyStatus || 'available'),
    };

    // Formatted beta restrictions
    let betaRestrictionsFormatted: string[] | null = null;
    if (isBeta && betaRestrictions) {
      betaRestrictionsFormatted = [
        `${betaRestrictions.maxStyles} ` + this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.maxStyles'),
        this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.resolution') + ` ${betaRestrictions.maxResolution}`,
        `${betaRestrictions.maxOutputTokens} ` + this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.maxTokens'),
      ];

      if (this.featureName && !betaRestrictions.allowedFeatures.includes(this.featureName)) {
        betaRestrictionsFormatted.unshift(this.translate.instant('dashboard.dashboard.quotaWarning.tooltip.featureNotAuthorized'));
      }
    }

    return {
      title,
      message,
      quotaInfo: quotaInfoFormatted,
      betaRestrictions: betaRestrictionsFormatted,
    };
  });

  private getStatusClass(status: string): string {
    switch (status) {
      case 'exceeded':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      default:
        return 'text-green-400';
    }
  }
}
