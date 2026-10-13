/**
 * `npm run check:request --prefix apps/ivision/core` — LA DEMANDE SUIVIE À LA LETTRE, sans IDEM.
 *
 * Le point de départ est un vrai script d'utilisateur (`fixtures/launch-script.fr.md`, 60 s, six
 * scènes, textes à l'écran, interdits) qui donnait une vidéo hors sujet : demande coupée à 2 000
 * signes, voix anglaise sur des textes français, aucun plan filmé, captures de la marque ignorées,
 * images jamais dessinées, six plans sur dix repliés en cartes de texte. Ce contrôle prouve :
 *
 *   1. la lecture : langue, scènes, minutage, textes mot pour mot, textes d'interface, supports,
 *      périmètre (4K, 24 i/s signalés), consignes ;
 *   2. la langue de la DEMANDE, jamais celle de la page (cinq langues, consignes explicites) ;
 *   3. le découpage par le code (crans Low à Max) ;
 *   4. le directeur IA tenu par le scénario (cran Ultra) : textes replacés, texte inventé retiré,
 *      scène oubliée rajoutée, minutage des scènes ;
 *   5. le contrôle du code des plans : plus de faux positif sur un commentaire, réparations
 *      mécaniques, alias du kit ;
 *   6. les médias : disjoncteur sur un fournisseur sans crédit (402), banques ancrées sur le
 *      personnage ;
 *   7–8. deux vidéos créées de bout en bout (Low sans modèle, Ultra avec un directeur simulé) :
 *      plans filmés générés, captures de la marque à l'écran, textes exacts, minutage, fidélité —
 *      et des images du rendu réel ;
 *   9. la voix off : lignes lisibles, réponse du narrateur tolérée.
 */
process.env.VIDEO_MUSIC_OPENVERSE = 'off';
process.env.VIDEO_MUSIC_CCMIXTER = 'off';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.VIDEO_MEDIA_CHECK = 'off';
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
delete process.env.PEXELS_API_KEY;
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { configureCore } from '../src/runtime/host';
import { MotionVideoService } from '../src/video/motionVideo.service';
import type { VideoStore } from '../src/video/video.store';
import type { MotionVideo, VideoStoryboard } from '../src/video/video.model';
import { detectLanguage, resolveLanguage } from '../src/text/language';
import { describesFilmedAction, mergeReader, parseRequest, requestMessage, sceneTimeline, normText } from '../src/video/video.request';
import { checkFidelity, planScriptShots, slotTexts, splitText, textSlots } from '../src/video/video.script';
import { DirectorInput, parseFilm } from '../src/video/video.author';
import { autoFixSceneCode, lintSceneCode } from '../src/video/video.coder';
import { isPaymentError, sourceShots, stockQuery } from '../src/video/video.sourcing';
import { parseNarration, speakableCase } from '../src/video/video.voice';
import { extractFacts } from '../src/video/video.copy';
import { buildVideoTheme } from '../src/video/video.theme';
import { composeVideoHtml, inlineAssets } from '../src/video/video.composer';
import { closeRenderBrowser, withRenderPage } from '../src/video/video.renderer';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'ivision-request-check-'));
const RAW = fs.readFileSync(path.join(__dirname, 'fixtures', 'launch-script.fr.md'), 'utf8');
const EXPECTED = [
  'Tout commence par une idée.',
  'Avoir une idée, c’est facile. Construire un business, c’est une autre histoire.',
  'Et si tu n’avais plus à tout construire seul ?',
  'Analyse.',
  'Construis.',
  'Crée.',
  'Lance-toi.',
  'Ton idée mérite de devenir un business.',
  'IDEM',
  'De l’idée au business.',
  'https://idem.africa',
];

// ─── Hôte simulé : stockage sur disque, générateurs d'images et de clips pilotables ───────────

let clipMode: 'ok' | 'payment' = 'ok';
let clipCalls = 0;
let imageCalls = 0;
const clipFile = path.join(OUT, 'clip.mp4');
const ff = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipFile]);
if (ff.status !== 0) throw new Error(`ffmpeg: ${ff.stderr}`);
const paymentError = () => Object.assign(new Error('Request failed with status code 402'), { status: 402 });

configureCore({
  apiBaseUrl: () => 'http://127.0.0.1:1',
  sfxUrl: (n) => `http://127.0.0.1:1/sfx/${n}`,
  storage: {
    async uploadFile(content, fileName, folder) {
      const dir = path.join(OUT, 'storage', folder.replace(/[^a-zA-Z0-9/_-]/g, '_'));
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, fileName);
      fs.writeFileSync(file, content);
      return { fileName, downloadURL: `file://${file}` };
    },
  },
  generateImage: async () => {
    imageCalls++;
    if (clipMode === 'payment') throw paymentError();
    const buffer = await sharp({ create: { width: 1728, height: 960, channels: 3, background: '#7a5c3e' } }).jpeg().toBuffer();
    return { buffer, mimeType: 'image/jpeg', model: 'test-image' };
  },
  generateVideo: async () => {
    clipCalls++;
    if (clipMode === 'payment') throw paymentError();
    return { buffer: fs.readFileSync(clipFile), model: 'test-clip' };
  },
});

