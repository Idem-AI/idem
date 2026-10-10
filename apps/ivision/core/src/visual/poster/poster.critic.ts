/**
 * LA CRITIQUE VISUELLE — les yeux des crans High, Max et Ultra.
 *
 * Un modèle de vision regarde le RENDU réel (pas le code) comme un directeur artistique exigeant :
 * hiérarchie, lisibilité, équilibre, fidélité à la charte, finition. Il rend un verdict, une note
 * et des corrections concrètes que l'agent qui a composé applique au tour suivant. Il compare
 * aussi plusieurs rendus côte à côte pour désigner le plus professionnel.
 *
 * La critique CONSEILLE : les contrôles mesurés (débordement, chevauchement, contraste sur les
 * pixels, marges) restent seuls à pouvoir écarter une composition.
 */
import sharp from 'sharp';
import { coreHost } from '../../runtime/host';
import logger from '../../runtime/logger';
import type { VisualBrandContext } from '../visual.model';
import type { PosterCopy } from './poster.types';

export interface CritiqueContext {
  context: VisualBrandContext;
  /** La demande de l'utilisateur, telle qu'il l'a écrite. */
  request: string;
  copy: PosterCopy;
  feedback?: string;
  /** Ce que l'auteur voulait faire (concept), pour juger l'intention et pas seulement la finition. */
  intent?: string;
}

export interface Critique {
  verdict: 'ok' | 'revise';
  /** 0–10 : 8 = publiable par une agence, 6 = correct, 4 = amateur. */
  score: number;
  fixes: string[];
}

function charterLine(ctx: VisualBrandContext): string {
  const b = ctx.branding;
  const ad = ctx.artDirection;
  return [
    `Brand: ${ctx.brandName} — ${ctx.businessType}; tone: ${ctx.tone}.`,
    `Colours: primary ${b.primary}${b.secondary ? `, secondary ${b.secondary}` : ''}${b.accent ? `, accent ${b.accent}` : ''}. Fonts: ${b.primaryFont || 'brand display'} / ${b.secondaryFont || 'brand text'}.`,
    ad ? `Art direction: ${ad.styleName || ad.styleId}. Do: ${(ad.dos || []).slice(0, 3).join('; ')}. Don't: ${(ad.donts || []).slice(0, 3).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

const jpeg = async (png: Buffer, height = 900) => (await sharp(png).resize({ height, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()).toString('base64');

export function parseCritique(raw: string): Critique | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const o = JSON.parse(json);
      // La note : la moyenne des critères, le plus faible pesant double (un défaut grave se voit).
      const crit = ['hierarchy', 'legibility', 'balance', 'brand', 'finish', 'originality'].map((k) => Number(o[k])).filter((v) => Number.isFinite(v));
      const score = crit.length >= 4 ? Math.round(((crit.reduce((a, v) => a + v, 0) + Math.min(...crit)) / (crit.length + 1)) * 10) / 10 : Math.max(0, Math.min(10, Number(o.score)));
      const fixes = (Array.isArray(o.fixes) ? o.fixes : []).map((f: unknown) => String(f).slice(0, 220)).filter((f: string) => f.length > 4).slice(0, 5);
      const verdict = (o.verdict ? /revise/i.test(String(o.verdict)) : score < 8) && fixes.length ? 'revise' : 'ok';
      if (Number.isFinite(score)) return { verdict, score, fixes };
    } catch {
      /* lecture ligne à ligne ci-dessous */
    }
  }
  const score = Number(raw.match(/score\s*[:=]\s*(\d+(?:\.\d+)?)/i)?.[1]);
  const fixes = [...raw.matchAll(/^\s*[-*]?\s*fix\s*[:=]\s*(.+)$/gim)].map((m) => m[1].trim().slice(0, 220)).slice(0, 5);
  if (!Number.isFinite(score)) return null;
  return { verdict: /verdict\s*[:=]\s*revise/i.test(raw) && fixes.length ? 'revise' : 'ok', score: Math.max(0, Math.min(10, score)), fixes };
}

/** Relit UN rendu : verdict, note, corrections. Sans vision chez l'hôte : null (on s'en tient aux mesures). */
export async function reviewPoster(png: Buffer, c: CritiqueContext): Promise<Critique | null> {
  const analyze = coreHost().analyzeImage;
  if (!analyze) return null;
  const facts = [c.copy.offer, ...c.copy.facts.map((f) => f.text)].filter(Boolean).join(', ');
  try {
    const raw = await analyze(
      await jpeg(png),
      'image/jpeg',
      [
        'You are the demanding creative director of a top branding agency. Review this social-media visual exactly as it will be published.',
        charterLine(c.context),
        `The client asked: "${c.request.slice(0, 300)}".`,
        `Approved words: headline "${c.copy.headline}"${c.copy.kicker ? `, kicker "${c.copy.kicker}"` : ''}${c.copy.sub ? `, subtitle "${c.copy.sub}"` : ''}${facts ? `, facts: ${facts}` : ''}${c.copy.quote ? `, quote "${c.copy.quote.text}"` : ''}.`,
        c.intent ? `The designer's intent: ${c.intent.slice(0, 300)}` : '',
        c.feedback ? `The client rejected the previous version: "${c.feedback.slice(0, 160)}" — check this one answers it.` : '',
        'Judge: (1) one clear focal point and hierarchy (headline first); (2) every text legible — size and contrast, nothing cut, nothing on a busy photo area without a calm backing; (3) balance, alignment, generous consistent margins, nothing cramped or floating; (4) true to the brand colours and fonts, logo visible and clean; (5) professional finish — no clutter, no cheap effects, no empty dead zones, the photo well cropped; (6) is it memorable, or a generic template?',
        'Typical amateur tells — each one costs points: small decorative dots, pills, badges or confetti that carry no information; a word repeated in a badge; a neon colour used on large areas; elements floating without alignment; a cramped corner; a logo stuck on as an afterthought; two competing focal points; a generic "template" look.',
        'Be strict and calibrated: most AI-made visuals are 5–6. Rate EACH criterion 0–10 (9 = award level, 8 = premium agency, 7 = good but generic, 6 = acceptable, 4 = amateur): hierarchy, legibility, balance, brand, finish, originality.',
        'Then name the two biggest weaknesses as CONCRETE, spatial fixes ("move the logo to the bottom-left corner, 1/3 smaller", "put the headline on a solid brand-colour band over the lower third of the photo"), never vague ("improve hierarchy").',
        'Reply ONLY with JSON: {"hierarchy":0,"legibility":0,"balance":0,"brand":0,"finish":0,"originality":0,"fixes":["...","..."]}',
      ]
        .filter(Boolean)
        .join('\n'),
      { maxOutputTokens: 400, temperature: 0.1, purpose: 'visual-analysis' }
    );
    return parseCritique(raw);
  } catch (error) {
    logger.warn('poster.review_failed', { event: 'poster.review_failed', error });
    return null;
  }
}

