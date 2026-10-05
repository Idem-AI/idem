/**
 * LA DIRECTION CRÉATIVE — ce que le modèle décide, et rien d'autre.
 *
 * Tout ce qui peut être écrit à l'avance l'est (scènes, composants, concepts,
 * effets, règles de motion, charte) ; le modèle ne fait que des CHOIX, dans des
 * menus courts que le graphe a déjà filtrés pour CE projet et CETTE charte :
 *
 *   objective   ce que la vidéo doit accomplir (si l'utilisateur ne l'a pas dit)
 *   concept     la structure du récit, parmi les 5 que le graphe juge pertinentes
 *   scenes      l'enchaînement, dans le menu des scènes réellement montrables
 *   accent      la scène qui porte le grand moment (l'effet, lui, vient de la direction)
 *   moves       quelques entrées de texte, parmi celles de la direction retenue
 *   logo        l'animation du logo, parmi les 3 que le graphe recommande
 *
 * Un appel court (~550 tokens en entrée, ~60 en sortie). Chaque ligne est lue
 * seule et validée par le code ; une ligne absente, fausse ou inventée est
 * remplacée par le choix du graphe. Un modèle très faible, ou aucun modèle,
 * donne donc toujours une vidéo complète, correcte et variée.
 *
 * Type imposé (calendrier, choix explicite) : aucun appel — le concept est tiré
 * par le graphe parmi ceux du type, et la vidéo reste différente des précédentes.
 */
import { VIDEO_OBJECTIVES, VideoObjective, VideoType } from '../../../models/motionVideo.model';
import { conceptFits, CONCEPTS, ConceptId, CONCEPT_IDS, ensureScenes, expandConcept, mustShowScenes, pickConcept, rankConcepts, sceneRange, typeOfScenes } from './video.concepts';
import { BriefFacts, CopyContext, CopyWriter, estimateTokens } from './video.copy';
import { DirectionId } from './video.direction';
import { SCENES } from './video.scenes';
import { available, MediaCounts } from './video.types';

/** Ce que chaque scène montre, en quelques mots (le menu du modèle). */
export const SCENE_MENU: Record<string, string> = {
  hook: 'opening headline that grabs attention',
  statement: 'one strong sentence on plain color',
  kinetic: 'punchy animated typography, 2-4 short lines',
  wordswap: 'rotating words ("fast / local / reliable")',
  product: 'product photo with name and price',
  gallery: 'three photos in a row',
  footage: 'full-screen video clip with a caption',
  showcase3d: '3D: the product turning, or 3D photo cards',
  lottie: 'animated illustration (confetti, check, sparkle)',
  benefits: 'three benefits with icons',
  stat: 'one big number with its label',
  offer: 'discount or price offer',
  quote: 'customer testimonial',
  event: 'date, time and place',
  cta: 'call to action',
  logo: 'brand signature (always last)',
};

export interface CreativeInput {
  message: string;
  details?: string;
  durationSec: number;
  media: MediaCounts;
  facts: BriefFacts;
  ctx: CopyContext;
  /** Objectif connu (sinon choisi par le modèle, ou déduit). */
  objective?: VideoObjective;
  /** Type imposé (calendrier, choix explicite). `mix` = le modèle compose librement. */
  type?: VideoType;
  /** Direction de motion déjà retenue (DA de la charte + variété). */
  direction: DirectionId;
  /** Entrées de titre de cette direction : le menu des « moves ». */
  techniques: string[];
  /** Animations de logo recommandées par le graphe (3 au plus). */
  logoMenu: string[];
  /** DA de la charte : style, médium d'image, mots-clés. */
  art?: { medium?: string; summary?: string; styleId?: string };
  /** Concepts des dernières vidéos du projet. */
  recentConcepts?: string[];
  /** Médias fournis par l'utilisateur : ils sont toujours montrés, quoi que réponde le modèle. */
  owned?: MediaCounts;
  /** Enchaînements des dernières vidéos du projet (« hook>product>cta>logo ») : jamais repris tel quel. */
  recentSequences?: string[];
  /** Animations de logo des dernières vidéos : retirées du menu tant qu'il reste un choix. */
  recentLogos?: string[];
  seed: number;
}

