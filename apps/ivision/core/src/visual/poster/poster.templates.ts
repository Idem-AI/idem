/**
 * LES COMPOSITIONS — dessinées par le code, pour tous les crans de créativité.
 *
 * Règles communes, celles d'un studio de graphisme :
 *  - une grille : marges de sécurité (story : l'interface du réseau couvre le haut et le bas),
 *    une unité (1 % du petit côté) pour tous les espacements ;
 *  - une échelle typographique : sur-titre, titre, sous-titre, faits — quatre tailles au plus,
 *    deux familles (celles de la charte), le titre ajusté AU MILLIMÈTRE à sa zone par le rendu ;
 *  - des zones réservées : le texte, la photo, le logo ne se chevauchent jamais par hasard ;
 *  - une couleur forte au plus, utilisée une fois (le mot en valeur ou un filet) ;
 *  - le logo là où il se lit (sinon sur un cartouche clair), jamais avec un halo ;
 *  - aucun bouton, aucune pastille, aucun décor qui ne porte pas d'information.
 */
import { contrastRatio } from '../../design/color';
import { duotoneFilter, gfxContext, gfxHtml, isNeonHex } from './kit/render';
import type { GfxParams } from './kit/types';
import { motifHtml } from './kit/motifs';
import { isDarkColor, mix, mutedOn } from './poster.schemes';
import type { PosterSpec, PosterTemplate } from './poster.types';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r = Math.round;

// ─── Briques ────────────────────────────────────────────────────────────────

/** Une colonne de texte à hauteur fixe : le rendu y ajuste toutes les tailles ensemble. */
function stack(box: Box, parts: string[], opts: { justify?: 'start' | 'center' | 'end'; align?: 'left' | 'center'; gap: number; name?: string; overPhoto?: boolean }): string {
  const align = opts.align || 'left';
  return `<div class="stack" data-stack="${opts.name || 'text'}"${opts.overPhoto ? ' data-over-photo="1"' : ''} style="left:${r(box.x)}px;top:${r(box.y)}px;width:${r(box.w)}px;height:${r(box.h)}px;justify-content:${opts.justify === 'center' ? 'center' : opts.justify === 'end' ? 'flex-end' : 'flex-start'};align-items:${align === 'center' ? 'center' : 'flex-start'};text-align:${align};gap:${r(opts.gap)}px">${parts.filter(Boolean).join('')}</div>`;
}

/** Ordre de retrait quand la place manque : le sous-titre d'abord, puis le sur-titre. */
const DROP: Record<string, number> = { sub: 1, kicker: 2 };
const fit = (cls: string, min: number, max: number, style: string, html: string) => {
  const kind = cls.split(' ')[0];
  return `<div class="fit ${cls}" data-min="${r(min)}" data-max="${r(max)}"${DROP[kind] ? ` data-drop="${DROP[kind]}"` : ''} style="font-size:${r(max)}px;${style}">${html}</div>`;
};

function kicker(spec: PosterSpec, color: string, scale = 1, bg = spec.scheme.bg): string {
  if (!spec.copy.kicker) return '';
  const u = spec.u;
  // Petit texte : 5,2:1 sur son fond (4,5 exigés + la marge du décor tonal), sinon l'encre du fond.
  const ink = /^#[0-9a-f]{6}$/i.test(color) && contrastRatio(color, bg) < 5.2 ? (contrastRatio(spec.scheme.ink, bg) >= 4.5 ? spec.scheme.ink : contrastRatio('#ffffff', bg) > contrastRatio('#111111', bg) ? '#ffffff' : '#111111') : color;
  return fit('kicker', 2.1 * u, 3.1 * u * scale, `color:${ink}`, esc(spec.copy.kicker));
}

/** Le titre ; le mot en valeur prend l'accent (s'il se lit sur ce fond). */
function headline(spec: PosterSpec, color: string, accent: string | null, opts: { max: number; min?: number; upper?: boolean; weight?: number; tight?: boolean }): string {
  const words = spec.copy.headline.split(/\s+/).filter(Boolean);
  const at = spec.copy.emphasis;
  const html = words.map((w, i) => (accent && i === at ? `<span style="color:${accent}">${esc(w)}</span>` : esc(w))).join(' ');
  return fit(
    'headline',
    opts.min ?? 5.2 * spec.u,
    opts.max,
    `color:${color};${opts.upper ? 'text-transform:uppercase;letter-spacing:-0.01em;' : ''}${opts.weight ? `font-weight:${opts.weight};` : ''}${opts.tight ? 'line-height:0.95;' : ''}`,
    html
  );
}

function sub(spec: PosterSpec, color: string, max = 3.9): string {
  if (!spec.copy.sub) return '';
  return fit('sub', 2.6 * spec.u, max * spec.u, `color:${color}`, esc(spec.copy.sub));
}

/** Les faits (date, heure, lieu, prix) : une ligne d'affiche séparée par des filets. */
function facts(spec: PosterSpec, color: string, rule: string, opts: { column?: boolean; max?: number; offer?: boolean } = {}): string {
  // L'offre (−20 %) ouvre la ligne des faits quand le gabarit ne l'affiche pas en grand.
  const offerDigits = (spec.copy.offer || '').match(/\d+/)?.[0] || '';
  const offerItem = opts.offer !== false && spec.copy.offer && !spec.copy.headline.includes(offerDigits) ? [{ kind: 'offer', text: spec.copy.offer }] : [];
  const list = [...offerItem, ...spec.copy.facts.filter((f) => f.text)];
  if (!list.length) return '';
  const items = list.map((f, i) => `${i && !opts.column ? `<span class="sep" style="background:${rule}"></span>` : ''}<span class="fact fact-${f.kind}"${f.kind === 'offer' ? ' style="font-weight:900"' : ''}>${esc(f.text)}</span>`).join('');
  return fit(`facts${opts.column ? ' facts-col' : ''}`, 2.4 * spec.u, (opts.max ?? 3.3) * spec.u, `color:${color}`, items);
}

/** Un filet court de la couleur forte : le seul ornement admis, il structure. */
const accentRule = (spec: PosterSpec, color: string, width = 9) => `<div class="rule" style="width:${r(width * spec.u)}px;height:${r(Math.max(4, 0.75 * spec.u))}px;background:${color}"></div>`;

