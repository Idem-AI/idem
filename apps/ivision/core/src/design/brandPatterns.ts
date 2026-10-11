/**
 * LES MOTIFS DE LA MARQUE — des fichiers SVG, pas des dégradés recalculés.
 *
 * La charte a une page « Motifs ». Jusqu'ici elle les dessinait en CSS au moment du rendu
 * (`brandMotifs.ts`), si bien qu'ils n'existaient nulle part : chaque livrable qui voulait « le
 * motif de la marque » le recalculait, et la couverture, la carte de visite et la page de la
 * charte pouvaient diverger. Un motif de marque est un ACTIF, au même titre qu'un logo.
 *
 * Ici, chaque motif est une TUILE SVG réellement répétable (`background-repeat: repeat`) :
 * déposée une fois dans le stockage à la création de la charte, elle est ensuite la même partout
 * — page de charte, business plan, pitch deck, carte de visite, visuels — et l'utilisateur peut
 * la télécharger avec ses logos.
 *
 * Répétable veut dire : toute forme qui touche un bord est redessinée sur le bord opposé. Les
 * mathématiques sont ici, une fois, plutôt que dans six réglages CSS approximatifs.
 */

/** Le vocabulaire de motifs d'une marque. `weave` reprend la géométrie des étoffes d'Afrique de l'Ouest. */
export type BrandPatternKind = 'stripes' | 'grid' | 'dots' | 'chevron' | 'arcs' | 'checker' | 'weave';

export const BRAND_PATTERN_KINDS: BrandPatternKind[] = ['stripes', 'grid', 'dots', 'chevron', 'arcs', 'checker', 'weave'];

/** Ce que chaque motif dit, pour les menus des agents et les légendes de la charte. */
export const BRAND_PATTERN_SUMMARY: Record<BrandPatternKind, string> = {
  stripes: 'fine diagonal stripes',
  grid: 'a fine technical grid',
  dots: 'a regular dot field',
  chevron: 'a chevron zigzag',
  arcs: 'interlocking quarter circles',
  checker: 'a two-tone checker',
  weave: 'a woven band (West-African textile geometry)',
};

export interface BrandPatternInput {
  kind: BrandPatternKind;
  /** L'encre du motif et son fond, en #rrggbb. */
  ink: string;
  ground: string;
  /** Côté de la tuile, en px (le consommateur choisit l'échelle d'affichage). */
  tile?: number;
  /** Épaisseur du trait, en fraction de la tuile (0,02 à 0,25). */
  weight?: number;
}

const n = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Le contenu d'une tuile, répétable par construction.
 *
 * Chaque générateur reçoit le côté `t` et l'épaisseur `w` en px, et ne dessine QUE dans
 * [0, t] × [0, t] — ce qui dépasse d'un bord est redessiné sur le bord opposé.
 */
const TILES: Record<BrandPatternKind, (t: number, w: number, ink: string) => string> = {
  // Deux bandes à 45° : celle du coin se complète par sa jumelle décalée d'une tuile.
  stripes: (t, w, ink) => {
    const band = (shift: number) => `M${n(-w + shift)},${n(t)} L${n(-w + shift + t)},0 L${n(shift + t)},0 L${n(shift)},${n(t)}Z`;
    return `<path d="${band(0)} ${band(t)} ${band(-t)}" fill="${ink}"/>`;
  },
  // Les deux filets des bords : répétés, ils forment la grille complète.
  grid: (t, w, ink) => `<path d="M0,0 H${n(t)} V${n(w)} H0Z M0,0 V${n(t)} H${n(w)} V0Z" fill="${ink}"/>`,
  // Un point au centre et un quart de point à chaque coin.
  dots: (t, w, ink) => {
    const r = clamp(w * 1.6, t * 0.04, t * 0.22);
    const corners = [
      [0, 0],
      [t, 0],
      [0, t],
      [t, t],
    ];
    return `<circle cx="${n(t / 2)}" cy="${n(t / 2)}" r="${n(r)}" fill="${ink}"/>${corners.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${ink}"/>`).join('')}`;
  },
  // Un chevron dont les pointes tombent exactement sur les bords : il se prolonge de tuile en tuile.
  chevron: (t, w, ink) => {
    const line = (y: number) => `M0,${n(y + t / 2)} L${n(t / 2)},${n(y)} L${n(t)},${n(y + t / 2)} L${n(t)},${n(y + t / 2 + w)} L${n(t / 2)},${n(y + w)} L0,${n(y + t / 2 + w)}Z`;
    return `<path d="${line(0)} ${line(-t)} ${line(t)}" fill="${ink}"/>`;
  },
  // Des cercles centrés sur les COINS, rognés par la tuile : chaque quart rejoint celui de la
  // tuile voisine, et le motif se referme en cercles pleins sur la trame. Un cercle au centre
  // double la densité sans casser la répétition.
  arcs: (t, w, ink) => {
    const r = t / 2;
    const ring = (cx: number, cy: number) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${ink}" stroke-width="${n(w)}"/>`;
    return [ring(0, 0), ring(t, 0), ring(0, t), ring(t, t), ring(t / 2, t / 2)].join('');
  },
  // Le damier : deux carrés sur quatre, donc répétable tel quel.
  checker: (t, _w, ink) => `<path d="M0,0 h${n(t / 2)} v${n(t / 2)} h-${n(t / 2)}Z M${n(t / 2)},${n(t / 2)} h${n(t / 2)} v${n(t / 2)} h-${n(t / 2)}Z" fill="${ink}"/>`,
  // Le tissage : une trame verticale et deux fils horizontaux qui passent dessus et dessous.
  weave: (t, w, ink) => {
    const b = clamp(w * 2.2, t * 0.08, t * 0.3);
    const half = t / 2;
    return (
      `<path d="M0,0 h${n(b)} v${n(t)} h-${n(b)}Z M${n(half)},0 h${n(b)} v${n(t)} h-${n(b)}Z" fill="${ink}" opacity="0.55"/>` +
      `<path d="M0,${n(half - b / 2)} h${n(t)} v${n(b)} h-${n(t)}Z" fill="${ink}"/>` +
      `<path d="M0,${n(t - b / 2)} h${n(t)} v${n(b)} h-${n(t)}Z M0,${n(-b / 2)} h${n(t)} v${n(b)} h-${n(t)}Z" fill="${ink}" opacity="0.8"/>`
    );
  },
};

