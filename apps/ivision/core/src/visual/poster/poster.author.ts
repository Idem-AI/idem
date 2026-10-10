/**
 * CRAN ULTRA — LE VISUEL D'AUTEUR : l'IA invente et code tout le visuel.
 *
 *   1. le DIRECTEUR DE CRÉATION invente deux concepts réellement différents : l'idée, la mise en
 *      page, l'usage de la photo, des couleurs et de la typographie ; il peut réécrire le titre
 *      (le titre proposé repasse les mêmes contrôles que celui du rédacteur) ;
 *   2. un DESIGNER par concept écrit le HTML/CSS complet de l'affiche — formes, SVG, dégradés de
 *      la charte, grande typographie, photo découpée… — dans un CONTRAT : jetons de couleur,
 *      polices de la charte, mots approuvés, photos et logo fournis, blocs de texte ajustables ;
 *   3. le code VÉRIFIE et NETTOIE le HTML (aucun script, aucune ressource extérieure, aucune
 *      couleur ni texte hors charte) puis la boucle de conception rend, MESURE, fait CRITIQUER et
 *      renvoie défauts et corrections au designer (trois tours au plus) ;
 *   4. la critique compare les concepts aboutis et garde le plus professionnel.
 *
 * Si aucun concept n'aboutit, le compositeur reprend la méthode du cran inférieur, et le dit.
 */
import { agentLines } from '../../creativity/agent-io';
import type { CreativeOrchestrator } from '../../creativity/orchestrator';
import { approvedWords, briefLines, type DesignBrief } from './poster.canvas';
import { validHeadline, type PosterBrief } from './poster.copy';
import { revisionLines, type LoopFeedback } from './poster.loop';
import type { PosterCopy } from './poster.types';

export interface PosterConcept {
  title: string;
  idea: string;
  layout: string;
  photo: string;
  colour: string;
  type: string;
  headline?: string;
}

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ─── 1. Le directeur de création ────────────────────────────────────────────

export function parseConcepts(raw: string): PosterConcept[] | undefined {
  const json = (raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || raw).match(/[\[{][\s\S]*[\]}]/)?.[0];
  if (!json) return undefined;
  try {
    const o = JSON.parse(json.replace(/,\s*([\]}])/g, '$1'));
    const list = (Array.isArray(o) ? o : Array.isArray(o.concepts) ? o.concepts : Array.isArray(o.ideas) ? o.ideas : [])
      .map((c: any) => ({
        title: String(c.title || '').slice(0, 60),
        idea: String(c.idea || '').slice(0, 400),
        layout: String(c.layout || '').slice(0, 400),
        photo: String(c.photo || '').slice(0, 200),
        colour: String(c.colour || c.color || '').slice(0, 200),
        type: String(c.type || c.typography || '').slice(0, 200),
        headline: typeof c.headline === 'string' && c.headline.trim() && !/^(keep|same|none)$/i.test(c.headline.trim()) ? c.headline.trim().slice(0, 70) : undefined,
      }))
      .filter((c: PosterConcept) => c.idea.length > 10 && c.layout.length > 10);
    return list.length ? list.slice(0, 3) : undefined;
  } catch {
    return undefined;
  }
}

export async function inventConcepts(orch: CreativeOrchestrator, b: DesignBrief, brief: PosterBrief, count: number, key = 'posterCreativeDirector'): Promise<PosterConcept[]> {
  const res = await orch.run<PosterConcept[] | null>({
    role: 'posterCreativeDirector',
    key,
    minLevel: 'ultra',
    profile: 'coder',
    prompt: () => ({
      system: [
        `You are the executive creative director of ${b.context.brandName}'s agency. Invent ${count} REALLY DIFFERENT concepts for this one social-media visual — the kind that wins awards and still sells. Not templates: ideas (a visual metaphor, a bold crop, a typographic architecture, a striking use of the brand colour, a graphic device born from the brand).`,
        'Each concept says precisely what a designer must build: the layout (where the photo, the headline, the colour areas, the logo go, their proportions), how the photo is used (crop, mask, cut-out shape, duotone…), how the colours are used, the typographic attitude.',
        'You may propose a sharper headline (max 9 words, same language, no fact or format that is not in the request) or "keep".',
        'Answer ONLY with JSON: {"concepts":[{"title":"","idea":"","layout":"","photo":"","colour":"","type":"","headline":"keep|<new headline>"}]}',
      ].join('\n'),
      user: briefLines(b, 'px').join('\n'),
    }),
    parse: (raw) => parseConcepts(raw),
    fallback: () => null,
  });
  const concepts = res.value || [];
  // Un titre réécrit repasse les contrôles du rédacteur.
  return concepts.map((c) => (c.headline && !validHeadline(c.headline, brief) ? { ...c, headline: undefined } : c));
}

