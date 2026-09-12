/**
 * Le contrat entre le modèle et le rendu.
 *
 * C'est le renversement central : **le modèle écrit le contenu, le code produit
 * la page**. Il ne rend plus de HTML, il rend des BLOCS — un titre, des
 * paragraphes, un tableau, une série de chiffres — et le gabarit les met en
 * page.
 *
 * Ce que cela change, mécaniquement :
 *
 *   · la sortie passe d'environ 10 000 tokens de balisage à ~2 500 de contenu.
 *     Une page A4 pleine porte 550 à 700 mots utiles, soit ~900 tokens : tout le
 *     reste était de la frappe de classes Tailwind. Et comme la latence est
 *     dominée par le decode, diviser la sortie divise l'attente d'autant ;
 *   · la troncature en plein milieu d'une balise devient IMPOSSIBLE — il n'y a
 *     plus de balise à tronquer, et un JSON coupé est détecté par le parseur ;
 *   · la palette, la typographie, la grille, le rayon, les ombres, le placement
 *     du logo et l'accessibilité cessent d'être des consignes à respecter pour
 *     devenir des propriétés du rendu ;
 *   · la variété ne disparaît pas : elle vient de la graine, qui choisit
 *     l'archétype de mise en page parmi douze (cf. `sectionRenderer`).
 *
 * Ce qui reste au modèle est exactement ce qu'un petit modèle sait faire :
 * trouver l'angle, choisir les faits, écrire des phrases justes.
 */

