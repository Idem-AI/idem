/**
 * LES COMPOSITIONS DE VISUELS DU CODE — crans Low, Medium et High de la jauge de créativité.
 *
 * Aux crans Max et Ultra, l'IA écrit le HTML du visuel. En dessous, le CODE compose : douze
 * compositions éprouvées, calculées sur la grille du visuel (`design/compositionGrid.ts` :
 * marges de sécurité, césure 62/38, point focal), aux couleurs et polices exactes de la
 * charte. L'IA n'y écrit que les mots (et, aux crans supérieurs, choisit la structure puis la
 * composition dans un menu filtré par la direction artistique).
 *
 * Chaque composition :
 *  - prend sa couleur de texte selon le contraste RÉEL avec son fond (≥ 4,5:1) ;
 *  - pose le logo dans la déclinaison qui contraste (le rendu le revérifie sur les pixels) ;
 *  - ne dessine jamais de bouton (l'appel à l'action vit dans la légende du post) ;
 *  - passe ensuite par le même rendu contrôlé et réparé que les visuels de l'IA.
 */
import { CompositionGrid } from '../design/compositionGrid';
import { contrastRatio } from '../design/color';

export type FlyerStructure = 'photo' | 'type' | 'fact' | 'quote';

export type FlyerLayoutId =
  | 'photoSplit'
  | 'bandOverPhoto'
  | 'framedPhoto'
  | 'circlePhoto'
  | 'minimalCaption'
  | 'stripeOverPhoto'
  | 'diagonalSplit'
  | 'bentoGrid'
  | 'typePoster'
  | 'outlinePoster'
  | 'bigFact'
  | 'quoteCard';

export interface FlyerCopy {
  kicker?: string;
  headline: string;
  sub?: string;
  /** Un fait chiffré tiré du contenu (prix, date, pourcentage) — jamais inventé. */
  detail?: string;
}

