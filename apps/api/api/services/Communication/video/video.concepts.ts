/**
 * LES CONCEPTS — la variété du RÉCIT, pas seulement de l'image.
 *
 * Deux vidéos qui ont la même direction de motion se ressemblent encore si elles
 * racontent la même chose dans le même ordre (accroche, avantages, appel à
 * l'action…). Un concept est une structure narrative éprouvée — question puis
 * réponse, problème puis solution, le produit en héros, un manifeste, la preuve
 * d'abord, un teaser… — écrite ici, dans le code :
 *
 *   beats   les temps du récit, chacun avec ses scènes possibles (par préférence)
 *   copy    la consigne de texte propre au concept, ajoutée aux cases concernées
 *   accent  le temps qui porte le « grand moment »
 *   suits   à quoi il convient (objectif, type, direction, DA)
 *
 * Le modèle CHOISIT un concept dans un menu court (celui que le graphe juge
 * pertinent pour le projet) ; le code le DÉPLIE en scènes, selon les médias
 * disponibles et la durée. Sans modèle, le graphe choisit — la vidéo reste variée.
 */
import { VideoObjective, VideoType } from '../../../models/motionVideo.model';
import { BriefFacts } from './video.copy';
import { DirectionId } from './video.direction';
import { SCENES } from './video.scenes';
import { available, MediaCounts } from './video.types';

export type ConceptId =
  | 'question'
  | 'problem-solution'
  | 'product-hero'
  | 'manifesto'
  | 'offer-blast'
  | 'proof'
  | 'journey'
  | 'teaser'
  | 'invitation'
  | 'showcase'
  | 'reasons'
  | 'celebration'
  | 'logo-sting';

interface Beat {
  scenes: string[];
  optional?: boolean;
}

export interface ConceptDef {
  id: ConceptId;
  /** La ligne du menu du modèle (anglais, courte). */
  pitch: string;
  beats: Beat[];
  /** Consignes de texte par scène et par case (préfixées à la consigne de la case). */
  copy?: Record<string, Record<string, string>>;
  /** Index du temps qui porte le grand moment. */
  accent: number;
  suits: {
    objectives?: Partial<Record<VideoObjective, number>>;
    types?: Partial<Record<VideoType, number>>;
    directions?: Partial<Record<DirectionId, number>>;
    arts?: Record<string, number>;
  };
  /** Il faut au moins une de ces scènes disponible pour que le concept tienne. */
  needs?: string[];
}

const b = (scenes: string, optional = false): Beat => ({ scenes: scenes.split('|'), optional });