/** Compare des rendus côte à côte et désigne le plus professionnel (index), avec sa raison. */
export async function compareRenders(pngs: Buffer[], c: CritiqueContext): Promise<{ best: number; why?: string } | null> {
  const analyze = coreHost().analyzeImage;
  if (!analyze || pngs.length < 2) return null;
  try {
    const tileH = 460;
    const tiles = await Promise.all(pngs.map((p) => sharp(p).resize({ height: tileH }).png().toBuffer({ resolveWithObject: true })));
    let x = 0;
    const comps = tiles.map((t) => {
      const item = { input: t.data, left: x, top: 0 };
      x += t.info.width + 16;
      return item;
    });
    const sheet = await sharp({ create: { width: x - 16, height: tileH, channels: 3, background: '#9a9a9a' } }).composite(comps).jpeg({ quality: 82 }).toBuffer();
    const raw = await analyze(
      sheet.toString('base64'),
      'image/jpeg',
      [
        `${pngs.length} candidate social-media visuals, numbered 1 to ${pngs.length} from left to right.`,
        charterLine(c.context),
        `The client asked: "${c.request.slice(0, 240)}".`,
        'As a demanding creative director, pick the one you would publish: clear hierarchy, legible text, balance, on-brand, professional finish, memorable. A real photo of the brand’s own people, well composed, beats an empty layout.',
        'Reply ONLY with JSON: {"best": <number>, "why": "<15 words"}',
      ].join('\n'),
      { maxOutputTokens: 120, temperature: 0, purpose: 'visual-analysis' }
    );
    const json = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    const best = Number(json.best) - 1;
    return Number.isInteger(best) && best >= 0 && best < pngs.length ? { best, why: typeof json.why === 'string' ? json.why.slice(0, 140) : undefined } : null;
  } catch (error) {
    logger.warn('poster.critic_failed', { event: 'poster.critic_failed', error });
    return null;
  }
}

/** Les défauts MESURÉS d'un rendu, dits en mots pour l'agent qui corrige. */
export function measuredIssues(m: { overflow: string[]; overlaps: string[]; outside: string[]; tooSmall: string[]; lowContrast?: { name: string; ratio: number }[]; dropped?: string[]; headlineU: number }): string[] {
  return [
    ...m.overflow.map((o) => (o.startsWith('loose:') ? `the ${o.slice(6)} text is not inside a <div data-stack> text box: every .fit line must be in one` : `text block "${o}" does not fit its box even at the minimum size: make the box larger or give it fewer elements`)),
    ...m.overlaps.map((o) => `"${o.replace('/', '" overlaps "')}": move one of them so they never touch`),
    ...m.outside.map((o) => `"${o}" goes outside the safe margins: keep every text and the logo inside the safe zone`),
    ...(m.lowContrast || []).map((c) => `"${c.name}" is not legible on what is behind it (contrast ${c.ratio}:1): put it on a solid calm area or change its colour token`),
    ...m.tooSmall.map((t) => `"${t}" is too small to read on a phone`),
    ...(m.dropped || []).map((d) => `"${d}" was removed because its box was too small`),
    ...(m.headlineU && m.headlineU < 6 ? ['the headline is too small for a poster: give it a much larger box'] : []),
  ];
}
