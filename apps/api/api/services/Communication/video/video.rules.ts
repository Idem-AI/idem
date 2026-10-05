/**
 * LES BONNES PRATIQUES, TOUJOURS APPLIQUÉES.
 *
 * Les règles de motion design et de vidéo sociale trouvées dans les sources (voir
 * docs/MOTION_VIDEO.md et docs/VIDEO_ENGINE.md §13) ne vivent pas dans un prompt :
 * elles sont vérifiées ici, sur CHAQUE storyboard, après tous les choix (modèle,
 * graphe, rythme, grand moment). Ce qui peut être réparé l'est (durées, tempo) ;
 * le reste est signalé dans le rapport de la vidéo et fait échouer les contrôles.
 *
 *   hook-first-seconds   l'accroche arrive tout de suite et tient 1,6 à 4 s
 *   reading-time         chaque texte reste à l'écran le temps d'être lu (≤ 3 mots/s)
 *   min-hold             aucune scène de texte sous 1,6 s, aucune au-delà de 7 s
 *   logo-hold            la signature tient au moins 1,5 s (2,2 s dès 15 s)
 *   entrance-duration    entrées entre 0,3 et 1,2 s (vif sans être expédié)
 *   exit-shorter         sorties plus courtes que les entrées (≈ 2/3) — garanti par le moteur
 *   no-linear            aucune courbe linéaire — garanti par les directions
 *   one-accent           un seul grand moment
 *   call-to-action       un appel à l'action quand l'objectif en demande un
 *   sound-off            chaque scène porte son texte : la vidéo se comprend sans le son
 *   cuts-on-beat         les coupes tombent sur le temps quand la musique en a un (cède à la lecture)
 *   ends-on-brand        la vidéo finit sur la marque
 */
import { VideoObjective, VideoStoryboard } from '../../../models/motionVideo.model';
import { DIRECTIONS, isMotionDirection } from './video.direction';
import { fitLength } from './video.copy';

export interface RuleIssue {
  rule: string;
  scene?: string;
  detail: string;
}

export interface RulesReport {
  checked: string[];
  repaired: RuleIssue[];
  issues: RuleIssue[];
  /** Règles secondaires cédées à une règle prioritaire (ex. : coupe hors temps pour garder la lecture). */
  warnings: RuleIssue[];
}

export const RULES: { id: string; statement: string; source: string }[] = [
  { id: 'hook-first-seconds', statement: "L'accroche se lit dès la première seconde et tient 1,6 à 4 s.", source: 'Hooks des 3 premières secondes (CapCut, Teleprompter.com, 2026)' },
  { id: 'reading-time', statement: 'Un texte reste à l’écran le temps d’être lu : au plus 3 mots par seconde, entrée comprise.', source: 'University of Melbourne, Video captioning style guide (180 mots/min)' },
  { id: 'min-hold', statement: 'Aucune scène de texte sous 1,6 s, aucune au-delà de 7 s.', source: 'Netflix timed text guidance (5/6 s à 7 s), Melbourne (≥ 2 s par phrase)' },
  { id: 'logo-hold', statement: 'La signature tient au moins 1,5 s (2,2 s pour 15 s et plus).', source: 'Pratique de la signature de marque en fin de spot' },
  { id: 'entrance-duration', statement: 'Les entrées durent entre 0,3 et 1,2 s.', source: 'Material Design 3, Easing and duration (200-500 ms, entrée ≈ 400 ms)' },
  { id: 'exit-shorter', statement: 'Les sorties sont plus courtes que les entrées (≈ 2/3).', source: 'Material Design 3 (sortie ≈ 200 ms pour une entrée de 400 ms)' },
  { id: 'no-linear', statement: 'Aucune courbe linéaire : sortie amortie à l’entrée, accélérée à la sortie.', source: 'Material Design 3, Easing and duration' },
  { id: 'one-accent', statement: 'Un seul grand moment par vidéo.', source: 'Hiérarchie : une seule chose compte à la fois' },
  { id: 'call-to-action', statement: 'Un appel à l’action clair quand l’objectif est de vendre, d’inviter ou d’ouvrir.', source: 'Bonnes pratiques Reels / Shorts 2026' },
  { id: 'sound-off', statement: 'Chaque scène porte son texte : la vidéo se comprend sans le son.', source: 'La plupart des vidéos sociales sont regardées sans le son (Teleprompter.com, Opus, 2026)' },
  { id: 'cuts-on-beat', statement: 'Les coupes tombent sur le temps quand la musique a un tempo.', source: 'Montage musical : coupe sur le temps' },
  { id: 'ends-on-brand', statement: 'La vidéo finit sur la marque.', source: 'Signature de marque' },
];

