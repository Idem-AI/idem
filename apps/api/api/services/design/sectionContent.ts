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

    case 'sources':
      // Deux lignes par référence, en petit corps.
      return 0.03 + block.items.length * 0.018;

    default:
      return 0.08;
  }
}