/** Contraste entre l'encre du logo et un fond. */
function logoReadsOn(spec: PosterSpec, bg: string): boolean {
  if (!spec.logo.url) return true;
  if (spec.logo.ink === 'color') return contrastRatio(isDarkColor(bg) ? '#ffffff' : '#111111', bg) >= 4.5 && !isDarkColor(bg);
  const lum = (hex: string) => {
    const [rr, gg, bb] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
  };
  const b = lum(bg);
  const ratio = (a: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  // Un logo bicolore (« #DEV_ » noir, « Girls » rose) se lit si SES DEUX parties se lisent.
  return [spec.logo.darkPart ?? spec.logo.luminance, spec.logo.lightPart ?? spec.logo.luminance].every((a) => ratio(a) >= 2.6);
}

/**
 * Le logo à (x, y), hauteur h. Lisible sur ce fond : posé tel quel. Sinon : sur un cartouche
 * clair (jamais de halo). Sans logo : le nom de la marque dans la police de titre.
 */
function logo(spec: PosterSpec, box: { x: number; y: number; h: number; anchor?: 'left' | 'right' | 'center' }, bg: string, ink: string): string {
  const h = box.h;
  const maxW = 34 * spec.u;
  if (!spec.logo.url) {
    // Création sans charte (ni logo ni nom) : pas de signature.
    if (!spec.brandName.trim()) return '';
    const size = r(h * 0.62);
    const pos = box.anchor === 'right' ? `right:${r(spec.width - box.x)}px` : box.anchor === 'center' ? `left:0;right:0;text-align:center` : `left:${r(box.x)}px`;
    return `<div class="wordmark" data-role="logo" style="${pos};top:${r(box.y + (h - size) / 2)}px;font-size:${size}px;color:${ink}">${esc(spec.brandName)}</div>`;
  }
  const w = Math.min(maxW, h * spec.logo.aspect);
  const hh = w / spec.logo.aspect;
  const readable = logoReadsOn(spec, bg);
  const pad = readable ? 0 : r(h * 0.32);
  const outerW = w + pad * 2;
  const left = box.anchor === 'right' ? box.x - outerW : box.anchor === 'center' ? (spec.width - outerW) / 2 : box.x;
  const t = spec.logo.trim;
  const viewBox = t ? `object-view-box:inset(${(t.top * 100).toFixed(2)}% ${(t.right * 100).toFixed(2)}% ${(t.bottom * 100).toFixed(2)}% ${(t.left * 100).toFixed(2)}%);` : '';
  const img = `<img data-role="logo" src="${esc(spec.logo.url)}" alt="${esc(spec.brandName)}" style="display:block;width:${r(w)}px;height:${r(hh)}px;object-fit:contain;${viewBox}" />`;
  return readable
    ? `<div class="logo" style="left:${r(left)}px;top:${r(box.y + (h - hh) / 2)}px">${img}</div>`
    : `<div class="logo logo-tab" style="left:${r(left)}px;top:${r(box.y + (h - hh) / 2 - pad)}px;padding:${pad}px;border-radius:${r(pad * 0.5)}px;background:#ffffff">${img}</div>`;
}

/** Une photo cadrée sur son point d'intérêt, avec son traitement. */
function photo(spec: PosterSpec, box: Box, opts: { radius?: number; image?: PosterSpec['image']; tint?: string; background?: boolean; css?: string } = {}): string {
  const image = opts.image || spec.image;
  if (!image) return '';
  // Bichromie : un vrai filtre (ombres et lumières prennent les deux tons de la marque). Mono : gris contrasté.
  const duo = spec.treatment === 'duotone' ? duotoneFilter(`duo-${r(box.x)}-${r(box.y)}`, opts.tint || spec.palette.primary) : null;
  const filter = duo ? duo.css : spec.treatment === 'mono' ? 'filter:grayscale(1) contrast(1.08);' : '';
  return `<div class="ph" data-role="photo"${opts.background ? ' data-bg="1"' : ''} style="left:${r(box.x)}px;top:${r(box.y)}px;width:${r(box.w)}px;height:${r(box.h)}px;${opts.radius ? `border-radius:${r(opts.radius)}px;` : ''}${opts.css || ''}">${duo ? duo.defs : ''}<img src="${esc(image.url)}" alt="" style="object-position:${r(image.focal.x * 100)}% ${r(image.focal.y * 100)}%;${filter}" /></div>`;
}

const block = (box: Box, bg: string, extra = '') => `<div class="blk" style="left:${r(box.x)}px;top:${r(box.y)}px;width:${r(box.w)}px;height:${r(box.h)}px;background:${bg};${extra}"></div>`;

/** La toile : le décor tonal du kit derrière, la composition, le grain par-dessus. */
const root = (spec: PosterSpec, bg: string, body: string) => {
  const m = motifHtml(spec, bg);
  return `<div class="pv" style="width:${spec.width}px;height:${spec.height}px;background:${bg === spec.scheme.bg && spec.scheme.bgCss ? spec.scheme.bgCss : bg}">${m.back}${body}${m.front}</div>`;
};

/** L'accent du titre sur un fond donné (null : pas de mot coloré, le contraste ne le permet pas). */
const emphasisOn = (spec: PosterSpec, bg: string, preferred: string) => (contrastRatio(preferred, bg) >= 3 && preferred.toLowerCase() !== spec.scheme.ink.toLowerCase() ? preferred : null);

/** Une forme du kit graphique posée dans la composition (couleurs en #hex : la charte est déjà résolue). */
const gfx = (spec: PosterSpec, p: GfxParams, box: Box, id: string, bg = spec.scheme.bg) =>
  gfxHtml(p, box, gfxContext({ width: spec.width, height: spec.height, u: spec.u, tokens: {}, primary: spec.palette.primary, secondary: spec.palette.secondary, bg, ink: spec.scheme.ink }), id).html;

/** Les deux couleurs franches des formes : la couleur de marque et une seconde qui n'est pas un fluo. */
function fills(spec: PosterSpec): { c1: string; c2: string } {
  const c1 = spec.palette.primary;
  const c2 = [spec.palette.secondary, spec.palette.accent].find((c) => c && c.toLowerCase() !== c1.toLowerCase() && !isNeonHex(c)) || mix(c1, spec.scheme.bg, 0.55);
  return { c1, c2 };
}

/** Découpe un bloc positionné en polygone (clip-path) : la diagonale, l'arche, la forme libre. */
const clipped = (box: Box, polygon: string, inner: string, id: string) =>
  `<div class="blk" data-role="panel" data-el="${id}" style="left:${r(box.x)}px;top:${r(box.y)}px;width:${r(box.w)}px;height:${r(box.h)}px;clip-path:${polygon}">${inner}</div>`;

const logoH = (spec: PosterSpec) => r(spec.orientation === 'landscape' ? 7.5 * spec.u : 6.2 * spec.u);

// ─── Les compositions ───────────────────────────────────────────────────────

/** Photo d'un côté, panneau de texte de l'autre (pleine hauteur ou pleine largeur). */
const split: PosterTemplate = {
  id: 'split',
  label: 'Photo et panneau',
  summary: 'photo on one half, a clean panel of the brand colour or paper carries the text',
  needsImage: true,
  intents: { event: 1.4, launch: 1.6, product: 1.8, info: 1.4, recruit: 1.4, promo: 1 },
  schemes: ['paper', 'brand', 'tint', 'accent'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const parts = (gap: number) => [accentRule(spec, scheme.accent), kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 12.5 * u }), sub(spec, scheme.muted), facts(spec, scheme.ink, scheme.rule)].map((p) => p);
    if (spec.orientation === 'portrait') {
      const ph = r(H * (spec.format === 'story' ? 0.42 : 0.5));
      const photoTop = spec.mirror ? H - ph : 0;
      const textTop = spec.mirror ? safe.top : ph + 5.5 * u;
      const textBottom = spec.mirror ? H - ph - 5 * u - lh - 3 * u : H - safe.bottom - lh - 3.5 * u;
      const logoY = spec.mirror ? H - ph - 4 * u - lh : H - safe.bottom - lh;
      return root(spec, scheme.bg, photo(spec, { x: 0, y: photoTop, w: W, h: ph }) + stack({ x: safe.left, y: textTop, w: W - safe.left - safe.right, h: textBottom - textTop }, parts(2.4 * u), { justify: spec.mirror ? 'end' : 'start', gap: 2.4 * u }) + logo(spec, { x: safe.left, y: logoY, h: lh }, scheme.bg, scheme.ink));
    }
    const pw = r(W * (spec.orientation === 'landscape' ? 0.46 : 0.5));
    const photoLeft = spec.mirror ? 0 : W - pw;
    const colX = spec.mirror ? pw + 5.5 * u : safe.left;
    const colW = W - pw - 5.5 * u - (spec.mirror ? safe.right : safe.left);
    return root(spec, scheme.bg, photo(spec, { x: photoLeft, y: 0, w: pw, h: H }) + stack({ x: colX, y: safe.top, w: colW, h: H - safe.top - safe.bottom - lh - 3 * u }, parts(2.2 * u), { justify: 'center', gap: 2.2 * u }) + logo(spec, { x: colX, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink));
  },
};

