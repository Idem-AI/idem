/**
 * LES RÈGLES DE LA BOUCLE — quoi proposer, quand, et quand se taire.
 *
 * Une règle relie des ÉVÉNEMENTS (ce que l'utilisateur vient de faire) à une DESTINATION (où l'emmener
 * ensuite). Elle ne s'applique que si la destination n'est pas déjà atteinte, que ses prérequis le sont, et
 * que l'utilisateur ne l'a pas écartée récemment. Le moment compte plus que le poids : une recommandation née
 * d'un geste d'il y a une minute passe devant une « prochaine étape » générique.
 *
 * Tout est calculé par le code, sans modèle : la même entrée donne toujours la même réponse.
 */
import type { JourneyDestination, JourneyEvent, JourneyEventType, JourneyMemory, JourneySurface, ProjectFacts, Recommendation } from './model';

export interface JourneyRule {
  id: string;
  destination: JourneyDestination;
  /** Les gestes qui la rendent opportune. */
  after: readonly JourneyEventType[];
  /** Ce que le projet doit déjà avoir. */
  needs?: (facts: ProjectFacts) => boolean;
  /** La destination est atteinte : on ne la propose plus jamais. */
  done: (facts: ProjectFacts) => boolean;
  /** Importance de la règle quand plusieurs sont opportunes en même temps. */
  weight: number;
  /** Proposable sans geste récent, comme « prochaine étape » du projet (accueil d'un projet). */
  ambient?: boolean;
}

