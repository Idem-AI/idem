/**
 * LE SCÉNARIO DE L'UTILISATEUR, SUIVI — et le contrôle qui le prouve.
 *
 * Quand l'utilisateur écrit son film scène par scène (`RequestSpec.mode === 'script'`), le film
 * n'est plus inventé : il est DÉCOUPÉ. Chaque scène garde son minutage (ramené à la durée
 * achetée), ses textes à l'écran mot pour mot, et devient un à trois plans, un par support :
 *
 *   footage  plan filmé (clip généré, sinon vidéo libre, sinon image animée) — scène `footage` ;
 *   screen   l'interface du produit (capture de la marque, sinon interface dessinée avec les
 *            textes de la demande) — scène `screen` ;
 *   motion   motion design (typographie, formes) — scène `statement`, ou `kinetic` pour une
 *            suite de mots courts (« Analyse. », « Construis. »…) ;
 *   logo     la signature — scène `logo` (phrase et adresse web).
 *
 * Aux crans Low à Max, ce découpage est fait par le code (`planScriptShots`) ; au cran Ultra, le
 * directeur IA découpe lui-même, sous les mêmes règles (video.author.ts). Dans les deux cas,
 * `checkFidelity` compare le film au scénario : scènes, textes, minutage, plans filmés, langue.
 */
import { detectLanguage } from '../text/language';
import { normText, RequestSpec, sameText, sceneTimeline, SpecMedium } from './video.request';
import type { VideoStoryboard } from './video.model';

/** Un plan du film tel que le scénario le demande. */
export interface ScriptShot {
  /** Index de la scène du scénario. */
  scene: number;
  medium: SpecMedium;
  /** Scène du moteur qui le compose (et sa composition de repli). */
  sceneId: string;
  duration: number;
  /** Textes de l'utilisateur, mot pour mot, dans les cases de la scène. */
  slots: Record<string, string>;
  /** Plan filmé : ce que le générateur doit filmer (anglais) et la requête de banque de vidéos. */
  footage?: string;
  query?: string;
  /** Interface : les textes DANS l'écran (dossier, saisie) et ce que la scène décrit (choix de la capture). */
  props?: string[];
  hint?: string;
  /** Le fond demandé en toutes lettres (« écran noir », « fond sombre ») : profond. */
  surface?: 'deep';
}

/** Scène du moteur d'un support. */
export const SCENE_OF_MEDIUM: Record<SpecMedium, string> = { footage: 'footage', screen: 'screen', motion: 'statement', logo: 'logo' };

const wordsOf = (t: string) => String(t || '').split(/\s+/).filter(Boolean).length;
const isUrl = (t: string) => /^(?:https?:\/\/|www\.)\S+$|^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i.test(t.trim());
const isPhone = (t: string) => /^\+?[\d\s().-]{8,}$/.test(t.trim());

/**
 * Un texte trop long pour une ligne de titre se coupe à la fin d'une phrase (jamais au milieu
 * d'un mot) : « Avoir une idée, c'est facile. » / « Construire un business, c'est une autre histoire. »
 */
export function splitText(text: string, max = 64): [string, string?] {
  const t = text.trim();
  if (t.length <= max) return [t];
  const cut = [...t.matchAll(/[.!?…](?=\s+\S)/g)].map((m) => (m.index ?? 0) + 1).filter((i) => i >= 12 && t.length - i >= 8);
  if (cut.length) {
    const best = cut.reduce((a, b) => (Math.abs(b - t.length / 2) < Math.abs(a - t.length / 2) ? b : a));
    return [t.slice(0, best).trim(), t.slice(best).trim()];
  }
  const comma = [...t.matchAll(/[,;:—–](?=\s)/g)].map((m) => (m.index ?? 0) + 1).filter((i) => i >= 12 && t.length - i >= 8);
  if (comma.length) {
    const best = comma.reduce((a, b) => (Math.abs(b - t.length / 2) < Math.abs(a - t.length / 2) ? b : a));
    return [t.slice(0, best).trim(), t.slice(best).trim()];
  }
  return [t];
}

