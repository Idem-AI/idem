import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * « Comment ça marche », en trois étapes numérotées, en tête d'un écran.
 *
 * Le mode d'emploi est montré tant qu'on ne l'a pas masqué, puis réduit à un
 * lien : quelqu'un qui découvre l'écran le lit, quelqu'un qui y revient tous
 * les jours n'a pas à le faire défiler. Le choix est retenu dans le navigateur
 * — c'est une commodité de lecture, pas une donnée du projet.
 *
 * Textes : `dashboard.showCommunication.guide.<guideKey>.title` et
 * `.steps.1` à `.steps.3`.
 */
@Component({
  selector: 'app-screen-guide',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <section class="sg glass" [attr.aria-labelledby]="titleId()">
        <div class="sg-head">
          <h3 class="sg-title" [id]="titleId()">
            <i class="pi pi-question-circle" aria-hidden="true"></i>
            {{ prefix() + '.title' | translate }}
          </h3>
          <button type="button" class="sg-hide" (click)="setOpen(false)">
            {{ 'dashboard.showCommunication.guide.hide' | translate }}
          </button>
        </div>
        <ol class="sg-steps">
          @for (index of [1, 2, 3]; track index) {
            <li class="sg-step">
              <span class="sg-num" aria-hidden="true">{{ index }}</span>
              <span>{{ prefix() + '.steps.' + index | translate }}</span>
            </li>
          }
        </ol>
      </section>
    } @else {
      <button type="button" class="sg-show" (click)="setOpen(true)">
        <i class="pi pi-question-circle" aria-hidden="true"></i>
        {{ 'dashboard.showCommunication.guide.show' | translate }}
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 1.25rem;
    }

    .sg {
      border-radius: 1rem;
      padding: 1rem 1.1rem;
    }

    .sg-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .sg-title {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }

    .sg-title .pi {
      color: var(--color-primary-500);
    }

    .sg-hide,
    .sg-show {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .sg-hide:hover,
    .sg-show:hover {
      color: var(--color-text-primary);
      text-decoration: underline;
    }

    .sg-show {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .sg-steps {
      margin-top: 0.8rem;
      display: grid;
      gap: 0.75rem;
    }

    @media (min-width: 48rem) {
      .sg-steps {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .sg-step {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.84rem;
      line-height: 1.45;
      color: var(--color-text-secondary);
    }

    .sg-num {
      display: flex;
      height: 1.5rem;
      width: 1.5rem;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1.5px solid var(--color-primary-500);
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-primary-500);
    }
  `,
})
export class ScreenGuide {
  readonly guideKey = input.required<string>();

  protected readonly prefix = computed(() => `dashboard.showCommunication.guide.${this.guideKey()}`);
  protected readonly titleId = computed(() => `sg-${this.guideKey()}`);

  /** `null` tant qu'on n'a rien lu : le stockage n'est consulté qu'une fois la clé connue. */
  private readonly override = signal<boolean | null>(null);

  protected readonly isOpen = computed(() => this.override() ?? !this.readHidden());

  protected setOpen(open: boolean): void {
    this.override.set(open);
    try {
      if (open) localStorage.removeItem(this.storageKey());
      else localStorage.setItem(this.storageKey(), '1');
    } catch {
      /* stockage indisponible (navigation privée) : le choix vaut pour la session */
    }
  }

  private storageKey(): string {
    return `idem.communication.guide.${this.guideKey()}.hidden`;
  }

  private readHidden(): boolean {
    try {
      return localStorage.getItem(this.storageKey()) === '1';
    } catch {
      return false;
    }
  }
}
