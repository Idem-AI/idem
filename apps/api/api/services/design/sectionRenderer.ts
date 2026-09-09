/**
 * Le rendu d'une page de livrable.
 *
 * ⚠️ CE N'EST PAS UN GABARIT. C'est une FAMILLE de mises en page paramétrée par
 * la graine : douze archétypes de structure, six affectations de palette, huit
 * traitements typographiques, huit tensions spatiales. Un gabarit unique
 * transformerait ce dispositif en son propre repoussoir — douze projets, douze
 * fois la même page.
 *
 * Ce qui est GARANTI ici, et ne dépend donc plus du modèle :
 *
 *   · le balisage est toujours valide (il n'y a plus de balise à tronquer) ;
 *   · la palette et les polices sont celles de la charte, sans exception ;
 *   · les contrastes sont ceux calculés par `documentDesignSystem` (AAA/AA) ;
 *   · un seul rayon, un seul rythme spatial, une seule grille sur tout le
 *     livrable ;
 *   · le logo est posé, à sa place, dans la déclinaison qui contraste ;
 *   · chaque image porte un `alt` ;
 *   · la pagination A4 reste au paginateur (`flow-pagination.runtime`), à qui
 *     l'on rend un flux propre avec ses `data-keep-together`.
 *
 * Ce qui reste VARIABLE, et distingue donc deux projets :
 *
 *   · l'archétype (12), la stratégie de couleur (6), l'humeur typographique (8),
 *     la tension (8), l'accent graphique (8), le rythme (5), la densité (4).
 *
 * Les valeurs sont posées en style INLINE plutôt qu'en classes utilitaires : le
 * rendu ne dépend alors d'aucune feuille externe ni d'aucune compilation
 * Tailwind au moment de l'export PDF. Une page qui se rend correctement ici se
 * rend correctement partout.
 */

import { contrastRatio } from './color';
import { buildGoogleFontLinks } from '../../utils/google-fonts.util';
import { DocumentDesignSystem } from './documentDesignSystem';
import { SectionSeed } from './designSeed';
import logger from '../../config/logger';
import { Block, condenseForFixedPage, SectionContent, estimateBlockWeight } from './sectionContent';
import {
  balancedColumns,
  distributeVertically,
  MEASURE,
  packRow,
  PROSE_WRAP,
  snap,
  subgridRows,
  TITLE_WRAP,
} from './layoutGrid';

export interface RenderOptions {
  /** URL du logo à poser sur la page. Absent ⇒ aucune marque n'est inventée. */
  logoUrl?: string;
  /** Nom de marque, pour le pied de page. */
  brandName?: string;
  /** Numéro de section, utilisé par les archétypes qui en font un élément graphique. */
  index?: number;
  /** Format de page. Le défaut est l'A4 portrait du business plan. */
  page?: PageFormat;
  /**
   * La page peut-elle s'étendre sur PLUSIEURS pages ?
   *
   * `true`  (business plan) : le paginateur mesure le flux et le redécoupe. La
   *          hauteur est un minimum, la matière peut déborder sans dommage.
   * `false` (deck, charte)  : une section = EXACTEMENT une page, et ce qui
   *          dépasse est ROGNÉ. Le rendu resserre alors le rythme et l'échelle,
   *          parce qu'un débordement n'est pas rattrapable en aval.
   */
  multiPage?: boolean;
}

export interface PageFormat {
  width: string;
  minHeight: string;
  padding: string;
  orientation: 'portrait' | 'landscape';
}

export const PORTRAIT_A4: PageFormat = {
  width: '210mm',
  minHeight: '297mm',
  padding: '12mm',
  orientation: 'portrait',
};

/** Diapositive 16:9 — le format du pitch deck et de la charte. */
export const LANDSCAPE_SLIDE: PageFormat = {
  width: '297mm',
  minHeight: '167mm',
  padding: '14mm',
  orientation: 'landscape',
};

/**
 * Disposition d'une page, telle que l'archétype la choisit.
 *
 * Elle ne décide pas que du rendu : elle décide de la PLACE offerte aux blocs,
 * donc de ce qui tient sur une page rognée (cf. `fitToPage`).
 */
/**
 * Les STRUCTURES d'une page en paysage.
 *
 * ── LE DÉFAUT QUE CECI CORRIGE ──────────────────────────────────────────────
 *
 * Il y en avait DEUX : `side` (titre à gauche, contenu à droite) et `stacked`
 * (titre en haut, contenu dessous). Les douze archétypes s'y ramenaient tous,
 * et ne différaient plus que par l'ornement de leur en-tête — un filet, un
 * numéro, une bordure.
 *
 * Or un style de direction artistique ne tire que dans QUATRE OU CINQ
 * archétypes. Mesuré sur le catalogue : deux styles — « minimalism » et
 * « retro » — n'avaient accès qu'à des archétypes de la MÊME disposition. Une
 * charte en style minimaliste sortait donc avec sept pages rigoureusement
 * identiques de structure, ce que ni le tirage de la graine ni le contrôle
 * d'unicité ne pouvaient voir : ils comptaient des dimensions que le rendu ne
 * lisait pas.
 *
 * Six structures, réparties de sorte que CHAQUE style en atteigne au moins
 * trois (moyenne 4,1 pour quatre à cinq archétypes). La vérification est
 * automatique — cf. `check:uniqueness`, section « structures réellement
 * rendues ».
 */
export type LandscapeLayout =
  /** En-tête colonne gauche (5/12), contenu à droite (7/12). */
  | 'side'
  /** Contenu à gauche (7/12), en-tête colonne droite alignée à droite (5/12). */
  | 'side-reverse'
  /** En-tête pleine largeur, contenu dans la grille à douze colonnes dessous. */
  | 'stacked'
  /** En-tête en aplat saignant jusqu'aux bords, contenu dessous. */
  | 'banner'
  /** En-tête centré sur une mesure resserrée, contenu centré dessous. */
  | 'centered'
  /** En-tête dans le quart haut-gauche, contenu pleine largeur dessous. */
  | 'corner';

export type PageLayout = 'portrait' | LandscapeLayout;

export const LANDSCAPE_A4: PageFormat = {
  width: '297mm',
  minHeight: '210mm',
  padding: '14mm',
  orientation: 'landscape',
};

/**
 * Piles de repli typographiques.
 *
 * Volontairement GÉNÉRIQUES. Nommer une famille concrète (Georgia, Helvetica
 * Neue, Arial) ferait remonter le linter de charte, qui les compte parmi les
 * polices « par défaut » — et il aurait raison : sur une page où la police de
 * charte ne charge pas, tomber sur Georgia est un accident, pas une décision.
 *
 * Le pipeline PDF pose par ailleurs ses propres règles d'élément
 * (`h1..h6 { font-family: PRIMARY }`, `p, div, td { font-family: SECONDARY }`).
 * Elles ont une spécificité inférieure aux styles inline posés ici, donc le
 * rendu garde la main — mais les deux désignent les mêmes familles, ce qui
 * évite qu'une page rendue diffère selon qu'elle passe ou non par le PDF.
 */
const DISPLAY_FALLBACK = 'serif';
const BODY_FALLBACK = 'sans-serif';

// ─────────────────────────────────────────────────────────────────────────────
// Échappement. Tout texte venu du modèle traverse cette fonction : c'est la
// frontière entre du CONTENU et du BALISAGE, et elle n'a pas d'exception.
// ─────────────────────────────────────────────────────────────────────────────

