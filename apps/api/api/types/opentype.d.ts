/**
 * Déclarations minimales pour `opentype.js` v2 (le paquet ne publie pas ses
 * typings et `@types/opentype.js` ne couvre que la v1). On ne déclare que ce
 * que le pipeline de composition de logo utilise réellement.
 */
declare module 'opentype.js' {
  export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  export interface Path {
    toPathData(decimalPlaces?: number): string;
    getBoundingBox(): BoundingBox;
  }

  export interface Glyph {
    index: number;
    name: string | null;
    unicode?: number;
    advanceWidth?: number;
    getPath(x?: number, y?: number, fontSize?: number): Path;
  }

  /** Options de rendu ; `letterSpacing` s'exprime en em (0.08 = 8 % du corps). */
  export interface RenderOptions {
    kerning?: boolean;
    letterSpacing?: number;
    tracking?: number;
    features?: Record<string, boolean>;
  }

  export interface Os2Table {
    sCapHeight?: number;
    sxHeight?: number;
    usWeightClass?: number;
  }

  export interface FontTables {
    os2?: Os2Table;
    [table: string]: unknown;
  }

  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    tables: FontTables;
    names: Record<string, Record<string, string>>;
    getPath(text: string, x: number, y: number, fontSize: number, options?: RenderOptions): Path;
    getAdvanceWidth(text: string, fontSize: number, options?: RenderOptions): number;
    getKerningValue(left: Glyph, right: Glyph): number;
    stringToGlyphs(text: string): Glyph[];
    charToGlyph(char: string): Glyph;
  }

  export function parse(buffer: ArrayBuffer, options?: Record<string, unknown>): Font;
}
