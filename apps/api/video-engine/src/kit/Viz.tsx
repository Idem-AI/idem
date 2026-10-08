/**
 * Data-visualisation sur mesure : visx (composants React d'Airbnb) et d3, pilotés par le temps.
 *
 *  - useViz()        la librairie entière pour une scène écrite par l'IA (formes, échelles,
 *                    dégradés, motifs, courbes, hiérarchies, projections, d3) ; null sans l'addon
 *  - <DataArc>       une jauge qui se remplit jusqu'à un pourcentage
 *  - <GrowArea>      une courbe en aire qui se dessine de gauche à droite
 *  - <AfricaMap>     la carte de l'Afrique, les pays NOMMÉS dans le texte mis en valeur
 *  - <VoronoiField>  une mosaïque de cellules aux couleurs de la charte qui dérive lentement
 *
 * Tout est en SVG (viewBox 100 × 100, étiré à la boîte) ; sans l'addon `viz`, rien n'est rendu.
 */
import { CSSProperties, useId, useMemo } from 'react';
import { useEngine, useLocalTime } from '../context';
import { addon, VizAddon } from '../shared';
import { hash, mix, progress } from '../time';
import { countriesIn } from './africa';

export function useViz(): VizAddon | null {
  return addon('viz') || null;
}

const svgBox: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' };

/** Jauge : un arc de 270° qui se remplit jusqu'à `value` / `max`. */
export function DataArc({ value, max = 100, at = 0.2, dur = 1.4, thickness = 14, track = true, style }: { value: number; max?: number; at?: number; dur?: number; thickness?: number; track?: boolean; style?: CSSProperties }) {
  const viz = useViz();
  const { ease } = useEngine();
  const lt = useLocalTime();
  if (!viz) return null;
  const Arc = viz.shape.Arc;
  const start = -0.75 * Math.PI;
  const span = 1.5 * Math.PI;
  const share = Math.max(0, Math.min(1, value / (max || 1)));
  const p = ease(progress(lt, at, dur));
  const outer = 48;
  const inner = outer - thickness;
  return (
    <div data-chart-values={JSON.stringify([value])} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={svgBox} aria-hidden>
        <g transform="translate(50 52)">
          {track ? <Arc innerRadius={inner} outerRadius={outer} startAngle={start} endAngle={start + span} cornerRadius={thickness / 2} fill="var(--soft)" /> : null}
          {/* Toujours monté : un tracé retiré puis remis laissait une trace au rendu (image dépendante de l'ordre). */}
          <Arc innerRadius={inner} outerRadius={outer} startAngle={start} endAngle={start + Math.max(0.0001, span * share * p)} cornerRadius={thickness / 2} fill="var(--hl)" opacity={p > 0.001 ? 1 : 0} />
        </g>
      </svg>
    </div>
  );
}

/** Courbe en aire tracée de gauche à droite, à partir de `values` (lues dans les textes). */
export function GrowArea({ values, at = 0.2, dur = 1.6, style }: { values: number[]; at?: number; dur?: number; style?: CSSProperties }) {
  const viz = useViz();
  const { ease } = useEngine();
  const lt = useLocalTime();
  const id = useId().replace(/:/g, '');
  if (!viz || values.length < 2) return null;
  const { AreaClosed, LinePath } = viz.shape;
  const { LinearGradient } = viz.gradient;
  const max = Math.max(...values, 0) || 1;
  const x = (i: number) => 4 + (92 * i) / (values.length - 1);
  const y = (v: number) => 92 - (80 * v) / max;
  const points = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const p = ease(progress(lt, at, dur));
  return (
    <div data-chart-values={JSON.stringify(values)} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={svgBox} aria-hidden>
        <LinearGradient id={`ga-${id}`} from="var(--hl)" to="var(--hl)" fromOpacity={0.45} toOpacity={0} />
        <clipPath id={`gc-${id}`}>
          <rect x={0} y={0} width={100 * p} height={100} />
        </clipPath>
        <g clipPath={`url(#gc-${id})`}>
          <AreaClosed data={points} x={(d: number[]) => d[0]} y={(d: number[]) => d[1]} yScale={viz.scale.scaleLinear({ domain: [0, 100], range: [100, 0] })} curve={viz.curve.curveMonotoneX} fill={`url(#ga-${id})`} />
          <LinePath data={points} x={(d: number[]) => d[0]} y={(d: number[]) => d[1]} curve={viz.curve.curveMonotoneX} stroke="var(--hl)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" fill="none" />
        </g>
      </svg>
    </div>
  );
}