function esc(value: string): string {
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
function escCited(value: string, sourceCount: number): string {
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
const style = (declarations: Record<string, string | number | undefined>): string => {
  const body = Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([property, value]) => `${property}:${value}`)
    .join(';');
  return body ? ` style="${body}"` : '';
};

// ─────────────────────────────────────────────────────────────────────────────
// Affectation de la palette — 6 stratégies.
//
// La stratégie ne change pas les COULEURS (elles viennent de la charte), elle
// change leur RÔLE : quelle teinte porte le titre, laquelle le fond des blocs,
// laquelle l'accent. C'est ce qui fait que deux marques à palette voisine ne
// produisent pas la même page.
// ─────────────────────────────────────────────────────────────────────────────

interface ColorRoles {
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

function resolveColorRoles(ds: DocumentDesignSystem, strategy: string): ColorRoles {
  const c = ds.colors;
  const base: ColorRoles = {
    ground: c.surface,
    heading: c.ink,
    band: c.primary,
    onBand: c.onAccent,
    panel: c.surfaceRaised,
    highlight: c.accent,
    onHighlight: c.onAccent,
  };

  switch (strategy) {
    // Presque-noir + presque-blanc + UN accent. Le titre reste encre.
    case 'MONOCHROME_ACCENT':
      return { ...base, band: c.neutral[ds.dark ? '900' : '100'], onBand: c.ink, heading: c.ink };

    // La primaire prend le bandeau, l'accent les chiffres.
    case 'BRAND_FULL':
      return { ...base, heading: c.primary, band: c.primary, onBand: c.onAccent };

    // Deux couleurs seulement : la secondaire disparaît au profit de l'accent.
    case 'DUOTONE':
      return {
        ...base,
        band: c.accent,
        onBand: c.onAccent,
        highlight: c.primary,
        onHighlight: c.onAccent,
        heading: c.accent,
      };

    // Zone de contraste dure : le bandeau inverse le fond de page.
    case 'INVERSE':
      return {
        ...base,
        band: ds.dark ? c.neutral['50'] : c.neutral['950'],
        onBand: ds.dark ? c.neutral['950'] : c.neutral['50'],
        panel: ds.dark ? c.neutral['900'] : c.neutral['100'],
      };

    // La primaire plus deux tons voisins : le bandeau descend d'un cran.
    case 'SPLIT_COMPLEMENTARY':
      return { ...base, band: c.secondary, heading: c.primary, highlight: c.accent };

    // Tons extraits : le bandeau s'efface, l'accent porte seul.
    case 'IMAGE_EXTRACTED':
      return {
        ...base,
        band: c.neutral[ds.dark ? '900' : '100'],
        onBand: c.ink,
        heading: c.ink,
      };

    default:
      return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Traitement typographique — 8 humeurs.
//
// Le prompt demandait « trois niveaux minimum, sauts décisifs » et obtenait
// souvent deux tailles voisines. Ici le saut est CALCULÉ (échelle du style) et
// l'humeur ne fait varier que ce qui est sûr : graisse, casse, interlettrage,
// interlignage.
// ─────────────────────────────────────────────────────────────────────────────

interface TypeTreatment {
  titleSize: number;
  weight: number;
  transform: 'none' | 'uppercase' | 'lowercase';
  tracking: string;
  leading: number;
  /** Le titre s'écrit-il sur plusieurs lignes très serrées ? */
  stacked?: boolean;
}

function resolveTypeTreatment(ds: DocumentDesignSystem, mood: string): TypeTreatment {
  const s = ds.typeScale;
  const base: TypeTreatment = {
    titleSize: s['3xl'],
    weight: 700,
    transform: 'none',
    tracking: '-0.02em',
    leading: 1.05,
  };

  switch (mood) {
    case 'CONDENSED_TOWER':
      return { ...base, titleSize: s['4xl'], leading: 0.92, tracking: '-0.035em', stacked: true };
    case 'WIDE_WHISPER':
      // 0,45 em produisait des capitales si écartées que le mot cessait de se
      // lire comme un mot. 0,28 em reste franchement aéré — c'est l'identité de
      // cette humeur — sans que le titre se disloque.
      return { ...base, titleSize: s.xl, weight: 400, transform: 'uppercase', tracking: '0.28em', leading: 1.4 };
    case 'WEIGHT_CLASH':
      return { ...base, titleSize: s['4xl'], weight: 900, tracking: '-0.04em' };
    case 'SINGLE_LETTER_ANCHOR':
      return { ...base, titleSize: s['3xl'], weight: 800 };
    case 'ALL_LOWERCASE_INTIMATE':
      return { ...base, titleSize: s['3xl'], weight: 500, transform: 'lowercase', tracking: '-0.03em' };
    case 'ROTATED_AXIS':
      return { ...base, titleSize: s['2xl'], weight: 700, transform: 'uppercase', tracking: '0.1em' };
    case 'OUTLINE_FILLED_MIX':
      return { ...base, titleSize: s['4xl'], weight: 800, tracking: '-0.03em' };
    case 'STAGGERED_INDENT':
      return { ...base, titleSize: s['3xl'], weight: 700, leading: 1.15, stacked: true };
    default:
      return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tension spatiale — 8 régimes.
//
// Elle règle le rapport entre le vide et le plein. C'est la dimension qui rend
// deux pages de MÊME archétype visiblement différentes.
// ─────────────────────────────────────────────────────────────────────────────

interface Tension {
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

function resolveTension(name: string): Tension {
  switch (name) {
    case 'TEXT_ESCAPES_BOUNDS':
      return { gap: 1.4, inset: 0, separator: 'none', bleed: true, columns: 1 };
    case 'DIAGONAL_FLOW':
      return { gap: 1.6, inset: 4, separator: 'none', bleed: false, columns: 1 };
    case 'RULE_HEAVY':
      return { gap: 1.1, inset: 0, separator: 'thick', bleed: false, columns: 1 };
    case 'NEGATIVE_SPACE_HERO':
      return { gap: 2.4, inset: 14, separator: 'none', bleed: false, columns: 1 };
    case 'CORNER_ANCHOR':
      return { gap: 1.3, inset: 0, separator: 'hairline', bleed: false, columns: 1 };
    case 'FULL_BLEED_EDGE':
      return { gap: 1.2, inset: 0, separator: 'none', bleed: true, columns: 1 };
    case 'FRAME_WITHIN_FRAME':
      return { gap: 1.3, inset: 6, separator: 'hairline', bleed: false, columns: 1 };
    case 'COLLAGE_LAYER':
      return { gap: 1.5, inset: 0, separator: 'none', bleed: false, columns: 2 };
    default:
      return { gap: 1.3, inset: 0, separator: 'hairline', bleed: false, columns: 1 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu des blocs. Identique quel que soit l'archétype : c'est la STRUCTURE de
// page qui varie, pas la façon de dessiner un tableau.
// ─────────────────────────────────────────────────────────────────────────────

interface Ctx {
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
const MM_TO_PX = 96 / 25.4;

/**
 * Présentation des blocs à variantes, tirée des INVARIANTS du document.
 *
 * Somme de codes de caractères plutôt qu'un hachage cryptographique : la valeur
 * n'a besoin d'être ni imprévisible ni uniformément répartie, seulement
 * DÉTERMINISTE et stable — deux appels sur le même document doivent rendre la
 * même page, y compris après un redémarrage.
 */
export function documentVariant(seed: SectionSeed): number {
  const key = `${seed.colorStrategy}:${seed.graphicAccent}`;
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  return sum % 3;
}

/** Bloc insécable : le paginateur ne le coupera pas en deux pages. */
const atomic = ' data-keep-together';

function renderProse(block: Extract<Block, { kind: 'prose' }>, ctx: Ctx): string {
  const { ds } = ctx;
  return block.paragraphs
    .map(
      (paragraph) =>
        `<p${style({
          margin: `0 0 ${snap(ctx.ds.spacing)}px`,
          'font-size': `${ds.typeScale.base}px`,
          'line-height': 1.55,
          color: ds.colors.ink,
          // MESURE BORNÉE. Une diapositive fait 297 mm de large : un paragraphe
          // qui la traverse donne des lignes de 140 signes, deux fois ce que
          // l'œil suit sans perdre la ligne suivante en revenant à gauche.
          'max-width': MEASURE.prose,
          ...PROSE_WRAP,
        })}>${escCited(paragraph, ctx.sourceCount)}</p>`
    )
    .join('');
}

function renderCards(block: Extract<Block, { kind: 'cards' }>, ctx: Ctx): string {
  const { ds, roles } = ctx;
  // HIÉRARCHIE IMPOSÉE. Une rangée de cartes strictement identiques est le tic
  // le plus reconnaissable d'une page générée. Si le modèle n'a mis en avant
  // aucune carte, le rendu met la PREMIÈRE en avant — le défaut n'est pas la
  // grille, c'est l'absence de hiérarchie, et elle se pose en code.
  const hasEmphasis = block.items.some((item) => item.emphasis);
  const items = block.items.map((item, index) => ({
    ...item,
    emphasis: hasEmphasis ? item.emphasis : index === 0,
  }));

  // ── LA GRILLE ─────────────────────────────────────────────────────────
  //
  // `min(3, max(2, ceil(n / 2)))` donnait 3 colonnes pour 4 cartes : trois en
  // haut, UNE en bas, flottant à gauche d'un vide. `balancedColumns` interdit
  // ce reste de 1 — quatre cartes font deux rangées de deux.
  //
  // Les rangées sont en `subgrid` : le titre d'une carte et le corps d'une
  // autre partagent leur bande, donc tous les corps commencent à la MÊME
  // hauteur, qu'un titre tienne sur une ligne ou sur deux. C'est ce qui
  // manquait pour qu'une rangée de cartes se lise comme une rangée.
  const columns = balancedColumns(items.length);
  const gap = snap(ds.spacing);
  const grid = subgridRows(2, columns, gap);

  const cells = items
    .map((item) => {
      const strong = item.emphasis;
      return `<div${style({
        ...grid.cell,
        'background-color': strong ? roles.highlight : roles.panel,
        color: strong ? roles.onHighlight : ds.colors.ink,
        'border-radius': `${ds.radius}px`,
        padding: `${snap(ds.spacing * 1.5)}px`,
        // La carte mise en avant ne s'élargit plus : elle rompait la grille
        // pour la seule raison qu'elle était première. Sa couleur suffit à la
        // distinguer, et la rangée reste une rangée.
        'align-content': 'start',
      })}${atomic}>
  <div${style({
        'font-size': `${ds.typeScale.lg}px`,
        'font-weight': 700,
        'line-height': 1.2,
        'text-wrap': 'balance',
      })}>${esc(item.title)}</div>
  <div${style({
        'font-size': `${ds.typeScale.sm}px`,
        'line-height': 1.5,
        'max-width': MEASURE.card,
        opacity: strong ? 0.92 : 0.85,
        ...PROSE_WRAP,
      })}>${escCited(item.body, ctx.sourceCount)}</div>
</div>`;
    })
    .join('');

  return `<div${style(grid.container)}>${cells}</div>`;
}

function renderTable(block: Extract<Block, { kind: 'table' }>, ctx: Ctx): string {
  const { ds, roles } = ctx;
  const head = block.headers
    .map(
      (header) =>
        `<th${style({
          'text-align': 'left',
          padding: `${ds.spacing * 0.75}px ${ds.spacing}px`,
          'font-size': `${ds.typeScale.xs}px`,
          'font-weight': 700,
          'text-transform': 'uppercase',
          'letter-spacing': '0.08em',
          color: roles.onBand,
          'background-color': roles.band,
        })}>${esc(header)}</th>`
    )
    .join('');

  const body = block.rows
    .map(
      (row, rowIndex) =>
        `<tr${style({
          'background-color': rowIndex % 2 === 1 ? roles.panel : 'transparent',
        })}>${row
          .map(
            (cell) =>
              `<td${style({
                padding: `${ds.spacing * 0.7}px ${ds.spacing}px`,
                'font-size': `${ds.typeScale.sm}px`,
                color: ds.colors.ink,
                'border-bottom': `1px solid ${ds.colors.rule}`,
              })}>${escCited(cell, ctx.sourceCount)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');

  const caption = block.caption
    ? `<div${style({
        'font-size': `${ds.typeScale.xs}px`,
        color: ds.colors.inkMuted,
        'margin-top': `${ds.spacing * 0.5}px`,
      })}>${esc(block.caption)}</div>`
    : '';

  // Le tableau n'est PAS insécable : le paginateur sait le couper proprement et
  // répéter son <thead>. L'y forcer produirait des pages à moitié vides.
  return `<div><table${style({
    width: '100%',
    'border-collapse': 'collapse',
    'border-radius': `${ds.radius}px`,
    overflow: 'hidden',
  })}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${caption}</div>`;
}

function renderMetrics(block: Extract<Block, { kind: 'metrics' }>, ctx: Ctx): string {
  const { ds, roles } = ctx;

  // ── LE DÉFAUT QUE LE SUBGRID CORRIGE ──────────────────────────────────
  //
  // Les cellules étaient des `flex: 1 1 0` empilant chacune ses trois lignes
  // pour son compte. « 2,3 Md FCFA » passait sur deux lignes quand « +18 %/an »
  // tenait sur une : son libellé tombait donc un cran plus bas que celui de sa
  // voisine, et sa note un cran plus bas encore. Trois chiffres censés se
  // comparer se lisaient en escalier — le défaut le plus visible de la page,
  // et celui que personne ne sait nommer en la regardant.
  //
  // En `subgrid`, la valeur, le libellé et la note sont TROIS BANDES communes
  // à toute la rangée : quoi qu'il arrive au texte, les libellés s'alignent.
  const columns = balancedColumns(block.items.length);
  const gap = snap(ds.spacing * 1.5);
  const grid = subgridRows(3, columns, gap);

  // ── LA TAILLE DU CHIFFRE SUIT LA COLONNE QUI LE PORTE ─────────────────
  //
  // Un chiffre-clé ne se coupe pas en deux lignes : « 2,3 Md FCFA » scindé
  // après « Md » cesse d'être une valeur et devient deux fragments. Mais
  // l'interdire sans regarder la place disponible ne fait que déplacer le
  // défaut : le chiffre déborde alors sur son voisin, et les deux se
  // chevauchent — c'est ce qui arrivait dans la colonne étroite de la
  // disposition `side`.
  //
  // La taille est donc CALCULÉE pour que la plus longue valeur de la série
  // tienne dans sa colonne. Le plancher garde le chiffre plus gros que son
  // libellé : en dessous, il cesse d'être le héros de la rangée.
  const columnPx = (ctx.contentWidthPx - gap * (columns - 1)) / columns;
  const longest = Math.max(...block.items.map((item) => item.value.length), 1);
  // Un chiffre est plus étroit qu'une lettre ; 0,58 em couvre les deux ainsi
  // que l'espace fine des milliers.
  const valueSize = Math.max(
    ds.typeScale.lg,
    Math.min(ds.typeScale['2xl'], Math.floor(columnPx / (longest * 0.58)))
  );

  const cells = block.items
    .map(
      (item) => `<div${style(grid.cell)}>
  <div${style({
        'font-size': `${valueSize}px`,
        'font-weight': 800,
        color: roles.highlight,
        'line-height': 1,
        'letter-spacing': '-0.03em',
        'white-space': 'nowrap',
      })}>${esc(item.value)}</div>
  <div${style({
        'font-size': `${ds.typeScale.sm}px`,
        color: ds.colors.ink,
        'line-height': 1.3,
        'text-wrap': 'balance',
      })}>${esc(item.label)}</div>
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>${item.note ? esc(item.note) : ''}</div>
</div>`
    )
    .join('');

  return `<div${style({
    ...grid.container,
    'padding-top': `${snap(ds.spacing)}px`,
    'border-top': `3px solid ${roles.highlight}`,
  })}${atomic}>${cells}</div>`;
}

/**
 * Graphique en CSS/SVG pur — aucune bibliothèque, aucun `<canvas>`, aucun script.
 *
 * Les prompts consacraient plusieurs lignes à encadrer Chart.js (« un id
 * unique », « un seul graphe par canvas », « animation: false », « pas de
 * <script src> ») et échouaient régulièrement dessus. Le rendu maîtrisant le
 * balisage, le problème disparaît au lieu d'être surveillé.
 */
function renderChart(block: Extract<Block, { kind: 'chart' }>, ctx: Ctx): string {
  const { ds, roles } = ctx;
  const palette = [roles.highlight, ds.colors.primary, ds.colors.secondary, ds.colors.neutral['400']];
  const max = Math.max(
    1,
    ...(block.chartType === 'stacked'
      ? block.labels.map((_, index) => block.series.reduce((sum, s) => sum + (s.data[index] ?? 0), 0))
      : block.series.flatMap((s) => s.data))
  );

  const plotHeight = 150;
  let plot: string;

  if (block.chartType === 'line') {
    const width = 600;
    const step = block.labels.length > 1 ? width / (block.labels.length - 1) : width;
    plot = `<svg viewBox="0 0 ${width} ${plotHeight}" preserveAspectRatio="none"${style({ width: '100%', height: `${plotHeight}px`, display: 'block' })} role="img" aria-label="${esc(block.readingKey || 'Graphique')}">
${block.series
      .map((serie, serieIndex) => {
        const points = serie.data
          .map((value, index) => `${(index * step).toFixed(1)},${(plotHeight - (value / max) * plotHeight).toFixed(1)}`)
          .join(' ');
        return `<polyline points="${points}" fill="none" stroke="${palette[serieIndex % palette.length]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      })
      .join('')}
</svg>`;
  } else {
    const columns = block.labels
      .map((_, index) => {
        const segments =
          block.chartType === 'stacked'
            ? block.series.map((serie, serieIndex) => {
                const value = serie.data[index] ?? 0;
                return `<div${style({
                  height: `${((value / max) * plotHeight).toFixed(1)}px`,
                  'background-color': palette[serieIndex % palette.length],
                })}></div>`;
              })
            : block.series.map((serie, serieIndex) => {
                const value = serie.data[index] ?? 0;
                return `<div${style({
                  flex: '1 1 0',
                  height: `${((value / max) * plotHeight).toFixed(1)}px`,
                  'background-color': palette[serieIndex % palette.length],
                  'border-radius': `${Math.min(ds.radius, 4)}px ${Math.min(ds.radius, 4)}px 0 0`,
                })}></div>`;
              });

        return `<div${style({
          flex: '1 1 0',
          display: 'flex',
          'flex-direction': block.chartType === 'stacked' ? 'column-reverse' : 'row',
          'align-items': block.chartType === 'stacked' ? 'stretch' : 'flex-end',
          gap: '2px',
          height: `${plotHeight}px`,
          'justify-content': 'flex-end',
        })}>${segments.join('')}</div>`;
      })
      .join('');

    plot = `<div${style({ display: 'flex', gap: `${ds.spacing * 0.6}px`, 'align-items': 'flex-end' })}>${columns}</div>`;
  }

  const axis = `<div${style({ display: 'flex', gap: `${ds.spacing * 0.6}px`, 'margin-top': '6px' })}>${block.labels
    .map(
      (label) =>
        `<div${style({
          flex: '1 1 0',
          'font-size': `${ds.typeScale.xs}px`,
          color: ds.colors.inkMuted,
          'text-align': 'center',
        })}>${esc(label)}</div>`
    )
    .join('')}</div>`;

  const legend =
    block.series.length > 1
      ? `<div${style({ display: 'flex', gap: `${ds.spacing}px`, 'margin-top': `${ds.spacing * 0.5}px`, 'flex-wrap': 'wrap' })}>${block.series
          .map(
            (serie, index) =>
              `<span${style({ display: 'inline-flex', 'align-items': 'center', gap: '6px', 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.ink })}><span${style(
                { width: '10px', height: '10px', 'background-color': palette[index % palette.length], display: 'inline-block' }
              )}></span>${esc(serie.name)}</span>`
          )
          .join('')}</div>`
      : '';

  const key = block.readingKey
    ? `<div${style({
        'font-size': `${ds.typeScale.sm}px`,
        color: ds.colors.ink,
        'margin-top': `${ds.spacing * 0.75}px`,
        'border-left': `3px solid ${roles.highlight}`,
        'padding-left': `${ds.spacing * 0.75}px`,
        'line-height': 1.45,
      })}>${esc(block.readingKey)}</div>`
    : '';

  const unit = block.unit
    ? `<div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted, 'margin-bottom': '4px' })}>${esc(block.unit)}</div>`
    : '';

  // ── LE GRAPHIQUE RÉEL, PAR CHART.JS ────────────────────────────────────────
  //
  // Ce qui précède (`plot`, `axis`, `legend`) reste, mais comme REPLI. Il est
  // dessiné par le serveur, donc toujours juste, mais il ne sait faire que des
  // barres et une polyline : parts d'un tout, comparaisons croisées et profils
  // arrivaient tous en barres verticales, et le graphique cessait de porter le
  // sens qu'on lui demandait.
  //
  // Chart.js est déjà chargé dans le pipeline d'impression. Le canvas porte sa
  // configuration en attribut ; le runtime la construit après le chargement de
  // la bibliothèque (cf. `buildCharts`), puis masque le repli. Là où Chart.js
  // n'existe pas — un éditeur, une prévisualisation, un export brut — le repli
  // reste visible et la page ne perd rien.
  //
  // Les deux occupent la MÊME boîte, de hauteur fixe : le paginateur mesure
  // donc la même chose dans les deux cas, et une page ne se recompose pas selon
  // qu'un script a tourné ou non.
  const boxHeight = plotHeight + 30 + (block.series.length > 1 ? 24 : 0);
  const config = buildChartConfig(block, ctx);
  const canvas = `<canvas data-idem-chart="${esc(JSON.stringify(config))}"${style({
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
  })} role="img" aria-label="${esc(block.readingKey || 'Graphique')}"></canvas>`;

  return `<div${atomic}>${unit}<div${style({ position: 'relative', height: `${boxHeight}px` })}>${canvas}<div data-chart-fallback>${plot}${axis}${legend}</div></div>${key}</div>`;
}

/**
 * Traduit un bloc `chart` en configuration Chart.js, aux couleurs du document.
 *
 * Le modèle choisit le TYPE d'après ce que la donnée signifie ; tout le reste —
 * couleurs, polices, grille, axes, légende — est décidé ici. C'est la même
 * répartition que partout ailleurs dans le gabarit : le modèle dit quoi
 * montrer, le code décide à quoi cela ressemble. Un graphique ne peut donc pas
 * sortir de la charte, quel que soit le modèle qui l'a demandé.
 */
function buildChartConfig(block: Extract<Block, { kind: 'chart' }>, ctx: Ctx): unknown {
  const { ds, roles } = ctx;
  // Assez de teintes pour un camembert sans répétition visible, toutes tirées
  // de la rampe de marque : la variété reste dans la charte.
  const palette = [
    roles.highlight,
    ds.colors.primary,
    ds.colors.secondary,
    ds.colors.brand['400'],
    ds.colors.brand['700'],
    ds.colors.neutral['400'],
    ds.colors.brand['300'],
    ds.colors.neutral['600'],
  ];

  const type = block.chartType;
  const circular = type === 'pie' || type === 'doughnut';
  const baseType =
    circular ? type : type === 'line' || type === 'area' ? 'line' : type === 'radar' ? 'radar' : 'bar';

  const datasets = block.series.map((serie, index) => {
    const color = palette[index % palette.length];
    return {
      label: serie.name,
      data: serie.data,
      // Sur un camembert, la couleur distingue les PARTS ; ailleurs, les séries.
      backgroundColor: circular
        ? block.labels.map((_, position) => palette[position % palette.length])
        : type === 'area' || type === 'radar'
          ? `${color}33`
          : color,
      borderColor: color,
      borderWidth: baseType === 'bar' ? 0 : 2,
      fill: type === 'area' || type === 'radar',
      tension: type === 'area' || type === 'line' ? 0.3 : 0,
      pointRadius: 2,
    };
  });

  const stacked = type === 'stacked';
  const font = { family: `'${ds.fonts.body}', ${BODY_FALLBACK}`, size: ds.typeScale.xs };
  const grid = { color: ds.colors.rule, drawBorder: false };
  const ticks = { color: ds.colors.inkMuted, font };

  return {
    type: baseType,
    data: { labels: block.labels, datasets },
    options: {
      indexAxis: type === 'horizontalBar' ? 'y' : 'x',
      plugins: {
        // Une légende à une seule entrée n'informe personne et vole de la
        // hauteur à la zone de tracé.
        legend: {
          display: datasets.length > 1 || circular,
          position: circular ? 'right' : 'top',
          labels: { color: ds.colors.ink, font, boxWidth: 10, boxHeight: 10 },
        },
        tooltip: { enabled: false },
      },
      // Un camembert et un radar n'ont pas d'axes cartésiens : leur en donner
      // ferait apparaître une grille orpheline derrière le tracé.
      scales: circular
        ? {}
        : type === 'radar'
          ? { r: { grid, ticks, angleLines: { color: ds.colors.rule } } }
          : {
              x: { stacked, grid: { display: false }, ticks },
              // L'axe des valeurs part de zéro : ne pas le faire exagère
              // visuellement des écarts faibles, ce qui est le mensonge
              // graphique le plus courant dans un document d'affaires.
              y: { stacked, beginAtZero: true, grid, ticks },
            },
    },
  };
}

function renderQuote(block: Extract<Block, { kind: 'quote' }>, ctx: Ctx): string {
  const { ds, roles } = ctx;
  return `<blockquote${style({
    margin: 0,
    padding: `${ds.spacing * 1.25}px ${ds.spacing * 1.5}px`,
    'border-left': `4px solid ${roles.highlight}`,
    'background-color': roles.panel,
    'border-radius': `0 ${ds.radius}px ${ds.radius}px 0`,
  })}${atomic}>
  <div${style({ 'font-size': `${ds.typeScale.lg}px`, 'line-height': 1.4, color: ds.colors.ink })}>${esc(block.text)}</div>
  ${
    block.attribution
      ? `<div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted, 'margin-top': `${ds.spacing * 0.5}px` })}>— ${esc(block.attribution)}</div>`
      : ''
  }
</blockquote>`;
}

function renderTimeline(block: Extract<Block, { kind: 'timeline' }>, ctx: Ctx): string {
  const { ds, roles } = ctx;
  const steps = block.steps
    .map(
      (step) => `<div${style({
        display: 'grid',
        'grid-template-columns': '22mm 1fr',
        gap: `${ds.spacing}px`,
        'padding-bottom': `${ds.spacing}px`,
        'border-left': `2px solid ${ds.colors.rule}`,
        'padding-left': `${ds.spacing}px`,
      })}${atomic}>
  <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'font-weight': 700, color: roles.highlight })}>${esc(step.date)}</div>
  <div>
    <div${style({ 'font-size': `${ds.typeScale.base}px`, 'font-weight': 600, color: ds.colors.ink })}>${esc(step.title)}</div>
    <div${style({ 'font-size': `${ds.typeScale.sm}px`, color: ds.colors.inkMuted, 'line-height': 1.45 })}>${esc(step.body)}</div>
  </div>
</div>`
    )
    .join('');
  return `<div>${steps}</div>`;
}

function renderAssumption(block: Extract<Block, { kind: 'assumption' }>, ctx: Ctx): string {
  const { ds } = ctx;
  return `<div${style({
    'border-top': `1px solid ${ds.colors.rule}`,
    'border-bottom': `1px solid ${ds.colors.rule}`,
    padding: `${ds.spacing * 0.75}px 0`,
    'font-size': `${ds.typeScale.sm}px`,
    color: ds.colors.ink,
  })}${atomic}>
  <span${style({ 'font-weight': 700, 'text-transform': 'uppercase', 'letter-spacing': '0.08em', 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>Hypothèse</span>
  <div${style({ 'margin-top': '4px', 'line-height': 1.45 })}>${escCited(block.statement, ctx.sourceCount)}</div>
  ${block.basis ? `<div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted, 'margin-top': '2px' })}>Base : ${esc(block.basis)}</div>` : ''}
</div>`;
}

/**
 * Nuancier. Le CONTRASTE de chaque teinte sur l'encre du document est CALCULÉ et
 * affiché — c'est l'information qu'une charte doit porter et que personne
 * n'écrit à la main correctement.
 */
/**
 * Nuancier. Le CONTRASTE de chaque teinte sur l'encre du document est CALCULÉ
 * et affiché — c'est l'information qu'une charte doit porter et que personne
 * n'écrit à la main correctement.
 *
 * ── TROIS PRÉSENTATIONS, ET POURQUOI ────────────────────────────────────────
 *
 * Le nuancier est LA page d'une charte : celle qu'on ouvre en premier et celle
 * qu'on rouvre ensuite. Elle sortait rigoureusement identique d'un projet à
 * l'autre — même rangée de pastilles, même hauteur de 26 mm, mêmes légendes au
 * même endroit — quelles que soient la marque, la direction artistique et la
 * graine. Toute la variété du dispositif se jouait autour d'elle, jamais dedans.
 *
 * Trois présentations, choisies par la graine du DOCUMENT : les pages d'une
 * même charte s'accordent entre elles, deux chartes ne se ressemblent pas.
 *
 *   `chips` — pastilles séparées, légendes dessous. La forme de référence.
 *   `ramp`  — une seule bande continue, segments jointifs. Le nuancier se lit
 *             comme une gamme plutôt que comme une collection.
 *   `stack` — bandes horizontales empilées, nom à gauche, valeurs à droite.
 *             La forme d'un tableau de spécification.
 *
 * Aucune n'est un ornement : chacune dit la même chose dans une syntaxe
 * différente, et les trois portent les mêmes contrastes calculés.
 */
function renderSwatches(block: Extract<Block, { kind: 'swatches' }>, ctx: Ctx): string {
  const { ds } = ctx;
  const gap = snap(ds.spacing);

  /** Encre lisible SUR la teinte : calculée, jamais devinée. */
  const inkOn = (hex: string): { ink: string; ratio: number } => {
    const ink = contrastRatio('#ffffff', hex) >= 4.5 ? '#ffffff' : '#000000';
    return { ink, ratio: Math.round(contrastRatio(ink, hex) * 10) / 10 };
  };

  // ── `ramp` : une bande continue ────────────────────────────────────────
  if (ctx.variant === 1) {
    const band = block.items
      .map((item) => {
        const { ink } = inkOn(item.hex);
        // ── LA TEINTE QUI SE CONFOND AVEC LA PAGE ───────────────────────
        //
        // Une charte porte presque toujours sa couleur de FOND parmi ses
        // valeurs — et cette valeur-là est, par définition, celle de la page.
        // Dans une bande continue sans bordure, son segment disparaît : la
        // bande paraît COUPÉE en deux, ce qui se lit comme un défaut
        // d'impression et non comme une couleur.
        //
        // Un filet intérieur la rend visible sans élargir le segment — une
        // bordure, elle, décalerait tous les suivants et romprait la
        // continuité qui fait toute la forme.
        const faint = contrastRatio(item.hex, ds.colors.surface) < 1.3;
        return `<div${style({
          'background-color': item.hex,
          color: ink,
          height: '34mm',
          display: 'flex',
          'align-items': 'flex-end',
          padding: `${snap(ds.spacing * 0.6)}px`,
          'font-size': `${ds.typeScale.xs}px`,
          'font-weight': 700,
          'box-shadow': faint ? `inset 0 0 0 1px ${ds.colors.rule}` : undefined,
        })}>${esc(item.hex.toUpperCase())}</div>`;
      })
      .join('');

    // Les légendes forment leur propre grille, calée sur la même partition que
    // la bande : les deux rangées s'alignent colonne à colonne.
    const legend = subgridRows(3, block.items.length, gap);
    const labels = block.items
      .map((item) => {
        const { ratio } = inkOn(item.hex);
        return `<div${style(legend.cell)}>
  <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'font-weight': 600, color: ds.colors.ink })}>${esc(item.name)}</div>
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, 'line-height': 1.35, color: ds.colors.inkMuted })}>${item.role ? esc(item.role) : ''}</div>
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>contraste ${ratio}:1</div>
</div>`;
      })
      .join('');

    return `<div${atomic}>
  <div${style({
      display: 'grid',
      'grid-template-columns': `repeat(${block.items.length}, minmax(0, 1fr))`,
      'border-radius': `${ds.radius}px`,
      overflow: 'hidden',
    })}>${band}</div>
  <div${style({ ...legend.container, 'margin-top': `${gap}px` })}>${labels}</div>
</div>`;
  }

  // ── `stack` : bandes horizontales, à la manière d'un tableau ───────────
  if (ctx.variant === 2) {
    const rows = block.items
      .map((item) => {
        const { ink, ratio } = inkOn(item.hex);
        return `<div${style({
          display: 'grid',
          'grid-template-columns': '18mm 1fr auto',
          'align-items': 'center',
          gap: `${gap}px`,
          'border-top': `1px solid ${ds.colors.rule}`,
          padding: `${snap(ds.spacing * 0.75)}px 0`,
        })}>
  <div${style({
          'background-color': item.hex,
          color: ink,
          height: '12mm',
          'border-radius': `${ds.radius}px`,
          border: `1px solid ${ds.colors.rule}`,
        })}></div>
  <div>
    <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'font-weight': 600, color: ds.colors.ink })}>${esc(item.name)}</div>
    <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>${item.role ? esc(item.role) : ''}</div>
  </div>
  <div${style({ 'text-align': 'right', 'white-space': 'nowrap' })}>
    <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'font-weight': 700, color: ds.colors.ink })}>${esc(item.hex.toUpperCase())}</div>
    <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>contraste ${ratio}:1</div>
  </div>
