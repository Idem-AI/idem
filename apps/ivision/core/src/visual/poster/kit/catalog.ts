/**
 * LE CATALOGUE DU KIT — ce que chaque forme sait faire, en une ligne.
 *
 * C'est le « menu » des agents (comme le graphe de capacités du moteur vidéo) : le designer ne voit
 * pas le code des formes, il voit leur nom, leurs déclinaisons et ce qu'elles disent. Le même
 * catalogue sert à valider ce qu'il demande (forme inconnue, déclinaison inventée).
 */
import { ICON_CONCEPT_IDS } from '../../../video/video.icons';
import type { GfxEntry, GfxKind } from './types';

export const GFX_CATALOG: GfxEntry[] = [
  { kind: 'blob', summary: 'organic pebble / cloud shape, soft and friendly', variants: ['single', 'duo', 'outline'], paint: 'both' },
  { kind: 'rings', summary: 'concentric circles: ripples, target, depth — bleed it off a corner', variants: ['lines', 'target', 'offset'], paint: 'both' },
  { kind: 'arcs', summary: 'grid of quarter/half circles and discs: Bauhaus geometry, strong and graphic', variants: ['modules'], paint: 'fill' },
  { kind: 'waves', summary: 'stacked waves along an edge, or flowing lines', variants: ['layers', 'lines'], paint: 'both' },
  { kind: 'contours', summary: 'topographic contour lines or flow lines: editorial, technical, calm', variants: ['topo', 'flow'], paint: 'stroke' },
  { kind: 'dots', summary: 'halftone dot field fading in size: pop, retro, print', variants: ['radial', 'linear', 'uniform'], paint: 'fill' },
  { kind: 'stripes', summary: 'diagonal / straight stripes or crosshatch', variants: ['diagonal', 'vertical', 'horizontal', 'hatch'], paint: 'stroke' },
  { kind: 'burst', summary: 'sunburst rays from the box centre: energy, announcement', variants: ['rays'], paint: 'fill' },
  { kind: 'grid', summary: 'technical grid, registration crosses or ruler ticks: swiss, precise', variants: ['lines', 'cross', 'ruler'], paint: 'stroke' },
  { kind: 'swash', summary: 'brush stroke: underline, marker highlight or slash behind/under a key word', variants: ['underline', 'highlight', 'slash'], paint: 'fill' },
  { kind: 'scribble', summary: 'hand-drawn gesture: circle, arrow, wavy underline, zigzag', variants: ['circle', 'arrow', 'underline', 'zigzag'], paint: 'stroke' },
  { kind: 'frame', summary: 'offset hard-shadow frame, crop-mark corners or double rule', variants: ['offset', 'corners', 'double'], paint: 'both' },
  { kind: 'mesh', summary: 'aurora / mesh gradient glow made of soft radial lights', variants: ['aurora'], paint: 'fill' },
  { kind: 'weave', summary: 'West-African woven band (kente / bogolan / wax inspired geometry)', variants: ['zigzag', 'diamond', 'saw', 'mud'], paint: 'both' },
  { kind: 'grain', summary: 'film / paper grain over the whole visual (always full canvas, low opacity)', variants: ['fine', 'coarse', 'paper'], paint: 'texture' },
  { kind: 'icon', summary: 'one pictogram (line icon) from a concept list — only when it carries a real fact', variants: ['line'], paint: 'stroke', functional: true },
];

export const GFX_BY_KIND = new Map<GfxKind, GfxEntry>(GFX_CATALOG.map((e) => [e.kind, e]));

export const GFX_KINDS = GFX_CATALOG.map((e) => e.kind);

/** Les concepts de pictogramme (le vocabulaire du moteur vidéo, partagé). */
export const ICON_CONCEPTS_LIST = ICON_CONCEPT_IDS;

/** Épaisseur de trait par défaut, en % du petit côté. */
export const DEFAULT_STROKE: Partial<Record<GfxKind, number>> = {
  blob: 0.45,
  rings: 0.38,
  waves: 0.24,
  contours: 0.2,
  stripes: 0.55,
  grid: 0.1,
  scribble: 0.5,
  frame: 0.45,
  weave: 0.3,
  icon: 0.2,
};

/** Fusion et opacité par défaut : le grain se fond, le surligneur se superpose. */
export const DEFAULT_LOOK: Partial<Record<GfxKind, { blend?: 'multiply' | 'overlay' | 'soft-light'; opacity?: number }>> = {
  grain: { blend: 'overlay', opacity: 0.3 },
};

/**
 * Le manifeste des formes pour les designers (Max : éléments JSON ; Ultra : balise `<x-gfx>`).
 * Court à dessein : c'est ce qui remplace des centaines de jetons de SVG écrit à la main.
 */
export function kitManifest(format: 'json' | 'html', opts: { icons?: boolean } = {}): string[] {
  const entries = GFX_CATALOG.filter((e) => opts.icons || e.kind !== 'icon');
  const syntax =
    format === 'json'
      ? 'GRAPHICS (drawn by the code from one line — never write SVG): {"type":"graphic","kind":"rings","x":55,"y":-8,"w":60,"h":60,"color":"primary","color2":"tint","variant":"lines","seed":3,"opacity":1,"density":3,"stroke":0.4,"blend":"normal"} — x,y,w,h in percent of the canvas (they may bleed past the edges). "grain" is always full canvas: {"type":"graphic","kind":"grain","opacity":0.25}. Only "kind" is required.'
      : 'GRAPHICS (drawn by the code from one tag — never write SVG paths by hand): <x-gfx kind="rings" x="620" y="-90" w="620" h="620" color="primary" color2="tint" variant="lines" seed="3" opacity="1" density="3" stroke="0.4" blend="normal"></x-gfx> — x,y,w,h in px (they may bleed past the canvas edges), colours are tokens. "grain" is always full canvas: <x-gfx kind="grain" opacity="0.25"></x-gfx>. Only kind is required; place them BEFORE the text boxes in the document (later = on top).';
  return [
    syntax,
    'GRAPHIC KINDS (variants, first = default):',
    ...entries.map((e) => `- ${e.kind} [${e.variants.join('|')}]: ${e.summary}`),
    ...(opts.icons ? [`ICON concepts: ${ICON_CONCEPTS_LIST.join(', ')} (use "concept")`] : []),
    'RULES: 1 to 3 graphics plus at most one grain — each LARGE and structural (a bleeding ring set, a band of waves, a halftone field), never confetti. Graphics sit BEHIND text unless they are thin lines or at most 20% opaque. Do not stack more than two filled graphics of the same kind. One neon token is never a graphic fill.',
  ];
}