/** Trois captures du « produit » (1440×900), comme celles qu'iVision lit sur un site. */
async function screenshot(name: string, label: string, color: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><rect width="1440" height="900" fill="#f6f7fb"/><rect width="260" height="900" fill="#ffffff"/><rect x="300" y="60" width="1080" height="120" rx="16" fill="${color}"/><text x="330" y="140" font-family="Arial" font-size="56" font-weight="700" fill="#ffffff">${label}</text><rect x="300" y="220" width="520" height="300" rx="16" fill="#ffffff"/><rect x="860" y="220" width="520" height="300" rx="16" fill="#ffffff"/><rect x="300" y="560" width="1080" height="280" rx="16" fill="#ffffff"/></svg>`;
  const file = path.join(OUT, `${name}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  return `file://${file}`;
}

class MemoryStore implements VideoStore {
  videos: MotionVideo[] = [];
  director = '';
  prompts: string[] = [];
  constructor(private readonly media: { url: string; kind?: 'screen' | 'photo'; note?: string }[]) {}
  async loadBrand() {
    return {
      brandName: 'IDEM',
      branding: {
        colors: { colors: { primary: '#1447e6', secondary: '#0f141b', accent: '#ec4300', background: '#ffffff', text: '#16181d' } },
        typography: { primary: { family: 'Inter' }, secondary: { family: 'Inter' } },
      } as any,
      // La page de l'utilisateur et sa marque sont en ANGLAIS : la vidéo doit pourtant être en français.
      voice: { brandName: 'IDEM', businessType: 'AI agents for business building', tone: 'empowering', valueProposition: 'Intelligence you own, not rent.', keywords: ['AI'], language: 'en' },
      visuals: [],
      videos: this.videos,
      media: this.media,
    };
  }
  async listVideos() {
    return JSON.parse(JSON.stringify(this.videos));
  }
  async saveVideo(_u: string, _p: string, video: MotionVideo) {
    this.videos = [...this.videos.filter((v) => v.id !== video.id), JSON.parse(JSON.stringify(video))];
  }
  async mutateVideo(_u: string, _p: string, id: string, mutate: (v: MotionVideo) => MotionVideo) {
    let out: MotionVideo | null = null;
    this.videos = this.videos.map((v) => (v.id === id ? (out = mutate(v)) : v));
    return out;
  }
  async removeVideo() {
    return true;
  }
  async runVideoTieredPrompt(_u: string, system: string, user: string) {
    this.prompts.push(`${system}\n${user}`);
    // Le directeur simulé ne répond qu'au découpage d'un scénario ; les autres agents se taisent (repli du code).
    return /SCRIPT — written by the client/.test(user) ? this.director : '';
  }
}

/** Un découpage de directeur avec les fautes qu'un modèle fait vraiment. */
const DIRECTOR = [
  'FILM: De l’idée au business',
  'CONCEPT: Un entrepreneur, son carnet, et l’idée qui devient une entreprise.',
  'BIBLE: Lumière naturelle ; des lignes bleues relient les gestes à l’interface.',
  'CAST: young Black African man, late twenties, short hair, white linen shirt, calm and determined',
  'LOOK: soft natural window light, warm wood tones, 35mm lens, shallow depth of field',
  'SHOT 1 | 5s | surface: deep | scene: 1 | medium: footage',
  'FOOTAGE: a young Black African entrepreneur alone in a modest modern workspace writes an idea in a notebook, looks at his laptop and smiles, slow push-in, natural light',
  'QUERY: entrepreneur writing notebook',
  'VISUAL: the clip fills the frame; a thin blue line rises from the handwriting',
  'HANDOFF: the blue line carries on',
  // Le texte légèrement retouché (sans accent ni point) doit reprendre sa forme exacte.
  'SHOT 2 | 3s | surface: deep | scene: 1 | medium: motion',
  'TEXT: « Tout commence par une idee »',
  'VISUAL: the sentence writes itself along the blue line',
  'SHOT 3 | 4s | surface: light | scene: 2 | medium: footage',
  'FOOTAGE: the same man opens his laptop on a wooden desk, over-the-shoulder shot, slow pan right',
  'VISUAL: the clip, a cursor appears',
  'SHOT 4 | 3s | surface: light | scene: 2 | medium: screen',
  'SCREEN: none',
  'VISUAL: a folder named MON BUSINESS opens and its files multiply',
  // Un texte inventé (« ne pas ajouter de texte ») doit disparaître.
  'SHOT 5 | 3s | surface: deep | scene: 2 | medium: motion',
  'TEXT: Avoir une idée, c’est facile. Construire un business, c’est une autre histoire.',
  'TEXT: Rejoignez la révolution !',
  'VISUAL: black screen, the sentence types itself',
  'SHOT 6 | 7s | surface: deep | scene: 3 | medium: screen',
  'SCREEN: 3',
  'TEXT: Et si tu n’avais plus à tout construire seul ?',
  'VISUAL: a blue dot draws a line that reveals the logo, then the interface',
  // Ordre inversé et un mot oublié.
  'SHOT 7 | 10s | surface: primary | scene: 4 | medium: screen',
  'SCREEN: 1',
  'TEXT: Construis.',
  'TEXT: Analyse.',
  'VISUAL: the business plan builds itself',
  'SHOT 8 | 10s | surface: deep | scene: 4 | medium: motion',
  'TEXT: Lance-toi.',
  'VISUAL: elements reorganise into a clear composition',
  // La scène 5 est oubliée : elle doit revenir, telle qu'écrite.
  'SHOT 9 | 7s | surface: deep | scene: 6 | medium: logo',
  'SIGNATURE: yes',
  'TEXT: De l’idée au business.',
  'TEXT: https://idem.africa',
  'VISUAL: the logo appears in the centre, a blue line links it to a minimal composition',
].join('\n');

