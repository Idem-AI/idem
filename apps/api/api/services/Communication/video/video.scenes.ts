/**
 * LE CATALOGUE DE SCÈNES — écrit à la main, une fois.
 *
 * Chaque scène déclare :
 *   - ses CASES de texte (clé, longueur maximale, obligatoire ou non) : c'est
 *     tout ce que le modèle voit et remplit ;
 *   - ses VARIANTES de mise en page, tirées par la graine ;
 *   - son BALISAGE (HTML + classes Tailwind), produit ici côté serveur.
 *
 * L'animation de chaque scène vit dans le runtime navigateur
 * (`video.runtime.ts`), sous la même clé : le balisage pose des rôles
 * (`data-r="title"`), le runtime les anime. Les tailles de texte ne sont jamais
 * fixées en dur : `data-fit` laisse le runtime trouver la plus grande taille
 * qui tient dans la zone, quelle que soit la longueur écrite par le modèle.
 */
import { VideoSceneInstance } from '../../../models/motionVideo.model';
import { VideoTheme } from './video.theme';

export interface SlotDef {
  key: string;
  /** Longueur maximale, en caractères. */
  max: number;
  required?: boolean;
  /** Indication donnée au modèle, en anglais (plus court en tokens). */
  hint: string;
}

export interface SceneDef {
  id: string;
  slots: SlotDef[];
  /** `required` : sans image la scène est retirée ; `optional` : une variante sans image existe. */
  image?: 'required' | 'optional';
  /** Images minimum pour une galerie. */
  minImages?: number;
  variants: number;
  /** Durée confortable (s) et bornes. */
  nominal: number;
  min: number;
  max: number;
  /** Surfaces qui conviennent, par ordre de préférence. */
  surfaces: VideoSceneInstance['surface'][];
}

export type Orientation = 'portrait' | 'square' | 'landscape';

export interface SceneContext {
  scene: VideoSceneInstance;
  theme: VideoTheme;
  orient: Orientation;
  /** Rang de la scène dans la vidéo (fait tourner les décors). */
  index: number;
  /** Source du logo adaptée à la polarité de la surface. */
  logo?: string;
}

const esc = (raw: string | undefined): string =>
  (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const attr = (raw: string | undefined): string => esc(raw).replace(/'/g, '&#39;');

/** Zone de texte auto-ajustée : tailles en centièmes du petit côté. */
const fit = (max: number, min: number, lines: number, extra = ''): string =>
  `data-fit="${max},${min},${lines}" ${extra}`.trim();

// ─── Icônes (traits simples, animables au tracé) ───────────────────────────
export const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path data-draw d="M5 12.5l4.2 4.2L19 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h3.5l1.6 4.2-2.2 1.4a11 11 0 0 0 6.5 6.5l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/></svg>',
  quote: '<svg viewBox="0 0 48 36" fill="currentColor"><path d="M0 36V22C0 9.6 6.3 2.3 17.4 0l2 4.6C13.2 6.6 10.4 10.4 10 16h8v20H0zm28 0V22C28 9.6 34.3 2.3 45.4 0l2 4.6C41.2 6.6 38.4 10.4 38 16h8v20H28z"/></svg>',
};

// ─── Décors : formes douces qui dérivent lentement derrière le contenu ─────
const DECORS = ['blob', 'rings', 'dots', 'arc', 'stripes'] as const;

function decor(index: number): string {
  const kind = DECORS[index % DECORS.length];
  switch (kind) {
    case 'blob':
      return `<div data-r="decor" class="deco absolute rounded-full" style="width:115%;aspect-ratio:1;right:-55%;top:-30%;background:var(--soft)"></div>
<div data-r="decor" class="deco absolute rounded-full" style="width:45%;aspect-ratio:1;left:-15%;bottom:-12%;background:var(--soft)"></div>`;
    case 'rings':
      return `<svg data-r="decor" class="deco absolute" style="width:120%;left:-10%;top:12%;color:var(--soft)" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="7"><circle cx="100" cy="100" r="40"/><circle cx="100" cy="100" r="68"/><circle cx="100" cy="100" r="96"/></svg>`;
    case 'dots':
      return `<div data-r="decor" class="deco absolute" style="inset:-10%;background-image:radial-gradient(var(--soft) 18%,transparent 19%);background-size:calc(var(--u)*6) calc(var(--u)*6)"></div>`;
    case 'arc':
      return `<div data-r="decor" class="deco absolute rounded-full" style="width:150%;aspect-ratio:1;left:-25%;top:62%;border:calc(var(--u)*9) solid var(--soft)"></div>`;
    default:
      return `<div data-r="decor" class="deco absolute" style="inset:-30%;background:repeating-linear-gradient(-35deg,var(--soft) 0 calc(var(--u)*2.2),transparent calc(var(--u)*2.2) calc(var(--u)*7))"></div>`;
  }
}

/** Mot mis en valeur : le plus long des 3 derniers mots, souvent le plus porteur. */
function emphasize(text: string): string {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length < 3) return esc(text);
  const tail = words.slice(-3);
  const target = tail.reduce((a, b) => (b.replace(/\W/g, '').length > a.replace(/\W/g, '').length ? b : a));
  const idx = words.lastIndexOf(target);
  return words.map((w, i) => (i === idx ? `<span class="hl-word">${esc(w)}</span>` : esc(w))).join(' ');
}