const CTA_OBJECTIVES: VideoObjective[] = ['promotion', 'event', 'opening', 'product', 'recruitment'];
const TEXT_SLOTS = ['title', 'sub', 'l1', 'l2', 'l3', 'l4', 'b1', 'b2', 'b3', 'value', 'label', 'quote', 'name', 'tagline', 'action', 'price', 'lead', 'w1', 'w2', 'w3', 'date', 'time', 'place', 'offer'];

/** Mots à lire : un nombre et son unité (« 1 000 F », « -30 % », « 24 h ») comptent pour un. */
const words = (slots: Record<string, string>) =>
  TEXT_SLOTS.map((k) => slots[k])
    .filter(Boolean)
    .join(' ')
    .replace(/[-+]?\d[\d\s.,:/]*\d?\s*(%|F|FCFA|CFA|€|\$|h|min|km|kg|cl|ml)?(?=\s|$)/gi, ' N ')
    .split(/\s+/)
    .filter(Boolean).length;

/** Temps minimal d'une scène : entrée + lecture à 3 mots/s + un souffle. */
export function requiredHold(slots: Record<string, string>, sceneId: string, enter: number): number {
  if (sceneId === 'logo') return 0;
  const n = words(slots);
  if (!n) return sceneId === 'footage' || sceneId === 'gallery' || sceneId === 'showcase3d' || sceneId === 'lottie' ? 1.4 : 1.2;
  return Math.max(1.6, enter + n / 3 + 0.3);
}

