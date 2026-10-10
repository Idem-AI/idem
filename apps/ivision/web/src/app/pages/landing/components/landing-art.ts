import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Les grandes illustrations de la landing d'iVision — style IDEM (AGENTS.md § 4) : un objet de
 * la culture africaine choisi pour ce que dit la section, au trait, deux encres (`currentColor`
 * et la couleur primaire pour le seul détail qui compte). Mêmes objets que les petites
 * illustrations de l'atelier (`shared/components/illustration.ts`), dessinés en grand format
 * avec leur contexte :
 *
 *   stamp     tampon adinkra au-dessus de l'étoffe, l'empreinte fraîche : votre site devient votre charte
 *   stencil   pochoir d'adire sur l'étoffe, le motif réimprimé à côté : un modèle reproduit
 *   calame    feuillet et calame, la ligne qu'on écrit : la retouche en direct
 *   kente     bandes de kente cousues, un bloc en couleur : la composition, donc les visuels
 *   kora      kora, le chevalet en couleur : raconter en musique, donc les vidéos
 *   ladder    échelle dogon et ses crans : le cran de créativité (`level` = le cran en couleur)
 *   kuba      raphia kuba, une zone découpée, une pièce cousue : le montage
 *   cauris    calebasse de cauris : les crédits
 *
 * Les traits principaux (`.d`, `pathLength="1"`) se tracent quand l'illustration arrive à
 * l'écran (directive `ivInView` posée sur l'hôte) ; les détails (`.f`) apparaissent ensuite.
 * `--art-ground` masque ce qui passe derrière un objet : la couleur du fond de la page.
 */
export type LandingArtKind = 'stamp' | 'stencil' | 'calame' | 'kente' | 'kora' | 'ladder' | 'kuba' | 'cauris';

const diamond = (cx: number, cy: number, s: number) => `M${cx} ${cy - s} L${cx + s} ${cy} L${cx} ${cy + s} L${cx - s} ${cy}Z`;

/** Le losange à quatre pointes : la signature d'IDEM, que le tampon imprime. */
const sign = (cx: number, cy: number, s: number) => {
  const t = s * 0.45;
  return `${diamond(cx, cy, s)} ${diamond(cx, cy, s * 0.42)} M${cx - s} ${cy} H${cx - s - t} M${cx + s} ${cy} H${cx + s + t} M${cx} ${cy - s} V${cy - s - t} M${cx} ${cy + s} V${cy + s + t}`;
};

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Points de couture en zigzag le long d'une couture verticale. */
const zigzagSeam = (x: number, y0: number, y1: number) =>
  range(y0, y1, 10)
    .map((y, i) => `${i ? 'L' : 'M'}${x + (i % 2 ? 4 : -4)} ${y}`)
    .join(' ');

/** Une frange de fils sous une étoffe. */
const fringe = (x0: number, x1: number, y: number) =>
  range(x0, x1, 8)
    .map((x, i) => `M${x} ${y} V${y + (i % 2 ? 10 : 15)}`)
    .join(' ');

/** Dents de scie entre deux droites (bordure brodée du raphia). */
const sawtooth = (axis: 'h' | 'v', from: number, to: number, a: number, b: number) =>
  range(from, to, 16)
    .map((p, i) => {
      const q = i % 2 ? b : a;
      return `${i ? 'L' : 'M'}${axis === 'h' ? `${p} ${q}` : `${q} ${p}`}`;
    })
    .join(' ');

/** Les motifs d'un bloc de kente, selon son rang dans la bande. */
function kenteBlock(x: number, y: number, pattern: number): string {
  switch (pattern) {
    case 0:
      return `M${x + 10} ${y + 18} H${x + 70} M${x + 10} ${y + 30} H${x + 70} M${x + 10} ${y + 42} H${x + 70}`;
    case 1:
      return `M${x + 10} ${y + 38} l10 -16 l10 16 l10 -16 l10 16 l10 -16 l10 16`;
    case 2:
      return `${diamond(x + 40, y + 30, 18)} ${diamond(x + 40, y + 30, 7)}`;
    case 3:
      return range(x + 20, x + 60, 10)
        .map((px) => `M${px} ${y + 12} V${y + 48}`)
        .join(' ');
    default:
      return `M${x + 14} ${y + 30} H${x + 66}`;
  }
}

