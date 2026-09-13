/**
 * Les PRIMITIVES partagées par tous les dessins de page.
 *
 * Elles vivaient dans `sectionRenderer.ts`, qui était seul à dessiner. Les
 * familles de mise en page (`layoutFamilies.ts`) ajoutent des dizaines de
 * dessins d'en-tête, de pied de page et de blocs : ils ont besoin de la MÊME
 * frontière d'échappement, du MÊME ajusteur de titre et du MÊME contexte de page.
 * Les recopier aurait créé deux frontières entre contenu et balisage — et une
 * frontière qui existe en deux exemplaires finit toujours par diverger.
 *
 * Ce module ne dépend d'aucun dessin : `sectionRenderer`, `familyChrome` et
 * `familyBlocks` en dépendent tous les trois, jamais l'inverse.
 */

import type { RenderOptions } from './sectionRenderer';
import { DocumentDesignSystem } from './documentDesignSystem';
import { SectionSeed } from './designSeed';
import { SectionContent } from './sectionContent';
import { MEASURE, snap, TITLE_WRAP } from './layoutGrid';
import { contrastRatio } from './color';
import { LayoutFamily } from './layoutFamilies';

/**
 * Piles de repli typographiques.
 *
 * Volontairement GÉNÉRIQUES. Nommer une famille concrète (Georgia, Helvetica
 * Neue, Arial) ferait remonter le linter de charte, qui les compte parmi les
 * polices « par défaut » — et il aurait raison : sur une page où la police de
 * charte ne charge pas, tomber sur Georgia est un accident, pas une décision.
 *
 * Le pipeline PDF pose la police du texte sur `body` et celle des titres sur
 * `h1..h6`, et rien d'autre : un style inline posé ici l'emporte, et tout
 * élément qui n'en porte pas HÉRITE de la racine de page (`rootStyle`). Il
 * posait autrefois `p, div, td { font-family: SECONDARY }` — une règle
 * d'élément bat toujours l'héritage, et elle écrasait la police de charte de
 * chaque texte composé dans un conteneur stylé.
 */
export const DISPLAY_FALLBACK = 'serif';

export const BODY_FALLBACK = 'sans-serif';

export function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Échappe un texte ET convertit ses marqueurs de citation `[sN]` en appels de
 * note.
 *
 * L'ordre compte : on échappe d'abord (le texte vient du modèle), puis on
 * reconnaît les marqueurs — les crochets ne font pas partie des caractères
 * échappés, donc ils survivent intacts. Faire l'inverse laisserait passer du
 * balisage.
 *
 * Les marqueurs sont posés par le modèle et pointent vers le bloc `sources`,
 * lui-même injecté par le service à partir des URLs réelles. Un marqueur qui
 * dépasse le nombre de sources est SUPPRIMÉ plutôt que rendu : un appel de note
 * qui ne mène nulle part décrédibilise ceux qui mènent quelque part.
 */
export function escCited(value: string, sourceCount: number): string {
  const escaped = esc(value);
  if (sourceCount === 0) {
    // Pas de sources : les marqueurs sont du bruit, on les retire.
    return escaped.replace(/\s*\[s\d+\]/g, '');
  }
  return escaped.replace(/\s*\[s(\d+)\]/g, (whole, raw) => {
    const index = Number.parseInt(raw, 10);
    if (!Number.isInteger(index) || index < 0 || index >= sourceCount) return '';
    return `<sup data-citation="${index}">${index + 1}</sup>`;
  });
}

/** Attribut de style : les valeurs sont produites ici, jamais par le modèle. */
export const style = (declarations: Record<string, string | number | undefined>): string => {
  const body = Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([property, value]) => `${property}:${value}`)
    .join(';');
  return body ? ` style="${body}"` : '';
};

export interface ColorRoles {
  /** Fond de la page. */
  ground: string;
  /** Couleur du titre de section. */
  heading: string;
  /** Fond du bandeau ou du panneau d'en-tête. */
  band: string;
  /** Encre lisible sur `band`. */
  onBand: string;
  /** Fond des blocs posés (cartes, tableaux). */
  panel: string;
  /** Couleur de mise en valeur (chiffres, filets accentués). */
  highlight: string;
  /** Encre lisible sur `highlight`. */
  onHighlight: string;
}