export type Block =
  /** Paragraphes de texte courant. */
  | { kind: 'prose'; paragraphs: string[] }
  /**
   * Grille de cartes. `emphasis` sort UNE carte du lot — c'est le gabarit qui
   * lui donne sa forme. Sans elle, trois cartes identiques restent trois cartes
   * identiques, le tic le plus reconnaissable d'une page générée.
   */
  | { kind: 'cards'; items: { title: string; body: string; emphasis?: boolean }[] }
  | { kind: 'table'; headers: string[]; rows: string[][]; caption?: string }
  /** Chiffres-clés. `note` porte l'année, la source ou l'unité. */
  | { kind: 'metrics'; items: { value: string; label: string; note?: string }[] }
  /**
   * Graphique. Rendu en CSS pur, sans bibliothèque ni <canvas> : le gabarit
   * maîtrise le balisage, il n'a donc pas besoin de Chart.js — ni des règles de
   * prompt qui l'encadraient (« un id unique », « un seul graphe par canvas »,
   * « animation: false »), ni de leurs échecs.
   *
   * `readingKey` dit ce que le lecteur doit CONCLURE, pas ce que le graphe montre.
   */
  | {
      kind: 'chart';
      /**
       * Le type dit ce que la donnée EST, pas ce qui est joli.
       *
       * Le catalogue n'en offrait que trois, sans dire quand employer lequel :
       * tout arrivait en barres, y compris des parts d'un tout et des
       * évolutions dans le temps. Le lecteur y perdait le sens que le graphique
       * était censé porter. Cf. `CHART_GUIDE` dans sectionContent.prompt.ts,
       * qui associe chaque type à la question à laquelle il répond.
       */
      chartType:
        | 'bar'
        | 'groupedBar'
        | 'stacked'
        | 'horizontalBar'
        | 'line'
        | 'area'
        | 'pie'
        | 'doughnut'
        | 'radar';
      labels: string[];
      series: { name: string; data: number[] }[];
      readingKey: string;
      unit?: string;
    }
  | { kind: 'quote'; text: string; attribution?: string }
  | { kind: 'timeline'; steps: { date: string; title: string; body: string }[] }
  /** Hypothèse explicite : ce que le plan suppose, et sur quoi. */
  | { kind: 'assumption'; statement: string; basis: string }
  // ── Blocs SPÉCIMENS ────────────────────────────────────────────────────────
  // Ceux-ci ne sont JAMAIS produits par le modèle : ils sont injectés par le
  // service à partir des données réelles du projet (cf. `prependBlocks`).
  //
  // C'est l'expression la plus nette de la doctrine. Une page de nuancier
  // demande des valeurs hexadécimales EXACTES ; les faire écrire à un modèle,
  // c'est accepter qu'une charte affiche une couleur qui n'est pas celle de la
  // marque — le défaut le plus grave possible sur ce livrable, et le plus
  // fréquent, parce qu'un modèle recopie mal six chiffres hexadécimaux.
  /** Nuancier. Le contraste de chaque teinte est CALCULÉ, pas annoncé. */
  | { kind: 'swatches'; items: { hex: string; name: string; role?: string }[] }
  /** Spécimen typographique, rendu dans la vraie police. */
  | {
      kind: 'typeSpecimen';
      specimens: { family: string; role: string; sample: string }[];
    }
  /** Déclinaisons du logo, chacune sur le fond qui la met en valeur. */
  | {
      kind: 'logoDisplay';
      variants: { url: string; label: string; background: 'light' | 'dark' | 'neutral' }[];
    }
  /**
   * Échelle typographique, DÉMONTRÉE plutôt que décrite.
   *
   * Le niveau ne porte pas sa taille en pixels : il porte le DEGRÉ de l'échelle
   * du document (`xs`…`4xl`), et le rendu le compose à la taille que ce degré
   * vaut dans CE document. Une page de hiérarchie qui annoncerait « H1 — 48 px »
   * pendant que le document compose ses titres à 34 px dirait le faux sur le
   * seul sujet dont elle traite.
   */
  | {
      kind: 'typeScale';
      levels: {
        label: string;
        family: string;
        step: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
        weight: number;
        sample: string;
        usage?: string;
      }[];
    }
  /**
   * Motifs graphiques de la marque, dessinés en CSS depuis sa palette.
   *
   * Le bloc ne porte AUCUN CSS : il nomme un motif du répertoire et ses deux
   * encres. Laisser passer une chaîne de `background-image` reviendrait à
   * rouvrir la porte que les blocs spécimens ferment — un modèle y glisserait
   * une couleur qui n'est pas celle de la marque, et un motif est justement ce
   * qu'on décline ensuite sur tous les supports.
   */
  | {
      kind: 'patternGrid';
      patterns: {
        name: string;
        motif: 'stripes' | 'grid' | 'dots' | 'chevron' | 'arcs' | 'checker';
        ink: string;
        ground: string;
        note?: string;
      }[];
    }
  /** Créations pour les réseaux sociaux, composées à la charte, au format carré. */
  | {
      kind: 'socialPosts';
      posts: {
        platform: string;
        headline: string;
        kicker?: string;
        ground: 'primary' | 'accent' | 'dark' | 'light';
        logoUrl?: string;
      }[];
    }
  /** Bannières de profil, au ratio réel de chaque réseau. */
  | {
      kind: 'socialBanners';
      banners: {
        platform: string;
        /** Ratio réel du réseau, ex. « 1584 × 396 ». Affiché tel quel. */
        ratio: string;
        headline: string;
        tagline?: string;
        ground: 'primary' | 'accent' | 'dark' | 'light';
        logoUrl?: string;
      }[];
    }
  /**
   * Mockups de réseaux sociaux, déjà rendus en image.
   *
   * `ratio` (largeur / hauteur) répartit la largeur de la rangée pour que ses
   * mockups partagent leur hauteur : un profil en paysage et une publication
   * en portrait ne se lisent côte à côte que s'ils ont la même.
   */
  | {
      kind: 'mockupShowcase';
      items: { url: string; label: string; caption?: string; ratio: number }[];
    }
  /** Le logo et son explication, côte à côte : la forme d'abord, sa raison ensuite. */
  | {
      kind: 'logoStory';
      url: string;
      label: string;
      background: 'light' | 'dark' | 'neutral';
      points: { label: string; text: string }[];
    }
  /** Le parti pris de la direction artistique : son nom, sa raison, son vocabulaire. */
  | { kind: 'artDirectionStance'; styleName: string; rationale: string; keywords: string[] }
  /** Les principes de composition, chacun DÉMONTRÉ en CSS avant d'être nommé. */
  | {
      kind: 'compositionPrinciples';
      density: 'airy' | 'balanced' | 'dense';
      items: { demo: 'grid' | 'density' | 'whitespace' | 'signature'; label: string; text: string }[];
    }
  /** Le traitement de l'image : une photographie d'univers et ses réglages. */
  | { kind: 'imageryShowcase'; imageUrl?: string; rows: { label: string; value: string }[] }
  /** Les leviers de la direction artistique, puis ce qu'on fait et ce qu'on évite. */
  | {
      kind: 'artDirectionRules';
      rows: { label: string; value: string }[];
      dos: string[];
      donts: string[];
    }
  /**
   * Références numérotées d'une section appuyée sur une recherche web.
   *
   * Injecté par le service à partir des sources RÉELLES retournées par le
   * moteur — jamais écrit par le modèle, qui inventerait des URLs. Le modèle,
   * lui, pose des marqueurs `[s0]`, `[s1]`… dans son texte ; le rendu les
   * transforme en appels de note.
   *
   * C'est ce qui permet à une section sourcée d'être une SECTION DU DOCUMENT,
   * au même format que les autres, plutôt qu'une page à part avec sa propre
   * mise en page et sa propre liste de sources en bas.
   */
  | {
      kind: 'sources';
      /**
       * Section d'origine, quand la page « Ressources » regroupe plusieurs
       * listes. Les numéros restent ceux CITÉS dans cette section-là : c'est ce
       * qui permet au lecteur de retrouver l'exposant qu'il vient de lire.
       */
      label?: string;
      items: {
        index: number;
        title: string;
        url: string;
        domain?: string;
        /**
         * À quoi cette source a servi, en une phrase.
         *
         * Une bibliographie qui n'aligne que des titres oblige le lecteur à
         * ouvrir chaque lien pour savoir lequel l'intéresse. Dire ce que la
         * source apporte est ce qui la rend consultable.
         */
        description?: string;
      }[];
    };

