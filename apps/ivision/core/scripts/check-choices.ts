/**
 * `npm run check:choices --prefix apps/ivision/core` — les questions à cliquer et la fidélité au modèle,
 * SANS modèle (règles pures, zéro jeton) :
 *
 *  1. questions du montage : celles que la demande règle ne sont pas posées, le choix recommandé suit le
 *     cadre de la vidéo et la marque, les réponses (ou « Choisir pour moi ») deviennent les réglages ;
 *  2. choix appliqués au plan du monteur (sous-titres, intro, carton de fin) ;
 *  3. modèle : format d'un visuel tiré de ses proportions ; vidéo — une scène par plan du modèle, la fiche
 *     du plan jointe à sa scène, la dernière scène du planificateur gardée en dernier.
 */
import { montageChoices, montageChoicesInText, montageQuestions } from '../src/montage/montage.questions';
import { rulesPlan, withChoices, PlannerInput, MontagePlan } from '../src/montage/montage.planner';
import { visualFormatOfRatio, ReferenceBlueprint } from '../src/reference/reference.analyzer';
import { referenceShotCards } from '../src/reference/reference.plan';
import { normalizeStoryboard } from '../src/video/director/storyboard.agent';
import type { FilmBrief } from '../src/video/director/brief';
import type { PlannedFilm } from '../src/video/director/film-format';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  // eslint-disable-next-line no-console
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const recommended = (q: ReturnType<typeof montageQuestions>[number] | undefined) => q?.options.find((o) => o.recommended)?.id;

// ── 1. Questions du montage ────────────────────────────────────────────────
{
  const vertical = montageQuestions({ request: '', width: 1080, height: 1920, branded: true, language: 'fr' });
  check('sans consigne : format, coupes, sous-titres, début et fin, musique', vertical.map((q) => q.id).join(',') === 'format,cuts,captions,finish,music', vertical.map((q) => q.id).join(','));
  check('une seule option recommandée par question', vertical.every((q) => q.options.filter((o) => o.recommended).length === 1));
  check('vidéo verticale : « Statut, Reels, TikTok » recommandé', recommended(vertical.find((q) => q.id === 'format')) === 'story');
  check('marque connue : carton de fin seul recommandé', recommended(vertical.find((q) => q.id === 'finish')) === 'outro');

  const landscape = montageQuestions({ request: '', width: 1920, height: 1080, branded: false, language: 'en' });
  check('vidéo horizontale : YouTube recommandé, sous-titres « phrase entière »', recommended(landscape.find((q) => q.id === 'format')) === 'landscape' && recommended(landscape.find((q) => q.id === 'captions')) === 'karaoke');
  check('sans marque : ni intro ni carton recommandés', recommended(landscape.find((q) => q.id === 'finish')) === 'none');
  check('questions en anglais pour une demande anglaise', /Where will you post/.test(landscape[0].question));

  const said = montageQuestions({ request: 'Monte ma vidéo en carré, sans musique, avec une intro', width: 1080, height: 1920, branded: true, language: 'fr' });
  check('« en carré, sans musique, avec une intro » : ces trois questions ne sont pas posées', !said.some((q) => ['format', 'music', 'finish'].includes(q.id)), said.map((q) => q.id).join(','));
  const known = montageChoicesInText('Monte ma vidéo en carré, sans musique, avec une intro');
  check('la demande règle format, musique et intro', known.format === 'square' && known.music === false && known.finish === 'both', JSON.stringify(known));
  check('« sans sous-titres » est lu', montageChoicesInText('pas de sous-titres stp').captions === 'none');
  check('« coupe les blancs » est lu', montageChoicesInText('coupe les blancs').cuts === 'tight');

  const picked = montageChoices('', { format: 'landscape', cuts: 'none', captions: 'minimal', finish: 'both', music: 'no' });
  check('les réponses deviennent les réglages', picked.format === 'landscape' && picked.cuts === 'none' && picked.captions === 'minimal' && picked.finish === 'both' && picked.music === false, JSON.stringify(picked));
  const forMe = montageChoices('', {}, vertical);
  check('« Choisir pour moi » : les choix recommandés', forMe.format === 'story' && forMe.cuts === 'tight' && forMe.captions === 'pop' && forMe.finish === 'outro' && forMe.music === true, JSON.stringify(forMe));
  const injected = montageChoices('', { format: 'cinema', captions: '<script>' });
  check('une réponse hors des valeurs admises est ignorée', !injected.format && !injected.captions);
  const textWins = montageChoices('en carré', { format: 'story' });
  check('la demande écrite l’emporte sur un clic contraire', textWins.format === 'square');
}