</div>`;
      })
      .join('');

    return `<div${atomic}>${rows}</div>`;
  }

  // ── `chips` : la forme de référence ────────────────────────────────────
  //
  // QUATRE BANDES : pastille, nom, rôle, contraste. En `flex`, le rôle
  // « Identité, titres, aplats » passait sur trois lignes quand « Surface de
  // page » en tenait deux, et la ligne « contraste » de chaque nuancier
  // tombait à une hauteur différente.
  const grid = subgridRows(4, block.items.length, gap);
  const cells = block.items
    .map((item) => {
      const { ink, ratio } = inkOn(item.hex);
      return `<div${style(grid.cell)}>
  <div${style({
        'background-color': item.hex,
        color: ink,
        height: '26mm',
        'border-radius': `${ds.radius}px`,
        display: 'flex',
        'align-items': 'flex-end',
        padding: `${snap(ds.spacing * 0.6)}px`,
        'font-size': `${ds.typeScale.xs}px`,
        'font-weight': 700,
        border: `1px solid ${ds.colors.rule}`,
      })}>${esc(item.hex.toUpperCase())}</div>
  <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'font-weight': 600, color: ds.colors.ink })}>${esc(item.name)}</div>
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, 'line-height': 1.35, color: ds.colors.inkMuted })}>${item.role ? esc(item.role) : ''}</div>
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>contraste ${ratio}:1</div>
</div>`;
    })
    .join('');

  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Spécimen typographique, rendu DANS la police réelle. */
function renderTypeSpecimen(
  block: Extract<Block, { kind: 'typeSpecimen' }>,
  ctx: Ctx
): string {
  const { ds } = ctx;
  const last = block.specimens.length - 1;
  return block.specimens
    .map(
      // Le filet SÉPARE deux spécimens. Sous le dernier, il ne sépare plus
      // rien : il souligne le vide qui suit, et l'œil le lit comme le début
      // d'une section absente.
      (specimen, index) => `<div${style({
        'padding-bottom': index === last ? undefined : `${snap(ds.spacing)}px`,
        'margin-bottom': index === last ? undefined : `${snap(ds.spacing)}px`,
        'border-bottom': index === last ? undefined : `1px solid ${ds.colors.rule}`,
      })}${atomic}>
  <div${style({
        'font-size': `${ds.typeScale.xs}px`,
        'text-transform': 'uppercase',
        'letter-spacing': '0.12em',
        color: ctx.roles.highlight,
        'font-weight': 700,
      })}>${esc(specimen.role)} — ${esc(specimen.family)}</div>
  <div${style({
        'font-family': `'${specimen.family}', ${DISPLAY_FALLBACK}`,
        'font-size': `${ds.typeScale['2xl']}px`,
        'line-height': 1.1,
        color: ds.colors.ink,
        'margin-top': '4px',
      })}>${esc(specimen.sample)}</div>
  <div${style({
        'font-family': `'${specimen.family}', ${BODY_FALLBACK}`,
        'font-size': `${ds.typeScale.sm}px`,
        color: ds.colors.inkMuted,
        'margin-top': '4px',
        'letter-spacing': '0.02em',
      })}>ABCDEFGHIJKLMNOPQRSTUVWXYZ &nbsp; abcdefghijklmnopqrstuvwxyz &nbsp; 0123456789</div>
