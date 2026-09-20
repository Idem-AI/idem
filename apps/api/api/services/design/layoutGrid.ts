/**
 * Les PRIMITIVES DE MISE EN PAGE du rendu.
 *
 * `sectionRenderer` savait déjà quoi dessiner ; il ne savait pas OÙ le poser.
 * Chaque composant y inventait sa propre grille — un `flex: 1 1 0` ici, un
 * `repeat(2, 1fr)` là, un `margin-top: spacing * 1.5` ailleurs — et le résultat
 * était une page dont chaque partie était correcte et dont l'ensemble ne
 * s'alignait sur rien.
 *
 * ── LES QUATRE DÉFAUTS QUE CE MODULE SUPPRIME ───────────────────────────────
 *
 *  1. RANGÉES DÉSALIGNÉES. Cinq nuanciers côte à côte, dont l'un porte un rôle
 *     sur trois lignes et les autres sur deux : la ligne « contraste 9.1:1 »
 *     tombait à quatre hauteurs différentes. Personne ne sait nommer ce défaut
 *     en regardant la page, tout le monde le voit. C'est `subgridRows`.
 *
 *  2. RANGÉES ORPHELINES. `columns = min(3, max(2, ceil(n / 2)))` donnait 3
 *     colonnes pour 4 cartes : trois en haut, une seule en bas, flottant à
 *     gauche d'un vide. C'est `balancedColumns`.
 *
 *  3. MESURE NON BORNÉE. Un titre à 0,45 em d'interlettrage traversait les
 *     297 mm d'une diapositive jusqu'au bord ; un paragraphe pleine largeur
 *     donnait des lignes de 140 signes, deux fois la mesure lisible. C'est
 *     `MEASURE`.
 *
 *  4. RYTHME ARBITRAIRE. Les écarts verticaux valaient `spacing × 1.5`,
 *     `× 2.5`, `× 0.7` — des nombres choisis un à un, jamais des multiples
 *     d'une même unité. C'est `snap`.
 *
 * ── POURQUOI ICI PLUTÔT QUE DANS LE RENDU ───────────────────────────────────
 *
 * Ces règles ne dépendent ni de l'archétype, ni de la charte, ni du contenu :
 * elles sont vraies de toute page. Les isoler les rend VÉRIFIABLES — un test
 * peut affirmer que `balancedColumns(4) !== 3` sans rendre une page — et
 * garantit qu'un nouvel archétype les hérite au lieu de les réinventer.
 */

/**
 * L'unité de rythme, en px.
 *
 * Tout écart vertical de la page est un MULTIPLE de cette valeur. C'est la
 * transposition littérale de la grille de ligne de base de l'imprimé : elle ne
 * rend pas une page belle, elle rend ses écarts COMPARABLES entre eux, ce qui
 * est la condition pour qu'une succession de blocs se lise comme une
 * composition et non comme un empilement.
 *
 * 4 px plutôt que 8 : le rythme du document (`ds.spacing`) varie déjà d'un
 * projet à l'autre entre 4 et 12 px, et une unité de 8 forcerait un document
 * serré à doubler tous ses écarts.
 */
export const RHYTHM = 4;

/**
 * Cale une valeur sur le rythme.
 *
 * Arrondi au plus proche, jamais vers le bas : un écart nul entre deux blocs
 * est un défaut, un écart d'un cran ne l'est pas.
 */
export function snap(value: number, unit: number = RHYTHM): number {
  return Math.max(unit, Math.round(value / unit) * unit);
}

/**
 * Mesures maximales, en `ch` — c'est-à-dire en largeur du chiffre zéro de la
 * police EN COURS, donc une borne qui suit la taille du texte au lieu de la
 * contredire.
 *
 * Les valeurs sont celles de la composition classique : entre 45 et 75 signes
 * par ligne pour du texte courant, au-delà l'œil perd la ligne suivante en
 * revenant à gauche. Un titre se borne plus court encore, parce qu'il se lit
 * d'un seul regard.
 */
export const MEASURE = {
  /** Chapô : une phrase, deux lignes au plus. */
  lede: '52ch',
  /** Texte courant. */
  prose: '68ch',
  /** Corps d'une carte, déjà contraint par sa colonne. */
  card: '46ch',
} as const;

/**
 * Composition d'un texte de TITRE.
 *
 * `text-wrap: balance` répartit les mots entre les lignes au lieu de remplir la
 * première puis d'abandonner un mot seul sur la dernière. Chrome le limite aux
 * blocs de six lignes ou moins, ce qui couvre tous les titres — et c'est
 * précisément pour eux qu'il existe.
 *
 * Observé avant : « LE CAFÉ DE SPÉCIALITÉ ARRIVE AU CAMEROUN » remplissait une
 * ligne pleine largeur et laissait « CAMEROUN » seul sur la seconde.
 *
 * Aucune borne de mesure ici, à la différence du texte courant : un titre porte
 * souvent un interlettrage large, et l'unité `ch` ne compte QUE la largeur des
 * signes, pas l'espace ajouté entre eux. Une borne en `ch` serait donc fausse
 * d'autant. C'est `fitTitleSize`, dans le rendu, qui borne un titre — en
 * intégrant l'interlettrage à l'avance moyenne d'un signe.
 */
