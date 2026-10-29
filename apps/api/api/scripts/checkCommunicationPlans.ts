/**
 * Contrôle des PÉRIODES de communication — `npm run check:comm`.
 *
 * Deux propriétés sont vérifiées ici, et elles sont l'essentiel de la V2 :
 *
 *  1. **La migration ne perd rien.** Un projet V1 (calendrier unique, moments à
 *     part, visuels dont le contenu a disparu) doit se retrouver entièrement dans
 *     le modèle V2 — visuels orphelins compris, qui étaient devenus inatteignables
 *     dans l'interface. Et rejouer la migration ne doit rien dupliquer.
 *
 *  2. **L'arithmétique des dates est juste.** Une période porte des bornes
 *     réelles ; un contenu daté hors de ces bornes est inutilisable. Ces règles
 *     sont tenues par du code et non par un prompt — elles sont donc testables
 *     sans appeler un seul modèle.
 *
 * Aucun réseau, aucune base, aucune clé d'API : il tourne partout, en une
 * seconde, et peut donc être exécuté en intégration continue.
 *
 *   npx ts-node --transpile-only api/scripts/checkCommunicationPlans.ts
 */

import {
  CommunicationModel,
  COMMUNICATION_SCHEMA_VERSION,
  ContentIdea,
} from '../models/communication.model';
import {
  addDays,
  daysBetween,
  migrateLegacyCommunication,
  weekOfPeriod,
} from '../services/Communication/communication.migration';
import { toContentChannel, toContentChannels } from '../services/Communication/channels';
import { ensureVideoShare, normaliseVideoPlan, videoRequestOf } from '../services/Communication/video/video.calendar';
import { parseRequest } from '../../../ivision/core/src/video/request/request';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Helpers de dates
// ───────────────────────────────────────────────────────────────────────────

console.log('\nArithmétique des dates');

check('addDays traverse une fin de mois', addDays('2026-01-30', 3) === '2026-02-02');
check('addDays traverse une fin d’année', addDays('2026-12-30', 3) === '2027-01-02');
check(
  'addDays gère une année bissextile',
  addDays('2028-02-28', 1) === '2028-02-29',
  addDays('2028-02-28', 1),
);
check('daysBetween compte les deux bornes', daysBetween('2026-11-01', ' 2026-11-30'.trim()) === 30);
check('daysBetween sur un seul jour vaut 1', daysBetween('2026-11-01', '2026-11-01') === 1);
check(
  'weekOfPeriod : le premier jour est en semaine 1',
  weekOfPeriod('2026-11-01', '2026-11-01') === 1,
);
check(
  'weekOfPeriod : le 7e jour est encore en semaine 1',
  weekOfPeriod('2026-11-01', '2026-11-07') === 1,
);
check(
  'weekOfPeriod : le 8e jour passe en semaine 2',
  weekOfPeriod('2026-11-01', '2026-11-08') === 2,
);
check(
  'weekOfPeriod : un mois de 30 jours tient en 5 semaines',
  weekOfPeriod('2026-11-01', '2026-11-30') === 5,
  String(weekOfPeriod('2026-11-01', '2026-11-30')),
);

// ───────────────────────────────────────────────────────────────────────────
// 1bis. Canaux de publication
//
// `ContentChannel` est une énumération en minuscules, mais la valeur venait d'un
// modèle à qui on demandait « primary channels » en texte libre. Un « Instagram »
// qui passait affichait la CLÉ de traduction brute à l'écran et la même icône
// pour tous les réseaux. Ces contrôles ferment la porte.
// ───────────────────────────────────────────────────────────────────────────

console.log('\nCanaux de publication');

check('un nom affiché est ramené en minuscules', toContentChannel('Instagram') === 'instagram');
check('la casse mixte est acceptée', toContentChannel('LinkedIn') === 'linkedin');
check('les séparateurs sont ignorés', toContentChannel('linked-in') === 'linkedin');
check('les accents sont ignorés', toContentChannel('Réseaux sociaux') === 'other');
check('Twitter devient x', toContentChannel('Twitter') === 'x');
check('une newsletter devient email', toContentChannel('Newsletter') === 'email');
check('un site web devient blog', toContentChannel('Site web') === 'blog');
check(
  'une valeur composée retient le premier réseau reconnu',
  toContentChannel('Instagram & Facebook') === 'instagram',
);
check('une valeur vide ne donne rien', toContentChannel('') === null);
check('une valeur inconnue ne donne rien', toContentChannel('carrier pigeon') === null);
check('un non-texte ne casse pas', toContentChannel(42) === null && toContentChannel(null) === null);

