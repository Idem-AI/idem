/**
 * Le PLANIFICATEUR DE CONTENU : la structure SÉMANTIQUE d'une section, avant toute décision graphique.
 *
 * Le contenu arrive déjà structuré (les rédacteurs de l'hôte produisent des blocs) : la règle « données
 * déjà structurées → réutiliser » s'applique, et ce planificateur ne fait qu'en déduire ce que la
 * composition doit savoir — le RÔLE de la section quand l'hôte ne l'a pas dit. Il est déterministe : un
 * appel de modèle n'apporterait rien que les blocs ne disent déjà.
 */
import type { SectionContent, SectionRole } from '../contracts/content-model';
import type { ContentAnalysis } from '../composition-engine/analyze';

export function inferRole(section: SectionContent, a: ContentAnalysis): SectionRole {
  if (section.role) return section.role;
  if (a.kinds.has('cover')) return 'cover';
  if (a.kinds.has('contact')) return 'card-face';
  if (a.kinds.has('copy')) return 'visual';
  if (a.specimen) return 'specimen';
  if (a.kinds.has('sources') && a.blocks.length === 1) return 'appendix';
  if (a.kinds.has('comparison') || a.kinds.has('swot') || a.kinds.has('riskMatrix')) return 'comparison';
  if (a.kinds.has('timeline') || a.kinds.has('steps') || a.kinds.has('funnel')) return 'process';
  if (a.dataHeavy || a.kinds.has('metrics')) return 'data';
  if (a.light) return 'opening';
  return 'narrative';
}

/** La section, son rôle complété (le contenu n'est jamais modifié). */
export function planContent(section: SectionContent, a: ContentAnalysis): SectionContent {
  return section.role ? section : { ...section, role: inferRole(section, a) };
}