// ─── 2. Le designer ─────────────────────────────────────────────────────────

const ROLE_SIZES = (u: number) => ({
  kicker: [2.1 * u, 3.4 * u],
  headline: [4.6 * u, 18 * u],
  sub: [2.6 * u, 4.2 * u],
  facts: [2.4 * u, 3.6 * u],
  offer: [10 * u, 34 * u],
  quote: [4 * u, 9 * u],
  author: [2.4 * u, 3.6 * u],
});

function contract(b: DesignBrief): string[] {
  const { spec } = b;
  const u = spec.u;
  const sizes = ROLE_SIZES(u);
  const r = Math.round;
  const lh = [r(4.5 * u), r(12 * u)];
  return [
    'OUTPUT: ONLY the inner HTML of the poster, in one ```html block. The poster root (position:relative; width and height of the canvas; background var(--paper)) is provided — paint your own background inside it if the concept needs one.',
    'POSITIONING: absolute positions in px (style="position:absolute;left:…px;top:…px;width:…px;height:…px"). You may add ONE <style> block; your class names start with "x-".',
    'TEXT — the renderer FITS your type, so follow this exactly:',
    '- every text sits in a TEXT BOX: <div data-stack="NAME" style="position:absolute;left:…;top:…;width:…;height:…;display:flex;flex-direction:column;justify-content:flex-start|center|flex-end;align-items:flex-start|center;text-align:left|center;gap:…px">',
    '- each line of the box: <div class="fit ROLE" data-min="MIN" data-max="MAX" style="color:var(--token)">WORDS</div> where ROLE is kicker, headline, sub, facts, offer, quote or author. Never set font-size on .fit (the renderer chooses between data-min and data-max so it fits the box); font-weight, letter-spacing, text-transform, line-height are yours.',
    `- size ranges in px: ${Object.entries(sizes).map(([k, [a, z]]) => `${k} ${r(a)}–${r(z)}`).join(', ')}. The headline is the dominant element: give its box room.`,
    '- inside the headline you may wrap ONE word in <span style="color:var(--token)">.',
    '- facts: <div class="fit facts" …><span class="fact">…</span><span class="sep" style="background:var(--token)"></span><span class="fact">…</span></div>',
    '- a text box over a photo gets data-over-photo="1" and must sit on a calm area or a backing you draw (solid shape or rgba(0,0,0,…) gradient).',
    'PHOTOS: <div class="ph" style="position:absolute;left;top;width;height;border-radius:…;clip-path:…"><img src="{{PHOTO_1}}" style="object-position:X% Y%"></div> — {{PHOTO_1}}, {{PHOTO_2}}… are the photos provided. Add data-bg="1" on a photo that is a background behind text.',
    b.spec.logo.url
      ? `LOGO: exactly once — <div class="logo" style="position:absolute;left:…;top:…"><img src="{{LOGO}}" style="height:Hpx;width:auto;display:block"></div> with H between ${lh[0]} and ${lh[1]}, on a calm area where its ink reads.`
      : 'LOGO: none — this brand has no logo file: no logo, no {{LOGO}}, no brand signature.',
    `COLOURS: only var(--${b.tokens.map((t) => t.id).join('), var(--')}), plus rgba(0,0,0,a) and rgba(255,255,255,a) for scrims and shadows. Gradients of these are fine. FONTS: only var(--fd) (display) and var(--fb) (text).`,
    'GRAPHICS: shapes (divs, clip-path, inline <svg> filled with the colour vars) are welcome when they serve the concept — bands, frames, oversized geometric forms, cut-outs, patterns drawn from the brand. Forbidden: <script>, external URLs, @import, icons, emojis, buttons, fake UI, any text that is not an approved word (no <text> in SVG).',
  ];
}

