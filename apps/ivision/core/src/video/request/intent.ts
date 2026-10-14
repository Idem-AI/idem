/**
 * L'INTENTION D'UNE VIDÉO — ce que l'utilisateur veut, séparé en trois dimensions qui ne se mélangent plus :
 *
 *   objectif          POURQUOI la vidéo existe (convertir, démontrer un produit, faire visiter un site,
 *                     expliquer, film de marque, événement, histoire, annonce, réutilisation) ;
 *   mode de production QUELLE MATIÈRE on travaille (présentation d'app ou de site, montage de vidéos filmées,
 *                     motion design pur, hybride, présentation produit, infographie) ;
 *   langage de motion COMMENT ça bouge (typographie cinétique, éditorial, géométrique, illustration 2D, 3D,
 *                     interface, cinématographique, données, collage, minimal) — vocabulaire du directeur,
 *                     jamais une liste technique imposée à l'utilisateur.
 *
 * L'ancienne liste de types (`kinetic`, `product`, `footage`…) mêlait ces trois dimensions ; elle reste le
 * contrat du pipeline existant, et l'intention s'y TRADUIT (`legacy`) sans que l'utilisateur ait à la voir.
 *
 * HIÉRARCHIE des décisions : consigne explicite > scénario fourni > médias importés > contexte du projet >
 * choix automatique. Chaque dimension dit d'où vient sa décision (`decided`).
 *
 * Tout est lu par le CODE (zéro jeton) ; un agent `video.intent-classifier` peut affiner une lecture peu sûre
 * (`refineVideoIntent`), dans les seules valeurs admises. La CLARIFICATION (`clarifyVideoIntent`) ne pose une
 * question que si sa réponse change le pipeline — jamais la langue, la durée, le format ou la musique.
 */
import type { CopyWriter } from './facts';
import { extractFacts } from './facts';
/** Ancienne direction de motion (vidéos d'avant Motion Canvas) : un simple nom. */
type DirectionId = string;
import type { VideoFormat, VideoObjective, VideoType } from '../contracts/model';
import type { RequestSpec } from './request';

export const VIDEO_GOALS = ['conversion', 'product-demo', 'website-tour', 'explainer', 'brand-film', 'event', 'story', 'announcement', 'repurpose'] as const;
export type VideoGoal = (typeof VIDEO_GOALS)[number];

export const PRODUCTION_MODES = ['app-presentation', 'footage-edit', 'pure-motion', 'hybrid', 'product-showcase', 'data-story'] as const;
export type ProductionMode = (typeof PRODUCTION_MODES)[number];

export const MOTION_LANGUAGES = ['kinetic-type', 'editorial', 'geometric', 'illustration-2d', 'spatial-3d', 'interface', 'cinematic', 'data-led', 'collage', 'minimal-broadcast'] as const;
export type MotionLanguage = (typeof MOTION_LANGUAGES)[number];

export type Decision = 'explicit' | 'script' | 'assets' | 'project' | 'auto';
export type YesNoAsk = 'yes' | 'no' | 'ask';

/** Un média disponible, tel que le classificateur le voit (sans l'ouvrir). */
export interface IntentAsset {
  id: string;
  kind: 'image' | 'video' | 'model3d' | 'lottie' | 'rive' | 'audio' | 'screen';
  width?: number;
  height?: number;
  durationSec?: number;
  /** Une ligne de description (vision), si l'hôte la garde : « screenshot: … », « photo: … ». */
  note?: string;
}

export interface VideoIntentSpec {
  v: 1;
  objective: VideoGoal;
  secondaryObjective?: VideoGoal;
  productionModes: ProductionMode[];
  motionDirection: MotionLanguage[];
  /** Les médias qui portent la vidéo (dans l'ordre). */
  primaryAssetIds: string[];
  /** Ce qu'il faudra obtenir (« product captures », « filmed footage »…). */
  assetNeeds: string[];
  language: string;
  subtitles: YesNoAsk;
  voiceover: YesNoAsk;
  music: YesNoAsk;
  /** Les consignes explicites de l'utilisateur, à respecter telles quelles. */
  explicitConstraints: string[];
  /** Les décisions qui changeraient le résultat et que rien ne permet de prendre. */
  missingDecisions: string[];
  /** 0..1 : la sûreté de la lecture (objectif et mode). */
  confidence: number;
  durationSec?: number;
  format?: VideoFormat;
  /** Le scénario de l'utilisateur est suivi tel quel. */
  scripted: boolean;
  /** `montage` : la vidéo de l'utilisateur est retravaillée (sous-titres, montage) plutôt que réinventée. */
  pipeline: 'motion' | 'montage';
  decided: Record<'objective' | 'productionModes' | 'motionDirection', Decision>;
  /** La traduction dans le contrat du pipeline existant. */
  legacy: { type: VideoType | 'auto'; objective: VideoObjective; direction?: DirectionId };
  source: 'code' | 'agent' | 'user';
}

