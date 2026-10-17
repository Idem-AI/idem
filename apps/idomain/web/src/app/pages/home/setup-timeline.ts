import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { InView } from '../../shared/in-view';

/**
 * Ce qui se passe après le paiement, montré comme le client le verra : une carte de suivi dont les
 * quatre étapes se cochent l'une après l'autre (enregistrement, adresse écrite, site relié, HTTPS).
 * C'est une vraie séquence, donc numérotée. La carte est complète au repos ; l'animation ne joue
 * qu'à son arrivée à l'écran, et jamais si le visiteur réduit les animations.
 */
@Component({
  selector: 'idm-setup-timeline',
  imports: [TranslateModule, InView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-20">
      <div>
        <h2 class="idm-section-title text-[var(--color-heading)]">
          <span class="block">{{ 'home.setup.title1' | translate }}</span>
          <span class="block"><span class="i-underline">{{ 'home.setup.title2' | translate }}</span></span>
        </h2>
        <p class="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]">{{ 'home.setup.lead' | translate }}</p>
        <p class="mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">{{ 'home.setup.leave' | translate }}</p>
      </div>

      <ol idmInView class="idm-track" [attr.aria-label]="'home.setup.label' | translate">
        @for (step of steps; track step.key; let i = $index) {
          <li class="idm-step" [style.--i]="i">
            <span class="idm-step-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.4l3 3 6-6.6" /></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">{{ i + 1 }}. {{ ('home.setup.steps.' + step.key + '.title') | translate }}</span>
              <span class="mt-0.5 block text-sm text-[var(--color-text-secondary)]">{{ ('home.setup.steps.' + step.key + '.body') | translate }}</span>
            </span>
            <span class="shrink-0 text-xs tabular-nums text-[var(--color-text-tertiary)]">{{ ('home.setup.steps.' + step.key + '.when') | translate }}</span>
          </li>
        }
      </ol>
    </div>
  `,
  styles: `
    .idm-track {
      border: 1px solid var(--glass-border);
      border-radius: 1.5rem;
      background: var(--color-surface-1);
      padding: 0.5rem;
    }
    .idm-step {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      border-radius: 1rem;
      padding: 1.125rem 1rem;
    }
    .idm-step + .idm-step {
      border-top: 1px solid var(--glass-border-subtle);
      border-radius: 0;
    }
    .idm-step-mark {
      display: grid;
      place-items: center;
      height: 1.75rem;
      width: 1.75rem;
      flex-shrink: 0;
      border-radius: 999px;
      background: var(--color-success);
      color: var(--color-surface-1);
    }
    /* À l'arrivée à l'écran : les étapes se cochent une à une, comme pendant une vraie installation. */
    .is-drawn .idm-step {
      animation: idm-step-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(var(--i) * 650ms + 200ms);
    }
    .is-drawn .idm-step-mark {
      animation: idm-mark-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(var(--i) * 650ms + 520ms);
    }
    @keyframes idm-step-in {
      from { opacity: 0.35; }
    }
    @keyframes idm-mark-in {
      from { background: var(--color-surface-3); color: transparent; transform: scale(0.85); }
    }
  `,
})
export class SetupTimeline {
  protected readonly steps = [{ key: 'paid' }, { key: 'registered' }, { key: 'connected' }, { key: 'secured' }];
}