/** La photo plein cadre, un dégradé sombre sous le texte blanc. */
const fullbleed: PosterTemplate = {
  id: 'fullbleed',
  label: 'Photo plein cadre',
  summary: 'full-bleed photo, a soft dark gradient under white text at the bottom',
  needsImage: true,
  intents: { event: 1.6, launch: 1.4, recruit: 1, info: 1.2, product: 1 },
  schemes: ['paper', 'brand'],
  render(spec) {
    const { width: W, height: H, safe, u } = spec;
    const lh = logoH(spec);
    const ink = '#ffffff';
    const accent = [spec.palette.primary, spec.palette.accent, spec.palette.secondary].find((c) => c && contrastRatio(c, '#1c1c1c') >= 3.2) || null;
    const landscape = spec.orientation === 'landscape';
    const box: Box = landscape
      ? { x: safe.left, y: safe.top + lh + 4 * u, w: W * 0.5 - safe.left, h: H - safe.top - safe.bottom - lh - 4 * u }
      : { x: safe.left, y: H * (spec.format === 'story' ? 0.5 : 0.44), w: W - safe.left - safe.right, h: H * (spec.format === 'story' ? 0.5 : 0.56) - safe.bottom };
    // Le voile commence AU-DESSUS du texte et l'enveloppe entièrement : jamais de texte sur une zone claire.
    const start = Math.max(0, box.y - 16 * u);
    const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(1)}%`;
    const scrim = landscape
      ? `<div class="blk" style="inset:0;background:linear-gradient(90deg,rgba(10,10,12,0.84) 0%,rgba(10,10,12,0.74) ${pct(box.x + box.w, W)},rgba(10,10,12,0) ${pct(box.x + box.w + 22 * u, W)})"></div>`
      : `<div class="blk" style="inset:0;background:linear-gradient(180deg,rgba(10,10,12,0) ${pct(start, H)},rgba(10,10,12,0.62) ${pct(box.y + 6 * u, H)},rgba(10,10,12,0.84) ${pct(box.y + box.h * 0.5, H)},rgba(10,10,12,0.9) 100%)"></div>`;
    const parts = [kicker(spec, 'rgba(255,255,255,0.92)'), headline(spec, ink, accent, { max: 12.5 * u }), sub(spec, 'rgba(255,255,255,0.88)'), facts(spec, ink, 'rgba(255,255,255,0.45)')];
    return root(spec, '#1c1c1c', photo(spec, { x: 0, y: 0, w: W, h: H }, { background: true }) + scrim + stack(box, parts, { justify: 'end', gap: 2.2 * u }) + logo(spec, { x: safe.left, y: safe.top, h: lh }, '#2a2a2a', ink));
  },
};

/** La mise en page de magazine : le titre en haut, la photo encadrée, les faits en colonnes. */
const editorial: PosterTemplate = {
  id: 'editorial',
  label: 'Éditorial',
  summary: 'magazine page on paper: big headline at the top, an inset photo, facts set in columns',
  needsImage: true,
  intents: { launch: 1.6, info: 1.6, event: 1.2, product: 1.2, recruit: 1.2 },
  schemes: ['paper', 'tint'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const innerW = W - safe.left - safe.right;
    if (spec.orientation === 'landscape') {
      const pw = r(W * 0.44);
      const px = spec.mirror ? W - safe.right - pw : safe.left;
      const tx = spec.mirror ? safe.left : px + pw + 5 * u;
      const tw = innerW - pw - 5 * u;
      return root(spec, scheme.bg, photo(spec, { x: px, y: safe.top, w: pw, h: H - safe.top - safe.bottom }) + stack({ x: tx, y: safe.top, w: tw, h: H - safe.top - safe.bottom - lh - 3 * u }, [kicker(spec, scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 11 * u }), sub(spec, scheme.muted, 3.4), facts(spec, scheme.ink, scheme.rule)], { justify: 'center', gap: 2 * u }) + logo(spec, { x: tx, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink));
    }
    const headH = r(H * (spec.orientation === 'portrait' ? 0.27 : 0.3));
    const photoY = safe.top + headH + 3.5 * u;
    const bottomH = r(spec.orientation === 'portrait' ? H * 0.17 : H * 0.2);
    const photoH = H - photoY - safe.bottom - bottomH - 3.5 * u;
    const head = stack({ x: safe.left, y: safe.top, w: innerW, h: headH }, [kicker(spec, scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 12 * u, tight: true })], { justify: 'end', gap: 1.6 * u, name: 'head' });
    const rule = `<div class="blk" style="left:${r(safe.left)}px;top:${r(photoY + photoH + 2.8 * u)}px;width:${r(innerW)}px;height:${Math.max(2, r(0.25 * u))}px;background:${scheme.ink}"></div>`;
    const foot = stack({ x: safe.left, y: photoY + photoH + 4.6 * u, w: innerW - lh * spec.logo.aspect * 0.0 - 30 * u, h: bottomH - 1.6 * u }, [sub(spec, scheme.muted, 3.2), facts(spec, scheme.ink, scheme.rule, { max: 3 })], { justify: 'start', gap: 1.4 * u, name: 'foot' });
    return root(spec, scheme.bg, head + photo(spec, { x: safe.left, y: photoY, w: innerW, h: photoH }) + rule + foot + logo(spec, { x: W - safe.right, y: H - safe.bottom - lh, h: lh, anchor: 'right' }, scheme.bg, scheme.ink));
  },
};

/** L'affiche typographique : le titre EST l'image. */
const typographic: PosterTemplate = {
  id: 'typographic',
  label: 'Affiche typographique',
  summary: 'typographic poster: the headline set huge, kicker above, facts below a rule — no photo',
  needsImage: false,
  intents: { event: 1.2, launch: 1.4, info: 1.4, promo: 1.2, recruit: 1.2, quote: 0.6 },
  schemes: ['brand', 'paper', 'tint', 'accent', 'ink'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const innerW = W - safe.left - safe.right;
    const portrait = spec.orientation === 'portrait';
    // Un grand cercle de la couleur forte, à moitié hors cadre, dans le coin que le texte laisse libre.
    const d = r((portrait ? 62 : 54) * u);
    const circle = `<div class="blk" style="width:${d}px;height:${d}px;border-radius:50%;background:${scheme.dark ? mix(scheme.bg, scheme.accent, 0.35) : mix(scheme.bg, scheme.accent, scheme.id === 'paper' || scheme.id === 'tint' ? 0.16 : 0.28)};${spec.mirror ? `left:${r(-d * 0.32)}px` : `right:${r(-d * 0.32)}px`};top:${r(-d * 0.3)}px"></div>`;
    const top = r(portrait ? H * 0.3 : H * 0.26);
    const footH = r((spec.copy.facts.length ? 11 : 6) * u + (spec.copy.sub ? 7 * u : 0));
    const headBox: Box = { x: safe.left, y: top, w: innerW * (spec.orientation === 'landscape' ? 0.78 : 1), h: H - top - safe.bottom - footH - 4 * u };
    const rule = `<div class="blk" style="left:${r(safe.left)}px;top:${r(headBox.y + headBox.h + 2.4 * u)}px;width:${r(14 * u)}px;height:${r(Math.max(4, 0.7 * u))}px;background:${scheme.accent}"></div>`;
    const foot = stack({ x: safe.left, y: headBox.y + headBox.h + 5.2 * u, w: innerW, h: footH }, [sub(spec, scheme.muted, 3.6), facts(spec, scheme.ink, scheme.rule)], { gap: 1.6 * u, name: 'foot' });
    return root(
      spec,
      scheme.bg,
      circle +
        stack(headBox, [kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent, 1.1), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: (portrait ? 17 : 15) * u, min: 7 * u, upper: true, weight: 900, tight: true })], { justify: 'end', gap: 2 * u, name: 'head' }) +
        rule +
        foot +
        (spec.mirror ? logo(spec, { x: W - safe.right, y: safe.top, h: lh, anchor: 'right' }, scheme.bg, scheme.ink) : logo(spec, { x: safe.left, y: safe.top, h: lh }, scheme.bg, scheme.ink))
    );
  },
};

/** L'événement : un bloc de date qui se voit de loin, puis le titre, l'heure et le lieu. */
const eventDate: PosterTemplate = {
  id: 'event',
  label: 'Événement daté',
  summary: 'event poster: a bold date block, the title, then time and place; optional photo band',
  needsImage: false,
  needs: (s) => s.copy.facts.some((f) => f.kind === 'date'),
  intents: { event: 2.2 },
  schemes: ['paper', 'tint', 'brand'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme, palette } = spec;
    const lh = logoH(spec);
    const innerW = W - safe.left - safe.right;
    const date = spec.copy.facts.find((f) => f.kind === 'date')!;
    const rest = { ...spec, copy: { ...spec.copy, facts: spec.copy.facts.filter((f) => f !== date) } };
    const blockBg = scheme.id === 'brand' ? scheme.panel : palette.primary;
    const blockInk = contrastRatio('#ffffff', blockBg) >= contrastRatio(palette.text, blockBg) ? '#ffffff' : palette.text;
    const portrait = spec.orientation === 'portrait';
    const hasPhoto = !!spec.image;
    // Le bloc de date : le jour en très grand.
    const dateW = r(portrait ? innerW * 0.62 : spec.orientation === 'landscape' ? W * 0.3 : innerW * 0.5);
    const dateH = r(portrait ? 26 * u : 24 * u);
    let photoBox: Box | null = null;
    let dateBox: Box;
    let textBox: Box;
    if (portrait) {
      const ph = hasPhoto ? r(H * 0.34) : 0;
      if (hasPhoto) photoBox = { x: 0, y: 0, w: W, h: ph };
      dateBox = { x: safe.left, y: hasPhoto ? ph - dateH * 0.42 : safe.top + 4 * u, w: dateW, h: dateH };
      textBox = { x: safe.left, y: dateBox.y + dateH + 5 * u, w: innerW, h: H - (dateBox.y + dateH + 5 * u) - safe.bottom - lh - 4 * u };
    } else if (spec.orientation === 'landscape') {
      if (hasPhoto) photoBox = { x: W * 0.62, y: 0, w: W * 0.38, h: H };
      dateBox = { x: safe.left, y: safe.top, w: dateW, h: H - safe.top - safe.bottom };
      // (le logo va sous le texte, à droite du bloc)
      textBox = { x: safe.left + dateW + 4.5 * u, y: safe.top, w: (hasPhoto ? W * 0.62 : W - safe.right) - safe.left - dateW - 9 * u, h: H - safe.top - safe.bottom - lh - 3 * u };
    } else {
      if (hasPhoto) photoBox = { x: W * 0.5, y: 0, w: W * 0.5, h: H * 0.5 };
      dateBox = { x: safe.left, y: safe.top, w: Math.min(dateW, W * 0.5 - safe.left - 4 * u), h: dateH };
      const textTop = Math.max(safe.top + dateH, photoBox ? photoBox.h : 0) + 5 * u;
      textBox = { x: safe.left, y: textTop, w: innerW, h: H - textTop - safe.bottom - lh - 4 * u };
    }
    // « Samedi 12 oct. » : le jour en sur-titre, la date en très grand (sur deux lignes au besoin).
    const [day, ...restDate] = date.text.split(/\s+/);
    const dateLines = restDate.length && /^[a-zéèêûôîàç]+\.?$/i.test(day) ? [day, restDate.join(' ')] : ['', date.text];
    const dateStack = stack(
      { x: dateBox.x + 3 * u, y: dateBox.y + 2.4 * u, w: dateBox.w - 6 * u, h: dateBox.h - 4.8 * u },
      [dateLines[0] ? fit('kicker', 2.4 * u, 4 * u, `color:${blockInk};opacity:0.92`, esc(dateLines[0])) : '', fit('date', 5 * u, 14 * u, `color:${blockInk};font-weight:900;text-transform:uppercase;line-height:0.95;text-wrap:balance`, esc(dateLines[1]))],
      { justify: 'center', gap: 0.8 * u, name: 'date', overPhoto: true }
    );
    const parts = [kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 11 * u }), sub(rest, scheme.muted), facts(rest, scheme.ink, scheme.rule, { column: true, max: 3.6 })];
    // Le logo dans la colonne du texte, jamais sur le bloc de date.
    const logoX = spec.orientation === 'landscape' ? textBox.x : safe.left;
    return root(spec, scheme.bg, (photoBox ? photo(spec, photoBox) : '') + block(dateBox, blockBg) + dateStack + stack(textBox, parts, { justify: portrait ? 'start' : 'center', gap: 2.2 * u }) + logo(spec, { x: logoX, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink));
  },
};

/** L'offre : le chiffre occupe l'espace, le titre l'explique. */
const offer: PosterTemplate = {
  id: 'offer',
  label: 'Offre',
  summary: 'promotion: the offer figure (−20 %, a price) set huge, the headline explains it',
  needsImage: false,
  needs: (s) => !!s.copy.offer,
  intents: { promo: 2.4, product: 0.8 },
  schemes: ['brand', 'paper', 'accent', 'tint'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const innerW = W - safe.left - safe.right;
    const portrait = spec.orientation === 'portrait';
    const landscape = spec.orientation === 'landscape';
    const hasPhoto = !!spec.image;
    const d = r((portrait ? 52 : landscape ? 0 : 34) * u);
    const photoHtml = hasPhoto && !landscape ? photo(spec, { x: spec.mirror ? safe.left : W - d - safe.right + 4 * u, y: portrait ? safe.top : safe.top - 2 * u, w: d, h: d }, { radius: d / 2 }) : hasPhoto ? photo(spec, { x: W * 0.6, y: 0, w: W * 0.4, h: H }) : '';
    const top = portrait ? (hasPhoto ? safe.top + d + 3 * u : H * 0.24) : landscape ? safe.top : hasPhoto ? safe.top + d - 2 * u : H * 0.18;
    const w = landscape && hasPhoto ? W * 0.6 - safe.left - 4 * u : innerW;
    const big = fit('offer', 12 * u, (portrait ? 34 : 30) * u, `color:${scheme.accent};font-weight:900;line-height:0.88;letter-spacing:-0.03em;white-space:nowrap`, esc(spec.copy.offer || ''));
    // Le chiffre est déjà en grand : « −20 % sur toutes les formations » devient « Sur toutes les formations »
    // — seulement si la phrase reste juste sans lui (sinon le titre est gardé tel quel).
    const n = (spec.copy.offer || '').match(/\d+/)?.[0];
    const stripped = n ? spec.copy.headline.replace(new RegExp(`^\\s*(?:profitez\\s+de\\s+|jusqu['’]à\\s+|get\\s+|save\\s+)?[-−–]?\\s?${n}\\s?%\\s*`, 'i'), '') : spec.copy.headline;
    const clean = stripped !== spec.copy.headline && /^(sur|on|off|de\s|des\s|du\s)/i.test(stripped) && stripped.split(/\s+/).length >= 2;
    const hSpec = clean ? { ...spec, copy: { ...spec.copy, headline: stripped.charAt(0).toUpperCase() + stripped.slice(1), emphasis: undefined } } : spec;
    const parts = [big, headline(hSpec, scheme.ink, null, { max: 8.5 * u, min: 4.6 * u }), sub(spec, scheme.muted, 3.4), facts(spec, scheme.ink, scheme.rule, { offer: false })];
    return root(spec, scheme.bg, photoHtml + stack({ x: safe.left, y: top, w, h: H - top - safe.bottom - lh - 4 * u }, parts, { justify: 'center', gap: 2 * u }) + logo(spec, { x: safe.left, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink));
  },
};

/** La citation : les guillemets, la phrase, l'auteur. */
const quote: PosterTemplate = {
  id: 'quote',
  label: 'Citation',
  summary: 'testimonial: big quotation marks, the sentence, the author; optional portrait in a circle',
  needsImage: false,
  needs: (s) => !!s.copy.quote,
  intents: { quote: 2.6 },
  schemes: ['paper', 'tint', 'brand'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const innerW = W - safe.left - safe.right;
    const q = spec.copy.quote!;
    const marks = `<div class="marks" style="left:${r(safe.left - 1.2 * u)}px;top:${r(safe.top - 6 * u)}px;font-size:${r(32 * u)}px;color:${scheme.accent}">“</div>`;
    const d = r(18 * u);
    const portraitImg = spec.image ? photo(spec, { x: safe.left, y: H - safe.bottom - lh - 6 * u - d, w: d, h: d }, { radius: d / 2 }) : '';
    const authorX = spec.image ? safe.left + d + 3.5 * u : safe.left;
    const author = q.author ? stack({ x: authorX, y: H - safe.bottom - lh - 6 * u - d, w: innerW - (authorX - safe.left), h: d }, [fit('author', 2.6 * u, 3.6 * u, `color:${scheme.ink};font-weight:700`, esc(q.author))], { justify: 'center', gap: 0, name: 'author' }) : '';
    const textTop = safe.top + 16 * u;
    const textBottom = H - safe.bottom - lh - 9 * u - (spec.image || q.author ? d : 0);
    return root(spec, scheme.bg, marks + stack({ x: safe.left, y: textTop, w: innerW, h: textBottom - textTop }, [fit('quote', 4.4 * u, 9 * u, `color:${scheme.ink}`, esc(q.text))], { justify: 'center', gap: 2 * u }) + portraitImg + author + logo(spec, { x: W - safe.right, y: H - safe.bottom - lh, h: lh, anchor: 'right' }, scheme.bg, scheme.ink));
  },
};

/** La photo plein cadre et une bande pleine qui porte le texte. */
const band: PosterTemplate = {
  id: 'band',
  label: 'Bande sur photo',
  summary: 'full photo with a solid band of the brand colour or paper carrying the text',
  needsImage: true,
  intents: { promo: 1.2, event: 1.2, launch: 1.2, info: 1.2, product: 1.4 },
  schemes: ['brand', 'paper', 'accent'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const landscape = spec.orientation === 'landscape';
    const bandBox: Box = landscape ? { x: spec.mirror ? W * 0.55 : 0, y: 0, w: W * 0.45, h: H } : { x: 0, y: spec.mirror ? 0 : H - H * (spec.format === 'story' ? 0.46 : 0.42), w: W, h: H * (spec.format === 'story' ? 0.46 : 0.42) };
    const pad = 5.5 * u;
    const textBox: Box = landscape
      ? { x: bandBox.x + safe.left, y: safe.top, w: bandBox.w - safe.left - pad, h: H - safe.top - safe.bottom - lh - 3 * u }
      : { x: safe.left, y: bandBox.y + (spec.mirror ? Math.max(safe.top, pad) : pad), w: W - safe.left - safe.right, h: bandBox.h - pad - (spec.mirror ? Math.max(safe.top, pad) : Math.max(safe.bottom, pad)) - lh - 3 * u };
    const logoY = landscape ? H - safe.bottom - lh : textBox.y + textBox.h + 3 * u;
    const parts = [kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 10.5 * u }), sub(spec, scheme.muted, 3.4), facts(spec, scheme.ink, scheme.rule)];
    return root(spec, scheme.bg, photo(spec, { x: 0, y: 0, w: W, h: H }, { background: true }) + block(bandBox, scheme.bg) + stack(textBox, parts, { justify: 'center', gap: 1.8 * u }) + logo(spec, { x: textBox.x, y: logoY, h: lh }, scheme.bg, scheme.ink));
  },
};