export interface CreativePlan {
  objective: VideoObjective;
  type: VideoType;
  concept: ConceptId;
  scenes: string[];
  /** Index de la scène du grand moment. */
  accent: number;
  /** Entrées de titre choisies (index de scène → technique). */
  moves: Record<number, string>;
  /** Animation de logo choisie dans le menu du graphe. */
  logo?: string;
  source: 'llm' | 'graph';
  tokens: { input: number; output: number };
}

/** Objectif déduit du texte (repli sans modèle). */
export function inferObjective(text: string): VideoObjective {
  const t = text.toLowerCase();
  if (/promo|r[ée]duc|remise|solde|-\s?\d+ ?%|\d+ ?% de|offre sp[ée]ciale|black friday/.test(t)) return 'promotion';
  if (/ouverture|inaugur|ouvre ses portes|nouvelle boutique|nouveau magasin/.test(t)) return 'opening';
  if (/recrut|on embauche|rejoignez l.[ée]quipe|offre d.emploi|hiring/.test(t)) return 'recruitment';
  if (/avis|t[ée]moign|nos clients disent|review/.test(t)) return 'testimonial';
  if (/soir[ée]e|[ée]v[ée]nement|concert|atelier le|salon|festival|webinaire|\ble \d{1,2} /.test(t)) return 'event';
  if (/produit|nouveaut[ée]|nouveau|nouvelle|collection|gamme|d[ée]couvrez notre|lancement|\bnew\b/.test(t)) return 'product';
  return 'announce';
}

const CANON: Record<string, string> = { showcase: 'showcase3d', '3d': 'showcase3d', video: 'footage', clip: 'footage', animation: 'lottie', signature: 'logo', calltoaction: 'cta', testimonial: 'quote', photos: 'gallery', typography: 'kinetic' };

