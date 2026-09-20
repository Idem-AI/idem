/**
 * Migration V1 → V2 du modèle de communication.
 *
 * La V1 ne connaissait qu'un calendrier unique (`calendar`), des contenus
 * d'occasion à part (`moments`) et des visuels (`flyers`). La V2 range tout dans
 * des PÉRIODES et une bibliothèque de visuels.
 *
 * Trois propriétés, non négociables :
 *
 *  1. **Idempotente** — `schemaVersion` marque le travail fait. Rejouée, elle ne
 *     duplique rien.
 *  2. **Non destructive** — les champs V1 restent en base. Un retour arrière
 *     n'exige aucune restauration : l'ancien code relit `calendar` intact.
 *  3. **Sans IA** — un brief de période est reconstitué depuis la stratégie déjà
 *     payée, pas régénéré. Migrer ne doit rien coûter à l'utilisateur.
 *
 * Elle répare au passage le défaut le plus coûteux de la V1 : un visuel dont le
 * contenu avait disparu (calendrier régénéré) devenait inatteignable dans
 * l'interface. Ici il est reclassé `origin: 'studio'` et réapparaît dans la
 * bibliothèque.
 */
import logger from '../../config/logger';
import { toContentChannel, toContentChannels } from './channels';
import {
  COMMUNICATION_SCHEMA_VERSION,
  CommunicationModel,
  CommunicationPlan,
  ContentChannel,
  ContentIdea,
  Flyer,
  MomentIdea,
  PlanBrief,
} from '../../models/communication.model';

/** Date ISO du jour (YYYY-MM-DD). */
const today = (): string => new Date().toISOString().slice(0, 10);

/** Ajoute `days` jours à une date ISO et renvoie une date ISO. */
export const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Nombre de jours entre deux dates ISO, bornes incluses (minimum 1). */
export const daysBetween = (start: string, end: string): number => {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
};

/** Rang de semaine (1-indexé) d'une date dans une période. */
export const weekOfPeriod = (start: string, date: string): number => {
  const offset = daysBetween(start, date) - 1;
  return Math.max(1, Math.floor(offset / 7) + 1);
};