const listed = toContentChannels(['Instagram', 'instagram', 'LinkedIn', 'Social media', 'zzz']);
check(
  'une liste est normalisée et dédoublonnée',
  JSON.stringify(listed) === JSON.stringify(['instagram', 'linkedin', 'other']),
  JSON.stringify(listed),
);
check('une liste absente donne un tableau vide', toContentChannels(undefined).length === 0);

// ───────────────────────────────────────────────────────────────────────────
// 2. Migration V1 → V2
// ───────────────────────────────────────────────────────────────────────────

/**
 * Un projet V1 représentatif du pire cas :
 *  - un calendrier de 3 contenus,
 *  - un moment daté hors du calendrier,
 *  - trois visuels : un rattaché au calendrier, un au moment, et un ORPHELIN
 *    (son contenu a disparu lors d'une régénération — c'est le bug que la
 *    migration doit réparer).
 */
function legacyProject(): CommunicationModel {
  return {
    strategy: {
      summary: 'Marque de café de spécialité à Douala.',
      blocks: [
        { id: 'b1', kind: 'positioning', title: 'Positionnement', body: 'Le café de quartier.' },
        {
          id: 'b2',
          kind: 'pillars',
          title: 'Piliers',
          body: '- Origine : d’où vient le grain\n- Gestes : le métier de barista\n- Lieu : la salle',
        },
        { id: 'b3', kind: 'messaging', title: 'Messages', body: 'Un café qu’on sait nommer.' },
        { id: 'b4', kind: 'kpis', title: 'Indicateurs', body: '- 30 sacs vendus\n- 20 réponses en DM' },
      ],
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-01'),
    },
    calendar: {
      rhythm: 'weekly',
      horizonWeeks: 4,
      items: [
        {
          id: 'c1',
          title: 'L’origine du grain',
          hook: '',
          description: '',
          format: 'post',
          // Valeur telle que le modèle la produisait : c'est elle qui affichait
          // la clé de traduction brute dans l'interface.
          channel: 'Instagram' as ContentIdea['channel'],
          scheduledFor: '2026-09-01',
          week: 1,
          hashtags: [],
          callToAction: '',
          status: 'idea',
          flyerIds: ['flyer-c1'],
        },
        {
          id: 'c2',
          title: 'Le geste du barista',
          hook: '',
          description: '',
          format: 'reel',
          channel: 'instagram',
          scheduledFor: '2026-09-08',
          week: 2,
          hashtags: [],
          callToAction: '',
          status: 'idea',
        },
        {
          id: 'c3',
          title: 'La salle du matin',
          hook: '',
          description: '',
          format: 'post',
          channel: 'facebook',
          scheduledFor: '2026-09-15',
          week: 3,
          hashtags: [],
          callToAction: '',
          status: 'idea',
        },
      ],
      createdAt: new Date('2026-08-20'),
      updatedAt: new Date('2026-08-20'),
    },
    moments: [
      {
        id: 'm1',
        title: 'Bonne fête nationale',
        hook: '',
        description: '',
        format: 'post',
        channel: 'facebook',
        scheduledFor: '2026-05-20',
        week: 0,
        hashtags: [],
        callToAction: '',
        status: 'idea',
        occasion: 'Fête nationale',
        occasionDate: '2026-05-20',
        source: 'suggestion',
        caption: 'Bonne fête à tous.',
        flyerIds: ['flyer-m1'],
      },
    ],
    flyers: [
      {
        id: 'flyer-c1',
        contentId: 'c1',
        format: 'square',
        concept: '',
        layoutNotes: '',
        marketingText: { headline: 'L’origine', body: '' },
        html: '<div>c1</div>',
        createdAt: new Date('2026-08-21'),
        updatedAt: new Date('2026-08-21'),
      },
      {
        id: 'flyer-m1',
        contentId: 'm1',
        format: 'story',
        concept: '',
        layoutNotes: '',
        marketingText: { headline: 'Fête', body: '' },
        html: '<div>m1</div>',
        createdAt: new Date('2026-05-18'),
        updatedAt: new Date('2026-05-18'),
      },
      {
        // Orphelin : son contenu a disparu d'une régénération de calendrier.
        id: 'flyer-lost',
        contentId: 'c-disparu',
        format: 'square',
        concept: '',
        layoutNotes: '',
        marketingText: { headline: 'Perdu', body: '' },
        html: '<div>lost</div>',
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date('2026-07-01'),
      },
    ],
  };
}

console.log('\nMigration V1 → V2');

const first = migrateLegacyCommunication(legacyProject());

check('la migration signale un changement', first.changed);
check('le schéma est marqué', first.model.schemaVersion === COMMUNICATION_SCHEMA_VERSION);
check('deux périodes sont créées', (first.model.plans?.length ?? 0) === 2, String(first.model.plans?.length));

