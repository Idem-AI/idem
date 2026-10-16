/**
 * `npm run check:request --prefix apps/ivision/core` — LA DEMANDE SUIVIE À LA LETTRE, sans IDEM.
 *
 * Le point de départ est un vrai script d'utilisateur (`fixtures/launch-script.fr.md`, 60 s, six
 * scènes, textes à l'écran, interdits). Ce contrôle prouve, avec le moteur Motion Canvas :
 *
 *   1. la lecture : langue, scènes, minutage, textes mot pour mot, textes d'interface, supports,
 *      périmètre (4K, 24 i/s signalés), consignes ;
 *   2. la langue de la DEMANDE, jamais celle de la page (cinq langues, consignes explicites) ;
 *   3. le storyboard tenu par le scénario : une scène par scène écrite, textes et voix de
 *      l'utilisateur repris mot pour mot (le planificateur ne décide que du visuel et du mouvement),
 *      scène oubliée rétablie, minutage du scénario ;
 *   4. les médias : disjoncteur sur un fournisseur sans crédit (402), banques ancrées sur le personnage ;
 *   5. une vidéo créée de bout en bout (modèles simulés) : français malgré une page anglaise, plans
 *      filmés générés et posés sur leurs scènes, captures de la marque, textes exacts, 4K signalé,
 *      chaque scène exécutée (vignettes réelles) ;
 *   6. la voix off : une ligne en capitales se dit en casse de phrase.
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
import type { VideoStore } from '../src/video/contracts/store';
import type { MotionVideo } from '../src/video/contracts/model';
import type { AgentCall } from '../src/creativity/orchestrator';
import { detectLanguage, resolveLanguage } from '../src/text/language';
import { describesFilmedAction, mergeReader, parseRequest, requestMessage, sceneTimeline, normText } from '../src/video/request/request';
import { isPaymentError, sourceShots, stockQuery } from '../src/video/assets/sourcing';
import { speakableCase } from '../src/video/audio/voice';
import { normalizeStoryboard } from '../src/video/director/storyboard.agent';
import { parseFilmPlan } from '../src/video/director/film-format';
import type { FilmBrief } from '../src/video/director/brief';
import { closeFilmBrowser } from '../src/video/rendering/runner';

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
}


/** Le storyboard d'un planificateur avec les fautes qu'un modèle fait vraiment : texte retouché, texte inventé, scène 5 oubliée. */
const PLANNER = [
  'TITLE: De l’idée au business',
  'CONCEPT: Un entrepreneur, son carnet, et l’idée qui devient une entreprise.',
  'BIBLE: Lumière naturelle ; des lignes bleues relient les gestes à l’interface.',
  'SCENE 1 | 8', 'purpose: l’idée naît', 'visual: le clip plein cadre, une ligne bleue monte de l’écriture', 'motion: travelling avant lent', 'text.headline: Tout commence par une idee', 'new clip: a young Black African entrepreneur writes an idea in a notebook in a modest modern workspace, slow push-in | entrepreneur writing notebook',
  'SCENE 2 | 10', 'purpose: la difficulté', 'visual: un dossier MON BUSINESS s’ouvre, ses fichiers se multiplient', 'motion: les fichiers tombent en cascade', 'text.headline: Avoir une idée, c’est facile.', 'text.extra: Rejoignez la révolution !',
  'SCENE 3 | 7', 'purpose: la promesse', 'visual: un point bleu trace une ligne qui révèle l’interface', 'motion: tracé continu', 'media: m3',
  'SCENE 4 | 20', 'purpose: le produit', 'visual: le business plan se construit à l’écran', 'motion: quatre mots en rafale', 'media: m1, m2',
  'SCENE 6 | 7', 'purpose: la signature', 'visual: le logo au centre', 'motion: une ligne bleue relie le logo', 'text.cta: https://idem.africa',
].join('\n');