</div>`
    )
    .join('');
}

/**
 * Déclinaisons du logo, chacune sur le fond qui la met en valeur.
 *
 * Le fond est déduit du LABEL de la déclinaison, pas laissé au jugement : poser
 * un logo à encre claire sur un fond clair est l'erreur la plus commune d'une
 * charte générée, et elle est purement mécanique.
 */
function renderLogoDisplay(
  block: Extract<Block, { kind: 'logoDisplay' }>,
  ctx: Ctx
): string {
  const { ds } = ctx;
  const grounds = {
    light: ds.colors.neutral['50'],
    dark: ds.colors.neutral['950'],
    neutral: ds.colors.neutral['200'],
  };

  // Une SEULE déclinaison veut la place : c'est une page de présentation, le
  // logo en est le sujet. Trois déclinaisons veulent la comparaison : elles se
  // partagent la largeur et se regardent côte à côte. La hauteur suit, sans
  // quoi un logo présenté seul occuperait un timbre-poste au milieu d'une page
  // blanche — ce que produisaient les anciennes pages libres.
  const showcase = block.variants.length === 1;

  const gap = snap(ds.spacing);
  const grid = subgridRows(2, block.variants.length, gap);

  const cells = block.variants
    .map(
      (variant) => `<div${style(grid.cell)}>
  <div${style({
        'background-color': grounds[variant.background] ?? grounds.neutral,
        border: `1px solid ${ds.colors.rule}`,
        'border-radius': `${ds.radius}px`,
        height: showcase ? '78mm' : '32mm',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        padding: `${gap}px`,
      })}>
    <img src="${esc(variant.url)}" alt="${esc(variant.label)}"${style({ 'max-height': '100%', 'max-width': '100%', width: 'auto', height: 'auto' })}>
  </div>
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>${esc(variant.label)}</div>
</div>`
    )
    .join('');

  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/**
 * Références numérotées, en pied de section.
 *
 * Compactes et discrètes : ce sont des preuves, pas du contenu. Le domaine est
 * affiché quand il est CONNU — jamais l'hôte de l'URL, qui pour une recherche
 * Google est un redirecteur technique (`vertexaisearch.cloud.google.com`) que
 * personne ne reconnaît et qui ne dit rien de l'éditeur.
 */
function renderSources(block: Extract<Block, { kind: 'sources' }>, ctx: Ctx): string {
  const { ds } = ctx;

  const items = block.items
    .map((item) => {
      // Le lien est posé sur le TITRE, jamais sur l'URL brute : une URL de
      // grounding fait trois lignes et ne dit rien de l'éditeur.
      const label = esc(item.title || item.domain || 'Source');
      const anchor = item.url
        ? `<a href="${esc(item.url)}"${style({
            color: ctx.roles.highlight,
            'text-decoration': 'none',
            'font-weight': 600,
          })}>${label}</a>`
        : `<span${style({ 'font-weight': 600, color: ds.colors.ink })}>${label}</span>`;

      const domain = item.domain
        ? `<span${style({ color: ds.colors.inkMuted })}> — ${esc(item.domain)}</span>`
        : '';

      const description = item.description
        ? `<div${style({
            'font-size': `${ds.typeScale.xs}px`,
            color: ds.colors.inkMuted,
            'line-height': 1.5,
            'margin-top': '2px',
          })}>${esc(item.description)}</div>`
        : '';

      return `<li${style({
        'font-size': `${ds.typeScale.sm}px`,
        color: ds.colors.ink,
        'line-height': 1.5,
        'margin-bottom': `${ds.spacing * 0.75}px`,
        display: 'flex',
        gap: `${ds.spacing * 0.6}px`,
        'align-items': 'baseline',
      })}><span${style({
        'font-weight': 700,
        color: ctx.roles.highlight,
        'min-width': '22px',
        'font-variant-numeric': 'tabular-nums',
      })}>${item.index}.</span><span>${anchor}${domain}${description}</span></li>`;
    })
    .join('');

  const heading = block.label
    ? `<div${style({
        'font-size': `${ds.typeScale.xs}px`,
        'text-transform': 'uppercase',
        'letter-spacing': '0.12em',
        'font-weight': 700,
        color: ctx.roles.highlight,
        'margin-bottom': `${ds.spacing * 0.5}px`,
        'padding-bottom': `${ds.spacing * 0.3}px`,
        'border-bottom': `1px solid ${ds.colors.rule}`,
      })}>${esc(block.label)}</div>`
    : '';

  return `<div${atomic}>
  ${heading}
  <ol${style({ margin: 0, padding: 0, 'list-style': 'none' })}>${items}</ol>
