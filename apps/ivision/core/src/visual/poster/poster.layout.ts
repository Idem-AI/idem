/**
 * CRAN MAX — L'IA COMPOSE LA MISE EN PAGE.
 *
 * Plus de gabarit : un designer (IA) pose lui-même chaque élément sur la toile — photo(s), aplats
 * et formes, blocs de texte, logo — avec leur position, leur taille, leur couleur (jetons de la
 * charte) et leur ordre. Le code construit cette mise en page avec les briques éprouvées (texte
 * ajusté au millimètre, photo cadrée sur son sujet, logo lisible), puis la boucle de conception
 * mesure, fait critiquer le rendu et renvoie les corrections au designer.
 *
 * Ce que l'IA ne peut pas casser : la charte (jetons seulement), les mots (approuvés), la zone de
 * sécurité (textes et logo y sont ramenés), la lisibilité (mesurée sur les pixels).
 */
import type { CreativeOrchestrator } from '../../creativity/orchestrator';
import { briefLines, tokenById, type DesignBrief } from './poster.canvas';
import { revisionLines, type LoopFeedback } from './poster.loop';
import { inkOn, mix, mutedOn } from './poster.schemes';
import { posterBricks as B, type PosterBox } from './poster.templates';
import type { PosterSpec, PosterTreatment } from './poster.types';

type TextItem = 'kicker' | 'headline' | 'sub' | 'facts' | 'offer' | 'quote' | 'author';
const TEXT_ITEMS: TextItem[] = ['kicker', 'headline', 'sub', 'facts', 'offer', 'quote', 'author'];

export interface LayoutElement {
  type: 'photo' | 'shape' | 'text' | 'logo';
  x: number;
  y: number;
  w: number;
  h: number;
  photo?: number;
  radius?: number;
  angle?: number;
  treatment?: PosterTreatment;
  color?: string;
  items?: TextItem[];
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'center' | 'bottom';
  ink?: string;
  accent?: string;
  headline?: 'normal' | 'large' | 'huge';
  upper?: boolean;
  backing?: string;
  size?: number;
  anchor?: 'left' | 'right' | 'center';
}

export interface LayoutDesign {
  concept: string;
  background: string;
  elements: LayoutElement[];
}

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function parseLayout(raw: string): LayoutDesign | undefined {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return undefined;
  try {
    const o = JSON.parse(json);
    if (!Array.isArray(o.elements) || !o.elements.length) return undefined;
    const elements: LayoutElement[] = o.elements
      .filter((e: any) => e && ['photo', 'shape', 'text', 'logo'].includes(e.type))
      .slice(0, 14)
      .map((e: any) => ({
        type: e.type,
        x: clamp(num(e.x), -10, 110),
        y: clamp(num(e.y), -10, 110),
        w: clamp(num(e.w, 20), 0, 120),
        h: clamp(num(e.h, 10), 0, 120),
        photo: e.photo !== undefined ? Math.round(num(e.photo, 1)) : undefined,
        radius: e.radius !== undefined ? clamp(num(e.radius), 0, 50) : undefined,
        angle: e.angle !== undefined ? clamp(num(e.angle), -45, 45) : undefined,
        treatment: ['natural', 'duotone', 'mono'].includes(e.treatment) ? e.treatment : undefined,
        color: typeof e.color === 'string' ? e.color : undefined,
        items: Array.isArray(e.items) ? e.items.filter((i: unknown) => TEXT_ITEMS.includes(i as TextItem)) : undefined,
        align: ['left', 'center', 'right'].includes(e.align) ? e.align : undefined,
        valign: ['top', 'center', 'bottom'].includes(e.valign) ? e.valign : undefined,
        ink: typeof e.ink === 'string' ? e.ink : undefined,
        accent: typeof e.accent === 'string' ? e.accent : undefined,
        headline: ['normal', 'large', 'huge'].includes(e.headline) ? e.headline : undefined,
        upper: !!e.upper,
        backing: typeof e.backing === 'string' ? e.backing : undefined,
        size: e.size !== undefined ? num(e.size) : undefined,
        anchor: ['left', 'right', 'center'].includes(e.anchor) ? e.anchor : undefined,
      }));
    return { concept: String(o.concept || '').slice(0, 300), background: String(o.background || 'paper'), elements };
  } catch {
    return undefined;
  }
}

