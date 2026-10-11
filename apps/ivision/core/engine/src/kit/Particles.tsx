/**
 * Les particules du kit — poussière, braises, confettis, éclat, rassemblement, désintégration.
 *
 * Toute la pose vient de `particles.math.ts` (fonction pure de la graine, de l'indice et du
 * temps) : la même image, quel que soit l'ordre de rendu. Aucune bibliothèque, aucun addon
 * à charger : de simples éléments HTML placés en %, aux couleurs de la charte.
 *
 *   <Particles mode="drift" count={36} />                                  poussière qui flotte
 *   <Particles mode="rise" area={[10, 60, 90, 100]} />                     braises qui montent
 *   <Particles mode="burst" origin={[50, 42]} at={0.3} dur={1.4} />        éclat depuis un point
 *   <Particles mode="converge" origin={[50, 50]} at={0.2} dur={1.2} />     rassemblement
 *   <Particles mode="dissolve" area={[8, 38, 70, 62]} at={exitAt} dur={1.2} />   désintégration d'un bloc
 */
import { CSSProperties } from 'react';
import { useEngine, useLocalTime } from '../context';
import { progress } from '../time';
import { MAX_PARTICLES, ParticleMode, ParticleShape, ParticleSpec, particleAt, normalizeSpec } from './particles.math';

export type { ParticleMode, ParticleShape };

/**
 * Teintes de la surface courante : le surlignage de la marque (une particule sur deux), l'encre du texte
 * et le surlignage adouci. Jamais `--c-primary` ni `--c-accent` : sur un aplat de cette couleur, la
 * particule disparaîtrait ; `--hl` et `--ink` contrastent avec la surface par construction.
 */
const TONES = ['var(--hl)', 'var(--ink)', 'var(--hl)', 'var(--hl-soft)'];

export interface ParticlesProps {
  mode?: ParticleMode;
  /** 1 → 120. */
  count?: number;
  /** Même graine, mêmes particules. */
  seed?: number;
  /** Zone d'émission [x0, y0, x1, y1] en % du cadre. */
  area?: [number, number, number, number];
  /** Point d'origine en % (burst, converge) : remplace `area`. */
  origin?: [number, number];
  /** Taille minimale et maximale, en u. */
  size?: [number, number];
  /** Agitation, 0 → 1. */
  turbulence?: number;
  /** Portée du mouvement, en u (par défaut : selon le mode). */
  reach?: number;
  /** Durée d'un cycle en secondes (drift, rise, fall). */
  life?: number;
  /** Formes tirées au hasard : dot, square, ring, spark. */
  shapes?: ParticleShape[];
  /** Début (s, temps de la scène) et durée (s) de l'événement (burst, converge, dissolve). */
  at?: number;
  dur?: number;
  /** Avancement imposé de l'événement (0 → 1) ; sinon calculé depuis `at` et `dur`. */
  p?: number;
  opacity?: number;
  style?: CSSProperties;
}

const REACH: Record<ParticleMode, number> = { drift: 14, rise: 38, fall: 46, burst: 34, converge: 40, dissolve: 26 };
const LIFE: Record<ParticleMode, number> = { drift: 7, rise: 5, fall: 6, burst: 1, converge: 1, dissolve: 1 };

export function Particles({ mode = 'drift', count = 36, seed = 7, area, origin, size, turbulence = 0.5, reach, life, shapes, at = 0, dur = 1.4, p, opacity = 1, style }: ParticlesProps) {
  const { u, data } = useEngine();
  const lt = useLocalTime();
  const event = mode === 'burst' || mode === 'converge' || mode === 'dissolve';
  const spec: ParticleSpec = normalizeSpec({
    mode,
    count,
    seed,
    area: origin ? [origin[0], origin[1], origin[0], origin[1]] : area || [0, 0, 100, 100],
    size: size || (mode === 'burst' ? [0.9, 2.6] : mode === 'dissolve' ? [0.6, 2.2] : [0.5, 1.7]),
    turbulence,
    reach: reach ?? REACH[mode],
    life: life ?? LIFE[mode],
    aspect: data.width / Math.max(1, data.height),
    shapes: shapes || (mode === 'burst' ? ['dot', 'spark', 'square'] : mode === 'fall' ? ['square', 'dot', 'ring'] : ['dot']),
    tones: TONES.length,
  });
  const progressNow = p ?? (event ? progress(lt, at, dur) : 0);
  const poses = Array.from({ length: Math.min(spec.count, MAX_PARTICLES) }, (_, i) => particleAt(spec, i, lt, progressNow)).filter((q) => q.alpha >= 0.01);
  return (
    // data-particles : le nombre de particules visibles à cet instant (lu par les contrôles de rendu).
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-particles={poses.length} style={{ opacity, ...style }} aria-hidden>
      {poses.map((q, i) => {
        const w = q.size * u * (q.shape === 'spark' ? 0.32 : 1);
        const h = q.size * u * (q.shape === 'spark' ? q.stretch : 1);
        const color = TONES[q.tone];
        const base: CSSProperties = {
          position: 'absolute',
          left: `${q.x.toFixed(2)}%`,
          top: `${q.y.toFixed(2)}%`,
          width: w,
          height: h,
          transform: `translate(-50%, -50%) rotate(${q.rot.toFixed(1)}deg)`,
          opacity: q.alpha,
        };
        if (q.shape === 'ring') return <span key={i} style={{ ...base, borderRadius: '50%', border: `${Math.max(1, q.size * u * 0.16)}px solid ${color}` }} />;
        return <span key={i} style={{ ...base, background: color, borderRadius: q.shape === 'square' ? q.size * u * 0.12 : 999 }} />;
      })}
    </div>
  );
}
