/**
 * LES AGENTS DES VISUELS — un par décision, selon le cran de la jauge de créativité.
 *
 *   rédacteur        (tous les crans)  sur-titre, titre, sous-titre, fait chiffré du contenu
 *   structure        (dès Medium)      photo, typographique, chiffre, citation
 *   directeur art.   (dès High)        la composition dans le menu filtré par la DA + le mot en valeur
 *   concept          (Ultra)           l'idée de composition donnée au compositeur HTML
 *
 * Chaque tâche passe par l'orchestrateur (services/creativity/orchestrator.ts) : prompt court,
 * réponse en lignes, validation par le code, repli du code. Le rédacteur n'invente jamais un
 * chiffre : un fait chiffré absent du contenu est retiré.
 */
import type { AgentTask } from '../creativity/orchestrator';
import { agentLines, menuLines, pickOption } from '../creativity/agent-io';
import { FLYER_LAYOUTS, FlyerCopy, FlyerLayoutId, FlyerStructure } from './flyer.layouts';

export interface FlyerBrief {
  title: string;
  hook?: string;
  description?: string;
  intent?: string;
  language?: string;
}

const clip = (text: string | undefined, max: number) => {
  const t = (text || '').replace(/\s+/g, ' ').trim().replace(/^["'«»]+|["'«»]+$/g, '');
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:\-–—]$/, '').trim();
};
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const digitsOf = (t: string) => (t.match(/\d+/g) || []).join(' ');

/** Les mots du visuel tirés du contenu, sans modèle (repli et cran le plus bas sans réponse). */
export function heuristicFlyerCopy(brief: FlyerBrief): FlyerCopy {
  const headline = clip(brief.hook && words(brief.hook) <= 9 ? brief.hook : brief.title, 60) || clip(brief.title, 60);
  const sub = clip(brief.description, 110);
  const fact = `${brief.title} ${brief.hook || ''} ${brief.description || ''}`.match(/(-?\d+[\d\s.,]*\s?(?:%|F\s?CFA|FCFA|F|€|\$|XOF|XAF|km|h)?)/i)?.[1]?.trim();
  return { headline, sub: sub && sub !== headline ? sub : undefined, detail: fact && fact.length <= 14 ? fact : undefined };
}

