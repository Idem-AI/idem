/**
 * Les FAMILLES DE MISE EN PAGE.
 *
 * ── LE DÉFAUT QUE CE MODULE CORRIGE ─────────────────────────────────────────
 *
 * La graine faisait varier des RÉGLAGES — quelle couleur va où, l'humeur du
 * titre, l'ornement de l'en-tête — posés sur un seul et même dessin. Les blocs,
 * eux, étaient dessinés à l'identique pour tous les projets : la même rangée de
 * trois chiffres sous un filet d'accent, le même tableau à en-tête plein et
 * lignes zébrées, la même rangée de cartes dont la première est pleine, la même
 * frise à rail gauche, le même pied de page « marque à gauche, titre à droite ».
 *
 * Or c'est précisément ce qu'un lecteur reconnaît d'un document à l'autre. Il
 * ne compare pas deux palettes : il voit la silhouette de la page et la forme de
 * ses composants. Constaté par l'utilisateur le 13 septembre 2026 : « peu importe
 * le projet, c'est toujours les mêmes styles, exactement les mêmes dispositions ».
 *
 * ── CE QU'EST UNE FAMILLE ───────────────────────────────────────────────────
 *
 * Une grammaire complète et COHÉRENTE : comment la section s'ouvre, comment la
 * page se ferme, où court le texte, et comment se DESSINENT chacun des blocs —
 * chiffres, tableau, cartes, frise, citation, hypothèse, prose, graphique —,
 * plus le ton de ses étiquettes, sa numérotation, ses filets, l'encre de ses
 * chiffres et ses angles.
 *
 * Chaque dimension désigne un DESSIN distinct, implémenté par sa propre fonction
 * (cf. `familyChrome.ts`, `familyBlocks.ts`), jamais un curseur sur un dessin
 * commun. C'est la règle apprise à nos dépens : une dimension de variété ne
 * compte que si l'on peut nommer le code qui la rend.
 *
 * ── POURQUOI BEAUCOUP DE FAMILLES, ET POURQUOI DES FAMILLES NOMMÉES ─────────
 *
 * Beaucoup, parce que l'impression « tout ce qui sort d'IDEM se ressemble » naît
 * de la RÉPÉTITION perçue d'un projet à l'autre : avec six familles, un
 * utilisateur qui en voit trois a déjà vu la moitié du catalogue.
 *
 * Nommées et assemblées à la main plutôt que tirées dimension par dimension,
 * parce qu'un tirage libre produirait des documents incohérents — un tableau de
 * registre comptable sous un en-tête d'affiche. La cohérence reste tenue par la
 * famille ; la variété vient de leur nombre et de leur écart mesuré
 * (`familyDistance`, contrôlé par `check:uniqueness`).
 *
 * ── CE QUI RESTE À LA GRAINE ────────────────────────────────────────────────
 *
 * La famille est un INVARIANT du document : toutes les pages d'un plan
 * partagent leur grammaire. L'archétype, la tension, la stratégie de couleur et
 * l'humeur typographique continuent de varier par-dessus, page à page et projet
 * à projet.
 */

import { ArtDirectionStyleId } from '../../models/art-direction.model';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Le vocabulaire. Chaque valeur est un dessin, et le commentaire dit lequel.
// ─────────────────────────────────────────────────────────────────────────────

/** Ouverture de section (portrait). */
export type HeaderTreatment =
  /** L'en-tête de l'archétype tiré par la graine — le comportement historique. */
  | 'archetype'
  /** Numéro surdimensionné dans une colonne de marge, titre à côté, filet dessous. */
  | 'hanging-number'
  /** Aplat de couleur saignant bord à bord, titre posé dessus. */
  | 'bleed-band'
  /** Sur-titre, titre et chapô centrés autour d'un court filet. */
  | 'centered-rule'
  /** Titre à gauche sur un filet pleine largeur, sur-titre calé à droite. */
  | 'underscored'
  /** Ouverture de chapitre : bloc haut, numéro en tête, titre en pied. */
  | 'opener'
  /** Titre à gauche, chapô à droite, alignés sur leur ligne de pied. */
  | 'split-lede'
  /** En-tête inscrit dans un cadre. */
  | 'boxed'
  /** Sur-titre tourné dans une colonne de marge, titre et chapô à côté. */
  | 'margin-kicker'
  /** Ligne d'index « 02 ——— SUR-TITRE », puis le titre. */
  | 'numbered-rule'
  /** Hiérarchie inversée : le titre en étiquette, le chapô composé en grand. */
  | 'lede-led'
  /** Titre centré entre deux doubles filets. */
  | 'double-rule'
  /** Sur-titre en onglet posé sur un filet de couleur. */
  | 'ribbon';

/** Pied de page. */
export type FolioTreatment =
  /** Filet, marque à gauche, titre à droite — le comportement historique. */
  | 'rule-split'
  /** Marque et titre centrés, sans filet. */
  | 'centered'
  /** Marque à gauche, numéro de section composé en grand à droite. */
  | 'index-right'
  /** Barre d'encre épaisse, marque en gras. */
  | 'heavy-bar'
  /** Le logo seul, calé à droite. */
  | 'mark-only'
  /** Bande de fond teinté pleine largeur. */
  | 'tinted-strip'
  /** Aucun pied : un titre courant en tête de CHAQUE page. */
  | 'running-head'
  /** Numéro de section composé en grand dans l'angle bas de la page. */
  | 'corner-number';

/** Disposition du flux en portrait paginé. */
export type BodyTreatment =
  /** Pleine largeur utile. */
  | 'full'
  /** Colonne décalée : une grande marge gauche que seul l'en-tête reprend. */
  | 'offset'
  /** Chaque bloc numéroté dans une colonne de marge (2.1, 2.2…). */
  | 'indexed'
  /** Mesure de livre : marges larges des deux côtés. */
  | 'narrow'
  /** Les petits blocs voisins se rangent par deux. */
  | 'paired';

export type MetricsTreatment =
  /** Rangée sous un filet d'accent — le comportement historique. */
  | 'ruled-row'
  /** Registre : libellé à gauche, valeur alignée à droite, une ligne par chiffre. */
  | 'ledger'
  /** Un chiffre héros à gauche, les autres en liste à droite. */
  | 'hero-list'
  /** Tuiles sur fond teinté. */
  | 'tiles'
  /** Colonnes séparées par des filets verticaux, sans filet de tête. */
  | 'divided'
  /** Bande de couleur pleine qui porte toute la rangée. */
  | 'band'
  /** Libellé d'abord, puis la valeur soulignée. */
  | 'label-first'
  /** Valeur en grand dans une colonne gauche, libellé à côté, ligne par ligne. */
  | 'stacked-rows'
  /** Les chiffres dits en une phrase, valeurs en relief. */
  | 'inline-sentence'
  /** Chaque valeur dans un cartouche tracé, libellé dessous. */
  | 'stamped'
  /** Lignes décalées en escalier. */
  | 'staircase';

export type TableTreatment =
  /** En-tête plein, lignes zébrées — le comportement historique. */
  | 'banded'
  /** Trois filets typographiques, aucun fond. */
  | 'booktabs'
  /** Toutes les cellules bordées, en-tête teinté. */
  | 'gridded'
  /** En-tête à l'encre d'accent souligné d'accent, lignes pointillées. */
  | 'accent-head'
  /** Première colonne en gras sur fond teinté. */
  | 'first-column'
  /** Chaque ligne est une bande arrondie détachée. */
  | 'row-cards'
  /** En-tête en négatif (encre en fond). */
  | 'inverted-head'
  /** Grand interlignage, un seul filet en pied. */
  | 'airy'
  /** Colonnes alternées sur fond teinté. */
  | 'striped-columns'
  /** Lignes et colonnes transposées (petits tableaux). */
  | 'transposed'
  /** Tableau dans un cadre, en-tête teinté, légende en pied de cadre. */
  | 'framed';

export type CardsTreatment =
  /** Panneaux teintés, le premier en accent — le comportement historique. */
  | 'panels'
  /** Liste numérotée, grands numéros, sans boîte. */
  | 'numbered'
  /** Boîtes à bordure fine, la carte mise en avant coiffée d'un filet épais. */
  | 'outlined'
  /** Pile à liseré gauche. */
  | 'edge-stack'
  /** Colonnes séparées de filets, titres soulignés. */
  | 'ruled-columns'
  /** La carte mise en avant en négatif, les autres nues sous un filet. */
  | 'inverted-lead'
  /** Définitions : titre à gauche, texte à droite. */
  | 'definitions'
  /** Titre en cartouche, texte dessous. */
  | 'tagged'
  /** Bandes pleine largeur alternées. */
  | 'stacked-bands'
  /** Deux colonnes décalées en hauteur. */
  | 'staggered'
  /** Lettrine carrée de l'initiale du titre, texte à côté. */
  | 'monogram'
  /** Boîtes à grand numéro d'angle. */
  | 'corner-number';