</div>`;
}

function renderBlock(block: Block, ctx: Ctx): string {
  switch (block.kind) {
    case 'prose':
      return renderProse(block, ctx);
    case 'cards':
      return renderCards(block, ctx);
    case 'table':
      return renderTable(block, ctx);
    case 'metrics':
      return renderMetrics(block, ctx);
    case 'chart':
      return renderChart(block, ctx);
    case 'quote':
      return renderQuote(block, ctx);
    case 'timeline':
      return renderTimeline(block, ctx);
    case 'assumption':
      return renderAssumption(block, ctx);
    case 'swatches':
      return renderSwatches(block, ctx);
    case 'typeSpecimen':
      return renderTypeSpecimen(block, ctx);
    case 'logoDisplay':
      return renderLogoDisplay(block, ctx);
    case 'sources':
      return renderSources(block, ctx);
    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Les douze archétypes.
//
// Chacun décide la STRUCTURE de la page : comment l'en-tête est composé, et
// comment le flux de blocs s'organise dessous. Le rendu des blocs, lui, est
// commun — un tableau se dessine de la même façon partout, c'est la page qui
// change.
// ─────────────────────────────────────────────────────────────────────────────

interface PageChrome {
  /** En-tête de la page, déjà rendu. */
  header: string;
  /**
   * Retrait latéral supplémentaire, en mm, propre à l'archétype.
   *
   * Posé sur le PADDING DE LA RACINE, jamais sur un conteneur interne : c'est
   * `insetsOf(root)` que le paginateur lit pour calculer la capacité d'une page.
   * Un retrait porté par un wrapper lui serait invisible, et il planifierait des
   * pages trop pleines.
   */
  rootInsetMm?: number;
  /** Élément graphique de fond, posé derrière le contenu. */
  backdrop?: string;
}

type ArchetypeRenderer = (content: SectionContent, ctx: Ctx) => PageChrome;

/**
 * Mots qui ne doivent JAMAIS rester seuls sur une ligne.
 *
 * Une esperluette ou une préposition isolée en bout de ligne est une faute de
 * composition connue (« orpheline ») : l'œil la lit comme un mot à part entière
 * et la ligne suivante paraît commencer au milieu d'une idée. Sur un titre de
 * couverture, elle occupe une ligne entière pour un seul caractère.
 */
const ORPHAN_WORDS = /^(?:&|et|de|du|des|la|le|les|à|au|aux|and|of|the|for|to|in|on)$/i;

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
function fitTitleSize(
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
function trackingEm(tracking: string): number {
  const parsed = Number.parseFloat(tracking);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Titre, rendu selon l'humeur typographique en vigueur. */
function renderTitle(content: SectionContent, ctx: Ctx, color: string): string {
  const { type, ds } = ctx;
  const title = content.title.trim();
  const words = title.split(/\s+/).filter(Boolean);

  // EMPILEMENT — un mot par ligne. C'est un vrai parti pris éditorial, mais il
  // ne vaut que sur un titre COURT : appliqué à cinq mots il ne compose plus, il
  // empile, et mange la page. On le réserve donc aux titres de deux ou trois
  // mots courts, et on retombe sur le flux normal au-delà — où le navigateur
  // coupe aux bons endroits, ce qu'il fait mieux qu'une règle fixe.
  const stackable =
    ctx.type.stacked && words.length <= 3 && Math.max(...words.map((w) => w.length), 0) <= 12;

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

function renderKicker(content: SectionContent, ctx: Ctx, color: string): string {
  if (!content.kicker) return '';
  return `<div${style({
    'font-size': `${ctx.ds.typeScale.xs}px`,
    'font-weight': 700,
    'text-transform': 'uppercase',
    'letter-spacing': '0.18em',
    color,
    'margin-bottom': `${ctx.ds.spacing * 0.5}px`,
  })}>${esc(content.kicker)}</div>`;
}

function renderLede(content: SectionContent, ctx: Ctx, color: string): string {
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

/**
 * Quelle STRUCTURE chaque archétype demande.
 *
 * ── POURQUOI UNE TABLE, ET NON UN CHAMP RENDU PAR L'ARCHÉTYPE ───────────────
 *
 * L'archétype la déclarait en même temps qu'il produisait son en-tête. Le rendu
 * ne connaissait donc la structure qu'APRÈS avoir composé le titre — or c'est
 * la structure qui dit quelle largeur ce titre aura. `fitTitleSize` travaillait
 * en conséquence sur une largeur SUPPOSÉE (430 px, en dur), et se trompait
 * d'autant que la structure s'en écartait.
 *
 * Mesuré avant correction : sur les dispositions `corner` et `centered`, les
 * en-têtes occupaient 344 à 387 px d'une zone de 500 px — plus des trois quarts
 * de la page pour un seul titre — et le contenu débordait sous le pied de page.
 *
 * Déclarée ici, la structure est connue AVANT que l'archétype ne compose quoi
 * que ce soit. La table est par ailleurs lisible d'un coup d'oeil, ce qui est
 * la condition pour vérifier qu'un style de direction artistique atteint bien
 * trois structures distinctes (cf. `check:uniqueness`).
 *
 * Trois affectations sont IMPOSÉES par l'identité de l'archétype : « B » est un
 * bandeau saignant, « G » une manchette de journal, « J » un cadre à titre
 * centré. Les neuf autres ont été réparties par recherche, sous la contrainte
 * que chaque style atteigne au moins trois structures distinctes.
 */
/**
 * Part de la largeur utile qui revient à l'EN-TÊTE, par structure.
 *
 * Une seule source : elle sert à la fois à composer le titre (`fitTitleSize`)
 * et à borner le conteneur qui l'accueille. Les deux tirés de la même valeur,
 * ils ne peuvent plus se contredire — c'est exactement ce qui arrivait quand
 * l'un lisait 62 % et l'autre « 34ch ».
 */
const HEADER_SHARE: Record<LandscapeLayout, number> = {
  side: 5 / 12,
  'side-reverse': 5 / 12,
  stacked: 1,
  banner: 1,
  centered: 0.62,
  corner: 0.5,
};

export const ARCHETYPE_LANDSCAPE: Record<string, LandscapeLayout> = {
  A: 'side-reverse',
  B: 'banner',
  C: 'centered',
  D: 'corner',
  E: 'side',
  F: 'side-reverse',
  G: 'stacked',
  H: 'side',
  I: 'corner',
  J: 'centered',
  K: 'corner',
  L: 'side',
};

const ARCHETYPE_RENDERERS: Record<string, ArchetypeRenderer> = {
  // A — SPLIT ÉDITORIAL : le titre tient les deux tiers de la largeur, le tiers
  // restant est laissé VIDE.
  //
  // Il portait un panneau de couleur pleine hauteur. C'était l'exemple type de
  // ce que `EDITORIAL_RESTRAINT_BLOCK` interdit au modèle deux fichiers plus
  // loin — « une forme posée pour remplir » — et le demander au modèle tout en
  // le produisant en code n'était pas tenable. Ce qui fait le travail ici, c'est
  // la GRILLE : elle raccourcit la justification du titre. Le vide qui reste
  // n'est pas un défaut à combler, c'est ce qui rend le titre lisible.
  A: (content, ctx) => ({
    header: `<div${style({ display: 'grid', 'grid-template-columns': '2fr 1fr', gap: `${ctx.ds.spacing * 2}px`, 'align-items': 'end', 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  <div>${renderKicker(content, ctx, ctx.roles.highlight)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
</div>`,
  }),

  // B — BANDEAU PLEIN : le titre est posé sur une bande de couleur pleine largeur.
  B: (content, ctx) => ({
    header: `<div${style({
      'background-color': ctx.roles.band,
      color: ctx.roles.onBand,
      margin: `-${ctx.padMm}mm -${ctx.bleedMm}mm ${snap(ctx.ds.spacing * 2)}px`,
      padding: `${snap(ctx.ds.spacing * 2.5)}px ${ctx.bleedMm}mm`,
    })}>${renderKicker(content, ctx, ctx.roles.onBand)}${renderTitle(content, ctx, ctx.roles.onBand)}${renderLede(content, ctx, ctx.roles.onBand)}</div>`,
  }),

  // C — TYPOGRAPHIE DOMINANTE : le titre occupe le tiers supérieur, rien d'autre.
  C: (content, ctx) => ({
    // Marge basse ramenée de trois à deux unités de rythme — la valeur commune
    // aux autres archétypes. Trois unités PLUS le retrait sous le filet
    // faisaient de cet en-tête le plus haut du catalogue, et la page débordait
    // de 13,8 px sous son pied. La dominance typographique tient au titre et au
    // filet qui le souligne, pas à l'écart qui suit.
    header: `<div${style({ 'margin-bottom': `${snap(ctx.ds.spacing * 2)}px`, 'padding-bottom': `${snap(ctx.ds.spacing * 1.5)}px`, 'border-bottom': `1px solid ${ctx.ds.colors.rule}` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${
    // Le titre était composé ici à la main, à `titleSize × 1.35`, sans passer
    // par `fitTitleSize` — donc sans jamais regarder combien de mots il porte
    // ni quelle largeur l'attend. Centré sur une mesure resserrée, il
    // débordait de 514 px, soit près de la moitié d'une diapositive.
    //
    // La dominance typographique de cet archétype ne tient pas au coefficient :
    // elle tient à ce que la page ne porte QUE le titre, à ce que le filet le
    // souligne, et à l'espace qu'il a devant lui. Elle survit à l'ajusteur.
    renderTitle(content, ctx, ctx.roles.heading)
  }
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
  }),

  // D — SUISSE BRUTALISTE : grille stricte, filets épais, numéro surdimensionné.
  D: (content, ctx) => ({
    header: `<div${style({ display: 'grid', 'grid-template-columns': '24mm 1fr', gap: `${ctx.ds.spacing * 1.5}px`, 'border-top': `6px solid ${ctx.roles.heading}`, 'padding-top': `${ctx.ds.spacing}px`, 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  <div${style({ 'font-size': `${ctx.ds.typeScale['3xl']}px`, 'font-weight': 900, 'line-height': 0.85, color: ctx.roles.highlight })}>${String(ctx.options.index ?? 1).padStart(2, '0')}</div>
  <div>${renderKicker(content, ctx, ctx.ds.colors.inkMuted)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
</div>`,
  }),

  // E — MINIMAL DE LUXE : vide maximal, titre discret en haut à gauche.
  E: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 4}px`, 'max-width': '120mm' })}>
  ${renderKicker(content, ctx, ctx.ds.colors.inkMuted)}
  <h1${style({
      margin: 0,
      'font-family': `'${ctx.ds.fonts.display}', ${DISPLAY_FALLBACK}`,
      'font-size': `${ctx.ds.typeScale.xl}px`,
      'font-weight': 400,
      'text-transform': 'uppercase',
      'letter-spacing': '0.35em',
      'line-height': 1.5,
      color: ctx.roles.heading,
    })}>${esc(content.title)}</h1>
  <div${style({ width: '18mm', height: '1px', 'background-color': ctx.roles.highlight, margin: `${ctx.ds.spacing * 1.5}px 0` })}></div>
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
    rootInsetMm: 14,
  }),

  // F — PROFONDEUR EN COUCHES : un panneau teinté décalé passe derrière le titre.
  F: (content, ctx) => ({
    header: `<div${style({ position: 'relative', 'margin-bottom': `${ctx.ds.spacing * 2}px`, 'padding-top': `${ctx.ds.spacing * 1.5}px` })}>
  <div${style({ position: 'absolute', top: 0, left: '-6mm', width: '60mm', height: '26mm', 'background-color': ctx.roles.panel, 'border-radius': `${ctx.ds.radius}px` })}></div>
  <div${style({ position: 'relative' })}>${renderKicker(content, ctx, ctx.roles.highlight)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
</div>`,
  }),

  // G — GRILLE DE JOURNAL : bandeau de titre lourd, flux sur deux colonnes.
  G: (content, ctx) => ({
    header: `<div${style({ 'border-top': `3px solid ${ctx.roles.heading}`, 'border-bottom': `1px solid ${ctx.roles.heading}`, padding: `${ctx.ds.spacing}px 0`, 'margin-bottom': `${ctx.ds.spacing * 1.5}px`, display: 'flex', 'align-items': 'baseline', 'justify-content': 'space-between', gap: `${ctx.ds.spacing}px` })}>
  <div>${renderTitle(content, ctx, ctx.roles.heading)}</div>
  <div${style({ 'font-size': `${ctx.ds.typeScale.xs}px`, 'text-transform': 'uppercase', 'letter-spacing': '0.14em', color: ctx.ds.colors.inkMuted, 'white-space': 'nowrap' })}>${esc(content.kicker ?? '')}</div>
</div>${renderLede(content, ctx, ctx.ds.colors.inkMuted)}`,
  }),

  // H — MOSAÏQUE : en-tête décalé, blocs légèrement désalignés.
  H: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px`, transform: 'translateX(-3mm)' })}>
  <div${style({ display: 'inline-block', 'background-color': ctx.roles.highlight, color: ctx.roles.onHighlight, padding: `4px ${ctx.ds.spacing}px`, 'border-radius': `${ctx.ds.radius}px`, 'font-size': `${ctx.ds.typeScale.xs}px`, 'font-weight': 700, 'text-transform': 'uppercase', 'letter-spacing': '0.12em', 'margin-bottom': `${ctx.ds.spacing * 0.75}px` })}>${esc(content.kicker || 'Section')}</div>
  ${renderTitle(content, ctx, ctx.roles.heading)}
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
  }),

  // I — SOMBRE LUMINEUX : fond profond, titre porté par l'accent.
  I: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2.5}px` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.highlight)}
  ${renderLede(content, ctx, ctx.ds.colors.ink)}
</div>`,
    // Pas de fond décoratif : l'archétype tient à son FOND SOMBRE et à son titre
    // d'accent, pas au disque flou qu'il posait dans l'angle. Une « blob » est
    // nommément interdite au modèle par le bloc de retenue éditoriale ; la
    // produire en code revenait à lui reprocher ce que la plateforme faisait.
  }),

  // J — CADRE : la page entière est encadrée d'un filet, le titre s'y inscrit.
  J: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px`, 'text-align': 'center' })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.heading)}
  <div${style({ width: '24mm', height: '2px', 'background-color': ctx.roles.highlight, margin: `${ctx.ds.spacing}px auto 0` })}></div>
</div>`,
    backdrop: `<div${style({ position: 'absolute', inset: '6mm', border: `1px solid ${ctx.ds.colors.rule}`, 'border-radius': `${ctx.ds.radius}px`, 'pointer-events': 'none' })}></div>`,
  }),

  // K — ÉDITORIAL RÉGLÉ : un filet épais sépare le titre de son chapô.
  //
  // C'était une bande de POINTS de 6 mm. Elle ne mesurait rien, ne séparait rien
  // que le blanc ne séparait déjà, et tombait sous l'interdit « dots placed to
  // liven up ». Un filet, lui, est l'un des trois ornements qu'une page
  // éditoriale admet — il marque une rupture de niveau, et il en fait la preuve.
  K: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.heading)}
  <div${style({
      width: '32mm',
      height: '3px',
      'margin-top': `${ctx.ds.spacing}px`,
      'background-color': ctx.roles.highlight,
    })}></div>
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
  }),

  // L — AFFICHE DE DONNÉES : le premier chiffre de la page devient le héros.
  L: (content, ctx) => {
    const metrics = content.blocks.find((block) => block.kind === 'metrics');
    // ── LE CHIFFRE HÉROS TIENT SUR UNE LIGNE, OU IL N'EST PAS UN HÉROS ────
    //
    // Il était composé à `4xl × 1.4` sans regarder ni sa longueur ni la
    // colonne qui le porte. « 2,3 Md FCFA » y passait sur deux lignes, dont la
    // seconde — « FCFA » — occupait un quart de la hauteur de la page pour
    // dire une unité. La taille se déduit ici de la place réelle : en paysage
    // l'archétype pose son en-tête dans les 5/12 de la grille.
    const heroColumnPx = ctx.contentWidthPx * (ctx.landscape ? 5 / 12 : 1);
    const heroValue =
      metrics && metrics.kind === 'metrics' && metrics.items[0]
        ? metrics.items[0].value
        : '';
    const heroSize = Math.max(
      ctx.ds.typeScale.xl,
      Math.min(
        Math.round(ctx.ds.typeScale['4xl'] * 1.4),
        Math.floor(heroColumnPx / (Math.max(heroValue.length, 1) * 0.58))
      )
    );
    const hero =
      metrics && metrics.kind === 'metrics' && metrics.items[0]
        ? `<div${style({ 'font-size': `${heroSize}px`, 'font-weight': 900, 'line-height': 0.85, color: ctx.roles.highlight, 'letter-spacing': '-0.05em', 'white-space': 'nowrap' })}>${esc(metrics.items[0].value)}</div>
  <div${style({
        'font-size': `${ctx.ds.typeScale.base}px`,
        color: ctx.ds.colors.inkMuted,
        // Le chiffre héros est composé à `line-height: 0.85` : sa boîte est
        // PLUS COURTE que ses glyphes, et le libellé posé dessous venait se
        // superposer à ses jambages. Le retrait rend au chiffre la hauteur que
        // son interlignage lui retire.
        'margin-top': `${Math.round(heroSize * 0.12)}px`,
        'margin-bottom': `${snap(ctx.ds.spacing)}px`,
      })}>${esc(metrics.items[0].label)}</div>`
        : '';
    return {
      header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${hero}
  ${renderTitle(content, ctx, ctx.roles.heading)}
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
    };
  },
};

