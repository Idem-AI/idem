/**
 * <ChartJs> — un graphique Chart.js 4 piloté par le temps de la vidéo.
 *
 * Chart.js n'anime rien lui-même (addon `chart` : animation coupée) : à chaque image, ce
 * composant pose les valeurs de l'instant puis `update('none')`, qui dessine aussitôt. La
 * même image quel que soit l'ordre de lecture.
 *
 * Couleurs et polices viennent de la charte de la scène (variables CSS résolues) : une série
 * sans couleur prend celle de la marque. Les valeurs affichées sont exposées dans
 * `data-chart-values` : le contrôle de rendu vérifie qu'elles viennent des textes de la scène.
 *
 * Croissance (`grow`) :
 *  - rise   les valeurs montent depuis zéro, point après point (barres, lignes, radar, bulles)
 *  - sweep  l'anneau ou le camembert se déploie (doughnut, pie, polarArea)
 *  - reveal le graphique se découvre de gauche à droite (treemap, sankey, matrice, lignes)
 *  - none   posé d'emblée
 */
import { CSSProperties, useLayoutEffect, useMemo, useRef } from 'react';
import { useEngine, useLocalTime } from '../context';
import { addon } from '../shared';
import { progress } from '../time';
import { brandTokens, BrandTokens, seriesColors, withAlpha } from './data';

export type ChartGrow = 'rise' | 'sweep' | 'reveal' | 'none';

export interface ChartJsProps {
  /** bar, line, doughnut, pie, radar, polarArea, bubble, scatter, treemap, sankey, matrix. */
  type: string;
  /** Données Chart.js ; les couleurs peuvent être écrites `var(--hl)` (charte de la scène). */
  data: { labels?: string[]; datasets: Record<string, any>[] };
  /** Options Chart.js, fusionnées par-dessus celles de la charte. */
  options?: Record<string, any>;
  /** Début de la croissance (s, temps local de la scène) et durée. */
  at?: number;
  dur?: number;
  grow?: ChartGrow;
  /** Décalage entre deux points (s). */
  stagger?: number;
  /** Étiquettes des valeurs (plugin datalabels), dans la police de titre. */
  values?: boolean;
  /** Format des étiquettes ; par défaut, la valeur arrondie avec espaces de milliers. */
  format?: (v: number) => string;
  style?: CSSProperties;
  className?: string;
}

const RING = new Set(['doughnut', 'pie', 'polarArea']);
const WIPE = new Set(['treemap', 'sankey', 'matrix']);

/** Les nombres d'une série, quel que soit son format (nombres, {y}, {v}, {value}, {flow}, {r}). */
function valuesOf(datasets: Record<string, any>[]): number[] {
  const out: number[] = [];
  for (const ds of datasets) {
    for (const d of ds.data || ds.tree || []) {
      if (typeof d === 'number') out.push(d);
      else if (d && typeof d === 'object') for (const k of ['y', 'v', 'value', 'flow', 'r']) if (typeof d[k] === 'number') out.push(d[k]);
    }
  }
  return out;
}

/** Une donnée à l'instant `p` (0 → 1) : les grandeurs montent, les positions restent. */
function scaleDatum(d: any, p: number): any {
  if (typeof d === 'number') return d * p;
  if (d && typeof d === 'object') {
    const next = { ...d };
    for (const k of ['y', 'v', 'value', 'flow', 'r']) if (typeof d[k] === 'number') next[k] = d[k] * p;
    return next;
  }
  return d;
}

const groupThousands = (v: number) => {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',');
};

/** Découvre la zone du graphique de gauche à droite (option `plugins.idemReveal.p`). */
const REVEAL = {
  id: 'idemReveal',
  beforeDatasetsDraw(chart: any, _a: unknown, opts: { p?: number }) {
    const p = opts?.p ?? 1;
    if (p >= 1) return;
    const { left, top, right, bottom } = chart.chartArea;
    chart.ctx.save();
    chart.ctx.beginPath();
    chart.ctx.rect(left - 2, top - 2, (right - left + 4) * Math.max(0, p), bottom - top + 4);
    chart.ctx.clip();
  },
  afterDatasetsDraw(chart: any, _a: unknown, opts: { p?: number }) {
    if ((opts?.p ?? 1) < 1) chart.ctx.restore();
  },
};