/**
 * Les textes d'un plan dans les cases de sa scène — MOT POUR MOT : jamais raccourcis ni réécrits
 * (le moteur ajuste la taille ; un texte trop long se partage entre titre et sous-titre).
 */
export function textSlots(sceneId: string, texts: string[], brandName = ''): Record<string, string> {
  const list = texts.map((t) => t.trim()).filter(Boolean);
  if (!list.length) return {};
  if (sceneId === 'logo') {
    const out: Record<string, string> = {};
    const url = list.find((t) => isUrl(t) || isPhone(t));
    // Le premier texte, s'il a l'allure d'un nom (« IDEM »), est le nom de la marque : celui de la
    // charte (le logo le montre déjà) ou, s'il diffère, celui que le scénario veut voir signer.
    const first = list[0];
    const nameLike = !!first && first !== url && wordsOf(first) <= 3 && first.length <= 32 && !/[.!?…:]$/.test(first);
    const name = nameLike && list.length > 1 && !(brandName && sameText(first, brandName)) ? first : undefined;
    const tagline = list.find((t) => t !== url && t !== name && !(brandName && sameText(t, brandName)));
    if (name) out.name = name;
    if (tagline) out.tagline = tagline;
    if (url) out.url = url;
    return out;
  }
  if (sceneId === 'kinetic') return Object.fromEntries(list.slice(0, 4).map((t, i) => [`l${i + 1}`, t]));
  if (list.length >= 2) return { title: list[0], sub: list.slice(1).join(' ') };
  const [title, sub] = splitText(list[0], sceneId === 'footage' ? 48 : 64);
  return sub ? { title, sub } : { title };
}

/** Les textes de l'utilisateur rangés dans les cases d'une scène, dans l'ordre (pour les contrôles). */
export function slotTexts(sceneId: string, slots: Record<string, string>): string[] {
  const keys = sceneId === 'kinetic' ? ['l1', 'l2', 'l3', 'l4'] : sceneId === 'logo' ? ['name', 'tagline', 'url'] : ['title', 'sub', 'kicker', 'name', 'tagline', 'action', 'contact', 'caption', 'l1', 'l2', 'l3', 'l4', 'lead', 'w1', 'w2', 'w3', 'quote', 'value', 'label', 'b1', 'b2', 'b3'];
  return keys.map((k) => slots[k]).filter((v): v is string => !!v && !!v.trim());
}

const BLACK_CUE = /[ée]cran noir|fond noir|fond sombre|fond tr[èe]s sombre|black screen|dark background|fade to black|noir total/i;

/**
 * Le découpage du scénario en plans (crans Low à Max). Une scène courte garde un plan (son support
 * principal, ses textes) ; une scène longue en prend deux ou trois, dans l'ordre où elle les
 * décrit ; une suite de mots courts devient un plan par mot quand le temps le permet. Un plan
 * filmé de plus que le plafond de clips devient un plan de motion design (et le contrôle le dit).
 */