// ── 2. Choix appliqués au plan du monteur ──────────────────────────────────
{
  const words = 'Bonjour je suis Awa Diop et je vends du jus de bissap naturel à Abidjan'.split(' ').map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
  const input: PlannerInput = { words, timed: words.map((w) => ({ ...w, index: 0 })) as never, durationSec: 6, prompt: '', brandName: 'Saveurs d’Abidjan', sheet: '', contacts: ['wa.me/2250700000000'], language: 'fr', format: 'story', creativity: 'low', clips: [] };
  const plan: MontagePlan = { ...rulesPlan(input), intro: undefined, outro: undefined };
  const both = withChoices(plan, { captions: 'karaoke', intro: true, outro: true }, input);
  check('intro et carton voulus : posés par les règles', !!both.intro && !!both.outro && both.captions === 'karaoke', JSON.stringify({ intro: both.intro?.title, outro: both.outro?.text }));
  const none = withChoices({ ...plan, intro: { title: 'Titre', durationSec: 2.6 }, outro: { text: 'Fin', durationSec: 2.6 } }, { intro: false, outro: false, captions: 'none' }, input);
  check('refusés : retirés, même proposés par le monteur ; « pas de sous-titres » appliqué', !none.intro && !none.outro && none.captions === 'none');
  check('sans choix : le plan du monteur intact', withChoices(plan, undefined, input) === plan);
}

// ── 3. Fidélité au modèle ──────────────────────────────────────────────────
{
  check('modèle 1080×1920 → story', visualFormatOfRatio(1080, 1920) === 'story');
  check('modèle 1080×1080 → carré', visualFormatOfRatio(1080, 1080) === 'square');
  check('modèle 1200×628 → bannière', visualFormatOfRatio(1200, 628) === 'banner');
  check('modèle 1080×1350 → publication 4:5', visualFormatOfRatio(1080, 1350) === 'post');
  check('dimensions inconnues → rien d’imposé', visualFormatOfRatio(undefined, 100) === undefined);

  const shot = (i: number, layout: string, description: string) => ({
    index: i,
    start: i * 2,
    duration: 2,
    role: 'claim' as const,
    media: 'none' as const,
    layout: layout as never,
    camera: 'push' as const,
    background: 'brand' as const,
    texts: [{ role: 'headline' as const, words: 3, position: 'center' as const }],
    energy: 'high' as const,
    description,
    ...(i ? { transitionIn: 'whip' } : {}),
  });
  const bp: ReferenceBlueprint = {
    kind: 'video',
    duration: 8,
    width: 1080,
    height: 1920,
    orientation: 'portrait',
    hasAudio: false,
    shots: [shot(0, 'giant-number', 'a giant number slams in'), shot(1, 'split-blocks', 'two colour blocks slide apart'), shot(2, 'kinetic-words', 'words burst one by one'), shot(3, 'logo', 'the logo draws itself')],
    pace: 0.4,
    summary: '',
    source: 'vision',
  };
  const cards = referenceShotCards(bp, 6);
  check('une fiche par plan, avec sa mise en page et son mouvement', cards.length === 4 && /chiffre géant/.test(cards[0].line) && /giant number slams/.test(cards[0].line) && cards[1].transition === 'as in the model: whip');

  const brief = { request: 'Promo', language: 'fr', brandSheet: '', anonymous: false, format: 'story', durationSec: 8, media: [], voice: false, newMedia: { images: 0, clips: 0 }, previous: [], level: 'medium', referenceShots: cards } as unknown as FilmBrief;
  const scene = (headline: string) => ({ purpose: headline, visual: `visual of ${headline}`, motion: 'moves', texts: { headline }, media: [], needs: [] });
  const tooMany: PlannedFilm = { title: 'T', concept: 'C', bible: 'B', scenes: [scene('Un'), scene('Deux'), scene('Trois'), scene('Quatre'), scene('Cinq'), scene('Fin')] };
  const sb = normalizeStoryboard(tooMany, brief, null);
  check('planificateur trop long : une scène par plan du modèle', sb.scenes.length === 4, String(sb.scenes.length));
  check('la dernière scène (la marque, l’appel) reste la dernière', sb.scenes[3].texts.headline === 'Fin');
  check('chaque scène porte la fiche de son plan', sb.scenes.every((s, i) => s.visual.includes(`AS IN THE CLIENT'S MODEL (shot ${i + 1})`)) && sb.scenes[1].visual.includes('two colour blocks'));
  check('la transition du modèle est reprise quand le planificateur n’en donne pas', sb.scenes[1].transition === 'as in the model: whip');
  const tooFew: PlannedFilm = { title: 'T', concept: 'C', bible: 'B', scenes: [scene('Un'), scene('Fin')] };
  const sb2 = normalizeStoryboard(tooFew, brief, null);
  check('planificateur trop court : complété jusqu’au nombre de plans, la fin gardée', sb2.scenes.length === 4 && sb2.scenes[3].texts.headline === 'Fin' && sb2.scenes[1].visual.startsWith("AS IN THE CLIENT'S MODEL"));
  check('les durées font la durée achetée', Math.abs(sb.scenes.reduce((a, s) => a + s.duration, 0) - 8) < 0.01);
}

// eslint-disable-next-line no-console
console.log(`\n${passes} vérifications réussies, ${failures} en échec`);
process.exit(failures ? 1 : 0);