/** L'auteur simulé : un programme correct pour chaque scène (ses textes dans une pile ; seule la chaîne compte ici). */
function AUTHOR(user: string): string {
  const scene = user.split('THIS SCENE')[1] || user;
  const keys = [...scene.matchAll(/\$(\w+) = "/g)].map((m) => m[1]);
  const program = { nodes: [{ id: 'words', type: 'stack', dir: 'column', gap: 2, children: keys.map((k, i) => ({ type: 'text', text: `$${k}`, size: i ? 4.6 : 8, width: 'SW' })) }], timeline: [{ at: 0.1, target: 'words', dur: 0.6, from: { opacity: 0 }, to: {} }] };
  return '```json\n' + JSON.stringify(program) + '\n```';
}
/** Une image de rendu : est-elle autre chose qu'un aplat ? */
async function variance(png: Buffer): Promise<number> {
  const stats = await sharp(png).stats();
  return stats.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
}

(async () => {
  console.log('La demande suivie à la lettre — moteur Motion Canvas, modèles simulés\n');

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
  section('3. Le storyboard tenu par le scénario');
  const brief: FilmBrief = { request: RAW, language: 'fr', spec, brandSheet: 'BRAND: IDEM', anonymous: false, format: 'landscape', durationSec: 60, media: [], voice: false, newMedia: { images: 6, clips: 4 }, previous: [], level: 'medium' };
  const timeline = sceneTimeline(spec, 60);
  const board = normalizeStoryboard(parseFilmPlan(PLANNER), brief, null, timeline);
  const boardTexts = board.scenes.flatMap((s) => Object.entries(s.texts).filter(([k]) => !k.startsWith('prop')).map(([, v]) => v));
  check('une scène par scène du scénario, dans l’ordre', board.scenes.length === 6, String(board.scenes.length));
  check('textes de l’utilisateur mot pour mot ; le texte retouché reprend sa forme, l’inventé disparaît', JSON.stringify(boardTexts) === JSON.stringify(EXPECTED), JSON.stringify(boardTexts));
  check('textes DANS l’interface gardés (dossier MON BUSINESS)', board.scenes[1].texts.prop1 === 'MON BUSINESS', JSON.stringify(board.scenes[1].texts));
  check('scène oubliée rétablie depuis la description, et c’est dit', !!board.scenes[4].visual && board.fidelity.some((n) => /Scène 5/.test(n)), JSON.stringify(board.fidelity));
  check('minutage du scénario tenu', board.scenes.every((s, k) => Math.abs(s.duration - timeline[k].duration) < 0.01) && Math.abs(board.scenes.reduce((a, s) => a + s.duration, 0) - 60) < 0.01);
  check('idées visuelles du planificateur gardées telles quelles', board.scenes[0].visual === 'le clip plein cadre, une ligne bleue monte de l’écriture' && board.scenes[0].needs[0]?.kind === 'video');

  // ── 4 ──
  section('4. Médias : disjoncteur et requêtes de banque');
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

  // ── 5 ──
  section('5. Bout en bout : le script réel (modèles simulés)');
  const screens = [await screenshot('bp', 'Business plan', '#1447e6'), await screenshot('finance', 'Prévisions financières', '#0f141b'), await screenshot('site', 'The AI that builds businesses', '#000060')];
  const brandMedia = [
    { url: screens[0], kind: 'screen' as const, note: 'screenshot: business plan document cover page in the IDEM editor' },
    { url: screens[1], kind: 'screen' as const, note: 'screenshot: financial forecasts dashboard with revenue chart' },
    { url: screens[2], kind: 'screen' as const, note: 'screenshot: website homepage hero, the AI that builds profitable businesses' },
  ];
  const store = new MemoryStore(brandMedia);
  const prompts: Record<string, string> = {};
  const call: AgentCall = async ({ role, system, user }) => {
    prompts[role] = `${system}\n${user}`;
    if (role === 'video.planner') return PLANNER;
    if (role === 'video.author') return AUTHOR(user);
    return '';
  };
  const service = new MotionVideoService(store, call);
  clipCalls = 0;
  const video = await service.createVideo('u', 'idem', { brief: { message: RAW.slice(0, 400), request: RAW, musicMood: 'none', sfx: false, voice: false, allowStock: false, allowGenerate: true } as any, scope: { durationSec: 60, formats: ['landscape'], quality: 'standard' }, creativity: 'low', language: 'en' }, 0);
  fs.writeFileSync(path.join(OUT, 'video.json'), JSON.stringify(video, null, 1));
  const film = video.film!;
  const filmTexts = film.scenes.flatMap((s) => Object.entries(s.texts).filter(([k]) => !k.startsWith('prop')).map(([, v]) => v));
  check(`vidéo en français malgré une page et une marque en anglais (${video.brief.language})`, video.brief.language === 'fr' && film.language === 'fr');
  check('la demande gardée en entier avec la vidéo', (video.brief.request || '').length === RAW.trim().length);
  check('le planificateur reçoit le scénario, ses textes fixes, les captures décrites et les interdits', /CLIENT SCRIPT/.test(prompts['video.planner'] || '') && /« L’IDÉE »|SCENE 4/.test(prompts['video.planner'] || '') && /financial forecasts dashboard/.test(prompts['video.planner'] || '') && /CLIENT FORBIDS/.test(prompts['video.planner'] || ''));
  check('six scènes, textes exacts, aucun inventé', film.scenes.length === 6 && JSON.stringify(filmTexts) === JSON.stringify(EXPECTED), JSON.stringify(filmTexts));
  const clipScene = film.scenes[0].media.map((id) => video.media?.find((m) => m.id === id)).find((m) => m?.kind === 'video');
  check(`plan filmé généré (${clipCalls} appel(s)) et posé sur sa scène`, !!clipScene && clipScene.origin === 'generated', JSON.stringify(film.scenes[0].media));
  check('captures de la marque sur les scènes qui les citent', film.scenes[3].media.some((id) => video.media?.find((m) => m.id === id)?.url === screens[0]) && film.scenes[2].media.some((id) => video.media?.find((m) => m.id === id)?.url === screens[2]));
  check('4K et 24 i/s dits à l’utilisateur', (film.fidelity?.notes || []).some((n) => /4K/.test(n)) && (film.fidelity?.notes || []).some((n) => /24/.test(n)), JSON.stringify(film.fidelity?.notes));
  check('l’auteur reçoit les textes exacts de sa scène, par clé', /\$headline = "Tout commence par une idée\."/.test(prompts['video.author'] || '') || film.scenes.every((s) => s.status === 'ready'));
  const thumbs = film.scenes.filter((s) => s.thumbnail);
  const v = await Promise.all(thumbs.map(async (s) => variance(fs.readFileSync(s.thumbnail!.replace('file://', '')))));
  check(`chaque scène exécutée par Motion Canvas : ${thumbs.length} vignettes, aucun aplat vide`, thumbs.length === 6 && film.scenes.every((s) => s.status === 'ready') && v.every((x) => x > 4), v.map((x) => x.toFixed(1)).join(', '));
  check('demande sans scénario : « un jeune entrepreneur qui travaille » appelle un plan filmé, « nos clients adorent » non', describesFilmedAction('Une vidéo avec un jeune entrepreneur africain qui travaille sur son ordinateur') && !describesFilmedAction('Soldes : -30 % sur tous nos pagnes, nos clients adorent'));

  // ── 6 ──
  section('6. Voix off');
  check('une ligne en capitales se dit en casse de phrase', speakableCase('L’IDÉE NAÎT SEULE') === 'L’idée naît seule' && speakableCase('Tout commence') === 'Tout commence');

  await closeFilmBrowser();
  console.log(`\n${passes} vérifications réussies, ${failures} en échec · fichiers : ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await closeFilmBrowser().catch(() => undefined);
  process.exit(1);
});