export const JOURNEY_RULES: readonly JourneyRule[] = [
  {
    // Le cas demandé en premier : un site neuf ou refait sans personne pour le voir.
    id: 'site-to-communication',
    destination: 'communication',
    after: ['site.generated', 'site.redesigned', 'site.published', 'domain.connected'],
    needs: (f) => f.site,
    done: (f) => f.communication,
    weight: 100,
    ambient: true,
  },
  {
    id: 'app-to-communication',
    destination: 'communication',
    after: ['app.published'],
    needs: (f) => f.app,
    done: (f) => f.communication,
    weight: 80,
  },
  {
    id: 'site-to-publish',
    destination: 'publish-site',
    after: ['site.generated', 'site.redesigned'],
    needs: (f) => f.site,
    done: (f) => f.sitePublished,
    weight: 90,
    ambient: true,
  },
  {
    id: 'app-to-publish',
    destination: 'publish-app',
    after: ['app.generated'],
    needs: (f) => f.app,
    done: (f) => f.appPublished,
    weight: 85,
  },
  {
    id: 'published-to-domain',
    destination: 'domain',
    after: ['site.published', 'app.published'],
    needs: (f) => f.sitePublished || f.appPublished,
    done: (f) => f.domain,
    weight: 75,
  },
  {
    // Un site en ligne doit afficher ses mentions légales (et souvent des conditions de vente).
    id: 'published-to-legal',
    destination: 'legal',
    after: ['site.published', 'app.published'],
    needs: (f) => f.sitePublished || f.appPublished,
    done: (f) => f.legal,
    weight: 50,
  },
  {
    // La marque lue sur un site, ou des visuels faits sans charte : la charte complète leur donne une règle.
    id: 'brand-to-charter',
    destination: 'charter',
    after: ['brand.imported', 'site.redesigned', 'visual.created', 'video.created'],
    needs: (f) => f.brand,
    done: (f) => f.charter,
    weight: 60,
  },
  {
    id: 'charter-to-site',
    destination: 'site',
    after: ['charter.generated', 'brand.imported', 'business_plan.generated', 'visual.created', 'video.created'],
    done: (f) => f.site,
    weight: 70,
    ambient: true,
  },
  {
    id: 'communication-to-video',
    destination: 'video',
    after: ['communication.started', 'visual.created', 'site.published'],
    needs: (f) => f.brand,
    done: (f) => f.video,
    weight: 45,
  },
  {
    id: 'simulation-to-business-plan',
    destination: 'business-plan',
    after: ['simulation.completed', 'site.published', 'charter.generated'],
    done: (f) => f.businessPlan,
    weight: 55,
  },
  {
    id: 'business-plan-to-pitch-deck',
    destination: 'pitch-deck',
    after: ['business_plan.generated'],
    needs: (f) => f.businessPlan,
    done: (f) => f.pitchDeck,
    weight: 65,
  },
  {
    id: 'site-to-app',
    destination: 'app',
    after: ['site.published'],
    needs: (f) => f.sitePublished,
    done: (f) => f.app,
    weight: 20,
  },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Un geste plus vieux ne rend plus rien « opportun » : c'est alors l'affaire des recommandations d'accueil. */
export const TRIGGER_WINDOW_MS = 7 * DAY;
/** Écartée : silence pendant 14 jours, doublé à chaque nouveau refus, jamais plus de 90 jours. */
const DISMISS_BASE_MS = 14 * DAY;
const DISMISS_MAX_MS = 90 * DAY;
/** Suivie : l'utilisateur y est allé ; s'il n'a rien fait, on peut le lui rappeler un mois plus tard. */
const CLICK_QUIET_MS = 30 * DAY;
/** Montrée souvent sans réaction : une semaine de silence. */
const SHOWN_LIMIT = 6;
const SHOWN_QUIET_MS = 7 * DAY;

const time = (iso: string | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** La recommandation est-elle au repos (écartée, suivie ou trop montrée) ? */
export function isQuiet(id: string, memory: JourneyMemory, now: number): boolean {
  const dismissed = memory.dismissed[id];
  if (dismissed) {
    const quiet = Math.min(DISMISS_MAX_MS, DISMISS_BASE_MS * 2 ** Math.max(0, dismissed.count - 1));
    if (now - time(dismissed.at) < quiet) return true;
  }
  const clicked = memory.clicked[id];
  if (clicked && now - time(clicked.at) < CLICK_QUIET_MS) return true;
  const shown = memory.shown[id];
  // Les affichages comptés depuis le dernier clic seulement : un clic remet le compteur à zéro (voir `remember`).
  if (shown && shown.count >= SHOWN_LIMIT && now - time(shown.at) < SHOWN_QUIET_MS) return true;
  return false;
}

export interface RecommendInput {
  facts: ProjectFacts;
  /** Les événements récents du projet, dans n'importe quel ordre. */
  events: readonly JourneyEvent[];
  memory: JourneyMemory;
  surface: JourneySurface;
  /** Le geste qui vient d'avoir lieu : ses recommandations passent devant tout. */
  trigger?: JourneyEventType;
  projectId?: string;
  /** Combien en rendre (1 par défaut : une seule proposition à la fois). */
  limit?: number;
  /** Les recommandations d'accueil (sans geste récent) sont-elles permises ici ? */
  ambient?: boolean;
  now?: number;
}

/**
 * Les recommandations du moment, de la plus opportune à la moins. Une seule destination par réponse (deux
 * règles qui mènent au même endroit n'en font qu'une).
 */
export function recommend(input: RecommendInput): Recommendation[] {
  const now = input.now ?? Date.now();
  const recent = input.events.filter((event) => now - time(event.at) <= TRIGGER_WINDOW_MS && (!input.projectId || !event.projectId || event.projectId === input.projectId));
  const scored: Recommendation[] = [];

  for (const rule of JOURNEY_RULES) {
    if (rule.done(input.facts)) continue;
    if (rule.needs && !rule.needs(input.facts)) continue;
    // La page Communication ne recommande pas la communication, l'atelier du site ne recommande pas le site.
    if (input.surface.place === rule.destination) continue;
    if (isQuiet(rule.id, input.memory, now)) continue;

    let score = 0;
    let because: JourneyEventType | undefined;
    if (input.trigger && rule.after.includes(input.trigger)) {
      score = rule.weight + 200;
      because = input.trigger;
    } else {
      const latest = recent
        .filter((event) => rule.after.includes(event.type))
        .sort((a, b) => time(b.at) - time(a.at))[0];
      if (latest) {
        const age = now - time(latest.at);
        score = rule.weight + (age < DAY ? 60 : age < 3 * DAY ? 25 : 5);
        because = latest.type;
      } else if (rule.ambient && input.ambient) {
        score = rule.weight / 4;
      }
    }
    if (score <= 0) continue;
    scored.push({ id: rule.id, destination: rule.destination, score, ...(because ? { because } : {}), ...(input.projectId ? { projectId: input.projectId } : {}) });
  }

  const seen = new Set<JourneyDestination>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((rec) => (seen.has(rec.destination) ? false : (seen.add(rec.destination), true)))
    .slice(0, Math.max(1, input.limit ?? 1));
}

/** La mémoire après un retour de l'utilisateur (pur : rend une nouvelle mémoire). */
export function remember(memory: JourneyMemory, id: string, action: 'shown' | 'clicked' | 'dismissed', now = Date.now()): JourneyMemory {
  const at = new Date(now).toISOString();
  const next: JourneyMemory = { shown: { ...memory.shown }, clicked: { ...memory.clicked }, dismissed: { ...memory.dismissed } };
  const bump = (bucket: Record<string, { at: string; count: number }>) => {
    bucket[id] = { at, count: (bucket[id]?.count ?? 0) + 1 };
  };
  if (action === 'shown') {
    // Deux affichages dans la même heure (rechargement, deux onglets) n'en font qu'un.
    const last = next.shown[id];
    if (last && now - time(last.at) < HOUR) return memory;
    bump(next.shown);
  } else if (action === 'clicked') {
    bump(next.clicked);
    delete next.shown[id];
  } else {
    bump(next.dismissed);
  }
  return next;
}