export interface FlyerPalette {
  primary: string;
  secondary: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface FlyerLayoutInput {
  copy: FlyerCopy;
  brandName: string;
  palette: FlyerPalette;
  logo: { onLight?: string; onDark?: string };
  image?: string;
  width: number;
  height: number;
  grid: CompositionGrid;
  /** Index du mot du titre mis en valeur (désigné par l'agent, sinon le plus long). */
  emphasis?: number;
}

/** Ce que chaque composition dit, pour le menu de l'agent, et la structure qu'elle sert. */
export const FLYER_LAYOUTS: Record<FlyerLayoutId, { structures: FlyerStructure[]; summary: string }> = {
  photoSplit: { structures: ['photo'], summary: 'photo on 62 % of the frame, headline on a brand-colour panel beside it' },
  bandOverPhoto: { structures: ['photo'], summary: 'full photo, a solid brand band carries the headline' },
  framedPhoto: { structures: ['photo'], summary: 'photo inset in a thick offset frame, headline on the paper' },
  circlePhoto: { structures: ['photo'], summary: 'photo in a large circle, headline beside it on a brand colour' },
  minimalCaption: { structures: ['photo'], summary: 'the photo speaks, a small caption block with a fine rule in a corner' },
  stripeOverPhoto: { structures: ['photo'], summary: 'a tilted brand stripe crosses the photo with the headline on it' },
  diagonalSplit: { structures: ['photo', 'type'], summary: 'the frame cut on a diagonal: brand colour with the headline, photo or accent on the other side' },
  bentoGrid: { structures: ['photo'], summary: 'a bento grid: big photo cell, a brand cell with the headline, a small fact cell' },
  typePoster: { structures: ['type'], summary: 'typographic poster: the headline stacked huge on the brand colour' },
  outlinePoster: { structures: ['type'], summary: 'poster lines alternating solid and outline type' },
  bigFact: { structures: ['fact'], summary: 'the number or price fills the frame, the headline explains it' },
  quoteCard: { structures: ['quote', 'type'], summary: 'a giant quotation mark, the sentence as a quote' },
};
export const FLYER_LAYOUT_IDS = Object.keys(FLYER_LAYOUTS) as FlyerLayoutId[];

/** Ce que la DA du catalogue exclut (cf. video.artdirection.ts : même esprit). */
export const FLYER_ART_EXCLUDES: Record<string, FlyerLayoutId[]> = {
  minimalism: ['stripeOverPhoto', 'outlinePoster', 'diagonalSplit', 'bentoGrid'],
  swiss: ['circlePhoto', 'stripeOverPhoto'],
  editorial: ['stripeOverPhoto', 'outlinePoster'],
  victorian: ['stripeOverPhoto', 'diagonalSplit', 'outlinePoster', 'bentoGrid'],
  glassmorphism: ['stripeOverPhoto'],
  aurora: ['bentoGrid'],
};
/** Ce que la DA favorise. */
export const FLYER_ART_BOOSTS: Record<string, Partial<Record<FlyerLayoutId, number>>> = {
  minimalism: { minimalCaption: 2, framedPhoto: 1.5, photoSplit: 1 },
  swiss: { photoSplit: 2, bentoGrid: 2, typePoster: 1.5, bigFact: 1.5 },
  editorial: { framedPhoto: 2, minimalCaption: 1.5, quoteCard: 1.5 },
  maximalism: { stripeOverPhoto: 2, outlinePoster: 2, diagonalSplit: 1.5 },
  'pop-art': { stripeOverPhoto: 2, typePoster: 2, circlePhoto: 1.5 },
  graffiti: { outlinePoster: 2, stripeOverPhoto: 2 },
  'collage-art': { framedPhoto: 2, bentoGrid: 1.5 },
  cyberpunk: { diagonalSplit: 2, outlinePoster: 1.5 },
  y2k: { circlePhoto: 2, stripeOverPhoto: 1.5 },
};

/** Les compositions possibles pour une structure, sous une DA, moins celles des derniers visuels. */
export function flyerLayoutMenu(structure: FlyerStructure, opts: { styleId?: string; recent?: string[]; size?: number } = {}): FlyerLayoutId[] {
  const style = (opts.styleId || '').toLowerCase();
  const excluded = new Set(FLYER_ART_EXCLUDES[style] || []);
  const boosts = FLYER_ART_BOOSTS[style] || {};
  const recent = (opts.recent || []).slice(-4);
  return FLYER_LAYOUT_IDS.filter((id) => FLYER_LAYOUTS[id].structures.includes(structure) && !excluded.has(id))
    .map((id) => ({ id, w: 1 + (boosts[id] || 0) - recent.filter((r) => r === id).length * 1.2 - (recent[recent.length - 1] === id ? 2 : 0) }))
    .sort((a, b) => b.w - a.w || a.id.localeCompare(b.id))
    .slice(0, opts.size ?? 4)
    .map((x) => x.id);
}

/** Le choix du code : le meilleur de la structure, varié par la graine parmi les premiers. */
export function pickFlyerLayout(structure: FlyerStructure, seed: number, opts: { styleId?: string; recent?: string[] } = {}): FlyerLayoutId {
  const menu = flyerLayoutMenu(structure, { ...opts, size: 3 });
  if (!menu.length) return structure === 'fact' ? 'bigFact' : structure === 'photo' ? 'photoSplit' : 'typePoster';
  return menu[Math.abs(seed) % menu.length];
}

// ─── Rendu ──────────────────────────────────────────────────────────────────

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** La couleur de texte la plus lisible sur ce fond, parmi celles de la charte puis le noir et le blanc. */
export function textOn(bg: string, palette: FlyerPalette): string {
  const candidates = [palette.text, palette.background, '#111111', '#ffffff'].filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c));
  return candidates.map((c) => ({ c, r: contrastRatio(c, bg) })).sort((a, b) => b.r - a.r).find((x) => x.r >= 4.5)?.c || candidates.sort((a, b) => contrastRatio(b, bg) - contrastRatio(a, bg))[0] || '#111111';
}

/**
 * Une couleur d'accent qui se détache sur ce fond (sinon la couleur de texte). Seuil 3:1 pour
 * un grand texte (titre), 4,5:1 pour un petit (sur-titre) — les seuils WCAG du texte.
 */
function accentOn(bg: string, palette: FlyerPalette, min = 3): string {
  const options = [palette.accent, palette.secondary, palette.primary].filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c));
  return options.find((c) => contrastRatio(c, bg) >= min) || textOn(bg, palette);
}

const isDark = (hex: string) => contrastRatio('#ffffff', hex) > contrastRatio('#111111', hex);

