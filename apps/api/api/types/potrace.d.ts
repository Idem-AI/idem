declare module 'potrace' {
  export interface PotraceOptions {
    turdSize?: number;
    optTolerance?: number;
    color?: string;
    background?: string;
    threshold?: number;
    turnPolicy?: string;
  }

  export type TraceCallback = (err: Error | null, svg: string) => void;

  export function trace(
    input: Buffer | string,
    options: PotraceOptions,
    callback: TraceCallback
  ): void;

  export function trace(input: Buffer | string, callback: TraceCallback): void;
}