export interface AuthoredDesign {
  html: string;
}

export function extractHtml(raw: string): string | undefined {
  const m = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  // Sans bloc de code : du premier « < » au dernier « > » (jamais le raisonnement qui l'entoure).
  const bare = raw.includes('data-stack') ? raw.slice(raw.indexOf('<'), raw.lastIndexOf('>') + 1) : '';
  const html = (m ? m[1] : bare).trim();
  return html.length > 80 ? html : undefined;
}

export async function writeAuthored(orch: CreativeOrchestrator, b: DesignBrief, concept: PosterConcept, key: string, round: number, previous?: LoopFeedback<AuthoredDesign>): Promise<AuthoredDesign | null> {
  const system = [
    `You are a world-class graphic designer who codes. You build ONE social-media visual for ${b.context.brandName} in HTML/CSS, from the creative director's concept, at agency level.`,
    ...contract(b),
  ].join('\n');
  const conceptLines = [
    `CONCEPT "${concept.title}": ${concept.idea}`,
    `LAYOUT: ${concept.layout}`,
    `PHOTO: ${concept.photo}`,
    `COLOUR: ${concept.colour}`,
    `TYPE: ${concept.type}`,
  ];
  const base = [...briefLines(b, 'px'), '', ...conceptLines].join('\n');
  const user = previous ? [base, '', 'YOUR PREVIOUS HTML:', '```html', previous.design.html.slice(0, 14000), '```', ...revisionLines(previous)].join('\n') : base;
  const res = await orch.run<AuthoredDesign | null>({
    role: 'posterAuthor',
    key: `${key}:r${round}`,
    minLevel: 'ultra',
    profile: 'coder',
    prompt: () => ({ system, user }),
    parse: (raw) => {
      const html = extractHtml(raw);
      return html ? { html } : undefined;
    },
    fallback: () => null,
  });
  return res.value;
}

// ─── 3. La vérification et le nettoyage ─────────────────────────────────────

const FORBIDDEN_TAGS = /<\/?(script|iframe|object|embed|link|meta|base|a|button|input|form|textarea|select|video|audio|canvas|foreignObject)\b[^>]*>/gi;

/** Les mots visibles d'un HTML (sans balises, styles ni attributs). */
function visibleWords(html: string): string[] {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  return (text.match(/[\p{L}\p{N}]+/gu) || []).map(fold);
}

/**
 * Vérifie le HTML du designer et le prépare au rendu. Bloquant (renvoyé au designer) : texte non
 * approuvé, couleur hors jetons, ressource extérieure, titre ou logo absent, texte hors bloc.
 */
