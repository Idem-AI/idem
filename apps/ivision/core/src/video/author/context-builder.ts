/**
 * LE COMPILATEUR DE CONTEXTE — ce que l'auteur d'une scène reçoit, et rien de plus.
 *
 * Il ne choisit ni mise en page ni style : il rassemble la référence d'API, un à trois exemples
 * techniques proches de la scène, la fiche de la scène (intention, idées, textes exacts, médias,
 * minutage, voix, tempo), la bible du film et ses voisines. Un petit modèle travaille ainsi sur UN
 * problème précis, avec les seules API qui existent dans la version installée.
 */
import type { CreativityLevel } from '../../creativity/levels';
import type { BrandTokens } from '../../../motion/kit/context';
import type { VideoFormat } from '../contracts/model';
import { COMPOSITION } from '../rendering/formats';
import { API_REFERENCE } from './api-reference';
import { pickExamples } from './examples';
import type { CodeSnippet } from './snippets';
import { textsLine } from '../director/film-format';
import { repairInstruction, RepairStrategy } from './repair';

export interface AuthorSceneCard {
  key: string;
  index: number;
  count: number;
  duration: number;
  purpose: string;
  visual: string;
  motion: string;
  transition?: string;
  texts: Record<string, string>;
  media: { id: string; kind: 'image' | 'video'; width: number; height: number; note?: string; durationSec?: number }[];
  voice?: { text: string; at: number; duration: number };
  beat?: { bpm: number; first: number };
}

export interface AuthorContext {
  film: { title: string; concept: string; bible: string };
  format: VideoFormat;
  brand: BrandTokens;
  scene: AuthorSceneCard;
  previous?: { purpose: string; visual: string };
  next?: { purpose: string; visual: string };
  snippets: CodeSnippet[];
  level: CreativityLevel;
  /** Retouche demandée par l'utilisateur, avec le code actuel. */
  revise?: { instruction: string; code: string };
  /** Correction (automatique ou demandée) : la stratégie, le code actuel (s'il y en a un), l'erreur et les erreurs passées. */
  repair?: { strategy: RepairStrategy; code?: string; error: string; history: string[] };
}

/** Le même contexte à tous les crans : la jauge choisit le MODÈLE (`config/creative-roles.ts`), pas le contexte. */
const EXAMPLES = 2;

