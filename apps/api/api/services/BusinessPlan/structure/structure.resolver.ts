/**
 * Résolution d'une structure de business plan.
 *
 * MODULE À PART, sans aucune dépendance d'infrastructure : `npm run
 * check:prompts` doit pouvoir le lire sans ouvrir Mongo, MinIO ni Puppeteer —
 * même raison que `businessPlanSpec.ts`.
 *
 * Une structure venue du client est une donnée non fiable : clés inconnues,
 * doublons, liste vide, sections qui ne peuvent pas tenir seules. Tout passe
 * par `resolveStructure`, qui rend TOUJOURS une structure exécutable.
 */

import {
  BUSINESS_PLAN_SECTION_CATALOG,
  BusinessPlanSectionDefinition,
  getSectionByKey,
} from './section-catalog';
import { BusinessPlanStructure } from '../../../models/businessPlanStructure.model';
import { CUSTOM_TEMPLATE_ID, DEFAULT_TEMPLATE_ID, getTemplate } from './templates';

/** Nombre minimum de sections pour qu'un document mérite le nom de plan. */
export const MIN_SECTIONS = 3;
/** Au-delà, la génération coûte plus qu'elle ne rapporte en lisibilité. */
export const MAX_SECTIONS = 20;

/**
 * Rend la structure exécutable d'un projet.
 *
 * @param stored Structure persistée sur le projet (peut être absente/invalide).
 * @returns La structure normalisée et la liste ordonnée des définitions.
 */
export function resolveStructure(stored?: BusinessPlanStructure | null): {
  structure: BusinessPlanStructure;
  sections: BusinessPlanSectionDefinition[];
} {
  const keys = sanitizeSectionKeys(stored?.sectionKeys);

  // Structure absente, vide ou entièrement inconnue : on retombe sur le modèle
  // par défaut plutôt que de produire un document de deux pages.
  if (keys.length < MIN_SECTIONS) {
    const fallbackId = stored?.templateId && stored.templateId !== CUSTOM_TEMPLATE_ID
      ? stored.templateId
      : DEFAULT_TEMPLATE_ID;
    const template = getTemplate(fallbackId) ?? getTemplate(DEFAULT_TEMPLATE_ID)!;
    return {
      structure: { templateId: template.id, sectionKeys: [...template.sectionKeys] },
      sections: template.sectionKeys
        .map(getSectionByKey)
        .filter((s): s is BusinessPlanSectionDefinition => !!s),
    };
  }

  return {
    structure: {
      templateId: stored?.templateId || CUSTOM_TEMPLATE_ID,
      sectionKeys: keys,
      updatedAt: stored?.updatedAt,
    },
    sections: keys.map(getSectionByKey).filter((s): s is BusinessPlanSectionDefinition => !!s),
  };
}

/**
 * Normalise une liste de clés reçue du client : clés inconnues écartées,
 * doublons supprimés (la PREMIÈRE position gagne — c'est celle que
 * l'utilisateur a posée), longueur plafonnée.
 *
 * L'ordre du client est conservé tel quel : c'est tout l'objet de la
 * fonctionnalité. Réordonner « pour bien faire » annulerait le choix que
 * l'utilisateur vient d'exprimer, et une banque qui numérote ses rubriques
 * attend exactement sa numérotation.
 */
export function sanitizeSectionKeys(keys?: readonly string[] | null): string[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of keys) {
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (!key || seen.has(key) || !getSectionByKey(key)) continue;
    seen.add(key);
    result.push(key);
    if (result.length >= MAX_SECTIONS) break;
  }
  return result;
}

/**
 * Construit une structure à partir d'un choix utilisateur (modèle prédéfini ou
 * composition libre). Rend `null` si le choix ne donne aucune structure
 * valide — l'appelant répond alors 400 plutôt que de persister n'importe quoi.
 */
export function buildStructure(
  templateId: string | undefined,
  sectionKeys?: readonly string[] | null
): BusinessPlanStructure | null {
  const template = templateId ? getTemplate(templateId) : undefined;

  // Modèle prédéfini SANS liste explicite : la structure EST celle du modèle.
  if (template && !sectionKeys) {
    return { templateId: template.id, sectionKeys: [...template.sectionKeys], updatedAt: new Date() };
  }

  const keys = sanitizeSectionKeys(sectionKeys);
  if (keys.length < MIN_SECTIONS) return null;

  // Une liste identique à celle d'un modèle reste attribuée à ce modèle : elle
  // doit continuer de s'afficher comme « structure banque », pas « custom ».
  const matching = template && sameOrder(template.sectionKeys, keys) ? template.id : undefined;

  return {
    templateId: matching ?? templateId ?? CUSTOM_TEMPLATE_ID,
    sectionKeys: keys,
    updatedAt: new Date(),
  };
}

const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, i) => key === b[i]);

/** Noms canoniques d'une structure, dans l'ordre — ordre d'affichage du PDF. */
export const structureSectionNames = (
  sections: readonly BusinessPlanSectionDefinition[]
): string[] => sections.map((s) => s.name);

/** Toutes les sections du catalogue, pour l'endpoint de découverte. */
export const catalogSections = (): BusinessPlanSectionDefinition[] =>
  BUSINESS_PLAN_SECTION_CATALOG;
