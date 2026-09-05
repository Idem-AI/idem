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
import { Block, SectionContent, estimateBlockWeight } from './sectionContent';

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

export const LANDSCAPE_A4: PageFormat = {
  width: '297mm',
  minHeight: '210mm',
  padding: '14mm',
  orientation: 'landscape',
};

const A4 = PORTRAIT_A4;

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
      return { ...base, titleSize: s.xl, weight: 400, transform: 'uppercase', tracking: '0.45em', leading: 1.4 };
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
}

/** Bloc insécable : le paginateur ne le coupera pas en deux pages. */
const atomic = ' data-keep-together';

function renderProse(block: Extract<Block, { kind: 'prose' }>, ctx: Ctx): string {
  const { ds } = ctx;
  return block.paragraphs
    .map(
      (paragraph) =>
        `<p${style({
          margin: `0 0 ${ctx.ds.spacing}px`,
          'font-size': `${ds.typeScale.base}px`,
          'line-height': 1.55,
          color: ds.colors.ink,
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

  const cells = items
    .map((item) => {
      const strong = item.emphasis;
      return `<div${style({
        'background-color': strong ? roles.highlight : roles.panel,
        color: strong ? roles.onHighlight : ds.colors.ink,
        'border-radius': `${ds.radius}px`,
        padding: `${ds.spacing * 1.5}px`,
        'grid-column': strong && items.length > 2 ? 'span 2' : 'span 1',
      })}${atomic}>
  <div${style({
        'font-size': `${ds.typeScale.lg}px`,
        'font-weight': 700,
        'margin-bottom': `${ds.spacing * 0.5}px`,
        'line-height': 1.2,
      })}>${esc(item.title)}</div>
  <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'line-height': 1.5, opacity: strong ? 0.92 : 0.85 })}>${escCited(item.body, ctx.sourceCount)}</div>
</div>`;
    })
    .join('');

  const columns = Math.min(3, Math.max(2, Math.ceil(items.length / 2)));
  return `<div${style({
    display: 'grid',
    'grid-template-columns': `repeat(${columns}, minmax(0, 1fr))`,
    gap: `${ctx.ds.spacing}px`,
  })}>${cells}</div>`;
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
  const cells = block.items
    .map(
      (item) => `<div${style({ flex: '1 1 0', 'min-width': '0' })}>
  <div${style({
        'font-size': `${ds.typeScale['2xl']}px`,
        'font-weight': 800,
        color: roles.highlight,
        'line-height': 1,
        'letter-spacing': '-0.03em',
      })}>${esc(item.value)}</div>
  <div${style({
        'font-size': `${ds.typeScale.sm}px`,
        color: ds.colors.ink,
        'margin-top': `${ds.spacing * 0.4}px`,
        'line-height': 1.3,
      })}>${esc(item.label)}</div>
  ${
    item.note
      ? `<div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted, 'margin-top': '2px' })}>${esc(item.note)}</div>`
      : ''
  }