const SCHEMA = `{
  "concept": "<one sentence: the idea and why it serves the message>",
  "background": "<colour token>",
  "elements": [   // painted in this order (later = on top)
    {"type":"photo", "photo":1, "x":0, "y":0, "w":100, "h":60, "radius":0, "treatment":"natural|duotone|mono"},
    {"type":"shape", "color":"<token>", "x":0, "y":58, "w":100, "h":42, "radius":0, "angle":0},
    {"type":"text", "x":8, "y":64, "w":84, "h":24, "items":["kicker","headline","sub","facts"], "align":"left|center|right", "valign":"top|center|bottom", "ink":"auto|<token>", "accent":"<token>", "headline":"normal|large|huge", "upper":false, "backing":"none|scrim|<token>"},
    {"type":"logo", "x":8, "y":90, "size":7, "anchor":"left|right|center"}
  ]
}`;

function layoutPrompt(b: DesignBrief, angle: string): { system: string; user: string } {
  return {
    system: [
      `You are the senior graphic designer of ${b.context.brandName}. You compose ONE social-media visual yourself, element by element, like in a design tool. There is no template: the layout is yours.`,
      'Answer ONLY with JSON in this exact shape (no comments in your answer):',
      SCHEMA,
      'Units: x, y, w, h are PERCENT of the canvas width (x, w) and height (y, h). Logo "size" is its height in percent of the canvas short side (4 to 12). Shape "radius" in percent of its short side (50 = circle/pill).',
      'Text blocks: "items" are the approved words, in reading order, each used once (all facts go in one "facts" item). The renderer fits the type to the block: give the headline a LARGE block — it must be the dominant element. "ink":"auto" picks the legible colour of what is under the block. On a photo, use "backing":"scrim" (soft dark gradient) or a solid token, or place the text on a calm area of the photo.',
      'Every approved fact and the offer must appear. Exactly one logo. Shapes are for structure (bands, panels, frames, big geometric forms) — never decoration for its own sake.',
      angle,
    ].join('\n'),
    user: briefLines(b, 'percent').join('\n'),
  };
}

/** Le designer de mise en page, un tour. */
export async function writeLayout(orch: CreativeOrchestrator, b: DesignBrief, key: string, angle: string, round: number, previous?: LoopFeedback<LayoutDesign>): Promise<LayoutDesign | null> {
  const base = layoutPrompt(b, angle);
  const user = previous ? [base.user, '', 'YOUR PREVIOUS LAYOUT:', JSON.stringify(previous.design), ...revisionLines(previous)].join('\n') : base.user;
  const res = await orch.run<LayoutDesign | null>({
    role: 'posterLayoutDesigner',
    key: `${key}:r${round}`,
    minLevel: 'max',
    profile: 'coder',
    prompt: () => ({ system: base.system, user }),
    parse: (raw) => parseLayout(raw),
    fallback: () => null,
  });
  return res.value;
}

// ─── La construction ────────────────────────────────────────────────────────

