import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe, LowerCasePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FirewallTrafficBucket } from '../../../shared/models/ideploy.models';

/**
 * Incoming requests over time, allowed and blocked, stacked per interval on
 * one axis. Blocked sits on top in the danger color so even a thin slice of
 * refused traffic stands out against the allowed volume. A legend names both
 * series, hovering a bar gives its exact numbers, and the same figures are in
 * a table for screen readers.
 */
@Component({
  selector: 'app-traffic-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, LowerCasePipe, TranslateModule],
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-4 text-xs" style="color:var(--color-text-secondary);">
      <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm" style="background:var(--color-primary);"></span>{{ 'security.app.trafficAllowed' | translate }}</span>
      <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm" style="background:var(--color-danger);"></span>{{ 'security.app.trafficBlocked' | translate }}</span>
      @if (hovered(); as h) {
        <span class="ml-auto" style="color:var(--color-text-primary);font-variant-numeric:tabular-nums;" aria-live="polite">
          {{ h.at | date: 'short' }} · {{ h.allowed | number }} {{ 'security.app.trafficAllowed' | translate | lowercase }} · {{ h.blocked | number }} {{ 'security.app.trafficBlocked' | translate | lowercase }}
        </span>
      }
    </div>
    @if (buckets().length === 0) {
      <p class="py-8 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'security.app.noTraffic' | translate }}</p>
    } @else {
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="block w-full" style="height:160px;" preserveAspectRatio="none" role="img" [attr.aria-label]="'security.app.trafficChart' | translate">
        <!-- recessive baseline -->
        <line x1="0" [attr.y1]="height" [attr.x2]="width" [attr.y2]="height" stroke="var(--color-surface-2)" stroke-width="1" />
        @for (b of bars(); track b.at) {
          <g (mouseenter)="hovered.set(b)" (mouseleave)="hovered.set(null)">
            <!-- hit target: the full column, wider than the mark -->
            <rect [attr.x]="b.x" y="0" [attr.width]="b.w" [attr.height]="height" fill="transparent" />
            @if (b.allowedH > 0) {
              <rect [attr.x]="b.x + 1" [attr.y]="height - b.allowedH" [attr.width]="b.w - 2" [attr.height]="b.allowedH" rx="1.5" fill="var(--color-primary)" [attr.opacity]="hovered() && hovered() !== b ? 0.45 : 0.85" />
            }
            @if (b.blockedH > 0) {
              <!-- 2px surface gap between the stacked segments -->
              <rect [attr.x]="b.x + 1" [attr.y]="height - b.allowedH - b.blockedH - (b.allowedH > 0 ? 2 : 0)" [attr.width]="b.w - 2" [attr.height]="b.blockedH" rx="1.5" fill="var(--color-danger)" [attr.opacity]="hovered() && hovered() !== b ? 0.5 : 1" />
            }
          </g>
        }
      </svg>
      <div class="mt-1 flex justify-between text-[10px]" style="color:var(--color-text-tertiary);">
        <span>{{ buckets()[0].at | date: 'short' }}</span>
        <span>{{ buckets()[buckets().length - 1].at | date: 'short' }}</span>
      </div>
      <table class="sr-only">
        <caption>{{ 'security.app.trafficChart' | translate }}</caption>
        <thead><tr><th scope="col">{{ 'security.app.trafficTime' | translate }}</th><th scope="col">{{ 'security.app.trafficAllowed' | translate }}</th><th scope="col">{{ 'security.app.trafficBlocked' | translate }}</th></tr></thead>
        <tbody>
          @for (b of buckets(); track b.at) {
            <tr><td>{{ b.at | date: 'short' }}</td><td>{{ b.allowed }}</td><td>{{ b.blocked }}</td></tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class TrafficChartComponent {
  readonly buckets = input<FirewallTrafficBucket[]>([]);

  protected readonly width = 600;
  protected readonly height = 150;
  protected readonly hovered = signal<(FirewallTrafficBucket & { x: number }) | null>(null);

  protected readonly bars = computed(() => {
    const data = this.buckets();
    if (data.length === 0) return [];
    const max = Math.max(1, ...data.map((b) => b.allowed + b.blocked));
    const w = this.width / data.length;
    // Leave room for the 2px gap so the stack never overflows the plot.
    const scale = (this.height - 2) / max;
    return data.map((b, i) => ({
      ...b,
      x: i * w,
      w: Math.max(w, 2),
      allowedH: b.allowed > 0 ? Math.max(b.allowed * scale, 1) : 0,
      blockedH: b.blocked > 0 ? Math.max(b.blocked * scale, 2) : 0,
    }));
  });
}
