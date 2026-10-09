/**
 * Du plan de reproduction (`ReferenceBlueprint`) aux choix du moteur.
 *
 * Chaque plan du modèle devient une scène du moteur, avec SA durée (à l'échelle de la durée
 * achetée), SA mise en page (motif), SON entrée de titre, SA transition ; la caméra, la
 * direction et le rythme suivent le modèle. Les textes et les médias restent ceux de la marque :
 * un plan « chiffre géant » sans chiffre dans le brief devient une affirmation, un plan « clip »
 * sans clip prend une photo, sinon une scène de texte. Les bonnes pratiques (temps de lecture,
 * signature finale) passent toujours après : le modèle n'impose jamais un texte illisible.
 */
import type { BriefFacts } from '../video/video.copy';
import type { DirectionId, MotionTransition, TextTechnique } from '../video/video.direction';
import { available, MediaCounts } from '../video/video.types';
import { PATTERN_BY_ID } from '../video/video.patterns';
import { REFERENCE_LAYOUTS, ReferenceBlueprint, ReferenceShot } from './reference.analyzer';

export interface ReferencePlan {
  sceneIds: string[];
  /** Durées (s) à l'échelle de la durée achetée, somme exacte. */
  durations: number[];
  /** Motif par scène (mise en page résolue par le moteur), `undefined` = choix du moteur. */
  patterns: (string | undefined)[];
  techniques: (TextTechnique | undefined)[];
  transitions: (MotionTransition | undefined)[];
  camera?: string;
  direction?: DirectionId;
  rhythm?: string;
  /** La scène du grand moment : le plan le plus énergique du milieu du film. */
  accent: number;
  /** Consigne de texte par scène : le rôle et la longueur vus sur le modèle. */
  copyHints: Record<string, Record<string, string>>;
}

