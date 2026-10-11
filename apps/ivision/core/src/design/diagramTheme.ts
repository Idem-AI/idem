/**
 * LE THÈME MERMAID D'UNE MARQUE — ce qui rend un schéma présentable.
 *
 * Mermaid sait dessiner vingt sortes de schémas à partir d'une ligne de texte ; c'est le meilleur
 * marché possible pour un agent (« flowchart LR A-->B », 78 signes, contre 10 Ko de SVG écrit à la
 * main). Mais laissé à son thème par défaut, il sort du noir, de l'ocre et des dégradés bleu-orange
 * qui n'ont rien à voir avec la marque — et, sur un quadrant, des aplats si proches que les points
 * ne se voient plus.
 *
 * Chaque famille de schéma a ses propres variables (`cScale0…11` pour les chronologies et les
 * cartes mentales, `quadrant*` pour les positionnements, `pie1…12`, `actor*` pour les parcours).
 * Elles sont toutes écrites ici, depuis le design system du document — comme `buildChartConfig`
 * le fait pour Chart.js. C'est la condition pour qu'un schéma soit utilisable sans relecture.
 */
import { contrastRatio } from './color';
import { mixHex } from '../visual/poster/kit/math';

/** Les schémas que le moteur accepte : chacun est thémé ET vérifié. Le reste est refusé. */
export const DIAGRAM_KINDS = ['flowchart', 'timeline', 'quadrantChart', 'journey', 'mindmap', 'sankey-beta', 'pie'] as const;
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

/** Ce que chaque schéma répond, pour le menu du rédacteur (anglais : la langue des agents). */
export const DIAGRAM_GUIDE: Record<DiagramKind, string> = {
  flowchart: 'a process, a value chain, how something flows from one step to the next',
  timeline: 'a roadmap: what happens in which year or phase',
  quadrantChart: 'a positioning: where you and the others sit on two axes',
  journey: 'a customer journey, step by step, with how it feels',
  mindmap: 'an ecosystem, a breakdown of a market or an offer into branches',
  'sankey-beta': 'where a volume or a budget goes, and in what proportion',
  pie: 'the parts of a whole (use it only for 3 to 6 parts)',
};

/** La première ligne dit le type : un schéma d'une autre famille est refusé. */
export function diagramKindOf(source: string): DiagramKind | null {
  const head = (source || '').trim().split(/\s|\n/)[0];
  return (DIAGRAM_KINDS as readonly string[]).includes(head) ? (head as DiagramKind) : null;
}

export interface DiagramPalette {
  /** Couleurs de la charte. */
  primary: string;
  secondary: string;
  accent: string;
  /** Fond de page et encres, déjà contrastés par le design system. */
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  rule: string;
  /** Rampe de la marque (50 → 950), pour les séries. */
  brand?: Record<string, string>;
  fontFamily: string;
  fontSizePx: number;
}

/** L'encre qui se lit sur un fond : celle de la charte si elle passe, sinon blanc ou noir. */
function inkOn(bg: string, ink: string): string {
  if (contrastRatio(ink, bg) >= 4.5) return ink;
  return contrastRatio('#ffffff', bg) >= contrastRatio('#111111', bg) ? '#ffffff' : '#111111';
}

/**
 * La série de couleurs d'une marque : des TONS de sa palette, assez distincts pour qu'on
 * distingue douze entrées, assez proches pour que l'ensemble reste une seule marque.
 */
export function brandSeries(p: DiagramPalette, count = 12): string[] {
  const bases = [p.primary, p.accent, p.secondary].filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = bases[i % bases.length];
    // Chaque tour s'éclaircit : trois couleurs donnent douze tons lisibles, jamais douze criards.
    const round = Math.floor(i / bases.length);
    out.push(round === 0 ? base : mixHex(base, p.surface, Math.min(0.62, round * 0.22)));
  }
  return out;
}