/** Taille de titre qui tient dans la boîte (estimation ; le rendu mesuré répare le reste). */
export function fitSize(text: string, boxWidth: number, maxLines: number, max: number, min: number, charWidth = 0.58): number {
  const chars = Math.max(4, text.length);
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  const byLines = (boxWidth * maxLines) / (chars * charWidth);
  const byWord = boxWidth / (longest * (charWidth + 0.06));
  return Math.round(Math.max(min, Math.min(max, byLines, byWord)));
}

/** Lignes qu'occupera un texte à cette taille (estimation). */
const linesAt = (text: string, size: number, width: number, charWidth: number) => Math.max(1, Math.ceil((text.length * charWidth * size) / Math.max(1, width)));

/** Le titre, avec son mot mis en valeur dans la couleur d'accent. */
function headlineHtml(text: string, emphasis: number | undefined, accent: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  let at = emphasis != null && emphasis >= 0 && emphasis < words.length ? emphasis : -1;
  if (at < 0 && words.length >= 3) {
    at = words.length - 1;
    for (let i = Math.max(0, words.length - 3); i < words.length; i++) if (words[i].length > words[at].length) at = i;
  }
  return words.map((w, i) => (i === at ? `<span style="color:${accent}">${esc(w)}</span>` : esc(w))).join(' ');
}

function logoHtml(input: FlyerLayoutInput, bg: string, x: string, y: string, height: number): string {
  const src = isDark(bg) ? input.logo.onDark || input.logo.onLight : input.logo.onLight || input.logo.onDark;
  if (!src) return `<div class="font-primary" style="position:absolute;${x};${y};font-size:${Math.round(height * 0.55)}px;font-weight:800;letter-spacing:0.02em;color:${textOn(bg, input.palette)}">${esc(input.brandName)}</div>`;
  return `<img data-role="logo" src="${esc(src)}" alt="${esc(input.brandName)}" style="position:absolute;${x};${y};height:${height}px;width:auto;object-fit:contain" />`;
}

function textBlock(input: FlyerLayoutInput, opts: { bg: string; width: number; height?: number; maxLines: number; max: number; align?: 'left' | 'center'; kicker?: boolean; subColor?: string }): string {
  const { copy, palette } = input;
  const ink = textOn(opts.bg, palette);
  const accent = accentOn(opts.bg, palette);
  let size = fitSize(copy.headline, opts.width, opts.maxLines, opts.max, 26);
  // La hauteur disponible borne aussi la taille : sur-titre, titre et sous-titre tiennent dans la case.
  if (opts.height) {
    const total = (sz: number) => {
      const sub = Math.max(22, Math.round(sz * 0.36));
      return (
        linesAt(copy.headline, sz, opts.width, 0.6) * sz * 1.04 +
        (copy.kicker && opts.kicker !== false ? sz * 0.3 * 1.3 + sz * 0.32 : 0) +
        (copy.sub ? sz * 0.32 + linesAt(copy.sub, sub, opts.width * 0.92, 0.52) * sub * 1.32 : 0)
      );
    };
    while (size > 26 && total(size) > opts.height * 0.9) size = Math.round(size * 0.92);
  }
  const align = opts.align || 'left';
  return [
    `<div style="display:flex;flex-direction:column;gap:${Math.round(size * 0.32)}px;text-align:${align};align-items:${align === 'center' ? 'center' : 'flex-start'};width:${opts.width}px">`,
    copy.kicker && opts.kicker !== false ? `<div class="font-secondary" style="font-size:${Math.round(size * 0.3)}px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${accentOn(opts.bg, palette, 4.5)}">${esc(copy.kicker)}</div>` : '',
    `<div class="font-primary" style="font-size:${size}px;line-height:1.02;font-weight:800;letter-spacing:-0.02em;color:${ink}">${headlineHtml(copy.headline, input.emphasis, accent)}</div>`,
    copy.sub ? `<div class="font-secondary" style="font-size:${Math.max(24, Math.round(size * 0.36))}px;line-height:1.3;color:${opts.subColor || ink};opacity:0.9;max-width:${Math.round(opts.width * 0.92)}px">${esc(copy.sub)}</div>` : '',
    '</div>',
  ].join('');
}

const photo = (src: string, style: string) => `<img src="${esc(src)}" alt="" style="position:absolute;object-fit:cover;${style}" />`;