// ─── Le catalogue ───────────────────────────────────────────────────────────

export const SCENES: Record<string, SceneDef> = {
  hook: {
    id: 'hook',
    slots: [
      { key: 'kicker', max: 24, hint: 'tiny label above, e.g. NEW, LIMITED OFFER' },
      { key: 'title', max: 42, required: true, hint: 'punchy opening line, 3-7 words' },
    ],
    variants: 3,
    nominal: 2.6,
    min: 1.6,
    max: 4,
    surfaces: ['primary', 'light', 'secondary'],
  },
  statement: {
    id: 'statement',
    slots: [
      { key: 'title', max: 60, required: true, hint: 'the main promise, one sentence' },
      { key: 'sub', max: 80, hint: 'supporting line' },
    ],
    variants: 2,
    nominal: 3,
    min: 2,
    max: 5,
    surfaces: ['light', 'secondary', 'primary'],
  },
  product: {
    id: 'product',
    slots: [
      { key: 'name', max: 32, required: true, hint: 'product or service name' },
      { key: 'tagline', max: 60, hint: 'what it brings, short' },
      { key: 'price', max: 18, hint: 'price ONLY if given in brief' },
    ],
    image: 'optional',
    variants: 3,
    nominal: 3.2,
    min: 2.2,
    max: 5,
    surfaces: ['light', 'primary', 'secondary'],
  },
  benefits: {
    id: 'benefits',
    slots: [
      { key: 'title', max: 36, hint: 'short heading' },
      { key: 'b1', max: 34, required: true, hint: 'benefit 1, 2-5 words' },
      { key: 'b2', max: 34, required: true, hint: 'benefit 2, 2-5 words' },
      { key: 'b3', max: 34, hint: 'benefit 3, 2-5 words' },
    ],
    variants: 2,
    nominal: 3.6,
    min: 2.6,
    max: 5.5,
    surfaces: ['light', 'secondary', 'primary'],
  },
  stat: {
    id: 'stat',
    slots: [
      { key: 'value', max: 10, required: true, hint: 'a figure FROM THE BRIEF, e.g. 500+, 24h, 98%' },
      { key: 'label', max: 48, required: true, hint: 'what the figure means' },
    ],
    variants: 2,
    nominal: 2.8,
    min: 2,
    max: 4,
    surfaces: ['primary', 'light', 'accent'],
  },
  offer: {
    id: 'offer',
    slots: [
      { key: 'kicker', max: 24, hint: 'e.g. SPECIAL OFFER' },
      { key: 'oldPrice', max: 16, hint: 'previous price ONLY if given' },
      { key: 'price', max: 18, required: true, hint: 'price or discount FROM THE BRIEF' },
      { key: 'badge', max: 10, hint: 'e.g. -30%' },
      { key: 'note', max: 48, hint: 'condition or end date FROM THE BRIEF' },
    ],
    variants: 2,
    nominal: 3.2,
    min: 2.2,
    max: 5,
    surfaces: ['accent', 'primary', 'light'],
  },
  quote: {
    id: 'quote',
    slots: [
      { key: 'quote', max: 110, required: true, hint: 'customer testimonial FROM THE BRIEF' },
      { key: 'author', max: 32, required: true, hint: 'name of the customer' },
    ],
    variants: 1,
    nominal: 4,
    min: 3,
    max: 6,
    surfaces: ['light', 'secondary'],
  },
  event: {
    id: 'event',
    slots: [
      { key: 'title', max: 40, required: true, hint: 'event name' },
      { key: 'date', max: 24, required: true, hint: 'date FROM THE BRIEF' },
      { key: 'time', max: 16, hint: 'time FROM THE BRIEF' },
      { key: 'place', max: 40, hint: 'place FROM THE BRIEF' },
    ],
    variants: 1,
    nominal: 3.6,
    min: 2.6,
    max: 5.5,
    surfaces: ['light', 'primary'],
  },
  gallery: {
    id: 'gallery',
    slots: [{ key: 'caption', max: 40, hint: 'short caption' }],
    image: 'required',
    minImages: 2,
    variants: 1,
    nominal: 3,
    min: 2.2,
    max: 4.5,
    surfaces: ['light', 'secondary'],
  },
  wordswap: {
    id: 'wordswap',
    slots: [
      { key: 'lead', max: 24, required: true, hint: 'lead-in, e.g. "Here it is"' },
      { key: 'w1', max: 16, required: true, hint: 'one strong word' },
      { key: 'w2', max: 16, required: true, hint: 'one strong word' },
      { key: 'w3', max: 16, required: true, hint: 'one strong word' },
    ],
    variants: 1,
    nominal: 3,
    min: 2.2,
    max: 4.5,
    surfaces: ['secondary', 'primary', 'light'],
  },
  cta: {
    id: 'cta',
    slots: [
      { key: 'title', max: 40, required: true, hint: 'closing invitation' },
      { key: 'action', max: 26, required: true, hint: 'button text, e.g. Order on WhatsApp' },
      { key: 'contact', max: 40, hint: 'phone, address or site FROM THE BRIEF' },
    ],
    variants: 2,
    nominal: 3,
    min: 2.2,
    max: 4.5,
    surfaces: ['primary', 'accent', 'light'],
  },
  logo: {
    id: 'logo',
    slots: [{ key: 'tagline', max: 48, hint: 'brand signature line' }],
    variants: 2,
    nominal: 2.4,
    min: 1.8,
    max: 3.5,
    surfaces: ['light', 'primary'],
  },
};