/**
 * Les variables de thème Mermaid d'une marque.
 *
 * Elles couvrent les familles acceptées : boîtes et flèches (flowchart), séries (timeline,
 * mindmap, pie, journey), aplats et axes (quadrant), liens (sankey). Une variable oubliée se voit
 * immédiatement — c'est par là que revenaient le noir et l'ocre du thème par défaut.
 */
export function brandMermaidTheme(p: DiagramPalette): Record<string, string> {
  const series = brandSeries(p);
  const onPrimary = inkOn(p.primary, p.ink);
  // Les aplats d'un quadrant sont des VOILES : les points et leurs noms doivent rester lisibles.
  const veil = (t: number) => mixHex(p.surface, p.primary, t);
  const vars: Record<string, string> = {
    darkMode: 'false',
    background: p.surface,
    fontFamily: p.fontFamily,
    fontSize: `${p.fontSizePx}px`,

    // Boîtes, traits et textes (flowchart, et socle de tout le reste).
    primaryColor: p.primary,
    primaryTextColor: onPrimary,
    primaryBorderColor: mixHex(p.primary, '#000000', 0.22),
    secondaryColor: mixHex(p.secondary, p.surface, 0.1),
    secondaryTextColor: inkOn(mixHex(p.secondary, p.surface, 0.1), p.ink),
    secondaryBorderColor: mixHex(p.secondary, '#000000', 0.2),
    tertiaryColor: p.surfaceRaised,
    tertiaryTextColor: p.ink,
    tertiaryBorderColor: p.rule,
    lineColor: mixHex(p.ink, p.surface, 0.35),
    textColor: p.ink,
    mainBkg: p.primary,
    nodeBorder: mixHex(p.primary, '#000000', 0.22),
    nodeTextColor: onPrimary,
    clusterBkg: p.surfaceRaised,
    clusterBorder: p.rule,
    titleColor: p.ink,
    edgeLabelBackground: p.surface,

    // Les séries (chronologie, carte mentale, camembert, parcours).
    ...Object.fromEntries(series.map((c, i) => [`cScale${i}`, c])),
    ...Object.fromEntries(series.map((c, i) => [`cScaleLabel${i}`, inkOn(c, p.ink)])),
    ...Object.fromEntries(series.map((c, i) => [`cScalePeer${i}`, mixHex(c, '#000000', 0.18)])),
    ...Object.fromEntries(series.map((c, i) => [`pie${i + 1}`, c])),
    pieTitleTextColor: p.ink,
    pieSectionTextColor: onPrimary,
    pieOuterStrokeColor: p.rule,
    pieStrokeColor: p.surface,

    // Le positionnement : des voiles, des axes lisibles, des points francs.
    quadrant1Fill: veil(0.1),
    quadrant2Fill: veil(0.05),
    quadrant3Fill: veil(0.02),
    quadrant4Fill: veil(0.07),
    quadrant1TextFill: p.ink,
    quadrant2TextFill: p.ink,
    quadrant3TextFill: p.ink,
    quadrant4TextFill: p.ink,
    quadrantPointFill: p.primary,
    quadrantPointTextFill: p.ink,
    quadrantXAxisTextFill: p.inkMuted,
    quadrantYAxisTextFill: p.inkMuted,
    quadrantInternalBorderStrokeFill: p.rule,
    quadrantExternalBorderStrokeFill: p.rule,
    quadrantTitleFill: p.ink,

    // Le parcours client : les acteurs et le ressenti.
    actorBkg: p.primary,
    actorTextColor: onPrimary,
    actorBorder: mixHex(p.primary, '#000000', 0.22),
    labelBoxBkgColor: p.surfaceRaised,
    labelBoxBorderColor: p.rule,
    labelTextColor: p.ink,
    noteBkgColor: p.surfaceRaised,
    noteTextColor: p.ink,
    noteBorderColor: p.rule,
  };
  return vars;
}