/** La composition `id`, en HTML autonome (racine aux dimensions du format). */
export function renderFlyerLayout(id: FlyerLayoutId, input: FlyerLayoutInput): string {
  const { width: W, height: H, grid, palette } = input;
  const s = grid.safe;
  const bgPaper = palette.background && /^#[0-9a-f]{6}$/i.test(palette.background) ? palette.background : '#ffffff';
  const short = Math.min(W, H);
  const logoH = Math.round(short * 0.06);
  const root = (bg: string, body: string) => `<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${bg}">${body}</div>`;
  const tf = grid.typeField;
  const img = input.image;

  switch (id) {
    case 'photoSplit': {
      if (!img) return renderFlyerLayout('typePoster', input);
      const bg = palette.primary;
      const f = grid.imageField;
      return root(
        bg,
        photo(img, `left:${f.x}px;top:${f.y}px;width:${f.width}px;height:${f.height}px`) +
          `<div style="position:absolute;left:${tf.x + s * 0.5}px;top:${tf.y + s * 0.5}px;width:${tf.width - s}px;height:${tf.height - s * 1.5 - logoH}px;display:flex;flex-direction:column;justify-content:center">${textBlock(input, { bg, width: tf.width - s * 1.5, height: tf.height - s * 1.5 - logoH, maxLines: 4, max: 110 })}</div>` +
          logoHtml(input, bg, `left:${tf.x + s * 0.5}px`, `bottom:${s}px`, logoH)
      );
    }
    case 'bandOverPhoto': {
      if (!img) return renderFlyerLayout('typePoster', input);
      const bg = palette.primary;
      const bandH = Math.round(H * (H > W ? 0.34 : 0.4));
      return root(
        bg,
        photo(img, `inset:0;width:100%;height:100%`) +
          `<div style="position:absolute;left:0;right:0;bottom:0;height:${bandH}px;background:${bg};padding:${Math.round(s * 0.7)}px ${s}px;display:flex;align-items:center">${textBlock(input, { bg, width: W - s * 2 - logoH * 3, height: bandH - s * 1.4, maxLines: 3, max: 96 })}</div>` +
          logoHtml(input, bg, `right:${s}px`, `bottom:${s}px`, logoH)
      );
    }
    case 'framedPhoto': {
      if (!img) return renderFlyerLayout('quoteCard', input);
      const bg = bgPaper;
      const f = grid.imageField;
      const inset = Math.round(short * 0.05);
      const accent = accentOn(bg, palette);
      return root(
        bg,
        `<div style="position:absolute;left:${f.x + inset * 1.6}px;top:${f.y + inset * 1.6}px;width:${f.width - inset * 2}px;height:${f.height - inset * 2}px;border:${Math.round(short * 0.012)}px solid ${accent}"></div>` +
          photo(img, `left:${f.x + inset}px;top:${f.y + inset}px;width:${f.width - inset * 2}px;height:${f.height - inset * 2}px`) +
          `<div style="position:absolute;left:${tf.x + s * 0.5}px;top:${tf.y + s * 0.5}px;width:${tf.width - s}px;height:${tf.height - s}px;display:flex;flex-direction:column;justify-content:center">${textBlock(input, { bg, width: tf.width - s * 1.5, height: tf.height - s, maxLines: 4, max: 96 })}</div>` +
          logoHtml(input, bg, `right:${s}px`, `top:${s}px`, logoH)
      );
    }
    case 'circlePhoto': {
      if (!img) return renderFlyerLayout('typePoster', input);
      const bg = palette.secondary || palette.primary;
      // Story, post, A4 : le cercle au-dessus du texte. Carré et bannière : côte à côte.
      const portrait = H > W * 1.15;
      const d = Math.round(short * (portrait ? 0.62 : 0.66));
      // Côte à côte, le cercle déborde du bord droit : la colonne de texte garde de quoi porter un grand titre.
      const cx = portrait ? (W - d) / 2 : W - d * 0.74;
      const cy = portrait ? s * 1.4 : (H - d) / 2;
      const textTop = portrait ? cy + d + s * 0.8 : s;
      const textW = portrait ? W - s * 2 : Math.round(W - d * 0.74 - s * 2.4);
      return root(
        bg,
        `<div style="position:absolute;left:${cx - d * 0.04}px;top:${cy - d * 0.04}px;width:${d * 1.08}px;height:${d * 1.08}px;border-radius:50%;background:${accentOn(bg, palette)}"></div>` +
          photo(img, `left:${cx}px;top:${cy}px;width:${d}px;height:${d}px;border-radius:50%`) +
          `<div style="position:absolute;left:${s}px;top:${textTop}px;width:${textW}px;bottom:${s * 2 + logoH}px;display:flex;flex-direction:column;justify-content:center">${textBlock(input, { bg, width: textW, height: (portrait ? H - textTop : H - s) - s * 2 - logoH, maxLines: 3, max: 100, align: portrait ? 'center' : 'left' })}</div>` +
          logoHtml(input, bg, portrait ? `left:${(W - logoH * 3) / 2}px` : `left:${s}px`, `bottom:${s}px`, logoH)
      );
    }
    case 'minimalCaption': {
      if (!img) return renderFlyerLayout('quoteCard', input);
      const bg = bgPaper;
      const boxW = Math.round(W * (W > H ? 0.46 : 0.72));
      const accent = accentOn(bg, palette);
      return root(
        bg,
        photo(img, `inset:0;width:100%;height:100%`) +
          `<div style="position:absolute;left:${s}px;bottom:${s}px;width:${boxW}px;background:${bg};padding:${Math.round(s * 0.7)}px">` +
          `<div style="width:${Math.round(short * 0.08)}px;height:${Math.max(3, Math.round(short * 0.006))}px;background:${accent};margin-bottom:${Math.round(s * 0.4)}px"></div>` +
          textBlock(input, { bg, width: boxW - Math.round(s * 1.4), height: Math.round(H * 0.42), maxLines: 3, max: Math.round(short * 0.085), kicker: false }) +
          `</div>` +
          logoHtml(input, bg, `right:${s}px`, `top:${s}px`, logoH)
      );
    }
    case 'stripeOverPhoto': {
      if (!img) return renderFlyerLayout('outlinePoster', input);
      const bg = palette.primary;
      const angle = W > H ? -4 : -7;
      return root(
        bg,
        photo(img, `inset:0;width:100%;height:100%`) +
          `<div style="position:absolute;left:-10%;width:120%;top:50%;transform:translateY(-50%) rotate(${angle}deg);background:${bg};padding:${Math.round(s * 0.9)}px ${Math.round(W * 0.1 + s)}px;display:flex;justify-content:center">${textBlock(input, { bg, width: Math.round(W * 0.72), height: Math.round(H * 0.42), maxLines: 2, max: 92, align: 'center' })}</div>` +
          logoHtml(input, bgPaper, `left:${s}px`, `top:${s}px`, logoH)
      );
    }
    case 'diagonalSplit': {
      const bg = palette.primary;
      // Format vertical : la diagonale court de gauche à droite (photo en haut, texte en bas) ;
      // ailleurs, de haut en bas (texte à gauche). Le texte reste toujours du côté de la couleur.
      const portrait = H > W * 1.15;
      const cut = portrait ? 'polygon(0 0,100% 0,100% 46%,0 58%)' : 'polygon(58% 0,100% 0,100% 100%,38% 100%)';
      const other = img ? photo(img, `inset:0;width:100%;height:100%;clip-path:${cut}`) : `<div style="position:absolute;inset:0;background:${accentOn(bg, palette)};clip-path:${cut}"></div>`;
      const box = portrait
        ? { left: s, top: Math.round(H * 0.6), width: W - s * 2, height: Math.round(H * 0.4) - s * 2 - logoH }
        : { left: s, top: s, width: Math.round(W * 0.38) - Math.round(s * 0.4), height: H - s * 3 - logoH };
      return root(
        bg,
        other +
          `<div style="position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;display:flex;flex-direction:column;justify-content:center">${textBlock(input, { bg, width: box.width, height: box.height, maxLines: 5, max: Math.round(short * 0.1) })}</div>` +
          logoHtml(input, bg, `left:${s}px`, `bottom:${s}px`, logoH)
      );
    }
    case 'bentoGrid': {
      if (!img) return renderFlyerLayout('typePoster', input);
      const bg = bgPaper;
      const gap = Math.round(short * 0.02);
      const inner = { x: s, y: s, w: W - s * 2, h: H - s * 2 };
      const portrait = H >= W;
      const big = portrait ? { x: inner.x, y: inner.y, w: inner.w, h: Math.round(inner.h * 0.56) } : { x: inner.x, y: inner.y, w: Math.round(inner.w * 0.58), h: inner.h };
      const cellA = portrait ? { x: inner.x, y: big.y + big.h + gap, w: Math.round(inner.w * 0.64) - gap, h: inner.h - big.h - gap } : { x: big.x + big.w + gap, y: inner.y, w: inner.w - big.w - gap, h: Math.round(inner.h * 0.66) - gap };
      const cellB = portrait ? { x: cellA.x + cellA.w + gap, y: cellA.y, w: inner.w - cellA.w - gap, h: cellA.h } : { x: cellA.x, y: cellA.y + cellA.h + gap, w: cellA.w, h: inner.h - cellA.h - gap };
      const brand = palette.primary;
      const second = palette.secondary || palette.accent || brand;
      const radius = Math.round(short * 0.02);
      return root(
        bg,
        photo(img, `left:${big.x}px;top:${big.y}px;width:${big.w}px;height:${big.h}px;border-radius:${radius}px`) +
          `<div style="position:absolute;left:${cellA.x}px;top:${cellA.y}px;width:${cellA.w}px;height:${cellA.h}px;background:${brand};border-radius:${radius}px;padding:${Math.round(s * 0.6)}px;display:flex;flex-direction:column;justify-content:flex-end">${textBlock(input, { bg: brand, width: cellA.w - Math.round(s * 1.2), height: cellA.h - Math.round(s * 1.2), maxLines: 4, max: 84, kicker: false })}</div>` +
          `<div style="position:absolute;left:${cellB.x}px;top:${cellB.y}px;width:${cellB.w}px;height:${cellB.h}px;background:${second};border-radius:${radius}px;display:flex;align-items:center;justify-content:center;padding:${Math.round(s * 0.4)}px">` +
          (input.copy.detail
            ? `<div class="font-primary" style="font-size:${fitSize(input.copy.detail, cellB.w - s * 0.8, 1, 120, 30)}px;font-weight:800;color:${textOn(second, palette)}">${esc(input.copy.detail)}</div>`
            : logoHtml(input, second, `left:${Math.round(cellB.w * 0.2)}px`, `top:${Math.round((cellB.h - logoH * 1.4) / 2)}px`, Math.round(logoH * 1.4))) +
          `</div>` +
          (input.copy.detail ? logoHtml(input, bg, `right:${s}px`, `top:${s * 0.4}px`, Math.round(logoH * 0.8)) : '')
      );
    }
    case 'typePoster': {
      const bg = palette.primary;
      const ink = textOn(bg, palette);
      const accent = accentOn(bg, palette);
      const words = input.copy.headline.split(/\s+/).filter(Boolean);
      const lines = posterLines(words, H > W ? 4 : 3);
      const width = W - s * 2;
      return root(
        bg,
        `<div style="position:absolute;left:${s}px;right:${s}px;top:${s}px;bottom:${s * 2 + logoH}px;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(s * 0.2)}px">` +
          (input.copy.kicker ? `<div class="font-secondary" style="font-size:${Math.round(short * 0.035)}px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${accentOn(bg, palette, 4.5)}">${esc(input.copy.kicker)}</div>` : '') +
          lines.map((l, i) => `<div class="font-primary" style="font-size:${posterSize(l, width, H - s * 3 - logoH, lines.length, short)}px;line-height:0.95;font-weight:900;letter-spacing:-0.03em;text-transform:uppercase;color:${i === lines.length - 1 ? accent : ink}">${esc(l)}</div>`).join('') +
          (input.copy.sub ? `<div class="font-secondary" style="margin-top:${Math.round(s * 0.4)}px;font-size:${Math.round(short * 0.032)}px;line-height:1.35;color:${ink};max-width:${Math.round(width * 0.8)}px">${esc(input.copy.sub)}</div>` : '') +
          `</div>` +
          logoHtml(input, bg, `left:${s}px`, `bottom:${s}px`, logoH)
      );
    }
    case 'outlinePoster': {
      const bg = bgPaper;
      const ink = textOn(bg, palette);
      const accent = accentOn(bg, palette);
      const words = input.copy.headline.split(/\s+/).filter(Boolean);
      const lines = posterLines(words, H > W ? 4 : 3);
      const width = W - s * 2;
      return root(
        bg,
        `<div style="position:absolute;left:${s}px;right:${s}px;top:${s}px;bottom:${s * 2 + logoH}px;display:flex;flex-direction:column;justify-content:center">` +
          lines
            .map((l, i) => {
              const size = posterSize(l, width, H - s * 3 - logoH, lines.length, short);
              const outline = i % 2 === 1 && lines.length > 2;
              return `<div class="font-primary" style="font-size:${size}px;line-height:0.95;font-weight:900;letter-spacing:-0.02em;text-transform:uppercase;${outline ? `color:transparent;-webkit-text-stroke:${Math.max(2, Math.round(size * 0.025))}px ${ink}` : `color:${i === lines.length - 1 ? accent : ink}`}">${esc(l)}</div>`;
            })
            .join('') +
          (input.copy.sub ? `<div class="font-secondary" style="margin-top:${Math.round(s * 0.5)}px;font-size:${Math.round(short * 0.032)}px;line-height:1.35;color:${ink};max-width:${Math.round(width * 0.78)}px">${esc(input.copy.sub)}</div>` : '') +
          `</div>` +
          logoHtml(input, bg, `left:${s}px`, `bottom:${s}px`, logoH)
      );
    }
    case 'bigFact': {
      const bg = palette.secondary || palette.primary;
      const ink = textOn(bg, palette);
      const accent = accentOn(bg, palette);
      const fact = input.copy.detail || input.copy.headline.split(/\s+/)[0];
      const width = W - s * 2;
      return root(
        bg,
        `<div style="position:absolute;left:${s}px;right:${s}px;top:${s}px;bottom:${s * 2 + logoH}px;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(s * 0.5)}px">` +
          `<div class="font-primary" style="font-size:${fitSize(fact, width, 1, Math.round(short * 0.42), 80)}px;line-height:0.9;font-weight:900;letter-spacing:-0.04em;color:${accent}">${esc(fact)}</div>` +
          textBlock(input, { bg, width: Math.round(width * 0.86), height: Math.round((H - s * 3 - logoH) * 0.45), maxLines: 3, max: 72, subColor: ink }) +
          `</div>` +
          logoHtml(input, bg, `left:${s}px`, `bottom:${s}px`, logoH)
      );
    }
    case 'quoteCard':
    default: {
      const bg = bgPaper;
      const accent = accentOn(bg, palette);
      const width = W - s * 2;
      return root(
        bg,
        `<div class="font-primary" style="position:absolute;left:${s - short * 0.02}px;top:${s - short * 0.06}px;font-size:${Math.round(short * 0.42)}px;line-height:1;font-weight:900;color:${accent};opacity:0.9">“</div>` +
          `<div style="position:absolute;left:${s}px;right:${s}px;top:${Math.round(s + short * 0.22)}px;bottom:${s * 2 + logoH}px;display:flex;flex-direction:column;justify-content:center">${textBlock(input, { bg, width, height: H - Math.round(s + short * 0.22) - s * 2 - logoH, maxLines: 5, max: Math.round(short * (H > W * 1.15 ? 0.11 : 0.085)) })}</div>` +
          logoHtml(input, bg, `right:${s}px`, `bottom:${s}px`, logoH)
      );
    }
  }
}

/**
 * Taille d'une ligne d'affiche : en majuscules grasses (≈ 0,74 em par lettre), sur une ligne,
 * et l'ensemble des lignes (plus le sous-titre) dans la hauteur disponible.
 */
function posterSize(line: string, width: number, height: number, count: number, short: number): number {
  const byWidth = fitSize(line, width, 1, Math.round(short * 0.22), 36, 0.74);
  const byHeight = Math.floor((height * 0.72) / (count * 0.97));
  return Math.max(36, Math.min(byWidth, byHeight));
}

/** Le titre en lignes d'affiche : les petits mots restent attachés au suivant. */
function posterLines(words: string[], maxLines: number): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    while (w.replace(/\W/g, '').length <= 3 && i < words.length - 1) w = `${w} ${words[++i]}`;
    tokens.push(w);
  }
  while (tokens.length > maxLines) {
    let best = 0;
    for (let i = 1; i < tokens.length - 1; i++) if (tokens[i].length + tokens[i + 1].length < tokens[best].length + tokens[best + 1].length) best = i;
    tokens.splice(best, 2, `${tokens[best]} ${tokens[best + 1]}`);
  }
  return tokens.length ? tokens : [''];
}