export interface ClassifyInput {
  /** La demande telle qu'écrite (en entier). */
  request: string;
  spec?: RequestSpec;
  assets?: IntentAsset[];
  /** Un type imposé par l'appelant (calendrier, choix explicite). */
  requestedType?: VideoType | 'auto';
  /** La marque a des captures de son site ou de son produit. */
  brandHasScreens?: boolean;
  language?: string;
}

// ─── Lecture ────────────────────────────────────────────────────────────────

const norm = (text: string): string => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

const GOAL_RULES: Array<[VideoGoal, RegExp]> = [
  ['repurpose', /\b(decoupe|decouper|clips? courts?|formats? courts?|reels?|shorts?|tiktok|reutilis\w*|recycl\w*|repurpose|short clips?)\b/],
  ['website-tour', /\b(site( web| internet)?|website|landing|page d accueil|web ?app)\b.*\b(presente\w*|presenter|visite\w*|decouvr\w*|montre\w*|tour|show)|\b(presente|presenter|visite|tour|show)\b.*\b(site( web)?|website|landing)\b/],
  ['product-demo', /\b(demo\w*|tutoriel\w*|tuto|prise en main|onboarding|fonctionnalites?|features?|how it works)\b|\b(present\w*|montre\w*|show)\b.*\b(appli(cation)?s?|apps?|logiciels?|plateformes?|software|saas|outils?)\b/],
  ['event', /\b(evenements?|events?|conferences?|salons?|webinaires?|webinars?|ateliers?|concerts?|festivals?|soirees?|inscri(ption|vez|re)\w*|register)\b/],
  ['announcement', /\b(lancement|lance\w*|nouveau\w*|nouvelle\w*|annonce\w*|ouverture|launch\w*|announce\w*|new feature|now available|disponibles?)\b/],
  ['story', /\b(temoignages?|cas clients?|histoires?|recits?|parcours|story|testimonials?|case study|avant\/apres|avant et apres)\b/],
  ['explainer', /\b(expliqu\w*|explication\w*|comprendre|comment (ca|cela) marche|vulgaris\w*|pedagog\w*|explainer|how to)\b/],
  ['brand-film', /\b(film de marque|manifeste|notre vision|notre mission|nos valeurs|ambitions?|brand film|brand story|identite de marque)\b/],
  ['conversion', /\b(promo\w*|soldes?|offres?|reductions?|remises?|achet\w*|commande\w*|essai gratuit|abonne\w*|inscri\w*|telecharg\w*|download|buy|shop|sale|discount)|-?\d+ ?%\b/],
];

const LANGUAGE_RULES: Array<[MotionLanguage, RegExp]> = [
  ['kinetic-type', /\b(typo(graphie)?|kinetic|textes? animes?|lettres|mots? geants?)\b/],
  ['spatial-3d', /\b(3d|three\.?js|volume|objet 3d|rendu 3d)\b/],
  ['illustration-2d', /\b(illustr\w*|dessin\w*|cartoon|personnages? anim\w*|flat design|2d)\b/],
  ['cinematic', /\b(cinema\w*|filmique|cinematic|plans? films?)\b/],
  ['minimal-broadcast', /\b(minimal\w*|sobre|epure\w*|corporate|broadcast)\b/],
  ['collage', /\b(collage|mixed media|decoupage|scrapbook)\b/],
  ['data-led', /\b(graphiques?|chiffres|donnees|statistiques?|infographie|data|kpi|courbes?)\b/],
  ['geometric', /\b(geometr\w*|formes|abstrait\w*|abstract|motifs)\b/],
  ['editorial', /\b(editorial|magazine|mise en page)\b/],
  ['interface', /\b(interface|ecrans?|captures?|screenshots?|ui|ux)\b/],
];

