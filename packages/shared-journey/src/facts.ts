/**
 * Ce que le projet a déjà, lu de deux sources qui se complètent :
 *
 *   le PROJET    la fiche IDEM (charte, business plan, communication…) — ce qui vit dans le document ;
 *   les GESTES   les événements de la boucle — ce qui vit ailleurs (code du site dans iCode, mise en ligne
 *                dans iDeploy, domaine dans iDomain), qu'une lecture du projet ne voit pas.
 *
 * Lu défensivement : les projets anciens n'ont pas tous la même forme.
 */
import { JourneyEvent, NO_FACTS, ProjectFacts } from './model';

/** La forme lue, toute facultative : un projet ancien peut n'en avoir qu'une partie, ou rien. */
interface Section {
  data?: unknown;
  summary?: unknown;
}
interface DocumentLike {
  sections?: Section[];
}
interface LooseProject {
  analysisResultModel?: {
    branding?: {
      logo?: { svg?: unknown; id?: unknown };
      colors?: { colors?: { primary?: unknown } };
      typography?: { primaryFont?: unknown };
      sections?: Section[];
    };
    communication?: { strategy?: unknown; plans?: unknown[]; visuals?: unknown[]; publications?: unknown[]; videos?: unknown[] };
    businessPlan?: DocumentLike;
    businessPlans?: DocumentLike[];
    pitchDeck?: DocumentLike;
    pitchDecks?: DocumentLike[];
    legalDocs?: { documents?: Section[] };
  };
}

const list = <T>(value: T[] | undefined | unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const filledSection = (section: Section | null | undefined) => !!section && (!!section.data || !!section.summary);

/** Un livrable « généré » : au moins une section avec du contenu, dans l'ancien champ ou la liste. */
function hasDocument(single: DocumentLike | undefined, many: DocumentLike[] | undefined): boolean {
  const filled = (doc: DocumentLike | null | undefined) => !!doc && list<Section>(doc.sections).some(filledSection);
  return filled(single) || list<DocumentLike>(many).some(filled);
}

/** Les faits que la fiche du projet porte elle-même. */
export function factsFromProject(project: unknown): ProjectFacts {
  const analysis = project && typeof project === 'object' ? ((project as LooseProject).analysisResultModel ?? {}) : {};
  const branding = analysis.branding ?? {};
  const communication = analysis.communication ?? {};
  return {
    ...NO_FACTS,
    brand: !!(branding.logo?.svg || branding.logo?.id) && !!branding.colors?.colors?.primary && !!branding.typography?.primaryFont,
    charter: list<Section>(branding.sections).some((section) => !!section?.data),
    communication: !!communication.strategy || list(communication.plans).length > 0 || list(communication.visuals).length > 0 || list(communication.publications).length > 0,
    video: list(communication.videos).length > 0,
    businessPlan: hasDocument(analysis.businessPlan, analysis.businessPlans),
    pitchDeck: hasDocument(analysis.pitchDeck, analysis.pitchDecks),
    legal: list<Section>(analysis.legalDocs?.documents).some((doc) => !!doc?.data),
  };
}

/** Les faits que seuls les gestes révèlent. */
export function factsFromEvents(events: readonly JourneyEvent[], projectId?: string): Partial<ProjectFacts> {
  const facts: Partial<ProjectFacts> = {};
  for (const event of events) {
    if (projectId && event.projectId && event.projectId !== projectId) continue;
    switch (event.type) {
      case 'site.generated':
      case 'site.redesigned':
        facts.site = true;
        break;
      case 'site.published':
        facts.site = true;
        facts.sitePublished = true;
        break;
      case 'app.generated':
        facts.app = true;
        break;
      case 'app.published':
        facts.app = true;
        facts.appPublished = true;
        break;
      case 'domain.connected':
        facts.domain = true;
        break;
      case 'charter.generated':
        facts.charter = true;
        facts.brand = true;
        break;
      case 'brand.imported':
        facts.brand = true;
        break;
      case 'communication.started':
      case 'visual.created':
        facts.communication = true;
        break;
      case 'video.created':
        facts.video = true;
        facts.communication = true;
        break;
      case 'business_plan.generated':
        facts.businessPlan = true;
        break;
      case 'pitch_deck.generated':
        facts.pitchDeck = true;
        break;
      case 'legal.generated':
        facts.legal = true;
        break;
      default:
        break;
    }
  }
  return facts;
}

/** Un fait est acquis dès qu'une des sources l'affirme. */
export function mergeFacts(...sources: Partial<ProjectFacts>[]): ProjectFacts {
  const merged: ProjectFacts = { ...NO_FACTS };
  for (const source of sources) {
    for (const key of Object.keys(merged) as (keyof ProjectFacts)[]) {
      if (source[key]) merged[key] = true;
    }
  }
  return merged;
}