/** Archétype de repli : un identifiant inconnu ne doit jamais perdre une page. */
const DEFAULT_ARCHETYPE = 'A';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liens de chargement des polices de la CHARTE.
 *
 * ── LE DÉFAUT QUE CECI CORRIGE ──────────────────────────────────────────────
 *
 * Le rendu écrivait `font-family: 'Playfair Display', serif` sans que rien, nulle
 * part, ne charge jamais Playfair Display. Chrome faisait alors ce qu'il doit :
 * il tombait sur le `serif` générique. Résultat, la typographie de la charte
 * était nommée dans le CSS et absente de la page — et TOUS les projets sortaient
 * dans le même Times et le même Helvetica, quelle que soit la charte décidée.
 *
 * C'était l'écart le plus visible entre ce que la plateforme promet (« la charte
 * est respectée ») et ce qu'elle livrait, et il ne se voyait pas dans le code :
 * la déclaration CSS était juste, seul le chargement manquait.
 *
 * ── PLACEMENT ───────────────────────────────────────────────────────────────
 *
 * Les `<link>` sont émis AVANT la racine, jamais à l'intérieur. Le paginateur
 * prend les enfants directs de la racine pour des blocs de contenu : un `<link>`
 * parmi eux serait compté comme un bloc de hauteur nulle et fausserait la
 * mesure. Dehors, il n'existe que pour le chargement.
 *
 * Émis par section plutôt qu'une fois par document : une section rendue reste
 * ainsi autonome — même page dans le PDF, dans l'éditeur et dans une
 * prévisualisation. Le navigateur dédoublonne les href identiques, le coût est
 * donc celui d'une seule requête pour tout le livrable.
 *
 * `buildGoogleFontLinks` ignore de lui-même les piles système (`serif`,
 * `sans-serif`, Georgia…) : une charte qui n'a pas encore de police n'émet rien.
 */
function fontLinks(ds: DocumentDesignSystem): string {
  const links = buildGoogleFontLinks([ds.fonts.display, ds.fonts.body]);
  return links ? `${links}\n` : '';
}

/**
 * Rend une page complète.
 *
 * Ne lève jamais : un contenu partiel produit une page partielle, jamais une
 * exception. C'est la propriété qui permet de basculer une section sur le
 * gabarit sans risque de perdre une génération.
 */