export function planScriptShots(spec: RequestSpec, total: number, opts: { maxClips: number; hasScreens: boolean; brandName?: string }): ScriptShot[] {
  const timeline = sceneTimeline(spec, total);
  const shots: ScriptShot[] = [];
  let clips = 0;
  spec.scenes.forEach((scene, k) => {
    const D = timeline[k].duration;
    const texts = scene.texts;
    const dark = BLACK_CUE.test(scene.description);
    if (scene.media[0] === 'logo') {
      shots.push({ scene: k, medium: 'logo', sceneId: 'logo', duration: D, slots: textSlots('logo', texts, opts.brandName), ...(dark ? { surface: 'deep' as const } : {}) });
      return;
    }
    const footageOk = () => clips < opts.maxClips;
    const base = (medium: SpecMedium, duration: number, shotTexts: string[], extra: Partial<ScriptShot> = {}): ScriptShot => {
      let m = medium;
      if (m === 'footage' && !footageOk()) m = scene.media.includes('screen') && opts.hasScreens ? 'screen' : 'motion';
      if (m === 'footage') clips++;
      const sceneId = m === 'motion' && shotTexts.length >= 3 && shotTexts.every((t) => wordsOf(t) <= 3) ? 'kinetic' : SCENE_OF_MEDIUM[m];
      return {
        scene: k,
        medium: m,
        sceneId,
        duration: duration,
        slots: textSlots(sceneId, shotTexts, opts.brandName),
        ...(m === 'footage' ? { footage: scene.footage || scene.description.slice(0, 400), ...(scene.query ? { query: scene.query } : {}) } : {}),
        ...(m === 'screen' ? { props: scene.props, hint: scene.description.slice(0, 300) } : {}),
        // « Écran noir. Texte : … » : le texte se pose sur le fond profond que la scène demande.
        ...(dark && m === 'motion' && shotTexts.length ? { surface: 'deep' as const } : {}),
        ...extra,
      };
    };

    // Une suite de mots courts (« Analyse. » « Construis. » « Crée. » « Lance-toi. ») : un plan par
    // mot, chacun sur une interface du produit quand il y en a, sinon une seule rafale typographique.
    const burst = texts.length >= 3 && texts.every((t) => wordsOf(t) <= 3);
    if (burst) {
      if (D >= texts.length * 2.2) {
        const per = D / texts.length;
        texts.forEach((t, i) => shots.push(base(scene.media.includes('screen') && opts.hasScreens && i % 2 === 0 ? 'screen' : 'motion', per, [t])));
      } else shots.push(base('motion', D, texts));
      return;
    }

    let segs = [...new Set(scene.media.filter((m) => m !== 'logo'))];
    if (!segs.length) segs = ['motion'];
    const maxSegs = D < 5.5 ? 1 : D < 9 ? 2 : 3;
    const black = BLACK_CUE.test(scene.description);
    if (segs.length > maxSegs) {
      // Les textes ont besoin d'un plan pour eux quand la scène finit sur un écran noir.
      const keepMotion = texts.length && segs.includes('motion') && black;
      segs = keepMotion ? [...segs.filter((m) => m !== 'motion').slice(0, maxSegs - 1), 'motion'] : segs.slice(0, maxSegs);
    }
    // Où se posent les textes : sur l'écran noir s'il y en a un ; un texte seul vit SUR le plan filmé
    // (le motion design du titre l'anime) ; sinon sur le motion design, sinon sur le dernier plan.
    let textAt = segs.length - 1;
    if (texts.length && black && segs.includes('motion')) textAt = segs.lastIndexOf('motion');
    else if (texts.length === 1 && segs.includes('footage')) textAt = segs.indexOf('footage');
    else if (segs.includes('motion')) textAt = segs.lastIndexOf('motion');
    // Un plan de motion design sans texte ne montrerait rien : son temps revient aux autres plans.
    const keep = segs.map((m, i) => !(m === 'motion' && i !== textAt && segs.length > 1));
    const kept = segs.filter((_, i) => keep[i]);
    textAt = kept.indexOf(segs[textAt]) >= 0 ? kept.lastIndexOf(segs[textAt]) : kept.length - 1;
    segs = kept;
    const weight = (m: SpecMedium) => (m === 'footage' ? 1.3 : m === 'screen' ? 1.1 : 1);
    const weights = segs.map(weight);
    const sum = weights.reduce((a, b) => a + b, 0);
    segs.forEach((m, i) => shots.push(base(m, (D * weights[i]) / sum, i === textAt ? texts : [])));
  });
  // Durées arrondies, total exact.
  let acc = 0;
  shots.forEach((s) => {
    s.duration = Math.round(s.duration * 1000) / 1000;
    acc += s.duration;
  });
  if (shots.length) shots[shots.length - 1].duration = Math.round((shots[shots.length - 1].duration + total - acc) * 1000) / 1000;
  return shots;
}

// ─── Le contrôle de fidélité ────────────────────────────────────────────────