/** Les médias filmés (pas une capture d'écran animée). */
const isFilmed = (a: IntentAsset) => a.kind === 'video' && !/^screen/i.test(a.note || '');
const isScreen = (a: IntentAsset) => a.kind === 'screen' || /^screenshot|screen recording/i.test(a.note || '');

export function classifyVideoIntent(input: ClassifyInput): VideoIntentSpec {
  const raw = input.request || '';
  const text = norm(raw);
  const words = text.split(/\s+/).filter(Boolean).length;
  const assets = input.assets || [];
  const spec = input.spec;
  const filmed = assets.filter(isFilmed);
  const screens = assets.filter(isScreen);
  const photos = assets.filter((a) => a.kind === 'image' && !isScreen(a));
  const facts = extractFacts(raw);

  // 1. L'objectif : la consigne écrite d'abord (deux objectifs possibles), puis ce que les médias disent.
  const goals = GOAL_RULES.filter(([, re]) => re.test(text)).map(([g]) => g);
  let objective: VideoGoal;
  let objectiveDecision: Decision = 'explicit';
  let secondaryObjective: VideoGoal | undefined;
  if (goals.length) {
    // « présente notre site » est une visite, même si « nouveau » apparaît ; une promo chiffrée reste une conversion.
    const order: VideoGoal[] = ['repurpose', 'website-tour', 'product-demo', 'event', 'story', 'explainer', 'brand-film', 'announcement', 'conversion'];
    const sorted = order.filter((g) => goals.includes(g));
    objective = sorted[0];
    secondaryObjective = sorted.find((g) => g !== objective);
  } else if (spec?.mode === 'script' && spec.scenes.length >= 2) {
    objective = 'brand-film';
    objectiveDecision = 'script';
  } else if (screens.length) {
    objective = 'product-demo';
    objectiveDecision = 'assets';
  } else if (filmed.length && words < 4) {
    objective = 'repurpose';
    objectiveDecision = 'assets';
  } else {
    objective = 'conversion';
    objectiveDecision = 'auto';
  }

  // 2. Le mode de production : la matière disponible et demandée.
  const modes: ProductionMode[] = [];
  let modeDecision: Decision = 'auto';
  const wantsScreens = /\b(captures?|screenshots?|ecrans?|interface|appli(cation)?|app|site|logiciel|plateforme|dashboard|tableau de bord)\b/.test(text);
  if (screens.length || ((objective === 'product-demo' || objective === 'website-tour') && (wantsScreens || input.brandHasScreens))) {
    modes.push('app-presentation');
    modeDecision = screens.length ? 'assets' : 'explicit';
  }
  if (filmed.length) {
    modes.push('footage-edit');
    modeDecision = 'assets';
  }
  if (/\b(graphiques?|chiffres cles|statistiques?|infographie|donnees|data|courbe)\b/.test(text) || facts.stats.length >= 2) {
    modes.push('data-story');
    if (modeDecision === 'auto') modeDecision = 'explicit';
  }
  if (photos.length >= 2 && !modes.includes('app-presentation')) {
    modes.push('product-showcase');
    if (modeDecision === 'auto') modeDecision = 'assets';
  }
  if (spec?.mode === 'script' && spec.scenes.some((sc) => sc.media.includes('footage')) && !modes.includes('footage-edit')) {
    modes.push('footage-edit');
    modeDecision = 'script';
  }
  if (!modes.length) modes.push('pure-motion');
  if (modes.length > 1) modes.push('hybrid');

  // 3. Le langage de motion : demandé en toutes lettres, sinon celui de la matière.
  const asked = LANGUAGE_RULES.filter(([, re]) => re.test(text)).map(([l]) => l);
  let motionDirection: MotionLanguage[];
  let languageDecision: Decision;
  if (asked.length) {
    motionDirection = asked.slice(0, 2);
    languageDecision = 'explicit';
  } else {
    languageDecision = 'auto';
    const primary = modes[0];
    motionDirection =
      primary === 'app-presentation'
        ? ['interface', 'editorial']
        : primary === 'footage-edit'
          ? ['cinematic', 'minimal-broadcast']
          : primary === 'data-story'
            ? ['data-led', 'editorial']
            : primary === 'product-showcase'
              ? ['editorial', 'cinematic']
              : objective === 'brand-film'
                ? ['cinematic', 'kinetic-type']
                : objective === 'explainer'
                  ? ['illustration-2d', 'geometric']
                  : ['kinetic-type', 'geometric'];
  }

  // 4. Le son et les sous-titres : ce qui est demandé ou refusé ; jamais redemandé.
  const subtitles: YesNoAsk = /\b(sans sous.?titres?|no subtitles?)\b/.test(text) ? 'no' : /\b(sous.?titr\w*|subtitles?|captions?|transcri\w*)/.test(text) ? 'yes' : 'no';
  const voiceover: YesNoAsk = spec?.voiceOver === 'wanted' || /\b(voix.?off|voiceover|voice.?over|narrat\w*|commentaire audio)/.test(text) ? (/\b(sans voix|no voice)/.test(text) ? 'no' : 'yes') : spec?.voiceOver === 'none' ? 'no' : 'no';
  const music: YesNoAsk = /\b(sans musique|no music|pas de musique)\b/.test(text) ? 'no' : 'yes';

  // 5. Ce qui manque vraiment.
  const missing: string[] = [];
  // Des vidéos déposées sans consigne (tournées ou enregistrements d'écran) : le média ne dit pas quoi en faire.
  const onlyMedia = assets.some((a) => a.kind === 'video') && words < 4 && !goals.length;
  if (onlyMedia) missing.push('video-treatment');
  if (objective === 'event' && !facts.dates.length && !facts.places.length) missing.push('event-details');
  if (objective === 'product-demo' && modes.includes('app-presentation') && !screens.length && !input.brandHasScreens) missing.push('product-captures');

  // 6. Le pipeline et la traduction dans le contrat existant.
  const montage = (objective === 'repurpose' || (filmed.length > 0 && subtitles === 'yes' && !/\b(motion|anime|animation|habillage)\b/.test(text))) && filmed.length > 0;
  const constraints = [...(spec?.musts || []), ...(spec?.avoid || []).map((a) => `avoid: ${a}`), ...(spec?.texts || []).map((t) => `text: « ${t} »`)].slice(0, 12);
  const confidence = Math.round(Math.min(1, (objectiveDecision === 'auto' ? 0.3 : objectiveDecision === 'explicit' ? 0.55 : 0.45) + (modeDecision === 'auto' ? 0.1 : 0.25) + (languageDecision === 'explicit' ? 0.15 : 0.05) - missing.length * 0.15) * 100) / 100;

  return {
    v: 1,
    objective,
    ...(secondaryObjective ? { secondaryObjective } : {}),
    productionModes: [...new Set(modes)],
    motionDirection,
    primaryAssetIds: [...screens, ...filmed, ...photos].map((a) => a.id).slice(0, 8),
    assetNeeds: [
      ...(modes.includes('app-presentation') && !screens.length ? ['product captures'] : []),
      ...(modes.includes('footage-edit') && !filmed.length ? ['filmed footage'] : []),
      ...(modes.includes('product-showcase') && photos.length < 2 ? ['product photos'] : []),
    ],
    language: spec?.language || input.language || 'fr',
    subtitles,
    voiceover,
    music,
    explicitConstraints: constraints,
    missingDecisions: missing,
    confidence: Math.max(0.05, confidence),
    ...(spec?.durationSec ? { durationSec: spec.durationSec } : {}),
    ...(spec?.format ? { format: spec.format } : {}),
    scripted: spec?.mode === 'script' && (spec?.scenes.length ?? 0) >= 2,
    pipeline: montage ? 'montage' : 'motion',
    decided: { objective: objectiveDecision, productionModes: modeDecision, motionDirection: languageDecision },
    legacy: legacyOf({ objective, productionModes: [...new Set(modes)], motionDirection, decided: { objective: objectiveDecision, productionModes: modeDecision, motionDirection: languageDecision } }, input),
    source: 'code',
  };
}

