/**
 * <Flat3D> — des objets en pseudo-3D plats et ronds (Zdog), rendus en SVG, sans WebGL.
 *
 * Aucune boucle d'animation : le composant pose la rotation de l'instant puis
 * `updateRenderGraph()`. Les couleurs `var(--…)` sont résolues sur la charte de la scène.
 *
 *   <Flat3D items={[{ kind: 'box', width: 30, height: 30, depth: 30, color: 'var(--hl)' }]} rotate={{ y: lt * 0.8, x: -0.4 }} />
 */
import { CSSProperties, useLayoutEffect, useMemo, useRef } from 'react';
import { addon } from '../shared';

export interface Flat3DItem {
  /** box, cylinder, cone, hemisphere, ring, disc, polygon, sphere, rect, line */
  kind: string;
  x?: number;
  y?: number;
  z?: number;
  rotate?: { x?: number; y?: number; z?: number };
  width?: number;
  height?: number;
  depth?: number;
  diameter?: number;
  length?: number;
  sides?: number;
  radius?: number;
  stroke?: number;
  color?: string;
  /** Faces secondaires (boîte : côtés et dessus ; cylindre : fond). */
  shade?: string;
  fill?: boolean;
}

export interface Flat3DProps {
  items: Flat3DItem[];
  /** Rotation de toute la scène, en radians. */
  rotate?: { x?: number; y?: number; z?: number };
  zoom?: number;
  /** Repère : la scène va de -50 à 50 sur chaque axe. */
  style?: CSSProperties;
}

/** Résout `var(--x)` sur l'élément (Zdog écrit les couleurs en attributs). */
function resolve(el: Element, color: string | undefined, fallback: string): string {
  const c = (color || fallback).trim();
  const m = c.match(/^var\((--[\w-]+)\)$/);
  return m ? getComputedStyle(el).getPropertyValue(m[1]).trim() || '#888' : c;
}

export function Flat3D({ items, rotate, zoom = 1, style }: Flat3DProps) {
  const lib = addon('zdog');
  const svg = useRef<SVGSVGElement>(null);
  const illo = useRef<any>(null);
  const key = useMemo(() => JSON.stringify(items), [items]);

  useLayoutEffect(() => {
    if (!lib || !svg.current) return;
    const Z = lib.Zdog;
    const el = svg.current;
    while (el.firstChild) el.removeChild(el.firstChild);
    const scene = new Z.Illustration({ element: el, resize: false, zoom });
    for (const it of items) {
      const color = resolve(el, it.color, 'var(--hl)');
      const shade = resolve(el, it.shade, it.color || 'var(--c-primary)');
      const base = { addTo: scene, translate: { x: it.x || 0, y: it.y || 0, z: it.z || 0 }, rotate: it.rotate || {}, color, stroke: it.stroke ?? 0, fill: it.fill ?? true };
      switch (it.kind) {
        case 'box':
          new Z.Box({ ...base, width: it.width ?? 20, height: it.height ?? 20, depth: it.depth ?? 20, stroke: it.stroke ?? false, topFace: shade, leftFace: shade, rightFace: shade, bottomFace: shade });
          break;
        case 'cylinder':
          new Z.Cylinder({ ...base, diameter: it.diameter ?? 20, length: it.length ?? 20, stroke: it.stroke ?? false, backface: shade });
          break;
        case 'cone':
          new Z.Cone({ ...base, diameter: it.diameter ?? 20, length: it.length ?? 24, stroke: it.stroke ?? false, backface: shade });
          break;
        case 'hemisphere':
          new Z.Hemisphere({ ...base, diameter: it.diameter ?? 24, stroke: it.stroke ?? false, backface: shade });
          break;
        case 'ring':
          new Z.Ellipse({ ...base, diameter: it.diameter ?? 30, stroke: it.stroke ?? 4, fill: false });
          break;
        case 'disc':
          new Z.Ellipse({ ...base, diameter: it.diameter ?? 30, stroke: it.stroke ?? 0, fill: true });
          break;
        case 'polygon':
          new Z.Polygon({ ...base, radius: it.radius ?? 16, sides: it.sides ?? 6, stroke: it.stroke ?? 0 });
          break;
        case 'rect':
          new Z.Rect({ ...base, width: it.width ?? 20, height: it.height ?? 20 });
          break;
        case 'line':
          new Z.Shape({ ...base, path: [{ x: -(it.length ?? 20) / 2 }, { x: (it.length ?? 20) / 2 }], stroke: it.stroke ?? 2, fill: false });
          break;
        default:
          // sphère : un point au trait épais, rond par construction
          new Z.Shape({ ...base, stroke: it.diameter ?? it.stroke ?? 20 });
      }
    }
    illo.current = scene;
    return () => {
      illo.current = null;
    };
  }, [lib, key, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // À chaque image : la rotation de l'instant, puis le rendu.
  useLayoutEffect(() => {
    const scene = illo.current;
    if (!scene) return;
    scene.rotate.set({ x: rotate?.x || 0, y: rotate?.y || 0, z: rotate?.z || 0 });
    scene.updateRenderGraph();
  });

  if (!lib) return null;
  // Zdog lit width/height pour son cadre (-50 → 50) ; le CSS étire le dessin à la boîte.
  return <svg ref={svg} width={100} height={100} viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', ...style }} aria-hidden />;
}