/** Vérifie et répare un storyboard. Mutation en place des durées et du tempo. */
export function applyRules(sb: VideoStoryboard, opts: { objective?: VideoObjective } = {}): RulesReport {
  const report: RulesReport = { checked: RULES.map((r) => r.id), repaired: [], issues: [], warnings: [] };
  const scenes = sb.scenes;
  if (!scenes.length) return report;
  const d = DIRECTIONS[isMotionDirection(sb.direction) ? sb.direction : 'editorial'];
  const artPace = sb.art?.pace && sb.art.pace > 0.6 && sb.art.pace < 1.6 ? sb.art.pace : 1;

  // entrance-duration : le tempo de chaque scène ramené dans [0,3 ; 1,2] s.
  for (const sc of scenes) {
    const enter = d.pacing.enter * artPace * (sc.pace || 1) * (sc.accent === 'hold' ? 1.45 : 1);
    if (enter < 0.3 || enter > 1.2) {
      const target = Math.min(1.2, Math.max(0.3, enter));
      sc.pace = Math.round(((sc.pace || 1) * target) / enter * 100) / 100;
      report.repaired.push({ rule: 'entrance-duration', scene: sc.key, detail: `${enter.toFixed(2)} s → ${target.toFixed(2)} s` });
    }
  }

  // one-accent
  const accents = scenes.filter((s) => s.accent);
  if (accents.length > 1) {
    accents.slice(1).forEach((s) => delete s.accent);
    report.repaired.push({ rule: 'one-accent', detail: `${accents.length} grands moments → 1` });
  }

  // reading-time, min-hold, logo-hold, hook-first-seconds : bornes par scène, puis répartition.
  const total = sb.durationSec;
  const bounds = () =>
    sb.scenes.map((sc, i) => {
      const lastOne = i === sb.scenes.length - 1;
      const enter = d.pacing.enter * artPace * (sc.pace || 1);
      const media = ['footage', 'gallery', 'showcase3d', 'product', 'lottie'].includes(sc.sceneId);
      let lo = requiredHold(sc.slots, sc.sceneId, enter);
      let hi = media ? 9 : 7;
      if (lastOne && sc.sceneId === 'logo') {
        lo = total >= 15 ? 2.2 : 1.5;
        hi = total >= 30 ? 5 : 4;
      }
      if (i === 0) hi = Math.min(hi, 4);
      return { lo: Math.min(lo, total * 0.6), hi: Math.max(hi, lo) };
    });
  // Trop de texte pour la durée : la scène la moins essentielle part (jamais l'ouverture,
  // la signature, l'appel à l'action ni une scène qui montre les médias de l'utilisateur).
  // D'abord le texte secondaire (sous-titre, petit libellé, note), puis une scène entière.
  const SECONDARY = ['kicker', 'sub', 'note', 'tagline', 'label'];
  if (bounds().reduce((a, x) => a + x.lo, 0) > total + 0.01) {
    for (const sc of sb.scenes) {
      for (const k of SECONDARY) {
        if (!sc.slots[k] || (sc.sceneId === 'stat' && k === 'label')) continue;
        delete sc.slots[k];
        report.repaired.push({ rule: 'reading-time', scene: sc.key, detail: `texte secondaire « ${k} » retiré (vidéo courte)` });
        if (bounds().reduce((a, x) => a + x.lo, 0) <= total + 0.01) break;
      }
      if (bounds().reduce((a, x) => a + x.lo, 0) <= total + 0.01) break;
    }
  }
  const EXPENDABLE = ['wordswap', 'statement', 'stat', 'kinetic', 'quote', 'benefits', 'gallery'];
  for (let guard = 0; guard < 4; guard++) {
    const b = bounds();
    if (b.reduce((a, x) => a + x.lo, 0) <= total + 0.01 || sb.scenes.length <= 3) break;
    let victim = -1;
    for (const id of EXPENDABLE) {
      victim = sb.scenes.findIndex((sc, i) => i > 0 && i < sb.scenes.length - 1 && sc.sceneId === id && !sc.accent);
      if (victim > 0) break;
    }
    if (victim <= 0) break;
    report.repaired.push({ rule: 'reading-time', scene: sb.scenes[victim].key, detail: 'trop de texte pour la durée : scène retirée' });
    sb.scenes.splice(victim, 1);
  }
  // Dernier recours (vidéo très courte) : le texte principal le plus long est raccourci au mot.
  for (let guard = 0; guard < 12 && bounds().reduce((a, x) => a + x.lo, 0) > total + 0.01; guard++) {
    const bb = bounds();
    let worst = -1;
    let worstGap = 0;
    sb.scenes.forEach((sc, i) => {
      const gap = bb[i].lo - total / sb.scenes.length;
      if (sc.sceneId !== 'logo' && gap > worstGap) {
        worst = i;
        worstGap = gap;
      }
    });
    if (worst < 0) break;
    const sc = sb.scenes[worst];
    const key = ['title', 'l1', 'quote', 'action', 'name', 'b3', 'b2'].filter((k) => sc.slots[k]).sort((x, y) => sc.slots[y].length - sc.slots[x].length)[0];
    const wordsOf = key ? sc.slots[key].split(/\s+/) : [];
    if (!key || wordsOf.length <= 2) break;
    // Coupe propre (au mot, sans « de », « qui », « et » en bout de phrase) : celle de la copie.
    const shorter = fitLength(sc.slots[key], Math.max(10, Math.floor(sc.slots[key].length * 0.8)));
    if (!shorter || shorter === sc.slots[key] || shorter.split(/\s+/).length < 2) break;
    sc.slots[key] = shorter;
    report.repaired.push({ rule: 'reading-time', scene: sc.key, detail: `« ${key} » raccourci (vidéo courte)` });
  }
  const b = bounds();
  const n = sb.scenes.length;
  const sumLo = b.reduce((a, x) => a + x.lo, 0);
  // La signature et les médias peuvent s'allonger un peu si les scènes manquent.
  const sumHi = b.reduce((a, x) => a + x.hi, 0);
  if (sumHi < total) {
    sb.scenes.forEach((sc, i) => {
      if (i === n - 1 || ['footage', 'gallery', 'showcase3d', 'product', 'lottie'].includes(sc.sceneId)) b[i].hi *= 1.5;
    });
  }
  if (sumLo > total + 0.01) {
    sb.scenes.forEach((sc, i) => {
      if (sc.duration < b[i].lo - 0.05) report.issues.push({ rule: 'reading-time', scene: sc.key, detail: `${sc.duration.toFixed(2)} s pour ${b[i].lo.toFixed(2)} s de lecture (vidéo trop courte pour ce texte)` });
    });
  } else {
    // Répartition par remplissage : chaque scène dans ses bornes, au plus près de sa durée voulue.
    let dur = sb.scenes.map((sc, i) => Math.min(b[i].hi, Math.max(b[i].lo, sc.duration)));
    for (let pass = 0; pass < 12; pass++) {
      const diff = total - dur.reduce((a, x) => a + x, 0);
      if (Math.abs(diff) < 0.002) break;
      const free = dur.map((x, i) => (diff > 0 ? x < b[i].hi - 1e-6 : x > b[i].lo + 1e-6));
      const weight = dur.reduce((a, x, i) => a + (free[i] ? x : 0), 0);
      if (weight <= 0) break;
      dur = dur.map((x, i) => (free[i] ? Math.min(b[i].hi, Math.max(b[i].lo, x + (diff * x) / weight)) : x));
    }
    sb.scenes.forEach((sc, i) => {
      const before = sc.duration;
      sc.duration = Math.round(dur[i] * 1000) / 1000;
      if (Math.abs(before - sc.duration) > 0.15 && (before < b[i].lo - 0.05 || before > b[i].hi + 0.05)) {
        report.repaired.push({ rule: before < b[i].lo ? (i === n - 1 ? 'logo-hold' : 'reading-time') : i === 0 ? 'hook-first-seconds' : 'min-hold', scene: sc.key, detail: `${before.toFixed(2)} s → ${sc.duration.toFixed(2)} s` });
      }
    });
    const left = total - dur.reduce((a, x) => a + x, 0);
    if (Math.abs(left) > 0.05) {
      sb.scenes.forEach((sc, i) => {
        if (sc.duration > b[i].hi + 0.05) report.issues.push({ rule: i === 0 ? 'hook-first-seconds' : 'min-hold', scene: sc.key, detail: `${sc.duration.toFixed(1)} s (pas assez de scènes pour la durée)` });
      });
    }
  }
  // Les réparations ont pu décaler les coupes : chacune revient sur le temps le plus proche
  // tant que les deux scènes voisines restent dans leurs bornes (règle cuts-on-beat).
  if (sb.beat && sb.beat.bpm && sb.beat.confidence >= 0.15 && sb.scenes.length > 1) {
    let unit = 60 / sb.beat.bpm;
    while (unit < 0.45) unit *= 2;
    const off = ((sb.beat.offset % unit) + unit) % unit;
    const bb = bounds();
    let acc = 0;
    for (let i = 0; i < sb.scenes.length - 1; i++) {
      const cut = acc + sb.scenes[i].duration;
      // Le temps le plus proche, sinon celui d'avant ou d'après, tant que les bornes tiennent.
      const k = (cut - off) / unit;
      const candidates = [Math.round(k), Math.floor(k), Math.ceil(k), Math.floor(k) - 1, Math.ceil(k) + 1].map((m) => off + m * unit).sort((x, y) => Math.abs(x - cut) - Math.abs(y - cut));
      for (const snapped of candidates) {
        const delta = snapped - cut;
        const a = sb.scenes[i].duration + delta;
        const c = sb.scenes[i + 1].duration - delta;
        if (Math.abs(delta) < 0.001) break;
        if (Math.abs(delta) <= unit * 1.5 && a >= bb[i].lo - 0.05 && a <= bb[i].hi + 0.5 && c >= bb[i + 1].lo - 0.05 && c > 0.9) {
          sb.scenes[i].duration = Math.round(a * 1000) / 1000;
          sb.scenes[i + 1].duration = Math.round(c * 1000) / 1000;
          break;
        }
      }
      acc += sb.scenes[i].duration;
    }
  }
  // Recalage des débuts ; la dernière scène finit exactement à la durée achetée.
  {
    let start = 0;
    sb.scenes.forEach((sc) => {
      sc.start = Math.round(start * 1000) / 1000;
      start += sc.duration;
    });
    const lastScene = sb.scenes[sb.scenes.length - 1];
    lastScene.duration = Math.round((total - lastScene.start) * 1000) / 1000;
  }

  // Contrôles purs (signalés).
  const scenesNow = sb.scenes;
  const last = scenesNow.length - 1;
  const first = scenesNow[0];
  if (first.sceneId === 'logo' || first.sceneId === 'cta') report.issues.push({ rule: 'hook-first-seconds', scene: first.key, detail: `ouverture sur ${first.sceneId}` });
  if (first.duration > 4.5 && total > 6) report.issues.push({ rule: 'hook-first-seconds', scene: first.key, detail: `${first.duration.toFixed(1)} s avant la deuxième scène` });
  scenesNow.forEach((sc, i) => {
    const mediaScene = ['footage', 'gallery', 'showcase3d', 'product', 'lottie'].includes(sc.sceneId);
    if (i < last && words(sc.slots) > 0 && sc.duration > (mediaScene ? 9.5 : 7.5)) report.issues.push({ rule: 'min-hold', scene: sc.key, detail: `${sc.duration.toFixed(1)} s > ${mediaScene ? 9 : 7} s` });
    if (i < last && words(sc.slots) === 0 && !['gallery', 'showcase3d', 'lottie', 'kinetic'].includes(sc.sceneId)) report.issues.push({ rule: 'sound-off', scene: sc.key, detail: 'scène sans texte' });
  });
  if (scenesNow[last].sceneId !== 'logo') report.issues.push({ rule: 'ends-on-brand', detail: `fin sur ${scenesNow[last].sceneId}` });
  if (opts.objective && CTA_OBJECTIVES.includes(opts.objective) && total >= 15 && !scenesNow.some((s) => s.sceneId === 'cta' || s.sceneId === 'offer' || s.sceneId === 'event')) {
    report.issues.push({ rule: 'call-to-action', detail: `objectif ${opts.objective} sans appel à l’action` });
  }
  if (sb.beat && sb.beat.confidence >= 0.15 && scenesNow.length > 2) {
    let unit = 60 / sb.beat.bpm;
    while (unit < 0.45) unit *= 2;
    const cuts = scenesNow.slice(1).map((s) => s.start);
    const onBeat = cuts.filter((c) => {
      const r = (((c - sb.beat!.offset) % unit) + unit) % unit;
      return Math.min(r, unit - r) < 0.07;
    }).length;
    // Priorité à la lecture : une coupe qui ne peut tomber sur le temps sans voler du temps de
    // lecture reste où elle est ; c'est signalé, pas bloquant.
    if (onBeat / cuts.length < 0.5) report.warnings.push({ rule: 'cuts-on-beat', detail: `${onBeat}/${cuts.length} coupes sur le temps (lecture prioritaire)` });
  }
  return report;
}

/** Les règles portées par le moteur et les directions (contrôlées une fois, pas par vidéo). */
export function staticRuleIssues(): RuleIssue[] {
  const issues: RuleIssue[] = [];
  for (const [id, d] of Object.entries(DIRECTIONS)) {
    const linear = (b: number[]) => b[0] === b[1] && b[2] === b[3];
    if (linear(d.ease.out) || linear(d.ease.in)) issues.push({ rule: 'no-linear', detail: `direction ${id}` });
    if (d.pacing.enter < 0.3 || d.pacing.enter > 1.2) issues.push({ rule: 'entrance-duration', detail: `direction ${id} : ${d.pacing.enter} s` });
    if (d.pacing.unitStagger < 0.02 || d.pacing.unitStagger > 0.12) issues.push({ rule: 'entrance-duration', detail: `direction ${id} : décalage ${d.pacing.unitStagger} s` });
  }
  return issues;
}
