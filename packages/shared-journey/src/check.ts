/**
 * Contrôle sans réseau ni modèle de la boucle : `npm run check` dans `packages/shared-journey`.
 * Chaque cas est une décision que l'utilisateur verrait (une carte affichée ou pas, laquelle, vers où).
 */
import { EMPTY_MEMORY, JourneyEvent, NO_FACTS, ProjectFacts } from './model';
import { factsFromEvents, factsFromProject, mergeFacts } from './facts';
import { journeyLink } from './links';
import { recommend, remember } from './rules';
import { recommendationText } from './texts';

let failed = 0;
let passed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`✗ ${name}`, detail ?? '');
  }
};

const NOW = Date.parse('2026-10-27T12:00:00Z');
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
const facts = (partial: Partial<ProjectFacts>): ProjectFacts => ({ ...NO_FACTS, ...partial });
const event = (type: JourneyEvent['type'], hours = 0, projectId = 'p1'): JourneyEvent => ({ type, app: 'icode', projectId, at: ago(hours) });

// 1. Un site refait dans iCode : la communication est proposée tout de suite, dans iCode.
{
  const [rec] = recommend({ facts: facts({ site: true, brand: true }), events: [event('site.redesigned')], memory: EMPTY_MEMORY, surface: { app: 'icode', place: 'site' }, trigger: 'site.redesigned', projectId: 'p1', now: NOW });
  check('site refait → communication', rec?.destination === 'communication' && rec.because === 'site.redesigned', rec);
  check('lien communication avec le projet', journeyLink('communication', { urls: { dashboard: 'https://app.idem.africa/', icode: 'https://icode.idem.africa' }, projectId: 'p1', from: 'icode' }) === 'https://app.idem.africa/project/communication?projectId=p1&from=icode');
}

// 2. Communication déjà en place : on ne la propose plus, la mise en ligne passe devant.
{
  const [rec] = recommend({ facts: facts({ site: true, communication: true }), events: [event('site.generated')], memory: EMPTY_MEMORY, surface: { app: 'icode', place: 'site' }, trigger: 'site.generated', projectId: 'p1', now: NOW });
  check('communication faite → mise en ligne', rec?.destination === 'publish-site', rec);
}

// 3. Écartée : silence 14 jours, puis de nouveau proposable ; un deuxième refus double le silence.
{
  const input = { facts: facts({ site: true }), events: [event('site.generated', 1)], surface: { app: 'icode' as const, place: 'site' as const }, projectId: 'p1' };
  let memory = remember(EMPTY_MEMORY, 'site-to-communication', 'dismissed', NOW);
  check('écartée → pas proposée', !recommend({ ...input, memory, now: NOW + 3_600_000 }).some((r) => r.id === 'site-to-communication'));
  const later = NOW + 15 * 86_400_000;
  check('écartée il y a 15 jours → de nouveau proposable', recommend({ ...input, events: [event('site.published', -15 * 24)], memory, now: later }).some((r) => r.id === 'site-to-communication'));
  memory = remember(memory, 'site-to-communication', 'dismissed', later);
  check('2e refus → 28 jours', !recommend({ ...input, events: [event('site.published', -15 * 24)], memory, now: later + 20 * 86_400_000 }).some((r) => r.id === 'site-to-communication'));
}

// 4. La page Communication ne recommande pas la communication.
{
  const recs = recommend({ facts: facts({ site: true, brand: true }), events: [event('site.generated', 2)], memory: EMPTY_MEMORY, surface: { app: 'dashboard', place: 'communication' }, projectId: 'p1', limit: 3, now: NOW });
  check('pas de boucle sur place', !recs.some((r) => r.destination === 'communication'), recs);
}

// 5. Un geste vieux de 10 jours ne déclenche plus rien, sauf l'accueil d'un projet (ambient).
{
  const input = { facts: facts({ site: true }), events: [event('site.generated', 240)], memory: EMPTY_MEMORY, surface: { app: 'dashboard' as const }, projectId: 'p1', now: NOW };
  check('vieux geste → rien', recommend(input).length === 0);
  check('accueil → prochaine étape', recommend({ ...input, ambient: true }).length === 1);
}

// 6. Les événements d'un autre projet ne comptent pas.
{
  const recs = recommend({ facts: facts({ site: true }), events: [event('site.published', 1, 'p2')], memory: EMPTY_MEMORY, surface: { app: 'dashboard' }, projectId: 'p1', now: NOW });
  check('autre projet ignoré', !recs.some((r) => r.because === 'site.published'), recs);
}

// 7. Faits : projet + événements.
{
  const project = { analysisResultModel: { branding: { logo: { svg: '<svg/>' }, colors: { colors: { primary: '#123456' } }, typography: { primaryFont: 'Inter' }, sections: [{ data: '<p/>' }] }, communication: { visuals: [{}] } } };
  const merged = mergeFacts(factsFromProject(project), factsFromEvents([event('site.published')], 'p1'));
  check('faits du projet', merged.brand && merged.charter && merged.communication && !merged.businessPlan, merged);
  check('faits des gestes', merged.site && merged.sitePublished && !merged.domain, merged);
  check('projet vide lisible', !Object.values(factsFromProject(null)).some(Boolean));
}

// 8. Une seule carte par destination, même si deux règles y mènent.
{
  const recs = recommend({ facts: facts({ site: true, app: true, appPublished: true }), events: [event('site.generated'), event('app.published')], memory: EMPTY_MEMORY, surface: { app: 'dashboard' }, projectId: 'p1', limit: 5, now: NOW });
  check('destinations uniques', new Set(recs.map((r) => r.destination)).size === recs.length, recs);
}

// 9. Affichages : deux dans la même heure n'en font qu'un ; un clic remet à zéro.
{
  let memory = remember(EMPTY_MEMORY, 'x', 'shown', NOW);
  memory = remember(memory, 'x', 'shown', NOW + 60_000);
  check('affichage compté une fois par heure', memory.shown.x.count === 1);
  memory = remember(memory, 'x', 'clicked', NOW + 120_000);
  check('clic remet les affichages à zéro', !memory.shown.x && memory.clicked.x.count === 1);
}

// 10. Chaque règle a ses textes dans les deux langues.
{
  const ids = ['site-to-communication', 'app-to-communication', 'site-to-publish', 'app-to-publish', 'published-to-domain', 'published-to-legal', 'brand-to-charter', 'charter-to-site', 'communication-to-video', 'simulation-to-business-plan', 'business-plan-to-pitch-deck', 'site-to-app'];
  for (const id of ids) {
    for (const lang of ['fr', 'en']) {
      const text = recommendationText(id, 'communication', lang);
      check(`texte ${id} ${lang}`, !!text.title && !!text.body && !!text.cta);
    }
  }
}

console.log(`${passed} contrôles réussis, ${failed} en échec`);
if (failed) process.exit(1);
