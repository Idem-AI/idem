declare module 'flubber' {
  type Interp = (t: number) => string;
  export function interpolate(from: string, to: string, opts?: Record<string, unknown>): Interp;
  export function fromCircle(cx: number, cy: number, r: number, to: string, opts?: Record<string, unknown>): Interp;
  export function separate(from: string, to: string[], opts?: Record<string, unknown>): Interp[];
}

declare module 'lottie-web/build/player/lottie_light' {
  const lottie: { loadAnimation(opts: Record<string, unknown>): any };
  export default lottie;
}

declare module 'zdog' {
  const Zdog: any;
  export default Zdog;
}

declare module 'topojson-client' {
  export function feature(topology: any, object: any): any;
}

declare module 'world-atlas/countries-110m.json' {
  const topology: any;
  export default topology;
}