export function buildCreativePrompt(input: CreativeInput, concepts: ConceptId[], scenes: string[]): { system: string; user: string } {
  const [min, max] = sceneRange(input.durationSec);
  const askObjective = !input.objective;
  const system = [
    'You are the creative director of a short brand video. Output ONLY these lines, nothing else:',
    askObjective ? `objective: one of ${VIDEO_OBJECTIVES.join(' | ')}` : '',
    'concept: one id from CONCEPTS (the first one is recommended)',
    `scenes: ${min} to ${max} ids from SCENES, comma separated, in the concept's order; the last one is logo`,
    'accent: the number of the scene that gets the big moment',
    'moves: up to 3 pairs "scene number=technique" from TECHNIQUES, e.g. 1=scramble',
    input.logoMenu.length ? `logo: one of ${input.logoMenu.join(' | ')}` : '',
    'Serve the request and the brand art direction. Combine techniques when it helps. Never the same scene twice in a row.',
  ]
    .filter(Boolean)
    .join('\n');
  const m = input.media;
  const user = [
    `REQUEST: ${input.message.slice(0, 400)}`,
    input.details ? `DETAILS: ${input.details.slice(0, 500)}` : '',
    `BRAND: ${input.ctx.brandName}${input.ctx.businessType ? ` (${input.ctx.businessType})` : ''}`,
    input.art?.summary ? `ART DIRECTION: ${input.art.summary}` : '',
    `DURATION: ${input.durationSec} s · MEDIA: ${m.images} photo(s), ${m.videos} clip(s), ${m.models} 3D model(s), ${m.lotties} animation(s)`,
    'CONCEPTS:',
    ...concepts.map((id) => `${id}: ${CONCEPTS[id].pitch}`),
    'SCENES:',
    ...scenes.map((id) => `${id}: ${SCENE_MENU[id] || id}`),
    `TECHNIQUES: ${input.techniques.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export interface ParsedCreative {
  objective?: string;
  concept?: string;
  scenes?: string[];
  accent?: number;
  moves?: Record<number, string>;
  logo?: string;
}

/** Lit la réponse, ligne à ligne, quelle qu'en soit la forme (puces, gras, JSON, majuscules…). */
export function parseCreative(raw: string): ParsedCreative {
  const out: ParsedCreative = {};
  let text = (raw || '').replace(/```[a-z]*\n?/gi, '').trim();
  // Un modèle qui répond en JSON : on le remet en lignes.
  if (/^\{/.test(text)) {
    try {
      const data = JSON.parse(text);
      text = Object.entries(data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a}=${b}`).join(', ') : v}`)
        .join('\n');
    } catch {
      /* lignes telles quelles */
    }
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\W*(objective|concept|scenes|accent|moves|logo)\W*[:=]\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim().replace(/^["'[]+|["'\].]+$/g, '');
    if (key === 'scenes') out.scenes = value.split(/[,;>→|\s]+/).map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
    else if (key === 'accent') {
      const n = parseInt(value.replace(/\D+/g, ' ').trim().split(' ')[0] || '', 10);
      if (Number.isFinite(n)) out.accent = n;
    } else if (key === 'moves') {
      out.moves = {};
      for (const pair of value.matchAll(/(\d{1,2})\s*[=:→-]\s*([a-zA-Z]+)/g)) out.moves[Number(pair[1])] = pair[2];
    } else (out as Record<string, unknown>)[key] = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  }
  return out;
}

/** Scènes validées : connues, montrables, jamais deux fois de suite, dans les bornes, logo en dernier. */
export function normaliseScenes(proposed: string[], input: Pick<CreativeInput, 'durationSec' | 'facts' | 'media'>): string[] {
  const [, max] = sceneRange(input.durationSec);
  const ok = (id: string) => !!SCENES[id] && available(id, input.facts, input.media);
  const scenes: string[] = [];
  for (const raw of proposed) {
    const id = CANON[raw] || raw;
    if (!ok(id) || id === 'logo' || scenes[scenes.length - 1] === id) continue;
    scenes.push(id);
  }
  if (scenes[0] === 'cta') scenes.shift();
  return [...scenes.slice(0, max - 1), 'logo'];
}

/** Le plan créatif d'une vidéo. */
export async function planCreative(input: CreativeInput, writer?: CopyWriter): Promise<CreativePlan> {
  const text = `${input.message}\n${input.details || ''}`;
  const objective0 = input.objective || inferObjective(text);
  const fixedType = input.type && input.type !== 'mix' ? input.type : undefined;
  const conceptCtx = {
    objective: objective0,
    type: fixedType ?? (input.type === 'mix' ? 'mix' : undefined),
    direction: input.direction,
    artStyleId: input.art?.styleId,
    durationSec: input.durationSec,
    facts: input.facts,
    media: input.media,
    seed: input.seed,
    recent: input.recentConcepts,
    owned: input.owned,
  } as const;

  // Le choix du graphe : toujours calculé, c'est le repli de chaque ligne.
  const graphConcept = pickConcept(conceptCtx);
  const graphExpanded = expandConcept(graphConcept, conceptCtx);
  const graphPlan: CreativePlan = {
    objective: objective0,
    type: fixedType ?? (input.type === 'mix' ? 'mix' : typeOfScenes(graphConcept, graphExpanded.scenes)),
    concept: graphConcept,
    scenes: graphExpanded.scenes,
    accent: graphExpanded.accent,
    moves: {},
    source: 'graph',
    tokens: { input: 0, output: 0 },
  };
  // Type imposé, ou pas de modèle : le graphe décide seul (zéro token).
  if (fixedType || !writer) return graphPlan;

  const menu = rankConcepts(conceptCtx).slice(0, 5).map((c) => c.id);
  if (!menu.length) return graphPlan;
  // Le concept recommandé est celui du graphe, placé en tête.
  const concepts = [graphConcept, ...menu.filter((id) => id !== graphConcept)].slice(0, 5);
  const sceneMenu = Object.keys(SCENE_MENU).filter((id) => id === 'logo' || available(id, input.facts, input.media));
  // Le menu de logo exclut ceux des dernières vidéos (s'il reste au moins deux choix).
  const freshLogos = input.logoMenu.filter((l) => !(input.recentLogos || []).slice(-2).includes(l));
  const logoMenu = freshLogos.length >= 2 ? freshLogos : input.logoMenu;
  const prompt = buildCreativePrompt({ ...input, logoMenu }, concepts, sceneMenu);
  let raw = '';
  try {
    raw = await writer(prompt.system, prompt.user);
  } catch {
    return graphPlan;
  }
  const parsed = parseCreative(raw);

  const objective = input.objective || (VIDEO_OBJECTIVES.includes(parsed.objective as VideoObjective) ? (parsed.objective as VideoObjective) : objective0);
  const conceptAccepted = concepts.includes(parsed.concept as ConceptId) && CONCEPT_IDS.includes(parsed.concept as ConceptId) && conceptFits(CONCEPTS[parsed.concept as ConceptId], conceptCtx);
  const concept = conceptAccepted ? (parsed.concept as ConceptId) : graphConcept;
  const fromModel = parsed.scenes ? normaliseScenes(parsed.scenes, input) : [];
  const [min] = sceneRange(input.durationSec);
  const expanded = expandConcept(concept, conceptCtx);
  // Les scènes du modèle ne valent que si son concept a été retenu (sinon elles racontent
  // autre chose) et si elles ne recopient pas une vidéo récente du projet.
  const repeated = (seq: string[]) => (input.recentSequences || []).includes(seq.join('>'));
  const proposed = fromModel.length >= Math.max(2, min - 1) ? ensureScenes(fromModel, mustShowScenes(input.owned, input.facts, input.media), input.durationSec) : [];
  const usedModelScenes = conceptAccepted && proposed.length > 0 && !repeated(proposed);
  // Les médias de l'utilisateur sont montrés même si le modèle les a oubliés.
  const scenes = usedModelScenes ? proposed : expanded.scenes;

  // Le grand moment : la scène désignée (jamais la signature), sinon celle du concept.
  let accent = parsed.accent != null ? parsed.accent - 1 : -1;
  if (accent < 0 || accent >= scenes.length - 1) {
    const beatScenes = CONCEPTS[concept].beats[CONCEPTS[concept].accent]?.scenes || [];
    const found = scenes.findIndex((s) => beatScenes.includes(s));
    accent = found >= 0 && found < scenes.length - 1 ? found : usedModelScenes ? Math.min(1, scenes.length - 2) : expanded.accent;
  }

  const moves: Record<number, string> = {};
  for (const [n, technique] of Object.entries(parsed.moves || {})) {
    const index = Number(n) - 1;
    const match = input.techniques.find((t) => t.toLowerCase() === technique.toLowerCase());
    if (match && index >= 0 && index < scenes.length - 1 && Object.keys(moves).length < 3) moves[index] = match;
  }
  const logo = parsed.logo && logoMenu.includes(parsed.logo) ? parsed.logo : undefined;

  const answered = !!(parsed.concept || parsed.scenes || parsed.accent != null);
  return {
    objective,
    type: input.type === 'mix' ? 'mix' : typeOfScenes(concept, scenes),
    concept,
    scenes,
    accent,
    moves,
    logo,
    source: answered ? 'llm' : 'graph',
    tokens: { input: estimateTokens(prompt.system + prompt.user), output: estimateTokens(raw) },
  };
}