const DIRECTION_OF: Record<MotionLanguage, DirectionId> = {
  'kinetic-type': 'kinetic',
  editorial: 'editorial',
  geometric: 'swiss',
  'illustration-2d': 'collage',
  'spatial-3d': 'precision',
  interface: 'precision',
  cinematic: 'cinematic',
  'data-led': 'swiss',
  collage: 'collage',
  'minimal-broadcast': 'editorial',
};

/**
 * La TRADUCTION d'une intention dans le contrat du pipeline existant (type de motion, objectif, direction) :
 * recalculée quand l'utilisateur corrige l'interprétation. Un type imposé par l'appelant l'emporte.
 */
export function legacyOf(intent: Pick<VideoIntentSpec, 'objective' | 'productionModes' | 'motionDirection' | 'decided'>, input: ClassifyInput): VideoIntentSpec['legacy'] {
  const text = norm(input.request || '');
  const facts = extractFacts(input.request || '');
  const photos = (input.assets || []).filter((a) => a.kind === 'image' && !isScreen(a));
  const modes = intent.productionModes;
  const motion = intent.motionDirection[0];
  const type: VideoType | 'auto' =
    input.requestedType && input.requestedType !== 'auto'
      ? input.requestedType
      : /\b(revelation|reveal|logo anime|animation (du|de mon) logo)\b/.test(text)
        ? 'logo'
        : motion === 'spatial-3d'
          ? 'showcase3d'
          : motion === 'illustration-2d'
            ? 'illustrated'
            : modes[0] === 'footage-edit'
              ? 'footage'
              : modes[0] === 'product-showcase'
                ? photos.length >= 4
                  ? 'slideshow'
                  : 'product'
                : modes.includes('hybrid') || modes[0] === 'app-presentation' || modes[0] === 'data-story'
                  ? 'mix'
                  : intent.objective === 'conversion' && (facts.percents.length || facts.prices.length)
                    ? 'promo'
                    : 'kinetic';
  const objective: VideoObjective =
    intent.objective === 'event'
      ? 'event'
      : intent.objective === 'announcement'
        ? /\b(ouverture|opening)\b/.test(text)
          ? 'opening'
          : 'announce'
        : intent.objective === 'story'
          ? 'testimonial'
          : intent.objective === 'product-demo' || intent.objective === 'website-tour' || intent.objective === 'explainer'
            ? 'product'
            : /\b(recrut\w*|hiring)/.test(text)
              ? 'recruitment'
              : intent.objective === 'brand-film'
                ? 'announce'
                : 'promotion';
  return { type, objective, ...(intent.decided.motionDirection === 'explicit' ? { direction: DIRECTION_OF[motion] } : {}) };
}

