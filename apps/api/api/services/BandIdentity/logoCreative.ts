/**
 * LES AGENTS DU LOGO — selon le cran de la jauge de créativité.
 *
 *   low     aucun agent : trois logos composés par le code (logoTemplates.ts)
 *   medium  le dessinateur (pipeline historique) : l'IA dessine chaque proposition en SVG,
 *           puis critique et révision
 *   high    + le directeur de création : trois directions DISTINCTES, une par proposition,
 *           pour que les trois logos ne soient pas trois variantes d'une même idée
 *   max     + deux brouillons par proposition, départagés par le jury (après svgGate)
 *   ultra   + trois brouillons par proposition
 */
import type { AgentTask } from '../creativity/orchestrator';
import { agentLines, LETTERS, pickOption } from '../creativity/agent-io';
import type { LogoModel, LogoType } from '../../models/logo.model';

const TYPE_BRIEF: Record<LogoType, string> = {
  icon: 'a symbol + the brand name',
  name: 'a wordmark: the brand name alone, typography is the logo',
  initial: 'a monogram: the initials alone',
};

/** High+ : trois directions de création, une par proposition. */
export function logoDirectionsTask(sheet: string, type: LogoType, count: number, wish?: string): AgentTask<string[] | null> {
  return {
    role: 'logoDirector',
    minLevel: 'high',
    prompt: () => ({
      system: [
        `You are the creative director of a brand identity. Propose ${count} clearly DIFFERENT directions for ${count} logo proposals (${TYPE_BRIEF[type]}), true to the brand charter and its art direction.`,
        'Each direction: the idea (metaphor or form), the construction (geometry, weight, negative space) and the use of the brand colours — in one sentence, no brand-name puns that need explaining.',
        `Output ONLY ${count} lines: 1: … / 2: … / 3: …`,
      ].join('\n'),
      user: [sheet, wish ? `CLIENT WISH: ${wish.slice(0, 300)}` : ''].filter(Boolean).join('\n'),
    }),
    parse: (raw) => {
      const lines = [...(raw || '').matchAll(/^\s*[*-]?\s*(?:direction\s*)?(\d)\s*[.):\-–]\s*(.+)$/gim)].map((m) => m[2].replace(/\*+/g, '').trim());
      const directions = lines.filter((l) => l.split(/\s+/).length >= 6).map((l) => l.slice(0, 300));
      return directions.length >= count ? directions.slice(0, count) : undefined;
    },
    fallback: () => null,
  };
}

/** Le SVG soumis au jury : l'icône seule quand le lockup est composé (le nom est déterministe). */
const juryArtwork = (logo: LogoModel) => ((logo.lockup && logo.iconSvg) || logo.svg || '').replace(/\s+/g, ' ').slice(0, 5000);

/** Max+ : le jury départage les brouillons d'une proposition (déjà passés par svgGate). */
export function logoJuryTask(sheet: string, drafts: LogoModel[], index: number): AgentTask<number> {
  return {
    role: 'logoJury',
    key: `logoJury:${index + 1}`,
    minLevel: 'max',
    profile: 'critic',
    prompt: () =>
      drafts.length < 2
        ? null
        : {
            system: [
              'You are a jury of senior brand designers. Pick the STRONGEST logo draft for this brand: distinctive, simple, balanced, legible at 16 px, true to the charter and its art direction.',
              'Output ONLY: best: the letter of one draft',
            ].join('\n'),
            user: [sheet, 'DRAFTS:', ...drafts.map((d, i) => `${LETTERS[i]}) ${d.concept ? `concept: ${d.concept.slice(0, 200)} — ` : ''}svg: ${juryArtwork(d)}`)].join('\n'),
          },
    parse: (raw) => {
      const ids = drafts.map((_, i) => LETTERS[i]);
      const letter = pickOption(agentLines(raw).best || raw.trim(), ids);
      return letter ? ids.indexOf(letter) : undefined;
    },
    fallback: () => 0,
  };
}

/** Nombre de brouillons dessinés par proposition, selon le cran. */
export const logoDraftCount = (level: string) => (level === 'ultra' ? 3 : level === 'max' ? 2 : 1);
