/**
 * LE DÉCOR D'UNE PAGE DE DOCUMENT — business plan, charte graphique, pitch deck.
 *
 * Même marché que sur les visuels et les vidéos : l'agent NOMME, le code DESSINE. Mais un
 * document n'est pas une affiche — il se lit. La règle qui en découle, et qui est tenue ici :
 *
 *   le décor ne va que sur les pages qui RESPIRENT.
 *
 * Une ouverture de section, une citation, une page à chiffre-clé ont de la place ; une page de
 * texte long, un tableau ou un graphique n'en ont pas, et un décor y volerait l'attention au
 * lieu de la porter. `pageBreathes()` tranche sur le CONTENU réel, pas sur une intention.
 *
 * UN SEUL vocabulaire de motifs : celui de la CHARTE (`branding.patterns`). Une marque qui a ses
 * motifs ne doit pas en voir d'autres apparaître dans ses documents — c'est ce qui faisait que la
 * charte promettait une chose et que le plan en montrait une autre. Les formes du kit ne servent
 * plus que de filet pour une marque dont les motifs ne sont pas encore déposés.
 *
 * Qui choisit, selon le cran (comme partout ailleurs) :
 *   Low / Medium  le code, d'après le style et la graine — zéro jeton ;
 *   High / Max    le directeur artistique de la page, dans le menu que le code lui donne ;
 *   Ultra         le compositeur écrit la page et pose lui-même ses `<x-gfx>`.
 */
import type { PatternStrength } from './brandPatterns';
import type { GfxParams } from '../visual/poster/kit/types';
import { hashSeed } from '../visual/poster/kit/math';

/** Ce qu'une page porte, vu du décor. */
export interface PageShape {
  /** Blocs de la page, par nature. */
  kinds: string[];
  /** Signes de texte courant (prose, citations) : au-delà, la page est pleine. */
  textLength: number;
}

/** Les natures de bloc qui remplissent une page : un décor n'y a pas sa place. */
const DENSE = new Set(['table', 'chart', 'sources', 'typeScale', 'patternGrid', 'socialPosts', 'socialBanners', 'mockupShowcase', 'logoStory', 'compositionPrinciples', 'artDirectionRules', 'typeSpecimen', 'logoDisplay']);

/**
 * La page a-t-elle de la place pour un décor ?
 *
 * Trois cas, dans l'ordre : jamais sur une page dense (tableau, graphique, spécimen de charte) ;
 * toujours sur une citation (c'est la page qui en demande le plus) ; sinon, seulement si le
 * texte reste court.
 */
export function pageBreathes(shape: PageShape): boolean {
  if (shape.kinds.some((k) => DENSE.has(k))) return false;
  if (shape.kinds.includes('quote')) return true;
  return shape.textLength <= 900 && shape.kinds.length <= 3;
}

export interface PageDecorDef {
  id: string;
  /** Une ligne pour le menu du directeur artistique (anglais : la langue des agents). */
  summary: string;
  /** Affinités de style (identifiant du catalogue de direction artistique). */
  styles: Record<string, number>;
  /** La forme et sa place, en pourcentage de la page (le code convertit dans l'unité de la page). */
  layers: (shape: PageShape) => { params: GfxParams; place: { left: string; top: string; width: string; height: string } }[];
  /**
   * La zone remplie par LE MOTIF DE LA MARQUE (`branding.patterns`), quand elle en a un.
   *
   * C'est la forme préférée du décor : une page de business plan qui porte le motif de la charte
   * appartient visiblement à la marque, là où une forme inventée pour l'occasion ne dit rien.
   * `scale` est le côté de la tuile à l'écran, en millimètres.
   */
  pattern?: { left: string; top: string; width: string; height: string; scaleMm: number; strength: PatternStrength };
}

/** Un ton de la couleur du document : le décor ne pose jamais une couleur franche sous un texte. */
const TONE = 'decor';