export interface TypeTreatment {
  titleSize: number;
  weight: number;
  transform: 'none' | 'uppercase' | 'lowercase';
  tracking: string;
  leading: number;
  /** Le titre s'écrit-il sur plusieurs lignes très serrées ? */
  stacked?: boolean;
}

export interface Tension {
  /** Multiplicateur appliqué au rythme de base entre blocs. */
  gap: number;
  /** Retrait latéral du flux, en mm. */
  inset: number;
  /** Filets de séparation entre blocs. */
  separator: 'none' | 'hairline' | 'thick';
  /** Le titre déborde-t-il dans la marge ? */
  bleed: boolean;
  /** Colonnes du flux de blocs. */
  columns: 1 | 2;
}

export interface Ctx {
  /**
   * Famille de mise en page du document (cf. `layoutFamilies.ts`) : elle décide
   * comment s'ouvre la section, comment se ferme la page et comment se dessine
   * chaque bloc.
   */
  family: LayoutFamily;
  /**
   * Ce qu'un dessin ne fait qu'UNE fois par page. La lettrine en est l'exemple :
   * posée sur chaque bloc de prose, elle cesserait d'ouvrir la section.
   */
  state: { dropCapUsed: boolean };
  /**
   * Retrait total du bord GAUCHE, en mm. Il diffère de `bleedMm` dès que la
   * famille décale la colonne de texte : un bandeau qui saigne doit alors
   * reprendre, à gauche, la marge de page ET la colonne décalée.
   */
  bleedLeftMm: number;
  ds: DocumentDesignSystem;
  roles: ColorRoles;
  type: TypeTreatment;
  tension: Tension;
  seed: SectionSeed;
  options: RenderOptions;
  /** Le format est-il en paysage ? Les archétypes s'y composent en colonnes. */
  landscape: boolean;
  /** Nombre de sources disponibles — borne les appels de note. */
  sourceCount: number;
  /**
   * Marge de la page RÉELLE, en mm.
   *
   * Les archétypes qui font saigner un bandeau jusqu'au bord la retranchent en
   * marge négative. Ils lisaient la marge de l'A4 portrait (12 mm) en dur, quel
   * que soit le format : sur une diapositive, dont la marge est de 14 mm, le
   * bandeau « pleine largeur » s'arrêtait donc à 2 mm du bord — un liseré de
   * fond de page le long des deux côtés, qui se lit comme un défaut d'impression.
   */
  padMm: number;
  /**
   * Largeur, en px, offerte à l'EN-TÊTE par la structure de la page.
   *
   * `fitTitleSize` la prenait pour 430 px en dur, quelle que soit la structure.
   * C'était à peu près juste pour une colonne des 5/12 et faux partout
   * ailleurs — de moitié trop petit en pleine largeur, de moitié trop grand
   * dans l'en-tête à deux colonnes de l'archétype « D ».
   */
  headerWidthPx: number;
  /**
   * Hauteur, en px, que le titre ne doit pas dépasser. Zéro = pas de borne.
   *
   * Sur une page PAGINÉE il n'y en a pas : le paginateur donne au document les
   * pages qu'il lui faut. Sur une page à hauteur fixe, c'est ce qui empêche un
   * titre de manger la page qu'il annonce.
   */
  titleHeightPx: number;
  /**
   * Présentation retenue pour les blocs qui en offrent plusieurs (0, 1 ou 2).
   *
   * Tirée des invariants du DOCUMENT — stratégie de couleur et accent
   * graphique — et non de la page : les pages d'une même charte s'accordent
   * entre elles, deux chartes ne se ressemblent pas. C'est la même règle que
   * pour la palette et le registre typographique, qui sont eux aussi des
   * propriétés du document et non de la page.
   */
  variant: number;
  /**
   * Retrait TOTAL du bord de page au contenu, en mm : marge de page plus
   * retrait de la tension spatiale.
   *
   * C'est la marge négative que doit poser un bandeau pour saigner jusqu'au
   * bord. Retrancher la seule marge de page laissait, sous la tension
   * `NEGATIVE_SPACE_HERO` et ses 14 mm de retrait, un liseré de fond de page
   * de 14 mm de chaque côté d'un bandeau censé être pleine largeur.
   */
  bleedMm: number;
  /**
   * Largeur, en px, de la zone réellement offerte aux blocs.
   *
   * ── POURQUOI UN BLOC DOIT LA CONNAÎTRE ──────────────────────────────────
   *
   * Les blocs se rendaient sans savoir où ils allaient être posés. Un
   * chiffre-clé composé à la taille `2xl` tient dans une A4 pleine largeur ;
   * dans la colonne de droite d'une diapositive `side` — les 7/12 de la
   * page, divisés en trois — il fait plus du double de la place disponible.
   * Rendu tel quel, « 2,3 Md FCFA » débordait sur son voisin et les deux se
   * chevauchaient.
   *
   * Renseignée APRÈS le choix de l'archétype, puisque c'est lui qui décide si
   * les blocs prennent toute la page ou une colonne.
   */
  contentWidthPx: number;
}