export type TimelineTreatment =
  /** Rail vertical à gauche — le comportement historique. */
  | 'rail'
  /** Étapes horizontales sur une ligne. */
  | 'steps'
  /** Dates composées en grand dans une colonne. */
  | 'date-column'
  /** Une boîte par étape. */
  | 'boxes'
  /** Titre, points de conduite, date. */
  | 'leaders'
  /** Grille de grandes dates. */
  | 'big-dates'
  /** Épine centrale, étapes alternées à gauche et à droite. */
  | 'spine'
  /** Étapes numérotées reliées par une ligne. */
  | 'numbered-circles'
  /** Dates en chevrons enchaînés. */
  | 'chevrons';

export type QuoteTreatment =
  /** Panneau à liseré — le comportement historique. */
  | 'panel'
  /** Grand corps de titrage sous un guillemet surdimensionné. */
  | 'display'
  /** Centrée entre deux filets, en italique. */
  | 'centered'
  /** Bloc en négatif. */
  | 'inverted'
  /** Guillemet dans une colonne de marge. */
  | 'hanging'
  /** Capitales sous un filet épais. */
  | 'caps'
  /** L'auteur en grand à gauche, la parole à droite. */
  | 'split'
  /** Encadrée de deux équerres. */
  | 'brackets'
  /** Texte surligné au marqueur. */
  | 'highlight';

export type AssumptionTreatment =
  /** Entre deux filets — le comportement historique. */
  | 'ruled'
  /** Encadrée. */
  | 'boxed'
  /** Libellé dans une colonne de marge. */
  | 'margin'
  /** Libellé en gras dans la phrase. */
  | 'inline'
  /** Liseré d'accent. */
  | 'edge'
  /** Libellé en onglet sur un cadre. */
  | 'tab'
  /** Note de bas de bloc, sous un filet court. */
  | 'footnote';

export type ProseTreatment =
  /** Mesure bornée — le comportement historique. */
  | 'plain'
  /** Lettrine sur trois lignes. */
  | 'drop-cap'
  /** Première phrase en gras. */
  | 'lead-in'
  /** Deux colonnes. */
  | 'columns'
  /** Alinéas en retrait, sans blanc entre paragraphes. */
  | 'indented'
  /** Corps d'essai : plus grand, plus aéré, mesure plus courte. */
  | 'essay'
  /** Premier paragraphe de la section composé plus grand. */
  | 'large-lead'
  /** Paragraphes séparés par un filet court. */
  | 'rule-separated';

export type ChartTreatment =
  /** Clé de lecture dessous, sur un liseré — le comportement historique. */
  | 'keyline'
  /** Clé de lecture AU-DESSUS, composée comme un titre de graphique. */
  | 'headline'
  /** Graphique dans un cadre. */
  | 'boxed'
  /** Rien autour : clé de lecture en légende discrète. */
  | 'bare'
  /** Clé de lecture en colonne à côté du tracé. */
  | 'side-note'
  /** Légende numérotée « Fig. 2.1 ». */
  | 'figure-caption';

/** Petites étiquettes : sur-titres, en-têtes de tableau, notes. */
export type LabelTone = 'caps' | 'small-caps' | 'italic' | 'bold' | 'underlined';

/** Format des numéros de section, d'étape, de bloc. */
export type NumberingStyle = 'padded' | 'roman' | 'section' | 'dotted' | 'bracketed' | 'plain';

/** Filets de la famille. */
export type RuleTone = 'hairline' | 'heavy' | 'double' | 'dotted' | 'none';

/** Encre des chiffres mis en valeur. */
export type FigureInk = 'accent' | 'ink';

/** Angles : ceux de la direction artistique, ou vifs quoi qu'elle dise. */
export type CornerTone = 'style' | 'square';

/**
 * Échelle du titre de section.
 *
 * Le titre composé en très grand sur quatre lignes était le trait commun le plus
 * visible de toutes les pages, quelle que soit la famille : c'est l'humeur
 * typographique qui décidait seule de sa taille. Un rapport, un cahier des
 * charges ou un grand livre titrent pourtant bas — c'est le contenu qui y mène.
 */
export type TitleScale =
  /** L'humeur typographique décide (titre monumental possible). */
  | 'mood'
  /** Plafonné au degré `2xl`. */
  | 'moderate'
  /** Plafonné au degré `xl` : le titre annonce, il ne s'impose pas. */
  | 'discreet';

/** Composition du chapô sous le titre — il était gris, au même corps, partout. */
export type LedeTreatment =
  | 'muted'
  /** Grand, en police de titrage, à l'encre. */
  | 'large'
  /** Italique de titrage. */
  | 'italic'
  /** Sur un liseré d'accent. */
  | 'ruled'
  /** Petites capitales espacées. */
  | 'caps';

/** Dessin des chiffres mis en valeur — ils sortaient tous en titrage gras. */
export type FigureFace =
  /** Police de titrage, graisse forte. */
  | 'display'
  /** Police de texte, graisse légère. */
  | 'light'
  /** Italique de titrage. */
  | 'italic'
  /** Police de texte, demi-graisse. */
  | 'medium';

/** Encre des graphiques — ils étaient identiques dans toutes les familles. */
export type ChartInk =
  /** Couleurs de la charte, séries contrastées. */
  | 'palette'
  /** Nuances de la seule couleur primaire. */
  | 'monochrome'
  /** La première série en accent, les autres en gris. */
  | 'focus'
  /** Barres tracées au trait. */
  | 'outline';

/** Écart entre deux blocs d'un document paginé. */
export type Rhythm = 'standard' | 'airy' | 'tight';

/** Bord de page : ce qui signe la page avant tout contenu. */
export type EdgeTreatment =
  | 'none'
  /** Barre de couleur en haut de chaque page. */
  | 'top-bar'
  /** Barre de couleur le long du bord gauche. */
  | 'side-bar'
  /** Filet de cadre fin tout autour. */
  | 'frame';

export interface LayoutFamily {
  id: string;
  /** Nom affiché, en français. */
  name: string;
  /** Ce qui la distingue, en une phrase (documentation, journaux). */
  description: string;
  /**
   * La même chose, en anglais et en consignes : c'est ce qui part dans les
   * prompts des pages encore composées par un modèle (la couverture), pour
   * qu'elles parlent la grammaire du reste du document.
   */
  brief: string;
  /** Styles de direction artistique auxquels la famille convient. */
  fits: ArtDirectionStyleId[];
  /**
   * Ouvertures de section. Plusieurs : une page d'un document ne s'ouvre pas
   * forcément comme sa voisine, et la graine de page choisit parmi elles.
   */
  headers: HeaderTreatment[];
  folio: FolioTreatment;
  body: BodyTreatment;
  metrics: MetricsTreatment;
  table: TableTreatment;
  cards: CardsTreatment;
  timeline: TimelineTreatment;
  quote: QuoteTreatment;
  assumption: AssumptionTreatment;
  prose: ProseTreatment;
  chart: ChartTreatment;
  label: LabelTone;
  numbering: NumberingStyle;
  rules: RuleTone;
  figures: FigureInk;
  corners: CornerTone;
  titleScale: TitleScale;
  lede: LedeTreatment;
  figureFace: FigureFace;
  chartInk: ChartInk;
  rhythm: Rhythm;
  edge: EdgeTreatment;
  /** Présentation du nuancier de charte : pastilles, gamme continue, pile. */
  swatches: 0 | 1 | 2;
}

type FamilySpec = Omit<LayoutFamily, 'id' | 'name' | 'description' | 'brief' | 'fits'>;

const family = (
  id: string,
  name: string,
  description: string,
  brief: string,
  fits: ArtDirectionStyleId[],
  spec: FamilySpec
): LayoutFamily => ({ id, name, description, brief, fits, ...spec });

// ─────────────────────────────────────────────────────────────────────────────
// Le catalogue.
//
// L'ÉCART entre deux familles est vérifié, pas supposé : `check:uniqueness`
// échoue si deux familles partagent trop de dimensions. Ajouter une famille qui
// ressemble à une autre n'ajoute pas de variété, cela ajoute un doublon.
// ─────────────────────────────────────────────────────────────────────────────

