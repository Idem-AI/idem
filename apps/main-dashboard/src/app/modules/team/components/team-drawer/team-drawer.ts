import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

let nextDrawerId = 0;

/**
 * Le tiroir latéral de l'équipe : inviter, régler les accès d'une personne,
 * composer un groupe. On reste sur la page — la liste reste visible derrière,
 * on voit ce qu'on modifie — et le geste tient dans un seul panneau, avec ses
 * boutons toujours en bas, à portée de pouce sur téléphone.
 *
 * Échap ou un clic sur le voile ferment ; le focus entre dans le panneau à
 * l'ouverture.
 */
@Component({
  selector: 'app-team-drawer',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styles: `
    .td-veil {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      justify-content: flex-end;
      background: color-mix(in oklab, black 55%, transparent);
      animation: td-fade 0.18s ease-out;
    }
    .td-panel {
      display: flex;
      flex-direction: column;
      width: min(34rem, 100%);
      height: 100%;
      border-left: 1px solid var(--glass-border);
      animation: td-slide 0.24s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .td-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem 1.5rem 1.5rem;
    }
    .td-foot {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--glass-border);
    }
    @keyframes td-fade {
      from { opacity: 0; }
    }
    @keyframes td-slide {
      from { transform: translateX(100%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .td-veil, .td-panel { animation: none; }
    }
  `,
  template: `
    <div class="td-veil" (click)="closed.emit()">
      <section
        class="td-panel modal-drawer"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="uid + '-title'"
        tabindex="-1"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-start gap-3 border-b border-[var(--glass-border)] px-6 py-5">
          <div class="min-w-0 flex-1">
            @if (eyebrow()) {
              <p class="text-xs font-medium uppercase tracking-wide text-primary-500">{{ eyebrow() }}</p>
            }
            <h2 [id]="uid + '-title'" class="truncate text-lg font-semibold text-text-primary">{{ heading() }}</h2>
            @if (subheading()) {
              <p class="mt-0.5 truncate text-sm text-text-tertiary">{{ subheading() }}</p>
            }
          </div>
          <button type="button" class="button-icon" [attr.aria-label]="'common.close' | translate" (click)="closed.emit()">
            <i class="pi pi-times text-sm" aria-hidden="true"></i>
          </button>
        </header>
        <div class="td-body custom-scrollbar">
          <ng-content />
        </div>
        <footer class="td-foot">
          <ng-content select="[drawer-actions]" />
        </footer>
      </section>
    </div>
  `,
})
export class TeamDrawerComponent {
  readonly heading = input.required<string>();
  readonly subheading = input<string>('');
  readonly eyebrow = input<string>('');
  readonly closed = output<void>();

  protected readonly uid = `drawer-${++nextDrawerId}`;

  constructor() {
    const host = inject(ElementRef<HTMLElement>);
    afterNextRender(() => {
      const panel = (host.nativeElement as HTMLElement).querySelector<HTMLElement>('.td-panel');
      const first = panel?.querySelector<HTMLElement>('input, button:not([aria-label])');
      (first ?? panel)?.focus();
    });
  }
}