export const CONCEPTS: Record<ConceptId, ConceptDef> = {
  question: {
    id: 'question',
    pitch: "ask the audience's own question, then answer it",
    beats: [b('hook'), b('statement|kinetic'), b('benefits|product|showcase3d', true), b('cta')],
    copy: { hook: { title: 'a question the audience asks themselves' }, statement: { title: 'the answer, short and confident' } },
    accent: 1,
    suits: { objectives: { announce: 1.5, product: 1, recruitment: 1, testimonial: 0.5 }, types: { kinetic: 1.5, product: 1, illustrated: 1, mix: 1 }, directions: { editorial: 1, swiss: 1, precision: 1 } },
  },
  'problem-solution': {
    id: 'problem-solution',
    pitch: 'name an everyday problem, then show it solved',
    beats: [b('hook'), b('kinetic|wordswap'), b('product|showcase3d|footage'), b('benefits', true), b('cta')],
    copy: { hook: { title: "the everyday problem, in the audience's words" }, kinetic: { l1: 'the turning point' } },
    accent: 2,
    suits: { objectives: { product: 1.5, promotion: 1, announce: 0.5 }, types: { product: 1.5, showcase3d: 1, kinetic: 1, footage: 1, mix: 1.5 }, directions: { kinetic: 1, brutal: 1, swiss: 0.5 } },
  },
  'product-hero': {
    id: 'product-hero',
    pitch: 'reveal the product like a hero, then its strengths',
    beats: [b('hook'), b('showcase3d|product|gallery'), b('benefits'), b('offer|stat', true), b('cta')],
    copy: { hook: { title: 'a teaser that builds desire for the product' } },
    accent: 1,
    suits: { objectives: { product: 2.5, promotion: 1 }, types: { product: 2, showcase3d: 2.5, promo: 1, slideshow: 1, mix: 1 }, directions: { precision: 1, cinematic: 1, drenched: 1 } },
    needs: ['showcase3d', 'product', 'gallery'],
  },
  manifesto: {
    id: 'manifesto',
    pitch: 'short brand beliefs, one after another',
    beats: [b('kinetic'), b('statement'), b('wordswap|kinetic', true), b('cta', true)],
    copy: { kinetic: { l1: 'a brand belief as a short affirmation', l2: 'another belief', l3: 'another belief' }, statement: { title: 'what the brand stands for, in one line' } },
    accent: 0,
    suits: { objectives: { announce: 1.5, recruitment: 1, opening: 0.5 }, types: { kinetic: 2.5, mix: 1 }, directions: { brutal: 2, swiss: 1, kinetic: 1, editorial: 0.5 }, arts: { maximalism: 1, graffiti: 1.5, swiss: 1 } },
  },
  'offer-blast': {
    id: 'offer-blast',
    pitch: 'hit with the offer, create urgency, then act',
    beats: [b('offer'), b('wordswap|kinetic'), b('product', true), b('cta')],
    copy: { wordswap: { lead: 'urgency, why now' } },
    accent: 0,
    suits: { objectives: { promotion: 3 }, types: { promo: 3, product: 0.5, mix: 1 }, directions: { kinetic: 1.5, brutal: 1.5, drenched: 1 } },
    needs: ['offer'],
  },
  proof: {
    id: 'proof',
    pitch: "lead with proof: a number, a customer's words",
    beats: [b('stat|quote'), b('quote|stat'), b('benefits', true), b('cta')],
    copy: { stat: { label: 'what this number proves' } },
    accent: 0,
    suits: { objectives: { testimonial: 3, recruitment: 1, product: 0.5 }, types: { kinetic: 1, footage: 0.5, mix: 1 }, directions: { precision: 1.5, editorial: 1, swiss: 1 } },
    needs: ['stat', 'quote'],
  },
  journey: {
    id: 'journey',
    pitch: 'real scenes from the field, with captions',
    beats: [b('footage'), b('footage'), b('statement|benefits'), b('footage', true), b('cta')],
    copy: { footage: { title: 'a caption that names what we see' } },
    accent: 0,
    suits: { objectives: { announce: 1, opening: 1, recruitment: 1 }, types: { footage: 3, slideshow: 1, mix: 1 }, directions: { cinematic: 2, editorial: 1 } },
    needs: ['footage'],
  },
  teaser: {
    id: 'teaser',
    pitch: 'intrigue first, reveal at the end',
    beats: [b('kinetic|hook'), b('statement', true), b('product|showcase3d|event|offer'), b('cta', true)],
    copy: { hook: { title: 'intriguing, reveal nothing yet' }, kinetic: { l1: 'an intriguing hint, no reveal' } },
    accent: 2,
    suits: { objectives: { event: 1.5, opening: 1.5, product: 1, announce: 1 }, types: { showcase3d: 1.5, kinetic: 1, product: 1, footage: 0.5, mix: 1.5 }, directions: { cinematic: 1.5, kinetic: 1, drenched: 1 }, arts: { surreal: 1, aurora: 1, futuristic: 1 } },
  },
  invitation: {
    id: 'invitation',
    pitch: 'invite: the occasion, the date, the place',
    beats: [b('hook'), b('event'), b('lottie|gallery', true), b('cta')],
    copy: { hook: { title: 'a warm invitation, name the occasion' } },
    accent: 1,
    suits: { objectives: { event: 3, opening: 2.5 }, types: { illustrated: 2, kinetic: 1, slideshow: 0.5, mix: 1 }, directions: { collage: 1, editorial: 1, kinetic: 0.5 } },
    needs: ['event'],
  },
  showcase: {
    id: 'showcase',
    pitch: 'a gallery of the work, then one strong line',
    beats: [b('hook'), b('gallery'), b('product|statement'), b('gallery', true), b('cta')],
    copy: { statement: { title: 'one strong line about the work shown' } },
    accent: 1,
    suits: { objectives: { product: 1, announce: 1, opening: 0.5 }, types: { slideshow: 3, product: 1, mix: 1 }, directions: { editorial: 1.5, collage: 1, cinematic: 1 } },
    needs: ['gallery'],
  },
  reasons: {
    id: 'reasons',
    pitch: 'why choose us: the reasons, one by one',
    beats: [b('hook'), b('benefits'), b('stat|wordswap', true), b('cta')],
    copy: { hook: { title: 'why choose the brand, as a question' } },
    accent: 1,
    suits: { objectives: { recruitment: 1.5, product: 1, announce: 1, promotion: 0.5 }, types: { kinetic: 1, product: 1, illustrated: 1, promo: 0.5, mix: 1 }, directions: { swiss: 1, precision: 1, collage: 0.5 } },
  },
  celebration: {
    id: 'celebration',
    pitch: 'celebrate a moment with the community',
    beats: [b('hook'), b('lottie'), b('statement|quote'), b('cta', true)],
    copy: { hook: { title: 'the moment we celebrate' } },
    accent: 1,
    suits: { objectives: { event: 1, announce: 1, opening: 1 }, types: { illustrated: 2.5, mix: 1 }, directions: { collage: 2, kinetic: 1, drenched: 0.5 }, arts: { 'pop-art': 1, clay: 1, y2k: 1 } },
  },
  'logo-sting': {
    id: 'logo-sting',
    pitch: 'a short signature: one word, then the logo',
    beats: [b('kinetic', true)],
    accent: 0,
    suits: { types: { logo: 5 } },
  },
};

