/**
 * `npm run check:video:novelty` — le moteur créatif : de la variété par exclusion à la créativité
 * par recherche dans l'espace des motifs. Aucun modèle, aucune base, aucun rendu :
 *
 *  1. Couche des motifs : chaque motif se résout en briques qui existent (mises en page, techniques,
 *     fonds, annotations, kit du codeur) ; chaque intention et chaque scène ont du choix.
 *  2. Empreinte créative : déterministe, distance 0 à soi-même, symétrique, bornée, calculée aussi
 *     sur une vidéo ancienne (sans motif enregistré).
 *  3. Planificateur : exploration qui croît avec le cran, trois directions créatives distinctes, un
 *     accent unique hors de l'ADN (25 % du film au plus), menus de 3 à 5 motifs.
 *  4. Le vrai pipeline (service, agents simulés) : 10 vidéos d'une même marque et d'un même brief à
 *     chaque cran, puis 8 dans une direction IMPOSÉE — aucune n'est « trop proche » (< 0,30) d'une
 *     vidéo précédente ; au cran High l'agent choisit dans les motifs, au cran Max la direction.
 *  5. Contrôle créatif : une copie conforme d'une vidéo récente est détectée et écartée au-delà du seuil.
 *  6. Mémoire d'expérience : la qualité apprise bouge dans ses bornes, l'export fait monter un nœud.
 *  7. Cran Ultra : univers créatif compact, motifs et explorations lus dans le film, manifeste du kit
 *     restreint au motif du plan, validation renforcée des plans qui explorent.
 *  8. Budget : menus des agents et prompts au même ordre de grandeur qu'avant.
 */
process.env.VIDEO_MUSIC_OPENVERSE = 'off';
process.env.VIDEO_MUSIC_CCMIXTER = 'off';
delete process.env.JAMENDO_CLIENT_ID;
delete process.env.FREESOUND_API_KEY;
delete process.env.PEXELS_API_KEY;
process.env.VIDEO_SFX_OFFLINE = '1';
import { IdemVideoStore } from '../services/Communication/video/idemVideoStore';
import { MotionVideo, VideoStoryboard } from '../models/motionVideo.model';
import { CreativityLevel } from '../models/creativity.model';
import { MotionVideoService } from '../../../ivision/core/src/video/motionVideo.service';
import { KIT_MANIFEST, KIT_NAMES, scopedKitManifest } from '../../../ivision/core/src/video/video.coder';
import { LAYOUT_IDS, LAYOUT_SCENES } from '../../../ivision/core/src/video/video.layouts';
import { DIRECTION_IDS, DirectionId } from '../../../ivision/core/src/video/video.direction';
import { capabilitiesForIntent, INTENTS, IntentId, PATTERN_BY_ID, patternIssues, PATTERNS, scenePatterns } from '../../../ivision/core/src/video/video.patterns';
import { fingerprintDistance, fingerprintOf, SIMILARITY, verdictOf } from '../../../ivision/core/src/video/video.fingerprint';
import { briefCreative, creativeUniverse, EXPLORATION_BUDGET, PatternScene, planPatterns, projectMemory, strategyMenu } from '../../../ivision/core/src/video/video.planner';
import { creativeLint } from '../../../ivision/core/src/video/video.creativeLint';
import { ExperienceMemory, MemoryExperienceBackend } from '../../../ivision/core/src/video/video.experience';
import { buildDirectorPrompt, DirectorInput, isExploratoryShot, parseFilm, shotKit } from '../../../ivision/core/src/video/video.author';
import { buildArtDirectorPrompt, ArtDirectorScene } from '../../../ivision/core/src/video/video.agents';
import { estimateTokens, extractFacts } from '../../../ivision/core/src/video/video.copy';
import { buildStoryboard } from '../../../ivision/core/src/video/video.storyboard';
import { BRANDS } from './fixtures/motion-video/brands';
import { CASES, simulateAgent, simulateModel } from './fixtures/motion-video/cases';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
const LEVELS: CreativityLevel[] = ['low', 'medium', 'high', 'max', 'ultra'];