const calendarPlan = first.model.plans?.find((plan) => plan.id === 'plan-legacy-calendar');
check('le calendrier devient une période', !!calendarPlan);
check(
  'la période reprend les 3 contenus',
  (calendarPlan?.items.length ?? 0) === 3,
  String(calendarPlan?.items.length),
);
check(
  'ses bornes viennent des dates réelles des contenus',
  calendarPlan?.period.start === '2026-09-01' && calendarPlan?.period.end === '2026-09-15',
  `${calendarPlan?.period.start} → ${calendarPlan?.period.end}`,
);
check(
  'chaque contenu connaît sa période',
  (calendarPlan?.items ?? []).every((item) => item.planId === 'plan-legacy-calendar'),
);
check(
  'les rangs de semaine sont recalculés sur la borne de départ',
  calendarPlan?.items.find((item) => item.id === 'c3')?.week === 3,
  String(calendarPlan?.items.find((item) => item.id === 'c3')?.week),
);
check(
  'un brief est reconstitué depuis la stratégie, sans IA',
  !!calendarPlan?.brief && calendarPlan.brief.themes.length === 3,
  `themes=${calendarPlan?.brief?.themes.length}`,
);
check(
  'une période dont la fin est passée est « terminée »',
  calendarPlan?.status === 'done',
  calendarPlan?.status,
);

const momentsPlan = first.model.plans?.find((plan) => plan.id === 'plan-legacy-moments');
check('les moments deviennent une période', !!momentsPlan);
check(
  'le moment garde son occasion et sa légende',
  momentsPlan?.items[0]?.occasion === 'Fête nationale' &&
    momentsPlan?.items[0]?.caption === 'Bonne fête à tous.',
);
check(
  'le moment est daté sur son occasion',
  momentsPlan?.items[0]?.scheduledFor === '2026-05-20',
  momentsPlan?.items[0]?.scheduledFor,
);

check(
  'les 3 visuels rejoignent la bibliothèque',
  (first.model.visuals?.length ?? 0) === 3,
  String(first.model.visuals?.length),
);
const byId = new Map((first.model.visuals ?? []).map((visual) => [visual.id, visual]));
check(
  'un visuel de calendrier est classé « période »',
  byId.get('flyer-c1')?.origin === 'plan' && byId.get('flyer-c1')?.planId === 'plan-legacy-calendar',
);
check(
  'un visuel de moment est classé « occasion »',
  byId.get('flyer-m1')?.origin === 'occasion',
  byId.get('flyer-m1')?.origin,
);
check(
  'LE VISUEL ORPHELIN redevient atteignable',
  byId.get('flyer-lost')?.origin === 'studio' && !byId.get('flyer-lost')?.planId,
  byId.get('flyer-lost')?.origin,
);

check(
  'les champs V1 restent en base (retour arrière possible)',
  !!first.model.calendar && !!first.model.moments && !!first.model.flyers,
);
check(
  'un canal en texte libre est CORRIGÉ dans la donnée, pas seulement à l’écran',
  calendarPlan?.items.find((item) => item.id === 'c1')?.channel === 'instagram',
  calendarPlan?.items.find((item) => item.id === 'c1')?.channel,
);
check(
  'les canaux de la période sont tous valides',
  (calendarPlan?.channels ?? []).every((channel) =>
    ['instagram', 'linkedin', 'facebook', 'tiktok', 'x', 'youtube', 'blog', 'email', 'other'].includes(
      channel,
    ),
  ),
  JSON.stringify(calendarPlan?.channels),
);

// ── Idempotence ───────────────────────────────────────────────────────────
const second = migrateLegacyCommunication(first.model);
check('rejouée, la migration ne signale aucun changement', !second.changed);
check(
  'rejouée, elle ne duplique aucune période',
  (second.model.plans?.length ?? 0) === 2,
  String(second.model.plans?.length),
);
check(
  'rejouée, elle ne duplique aucun visuel',
  (second.model.visuals?.length ?? 0) === 3,
  String(second.model.visuals?.length),
);

// ── Cas dégradés ──────────────────────────────────────────────────────────
console.log('\nCas dégradés');

const empty = migrateLegacyCommunication({});
check('un projet vide ne déclenche pas d’écriture', !empty.changed);
check('un projet vide reçoit tout de même sa version de schéma', empty.model.schemaVersion === COMMUNICATION_SCHEMA_VERSION);

const nothing = migrateLegacyCommunication(null);
check('un modèle absent ne casse pas la migration', !!nothing.model && !nothing.changed);