const AFRICA_IDS = new Set(['012', '024', '072', '108', '120', '140', '148', '178', '180', '204', '226', '231', '232', '262', '266', '270', '288', '324', '384', '404', '426', '430', '434', '450', '454', '466', '478', '504', '508', '516', '562', '566', '624', '646', '686', '694', '706', '710', '716', '728', '729', '732', '748', '768', '788', '800', '818', '834', '854', '894']);

/**
 * La carte de l'Afrique : le continent se pose, puis les pays NOMMÉS dans `highlightIn`
 * (texte de la scène : « Livraison au Sénégal et à Abidjan ») prennent la couleur de la marque,
 * l'un après l'autre. Aucun pays n'est mis en valeur s'il n'est pas dans le texte.
 */
export function AfricaMap({ highlightIn, at = 0.1, dur = 1.2, stagger = 0.25, style }: { highlightIn?: string; at?: number; dur?: number; stagger?: number; style?: CSSProperties }) {
  const viz = useViz();
  const { ease } = useEngine();
  const lt = useLocalTime();
  const map = useMemo(() => {
    if (!viz) return null;
    const all = viz.countries().features.filter((f) => AFRICA_IDS.has(String(f.id)) || f.properties.name === 'Somaliland');
    const fc = { type: 'FeatureCollection', features: all };
    const projection = viz.d3.geo.geoMercator().fitExtent([[3, 3], [97, 97]], fc);
    const path = viz.d3.geo.geoPath(projection);
    return all.map((f) => ({ id: String(f.id ?? f.properties.name), d: path(f) as string }));
  }, [viz]);
  const highlight = useMemo(() => countriesIn(highlightIn), [highlightIn]);
  if (!viz || !map) return null;
  const base = ease(progress(lt, at, dur));
  return (
    <div data-map-highlight={JSON.stringify(highlight)} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={svgBox} aria-hidden>
        {map.map((c) => {
          const rank = highlight.indexOf(c.id);
          const on = rank >= 0 ? ease(progress(lt, at + dur * 0.6 + rank * stagger, 0.6)) : 0;
          return <path key={c.id} d={c.d} fill={on > 0 ? 'var(--hl)' : 'var(--soft)'} fillOpacity={on > 0 ? mix(0.35, 1, on) : base} stroke="var(--bg)" strokeWidth={0.25} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
    </div>
  );
}

/** Mosaïque de Voronoï : cellules aux couleurs de la charte, germes qui dérivent avec le temps. */
export function VoronoiField({ cells = 26, seed = 7, opacity = 0.22, drift = 1, style }: { cells?: number; seed?: number; opacity?: number; drift?: number; style?: CSSProperties }) {
  const viz = useViz();
  const lt = useLocalTime();
  if (!viz) return null;
  const pts: number[] = [];
  for (let i = 0; i < cells; i++) {
    const a = hash(seed * 97 + i * 3.1) * Math.PI * 2;
    const r = 2 + hash(seed * 31 + i * 7.7) * 4;
    pts.push(hash(seed + i * 1.37) * 100 + Math.cos(a + lt * 0.35 * drift) * r, hash(seed * 13 + i * 2.21) * 100 + Math.sin(a + lt * 0.35 * drift) * r);
  }
  const voronoi = new viz.d3.Delaunay(Float64Array.from(pts)).voronoi([0, 0, 100, 100]);
  const fills = ['var(--hl)', 'var(--c-primary)', 'var(--c-secondary)', 'var(--soft)'];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ ...svgBox, opacity, ...style }} aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <path key={i} d={voronoi.renderCell(i)} fill={fills[Math.floor(hash(seed + i * 5.3) * fills.length)]} stroke="var(--bg)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