/** Le module Communication, en mémoire (comme dans check:video). */
class FakeCommunication {
  projects = new Map<string, any>();
  constructor() {
    for (const brand of BRANDS) {
      this.projects.set(brand.id, { id: brand.id, name: brand.name, type: brand.type, description: brand.description, analysisResultModel: { branding: brand.branding, communication: { context: brand.context, videos: [], visuals: [] } } });
    }
  }
  reset(id: string) {
    this.projects.get(id).analysisResultModel.communication.videos = [];
  }
  async loadProjectForVideo(_u: string, projectId: string) {
    return this.projects.get(projectId) || null;
  }
  async listVideos(_u: string, projectId: string): Promise<MotionVideo[]> {
    return JSON.parse(JSON.stringify(this.projects.get(projectId)?.analysisResultModel.communication.videos || []));
  }
  async saveVideo(_u: string, projectId: string, video: MotionVideo) {
    const comm = this.projects.get(projectId).analysisResultModel.communication;
    comm.videos = [...comm.videos.filter((v: MotionVideo) => v.id !== video.id), JSON.parse(JSON.stringify(video))];
  }
  async mutateVideo(_u: string, projectId: string, videoId: string, mutate: (v: MotionVideo) => MotionVideo) {
    const comm = this.projects.get(projectId).analysisResultModel.communication;
    let out: MotionVideo | null = null;
    comm.videos = comm.videos.map((v: MotionVideo) => (v.id === videoId ? (out = mutate(v)) : v));
    return out;
  }
  async findPlanItem() {
    return null;
  }
  async linkVideoToContent() {}
}

const sampleStoryboard = (seed: number, direction: DirectionId = 'swiss'): VideoStoryboard =>
  withLayouts(buildStoryboard({
    sceneIds: ['hook', 'statement', 'benefits', 'stat', 'cta', 'logo'],
    slots: [{ title: 'Vos pagnes à prix doux' }, { title: 'Le wax qui raconte votre histoire', sub: 'Fait main à Abidjan' }, { title: 'Pourquoi nous', b1: 'Livraison 24h', b2: 'Mobile Money', b3: 'Retour gratuit' }, { value: '98 %', label: 'de clientes satisfaites' }, { title: 'Commandez maintenant', action: 'Sur WhatsApp' }, { tagline: 'Wax & Co' }],
    durationSec: 15,
    style: 'premium',
    seed,
    images: [],
    direction,
    rhythm: 'crescendo',
    concept: 'reasons',
  }));

/** Un storyboard « livré » : mises en page et kit (caméra, entrées) comme le pipeline les pose. */
function withLayouts(sb: VideoStoryboard): VideoStoryboard {
  const layouts: Record<string, string> = { hook: 'classic', statement: 'splitBlock', benefits: 'gridCards', stat: 'bigNumber', cta: 'wordStack' };
  sb.scenes.forEach((sc) => layouts[sc.sceneId] && (sc.layout = layouts[sc.sceneId]));
  sb.kit = { background: 'none', backdropScenes: [], annotate: 'none', logo: 'wipe', iconSet: 'tabler', icons: {}, camera: 'still', entrance: 'slideLeft', postfx: [], addons: [], trace: [] };
  return sb;
}

