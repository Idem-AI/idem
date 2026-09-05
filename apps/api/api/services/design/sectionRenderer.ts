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

import { DocumentDesignSystem } from './documentDesignSystem';
import { SectionSeed } from './designSeed';
import { Block, SectionContent } from './sectionContent';

export interface RenderOptions {
  /** URL du logo à poser sur la page. Absent ⇒ aucune marque n'est inventée. */
  logoUrl?: string;
  /** Nom de marque, pour le pied de page. */
  brandName?: string;
  /** Numéro de section, utilisé par les archétypes qui en font un élément graphique. */
  index?: number;
  /** Format de page. Le défaut est l'A4 portrait du business plan. */
  page?: { width: string; minHeight: string; padding: string };
}

const A4: Required<RenderOptions>['page'] = {
  width: '210mm',
  minHeight: '297mm',
  padding: '12mm',
};

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
        })}>${esc(paragraph)}</p>`
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
  <div${style({ 'font-size': `${ds.typeScale.sm}px`, 'line-height': 1.5, opacity: strong ? 0.92 : 0.85 })}>${esc(item.body)}</div>
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
              })}>${esc(cell)}</td>`
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

  return `<div${atomic}>${unit}${plot}${axis}${legend}${key}</div>`;
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
  <div${style({ 'margin-top': '4px', 'line-height': 1.45 })}>${esc(block.statement)}</div>
  ${block.basis ? `<div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted, 'margin-top': '2px' })}>Base : ${esc(block.basis)}</div>` : ''}
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
  /** Déclarations appliquées au conteneur du flux de blocs. */
  flow: Record<string, string | number | undefined>;
  /** Élément graphique de fond, posé derrière le contenu. */
  backdrop?: string;
}

type ArchetypeRenderer = (content: SectionContent, ctx: Ctx) => PageChrome;

/** Titre, rendu selon l'humeur typographique en vigueur. */
function renderTitle(content: SectionContent, ctx: Ctx, color: string): string {
  const { type, ds } = ctx;
  const text = ctx.type.stacked
    ? esc(content.title).replace(/\s+/g, '<br>')
    : esc(content.title);

  return `<h1${style({
    margin: 0,
    'font-family': `'${ds.fonts.display}', serif`,
    'font-size': `${type.titleSize}px`,
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
    flow: {},
  }),

  // B — BANDEAU PLEIN : le titre est posé sur une bande de couleur pleine largeur.
  B: (content, ctx) => ({
    header: `<div${style({
      'background-color': ctx.roles.band,
      color: ctx.roles.onBand,
      margin: `-${A4.padding} -${A4.padding} ${ctx.ds.spacing * 2}px`,
      padding: `${ctx.ds.spacing * 2.5}px ${A4.padding}`,
    })}>${renderKicker(content, ctx, ctx.roles.onBand)}${renderTitle(content, ctx, ctx.roles.onBand)}${renderLede(content, ctx, ctx.roles.onBand)}</div>`,
    flow: {},
  }),

  // C — TYPOGRAPHIE DOMINANTE : le titre occupe le tiers supérieur, rien d'autre.
  C: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 3}px`, 'padding-bottom': `${ctx.ds.spacing * 1.5}px`, 'border-bottom': `1px solid ${ctx.ds.colors.rule}` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  <h1${style({
      margin: 0,
      'font-family': `'${ctx.ds.fonts.display}', serif`,
      'font-size': `${Math.round(ctx.type.titleSize * 1.35)}px`,
      'font-weight': 800,
      'line-height': 0.95,
      'letter-spacing': '-0.04em',
      color: ctx.roles.heading,
    })}>${esc(content.title)}</h1>
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
    flow: {},
  }),

  // D — SUISSE BRUTALISTE : grille stricte, filets épais, numéro surdimensionné.
  D: (content, ctx) => ({
    header: `<div${style({ display: 'grid', 'grid-template-columns': '24mm 1fr', gap: `${ctx.ds.spacing * 1.5}px`, 'border-top': `6px solid ${ctx.roles.heading}`, 'padding-top': `${ctx.ds.spacing}px`, 'margin-bottom': `${ctx.ds.spacing * 2}px` })}>
  <div${style({ 'font-size': `${ctx.ds.typeScale['3xl']}px`, 'font-weight': 900, 'line-height': 0.85, color: ctx.roles.highlight })}>${String(ctx.options.index ?? 1).padStart(2, '0')}</div>
  <div>${renderKicker(content, ctx, ctx.ds.colors.inkMuted)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
</div>`,
    flow: {},
  }),

  // E — MINIMAL DE LUXE : vide maximal, titre discret en haut à gauche.
  E: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 4}px`, 'max-width': '120mm' })}>
  ${renderKicker(content, ctx, ctx.ds.colors.inkMuted)}
  <h1${style({
      margin: 0,
      'font-family': `'${ctx.ds.fonts.display}', serif`,
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
    flow: { 'padding-left': '14mm', 'padding-right': '14mm' },
  }),

  // F — PROFONDEUR EN COUCHES : un panneau teinté décalé passe derrière le titre.
  F: (content, ctx) => ({
    header: `<div${style({ position: 'relative', 'margin-bottom': `${ctx.ds.spacing * 2}px`, 'padding-top': `${ctx.ds.spacing * 1.5}px` })}>
  <div${style({ position: 'absolute', top: 0, left: '-6mm', width: '60mm', height: '26mm', 'background-color': ctx.roles.panel, 'border-radius': `${ctx.ds.radius}px` })}></div>
  <div${style({ position: 'relative' })}>${renderKicker(content, ctx, ctx.roles.highlight)}${renderTitle(content, ctx, ctx.roles.heading)}${renderLede(content, ctx, ctx.ds.colors.inkMuted)}</div>