export const CONCEPT_IDS = Object.keys(CONCEPTS) as ConceptId[];

/** Bornes du nombre de scènes (signature comprise) par durée. */
const RANGE: Record<number, [number, number]> = { 6: [2, 3], 15: [4, 6], 30: [6, 9], 60: [9, 15] };
export const sceneRange = (d: number): [number, number] => RANGE[d] ?? [Math.max(2, Math.round(d / 6)), Math.max(3, Math.round(d / 4))];

/** Les scènes qui font qu'une vidéo est bien de ce type (imposées quand le type est demandé). */
export const TYPE_SIGNATURE: Partial<Record<VideoType, string[]>> = {
  product: ['product'],
  promo: ['offer'],
  footage: ['footage'],
  showcase3d: ['showcase3d'],
  illustrated: ['lottie'],
  slideshow: ['gallery'],
  kinetic: ['kinetic'],
};

/** Types qui se reconnaissent à la répétition de leur scène signature (dès 15 s). */
const TYPE_REPEAT: Partial<Record<VideoType, string>> = { illustrated: 'lottie', footage: 'footage' };

export interface ConceptContext {
  objective: VideoObjective;
  type?: VideoType;
  direction: DirectionId;
  artStyleId?: string;
  durationSec: number;
  facts: BriefFacts;
  media: MediaCounts;
  seed: number;
  /** Concepts des dernières vidéos du projet (variété). */
  recent?: string[];
  /** Médias fournis par l'utilisateur (ou déjà dans ses visuels) : ils DOIVENT apparaître. */
  owned?: MediaCounts;
  /** Bonus de nouveauté du planificateur créatif : les concepts sous-explorés dans le projet passent devant. */
  boosts?: Record<string, number>;
}

/** Les scènes qui montrent les médias de l'utilisateur (une par sorte de média fournie). */
export function mustShowScenes(owned: MediaCounts | undefined, facts: BriefFacts, media: MediaCounts): string[] {
  if (!owned) return [];
  const ok = (id: string) => available(id, facts, media);
  const out: string[] = [];
  if (owned.models > 0 && ok('showcase3d')) out.push('showcase3d');
  if (owned.videos > 0 && ok('footage')) out.push('footage');
  if (owned.images > 0) {
    const photo = owned.images >= 3 && ok('gallery') ? 'gallery' : ok('product') ? 'product' : ok('gallery') ? 'gallery' : null;
    if (photo) out.push(photo);
  }
  if (owned.lotties > 0 && ok('lottie')) out.push('lottie');
  return out;
}

/** Scènes qui mettent en scène une sorte de média. */
const SHOWS: Record<string, keyof MediaCounts> = { product: 'images', gallery: 'images', footage: 'videos', showcase3d: 'models', lottie: 'lotties' };