(async () => {
  console.log('Moteur créatif : motifs, empreinte, planificateur, nouveauté\n');

  // ── 1 ──
  section('1. Couche des motifs (intention → capacité → motif → outil → primitive)');
  {
    const issues = patternIssues(KIT_NAMES);
    check(`${PATTERNS.length} motifs : chaque outil et chaque brique du kit existent`, issues.length === 0, issues.slice(0, 6).join(' ; '));
    const uncovered = LAYOUT_IDS.filter((id) => !PATTERNS.some((p) => p.tools.layout === id));
    check('chaque mise en page du moteur est portée par au moins un motif', uncovered.length === 0, uncovered.join(', '));
    const poor: string[] = [];
    for (const d of DIRECTION_IDS) for (const sceneId of LAYOUT_SCENES) {
      const slots: Record<string, string> = { title: 'Une promesse forte et claire', sub: 'Un détail', b1: 'Un', b2: 'Deux', b3: 'Trois', value: '87 %', label: 'de clients', price: '15 000 F', oldPrice: '21 500 F', quote: 'Le meilleur', author: 'Awa', action: 'Commander', date: '12 mai', place: 'Dakar', name: 'Pagne' };
      if (scenePatterns({ sceneId, slots }, { direction: d }).length < 2) poor.push(`${d}/${sceneId}`);
    }
    check('chaque scène de contenu a au moins deux motifs dans chaque direction', poor.length === 0, poor.slice(0, 8).join(' '));
    const intents = Object.keys(INTENTS) as IntentId[];
    check(`${intents.length} intentions, chacune servie par des capacités`, intents.every((i) => capabilitiesForIntent(i).length >= 1), intents.filter((i) => !capabilitiesForIntent(i).length).join(','));
    console.log(`      « croissance » → ${capabilitiesForIntent('growth').join(', ')} → ${PATTERNS.filter((p) => p.intents.includes('growth')).map((p) => p.id).join(', ')}`);
  }

  // ── 2 ──
  section('2. Empreinte créative');
  {
    const a = sampleStoryboard(11);
    const b = sampleStoryboard(11);
    const c = sampleStoryboard(977, 'cinematic');
    const fa = fingerprintOf(a);
    check('déterministe (même storyboard → même empreinte)', JSON.stringify(fa) === JSON.stringify(fingerprintOf(b)));
    check('distance 0 à soi-même', fingerprintDistance(fa, fa).distance === 0);
    const ac = fingerprintDistance(fa, fingerprintOf(c)).distance;
    const ca = fingerprintDistance(fingerprintOf(c), fa).distance;
    check(`symétrique et bornée (swiss ↔ cinématique : ${ac})`, ac === ca && ac > 0 && ac <= 1);
    check('vidéo ancienne (sans motif enregistré) : motifs déduits de ce qu’elle montre', fa.patterns.filter((p) => !p.startsWith('scene:')).length >= 5 && fa.patterns.includes('counterAcceleration') && fa.patterns.includes('logoWipe'), fa.patterns.join(','));
    check('seuils : < 0,30 trop proche, > 0,55 réellement différente', verdictOf(0.2) === 'too-close' && verdictOf(0.4) === 'acceptable' && verdictOf(0.7) === 'distinct' && verdictOf(null) === 'first');
  }

  // ── 3 ──
  section('3. Planificateur créatif');
  {
    const budgets = LEVELS.map((l) => EXPLORATION_BUDGET[l]);
    check(`exploration qui croît avec le cran (${budgets.join(' → ')})`, budgets.every((b, i) => i === 0 || b > budgets[i - 1]) && budgets[0] <= 0.05 && budgets[4] >= 0.7);
    const facts = extractFacts('Pagne wax à 15 000 FCFA au lieu de 21 500 FCFA, 98 % de clientes satisfaites, livraison à Abidjan');
    const mem = projectMemory([]);
    const scenes: PatternScene[] = [{ sceneId: 'hook', slots: { title: 'Vos pagnes à prix doux, enfin' } }, { sceneId: 'statement', slots: { title: 'Le wax qui raconte votre histoire', sub: 'Fait main' } }, { sceneId: 'stat', slots: { value: '98 %', label: 'de clientes satisfaites' } }, { sceneId: 'benefits', slots: { title: 'Pourquoi nous', b1: 'Livraison 24h', b2: 'Mobile Money', b3: 'Retour gratuit' } }, { sceneId: 'cta', slots: { title: 'Commandez dès aujourd’hui', action: 'Sur WhatsApp' } }, { sceneId: 'logo', slots: {} }];
    let accentOk = 0;
    let menusOk = 0;
    let distinctStrategies = 0;
    const exp: Record<string, number> = {};
    for (const level of LEVELS) {
      for (const d of DIRECTION_IDS) {
        for (let k = 0; k < 4; k++) {
          const seed = 101 + k * 7919;
          const brief = briefCreative({ level, direction: d, facts, photos: 0, durationSec: 15, memory: mem, seed });
          if (new Set(brief.strategies.map((s) => `${s.families.join('+')}|${s.accentFamily}`)).size >= 2) distinctStrategies++;
          const plan = planPatterns(brief, scenes, { concept: 'reasons', accentIndex: 2, seed });
          const a = plan.accent;
          if (!a || (!brief.strategy.families.includes(a.family) && a.index > 0 && a.index < scenes.length - 1)) accentOk++;
          if (plan.scenes.filter((s) => s.pattern).every((s) => s.options.length >= 1 && s.options[0] === s.pattern && s.options.length <= 5)) menusOk++;
          exp[level] = (exp[level] || 0) + plan.experimental / Math.max(1, plan.considered);
        }
      }
    }
    const runs = DIRECTION_IDS.length * 4;
    check(`directions créatives distinctes (${distinctStrategies}/${runs * LEVELS.length})`, distinctStrategies >= runs * LEVELS.length * 0.9);
    check(`accent : hors de l'ADN, ni ouverture ni signature (${accentOk}/${runs * LEVELS.length})`, accentOk === runs * LEVELS.length);
    check(`menus des agents : le choix du graphe d'abord, 5 motifs au plus (${menusOk}/${runs * LEVELS.length})`, menusOk === runs * LEVELS.length);
    const shares = LEVELS.map((l) => Math.round((exp[l] / runs) * 100));
    check(
      `part réellement explorée qui suit le cran (${shares.map((s, i) => `${LEVELS[i]} ${s} %`).join(' · ')} ; visé ${LEVELS.map((l) => `${Math.round(EXPLORATION_BUDGET[l] * 100)} %`).join(' · ')})`,
      // Dans les menus, l'exploration est plafonnée par les combinaisons compatibles disponibles ; en Ultra,
      // le directeur explore lui-même (univers créatif, « explore A+B ») avec ce budget.
      shares[0] <= 5 && shares.every((x, i) => i === 0 || x >= shares[i - 1]) && shares[3] >= 25 && shares[4] >= 35
    );
    console.log(`      menu Max : ${strategyMenu(briefCreative({ level: 'max', direction: 'swiss', facts, photos: 0, durationSec: 15, memory: mem, seed: 5 })).join(' / ')}`);
  }

  // ── 4 ──
  section('4. Le vrai pipeline : 10 vidéos d’une même marque, même brief, à chaque cran');
  const fake = new FakeCommunication();
  const memoryBackend = new MemoryExperienceBackend();
  const experience = new ExperienceMemory(memoryBackend, 0);
  const base = CASES.find((c) => c.id === 'wax-soldes-story')!;
  const service = new MotionVideoService(new IdemVideoStore(fake as any), () => (system, user) => simulateModel(base)(system, user), () => (system, user) => simulateAgent('clean', system, user), () => undefined, undefined, experience);
  const brief = { ...base.brief, musicMood: 'none' as const, sfx: false, allowStock: false, allowGenerate: false };
  const scope = { durationSec: 15, formats: ['story' as const], quality: 'standard' as const };
  const series = async (level: CreativityLevel, n: number, direction?: DirectionId) => {
    fake.reset('wax');
    const out: MotionVideo[] = [];
    for (let i = 0; i < n; i++) out.push(await service.createVideo('u', 'wax', { brief: { ...brief, ...(direction ? { direction } : {}) }, scope, creativity: level }, 0));
    return out;
  };
  const summarize = (videos: MotionVideo[]) => {
    const near = videos.slice(1).map((v) => v.storyboard.creative?.novelty?.nearest ?? 0);
    const pairwise: number[] = [];
    for (let i = 0; i < videos.length; i++) for (let j = i + 1; j < videos.length; j++) pairwise.push(fingerprintDistance(videos[i].storyboard.creative!.fingerprint!, videos[j].storyboard.creative!.fingerprint!).distance);
    const mean = pairwise.reduce((s, x) => s + x, 0) / pairwise.length;
    return { near, min: Math.min(...near), mean: Math.round(mean * 1000) / 1000, closeRepaired: videos.filter((v) => (v.storyboard.creative?.lint?.repaired || []).some((r) => r.startsWith('écart'))).length };
  };
  for (const level of ['low', 'medium', 'high', 'max'] as CreativityLevel[]) {
    const videos = await series(level, 10);
    const s = summarize(videos);
    const every = videos.every((v) => v.storyboard.creative?.fingerprint && v.storyboard.creative.dna.families.length && v.storyboard.scenes.some((sc) => sc.pattern));
    check(`[${level}] chaque vidéo a son rapport créatif (ADN, motifs, empreinte)`, every);
    check(`[${level}] aucune vidéo trop proche d’une précédente : écart min ${s.min}, moyen ${s.mean} (${s.closeRepaired} écartée(s) par le contrôle)`, s.min >= SIMILARITY.tooClose, s.near.join(' '));
    const accents = videos.filter((v) => v.storyboard.creative?.accent).length;
    const families = new Set(videos.flatMap((v) => v.storyboard.creative!.dna.families));
    console.log(`      accents posés ${accents}/10 · familles d’ADN ${[...families].join(', ')} · motifs ${new Set(videos.flatMap((v) => v.storyboard.scenes.map((sc) => sc.pattern).filter(Boolean))).size} distincts`);
    if (level === 'high') {
      const v = videos[0];
      const picked = v.storyboard.scenes.filter((sc) => sc.pattern && PATTERN_BY_ID.get(sc.pattern)?.role === 'scene').length;
      check(`[high] le directeur artistique choisit dans les motifs (${picked} scène(s) à motif)`, (v.storyboard.agents || []).some((a) => a.agent === 'artDirector' && a.source === 'llm') && picked >= 2);
    }
    if (level === 'max') check('[max] la direction créative est choisie par l’IA parmi trois', videos.every((v) => v.storyboard.creative?.strategy?.source === 'llm' && v.storyboard.creative.strategy.id === 'b'), videos.map((v) => v.storyboard.creative?.strategy?.id).join(''));
  }
  {
    const videos = await series('medium', 8, 'swiss');
    const s = summarize(videos);
    check(`direction imposée (swiss × 8, cas le plus dur) : écart min ${s.min}, moyen ${s.mean} (${s.closeRepaired} écartée(s))`, s.min >= SIMILARITY.tooClose, s.near.join(' '));
  }

  // ── 5 ──
  section('5. Contrôle créatif');
  {
    const previous = sampleStoryboard(42);
    const twin = sampleStoryboard(42);
    const memory = projectMemory([{ storyboard: previous }]);
    const report = creativeLint(twin, {
      direction: 'swiss',
      memory,
      transitions: ['cut', 'push', 'wipe', 'blockStack', 'slideOver', 'split', 'iris'],
      layoutsFor: (i) => ({ hook: ['diagonalBand', 'ticker', 'classic'], statement: ['frameOverlap', 'circleStage', 'classic'], benefits: ['checklist', 'layeredCards', 'classic'], stat: ['circleStage', 'classic'], cta: ['diagonalBand', 'ticker', 'classic'] } as Record<string, string[]>)[twin.scenes[i].sceneId] || [],
      cameras: ['still', 'push', 'drift'],
      entrances: ['rise', 'slideLeft', 'unfold'],
      repair: true,
    });
    const after = fingerprintDistance(report.fingerprint, memory.fingerprints[0]).distance;
    check(`copie conforme d’une vidéo récente détectée (distance 0) puis écartée (→ ${after})`, report.issues.some((i) => i.startsWith('trop proche')) && after >= SIMILARITY.tooClose, report.repaired.join(' | '));
    const softBefore = sampleStoryboard(7, 'cinematic');
    const a = softBefore.scenes.findIndex((sc) => sc.sceneId === 'stat');
    softBefore.scenes[a].accent = 'hold';
    softBefore.scenes[a].motion = { ...softBefore.scenes[a].motion!, transition: 'dissolve' };
    const r2 = creativeLint(softBefore, { direction: 'cinematic', memory: projectMemory([]), transitions: ['dissolve', 'zoomThrough', 'cut', 'iris'], repair: true });
    check('coupe douce avant le grand moment : remplacée par une coupe forte du menu', r2.repaired.some((x) => x.includes('grand moment')), r2.repaired.join(' | '));
  }

  // ── 6 ──
  section('6. Mémoire d’expérience (globale)');
  {
    const mem = new ExperienceMemory(new MemoryExperienceBackend(), 0);
    const prior = 0.8;
    const fresh = mem.quality('ringSweep', 'swiss', prior).value;
    for (let i = 0; i < 40; i++) await mem.record({ level: 'high', direction: 'swiss', patterns: [{ pattern: 'ringSweep', direction: 'swiss', experimental: false, kept: false }], nodes: ['logo:morph'], tokens: { input: 0, output: 0 } });
    const bad = mem.quality('ringSweep', 'swiss', prior).value;
    for (let i = 0; i < 40; i++) await mem.record({ level: 'high', direction: 'swiss', patterns: [{ pattern: 'gaugeFill', direction: 'swiss', experimental: false, kept: true }], nodes: ['logo:draw'], tokens: { input: 0, output: 0 } });
    for (let i = 0; i < 30; i++) await mem.recordExport(['gaugeFill'], ['logo:draw'], 'swiss');
    const good = mem.quality('gaugeFill', 'swiss', prior).value;
    check(`a priori sans observation (${fresh}), échecs répétés → qualité bornée (${bad.toFixed(2)} ≥ ${prior - 0.25})`, fresh === prior && bad < prior && bad >= prior - 0.25 - 1e-9);
    check(`motif retenu et exporté → qualité en hausse, bornée (${good.toFixed(2)} ≤ ${prior + 0.25})`, good > prior && good <= prior + 0.25 + 1e-9);
    check(`nœud des vidéos exportées au-dessus de la moyenne (logo:draw ${mem.nodeDelta('logo:draw').toFixed(2)} > logo:morph ${mem.nodeDelta('logo:morph').toFixed(2)})`, mem.nodeDelta('logo:draw') > 0 && mem.nodeDelta('logo:morph') < 0 && Math.abs(mem.nodeDelta('logo:draw')) <= 0.4);
    const facts = extractFacts('98 % de clientes satisfaites');
    const scenes: PatternScene[] = [{ sceneId: 'hook', slots: { title: 'Vos clientes le disent' } }, { sceneId: 'stat', slots: { value: '98 %', label: 'de clientes satisfaites' } }, { sceneId: 'logo', slots: {} }];
    // En direction « précision », l'anneau (3) est plus affin que la jauge (2) : sans mémoire il passe devant.
    for (let i = 0; i < 40; i++) await mem.record({ level: 'high', direction: 'precision', patterns: [{ pattern: 'ringSweep', direction: 'precision', experimental: false, kept: false }, { pattern: 'gaugeFill', direction: 'precision', experimental: false, kept: true }], nodes: [], tokens: { input: 0, output: 0 } });
    const pick = (m?: ExperienceMemory) => planPatterns(briefCreative({ level: 'medium', direction: 'precision', facts, photos: 0, durationSec: 15, memory: projectMemory([]), experience: m, seed: 3 }), scenes, { seed: 3 }).scenes[1].scored;
    const rank = (list: { id: string }[], id: string) => {
      const at = list.findIndex((s) => s.id === id);
      return at < 0 ? Infinity : at;
    };
    const naive = pick();
    const learned = pick(mem);
    check(
      `le planificateur suit l’expérience : sans mémoire l’anneau devant la jauge, avec elle la jauge devant (${learned.map((s) => `${s.id}:${s.score}`).join(' ')})`,
      rank(naive, 'ringSweep') < rank(naive, 'gaugeFill') && rank(learned, 'gaugeFill') < rank(learned, 'ringSweep')
    );
  }

  // ── 7 ──
  section('7. Cran Ultra : univers créatif, motifs par plan, manifeste restreint');
  {
    const facts = extractFacts('Pagne wax à 15 000 FCFA, livraison à Abidjan et Dakar, 98 % de clientes satisfaites');
    const brief = briefCreative({ level: 'ultra', direction: 'precision', facts, photos: 2, durationSec: 15, memory: projectMemory([{ storyboard: sampleStoryboard(3, 'precision') }]), seed: 9 });
    const universe = creativeUniverse(brief, { photos: 2 });
    const tokens = estimateTokens(universe.text);
    check(`univers créatif compact (≈ ${tokens} tokens, ${universe.patterns.length} motifs, sous-explorés et combinaisons compris)`, tokens <= 350 && /RECENTLY USED/.test(universe.text) && /EXPLORATION BUDGET: about 70 %/.test(universe.text) && /EXPLORE/.test(universe.text) && /MOTION DNA/.test(universe.text));
    const input: DirectorInput = { brief: { message: 'Soldes wax' }, briefText: 'Soldes wax à 15 000 FCFA, livraison à Abidjan', facts, sheet: 'BRAND: Wax & Co', direction: 'precision', durationSec: 15, formats: ['story'], range: [4, 6], media: [], brandName: 'Wax & Co', language: 'fr', universe: universe.text };
    const prompt = buildDirectorPrompt(input);
    check('le directeur reçoit l’univers et peut nommer un motif par plan', /CREATIVE UNIVERSE/.test(prompt.user) && /PATTERN:/.test(prompt.system));
    const raw = [
      'FILM: Le wax', 'CONCEPT: c', 'BIBLE: b',
      'SHOT 1 | 3s | surface: primary', 'TITLE: Soldes sur le wax', 'VISUAL: brand block', 'PATTERN: circleStage',
      'SHOT 2 | 3.5s | surface: light', 'TITLE: Livré à Abidjan', 'VISUAL: The map of Africa lights up Abidjan', 'MEDIA: none',
      'SHOT 3 | 3.5s | surface: light', 'TITLE: Des cubes qui montent', 'VISUAL: cubes rise', 'PATTERN: explore Flat3D + FlowField + Banana',
      'SHOT 4 | 2.6s | surface: light', 'SIGNATURE: yes', 'VISUAL: logo',
    ].join('\n');
    const film = parseFilm(raw, input)!;
    check('motif nommé lu, motif déduit de la consigne, exploration validée contre le kit', film?.shots[0].pattern === 'circleStage' && film.shots[1].pattern === 'mapLightUp' && film.shots[2].explore?.join('+') === 'Flat3D+FlowField', JSON.stringify(film?.shots.map((s) => s.pattern || s.explore)));
    const plain = scopedKitManifest(shotKit(film.shots[0]));
    const explore = scopedKitManifest(shotKit(film.shots[2]));
    check(`manifeste restreint : ${Math.round(plain.length / 4)} tokens pour un plan typographique, ${Math.round(explore.length / 4)} pour l’exploration (complet : ${Math.round(KIT_MANIFEST.length / 4)})`, plain.length < KIT_MANIFEST.length * 0.75 && /Flat 3D/.test(explore) && /Hand-made touch/.test(explore) && !/ChartJs type/.test(explore) && !/Flat 3D/.test(plain));
    check('validation renforcée pour les plans qui explorent (et les motifs expérimentaux)', isExploratoryShot(film.shots[2], 'precision') && !isExploratoryShot(film.shots[0], 'precision') && isExploratoryShot({ pattern: 'chartExplosion' }, 'precision'));
  }

  // ── 8 ──
  section('8. Budget de tokens');
  {
    const scene: ArtDirectorScene = { index: 1, count: 6, sceneId: 'stat', texts: ['98 %', 'de clientes satisfaites'], menu: ['bigNumber', 'chartRing', 'dataArc', 'classic'] };
    const before = buildArtDirectorPrompt('BRAND: Wax & Co\nCOLORS: …', 'swiss', scene);
    const withPatterns = buildArtDirectorPrompt('BRAND: Wax & Co\nCOLORS: …', 'swiss', { ...scene, intent: 'growth', patterns: ['counterAcceleration', 'ringSweep', 'gaugeFill', 'metricStage', 'directionClassic'].map((id) => ({ id, pitch: PATTERN_BY_ID.get(id)!.pitch, layout: PATTERN_BY_ID.get(id)!.tools.layout })) });
    const a = estimateTokens(before.system + before.user);
    const b = estimateTokens(withPatterns.system + withPatterns.user);
    check(`directeur artistique : ≈ ${b} tokens avec 5 motifs (${a} avec 4 mises en page) — même ordre de grandeur`, b <= a + 60, '');
  }

  console.log(`\n${passes} vérifications réussies, ${failures} en échec`);
  if (failures) {
    console.log('✗ Moteur créatif : des écarts.');
    process.exit(1);
  }
  console.log('✓ Moteur créatif : motifs résolus, vidéos réellement différentes, exploration bornée.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
