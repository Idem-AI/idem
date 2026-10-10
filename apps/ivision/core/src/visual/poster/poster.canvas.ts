/**
 * Ce que les agents designers (crans Max et Ultra) reçoivent : la toile, la zone de sécurité, les
 * JETONS de couleur de la charte (jamais une couleur libre), les photos fournies, le logo et les
 * mots approuvés. Le même brief pour la mise en page (Max) et pour le HTML d'auteur (Ultra).
 */
import { contrastRatio, hexToOklch } from '../../design/color';
import type { VisualBrandContext } from '../visual.model';
import { inkOn, isDarkColor } from './poster.schemes';
import type { PosterCopy, PosterImage, PosterLogo, PosterScheme, PosterSpec } from './poster.types';

export interface ColorToken {
  id: string;
  hex: string;
  /** Fluo : un accent fin seulement, jamais une grande surface. */
  neon?: boolean;
  /** L'encre lisible sur ce fond. */
  ink: string;
  dark: boolean;
}

/** Les couleurs que l'IA peut employer, par nom. Le fond profond seulement si admis. */
export function colorTokens(spec: PosterSpec, schemes: PosterScheme[]): ColorToken[] {
  const p = spec.palette;
  const paper = schemes.find((s) => s.id === 'paper')?.bg || '#ffffff';
  const list: [string, string | undefined][] = [
    ['paper', paper],
    ['white', '#ffffff'],
    ['tint', schemes.find((s) => s.id === 'tint')?.bg],
    ['primary', p.primary],
    ['secondary', p.secondary !== p.primary ? p.secondary : undefined],
    ['accent', p.accent !== p.primary && p.accent !== p.secondary ? p.accent : undefined],
    ['text', p.text],
    ['deep', schemes.find((s) => s.id === 'ink')?.bg],
  ];
  const out: ColorToken[] = [];
  for (const [id, hex] of list) {
    if (!hex || out.some((t) => t.hex.toLowerCase() === hex.toLowerCase())) continue;
    const o = hexToOklch(hex);
    out.push({ id, hex, ink: inkOn(hex, [p.text, paper]), dark: isDarkColor(hex), ...(o && o.c > 0.2 && o.l > 0.7 ? { neon: true } : {}) });
  }
  return out;
}

export const tokenById = (tokens: ColorToken[], id?: string) => tokens.find((t) => t.id === String(id || '').toLowerCase().replace(/^var\(--|\)$/g, ''));

export interface DesignBrief {
  spec: PosterSpec;
  tokens: ColorToken[];
  images: PosterImage[];
  context: VisualBrandContext;
  request: string;
  intent: string;
  feedback?: string;
  reference?: string;
  /** Les compositions récentes de la marque (ne pas se répéter). */
  recent?: string[];
}

export function approvedWords(copy: PosterCopy): { role: string; text: string }[] {
  return [
    copy.kicker ? { role: 'kicker', text: copy.kicker } : null,
    { role: 'headline', text: copy.headline },
    copy.sub ? { role: 'sub', text: copy.sub } : null,
    copy.offer ? { role: 'offer', text: copy.offer } : null,
    ...copy.facts.map((f) => ({ role: 'facts', text: f.text })),
    copy.quote ? { role: 'quote', text: copy.quote.text } : null,
    copy.quote?.author ? { role: 'author', text: copy.quote.author } : null,
  ].filter((x): x is { role: string; text: string } => !!x);
}

const logoInk = (l: PosterLogo) => (l.ink === 'light' ? 'light (needs a dark area)' : l.ink === 'color' ? 'coloured (needs a light, calm area)' : 'dark (needs a light area)');