/** Le concept tient-il avec ce que le projet peut montrer ? */
export function conceptFits(c: ConceptDef, ctx: Pick<ConceptContext, 'facts' | 'media' | 'type'>): boolean {
  if (c.id === 'logo-sting') return ctx.type === 'logo';
  if (ctx.type === 'logo') return false;
  if (ctx.type && ctx.type !== 'mix' && !(c.suits.types?.[ctx.type] && c.suits.types[ctx.type]! > 0)) return false;
  return !c.needs || c.needs.some((id) => available(id, ctx.facts, ctx.media));
}

export interface ScoredConcept {
  id: ConceptId;
  score: number;
}

/**
 * Les concepts possibles, classés. Ceux des trois dernières vidéos du projet sont
 * retirés (tant qu'il en reste au moins deux) : c'est le garde-fou contre « toutes
 * les vidéos racontent la même chose ».
 */
export function rankConcepts(ctx: ConceptContext): ScoredConcept[] {
  const recent = (ctx.recent || []).slice(-3);
  const scored = CONCEPT_IDS.map((id) => CONCEPTS[id])
    .filter((c) => conceptFits(c, ctx))
    .map((c) => {
      const s = c.suits;
      // Un concept qui met en scène ce que l'utilisateur a fourni (photos, clips, 3D…) passe devant.
      const usesOwned = !!ctx.owned && c.beats.some((beat) => beat.scenes.some((id) => SHOWS[id] && (ctx.owned![SHOWS[id]] || 0) > 0));
      // Au-delà des trois exclus, les concepts un peu plus anciens restent pénalisés (mémoire décroissante).
      const olderAt = (ctx.recent || []).slice(-6, -3).lastIndexOf(c.id);
      const older = olderAt >= 0 ? 0.6 + olderAt * 0.3 : 0;
      const score = 1 + (s.objectives?.[ctx.objective] || 0) * 1.5 + (ctx.type ? s.types?.[ctx.type] || 0 : 0) + (s.directions?.[ctx.direction] || 0) + (ctx.artStyleId ? s.arts?.[ctx.artStyleId.toLowerCase()] || 0 : 0) + (usesOwned ? 2 : 0) - Math.max(0, older) + (ctx.boosts?.[c.id] || 0);
      return { id: c.id, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const fresh = scored.filter((c) => !recent.includes(c.id));
  if (fresh.length >= 2 || fresh.length === scored.length) return fresh;
  // Trop peu de concepts possibles : on ne retire que le dernier.
  const last = recent[recent.length - 1];
  const almost = scored.filter((c) => c.id !== last);
  return almost.length ? almost : scored;
}

/** Choix déterministe (sans modèle) : tirage parmi les concepts proches du meilleur. */
export function pickConcept(ctx: ConceptContext): ConceptId {
  const ranked = rankConcepts(ctx);
  if (!ranked.length) return ctx.type === 'logo' ? 'logo-sting' : 'reasons';
  const best = ranked[0].score;
  const close = ranked.filter((c) => c.score >= best - 1);
  return close[Math.abs(ctx.seed >> 3) % close.length].id;
}

export interface ExpandedConcept {
  scenes: string[];
  /** Index de la scène du grand moment. */
  accent: number;
}

/**
 * Déplie un concept en scènes : à chaque temps, la première scène disponible ;
 * les temps facultatifs tombent si la durée est courte ; une vidéo longue reprend
 * les temps du cœur avec d'autres scènes ; les scènes du type demandé sont
 * garanties ; la signature termine toujours.
 */
export function expandConcept(conceptId: ConceptId, ctx: Pick<ConceptContext, 'durationSec' | 'facts' | 'media' | 'type' | 'owned'>): ExpandedConcept {
  const c = CONCEPTS[conceptId] || CONCEPTS.reasons;
  const [min, max] = sceneRange(ctx.durationSec);
  const ok = (id: string) => !!SCENES[id] && available(id, ctx.facts, ctx.media);
  const picked: { scene: string; beat: number; optional: boolean }[] = [];
  c.beats.forEach((beat, i) => {
    const prev = picked[picked.length - 1]?.scene;
    const scene = beat.scenes.find((id) => ok(id) && id !== prev);
    if (scene) picked.push({ scene, beat: i, optional: !!beat.optional });
    else if (!beat.optional && ok('statement') && prev !== 'statement') picked.push({ scene: 'statement', beat: i, optional: false });
  });
  // Trop de scènes pour la durée : les temps facultatifs partent d'abord (depuis la fin).
  while (picked.length + 1 > max) {
    const idx = [...picked].reverse().findIndex((p) => p.optional);
    if (idx < 0) break;
    picked.splice(picked.length - 1 - idx, 1);
  }
  while (picked.length + 1 > max) picked.splice(Math.max(1, picked.length - 2), 1);
  // Durée longue : les temps du cœur reviennent, avec leurs autres scènes.
  const core = c.beats.map((beat, i) => ({ beat, i })).filter(({ beat }) => !beat.scenes.includes('cta') && !beat.scenes.includes('hook'));
  let guard = 0;
  while (picked.length + 1 < min && core.length && guard < 24) {
    const { beat, i } = core[guard % core.length];
    const options = beat.scenes.filter(ok);
    const scene = options[(Math.floor(guard / core.length) + 1) % Math.max(1, options.length)] || options[0];
    guard++;
    if (!scene) continue;
    const at = picked[picked.length - 1]?.scene === 'cta' ? picked.length - 1 : picked.length;
    if (picked[at - 1]?.scene === scene || picked[at]?.scene === scene) continue;
    picked.splice(at, 0, { scene, beat: i, optional: true });
  }
  // Toujours trop court (concept bref, vidéo longue) : des scènes de texte encore inutilisées,
  // avant l'appel à l'action, jamais deux fois de suite.
  for (const id of ['statement', 'benefits', 'kinetic', 'wordswap', 'stat', 'quote']) {
    if (picked.length + 1 >= min) break;
    if (!ok(id) || picked.some((p) => p.scene === id)) continue;
    const ctaAt = picked.findIndex((p) => p.scene === 'cta');
    const at = ctaAt > 0 ? ctaAt : picked.length;
    if (picked[at - 1]?.scene === id) continue;
    picked.splice(at, 0, { scene: id, beat: -3, optional: true });
  }

  // Le type demandé doit se voir, et les médias de l'utilisateur être montrés :
  // leurs scènes sont garanties (avant l'appel à l'action), dans la limite de ce que
  // la durée permet — par priorité : signature du type, 3D, clips, photos, animation.
  for (const id of ensureList(ctx).slice(0, mediaCapacity(ctx.durationSec))) {
    if (picked.some((p) => p.scene === id) || !ok(id)) continue;
    const at = Math.max(1, picked.findIndex((p) => p.scene === 'cta'));
    const replace = picked.findIndex((p, k) => k > 0 && p.optional);
    if (replace >= 0 && picked.length + 1 >= max) picked[replace] = { scene: id, beat: picked[replace].beat, optional: false };
    else picked.splice(at < 1 ? picked.length : at, 0, { scene: id, beat: -1, optional: false });
  }
  // Certains types se reconnaissent à la répétition (deux animations, deux clips) dès 15 s.
  const repeat = ctx.type ? TYPE_REPEAT[ctx.type] : undefined;
  if (repeat && ctx.durationSec >= 15 && ok(repeat) && picked.filter((p) => p.scene === repeat).length === 1) {
    const first = picked.findIndex((p) => p.scene === repeat);
    const ctaAt = picked.findIndex((p) => p.scene === 'cta');
    let at = ctaAt > first + 1 ? ctaAt : picked.length;
    if (at === first + 1) at = Math.min(picked.length, first + 2);
    if (picked.length + 1 >= max) {
      const k = picked.findIndex((p, i) => i > 0 && i !== first && p.optional && p.scene !== repeat);
      if (k >= 0) picked.splice(k, 1);
      if (k >= 0 && k < at) at--;
    }
    if (picked[at - 1]?.scene !== repeat && picked[at]?.scene !== repeat) picked.splice(at, 0, { scene: repeat, beat: -2, optional: false });
  }
  if (!picked.length) picked.push({ scene: 'hook', beat: 0, optional: false });
  // Les scènes garanties ont pu dépasser : on retire d'abord le facultatif, puis le texte du milieu.
  const guaranteed = new Set(ensureList(ctx).slice(0, mediaCapacity(ctx.durationSec)));
  if (repeat) guaranteed.add(repeat);
  while (picked.length + 1 > max) {
    let k = picked.findIndex((p, i) => i > 0 && p.optional && !guaranteed.has(p.scene));
    if (k < 0) k = picked.findIndex((p, i) => i > 0 && !guaranteed.has(p.scene) && p.scene !== 'cta');
    if (k < 0) k = picked.findIndex((p, i) => i > 0 && p.scene === 'cta');
    if (k < 0) break;
    picked.splice(k, 1);
  }
  const scenes = [...picked.map((p) => p.scene), 'logo'];
  const accentIdx = picked.findIndex((p) => p.beat === c.accent);
  return { scenes, accent: accentIdx >= 0 ? accentIdx : Math.min(1, scenes.length - 2) };
}

/** Combien de scènes « garanties » une durée peut porter (ouverture, appel à l'action et signature à part). */
export function mediaCapacity(durationSec: number): number {
  const [, max] = sceneRange(durationSec);
  return Math.max(1, max - 2 - (max >= 5 ? 1 : 0));
}

function ensureList(ctx: Pick<ConceptContext, 'facts' | 'media' | 'type' | 'owned'>): string[] {
  const list = [...(ctx.type ? TYPE_SIGNATURE[ctx.type] || [] : []), ...mustShowScenes(ctx.owned, ctx.facts, ctx.media)];
  return [...new Set(list)];
}

/**
 * Garantit des scènes dans un enchaînement déjà fait (celui du modèle) : chacune est
 * insérée avant l'appel à l'action, sans doublon consécutif, dans la limite de la durée.
 */
export function ensureScenes(scenes: string[], required: string[], durationSec: number): string[] {
  const [, max] = sceneRange(durationSec);
  const out = scenes.filter((s) => s !== 'logo');
  for (const id of required.slice(0, mediaCapacity(durationSec))) {
    if (out.includes(id)) continue;
    const ctaAt = out.indexOf('cta');
    const at = ctaAt > 0 ? ctaAt : out.length;
    out.splice(at, 0, id);
    // Trop long : on retire une scène de texte du milieu (jamais une scène garantie, ni l'ouverture).
    if (out.length + 1 > max) {
      const drop = out.findIndex((s, k) => k > 0 && !required.includes(s) && s !== 'cta' && ['statement', 'wordswap', 'kinetic', 'stat', 'benefits'].includes(s));
      if (drop > 0) out.splice(drop, 1);
    }
  }
  const dedup = out.filter((s, k) => s !== out[k - 1]);
  while (dedup.length + 1 > max) {
    const drop = dedup.findIndex((s, k) => k > 0 && !required.includes(s) && s !== 'cta');
    dedup.splice(drop > 0 ? drop : dedup.length - 1, 1);
  }
  return [...dedup, 'logo'];
}

/** Consignes de texte du concept (fusionnées dans le plan de copie). */
export function conceptCopyHints(conceptId: ConceptId | undefined): Record<string, Record<string, string>> {
  return (conceptId && CONCEPTS[conceptId]?.copy) || {};
}

/** Le type d'une vidéo décrite librement, d'après son concept et ses scènes. */
export function typeOfScenes(conceptId: ConceptId, scenes: string[]): VideoType {
  const has = (id: string) => scenes.includes(id);
  const techniques = new Set(scenes.filter((s) => ['showcase3d', 'footage', 'lottie', 'gallery', 'product', 'kinetic'].includes(s)).map((s) => (s === 'gallery' ? 'product' : s)));
  if (conceptId === 'logo-sting') return 'logo';
  if (techniques.size >= 3) return 'mix';
  if (has('showcase3d')) return 'showcase3d';
  if (scenes.filter((s) => s === 'footage').length >= 2) return 'footage';
  if (has('gallery') && !has('product')) return 'slideshow';
  if (has('lottie')) return 'illustrated';
  if (has('offer')) return 'promo';
  if (has('product')) return 'product';
  return techniques.size >= 2 ? 'mix' : 'kinetic';
}