/** Une carte claire posée sur la couleur de marque : photo en haut, texte en dessous. */
const card: PosterTemplate = {
  id: 'card',
  label: 'Carte',
  summary: 'a light card on the brand colour: photo on top, text below, the logo on the colour',
  needsImage: true,
  intents: { launch: 1.6, recruit: 1.6, event: 1.2, info: 1.2, quote: 0.8 },
  schemes: ['brand', 'accent', 'tint'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme, palette } = spec;
    const lh = logoH(spec);
    const cardBg = scheme.id === 'tint' ? '#ffffff' : scheme.panel;
    const cardInk = scheme.id === 'tint' ? palette.text : scheme.panelInk;
    const cardAccent = [palette.primary, palette.accent, palette.secondary].find((c) => c && contrastRatio(c, cardBg) >= 3) || cardInk;
    const muted = mutedOn(cardInk, cardBg);
    const landscape = spec.orientation === 'landscape';
    const cardBox: Box = landscape
      ? { x: safe.left, y: safe.top, w: W - safe.left - safe.right - 30 * u, h: H - safe.top - safe.bottom }
      : { x: safe.left, y: safe.top + lh + 4 * u, w: W - safe.left - safe.right, h: H - safe.top - lh - 4 * u - safe.bottom };
    const pad = 4.2 * u;
    const radius = 2.2 * u;
    const photoBox: Box = landscape ? { x: cardBox.x, y: cardBox.y, w: cardBox.w * 0.48, h: cardBox.h } : { x: cardBox.x, y: cardBox.y, w: cardBox.w, h: cardBox.h * (spec.orientation === 'portrait' ? 0.55 : 0.5) };
    const textBox: Box = landscape ? { x: photoBox.x + photoBox.w + pad, y: cardBox.y + pad, w: cardBox.w - photoBox.w - pad * 2, h: cardBox.h - pad * 2 } : { x: cardBox.x + pad, y: photoBox.y + photoBox.h + pad * 0.9, w: cardBox.w - pad * 2, h: cardBox.h - photoBox.h - pad * 1.9 };
    const parts = [kicker(spec, cardAccent === cardInk ? muted : cardAccent, 1, cardBg), headline({ ...spec, scheme: { ...scheme, ink: cardInk } }, cardInk, emphasisOn({ ...spec, scheme: { ...scheme, ink: cardInk } }, cardBg, cardAccent), { max: 9.5 * u }), sub(spec, muted, 3.2), facts(spec, cardInk, mix(cardInk, cardBg, 0.75))];
    const logoBox = landscape ? { x: W - safe.right, y: safe.top, h: lh, anchor: 'right' as const } : { x: safe.left, y: safe.top, h: lh };
    return root(
      spec,
      scheme.bg,
      `<div class="blk" style="left:${r(cardBox.x)}px;top:${r(cardBox.y)}px;width:${r(cardBox.w)}px;height:${r(cardBox.h)}px;background:${cardBg};border-radius:${r(radius)}px;overflow:hidden">${photo(spec, { x: photoBox.x - cardBox.x, y: photoBox.y - cardBox.y, w: photoBox.w, h: photoBox.h })}</div>` +
        stack(textBox, parts, { justify: 'center', gap: 1.6 * u }) +
        logo(spec, logoBox, scheme.bg, scheme.ink)
    );
  },
};