export function buildAuthorPrompt(c: AuthorContext): { system: string; user: string } {
  const s = c.scene;
  const size = COMPOSITION[c.format];
  const examples = pickExamples({ purpose: s.purpose, visual: s.visual, motion: s.motion, transition: s.transition, mediaKinds: s.media.map((m) => m.kind), first: s.index === 0, last: s.index === s.count - 1 }, EXAMPLES);
  const system = [
    'You are a senior motion designer who writes Motion Canvas code (TypeScript + JSX). You write ONE scene of a short film, as one complete file.',
    'Make it look designed and alive: deliberate composition, clear hierarchy, real motion design (staggered entrances, easing, overlaps, a strong moment) — not a slide with text fading in.',
    'Use ONLY the API below. Every text comes from ctx.texts, every media from ctx.media, every colour and font from ctx.brand.',
    '',
    API_REFERENCE,
    '',
    '# Examples of correct code (techniques to learn from — do NOT copy their layout)',
    ...examples.map((e) => `## ${e.id}: ${e.shows}\n\`\`\`tsx\n${e.code}\n\`\`\``),
    '',
    'Answer with ONE ```tsx code block containing the whole file, and nothing else.',
  ].join('\n');

  const logo = c.brand.logo ? `available (${[c.brand.logo.light ? 'light' : '', c.brand.logo.dark ? 'dark' : '', c.brand.logo.svg ? 'svg' : ''].filter(Boolean).join(', ')}${c.brand.logo.width ? `, ${c.brand.logo.width}×${c.brand.logo.height}` : ''})` : 'none';
  const lines = [
    `FILM: ${c.film.title || '(untitled)'} — ${c.film.concept}`,
    c.film.bible ? `BIBLE: ${c.film.bible}` : '',
    `FRAME: ${c.format} ${size.width}×${size.height} (origin at the center) — scene ${s.index + 1} of ${s.count}, duration ${s.duration.toFixed(2)} s`,
    `BRAND: ${c.brand.name || '(no brand on screen)'} — colours primary ${c.brand.colors.primary}, secondary ${c.brand.colors.secondary}, accent ${c.brand.colors.accent}, background ${c.brand.colors.background}, text ${c.brand.colors.text}; fonts display "${c.brand.fonts.display}", body "${c.brand.fonts.body}"; logo ${logo}`,
    c.previous ? `PREVIOUS SCENE: ${c.previous.purpose} — ${c.previous.visual}`.slice(0, 400) : 'PREVIOUS SCENE: none (this scene opens the film)',
    c.next ? `NEXT SCENE: ${c.next.purpose} — ${c.next.visual}`.slice(0, 400) : 'NEXT SCENE: none (this scene closes the film)',
    '',
    'THIS SCENE',
    `purpose: ${s.purpose}`,
    `visual: ${s.visual}`,
    `motion: ${s.motion}`,
    s.transition ? `transition: ${s.transition}` : '',
    `texts (exact, read them from ctx.texts.KEY): ${textsLine(s.texts)}`,
    `media: ${s.media.length ? s.media.map((m, i) => `ctx.media[${i}] = ${m.id} ${m.kind}${m.width ? ` ${m.width}×${m.height}` : ''}${m.durationSec ? ` ${m.durationSec.toFixed(1)}s` : ''}${m.note ? ` — ${m.note.slice(0, 160)}` : ''}`).join(' · ') : 'none'}`,
    s.voice ? `voice-over: "${s.voice.text}" — starts at ${s.voice.at.toFixed(2)} s, lasts ${s.voice.duration.toFixed(2)} s (sync key moments with waitUntilTime)` : '',
    s.beat ? `music: ${Math.round(s.beat.bpm)} bpm, first beat at ${s.beat.first.toFixed(2)} s (beatTime(ctx, n))` : '',
  ];
  if (c.snippets.length) {
    lines.push('', 'REUSABLE FUNCTIONS FROM EARLIER FILMS OF THIS BRAND (copy one into your file if it helps):', ...c.snippets.map((sn) => `\`\`\`tsx\n${sn.doc ? `// ${sn.doc}\n` : ''}${sn.code}\n\`\`\``));
  }
  if (c.revise) {
    lines.push('', 'CURRENT CODE OF THIS SCENE:', '```tsx', c.revise.code, '```', `THE CLIENT ASKS: ${c.revise.instruction}`, 'Rewrite the whole file to do what the client asks. Keep what the request does not concern.');
  }
  if (c.repair) {
    // « fix » corrige le code existant ; les autres stratégies repartent de la fiche (le code fautif n'est pas redonné).
    if (c.repair.strategy === 'fix' && c.repair.code) lines.push('', 'CURRENT CODE OF THIS SCENE:', '```tsx', c.repair.code, '```');
    lines.push('', repairInstruction(c.repair.code || c.repair.strategy !== 'fix' ? c.repair.strategy : 'rewrite', c.repair.error, c.repair.history));
  }
  return { system, user: lines.filter((l) => l !== '').join('\n') };
}

/** Le code d'une réponse : le premier bloc ```tsx (ou ts/jsx), sinon la réponse entière si c'est du code. */
export function extractCode(raw: string): string | null {
  const text = String(raw || '');
  const block = text.match(/```(?:tsx|ts|typescript|jsx|javascript|js)?\s*\n([\s\S]*?)```/i);
  if (block && /export\s+default/.test(block[1])) return block[1].trim();
  const open = text.match(/```(?:tsx|ts|typescript|jsx)?\s*\n([\s\S]*)$/i);
  if (open && /export\s+default/.test(open[1])) return open[1].trim();
  if (/export\s+default\s+function/.test(text) && /^\s*import\s/m.test(text)) return text.trim();
  return null;
}
