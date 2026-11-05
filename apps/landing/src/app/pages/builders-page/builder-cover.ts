import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BuilderBrand } from '@idem/shared-models/builders/program';

/**
 * La couverture d'un projet Idem Builders, composée depuis sa charte.
 *
 * Le projet a été construit dans IDEM : sa couleur principale, sa couleur
 * secondaire et son logo existent déjà. La couverture les met en scène — le
 * fond à la couleur principale, une lumière à la couleur secondaire, un grand
 * anneau qui donne la profondeur, et le logo dans la variante prévue pour ce
 * fond. Rien à téléverser, rien à régénérer : quand la charte change, la
 * couverture suit.
 *
 * Sans charte, le bleu d'IDEM ; sans logo, les initiales du projet. Un logo
 * qui ne charge pas retombe aussi sur les initiales plutôt que sur une image
 * cassée.
 */
@Component({
  selector: 'app-builder-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--cover-bg]': 'background()',
    '[style.--cover-glow]': 'glow()',
    '[style.--cover-ink]': 'ink()',
    '[class.cover-hero]': "size() === 'hero'",
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      position: relative;
      display: grid;
      place-items: center;
      overflow: hidden;
      isolation: isolate;
      background-color: var(--cover-bg);
      background-image:
        radial-gradient(120% 90% at 100% 0%, var(--cover-glow) 0%, transparent 55%),
        radial-gradient(90% 70% at 0% 100%, color-mix(in srgb, black 22%, transparent) 0%, transparent 60%);
    }

    /* Le grand anneau : un seul geste graphique, qui sort du cadre. */
    :host::before {
      content: '';
      position: absolute;
      width: 78%;
      aspect-ratio: 1;
      right: -22%;
      top: -38%;
      border-radius: 9999px;
      border: clamp(1.25rem, 4vw, 3rem) solid color-mix(in srgb, var(--cover-ink) 9%, transparent);
      z-index: -1;
    }

    /* Le grain : une trame très fine, pour que l'aplat ne fasse pas « vide ». */
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(color-mix(in srgb, var(--cover-ink) 14%, transparent) 0.6px, transparent 0.6px);
      background-size: 14px 14px;
      mask-image: linear-gradient(to bottom, black, transparent 75%);
      z-index: -1;
    }

    .logo {
      display: block;
      max-width: 58%;
      max-height: 46%;
      object-fit: contain;
      filter: drop-shadow(0 10px 24px color-mix(in srgb, black 18%, transparent));
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
    }

    /* Survolée dans une fiche, la couverture avance un peu son logo. */
    :host-context(a:hover) .logo,
    :host-context(a:focus-visible) .logo {
      transform: scale(1.05);
    }

    .plate {
      display: grid;
      place-items: center;
      width: 52%;
      max-width: 18rem;
      aspect-ratio: 16 / 10;
      padding: 8%;
      border-radius: 1.25rem;
      background: #ffffff;
      box-shadow: 0 24px 48px -20px color-mix(in srgb, black 40%, transparent);
    }

    .plate .logo {
      max-width: 100%;
      max-height: 100%;
      filter: none;
    }

    .initials {
      font-weight: var(--font-weight-black, 900);
      font-size: clamp(2.5rem, 7vw, 4.5rem);
      line-height: 1;
      letter-spacing: -0.02em;
      color: var(--cover-ink);
    }

    :host(.cover-hero) .logo {
      max-width: 46%;
      max-height: 52%;
    }

    :host(.cover-hero) .initials {
      font-size: clamp(3.5rem, 11vw, 8rem);
    }

    @media (prefers-reduced-motion: reduce) {
      .logo {
        transition: none;
      }
    }
  `,
  template: `
    @if (logoSrc() && !failed()) {
      @if (plate()) {
        <span class="plate">
          <img class="logo" [src]="logoSrc()" alt="" loading="lazy" decoding="async" (error)="failed.set(true)" />
        </span>
      } @else {
        <img class="logo" [src]="logoSrc()" alt="" loading="lazy" decoding="async" (error)="failed.set(true)" />
      }
    } @else {
      <span class="initials">{{ initials() }}</span>
    }
  `,
})
export class BuilderCoverComponent {
  readonly brand = input<BuilderBrand | undefined>();
  readonly name = input.required<string>();
  readonly size = input<'card' | 'hero'>('card');

  protected readonly failed = signal(false);

  protected readonly background = computed(() => this.brand()?.primary ?? 'var(--color-primary-500)');

  protected readonly glow = computed(() => {
    const brand = this.brand();
    const light = brand?.secondary ?? brand?.accent;
    return light
      ? `color-mix(in srgb, ${light} 70%, transparent)`
      : 'color-mix(in srgb, white 22%, transparent)';
  });

  /** L'encre posée sur la couleur : claire sur un fond foncé, foncée sur un fond clair. */
  protected readonly ink = computed(() => (this.brand() && !this.brand()!.dark ? '#0f172a' : '#ffffff'));

  /** Le logo lisible sur le fond ; à défaut, la version claire posée sur une plaque. */
  protected readonly logoSrc = computed(() => this.brand()?.logoOnBrand ?? this.brand()?.logoOnLight);
  protected readonly plate = computed(() => !this.brand()?.logoOnBrand && !!this.brand()?.logoOnLight);

  protected readonly initials = computed(() => {
    const words = this.name().trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
  });
}