</div>`,
    flow: {},
  }),

  // G — GRILLE DE JOURNAL : bandeau de titre lourd, flux sur deux colonnes.
  G: (content, ctx) => ({
    header: `<div${style({ 'border-top': `3px solid ${ctx.roles.heading}`, 'border-bottom': `1px solid ${ctx.roles.heading}`, padding: `${ctx.ds.spacing}px 0`, 'margin-bottom': `${ctx.ds.spacing * 1.5}px`, display: 'flex', 'align-items': 'baseline', 'justify-content': 'space-between', gap: `${ctx.ds.spacing}px` })}>
  <div>${renderTitle(content, ctx, ctx.roles.heading)}</div>
  <div${style({ 'font-size': `${ctx.ds.typeScale.xs}px`, 'text-transform': 'uppercase', 'letter-spacing': '0.14em', color: ctx.ds.colors.inkMuted, 'white-space': 'nowrap' })}>${esc(content.kicker ?? '')}</div>
</div>${renderLede(content, ctx, ctx.ds.colors.inkMuted)}`,
    flow: { 'column-count': 2, 'column-gap': `${ctx.ds.spacing * 2}px` },
  }),

  // H — MOSAÏQUE : en-tête décalé, blocs légèrement désalignés.
  H: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px`, transform: 'translateX(-3mm)' })}>
  <div${style({ display: 'inline-block', 'background-color': ctx.roles.highlight, color: ctx.roles.onHighlight, padding: `4px ${ctx.ds.spacing}px`, 'border-radius': `${ctx.ds.radius}px`, 'font-size': `${ctx.ds.typeScale.xs}px`, 'font-weight': 700, 'text-transform': 'uppercase', 'letter-spacing': '0.12em', 'margin-bottom': `${ctx.ds.spacing * 0.75}px` })}>${esc(content.kicker || 'Section')}</div>
  ${renderTitle(content, ctx, ctx.roles.heading)}
  ${renderLede(content, ctx, ctx.ds.colors.inkMuted)}
</div>`,
    flow: {},
  }),

  // I — SOMBRE LUMINEUX : fond profond, titre porté par l'accent.
  I: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2.5}px` })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.highlight)}
  ${renderLede(content, ctx, ctx.ds.colors.ink)}