/** La mosaïque : trois photos de la marque et une case de texte. */
const mosaic: PosterTemplate = {
  id: 'mosaic',
  label: 'Mosaïque',
  summary: 'a tidy grid of the brand’s own photos with one cell of text — community, behind the scenes',
  needsImage: true,
  needs: (s) => s.extraImages.length >= 2,
  intents: { launch: 1.8, event: 1.2, recruit: 1.4, info: 1 },
  schemes: ['brand', 'paper', 'accent'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const g = 1.4 * u;
    const imgs = [spec.image!, ...spec.extraImages].slice(0, 3);
    const portrait = spec.orientation !== 'landscape';
    const landscape = spec.orientation === 'landscape';
    let cells: Box[];
    let text: Box;
    if (portrait) {
      const top = safe.top + lh + 3.5 * u;
      const gridH = H * (spec.orientation === 'square' ? 0.44 : 0.5);
      const half = (W - safe.left - safe.right - g) / 2;
      cells = [
        { x: safe.left, y: top, w: half, h: gridH },
        { x: safe.left + half + g, y: top, w: half, h: (gridH - g) / 2 },
        { x: safe.left + half + g, y: top + (gridH - g) / 2 + g, w: half, h: (gridH - g) / 2 },
      ];
      text = { x: safe.left, y: top + gridH + 4.5 * u, w: W - safe.left - safe.right, h: H - top - gridH - 4.5 * u - safe.bottom };
    } else {
      const colW = landscape ? W * 0.56 : W * 0.54;
      const half = (colW - g) / 2;
      cells = [
        { x: 0, y: 0, w: half, h: H },
        { x: half + g, y: 0, w: half, h: (H - g) / 2 },
        { x: half + g, y: (H - g) / 2 + g, w: half, h: (H - g) / 2 },
      ];
      if (spec.mirror) cells = cells.map((c) => ({ ...c, x: W - c.x - c.w }));
      const tx = spec.mirror ? safe.left : colW + 5 * u;
      text = { x: tx, y: safe.top + lh + 3 * u, w: W - colW - 5 * u - (spec.mirror ? safe.left : safe.right), h: H - safe.top - lh - 3 * u - safe.bottom };
    }
    const parts = [kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 10 * u }), sub(spec, scheme.muted, 3.2), facts(spec, scheme.ink, scheme.rule)];
    const logoBox = portrait ? { x: safe.left, y: safe.top, h: lh } : { x: text.x, y: safe.top, h: lh };
    return root(spec, scheme.bg, cells.map((c, i) => photo(spec, c, { image: imgs[i] || imgs[0] })).join('') + stack(text, parts, { justify: portrait ? 'start' : 'center', gap: 1.8 * u }) + logo(spec, logoBox, scheme.bg, scheme.ink));
  },
};

