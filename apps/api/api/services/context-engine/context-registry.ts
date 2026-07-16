import { ProjectModel } from '../../models/project.model';
import { ProjectSectionKey } from '../../models/revision.model';

/**
 * Registre central des sections d'un projet IDEM.
 *
 * C'est la source de vérité unique sur "où vit quelle donnée" : chaque section
 * sait s'extraire du document projet, se décrire pour un agent IA et produire
 * un résumé token-efficient. Le versioning (Chronicle) et le Context Engine
 * partagent ce même découpage, si bien qu'une section = un artefact versionné
 * = une unité de contexte récupérable à la demande.
 */
export interface SectionDefinition {
  key: ProjectSectionKey;
  /** Description courte, orientée agent: quoi et quand l'utiliser. */
  description: string;
  extract(project: ProjectModel): unknown;
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    key: 'overview',
    description:
      "Fiche d'identité du projet: nom, description, type, contraintes, équipe, budget, cibles, phases sélectionnées, coordonnées.",
    extract: (p) => ({
      name: p.name,
      description: p.description,
      type: p.type,
      constraints: p.constraints,
      teamSize: p.teamSize,
      scope: p.scope,
      budgetIntervals: p.budgetIntervals,
      targets: p.targets,
      selectedPhases: p.selectedPhases,
      additionalInfos: p.additionalInfos,
    }),
  },
  {
    key: 'branding',
    description:
      'Identité de marque: logo retenu et variantes générées, palettes de couleurs, typographies, sections de la charte graphique.',
    extract: (p) => p.analysisResultModel?.branding,
  },
  {
    key: 'businessPlan',
    description: "Business plan complet généré ou édité par l'utilisateur (sections rédigées).",
    extract: (p) => p.analysisResultModel?.businessPlan,
  },
  {
    key: 'pitchDeck',
    description: 'Pitch deck (slides de présentation investisseurs).',
    extract: (p) => p.analysisResultModel?.pitchDeck,
  },
  {
    key: 'legalDocs',
    description: 'Documents légaux générés (CGU, politique de confidentialité, etc.).',
    extract: (p) => p.analysisResultModel?.legalDocs,
  },
  {
    key: 'design',
    description: "Diagrammes d'architecture et de conception (use cases, classes, séquence…).",
    extract: (p) => p.analysisResultModel?.design,
  },
  {
    key: 'landing',
    description: 'Landing page générée (structure, contenus, options).',
    extract: (p) => p.analysisResultModel?.landing,
  },
  {
    key: 'architectures',
    description: 'Architectures techniques proposées pour le projet.',
    extract: (p) => p.analysisResultModel?.architectures,
  },
  {
    key: 'development',
    description:
      'Configurations de développement (stack, frameworks, options de génération de code).',
    extract: (p) => p.analysisResultModel?.development,
  },
  {
    key: 'communication',
    description: 'Stratégie de communication, calendrier éditorial et flyers générés.',
    extract: (p) => p.analysisResultModel?.communication,
  },
  {
    key: 'finance',
    description:
      'Prévisions financières: hypothèses, revenus, charges, trésorerie, indicateurs (TRI, VAN, point mort).',
    extract: (p) => p.analysisResultModel?.finance,
  },
  {
    key: 'deployments',
    description: 'Déploiements cloud du projet (composants, statuts, configurations).',
    extract: (p) => p.deployments,
  },
];

export const sectionRegistry = new Map<ProjectSectionKey, SectionDefinition>(
  SECTION_DEFINITIONS.map((d) => [d.key, d])
);

export const ALL_SECTION_KEYS: ProjectSectionKey[] = SECTION_DEFINITIONS.map((d) => d.key);

export function isSectionKey(value: string): value is ProjectSectionKey {
  return sectionRegistry.has(value as ProjectSectionKey);
}

/** True si la section contient une donnée exploitable (non vide). */
export function sectionHasContent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

const SUMMARY_MAX_STRING = 160;
const SUMMARY_MAX_ARRAY = 8;
const SUMMARY_MAX_DEPTH = 5;

/**
 * Résumé générique token-efficient d'une valeur de section: structure
 * préservée, longues chaînes tronquées (SVG, HTML, mermaid…), tableaux
 * échantillonnés. L'agent voit la forme et les valeurs clés sans payer le
 * coût du contenu intégral — il peut ensuite demander le détail via get_section
 * en mode "full" sur un chemin précis.
 */
export function summarizeValue(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return value;

  if (typeof value === 'string') {
    if (value.length <= SUMMARY_MAX_STRING) return value;
    return `${value.slice(0, SUMMARY_MAX_STRING)}… [tronqué, ${value.length} caractères — utiliser detail="full" avec un chemin pour le contenu intégral]`;
  }

  if (typeof value !== 'object') return value;

  if (depth >= SUMMARY_MAX_DEPTH) {
    return Array.isArray(value) ? `[tableau de ${value.length} éléments]` : '[objet imbriqué]';
  }

  if (Array.isArray(value)) {
    const sample = value.slice(0, SUMMARY_MAX_ARRAY).map((v) => summarizeValue(v, depth + 1));
    if (value.length > SUMMARY_MAX_ARRAY) {
      sample.push(`… [${value.length - SUMMARY_MAX_ARRAY} éléments supplémentaires]`);
    }
    return sample;
  }

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = summarizeValue(v, depth + 1);
  }
  return out;
}

/**
 * Accès à un sous-chemin d'une section, notation pointée ("colors.primary",
 * "sections.0.name"). Retourne undefined si le chemin n'existe pas.
 */
export function getAtPath(value: unknown, dottedPath?: string): unknown {
  if (!dottedPath) return value;
  let current: unknown = value;
  for (const segment of dottedPath.split('.')) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}