export const LAYOUT_FAMILIES: LayoutFamily[] = [
  family(
    'revue',
    'Revue',
    'Magazine culturel : petites capitales, lettrine, colonnes de chiffres séparées de filets.',
    'Cultural magazine: small-caps labels, a drop cap on the first paragraph, figures in rule-divided columns, booktabs tables, roman numerals.',
    ['editorial', 'victorian', 'surreal', 'collage-art', 'bohemian', 'handwritten'],
    {
      headers: ['underscored', 'lede-led'], folio: 'centered', body: 'full',
      metrics: 'divided', table: 'booktabs', cards: 'ruled-columns', timeline: 'date-column',
      quote: 'split', assumption: 'margin', prose: 'drop-cap', chart: 'headline',
      label: 'small-caps', numbering: 'roman', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'mood', swatches: 0,
      lede: 'italic', figureFace: 'display', chartInk: 'palette', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'rapport-annuel',
    'Rapport annuel',
    'Institutionnel : blocs indexés en marge, registre de chiffres, tableaux quadrillés.',
    'Annual report: every block indexed in a margin column (2.1, 2.2), figures as a ledger, fully gridded tables, a heavy ink bar in the footer.',
    ['swiss', 'minimalism', 'editorial', 'futuristic', 'glassmorphism', 'victorian'],
    {
      headers: ['hanging-number'], folio: 'heavy-bar', body: 'indexed',
      metrics: 'ledger', table: 'gridded', cards: 'definitions', timeline: 'leaders',
      quote: 'panel', assumption: 'boxed', prose: 'plain', chart: 'side-note',
      label: 'bold', numbering: 'dotted', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 2,
      lede: 'muted', figureFace: 'medium', chartInk: 'monochrome', rhythm: 'tight', edge: 'top-bar',
    }
  ),
  family(
    'affiche',
    'Affiche',
    'Prise de parole : aplats saignants, bande de chiffres, encarts en négatif.',
    'Poster: full-bleed colour bands, figures on a solid band, inverted call-outs, big dates, heavy rules.',
    ['maximalism', 'pop-art', 'graffiti', 'y2k', 'collage-art', 'retro', 'cyberpunk'],
    {
      headers: ['bleed-band', 'opener'], folio: 'index-right', body: 'full',
      metrics: 'band', table: 'inverted-head', cards: 'inverted-lead', timeline: 'big-dates',
      quote: 'inverted', assumption: 'edge', prose: 'essay', chart: 'bare',
      label: 'caps', numbering: 'padded', rules: 'heavy', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 1,
      lede: 'large', figureFace: 'display', chartInk: 'focus', rhythm: 'standard', edge: 'none',
    }
  ),
  family(
    'grille-modulaire',
    'Grille modulaire',
    'Suisse : colonne décalée, ligne d’index numérotée qui part du bord, filets épais, étapes horizontales.',
    'Modular grid: an offset text column, a numbered index rule above each title, heavy rules, horizontal steps, numbered lists.',
    ['swiss', 'minimalism', 'futuristic', 'pixel-art', 'cyberpunk', 'editorial'],
    {
      headers: ['numbered-rule'], folio: 'mark-only', body: 'offset',
      metrics: 'stacked-rows', table: 'accent-head', cards: 'numbered', timeline: 'steps',
      quote: 'caps', assumption: 'inline', prose: 'plain', chart: 'keyline',
      label: 'caps', numbering: 'padded', rules: 'heavy', figures: 'ink', corners: 'square', titleScale: 'mood', swatches: 2,
      lede: 'caps', figureFace: 'medium', chartInk: 'monochrome', rhythm: 'standard', edge: 'side-bar',
    }
  ),
  family(
    'carnet',
    'Carnet de terrain',
    'Notes d’atelier : italique, mesure étroite, filets pointillés, alinéas en retrait.',
    'Field notebook: italic labels, a narrow book measure, dotted rules, indented paragraphs, a rail timeline.',
    ['handwritten', 'bohemian', 'clay', 'retro', 'surreal', 'vector-art'],
    {
      headers: ['margin-kicker'], folio: 'tinted-strip', body: 'narrow',
      metrics: 'label-first', table: 'airy', cards: 'edge-stack', timeline: 'rail',
      quote: 'hanging', assumption: 'edge', prose: 'indented', chart: 'bare',
      label: 'italic', numbering: 'plain', rules: 'dotted', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'italic', figureFace: 'italic', chartInk: 'outline', rhythm: 'airy', edge: 'frame',
    }
  ),
  family(
    'atlas',
    'Atlas',
    'Planche d’atlas : en-têtes encadrés, doubles filets, tuiles, tableaux à première colonne.',
    'Atlas plate: framed headers, double rules, figure tiles, tables with an emphasised first column, section signs.',
    ['victorian', 'editorial', 'retro', 'surreal', 'collage-art', 'bohemian'],
    {
      headers: ['boxed'], folio: 'rule-split', body: 'full',
      metrics: 'tiles', table: 'first-column', cards: 'outlined', timeline: 'boxes',
      quote: 'centered', assumption: 'boxed', prose: 'lead-in', chart: 'boxed',
      label: 'small-caps', numbering: 'section', rules: 'double', figures: 'ink', corners: 'square', titleScale: 'moderate', swatches: 2,
      lede: 'ruled', figureFace: 'display', chartInk: 'monochrome', rhythm: 'standard', edge: 'frame',
    }
  ),
  family(
    'tableau-de-bord',
    'Tableau de bord',
    'Produit numérique : tuiles, lignes de tableau détachées, cartouches, blocs appariés.',
    'Dashboard: figure tiles, detached table rows, tagged cards, small blocks paired side by side, no rules.',
    ['futuristic', 'glassmorphism', 'aurora', 'cyberpunk', 'pixel-art', 'clay', 'vector-art'],
    {
      headers: ['split-lede'], folio: 'index-right', body: 'paired',
      metrics: 'tiles', table: 'row-cards', cards: 'tagged', timeline: 'steps',
      quote: 'panel', assumption: 'boxed', prose: 'plain', chart: 'boxed',
      label: 'bold', numbering: 'bracketed', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 1,
      lede: 'muted', figureFace: 'medium', chartInk: 'focus', rhythm: 'tight', edge: 'top-bar',
    }
  ),
  family(
    'gazette',
    'Gazette',
    'Journal : manchette, prose en deux colonnes, chiffre héros, doubles filets.',
    'Gazette: newspaper masthead rules, running text in two columns, one hero figure, definition lists, double rules.',
    ['editorial', 'victorian', 'retro', 'graffiti', 'maximalism', 'swiss'],
    {
      headers: ['numbered-rule', 'underscored'], folio: 'rule-split', body: 'full',
      metrics: 'hero-list', table: 'booktabs', cards: 'definitions', timeline: 'leaders',
      quote: 'caps', assumption: 'ruled', prose: 'columns', chart: 'figure-caption',
      label: 'caps', numbering: 'section', rules: 'double', figures: 'ink', corners: 'square', titleScale: 'moderate', swatches: 2,
      lede: 'caps', figureFace: 'display', chartInk: 'palette', rhythm: 'tight', edge: 'none',
    }
  ),
  family(
    'manifeste',
    'Manifeste',
    'Déclaration : ouverture pleine page, chiffre héros, citation monumentale.',
    'Manifesto: chapter-opener headers, an offset column, one hero figure, monumental quotes, bold lead-ins.',
    ['graffiti', 'maximalism', 'pop-art', 'cyberpunk', 'surreal', 'y2k', 'collage-art'],
    {
      headers: ['opener', 'bleed-band'], folio: 'corner-number', body: 'offset',
      metrics: 'hero-list', table: 'inverted-head', cards: 'numbered', timeline: 'big-dates',
      quote: 'display', assumption: 'inline', prose: 'lead-in', chart: 'headline',
      label: 'bold', numbering: 'padded', rules: 'heavy', figures: 'accent', corners: 'square', titleScale: 'mood', swatches: 1,
      lede: 'large', figureFace: 'display', chartInk: 'focus', rhythm: 'airy', edge: 'side-bar',
    }
  ),
  family(
    'monographie',
    'Monographie',
    'Livre d’art : mesure étroite, silence, italique, aucun filet superflu.',
    'Monograph: a narrow centred book measure, italic labels, essay-size running text, almost no rules.',
    ['minimalism', 'editorial', 'victorian', 'handwritten', 'bohemian', 'surreal'],
    {
      headers: ['centered-rule', 'margin-kicker'], folio: 'mark-only', body: 'narrow',
      metrics: 'divided', table: 'first-column', cards: 'definitions', timeline: 'date-column',
      quote: 'centered', assumption: 'inline', prose: 'large-lead', chart: 'bare',
      label: 'italic', numbering: 'plain', rules: 'none', figures: 'ink', corners: 'square', titleScale: 'moderate', swatches: 0,
      lede: 'italic', figureFace: 'light', chartInk: 'monochrome', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'catalogue',
    'Catalogue',
    'Catalogue produit : cartouches, blocs appariés, étiquettes soulignées.',
    'Catalogue: boxed headers, paired blocks, underlined labels, panel cards, box timelines.',
    ['clay', 'vector-art', 'pop-art', 'retro', 'y2k', 'pixel-art', 'bohemian', 'handwritten'],
    {
      headers: ['boxed', 'split-lede'], folio: 'tinted-strip', body: 'paired',
      metrics: 'label-first', table: 'gridded', cards: 'panels', timeline: 'boxes',
      quote: 'hanging', assumption: 'tab', prose: 'lead-in', chart: 'keyline',
      label: 'underlined', numbering: 'bracketed', rules: 'hairline', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'ruled', figureFace: 'medium', chartInk: 'palette', rhythm: 'standard', edge: 'top-bar',
    }
  ),
  family(
    'dossier-technique',
    'Dossier technique',
    'Spécification : numéros en marge, filets pointillés, prose en colonnes.',
    'Technical file: hanging section numbers, an offset column, dotted rules, running text in two columns, outlined cards.',
    ['futuristic', 'swiss', 'pixel-art', 'cyberpunk', 'minimalism', 'glassmorphism'],
    {
      headers: ['hanging-number', 'numbered-rule'], folio: 'index-right', body: 'offset',
      metrics: 'stacked-rows', table: 'accent-head', cards: 'outlined', timeline: 'steps',
      quote: 'hanging', assumption: 'edge', prose: 'columns', chart: 'headline',
      label: 'underlined', numbering: 'bracketed', rules: 'dotted', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 1,
      lede: 'caps', figureFace: 'medium', chartInk: 'outline', rhythm: 'tight', edge: 'side-bar',
    }
  ),
  family(
    'planche',
    'Planche',
    'Composition libre : l’archétype de page mène, lettrage en petites capitales.',
    'Plate: the page archetype leads the composition; small-caps labels, panel cards, big dates, display quotes.',
    ['editorial', 'surreal', 'collage-art', 'aurora', 'glassmorphism', 'victorian'],
    {
      headers: ['archetype'], folio: 'centered', body: 'full',
      metrics: 'ruled-row', table: 'first-column', cards: 'panels', timeline: 'big-dates',
      quote: 'display', assumption: 'ruled', prose: 'lead-in', chart: 'keyline',
      label: 'small-caps', numbering: 'padded', rules: 'hairline', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 1,
      lede: 'large', figureFace: 'italic', chartInk: 'palette', rhythm: 'airy', edge: 'frame',
    }
  ),
  family(
    'programme',
    'Programme',
    'Programme de saison : bande de chiffres, liste numérotée, points de conduite.',
    'Season programme: split title and lede, figures on a band, numbered lists, dotted leaders, indented paragraphs.',
    ['retro', 'bohemian', 'pop-art', 'y2k', 'clay', 'handwritten', 'graffiti'],
    {
      headers: ['split-lede', 'underscored'], folio: 'index-right', body: 'full',
      metrics: 'band', table: 'airy', cards: 'numbered', timeline: 'leaders',
      quote: 'centered', assumption: 'inline', prose: 'indented', chart: 'bare',
      label: 'caps', numbering: 'plain', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'italic', figureFace: 'light', chartInk: 'focus', rhythm: 'standard', edge: 'top-bar',
    }
  ),
  family(
    'fanzine',
    'Fanzine',
    'Autoédition : sur-titres tournés, cartouches, encarts en négatif, lettrine.',
    'Fanzine: rotated margin kickers or bleeding bands, tagged cards, inverted quotes and table heads, dotted rules.',
    ['graffiti', 'collage-art', 'pop-art', 'y2k', 'pixel-art', 'surreal', 'maximalism', 'vector-art'],
    {
      headers: ['margin-kicker', 'bleed-band'], folio: 'heavy-bar', body: 'paired',
      metrics: 'stamped', table: 'inverted-head', cards: 'tagged', timeline: 'boxes',
      quote: 'inverted', assumption: 'edge', prose: 'drop-cap', chart: 'bare',
      label: 'underlined', numbering: 'bracketed', rules: 'dotted', figures: 'accent', corners: 'square', titleScale: 'mood', swatches: 1,
      lede: 'caps', figureFace: 'display', chartInk: 'outline', rhythm: 'tight', edge: 'frame',
    }
  ),
  family(
    'grand-livre',
    'Grand livre',
    'Comptabilité ancienne : registre, doubles filets, chiffres romains, mesure étroite.',
    'Ledger book: a narrow measure, figures as a ledger with dotted leaders, double rules, roman numerals, hanging quotes.',
    ['victorian', 'editorial', 'swiss', 'minimalism', 'retro'],
    {
      headers: ['numbered-rule'], folio: 'centered', body: 'narrow',
      metrics: 'ledger', table: 'booktabs', cards: 'outlined', timeline: 'leaders',
      quote: 'hanging', assumption: 'footnote', prose: 'indented', chart: 'keyline',
      label: 'small-caps', numbering: 'roman', rules: 'double', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 0,
      lede: 'muted', figureFace: 'italic', chartInk: 'monochrome', rhythm: 'standard', edge: 'frame',
    }
  ),
  family(
    'terminal',
    'Terminal',
    'Interface système : numéros entre crochets, blocs indexés, lignes de conduite.',
    'Terminal: bracketed numbers, indexed blocks, stacked figure rows, gridded tables, dotted rules, tagged cards.',
    ['cyberpunk', 'pixel-art', 'futuristic', 'y2k'],
    {
      headers: ['numbered-rule'], folio: 'mark-only', body: 'indexed',
      metrics: 'stacked-rows', table: 'accent-head', cards: 'tagged', timeline: 'steps',
      quote: 'caps', assumption: 'footnote', prose: 'columns', chart: 'bare',
      label: 'underlined', numbering: 'bracketed', rules: 'dotted', figures: 'accent', corners: 'square', titleScale: 'discreet', swatches: 0,
      lede: 'caps', figureFace: 'light', chartInk: 'outline', rhythm: 'tight', edge: 'top-bar',
    }
  ),
  family(
    'brochure',
    'Brochure',
    'Présentation commerciale : titre et chapô en regard, chiffres étiquetés, boîtes d’étapes, corps d’essai.',
    'Brochure: title and lede side by side, label-first figures, airy tables, panel cards, box timelines, generous essay-size text, no rules.',
    ['clay', 'glassmorphism', 'aurora', 'vector-art', 'bohemian'],
    {
      headers: ['split-lede'], folio: 'tinted-strip', body: 'full',
      metrics: 'label-first', table: 'airy', cards: 'monogram', timeline: 'boxes',
      quote: 'display', assumption: 'edge', prose: 'essay', chart: 'headline',
      label: 'italic', numbering: 'plain', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 2,
      lede: 'large', figureFace: 'light', chartInk: 'palette', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'cahier',
    'Cahier',
    'Cahier d’études : blocs indexés, italique, rail de frise, liste à liseré.',
    'Study book: indexed blocks, underscored titles, italic labels, edge-stacked cards, a rail timeline, hairline rules.',
    ['handwritten', 'minimalism', 'editorial', 'clay'],
    {
      headers: ['underscored'], folio: 'rule-split', body: 'indexed',
      metrics: 'divided', table: 'airy', cards: 'edge-stack', timeline: 'rail',
      quote: 'centered', assumption: 'margin', prose: 'plain', chart: 'keyline',
      label: 'italic', numbering: 'dotted', rules: 'hairline', figures: 'ink', corners: 'style', titleScale: 'discreet', swatches: 0,
      lede: 'ruled', figureFace: 'italic', chartInk: 'outline', rhythm: 'standard', edge: 'side-bar',
    }
  ),
  family(
    'almanach',
    'Almanach',
    'Almanach : cadres et doubles filets, registre, grandes dates, lettrine.',
    'Almanac: framed or index-rule headers, figures as a ledger, big dates, a drop cap, double rules, roman numerals.',
    ['victorian', 'retro', 'bohemian', 'handwritten'],
    {
      headers: ['boxed', 'numbered-rule'], folio: 'centered', body: 'paired',
      metrics: 'ledger', table: 'striped-columns', cards: 'definitions', timeline: 'big-dates',
      quote: 'caps', assumption: 'ruled', prose: 'drop-cap', chart: 'boxed',
      label: 'small-caps', numbering: 'roman', rules: 'double', figures: 'accent', corners: 'square', titleScale: 'mood', swatches: 1,
      lede: 'italic', figureFace: 'display', chartInk: 'monochrome', rhythm: 'standard', edge: 'frame',
    }
  ),
  family(
    'signaletique',
    'Signalétique',
    'Système de signalisation : titre souligné qui part du bord, colonne décalée, lignes de chiffres, filets épais, capitales.',
    'Wayfinding system: underscored titles hanging from the page edge, an offset column, stacked figure rows, definition lists, heavy rules, capitals everywhere.',
    ['swiss', 'pop-art', 'vector-art', 'graffiti', 'futuristic', 'maximalism', 'cyberpunk'],
    {
      headers: ['underscored'], folio: 'running-head', body: 'offset',
      metrics: 'stacked-rows', table: 'gridded', cards: 'definitions', timeline: 'leaders',
      quote: 'hanging', assumption: 'boxed', prose: 'columns', chart: 'headline',
      label: 'caps', numbering: 'dotted', rules: 'heavy', figures: 'ink', corners: 'square', titleScale: 'mood', swatches: 0,
      lede: 'caps', figureFace: 'medium', chartInk: 'focus', rhythm: 'standard', edge: 'top-bar',
    }
  ),
  family(
    'lettre',
    'Lettre',
    'Correspondance : titre centré, mesure étroite, alinéas, citation monumentale.',
    'Letter: centred headers, a narrow measure, indented paragraphs, numbered lists, a display quote, italic labels.',
    ['minimalism', 'handwritten', 'editorial', 'surreal', 'bohemian', 'aurora'],
    {
      headers: ['centered-rule'], folio: 'centered', body: 'narrow',
      metrics: 'label-first', table: 'airy', cards: 'numbered', timeline: 'rail',
      quote: 'display', assumption: 'inline', prose: 'indented', chart: 'headline',
      label: 'italic', numbering: 'section', rules: 'hairline', figures: 'ink', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'italic', figureFace: 'light', chartInk: 'palette', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'vitrine',
    'Vitrine',
    'Lancement produit : chiffre héros, carte phare en négatif, lignes détachées.',
    'Showcase: split or framed headers, one hero figure, an inverted lead card, detached table rows, no rules.',
    ['glassmorphism', 'aurora', 'y2k', 'clay', 'pop-art', 'maximalism'],
    {
      headers: ['lede-led', 'boxed'], folio: 'mark-only', body: 'full',
      metrics: 'hero-list', table: 'row-cards', cards: 'inverted-lead', timeline: 'boxes',
      quote: 'inverted', assumption: 'boxed', prose: 'lead-in', chart: 'boxed',
      label: 'underlined', numbering: 'padded', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 1,
      lede: 'large', figureFace: 'light', chartInk: 'focus', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'epure',
    'Épure',
    'Épure d’architecte : sur-titres tournés, colonne décalée, tout en filets fins.',
    'Blueprint: rotated margin kickers, an offset column, rule-divided figures and columns, airy tables, hairlines only.',
    ['minimalism', 'swiss', 'futuristic', 'glassmorphism', 'aurora', 'cyberpunk'],
    {
      headers: ['margin-kicker', 'underscored'], folio: 'mark-only', body: 'offset',
      metrics: 'divided', table: 'airy', cards: 'ruled-columns', timeline: 'leaders',
      quote: 'brackets', assumption: 'margin', prose: 'plain', chart: 'bare',
      label: 'caps', numbering: 'plain', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 2,
      lede: 'muted', figureFace: 'light', chartInk: 'outline', rhythm: 'airy', edge: 'frame',
    }
  ),
  family(
    'fresque',
    'Fresque',
    'Récit visuel : ouvertures de chapitre, bande de chiffres, lettrine, grandes dates.',
    'Fresco: chapter-opener headers, paired blocks, figures on a band, an inverted lead card, big dates, a drop cap.',
    ['surreal', 'collage-art', 'maximalism', 'bohemian', 'aurora', 'handwritten'],
    {
      headers: ['opener'], folio: 'centered', body: 'paired',
      metrics: 'band', table: 'first-column', cards: 'inverted-lead', timeline: 'spine',
      quote: 'display', assumption: 'edge', prose: 'drop-cap', chart: 'headline',
      label: 'small-caps', numbering: 'section', rules: 'heavy', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 0,
      lede: 'large', figureFace: 'italic', chartInk: 'palette', rhythm: 'airy', edge: 'side-bar',
    }
  ),
  family(
    'releve',
    'Relevé',
    'Relevé de mesures : blocs indexés, chiffre héros, lignes détachées, prose en colonnes.',
    'Statement: indexed blocks, one hero figure, detached table rows, outlined cards, running text in two columns.',
    ['futuristic', 'glassmorphism', 'cyberpunk', 'clay', 'pixel-art'],
    {
      headers: ['numbered-rule'], folio: 'running-head', body: 'indexed',
      metrics: 'hero-list', table: 'row-cards', cards: 'outlined', timeline: 'date-column',
      quote: 'panel', assumption: 'ruled', prose: 'columns', chart: 'keyline',
      label: 'bold', numbering: 'dotted', rules: 'dotted', figures: 'accent', corners: 'style', titleScale: 'discreet', swatches: 2,
      lede: 'muted', figureFace: 'medium', chartInk: 'monochrome', rhythm: 'tight', edge: 'side-bar',
    }
  ),
  family(
    'cartel',
    'Cartel',
    'Cartel de musée : en-têtes encadrés, tuiles, tableaux en négatif, filets épais.',
    'Museum label: framed headers, a narrow measure, figure tiles, inverted table heads, definition lists, heavy rules.',
    ['victorian', 'swiss', 'graffiti', 'retro'],
    {
      headers: ['boxed'], folio: 'heavy-bar', body: 'narrow',
      metrics: 'tiles', table: 'framed', cards: 'definitions', timeline: 'steps',
      quote: 'hanging', assumption: 'boxed', prose: 'essay', chart: 'boxed',
      label: 'caps', numbering: 'roman', rules: 'heavy', figures: 'ink', corners: 'square', titleScale: 'mood', swatches: 1,
      lede: 'ruled', figureFace: 'display', chartInk: 'outline', rhythm: 'standard', edge: 'frame',
    }
  ),
  family(
    'partition',
    'Partition',
    'Partition : colonne décalée, doubles filets, liseré, grandes dates.',
    'Score: an offset column, underscored or opener headers, label-first figures, booktabs tables, edge-stacked cards, double rules.',
    ['editorial', 'maximalism', 'collage-art', 'y2k', 'graffiti'],
    {
      headers: ['underscored', 'opener'], folio: 'rule-split', body: 'offset',
      metrics: 'label-first', table: 'booktabs', cards: 'edge-stack', timeline: 'big-dates',
      quote: 'caps', assumption: 'margin', prose: 'lead-in', chart: 'bare',
      label: 'bold', numbering: 'section', rules: 'double', figures: 'accent', corners: 'square', titleScale: 'mood', swatches: 0,
      lede: 'caps', figureFace: 'italic', chartInk: 'focus', rhythm: 'standard', edge: 'side-bar',
    }
  ),
  family(
    'herbier',
    'Herbier',
    'Herbier : planches centrées, registre de chiffres, liste en chiffres romains, pointillés, lettrine.',
    'Herbarium: centred headers, figures as a ledger, gridded tables, lists numbered in roman numerals, italic labels, dotted rules, a drop cap.',
    ['bohemian', 'handwritten', 'victorian', 'clay', 'retro'],
    {
      headers: ['centered-rule'], folio: 'tinted-strip', body: 'full',
      metrics: 'ledger', table: 'gridded', cards: 'numbered', timeline: 'rail',
      quote: 'hanging', assumption: 'inline', prose: 'drop-cap', chart: 'keyline',
      label: 'italic', numbering: 'roman', rules: 'dotted', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 2,
      lede: 'italic', figureFace: 'italic', chartInk: 'monochrome', rhythm: 'airy', edge: 'frame',
    }
  ),
  family(
    'console',
    'Console',
    'Console : archétype ou titre partagé, blocs indexés, tuiles, filets épais.',
    'Console: archetype or split headers, indexed blocks, figure tiles, accent-headed tables, numbered lists, inverted quotes.',
    ['cyberpunk', 'pixel-art', 'futuristic', 'y2k', 'aurora'],
    {
      headers: ['archetype', 'split-lede'], folio: 'index-right', body: 'indexed',
      metrics: 'tiles', table: 'accent-head', cards: 'numbered', timeline: 'numbered-circles',
      quote: 'inverted', assumption: 'edge', prose: 'plain', chart: 'headline',
      label: 'underlined', numbering: 'bracketed', rules: 'heavy', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'caps', figureFace: 'medium', chartInk: 'focus', rhythm: 'tight', edge: 'frame',
    }
  ),
  family(
    'prospectus',
    'Prospectus',
    'Prospectus : titre et chapô en regard, chiffre héros, cartouches, blocs appariés.',
    'Flyer: title and lede side by side, paired blocks, one hero figure, banded tables, tagged cards, bold lead-ins.',
    ['pop-art', 'vector-art', 'clay', 'retro', 'y2k', 'maximalism'],
    {
      headers: ['split-lede'], folio: 'centered', body: 'paired',
      metrics: 'hero-list', table: 'banded', cards: 'tagged', timeline: 'steps',
      quote: 'display', assumption: 'boxed', prose: 'lead-in', chart: 'bare',
      label: 'caps', numbering: 'plain', rules: 'hairline', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 2,
      lede: 'large', figureFace: 'display', chartInk: 'palette', rhythm: 'standard', edge: 'top-bar',
    }
  ),
  family(
    'colonnes',
    'Colonnes',
    'Recueil : manchette centrée, prose en colonnes, rangée de chiffres, pointillés.',
    'Collection: centred headers, running text in two columns, a ruled row of figures, dotted leaders, small caps.',
    ['editorial', 'swiss', 'victorian', 'minimalism'],
    {
      headers: ['centered-rule', 'hanging-number'], folio: 'mark-only', body: 'full',
      metrics: 'ruled-row', table: 'airy', cards: 'outlined', timeline: 'leaders',
      quote: 'display', assumption: 'boxed', prose: 'columns', chart: 'bare',
      label: 'small-caps', numbering: 'padded', rules: 'dotted', figures: 'accent', corners: 'square', titleScale: 'moderate', swatches: 1,
      lede: 'ruled', figureFace: 'light', chartInk: 'monochrome', rhythm: 'tight', edge: 'none',
    }
  ),
  family(
    'frise',
    'Frise',
    'Chronique : ouvertures hautes, colonne décalée, lignes de chiffres, grandes dates.',
    'Chronicle: opener or hanging-number headers, an offset column, stacked figure rows, banded tables, big dates, italic labels.',
    ['vector-art', 'clay', 'surreal', 'collage-art', 'aurora'],
    {
      headers: ['opener', 'hanging-number'], folio: 'rule-split', body: 'offset',
      metrics: 'stacked-rows', table: 'banded', cards: 'panels', timeline: 'big-dates',
      quote: 'hanging', assumption: 'edge', prose: 'plain', chart: 'boxed',
      label: 'italic', numbering: 'padded', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 0,
      lede: 'ruled', figureFace: 'light', chartInk: 'focus', rhythm: 'airy', edge: 'side-bar',
    }
  ),
  family(
    'cahier-des-charges',
    'Cahier des charges',
    'Document contractuel : numéros en marge, cadres, registre, alinéas.',
    'Specification: hanging-number or framed headers, a narrow measure, figures as a ledger, gridded tables, outlined cards, box timelines.',
    ['swiss', 'minimalism', 'editorial', 'pixel-art', 'futuristic'],
    {
      headers: ['hanging-number', 'boxed'], folio: 'rule-split', body: 'narrow',
      metrics: 'ledger', table: 'gridded', cards: 'outlined', timeline: 'boxes',
      quote: 'caps', assumption: 'margin', prose: 'indented', chart: 'figure-caption',
      label: 'underlined', numbering: 'dotted', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 1,
      lede: 'muted', figureFace: 'medium', chartInk: 'outline', rhythm: 'tight', edge: 'none',
    }
  ),
  family(
    'bulletin',
    'Bulletin',
    'Lettre d’information : titre souligné, blocs appariés, doubles filets, liseré.',
    'Newsletter: underscored or centred headers, paired blocks, a ruled row of figures, accent-headed tables, edge-stacked cards, double rules.',
    ['retro', 'pop-art', 'editorial', 'graffiti', 'bohemian', 'vector-art'],
    {
      headers: ['underscored', 'centered-rule'], folio: 'index-right', body: 'paired',
      metrics: 'ruled-row', table: 'accent-head', cards: 'edge-stack', timeline: 'rail',
      quote: 'display', assumption: 'ruled', prose: 'lead-in', chart: 'bare',
      label: 'bold', numbering: 'roman', rules: 'double', figures: 'ink', corners: 'style', titleScale: 'moderate', swatches: 2,
      lede: 'ruled', figureFace: 'display', chartInk: 'palette', rhythm: 'standard', edge: 'top-bar',
    }
  ),
  family(
    'relief',
    'Relief',
    'Matière : archétype de page, bande de chiffres, lignes détachées, carte phare en négatif.',
    'Relief: the page archetype leads, figures on a band, detached table rows, an inverted lead card, inverted quotes, italic labels.',
    ['clay', 'glassmorphism', 'aurora', 'vector-art', 'y2k', 'surreal'],
    {
      headers: ['archetype'], folio: 'tinted-strip', body: 'paired',
      metrics: 'band', table: 'banded', cards: 'tagged', timeline: 'steps',
      quote: 'highlight', assumption: 'edge', prose: 'essay', chart: 'headline',
      label: 'bold', numbering: 'plain', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 0,
      lede: 'large', figureFace: 'light', chartInk: 'outline', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'journal-de-bord',
    'Journal de bord',
    'Carnet de voyage d’entreprise : onglet de sur-titre, titre courant, bandes alternées, épine de frise.',
    'Logbook: a ribbon tab above each title, a running head on every page, alternating full-width bands, a central-spine timeline, footnote assumptions.',
    ['handwritten', 'bohemian', 'retro', 'collage-art', 'surreal'],
    {
      headers: ['ribbon'], folio: 'running-head', body: 'full',
      metrics: 'label-first', table: 'striped-columns', cards: 'stacked-bands', timeline: 'spine',
      quote: 'hanging', assumption: 'footnote', prose: 'plain', chart: 'figure-caption',
      label: 'italic', numbering: 'plain', rules: 'dotted', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'italic', figureFace: 'italic', chartInk: 'focus', rhythm: 'standard', edge: 'none',
    }
  ),
  family(
    'planisphere',
    'Planisphère',
    'Cartographie : titres entre doubles filets, chiffres en escalier, tableaux transposés, chevrons, cadre fin.',
    'Planisphere: titles between double rules, staircase figures, transposed tables, chevron timelines, corner brackets on quotes, a thin page frame.',
    ['victorian', 'editorial', 'surreal', 'vector-art', 'glassmorphism'],
    {
      headers: ['double-rule'], folio: 'corner-number', body: 'narrow',
      metrics: 'staircase', table: 'transposed', cards: 'corner-number', timeline: 'chevrons',
      quote: 'brackets', assumption: 'tab', prose: 'lead-in', chart: 'side-note',
      label: 'small-caps', numbering: 'roman', rules: 'double', figures: 'ink', corners: 'square', titleScale: 'mood', swatches: 2,
      lede: 'ruled', figureFace: 'light', chartInk: 'monochrome', rhythm: 'airy', edge: 'frame',
    }
  ),
  family(
    'magazine-mode',
    'Magazine de mode',
    'Presse de mode : hiérarchie inversée, chiffres en phrase, cartes décalées, texte surligné.',
    'Fashion magazine: inverted hierarchy (small title, large statement), figures written as a sentence, staggered cards, highlighted quotes, light figures, no rules.',
    ['minimalism', 'editorial', 'maximalism', 'y2k', 'surreal', 'glassmorphism'],
    {
      headers: ['lede-led'], folio: 'mark-only', body: 'offset',
      metrics: 'inline-sentence', table: 'airy', cards: 'staggered', timeline: 'leaders',
      quote: 'highlight', assumption: 'inline', prose: 'large-lead', chart: 'bare',
      label: 'caps', numbering: 'plain', rules: 'none', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 1,
      lede: 'large', figureFace: 'light', chartInk: 'monochrome', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'annuaire',
    'Annuaire',
    'Répertoire : titre courant, blocs indexés, colonnes teintées, initiales en lettrines.',
    'Directory: a running head, indexed blocks, figures as a ledger, striped table columns, monogram cards, numbered-circle timelines, a top colour bar.',
    ['swiss', 'pixel-art', 'futuristic', 'clay', 'vector-art'],
    {
      headers: ['numbered-rule', 'ribbon'], folio: 'running-head', body: 'indexed',
      metrics: 'ledger', table: 'striped-columns', cards: 'monogram', timeline: 'numbered-circles',
      quote: 'caps', assumption: 'tab', prose: 'plain', chart: 'figure-caption',
      label: 'bold', numbering: 'padded', rules: 'hairline', figures: 'ink', corners: 'style', titleScale: 'discreet', swatches: 0,
      lede: 'caps', figureFace: 'medium', chartInk: 'palette', rhythm: 'tight', edge: 'top-bar',
    }
  ),
  family(
    'catalogue-raisonne',
    'Catalogue raisonné',
    'Catalogue d’œuvres : doubles filets, tableaux encadrés, numéros d’angle, paragraphes filetés.',
    'Catalogue raisonné: centred titles between double rules, framed tables, corner-numbered boxes, split quotes, rule-separated paragraphs, italic figures.',
    ['victorian', 'editorial', 'minimalism', 'collage-art', 'surreal'],
    {
      headers: ['double-rule'], folio: 'centered', body: 'full',
      metrics: 'divided', table: 'framed', cards: 'corner-number', timeline: 'date-column',
      quote: 'split', assumption: 'margin', prose: 'rule-separated', chart: 'figure-caption',
      label: 'small-caps', numbering: 'section', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'moderate', swatches: 2,
      lede: 'italic', figureFace: 'italic', chartInk: 'monochrome', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'rapport-impact',
    'Rapport d’impact',
    'Rapport extra-financier : onglets, chiffres en cartouches, bandes, graphique annoté en marge.',
    'Impact report: ribbon or split headers, stamped figures, detached table rows, alternating bands, a spine timeline, charts with a side note, a side colour bar.',
    ['clay', 'vector-art', 'glassmorphism', 'aurora', 'bohemian'],
    {
      headers: ['ribbon', 'split-lede'], folio: 'index-right', body: 'full',
      metrics: 'stamped', table: 'row-cards', cards: 'stacked-bands', timeline: 'spine',
      quote: 'split', assumption: 'tab', prose: 'large-lead', chart: 'side-note',
      label: 'bold', numbering: 'padded', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 1,
      lede: 'ruled', figureFace: 'medium', chartInk: 'focus', rhythm: 'standard', edge: 'side-bar',
    }
  ),
  family(
    'storyboard',
    'Storyboard',
    'Planche de story-board : cadre, cartouches, initiales, chevrons, blocs appariés.',
    'Storyboard: a page frame, stamped figures, monogram cards, chevron timelines, bracketed quotes, paired blocks, outline charts, heavy rules.',
    ['pop-art', 'graffiti', 'collage-art', 'pixel-art', 'y2k', 'maximalism'],
    {
      headers: ['hanging-number'], folio: 'corner-number', body: 'paired',
      metrics: 'stamped', table: 'gridded', cards: 'monogram', timeline: 'chevrons',
      quote: 'brackets', assumption: 'boxed', prose: 'plain', chart: 'figure-caption',
      label: 'caps', numbering: 'bracketed', rules: 'heavy', figures: 'accent', corners: 'square', titleScale: 'mood', swatches: 1,
      lede: 'caps', figureFace: 'display', chartInk: 'outline', rhythm: 'tight', edge: 'frame',
    }
  ),
  family(
    'mode-emploi',
    'Mode d’emploi',
    'Notice illustrée : onglets, mesure étroite, étapes numérotées, tableaux encadrés, notes.',
    'How-to guide: ribbon headers, a narrow measure, numbered lists, numbered-circle steps, framed tables, footnotes, rule-separated paragraphs, a top colour bar.',
    ['clay', 'vector-art', 'pixel-art', 'retro', 'swiss'],
    {
      headers: ['ribbon'], folio: 'heavy-bar', body: 'narrow',
      metrics: 'label-first', table: 'framed', cards: 'numbered', timeline: 'numbered-circles',
      quote: 'panel', assumption: 'footnote', prose: 'rule-separated', chart: 'keyline',
      label: 'underlined', numbering: 'plain', rules: 'heavy', figures: 'ink', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'muted', figureFace: 'medium', chartInk: 'palette', rhythm: 'standard', edge: 'top-bar',
    }
  ),
  family(
    'livre-blanc',
    'Livre blanc',
    'Étude de fond : hiérarchie inversée, titre courant, chiffres en phrase, tableaux transposés.',
    'White paper: inverted-hierarchy headers, a running head, a narrow measure, figures as a sentence, transposed tables, numbered figure captions.',
    ['minimalism', 'swiss', 'editorial', 'futuristic', 'glassmorphism'],
    {
      headers: ['lede-led', 'numbered-rule'], folio: 'running-head', body: 'narrow',
      metrics: 'inline-sentence', table: 'transposed', cards: 'definitions', timeline: 'date-column',
      quote: 'highlight', assumption: 'footnote', prose: 'large-lead', chart: 'figure-caption',
      label: 'small-caps', numbering: 'dotted', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 2,
      lede: 'large', figureFace: 'light', chartInk: 'monochrome', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'dossier-de-presse',
    'Dossier de presse',
    'Communiqué : aplat ou énoncé en grand, cartouches, cartes décalées, citation d’auteur.',
    'Press kit: bleeding band or statement headers, stamped figures, staggered cards, split quotes with the speaker large, corner page numbers.',
    ['maximalism', 'pop-art', 'graffiti', 'editorial', 'y2k'],
    {
      headers: ['bleed-band', 'lede-led'], folio: 'corner-number', body: 'full',
      metrics: 'stamped', table: 'booktabs', cards: 'staggered', timeline: 'big-dates',
      quote: 'split', assumption: 'inline', prose: 'lead-in', chart: 'side-note',
      label: 'caps', numbering: 'padded', rules: 'heavy', figures: 'accent', corners: 'square', titleScale: 'mood', swatches: 1,
      lede: 'large', figureFace: 'display', chartInk: 'focus', rhythm: 'standard', edge: 'none',
    }
  ),
  family(
    'carte-routiere',
    'Carte routière',
    'Itinéraire : chiffres en escalier, colonnes teintées, chevrons, barre latérale.',
    'Road map: double-rule headers, paired blocks, staircase figures, striped table columns, chevron timelines, a side colour bar.',
    ['vector-art', 'retro', 'pop-art', 'graffiti', 'cyberpunk'],
    {
      headers: ['double-rule'], folio: 'index-right', body: 'paired',
      metrics: 'staircase', table: 'striped-columns', cards: 'corner-number', timeline: 'chevrons',
      quote: 'caps', assumption: 'edge', prose: 'plain', chart: 'bare',
      label: 'bold', numbering: 'bracketed', rules: 'dotted', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'caps', figureFace: 'medium', chartInk: 'outline', rhythm: 'standard', edge: 'side-bar',
    }
  ),
  family(
    'manuel',
    'Manuel',
    'Manuel scolaire : onglets ou cadres, initiales, étapes numérotées, surligné, cadre de page.',
    'Textbook: ribbon or boxed headers, paired blocks, monogram cards, numbered-circle steps, highlighted quotes, tab assumptions, a page frame.',
    ['clay', 'handwritten', 'retro', 'bohemian', 'pixel-art'],
    {
      headers: ['ribbon', 'boxed'], folio: 'tinted-strip', body: 'paired',
      metrics: 'tiles', table: 'framed', cards: 'monogram', timeline: 'numbered-circles',
      quote: 'highlight', assumption: 'tab', prose: 'indented', chart: 'boxed',
      label: 'underlined', numbering: 'section', rules: 'hairline', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 2,
      lede: 'ruled', figureFace: 'italic', chartInk: 'palette', rhythm: 'standard', edge: 'frame',
    }
  ),
  family(
    'carton',
    'Carton d’invitation',
    'Faire-part : doubles filets centrés, mesure étroite, cartouches, équerres, cadre.',
    'Invitation card: centred titles between double rules, a narrow measure, stamped figures, bracketed quotes, rule-separated paragraphs, a page frame.',
    ['victorian', 'minimalism', 'handwritten', 'surreal', 'aurora'],
    {
      headers: ['double-rule', 'centered-rule'], folio: 'centered', body: 'narrow',
      metrics: 'stamped', table: 'airy', cards: 'corner-number', timeline: 'leaders',
      quote: 'brackets', assumption: 'inline', prose: 'rule-separated', chart: 'bare',
      label: 'small-caps', numbering: 'roman', rules: 'double', figures: 'ink', corners: 'square', titleScale: 'moderate', swatches: 1,
      lede: 'italic', figureFace: 'light', chartInk: 'monochrome', rhythm: 'airy', edge: 'frame',
    }
  ),
  family(
    'salle-de-controle',
    'Salle de contrôle',
    'Supervision : titre courant, blocs indexés, cartouches, étapes numérotées, graphique annoté.',
    'Control room: a running head, indexed blocks, stamped figures, framed tables, numbered-circle steps, charts with a side note, a top colour bar.',
    ['cyberpunk', 'futuristic', 'pixel-art', 'aurora', 'glassmorphism'],
    {
      headers: ['hanging-number', 'ribbon'], folio: 'running-head', body: 'indexed',
      metrics: 'stamped', table: 'framed', cards: 'tagged', timeline: 'numbered-circles',
      quote: 'inverted', assumption: 'footnote', prose: 'plain', chart: 'side-note',
      label: 'bold', numbering: 'bracketed', rules: 'dotted', figures: 'accent', corners: 'square', titleScale: 'discreet', swatches: 0,
      lede: 'caps', figureFace: 'medium', chartInk: 'outline', rhythm: 'tight', edge: 'top-bar',
    }
  ),
  family(
    'chronique',
    'Chronique',
    'Chronique : énoncé en grand, chiffres en phrase, cartes décalées, épine de frise, surligné.',
    'Chronicle: statement or underscored headers, figures as a sentence, staggered cards, a spine timeline, highlighted quotes, corner page numbers.',
    ['editorial', 'surreal', 'bohemian', 'collage-art', 'handwritten'],
    {
      headers: ['lede-led', 'underscored'], folio: 'corner-number', body: 'full',
      metrics: 'inline-sentence', table: 'booktabs', cards: 'staggered', timeline: 'spine',
      quote: 'highlight', assumption: 'margin', prose: 'large-lead', chart: 'figure-caption',
      label: 'italic', numbering: 'plain', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'mood', swatches: 0,
      lede: 'italic', figureFace: 'italic', chartInk: 'focus', rhythm: 'airy', edge: 'none',
    }
  ),
  family(
    'panneau-expo',
    'Panneau d’exposition',
    'Cimaise : énoncé en grand, colonne décalée, escalier de chiffres, bandes, chevrons.',
    'Exhibition panel: statement or band headers, an offset column, staircase figures, alternating bands, chevron timelines, split quotes, a side colour bar.',
    ['collage-art', 'surreal', 'maximalism', 'aurora', 'graffiti', 'pop-art'],
    {
      headers: ['lede-led', 'bleed-band'], folio: 'mark-only', body: 'offset',
      metrics: 'staircase', table: 'first-column', cards: 'stacked-bands', timeline: 'chevrons',
      quote: 'split', assumption: 'tab', prose: 'lead-in', chart: 'side-note',
      label: 'caps', numbering: 'section', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 2,
      lede: 'large', figureFace: 'display', chartInk: 'palette', rhythm: 'airy', edge: 'side-bar',
    }
  ),
  family(
    'fiche-produit',
    'Fiche produit',
    'Fiche technique commerciale : onglet, cartouches, colonnes teintées, initiales, barre haute.',
    'Product sheet: a ribbon tab, stamped figures, striped table columns, monogram cards, box timelines, tab assumptions, a top colour bar.',
    ['glassmorphism', 'clay', 'y2k', 'vector-art', 'pixel-art', 'futuristic'],
    {
      headers: ['ribbon'], folio: 'tinted-strip', body: 'full',
      metrics: 'stamped', table: 'striped-columns', cards: 'monogram', timeline: 'boxes',
      quote: 'panel', assumption: 'tab', prose: 'plain', chart: 'boxed',
      label: 'bold', numbering: 'bracketed', rules: 'none', figures: 'accent', corners: 'style', titleScale: 'discreet', swatches: 1,
      lede: 'ruled', figureFace: 'medium', chartInk: 'focus', rhythm: 'tight', edge: 'top-bar',
    }
  ),
  family(
    'portfolio',
    'Portfolio',
    'Book de créatif : énoncé en grand, mesure étroite, chiffres en phrase, équerres, cadre.',
    'Portfolio: statement or margin-kicker headers, a narrow measure, figures as a sentence, staggered cards, bracketed quotes, light figures, a page frame.',
    ['minimalism', 'surreal', 'y2k', 'aurora', 'glassmorphism', 'maximalism'],
    {
      headers: ['lede-led', 'margin-kicker'], folio: 'mark-only', body: 'narrow',
      metrics: 'inline-sentence', table: 'airy', cards: 'staggered', timeline: 'big-dates',
      quote: 'brackets', assumption: 'footnote', prose: 'rule-separated', chart: 'bare',
      label: 'underlined', numbering: 'padded', rules: 'none', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 2,
      lede: 'large', figureFace: 'light', chartInk: 'outline', rhythm: 'airy', edge: 'frame',
    }
  ),
  family(
    'notice',
    'Notice technique',
    'Notice : titre courant, blocs indexés, tableaux transposés, étapes numérotées, notes.',
    'Technical notice: a running head, indexed blocks, figures as a ledger, transposed tables, numbered-circle steps, footnotes, numbered figure captions.',
    ['swiss', 'pixel-art', 'cyberpunk', 'futuristic', 'minimalism'],
    {
      headers: ['numbered-rule'], folio: 'running-head', body: 'indexed',
      metrics: 'ledger', table: 'transposed', cards: 'definitions', timeline: 'numbered-circles',
      quote: 'caps', assumption: 'footnote', prose: 'rule-separated', chart: 'figure-caption',
      label: 'underlined', numbering: 'dotted', rules: 'heavy', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 0,
      lede: 'caps', figureFace: 'medium', chartInk: 'monochrome', rhythm: 'tight', edge: 'side-bar',
    }
  ),
  family(
    'calendrier',
    'Calendrier',
    'Calendrier : doubles filets, tuiles, colonnes teintées, chevrons, numéros d’angle.',
    'Calendar: double-rule headers, paired blocks, figure tiles, striped table columns, corner-numbered cards, chevron timelines, corner page numbers.',
    ['retro', 'pop-art', 'clay', 'vector-art', 'bohemian'],
    {
      headers: ['double-rule'], folio: 'corner-number', body: 'paired',
      metrics: 'tiles', table: 'striped-columns', cards: 'corner-number', timeline: 'chevrons',
      quote: 'centered', assumption: 'tab', prose: 'large-lead', chart: 'boxed',
      label: 'caps', numbering: 'padded', rules: 'heavy', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 2,
      lede: 'muted', figureFace: 'display', chartInk: 'palette', rhythm: 'standard', edge: 'top-bar',
    }
  ),
  family(
    'composition-typo',
    'Composition typographique',
    'Affiche typographique : énoncé en grand, mesure étroite, escalier de chiffres, citation d’auteur.',
    'Typographic composition: statement headers, a narrow measure, staircase figures, transposed tables, split quotes, charts with a side note, a page frame.',
    ['swiss', 'editorial', 'graffiti', 'minimalism', 'collage-art'],
    {
      headers: ['lede-led'], folio: 'centered', body: 'narrow',
      metrics: 'staircase', table: 'transposed', cards: 'ruled-columns', timeline: 'leaders',
      quote: 'split', assumption: 'inline', prose: 'large-lead', chart: 'side-note',
      label: 'small-caps', numbering: 'roman', rules: 'none', figures: 'ink', corners: 'square', titleScale: 'moderate', swatches: 0,
      lede: 'caps', figureFace: 'light', chartInk: 'monochrome', rhythm: 'standard', edge: 'frame',
    }
  ),
  family(
    'rapport-financier',
    'Rapport financier',
    'Comptes annuels : titre courant, cartouches, colonnes teintées, bandes, graphique annoté.',
    'Financial statements: hanging-number or double-rule headers, a running head, stamped figures, striped table columns, alternating bands, charts with a side note.',
    ['swiss', 'editorial', 'minimalism', 'victorian', 'glassmorphism'],
    {
      headers: ['hanging-number', 'double-rule'], folio: 'running-head', body: 'full',
      metrics: 'stamped', table: 'striped-columns', cards: 'stacked-bands', timeline: 'date-column',
      quote: 'split', assumption: 'footnote', prose: 'plain', chart: 'side-note',
      label: 'small-caps', numbering: 'dotted', rules: 'hairline', figures: 'ink', corners: 'square', titleScale: 'discreet', swatches: 2,
      lede: 'muted', figureFace: 'medium', chartInk: 'monochrome', rhythm: 'tight', edge: 'none',
    }
  ),
  family(
    'guide-voyage',
    'Guide de voyage',
    'Guide : onglets, colonne décalée, escalier de chiffres, initiales, épine de frise, lettrine.',
    'Travel guide: ribbon or statement headers, an offset column, staircase figures, monogram cards, a spine timeline, split quotes, a drop cap, a side colour bar.',
    ['bohemian', 'retro', 'handwritten', 'vector-art', 'collage-art'],
    {
      headers: ['ribbon', 'lede-led'], folio: 'tinted-strip', body: 'offset',
      metrics: 'staircase', table: 'row-cards', cards: 'monogram', timeline: 'spine',
      quote: 'split', assumption: 'edge', prose: 'drop-cap', chart: 'figure-caption',
      label: 'italic', numbering: 'section', rules: 'dotted', figures: 'accent', corners: 'style', titleScale: 'mood', swatches: 1,
      lede: 'italic', figureFace: 'italic', chartInk: 'palette', rhythm: 'airy', edge: 'side-bar',
    }
  ),
  family(
    'coffret',
    'Coffret',
    'Coffret précieux : doubles filets ou cadre, cartouches, numéros d’angle, équerres, cadre de page.',
    'Gift box: double-rule or boxed headers, a narrow measure, stamped figures, framed tables, corner-numbered cards, bracketed quotes, a page frame.',
    ['victorian', 'glassmorphism', 'aurora', 'clay', 'y2k'],
    {
      headers: ['double-rule', 'boxed'], folio: 'corner-number', body: 'narrow',
      metrics: 'stamped', table: 'framed', cards: 'corner-number', timeline: 'boxes',
      quote: 'brackets', assumption: 'tab', prose: 'large-lead', chart: 'boxed',
      label: 'small-caps', numbering: 'roman', rules: 'double', figures: 'accent', corners: 'style', titleScale: 'moderate', swatches: 0,
      lede: 'ruled', figureFace: 'italic', chartInk: 'focus', rhythm: 'airy', edge: 'frame',
    }
  ),
];

export const LAYOUT_FAMILY_IDS = LAYOUT_FAMILIES.map((entry) => entry.id);

const BY_ID = new Map(LAYOUT_FAMILIES.map((entry) => [entry.id, entry]));

/** Famille par identifiant, ou la première du catalogue si l'identifiant est inconnu. */
export function resolveFamily(id?: string | null): LayoutFamily {
  return (id && BY_ID.get(id)) || LAYOUT_FAMILIES[0];
}

/**
 * Familles compatibles avec un style.
 *
 * Sans style connu — un livrable produit avant que la direction artistique
 * n'existe —, TOUT le catalogue est ouvert : c'est précisément le cas où rien
 * ne justifie de restreindre la variété.
 */
export function familiesForStyle(styleId?: string | null): LayoutFamily[] {
  if (!styleId) return LAYOUT_FAMILIES;
  const pool = LAYOUT_FAMILIES.filter((entry) => (entry.fits as string[]).includes(styleId));
  return pool.length > 0 ? pool : LAYOUT_FAMILIES;
}

/**
 * Famille d'un livrable. Déterministe : le même document régénéré garde sa
 * grammaire, un autre projet en tire une autre.
 */
export function pickFamily(styleId: string | null | undefined, key: string): LayoutFamily {
  const pool = familiesForStyle(styleId);
  const digest = crypto.createHash('sha256').update(`family:${key}`).digest();
  return pool[digest.readUInt32BE(0) % pool.length];
}

/** Les dimensions scalaires d'une famille — celles que `familyDistance` compare. */
export const FAMILY_DIMENSIONS = [
  'folio',
  'body',
  'metrics',
  'table',
  'cards',
  'timeline',
  'quote',
  'assumption',
  'prose',
  'chart',
  'label',
  'numbering',
  'rules',
  'figures',
  'corners',
  'titleScale',
  'swatches',
  'lede',
  'figureFace',
  'chartInk',
  'rhythm',
  'edge',
] as const;

/**
 * Nombre de dimensions VISIBLES sur lesquelles deux familles diffèrent.
 *
 * Les ouvertures comptent pour une dimension : elles diffèrent si les deux
 * familles n'en partagent aucune. Le total possible est donc de vingt-trois.
 */
export function familyDistance(a: LayoutFamily, b: LayoutFamily): number {
  const scalar = FAMILY_DIMENSIONS.filter((dimension) => a[dimension] !== b[dimension]).length;
  const sharedHeader = a.headers.some((header) => b.headers.includes(header));
  return scalar + (sharedHeader ? 0 : 1);
}

/** Une ligne de description, pour le prompt des pages encore composées par un modèle. */
export function describeFamily(entry: LayoutFamily): string {
  return `- Layout family: ${entry.name} — ${entry.brief}`;
}
