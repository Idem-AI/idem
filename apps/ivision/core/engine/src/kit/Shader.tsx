/**
 * <Shader> — un fond de matière en shader (addon `ogl`), piloté par le temps.
 *
 *   <Shader effect="aurora" colors={['var(--hl)', 'var(--c-accent)']} strength={0.6} />
 *
 * Effets : aurora (rideaux de lumière), silk (satin froissé), plasma, fluid (encre dans l'eau),
 * mesh (dégradé à points mouvants), topology (courbes de niveau), waves (vagues en couches),
 * blobs (métaballes en 3D, raymarching). Chacun est une fonction pure de `uTime` : le moteur le
 * pose à chaque image, aucune boucle ne tourne.
 *
 * Le fond COLORE la surface (opacité `strength`, 0,6 par défaut) au lieu de la remplacer : le texte
 * posé dessus garde son contraste. `strength={1}` donne un fond plein pour une scène qui l'assume.
 * Sans WebGL, un halo de CSS tient la place (voir `.shader-wrap` dans engine.css).
 */
import { CSSProperties } from 'react';
import { useEngine, useScene } from '../context';
import { resolveRgb, useGl } from '../gl';
import { addon } from '../shared';

export type ShaderEffect = 'aurora' | 'silk' | 'plasma' | 'fluid' | 'mesh' | 'topology' | 'waves' | 'blobs';
export const SHADER_EFFECTS: ShaderEffect[] = ['aurora', 'silk', 'plasma', 'fluid', 'mesh', 'topology', 'waves', 'blobs'];

export interface ShaderProps {
  effect?: ShaderEffect;
  /** Jusqu'à quatre couleurs (`var(--hl)`, `#hex`) ; par défaut celles de la surface. */
  colors?: string[];
  /** Vitesse de l'animation (1 = normal). */
  speed?: number;
  /** Échelle du motif (1 = normal ; plus grand = plus de détails). */
  scale?: number;
  /** Opacité du fond, 0 → 1. */
  strength?: number;
  /** Même graine, même fond. */
  seed?: number;
  /** Définition du canevas, en part de la taille du cadre (0,35 suffit à des fonds doux). */
  res?: number;
  style?: CSSProperties;
}

const DEFAULT_COLORS = ['var(--hl)', 'var(--c-primary)', 'var(--c-accent)', 'var(--bg)'];
/** Les effets à arêtes nettes (courbes, métaballes) gagnent à être définis plus finement. */
const SHARP: Record<string, number> = { topology: 0.6, blobs: 0.5, waves: 0.5 };

export function Shader({ effect = 'fluid', colors, speed = 1, scale = 1, strength = 0.6, seed = 1, res, style }: ShaderProps) {
  const { data } = useEngine();
  const s = useScene();
  const id = SHADER_EFFECTS.includes(effect) ? effect : 'fluid';
  const k = Math.max(0.15, Math.min(1, res ?? SHARP[id] ?? 0.4));
  const width = Math.max(64, Math.round(data.width * k));
  const height = Math.max(64, Math.round(data.height * k));
  const list = (colors && colors.length ? colors : DEFAULT_COLORS).slice(0, 4);
  while (list.length < 4) list.push(list[list.length - 1]);
  const scene = s.index || 0;
  const ref = useGl({
    width,
    height,
    attrs: { 'data-shader': id },
    make: (canvas) => {
      const lib = addon('ogl');
      if (!lib) return null;
      const [c1, c2, c3, c4] = list.map((c) => resolveRgb(canvas, c));
      return lib.create(canvas, { effect: id, width, height, uniforms: { uTime: 0, uRes: [width, height], uC1: c1, uC2: c2, uC3: c3, uC4: c4, uScale: scale, uSeed: seed + scene * 3.7, uStrength: Math.max(0, Math.min(1, strength)) } });
    },
    params: (lt) => ({ uTime: lt * speed }),
  });
  return (
    <div className="shader-wrap" style={style} aria-hidden>
      <div ref={ref} className="gl-host" />
    </div>
  );
}
