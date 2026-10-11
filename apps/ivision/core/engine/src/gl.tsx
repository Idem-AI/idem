/**
 * Les toiles WebGL pilotées par le temps (shaders OGL, filtres PixiJS).
 *
 * Chaque toile s'inscrit au registre ; à chaque image, le moteur la pose à l'instant t :
 *   - la scène est visible → une toile NEUVE est créée dans l'hôte si besoin, puis se dessine ;
 *   - la scène est loin (plus de 1,5 s) → la toile est retirée et son contexte libéré.
 * Chromium ne garde que 16 contextes WebGL actifs : sans ce cycle de vie, une vidéo de vingt scènes à
 * shader perdrait les premiers. Une toile dont le contexte a été libéré ne peut plus en recevoir un autre :
 * c'est pourquoi la toile est créée et retirée à la main (React ne gère que l'hôte), et qu'une scène
 * qu'on revisite (aperçu, retouche) retrouve une toile neuve.
 *
 * Au rendu, rien ne tourne seul : aucun requestAnimationFrame, `uTime` vient du moteur.
 *
 * Marqueurs lus par les contrôles, sur l'HÔTE (qui, lui, ne disparaît pas) :
 *   data-gl-ready    la toile a été dessinée au moins une fois
 *   data-gl-live     une toile existe en ce moment (sinon le composant montre son repli)
 *   data-gl-failed   la création est impossible (pas de WebGL, effet inconnu) : repli définitif
 */
import { useEffect, useRef } from 'react';
import { Timed, useScene } from './context';
import { GlInstance } from './shared';

interface Entry {
  s: Timed;
  host: HTMLElement;
  width: number;
  height: number;
  make: (canvas: HTMLCanvasElement) => GlInstance | null | undefined;
  params: (lt: number) => Record<string, any>;
  canvas: HTMLCanvasElement | null;
  inst: GlInstance | null;
  failed: boolean;
}

const entries = new Set<Entry>();

const near = (s: Timed, t: number, pad: number) => t >= s.visFrom - pad && t <= s.visTo + pad;

function release(e: Entry) {
  e.inst?.dispose();
  e.inst = null;
  e.canvas?.remove();
  e.canvas = null;
  delete e.host.dataset.glLive;
}

/** À appeler après chaque rendu React : pose chaque toile visible à son instant. */
export function syncGl(t: number): void {
  for (const e of entries) {
    if (!e.host.isConnected) continue;
    if (!near(e.s, t, 0.08)) {
      if (e.inst && !near(e.s, t, 1.5)) release(e);
      continue;
    }
    if (!e.inst && !e.failed) {
      const canvas = document.createElement('canvas');
      canvas.className = 'gl-canvas';
      canvas.width = e.width;
      canvas.height = e.height;
      // Dans l'hôte AVANT la création : `make` lit les couleurs de la charte (var(--hl)…) sur l'arbre de la scène.
      e.host.appendChild(canvas);
      let made: GlInstance | null | undefined = null;
      try {
        made = e.make(canvas);
      } catch (error) {
        console.error('gl create', (error as Error)?.message);
      }
      // `undefined` : pas encore prêt (une image qui se décode) — on réessaie à l'image suivante ;
      // `null` : impossible (pas de WebGL, effet inconnu) — le composant garde son repli.
      if (made) {
        e.canvas = canvas;
        e.inst = made;
        e.host.dataset.glLive = '1';
      } else {
        canvas.remove();
        if (made === undefined) continue;
        e.failed = true;
        e.host.dataset.glFailed = '1';
      }
    }
    // Le temps d'une toile est celui de la scène (comme la 3D) : 0 à l'entrée des éléments.
    if (e.inst) {
      e.host.dataset.glReady = '1';
      e.inst.render(e.params(Math.max(0, t - e.s.tin)));
    }
  }
}

export interface GlOptions {
  /** Définition de la toile, en pixels. */
  width: number;
  height: number;
  /** Marqueurs posés sur l'hôte (data-shader, data-image-fx…). */
  attrs?: Record<string, string>;
  /** Crée l'instance sur la toile fournie (`undefined` : pas prêt, `null` : impossible). */
  make: (canvas: HTMLCanvasElement) => GlInstance | null | undefined;
  /** Les paramètres de l'instant. */
  params: (lt: number) => Record<string, any>;
}

/** Inscrit une toile au registre. Rend la ref de l'hôte (`<div ref={ref} className="gl-host" />`). */
export function useGl(opts: GlOptions) {
  const s = useScene();
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(opts);
  latest.current = opts;
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    for (const [k, v] of Object.entries(latest.current.attrs || {})) host.setAttribute(k, v);
    const entry: Entry = {
      s,
      host,
      width: latest.current.width,
      height: latest.current.height,
      make: (canvas) => latest.current.make(canvas),
      params: (lt) => latest.current.params(lt),
      canvas: null,
      inst: null,
      failed: false,
    };
    entries.add(entry);
    return () => {
      entries.delete(entry);
      release(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

let probe: CanvasRenderingContext2D | null = null;

/** Une couleur CSS (`#hex`, `rgb()`, `var(--x)`) en [r, g, b] de 0 à 1, résolue sur l'élément. */
export function resolveRgb(el: Element, color: string): [number, number, number] {
  let c = (color || '').trim();
  const m = c.match(/^var\((--[\w-]+)\)$/);
  if (m) c = getComputedStyle(el).getPropertyValue(m[1]).trim() || '#888888';
  probe = probe || document.createElement('canvas').getContext('2d')!;
  probe.fillStyle = '#888888';
  probe.fillStyle = c;
  // Le navigateur normalise toute couleur valide en #rrggbb (ou rgba() si elle est translucide).
  const norm = probe.fillStyle as string;
  if (norm.startsWith('#')) {
    const n = parseInt(norm.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = norm.match(/[\d.]+/g)?.map(Number) || [136, 136, 136];
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
}