/** La tuile SVG d'un motif : un document autonome, répétable, aux couleurs de la marque. */
export function brandPatternSvg(input: BrandPatternInput): string {
  const t = clamp(input.tile ?? 48, 12, 512);
  const w = clamp((input.weight ?? 0.08) * t, 0.5, t * 0.3);
  const draw = TILES[input.kind] ?? TILES.stripes;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(t)}" height="${n(t)}" viewBox="0 0 ${n(t)} ${n(t)}" shape-rendering="crispEdges">`,
    `<rect width="${n(t)}" height="${n(t)}" fill="${input.ground}"/>`,
    `<g clip-path="url(#c)">${draw(t, w, input.ink)}</g>`,
    `<defs><clipPath id="c"><rect width="${n(t)}" height="${n(t)}"/></clipPath></defs>`,
    '</svg>',
  ].join('');
}

/**
 * Le motif en `background-image`, répété : la seule façon correcte d'employer une tuile.
 *
 * Guillemets SIMPLES autour de l'URL : la valeur finit dans un attribut `style="…"`, où un
 * guillemet double refermerait l'attribut — le motif disparaissait sans un mot d'erreur.
 */
export function brandPatternCss(url: string, scalePx: number): Record<string, string> {
  return {
    'background-image': `url('${url.replace(/'/g, "%27")}')`,
    'background-repeat': 'repeat',
    'background-size': `${Math.round(scalePx)}px ${Math.round(scalePx)}px`,
  };
}

/**
 * UN MOTIF EN FOND — l'opacité est tenue par le code, pas par l'appelant.
 *
 * Un motif de marque a deux emplois, et ils n'ont pas la même force :
 *  - SPÉCIMEN (la page « Motifs » de la charte) : il se montre, à pleine force ;
 *  - FOND (couverture, bande de page, face de carte) : il se devine. Au-delà, il mange le texte
 *    et la page paraît bruyante — c'est exactement ce qu'on voyait sur les couvertures, où le
 *    motif était tramé à l'encre d'ACCENT à 55 %.
 *
 * `strength` dit l'intention, le code dit l'opacité : « whisper » sous un texte, « quiet » sur un
 * aplat, « present » sur une bande qui ne porte rien.
 */
export type PatternStrength = 'whisper' | 'quiet' | 'present';

export const PATTERN_OPACITY: Record<PatternStrength, number> = { whisper: 0.06, quiet: 0.12, present: 0.22 };

/** Le motif posé en fond, à l'opacité que son emploi autorise. */
export function backgroundPatternCss(url: string, scalePx: number, strength: PatternStrength = 'quiet'): Record<string, string> {
  return { ...brandPatternCss(url, scalePx), opacity: String(PATTERN_OPACITY[strength]) };
}

/** Un motif de la marque, tel qu'il est déposé dans le stockage et gardé sur la marque. */
export interface BrandPatternAsset {
  id: string;
  /** « Motif principal », « Trame fine »… */
  label: string;
  kind: BrandPatternKind;
  /** À quoi il sert, en une ligne (légende de la charte, menu des agents). */
  role: string;
  ink: string;
  ground: string;
  /** Côté de la tuile en px, pour l'échelle d'affichage. */
  tile: number;
  url: string;
}

export interface BrandPatternPlan {
  id: string;
  label: string;
  role: string;
  kind: BrandPatternKind;
  ink: string;
  ground: string;
  tile: number;
}

/**
 * Les quatre motifs d'une marque, tirés de son vocabulaire de style.
 *
 * Le répertoire vient de la FAMILLE de style (angles vifs → grille et filets ; rayon franc →
 * arcs et points), comme avant : deux marques proches partagent leur grammaire, deux marques
 * éloignées non. Ce qui change, c'est que le résultat est déposé une fois pour toutes.
 */
export function planBrandPatterns(input: {
  repertoire: BrandPatternKind[];
  primary: string;
  accent: string;
  surface: string;
  subtle: string;
}): BrandPatternPlan[] {
  const [a, b, c, d] = [0, 1, 2, 3].map((i) => input.repertoire[i % input.repertoire.length]);
  return [
    { id: 'primary', label: 'Motif principal', role: 'Aplats et fonds de page', kind: a, ink: input.primary, ground: input.surface, tile: 48 },
    { id: 'secondary', label: 'Motif secondaire', role: 'Zones de rappel', kind: b, ink: input.accent, ground: input.surface, tile: 48 },
    { id: 'subtle', label: 'Trame fine', role: 'Fonds discrets', kind: c, ink: input.primary, ground: input.subtle, tile: 32 },
    { id: 'inverted', label: 'Motif inversé', role: 'Sur fond de marque', kind: d, ink: input.surface, ground: input.primary, tile: 48 },
  ];
}
