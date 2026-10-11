/**
 * <LiquidGlass> — un verre réfractif posé sur ce qui est derrière lui.
 *
 *   <LiquidGlass x={50} y={44} w={60} h={18} radius={9}>
 *     <Kinetic … />                           // le contenu reste net, au-dessus du verre
 *   </LiquidGlass>
 *
 * L'image derrière le verre est déformée sur son pourtour comme par une lentille épaisse (un filtre
 * SVG `feDisplacementMap`, appliqué par `backdrop-filter`), légèrement floutée et saturée ; un
 * liseré clair et une ombre donnent le relief. C'est l'effet de liquid-glass-react, écrit pour ce
 * moteur : sans souris, sans horloge, chaque paramètre est posé par le temps de la scène.
 * (Chromium seulement : c'est le navigateur du rendu et de l'aperçu ; ailleurs, le verre dépoli
 * reste, sans réfraction.)
 *
 * `x`, `y` : centre, en % du cadre ; `w`, `h`, `radius` : en u (1 u = 1 % du petit côté).
 */
import { CSSProperties, ReactNode, useId, useMemo } from 'react';
import { useEngine } from '../context';

export interface LiquidGlassProps {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** Rayon des coins, en u (une pastille : la moitié de la hauteur). */
  radius?: number;
  /** Force de la réfraction, 0 → 2 (1 = normale). */
  refraction?: number;
  /** Flou de l'arrière-plan, en px à la définition 1080. */
  blur?: number;
  /** Densité du voile aux couleurs de la surface, 0 → 1. */
  tint?: number;
  /** Apparition 0 → 1 (opacité) ; 1 par défaut. */
  p?: number;
  children?: ReactNode;
  style?: CSSProperties;
}

/**
 * La carte de déplacement : au centre, aucun décalage (gris moyen) ; sur le pourtour, un décalage vers
 * l'intérieur qui croît vers le bord, comme la réfraction d'un biseau bombé. Rouge = x, vert = y.
 */
function displacementMap(w: number, h: number, radius: number, bezel: number): string {
  const k = Math.min(1, 220 / Math.max(w, h));
  const cw = Math.max(8, Math.round(w * k));
  const ch = Math.max(8, Math.round(h * k));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(cw, ch);
  const r = Math.min(radius * k, cw / 2, ch / 2);
  const bz = Math.max(2, bezel * k);
  // Distance signée (négative à l'intérieur) d'un rectangle à coins arrondis, et son gradient.
  const sdf = (px: number, py: number) => {
    const qx = Math.abs(px - cw / 2) - (cw / 2 - r);
    const qy = Math.abs(py - ch / 2) - (ch / 2 - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const d = sdf(x + 0.5, y + 0.5);
      const gx = sdf(x + 1.5, y + 0.5) - sdf(x - 0.5, y + 0.5);
      const gy = sdf(x + 0.5, y + 1.5) - sdf(x + 0.5, y - 0.5);
      const gl = Math.hypot(gx, gy) || 1;
      const inside = Math.max(0, Math.min(1, -d / bz));
      const mag = Math.pow(1 - inside, 2.2) * (d <= 0 ? 1 : 0);
      const i = (y * cw + x) * 4;
      img.data[i] = 128 - (gx / gl) * mag * 127;
      img.data[i + 1] = 128 - (gy / gl) * mag * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function LiquidGlass({ x = 50, y = 50, w = 60, h = 18, radius, refraction = 1, blur = 2, tint = 0.3, p = 1, children, style }: LiquidGlassProps) {
  const { u, data } = useEngine();
  const id = `lg-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const wp = Math.max(8, Math.round(w * u));
  const hp = Math.max(8, Math.round(h * u));
  const rp = Math.round(Math.min(radius ?? Math.min(w, h) * 0.5, Math.min(w, h) / 2) * u);
  const bezel = Math.max(6, Math.min(wp, hp) * 0.42);
  const map = useMemo(() => displacementMap(wp, hp, rp, bezel), [wp, hp, rp, bezel]);
  const scale = Math.round(bezel * 0.9 * refraction);
  const q = Math.max(0, Math.min(1, p));
  // Le flou et la saturation sont DANS le filtre SVG : Chromium ignore tout `backdrop-filter` où `url()` est
  // suivi d'une autre fonction (blur(), saturate()…), la lentille disparaîtrait.
  const backdrop = `url(#${id})`;
  const sigma = (blur * u) / 10.8;
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={id} x="0" y="0" width={wp} height={hp} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={wp} height={hp} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="bent" />
            {sigma > 0.05 ? <feGaussianBlur in="bent" stdDeviation={sigma} result="soft" /> : null}
            <feColorMatrix in={sigma > 0.05 ? 'soft' : 'bent'} type="saturate" values="1.4" />
          </filter>
        </defs>
      </svg>
      <div
        className="liquid-glass"
        style={{
          position: 'absolute',
          // Centré SANS transformation : avec un `transform` sur l'élément, Chromium décale la zone du filtre
          // SVG de l'arrière-plan et la réfraction ne tombe plus sur la lentille.
          left: (x / 100) * data.width - wp / 2,
          top: (y / 100) * data.height - hp / 2,
          width: wp,
          height: hp,
          borderRadius: rp,
          opacity: q,
          backdropFilter: backdrop,
          WebkitBackdropFilter: backdrop,
          // Le voile prend la couleur de la surface : le texte (--ink) garde son contraste, clair ou sombre.
          background: `linear-gradient(135deg, color-mix(in srgb, var(--bg) ${Math.round((tint + 0.12) * 100)}%, transparent), color-mix(in srgb, var(--bg) ${Math.round(tint * 40)}%, transparent))`,
          boxShadow: `inset 0 0 0 ${Math.max(1, u * 0.12)}px rgba(255,255,255,0.4), inset ${u * 0.3}px ${u * 0.5}px ${u * 1.2}px rgba(255,255,255,0.35), inset ${-u * 0.3}px ${-u * 0.5}px ${u * 1.4}px rgba(0,0,0,0.1), 0 ${u * 1.2}px ${u * 4}px rgba(0,0,0,0.16)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
}