// ─── Affinage par un agent (lecture peu sûre) ───────────────────────────────

/**
 * Un agent relit une demande que le code a lue sans assurance (< 0,55). Il ne peut que CHOISIR dans les
 * valeurs admises, et jamais contredire une décision explicite ou un scénario.
 */
export async function refineVideoIntent(intent: VideoIntentSpec, request: string, writer?: CopyWriter): Promise<VideoIntentSpec> {
  if (!writer || intent.confidence >= 0.55 || !request.trim()) return intent;
  const system = `You classify a video request. Answer with JSON only: {"objective":"${VIDEO_GOALS.join('|')}","modes":["${PRODUCTION_MODES.join('|')}"],"motion":["${MOTION_LANGUAGES.join('|')}"]}. objective = why the video exists; modes = what material is worked (1-2); motion = how it moves (1-2).`;
  try {
    const raw = await writer(system, request.slice(0, 4000));
    const o = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const next = { ...intent, source: 'agent' as const };
    if (intent.decided.objective === 'auto' && (VIDEO_GOALS as readonly string[]).includes(o.objective)) next.objective = o.objective;
    const modes = (Array.isArray(o.modes) ? o.modes : []).filter((m: string) => (PRODUCTION_MODES as readonly string[]).includes(m)).slice(0, 2);
    if (intent.decided.productionModes === 'auto' && modes.length) next.productionModes = modes;
    const motion = (Array.isArray(o.motion) ? o.motion : []).filter((m: string) => (MOTION_LANGUAGES as readonly string[]).includes(m)).slice(0, 2);
    if (intent.decided.motionDirection === 'auto' && motion.length) next.motionDirection = motion;
    next.confidence = Math.min(0.75, intent.confidence + 0.25);
    return next;
  } catch {
    return intent;
  }
}

// ─── Clarification ──────────────────────────────────────────────────────────

export interface ClarificationOption {
  id: string;
  label: string;
  description: string;
  /** Ce que la réponse change dans l'intention. */
  patch: Partial<Pick<VideoIntentSpec, 'objective' | 'productionModes' | 'motionDirection' | 'subtitles' | 'voiceover' | 'pipeline'>>;
}