@Component({
  selector: 'iv-landing-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @switch (kind()) {
      @case ('stamp') {
        <svg viewBox="0 0 560 450" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <!-- L'étoffe : trois bandes cousues (coutures brodées en zigzag), déjà imprimées. -->
          <path class="d" pathLength="1" d="M30 280 H530 V420 H30Z" />
          <path class="f" [attr.d]="stampSeams" stroke-width="1.68" />
          <path class="f" [attr.d]="stampFringe" stroke-width="1.68" />
          @for (p of stampPrints; track p.x + '-' + p.y) {
            <path class="f" [attr.d]="p.d" stroke-width="2.24" stroke-opacity="0.5" />
          }
          <!-- L'empreinte que le tampon vient de laisser. -->
          <path class="fresh" [attr.d]="stampFresh" stroke="var(--color-primary-500)" stroke-width="3.64" />
          <!-- Le tampon : un éclat de calebasse bombé, gravé dessous, et sa poignée de baguettes liées. -->
          <g class="press">
            @for (s of stampSticks; track s; let i = $index) {
              <path class="d" pathLength="1" [attr.d]="s" [style.--i]="i" />
            }
            <path class="d" pathLength="1" d="M262 112 H298 M262 122 H298 M262 132 H298" stroke-width="3.64" style="--i: 4" />
            <path class="d" pathLength="1" d="M194 214 C198 156 362 156 366 214" stroke-width="3.36" style="--i: 5" />
            <path class="d" pathLength="1" d="M194 214 C194 228 234 240 280 240 C326 240 366 228 366 214" stroke-width="3.36" style="--i: 6" />
            <path class="f" d="M212 226 V234 M232 232 V240 M256 236 V243 M304 236 V243 M328 232 V240 M348 226 V234" stroke-width="1.96" />
            <path class="f" d="M222 194 C246 176 314 176 338 194" stroke-width="1.68" stroke-opacity="0.5" />
          </g>
        </svg>
      }

      @case ('stencil') {
        <svg viewBox="0 0 600 440" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <!-- L'étoffe. -->
          <path class="d" pathLength="1" d="M20 120 H580 V400 H20Z" />
          <path class="f" [attr.d]="stencilFringe" stroke-width="1.68" />
          <!-- La tôle découpée, coin relevé, posée sur la gauche. -->
          <path class="d" pathLength="1" d="M50 148 H286 L320 182 V380 H50Z" style="--i: 2" />
          <path class="d" pathLength="1" d="M286 148 L320 182 L304 140Z" style="--i: 3" />
          @for (h of stencilHoles; track h; let i = $index) {
            <path class="d" pathLength="1" [attr.d]="h" stroke-width="2.52" [style.--i]="4 + i" />
          }
          @for (c of stencilDots; track c.x + '-' + c.y) {
            <circle class="f" [attr.cx]="c.x" [attr.cy]="c.y" r="5" stroke-width="2.24" />
          }
          <!-- La pâte de manioc passée à la spatule. -->
          <path class="f" d="M66 350 Q150 318 236 262" stroke-width="2.8" stroke-dasharray="2 8" />
          <path class="d" pathLength="1" d="M226 262 L292 222 L304 240 L238 280Z" style="fill: var(--art-ground); --i: 6" />
          <path class="d" pathLength="1" d="M292 228 L446 60 M302 238 L456 70 M446 60 L456 70" style="--i: 7" />
          <!-- Le même motif, déjà imprimé à droite, dans une autre couleur. -->
          <g stroke="var(--color-primary-500)" stroke-width="3.08">
            @for (h of stencilPrinted; track h; let i = $index) {
              <path class="print" [attr.d]="h" [style.--i]="i" />
            }
            @for (c of stencilPrintedDots; track c.x + '-' + c.y; let i = $index) {
              <circle class="print" [attr.cx]="c.x" [attr.cy]="c.y" r="5" [style.--i]="6 + i" />
            }
          </g>
        </svg>
      }

      @case ('calame') {
        <svg viewBox="0 0 520 470" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <g transform="rotate(-5 240 240)">
            <path class="d" pathLength="1" d="M70 60 H350 L392 102 V430 H70Z" />
            <path class="d" pathLength="1" d="M350 60 V102 H392" style="--i: 1" />
            @for (l of calameLines; track l; let i = $index) {
              <path class="f" [attr.d]="l" stroke-width="2.24" stroke-opacity="0.55" />
            }
            <!-- La ligne qu'on est en train d'écrire. -->
            <path class="d write" pathLength="1" d="M104 372 H172 M186 372 H246" stroke="var(--color-primary-500)" stroke-width="4.2" />
          </g>
          <!-- Le calame, bec taillé posé au bout de la ligne. -->
          <g transform="translate(259 369) rotate(36)">
            <path class="d" pathLength="1" d="M0 0 L-7 -26 L7 -32Z" style="--i: 3" />
            <path class="d" pathLength="1" d="M-7 -26 V-400 H7 V-32" style="--i: 4" />
            <path class="f" d="M-7 -130 H7 M-7 -136 H7 M-7 -250 H7 M-7 -256 H7 M-7 -350 H7 M-7 -356 H7" stroke-width="1.82" />
            <path class="f" d="M0 -6 V-20" stroke-width="1.68" />
          </g>
        </svg>
      }

      @case ('kente') {
        <svg viewBox="0 0 440 500" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          @for (s of kenteStrips; track s.x; let i = $index) {
            <rect class="d" pathLength="1" [attr.x]="s.x" y="30" width="80" height="420" [style.--i]="i * 2" />
            <path class="f" [attr.d]="s.blocks" stroke-width="1.96" />
          }
          <path class="f" [attr.d]="kenteSeams" stroke-width="1.54" stroke-opacity="0.7" />
          <path class="f" [attr.d]="kenteFringe" stroke-width="1.68" />
          <!-- Le bloc qui tient la composition. -->
          <g stroke="var(--color-primary-500)" stroke-width="3.36">
            <rect class="d" pathLength="1" x="148" y="218" width="64" height="44" style="--i: 9" />
            <path class="d" pathLength="1" [attr.d]="kenteFocal" style="--i: 10" />
          </g>
        </svg>
      }

      @case ('kora') {
        <svg viewBox="0 0 420 560" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <!-- Le manche, les poignées, la calebasse et ses clous. -->
          <path class="d" pathLength="1" d="M204 272 V18 Q210 8 216 18 V272" stroke-width="3.08" />
          <path class="d" pathLength="1" d="M146 286 V202 Q150 194 154 202 V286 M266 286 V202 Q270 194 274 202 V286" style="--i: 1" />
          <circle class="d" pathLength="1" cx="210" cy="400" r="130" stroke-width="3.36" style="--i: 2" />
          <circle class="f" cx="210" cy="400" r="117" stroke-width="4.76" stroke-dasharray="0 11" />
          <path class="f" [attr.d]="koraPegs" stroke-width="2.24" />
          <!-- Les cordes, en deux rangs, du manche au chevalet puis au cordier. -->
          @for (s of koraStrings; track s; let i = $index) {
            <path class="d" pathLength="1" [attr.d]="s" stroke-width="1.4" [style.--i]="3 + i * 0.4" />
          }
          <circle class="d" pathLength="1" cx="210" cy="520" r="6" style="--i: 4" />
          <path class="f" d="M300 108 q16 18 0 36 M318 96 q28 30 0 60 M336 84 q40 42 0 84" stroke-width="2.24" stroke-opacity="0.5" />
          <!-- Le chevalet. -->
          <g stroke="var(--color-primary-500)">
            <rect class="d" pathLength="1" x="176" y="290" width="68" height="112" rx="3" stroke-width="3.36" style="fill: var(--art-ground); --i: 6" />
            <path class="f" [attr.d]="koraNotches" stroke-width="2.24" />
          </g>
        </svg>
      }

      @case ('ladder') {
        <svg viewBox="0 0 240 640" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <!-- Le tronc fourchu, taillé d'une seule pièce. -->
          <path class="d" pathLength="1" d="M92 628 C88 520 96 420 90 320 C86 220 94 140 96 98 C90 72 76 46 58 20 L84 24 C96 48 106 70 112 92 Q120 82 128 92 C134 70 144 48 156 24 L182 20 C164 46 150 72 144 98 C146 140 154 220 150 320 C144 420 152 520 148 628" stroke-width="3.36" />
          <path class="f" d="M88 628 H152" stroke-opacity="0.5" />
          <path class="f" [attr.d]="ladderGrain" stroke-width="1.4" stroke-opacity="0.4" />
          @for (y of ladderNotches; track y; let i = $index) {
            <path
              class="d notch"
              pathLength="1"
              [attr.d]="'M95 ' + y + ' H146 M95 ' + y + ' Q120 ' + (y + 24) + ' 146 ' + y"
              [attr.stroke]="i === level() ? 'var(--color-primary-500)' : null"
              [attr.stroke-width]="i === level() ? 4.4 : 2.8"
              [style.--i]="1 + i"
            />
          }
        </svg>
      }

      @case ('kuba') {
        <svg viewBox="0 0 560 450" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <!-- Le panneau de raphia, sa trame et sa bordure brodée. -->
          <rect class="d" pathLength="1" x="60" y="30" width="440" height="370" stroke-width="3.36" />
          <rect class="d" pathLength="1" x="88" y="58" width="384" height="314" style="--i: 1" />
          <path class="f" [attr.d]="kubaWeave" stroke-width="1.12" stroke-opacity="0.3" />
          <path class="f" [attr.d]="kubaBorder" stroke-width="1.96" />
          <path class="f" [attr.d]="kubaFringe" stroke-width="1.68" />
          <!-- La zone découpée : ce que le montage retire. -->
          <rect x="130" y="110" width="130" height="96" rx="3" stroke-dasharray="5 7" style="fill: var(--art-ground)" />
          <path class="f" d="M150 158 H240" stroke-width="1.68" stroke-opacity="0.5" />
          <!-- Une petite pièce déjà cousue. -->
          <path class="d" pathLength="1" [attr.d]="kubaSmall" style="fill: var(--art-ground); --i: 3" />
          <path class="f" d="M146 262 L196 262 L196 322 L146 322Z" transform="rotate(-6 171 292)" stroke-width="1.68" stroke-dasharray="2 6" />
          <!-- La pièce appliquée, cousue au point : l'habillage. -->
          <g stroke="var(--color-primary-500)">
            <path class="d" pathLength="1" d="M372 176 C422 172 452 212 448 256 C444 304 406 330 368 324 C326 318 302 284 308 246 C314 206 336 180 372 176Z" stroke-width="3.36" style="fill: var(--art-ground); --i: 4" />
            <path class="f" d="M373 160 C432 154 468 206 464 258 C459 316 412 345 366 339 C315 332 286 290 293 245 C300 196 330 165 373 160Z" stroke-width="1.96" stroke-dasharray="2 7" />
            <path class="d" pathLength="1" [attr.d]="kubaSign" stroke-width="2.8" style="--i: 5" />
          </g>
        </svg>
      }

      @case ('cauris') {
        <svg viewBox="0 0 520 400" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <!-- La calebasse, son décor gravé. -->
          <path class="d" pathLength="1" d="M70 214 C76 314 160 374 260 374 C360 374 444 314 450 214" stroke-width="3.36" />
          <path class="f" d="M104 270 C150 300 370 300 416 270" stroke-width="1.96" stroke-dasharray="0 9" />
          <path class="f" d="M120 300 L132 288 L144 300 L156 288 L168 300 M352 300 L364 288 L376 300 L388 288 L400 300" stroke-width="1.82" stroke-opacity="0.7" />
          <path class="d" pathLength="1" d="M260 374 V386 M236 388 H284" stroke-width="2.52" style="--i: 1" />
          <path class="d" pathLength="1" d="M70 214 A190 34 0 0 1 450 214" stroke-width="3.08" />
          <!-- Les cauris : en tas dans la calebasse, deux tombés à côté. -->
          @for (c of cowries; track c.x + '-' + c.y; let i = $index) {
            <g [attr.transform]="'translate(' + c.x + ' ' + c.y + ') rotate(' + c.r + ') scale(' + c.s + ')'" [attr.stroke]="c.accent ? 'var(--color-primary-500)' : null">
              <ellipse class="d" pathLength="1" cx="0" cy="0" rx="25" ry="37" [attr.stroke-width]="3.1 / c.s" style="fill: var(--art-ground)" [style.--i]="2 + i" />
              <path class="f" d="M0 -29 C-6 -12 -6 12 0 29 C6 12 6 -12 0 -29" [attr.stroke-width]="2.2 / c.s" />
              <path class="f" d="M-6 -16 h-5 M-7 -6 h-5 M-7 4 h-5 M-6 14 h-5 M6 -16 h5 M7 -6 h5 M7 4 h5 M6 14 h5" [attr.stroke-width]="1.8 / c.s" />
            </g>
          }
          <!-- Le bord avant de la calebasse passe devant le tas. -->
          <path class="d" pathLength="1" d="M70 214 A190 34 0 0 0 450 214" stroke-width="3.08" style="--i: 1" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      --art-ground: var(--color-bg-darker);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    /* Tracé à l'arrivée (directive \`ivInView\`). Au repos, tout est dessiné : les animations
       ne partent qu'avec \`.is-drawn\`, et leur premier pas (en \`both\`) est l'état vide. */
    :host(.is-drawn) .d {
      stroke-dasharray: 1;
      animation: art-draw 1.7s var(--ease-fluid) both;
      animation-delay: calc(var(--i, 0) * 110ms);
    }
    :host(.is-drawn) .f {
      animation: art-fade 0.9s ease 1.1s both;
    }
    @keyframes art-draw {
      from {
        stroke-dashoffset: 1;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes art-fade {
      from {
        opacity: 0;
      }
    }

    /* Le tampon descend, imprime, remonte ; l'empreinte apparaît au contact. */
    :host(.is-drawn) .press {
      animation: art-press 1.1s var(--ease-fluid) 1.6s both;
    }
    :host(.is-drawn) .fresh {
      animation: art-fade 0.4s ease 2.1s both;
    }
    @keyframes art-press {
      45% {
        transform: translateY(26px);
      }
    }

    /* Le motif réimprimé, losange après losange. */
    :host(.is-drawn) .print {
      animation: art-fade 0.5s ease both;
      animation-delay: calc(1.4s + var(--i, 0) * 120ms);
    }

    /* La ligne qu'on écrit se trace après le reste. */
    :host(.is-drawn) .write {
      animation-duration: 1.4s;
      animation-delay: 1.6s;
    }

    .notch {
      transition:
        stroke 0.3s ease,
        stroke-width 0.3s ease;
    }
  `,
})
export class LandingArt {
  readonly kind = input.required<LandingArtKind>();
  /** Échelle dogon : le cran en couleur, de 0 (en bas) à 4 (en haut). */
  readonly level = input(-1);

  // Tampon adinkra.
  protected readonly stampSeams = `${zigzagSeam(197, 286, 414)} ${zigzagSeam(363, 286, 414)}`;
  protected readonly stampFringe = fringe(34, 526, 420);
  protected readonly stampPrints = [
    { x: 113, y: 318 },
    { x: 113, y: 384 },
    { x: 280, y: 384 },
    { x: 446, y: 318 },
    { x: 446, y: 384 },
  ].map((p) => ({ ...p, d: sign(p.x, p.y, 20) }));
  protected readonly stampFresh = sign(280, 318, 22);
  protected readonly stampSticks = ['M258 186 L266 70', 'M272 183 L275 62', 'M288 183 L285 62', 'M302 186 L294 70'];

  // Pochoir d'adire.
  protected readonly stencilFringe = fringe(24, 576, 400);
  protected readonly stencilHoles = [105, 185, 265].flatMap((x) => [204, 264, 324].map((y) => diamond(x, y, 20)));
  protected readonly stencilDots = [145, 225].flatMap((x) => [234, 294].map((y) => ({ x, y })));
  protected readonly stencilPrinted = [410, 490].flatMap((x) => [190, 250, 310].map((y) => diamond(x, y, 20)));
  protected readonly stencilPrintedDots = [
    { x: 450, y: 220 },
    { x: 450, y: 280 },
  ];

  // Feuillet et calame : des lignes d'écriture, coupées en mots.
  protected readonly calameLines = [
    [104, 150, 168, 262, 276, 330],
    [104, 196, 210, 300, 314, 352],
    [104, 140, 154, 250, 264, 340],
    [104, 220, 234, 296],
    [104, 168, 182, 290, 304, 350],
    [104, 150, 164, 256],
  ].map((xs, row) => {
    const y = 152 + row * 36;
    let d = '';
    for (let i = 0; i < xs.length; i += 2) d += `M${xs[i]} ${y} H${xs[i + 1]} `;
    return d.trim();
  });

  // Bandes de kente : 4 bandes, 7 blocs chacune, motifs décalés d'une bande à l'autre.
  protected readonly kenteStrips = [60, 140, 220, 300].map((x, strip) => ({
    x,
    blocks: range(0, 6, 1)
      .map((block) => {
        const y = 30 + block * 60;
        const separator = block ? `M${x} ${y} H${x + 80} ` : '';
        // Le bloc central de la deuxième bande porte la couleur : on le laisse vide ici.
        if (strip === 1 && block === 3) return separator;
        return separator + kenteBlock(x, y, (strip * 2 + block) % 5);
      })
      .join(' '),
  }));
  protected readonly kenteSeams = [140, 220, 300]
    .map((x) =>
      range(44, 436, 20)
        .map((y) => `M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}`)
        .join(' '),
    )
    .join(' ');
  protected readonly kenteFringe = fringe(64, 376, 450);
  protected readonly kenteFocal = `${diamond(180, 240, 16)} ${diamond(180, 240, 6)}`;

  // Kora : deux rangs de cordes (dessinés à 7 + 7, la vraie en a 21 : au trait, elles se fondraient).
  protected readonly koraStrings = [
    ...range(0, 6, 1).map((i) => `M203 ${40 + i * 30} L176 ${300 + i * 14} L210 520`),
    ...range(0, 6, 1).map((i) => `M217 ${55 + i * 30} L244 ${304 + i * 14} L210 520`),
  ];
  protected readonly koraPegs = [
    ...range(0, 6, 1).map((i) => `M203 ${40 + i * 30} H192`),
    ...range(0, 6, 1).map((i) => `M217 ${55 + i * 30} H228`),
  ].join(' ');
  protected readonly koraNotches = [
    ...range(0, 6, 1).map((i) => `M176 ${300 + i * 14} h8`),
    ...range(0, 6, 1).map((i) => `M244 ${304 + i * 14} h-8`),
  ].join(' ');

  // Échelle dogon : 5 crans, du bas (Low) vers le haut (Ultra).
  protected readonly ladderNotches = [560, 455, 350, 245, 140];
  protected readonly ladderGrain = [
    'M106 600 C104 580 108 520 104 500',
    'M134 590 C136 560 132 520 136 490',
    'M110 420 C106 400 112 380 108 370',
    'M130 300 C134 280 128 270 132 260',
    'M108 210 C104 190 110 175 106 165',
    'M134 120 C136 112 132 104 134 100',
  ].join(' ');

  // Raphia kuba.
  protected readonly kubaWeave = [
    ...range(112, 448, 24).map((x) => `M${x} 60 V370`),
    ...range(82, 358, 24).map((y) => `M90 ${y} H470`),
  ].join(' ');
  protected readonly kubaBorder = [
    sawtooth('h', 66, 498, 36, 52),
    sawtooth('h', 66, 498, 378, 394),
    sawtooth('v', 66, 386, 66, 82),
    sawtooth('v', 66, 386, 478, 494),
  ].join(' ');
  protected readonly kubaFringe = fringe(64, 496, 400);
  protected readonly kubaSmall = 'M150 266 L192 262 L196 318 L152 322Z';
  protected readonly kubaSign = `${diamond(376, 252, 24)} ${diamond(376, 252, 9)}`;

  // Calebasse de cauris : le tas, puis deux cauris tombés.
  protected readonly cowries = [
    { x: 168, y: 192, r: -58, s: 0.95, accent: false },
    { x: 346, y: 190, r: 62, s: 0.95, accent: false },
    { x: 214, y: 170, r: -22, s: 1, accent: false },
    { x: 304, y: 168, r: 24, s: 1, accent: false },
    { x: 258, y: 150, r: 4, s: 1.12, accent: true },
    { x: 462, y: 340, r: 68, s: 0.85, accent: false },
    { x: 412, y: 364, r: -14, s: 0.8, accent: false },
  ];
}
