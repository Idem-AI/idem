/**
 * <Gradient> — un dégradé animé qui passe d'un état de couleurs à l'autre (l'esprit de Granim.js).
 *
 *   <Gradient states={[['var(--hl)', 'var(--c-primary)'], ['var(--c-accent)', 'var(--bg)']]} angle={140} />
 *
 * Chaque état est une liste de couleurs (CSS : `var(--hl)`, `#hex`…). Le dégradé tient un état puis
 * glisse vers le suivant (`hold` secondes de tenue, `fade` de transition) ; l'angle dérive lentement.
 * Rien n'est accumulé : à l'instant t, l'état courant et le suivant sont mélangés par `color-mix`,
 * en pur CSS (pas de canevas, pas d'addon). Sans `states`, la charte de la surface.
 */
import { CSSProperties } from 'react';
import { useLocalTime } from '../context';
import { clamp } from '../time';

export interface GradientProps {
  /** Au moins deux états ; chacun de 2 à 4 couleurs. */
  states?: string[][];
  /** Angle de départ, en degrés. */
  angle?: number;
  /** Dérive de l'angle, en degrés par seconde. */
  drift?: number;
  /** Tenue d'un état (s) et durée de la transition (s). */
  hold?: number;
  fade?: number;
  /** `radial` : un dégradé qui part du centre. */
  kind?: 'linear' | 'radial';
  opacity?: number;
  style?: CSSProperties;
}

const DEFAULT_STATES = [
  ['var(--hl)', 'var(--c-primary)', 'var(--bg)'],
  ['var(--c-accent)', 'var(--hl)', 'var(--bg)'],
  ['var(--c-primary)', 'var(--c-accent)', 'var(--bg)'],
];

const ease = (x: number) => x * x * (3 - 2 * x);

export function Gradient({ states, angle = 135, drift = 6, hold = 1.6, fade = 1.8, kind = 'linear', opacity = 1, style }: GradientProps) {
  const lt = useLocalTime();
  const list = (states && states.length >= 2 ? states : DEFAULT_STATES).map((s) => (s.length >= 2 ? s : [s[0], s[0]]));
  const n = list.length;
  const period = hold + fade;
  const cycle = Math.max(0, lt) / period;
  const i = Math.floor(cycle) % n;
  const j = (i + 1) % n;
  // Dans une période : d'abord la tenue de l'état i, puis la glissade vers j.
  const k = ease(clamp((cycle - Math.floor(cycle) - hold / period) / (fade / period)));
  const stops = Math.max(...list.map((s) => s.length));
  const pick = (s: string[], x: number) => s[Math.min(s.length - 1, Math.round((x / Math.max(1, stops - 1)) * (s.length - 1)))];
  const colors = Array.from({ length: stops }, (_, x) => {
    const a = pick(list[i], x);
    const b = pick(list[j], x);
    return k <= 0.001 ? a : k >= 0.999 ? b : `color-mix(in oklab, ${a} ${Math.round((1 - k) * 100)}%, ${b})`;
  });
  const deg = angle + drift * lt;
  const image = kind === 'radial' ? `radial-gradient(circle at ${50 + 18 * Math.sin(lt * 0.4)}% ${50 + 18 * Math.cos(lt * 0.33)}%, ${colors.join(', ')})` : `linear-gradient(${deg.toFixed(2)}deg, ${colors.join(', ')})`;
  return <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: image, opacity, ...style }} aria-hidden />;
}
