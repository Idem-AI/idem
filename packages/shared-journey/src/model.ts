/**
 * Le vocabulaire de la boucle IDEM : ce que l'utilisateur FAIT dans une application (événements), ce que son
 * projet A DÉJÀ (faits), et où on peut l'emmener ensuite (destinations).
 *
 * Tout ici est sans framework et sans réseau : l'API IDEM s'en sert pour calculer, chaque application pour
 * afficher. Une seule définition, pour que le dashboard, iCode, iVision et iDeploy recommandent la même chose
 * au même moment.
 */

/** Les applications d'IDEM, là où une recommandation peut s'afficher et d'où un événement peut venir. */
export type IdemApp = 'dashboard' | 'icode' | 'ivision' | 'ideploy' | 'simulation';

/** Ce que l'utilisateur vient de faire. Un événement est daté et rattaché à un projet. */
export type JourneyEventType =
  | 'project.created'
  /** Un site existant lu et transformé en projet (iVision, iCode). */
  | 'brand.imported'
  | 'charter.generated'
  | 'site.generated'
  /** Un site existant refait par iCode. */
  | 'site.redesigned'
  | 'site.published'
  | 'app.generated'
  | 'app.published'
  | 'domain.connected'
  | 'visual.created'
  | 'video.created'
  | 'communication.started'
  | 'business_plan.generated'
  | 'pitch_deck.generated'
  | 'legal.generated'
  | 'simulation.completed';

export const JOURNEY_EVENT_TYPES: readonly JourneyEventType[] = [
  'project.created',
  'brand.imported',
  'charter.generated',
  'site.generated',
  'site.redesigned',
  'site.published',
  'app.generated',
  'app.published',
  'domain.connected',
  'visual.created',
  'video.created',
  'communication.started',
  'business_plan.generated',
  'pitch_deck.generated',
  'legal.generated',
  'simulation.completed',
];

export const IDEM_APPS: readonly IdemApp[] = ['dashboard', 'icode', 'ivision', 'ideploy', 'simulation'];

export interface JourneyEvent {
  type: JourneyEventType;
  /** L'application où c'est arrivé. */
  app: IdemApp;
  projectId?: string;
  /** ISO 8601. */
  at: string;
}

/** Où une recommandation emmène. Chaque destination a UNE page d'arrivée (voir `links.ts`). */
export type JourneyDestination =
  | 'communication'
  | 'video'
  | 'charter'
  | 'site'
  | 'app'
  | 'publish-site'
  | 'publish-app'
  | 'domain'
  | 'business-plan'
  | 'pitch-deck'
  | 'legal';

/**
 * Ce que le projet a déjà. Une destination atteinte n'est JAMAIS recommandée : proposer « Créez votre charte »
 * à quelqu'un qui l'a est la façon la plus sûre de faire ignorer toutes les recommandations suivantes.
 */
export interface ProjectFacts {
  /** Logo, couleurs et typographie choisis. */
  brand: boolean;
  /** Le document de la charte généré. */
  charter: boolean;
  site: boolean;
  sitePublished: boolean;
  app: boolean;
  appPublished: boolean;
  domain: boolean;
  /** Une stratégie, un calendrier, un visuel ou une publication. */
  communication: boolean;
  video: boolean;
  businessPlan: boolean;
  pitchDeck: boolean;
  legal: boolean;
}

export const NO_FACTS: ProjectFacts = {
  brand: false,
  charter: false,
  site: false,
  sitePublished: false,
  app: false,
  appPublished: false,
  domain: false,
  communication: false,
  video: false,
  businessPlan: false,
  pitchDeck: false,
  legal: false,
};

/** L'endroit où l'on affiche : l'application, et la page quand elle est elle-même une destination. */
export interface JourneySurface {
  app: IdemApp;
  /** La destination que la page affichée EST déjà (la page Communication ne recommande pas la communication). */
  place?: JourneyDestination;
}

/** Ce que l'utilisateur a fait des recommandations passées, par identifiant de règle. */
export interface JourneyMemory {
  shown: Record<string, { at: string; count: number }>;
  clicked: Record<string, { at: string; count: number }>;
  dismissed: Record<string, { at: string; count: number }>;
}

export const EMPTY_MEMORY: JourneyMemory = { shown: {}, clicked: {}, dismissed: {} };

export type JourneyFeedback = 'shown' | 'clicked' | 'dismissed';

/** Une recommandation calculée. Les textes et l'adresse sont posés par l'application qui l'affiche. */
export interface Recommendation {
  /** Identifiant stable de la règle (sert aux textes, à la mémoire et au suivi). */
  id: string;
  destination: JourneyDestination;
  projectId?: string;
  /** L'événement qui la rend opportune, s'il y en a un (sinon : prochaine étape logique du projet). */
  because?: JourneyEventType;
  score: number;
}