export interface SectionContent {
  /** Sur-titre court. Le gabarit décide s'il l'affiche — un kicker par page suffit. */
  kicker?: string;
  title: string;
  /** Une phrase qui ÉNONCE le constat. Jamais « dans cette section, nous allons… ». */
  lede?: string;
  blocks: Block[];
}

/**
 * Types de blocs que le MODÈLE peut produire.
 *
 * Les blocs spécimens (`swatches`, `typeSpecimen`, `logoDisplay`) en sont
 * volontairement absents : ils portent des valeurs exactes issues du projet, et
 * les accepter du modèle rouvrirait précisément la porte qu'on ferme.
 */
/** Types de graphiques acceptés. Doit rester aligné sur `CHART_GUIDE`. */
export type ChartKind =
  | 'bar'
  | 'groupedBar'
  | 'stacked'
  | 'horizontalBar'
  | 'line'
  | 'area'
  | 'pie'
  | 'doughnut'
  | 'radar';

export const CHART_TYPES: ReadonlySet<string> = new Set<ChartKind>([
  'bar',
  'groupedBar',
  'stacked',
  'horizontalBar',
  'line',
  'area',
  'pie',
  'doughnut',
  'radar',
]);

const BLOCK_KINDS = new Set([
  'prose',
  'cards',
  'table',
  'metrics',
  'chart',
  'quote',
  'timeline',
  'assumption',
]);

/**
 * Valide et NORMALISE une sortie de modèle.
 *
 * Ne lève jamais sur un bloc mal formé : elle l'écarte. Un petit modèle produit
 * régulièrement un bloc à moitié rempli au milieu de blocs corrects ; perdre la
 * page entière pour cela serait exactement l'échec que ce dispositif supprime.
 *
 * Renvoie `null` seulement quand il ne reste rien d'exploitable — l'appelant
 * retombe alors sur son repli.
 */
export function normalizeSectionContent(raw: unknown): SectionContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return null;

  const blocks: Block[] = [];
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];

  for (const candidate of rawBlocks) {
    const block = normalizeBlock(candidate);
    if (block) blocks.push(block);
  }

  if (blocks.length === 0) return null;

  return {
    kicker: typeof input.kicker === 'string' ? input.kicker.trim() || undefined : undefined,
    title,
    lede: typeof input.lede === 'string' ? input.lede.trim() || undefined : undefined,
    blocks,
  };
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asTexts = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asText).filter(Boolean) : [];
const asNumbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];

