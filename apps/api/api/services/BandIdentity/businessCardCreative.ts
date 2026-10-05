/**
 * LES AGENTS DE LA CARTE DE VISITE — un par décision, selon le cran de la jauge de créativité.
 *
 *   structure      (dès Medium)  ce que porte chaque face (marque seule, mixte, tout au recto)
 *   mise en page   (dès High)    le recto et le verso dans les menus de la structure
 *   réglages       (dès Max)     couleur de la face de marque, alignement, filet, taille du nom
 *   concept        (Ultra)       l'idée donnée à l'IA qui écrit les deux faces en HTML
 *
 * Au cran Low, le code décide de tout (aucun appel) : la carte reste dans la charte.
 */
import type { AgentTask } from '../creativity/orchestrator';
import { agentLines, boundedNumber, menuLines, pickOption } from '../creativity/agent-io';
import { CARD_BACKS, CARD_FRONTS, CARD_STRUCTURES, CardBackId, CardFrontId, CardStructure, CardTuning } from './businessCardLayouts';

const STRUCTURES = Object.keys(CARD_STRUCTURES) as CardStructure[];

export function cardStructureTask(sheet: string, fallback: CardStructure): AgentTask<CardStructure> {
  return {
    role: 'cardStructure',
    minLevel: 'medium',
    prompt: () => ({
      system: 'You decide what each face of ONE business card carries, true to the brand. Output ONLY: structure: the letter of one option.',
      user: [sheet, 'STRUCTURES:', ...menuLines(STRUCTURES, (id) => CARD_STRUCTURES[id as CardStructure].summary)].join('\n'),
    }),
    parse: (raw) => pickOption(agentLines(raw).structure || raw.trim(), STRUCTURES),
    fallback: () => fallback,
  };
}

export function cardLayoutTask(sheet: string, structure: CardStructure, fallback: { front: CardFrontId; back: CardBackId }): AgentTask<{ front: CardFrontId; back: CardBackId }> {
  const def = CARD_STRUCTURES[structure];
  return {
    role: 'cardLayout',
    minLevel: 'high',
    prompt: () =>
      def.fronts.length < 2 && def.backs.length < 2
        ? null
        : {
            system: ['You are the art director of ONE business card, true to the brand charter and its art direction. Output ONLY:', 'front: the letter of one option from FRONTS', 'back: the letter of one option from BACKS'].join('\n'),
            user: [sheet, 'FRONTS:', ...menuLines(def.fronts, (id) => CARD_FRONTS[id as CardFrontId]), 'BACKS:', ...menuLines(def.backs, (id) => CARD_BACKS[id as CardBackId])].join('\n'),
          },
    parse: (raw) => {
      const l = agentLines(raw);
      const front = pickOption(l.front || l.recto, def.fronts);
      const back = pickOption(l.back || l.verso, def.backs);
      return front || back ? { front: front || fallback.front, back: back || fallback.back } : undefined;
    },
    fallback: () => fallback,
  };
}

export function cardTuningTask(sheet: string, surfaces: ('primary' | 'secondary' | 'accent')[]): AgentTask<CardTuning> {
  return {
    role: 'cardTuning',
    minLevel: 'max',
    prompt: () => ({
      system: [
        'You fine-tune ONE business card within safe bounds, true to the brand. Output ONLY:',
        `surface: ${surfaces.join(' | ')} (the brand colour of the brand face)`,
        'align: left | center',
        'rule: none | thin | bold',
        'name: 0.9 to 1.2 (size of the person’s name)',
      ].join('\n'),
      user: sheet,
    }),
    parse: (raw) => {
      const l = agentLines(raw);
      const out: CardTuning = {};
      const surface = pickOption(l.surface || l.colour || l.color, surfaces);
      if (surface) out.surface = surface;
      if (/^(left|gauche)/i.test(l.align || '')) out.align = 'left';
      else if (/^(center|centre)/i.test(l.align || '')) out.align = 'center';
      const rule = (['none', 'thin', 'bold'] as const).find((r) => (l.rule || '').toLowerCase().startsWith(r));
      if (rule) out.rule = rule;
      const scale = boundedNumber(l.name || l.namescale || l.scale, 0.9, 1.2);
      if (scale != null) out.nameScale = Math.round(scale * 100) / 100;
      return Object.keys(out).length ? out : undefined;
    },
    fallback: () => ({}),
  };
}

/** Cran Ultra : l'idée de la carte, transmise à l'IA qui en écrit les deux faces. */
export function cardConceptTask(sheet: string): AgentTask<string | null> {
  return {
    role: 'cardConcept',
    minLevel: 'ultra',
    prompt: () => ({
      system: 'You are the creative director of ONE business card. Invent a striking, professional, print-ready idea true to the brand charter and its art direction — not a stock template. Output ONLY: idea: one or two sentences (front and back, materials of the layout, placement, colour use).',
      user: sheet,
    }),
    parse: (raw) => {
      const idea = (agentLines(raw).idea || '').trim();
      return idea.split(/\s+/).length >= 6 ? idea.slice(0, 320) : undefined;
    },
    fallback: () => null,
  };
}
