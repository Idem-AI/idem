/**
 * Registre des addons : chaque paquet `addon-<id>.js` s'y inscrit au chargement.
 *
 * Le moteur ne suppose jamais qu'un addon est là : `addon('three')` renvoie
 * undefined si le graphe de capacités ne l'a pas chargé, et la scène se replie.
 */
export interface MountedMedia {
  /** Pose le média à l'instant local lt (secondes) et le dessine. */
  update(lt: number): void;
}

export interface ThreeAddon {
  mount(canvas: HTMLCanvasElement, cfg: Record<string, any>, opts: { width: number; height: number; horizontal: boolean; span: number }): Promise<MountedMedia>;
}

export interface GsapAddon {
  gsap: any;
  CustomEase: any;
  /** Timeline en pause : le moteur la pose par `seek(lt)`, jamais par l'horloge. */
  timeline(vars?: Record<string, unknown>): any;
}

export interface AnimeAddon {
  createTimeline: (opts?: Record<string, unknown>) => any;
  stagger: (value: any, opts?: Record<string, unknown>) => any;
  utils: any;
  svg: any;
}

export interface FlubberAddon {
  interpolate(from: string, to: string, opts?: Record<string, unknown>): (t: number) => string;
  fromCircle(cx: number, cy: number, r: number, to: string, opts?: Record<string, unknown>): (t: number) => string;
  separate(from: string, to: string[], opts?: Record<string, unknown>): ((t: number) => string)[];
}

export interface LottieAddon {
  loadAnimation(opts: Record<string, unknown>): any;
}

export interface RiveAddon {
  mount(canvas: HTMLCanvasElement, buffer: ArrayBuffer): Promise<{ seek(t: number): void; duration: number }>;
}

/** Chart.js 4 et ses modules (treemap, sankey, matrice, étiquettes, repères), sans animation propre. */
export interface ChartAddon {
  Chart: any;
}

/** visx (composants React de data-visualisation) et les modules d3 purs qui les complètent. */
export interface VizAddon {
  axis: any;
  curve: any;
  geo: any;
  glyph: any;
  gradient: any;
  grid: any;
  group: any;
  heatmap: any;
  hierarchy: any;
  marker: any;
  pattern: any;
  scale: any;
  shape: any;
  text: any;
  d3: { interpolate: any; Delaunay: any; geo: any };
  countries(): { type: 'FeatureCollection'; features: { id?: string; properties: { name: string }; geometry: unknown }[] };
}

/** rough.js, perfect-freehand, simplex-noise. */
export interface DrawAddon {
  generator(): any;
  getStroke(points: number[][], options?: Record<string, unknown>): number[][];
  createNoise2D(random?: () => number): (x: number, y: number) => number;
  createNoise3D(random?: () => number): (x: number, y: number, z: number) => number;
}

/** Zdog : pseudo-3D plate rendue en SVG. */
export interface ZdogAddon {
  Zdog: any;
}

export interface Addons {
  three?: ThreeAddon;
  gsap?: GsapAddon;
  anime?: AnimeAddon;
  flubber?: FlubberAddon;
  lottie?: LottieAddon;
  rive?: RiveAddon;
  chart?: ChartAddon;
  viz?: VizAddon;
  draw?: DrawAddon;
  zdog?: ZdogAddon;
}

const registry = (): Addons => {
  const w = window as unknown as { __IDEM_ADDONS__?: Addons };
  w.__IDEM_ADDONS__ = w.__IDEM_ADDONS__ || {};
  return w.__IDEM_ADDONS__;
};

export function addon<K extends keyof Addons>(id: K): Addons[K] {
  return registry()[id];
}

export function registerAddon<K extends keyof Addons>(id: K, api: NonNullable<Addons[K]>): void {
  registry()[id] = api;
}
