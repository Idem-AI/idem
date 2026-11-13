import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BuilderBrand } from '@idem/shared-models/builders/program';

/** Luminance relative (WCAG) d'une couleur hexadécimale. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * La couverture d'un projet Idem Builders.
 *
 * Si le projet a choisi une couverture, c'est elle. Sinon elle est composée
 * depuis sa charte : le fond à la couleur principale, une lumière à la
 * couleur secondaire, un grand anneau, et le logo — toujours dans une
 * déclinaison qui se lit sur ce fond :
 *
 *  - fond foncé : la déclinaison pour fond sombre ; à défaut, le logo passé en
 *    blanc (jamais la version monochrome, souvent à la couleur principale) ;
 *  - fond clair : le logo tel quel, sauf si aucune de ses couleurs ne s'y
 *    détache ; il passe alors en encre foncée.
 *
 * Sans charte, le bleu d'IDEM ; sans logo, les initiales. Une image qui ne
 * charge pas retombe sur la composition plutôt que sur un cadre cassé.
 */
@Component({
  selector: 'app-builder-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--cover-bg]': 'background()',
    '[style.--cover-glow]': 'glow()',
    '[style.--cover-ink]': 'ink()',
    '[class.cover-hero]': "size() === 'hero'",
    '[class.cover-photo]': 'showPhoto()',
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
    :host(:not(.cover-photo))::before {
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
    :host(:not(.cover-photo))::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(color-mix(in srgb, var(--cover-ink) 14%, transparent) 0.6px, transparent 0.6px);
      background-size: 14px 14px;
      mask-image: linear-gradient(to bottom, black, transparent 75%);
      z-index: -1;
    }

    .photo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.8s cubic-bezier(0.25, 1, 0.5, 1);
    }

    .logo {
      display: block;
      max-width: 58%;
      max-height: 46%;
      object-fit: contain;
      transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
    }

    /* Les deux déclinaisons calculées : blanche sur un fond foncé, encre sur un fond clair. */
    .logo.on-dark {
      filter: brightness(0) invert(1);
    }
    .logo.on-light {
      filter: brightness(0);
      opacity: 0.88;
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

    /* Survolée dans une fiche, la couverture avance d'un rien. */
    :host-context(a:hover) .logo,
    :host-context(a:focus-visible) .logo {
      transform: scale(1.05);
    }
    :host-context(a:hover) .photo,
    :host-context(a:focus-visible) .photo {
      transform: scale(1.04);
    }

    @media (prefers-reduced-motion: reduce) {
      .logo,
      .photo {
        transition: none;
      }
    }
  `,
  template: `
    @if (showPhoto()) {
      <img class="photo" [src]="coverUrl()" alt="" loading="lazy" decoding="async" (error)="photoFailed.set(true)" />
    } @else if (logo().src && !logoFailed()) {
      <img
        class="logo"
        [class.on-dark]="logo().tone === 'white'"
        [class.on-light]="logo().tone === 'ink'"
        [src]="logo().src"
        alt=""
        loading="lazy"
        decoding="async"
        (error)="logoFailed.set(true)"
      />
    } @else {
      <span class="initials">{{ initials() }}</span>
    }
  `,
})
export class BuilderCoverComponent {
  readonly brand = input<BuilderBrand | undefined>();
  readonly coverUrl = input<string | undefined>();
  readonly name = input.required<string>();
  readonly size = input<'card' | 'hero'>('card');

  protected readonly photoFailed = signal(false);
  protected readonly logoFailed = signal(false);

  protected readonly showPhoto = computed(() => !!this.coverUrl() && !this.photoFailed());

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

  /** Quelle image du logo poser, et faut-il la recolorer pour qu'elle se lise. */
  protected readonly logo = computed<{ src?: string; tone: 'as-is' | 'white' | 'ink' }>(() => {
    const brand = this.brand();
    if (!brand) return { tone: 'as-is' };

    if (brand.dark) {
      if (brand.logoOnDark) return { src: brand.logoOnDark, tone: 'as-is' };
      return { src: brand.logoOnLight, tone: 'white' };
    }

    const colors = brand.logoColors ?? [];
    const readable = colors.length === 0 || colors.some((color) => contrast(color, brand.primary) >= 2.5);
    return { src: brand.logoOnLight, tone: readable ? 'as-is' : 'ink' };
  });

  protected readonly initials = computed(() => {
    const words = this.name().trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
  });
}
