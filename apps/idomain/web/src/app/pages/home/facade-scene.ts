import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

/** Des noms d'exemple, inscrits tour à tour sur la plaque tant que le visiteur n'écrit rien. */
const EXAMPLES = ['salon-kenfack.africa', 'atelier-Makam.com', 'chez-mariam.africa'];

/**
 * La grande illustration du hero : une maison à façade ndebele peinte — la maison qu'on reconnaît
 * de loin et qui dit à qui elle est, donc « une adresse à son nom » (AGENTS.md § 4, l'objet du nom
 * de domaine). Au trait, deux encres : `currentColor` pour la maison et ses motifs (chevrons,
 * losanges, dents de scie, à l'intérieur des murs), la couleur primaire pour le seul détail qui
 * compte — la plaque au-dessus de la porte, où s'inscrit le nom.
 *
 * Animation : les traits se dessinent à l'arrivée, puis le nom tapé par le visiteur (ou un exemple)
 * s'écrit sur la plaque et le cadenas se ferme. Rien ne bouge si le visiteur réduit les animations :
 * la maison est complète au repos. Décorative pour les lecteurs d'écran (le champ porte le sens).
 */
@Component({
  selector: 'idm-facade-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    <svg
      viewBox="0 0 480 420"
      class="idm-scene h-auto w-full"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      [class.is-ready]="ready()"
    >
      <!-- Le sol et l'ombre portée. -->
      <path class="d d1" pathLength="1" d="M24 384 H456" stroke-width="2" opacity=".55" />
      <path class="d d1" pathLength="1" d="M70 396 H410" stroke-width="1.2" opacity=".3" />

      <!-- Le mur à gradins (parapet ndebele). -->
      <path
        class="d d2"
        pathLength="1"
        d="M70 384 V176 H104 V150 H140 V124 H340 V150 H376 V176 H410 V384"
        stroke-width="3"
        style="fill: var(--color-surface-1)"
      />
      <path
        class="d d2"
        pathLength="1"
        d="M82 384 V188 H116 V162 H152 V136 H328 V162 H364 V188 H398 V384"
        stroke-width="1.2"
        opacity=".45"
      />

      <!-- Bande haute : dents de scie peintes. -->
      <path class="d d3" pathLength="1" d="M152 168 H328" stroke-width="1.4" opacity=".7" />
      <path
        class="d d3"
        pathLength="1"
        d="M152 168 L164 152 L176 168 L188 152 L200 168 L212 152 L224 168 L236 152 L248 168 L260 152 L272 168 L284 152 L296 168 L308 152 L320 168"
        stroke-width="1.6"
        opacity=".8"
      />

      <!-- Panneaux latéraux : losanges emboîtés. -->
      <path
        class="d d4"
        pathLength="1"
        d="M98 214 H170 V356 H98Z M310 214 H382 V356 H310Z"
        stroke-width="2"
      />
      <path
        class="d d4"
        pathLength="1"
        d="M134 226 L160 285 L134 344 L108 285Z M346 226 L372 285 L346 344 L320 285Z"
        stroke-width="1.6"
        opacity=".85"
      />
      <path
        class="d d5"
        pathLength="1"
        d="M134 252 L148 285 L134 318 L120 285Z M346 252 L360 285 L346 318 L332 285Z"
        stroke-width="1.2"
        opacity=".65"
      />
      <path
        class="d d5"
        pathLength="1"
        d="M98 236 L110 224 M170 236 L158 224 M98 334 L110 346 M170 334 L158 346 M310 236 L322 224 M382 236 L370 224 M310 334 L322 346 M382 334 L370 346"
        stroke-width="1.2"
        opacity=".55"
      />

      <!-- Chevrons sous les panneaux. -->
      <path
        class="d d5"
        pathLength="1"
        d="M98 370 L110 362 L122 370 L134 362 L146 370 L158 362 L170 370 M310 370 L322 362 L334 370 L346 362 L358 370 L370 362 L382 370"
        stroke-width="1.2"
        opacity=".6"
      />

      <!-- La porte en arc et son encadrement peint. -->
      <path
        class="d d4"
        pathLength="1"
        d="M206 384 V292 C206 262 274 262 274 292 V384"
        stroke-width="3"
      />
      <path
        class="d d5"
        pathLength="1"
        d="M194 384 V290 C194 248 286 248 286 290 V384"
        stroke-width="1.2"
        opacity=".5"
      />
      <path
        class="d d5"
        pathLength="1"
        d="M222 322 L240 304 L258 322 M222 346 L240 328 L258 346"
        stroke-width="1.2"
        opacity=".55"
      />

      <!-- La plaque au-dessus de la porte : le nom de la maison (seule couleur). -->
      <g class="plate">
        <rect
          class="d d6"
          pathLength="1"
          x="146"
          y="176"
          width="188"
          height="34"
          rx="8"
          stroke-width="2.4"
          style="color: var(--color-primary-500); fill: var(--color-surface-1)"
        />
        <!-- Le cadenas : ouvert pendant que le nom s'écrit, fermé quand il est complet. -->
        <g
          [attr.transform]="'translate(156 181)'"
          [style.color]="locked() ? 'var(--color-success)' : 'var(--color-text-tertiary)'"
        >
          <rect x="0" y="9" width="14" height="11" rx="2.5" stroke-width="2" />
          <path
            class="shackle"
            [class.is-locked]="locked()"
            d="M3 9 V6 a4 4 0 0 1 8 0 V9"
            stroke-width="2"
          />
        </g>
        <text
          x="180"
          y="198"
          class="plate-text"
          stroke="none"
          style="fill: var(--color-text-primary)"
        >
          {{ shown() }}
        </text>
      </g>

      <!-- Le losange du faîte : le signe de la maison. -->
      <path
        class="d d6"
        pathLength="1"
        d="M240 92 L254 106 L240 120 L226 106Z"
        stroke-width="2.4"
        style="color: var(--color-primary-500)"
      />
      <path
        class="d d6"
        pathLength="1"
        d="M212 106 H220 M260 106 H268"
        stroke-width="1.8"
        style="color: var(--color-primary-500)"
      />
    </svg>
  `,
  styles: `
    :host {
      color: var(--color-text-tertiary);
    }
    .plate-text {
      font-family: inherit;
      font-size: 15px;
      font-weight: 700;
    }
    .shackle {
      transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
      transform: translateY(-3px);
    }
    .shackle.is-locked {
      transform: translateY(0);
    }

    /* Les traits se dessinent une fois, couche après couche (le mur, les motifs, la porte, la plaque). */
    .is-ready .d {
      stroke-dasharray: 1;
      animation: idm-draw 1100ms cubic-bezier(0.65, 0, 0.35, 1) both;
    }
    .is-ready .d1 {
      animation-delay: 0ms;
    }
    .is-ready .d2 {
      animation-delay: 150ms;
    }
    .is-ready .d3 {
      animation-delay: 550ms;
    }
    .is-ready .d4 {
      animation-delay: 750ms;
    }
    .is-ready .d5 {
      animation-delay: 1000ms;
    }
    .is-ready .d6 {
      animation-delay: 1250ms;
    }
    @keyframes idm-draw {
      from {
        stroke-dashoffset: 1;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .is-ready .d {
        animation: none;
      }
      .shackle {
        transition: none;
      }
    }
  `,
})
export class FacadeScene {
  /** Ce que le visiteur tape (vide : les exemples s'inscrivent tour à tour). */
  readonly query = input('');
  /** L'extension ajoutée quand le visiteur n'a tapé que le nom (la première en vente). */
  readonly suffix = input('africa');
  private readonly typed = signal(EXAMPLES[0]);
  /** Le dessin ne s'anime qu'une fois le composant affiché (et jamais en mouvement réduit). */
  protected readonly ready = signal(false);

  protected readonly shown = computed(() => {
    const typed = clean(this.query());
    const value = typed
      ? typed.includes('.')
        ? typed
        : `${typed}.${this.suffix()}`
      : this.typed();
    return value.length > 22 ? `${value.slice(0, 21)}…` : value;
  });
  /** Le cadenas se ferme quand un nom complet (avec son extension) est sur la plaque. */
  protected readonly locked = computed(() => /\.[a-z]{2,}$/.test(this.shown()));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.ready.set(true);
      let example = 0;
      let length = EXAMPLES[0].length;
      let deleting = true;
      let timer: ReturnType<typeof setTimeout>;
      const tick = () => {
        // Le visiteur écrit : la plaque est à lui.
        if (clean(this.query())) {
          timer = setTimeout(tick, 600);
          return;
        }
        if (deleting) {
          length--;
          if (length <= 0) {
            deleting = false;
            example = (example + 1) % EXAMPLES.length;
          }
        } else {
          length++;
        }
        this.typed.set(EXAMPLES[example].slice(0, Math.max(0, length)));
        const complete = !deleting && length >= EXAMPLES[example].length;
        if (complete) deleting = true;
        timer = setTimeout(tick, complete ? 2800 : deleting ? 40 : 90);
      };
      timer = setTimeout(tick, 3400);
      destroyRef.onDestroy(() => clearTimeout(timer));
    });
  }
}

/** Ce qui ressemble à un nom dans la saisie : sans protocole, sans `www.`, en minuscules. */
function clean(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#\s]/)[0]
    .slice(0, 60);
}