export function buildAuthored(design: AuthoredDesign, b: DesignBrief, copy: PosterCopy): { body: string; issues: string[] } {
  const { spec } = b;
  const issues: string[] = [];
  let html = design.html;

  if (FORBIDDEN_TAGS.test(html)) issues.push('forbidden elements (script, link, a, button, iframe, media…): remove them');
  html = html.replace(FORBIDDEN_TAGS, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '');
  if (/@import|url\(\s*['"]?(?!data:image\/svg|#)/i.test(html.replace(/\{\{(PHOTO_\d|LOGO)\}\}/g, ''))) issues.push('external resources (url(), @import) are not allowed: use only {{PHOTO_n}} and {{LOGO}}');
  html = html.replace(/@import[^;]*;?/gi, '');
  if (/<svg[\s\S]*?<text\b/i.test(html)) issues.push('no <text> inside SVG: every word goes in a .fit text box');

  // Les textes : seulement les mots approuvés.
  const allowed = new Set([...approvedWords(copy).flatMap((w) => (w.text.match(/[\p{L}\p{N}]+/gu) || []).map(fold)), ...(spec.brandName.match(/[\p{L}\p{N}]+/gu) || []).map(fold)]);
  const foreign = [...new Set(visibleWords(html).filter((w) => !allowed.has(w)))];
  if (foreign.length) issues.push(`text that is not an approved word: ${foreign.slice(0, 8).join(', ')} — use the approved words only`);
  // Chaque mot approuvé une fois : un mot répété dans un badge ou un décor est un défaut d'amateur.
  const budget = new Map<string, number>();
  for (const w of approvedWords(copy).flatMap((x) => (x.text.match(/[\p{L}\p{N}]+/gu) || []).map(fold))) budget.set(w, (budget.get(w) || 0) + 1);
  const counts = new Map<string, number>();
  for (const w of visibleWords(html)) counts.set(w, (counts.get(w) || 0) + 1);
  const repeated = [...counts].filter(([w, n]) => budget.has(w) && (w.length > 2 || /^\d+$/.test(w)) && n > (budget.get(w) || 0)).map(([w]) => w);
  if (repeated.length) issues.push(`words repeated outside their approved line: ${repeated.slice(0, 6).join(', ')} — each approved text appears once`);

  // Les couleurs : une couleur écrite en dur est ramenée au jeton le plus proche (même transparence) —
  // la charte est tenue par le code, sans faire perdre un tour au designer.
  const palette = [...b.tokens.map((t) => t.hex), '#ffffff', '#000000'].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const);
  const nearest = (r: number, g: number, bl: number) => palette.reduce((best, c) => ((c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - bl) ** 2 < (best[0] - r) ** 2 + (best[1] - g) ** 2 + (best[2] - bl) ** 2 ? c : best));
  const hex2 = (c: readonly number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  html = html
    .replace(/(?<!url\(\s*['"]?|href=['"]?)#([0-9a-f]{6}|[0-9a-f]{3})\b(?![\w-])/gi, (m, h: string) => {
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      return hex2(nearest(parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)));
    })
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi, (_m, r, g, bl, a) => {
      const c = nearest(+r, +g, +bl);
      return a !== undefined ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : hex2(c);
    });

  // Le fluo : un filet ou un petit accent, jamais une couleur de texte ni une grande surface.
  for (const t of b.tokens.filter((x) => x.neon)) {
    // En couleur de texte : remplacé par la couleur principale (la mesure du contraste veille).
    html = html.replace(new RegExp(`(^|[;"\\s])color\\s*:\\s*var\\(--${t.id}\\)`, 'gi'), '$1color:var(--primary)');
    const asText = false;
    const big = [...html.matchAll(/style="([^"]*)"/g)].some(([, st]) => new RegExp(`background(-color)?\\s*:\\s*var\\(--${t.id}\\)`, 'i').test(st) && (+(st.match(/width\s*:\s*([\d.]+)px/)?.[1] || 0)) * (+(st.match(/height\s*:\s*([\d.]+)px/)?.[1] || 0)) > spec.width * spec.height * 0.03);
    if (asText || big) issues.push(`var(--${t.id}) is a neon colour: only a thin line or one small accent — never a large area`);
  }
  // Les polices : celles de la charte (corrigé en silence).
  html = html.replace(/font-family\s*:\s*([^;"']+)/gi, (m, v: string) => (/var\(--f[db]\)/.test(v) ? m : `font-family:var(--fd)`));

  // Structure : un titre, un logo, chaque texte dans un bloc ajustable.
  if (!/class="[^"]*\bfit\b[^"]*\bheadline\b/.test(html)) issues.push('no headline: add <div class="fit headline" data-min data-max> inside a text box');
  if (copy.facts.length && !/class="[^"]*\bfit\b[^"]*\bfacts\b/.test(html)) issues.push('the facts are missing: add a .fit facts line');
  if (copy.offer && !copy.headline.includes((copy.offer.match(/\d+/) || [''])[0]) && !html.includes((copy.offer.match(/\d+/) || ['@@'])[0])) issues.push(`the offer ${copy.offer} is missing`);
  const logoCount = (html.match(/\{\{LOGO\}\}/g) || []).length;
  if (spec.logo.url && logoCount !== 1) issues.push(`the logo must appear exactly once (found ${logoCount})`);
  if ((html.match(/data-stack=/g) || []).length === 0) issues.push('no text box: wrap the texts in <div data-stack="…">');
  const photoRefs = [...html.matchAll(/\{\{PHOTO_(\d+)\}\}/g)].map((m) => +m[1]);
  if (photoRefs.some((n) => n < 1 || n > b.images.length)) issues.push(`only {{PHOTO_1}}…{{PHOTO_${b.images.length}}} exist`);

  // Les ressources réelles, posées par le code.
  html = html.replace(/\{\{PHOTO_(\d+)\}\}/g, (_m, n) => b.images[+n - 1]?.url || '');
  // Sans logo : une balise {{LOGO}} glissée par le designer disparaît (jamais une image cassée).
  if (!spec.logo.url) html = html.replace(/<div[^>]*class="logo"[^>]*>\s*<img[^>]*\{\{LOGO\}\}[^>]*>\s*<\/div>/gi, '').replace(/<img[^>]*\{\{LOGO\}\}[^>]*>/gi, '');
  if (spec.logo.url) {
    const t = spec.logo.trim;
    const view = t ? `object-view-box:inset(${(t.top * 100).toFixed(2)}% ${(t.right * 100).toFixed(2)}% ${(t.bottom * 100).toFixed(2)}% ${(t.left * 100).toFixed(2)}%);object-fit:contain;` : 'object-fit:contain;';
    html = html.replace(/<img([^>]*?)src="\{\{LOGO\}\}"([^>]*?)style="([^"]*)"/i, (_m, a, c, st) => `<img${a}src="${spec.logo.url}" data-role="logo"${c}style="${view}${st}"`).replace(/\{\{LOGO\}\}/g, spec.logo.url);
  }
  // Les .fit sans tailles reçoivent celles de leur rôle ; une taille de police posée à la main est retirée.
  const sizes = ROLE_SIZES(spec.u);
  html = html.replace(/<div([^>]*class="[^"]*\bfit\s+(kicker|headline|sub|facts|offer|quote|author)\b[^"]*"[^>]*)>/g, (m, attrs: string, role: keyof typeof sizes) => {
    let a = attrs.replace(/font-size\s*:\s*[^;"]+;?/gi, '');
    const [mn, mx] = sizes[role];
    if (!/data-min=/.test(a)) a += ` data-min="${Math.round(mn)}"`;
    if (!/data-max=/.test(a)) a += ` data-max="${Math.round(mx)}"`;
    // Les bornes du designer, ramenées dans la plage du rôle.
    a = a.replace(/data-min="([\d.]+)"/, (_x, v) => `data-min="${Math.round(Math.max(mn * 0.9, Math.min(+v, mx)))}"`).replace(/data-max="([\d.]+)"/, (_x, v) => `data-max="${Math.round(Math.min(mx * 1.1, Math.max(+v, mn)))}"`);
    return `<div${a}>`;
  });

  const p = spec.palette;
  const vars = b.tokens.map((t) => `--${t.id}:${t.hex}`).join(';');
  const deep = b.tokens.find((t) => t.id === 'deep');
  return {
    body: `<div class="pv" style="${vars};--primary:${p.primary};width:${spec.width}px;height:${spec.height}px;background:var(--paper)${deep ? '' : ''}">${html}</div>`,
    issues,
  };
}

/** Les mots d'un concept : le titre réécrit par le directeur de création, s'il a passé les contrôles. */
export function conceptCopy(copy: PosterCopy, concept: PosterConcept): PosterCopy {
  return concept.headline ? { ...copy, headline: concept.headline, emphasis: undefined } : copy;
}

export { agentLines };