function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const block = raw as Record<string, unknown>;
  const kind = asText(block.kind);
  if (!BLOCK_KINDS.has(kind)) return null;

  switch (kind) {
    case 'prose': {
      const paragraphs = asTexts(block.paragraphs);
      return paragraphs.length > 0 ? { kind: 'prose', paragraphs } : null;
    }

    case 'cards': {
      const items = (Array.isArray(block.items) ? block.items : [])
        .map((item) => {
          const entry = (item ?? {}) as Record<string, unknown>;
          return {
            title: asText(entry.title),
            body: asText(entry.body),
            emphasis: entry.emphasis === true,
          };
        })
        .filter((item) => item.title || item.body);
      return items.length > 0 ? { kind: 'cards', items } : null;
    }

    case 'table': {
      const headers = asTexts(block.headers);
      const rows = (Array.isArray(block.rows) ? block.rows : [])
        .map(asTexts)
        .filter((row) => row.length > 0);
      if (headers.length === 0 || rows.length === 0) return null;
      // Lignes recalibrées sur l'en-tête : une ligne courte casserait la grille.
      const width = headers.length;
      const padded = rows.map((row) =>
        row.length === width ? row : [...row, ...Array(Math.max(0, width - row.length)).fill('')].slice(0, width)
      );
      return { kind: 'table', headers, rows: padded, caption: asText(block.caption) || undefined };
    }

    case 'metrics': {
      const items = (Array.isArray(block.items) ? block.items : [])
        .map((item) => {
          const entry = (item ?? {}) as Record<string, unknown>;
          return {
            value: asText(entry.value),
            label: asText(entry.label),
            note: asText(entry.note) || undefined,
          };
        })
        .filter((item) => item.value && item.label);
      return items.length > 0 ? { kind: 'metrics', items } : null;
    }

    case 'chart': {
      const labels = asTexts(block.labels);
      const series = (Array.isArray(block.series) ? block.series : [])
        .map((entry) => {
          const item = (entry ?? {}) as Record<string, unknown>;
          return { name: asText(item.name), data: asNumbers(item.data) };
        })
        .filter((entry) => entry.data.length > 0);
      if (labels.length === 0 || series.length === 0) return null;
      const chartType = asText(block.chartType);
      // Séries recalibrées sur les libellés : une barre sans étiquette ne se
      // dessine pas, et une étiquette sans valeur laisse un trou.
      const aligned = series.map((entry) => ({
        name: entry.name,
        data: labels.map((_, index) => entry.data[index] ?? 0),
      }));

      // ⚠️ Un graphique dont toutes les valeurs valent zéro se rend comme un
      // CADRE VIDE — un grand blanc au milieu de la page, avec sa légende et sa
      // clé de lecture pour seuls habitants. C'est pire que pas de graphique du
      // tout, et c'est exactement ce que produit un modèle qui a annoncé une
      // série sans savoir la remplir. On écarte le bloc.
      const hasSignal = aligned.some((entry) => entry.data.some((value) => value !== 0));
      if (!hasSignal) return null;

      // Le type annoncé est retenu s'il existe ; sinon on ne devine pas au
      // hasard, on déduit de la FORME de la donnée — c'est le code qui décide,
      // et il décide juste : plusieurs séries dans le temps appellent une
      // ligne, une série unique appelle des barres.
      const declared = CHART_TYPES.has(chartType) ? (chartType as ChartKind) : null;
      const fallbackType: ChartKind = aligned.length > 1 ? 'groupedBar' : 'bar';

      return {
        kind: 'chart',
        chartType: declared ?? fallbackType,
        labels,
        series: aligned,
        readingKey: asText(block.readingKey),
        unit: asText(block.unit) || undefined,
      };
    }

    case 'quote': {
      const text = asText(block.text);
      return text ? { kind: 'quote', text, attribution: asText(block.attribution) || undefined } : null;
    }

    case 'timeline': {
      const steps = (Array.isArray(block.steps) ? block.steps : [])
        .map((entry) => {
          const item = (entry ?? {}) as Record<string, unknown>;
          return { date: asText(item.date), title: asText(item.title), body: asText(item.body) };
        })
        .filter((step) => step.title);
      return steps.length > 0 ? { kind: 'timeline', steps } : null;
    }

    case 'assumption': {
      const statement = asText(block.statement);
      return statement
        ? { kind: 'assumption', statement, basis: asText(block.basis) }
        : null;
    }

    default:
      return null;
  }
}

