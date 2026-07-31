import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** Étapes affichées pendant la composition du modèle (clés i18n). */
const STEP_KEYS = [
  'dashboard.businessCards.empty.generate.steps.0',
  'dashboard.businessCards.empty.generate.steps.1',
  'dashboard.businessCards.empty.generate.steps.2',
  'dashboard.businessCards.empty.generate.steps.3',
];

/**
 * Maquettes de cartes affichées à droite du panneau de génération.
 *
 * Au repos : deux cartes fantômes, purement décoratives. Pendant la
 * génération : la carte se construit sous les yeux de l'utilisateur (le bloc
 * logo, puis le nom, la fonction et les lignes de contact apparaissent au fil
 * des étapes), balayée par une lumière. L'attente dure près d'une minute —
 * montrer l'objet en train de se composer la rend beaucoup moins longue qu'un
 * simple spinner.
 *
 * L'avancement est indicatif (la génération est un unique appel côté serveur,
 * sans progression réelle) : on annonce donc des ÉTAPES, jamais un pourcentage
 * qui laisserait croire à une mesure.
 */
@Component({
  selector: 'app-generation-preview',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage" [class.is-active]="active()">
      <div class="glow" aria-hidden="true"></div>

      <!-- Verso, en retrait -->
      <div class="ghost ghost--back" aria-hidden="true">
        <span class="ghost-mark"></span>
      </div>

      <!-- Recto : c'est lui qui se construit -->
      <div class="ghost ghost--front" aria-hidden="true">
        <span class="ghost-logo" [class.is-on]="active() && step() >= 0"></span>
        <span class="ghost-line ghost-line--name" [class.is-on]="active() && step() >= 1"></span>
        <span class="ghost-line ghost-line--role" [class.is-on]="active() && step() >= 1"></span>
        <span class="ghost-contact">
          <span class="ghost-line ghost-line--contact" [class.is-on]="active() && step() >= 2"></span>
          <span class="ghost-line ghost-line--contact" [class.is-on]="active() && step() >= 2"></span>
          <span class="ghost-line ghost-line--contact" [class.is-on]="active() && step() >= 3"></span>
        </span>
        <span class="sweep"></span>
      </div>
    </div>

    @if (active()) {
      <ol class="steps" aria-live="polite">
        @for (key of stepKeys; track key; let i = $index) {
          <li class="step" [class.is-done]="i < step()" [class.is-current]="i === step()">
            <span class="step-icon" aria-hidden="true">
              @if (i < step()) {
                <i class="pi pi-check"></i>
              } @else if (i === step()) {
                <i class="pi pi-spinner pi-spin"></i>
              }
            </span>
            <span>{{ key | translate }}</span>
          </li>
        }
      </ol>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .stage {
        position: relative;
        height: 15rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Halo de marque : discret au repos, il respire pendant la génération. */
      .glow {
        position: absolute;
        width: 16rem;
        height: 10rem;
        border-radius: 9999px;
        filter: blur(40px);
        opacity: 0;
        background: var(--color-primary, #1447e6);
        transition: opacity 0.6s ease;
      }
      .stage.is-active .glow {
        opacity: 0.28;
        animation: breathe 3.2s ease-in-out infinite;
      }

      .ghost {
        position: absolute;
        width: 16.25rem; /* 260px — ratio 85×55 respecté */
        height: 10.5rem;
        border-radius: 0.875rem;
        border: 1px solid var(--glass-border-medium);
        background: var(--glass-bg-light);
        overflow: hidden;
      }

      .ghost--back {
        transform: rotate(-9deg) translate(-1.75rem, -0.75rem);
        background: var(--glass-bg-subtle);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .stage.is-active .ghost--back {
        animation: drift 5s ease-in-out infinite;
      }

      .ghost-mark {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.625rem;
        border: 2px solid var(--glass-border-strong, #6b7280);
        opacity: 0.5;
      }

      .ghost--front {
        transform: rotate(5deg) translate(1.5rem, 0.75rem);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 1.25rem;
        box-shadow: 0 18px 40px -18px rgb(0 0 0 / 0.55);
        transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .stage.is-active .ghost--front {
        transform: rotate(2deg) translate(1rem, 0.25rem) scale(1.02);
      }

      /* Éléments de la carte : ils s'allument au fil des étapes. */
      .ghost-logo,
      .ghost-line {
        display: block;
        border-radius: 9999px;
        background: var(--glass-border-medium);
        opacity: 0.35;
        transition:
          opacity 0.5s ease,
          background-color 0.5s ease,
          transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .ghost-logo {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.5rem;
        margin-bottom: auto;
      }
      .ghost-line--name {
        width: 60%;
        height: 0.625rem;
      }
      .ghost-line--role {
        width: 40%;
        height: 0.4rem;
      }
      .ghost-contact {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        margin-top: 0.5rem;
      }
      .ghost-line--contact {
        width: 52%;
        height: 0.3rem;
      }
      .ghost-line--contact:nth-child(2) {
        width: 44%;
      }
      .ghost-line--contact:nth-child(3) {
        width: 60%;
      }

      .ghost-logo.is-on,
      .ghost-line.is-on {
        opacity: 1;
        background: var(--color-primary, #1447e6);
        animation: pop 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ghost-line--role.is-on,
      .ghost-line--contact.is-on {
        background: var(--glass-border-strong, #6b7280);
      }

      /* Balayage lumineux : la carte est « en cours d'impression ». */
      .sweep {
        position: absolute;
        inset: 0;
        opacity: 0;
        background: linear-gradient(
          105deg,
          transparent 35%,
          color-mix(in srgb, var(--color-primary, #1447e6) 22%, transparent) 50%,
          transparent 65%
        );
      }
      .stage.is-active .sweep {
        opacity: 1;
        animation: sweep 2.2s ease-in-out infinite;
      }

      /* Étapes */
      .steps {
        list-style: none;
        margin: 1.25rem 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        font-size: 0.8125rem;
        color: var(--color-text-tertiary);
        opacity: 0.55;
        transition:
          opacity 0.3s ease,
          color 0.3s ease;
      }
      .step.is-current {
        opacity: 1;
        color: var(--color-text-primary);
        font-weight: 500;
      }
      .step.is-done {
        opacity: 1;
      }
      .step-icon {
        width: 1rem;
        display: inline-flex;
        justify-content: center;
        font-size: 0.6875rem;
        color: var(--color-primary, #1447e6);
      }

      @keyframes sweep {
        0% {
          transform: translateX(-110%);
        }
        60%,
        100% {
          transform: translateX(110%);
        }
      }
      @keyframes breathe {
        0%,
        100% {
          transform: scale(1);
          opacity: 0.22;
        }
        50% {
          transform: scale(1.12);
          opacity: 0.34;
        }
      }
      @keyframes drift {
        0%,
        100% {
          transform: rotate(-9deg) translate(-1.75rem, -0.75rem);
        }
        50% {
          transform: rotate(-11deg) translate(-2rem, -1rem);
        }
      }
      @keyframes pop {
        from {
          transform: translateY(4px);
        }
        to {
          transform: translateY(0);
        }
      }

      /* Le mouvement est décoratif : on ne garde que les changements d'état
         pour qui demande à réduire les animations. */
      @media (prefers-reduced-motion: reduce) {
        .stage.is-active .glow,
        .stage.is-active .ghost--back,
        .stage.is-active .sweep,
        .ghost-logo.is-on,
        .ghost-line.is-on {
          animation: none;
        }
        .stage.is-active .sweep {
          opacity: 0;
        }
        .ghost,
        .ghost-logo,
        .ghost-line {
          transition: opacity 0.2s ease;
        }
      }
    `,
  ],
})
export class GenerationPreviewComponent {
  /** true pendant la génération : déclenche l'animation et la liste d'étapes. */
  readonly active = input<boolean>(false);
  /** Index de l'étape en cours (0 → 3). */
  readonly step = input<number>(0);

  protected readonly stepKeys = STEP_KEYS;
}