export interface VideoClarification {
  id: string;
  question: string;
  options: ClarificationOption[];
  /** Champs à saisir (date, lieu…), quand la réponse n'est pas un choix. */
  fields?: string[];
}

const fr = (lang: string) => !lang || lang.startsWith('fr');

/**
 * LA question la plus utile, ou `null` : on ne demande que ce qui change réellement le pipeline. Les options
 * suivent la matière détectée — un enregistrement d'écran n'appelle pas les mêmes choix qu'un film tourné.
 */
export function clarifyVideoIntent(intent: VideoIntentSpec, input: ClassifyInput): VideoClarification | null {
  const L = fr(intent.language);
  if (intent.missingDecisions.includes('video-treatment')) {
    const screenRecording = (input.assets || []).some((a) => a.kind === 'video' && /^screen/i.test(a.note || ''));
    const options: ClarificationOption[] = [
      { id: 'edit', label: L ? 'Améliorer le montage' : 'Improve the edit', description: L ? 'Garder ma vidéo, la resserrer, ajouter titres et habillage.' : 'Keep my video, tighten it, add titles and branding.', patch: { objective: 'repurpose', productionModes: ['footage-edit'], pipeline: 'montage' } },
      { id: 'subtitles', label: L ? 'Ajouter des sous-titres' : 'Add subtitles', description: L ? 'Transcrire ce qui est dit et l’afficher à l’écran.' : 'Transcribe what is said and show it on screen.', patch: { subtitles: 'yes', pipeline: 'montage', productionModes: ['footage-edit'] } },
      { id: 'voiceover', label: L ? 'Créer une voix off' : 'Create a voice-over', description: L ? 'Écrire et dire un commentaire sur les images.' : 'Write and voice a commentary over the footage.', patch: { voiceover: 'yes', pipeline: 'motion', productionModes: ['footage-edit'] } },
      screenRecording
        ? { id: 'demo', label: L ? 'En faire une démo produit' : 'Turn it into a product demo', description: L ? 'Zooms, annotations et mises en évidence sur les fonctionnalités.' : 'Zooms, annotations and highlights on the features.', patch: { objective: 'product-demo', productionModes: ['app-presentation', 'footage-edit', 'hybrid'], motionDirection: ['interface', 'editorial'], pipeline: 'motion' } }
        : { id: 'motion', label: L ? 'Ajouter du motion design' : 'Add motion design', description: L ? 'Un film promotionnel construit autour de ma vidéo.' : 'A promotional film built around my video.', patch: { objective: 'conversion', productionModes: ['footage-edit', 'pure-motion', 'hybrid'], motionDirection: ['cinematic', 'kinetic-type'], pipeline: 'motion' } },
      { id: 'clips', label: L ? 'Découper en clips courts' : 'Cut into short clips', description: L ? 'Plusieurs formats courts pour les réseaux.' : 'Several short formats for social networks.', patch: { objective: 'repurpose', productionModes: ['footage-edit'], pipeline: 'montage' } },
    ];
    return { id: 'video-treatment', question: L ? 'Que souhaites-tu faire avec cette vidéo ?' : 'What would you like to do with this video?', options };
  }
  if (intent.missingDecisions.includes('event-details')) {
    return { id: 'event-details', question: L ? 'Quand et où a lieu l’événement ?' : 'When and where is the event?', options: [], fields: ['date', 'place'] };
  }
  if (intent.missingDecisions.includes('product-captures')) {
    return {
      id: 'product-captures',
      question: L ? 'Je n’ai pas de capture de ton produit. Comment le montrer ?' : 'I have no capture of your product. How should I show it?',
      options: [
        { id: 'upload', label: L ? 'J’ajoute des captures' : 'I’ll add screenshots', description: L ? 'Les vraies écrans du produit, mis en scène.' : 'The real product screens, staged.', patch: {} },
        { id: 'motion', label: L ? 'Sans captures' : 'Without screenshots', description: L ? 'Le produit expliqué en motion design, sans fausse interface.' : 'The product explained in motion design, with no fake interface.', patch: { productionModes: ['pure-motion'], motionDirection: ['geometric', 'kinetic-type'] } },
      ],
    };
  }
  return null;
}