/**
 * Poids d'un bloc, exprimé en FRACTION D'UNE PAGE A4 PORTRAIT.
 *
 * Sert à deux choses : dire au modèle combien de matière produire, et décider ce
 * qui tient sur une page à hauteur fixe (`fitToPage`).
 *
 * ⚠️ L'unité de référence est celle des prompts de section : « une page A4
 * pleine porte 550 à 700 mots de texte courant ». À ~5,5 caractères par mot,
 * cela fait environ 3 600 caractères — pas 700. La calibration précédente
 * surestimait la prose d'un facteur cinq, ce qui faisait écarter tout le texte
 * d'une page rognée pour n'y laisser que les blocs graphiques.
 *
 * Les autres poids sont estimés en HAUTEUR OCCUPÉE sur une A4 utile
 * (186 × 273 mm), et volontairement un peu généreux : sous-estimer produit une
 * page coupée, surestimer produit une page un peu creuse.
 */

/** Caractères de texte courant que porte une page A4 pleine. */
const CHARS_PER_PAGE = 3600;

export function estimateBlockWeight(block: Block): number {
  switch (block.kind) {
    case 'prose':
      return block.paragraphs.join(' ').length / CHARS_PER_PAGE;

    case 'cards':
      // Une carte occupe une hauteur plancher, plus ce que son texte ajoute.
      return block.items.reduce(
        (total, item) =>
          total + 0.05 + (item.title.length + item.body.length) / (CHARS_PER_PAGE * 2),
        0
      );

    case 'table':
      // En-tête + lignes. Une ligne fait environ 8 mm sur 273 mm utiles.
      return 0.05 + block.rows.length * 0.03;

    case 'metrics':
      return 0.12;

    case 'chart':
      // Tracé (150 px) + axe + légende + clé de lecture.
      return 0.3;

    case 'quote':
      return 0.06 + block.text.length / (CHARS_PER_PAGE * 2);

    case 'timeline':
      return block.steps.reduce(
        (total, step) => total + 0.05 + step.body.length / (CHARS_PER_PAGE * 2),
        0
      );

    case 'assumption':
      return 0.06;

    case 'swatches':
      // Bande de 26 mm plus ses trois lignes de légende.
      return 0.15;

    case 'typeSpecimen':
      return block.specimens.length * 0.14;

    case 'logoDisplay':
      return 0.16;

    case 'typeScale':
      // Chaque niveau est composé à sa taille RÉELLE : son poids suit le degré.
      return block.levels.reduce(
        (total, level) =>
          total +
          0.03 +
          ({ xs: 0.012, sm: 0.014, base: 0.016, lg: 0.02, xl: 0.028, '2xl': 0.04, '3xl': 0.055, '4xl': 0.075 }[
            level.step
          ] ?? 0.02),
        0
      );

    case 'patternGrid':
      // Une rangée de tuiles de 34 mm, plus leurs légendes.
      return 0.18;

    case 'socialPosts':
      // Trois carrés côte à côte : une bande de 40 mm environ.
      return 0.22;

    case 'socialBanners':
      // Des bandeaux très larges et bas, empilés.
      return 0.08 + block.banners.length * 0.07;

    // Les blocs de démonstration dimensionnent leurs images sur la HAUTEUR
    // utile de la page (cf. `usableHeightPx`) : leur poids est celui de la
    // fraction qu'ils en prennent, légendes comprises.
    case 'mockupShowcase':
      return 0.34;

    case 'logoStory':
      return 0.32;

    case 'artDirectionStance':
      return 0.3;

    case 'compositionPrinciples':
      return 0.3;

    case 'imageryShowcase':
      return block.imageUrl ? 0.34 : 0.05 + block.rows.length * 0.03;

    case 'artDirectionRules':
      return 0.06 + Math.max(block.rows.length * 0.03, (block.dos.length + block.donts.length) * 0.025 + 0.04);

    case 'sources':
      // Deux lignes par référence, en petit corps.
      return 0.03 + block.items.length * 0.018;

    default:
      return 0.08;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VOLUME DE CONTENU D'UNE PAGE À HAUTEUR FIXE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combien une diapositive porte, par nature de bloc.
 *
 * ── POURQUOI DES NOMBRES ET NON UNE CONSIGNE ────────────────────────────────
 *
 * Le volume était demandé au modèle, en toutes lettres : « volume : 2 to 3 [blocs] ».
 * Une consigne de ce genre est respectée la plupart du temps et ignorée le
 * reste du temps, et c'est le reste du temps qui produit le livrable dont
 * l'utilisateur se plaint. Rien, en aval, ne bornait ensuite le nombre de
 * phrases d'un paragraphe, de cartes d'une grille ou de lignes d'un tableau.
 *
 * Le rendu écartait alors des blocs entiers faute de place (`fitToPage`), ce qui
 * est le pire arbitrage possible : la page perd une idée COMPLÈTE parce que la
 * précédente en a dit trois fois trop.
 *
 * Borner ici coûte quelques phrases et sauve des blocs entiers.
 *
 * ── POURQUOI À LA PHRASE ────────────────────────────────────────────────────
 *
 * On ne coupe jamais au signe : un paragraphe amputé en plein milieu se voit,
 * et se lit comme une panne. On retient des PHRASES ENTIÈRES tant que le budget
 * le permet, et l'on garde toujours la première — c'est celle qui porte le
 * constat.
 */
const FIXED_PAGE_LIMITS = {
  /** Une page de charte porte une idée, pas un chapitre. */
  proseParagraphs: 2,
  /** Signes par paragraphe. Environ quatre lignes de mesure pleine. */
  proseChars: 320,
  /** Au-delà, les cartes deviennent des vignettes illisibles. */
  cards: 4,
  cardBodyChars: 150,
  /** Quatre chiffres tiennent sur une rangée ; six s'écrasent. */
  metrics: 4,
  tableRows: 6,
  timelineSteps: 4,
  ledeChars: 170,
} as const;

/**
 * Retient les premières phrases d'un texte tenant dans `maxChars`.
 *
 * La première phrase est TOUJOURS conservée, même longue : la tronquer
 * reviendrait à publier une page sans son affirmation principale. Le texte
 * revient inchangé s'il tient déjà — le cas courant, et celui qui ne doit rien
 * coûter.
 */
function firstSentences(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Fin de phrase : ponctuation forte suivie d'une espace. Les décimales
  // (« 2,3 »), les abréviations courantes et les points de suspension ne la
  // déclenchent donc pas.
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (!sentences || sentences.length <= 1) return text;

  let kept = sentences[0];
  for (let i = 1; i < sentences.length; i++) {
    if (kept.length + sentences[i].length > maxChars) break;
    kept += sentences[i];
  }
  return kept.trim();
}

/**
 * Ramène un contenu au volume qu'une page à HAUTEUR FIXE porte réellement.
 *
 * Appliqué aux seuls formats rognés — diapositive, charte. Un business plan
 * paginé n'a pas de raison d'être condensé : le paginateur lui donne les pages
 * dont il a besoin.
 *
 * Ne renvoie jamais un contenu vide : chaque bloc conserve au moins son premier
 * élément.
 */
export function condenseForFixedPage(content: SectionContent): SectionContent {
  const blocks = content.blocks.map((block): Block => {
    switch (block.kind) {
      case 'prose':
        return {
          kind: 'prose',
          paragraphs: block.paragraphs
            .slice(0, FIXED_PAGE_LIMITS.proseParagraphs)
            .map((paragraph) => firstSentences(paragraph, FIXED_PAGE_LIMITS.proseChars)),
        };

      case 'cards':
        return {
          kind: 'cards',
          items: block.items.slice(0, FIXED_PAGE_LIMITS.cards).map((item) => ({
            ...item,
            body: firstSentences(item.body, FIXED_PAGE_LIMITS.cardBodyChars),
          })),
        };

      case 'metrics':
        return { kind: 'metrics', items: block.items.slice(0, FIXED_PAGE_LIMITS.metrics) };

      case 'table':
        return { ...block, rows: block.rows.slice(0, FIXED_PAGE_LIMITS.tableRows) };

      case 'timeline':
        return { kind: 'timeline', steps: block.steps.slice(0, FIXED_PAGE_LIMITS.timelineSteps) };

      default:
        // Nuancier, spécimen typographique, déclinaisons de logo, graphique,
        // citation, hypothèse, sources : leur volume est déjà celui de la
        // donnée qu'ils portent. Rien à retirer sans retirer du sens.
        return block;
    }
  });

  return {
    ...content,
    lede: content.lede ? firstSentences(content.lede, FIXED_PAGE_LIMITS.ledeChars) : undefined,
    blocks,
  };
}