export function copywriterTask(sheet: string, brief: FlyerBrief): AgentTask<FlyerCopy> {
  const source = `${brief.title} ${brief.hook || ''} ${brief.description || ''}`;
  return {
    role: 'flyerCopywriter',
    minLevel: 'low',
    prompt: () => ({
      system: [
        'You write the words of ONE social-media visual for a brand. Output ONLY these lines:',
        'kicker: 1-3 words above the headline, or none',
        'headline: the main line, at most 8 words, punchy, no emoji, no hashtag',
        'sub: one supporting sentence, at most 16 words, or none',
        'detail: one number/price/date copied EXACTLY from the content, or none',
        `Write in ${brief.language || 'the language of the content'}. Never invent a price, a date or a figure.`,
      ].join('\n'),
      user: [sheet, `CONTENT TITLE: ${brief.title}`, brief.hook ? `HOOK: ${brief.hook}` : '', brief.description ? `DESCRIPTION: ${brief.description.slice(0, 400)}` : '', brief.intent ? `INTENT: ${brief.intent}` : ''].filter(Boolean).join('\n'),
    }),
    parse: (raw) => {
      const l = agentLines(raw);
      const none = (v?: string) => !v || /^(none|aucun|n\/a|-|rien)$/i.test(v.trim());
      const headline = clip(l.headline || l.titre || l.title, 64);
      if (!headline || words(headline) > 10 || /[#\u{1F300}-\u{1FAFF}]/u.test(headline)) return undefined;
      const out: FlyerCopy = { headline };
      if (!none(l.kicker) && words(l.kicker) <= 4) out.kicker = clip(l.kicker, 28);
      if (!none(l.sub) && words(l.sub) <= 20) out.sub = clip(l.sub, 120);
      // Un fait chiffré n'est gardé que si ses chiffres sont DANS le contenu.
      if (!none(l.detail) && /\d/.test(l.detail) && digitsOf(l.detail).split(' ').every((d) => digitsOf(source).split(' ').includes(d))) out.detail = clip(l.detail, 16);
      // Le titre non plus n'invente pas de chiffre.
      if (/\d/.test(headline) && !digitsOf(headline).split(' ').every((d) => digitsOf(source).split(' ').includes(d))) return undefined;
      return out;
    },
    fallback: () => heuristicFlyerCopy(brief),
  };
}

const STRUCTURE_PITCH: Record<FlyerStructure, string> = {
  photo: 'photo-led: an image carries the message',
  type: 'typographic: the headline is the image',
  fact: 'number-led: one figure (price, %, date) dominates',
  quote: 'quote-led: the sentence as a testimonial',
};

export function structureTask(sheet: string, copy: FlyerCopy, options: FlyerStructure[], fallback: FlyerStructure): AgentTask<FlyerStructure> {
  return {
    role: 'flyerStructure',
    minLevel: 'medium',
    prompt: () =>
      options.length < 2
        ? null
        : {
            system: 'You decide the structure of ONE brand visual. Output ONLY: structure: the letter of one option.',
            user: [sheet, `HEADLINE: "${copy.headline}"${copy.detail ? ` · FACT: ${copy.detail}` : ''}`, 'STRUCTURES:', ...menuLines(options, (id) => STRUCTURE_PITCH[id as FlyerStructure])].join('\n'),
          },
    parse: (raw) => pickOption(agentLines(raw).structure || raw.trim(), options),
    fallback: () => fallback,
  };
}

export function artDirectorTask(sheet: string, copy: FlyerCopy, menu: FlyerLayoutId[], fallback: FlyerLayoutId): AgentTask<{ layout: FlyerLayoutId; emphasis?: number }> {
  const headlineWords = copy.headline.split(/\s+/).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}%€$'-]/gu, ''));
  return {
    role: 'flyerArtDirector',
    minLevel: 'high',
    prompt: () =>
      menu.length < 2
        ? null
        : {
            system: ['You are the art director of ONE social-media visual, true to the brand charter and its art direction. Output ONLY:', 'layout: the letter of one option from LAYOUTS', 'word: the most important word of the headline, copied exactly'].join('\n'),
            user: [sheet, `HEADLINE: "${copy.headline}"${copy.sub ? ` / "${copy.sub}"` : ''}`, 'LAYOUTS:', ...menuLines(menu, (id) => FLYER_LAYOUTS[id as FlyerLayoutId].summary)].join('\n'),
          },
    parse: (raw) => {
      const l = agentLines(raw);
      const layout = pickOption(l.layout || (/^\W*[a-p]\W*$/i.test(raw.trim()) ? raw.trim() : undefined), menu);
      if (!layout) return undefined;
      const w = (l.word || '').toLowerCase().replace(/[^\p{L}\p{N}%€$'-]/gu, '');
      const at = w ? headlineWords.indexOf(w) : -1;
      return { layout, ...(at >= 0 ? { emphasis: at } : {}) };
    },
    fallback: () => ({ layout: fallback }),
  };
}

export interface FlyerConcept {
  idea: string;
  focal: 'image' | 'headline' | 'number';
  dominant: 'primary' | 'secondary' | 'accent' | 'background';
}

/** Cran Ultra : l'idée de composition, décidée AVANT que le compositeur écrive le HTML. */
export function conceptTask(sheet: string, copy: FlyerCopy, hasImage: boolean): AgentTask<FlyerConcept | null> {
  return {
    role: 'flyerConcept',
    minLevel: 'ultra',
    prompt: () => ({
      system: [
        'You are the creative director of ONE social-media visual. Invent a striking, professional composition true to the brand charter and its art direction — not a stock template. Output ONLY:',
        'idea: one sentence describing the composition (layers, placement, scale contrast)',
        `focal: ${hasImage ? 'image | headline | number' : 'headline | number'}`,
        'dominant: primary | secondary | accent | background (the brand colour that dominates)',
      ].join('\n'),
      user: [sheet, `HEADLINE: "${copy.headline}"${copy.sub ? ` / "${copy.sub}"` : ''}${copy.detail ? ` · FACT: ${copy.detail}` : ''}`, hasImage ? 'A photo is available.' : 'No photo: typographic.'].join('\n'),
    }),
    parse: (raw) => {
      const l = agentLines(raw);
      const idea = clip(l.idea || l.concept, 240);
      if (!idea || words(idea) < 5) return undefined;
      const focal = (['image', 'headline', 'number'] as const).find((f) => (l.focal || '').toLowerCase().includes(f)) || 'headline';
      const dominant = (['primary', 'secondary', 'accent', 'background'] as const).find((d) => (l.dominant || '').toLowerCase().includes(d)) || 'primary';
      return { idea, focal: focal === 'image' && !hasImage ? 'headline' : focal, dominant };
    },
    fallback: () => null,
  };
}