/** Millimètres en pixels CSS, à 96 ppp — la conversion du moteur de rendu. */
export const MM_TO_PX = 96 / 25.4;

/** Bloc insécable : le paginateur ne le coupera pas en deux pages. */
export const atomic = ' data-keep-together';

/**
 * Mots qui ne doivent JAMAIS rester seuls sur une ligne.
 *
 * Une esperluette ou une préposition isolée en bout de ligne est une faute de
 * composition connue (« orpheline ») : l'œil la lit comme un mot à part entière
 * et la ligne suivante paraît commencer au milieu d'une idée. Sur un titre de
 * couverture, elle occupe une ligne entière pour un seul caractère.
 */
export const ORPHAN_WORDS = /^(?:&|et|de|du|des|la|le|les|à|au|aux|and|of|the|for|to|in|on)$/i;

/**
 * Ajuste la taille d'un titre à ce qu'il DIT.
 *
 * ── LE DÉFAUT QUE CECI CORRIGE ──────────────────────────────────────────────
 *
 * La taille venait de l'humeur typographique seule, sans jamais regarder le
 * texte. Un titre de cinq mots recevait donc la taille d'un titre de deux, et
 * occupait cinq lignes — la moitié de la page avant la première phrase utile.
 * Observé en production : « Goal Planning & Operational Milestones » sur cinq
 * lignes, « Appendix: Operational & Financial Records » sur cinq également.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Deux contraintes, la plus sévère l'emporte :
 *
 *  1. le MOT LE PLUS LONG doit tenir sur une ligne. Un titre dont un seul mot
 *     déborde casse à chaque mot — c'est ce qui produisait l'escalier ;
 *  2. le titre ENTIER doit tenir en trois lignes au plus.
 *
 * La largeur de référence est prudente (la moitié de la zone utile) : plusieurs
 * archétypes posent le titre dans une colonne, et se tromper vers le bas donne
 * un titre un peu petit, se tromper vers le haut donne l'escalier.
 *
 * La borne basse à 62 % empêche l'autre excès : un titre très long réduit sans
 * limite cesserait d'être un titre.
 */