/** Bornes d'un contenu daté : la plus petite et la plus grande date du lot. */
function itemDateRange(items: ContentIdea[]): { start: string; end: string } {
  const dates = items
    .map((item) => (item.scheduledFor || '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) {
    const start = today();
    return { start, end: addDays(start, 27) };
  }
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * Reconstitue un brief de période depuis la stratégie globale — sans appel IA.
 *
 * Le brief est volontairement pauvre : il dit d'où il vient. Mieux vaut un brief
 * honnêtement reconstitué qu'un brief inventé qui se ferait passer pour une
 * décision éditoriale.
 */
function briefFromStrategy(model: CommunicationModel): PlanBrief | undefined {
  const strategy = model.strategy;
  if (!strategy) return undefined;
  const block = (kind: string) => strategy.blocks?.find((b) => b.kind === kind)?.body || '';
  const pillars = block('pillars');
  const themes = pillars
    // Un bloc de piliers est rédigé en liste ; on récupère les lignes.
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((line) => line.length > 2)
    .slice(0, 4)
    .map((line) => {
      const [label, ...rest] = line.split(/\s*[:—–]\s*/);
      return { label: label.slice(0, 40), why: rest.join(' — ').slice(0, 140) };
    });

  return {
    angle: strategy.summary || '',
    keyMessage: block('messaging').split(/\n/)[0]?.slice(0, 140) || '',
    themes,
    successSignals: block('kpis')
      .split(/\n+/)
      .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
      .filter((line) => line.length > 2)
      .slice(0, 3),
  };
}

/** Un `MomentIdea` V1 devient un `ContentIdea` porteur d'une occasion. */
function momentToContent(moment: MomentIdea, planId: string, periodStart: string): ContentIdea {
  const scheduledFor = (moment.occasionDate || moment.scheduledFor || today()).slice(0, 10);
  return {
    ...moment,
    planId,
    scheduledFor,
    week: weekOfPeriod(periodStart, scheduledFor),
    occasion: moment.occasion,
    occasionDate: moment.occasionDate,
    caption: moment.caption,
  };
}

/**
 * Applique la migration si nécessaire. Renvoie le modèle tel quel s'il est déjà
 * à jour — le drapeau `changed` dit à l'appelant s'il vaut la peine d'écrire.
 */
export function migrateLegacyCommunication(
  input: CommunicationModel | null | undefined
): { model: CommunicationModel; changed: boolean } {
  const model: CommunicationModel = { ...(input || {}) };

  if (model.schemaVersion === COMMUNICATION_SCHEMA_VERSION) {
    return { model, changed: false };
  }

  const plans: CommunicationPlan[] = [...(model.plans || [])];
  const knownPlanIds = new Set(plans.map((p) => p.id));
  let changed = false;

  // ── 1. Le calendrier unique devient une période ──────────────────────────
  const legacyCalendar = model.calendar;
  if (legacyCalendar && !knownPlanIds.has('plan-legacy-calendar')) {
    const items = Array.isArray(legacyCalendar.items) ? legacyCalendar.items : [];
    const period = itemDateRange(items);
    const channels = Array.from(new Set(items.map((i) => i.channel).filter(Boolean)));
    const weeks = Math.max(1, Math.ceil(daysBetween(period.start, period.end) / 7));

    plans.push({
      id: 'plan-legacy-calendar',
      name: 'Plan initial',
      objective: model.strategy?.summary?.slice(0, 200) || '',
      period,
      kind: 'regular',
      postsPerWeek: Math.min(7, Math.max(1, Math.round(items.length / weeks) || 1)),
      channels: (channels.length ? channels : ['linkedin']) as ContentChannel[],
      brief: briefFromStrategy(model),
      items: items.map((item) => ({
        ...item,
        planId: 'plan-legacy-calendar',
        week: weekOfPeriod(period.start, (item.scheduledFor || period.start).slice(0, 10)),
      })),
      // Une période dont la fin est passée est terminée, pas active : elle ne
      // doit pas s'ouvrir par défaut devant l'utilisateur.
      status: period.end < today() ? 'done' : 'active',
      generatedAt: legacyCalendar.createdAt,
      createdAt: legacyCalendar.createdAt || new Date(),
      updatedAt: legacyCalendar.updatedAt || new Date(),
    });
    changed = true;
  }

  // ── 2. Les moments deviennent les contenus d'une période « Occasions » ───
  const legacyMoments = model.moments;
  if (legacyMoments?.length && !knownPlanIds.has('plan-legacy-moments')) {
    const contents = legacyMoments.map((m) =>
      momentToContent(m, 'plan-legacy-moments', itemDateRange(legacyMoments).start)
    );
    const period = itemDateRange(contents);
    plans.push({
      id: 'plan-legacy-moments',
      name: 'Occasions',
      objective: '',
      period,
      kind: 'campaign',
      postsPerWeek: 1,
      channels: Array.from(
        new Set(contents.map((c) => c.channel).filter(Boolean))
      ) as ContentChannel[],
      items: contents,
      status: period.end < today() ? 'done' : 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    changed = true;
  }

  // ── 3. Les visuels rejoignent la bibliothèque, y compris les orphelins ───
  const legacyFlyers = model.flyers;
  if (!model.visuals && legacyFlyers?.length) {
    const contentToPlan = new Map<string, string>();
    for (const plan of plans) {
      for (const item of plan.items) contentToPlan.set(item.id, plan.id);
    }

    model.visuals = legacyFlyers.map<Flyer>((flyer) => {
      const planId = flyer.contentId ? contentToPlan.get(flyer.contentId) : undefined;
      return {
        ...flyer,
        planId,
        // Un visuel dont le contenu a disparu (calendrier régénéré en V1) était
        // devenu invisible dans l'interface : ni dans le calendrier, ni dans
        // « prêt à publier ». Reclassé `studio`, il réapparaît dans la
        // bibliothèque — c'est le point le plus utile de cette migration.
        origin: !planId ? 'studio' : planId === 'plan-legacy-moments' ? 'occasion' : 'plan',
      };
    });
    changed = true;
  }

  // ── 4. Suggestions d'occasions ───────────────────────────────────────────
  if (!model.occasionSuggestions && model.momentSuggestions?.length) {
    model.occasionSuggestions = model.momentSuggestions;
    changed = true;
  }

  // ── 5. Canaux : ramenés vers l'énumération (schéma 3) ────────────────────
  // Les valeurs venaient d'un modèle interrogé en texte libre. Un « Instagram »
  // stocké affichait la clé de traduction brute à l'écran et la même icône pour
  // tous les réseaux ; les nettoyer ici corrige la donnée elle-même.
  for (const plan of plans) {
    const channels = toContentChannels(plan.channels);
    const fixed = channels.length ? channels : (['linkedin'] as ContentChannel[]);
    if (JSON.stringify(fixed) !== JSON.stringify(plan.channels)) {
      plan.channels = fixed;
      changed = true;
    }
    for (const item of plan.items) {
      const channel = toContentChannel(item.channel) || fixed[0];
      if (channel !== item.channel) {
        item.channel = channel;
        changed = true;
      }
    }
  }

  if (plans.length) model.plans = plans;
  if (!model.visuals && !legacyFlyers?.length) model.visuals = model.visuals || [];

  model.schemaVersion = COMMUNICATION_SCHEMA_VERSION;

  if (changed) {
    logger.info('[Communication] Legacy model migrated to V2', {
      plans: model.plans?.length || 0,
      visuals: model.visuals?.length || 0,
    });
  }

  // `changed` ne compte que les reclassements : poser la seule version du schéma
  // sur un projet vide ne justifie pas une écriture en base.
  return { model, changed };
}
