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
      chartType: 'bar' | 'stacked' | 'line';
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
      return {
        kind: 'chart',
        chartType:
          chartType === 'stacked' || chartType === 'line' ? (chartType as 'stacked' | 'line') : 'bar',
        labels,
        // Séries recalibrées sur les libellés : une barre sans étiquette ne se
        // dessine pas, et une étiquette sans valeur laisse un trou.
        series: series.map((entry) => ({
          name: entry.name,
          data: labels.map((_, index) => entry.data[index] ?? 0),
        })),
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
 * Volume approximatif d'une page A4, en « poids de bloc ».
 *
 * Sert à dire au modèle combien de matière produire sans lui demander de compter
 * des pixels — et au rendu à savoir s'il a de quoi remplir sa mise en page.
 */
export function estimateBlockWeight(block: Block): number {
  switch (block.kind) {
    case 'prose':
      return block.paragraphs.join(' ').length / 700;
    case 'cards':
      return block.items.length * 0.16;
    case 'table':
      return 0.2 + block.rows.length * 0.05;
    case 'metrics':
      return 0.22;
    case 'chart':
      return 0.42;
    case 'quote':
      return 0.14;
    case 'timeline':
      return block.steps.length * 0.13;
    case 'assumption':
      return 0.1;
    case 'swatches':
      return 0.3;
    case 'typeSpecimen':
      return block.specimens.length * 0.18;
    case 'logoDisplay':
      return 0.35;
    default:
      return 0.1;
  }
}