/** La composition géométrique : des modules (quarts de cercle, disques) en couleurs de marque d'un côté, le texte au calme de l'autre. */
const geometric: PosterTemplate = {
  id: 'geometric',
  label: 'Composition géométrique',
  summary: 'bold Bauhaus geometry — quarter circles and discs in the brand colours — fills one zone while the type sits calm on the other; no photo needed',
  needsImage: false,
  intents: { launch: 1.4, event: 1.2, recruit: 1.2, product: 1, info: 1.1, promo: 0.9, quote: 0.8 },
  schemes: ['paper', 'tint'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const innerW = W - safe.left - safe.right;
    const { c1, c2 } = fills(spec);
    const seed = spec.motif?.seed ?? 7;
    const parts = [kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 11.5 * u }), sub(spec, scheme.muted), facts(spec, scheme.ink, scheme.rule)];
    if (spec.orientation === 'landscape') {
      const gw = r(W * 0.38);
      const gx = spec.mirror ? W - gw : 0;
      const tx = spec.mirror ? safe.left : gw + 5.5 * u;
      const tw = W - gw - 5.5 * u - (spec.mirror ? safe.left : safe.right);
      return root(spec, scheme.bg, gfx(spec, { kind: 'arcs', seed, color: c1, color2: c2, density: 1 }, { x: gx, y: 0, w: gw, h: H }, 'geo') + stack({ x: tx, y: safe.top, w: tw, h: H - safe.top - safe.bottom - lh - 3 * u }, parts, { justify: 'center', gap: 2 * u }) + logo(spec, { x: tx, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink));
    }
    const cols = 4;
    const cell = W / cols;
    const rows = Math.max(1, Math.round((H * (spec.format === 'story' ? 0.3 : spec.orientation === 'square' ? 0.46 : 0.4)) / cell));
    const gh = rows * cell;
    const graphic = gfx(spec, { kind: 'arcs', seed, color: c1, color2: c2, density: 2 }, { x: 0, y: spec.mirror ? H - gh : 0, w: W, h: gh }, 'geo');
    if (spec.mirror) {
      const top = safe.top + lh + 3.5 * u;
      return root(spec, scheme.bg, graphic + logo(spec, { x: safe.left, y: safe.top, h: lh }, scheme.bg, scheme.ink) + stack({ x: safe.left, y: top, w: innerW, h: H - gh - 5 * u - top }, parts, { justify: 'start', gap: 2.2 * u }));
    }
    return root(spec, scheme.bg, graphic + stack({ x: safe.left, y: gh + 5.5 * u, w: innerW, h: H - safe.bottom - lh - 3.5 * u - (gh + 5.5 * u) }, parts, { justify: spec.format === 'story' ? 'center' : 'start', gap: 2.2 * u }) + logo(spec, { x: safe.left, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink));
  },
};