const noDates = migrateLegacyCommunication({
  calendar: {
    rhythm: 'weekly',
    horizonWeeks: 4,
    items: [
      {
        id: 'x1',
        title: 'Sans date',
        hook: '',
        description: '',
        format: 'post',
        channel: 'linkedin',
        scheduledFor: '',
        week: 1,
        hashtags: [],
        callToAction: '',
        status: 'idea',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});
const fallbackPlan = noDates.model.plans?.[0];
check(
  'un calendrier sans dates exploitables reçoit une fenêtre de repli',
  !!fallbackPlan && /^\d{4}-\d{2}-\d{2}$/.test(fallbackPlan.period.start),
  fallbackPlan?.period.start,
);
check(
  'la fenêtre de repli couvre 28 jours',
  !!fallbackPlan && daysBetween(fallbackPlan.period.start, fallbackPlan.period.end) === 28,
  fallbackPlan ? String(daysBetween(fallbackPlan.period.start, fallbackPlan.period.end)) : '',
);

// ───────────────────────────────────────────────────────────────────────────
// 3. Le PLAN des vidéos du calendrier : de quoi produire un film, transmis tel quel à la génération.

console.log('\nPlan des vidéos du calendrier');
{
  const plan = normaliseVideoPlan({
    voiceover: true,
    voiceTone: 'chaleureux et posé 🎉',
    voicePersona: 'energetic',
    music: 'afro',
    pacing: 'chaque plan prolonge le précédent',
    show: ['le torréfacteur à l’aube', 'un livreur à moto'],
    beats: [
      { name: 'Accroche', see: 'des grains qui craquent', text: '« Torréfié ce matin »', voice: 'Il est six heures.' },
      { name: 'Le trajet', see: 'un livreur traverse Dakar', text: 'Livré chez vous', voice: 'Il arrive chez vous.' },
      { name: 'vide', see: '' },
    ],
    ending: 'le logo et l’appel à commander',
  });
  check('le plan est lu', !!plan && plan.beats.length === 2, JSON.stringify(plan));
  check('le personnage « energetic » n’est jamais retenu', !!plan && plan.voicePersona === undefined);
  check('émojis et guillemets retirés', !!plan && !/[🎉«»]/u.test(JSON.stringify(plan)));
  check('musique gardée', plan?.music === 'afro');
  const silent = normaliseVideoPlan({ voiceover: false, voiceTone: 'x', beats: [{ name: 'a', see: 'b', voice: 'c' }] });
  check('sans voix off : ni ton ni répliques', !!silent && !silent.voiceover && !silent.voiceTone && silent.beats.every((b) => !b.voice));
  check('un plan vide n’est pas gardé', normaliseVideoPlan({ beats: [], show: [] }) === undefined);

  const item = { title: 'Le lancement de Kora Café', hook: 'Votre café torréfié ce matin', description: 'On annonce l’ouverture.', callToAction: 'Commandez', videoPlan: plan };
  const request = videoRequestOf(item, 'fr');
  check('la demande vidéo porte le déroulé', (request.match(/^- /gm) || []).length === 2 && /livreur traverse Dakar/.test(request), request);
  check('la demande dit le ton unique de la narration', /Ton de la narration : .*chaleureux et posé/.test(request));
  check('la demande vidéo reste un BRIEF (jamais un scénario imposé)', parseRequest(request).mode === 'brief' && parseRequest(request).texts.length === 0, JSON.stringify(parseRequest(request).texts));
  check('sans plan : l’angle du contenu', videoRequestOf({ ...item, videoPlan: undefined }).startsWith('Votre café torréfié ce matin'));

  const ideas = [
    { id: 'a', title: 'A', hook: 'h', description: 'd', format: 'reel', channel: 'instagram', scheduledFor: '2026-11-02', week: 1, hashtags: [], callToAction: '', status: 'idea', videoPlan: { voiceover: true, beats: [{ name: 'x', see: 'y' }], show: [] } },
    { id: 'b', title: 'B', hook: 'h', description: 'd', format: 'post', channel: 'linkedin', scheduledFor: '2026-11-03', week: 1, hashtags: [], callToAction: '', status: 'idea', videoPlan: { voiceover: true, beats: [{ name: 'x', see: 'y' }], show: [] } },
  ] as unknown as ContentIdea[];
  const shared = ensureVideoShare(ideas, false);
  check('une vidéo garde son plan', !!shared[0].videoPlan && shared[0].videoPlan.beats.length === 1);
  check('une publication (non vidéo) n’a pas de plan vidéo', !shared.find((i) => i.id === 'b' && i.format === 'post')?.videoPlan);
}

console.log(
  failures === 0
    ? '\n✓ Périodes de communication : tout est conforme.\n'
    : `\n✗ ${failures} contrôle(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