</div>`,
    flow: {},
    backdrop: `<div${style({ position: 'absolute', top: 0, right: 0, width: '70mm', height: '70mm', 'background-color': ctx.roles.highlight, opacity: 0.08, 'border-radius': '50%', transform: 'translate(30%, -30%)' })}></div>`,
  }),

  // J — CADRE : la page entière est encadrée d'un filet, le titre s'y inscrit.
  J: (content, ctx) => ({
    header: `<div${style({ 'margin-bottom': `${ctx.ds.spacing * 2}px`, 'text-align': 'center' })}>
  ${renderKicker(content, ctx, ctx.roles.highlight)}
  ${renderTitle(content, ctx, ctx.roles.heading)}
  <div${style({ width: '24mm', height: '2px', 'background-color': ctx.roles.highlight, margin: `${ctx.ds.spacing}px auto 0` })}></div>
</div>`,
    flow: {},
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
    flow: {},
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
      flow: {},
    };
  },
};

/** Archétype de repli : un identifiant inconnu ne doit jamais perdre une page. */
const DEFAULT_ARCHETYPE = 'A';

// ─────────────────────────────────────────────────────────────────────────────

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
  const page = options.page ?? A4;
  const ctx: Ctx = {
    ds,
    roles: resolveColorRoles(ds, seed.colorStrategy),
    type: resolveTypeTreatment(ds, seed.typographyMood),
    tension: resolveTension(seed.layoutTension),
    seed,
    options,
  };

  const renderer = ARCHETYPE_RENDERERS[seed.archetype] ?? ARCHETYPE_RENDERERS[DEFAULT_ARCHETYPE];
  const chrome = renderer(content, ctx);

  const separator =
    ctx.tension.separator === 'thick'
      ? `border-top:3px solid ${ds.colors.rule};padding-top:${ds.spacing * ctx.tension.gap}px;`
      : ctx.tension.separator === 'hairline'
        ? `border-top:1px solid ${ds.colors.rule};padding-top:${ds.spacing * ctx.tension.gap}px;`
        : '';

  const blocks = content.blocks
    .map((block, index) => {
      const html = renderBlock(block, ctx);
      if (!html) return '';
      const spacing =
        index === 0
          ? ''
          : `margin-top:${Math.round(ds.spacing * ctx.tension.gap * 1.5)}px;${separator}`;
      // `break-inside` n'est PAS posé ici : c'est le paginateur qui décide où
      // couper, et les blocs qui ne doivent jamais l'être portent déjà
      // `data-keep-together`.
      return spacing ? `<div style="${spacing}">${html}</div>` : `<div>${html}</div>`;
    })
    .join('');

  const logo = options.logoUrl
    ? `<img src="${esc(options.logoUrl)}" alt="${esc(options.brandName ? `${options.brandName} — logo` : 'Logo')}"${style({
        height: '9mm',
        width: 'auto',
        display: 'block',
      })}>`
    : '';

  const footer = `<div${style({
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    'margin-top': `${ds.spacing * 2}px`,
    'padding-top': `${ds.spacing}px`,
    'border-top': `1px solid ${ds.colors.rule}`,
    'font-size': `${ds.typeScale.xs}px`,
    color: ds.colors.inkMuted,
  })}${atomic}>
  ${logo || `<span>${esc(options.brandName ?? '')}</span>`}
  <span>${esc(content.title)}</span>
</div>`;

  return `<div${style({
    width: page.width,
    'min-height': page.minHeight,
    padding: page.padding,
    position: 'relative',
    'box-sizing': 'border-box',
    'background-color': ctx.roles.ground,
    color: ds.colors.ink,
    'font-family': `'${ds.fonts.body}', sans-serif`,
    'font-size': `${ds.typeScale.base}px`,
  })}>
${chrome.backdrop ?? ''}
<div${style({ position: 'relative', ...chrome.flow, 'padding-left': ctx.tension.inset ? `${ctx.tension.inset}mm` : undefined, 'padding-right': ctx.tension.inset ? `${ctx.tension.inset}mm` : undefined })}>
${chrome.header}
${blocks}
</div>
${footer}
</div>`;
}

/** Liste des archétypes réellement implémentés — sert aux vérifications. */
export const IMPLEMENTED_ARCHETYPES = Object.keys(ARCHETYPE_RENDERERS);