/** L'asymétrique : un panneau en biais (photo, ou couleur de marque et courbes) coupe la toile ; le texte tient le coin opposé. */
const diagonal: PosterTemplate = {
  id: 'diagonal',
  label: 'Asymétrique en diagonale',
  summary: 'asymmetric: a slanted panel (the photo, or the brand colour with fine rings) cuts across the canvas; the type holds the opposite corner on paper',
  needsImage: false,
  intents: { launch: 1.5, event: 1.4, product: 1.5, promo: 1.1, recruit: 1.2, info: 0.9, quote: 0.9 },
  schemes: ['paper', 'tint'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme, palette } = spec;
    const lh = logoH(spec);
    const innerW = W - safe.left - safe.right;
    const { c1 } = fills(spec);
    const seed = spec.motif?.seed ?? 3;
    const parts = [kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 11.5 * u }), sub(spec, scheme.muted), facts(spec, scheme.ink, scheme.rule)];
    /** Le contenu du panneau : la photo cadrée, ou l'aplat de marque et ses anneaux fins. */
    const fill = (box: Box) =>
      spec.image
        ? photo(spec, { x: 0, y: 0, w: box.w, h: box.h })
        : block({ x: 0, y: 0, w: box.w, h: box.h }, c1) + gfx(spec, { kind: 'rings', seed, color: mix(c1, '#ffffff', 0.2), color2: mix(c1, '#ffffff', 0.12), variant: 'offset', stroke: 0.3, density: 4 }, { x: box.w * 0.25, y: -box.h * 0.2, w: Math.max(box.w, box.h) * 1.05, h: Math.max(box.w, box.h) * 1.05 }, 'diag', c1);
    if (spec.orientation === 'landscape') {
      const x0 = r(W * 0.46);
      const slant = r(W * 0.07);
      const box: Box = spec.mirror ? { x: 0, y: 0, w: W - x0, h: H } : { x: x0, y: 0, w: W - x0, h: H };
      const poly = spec.mirror ? `polygon(0 0,calc(100% - ${slant}px) 0,100% 100%,0 100%)` : `polygon(${slant}px 0,100% 0,100% 100%,0 100%)`;
      const tx = spec.mirror ? W - x0 + 5 * u : safe.left;
      const tw = x0 - 5 * u - (spec.mirror ? safe.right : safe.left);
      return root(spec, scheme.bg, clipped(box, poly, fill(box), 'panel') + stack({ x: tx, y: safe.top, w: tw, h: H - safe.top - safe.bottom - lh - 3 * u }, parts, { justify: 'center', gap: 2 * u }) + logo(spec, { x: tx, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink));
    }
    const Hp = r(H * (spec.format === 'story' ? 0.5 : spec.orientation === 'square' ? 0.5 : 0.56));
    const slant = r(H * 0.09);
    // Bord bas : à gauche à Hp, à droite plus haut (ou l'inverse en miroir).
    const yl = spec.mirror ? Hp - slant : Hp;
    const yr = spec.mirror ? Hp : Hp - slant;
    const box: Box = { x: 0, y: 0, w: W, h: Hp };
    const poly = `polygon(0 0,100% 0,100% ${yr}px,0 ${yl}px)`;
    const edge = (x: number) => yr + ((W - x) / W) * (yl - yr);
    const lw = Math.min(34 * u, lh * spec.logo.aspect);
    const wedgeRight = yr < yl;
    const lx = wedgeRight ? W - safe.right : safe.left;
    const ly = (wedgeRight ? edge(W - safe.right - lw) : edge(safe.left + lw)) + 3 * u;
    const top = Math.max(yl, yr) + 5 * u;
    return root(spec, scheme.bg, clipped(box, poly, fill(box), 'panel') + stack({ x: safe.left, y: top, w: innerW, h: H - safe.bottom - top - lh * 0.4 }, parts, { justify: spec.format === 'story' ? 'center' : 'start', gap: 2.2 * u }) + logo(spec, { x: lx, y: ly, h: lh, anchor: wedgeRight ? 'right' : 'left' }, scheme.bg, scheme.ink));
  },
};

