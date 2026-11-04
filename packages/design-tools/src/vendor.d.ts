// Déclarations minimales des dépendances sans types publiés (seules les fonctions employées).

declare module 'culori' {
  export interface Oklch { mode: 'oklch'; l: number; c: number; h?: number; alpha?: number }
  export type Color = { mode: string; [k: string]: unknown };
  export function parse(color: string): Color | undefined;
  export function converter(mode: 'oklch'): (color: Color | string) => Oklch | undefined;
  export function formatHex(color: Color | Oklch | string): string | undefined;
  export function wcagContrast(a: Color | string, b: Color | string): number;
  export function clampChroma<T>(color: T, mode?: string): T;
}

declare module 'poisson-disk-sampling' {
  export default class PoissonDiskSampling {
    constructor(o: { shape: number[]; minDistance: number; maxDistance?: number; tries?: number }, rng?: () => number);
    fill(): number[][];
  }
}

declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToSVG(imagedata: { width: number; height: number; data: Uint8ClampedArray | Buffer }, options?: Record<string, unknown>): string;
  };
  export default ImageTracer;
}