/** Les réglages de la charte : polices, encres, grilles discrètes, séries aux couleurs de la marque. */
function brandConfig(type: string, data: ChartJsProps['data'], t: BrandTokens, u: number, values: boolean, format: (v: number) => string): Record<string, any> {
  const colors = seriesColors(t);
  const datasets = data.datasets.map((ds, i) => {
    const c = colors[i % colors.length];
    if (RING.has(type)) {
      const n = (ds.data || []).length;
      return { borderWidth: 0, backgroundColor: Array.from({ length: n }, (_, k) => (k === 0 ? t.hl : withAlpha(colors[(k + i) % colors.length], k === n - 1 && n === 2 ? 0.18 : 0.85))), ...ds };
    }
    if (type === 'line') return { borderColor: c, backgroundColor: withAlpha(c, 0.18), borderWidth: Math.max(2, u * 0.5), pointRadius: u * 0.7, pointBackgroundColor: c, tension: 0.35, fill: true, ...ds };
    if (type === 'radar') return { borderColor: c, backgroundColor: withAlpha(c, 0.25), borderWidth: Math.max(2, u * 0.4), pointRadius: 0, ...ds };
    if (type === 'treemap') return { backgroundColor: withAlpha(c, 0.9), borderColor: t.bg, borderWidth: Math.max(2, u * 0.4), spacing: u * 0.3, ...ds };
    if (type === 'sankey') return { colorFrom: () => t.hl, colorTo: () => t.primary, colorMode: 'gradient', borderWidth: 0, ...ds };
    if (type === 'matrix') return { backgroundColor: (ctx: any) => withAlpha(c, 0.2 + 0.8 * Math.min(1, (ctx.raw?.v ?? 0) / Math.max(1, ...valuesOf([ds])))), borderWidth: 0, ...ds };
    return { backgroundColor: c, borderRadius: u * 0.8, borderSkipped: false, ...ds };
  });
  const tick = { color: t.muted, font: { family: t.body, size: Math.round(u * 1.8) } };
  const grid = { color: withAlpha(t.ink, 0.1), drawTicks: false };
  return {
    type,
    data: { ...data, datasets },
    options: {
      devicePixelRatio: window.devicePixelRatio || 1,
      layout: { padding: u * 1.5 },
      color: t.ink,
      font: { family: t.body },
      scales: RING.has(type) || WIPE.has(type) ? undefined : type === 'radar' ? { r: { grid, angleLines: grid, ticks: { display: false }, pointLabels: { ...tick, color: t.ink } } } : { x: { grid: { display: false }, border: { display: false }, ticks: tick }, y: { grid, border: { display: false }, ticks: tick, beginAtZero: true } },
      plugins: {
        datalabels: values
          ? { display: true, color: RING.has(type) ? t.hlInk : t.ink, anchor: RING.has(type) ? 'center' : 'end', align: RING.has(type) ? 'center' : 'end', offset: u * 0.4, font: { family: t.display, weight: 700, size: Math.round(u * 2.6) }, formatter: (v: any) => format(typeof v === 'number' ? v : v?.v ?? v?.y ?? v?.value ?? 0) }
          : { display: false },
        idemReveal: { p: 1 },
      },
    },
    plugins: [REVEAL],
  };
}

/** `var(--hl)` dans les couleurs d'une série → la couleur réelle (la toile ne lit pas le CSS). */
function resolveColors(datasets: Record<string, any>[], el: Element): Record<string, any>[] {
  const st = getComputedStyle(el);
  const one = (c: unknown) => {
    if (typeof c !== 'string') return c;
    const m = c.trim().match(/^var\((--[\w-]+)\)$/);
    return m ? st.getPropertyValue(m[1]).trim() || c : c;
  };
  const keys = ['backgroundColor', 'borderColor', 'pointBackgroundColor', 'hoverBackgroundColor'];
  return datasets.map((ds) => {
    const next = { ...ds };
    for (const k of keys) if (k in next) next[k] = Array.isArray(next[k]) ? next[k].map(one) : one(next[k]);
    return next;
  });
}

/** Fusion profonde des options de la scène par-dessus celles de la charte. */
function merge(base: any, extra: any): any {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra;
  const out: any = { ...(base && typeof base === 'object' ? base : {}) };
  for (const [k, v] of Object.entries(extra)) out[k] = merge(out[k], v);
  return out;
}

export function ChartJs({ type, data, options, at = 0.15, dur = 1.2, grow, stagger = 0.06, values = false, format = groupThousands, style, className }: ChartJsProps) {
  const { ease, u } = useEngine();
  const lt = useLocalTime();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<any>(null);
  const lib = addon('chart');
  const mode: ChartGrow = grow || (RING.has(type) ? 'sweep' : WIPE.has(type) ? 'reveal' : 'rise');
  // La définition du graphique (sans le temps) : il n'est reconstruit que si elle change.
  const key = useMemo(() => JSON.stringify({ type, data, options, values }), [type, data, options, values]);
  const targets = useMemo(() => data.datasets.map((ds) => (ds.data || []).slice()), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!lib || !box.current || !canvas.current) return;
    const w = Math.max(1, box.current.offsetWidth);
    const h = Math.max(1, box.current.offsetHeight);
    canvas.current.style.width = `${w}px`;
    canvas.current.style.height = `${h}px`;
    canvas.current.width = Math.round(w * (window.devicePixelRatio || 1));
    canvas.current.height = Math.round(h * (window.devicePixelRatio || 1));
    const config = brandConfig(type, { ...data, datasets: resolveColors(data.datasets, box.current) }, brandTokens(box.current), u, values, format);
    config.options = merge(config.options, options);
    chart.current = new lib.Chart(canvas.current, config);
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, [lib, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // À chaque image : les valeurs de l'instant, puis un dessin synchrone.
  useLayoutEffect(() => {
    const c = chart.current;
    if (!c) return;
    const p = ease(progress(lt, at, dur));
    c.data.datasets.forEach((ds: any, i: number) => {
      const target = targets[i] || [];
      if (mode === 'rise') ds.data = target.map((d: any, k: number) => scaleDatum(d, ease(progress(lt, at + k * stagger, dur))));
      else ds.data = target;
    });
    if (mode === 'sweep') {
      c.options.circumference = 360 * p;
      c.options.rotation = -90 * (1 - p);
    }
    c.options.plugins.idemReveal.p = mode === 'reveal' ? p : 1;
    c.update('none');
  });

  const shown = useMemo(() => JSON.stringify(valuesOf(data.datasets)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={box} className={className} data-chart-values={shown} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {lib ? <canvas ref={canvas} style={{ position: 'absolute', inset: 0, display: 'block' }} /> : null}
    </div>
  );
}