export function fitTitleSize(
  title: string,
  base: number,
  availablePx: number,
  trackingEm = 0,
  maxHeightPx = 0,
  leading = 1.05
): number {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return base;

  // Une capitale de labeur mesure ~0,52 em dans un display ; on prend 0,55 pour
  // rester du côté prudent.
  //
  // La largeur, elle, n'est plus supposée : elle vient de la structure de la
  // page (`ctx.headerWidthPx`). La valeur en dur de 430 px valait pour une
  // colonne des 5/12 et pour elle seule ; sur `stacked` elle bridait le titre
  // sans raison, sur l'en-tête à deux colonnes de « D » elle le laissait
  // occuper les trois quarts de la page.
  const columnPx = availablePx;
  // ── L'INTERLETTRAGE COMPTE DANS LA LARGEUR ──────────────────────────────
  //
  // L'avance était tenue pour constante, quelle que soit l'humeur
  // typographique. Or `WIDE_WHISPER` pose 0,28 em entre chaque signe : un titre
  // y est plus de moitié plus large que ce que le calcul supposait. C'est ce
  // qui produisait le défaut observé — « DEUX FAMILLES, TROIS REGISTRES »
  // traversant la diapositive jusqu'au bord, et « LE CAFÉ DE SPÉCIALITÉ ARRIVE
  // AU CAMEROUN » débordant sur une seconde ligne pour un seul mot.
  //
  // L'espace ajouté suit CHAQUE signe : il s'ajoute donc directement à
  // l'avance moyenne, sans coefficient.
  const advance = 0.55 + Math.max(0, trackingEm);

  const longest = Math.max(...words.map((w) => w.length));
  const byLongestWord = columnPx / (longest * advance);

  const totalChars = title.trim().length;
  const byThreeLines = (columnPx * 3) / (totalChars * advance);

  // ── LA TROISIÈME CONTRAINTE : LA HAUTEUR DE LA PAGE ─────────────────────
  //
  // Les deux règles ci-dessus bornent la LARGEUR. Elles suffisent sur une A4,
  // où trois lignes de titre restent une fraction modeste de la page. Elles ne
  // suffisent pas sur une diapositive : trois lignes composées à `4xl` y font
  // les trois quarts de la hauteur, et le contenu passe sous le pied de page.
  //
  // C'est le défaut mesuré à l'ajout des structures empilées — en-têtes de 344
  // à 387 px dans une zone de 500. Le rendre plus large ne le corrigeait pas :
  // un titre à qui l'on donne plus de largeur grandit, et grandit en hauteur
  // autant qu'en largeur.
  //
  // On borne donc aussi la hauteur, et l'on cherche la plus grande taille qui
  // la respecte. La recherche est descendante et bornée : le nombre de lignes
  // dépend de la taille, donc la contrainte ne se résout pas d'un trait.
  const fitsHeight = (size: number): boolean => {
    if (maxHeightPx <= 0) return true;
    const perLine = Math.max(1, Math.floor(columnPx / (size * advance)));
    const lines = Math.max(1, Math.ceil(totalChars / perLine));
    return lines * size * leading <= maxHeightPx;
  };

  // Le plancher empêche l'autre excès : un titre réduit sans limite cesse
  // d'être un titre. Il descend plus bas quand une borne de HAUTEUR est en
  // vigueur — c'est-à-dire quand le titre partage la page avec le contenu
  // qu'il annonce : là, une ligne de titre gagnée est une ligne de contenu
  // sauvée, et l'arbitrage penche de l'autre côté.
  const floor = base * (maxHeightPx > 0 ? 0.5 : 0.62);

  // ── UNE SEULE LIGNE, QUAND ELLE TIENT ───────────────────────────────────
  //
  // Sur une page à hauteur fixe, l'ajusteur prenait la plus GRANDE taille qui
  // tenait en trois lignes : « Bannières réseaux sociaux » ou « Grammaire de
  // composition » sortaient sur deux ou trois lignes là où une seule suffisait,
  // et la page perdait autant de lignes de contenu. Si le titre tient sur UNE
  // ligne sans descendre sous 60 % de sa taille de base, il y est composé. La
  // largeur est comptée à 94 % : l'estimation par signe ne doit pas faire
  // casser le dernier mot.
  if (maxHeightPx > 0) {
    const byOneLine = (columnPx * 0.94) / (totalChars * advance);
    if (byOneLine >= base * 0.6) {
      return Math.round(Math.min(base, byOneLine, byLongestWord));
    }
  }

  let fitted = Math.min(base, byLongestWord, byThreeLines);
  while (fitted > floor && !fitsHeight(fitted)) fitted -= 1;

  return Math.round(Math.max(floor, fitted));
}

/**
 * Interlettrage d'une humeur, en em.
 *
 * Les valeurs sont posées par `resolveTypeTreatment` sous forme de chaînes CSS
 * (« -0.02em », « 0.28em »). `fitTitleSize` en a besoin comme NOMBRE : c'est la
 * part de largeur qu'aucun comptage de signes ne voit.
 */