const overlapArea = (a: PosterBox, b: PosterBox) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Construit la mise en page avec les briques mesurées. Les défauts de construction repartent au designer. */
export function buildLayout(design: LayoutDesign, b: DesignBrief): { body: string; issues: string[] } {
  const spec = b.spec;
  const { width: W, height: H, u, safe } = spec;
  const issues: string[] = [];
  const bgToken = tokenById(b.tokens, design.background);
  if (bgToken?.neon) issues.push(`"${bgToken.id}" is neon: never a background`);
  if (!bgToken) issues.push(`unknown background token "${design.background}": use one of ${b.tokens.map((t) => t.id).join(', ')}`);
  const bg = bgToken?.hex || b.tokens[0].hex;
  const px = (e: LayoutElement): PosterBox => ({ x: (e.x / 100) * W, y: (e.y / 100) * H, w: (e.w / 100) * W, h: (e.h / 100) * H });
  const inSafe = (box: PosterBox): PosterBox => {
    const x0 = Math.max(box.x, safe.left);
    const y0 = Math.max(box.y, safe.top);
    const x1 = Math.min(box.x + box.w, W - safe.right);
    const y1 = Math.min(box.y + box.h, H - safe.bottom);
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  };
  const painted: { box: PosterBox; kind: 'photo' | 'shape'; hex?: string }[] = [];
  /** Ce qui est sous une boîte : la photo ou l'aplat le plus haut qui en couvre l'essentiel, sinon le fond. */
  const under = (box: PosterBox): { photo: boolean; hex: string } => {
    for (let i = painted.length - 1; i >= 0; i--) {
      const p = painted[i];
      if (overlapArea(p.box, box) > box.w * box.h * 0.5) return p.kind === 'photo' ? { photo: true, hex: '#3a3a3a' } : { photo: false, hex: p.hex! };
    }
    return { photo: false, hex: bg };
  };
  const used = new Set<TextItem>();
  const offerPlaced = !!spec.copy.offer && design.elements.some((e) => e.type === 'text' && e.items?.includes('offer'));
  let logos = 0;
  const parts: string[] = [];
  for (const e of design.elements) {
    const box = px(e);
    if (e.type === 'photo') {
      const image = b.images[(e.photo || 1) - 1];
      if (!image) {
        issues.push(`photo ${e.photo} does not exist (${b.images.length} provided)`);
        continue;
      }
      if (box.w < W * 0.12 || box.h < H * 0.1) issues.push('a photo is too small to read: give it at least a fifth of the canvas');
      const radius = e.radius ? (Math.min(box.w, box.h) * e.radius) / 100 : 0;
      parts.push(B.photo({ ...spec, treatment: e.treatment || 'natural' }, box, { radius, image }));
      painted.push({ box, kind: 'photo' });
    } else if (e.type === 'shape') {
      const t = tokenById(b.tokens, e.color);
      if (!t) {
        issues.push(`unknown colour token "${e.color}"`);
        continue;
      }
      if (t.neon && box.w * box.h > W * H * 0.03) issues.push(`"${t.id}" is a neon colour: use it only as a thin line or a small accent, not as a ${Math.round(e.w)}%×${Math.round(e.h)}% area`);
      const radius = e.radius ? (Math.min(box.w, box.h) * e.radius) / 100 : 0;
      parts.push(B.block(box, t.hex, `${radius ? `border-radius:${Math.round(radius)}px;` : ''}${e.angle ? `transform:rotate(${e.angle}deg);` : ''}`));
      painted.push({ box, kind: 'shape', hex: t.hex });
    } else if (e.type === 'text') {
      const items = (e.items || []).filter((i) => !used.has(i));
      const present = items.filter((i) => (i === 'kicker' ? spec.copy.kicker : i === 'sub' ? spec.copy.sub : i === 'facts' ? spec.copy.facts.length : i === 'offer' ? spec.copy.offer : i === 'quote' ? spec.copy.quote : i === 'author' ? spec.copy.quote?.author : true));
      if (!present.length) continue;
      const tb = inSafe(box);
      if (tb.w < W * 0.18 || tb.h < 5 * u) {
        issues.push(`the text block with ${present.join(', ')} is too small once kept inside the safe zone: enlarge it`);
        continue;
      }
      const ground = under(tb);
      let backingHtml = '';
      const inkToken = tokenById(b.tokens, e.ink);
      let ink = inkToken && !inkToken.neon ? inkToken.hex : undefined;
      let surface = ground.hex;
      let onPhoto = ground.photo;
      const solid = e.backing && e.backing !== 'none' && e.backing !== 'scrim' ? tokenById(b.tokens, e.backing) : undefined;
      if (solid) {
        const pad = 3.4 * u;
        backingHtml = B.block({ x: tb.x - pad, y: tb.y - pad, w: tb.w + pad * 2, h: tb.h + pad * 2 }, solid.hex);
        surface = solid.hex;
        onPhoto = false;
        ink = ink || solid.ink;
      } else if (e.backing === 'scrim' && ground.photo) {
        const dir = e.valign === 'top' ? 'to bottom' : 'to top';
        const pad = 6 * u;
        backingHtml = `<div class="blk" style="left:${Math.round(tb.x - pad)}px;top:${Math.round(tb.y - pad)}px;width:${Math.round(tb.w + pad * 2)}px;height:${Math.round(tb.h + pad * 2)}px;background:linear-gradient(${dir}, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.42) 62%, rgba(0,0,0,0) 100%);border-radius:${Math.round(pad)}px"></div>`;
        surface = '#1a1a1a';
      }
      ink = ink || (onPhoto ? '#ffffff' : inkOn(surface, [spec.palette.text, '#ffffff']));
      // Le fluo n'est jamais une couleur de texte : la couleur principale prend sa place.
      const accentToken = tokenById(b.tokens, e.accent);
      const accentHex = accentToken && !accentToken.neon ? accentToken.hex : spec.palette.primary;
      const accent = onPhoto && e.backing !== 'scrim' ? null : B.emphasisOn({ ...spec, scheme: { ...spec.scheme, ink } }, surface, accentHex);
      const muted = onPhoto ? 'rgba(255,255,255,0.9)' : mutedOn(ink, surface);
      const rule = onPhoto ? 'rgba(255,255,255,0.5)' : mix(ink, surface, 0.6);
      const hMax = (e.headline === 'huge' ? 17 : e.headline === 'large' ? 12.5 : 9) * u;
      const html = present.map((i) => {
        used.add(i);
        switch (i) {
          case 'kicker':
            return B.kicker(spec, accent || muted, 1, surface);
          case 'headline':
            return B.headline(spec, ink!, accent, { max: hMax, min: 4.6 * u, upper: e.upper, weight: e.upper ? 900 : undefined, tight: e.headline === 'huge' });
          case 'sub':
            return B.sub(spec, muted);
          case 'facts':
            return B.facts(spec, ink!, rule, { offer: !offerPlaced });
          case 'offer':
            return B.fit('offer', 10 * u, (e.headline === 'huge' ? 30 : 22) * u, `color:${accent || ink};font-weight:900;line-height:0.88;letter-spacing:-0.03em;white-space:nowrap;font-family:var(--fd)`, B.esc(spec.copy.offer || ''));
          case 'quote':
            return B.fit('quote', 4 * u, 8.5 * u, `color:${ink}`, `“${B.esc(spec.copy.quote!.text)}”`);
          case 'author':
            return B.fit('author', 2.4 * u, 3.4 * u, `color:${muted};font-weight:600`, B.esc(spec.copy.quote!.author || ''));
        }
      });
      const align = e.align === 'center' ? 'center' : 'left';
      parts.push(backingHtml + B.stack(tb, html, { justify: e.valign === 'center' ? 'center' : e.valign === 'bottom' ? 'end' : 'start', align, gap: 1.8 * u, name: present[0], overPhoto: ground.photo }));
    } else if (e.type === 'logo') {
      if (logos++) continue;
      const h = clamp(((e.size ?? 7) / 100) * Math.min(W, H), 4.5 * u, 12 * u);
      const lb = inSafe({ x: box.x, y: box.y, w: Math.max(box.w, h * spec.logo.aspect), h });
      const ground = under({ ...lb, w: h * spec.logo.aspect });
      const anchor = e.anchor || 'left';
      const x = anchor === 'right' ? Math.min(lb.x + lb.w, W - safe.right) : lb.x;
      const y = Math.min(lb.y, H - safe.bottom - h);
      parts.push(B.logo(spec, { x, y, h, anchor }, ground.photo ? '#777777' : ground.hex, b.tokens.find((t) => t.hex.toLowerCase() === ground.hex.toLowerCase())?.ink || spec.scheme.ink));
    }
  }
  if (!used.has('headline')) issues.push('the headline is missing: put "headline" in a large text block');
  if (spec.copy.facts.length && !used.has('facts')) issues.push('the facts (date, place…) are missing: add a "facts" item');
  if (spec.copy.offer && !used.has('offer') && !used.has('facts')) issues.push('the offer is missing: add an "offer" item');
  if (spec.copy.quote && !used.has('quote')) issues.push('the quote is missing: add a "quote" item');
  if (!logos) issues.push('the logo is missing: add exactly one logo element');
  const bgCss = design.background === 'deep' && spec.scheme.id === 'ink' && spec.scheme.bgCss ? spec.scheme.bgCss : bg;
  return { body: `<div class="pv" style="width:${W}px;height:${H}px;background:${bgCss}">${parts.join('')}</div>`, issues };
}

/** Les angles d'attaque des deux designers du cran Max (deux propositions réellement différentes). */
export function layoutAngles(hasPhoto: boolean): string[] {
  return hasPhoto
    ? [
        'YOUR ANGLE: photo-led — the brand photo carries the emotion, cropped boldly; the type is built around it.',
        'YOUR ANGLE: type-led — a bold typographic architecture with strong colour areas; the photo, if used, is a secondary framed element.',
      ]
    : ['YOUR ANGLE: a bold typographic poster — scale contrast and colour areas.', 'YOUR ANGLE: an editorial, airy composition — refined hierarchy and a geometric structure.'];
}

export type { PosterSpec };