export const TITLE_WRAP = {
  'text-wrap': 'balance',
} as const;

/**
 * Composition d'un texte COURANT.
 *
 * `text-wrap: pretty` traite le dernier paragraphe : il empêche qu'un mot seul
 * termine un bloc. `orphans` et `widows` interdisent au paginateur de laisser
 * une ligne isolée en bas ou en haut d'une page — la règle d'imprimeur que le
 * navigateur applique gratuitement dès qu'on la lui demande.
 *
 * PAS de `hyphens: auto`, délibérément. La césure automatique coupe les mots
 * selon le dictionnaire de la langue DÉCLARÉE, et le gabarit PDF déclare
 * `lang="fr"` en dur alors que le contenu d'un livrable peut être en anglais.
 * Une césure appliquée avec le mauvais dictionnaire produit des coupures
 * fausses — un défaut plus voyant que le bord irrégulier qu'elle corrige.
 */
export const PROSE_WRAP = {
  'text-wrap': 'pretty',
  orphans: 2,
  widows: 2,
} as const;

/**
 * Nombre de colonnes pour `count` éléments de même nature.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Aucune rangée ne doit contenir UN SEUL élément quand les précédentes en
 * contiennent plusieurs. Un reste de 1 est le seul cas où la grille se voit :
 * l'œil lit une rangée complète, puis une rangée amputée, et conclut qu'il
 * manque quelque chose.
 *
 * On préfère 3 colonnes — la respiration d'une diapositive — puis 4 quand 3
 * laisse un orphelin, puis 2. Quatre éléments font donc DEUX rangées de deux,
 * jamais trois plus un.
 */
export function balancedColumns(count: number): number {
  if (count <= 3) return Math.max(1, count);
  if (count === 4) return 2;

  for (const columns of [3, 4, 2]) {
    if (count % columns !== 1) return columns;
  }
  return 3;
}

/**
 * Grille dont les RANGÉES INTERNES des cellules sont alignées entre elles.
 *
 * ── CE QUE `subgrid` FAIT, ET QUE RIEN D'AUTRE NE FAIT ───────────────────────
 *
 * Une rangée de composants identiques — nuanciers, chiffres-clés, déclinaisons
 * de logo — est faite de cellules qui portent chacune deux à quatre lignes :
 * une pastille, un nom, un rôle, un contraste. Tant que chaque cellule empile
 * ses lignes pour son compte, la troisième ligne de la cellule 1 ne tombe pas à
 * la hauteur de la troisième ligne de la cellule 2 dès que le rôle de l'une
 * passe sur deux lignes.
 *
 * `grid-template-rows: subgrid` fait hériter la cellule des rangées de sa
 * grille parente : les quatre lignes deviennent quatre BANDES communes, et le
 * contraste s'aligne d'une cellule à l'autre quoi qu'il arrive au texte
 * au-dessus. C'est la seule façon d'y parvenir sans mesurer le texte, donc la
 * seule qui tienne quel que soit le contenu.
 *
 * Chrome le sait faire depuis la version 117 ; le PDF est rendu par un Chrome
 * 140+. Le repli, si la propriété était ignorée, est l'ancien comportement —
 * des cellules qui s'empilent chacune de leur côté — jamais une page cassée.
 *
 * @param rows    Nombre de bandes horizontales d'une cellule.
 * @param columns Nombre de colonnes de la rangée.
 * @param gapPx   Gouttière, déjà calée sur le rythme par l'appelant.
 */
export function subgridRows(
  rows: number,
  columns: number,
  gapPx: number
): { container: Record<string, string>; cell: Record<string, string> } {
  return {
    container: {
      display: 'grid',
      'grid-template-columns': `repeat(${columns}, minmax(0, 1fr))`,
      // `auto` sur chaque bande : la bande prend la hauteur de la cellule LA
      // PLUS HAUTE, et toutes les autres s'y alignent. C'est là que
      // l'alignement se produit.
      'grid-template-rows': `repeat(${rows}, auto)`,
      'column-gap': `${gapPx}px`,
      'row-gap': `${gapPx}px`,
      'align-items': 'start',
    },
    cell: {
      display: 'grid',
      'grid-row': `span ${rows}`,
      'grid-template-rows': 'subgrid',
      'min-width': '0',
      // Aucune gouttière DANS la cellule : ses bandes sont celles du parent,
      // dont l'écart est déjà posé par `row-gap`.
      'row-gap': `${Math.round(gapPx / 2)}px`,
    },
  };
}