/** Le collage : une photo en arche, un panneau penché, un disque et une trame de points se superposent ; le texte reste net en dessous. */
const collage: PosterTemplate = {
  id: 'collage',
  label: 'Collage',
  summary: 'collage: an arch-shaped photo over a tilted brand panel, a disc and a dot field overlap like cut paper; the text stays clean below',
  needsImage: true,
  intents: { event: 1.3, recruit: 1.5, product: 1, launch: 1, promo: 0.9 },
  schemes: ['paper', 'tint'],
  render(spec) {
    const { width: W, height: H, safe, u, scheme } = spec;
    const lh = logoH(spec);
    const { c1, c2 } = fills(spec);
    const seed = spec.motif?.seed ?? 9;
    const parts = [kicker(spec, scheme.accent === scheme.ink ? scheme.muted : scheme.accent), headline(spec, scheme.ink, emphasisOn(spec, scheme.bg, scheme.accent), { max: 10.5 * u }), sub(spec, scheme.muted, 3.4), facts(spec, scheme.ink, scheme.rule)];
    const flip = (x: number, w: number) => (spec.mirror ? W - x - w : x);
    const second = spec.extraImages[0];
    if (spec.orientation === 'landscape') {
      const pw = r(W * 0.26);
      const ph = H - safe.top - safe.bottom;
      const px = flip(r(W * 0.6), pw);
      const tx = spec.mirror ? W * 0.44 + 3 * u : safe.left;
      const tw = W * 0.56 - safe.left - 6 * u - (spec.mirror ? 0 : 0);
      const disc = r(H * 0.62);
      return root(
        spec,
        scheme.bg,
        block({ x: flip(W * 0.56, W * 0.38), y: safe.top + 2 * u, w: W * 0.38, h: ph - 2 * u }, c1, 'transform:rotate(-4deg);border-radius:' + r(1.4 * u) + 'px') +
          block({ x: flip(W * 0.84, disc), y: H - disc * 0.62, w: disc, h: disc }, c2, 'border-radius:50%') +
          photo(spec, { x: px, y: safe.top, w: pw, h: ph }, { css: `border-radius:${r(pw / 2)}px ${r(pw / 2)}px 0 0;` }) +
          stack({ x: tx, y: safe.top, w: Math.min(tw, W * 0.5 - safe.left), h: H - safe.top - safe.bottom - lh - 3 * u }, parts, { justify: 'center', gap: 2 * u }) +
          logo(spec, { x: tx, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink)
      );
    }
    const innerW = W - safe.left - safe.right;
    const portrait = spec.orientation === 'portrait';
    const aw = r(W * 0.5);
    const ah = r(H * (portrait ? 0.4 : 0.42));
    const ay = safe.top;
    const ax = flip(r(W * 0.25), aw);
    const disc = r(W * 0.34);
    const bottom = ay + ah;
    const small = r(W * 0.25);
    // La petite photo déborde de l'arche : le texte commence sous elle, jamais contre elle.
    const textTop = bottom + (second ? Math.max(6.5 * u, small * 0.3 + 3 * u) : 6.5 * u);
    return root(
      spec,
      scheme.bg,
      block({ x: flip(W * 0.17, aw), y: ay + 2.2 * u, w: aw, h: ah, }, c1, 'transform:rotate(-5deg);border-radius:' + r(1.2 * u) + 'px') +
        block({ x: flip(W * 0.62, disc), y: ay - disc * 0.18, w: disc, h: disc }, c2, 'border-radius:50%') +
        gfx(spec, { kind: 'dots', seed, color: mix(c1, scheme.bg, 0.35), variant: 'uniform', density: 1 }, { x: flip(safe.left * 0.8, W * 0.2), y: ay + ah * 0.5, w: W * 0.2, h: W * 0.2 }, 'collage-dots') +
        photo(spec, { x: ax, y: ay, w: aw, h: ah }, { css: `border-radius:${r(aw / 2)}px ${r(aw / 2)}px 0 0;` }) +
        (second ? photo(spec, { x: flip(r(W * 0.64), small), y: bottom - small * 0.7, w: small, h: small }, { radius: W, image: second, css: `outline:${r(0.9 * u)}px solid ${scheme.bg};` }) : '') +
        stack({ x: safe.left, y: textTop, w: innerW, h: H - safe.bottom - lh - 3.5 * u - textTop }, parts, { justify: 'start', gap: 2 * u }) +
        logo(spec, { x: safe.left, y: H - safe.bottom - lh, h: lh }, scheme.bg, scheme.ink)
    );
  },
};

export const POSTER_TEMPLATES: PosterTemplate[] = [split, fullbleed, editorial, typographic, eventDate, offer, quote, band, card, mosaic, geometric, diagonal, collage];
export const TEMPLATE_BY_ID = new Map(POSTER_TEMPLATES.map((t) => [t.id, t]));

/** Les briques, pour les compositions écrites par l'IA (crans Max et Ultra) : mêmes règles d'ajustage et de mesure. */
export const posterBricks = { stack, fit, kicker, headline, sub, facts, logo, logoReadsOn, photo, block, root, emphasisOn, accentRule, logoH, esc };
export type PosterBox = Box;