/** Les lignes du brief, communes aux deux designers. */
export function briefLines(b: DesignBrief, units: 'percent' | 'px'): string[] {
  const { spec, context: ctx } = b;
  const ad = ctx.artDirection;
  const W = spec.width;
  const H = spec.height;
  const pct = (v: number, of: number) => `${Math.round((v / of) * 1000) / 10}%`;
  const safe = units === 'px' ? `left ${Math.round(spec.safe.left)}px, top ${Math.round(spec.safe.top)}px, right ${Math.round(spec.safe.right)}px, bottom ${Math.round(spec.safe.bottom)}px` : `left ${pct(spec.safe.left, W)}, top ${pct(spec.safe.top, H)}, right ${pct(spec.safe.right, W)}, bottom ${pct(spec.safe.bottom, H)}`;
  return [
    `BRAND: ${ctx.brandName} — ${ctx.businessType}. Tone: ${ctx.tone}.${ctx.valueProposition ? ` Promise: ${ctx.valueProposition.slice(0, 200)}` : ''}`,
    ad ? `ART DIRECTION: ${ad.styleName || ad.styleId}${ad.tagline ? ` — ${ad.tagline}` : ''}. DO: ${(ad.dos || []).slice(0, 4).join('; ')}. DON'T: ${(ad.donts || []).slice(0, 4).join('; ')}.` : '',
    `THE CLIENT ASKED: "${b.request.slice(0, 400)}" (purpose: ${b.intent}).`,
    b.feedback ? `THE CLIENT REJECTED THE PREVIOUS VISUAL: "${b.feedback.slice(0, 200)}" — this one must answer that.` : '',
    b.reference ? `MODEL IMAGE TO FOLLOW (structure only, never its texts): ${b.reference.slice(0, 300)}` : '',
    b.recent?.length ? `RECENT VISUALS OF THE BRAND (do something different): ${b.recent.slice(-4).join(' | ')}` : '',
    `CANVAS: ${W}×${H}px (${spec.format}). SAFE ZONE — every text and the logo stay inside: ${safe}${spec.format === 'story' ? ' (the app interface covers the top and bottom of a story)' : ''}. Photos and colour areas may bleed to the edges.`,
    'COLOUR TOKENS (the ONLY colours allowed):',
    ...b.tokens.map((t) => `- ${t.id}: ${t.hex} (${t.dark ? 'dark' : 'light'}; text on it: ${t.ink.toLowerCase() === '#ffffff' ? 'white' : t.ink})${t.neon ? ' — NEON: only as a thin line or one small accent, never an area or a text colour' : ''}`),
    `FONTS: display "${ctx.branding.primaryFont || 'brand display'}" for the headline, text "${ctx.branding.secondaryFont || ctx.branding.primaryFont || 'brand text'}" for the rest.`,
    b.images.length ? 'PHOTOS PROVIDED (use the best one, or none if the concept is purely typographic):' : 'NO PHOTO: a typographic / graphic composition.',
    ...b.images.map((im, i) => `- photo ${i + 1}: ${im.subject || 'brand photo'}; ratio ${im.aspect.toFixed(2)}; subject at ${Math.round(im.focal.x * 100)}% x, ${Math.round(im.focal.y * 100)}% y${im.origin === 'brand' || im.origin === 'user' ? ' (real photo of the brand)' : ''}`),
    spec.logo.url ? `LOGO: ratio ${spec.logo.aspect.toFixed(2)} (width/height), ink ${logoInk(spec.logo)}. Exactly once, never on a busy photo area.` : `NO LOGO FILE: the brand name "${spec.brandName}" is set as a wordmark.`,
    'APPROVED WORDS (use them EXACTLY, add no other text — no slogan, hashtag, URL, button, date or number of your own):',
    ...approvedWords(spec.copy).map((w) => `- ${w.role}: "${w.text}"`),
    '',
    'PROFESSIONAL STANDARDS: one focal point; the headline is the largest text by far and reads in one second; at most 4 text sizes; strong alignment on a grid; generous, consistent margins; one strong colour used with intent; every graphic element is LARGE and structural (bands, panels, frames, big shapes) — no small decorative dots, pills, badges, stickers or confetti; each approved word appears ONCE; text on a photo only on a calm area or a solid/gradient backing; the photo cropped on its subject; no clutter, no fake UI, no stock-template look. Light surfaces unless the dark token exists.',
  ].filter(Boolean);
}

/** Contraste de deux couleurs (raccourci pour les designers). */
export const readable = (ink: string, bg: string, large: boolean) => contrastRatio(ink, bg) >= (large ? 3 : 4.5);
