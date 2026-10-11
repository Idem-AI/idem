/**
 * Émission du SVG : de la scène composée à un fichier autonome.
 *
 * Le fichier produit n'a besoin de rien d'autre que lui-même : pas de `<text>` (les lettres sont
 * des tracés), pas de police, pas d'image, pas de référence externe, pas de script. Les rôles
 * de couleur de la palette sont résolus ici — c'est ce qui permet d'écrire, depuis la même
 * scène, la version couleur, monochrome ou inversée.
 */
import { optimize } from 'svgo';
import type { LogoPalette } from '../ir/logo.schema';
import { contrast, ensureContrast, isHex } from '../util/colors';
import type { ComposedScene } from './compose';
import type { Paint, Part } from './scene';

export type ColorMode = 'original' | 'mono' | 'inverted';

/** Fond sombre de référence pour la déclinaison inversée et les contrôles de contraste. */
export const DARK_BACKGROUND = '#0b0f19';
export const LIGHT_BACKGROUND = '#ffffff';
/** Contraste minimal d'une couleur d'encre sur son fond (seuil WCAG des éléments graphiques). */
export const MIN_INK_CONTRAST = 3;

export interface EmitOptions {
  palette: LogoPalette;
  mode?: ColorMode;
  /** Couleur unique du mode `mono`. */
  monoColor?: string;
  title: string;
  description?: string;
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Les couleurs de rôle de la palette, avec leurs replis (ink2 → ink, accent → ink2 → ink). */
export function paletteColors(palette: LogoPalette): Record<'ink' | 'ink2' | 'accent', string> {
  const ink = palette.ink;
  const ink2 = palette.ink2 ?? ink;
  return { ink, ink2, accent: palette.accent ?? ink2 };
}

/** La couleur hexadécimale d'un rôle pour un mode donné ; `null` pour une découpe ou « aucune ». */
export function resolvePaint(paint: Paint, options: Pick<EmitOptions, 'palette' | 'mode' | 'monoColor'>): string | null {
  if (paint === 'none' || paint === 'paper') return null;
  const mode = options.mode ?? 'original';
  if (mode === 'mono') return options.monoColor ?? '#111111';
  const colors = paletteColors(options.palette);
  const base = isHex(paint) ? paint.toLowerCase() : colors[paint as 'ink' | 'ink2' | 'accent'];
  return mode === 'inverted' ? ensureContrast(base, DARK_BACKGROUND, MIN_INK_CONTRAST + 0.5) : base;
}

function pathElement(part: Part, options: EmitOptions): string | null {
  const fill = resolvePaint(part.paint, options);
  const stroke = part.stroke ? resolvePaint(part.stroke.color, options) : null;
  if (!fill && !stroke) return null;
  const attrs = [`d="${part.shape.d}"`];
  attrs.push(fill ? `fill="${fill}"` : 'fill="none"');
  if (part.stroke && stroke) {
    attrs.push(`stroke="${stroke}"`, `stroke-width="${Number(part.stroke.width.toFixed(2))}"`, `stroke-linecap="${part.stroke.cap}"`, `stroke-linejoin="${part.stroke.join}"`);
  }
  if (part.opacity !== undefined && part.opacity < 1) attrs.push(`opacity="${part.opacity}"`);
  return `<path ${attrs.join(' ')}/>`;
}

/** Le SVG brut de la scène (avant optimisation). */
export function emitSvg(scene: ComposedScene, options: EmitOptions): string {
  const group = (id: string, parts: Part[]) => {
    const elements = parts.map((p) => pathElement(p, options)).filter(Boolean);
    return elements.length ? `<g id="${id}">${elements.join('')}</g>` : '';
  };
  const w = Number(scene.width.toFixed(2));
  const h = Number(scene.height.toFixed(2));
  const body = [group('symbol', scene.groups.symbol), group('wordmark', scene.groups.wordmark), group('tagline', scene.groups.tagline)].join('');
  const desc = options.description ? `<desc id="logo-desc">${xml(options.description)}</desc>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="logo-title${desc ? ' logo-desc' : ''}"><title id="logo-title">${xml(options.title)}</title>${desc}${body}</svg>`;
}

/**
 * Optimisation SVGO. Le `viewBox` et les `<title>`/`<desc>` (accessibilité) sont conservés par le
 * préréglage de SVGO 4 ; on garde aussi les identifiants de groupes (`symbol`, `wordmark`) dont
 * d'autres services dépendent.
 */
export function optimizeSvg(svg: string): string {
  try {
    const result = optimize(svg, {
      multipass: true,
      floatPrecision: 2,
      plugins: [
        {
          name: 'preset-default',
          params: { overrides: { cleanupIds: false } },
        },
      ],
    });
    return result.data;
  } catch {
    return svg;
  }
}

/** Les couleurs hexadécimales distinctes d'un SVG. */
export function colorsOf(svg: string): string[] {
  const found = new Set<string>();
  for (const m of svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"/g)) found.add(m[1].toLowerCase());
  return [...found];
}

export function svgStats(svg: string): { paths: number; nodes: number; bytes: number; colors: string[] } {
  const paths = (svg.match(/<path\b/g) || []).length;
  let nodes = 0;
  for (const m of svg.matchAll(/\sd="([^"]+)"/g)) nodes += (m[1].match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length;
  return { paths, nodes, bytes: Buffer.byteLength(svg, 'utf8'), colors: colorsOf(svg) };
}

export { contrast };