/**
 * Répartition verticale du contenu d'une page à HAUTEUR FIXE.
 *
 * ── LE DÉFAUT QUE CECI CORRIGE ──────────────────────────────────────────────
 *
 * Sur une diapositive, le contenu s'empilait depuis le haut et le pied de page
 * restait collé en bas. Entre les deux : un vide de 35 à 45 % de la hauteur,
 * sur presque toutes les pages observées. Ce vide n'était pas de la
 * respiration — il était toujours au même endroit, toujours en bas, et il se
 * lisait comme une page inachevée plutôt que comme une page aérée.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le vide restant est RÉPARTI au-dessus et au-dessous du contenu, non plus
 * accumulé sous lui. Une page à moitié pleine devient alors une page qui
 * respire des deux côtés, ce qu'un directeur artistique ferait à la main.
 *
 * Le décalage optique corrige le reste : un bloc géométriquement centré paraît
 * BAS, parce que l'œil place le centre d'un rectangle un peu au-dessus de son
 * milieu. On remonte donc le contenu d'un quatorzième de la hauteur utile —
 * soit la moitié du retrait posé ci-dessous, puisque le centrage répartit ce
 * retrait des deux côtés. Un huitième, essayé d'abord, remontait trop : le vide
 * du bas valait le double de celui du haut, ce qui n'est plus un décalage
 * optique mais un alignement en haut de page.
 *
 * `safe center` est ce qui rend la règle sûre : centrer un contenu PLUS GRAND
 * que son conteneur le ferait déborder des DEUX côtés, et sur une page rognée
 * le haut disparaîtrait — le titre, précisément. Le mot-clé `safe` bascule sur
 * un alignement en haut dès que le contenu déborde, donc le débordement ne
 * coûte jamais le titre.
 */
export function distributeVertically(usableHeightMm: number): Record<string, string> {
  return {
    display: 'flex',
    'flex-direction': 'column',
    'justify-content': 'safe center',
    // Le décalage optique : la moitié de ce retrait remonte le contenu.
    'padding-bottom': `${Math.round(usableHeightMm / 14)}mm`,
  };
}

/**
 * Largeur d'un bloc dans la grille de la page, en douzièmes.
 *
 * Un tableau, un graphique ou un nuancier veulent toute la largeur : les
 * réduire à une demi-colonne les rend illisibles. De la prose et une citation
 * s'accommodent d'une demi-largeur, et gagnent même à ne pas la dépasser.
 *
 * Ce que cela remplace : `grid-template-columns: repeat(2, 1fr)` appliqué à
 * TOUS les blocs indistinctement, qui posait un tableau de cinq colonnes dans
 * une demi-diapositive et laissait la moitié droite vide quand la page ne
 * portait qu'un seul bloc.
 */
export function blockSpan(kind: string): 6 | 12 {
  switch (kind) {
    case 'prose':
    case 'quote':
    case 'assumption':
    case 'timeline':
      return 6;
    default:
      // table, chart, metrics, cards, swatches, typeSpecimen, logoDisplay,
      // sources : la largeur EST leur lisibilité.
      return 12;
  }
}

/** Un bloc placé dans la grille : sa largeur, et la rangée qui le porte. */
export interface PackedBlock<T> {
  block: T;
  span: 6 | 12;
}

/**
 * Range les blocs en rangées de douze douzièmes, SANS colonne orpheline.
 *
 * Deux blocs à demi-largeur se mettent côte à côte. Un bloc à demi-largeur qui
 * ne trouve pas de partenaire est PROMU pleine largeur plutôt que laissé seul
 * dans sa colonne — c'est le défaut qui laissait la page « Typographie » à
 * moitié vide, son unique spécimen occupant la colonne de gauche et le vide
 * occupant celle de droite.
 */
export function packRow<T extends { kind: string }>(blocks: T[]): PackedBlock<T>[] {
  const packed: PackedBlock<T>[] = blocks.map((block) => ({
    block,
    span: blockSpan(block.kind),
  }));

  // Un demi-bloc n'est un demi-bloc que s'il a un voisin de même largeur.
  for (let i = 0; i < packed.length; i++) {
    if (packed[i].span !== 6) continue;
    const partnered = packed[i - 1]?.span === 6 || packed[i + 1]?.span === 6;
    if (!partnered) packed[i].span = 12;
  }

  // Un demi-bloc apparié à un voisin DÉJÀ apparié à gauche se retrouve seul sur
  // sa rangée : trois demis font une paire et un orphelin. On promeut le
  // dernier.
  let run = 0;
  for (let i = 0; i < packed.length; i++) {
    if (packed[i].span === 6) {
      run++;
      continue;
    }
    if (run % 2 === 1) packed[i - 1].span = 12;
    run = 0;
  }
  if (run % 2 === 1) packed[packed.length - 1].span = 12;

  return packed;
}