</div>`
    )
    .join('');

  return `<div${style({
    display: 'flex',
    gap: `${ds.spacing * 1.5}px`,
    'padding-top': `${ds.spacing}px`,
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
function renderSwatches(block: Extract<Block, { kind: 'swatches' }>, ctx: Ctx): string {
  const { ds } = ctx;
  const cells = block.items
    .map((item) => {
      // Encre lisible SUR la teinte : calculée, jamais devinée.
      const onSwatch = contrastRatio('#ffffff', item.hex) >= 4.5 ? '#ffffff' : '#000000';
      const ratio = Math.round(contrastRatio(onSwatch, item.hex) * 10) / 10;
      return `<div${style({ flex: '1 1 0', 'min-width': '0' })}>
  <div${style({
        'background-color': item.hex,
        color: onSwatch,
        height: '26mm',
        'border-radius': `${ds.radius}px`,
        display: 'flex',
        'align-items': 'flex-end',
        padding: `${ds.spacing * 0.6}px`,
        'font-size': `${ds.typeScale.xs}px`,
        'font-weight': 700,
        border: `1px solid ${ds.colors.rule}`,
      })}>${esc(item.hex.toUpperCase())}</div>
  <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'font-weight': 600, 'margin-top': '4px', color: ds.colors.ink })}>${esc(item.name)}</div>
  ${item.role ? `<div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>${esc(item.role)}</div>` : ''}
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted })}>contraste ${ratio}:1</div>
</div>`;
    })
    .join('');

  return `<div${style({ display: 'flex', gap: `${ds.spacing}px` })}${atomic}>${cells}</div>`;
}

/** Spécimen typographique, rendu DANS la police réelle. */
function renderTypeSpecimen(
  block: Extract<Block, { kind: 'typeSpecimen' }>,
  ctx: Ctx
): string {
  const { ds } = ctx;
  return block.specimens
    .map(
      (specimen) => `<div${style({
        'padding-bottom': `${ds.spacing}px`,
        'margin-bottom': `${ds.spacing}px`,
        'border-bottom': `1px solid ${ds.colors.rule}`,
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

  const cells = block.variants
    .map(
      (variant) => `<div${style({ flex: '1 1 0', 'min-width': '0' })}>
  <div${style({
        'background-color': grounds[variant.background] ?? grounds.neutral,
        border: `1px solid ${ds.colors.rule}`,
        'border-radius': `${ds.radius}px`,
        height: showcase ? '78mm' : '32mm',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        padding: `${ds.spacing}px`,
      })}>
    <img src="${esc(variant.url)}" alt="${esc(variant.label)}"${style({ 'max-height': '100%', 'max-width': '100%', width: 'auto', height: 'auto' })}>
  </div>
  <div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted, 'margin-top': '4px' })}>${esc(variant.label)}</div>
</div>`
    )
    .join('');

  return `<div${style({ display: 'flex', gap: `${ds.spacing}px` })}${atomic}>${cells}</div>`;
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
  /**
   * Grammaire de l'archétype EN PAYSAGE.
   *
   * Un format 16:9 ne se compose pas comme une A4 : empiler un titre puis un
   * flux vertical y laisse une bande vide à droite et fait déborder par le bas —
   * or le débordement y est ROGNÉ, pas paginé.
   *
   *   `side`    — titre dans une colonne, contenu dans l'autre. La grammaire
   *               naturelle de la diapositive.
   *   `stacked` — titre pleine largeur, contenu sur deux colonnes dessous. Pour
   *               les archétypes dont l'identité EST le bandeau ou le cadre.
   */
  landscape?: 'side' | 'stacked';
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
function fitTitleSize(title: string, base: number, landscape: boolean): number {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return base;

  // Largeur utile supposée, en px. Une capitale de labeur mesure ~0,52 em dans
  // un display ; on prend 0,55 pour rester du côté prudent.
  const columnPx = landscape ? 430 : 320;
  const advance = 0.55;

  const longest = Math.max(...words.map((w) => w.length));
  const byLongestWord = columnPx / (longest * advance);

  const totalChars = title.trim().length;
  const byThreeLines = (columnPx * 3) / (totalChars * advance);

  const fitted = Math.min(base, byLongestWord, byThreeLines);
  return Math.round(Math.max(base * 0.62, fitted));
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
    'font-size': `${fitTitleSize(title, type.titleSize, ctx.landscape)}px`,
    'font-weight': type.weight,
    'text-transform': type.transform,
    'letter-spacing': type.tracking,
    'line-height': type.leading,
    color,
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
    margin: `${ctx.ds.spacing}px 0 0`,
    'font-size': `${ctx.ds.typeScale.lg}px`,
    'line-height': 1.4,
    'max-width': '150mm',
    color,
  })}>${esc(content.lede)}</p>`;
}

const ARCHETYPE_RENDERERS: Record<string, ArchetypeRenderer> = {
  // A — SPLIT ÉDITORIAL : l'en-tête se partage en deux, un panneau plein tient
  // un tiers de la largeur.
  A: (content, ctx) => ({
    header: `<div${style({ display: 'grid', 'grid-template-columns': '2fr 1fr', gap: `${ctx.ds.spacing * 2}px`, 'align-items': 'end', 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  <div>${renderKicker(content, ctx, ctx.roles.highlight)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
  <div${style({ 'background-color': ctx.roles.band, height: '100%', 'min-height': '28mm', 'border-radius': `${ctx.ds.radius}px` })}></div>
</div>`,
    landscape: 'side',
  }),

  // B — BANDEAU PLEIN : le titre est posé sur une bande de couleur pleine largeur.
  B: (content, ctx) => ({
    header: `<div${style({
      'background-color': ctx.roles.band,
      color: ctx.roles.onBand,
      margin: `-${A4.padding} -${A4.padding} ${ctx.ds.spacing * 2}px`,
      padding: `${ctx.ds.spacing * 2.5}px ${A4.padding}`,
    })}>${renderKicker(content, ctx, ctx.roles.onBand)}${renderTitle(content, ctx, ctx.roles.onBand)}${renderLede(content, ctx, ctx.roles.onBand)}</div>`,
    landscape: 'stacked',
  }),

  // C — TYPOGRAPHIE DOMINANTE : le titre occupe le tiers supérieur, rien d'autre.
  C: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 3}px`, 'padding-bottom': `${ctx.ds.spacing * 1.5}px`, 'border-bottom': `1px solid ${ctx.ds.colors.rule}` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  <h1${style({
      margin: 0,
      'font-family': `'${ctx.ds.fonts.display}', ${DISPLAY_FALLBACK}`,
      'font-size': `${Math.round(ctx.type.titleSize * 1.35)}px`,
      'font-weight': 800,
      'line-height': 0.95,
      'letter-spacing': '-0.04em',
      color: ctx.roles.heading,
    })}>${esc(content.title)}</h1>
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
    landscape: 'side',
  }),

  // D — SUISSE BRUTALISTE : grille stricte, filets épais, numéro surdimensionné.
  D: (content, ctx) => ({
    header: `<div${style({ display: 'grid', 'grid-template-columns': '24mm 1fr', gap: `${ctx.ds.spacing * 1.5}px`, 'border-top': `6px solid ${ctx.roles.heading}`, 'padding-top': `${ctx.ds.spacing}px`, 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  <div${style({ 'font-size': `${ctx.ds.typeScale['3xl']}px`, 'font-weight': 900, 'line-height': 0.85, color: ctx.roles.highlight })}>${String(ctx.options.index ?? 1).padStart(2, '0')}</div>
  <div>${renderKicker(content, ctx, ctx.ds.colors.inkMuted)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
</div>`,
    landscape: 'stacked',
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
    landscape: 'side',
  }),

  // F — PROFONDEUR EN COUCHES : un panneau teinté décalé passe derrière le titre.
  F: (content, ctx) => ({
    header: `<div${style({ position: 'relative', 'margin-bottom': `${ctx.ds.spacing * 2}px`, 'padding-top': `${ctx.ds.spacing * 1.5}px` })}>
  <div${style({ position: 'absolute', top: 0, left: '-6mm', width: '60mm', height: '26mm', 'background-color': ctx.roles.panel, 'border-radius': `${ctx.ds.radius}px` })}></div>
  <div${style({ position: 'relative' })}>${renderKicker(content, ctx, ctx.roles.highlight)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
</div>`,
    landscape: 'stacked',
  }),

  // G — GRILLE DE JOURNAL : bandeau de titre lourd, flux sur deux colonnes.
  G: (content, ctx) => ({
    header: `<div${style({ 'border-top': `3px solid ${ctx.roles.heading}`, 'border-bottom': `1px solid ${ctx.roles.heading}`, padding: `${ctx.ds.spacing}px 0`, 'margin-bottom': `${ctx.ds.spacing * 1.5}px`, display: 'flex', 'align-items': 'baseline', 'justify-content': 'space-between', gap: `${ctx.ds.spacing}px` })}>
  <div>${renderTitle(content, ctx, ctx.roles.heading)}</div>
  <div${style({ 'font-size': `${ctx.ds.typeScale.xs}px`, 'text-transform': 'uppercase', 'letter-spacing': '0.14em', color: ctx.ds.colors.inkMuted, 'white-space': 'nowrap' })}>${esc(content.kicker ?? '')}</div>
</div>${renderLede(content, ctx, ctx.ds.colors.inkMuted)}`,
    landscape: 'stacked',
  }),

  // H — MOSAÏQUE : en-tête décalé, blocs légèrement désalignés.
  H: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px`, transform: 'translateX(-3mm)' })}>
  <div${style({ display: 'inline-block', 'background-color': ctx.roles.highlight, color: ctx.roles.onHighlight, padding: `4px ${ctx.ds.spacing}px`, 'border-radius': `${ctx.ds.radius}px`, 'font-size': `${ctx.ds.typeScale.xs}px`, 'font-weight': 700, 'text-transform': 'uppercase', 'letter-spacing': '0.12em', 'margin-bottom': `${ctx.ds.spacing * 0.75}px` })}>${esc(content.kicker || 'Section')}</div>
  ${renderTitle(content, ctx, ctx.roles.heading)}
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
    landscape: 'side',
  }),

  // I — SOMBRE LUMINEUX : fond profond, titre porté par l'accent.
  I: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2.5}px` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.highlight)}
  ${renderLede(content, ctx, ctx.ds.colors.ink)}
</div>`,
    landscape: 'stacked',
    backdrop: `<div${style({ position: 'absolute', top: 0, right: 0, width: '70mm', height: '70mm', 'background-color': ctx.roles.highlight, opacity: 0.08, 'border-radius': '50%', transform: 'translate(30%, -30%)' })}></div>`,
  }),

  // J — CADRE : la page entière est encadrée d'un filet, le titre s'y inscrit.
  J: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px`, 'text-align': 'center' })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.heading)}
  <div${style({ width: '24mm', height: '2px', 'background-color': ctx.roles.highlight, margin: `${ctx.ds.spacing}px auto 0` })}></div>
</div>`,
    landscape: 'stacked',
    backdrop: `<div${style({ position: 'absolute', inset: '6mm', border: `1px solid ${ctx.ds.colors.rule}`, 'border-radius': `${ctx.ds.radius}px`, 'pointer-events': 'none' })}></div>`,
  }),

  // K — ÉDITORIAL TRAMÉ : bande texturée sous le titre.
  K: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.heading)}
  <div${style({
      height: '6mm',
      'margin-top': `${ctx.ds.spacing}px`,
      'background-image': `radial-gradient(${ctx.roles.highlight} 1px, transparent 1px)`,
      'background-size': '6px 6px',
      opacity: 0.5,
    })}></div>
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
    landscape: 'stacked',
  }),

  // L — AFFICHE DE DONNÉES : le premier chiffre de la page devient le héros.
  L: (content, ctx) => {
    const metrics = content.blocks.find((block) => block.kind === 'metrics');
    const hero =
      metrics && metrics.kind === 'metrics' && metrics.items[0]
        ? `<div${style({ 'font-size': `${Math.round(ctx.ds.typeScale['4xl'] * 1.4)}px`, 'font-weight': 900, 'line-height': 0.85, color: ctx.roles.highlight, 'letter-spacing': '-0.05em' })}>${esc(metrics.items[0].value)}</div>
  <div${style({ 'font-size': `${ctx.ds.typeScale.base}px`, color: ctx.ds.colors.inkMuted, 'margin-bottom': `${ctx.ds.spacing}px` })}>${esc(metrics.items[0].label)}</div>`
        : '';
    return {
      header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${hero}
  ${renderTitle(content, ctx, ctx.roles.heading)}
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
      landscape: 'side',
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
  };

  const renderer = ARCHETYPE_RENDERERS[seed.archetype] ?? ARCHETYPE_RENDERERS[DEFAULT_ARCHETYPE];
  const chrome = renderer(content, ctx);

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
    ? fitToPage(content.blocks, page, ctx.ds, Boolean(content.lede))
    : content.blocks;

  const blocks = blockList
    .map((block, index) => {
      const html = renderBlock(block, ctx);
      if (!html) return '';
      const spacing =
        index === 0
          ? ''
          : `margin-top:${Math.round(ctx.ds.spacing * ctx.tension.gap * (cramped ? 0.9 : 1.5))}px;${separator}`;
      // `break-inside` n'est PAS posé ici : c'est le paginateur qui décide où
      // couper, et les blocs qui ne doivent jamais l'être portent déjà
      // `data-keep-together`.
      return spacing ? `<div style="${spacing}">${html}</div>` : `<div>${html}</div>`;
    })
    .filter(Boolean);

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
    const sideBySide = (chrome.landscape ?? 'side') === 'side';
    const body = sideBySide
      ? `<div${style({ display: 'grid', 'grid-template-columns': '5fr 7fr', gap: `${ctx.ds.spacing * 2}px`, 'align-items': 'start' })}>
  <div>${chrome.header}</div>
  <div>${blocks.join('\n')}</div>
</div>`
      : `${chrome.header}
<div${style({
          display: 'grid',
          'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
          gap: `${ctx.ds.spacing * 1.5}px`,
          'align-items': 'start',
        })}>${blocks.join('\n')}</div>`;

    return `${fontLinks(ctx.ds)}<div${style({ ...rootStyle, display: 'flex', 'flex-direction': 'column' })}>
${chrome.backdrop ?? ''}
<div${style({ flex: '1 1 auto', 'min-height': 0 })}>
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
  hasLede: boolean
): Block[] {
  const mm = (value: string): number => Number.parseFloat(value.replace('mm', '')) || 0;

  // Surface utile du format, rapportée à celle d'une A4 portrait (186 × 273 mm).
  const pad = mm(page.padding);
  const usable = (mm(page.width) - 2 * pad) * (mm(page.minHeight) - 2 * pad);
  const a4Usable = (210 - 24) * (297 - 24);
  // `tighten()` réduit corps et rythme d'environ 15 % : autant de matière en plus.
  const capacityRatio = (usable / a4Usable) * 1.15;

  // L'en-tête et le pied occupent la page avant le premier bloc.
  const chrome = 0.16 + (hasLede ? 0.05 : 0);
  // Marge de sûreté : l'estimation ignore les retours à la ligne, la casse et
  // les polices réelles. 10 % de réserve évitent le débordement d'un cheveu.
  const budget = Math.max(0.2, capacityRatio * 0.9 - chrome);

  const kept: Block[] = [];
  let used = 0;

  for (const block of blocks) {
    const weight = estimateBlockWeight(block);

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
        `(budget ${budget.toFixed(2)} page, format ${page.width}×${page.minHeight}). ` +
        `Réduire le volume demandé dans le brief si cela se répète.`
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