export function trackingEm(tracking: string): number {
  const parsed = Number.parseFloat(tracking);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Titre, rendu selon l'humeur typographique en vigueur. */
export function renderTitle(content: SectionContent, ctx: Ctx, color: string): string {
  const { type, ds } = ctx;
  const title = content.title.trim();
  const words = title.split(/\s+/).filter(Boolean);

  // EMPILEMENT — un mot par ligne. C'est un vrai parti pris éditorial, mais il
  // ne vaut que sur un titre COURT : appliqué à cinq mots il ne compose plus, il
  // empile, et mange la page. On le réserve donc aux titres de deux ou trois
  // mots courts, et on retombe sur le flux normal au-delà — où le navigateur
  // coupe aux bons endroits, ce qu'il fait mieux qu'une règle fixe.
  //
  // Jamais sur une page à hauteur FIXE (charte, deck) : « Palette / de /
  // couleurs » y prenait trois lignes là où une suffisait, et chaque ligne de
  // titre y est une ligne de contenu en moins.
  const stackable =
    ctx.type.stacked &&
    ctx.titleHeightPx <= 0 &&
    words.length <= 3 &&
    Math.max(...words.map((w) => w.length), 0) <= 12;

  const text = stackable
    ? words.map((w) => esc(w)).join('<br>')
    : // Hors empilement, on soude les orphelines au mot qui précède : une
      // esperluette seule sur sa ligne est une faute de composition, et c'est
      // exactement ce que produisait « Products & Service Infrastructure ».
      words
        .map((word, i) =>
          i > 0 && ORPHAN_WORDS.test(word) ? `\u00A0${esc(word)}` : `${i > 0 ? ' ' : ''}${esc(word)}`
        )
        .join('')
        .trim();

  return `<h1${style({
    margin: 0,
    'font-family': `'${ds.fonts.display}', ${DISPLAY_FALLBACK}`,
    'font-size': `${fitTitleSize(title, type.titleSize, ctx.headerWidthPx, trackingEm(type.tracking), ctx.titleHeightPx, type.leading)}px`,
    'font-weight': type.weight,
    'text-transform': type.transform,
    'letter-spacing': type.tracking,
    'line-height': type.leading,
    color,
    // Un titre empilé mot à mot porte déjà ses coupures : `balance` n'aurait
    // rien à équilibrer, et les `<br>` la rendraient inopérante.
    ...(stackable ? {} : TITLE_WRAP),
  })}>${text}</h1>`;
}

export function renderKicker(content: SectionContent, ctx: Ctx, color: string): string {
  if (!content.kicker) return '';
  // Le sur-titre prend le TON de la famille : capitales espacées, petites
  // capitales, italique… C'était la même ligne en capitales sur toutes les
  // pages de tous les projets.
  return `<div${style({
    ...labelStyle(ctx, color),
    'margin-bottom': `${ctx.ds.spacing * 0.5}px`,
  })}>${esc(content.kicker)}</div>`;
}

export function renderLede(content: SectionContent, ctx: Ctx, color: string): string {
  if (!content.lede) return '';
  return `<p${style({
    margin: `${snap(ctx.ds.spacing)}px 0 0`,
    'font-size': `${ctx.ds.typeScale.lg}px`,
    'line-height': 1.4,
    // `52ch` plutôt que `150mm` : la borne suit la taille du texte au lieu de
    // la contredire. Un chapô composé plus grand tient alors le même nombre de
    // signes par ligne, ce qui est ce qu'une mesure doit garantir.
    'max-width': MEASURE.lede,
    color,
    'text-wrap': 'pretty',
  })}>${esc(content.lede)}</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Le TON de la famille : étiquettes, filets, numéros, angles, encre des chiffres.
//
// Ces petites décisions se répètent sur chaque bloc de chaque page. Posées une
// fois ici, elles sont identiques dans tout un document — et différentes d'une
// famille à l'autre, ce qui est tout leur intérêt : ce sont elles qu'un lecteur
// reconnaît, sans savoir les nommer, d'un livrable à l'autre.
// ─────────────────────────────────────────────────────────────────────────────

/** Pile de la police de titrage de la charte. */
export const displayFont = (ds: DocumentDesignSystem): string =>
  `'${ds.fonts.display}', ${DISPLAY_FALLBACK}`;

/**
 * Style d'une petite étiquette — sur-titre, en-tête de tableau, note.
 *
 * L'italique et le gras montent d'un cran de corps : sans capitales ni
 * interlettrage pour les signaler, une étiquette au plus petit degré se lirait
 * comme une note de bas de page.
 */
export function labelStyle(ctx: Ctx, color: string): Record<string, string | number> {
  const { ds } = ctx;
  switch (ctx.family.label) {
    case 'small-caps':
      return {
        'font-family': displayFont(ds),
        'font-variant-caps': 'all-small-caps',
        'letter-spacing': '0.08em',
        'font-weight': 600,
        'font-size': `${ds.typeScale.sm}px`,
        color,
      };
    case 'italic':
      return {
        'font-family': displayFont(ds),
        'font-style': 'italic',
        'font-weight': 400,
        'font-size': `${ds.typeScale.sm}px`,
        color,
      };
    case 'bold':
      return { 'font-weight': 700, 'font-size': `${ds.typeScale.sm}px`, color };
    case 'underlined':
      return {
        'text-transform': 'uppercase',
        'letter-spacing': '0.1em',
        'font-weight': 600,
        'font-size': `${ds.typeScale.xs}px`,
        'text-decoration': 'underline',
        'text-underline-offset': '3px',
        color,
      };
    case 'caps':
    default:
      return {
        'text-transform': 'uppercase',
        'letter-spacing': '0.16em',
        'font-weight': 700,
        'font-size': `${ds.typeScale.xs}px`,
        color,
      };
  }
}

/**
 * Filet de la famille, en valeur de `border`.
 *
 * `soft` sépare deux éléments de même rang ; `strong` ouvre ou ferme un
 * ensemble. Une famille « sans filet » renvoie `none` pour le premier et un
 * filet fin pour le second : un tableau ou un registre privé de SA ligne de tête
 * cesse de se lire comme un ensemble.
 */
export function ruleLine(ctx: Ctx, strength: 'soft' | 'strong' = 'soft'): string {
  const { colors } = ctx.ds;
  const strong = strength === 'strong';
  switch (ctx.family.rules) {
    case 'heavy':
      return strong ? `3px solid ${colors.ink}` : `1px solid ${colors.rule}`;
    case 'double':
      return strong ? `3px double ${colors.ink}` : `1px solid ${colors.rule}`;
    case 'dotted':
      return strong ? `2px dotted ${colors.ink}` : `1px dotted ${colors.inkMuted}`;
    case 'none':
      return strong ? `1px solid ${colors.rule}` : 'none';
    case 'hairline':
    default:
      return strong ? `1px solid ${colors.ink}` : `1px solid ${colors.rule}`;
  }
}

/** Filet de séparation qui ne peut PAS manquer (lignes d'un registre, d'une liste). */
export function softRule(ctx: Ctx): string {
  return ctx.family.rules === 'none' ? `1px solid ${ctx.ds.colors.rule}` : ruleLine(ctx, 'soft');
}

const ROMAN: Array<[number, string]> = [
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function toRoman(value: number): string {
  let rest = Math.max(1, Math.min(89, Math.round(value)));
  let out = '';
  for (const [unit, glyph] of ROMAN) {
    while (rest >= unit) {
      out += glyph;
      rest -= unit;
    }
  }
  return out;
}

/** Numéro de section, d'étape ou de carte, au format de la famille. */
export function formatIndex(ctx: Ctx, value: number): string {
  const padded = String(value).padStart(2, '0');
  switch (ctx.family.numbering) {
    case 'roman':
      return toRoman(value);
    case 'section':
      return `§\u00A0${value}`;
    case 'dotted':
      return `${value}.`;
    case 'bracketed':
      return `[${padded}]`;
    case 'plain':
      return String(value);
    case 'padded':
    default:
      return padded;
  }
}

/** Rayon des angles : celui de la direction artistique, ou vif si la famille l'impose. */
export const cornerRadius = (ctx: Ctx): number => (ctx.family.corners === 'square' ? 0 : ctx.ds.radius);

/** Encre des chiffres mis en valeur. */
export const figureInk = (ctx: Ctx): string =>
  ctx.family.figures === 'ink' ? ctx.ds.colors.ink : ctx.roles.highlight;

/**
 * Encre la plus lisible sur un fond, CALCULÉE parmi les encres du document.
 *
 * `roles.onBand` est calculée contre l'ACCENT, pas contre le bandeau : sur une
 * stratégie où le bandeau prend la primaire, elle ne garantit rien. Les dessins
 * de famille posent du texte sur des aplats variés ; ils mesurent.
 */
export function readableOn(ds: DocumentDesignSystem, background: string): string {
  const candidates = [ds.colors.ink, ds.colors.surface, ds.colors.neutral['50'], ds.colors.neutral['950']].filter(
    (hex): hex is string => Boolean(hex)
  );
  return candidates.reduce((best, hex) =>
    contrastRatio(hex, background) > contrastRatio(best, background) ? hex : best
  );
}
