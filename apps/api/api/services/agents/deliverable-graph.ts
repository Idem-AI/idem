/**
 * Graphes de dépendances des livrables.
 *
 * Jusqu'ici, les 9 sections d'un business plan et les 11 slides d'un deck
 * étaient déclarées `hasDependencies: false`: elles partaient toutes en même
 * temps, sans qu'aucune ne sache ce que les autres racontaient. Rapide et peu
 * cher, mais c'est la cause directe des livrables qui se contredisent (une
 * cible dans une section, une autre dans le plan financier).
 *
 * Un graphe déclare qui a besoin de quoi. Les dépendances ne transportent PAS
 * le texte des sections amont mais leur digest (cf. `section-digest.service`):
 * la cohérence est gagnée sans repayer le contenu à chaque étape.
 *
 * ARBITRAGE ASSUMÉ — latence contre cohérence: un graphe se déroule par vagues,
 * donc le temps total passe d'« une section » à « profondeur × une section ».
 * Les graphes ci-dessous sont volontairement PLATS (3 vagues) et larges: à
 * chaque vague, plusieurs sections partent en parallèle. Ajouter une dépendance
 * « logique mais accessoire » coûte une vague entière — s'en tenir aux liens qui
 * évitent une vraie contradiction.
 */

import type { ProjectSectionKey } from '../../models/revision.model';

export interface GraphNode {
  /** Sections dont le digest est injecté dans le prompt de celle-ci. */
  requires?: string[];
  /**
   * Sections d'AUTRES modules (branding, finance…) que l'étape peut consulter
   * elle-même via les outils du Context Engine. Voir `IPromptStep.contextTools`.
   */
  consults?: ProjectSectionKey[];
}

export type DeliverableGraph = Record<string, GraphNode>;

/**
 * Business plan — 3 vagues.
 *
 *  V1  Cover Page · Opportunity · Target Audience · Products & Services
 *  V2  Company Summary · Marketing & Sales · Financial Plan
 *  V3  Goal Planning · Appendix
 *
 * `Cover Page` reste sans dépendance À DESSEIN: c'est la première section
 * diffusée en streaming, la faire attendre retarderait le premier affichage
 * pour un gain de cohérence quasi nul (un titre et une identité de marque).
 */
export const BUSINESS_PLAN_GRAPH: DeliverableGraph = {
  'Cover Page': { consults: ['branding'] },
  Opportunity: {},
  'Target Audience': {},
  'Products & Services': {},

  // La synthèse doit refléter ce qui est réellement écrit ailleurs: c'est la
  // section la plus lue, et celle où une contradiction se voit immédiatement.
  'Company Summary': {
    requires: ['Opportunity', 'Products & Services', 'Target Audience'],
  },
  'Marketing & Sales': {
    requires: ['Target Audience', 'Products & Services'],
  },
  // Les chiffres doivent porter sur les produits réellement décrits, aux prix
  // réellement annoncés — et rester alignés sur le module Finance s'il existe.
  'Financial Plan': {
    requires: ['Products & Services', 'Opportunity'],
    consults: ['finance'],
  },

  'Goal Planning': {
    requires: ['Marketing & Sales', 'Financial Plan'],
  },
  Appendix: {
    requires: ['Opportunity', 'Financial Plan'],
  },
};

/**
 * Pitch deck — 3 vagues.
 *
 *  V1  Cover · Problem · Market · Team · Business Model
 *  V2  Solution · Product · Competition · Financials
 *  V3  Traction · Ask
 *
 * `Ask` dépend de `Financials`: un montant demandé qui ne découle pas des
 * projections est le défaut le plus visible d'un deck généré.
 */
export const PITCH_DECK_GRAPH: DeliverableGraph = {
  Cover: { consults: ['branding'] },
  Problem: {},
  Market: {},
  Team: {},
  'Business Model': {},

  Solution: { requires: ['Problem'] },
  Product: { requires: ['Problem', 'Business Model'] },
  Competition: { requires: ['Market'] },
  Financials: { requires: ['Business Model', 'Market'], consults: ['finance'] },

  Traction: { requires: ['Product', 'Business Model'] },
  Ask: { requires: ['Financials', 'Business Model'] },
};

/**
 * Vérifie qu'un graphe est acyclique et ne référence que des étapes connues.
 * Appelé à l'application du graphe: une faute de frappe dans un nom de section
 * doit échouer au démarrage de la génération, pas bloquer l'ordonnanceur.
 */
export function validateGraph(graph: DeliverableGraph, knownSteps: string[]): void {
  const known = new Set(knownSteps);

  for (const [step, node] of Object.entries(graph)) {
    for (const required of node.requires ?? []) {
      if (!known.has(required)) {
        throw new Error(
          `Graphe invalide: l'étape "${step}" dépend de "${required}", qui n'existe pas dans ce livrable.`
        );
      }
    }
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (step: string, path: string[]): void => {
    const current = state.get(step);
    if (current === 'done') return;
    if (current === 'visiting') {
      throw new Error(`Graphe invalide: cycle de dépendances ${[...path, step].join(' → ')}.`);
    }
    state.set(step, 'visiting');
    for (const required of graph[step]?.requires ?? []) {
      visit(required, [...path, step]);
    }
    state.set(step, 'done');
  };

  for (const step of Object.keys(graph)) visit(step, []);
}

/** Profondeur du graphe = nombre de vagues = multiplicateur de latence. */
export function graphDepth(graph: DeliverableGraph): number {
  const memo = new Map<string, number>();
  const depth = (step: string): number => {
    const cached = memo.get(step);
    if (cached !== undefined) return cached;
    const requires = graph[step]?.requires ?? [];
    const value = requires.length === 0 ? 1 : 1 + Math.max(...requires.map(depth));
    memo.set(step, value);
    return value;
  };
  const steps = Object.keys(graph);
  return steps.length === 0 ? 0 : Math.max(...steps.map(depth));
}