export function renderSection(
  content: SectionContent,
  ds: DocumentDesignSystem,
  seed: SectionSeed,
  options: RenderOptions = {}
): string {
  const page = options.page ?? PORTRAIT_A4;
  const landscape = page.orientation === 'landscape';
  // Une page ROGNÉE ne pardonne pas le débordement : on resserre le rythme.
  const cramped = options.multiPage === false;

  // ── LE VOLUME, BORNÉ AVANT TOUT LE RESTE ─────────────────────────────────
  //
  // Sur une page rognée, le contenu est ramené à ce que la page porte AVANT
  // que l'archétype ne le lise. L'ordre compte : l'archétype « L » prend le
  // premier chiffre-clé pour en faire son héros, et `fitToPage` pèse ensuite
  // les blocs. Condenser après eux les ferait travailler sur un contenu qui
  // n'est pas celui qui sera rendu.
  //
  // Un document paginé n'est pas touché : le paginateur lui donne les pages
  // dont il a besoin, et lui retirer des phrases serait une perte sèche.
  content = cramped ? condenseForFixedPage(content) : content;

  const ctx: Ctx = {
    ds: cramped ? tighten(ds) : ds,
    roles: resolveColorRoles(ds, seed.colorStrategy),
    type: resolveTypeTreatment(cramped ? tighten(ds) : ds, seed.typographyMood),
    tension: resolveTension(seed.layoutTension),
    seed,
    options,
    landscape,
    sourceCount:
      content.blocks.find((block) => block.kind === 'sources')?.items.length ?? 0,
    padMm: Number.parseFloat(page.padding),
    bleedMm: Number.parseFloat(page.padding) + resolveTension(seed.layoutTension).inset,
    // Repli : la pleine largeur utile. Fixée juste après, une fois la
    // structure connue.
    headerWidthPx:
      (Number.parseFloat(page.width) - 2 * Number.parseFloat(page.padding)) * MM_TO_PX,
    titleHeightPx: 0,
    variant: documentVariant(seed),
    // Repli : la largeur utile pleine page. Affinée juste après, une fois
    // l'archétype connu.
    contentWidthPx:
      (Number.parseFloat(page.width) - 2 * Number.parseFloat(page.padding)) * MM_TO_PX,
  };

  const renderer = ARCHETYPE_RENDERERS[seed.archetype] ?? ARCHETYPE_RENDERERS[DEFAULT_ARCHETYPE];

  // ── LA STRUCTURE, PUIS SEULEMENT ENSUITE L'EN-TÊTE ───────────────────────
  //
  // La table dit la structure ; la direction de lecture peut la refléter ; la
  // structure dit la largeur de l'en-tête ; l'en-tête s'y compose. L'ordre
  // compte : composer d'abord et mesurer ensuite, c'était garantir que la
  // mesure arrive trop tard.
  const declared: LandscapeLayout =
    ARCHETYPE_LANDSCAPE[seed.archetype] ?? ARCHETYPE_LANDSCAPE[DEFAULT_ARCHETYPE];
  // `readingDirection` était tirée pour chaque page et lue par personne — le
  // contrôle d'unicité la comptait pourtant comme un facteur six. Elle sert
  // enfin : une page qui se lit de droite à gauche pose son en-tête à droite.
  // Le reflet ne vaut que pour les dispositions latérales, seules à avoir un
  // côté : refléter un bandeau ou un en-tête centré ne voudrait rien dire.
  const mirrored =
    seed.readingDirection === 'RIGHT_TO_LEFT' || seed.readingDirection === 'CORNER_DIAGONAL';
  const layout: LandscapeLayout = !landscape
    ? declared
    : !mirrored
      ? declared
      : declared === 'side'
        ? 'side-reverse'
        : declared === 'side-reverse'
          ? 'side'
          : declared;

  ctx.headerWidthPx = landscape
    ? (ctx.contentWidthPx - 2 * ctx.tension.inset * MM_TO_PX) * HEADER_SHARE[layout]
    : ctx.contentWidthPx;

  // Part de la HAUTEUR que le titre peut prendre, par structure.
  //
  // Les deux dispositions latérales posent l'en-tête dans sa propre colonne :
  // il n'y dispute la hauteur à personne, et un grand titre y est l'effet
  // recherché. Les quatre dispositions empilées le posent AU-DESSUS des blocs,
  // où chaque ligne de titre est une ligne de contenu en moins.
  const TITLE_SHARE: Record<LandscapeLayout, number> = {
    side: 0.45,
    'side-reverse': 0.45,
    stacked: 0.24,
    banner: 0.24,
    centered: 0.24,
    corner: 0.24,
  };
  // La borne ne vaut que pour une page à hauteur FIXE. Un document paginé n'a
  // pas de hauteur à répartir : le paginateur lui donne les pages qu'il faut.
  ctx.titleHeightPx = cramped
    ? (Number.parseFloat(page.minHeight) - 2 * Number.parseFloat(page.padding)) *
      MM_TO_PX *
      (landscape ? TITLE_SHARE[layout] : 0.3)
    : 0;

  const chrome = renderer(content, ctx);

  // ── LA LARGEUR RÉELLEMENT OFFERTE AUX BLOCS ──────────────────────────────
  //
  // Deux retranchements, dans l'ordre où la page les applique.
  //
  //  1. LES RETRAITS. La tension spatiale et l'archétype ajoutent chacun un
  //     retrait latéral au padding de la racine — jusqu'à 14 mm de chaque côté
  //     pour l'archétype « E », soit 28 mm de moins que la page. Les ignorer
  //     faisait composer les chiffres-clés pour une colonne plus large que
  //     celle où ils atterrissaient, et deux d'entre eux se touchaient.
  //
  //  2. LA COLONNE. En paysage `side`, l'en-tête tient les 5/12 de la grille :
  //     les blocs n'ont que les 7/12 restants, moins la gouttière.
  const insetMm = ctx.tension.inset + (chrome.rootInsetMm ?? 0);
  ctx.contentWidthPx -= 2 * insetMm * MM_TO_PX;
  if (landscape && (layout === 'side' || layout === 'side-reverse')) {
    ctx.contentWidthPx = ctx.contentWidthPx * (7 / 12) - snap(ctx.ds.spacing * 2);
  }
  // Réserve : l'estimation d'une largeur de signe reste une estimation, et un
  // dépassement d'un cheveu se voit — deux chiffres qui se touchent — alors
  // qu'un chiffre 3 % plus petit ne se voit pas.
  ctx.contentWidthPx *= 0.97;

  const separator =
    ctx.tension.separator === 'thick'
      ? `border-top:3px solid ${ctx.ds.colors.rule};padding-top:${ctx.ds.spacing * ctx.tension.gap}px;`
      : ctx.tension.separator === 'hairline'
        ? `border-top:1px solid ${ctx.ds.colors.rule};padding-top:${ctx.ds.spacing * ctx.tension.gap}px;`
        : '';

  // ── AJUSTEMENT À LA PAGE ROGNÉE ──────────────────────────────────────────
  //
  // Sur `multiPage: false`, la page a une hauteur FIXE et `overflow: hidden` :
  // ce qui dépasse est coupé, souvent en pleine phrase, et le lecteur voit un
  // paragraphe amputé sans savoir qu'il l'est. C'est le pire des deux mondes —
  // le contenu est produit, payé, puis masqué.
  //
  // Le paginateur ne peut rien y faire (il ne tourne pas sur ces formats), et le
  // modèle ne sait pas mesurer une page. C'est donc au rendu de décider ce qui
  // tient — et de le DIRE, pour qu'un livrable systématiquement tronqué se voie
  // dans les journaux au lieu de se découvrir à l'impression.
  const blockList = cramped
    ? fitToPage(
        content.blocks,
        page,
        ctx.ds,
        Boolean(content.lede),
        // La structure RÉSOLUE, miroir de lecture compris : c'est elle qui
        // sera rendue, donc elle seule qui dit la place disponible.
        landscape ? layout : 'portrait'
      )
    : content.blocks;

  // ── L'ÉCART ENTRE DEUX BLOCS ──────────────────────────────────────────────
  //
  // Calé sur le rythme, comme tout écart vertical de la page. Il valait
  // `spacing × gap × 1.5` arrondi — un nombre juste par construction et
  // comparable à aucun autre, alors que la lecture d'une page tient
  // précisément à ce que ses écarts SE COMPARENT.
  const blockGap = snap(ctx.ds.spacing * ctx.tension.gap * (cramped ? 0.9 : 1.5));

  // Chaque bloc n'est rendu QU'UNE FOIS. Les deux assemblages qui suivent —
  // le flux vertical et la grille — sont deux façons de POSER le même balisage,
  // pas deux rendus. `renderBlock` est pur, le rendre deux fois donnerait le
  // même résultat, mais le prix serait payé sur chaque page de chaque livrable.
  const rendered = packRow(blockList)
    .map(({ block, span }) => ({ span, html: renderBlock(block, ctx) }))
    .filter((entry) => Boolean(entry.html));

  const blocks = rendered.map(({ html }, index) => {
    const spacing = index === 0 ? '' : `margin-top:${blockGap}px;${separator}`;
    // `break-inside` n'est PAS posé ici : c'est le paginateur qui décide où
    // couper, et les blocs qui ne doivent jamais l'être portent déjà
    // `data-keep-together`.
    return spacing ? `<div style="${spacing}">${html}</div>` : `<div>${html}</div>`;
  });

  /**
   * Les mêmes blocs, rangés dans la GRILLE À DOUZE COLONNES de la page.
   *
   * ── LE DÉFAUT QUE CECI CORRIGE ────────────────────────────────────────
   *
   * Le paysage posait `grid-template-columns: repeat(2, 1fr)` sur tous les
   * blocs indistinctement. Deux conséquences, visibles sur presque toutes les
   * pages de charte observées :
   *
   *   · une page qui ne portait QU'UN bloc — la page « Typographie » et son
   *     unique spécimen — le laissait dans la colonne de gauche et laissait la
   *     colonne de droite VIDE. La moitié de la diapositive, blanche, par
   *     construction ;
   *   · un tableau ou un nuancier, dont la largeur EST la lisibilité, se
   *     retrouvait comprimé dans une demi-diapositive.
   *
   * `packRow` donne à chaque bloc la largeur que sa NATURE réclame, puis
   * promeut pleine largeur tout demi-bloc qui n'a pas de voisin — il n'y a
   * donc plus de colonne orpheline.
   *
   * L'écart est porté par la gouttière de la grille, jamais par un
   * `margin-top` : dans une grille, une marge posée sur le premier élément
   * d'une rangée décale cette rangée-là seule, et les rangées cessent d'être
   * des rangées.
   */
  const gridded = rendered.map(
    ({ span, html }) =>
      `<div${style({ 'grid-column': `span ${span}`, 'min-width': '0' })}>${html}</div>`
  );

  const blockGrid = (items: string[], columns: number): string =>
    `<div${style({
      display: 'grid',
      'grid-template-columns': `repeat(${columns}, minmax(0, 1fr))`,
      gap: `${blockGap}px`,
      'align-items': 'start',
    })}>${items.join('\n')}</div>`;

  const logo = options.logoUrl
    ? `<img src="${esc(options.logoUrl)}" alt="${esc(options.brandName ? `${options.brandName} — logo` : 'Logo')}"${style({
        height: landscape ? '8mm' : '9mm',
        width: 'auto',
        display: 'block',
      })}>`
    : '';

  const footer = `<div${style({
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    'margin-top': `${ctx.ds.spacing * (cramped ? 1.2 : 2)}px`,
    'padding-top': `${ctx.ds.spacing * 0.75}px`,
    'border-top': `1px solid ${ctx.ds.colors.rule}`,
    'font-size': `${ctx.ds.typeScale.xs}px`,
    color: ctx.ds.colors.inkMuted,
  })}${atomic}>
  ${logo || `<span>${esc(options.brandName ?? '')}</span>`}
  <span>${esc(content.title)}</span>
</div>`;

  // Retraits cumulés (tension + archétype), portés par la racine pour rester
  // visibles du paginateur.
  const sideInset = ctx.tension.inset + (chrome.rootInsetMm ?? 0);
  const insetPadding = sideInset
    ? `${page.padding} ${Number(page.padding.replace('mm', '')) + sideInset}mm`
    : page.padding;

  // ── RÉPARTITION VERTICALE ────────────────────────────────────────────────
  //
  // Elle ne vaut que pour les pages à HAUTEUR FIXE. Un document paginé n'a pas
  // de vide à répartir : le paginateur remplit ses pages puis étire ses
  // interlignes lui-même, et centrer un flux qu'il s'apprête à découper
  // décalerait chaque page d'une quantité différente.
  const usableHeightMm =
    Number.parseFloat(page.minHeight) - 2 * Number.parseFloat(page.padding);
  const distribution = cramped ? distributeVertically(usableHeightMm) : {};

  const rootStyle = {
    width: page.width,
    'min-height': page.minHeight,
    ...(cramped ? { height: page.minHeight, overflow: 'hidden' } : {}),
    padding: insetPadding,
    position: 'relative',
    'box-sizing': 'border-box',
    'background-color': ctx.roles.ground,
    color: ctx.ds.colors.ink,
    'font-family': `'${ctx.ds.fonts.body}', ${BODY_FALLBACK}`,
    'font-size': `${ctx.ds.typeScale.base}px`,
  };

  // ── PAYSAGE ──────────────────────────────────────────────────────────────
  // Le paginateur ne tourne PAS sur ces formats (`multiPage: false` : chaque
  // section est exactement une page, et ce qui dépasse est rogné). Le rendu a
  // donc les mains libres pour composer en colonnes — ce qu'un 16:9 réclame :
  // empiler un titre puis un flux vertical y laisse une bande vide à droite et
  // fait déborder par le bas.
  if (landscape) {
    // Gouttière ENTRE LES DEUX COLONNES d'une disposition latérale.
    //
    // Les dispositions empilées n'en prennent pas : l'archétype pose déjà la
    // marge basse de son en-tête, et en ajouter une seconde par-dessus doublait
    // l'écart — assez pour faire déborder « C » de 30 px et « D » de 11 px sous
    // le pied de page, ce que `check:fit` a signalé.
    const gutter = snap(ctx.ds.spacing * 2);

    /** Les deux colonnes d'une disposition latérale, dans l'ordre demandé. */
    const columned = (headerFirst: boolean): string =>
      `<div${style({
        display: 'grid',
        'grid-template-columns': headerFirst ? '5fr 7fr' : '7fr 5fr',
        gap: `${gutter}px`,
        'align-items': 'start',
      })}>
  ${
    headerFirst
      ? `<div>${chrome.header}</div>
  <div>${blocks.join('\n')}</div>`
      : `<div>${blocks.join('\n')}</div>
  <div${style({ 'text-align': 'right' })}>${chrome.header}</div>`
  }
</div>`;

    // Dans une colonne des 7/12, les blocs restent pleine largeur : la
    // subdiviser encore rendrait un tableau ou un nuancier illisibles.
    const body =
      layout === 'side'
        ? columned(true)
        : layout === 'side-reverse'
          ? columned(false)
          : layout === 'centered'
            ? // L'en-tête est centré sur une mesure resserrée ; le contenu
              // garde la pleine largeur, faute de quoi un nuancier centré
              // laisserait deux vides symétriques qui ne disent rien.
              // La borne est un POURCENTAGE, et c'est la même part que celle
              // annoncée à `fitTitleSize` (`HEADER_SHARE.centered`).
              //
              // Elle était exprimée en `ch`. L'unité se résout sur la police du
              // conteneur — 14 px ici — et non sur celle du titre qu'elle
              // borne : 34ch valaient 238 px au lieu des 630 px annoncés à
              // l'ajusteur, qui composait donc un titre de 54 px pour deux
              // lignes là où la page en imposait quatre.
              `<div${style({
                'text-align': 'center',
                'max-width': `${Math.round(HEADER_SHARE.centered * 100)}%`,
                margin: '0 auto',
              })}>${chrome.header}</div>
${blockGrid(gridded, 12)}`
            : layout === 'corner'
              ? // L'en-tête occupe le quart haut-gauche, le contenu prend
                // toute la largeur dessous. Le coin haut-droit reste vide —
                // c'est la tension `CORNER_ANCHOR`, enfin rendue.
                // Six colonnes, pas cinq : le coin opposé reste franchement
                // vide, et le titre cesse de casser à chaque mot. À 5/12,
                // l'en-tête à deux colonnes de l'archétype « D » ne laissait
                // que 332 px au titre, là où l'ajusteur en suppose 430.
                `<div${style({ 'max-width': `${Math.round(HEADER_SHARE.corner * 100)}%` })}>${chrome.header}</div>
${blockGrid(gridded, 12)}`
              : // `stacked` : en-tête pleine largeur, contenu dans la grille.
                `${chrome.header}
${blockGrid(gridded, 12)}`;

    // `banner` : l'en-tête est un aplat qui SAIGNE. Sa marge négative doit
    // s'annuler contre la marge de page, ce qui suppose qu'il y soit collé —
    // il reste donc hors de la zone répartie, et seul le contenu se répartit
    // dans ce qui reste.
    if (layout === 'banner') {
      return `${fontLinks(ctx.ds)}<div${style({ ...rootStyle, display: 'flex', 'flex-direction': 'column' })}>
${chrome.backdrop ?? ''}
${chrome.header}
<div${style({ flex: '1 1 auto', 'min-height': 0, ...distribution })}>
${blockGrid(gridded, 12)}
</div>
${footer}
</div>`;
    }

    return `${fontLinks(ctx.ds)}<div${style({ ...rootStyle, display: 'flex', 'flex-direction': 'column' })}>
${chrome.backdrop ?? ''}
<div${style({ flex: '1 1 auto', 'min-height': 0, ...distribution })}>
${body}
</div>
${footer}
</div>`;
  }

  // ── PORTRAIT ─────────────────────────────────────────────────────────────
  // ⚠️ STRUCTURE PLATE, ET C'EST UN CONTRAT, PAS UN STYLE.
  //
  // Le paginateur prend les ENFANTS DIRECTS de cette racine pour blocs
  // (`flow-pagination.runtime`, `paginateSection`) : il les mesure, les regroupe
  // en pages, et clone la racine pour chacune. Envelopper le flux dans un
  // conteneur intermédiaire lui présenterait UN seul bloc géant, insécable —
  // une section de plus d'une page serait alors réduite à l'échelle ou rognée.
  //
  // Le retrait de la tension est donc porté par le PADDING de la racine, jamais
  // par un conteneur interne. Le décor de fond est en `position:absolute`, donc
  // hors flux : le paginateur le préserve comme décoration de page.
  // Un portrait ROGNÉ (charte au format A4) ne passe pas non plus par le
  // paginateur : il a droit à la même répartition verticale que la
  // diapositive, et le contrat de structure plate ne le concerne pas — c'est
  // le paginateur qu'il protège, et le paginateur ne tourne pas ici.
  if (cramped) {
    const bleeds = layout === 'banner';
    const head = bleeds ? chrome.header : '';
    const inside = bleeds ? '' : chrome.header;
    return `${fontLinks(ctx.ds)}<div${style({ ...rootStyle, display: 'flex', 'flex-direction': 'column' })}>
${chrome.backdrop ?? ''}
${head}
<div${style({ flex: '1 1 auto', 'min-height': 0, ...distribution })}>
${inside}
${blocks.join('\n')}
</div>
${footer}
</div>`;
  }

  return `${fontLinks(ctx.ds)}<div${style(rootStyle)}>
${chrome.backdrop ?? ''}
${chrome.header}
${blocks.join('\n')}
${footer}
</div>`;
}