/** Une image de rendu : est-elle autre chose qu'un aplat ? */
async function variance(png: Buffer): Promise<number> {
  const stats = await sharp(png).stats();
  return stats.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
}

(async () => {
  console.log('La demande suivie à la lettre — sans IDEM, modèles simulés\n');

  // ── 1 ──
  section('1. La demande lue en entier');
  const spec = parseRequest(RAW, { fallbackLanguages: ['en', 'en'] });
  check('langue : celle de la demande (français), pas celle de la page ni de la marque (anglais)', spec.language === 'fr' && spec.languageSource === 'explicit', `${spec.language} (${spec.languageSource})`);
  check('scénario : six scènes, minutage écrit', spec.mode === 'script' && JSON.stringify(spec.scenes.map((s) => [s.start, s.end])) === JSON.stringify([[0, 8], [8, 18], [18, 25], [25, 45], [45, 53], [53, 60]]), JSON.stringify(spec.scenes.map((s) => [s.start, s.end])));
  check('textes à l’écran mot pour mot, dans l’ordre (onze)', JSON.stringify(spec.scenes.flatMap((s) => s.texts)) === JSON.stringify(EXPECTED), JSON.stringify(spec.scenes.flatMap((s) => s.texts)));
  check('textes DANS l’image : le dossier, ses sept fichiers, la saisie', spec.scenes[1].props[0] === 'MON BUSINESS' && spec.scenes[1].props.length === 8 && spec.scenes[2].props[0] === 'Je veux lancer mon business.', JSON.stringify(spec.scenes.map((s) => s.props)));
  check('supports : plan filmé, interface, motion design, signature', spec.scenes[0].media[0] === 'footage' && spec.scenes[1].media.join() === 'footage,screen,motion' && spec.scenes[3].media[0] === 'motion' && spec.scenes[4].media[0] === 'footage' && spec.scenes[5].media.join() === 'logo', JSON.stringify(spec.scenes.map((s) => s.media)));
  check('périmètre : 60 s, 16:9 ; 4K et 24 i/s signalés (jamais ignorés en silence)', spec.durationSec === 60 && spec.format === 'landscape' && spec.unsupported.join() === '4K,24 fps', JSON.stringify([spec.durationSec, spec.format, spec.unsupported]));
  check('consignes : interdits relevés, musique électronique → ambiance épique, personnage africain', spec.avoid.some((a) => /robots/.test(a)) && spec.avoid.some((a) => /texte aléatoire/.test(a)) && spec.musicMood === 'epic' && /africain/.test(spec.cast || ''), JSON.stringify({ avoid: spec.avoid, mood: spec.musicMood, cast: spec.cast }));
  check('« même sans voix off » n’est pas un refus de voix off', spec.voiceOver !== 'none');
  check('le message est l’objectif (pas les 400 premiers signes du script)', requestMessage(spec, RAW).startsWith('Créer une vidéo de lancement mémorable pour IDEM'), requestMessage(spec, RAW));
  const shortBrief = parseRequest("Fais une vidéo de 15 s pour nos soldes de fin d'année : -30 % sur tout, avec le slogan « Le goût du pays »", { fallbackLanguages: ['en'] });
  check('demande courte : pas de scénario, texte exigé relevé, durée lue', shortBrief.mode === 'brief' && shortBrief.texts[0] === 'Le goût du pays' && shortBrief.durationSec === 15 && shortBrief.language === 'fr');
  const timed = parseRequest('0-5s : plan sur le produit, une femme tient le flacon\n5-10s : texte « 5 000 FCFA seulement »\n10-15s : logo et slogan');
  check('script minuté sans titres de scène (« 0-5s : … »)', timed.mode === 'script' && timed.scenes.length === 3 && timed.scenes[0].media[0] === 'footage' && timed.scenes[1].texts[0] === '5 000 FCFA seulement' && timed.scenes[2].media[0] === 'logo');
  const english = parseRequest('Scene 1: A young woman walks into a bright bakery in Lagos.\nText: "Fresh every morning"\nScene 2: Close-up on bread coming out of the oven.\nText: "Since 1998"\nScene 3: Logo with the website www.mabakery.ng', { fallbackLanguages: ['fr'] });
  check('script anglais (« Scene 1: … », « Text: "…" ») et adresse de la signature', english.language === 'en' && english.scenes.length === 3 && english.scenes[0].texts[0] === 'Fresh every morning' && english.scenes[1].media[0] === 'footage' && english.scenes[2].texts.includes('www.mabakery.ng'), JSON.stringify(english.scenes.map((s) => [s.media, s.texts])));
  const merged = mergeReader(spec, ['cast: young Black African man, late twenties, short hair, white shirt', 'look: soft window light, warm tones', 'music: epic', '1.media: footage, motion', '1.footage: a young Black African entrepreneur writes in a notebook in a modest modern workspace, slow push-in', '1.query: african entrepreneur notebook', '6.media: footage', '9.media: footage'].join('\n'));
  check('le lecteur IA complète (personnage, plans filmés) sans pouvoir changer la signature ni ajouter de scène', !!merged && merged.cast?.startsWith('young Black African man') === true && !!merged.scenes[0].footage && merged.scenes[5].media.join() === 'logo' && merged.scenes.length === 6);

  // ── 2 ──
  section('2. La langue de la demande, jamais celle de la page');
  const lang = (text: string, ...fallbacks: string[]) => resolveLanguage(text, fallbacks).code;
  check('français écrit sur une page anglaise → français', lang('Fais une vidéo pour mon restaurant de grillades à Douala, ambiance chaleureuse', 'en', 'en') === 'fr');
  check('anglais écrit sur une page française → anglais', lang('Make a video for my grill restaurant in Douala, with a warm mood', 'fr', 'fr') === 'en');
  check('consigne explicite : « voice-over in French » → français', lang('Create a 30s video for our coffee shop opening in Accra on Saturday. Voice-over in French.', 'en') === 'fr');
  check('espagnol et swahili reconnus', lang('Un vídeo para nuestra tienda de ropa en Madrid con descuentos de verano', 'fr') === 'es' && lang('Video ya tangazo kwa duka letu la simu katika Nairobi, na punguzo kubwa kwa wateja wetu', 'fr') === 'sw');
  check('demande trop courte pour trancher : la langue de l’interface', lang('promo IDEM', 'en', 'fr') === 'en' && lang('IDEM', 'fr', 'en') === 'fr');
  check('« L’IDÉE NAÎT SEULE » seul ne suffit pas à trancher (repli)', !detectLanguage('L’IDÉE NAÎT SEULE'));

  // ── 3 ──
  section('3. Le scénario découpé par le code (crans Low à Max)');
  const shots = planScriptShots(spec, 60, { maxClips: 4, hasScreens: true, brandName: 'IDEM' });
  const shotTexts = shots.flatMap((sh) => slotTexts(sh.sceneId, sh.slots));
  const joined = normText(shotTexts.join(' '));
  check(`${shots.length} plans pour six scènes, total 60 s`, new Set(shots.map((s) => s.scene)).size === 6 && Math.abs(shots.reduce((a, s) => a + s.duration, 0) - 60) < 0.01);
  check('chaque texte à l’écran, mot pour mot (le nom de la marque : par le logo)', EXPECTED.filter((t) => t !== 'IDEM').every((t) => joined.includes(normText(t))), JSON.stringify(shotTexts));
  check('le minutage de chaque scène est tenu', sceneTimeline(spec, 60).every((t, k) => Math.abs(shots.filter((s) => s.scene === k).reduce((a, s) => a + s.duration, 0) - t.duration) < 0.02));
  check('plans filmés : au plus le plafond de clips (4)', shots.filter((s) => s.medium === 'footage').length <= 4 && shots.filter((s) => s.medium === 'footage').length >= 2);
  check('la scène 2 montre l’interface du dossier et ses fichiers', shots.some((s) => s.scene === 1 && s.medium === 'screen' && s.props?.[0] === 'MON BUSINESS'));
  check('la rafale « Analyse. Construis. Crée. Lance-toi. » : un plan par mot', shots.filter((s) => s.scene === 3).length === 4);
  check('la signature : phrase et adresse web', shots[shots.length - 1].sceneId === 'logo' && shots[shots.length - 1].slots.tagline === 'De l’idée au business.' && shots[shots.length - 1].slots.url === 'https://idem.africa');
  const unnamed = textSlots('logo', ['IDEM', 'De l’idée au business.', 'https://idem.africa'], 'Marque');
  const named = textSlots('logo', ['IDEM', 'De l’idée au business.', 'https://idem.africa'], 'IDEM');
  check('signature sans marque : le nom écrit par le script signe, le slogan reste le slogan', unnamed.name === 'IDEM' && unnamed.tagline === 'De l’idée au business.' && unnamed.url === 'https://idem.africa' && !named.name && named.tagline === 'De l’idée au business.', JSON.stringify({ unnamed, named }));
  check('un texte long se coupe à la fin d’une phrase, jamais au milieu d’un mot', JSON.stringify(splitText(EXPECTED[1])) === JSON.stringify(['Avoir une idée, c’est facile.', 'Construire un business, c’est une autre histoire.']));
  const half = planScriptShots(spec, 30, { maxClips: 4, hasScreens: true, brandName: 'IDEM' });
  check('vidéo achetée en 30 s : chaque scène garde sa part du temps', Math.abs(half.reduce((a, s) => a + s.duration, 0) - 30) < 0.01 && Math.abs(half.filter((s) => s.scene === 3).reduce((a, s) => a + s.duration, 0) - 10) < 0.05);

  // ── 4 ──
  section('4. Le directeur IA tenu par le scénario (cran Ultra)');
  const directorInput: DirectorInput = {
    brief: { message: requestMessage(spec, RAW) },
    briefText: RAW,
    facts: extractFacts(RAW),
    sheet: 'BRAND: IDEM',
    direction: 'cinematic',
    durationSec: 60,
    formats: ['landscape'],
    range: [6, 18],
    media: ['SCREENSHOT of the brand product: business plan', 'SCREENSHOT of the brand product: financial forecasts', 'SCREENSHOT of the brand product: IDEM website home'],
    brandName: 'IDEM',
    language: 'fr',
    script: spec,
    timeline: sceneTimeline(spec, 60),
    maxFootage: 4,
  };
  const film = parseFilm(DIRECTOR, directorInput);
  const filmTexts = film ? film.shots.flatMap((sh) => slotTexts(sh.kind, sh.slots)) : [];
  check('le découpage du directeur est accepté et réparé', !!film && (film.repairs?.length || 0) >= 3, JSON.stringify(film?.repairs));
  check('texte retouché par le modèle → sa forme exacte', filmTexts.includes('Tout commence par une idée.'), JSON.stringify(filmTexts));
  check('texte inventé (« Rejoignez la révolution ! ») retiré', !filmTexts.some((t) => /révolution/i.test(t)));
  check('ordre du scénario rétabli, mot oublié replacé (Analyse. › Construis. › Crée. › Lance-toi.)', JSON.stringify(filmTexts.filter((t) => ['Analyse.', 'Construis.', 'Crée.', 'Lance-toi.'].includes(t))) === JSON.stringify(['Analyse.', 'Construis.', 'Crée.', 'Lance-toi.']), JSON.stringify(filmTexts));
  check('scène oubliée rajoutée, telle qu’écrite', !!film?.shots.some((sh) => sh.scene === 4 && slotTexts(sh.kind, sh.slots).includes('Ton idée mérite de devenir un business.')));
  check('signature : phrase et adresse, le nom par le logo', film?.shots[film.shots.length - 1].kind === 'logo' && film.shots[film.shots.length - 1].slots.tagline === 'De l’idée au business.' && film.shots[film.shots.length - 1].slots.url === 'https://idem.africa');
  check('minutage : chaque scène dure ce que dit le scénario', !!film && sceneTimeline(spec, 60).every((t, k) => Math.abs(film.shots.filter((s) => s.scene === k).reduce((a, s) => a + s.duration, 0) - t.duration) < 0.15) && Math.abs(film.shots.reduce((a, s) => a + s.duration, 0) - 60) < 0.05);
  check('outils : plans filmés décrits pour le générateur, captures désignées, personnage et lumière', !!film && film.shots[0].medium === 'footage' && /notebook/.test(film.shots[0].footage || '') && film.shots.find((sh) => sh.scene === 2)?.media === 3 && /young Black African man/.test(film.cast || '') && !!film.look);

  // ── 5 ──
  section('5. Le contrôle du code des plans');
  const clean = `import { useScene, useLocalTime, Kinetic, easeOut, lerp } from '@idem/kit';
export default function Scene() {
  const s = useScene();
  const lt = useLocalTime();
  // Transition: wipe to the next shot, in the brand colour (a comment, not CSS).
  const p = easeOut(Math.min(1, lt / 0.8));
  return <div style={{ position: 'absolute', inset: 0, opacity: lerp(0, 1, p) }}><Kinetic text={s.slots.title} technique="maskUp" at={0.2} role="headline" fit={[12, 6, 3]} /></div>;
}`;
  const cleanIssues = await lintSceneCode(clean, ['title']);
  check('un commentaire « Transition: … » ne fait plus refuser un plan ; easeOut et lerp existent', cleanIssues.length === 0, JSON.stringify(cleanIssues));
  const css = clean.replace("opacity: lerp(0, 1, p) }}", "opacity: lerp(0, 1, p), transition: 'opacity 0.4s ease' }}");
  const cssIssues = await lintSceneCode(css, ['title']);
  check('une vraie transition CSS est refusée', cssIssues.some((i) => /transition/i.test(i)), JSON.stringify(cssIssues));
  const fixed = autoFixSceneCode(css);
  check('…et réparée sans tour de plus', fixed.fixes.includes('css-transition-removed') && (await lintSceneCode(fixed.code, ['title'])).length === 0);
  const alias = autoFixSceneCode(clean.replace('useLocalTime, ', 'useTime, ').replace('const lt = useLocalTime();', 'const lt = useTime();'));
  check('un nom voisin du kit (useTime) est rebranché', (await lintSceneCode(alias.code, ['title'])).length === 0 && alias.fixes.some((f) => f === 'alias:useTime'));

  // ── 6 ──
  section('6. Médias : disjoncteur et requêtes de banque');
  check('402 reconnu comme un manque de crédits', isPaymentError(paymentError()) && isPaymentError({ response: { status: 402 } }) && !isPaymentError(new Error('timeout')));
  check('requête de banque ancrée sur le personnage voulu', stockQuery('entrepreneur writing notebook', 'young Black African man') === 'african entrepreneur writing notebook' && stockQuery('bakery bread', 'a woman in an apron') === 'bakery bread');
  clipMode = 'payment';
  clipCalls = 0;
  imageCalls = 0;
  const blocked = await sourceShots({
    direction: { look: 'natural light', source: 'llm', shots: [0, 1, 2].map((i) => ({ scene: i, sceneId: 'footage', kind: 'video' as const, slot: 0, texts: [], shot: 'a man writes in a notebook', query: 'man notebook' })) },
    orientation: 'landscape',
    storage: { uploadFile: async (_c: Buffer | string, n: string) => ({ downloadURL: `file:///tmp/${n}` }) } as any,
    folder: 'test',
    allowGenerate: true,
    allowStock: false,
    clipQuality: 'quality',
    visualPhotos: [],
  });
  // Trois plans partent en même temps : une seule vague d'essais, puis plus rien (avant : 3 essais × 2 médias × 3 plans).
  check(`fournisseur sans crédit : ${imageCalls} essais d’image et ${clipCalls} de clip (une vague) au lieu de 18, génération coupée pour la vidéo`, imageCalls <= 3 && clipCalls <= 3 && blocked.report.blocked === 'payment', JSON.stringify({ imageCalls, clipCalls, report: blocked.report }));
  clipMode = 'ok';

  // ── 7 ──
  section('7. Bout en bout : le script réel, cran Low (aucun modèle)');
  const screens = [await screenshot('bp', 'Business plan', '#1447e6'), await screenshot('finance', 'Prévisions financières', '#0f141b'), await screenshot('site', 'The AI that builds businesses', '#000060')];
  const brandMedia = [
    { url: screens[0], kind: 'screen' as const, note: 'screenshot: business plan document cover page in the IDEM editor' },
    { url: screens[1], kind: 'screen' as const, note: 'screenshot: financial forecasts dashboard with revenue chart' },
    { url: screens[2], kind: 'screen' as const, note: 'screenshot: website homepage hero, the AI that builds profitable businesses' },
  ];
  const store = new MemoryStore(brandMedia);
  const service = new MotionVideoService(store, undefined, undefined, () => undefined, undefined);
  const brief = { message: RAW.slice(0, 400), request: RAW, musicMood: 'none', sfx: false, voice: false, allowStock: false, allowGenerate: true } as any;
  clipCalls = 0;
  const low = await service.createVideo('u', 'idem', { brief, scope: { durationSec: 60, formats: ['landscape'], quality: 'standard' }, creativity: 'low', language: 'en' }, 0);
  const lowTexts = normText(low.storyboard.scenes.flatMap((sc) => slotTexts(sc.sceneId, sc.slots)).join(' '));
  fs.writeFileSync(path.join(OUT, 'low.json'), JSON.stringify(low, null, 1));
  check(`vidéo en français malgré une page et une marque en anglais (${low.brief.language})`, low.brief.language === 'fr' && low.brief.spec?.language === 'fr');
  check('la demande gardée en entier avec la vidéo', (low.brief.request || '').length === RAW.trim().length);
  check('les six scènes, dans l’ordre', JSON.stringify([...new Set(low.storyboard.scenes.map((sc) => sc.script?.scene))]) === JSON.stringify([0, 1, 2, 3, 4, 5]), JSON.stringify(low.storyboard.scenes.map((sc) => sc.script)));
  check('tous les textes, mot pour mot ; aucun texte ajouté', EXPECTED.filter((t) => t !== 'IDEM').every((t) => lowTexts.includes(normText(t))) && low.storyboard.fidelity?.texts.added.length === 0 && low.storyboard.fidelity?.texts.missing.length === 0, JSON.stringify(low.storyboard.fidelity?.texts));
  check(`plans filmés : clips générés (${clipCalls} appels) et posés sur leurs plans`, low.storyboard.scenes.filter((sc) => sc.script?.medium === 'footage').every((sc) => !!sc.video) && (low.storyboard.fidelity?.footage.generated || 0) >= 2, JSON.stringify(low.storyboard.fidelity?.footage));
  check('interfaces : les captures de la marque à l’écran', low.storyboard.scenes.filter((sc) => sc.sceneId === 'screen').some((sc) => screens.includes(sc.image || '')));
  check('minutage du scénario tenu (écart ≤ 0,05 s)', (low.storyboard.fidelity?.drift ?? 9) <= 0.05, String(low.storyboard.fidelity?.drift));
  check('4K et 24 i/s dits à l’utilisateur', (low.storyboard.fidelity?.codes || []).some((c) => c.key === 'fidelity.4k') && (low.storyboard.fidelity?.codes || []).some((c) => c.key === 'fidelity.fps'));
  check(`titre : « ${low.title} »`, low.title === 'Vidéo officielle de lancement d’IDEM');

  // Le rendu réel : une image au milieu de quelques plans.
  {
    const theme = buildVideoTheme((await store.loadBrand()).branding, 'IDEM');
    const assets = await inlineAssets(low.storyboard, theme, 'render');
    const { html, spec: frame } = await composeVideoHtml({ ...assets, format: 'landscape', quality: 'standard', mode: 'render' });
    const pick = (pred: (sc: VideoStoryboard['scenes'][number]) => boolean) => low.storyboard.scenes.find(pred);
    const wanted = [
      ['filmé', pick((sc) => sc.sceneId === 'footage' && !!sc.video)],
      ['interface (capture)', pick((sc) => sc.sceneId === 'screen' && !!sc.image)],
      ['interface (dossier)', pick((sc) => sc.sceneId === 'screen' && !sc.image && !!sc.props?.length)],
      ['phrase', pick((sc) => sc.sceneId === 'statement')],
      ['signature', pick((sc) => sc.sceneId === 'logo')],
    ].filter((x): x is [string, VideoStoryboard['scenes'][number]] => !!x[1]);
    const shotsOut = await withRenderPage({ html, width: frame.width, height: frame.height, strict: true }, async (page) => {
      const out: { label: string; png: Buffer; media: number; text: string }[] = [];
      for (const [label, sc] of wanted) {
        const t = sc.start + sc.duration * 0.6;
        await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
        const probe = await page.evaluate((key: string, w: number, h: number) => {
          const section = Array.from(document.querySelectorAll('section.scene')).find((s) => getComputedStyle(s).visibility !== 'hidden' && (s as HTMLElement).dataset.scene) as HTMLElement | undefined;
          let best = 0;
          for (const el of Array.from(section?.querySelectorAll<HTMLElement>('img, video, canvas') || [])) {
            const r = el.getBoundingClientRect();
            const wv = Math.max(0, Math.min(w, r.right) - Math.max(0, r.left));
            const hv = Math.max(0, Math.min(h, r.bottom) - Math.max(0, r.top));
            best = Math.max(best, (wv * hv) / (w * h));
          }
          return { media: best, text: (section?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160), key };
        }, sc.key, frame.width, frame.height);
        out.push({ label, png: Buffer.from(await page.screenshot({ type: 'png' })), media: probe.media, text: probe.text });
      }
      return out;
    });
    const dir = path.join(OUT, 'frames-low');
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, f] of shotsOut.entries()) fs.writeFileSync(path.join(dir, `${i + 1}-${f.label.replace(/[^a-z]+/gi, '-')}.png`), f.png);
    const v = await Promise.all(shotsOut.map((f) => variance(f.png)));
    check(`rendu réel : ${shotsOut.length} plans photographiés, aucun aplat vide`, shotsOut.length >= 4 && v.every((x) => x > 6), v.map((x) => x.toFixed(1)).join(', '));
    const filmedFrame = shotsOut.find((f) => f.label === 'filmé');
    check('le clip filmé occupe le cadre', !!filmedFrame && filmedFrame.media > 0.3, String(filmedFrame?.media));
    const screenFrame = shotsOut.find((f) => f.label === 'interface (capture)');
    check('la capture du produit se voit dans sa fenêtre', !!screenFrame && screenFrame.media > 0.2, String(screenFrame?.media));
    const folderFrame = shotsOut.find((f) => f.label === 'interface (dossier)');
    check('le dossier « MON BUSINESS » et ses fichiers sont écrits dans l’interface', !folderFrame || (/MON BUSINESS/.test(folderFrame.text) && /BUSINESS PLAN/.test(folderFrame.text)), folderFrame?.text);
    const signFrame = shotsOut.find((f) => f.label === 'signature');
    check('la signature affiche son adresse', !!signFrame && /idem\.africa/.test(signFrame.text), signFrame?.text);
    console.log(`    images : ${dir}`);
  }

  // Une demande courte, sans scénario, qui décrit une personne en action : le bon outil est un plan filmé.
  check('demande sans scénario : « un jeune entrepreneur qui travaille » appelle un plan filmé, « nos clients adorent » non', describesFilmedAction('Une vidéo avec un jeune entrepreneur africain qui travaille sur son ordinateur') && !describesFilmedAction('Soldes : -30 % sur tous nos pagnes, nos clients adorent'));
  clipCalls = 0;
  const short = await service.createVideo('u', 'idem', { brief: { message: 'Une vidéo pour IDEM avec un jeune entrepreneur africain qui travaille sur son ordinateur, le soir', musicMood: 'none', sfx: false, voice: false, allowStock: false, allowGenerate: true } as any, scope: { durationSec: 15, formats: ['landscape'], quality: 'standard' }, creativity: 'low', language: 'en' }, 0);
  check(`…et l’obtient : ${short.storyboard.scenes.map((sc) => sc.sceneId).join(' › ')} (${clipCalls} clip généré)`, short.storyboard.scenes.some((sc) => sc.sceneId === 'footage' && !!sc.video) && short.brief.language === 'fr');

  // ── 8 ──
  section('8. Bout en bout : cran Ultra, directeur simulé, aucun codeur');
  store.director = DIRECTOR;
  clipCalls = 0;
  const ultra = await service.createVideo('u', 'idem', { brief, scope: { durationSec: 60, formats: ['landscape'], quality: 'standard' }, creativity: 'ultra', language: 'en' }, 0);
  const ultraTexts = ultra.storyboard.scenes.flatMap((sc) => slotTexts(sc.sceneId, sc.slots));
  const directorPrompt = store.prompts.find((p) => /SCRIPT — written by the client/.test(p)) || '';
  check('le directeur reçoit le scénario, ses textes, les captures décrites et les consignes', /SCENE 4 · 25\.0–45\.0 s/.test(directorPrompt) && /«Analyse\.»/.test(directorPrompt) && /financial forecasts dashboard/.test(directorPrompt) && /CLIENT FORBIDS/.test(directorPrompt) && /LANGUAGE OF THE FILM: French/.test(directorPrompt));
  check('film d’auteur créé (pas de repli sur les menus)', ultra.storyboard.concept === 'authored' && !!ultra.storyboard.authored);
  check('textes exacts, aucun inventé', EXPECTED.filter((t) => t !== 'IDEM').every((t) => ultraTexts.some((x) => normText(x) === normText(t)) || normText(ultraTexts.join(' ')).includes(normText(t))) && !ultraTexts.some((t) => /révolution/i.test(t)), JSON.stringify(ultraTexts));
  check(`plans filmés générés (${clipCalls} clips) ; interfaces sur les captures désignées`, ultra.storyboard.scenes.filter((sc) => sc.sceneId === 'footage').length >= 2 && ultra.storyboard.scenes.filter((sc) => sc.sceneId === 'footage').every((sc) => !!sc.video || !!sc.image) && ultra.storyboard.scenes.some((sc) => sc.sceneId === 'screen' && sc.image === screens[2]), JSON.stringify(ultra.storyboard.scenes.map((sc) => [sc.sceneId, !!sc.video, sc.image?.slice(-12)])));
  check('rapport de fidélité sans écart de texte', ultra.storyboard.fidelity?.texts.missing.length === 0 && ultra.storyboard.fidelity?.texts.added.length === 0, JSON.stringify(ultra.storyboard.fidelity));
  check('langue française partout', ultra.brief.language === 'fr');

  // ── 9 ──
  section('9. Voix off');
  check('une ligne en capitales se dit en casse de phrase', speakableCase('L’IDÉE NAÎT SEULE') === 'L’idée naît seule' && speakableCase('Tout commence') === 'Tout commence');
  const narratorInput = { sheet: '', brandName: 'IDEM', language: 'fr', brief: RAW, facts: extractFacts(RAW), style: 'premium' as const, scenes: [0, 1, 2].map(() => ({ sceneId: 'statement', duration: 5, texts: ['Tout commence par une idée.'] })), personas: [{ id: 'warm', gender: 'female' as const, character: 'warm', fits: [] }] };
  const narration = parseNarration('**Scène 1** : Une idée, et tout peut commencer.\nPlan 2 — Mais construire, c’est autre chose.\n[3] IDEM vous accompagne.\nvoice: a', narratorInput as any);
  check('réponse du narrateur en français (« Scène 1 », « Plan 2 — », « [3] ») comprise', !!narration && Object.keys(narration.lines).length === 3, JSON.stringify(narration?.lines));
  const report = checkFidelity(spec, { ...low.storyboard, scenes: low.storyboard.scenes.map((sc) => (sc.slots.title === 'Ton idée mérite de devenir un business.' ? { ...sc, slots: { title: 'Rejoignez-nous' } } : sc)) }, { brandName: 'IDEM', total: 60 });
  check('le contrôle de fidélité voit un texte remplacé', report.texts.missing.includes('Ton idée mérite de devenir un business.') && report.texts.added.includes('Rejoignez-nous'));
  const unfilmed = checkFidelity(spec, { ...low.storyboard, scenes: low.storyboard.scenes.map((sc) => (sc.script?.medium === 'footage' ? { ...sc, video: undefined, image: undefined } : sc)) }, { brandName: 'IDEM', total: 60, blocked: 'payment' });
  check('fournisseur sans crédit : la cause et chaque remplacement dits, sans « 0 » inutile', unfilmed.codes.some((c) => c.key === 'fidelity.footageBlocked.payment') && unfilmed.codes.some((c) => c.key === 'fidelity.footageMissing') && !unfilmed.codes.some((c) => c.key === 'fidelity.footageStock'), JSON.stringify(unfilmed.codes));

  await closeRenderBrowser();
  console.log(`\n${passes} vérifications réussies, ${failures} en échec · fichiers : ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await closeRenderBrowser().catch(() => undefined);
  process.exit(1);
});