export const PAGE_DECORS: PageDecorDef[] = [
  {
    id: 'none',
    summary: 'nothing: the type and the white space carry the page alone',
    styles: { minimalism: 1.6, swiss: 0.6, editorial: 0.5, brutalism: 0.6, 'corporate-modern': 0.4 },
    layers: () => [],
  },
  {
    id: 'brand-band',
    summary: "the brand's own motif as a band along the bottom edge",
    styles: { bohemian: 1.1, maximalism: 0.6, 'collage-art': 0.6, editorial: 0.5, retro: 0.5, swiss: 0.4, 'corporate-modern': 0.5 },
    // Une bande de pied ne porte aucun texte : le motif peut s'y voir.
    pattern: { left: '0', top: '95.5%', width: '100%', height: '4.5%', scaleMm: 6, strength: 'present' },
    layers: () => [{ params: { kind: 'weave', color: TONE, color2: TONE, variant: 'diamond', density: 5, opacity: 0.5 }, place: { left: '0', top: '95%', width: '100%', height: '5%' } }],
  },
  {
    id: 'brand-corner',
    summary: "the brand's own motif as a block in the outer top corner",
    styles: { swiss: 0.7, editorial: 0.6, 'corporate-modern': 0.7, minimalism: 0.3, brutalism: 0.5, 'vector-art': 0.5 },
    pattern: { left: '74%', top: '0', width: '26%', height: '9%', scaleMm: 5, strength: 'present' },
    layers: () => [{ params: { kind: 'arcs', color: TONE, color2: TONE, density: 1, opacity: 0.55 }, place: { left: '74%', top: '0', width: '26%', height: '9%' } }],
  },
  {
    id: 'edge-band',
    summary: 'a woven band along the bottom edge (West-African textile geometry)',
    styles: { bohemian: 1.2, maximalism: 0.6, 'collage-art': 0.6, editorial: 0.3, retro: 0.4 },
    layers: () => [{ params: { kind: 'weave', color: TONE, color2: TONE, variant: 'diamond', density: 5, opacity: 0.5 }, place: { left: '0', top: '95%', width: '100%', height: '5%' } }],
  },
  {
    id: 'corner-arcs',
    summary: 'quarter-circle modules in the top corner (Bauhaus geometry)',
    styles: { 'vector-art': 0.9, 'pop-art': 0.7, maximalism: 0.5, y2k: 0.5, 'corporate-modern': 0.4 },
    layers: () => [{ params: { kind: 'arcs', color: TONE, color2: TONE, density: 1, opacity: 0.55 }, place: { left: '72%', top: '0', width: '28%', height: '18%' } }],
  },
  {
    id: 'brand-field',
    summary: "the brand's own motif as a whisper over the whole page, behind the text",
    styles: { editorial: 0.5, bohemian: 0.5, retro: 0.4, maximalism: 0.4, minimalism: 0.2, swiss: 0.3 },
    // Derrière un texte : l'opacité la plus basse du barème, et jamais davantage.
    pattern: { left: '0', top: '0', width: '100%', height: '100%', scaleMm: 7, strength: 'whisper' },
    layers: () => [],
  },
  {
    id: 'tonal-contours',
    summary: 'faint topographic contour lines across the lower half',
    styles: { editorial: 0.9, futuristic: 0.6, surreal: 0.5, cyberpunk: 0.4, aurora: 0.3 },
    layers: () => [{ params: { kind: 'contours', color: TONE, color2: TONE, variant: 'topo', stroke: 0.18, density: 3, opacity: 0.6 }, place: { left: '0', top: '55%', width: '100%', height: '45%' } }],
  },
  {
    id: 'corner-rings',
    summary: 'large concentric rings bleeding off the outer corner',
    styles: { minimalism: 0.4, swiss: 0.5, 'corporate-modern': 0.7, y2k: 0.6, glassmorphism: 0.5 },
    layers: () => [{ params: { kind: 'rings', color: TONE, color2: TONE, variant: 'offset', stroke: 0.22, density: 4, opacity: 0.6 }, place: { left: '62%', top: '-12%', width: '55%', height: '40%' } }],
  },
  {
    id: 'crop-marks',
    summary: 'crop-mark corners and a fine grid: swiss, precise, systematic',
    styles: { swiss: 1.4, brutalism: 0.8, 'pixel-art': 0.7, futuristic: 0.5, editorial: 0.4 },
    layers: () => [{ params: { kind: 'frame', color: TONE, variant: 'corners', stroke: 0.22, opacity: 0.7 }, place: { left: '2%', top: '1.5%', width: '96%', height: '97%' } }],
  },
  {
    id: 'waves-foot',
    summary: 'soft stacked waves along the bottom edge',
    styles: { bohemian: 0.6, retro: 0.6, aurora: 0.7, 'vector-art': 0.5, clay: 0.6 },
    layers: () => [{ params: { kind: 'waves', color: TONE, color2: TONE, variant: 'layers', density: 2, opacity: 0.5 }, place: { left: '0', top: '78%', width: '100%', height: '22%' } }],
  },
];

export const PAGE_DECOR_BY_ID = new Map(PAGE_DECORS.map((d) => [d.id, d]));

/** Ce que la direction artistique interdit, traduit en décors écartés. */
export function excludedDecors(donts: string[] = []): Set<string> {
  const text = donts.join(' ').toLowerCase();
  const out = new Set<string>();
  if (/pattern|texture|motif/.test(text)) ['edge-band', 'tonal-contours'].forEach((id) => out.add(id));
  if (/geometr|decorat|ornament|shape|forme|d[ée]cor/.test(text)) ['corner-arcs', 'corner-rings', 'edge-band', 'waves-foot'].forEach((id) => out.add(id));
  if (/gradient|glow|lueur/.test(text)) out.add('waves-foot');
  return out;
}

/**
 * Les décors classés pour cette page, sans un jeton : style × graine × page. Le premier est
 * celui que les crans Low et Medium posent ; les cinq premiers forment le menu du cran High.
 */
export function rankPageDecors(input: { styleId?: string | null; donts?: string[]; docKey: string; pageName: string; hasBrandPattern?: boolean }): { id: string; weight: number }[] {
  const style = String(input.styleId || '').toLowerCase();
  const excluded = excludedDecors(input.donts);
  // La marque a ses motifs : on ne propose QU'EUX (plus « aucun décor »). Les formes du kit sont
  // le filet des marques dont les motifs ne sont pas encore déposés, pas une seconde grammaire.
  const pool = input.hasBrandPattern ? PAGE_DECORS.filter((d) => d.pattern || d.id === 'none') : PAGE_DECORS.filter((d) => !d.pattern);
  return pool
    .filter((d) => !excluded.has(d.id))
    .map((d) => ({ id: d.id, weight: (d.styles[style] ?? 0.35) + ((hashSeed(`${input.docKey}:${input.pageName}:${d.id}`) % 1000) / 1000) * 0.5 }))
    .sort((a, b) => b.weight - a.weight);
}

/** Le menu du directeur artistique de la page (cran High et au-delà). */
export const pageDecorMenu = (ranked: { id: string }[], count = 5) => ranked.slice(0, count).map((r) => r.id);

export const pageDecorSummary = (id: string) => PAGE_DECOR_BY_ID.get(id)?.summary || id;
