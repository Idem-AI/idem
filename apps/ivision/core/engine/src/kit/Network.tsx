/**
 * <Network> — des points qui dérivent et se relient quand ils se rapprochent (réseau, constellation).
 * Ce que font les fonds « net » de Vanta.js et les liens de tsParticles, sans leur boucle : la
 * position du point i est une fonction pure de la graine, de i et du temps.
 *
 *   <Network count={44} reach={18} seed={3} />
 *
 * Le dessin est un SVG en unités u (1 u = 1 % du petit côté) : les points restent ronds dans les
 * trois formats. Aux couleurs de la surface (`--hl` pour les liens, `--ink` pour les points).
 */
import { CSSProperties } from 'react';
import { useEngine, useLocalTime } from '../context';
import { clamp, hash, mix, progress } from '../time';

export interface NetworkProps {
  /** 8 → 90 points. */
  count?: number;
  seed?: number;
  /** Distance en u sous laquelle deux points se relient. */
  reach?: number;
  /** Vitesse de la dérive (1 = normale). */
  speed?: number;
  /** Zone en % du cadre [x0, y0, x1, y1]. */
  area?: [number, number, number, number];
  /** Taille des points, en u. */
  dot?: number;
  opacity?: number;
  style?: CSSProperties;
}

export function Network({ count = 44, seed = 3, reach = 18, speed = 1, area = [0, 0, 100, 100], dot = 0.55, opacity = 0.85, style }: NetworkProps) {
  const { data, u } = useEngine();
  const lt = useLocalTime();
  const aspect = data.width / Math.max(1, data.height);
  const W = aspect >= 1 ? 100 * aspect : 100;
  const H = aspect >= 1 ? 100 : 100 / aspect;
  const n = Math.max(8, Math.min(90, Math.round(count)));
  const [x0, y0, x1, y1] = area;
  const appear = progress(lt, 0, 1.2);
  const pts = Array.from({ length: n }, (_, i) => {
    const h = (k: number) => hash(seed * 31.7 + i * 12.9898 + k * 78.233);
    // Chaque point flotte autour de son point d'ancrage sur deux sinusoïdes de fréquences propres.
    const ax = mix(x0, x1, h(1)) * (W / 100);
    const ay = mix(y0, y1, h(2)) * (H / 100);
    const t = lt * speed;
    return [ax + Math.sin(t * mix(0.18, 0.5, h(3)) + h(4) * 6.28) * mix(2, 7, h(5)), ay + Math.cos(t * mix(0.15, 0.45, h(6)) + h(7) * 6.28) * mix(2, 7, h(8)), mix(0.6, 1.4, h(9))];
  });
  const lines: { a: number; b: number; w: number }[] = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const d = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
      if (d < reach) lines.push({ a, b, w: 1 - d / reach });
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: opacity * clamp(appear), ...style }} aria-hidden>
      {lines.slice(0, 220).map((l, i) => (
        <line key={i} x1={pts[l.a][0]} y1={pts[l.a][1]} x2={pts[l.b][0]} y2={pts[l.b][1]} stroke="var(--hl)" strokeWidth={Math.max(1, u * 0.13 * l.w)} strokeOpacity={0.15 + 0.7 * l.w} vectorEffect="non-scaling-stroke" />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={dot * p[2]} fill={i % 4 === 0 ? 'var(--hl)' : 'var(--ink)'} fillOpacity={i % 4 === 0 ? 0.95 : 0.55} />
      ))}
    </svg>
  );
}