/**
 * Retient les blocs qui TIENNENT sur une page à hauteur fixe.
 *
 * La mesure est une estimation — il n'y a pas de moteur de rendu côté serveur —
 * mais elle est déterministe et volontairement PRUDENTE : mieux vaut une page
 * un peu creuse qu'une page coupée en pleine phrase.
 *
 * L'unité est la « page A4 portrait » (cf. `estimateBlockWeight`). La capacité
 * d'un autre format s'en déduit par sa surface utile, corrigée du resserrement
 * typographique appliqué aux pages rognées.
 *
 * Un bloc de prose trop long n'est pas jeté : il est TRONQUÉ à ses premiers
 * paragraphes. Perdre un paragraphe est un moindre mal ; perdre le tableau qui
 * le suivait ne l'est pas.
 */
function fitToPage(
  blocks: Block[],
  page: PageFormat,
  ds: DocumentDesignSystem,
  hasLede: boolean,
  layout: PageLayout = 'portrait'
): Block[] {
  const mm = (value: string): number => Number.parseFloat(value.replace('mm', '')) || 0;

  // Surface utile du format, rapportée à celle d'une A4 portrait (186 × 273 mm).
  const pad = mm(page.padding);
  const usable = (mm(page.width) - 2 * pad) * (mm(page.minHeight) - 2 * pad);
  const a4Usable = (210 - 24) * (297 - 24);
  // `tighten()` réduit corps et rythme d'environ 15 % : autant de matière en plus.
  const capacityRatio = (usable / a4Usable) * 1.15;

  // ── LA PLACE RÉELLEMENT OFFERTE AUX BLOCS DÉPEND DE LA DISPOSITION ────────
  //
  // Un seul budget était calculé pour les trois dispositions, à partir de la
  // surface de la page. C'est juste en portrait, où les blocs occupent toute la
  // largeur sous l'en-tête. Ça ne l'est dans AUCUN des deux cas paysage, qui
  // sont pourtant les seuls formats rognés de la plateforme (deck et charte) :
  //
  //   `side`    — l'en-tête prend la colonne de GAUCHE, les blocs n'ont que les
  //               7/12 de la largeur. La surface disponible était donc
  //               surestimée de près de moitié : le contenu débordait, et une
  //               page à `overflow: hidden` le coupe en pleine phrase.
  //   `stacked` — l'en-tête est au-dessus, mais les blocs sont en DEUX colonnes.
  //               La surface est la bonne ; c'est le retrait d'en-tête qui était
  //               calibré sur une A4, donc sous-évalué sur une page deux fois
  //               moins haute.
  //
  // Mesuré dans les journaux avant correction : « 1 bloc sur 4 écarté » sur des
  // slides, jusqu'à « 21 sur 24 » sur une page libre.
  const footer = 0.05;
  const heading = (layout === 'portrait' ? 0.16 : 0.17) + (hasLede ? 0.05 : 0);

  // Les deux dispositions LATÉRALES ne consomment pas de HAUTEUR pour leur
  // en-tête : il prend les 5/12 de la LARGEUR. On retire donc la colonne, pas
  // le bandeau.
  const lateral = layout === 'side' || layout === 'side-reverse';

  // Les quatre dispositions EMPILÉES posent l'en-tête au-dessus des blocs, mais
  // il n'y coûte pas la même hauteur partout : ce qui varie, c'est la largeur
  // offerte au titre, donc le nombre de lignes qu'il occupe.
  //
  //   `stacked`, `banner` — le titre a les douze colonnes : deux lignes suffisent ;
  //   `centered`          — borné à 34 signes, il en prend une de plus ;
  //   `corner`            — cantonné aux 5/12, il en prend près du double.
  //
  // Ces coefficients ne sont pas une appréciation : ils ont été posés à partir
  // des débordements MESURÉS par `check:fit` lors de l'ajout des structures
  // (514 px pour `centered`, 8 à 53 px pour `corner`), puis vérifiés par lui.
  const headingCost =
    layout === 'centered' ? heading * 1.35 : layout === 'corner' ? heading * 1.5 : heading;

  const area = lateral ? capacityRatio * (7 / 12) : capacityRatio;
  const chrome = lateral ? footer : headingCost + footer;

  // Marge de sûreté : l'estimation ignore les retours à la ligne, la casse et
  // les polices réelles. 10 % de réserve évitent le débordement d'un cheveu.
  const budget = Math.max(0.2, area * 0.9 - chrome);

  // ── CE QUE COÛTE UN BLOC DÉPEND DE SA RANGÉE ────────────────────────────
  //
  // En disposition `stacked`, les blocs sont rangés dans une grille à douze
  // colonnes : deux blocs à demi-largeur se posent CÔTE À CÔTE, et leur rangée
  // ne coûte que la hauteur du plus haut des deux — pas la somme des deux.
  //
  // Le budget les comptait l'un après l'autre, comme si la page les empilait.
  // Elle en écartait donc qui tenaient : mesuré sur le harnais de rendu,
  // « 2 blocs sur 4 écartés » sur chaque page de démonstration, et la page
  // sortait à la fois amputée et à moitié vide — le pire des deux résultats.
  // Les quatre dispositions empilées rangent leurs blocs dans la grille à douze
  // colonnes ; les latérales les posent pleine largeur d'une colonne des 7/12,
  // où deux demi-blocs n'auraient plus de place pour respirer.
  const spans =
    !lateral && layout !== 'portrait'
      ? packRow(blocks).map((entry) => entry.span)
      : blocks.map(() => 12 as const);

  /**
   * Coût du bloc `index`, une fois sa rangée prise en compte.
   *
   * Un bloc pleine largeur coûte son poids. Un demi-bloc coûte le poids du plus
   * haut de la paire, porté par le PREMIER des deux — le second est alors
   * gratuit, puisqu'il tient dans la hauteur déjà payée.
   */
  const rowCost = (index: number): number => {
    const weight = estimateBlockWeight(blocks[index]);
    if (spans[index] === 12) return weight;
    // Second d'une paire : sa rangée est déjà payée.
    if (index > 0 && spans[index - 1] === 6) return 0;
    const partner = spans[index + 1] === 6 ? estimateBlockWeight(blocks[index + 1]) : 0;
    return Math.max(weight, partner);
  };

  const kept: Block[] = [];
  let used = 0;

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const weight = rowCost(index);

    if (used + weight <= budget) {
      kept.push(block);
      used += weight;
      continue;
    }

    // Le bloc ne tient pas entier. De la prose peut être raccourcie ; le reste
    // est indivisible — un demi-tableau ne veut rien dire.
    if (block.kind === 'prose') {
      const remaining = budget - used;
      if (remaining > 0.06) {
        const paragraphs: string[] = [];
        let taken = 0;
        for (const paragraph of block.paragraphs) {
          const cost = paragraph.length / 3600;
          if (taken + cost > remaining) break;
          paragraphs.push(paragraph);
          taken += cost;
        }
        if (paragraphs.length > 0) {
          kept.push({ kind: 'prose', paragraphs });
          used += taken;
        }
      }
    }

    // Une fois le budget atteint, on ne cherche pas un bloc plus petit plus
    // loin : l'ordre des blocs porte le raisonnement de la page, le rompre
    // produirait une page cohérente en surface et absurde à la lecture.
    break;
  }

  const dropped = blocks.length - kept.length;
  if (dropped > 0) {
    logger.warn(
      `Page rognée : ${dropped} bloc(s) sur ${blocks.length} écarté(s) faute de place ` +
        `(budget ${budget.toFixed(2)} page, format ${page.width}×${page.minHeight}, ` +
        `disposition ${layout}). Réduire le volume demandé dans le brief si cela se répète.`
    );
  }

  return kept.length > 0 ? kept : blocks.slice(0, 1);
}

/**
 * Resserre le design system pour une page ROGNÉE (deck, charte).
 *
 * Sur un format où le débordement n'est pas rattrapable, le rythme et l'échelle
 * doivent laisser de la marge. On ne change ni la palette, ni les contrastes,
 * ni le rayon : seulement ce qui occupe de la place.
 */
function tighten(ds: DocumentDesignSystem): DocumentDesignSystem {
  const scale = ds.typeScale;
  const shrink = (value: number) => Math.max(9, Math.round(value * 0.82));
  return {
    ...ds,
    spacing: Math.max(4, Math.round(ds.spacing * 0.7)),
    typeScale: {
      xs: Math.max(9, scale.xs),
      sm: Math.max(10, scale.sm),
      base: Math.max(11, Math.round(scale.base * 0.88)),
      lg: shrink(scale.lg),
      xl: shrink(scale.xl),
      '2xl': shrink(scale['2xl']),
      '3xl': shrink(scale['3xl']),
      '4xl': shrink(scale['4xl']),
    },
  };
}

/** Liste des archétypes réellement implémentés — sert aux vérifications. */
export const IMPLEMENTED_ARCHETYPES = Object.keys(ARCHETYPE_RENDERERS);