export interface FidelityReport {
  mode: 'script' | 'brief';
  language: string;
  /** Scènes du scénario présentes dans le film. */
  scenes: { expected: number; kept: number };
  /** Textes de l'utilisateur montrés mot pour mot ; ceux qui manquent ; ceux que le film ajoute. */
  texts: { expected: number; shown: number; missing: string[]; added: string[] };
  /** Plans filmés demandés et ce qu'ils sont devenus. */
  footage: { wanted: number; generated: number; stock: number; stills: number; missing: number };
  /** Écart maximal (s) entre le minutage d'une scène et celui du film. */
  drift: number;
  /** Ce qu'il faut dire à l'utilisateur (français), une phrase par écart. */
  notes: string[];
  /** Les mêmes écarts, en clés d'interface (traduites par l'application). */
  codes: { key: string; params?: Record<string, string | number> }[];
}

/**
 * Le film comparé à la demande. `media` dit d'où vient le média de chaque plan filmé
 * (`generated`, `pexels`, `upload`…) ; `blocked` dit pourquoi la génération n'a pas pu se faire.
 */
export function checkFidelity(
  spec: RequestSpec,
  storyboard: VideoStoryboard,
  opts: { brandName?: string; total: number; originOf?: (url: string) => string | undefined; blocked?: string; voice?: { requested: boolean; language?: string; enabled?: boolean } }
): FidelityReport {
  const scenes = storyboard.scenes;
  const shown = new Set<string>();
  const all: string[] = [];
  for (const sc of scenes) {
    const texts = slotTexts(sc.sceneId, sc.slots);
    for (const t of texts) {
      shown.add(normText(t));
      all.push(t);
    }
    // Un texte long partagé entre titre et sous-titre reste le texte de l'utilisateur.
    if (texts.length > 1) shown.add(normText(texts.join(' ')));
  }
  // La signature montre le nom de la marque par son logo.
  if (opts.brandName && scenes.some((sc) => sc.sceneId === 'logo')) shown.add(normText(opts.brandName));
  const isShown = (t: string) => shown.has(normText(t)) || [...shown].some((s) => s.includes(normText(t)) && normText(t).length >= 4);
  const expected = [...spec.scenes.flatMap((s) => s.texts), ...spec.texts];
  const missing = expected.filter((t) => !isShown(t));
  const knownTexts = new Set(expected.map(normText));
  // (Un morceau d'un texte de l'utilisateur — titre ou sous-titre d'un texte partagé — n'est pas un ajout.)
  const props = new Set(spec.scenes.flatMap((s) => s.props).map(normText));
  // En scénario, aucun texte ajouté (« ne pas ajouter de texte ») : tout texte du film vient de la demande.
  const added =
    spec.mode === 'script'
      ? all.filter((t) => {
          const n = normText(t);
          return !knownTexts.has(n) && !props.has(n) && ![...knownTexts].some((k) => k.includes(n) || n.includes(k)) && !(opts.brandName && sameText(t, opts.brandName));
        })
      : [];

  // Minutage : chaque scène du scénario contre ses plans.
  let drift = 0;
  if (spec.mode === 'script') {
    const timeline = sceneTimeline(spec, opts.total);
    spec.scenes.forEach((_, k) => {
      const own = scenes.filter((sc) => sc.script?.scene === k);
      if (!own.length) return;
      const start = Math.min(...own.map((sc) => sc.start));
      const dur = own.reduce((a, sc) => a + sc.duration, 0);
      drift = Math.max(drift, Math.abs(start - timeline[k].start), Math.abs(dur - timeline[k].duration));
    });
  }
  const kept = spec.mode === 'script' ? new Set(scenes.map((sc) => sc.script?.scene).filter((x): x is number => x != null)).size : 0;

  // Plans filmés : ceux que le film a PRÉVUS (découpage du code ou du directeur), et ce que chacun montre vraiment.
  const filmed = scenes.filter((sc) => sc.script?.medium === 'footage');
  const wantedFootage = filmed.length;
  let generated = 0;
  let stock = 0;
  let stills = 0;
  for (const sc of filmed) {
    const origin = sc.video ? opts.originOf?.(sc.video) : sc.image ? opts.originOf?.(sc.image) : undefined;
    if (sc.video && origin === 'generated') generated++;
    else if (sc.video) stock++;
    else if (sc.image) stills++;
  }
  const missingFootage = filmed.filter((sc) => !sc.video && !sc.image).length;

  // La langue des textes du film (au moins quelques mots pour trancher).
  const textLang = detectLanguage(all.filter((t) => !isUrl(t)).join(' '));

  const notes: string[] = [];
  const codes: FidelityReport['codes'] = [];
  const note = (key: string, text: string, params?: Record<string, string | number>) => {
    notes.push(text);
    codes.push({ key, ...(params ? { params } : {}) });
  };
  if (spec.unsupported.includes('4K')) note('fidelity.4k', 'La 4K n’est pas disponible : la vidéo est rendue en 1080p, la meilleure qualité proposée.');
  const fps = spec.unsupported.find((u) => /fps/.test(u));
  if (fps) note('fidelity.fps', `${fps.replace('fps', 'i/s')} n’est pas disponible : la vidéo est rendue à 30 images par seconde.`, { fps: fps.replace(/\D/g, '') });
  if (spec.durationSec && Math.abs(spec.durationSec - opts.total) >= 1) note('fidelity.duration', `Votre scénario dure ${spec.durationSec} s et la vidéo ${opts.total} s (durée choisie) : chaque scène a gardé sa part du temps.`, { asked: spec.durationSec, made: opts.total });
  if (missing.length) note('fidelity.textsMissing', `Textes non placés : ${missing.map((t) => `« ${t} »`).join(', ')}.`, { count: missing.length });
  if (added.length) note('fidelity.textsAdded', `Textes ajoutés au scénario : ${added.map((t) => `« ${t} »`).join(', ')}.`, { count: added.length });
  // Les plans filmés qui ne sont pas des clips générés : la cause (si on la connaît), puis chaque remplacement.
  if (wantedFootage && (stock || stills || missingFootage)) {
    if (opts.blocked) note(`fidelity.footageBlocked.${opts.blocked}`, opts.blocked === 'payment' ? 'Le service de génération vidéo n’a plus de crédits : les plans filmés ont été remplacés. Relancez la création quand il sera rechargé.' : 'Le service de génération vidéo est indisponible : les plans filmés ont été remplacés. Relancez la création quand il sera revenu.');
    if (stock) note('fidelity.footageStock', `${stock} plan(s) filmé(s) remplacé(s) par des vidéos libres de droits.`, { count: stock });
    if (stills) note('fidelity.footageStills', `${stills} plan(s) filmé(s) montré(s) en images animées.`, { count: stills });
    if (missingFootage) note('fidelity.footageMissing', `${missingFootage} plan(s) filmé(s) composé(s) en motion design, faute de vidéo.`, { count: missingFootage });
  }
  if (textLang && textLang.code !== spec.language.slice(0, 2) && textLang.confidence >= 0.3) note('fidelity.language', `Certains textes ne sont pas en ${spec.language} : vérifiez-les avant l’export.`, { language: spec.language });
  if (opts.voice?.requested && opts.voice.enabled === false) note('fidelity.voice', 'La voix off n’a pas pu être générée dans la langue de la vidéo.', { language: spec.language });
  if (spec.mode === 'script' && kept < spec.scenes.length) note('fidelity.scenes', `${spec.scenes.length - kept} scène(s) du scénario manquent au film.`, { count: spec.scenes.length - kept });

  return {
    mode: spec.mode,
    language: spec.language,
    scenes: { expected: spec.scenes.length, kept },
    texts: { expected: expected.length, shown: expected.length - missing.length, missing, added },
    footage: { wanted: wantedFootage, generated, stock, stills, missing: missingFootage },
    drift: Math.round(drift * 100) / 100,
    notes,
    codes,
  };
}
