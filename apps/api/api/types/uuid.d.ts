// uuid v11 ships types via package.json "exports" field, which "moduleResolution: node" doesn't support.
declare module 'uuid' {
  export function v1(options?: Record<string, unknown>, buf?: Uint8Array, offset?: number): string;
  export function v3(name: string | Uint8Array, namespace: string | Uint8Array, buf?: Uint8Array, offset?: number): string;
  export function v4(options?: Record<string, unknown>, buf?: Uint8Array, offset?: number): string;
  export function v5(name: string | Uint8Array, namespace: string | Uint8Array, buf?: Uint8Array, offset?: number): string;
  export function v6(options?: Record<string, unknown>, buf?: Uint8Array, offset?: number): string;
  export function v7(options?: Record<string, unknown>, buf?: Uint8Array, offset?: number): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
  export function parse(uuid: string): Uint8Array;
  export function stringify(arr: Uint8Array, offset?: number): string;
  export const NIL: string;
  export const MAX: string;
}
