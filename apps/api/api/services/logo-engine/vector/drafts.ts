/**
 * BROUILLONS VECTORIELS — ce que le moteur demande à OmniSVG et ce qu'il en fait.
 *
 *   demande   une phrase anglaise courte, posée par le code : le type de marque, ce que le symbole
 *             montre (la ligne `drawing` du directeur, sinon son idée), le nombre de couleurs à plat.
 *             OmniSVG dessine mieux des formes simples aux couleurs nommées, et ne sait pas écrire :
 *             la demande exclut le texte, le moteur pose le nom lui-même.
 *   document  le document du planificateur pour la MÊME direction (nom, police, composition), dont
 *             le symbole est remplacé par les couches importées (`import.ts`).
 *
 * Le brouillon repasse ensuite par le pipeline qualité comme tous les autres, puis par le jury et
 * le critique : il n'a aucun passe-droit.
 */
import type { ConceptType, LogoLayer, LogoPalette } from '../ir/logo.schema';
import { hexToRgb, rgbToHsl } from '../util/colors';
import type { ImportedSymbol } from './import';

/** Les catégories où un symbole dessiné a sa place (les lettres restent au moteur typographique). */
export const VECTOR_TYPES: ConceptType[] = ['pictorial', 'abstract', 'mascot', 'combination', 'emblem', 'negative-space', 'minimal', 'dynamic'];

/** Candidats demandés par direction (le jury et les mesures départagent). */
export const VECTOR_CANDIDATES = 4;

const STYLE: Partial<Record<ConceptType, string>> = {
  pictorial: 'a minimal flat pictogram',
  combination: 'a minimal flat pictogram',
  abstract: 'an abstract geometric mark',
  dynamic: 'an abstract geometric mark with a sense of motion',
  mascot: 'a friendly flat mascot character head',
  emblem: 'a flat badge emblem',
  'negative-space': 'a bold flat symbol where the white negative space forms a second shape',
  minimal: 'a single minimal flat shape',
};

/** Un nom de couleur simple, pour la demande (le moteur repeint ensuite aux couleurs exactes de la charte). */
export function colorName(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (s < 0.15) return l < 0.2 ? 'black' : l > 0.85 ? 'white' : l < 0.45 ? 'dark gray' : 'gray';
  const hue = ((h % 360) + 360) % 360;
  const names: [number, string][] = [
    [10, 'red'],
    [40, 'orange'],
    [65, 'yellow'],
    [160, 'green'],
    [195, 'teal'],
    [255, 'blue'],
    [290, 'purple'],
    [335, 'pink'],
    [361, 'red'],
  ];
  const base = names.find(([max]) => hue < max)?.[1] ?? 'red';
  return l < 0.3 ? `dark ${base}` : l > 0.7 ? `light ${base}` : base;
}

/** La phrase envoyée à OmniSVG (anglais, ≤ 600 caractères). */
export function symbolPrompt(input: { type: ConceptType; idea: string; drawing?: string; palette: LogoPalette }): string {
  const subject = (input.drawing || input.idea || '').replace(/["\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 260);
  const colors = [...new Set([input.palette.ink, input.palette.accent, input.palette.ink2].filter((c): c is string => !!c).map(colorName))].slice(0, 3);
  const style = STYLE[input.type] ?? 'a minimal flat logo icon';
  return [
    `Logo icon: ${style} showing ${subject}.`,
    `Bold simple geometric shapes, ${colors.length} solid flat color${colors.length > 1 ? 's' : ''} (${colors.join(', ')}), centered on a white background.`,
    'No text, no letters, no gradients, no thin lines.',
  ].join(' ');
}

type Doc = Record<string, unknown>;

/**
 * Le document d'un brouillon vectoriel : celui du planificateur pour la même direction, son
 * symbole remplacé. Le nom (couche texte du planificateur, police et effets compris) est gardé
 * tant qu'il est posé par la composition ; un texte placé DANS le symbole (emblème courbé) part avec lui.
 */
export function vectorDoc(
  base: Doc | null,
  imported: ImportedSymbol,
  ctx: { brief: Doc; palette: LogoPalette; type: ConceptType; idea: string; withName: boolean; seed: number; brandName: string }
): Doc {
  const baseLayers = Array.isArray(base?.layers) ? (base!.layers as LogoLayer[]) : [];
  const texts = baseLayers.filter((l) => l.kind === 'text' && (l.role === 'wordmark' || l.role === 'tagline') && !('at' in l && l.at) && !('curve' in l && l.curve));
  const nameLayers: LogoLayer[] = ctx.withName
    ? texts.length
      ? texts
      : [{ kind: 'text', id: 'name', role: 'wordmark', fill: 'ink', content: ctx.brandName, font: { role: 'display', weight: 700 }, tracking: 0, case: 'none' } as LogoLayer]
    : [];
  const composition = { ...((base?.composition as Doc | undefined) ?? {}), layout: nameLayers.length ? 'auto' : 'symbol-only' };
  return {
    brief: base?.brief ?? ctx.brief,
    concept: { type: ctx.type, rationale: ctx.idea.slice(0, 400), motifs: ['omnisvg'], recipe: `omnisvg:${ctx.type}` },
    palette: ctx.palette,
    composition,
    layers: [...imported.layers, ...nameLayers],
    meta: { seed: ctx.seed, engine: 'logo-engine/1+omnisvg' },
  };
}