/** Le type de scène qui reproduit un plan, avec ce que la marque peut montrer. */
export function sceneForShot(shot: ReferenceShot, ctx: { facts: BriefFacts; media: MediaCounts }, previous?: string): string {
  const ok = (id: string) => available(id, ctx.facts, ctx.media);
  const layout = shot.layout;
  const candidates: string[] = (() => {
    if (shot.role === 'signature' || layout === 'logo') return ['logo'];
    if (shot.media === 'video') return ['footage', 'product', 'statement'];
    if (shot.media === 'photo') return layout === 'photo-split' || layout === 'circle' ? ['product', 'gallery', 'statement'] : ['product', 'footage', 'gallery', 'statement'];
    if (layout === 'kinetic-words') return ['kinetic', 'statement'];
    if (layout === 'word-swap') return ['wordswap', 'kinetic', 'statement'];
    if (layout === 'quote') return ['quote', 'statement'];
    // Un chiffre géant montre une donnée de la marque (jamais un prix inventé) ; sans donnée, une affirmation.
    if (layout === 'giant-number' || layout === 'ring-chart' || layout === 'gauge' || layout === 'bar-chart') return ['stat', 'statement'];
    if (layout === 'price-burst') return ['offer', 'product', 'statement'];
    if (layout === 'checklist' || layout === 'cards' || layout === 'grid') return ['benefits', 'statement'];
    switch (shot.role) {
      case 'hook':
        return ['hook', 'statement'];
      case 'proof':
        return ['stat', 'quote', 'statement'];
      case 'list':
        return ['benefits', 'statement'];
      case 'offer':
        return ['offer', 'statement'];
      case 'cta':
        return ['cta', 'statement'];
      case 'show':
        return ['product', 'gallery', 'statement'];
      default:
        return ['statement', 'kinetic'];
    }
  })();
  const found = candidates.filter((id) => id === 'logo' || ok(id));
  // Deux affirmations de suite restent possibles (le modèle peut en avoir) ; la typographie animée varie la seconde.
  if (found[0] === previous && previous === 'statement' && ok('kinetic')) return 'kinetic';
  return found[0] || 'statement';
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Le plan de reproduction, traduit pour une vidéo de `durationSec` secondes. */
export function planFromBlueprint(bp: ReferenceBlueprint, ctx: { facts: BriefFacts; media: MediaCounts; durationSec: number }): ReferencePlan {
  // Au plus un plan par 1,6 s de vidéo (temps de lecture minimal), signature comprise.
  const maxScenes = Math.max(2, Math.floor(ctx.durationSec / 1.6));
  let shots = bp.shots.slice();
  while (shots.length > maxScenes) {
    // On garde l'ouverture et la signature ; on retire le plan le plus court du milieu.
    let shortest = 1;
    for (let i = 1; i < shots.length - 1; i++) if (shots[i].duration < shots[shortest].duration) shortest = i;
    shots = shots.filter((_, i) => i !== shortest);
  }
  const sceneIds: string[] = [];
  for (const shot of shots) sceneIds.push(sceneForShot(shot, ctx, sceneIds[sceneIds.length - 1]));
  // Une signature finale, toujours.
  if (sceneIds[sceneIds.length - 1] !== 'logo') {
    if (sceneIds.length >= maxScenes) {
      sceneIds[sceneIds.length - 1] = 'logo';
    } else {
      sceneIds.push('logo');
      shots.push({ ...shots[shots.length - 1], role: 'signature', layout: 'logo', duration: Math.max(2.2, shots[shots.length - 1].duration * 0.6) });
    }
  }
  const total = shots.reduce((s, x) => s + x.duration, 0) || 1;
  const durations = shots.map((s) => round1((s.duration / total) * ctx.durationSec));
  durations[durations.length - 1] = round1(ctx.durationSec - durations.slice(0, -1).reduce((a, b) => a + b, 0));

  const patterns = shots.map((s, i) => {
    const id = REFERENCE_LAYOUTS[s.layout]?.pattern;
    const def = id ? PATTERN_BY_ID.get(id) : undefined;
    return def && def.scenes.includes(sceneIds[i]) ? def.id : undefined;
  });
  const middle = shots.map((s, i) => ({ s, i })).filter(({ i }) => i > 0 && i < shots.length - 1);
  const energy = { calm: 0, medium: 1, high: 2 } as const;
  const accent = middle.sort((a, b) => energy[b.s.energy] - energy[a.s.energy] || b.s.duration - a.s.duration)[0]?.i ?? Math.min(1, shots.length - 2);
  const cameras = shots.map((s) => s.camera);
  const camera = cameras.sort((a, b) => cameras.filter((c) => c === b).length - cameras.filter((c) => c === a).length)[0];

  const copyHints: Record<string, Record<string, string>> = {};
  shots.forEach((s, i) => {
    const headline = s.texts.find((t) => t.role === 'headline' || t.role === 'number');
    if (!headline || sceneIds[i] === 'logo') return;
    const key = ['stat'].includes(sceneIds[i]) ? 'label' : ['product'].includes(sceneIds[i]) ? 'name' : sceneIds[i] === 'kinetic' ? 'l1' : sceneIds[i] === 'quote' ? 'quote' : 'title';
    copyHints[sceneIds[i]] = { ...(copyHints[sceneIds[i]] || {}), [key]: `as in the reference video: about ${headline.words} word(s)` };
  });
  return {
    sceneIds,
    durations,
    patterns,
    techniques: shots.map((s) => s.textMotion),
    transitions: shots.map((s, i) => (i ? s.transitionIn : undefined)),
    camera,
    direction: bp.direction,
    rhythm: bp.rhythm,
    accent,
    copyHints,
  };
}

/** Le film modèle, décrit au directeur du film d'auteur (cran Ultra). */
export function blueprintForDirector(bp: ReferenceBlueprint, durationSec: number): string {
  const scale = durationSec / (bp.duration || durationSec);
  return [
    `REFERENCE FILM (the client wants THIS animation reproduced with their own brand, texts and media — same number of shots, same timing, same composition and motion per shot; never copy its texts):`,
    ...bp.shots.map(
      (s, i) =>
        `${i + 1}. ${(s.duration * scale).toFixed(1)} s · ${s.role}${s.media !== 'none' ? ` · ${s.media} of the brand` : ''} · ${REFERENCE_LAYOUTS[s.layout]?.label || s.layout}${s.transitionIn ? ` · enters by ${s.transitionIn}` : ''} · camera ${s.camera} · ${s.texts.map((t) => `${t.role} ~${t.words} words ${t.position}`).join(', ') || 'no text'} — ${s.description}`
    ),
  ].join('\n');
}
