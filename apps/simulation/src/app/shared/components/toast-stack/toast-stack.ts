import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'sim-toast-stack',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4">
      @for (toast of toasts(); track toast.id) {
        <div
          class="sim-rise pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border p-3 shadow-raised"
          [class]="toneClass(toast.tone)"
          role="status"
          aria-live="polite"
        >
          <span class="mt-0.5 size-2 shrink-0 rounded-full" [class]="dotClass(toast.tone)"></span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink">{{ toast.message }}</p>
            @if (toast.detail) {
              <p class="mt-0.5 text-meta text-ink-muted">{{ toast.detail }}</p>
            }
          </div>
          <button
            type="button"
            class="sim-btn sim-btn-ghost sim-btn-sm -my-1 -mr-1"
            [attr.aria-label]="'action.dismiss' | translate"
            (click)="dismiss(toast.id)"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastStack {
  private readonly service = inject(ToastService);
  protected readonly toasts = this.service.toasts;

  protected dismiss(id: number): void {
    this.service.dismiss(id);
  }

  protected toneClass(tone: string): string {
    const base = 'bg-panel-raised';
    switch (tone) {
      case 'success':
        return `${base} border-verdict-go/40`;
      case 'warning':
        return `${base} border-verdict-warn/40`;
      case 'error':
        return `${base} border-verdict-stop/40`;
      default:
        return `${base} border-line`;
    }
  }

  protected dotClass(tone: string): string {
    switch (tone) {
      case 'success':
        return 'bg-verdict-go';
      case 'warning':
        return 'bg-verdict-warn';
      case 'error':
        return 'bg-verdict-stop';
      default:
        return 'bg-verdict-info';
    }
  }
}