/** Une réponse à la clarification appliquée à l'intention (la décision devient explicite). */
export function applyClarification(intent: VideoIntentSpec, clarification: VideoClarification, optionId: string): VideoIntentSpec {
  const option = clarification.options.find((o) => o.id === optionId);
  if (!option) return intent;
  const next: VideoIntentSpec = { ...intent, ...option.patch, missingDecisions: intent.missingDecisions.filter((m) => m !== clarification.id), source: 'user' };
  if (option.patch.objective) next.decided = { ...next.decided, objective: 'explicit' };
  if (option.patch.productionModes) next.decided = { ...next.decided, productionModes: 'explicit' };
  if (option.patch.motionDirection) next.decided = { ...next.decided, motionDirection: 'explicit' };
  next.confidence = Math.max(next.confidence, 0.8);
  return next;
}

/** L'interprétation affichée à l'utilisateur : trois étiquettes et une phrase (jamais une liste technique). */
export function describeVideoIntent(intent: VideoIntentSpec): { tags: string[]; summary: string } {
  const L = fr(intent.language);
  const GOAL: Record<VideoGoal, [string, string]> = {
    conversion: ['Conversion', 'Conversion'], 'product-demo': ['Démo produit', 'Product demo'], 'website-tour': ['Visite du site', 'Website tour'], explainer: ['Explication', 'Explainer'], 'brand-film': ['Film de marque', 'Brand film'], event: ['Événement', 'Event'], story: ['Histoire client', 'Customer story'], announcement: ['Annonce', 'Announcement'], repurpose: ['Formats courts', 'Short formats'],
  };
  const MODE: Record<ProductionMode, [string, string]> = {
    'app-presentation': ['Captures réelles', 'Real captures'], 'footage-edit': ['Vidéos filmées', 'Filmed footage'], 'pure-motion': ['Motion design', 'Motion design'], hybrid: ['Hybride', 'Hybrid'], 'product-showcase': ['Photos produit', 'Product photos'], 'data-story': ['Données', 'Data'],
  };
  const MOTION: Record<MotionLanguage, [string, string]> = {
    'kinetic-type': ['Typographie animée', 'Kinetic type'], editorial: ['Éditorial', 'Editorial'], geometric: ['Géométrique', 'Geometric'], 'illustration-2d': ['Illustration', 'Illustration'], 'spatial-3d': ['3D', '3D'], interface: ['Motion UI', 'Motion UI'], cinematic: ['Cinématographique', 'Cinematic'], 'data-led': ['Data motion', 'Data motion'], collage: ['Collage', 'Collage'], 'minimal-broadcast': ['Minimal', 'Minimal'],
  };
  const pick = (pair: [string, string]) => (L ? pair[0] : pair[1]);
  const mode = intent.productionModes.find((m) => m !== 'hybrid') || intent.productionModes[0];
  const tags = [pick(GOAL[intent.objective]), pick(MODE[mode]), pick(MOTION[intent.motionDirection[0]])];
  tags.push(intent.voiceover === 'yes' ? (L ? 'Voix off' : 'Voice-over') : L ? 'Voix off non demandée' : 'No voice-over');
  if (intent.subtitles === 'yes') tags.push(L ? 'Sous-titres' : 'Subtitles');
  const uses =
    mode === 'app-presentation'
      ? L ? 'les captures du produit' : 'the product captures'
      : mode === 'footage-edit'
        ? L ? 'tes vidéos' : 'your videos'
        : mode === 'product-showcase'
          ? L ? 'tes photos' : 'your photos'
          : mode === 'data-story'
            ? L ? 'les chiffres de ta demande' : 'the figures you gave'
            : L ? 'la typographie, les formes et la charte' : 'type, shapes and your brand';
  const summary = L
    ? `${intent.pipeline === 'montage' ? 'Le moteur retravaillera' : 'Le moteur utilisera'} ${uses}${intent.scripted ? ', en suivant ton scénario scène par scène' : ''}, avec un mouvement ${pick(MOTION[intent.motionDirection[0]]).toLowerCase()}.`
    : `${intent.pipeline === 'montage' ? 'The engine will rework' : 'The engine will use'} ${uses}${intent.scripted ? ', following your script scene by scene' : ''}, with ${pick(MOTION[intent.motionDirection[0]]).toLowerCase()} motion.`;
  return { tags, summary };
}
