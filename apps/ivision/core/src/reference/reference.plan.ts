/**
 * La vidéo modèle, décrite au directeur et au planificateur du film : combien de plans, leur durée à
 * l'échelle de la durée achetée, ce qui s'y passe et comment on passe de l'un à l'autre. Les textes
 * et les médias restent ceux de la marque ; le code de chaque scène reste écrit librement.
 */
import { REFERENCE_LAYOUTS, ReferenceBlueprint } from './reference.analyzer';

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

/**
 * La fiche de chaque plan du modèle (mise en page, entrée du texte, caméra, fond, ce qu'on voit) : elle est
 * jointe à la scène du même rang, que l'auteur de la scène lit en entier. `max` : le nombre de scènes admis.
 */
export function referenceShotCards(bp: ReferenceBlueprint, max: number): { line: string; transition?: string }[] {
  return bp.shots.slice(0, max).map((s) => ({
    line: [
      REFERENCE_LAYOUTS[s.layout]?.label || s.layout,
      s.media !== 'none' ? `${s.media} of the brand fills its place` : '',
      `background ${s.background}`,
      s.textMotion ? `headline enters by ${s.textMotion}` : '',
      `camera ${s.camera}`,
      `${s.energy} energy`,
      s.texts.length ? s.texts.map((t) => `${t.role} ~${t.words} words ${t.position}`).join(', ') : 'no text',
    ]
      .filter(Boolean)
      .join(' · ')
      .concat(` — ${s.description}`),
    ...(s.transitionIn ? { transition: `as in the model: ${s.transitionIn}` } : {}),
  }));
}