// ─── Balisage ───────────────────────────────────────────────────────────────

/**
 * Le HTML intérieur d'une scène. Classes Tailwind pour la mise en page (la
 * feuille est compilée côté serveur à partir des classes réellement utilisées),
 * CSS du moteur pour l'échelle et les surfaces.
 */
export function sceneMarkup(ctx: SceneContext): string {
  const { scene, orient } = ctx;
  const s = scene.slots;
  const v = scene.variant;
  const land = orient === 'landscape';
  const deco = decor(ctx.index * 2 + v);

  switch (scene.sceneId) {
    case 'hook': {
      const words = (s.title || '').split(/\s+/).filter(Boolean);
      if (v === 2 && words.length >= 2 && words.length <= 6) {
        return `${deco}
<div class="safe items-center justify-center text-center">
  ${words.map((w) => `<div data-r="flash" class="absolute inset-0 flex items-center justify-center"><span class="display uppercase" style="font-size:calc(var(--u)*${Math.max(12, Math.min(30, 120 / Math.max(3, w.length)))});line-height:1">${esc(w)}</span></div>`).join('')}
  <div data-r="final" class="w-full"><h1 data-r="title" class="display fit" ${fit(17, 8, 3)}>${emphasize(s.title)}</h1></div>
</div>`;
      }
      if (v === 1) {
        return `${deco}
<div class="safe justify-center">
  ${s.kicker ? `<p data-r="kicker" class="kicker mb-[calc(var(--u)*3)]">${esc(s.kicker)}</p>` : ''}
  <div class="relative">
    <div data-r="block" class="absolute -inset-x-[calc(var(--u)*3)] -inset-y-[calc(var(--u)*2)] rounded-[calc(var(--u)*2)]" style="background:var(--hl);opacity:.14;transform-origin:left center"></div>
    <h1 data-r="title" class="display fit relative text-left" ${fit(18, 8, 4)}>${emphasize(s.title)}</h1>
  </div>
  <div data-r="bar" class="mt-[calc(var(--u)*4)] h-[calc(var(--u)*1.4)] w-[28%] rounded-full" style="background:var(--hl);transform-origin:left center"></div>
</div>`;
      }
      return `${deco}
<div class="safe items-center justify-center text-center">
  ${s.kicker ? `<p data-r="kicker" class="kicker mb-[calc(var(--u)*4)]">${esc(s.kicker)}</p>` : ''}
  <h1 data-r="title" class="display fit" ${fit(17, 8, 3)}>${emphasize(s.title)}</h1>
  <div data-r="bar" class="mt-[calc(var(--u)*5)] h-[calc(var(--u)*1.4)] w-[22%] rounded-full" style="background:var(--hl)"></div>
</div>`;
    }

    case 'statement': {
      if (v === 1) {
        return `${deco}
<div class="safe items-center justify-center text-center">
  <div data-r="bracket" class="bracket bracket-l"></div>
  <h2 data-r="title" class="display fit px-[calc(var(--u)*6)]" ${fit(11, 6, 4)}>${emphasize(s.title)}</h2>
  ${s.sub ? `<p data-r="sub" class="body fit mt-[calc(var(--u)*4)] px-[calc(var(--u)*6)]" style="color:var(--muted)" ${fit(5, 3.2, 3)}>${esc(s.sub)}</p>` : ''}
  <div data-r="bracket" class="bracket bracket-r"></div>
</div>`;
      }
      return `${deco}
<div class="safe justify-center">
  <h2 data-r="title" class="display fit" ${fit(11, 6, 4)}>${esc(s.title)}</h2>
  <svg data-r="underline" class="mt-[calc(var(--u)*3)] w-[55%]" viewBox="0 0 300 24" fill="none"><path data-draw d="M4 16 C 80 4, 200 4, 296 14" stroke="var(--hl)" stroke-width="9" stroke-linecap="round"/></svg>
  ${s.sub ? `<p data-r="sub" class="body fit mt-[calc(var(--u)*4)]" style="color:var(--muted)" ${fit(5, 3.2, 3)}>${esc(s.sub)}</p>` : ''}
</div>`;
    }

    case 'product': {
      const price = s.price
        ? `<div data-r="price" class="price-tag display">${esc(s.price)}</div>`
        : '';
      if (scene.image && v === 0) {
        return `<div data-r="media" class="media"><img data-r="img" src="${attr(scene.image)}" alt=""></div>
<div class="scrim"></div>
<div class="safe justify-end">
  ${price ? `<div class="mb-[calc(var(--u)*4)]">${price}</div>` : ''}
  <h2 data-r="name" class="display fit" ${fit(13, 7, 2)}>${esc(s.name)}</h2>
  ${s.tagline ? `<p data-r="tagline" class="body fit mt-[calc(var(--u)*2.5)]" ${fit(5.2, 3.4, 2)}>${esc(s.tagline)}</p>` : ''}
</div>`;
      }
      if (scene.image) {
        return `${deco}
<div class="safe ${land ? 'flex-row items-center gap-[calc(var(--u)*6)]' : 'justify-center'}">
  <div data-r="card" class="card ${land ? 'h-full w-[48%]' : 'h-[52%] w-full'}"><img data-r="img" src="${attr(scene.image)}" alt=""></div>
  <div class="${land ? 'flex-1' : 'mt-[calc(var(--u)*5)]'}">
    <h2 data-r="name" class="display fit" ${fit(11, 6, 2)}>${esc(s.name)}</h2>
    ${s.tagline ? `<p data-r="tagline" class="body fit mt-[calc(var(--u)*2)]" style="color:var(--muted)" ${fit(5, 3.2, 2)}>${esc(s.tagline)}</p>` : ''}
    ${price ? `<div class="mt-[calc(var(--u)*4)]">${price}</div>` : ''}
  </div>
</div>`;
      }
      return `${deco}
<div class="safe items-center justify-center text-center">
  <p data-r="kicker" class="kicker mb-[calc(var(--u)*3)]">${esc(ctx.theme.brandName)}</p>
  <h2 data-r="name" class="display fit" ${fit(16, 8, 3)}>${esc(s.name)}</h2>
  ${s.tagline ? `<p data-r="tagline" class="body fit mt-[calc(var(--u)*3)]" style="color:var(--muted)" ${fit(5.2, 3.4, 2)}>${esc(s.tagline)}</p>` : ''}
  ${price ? `<div class="mt-[calc(var(--u)*6)]">${price}</div>` : ''}
</div>`;
    }

    case 'benefits': {
      const items = [s.b1, s.b2, s.b3].filter(Boolean);
      if (v === 1) {
        return `${deco}
<div class="safe justify-center">
  ${s.title ? `<h2 data-r="title" class="display fit mb-[calc(var(--u)*5)]" ${fit(11, 6, 2)}>${esc(s.title)}</h2>` : ''}
  <div class="flex ${land ? 'flex-row' : 'flex-col'} gap-[calc(var(--u)*3)]">
    ${items.map((b, i) => `<div data-r="item" class="benefit-card flex-1"><span class="display benefit-num">0${i + 1}</span><span class="body fit font-bold" ${fit(7, 3.8, 2)}>${esc(b)}</span></div>`).join('')}
  </div>
</div>`;
      }
      return `${deco}
<div class="safe justify-center">
  ${s.title ? `<h2 data-r="title" class="display fit mb-[calc(var(--u)*7)]" ${fit(12, 6, 2)}>${esc(s.title)}</h2>` : ''}
  <ul class="flex flex-col gap-[calc(var(--u)*5.5)]">
    ${items.map((b) => `<li data-r="item" class="flex items-center gap-[calc(var(--u)*4.5)]"><span data-r="tick" class="tick">${ICONS.check}</span><span class="body fit font-bold" ${fit(8, 4, 2)}>${esc(b)}</span></li>`).join('')}
  </ul>
</div>`;
    }

    case 'stat': {
      if (v === 1) {
        return `${deco}
<div class="safe justify-center">
  <div data-r="value" data-count="${attr(s.value)}" class="display stat-value text-left">${esc(s.value)}</div>
  <div data-r="line" class="my-[calc(var(--u)*4)] h-[calc(var(--u)*1)] w-[40%] rounded-full" style="background:var(--hl);transform-origin:left center"></div>
  <p data-r="label" class="body fit font-semibold" ${fit(6.5, 3.6, 3)}>${esc(s.label)}</p>
</div>`;
      }
      return `${deco}
<div class="safe items-center justify-center text-center">
  <div class="relative flex items-center justify-center" style="width:calc(var(--u)*70);height:calc(var(--u)*70)">
    <svg data-r="ring" class="absolute inset-0" viewBox="0 0 200 200" fill="none"><circle data-draw cx="100" cy="100" r="92" stroke="var(--hl)" stroke-width="7" stroke-linecap="round" transform="rotate(-90 100 100)"/></svg>
    <div data-r="value" data-count="${attr(s.value)}" class="display stat-value">${esc(s.value)}</div>
  </div>
  <p data-r="label" class="body fit mt-[calc(var(--u)*5)] font-semibold" ${fit(6, 3.6, 3)}>${esc(s.label)}</p>
</div>`;
    }

    case 'offer': {
      const badge = s.badge ? `<div data-r="badge" class="badge display">${esc(s.badge)}</div>` : '';
      if (v === 1 && s.badge) {
        return `${deco}
<div class="safe ${land ? 'flex-row items-center justify-around' : 'items-center justify-center text-center'}">
  <div class="relative flex items-center justify-center" style="width:calc(var(--u)*${land ? 60 : 62});aspect-ratio:1">
    <svg data-r="rays" class="absolute inset-0" viewBox="0 0 200 200" style="color:var(--hl)">${Array.from({ length: 16 }, (_, i) => `<rect x="98" y="0" width="4" height="30" rx="2" fill="currentColor" transform="rotate(${i * 22.5} 100 100)"/>`).join('')}</svg>
    <div data-r="burst" class="burst display">${esc(s.badge)}</div>
  </div>
  <div class="${land ? 'max-w-[45%]' : 'mt-[calc(var(--u)*5)] w-full'}">
    ${s.kicker ? `<p data-r="kicker" class="kicker">${esc(s.kicker)}</p>` : ''}
    <div data-r="price" class="display fit" ${fit(15, 8, 1)}>${esc(s.price)}</div>
    ${s.note ? `<p data-r="note" class="body fit mt-[calc(var(--u)*2)]" style="color:var(--muted)" ${fit(4.6, 3.2, 2)}>${esc(s.note)}</p>` : ''}
  </div>
</div>`;
      }
      return `${deco}
<div class="safe items-center justify-center text-center">
  ${s.kicker ? `<p data-r="kicker" class="kicker mb-[calc(var(--u)*3)]">${esc(s.kicker)}</p>` : ''}
  ${s.oldPrice || badge ? `<div class="mb-[calc(var(--u)*3)] flex items-center justify-center gap-[calc(var(--u)*5)]">
    ${s.oldPrice ? `<div class="relative inline-block"><span data-r="old" class="body old-price">${esc(s.oldPrice)}</span><span data-r="strike" class="strike"></span></div>` : ''}
    ${badge}
  </div>` : ''}
  <div data-r="price" class="display fit" ${fit(19, 9, 2)}>${esc(s.price)}</div>
  ${s.note ? `<p data-r="note" class="body fit mt-[calc(var(--u)*4)]" style="color:var(--muted)" ${fit(4.8, 3.2, 2)}>${esc(s.note)}</p>` : ''}
</div>`;
    }

    case 'quote':
      return `${deco}
<div class="safe justify-center">
  <div data-r="mark" class="quote-mark">${ICONS.quote}</div>
  <blockquote data-r="quote" class="display fit mt-[calc(var(--u)*4)]" style="font-weight:600" ${fit(8, 4.4, 5)}>${esc(s.quote)}</blockquote>
  <div class="mt-[calc(var(--u)*5)] flex items-center gap-[calc(var(--u)*3)]">
    <span data-r="line" class="h-[calc(var(--u)*0.8)] w-[calc(var(--u)*10)] rounded-full" style="background:var(--hl);transform-origin:left center"></span>
    <span data-r="author" class="body font-semibold" style="font-size:calc(var(--u)*4.4)">${esc(s.author)}</span>
  </div>
</div>`;

    case 'event': {
      const rows = [
        s.date ? ['calendar', s.date] : null,
        s.time ? ['clock', s.time] : null,
        s.place ? ['pin', s.place] : null,
      ].filter(Boolean) as [keyof typeof ICONS, string][];
      return `${deco}
<div class="safe justify-center">
  <p data-r="kicker" class="kicker mb-[calc(var(--u)*3)]">${esc(ctx.theme.brandName)}</p>
  <h2 data-r="title" class="display fit" ${fit(12, 6, 3)}>${esc(s.title)}</h2>
  <div class="mt-[calc(var(--u)*6)] flex flex-col gap-[calc(var(--u)*3.5)]">
    ${rows.map(([icon, text]) => `<div data-r="row" class="event-row"><span class="event-icon">${ICONS[icon]}</span><span class="body fit font-semibold" ${fit(5.6, 3.4, 2)}>${esc(text)}</span></div>`).join('')}
  </div>
</div>`;
    }

    case 'gallery': {
      const imgs = (scene.images || []).slice(0, 3);
      const cls = imgs.length === 3 ? (land ? 'g3-land' : 'g3') : 'g2';
      return `<div class="safe">
  <div class="gallery ${cls}">
    ${imgs.map((src) => `<div data-r="tile" class="tile"><img data-r="img" src="${attr(src)}" alt=""></div>`).join('')}
  </div>
  ${s.caption ? `<p data-r="caption" class="display fit mt-[calc(var(--u)*4)] text-center" ${fit(7, 4.4, 2)}>${esc(s.caption)}</p>` : ''}
</div>`;
    }

    case 'wordswap': {
      const words = [s.w1, s.w2, s.w3].filter(Boolean);
      return `${deco}
<div class="safe items-center justify-center text-center">
  <p data-r="lead" class="body fit font-semibold" style="color:var(--muted)" ${fit(7, 4, 2)}>${esc(s.lead)}</p>
  <div class="swap-window mt-[calc(var(--u)*3)]">
    ${words.map((w) => `<div data-r="word" class="swap-word display"><span class="fit" ${fit(16, 7, 1)}>${esc(w)}</span></div>`).join('')}
  </div>
</div>`;
    }

    case 'cta': {
      if (v === 1) {
        return `${deco}
<div class="safe justify-center">
  <h2 data-r="title" class="display fit" ${fit(12, 6, 3)}>${esc(s.title)}</h2>
  <div class="mt-[calc(var(--u)*7)] flex items-center gap-[calc(var(--u)*4)]">
    <div data-r="circle" class="cta-circle">${ICONS.arrow}</div>
    <p data-r="action" class="display fit flex-1" ${fit(7, 4.2, 2)}>${esc(s.action)}</p>
  </div>
  ${s.contact ? `<p data-r="contact" class="body mt-[calc(var(--u)*6)] font-semibold" style="font-size:calc(var(--u)*4.6);color:var(--muted)">${esc(s.contact)}</p>` : ''}
</div>`;
      }
      return `${deco}
<div class="safe items-center justify-center text-center">
  <h2 data-r="title" class="display fit" ${fit(12, 6, 3)}>${emphasize(s.title)}</h2>
  <div data-r="button" class="cta-button display mt-[calc(var(--u)*7)]"><span>${esc(s.action)}</span><span class="cta-arrow">${ICONS.arrow}</span></div>
  ${s.contact ? `<p data-r="contact" class="body mt-[calc(var(--u)*5)] font-semibold" style="font-size:calc(var(--u)*4.6)">${esc(s.contact)}</p>` : ''}
</div>`;
    }

    case 'logo':
    default: {
      const mark = ctx.logo
        ? `<img data-r="logo" class="logo-img" src="${attr(ctx.logo)}" alt=""><div data-r="logo-fallback" class="display fit" style="display:none" ${fit(14, 7, 2)}>${esc(ctx.theme.brandName)}</div>`
        : `<div data-r="logo" class="display fit" ${fit(14, 7, 2)}>${esc(ctx.theme.brandName)}</div>`;
      if (v === 1) {
        return `<div data-r="rings" class="logo-rings"><span></span><span></span><span></span></div>
<div class="safe items-center justify-center text-center">
  <div data-r="plate" class="logo-plate">${mark}</div>
  ${s.tagline ? `<p data-r="tagline" class="body fit mt-[calc(var(--u)*6)] font-semibold" ${fit(5, 3.4, 2)}>${esc(s.tagline)}</p>` : ''}
</div>`;
      }
      return `${deco}
<div class="safe items-center justify-center text-center">
  <div data-r="reveal" class="logo-reveal">${mark}</div>
  <div data-r="bar" class="mt-[calc(var(--u)*5)] h-[calc(var(--u)*1)] w-[18%] rounded-full" style="background:var(--hl)"></div>
  ${s.tagline ? `<p data-r="tagline" class="body fit mt-[calc(var(--u)*4)] font-semibold" style="color:var(--muted)" ${fit(5, 3.4, 2)}>${esc(s.tagline)}</p>` : ''}
</div>`;
    }
  }
}
