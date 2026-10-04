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
