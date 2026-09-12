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
 * Business plan — graphe CONSTRUIT à partir de la structure choisie.
 *
 * Les sections d'un plan ne sont plus fixes : une structure « banque » ne
 * contient pas « Opportunity », une structure « VC » ajoute « Traction » et
 * « Exit Strategy ». Un graphe figé y répondrait de la pire des façons — il
 * ferait échouer `validateGraph` sur une dépendance vers une section absente,
 * au démarrage de la génération.
 *
 * Les dépendances vivent donc dans le catalogue (`requires` de chaque section)
 * et sont FILTRÉES ici sur les sections réellement retenues. Une section dont
 * toutes les dépendances sont absentes part en première vague : c'est le bon
 * comportement, elle n'a rien à attendre.
 *
 * `Cover Page` reste sans dépendance À DESSEIN: c'est la première section
 * diffusée en streaming, la faire attendre retarderait le premier affichage
 * pour un gain de cohérence quasi nul (un titre et une identité de marque).
 */
export function buildBusinessPlanGraph(
  sections: ReadonlyArray<{
    name: string;
    requires?: string[];
    consults?: ProjectSectionKey[];
  }>
): DeliverableGraph {
  const present = new Set(sections.map((s) => s.name));
  const graph: DeliverableGraph = {};

  for (const section of sections) {
    const requires = (section.requires ?? []).filter((name) => present.has(name));
    graph[section.name] = {
      ...(requires.length > 0 ? { requires } : {}),
      ...(section.consults?.length ? { consults: section.consults } : {}),
    };
  }

  // Le catalogue déclare des dépendances entre ALTERNATIVES (« Financial Plan »
  // attend « Opportunity » OU « Market Analysis » selon la structure). Filtrer
  // ne peut donc pas créer de cycle, mais une faute de frappe dans le catalogue
  // le pourrait : le contrôle reste, il coûte une passe sur un objet de vingt
  // clés.
  validateGraph(graph, [...present]);
  return graph;
}

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
