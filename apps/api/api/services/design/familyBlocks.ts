/**
 * Les DESSINS DE BLOCS de chaque famille de mise en page.
 *
 * ── LE DÉFAUT QUE CE MODULE CORRIGE ─────────────────────────────────────────
 *
 * Le rendu déclarait, en toutes lettres : « un tableau se dessine de la même
 * façon partout, c'est la page qui change ». C'était vrai, et c'était le
 * problème. Les blocs occupent l'essentiel d'une page de business plan ; les
 * dessiner à l'identique pour tous les projets, c'était livrer le même document
 * sous des couleurs différentes.
 *
 * Chaque fonction ci-dessous est un dessin DISTINCT — une autre construction,
 * pas un autre réglage du même dessin. Les dessins historiques (rangée sous
 * filet d'accent, tableau zébré, panneaux, rail, citation à liseré, hypothèse
 * entre filets, prose simple) restent dans `sectionRenderer.ts` : ils sont
 * devenus UNE option parmi d'autres.
 *
 * ── CE QUI NE CHANGE PAS D'UN DESSIN À L'AUTRE ──────────────────────────────
 *
 *   · les couleurs viennent du design system, jamais d'une valeur écrite ici ;
 *   · le texte du modèle traverse `esc` / `escCited`, sans exception ;
 *   · un bloc qui ne doit pas être coupé porte `data-keep-together` ; un tableau,
 *     jamais — le paginateur sait le couper et répéter son en-tête ;
 *   · une rangée de cellules comparables est en `subgrid`, pour que libellés et
 *     notes s'alignent quoi qu'il arrive au texte ;
 *   · un chiffre-clé ne se coupe pas : sa taille est calculée pour tenir dans la
 *     colonne qui le porte.
 */

import { Block } from './sectionContent';
import { balancedColumns, MEASURE, PROSE_WRAP, snap, subgridRows } from './layoutGrid';
import {
  atomic,
  cornerRadius,
  Ctx,
  displayFont,
  esc,
  escCited,
  figureAdvance,
  figureFont,
  figureInk,
  formatIndex,
  labelStyle,
  MM_TO_PX,
  readableOn,
  ruleLine,
  softRule,
  style,
} from './renderKit';

type Of<K extends Block['kind']> = Extract<Block, { kind: K }>;
type Css = Record<string, string | number | undefined>;

// ─────────────────────────────────────────────────────────────────────────────
// Outils communs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corps d'un chiffre qui doit tenir sur UNE ligne dans `columnPx`.
 *
 * 0,58 em par signe couvre un chiffre, une lettre et l'espace fine des milliers
 * dans la police du TEXTE (même estimation que `renderMetrics`). La police de
 * TITRAGE en graisse forte est bien plus large : « 2,3 Md FCFA » composé en
 * Fraunces 800 mordait sur le libellé voisin, vu sur la planche contact. On
 * compte donc 0,7 em pour elle.
 *
 * Le plancher garde le chiffre plus gros que son libellé — sauf si la colonne
 * ne le permet pas : un chiffre qui déborde est pire qu'un chiffre modeste.
 */
function fitFigure(ctx: Ctx, values: string[], columnPx: number, max: number, min: number): number {
  const longest = Math.max(1, ...values.map((value) => value.length));
  const fitted = Math.floor(columnPx / (longest * figureAdvance(ctx)));
  return Math.max(Math.min(min, fitted), Math.min(max, fitted));
}

function figure(ctx: Ctx, value: string, px: number, color: string, weight = 800): string {
  return `<div${style({
    ...figureFont(ctx, weight),
    'font-size': `${px}px`,
    'line-height': 1,
    color,
    'white-space': 'nowrap',
    'font-variant-numeric': 'tabular-nums',
  })}>${esc(value)}</div>`;
}

/**
 * Carte mise en avant. Si le modèle n'en a désigné aucune, c'est la première :
 * une rangée sans hiérarchie est le tic le plus reconnaissable d'une page
 * générée, et la hiérarchie se pose en code (même règle que `renderCards`).
 */
function withEmphasis<T extends { emphasis?: boolean }>(items: T[]): Array<T & { strong: boolean }> {
  const declared = items.some((item) => item.emphasis);
  return items.map((item, index) => ({ ...item, strong: declared ? Boolean(item.emphasis) : index === 0 }));
}

const small = (ctx: Ctx, color: string, extra: Css = {}): Css => ({
  'font-size': `${ctx.ds.typeScale.sm}px`,
  'line-height': 1.45,
  color,
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────
// Chiffres-clés
// ─────────────────────────────────────────────────────────────────────────────

export function renderFamilyMetrics(block: Of<'metrics'>, ctx: Ctx): string {
  switch (ctx.family.metrics) {
    case 'ledger':
      return metricsLedger(block, ctx);
    case 'hero-list':
      return metricsHeroList(block, ctx);
    case 'tiles':
      return metricsTiles(block, ctx);
    case 'divided':
      return metricsDivided(block, ctx);
    case 'band':
      return metricsBand(block, ctx);
    case 'label-first':
      return metricsLabelFirst(block, ctx);
    case 'stacked-rows':
      return metricsStackedRows(block, ctx);
    case 'inline-sentence':
      return metricsInline(block, ctx);
    case 'stamped':
      return metricsStamped(block, ctx);
    case 'staircase':
      return metricsStaircase(block, ctx);
    default:
      return '';
  }
}

/**
 * Sur une page ROGNÉE (charte, deck), les dessins à une ligne par chiffre se
 * resserrent : trois lignes composées comme en document paginé prenaient la
 * moitié d'une diapositive, et la page débordait sous son pied (`check:fit`).
 */
const compact = (ctx: Ctx): boolean => ctx.options.multiPage === false;

/** Registre : une ligne par chiffre, libellé à gauche, valeur alignée à droite. */
function metricsLedger(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const tight = compact(ctx);
  const px = fitFigure(
    ctx,
    block.items.map((item) => item.value),
    ctx.contentWidthPx * 0.4,
    tight ? ds.typeScale.xl : ds.typeScale['2xl'],
    tight ? ds.typeScale.base : ds.typeScale.lg
  );
  const rows = block.items
    .map(
      (item, index) => `<div${style({
        display: 'grid',
        'grid-template-columns': 'minmax(0, 1fr) auto',
        'column-gap': `${snap(ds.spacing * 1.5)}px`,
        'align-items': 'baseline',
        padding: `${snap(ds.spacing * (tight ? 0.35 : 0.6))}px 0`,
        'border-top': index === 0 ? ruleLine(ctx, 'strong') : softRule(ctx),
      })}>
  <div${style({ 'min-width': '0' })}>
    <div${style({ 'font-size': `${tight ? ds.typeScale.sm : ds.typeScale.base}px`, 'line-height': 1.3, color: ds.colors.ink })}>${esc(item.label)}${
      // Resserré, la note rejoint la ligne du libellé : une ligne de moins par chiffre.
      tight && item.note ? `<span${style({ color: ds.colors.inkMuted })}> · ${esc(item.note)}</span>` : ''
    }</div>
    ${!tight && item.note ? `<div${style({ ...labelStyle(ctx, ds.colors.inkMuted), 'margin-top': '2px' })}>${esc(item.note)}</div>` : ''}
  </div>
  ${figure(ctx, item.value, px, figureInk(ctx), 700)}
</div>`
    )
    .join('');
  return `<div${style({ 'border-bottom': ruleLine(ctx, 'strong') })}${atomic}>${rows}</div>`;
}

/** Un chiffre héros à gauche, les suivants en liste serrée à droite. */
function metricsHeroList(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const [hero, ...rest] = block.items;
  const gap = snap(ds.spacing * 2);
  const heroColumnPx = rest.length > 0 ? (ctx.contentWidthPx - gap) * 0.52 : ctx.contentWidthPx;
  const heroPx = fitFigure(ctx, [hero.value], heroColumnPx * 0.96, Math.round(ds.typeScale['4xl'] * 1.15), ds.typeScale.xl);

  const heroHtml = `<div${style({ 'min-width': '0' })}>
  ${figure(ctx, hero.value, heroPx, figureInk(ctx), 800)}
  <div${style({
    'font-size': `${ds.typeScale.base}px`,
    'line-height': 1.35,
    color: ds.colors.ink,
    // Le chiffre est composé serré (`line-height: 1`) : ses jambages mordraient
    // sur le libellé sans ce retrait proportionnel à son corps.
    'margin-top': `${Math.round(heroPx * 0.14)}px`,
    'text-wrap': 'balance',
  })}>${esc(hero.label)}</div>
  ${hero.note ? `<div${style({ ...labelStyle(ctx, ds.colors.inkMuted), 'margin-top': '2px' })}>${esc(hero.note)}</div>` : ''}
</div>`;

  if (rest.length === 0) return `<div${atomic}>${heroHtml}</div>`;

  const listPx = fitFigure(ctx, rest.map((item) => item.value), (ctx.contentWidthPx - gap) * 0.48 * 0.42, ds.typeScale.xl, ds.typeScale.base);
  const list = rest
    .map(
      (item, index) => `<div${style({
        display: 'grid',
        'grid-template-columns': 'auto minmax(0, 1fr)',
        'column-gap': `${snap(ds.spacing)}px`,
        'align-items': 'baseline',
        padding: `${snap(ds.spacing * 0.5)}px 0`,
        'border-top': index === 0 ? ruleLine(ctx, 'strong') : softRule(ctx),
      })}>
  ${figure(ctx, item.value, listPx, ds.colors.ink, 700)}
  <div${style(small(ctx, ds.colors.ink, { 'min-width': '0', 'line-height': 1.35 }))}>${esc(item.label)}${
    item.note ? `<span${style({ color: ds.colors.inkMuted })}> · ${esc(item.note)}</span>` : ''
  }</div>
</div>`
    )
    .join('');

  return `<div${style({
    display: 'grid',
    'grid-template-columns': 'minmax(0, 1.08fr) minmax(0, 1fr)',
    'column-gap': `${gap}px`,
    'align-items': 'end',
  })}${atomic}>${heroHtml}<div${style({ 'min-width': '0' })}>${list}</div></div>`;
}

/** Tuiles teintées, en rangée alignée. */
function metricsTiles(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const columns = balancedColumns(block.items.length);
  const gap = snap(ds.spacing);
  const pad = snap(ds.spacing * 1.2);
  const grid = subgridRows(3, columns, gap);
  const cellPx = (ctx.contentWidthPx - gap * (columns - 1)) / columns - 2 * pad;
  const px = fitFigure(ctx, block.items.map((item) => item.value), cellPx, ds.typeScale['2xl'], ds.typeScale.lg);
  const cells = block.items
    .map(
      (item) => `<div${style({
        ...grid.cell,
        'background-color': ctx.roles.panel,
        padding: `${pad}px`,
        'border-radius': `${cornerRadius(ctx)}px`,
        'row-gap': `${snap(ds.spacing * 0.35)}px`,
      })}>
  ${figure(ctx, item.value, px, figureInk(ctx), 800)}
  <div${style(small(ctx, ds.colors.ink, { 'line-height': 1.3, 'text-wrap': 'balance' }))}>${esc(item.label)}</div>
  <div${style(labelStyle(ctx, ds.colors.inkMuted))}>${item.note ? esc(item.note) : ''}</div>
</div>`
    )
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Colonnes séparées par des filets verticaux, sans filet de tête. */
function metricsDivided(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const columns = balancedColumns(block.items.length);
  const gap = snap(ds.spacing * 1.5);
  const grid = subgridRows(3, columns, gap);
  const cellPx = (ctx.contentWidthPx - gap * (columns - 1)) / columns - gap;
  const px = fitFigure(ctx, block.items.map((item) => item.value), cellPx, ds.typeScale['2xl'], ds.typeScale.lg);
  const cells = block.items
    .map((item, index) => {
      const first = index % columns === 0;
      return `<div${style({
        ...grid.cell,
        'border-left': first ? undefined : softRule(ctx),
        'padding-left': first ? undefined : `${gap}px`,
      })}>
  ${figure(ctx, item.value, px, figureInk(ctx), 600)}
  <div${style(small(ctx, ds.colors.ink, { 'line-height': 1.3, 'text-wrap': 'balance' }))}>${esc(item.label)}</div>
  <div${style(labelStyle(ctx, ds.colors.inkMuted))}>${item.note ? esc(item.note) : ''}</div>
</div>`;
    })
    .join('');
  return `<div${style({ ...grid.container, padding: `${snap(ds.spacing * 0.5)}px 0` })}${atomic}>${cells}</div>`;
}

/** Une bande de couleur pleine porte toute la rangée. L'encre y est mesurée. */
function metricsBand(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const ground = ctx.roles.band;
  const ink = readableOn(ds, ground);
  const columns = balancedColumns(block.items.length);
  const gap = snap(ds.spacing * 1.5);
  const padX = snap(ds.spacing * 1.8);
  const grid = subgridRows(3, columns, gap);
  const cellPx = (ctx.contentWidthPx - 2 * padX - gap * (columns - 1)) / columns;
  const px = fitFigure(ctx, block.items.map((item) => item.value), cellPx, ds.typeScale['2xl'], ds.typeScale.lg);
  const cells = block.items
    .map(
      (item) => `<div${style(grid.cell)}>
  ${figure(ctx, item.value, px, ink, 800)}
  <div${style(small(ctx, ink, { 'line-height': 1.3, 'text-wrap': 'balance' }))}>${esc(item.label)}</div>
  <div${style({ ...labelStyle(ctx, ink), opacity: 0.85 })}>${item.note ? esc(item.note) : ''}</div>
</div>`
    )
    .join('');
  return `<div${style({
    ...grid.container,
    'background-color': ground,
    color: ink,
    padding: `${snap(ds.spacing * 1.5)}px ${padX}px`,
    'border-radius': `${cornerRadius(ctx)}px`,
  })}${atomic}>${cells}</div>`;
}

/** Le libellé d'abord, puis la valeur, soulignée d'un trait épais. */
function metricsLabelFirst(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const columns = balancedColumns(block.items.length);
  const gap = snap(ds.spacing * 1.5);
  const grid = subgridRows(3, columns, gap);
  const cellPx = (ctx.contentWidthPx - gap * (columns - 1)) / columns;
  const px = fitFigure(ctx, block.items.map((item) => item.value), cellPx, ds.typeScale['2xl'], ds.typeScale.lg);
  const cells = block.items
    .map(
      (item) => `<div${style(grid.cell)}>
  <div${style({ ...labelStyle(ctx, ds.colors.inkMuted), 'text-wrap': 'balance' })}>${esc(item.label)}</div>
  <div${style({ 'justify-self': 'start', 'max-width': '100%', 'padding-bottom': '3px', 'border-bottom': `3px solid ${ctx.roles.highlight}` })}>${figure(ctx, item.value, px, figureInk(ctx), 800)}</div>
  <div${style(small(ctx, ds.colors.inkMuted, { 'font-size': `${ds.typeScale.xs}px` }))}>${item.note ? esc(item.note) : ''}</div>
</div>`
    )
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Valeur en grand dans une colonne gauche, libellé à côté, ligne par ligne. */
function metricsStackedRows(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const tight = compact(ctx);
  const px = fitFigure(
    ctx,
    block.items.map((item) => item.value),
    ctx.contentWidthPx * 0.36,
    tight ? ds.typeScale.xl : ds.typeScale['3xl'],
    tight ? ds.typeScale.lg : ds.typeScale.xl
  );
  const rows = block.items
    .map(
      (item) => `<div${style({
        display: 'grid',
        'grid-template-columns': '38% minmax(0, 1fr)',
        'column-gap': `${snap(ds.spacing * 1.5)}px`,
        'align-items': 'center',
        padding: `${snap(ds.spacing * (tight ? 0.4 : 0.7))}px 0`,
        'border-bottom': softRule(ctx),
      })}>
  ${figure(ctx, item.value, px, figureInk(ctx), 800)}
  <div${style({ 'min-width': '0' })}>
    <div${style({ 'font-size': `${tight ? ds.typeScale.sm : ds.typeScale.base}px`, 'line-height': 1.3, color: ds.colors.ink })}>${esc(item.label)}${
      tight && item.note ? `<span${style({ color: ds.colors.inkMuted })}> · ${esc(item.note)}</span>` : ''
    }</div>
    ${!tight && item.note ? `<div${style({ ...labelStyle(ctx, ds.colors.inkMuted), 'margin-top': '2px' })}>${esc(item.note)}</div>` : ''}
  </div>
</div>`
    )
    .join('');
  return `<div${style({ 'border-top': ruleLine(ctx, 'strong') })}${atomic}>${rows}</div>`;
}

/** Les chiffres dits en UNE phrase : la valeur en relief, son libellé à la suite. */
function metricsInline(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const size = compact(ctx) ? ds.typeScale.base : ds.typeScale.lg;
  const parts = block.items.map(
    (item) =>
      `<span${style({
        ...figureFont(ctx, 700),
        'font-size': `${Math.round(size * 1.4)}px`,
        color: figureInk(ctx),
        'white-space': 'nowrap',
        'font-variant-numeric': 'tabular-nums',
      })}>${esc(item.value)}</span> ${esc(item.label)}${
        item.note ? `<span${style({ color: ds.colors.inkMuted })}> (${esc(item.note)})</span>` : ''
      }`
  );
  return `<p${style({
    margin: 0,
    padding: `${snap(ds.spacing * 0.6)}px 0`,
    'border-top': ruleLine(ctx, 'strong'),
    'border-bottom': softRule(ctx),
    'font-size': `${size}px`,
    'line-height': 1.6,
    color: ds.colors.ink,
    'max-width': '64ch',
    'text-wrap': 'pretty',
  })}${atomic}>${parts.join(`<span${style({ color: ctx.roles.highlight })}>&nbsp;· </span>`)}</p>`;
}

/** Chaque valeur dans un cartouche tracé ; le libellé dessous, hors du cadre. */
function metricsStamped(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const columns = balancedColumns(block.items.length);
  const gap = snap(ds.spacing * 1.5);
  const pad = snap(ds.spacing * (compact(ctx) ? 0.6 : 0.9));
  const grid = subgridRows(3, columns, gap);
  const cellPx = (ctx.contentWidthPx - gap * (columns - 1)) / columns - 2 * pad - 4;
  const px = fitFigure(ctx, block.items.map((item) => item.value), cellPx, ds.typeScale['2xl'], ds.typeScale.lg);
  const cells = block.items
    .map(
      (item) => `<div${style(grid.cell)}>
  <div${style({ border: `2px solid ${ds.colors.ink}`, 'border-radius': `${cornerRadius(ctx)}px`, padding: `${pad}px`, display: 'flex', 'justify-content': 'center' })}>${figure(ctx, item.value, px, figureInk(ctx), 800)}</div>
  <div${style(small(ctx, ds.colors.ink, { 'text-align': 'center', 'line-height': 1.3, 'text-wrap': 'balance' }))}>${esc(item.label)}</div>
  <div${style({ ...labelStyle(ctx, ds.colors.inkMuted), 'text-align': 'center' })}>${item.note ? esc(item.note) : ''}</div>
</div>`
    )
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Lignes décalées en escalier : la rangée se lit comme une progression. */
function metricsStaircase(block: Of<'metrics'>, ctx: Ctx): string {
  const { ds } = ctx;
  const tight = compact(ctx);
  const count = block.items.length;
  const step = count > 1 ? Math.min(0.12, 0.36 / (count - 1)) : 0;
  const px = fitFigure(ctx, block.items.map((item) => item.value), ctx.contentWidthPx * 0.3, tight ? ds.typeScale.xl : ds.typeScale['2xl'], ds.typeScale.lg);
  const rows = block.items
    .map(
      (item, index) => `<div${style({
        'margin-left': `${Math.round(index * step * 100)}%`,
        display: 'grid',
        'grid-template-columns': 'auto minmax(0, 1fr)',
        'column-gap': `${snap(ds.spacing)}px`,
        'align-items': 'baseline',
        padding: `${snap(ds.spacing * (tight ? 0.3 : 0.5))}px 0`,
        'border-bottom': softRule(ctx),
      })}>
  ${figure(ctx, item.value, px, figureInk(ctx), 800)}
  <div${style(small(ctx, ds.colors.ink, { 'min-width': '0', 'line-height': 1.3 }))}>${esc(item.label)}${
    item.note ? `<span${style({ color: ds.colors.inkMuted })}> · ${esc(item.note)}</span>` : ''
  }</div>
</div>`
    )
    .join('');
  return `<div${atomic}>${rows}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tableaux
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cellule NUMÉRIQUE : un nombre, éventuellement signé, suivi d'une unité courte.
 *
 * Une colonne de chiffres alignée à gauche oblige à relire chaque ligne pour
 * comparer des ordres de grandeur ; alignée à droite, en chiffres tabulaires,
 * elle se compare d'un regard. C'est la règle de tout tableau comptable.
 */
const NUMERIC_CELL =
  /^[-+−–(]?\s*\d[\d\s  .,]*\s*(?:%|‰|k|K|M|Md|Mds|Mrd|Mrds|FCFA|XAF|XOF|€|\$|USD|EUR|t|kg|x|×|pts?|ans?|mois|j)?\s*\)?$/;

function numericColumns(block: Of<'table'>): boolean[] {
  return block.headers.map((_, column) => {
    if (column === 0) return false;
    const cells = block.rows
      .map((row) => (row[column] ?? '').replace(/\s*\[s\d+\]/g, '').trim())
      .filter(Boolean);
    return cells.length > 0 && cells.every((cell) => NUMERIC_CELL.test(cell));
  });
}

interface TableDrawing {
  table?: Css;
  th: (column: number) => Css;
  td: (row: number, column: number, lastRow: boolean, lastColumn: boolean) => Css;
  caption?: Css;
}

function drawTable(block: Of<'table'>, ctx: Ctx, drawing: TableDrawing): string {
  const { ds } = ctx;
  const numeric = numericColumns(block);
  const lastColumn = block.headers.length - 1;
  const head = block.headers
    .map(
      (header, column) =>
        `<th${style({ 'text-align': numeric[column] ? 'right' : 'left', ...drawing.th(column) })}>${esc(header)}</th>`
    )
    .join('');
  const body = block.rows
    .map(
      (row, rowIndex) =>
        `<tr>${row
          .map(
            (cell, column) =>
              `<td${style({
                'text-align': numeric[column] ? 'right' : 'left',
                'font-variant-numeric': numeric[column] ? 'tabular-nums' : undefined,
                'font-size': `${ds.typeScale.sm}px`,
                color: ds.colors.ink,
                ...drawing.td(rowIndex, column, rowIndex === block.rows.length - 1, column === lastColumn),
              })}>${escCited(cell, ctx.sourceCount)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  const caption = block.caption
    ? `<div${style({
        'font-size': `${ds.typeScale.xs}px`,
        color: ds.colors.inkMuted,
        'margin-top': `${snap(ds.spacing * 0.5)}px`,
        ...drawing.caption,
      })}>${esc(block.caption)}</div>`
    : '';
  // Pas insécable : le paginateur coupe un tableau entre deux lignes et répète
  // son <thead> sur la page suivante.
  return `<div><table${style({ width: '100%', 'border-collapse': 'collapse', ...drawing.table })}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${caption}</div>`;
}

export function renderFamilyTable(block: Of<'table'>, ctx: Ctx, treatment = ctx.family.table): string {
  const { ds, roles } = ctx;
  const padY = snap(ds.spacing * 0.6);
  const padX = snap(ds.spacing * 0.8);
  const cellPad = `${padY}px ${padX}px`;
  const radius = cornerRadius(ctx);

  switch (treatment) {
    // Trois filets : au-dessus de l'en-tête, sous l'en-tête, en pied. Aucun fond.
    case 'booktabs':
      return drawTable(block, ctx, {
        table: { 'border-top': `2px solid ${ds.colors.ink}`, 'border-bottom': `2px solid ${ds.colors.ink}` },
        th: () => ({ ...labelStyle(ctx, ds.colors.ink), padding: cellPad, 'border-bottom': `1px solid ${ds.colors.ink}` }),
        td: () => ({ padding: cellPad }),
        caption: { 'font-style': 'italic' },
      });

    case 'gridded':
      return drawTable(block, ctx, {
        th: () => ({
          ...labelStyle(ctx, ds.colors.ink),
          padding: cellPad,
          border: `1px solid ${ds.colors.rule}`,
          'background-color': roles.panel,
        }),
        td: () => ({ padding: cellPad, border: `1px solid ${ds.colors.rule}` }),
      });

    case 'accent-head':
      return drawTable(block, ctx, {
        th: () => ({ ...labelStyle(ctx, roles.highlight), padding: cellPad, 'border-bottom': `2px solid ${roles.highlight}` }),
        td: (_, __, lastRow) => ({ padding: cellPad, 'border-bottom': lastRow ? undefined : `1px dotted ${ds.colors.inkMuted}` }),
      });

    case 'first-column':
      return drawTable(block, ctx, {
        th: () => ({ ...labelStyle(ctx, ds.colors.ink), padding: cellPad, 'border-bottom': `2px solid ${ds.colors.ink}` }),
        td: (_, column) => ({
          padding: cellPad,
          'border-bottom': `1px solid ${ds.colors.rule}`,
          'font-weight': column === 0 ? 600 : undefined,
          'background-color': column === 0 ? roles.panel : undefined,
        }),
      });

    // Chaque ligne se détache en bande arrondie : la lecture se fait ligne à ligne.
    case 'row-cards':
      return drawTable(block, ctx, {
        table: { 'border-collapse': 'separate', 'border-spacing': `0 ${snap(ds.spacing * 0.4)}px` },
        th: () => ({ ...labelStyle(ctx, ds.colors.inkMuted), padding: `0 ${padX}px` }),
        td: (_, column, __, lastColumn) => ({
          padding: cellPad,
          'background-color': roles.panel,
          'border-radius':
            column === 0 ? `${radius}px 0 0 ${radius}px` : lastColumn ? `0 ${radius}px ${radius}px 0` : undefined,
        }),
      });

    // En-tête en négatif : l'encre en fond, le fond de page en encre — un
    // contraste garanti AAA par construction.
    case 'inverted-head':
      return drawTable(block, ctx, {
        th: () => ({
          ...labelStyle(ctx, ds.colors.surface),
          padding: cellPad,
          'background-color': ds.colors.ink,
        }),
        td: () => ({ padding: cellPad, 'border-bottom': `1px solid ${ds.colors.rule}` }),
      });

    case 'airy':
      return drawTable(block, ctx, {
        th: () => ({ ...labelStyle(ctx, ds.colors.inkMuted), padding: `0 ${padX}px ${padY}px` }),
        td: (_, __, lastRow) => ({
          padding: `${snap(ds.spacing * 0.95)}px ${padX}px`,
          'font-size': `${ds.typeScale.base}px`,
          'border-bottom': lastRow ? `1px solid ${ds.colors.rule}` : undefined,
        }),
      });

    // Colonnes alternées : la lecture se fait colonne par colonne, celle d'un
    // tableau de comparaison.
    case 'striped-columns':
      return drawTable(block, ctx, {
        th: (column) => ({
          ...labelStyle(ctx, ds.colors.ink),
          padding: cellPad,
          'border-bottom': `2px solid ${ds.colors.ink}`,
          'background-color': column % 2 === 1 ? roles.panel : undefined,
        }),
        td: (_, column, lastRow) => ({
          padding: cellPad,
          'background-color': column % 2 === 1 ? roles.panel : undefined,
          'border-bottom': lastRow ? `1px solid ${ds.colors.rule}` : undefined,
        }),
      });

    // Un petit tableau se lit mieux COUCHÉ : chaque ligne devient une colonne, et
    // les en-têtes descendent dans la première. Au-delà de quatre lignes, les
    // colonnes deviendraient trop étroites : le tableau reste debout.
    case 'transposed': {
      if (block.rows.length < 2 || block.rows.length > 4 || block.headers.length > 6) {
        return renderFamilyTable(block, ctx, 'booktabs');
      }
      const plain = (cell: string) => cell.replace(/\s*\[s\d+\]/g, '');
      const turned: Of<'table'> = {
        kind: 'table',
        headers: [block.headers[0], ...block.rows.map((row) => plain(row[0] ?? ''))],
        rows: block.headers.slice(1).map((header, index) => [header, ...block.rows.map((row) => row[index + 1] ?? '')]),
        caption: block.caption,
      };
      return drawTable(turned, ctx, {
        th: (column) => ({
          ...labelStyle(ctx, column === 0 ? ds.colors.inkMuted : ds.colors.ink),
          padding: cellPad,
          'border-bottom': ruleLine(ctx, 'strong'),
        }),
        td: (_, column) => ({
          padding: cellPad,
          'font-weight': column === 0 ? 600 : undefined,
          color: column === 0 ? ds.colors.inkMuted : ds.colors.ink,
          'border-bottom': `1px solid ${ds.colors.rule}`,
        }),
      });
    }

    // Le tableau dans un cadre : en-tête teinté, légende en pied de cadre.
    case 'framed': {
      const inner = drawTable({ ...block, caption: undefined }, ctx, {
        th: () => ({
          ...labelStyle(ctx, ds.colors.ink),
          padding: cellPad,
          'background-color': roles.panel,
          'border-bottom': `1px solid ${ds.colors.rule}`,
        }),
        td: (_, __, lastRow) => ({ padding: cellPad, 'border-bottom': lastRow ? undefined : `1px solid ${ds.colors.rule}` }),
      });
      const caption = block.caption
        ? `<div${style({ 'font-size': `${ds.typeScale.xs}px`, color: ds.colors.inkMuted, padding: cellPad, 'border-top': `1px solid ${ds.colors.rule}` })}>${esc(block.caption)}</div>`
        : '';
      return `<div${style({ border: `1px solid ${ds.colors.rule}`, 'border-radius': `${radius}px`, overflow: 'hidden' })}>${inner}${caption}</div>`;
    }

    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cartes
// ─────────────────────────────────────────────────────────────────────────────

export function renderFamilyCards(block: Of<'cards'>, ctx: Ctx): string {
  switch (ctx.family.cards) {
    case 'numbered':
      return cardsNumbered(block, ctx);
    case 'outlined':
      return cardsOutlined(block, ctx);
    case 'edge-stack':
      return cardsEdgeStack(block, ctx);
    case 'ruled-columns':
      return cardsRuledColumns(block, ctx);
    case 'inverted-lead':
      return cardsInvertedLead(block, ctx);
    case 'definitions':
      return cardsDefinitions(block, ctx);
    case 'tagged':
      return cardsTagged(block, ctx);
    case 'stacked-bands':
      return cardsStackedBands(block, ctx);
    case 'staggered':
      return cardsStaggered(block, ctx);
    case 'monogram':
      return cardsMonogram(block, ctx);
    case 'corner-number':
      return cardsCornerNumber(block, ctx);
    default:
      return '';
  }
}

const cardTitle = (ctx: Ctx, text: string, color: string, extra: Css = {}): string =>
  `<div${style({
    'font-size': `${ctx.ds.typeScale.lg}px`,
    'font-weight': 700,
    'line-height': 1.2,
    color,
    'text-wrap': 'balance',
    ...extra,
  })}>${esc(text)}</div>`;

const cardBody = (ctx: Ctx, text: string, color: string, extra: Css = {}): string =>
  `<div${style(small(ctx, color, { 'max-width': MEASURE.card, ...PROSE_WRAP, ...extra }))}>${escCited(text, ctx.sourceCount)}</div>`;

/** Liste numérotée : de grands numéros, aucune boîte. */
function cardsNumbered(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = items.length >= 4 ? 2 : 1;
  const numberPx = ds.typeScale['2xl'];
  const labels = items.map((_, index) => formatIndex(ctx, index + 1));
  const numberColumn = Math.ceil(Math.max(...labels.map((label) => label.length)) * numberPx * 0.62);
  const cells = items
    .map(
      (item, index) => `<div${style({
        display: 'grid',
        'grid-template-columns': `${numberColumn}px minmax(0, 1fr)`,
        'column-gap': `${snap(ds.spacing)}px`,
        'align-items': 'start',
        padding: `${snap(ds.spacing * 0.9)}px 0`,
        'border-top': index < columns ? ruleLine(ctx, 'strong') : softRule(ctx),
      })}${atomic}>
  <div${style({
        ...figureFont(ctx, 800),
        'font-size': `${numberPx}px`,
        'line-height': 0.9,
        color: item.strong ? figureInk(ctx) : ds.colors.inkMuted,
        'white-space': 'nowrap',
      })}>${esc(labels[index])}</div>
  <div${style({ 'min-width': '0' })}>${cardTitle(ctx, item.title, ds.colors.ink)}${cardBody(ctx, item.body, ds.colors.inkMuted, { 'margin-top': '4px' })}</div>
</div>`
    )
    .join('');
  return `<div${style({
    display: 'grid',
    'grid-template-columns': `repeat(${columns}, minmax(0, 1fr))`,
    'column-gap': `${snap(ds.spacing * 2)}px`,
  })}>${cells}</div>`;
}

/** Boîtes à bordure fine ; la carte mise en avant est coiffée d'un filet épais. */
function cardsOutlined(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = balancedColumns(items.length);
  const grid = subgridRows(2, columns, snap(ds.spacing));
  const cells = items
    .map(
      (item) => `<div${style({
        ...grid.cell,
        border: `1px solid ${ds.colors.rule}`,
        'border-top': item.strong ? `4px solid ${ctx.roles.highlight}` : `1px solid ${ds.colors.rule}`,
        'border-radius': `${cornerRadius(ctx)}px`,
        padding: `${snap(ds.spacing * 1.2)}px`,
        'align-content': 'start',
      })}${atomic}>${cardTitle(ctx, item.title, ds.colors.ink)}${cardBody(ctx, item.body, ds.colors.ink)}</div>`
    )
    .join('');
  return `<div${style(grid.container)}>${cells}</div>`;
}

/** Pile à liseré gauche. */
function cardsEdgeStack(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = items.length >= 4 ? 2 : 1;
  const cells = items
    .map(
      (item) => `<div${style({
        'border-left': `3px solid ${item.strong ? ctx.roles.highlight : ds.colors.rule}`,
        padding: `${snap(ds.spacing * 0.4)}px 0 ${snap(ds.spacing * 0.4)}px ${snap(ds.spacing)}px`,
      })}${atomic}>${cardTitle(ctx, item.title, ds.colors.ink, { 'font-size': `${ds.typeScale.base}px` })}${cardBody(ctx, item.body, ds.colors.inkMuted, { 'margin-top': '2px' })}</div>`
    )
    .join('');
  return `<div${style({
    display: 'grid',
    'grid-template-columns': `repeat(${columns}, minmax(0, 1fr))`,
    'column-gap': `${snap(ds.spacing * 2)}px`,
    'row-gap': `${snap(ds.spacing)}px`,
  })}>${cells}</div>`;
}

/** Colonnes séparées de filets, titres soulignés. */
function cardsRuledColumns(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = balancedColumns(items.length);
  const gap = snap(ds.spacing * 1.5);
  const grid = subgridRows(2, columns, gap);
  const cells = items
    .map((item, index) => {
      const first = index % columns === 0;
      return `<div${style({
        ...grid.cell,
        'border-left': first ? undefined : softRule(ctx),
        'padding-left': first ? undefined : `${gap}px`,
        'align-content': 'start',
      })}${atomic}>${cardTitle(ctx, item.title, item.strong ? ctx.roles.highlight : ds.colors.ink, {
        'padding-bottom': '4px',
        'border-bottom': `2px solid ${item.strong ? ctx.roles.highlight : ds.colors.ink}`,
      })}${cardBody(ctx, item.body, ds.colors.ink)}</div>`;
    })
    .join('');
  return `<div${style(grid.container)}>${cells}</div>`;
}

/** La carte mise en avant en négatif ; les autres, nues, sous un filet d'encre. */
function cardsInvertedLead(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = balancedColumns(items.length);
  const grid = subgridRows(2, columns, snap(ds.spacing));
  const pad = snap(ds.spacing * 1.2);
  const cells = items
    .map((item) => {
      const ink = item.strong ? ds.colors.surface : ds.colors.ink;
      return `<div${style({
        ...grid.cell,
        'background-color': item.strong ? ds.colors.ink : undefined,
        'border-top': item.strong ? undefined : `2px solid ${ds.colors.ink}`,
        'border-radius': item.strong ? `${cornerRadius(ctx)}px` : undefined,
        // Même retrait pour toutes : les titres et les textes restent alignés
        // d'une carte à l'autre, qu'elle ait un fond ou non.
        padding: `${pad}px`,
        'align-content': 'start',
      })}${atomic}>${cardTitle(ctx, item.title, ink)}${cardBody(ctx, item.body, ink, { opacity: item.strong ? 0.9 : 0.85 })}</div>`;
    })
    .join('');
  return `<div${style(grid.container)}>${cells}</div>`;
}

/** Définitions : le titre à gauche, son texte à droite. */
function cardsDefinitions(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const rows = items
    .map(
      (item, index) => `<div${style({
        display: 'grid',
        'grid-template-columns': '32% minmax(0, 1fr)',
        'column-gap': `${snap(ds.spacing * 1.5)}px`,
        'align-items': 'baseline',
        padding: `${snap(ds.spacing * 0.7)}px 0`,
        'border-top': index === 0 ? ruleLine(ctx, 'strong') : softRule(ctx),
      })}${atomic}>
  <div${style({
        'font-family': displayFont(ds),
        'font-size': `${ds.typeScale.base}px`,
        'font-weight': 600,
        'line-height': 1.3,
        color: item.strong ? ctx.roles.highlight : ds.colors.ink,
        'text-wrap': 'balance',
      })}>${esc(item.title)}</div>
  ${cardBody(ctx, item.body, ds.colors.ink, { 'max-width': MEASURE.prose })}
</div>`
    )
    .join('');
  return `<div>${rows}</div>`;
}

/** Le titre en cartouche, le texte dessous. */
function cardsTagged(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = balancedColumns(items.length);
  const grid = subgridRows(2, columns, snap(ds.spacing * 1.5));
  const cells = items
    .map((item) => {
      const ground = item.strong ? ctx.roles.highlight : ctx.roles.panel;
      const ink = readableOn(ds, ground);
      return `<div${style({ ...grid.cell, 'align-content': 'start' })}${atomic}>
  <div${style({
        'justify-self': 'start',
        'max-width': '100%',
        'background-color': ground,
        color: ink,
        padding: `${snap(ds.spacing * 0.35)}px ${snap(ds.spacing * 0.75)}px`,
        'border-radius': `${cornerRadius(ctx)}px`,
        'font-size': `${ds.typeScale.sm}px`,
        'font-weight': 700,
        'line-height': 1.3,
      })}>${esc(item.title)}</div>
  ${cardBody(ctx, item.body, ds.colors.ink)}
</div>`;
    })
    .join('');
  return `<div${style(grid.container)}>${cells}</div>`;
}

/** Bandes pleine largeur alternées : titre à gauche, texte à droite. */
function cardsStackedBands(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const rows = items
    .map((item, index) => {
      const ground = item.strong ? ctx.roles.highlight : index % 2 === 0 ? ctx.roles.panel : undefined;
      const ink = ground ? readableOn(ds, ground) : ds.colors.ink;
      return `<div${style({
        display: 'grid',
        'grid-template-columns': '30% minmax(0, 1fr)',
        'column-gap': `${snap(ds.spacing * 1.5)}px`,
        'align-items': 'baseline',
        padding: `${snap(ds.spacing * 0.8)}px ${snap(ds.spacing)}px`,
        'background-color': ground,
      })}${atomic}>${cardTitle(ctx, item.title, ink, { 'font-size': `${ds.typeScale.base}px` })}${cardBody(ctx, item.body, ink, { 'max-width': MEASURE.prose })}</div>`;
    })
    .join('');
  return `<div${style({ 'border-radius': `${cornerRadius(ctx)}px`, overflow: 'hidden' })}>${rows}</div>`;
}

/** Deux colonnes décalées en hauteur : la grille respire, la rangée disparaît. */
function cardsStaggered(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = items.length === 1 ? 1 : 2;
  const offset = snap(ds.spacing * 3);
  const cells = items
    .map(
      (item, index) => `<div${style({
        'margin-top': columns === 2 && index % 2 === 1 ? `${offset}px` : undefined,
        'border-top': `2px solid ${item.strong ? ctx.roles.highlight : ds.colors.ink}`,
        'padding-top': `${snap(ds.spacing * 0.8)}px`,
      })}${atomic}>${cardTitle(ctx, item.title, ds.colors.ink)}${cardBody(ctx, item.body, ds.colors.inkMuted, { 'margin-top': '4px' })}</div>`
    )
    .join('');
  return `<div${style({
    display: 'grid',
    'grid-template-columns': `repeat(${columns}, minmax(0, 1fr))`,
    'column-gap': `${snap(ds.spacing * 2)}px`,
    'row-gap': `${snap(ds.spacing * 1.2)}px`,
    'align-items': 'start',
  })}>${cells}</div>`;
}

/**
 * L'initiale du titre en lettrine carrée, le texte à côté. Un repère
 * TYPOGRAPHIQUE — la lettre vient du contenu — et non une icône inventée.
 */
function cardsMonogram(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = items.length >= 4 ? 2 : 1;
  const tile = Math.round(ds.typeScale['2xl'] * 1.5);
  const cells = items
    .map((item) => {
      const letter = (item.title.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/)?.[0] ?? '·').toUpperCase();
      const ground = item.strong ? ctx.roles.highlight : ctx.roles.panel;
      const ink = readableOn(ds, ground);
      return `<div${style({
        display: 'grid',
        'grid-template-columns': `${tile}px minmax(0, 1fr)`,
        'column-gap': `${snap(ds.spacing)}px`,
        'align-items': 'start',
        padding: `${snap(ds.spacing * 0.6)}px 0`,
      })}${atomic}>
  <div${style({
        width: `${tile}px`,
        height: `${tile}px`,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'background-color': ground,
        color: ink,
        'border-radius': `${cornerRadius(ctx)}px`,
        'font-family': displayFont(ds),
        'font-size': `${Math.round(tile * 0.55)}px`,
        'font-weight': 700,
        'line-height': 1,
      })} aria-hidden="true">${esc(letter)}</div>
  <div${style({ 'min-width': '0' })}>${cardTitle(ctx, item.title, ds.colors.ink, { 'font-size': `${ds.typeScale.base}px` })}${cardBody(ctx, item.body, ds.colors.inkMuted, { 'margin-top': '2px' })}</div>
</div>`;
    })
    .join('');
  return `<div${style({
    display: 'grid',
    'grid-template-columns': `repeat(${columns}, minmax(0, 1fr))`,
    'column-gap': `${snap(ds.spacing * 2)}px`,
    'row-gap': `${snap(ds.spacing * 0.5)}px`,
  })}>${cells}</div>`;
}

/**
 * Boîtes au grand numéro d'angle.
 *
 * Le numéro est DANS le flux, sur la ligne du titre, et non en position absolue :
 * posé en absolu dans l'angle, il recouvrait le titre dès que la colonne était
 * étroite (« Torréfaction à Douala » sous un « [01] », vu sur la planche contact)
 * — et le contrôle de chevauchement, qui ignore les éléments absolus, ne pouvait
 * pas le voir.
 */
function cardsCornerNumber(block: Of<'cards'>, ctx: Ctx): string {
  const { ds } = ctx;
  const items = withEmphasis(block.items);
  const columns = balancedColumns(items.length);
  const gap = snap(ds.spacing);
  const pad = snap(ds.spacing * 1.2);
  // Dans une cellule étroite, le numéro à côté du titre lui prend la moitié de sa
  // ligne : il monte alors AU-DESSUS du titre, un cran plus petit.
  const cellPx = (ctx.contentWidthPx - gap * (columns - 1)) / columns - 2 * pad;
  const stacked = cellPx < 210;
  const numberPx = stacked ? ds.typeScale.xl : ds.typeScale['2xl'];
  const grid = subgridRows(2, columns, gap);
  const cells = items
    .map((item, index) => {
      const number = `<div${style({
        ...figureFont(ctx, 800),
        flex: 'none',
        'font-size': `${numberPx}px`,
        'line-height': 0.9,
        color: item.strong ? ctx.roles.highlight : ds.colors.inkMuted,
        'margin-bottom': stacked ? `${snap(ds.spacing * 0.4)}px` : undefined,
      })} aria-hidden="true">${esc(formatIndex(ctx, index + 1))}</div>`;
      const head = stacked
        ? `<div>${number}${cardTitle(ctx, item.title, ds.colors.ink)}</div>`
        : `<div${style({ display: 'flex', 'align-items': 'flex-start', 'justify-content': 'space-between', gap: `${snap(ds.spacing * 0.75)}px` })}>
    ${cardTitle(ctx, item.title, ds.colors.ink, { 'min-width': '0' })}
    ${number}
  </div>`;
      return `<div${style({
        ...grid.cell,
        border: `1px solid ${item.strong ? ctx.roles.highlight : ds.colors.rule}`,
        'border-radius': `${cornerRadius(ctx)}px`,
        padding: `${pad}px`,
        'align-content': 'start',
      })}${atomic}>
  ${head}
  ${cardBody(ctx, item.body, ds.colors.ink)}
</div>`;
    })
    .join('');
  return `<div${style(grid.container)}>${cells}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frises
// ─────────────────────────────────────────────────────────────────────────────

export function renderFamilyTimeline(block: Of<'timeline'>, ctx: Ctx): string {
  switch (ctx.family.timeline) {
    case 'steps':
      return timelineSteps(block, ctx);
    case 'date-column':
      return timelineDateColumn(block, ctx);
    case 'boxes':
      return timelineBoxes(block, ctx);
    case 'leaders':
      return timelineLeaders(block, ctx);
    case 'big-dates':
      return timelineBigDates(block, ctx);
    case 'spine':
      return timelineSpine(block, ctx);
    case 'numbered-circles':
      return timelineCircles(block, ctx);
    case 'chevrons':
      return timelineChevrons(block, ctx);
    default:
      return '';
  }
}

const stepTitle = (ctx: Ctx, text: string): string =>
  `<div${style({
    'font-size': `${ctx.ds.typeScale.base}px`,
    'font-weight': 600,
    'line-height': 1.25,
    color: ctx.ds.colors.ink,
    'text-wrap': 'balance',
  })}>${esc(text)}</div>`;

const stepBody = (ctx: Ctx, text: string): string =>
  `<div${style(small(ctx, ctx.ds.colors.inkMuted))}>${esc(text)}</div>`;

/**
 * Étapes horizontales sur une ligne de progression. Au-delà de cinq étapes, ou
 * dans une colonne trop étroite, les colonnes deviendraient illisibles : la
 * frise se compose alors en colonne de dates.
 */
function timelineSteps(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  const count = block.steps.length;
  if (count > 5 || ctx.contentWidthPx / count < 150) return timelineDateColumn(block, ctx);
  const grid = subgridRows(3, count, snap(ds.spacing));
  const cells = block.steps
    .map(
      (step, index) => `<div${style({
        ...grid.cell,
        'border-top': `3px solid ${index === 0 ? ctx.roles.highlight : ds.colors.rule}`,
        'padding-top': `${snap(ds.spacing * 0.8)}px`,
      })}>
  <div${style(labelStyle(ctx, figureInk(ctx)))}>${esc(step.date)}</div>
  ${stepTitle(ctx, step.title)}
  ${stepBody(ctx, step.body)}
</div>`
    )
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Les dates composées en grand dans leur propre colonne. */
function timelineDateColumn(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  const columnMm = 30;
  const px = fitFigure(ctx, block.steps.map((step) => step.date), columnMm * MM_TO_PX * 0.95, ds.typeScale.xl, ds.typeScale.base);
  const rows = block.steps
    .map(
      (step, index) => `<div${style({
        display: 'grid',
        'grid-template-columns': `${columnMm}mm minmax(0, 1fr)`,
        'column-gap': `${snap(ds.spacing * 1.5)}px`,
        'align-items': 'baseline',
        padding: `${snap(ds.spacing * 0.7)}px 0`,
        'border-top': index === 0 ? ruleLine(ctx, 'strong') : softRule(ctx),
      })}${atomic}>
  <div${style({
        ...figureFont(ctx, 700),
        'font-size': `${px}px`,
        'line-height': 1.1,
        color: figureInk(ctx),
        'font-variant-numeric': 'tabular-nums',
      })}>${esc(step.date)}</div>
  <div${style({ 'min-width': '0' })}>${stepTitle(ctx, step.title)}${stepBody(ctx, step.body)}</div>
</div>`
    )
    .join('');
  return `<div>${rows}</div>`;
}

/** Une boîte teintée par étape. */
function timelineBoxes(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  const columns = balancedColumns(block.steps.length);
  if (ctx.contentWidthPx / columns < 150) return timelineDateColumn(block, ctx);
  const grid = subgridRows(3, columns, snap(ds.spacing));
  const cells = block.steps
    .map(
      (step) => `<div${style({
        ...grid.cell,
        'background-color': ctx.roles.panel,
        'border-radius': `${cornerRadius(ctx)}px`,
        padding: `${snap(ds.spacing * 1.1)}px`,
        'row-gap': `${snap(ds.spacing * 0.3)}px`,
      })}>
  <div${style(labelStyle(ctx, figureInk(ctx)))}>${esc(step.date)}</div>
  ${stepTitle(ctx, step.title)}
  ${stepBody(ctx, step.body)}
</div>`
    )
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Titre, points de conduite, date — la table des matières d'un programme. */
function timelineLeaders(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  const rows = block.steps
    .map(
      (step) => `<div${style({ padding: `${snap(ds.spacing * 0.5)}px 0` })}${atomic}>
  <div${style({ display: 'flex', 'align-items': 'baseline', gap: `${snap(ds.spacing * 0.5)}px` })}>
    <span${style({ 'font-size': `${ds.typeScale.base}px`, 'font-weight': 600, color: ds.colors.ink, 'min-width': '0' })}>${esc(step.title)}</span>
    <span${style({ flex: '1 1 auto', 'min-width': '12px', height: '0', 'border-bottom': `1px dotted ${ds.colors.inkMuted}` })}></span>
    <span${style({ ...labelStyle(ctx, figureInk(ctx)), 'white-space': 'nowrap' })}>${esc(step.date)}</span>
  </div>
  ${step.body ? `<div${style(small(ctx, ds.colors.inkMuted, { 'margin-top': '2px', 'max-width': MEASURE.prose }))}>${esc(step.body)}</div>` : ''}
</div>`
    )
    .join('');
  return `<div>${rows}</div>`;
}

/** Une grille de grandes dates. */
function timelineBigDates(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  const columns = Math.min(4, balancedColumns(block.steps.length));
  // Des dates en grand dans des colonnes trop étroites se touchent : la frise se
  // compose alors en colonne de dates.
  if (ctx.contentWidthPx / columns < 150) return timelineDateColumn(block, ctx);
  const gap = snap(ds.spacing * 1.5);
  const grid = subgridRows(3, columns, gap);
  const cellPx = (ctx.contentWidthPx - gap * (columns - 1)) / columns;
  const px = fitFigure(ctx, block.steps.map((step) => step.date), cellPx * 0.95, ds.typeScale['2xl'], ds.typeScale.lg);
  const cells = block.steps
    .map(
      (step) => `<div${style(grid.cell)}>
  ${figure(ctx, step.date, px, figureInk(ctx), 800)}
  ${stepTitle(ctx, step.title)}
  ${stepBody(ctx, step.body)}
</div>`
    )
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Épine centrale : les étapes alternent de part et d'autre d'une ligne. */
function timelineSpine(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  if (ctx.contentWidthPx < 420) return timelineDateColumn(block, ctx);
  const gap = snap(ds.spacing);
  const rows = block.steps
    .map((step, index) => {
      const left = index % 2 === 0;
      const content = `<div${style({ 'text-align': left ? 'right' : 'left', 'padding-bottom': `${snap(ds.spacing)}px`, 'min-width': '0' })}>
    <div${style(labelStyle(ctx, figureInk(ctx)))}>${esc(step.date)}</div>
    ${stepTitle(ctx, step.title)}
    ${stepBody(ctx, step.body)}
  </div>`;
      return `<div${style({ display: 'grid', 'grid-template-columns': 'minmax(0, 1fr) 12px minmax(0, 1fr)', 'column-gap': `${gap}px` })}${atomic}>
  ${left ? content : '<div></div>'}
  <div${style({ display: 'flex', 'flex-direction': 'column', 'align-items': 'center' })}>
    <div${style({ width: '10px', height: '10px', 'margin-top': '4px', flex: 'none', 'background-color': ctx.roles.highlight, 'border-radius': cornerRadius(ctx) > 0 ? '50%' : '0' })}></div>
    <div${style({ flex: '1 1 auto', width: '0', 'min-height': '12px', 'border-left': `2px solid ${ds.colors.rule}` })}></div>
  </div>
  ${left ? '<div></div>' : content}
</div>`;
    })
    .join('');
  return `<div>${rows}</div>`;
}

/** Étapes numérotées, reliées par une ligne. */
function timelineCircles(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  const count = block.steps.length;
  if (count > 5 || ctx.contentWidthPx / count < 150) return timelineDateColumn(block, ctx);
  const gap = snap(ds.spacing);
  const size = 26;
  const grid = subgridRows(4, count, gap);
  const cells = block.steps
    .map(
      (step, index) => `<div${style(grid.cell)}>
  <div${style({ display: 'flex', 'align-items': 'center' })}>
    <div${style({
        width: `${size}px`,
        height: `${size}px`,
        flex: 'none',
        'border-radius': cornerRadius(ctx) > 0 ? '50%' : '0',
        border: `2px solid ${ctx.roles.highlight}`,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'font-size': `${ds.typeScale.xs}px`,
        'font-weight': 700,
        color: ds.colors.ink,
      })}>${index + 1}</div>
    ${index < count - 1 ? `<div${style({ flex: '1 1 auto', height: '0', 'margin-left': '6px', 'margin-right': `-${gap}px`, 'border-top': `2px solid ${ds.colors.rule}` })}></div>` : ''}
  </div>
  <div${style(labelStyle(ctx, figureInk(ctx)))}>${esc(step.date)}</div>
  ${stepTitle(ctx, step.title)}
  ${stepBody(ctx, step.body)}
</div>`
    )
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

/** Les dates en chevrons enchaînés : la frise se lit comme une flèche. */
function timelineChevrons(block: Of<'timeline'>, ctx: Ctx): string {
  const { ds } = ctx;
  const count = block.steps.length;
  if (count > 5 || ctx.contentWidthPx / count < 150) return timelineDateColumn(block, ctx);
  const grid = subgridRows(3, count, snap(ds.spacing * 0.5));
  const notch = 10;
  const cells = block.steps
    .map((step, index) => {
      const ground = index === 0 ? ctx.roles.highlight : ctx.roles.panel;
      const ink = readableOn(ds, ground);
      return `<div${style(grid.cell)}>
  <div${style({
        ...labelStyle(ctx, ink),
        color: ink,
        'background-color': ground,
        padding: `${snap(ds.spacing * 0.45)}px ${notch + snap(ds.spacing * 0.6)}px`,
        'clip-path': `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%, ${notch}px 50%)`,
        'white-space': 'nowrap',
        overflow: 'hidden',
        'text-overflow': 'ellipsis',
      })}>${esc(step.date)}</div>
  <div${style({ 'padding-left': `${notch}px` })}>${stepTitle(ctx, step.title)}</div>
  <div${style({ 'padding-left': `${notch}px` })}>${stepBody(ctx, step.body)}</div>
</div>`;
    })
    .join('');
  return `<div${style(grid.container)}${atomic}>${cells}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Citations
// ─────────────────────────────────────────────────────────────────────────────

export function renderFamilyQuote(block: Of<'quote'>, ctx: Ctx, treatment = ctx.family.quote): string {
  const { ds } = ctx;
  const attribution = (color: string, extra: Css = {}): string =>
    block.attribution
      ? `<div${style({ ...labelStyle(ctx, color), 'margin-top': `${snap(ds.spacing * 0.6)}px`, ...extra })}>— ${esc(block.attribution)}</div>`
      : '';
  const mark = (color: string): string =>
    `<div${style({
      'font-family': displayFont(ds),
      'font-size': `${ds.typeScale['3xl']}px`,
      'font-weight': 700,
      'line-height': 0.8,
      height: `${Math.round(ds.typeScale['3xl'] * 0.5)}px`,
      color,
    })} aria-hidden="true">“</div>`;

  switch (treatment) {
    case 'display':
      return `<blockquote${style({ margin: 0 })}${atomic}>
  ${mark(ctx.roles.highlight)}
  <div${style({
        'font-family': displayFont(ds),
        'font-size': `${ds.typeScale.xl}px`,
        'line-height': 1.25,
        'letter-spacing': '-0.01em',
        color: ds.colors.ink,
        'max-width': '40ch',
        'text-wrap': 'balance',
      })}>${esc(block.text)}</div>
  ${attribution(ds.colors.inkMuted)}
</blockquote>`;

    case 'centered':
      return `<blockquote${style({
        margin: 0,
        padding: `${snap(ds.spacing * 1.2)}px ${snap(ds.spacing * 2)}px`,
        'border-top': ruleLine(ctx, 'strong'),
        'border-bottom': ruleLine(ctx, 'strong'),
        'text-align': 'center',
      })}${atomic}>
  <div${style({
        'font-family': displayFont(ds),
        'font-style': 'italic',
        'font-size': `${ds.typeScale.lg}px`,
        'line-height': 1.4,
        color: ds.colors.ink,
        'text-wrap': 'balance',
      })}>${esc(block.text)}</div>
  ${attribution(ds.colors.inkMuted)}
</blockquote>`;

    case 'inverted':
      return `<blockquote${style({
        margin: 0,
        padding: `${snap(ds.spacing * 1.5)}px ${snap(ds.spacing * 1.8)}px`,
        'background-color': ds.colors.ink,
        'border-radius': `${cornerRadius(ctx)}px`,
      })}${atomic}>
  <div${style({ 'font-size': `${ds.typeScale.lg}px`, 'line-height': 1.4, color: ds.colors.surface })}>${esc(block.text)}</div>
  ${attribution(ds.colors.surface, { opacity: 0.8 })}
</blockquote>`;

    case 'hanging':
      return `<blockquote${style({
        margin: 0,
        display: 'grid',
        'grid-template-columns': '10mm minmax(0, 1fr)',
        'column-gap': `${snap(ds.spacing)}px`,
      })}${atomic}>
  ${mark(ctx.roles.highlight)}
  <div>
    <div${style({ 'font-size': `${ds.typeScale.lg}px`, 'line-height': 1.4, color: ds.colors.ink })}>${esc(block.text)}</div>
    ${attribution(ds.colors.inkMuted)}
  </div>
</blockquote>`;

    case 'caps':
      return `<blockquote${style({
        margin: 0,
        'padding-top': `${snap(ds.spacing)}px`,
        'border-top': ctx.family.rules === 'hairline' || ctx.family.rules === 'none' ? `3px solid ${ds.colors.ink}` : ruleLine(ctx, 'strong'),
      })}${atomic}>
  <div${style({
        'font-size': `${ds.typeScale.base}px`,
        'font-weight': 700,
        'text-transform': 'uppercase',
        'letter-spacing': '0.04em',
        'line-height': 1.4,
        color: ds.colors.ink,
        'max-width': '52ch',
      })}>${esc(block.text)}</div>
  ${attribution(ds.colors.inkMuted)}
</blockquote>`;

    // L'auteur en grand, la parole à côté : la citation se lit par sa source.
    case 'split':
      if (!block.attribution) return renderFamilyQuote(block, ctx, 'display');
      return `<blockquote${style({
        margin: 0,
        display: 'grid',
        'grid-template-columns': 'minmax(0, 0.9fr) minmax(0, 2fr)',
        'column-gap': `${snap(ds.spacing * 2)}px`,
        'align-items': 'start',
        'padding-top': `${snap(ds.spacing)}px`,
        'border-top': ruleLine(ctx, 'strong'),
      })}${atomic}>
  <div${style({ 'font-family': displayFont(ds), 'font-size': `${ds.typeScale.lg}px`, 'font-weight': 600, 'line-height': 1.25, color: ctx.roles.highlight, 'text-wrap': 'balance' })}>${esc(block.attribution)}</div>
  <div${style({ 'font-size': `${ds.typeScale.lg}px`, 'line-height': 1.45, color: ds.colors.ink })}>“${esc(block.text)}”</div>
</blockquote>`;

    // Deux équerres d'angle encadrent la parole. Elles sont en position
    // absolue DANS le bloc : elles bornent, elles ne poussent rien.
    case 'brackets': {
      const arm = '16px';
      const line = `2px solid ${ctx.roles.highlight}`;
      return `<blockquote${style({
        margin: 0,
        position: 'relative',
        padding: `${snap(ds.spacing * 1.4)}px ${snap(ds.spacing * 2)}px`,
        'text-align': 'center',
      })}${atomic}>
  <div${style({ position: 'absolute', top: 0, left: 0, width: arm, height: arm, 'border-top': line, 'border-left': line })}></div>
  <div${style({ position: 'absolute', bottom: 0, right: 0, width: arm, height: arm, 'border-bottom': line, 'border-right': line })}></div>
  <div${style({ 'font-family': displayFont(ds), 'font-size': `${ds.typeScale.xl}px`, 'line-height': 1.3, color: ds.colors.ink, 'text-wrap': 'balance' })}>${esc(block.text)}</div>
  ${attribution(ds.colors.inkMuted)}
</blockquote>`;
    }

    // Surlignée au marqueur : un soulignement épais remonté sous le texte.
    // Pas de dégradé ni de transparence calculée — une teinte de la rampe,
    // claire sur fond clair, sombre sur fond sombre.
    case 'highlight': {
      const marker = ds.dark ? ds.colors.brand['800'] : ds.colors.brand['200'];
      return `<blockquote${style({ margin: 0 })}${atomic}>
  <p${style({ margin: 0, 'font-family': displayFont(ds), 'font-size': `${ds.typeScale.xl}px`, 'line-height': 1.45, color: ds.colors.ink })}><span${style({
        'text-decoration-line': 'underline',
        'text-decoration-color': marker,
        'text-decoration-thickness': '0.42em',
        'text-underline-offset': '-0.28em',
        'text-decoration-skip-ink': 'none',
      })}>${esc(block.text)}</span></p>
  ${attribution(ds.colors.inkMuted)}
</blockquote>`;
    }

    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hypothèses
// ─────────────────────────────────────────────────────────────────────────────

export function renderFamilyAssumption(block: Of<'assumption'>, ctx: Ctx): string {
  const { ds } = ctx;
  const label = (color: string): string => `<div${style(labelStyle(ctx, color))}>Hypothèse</div>`;
  const statement = `<div${style(small(ctx, ds.colors.ink, { 'margin-top': '4px' }))}>${escCited(block.statement, ctx.sourceCount)}</div>`;
  const basis = block.basis
    ? `<div${style(small(ctx, ds.colors.inkMuted, { 'font-size': `${ds.typeScale.xs}px`, 'margin-top': '2px' }))}>Base : ${esc(block.basis)}</div>`
    : '';

  switch (ctx.family.assumption) {
    case 'boxed':
      return `<div${style({
        border: `1px solid ${ds.colors.rule}`,
        'border-radius': `${cornerRadius(ctx)}px`,
        padding: `${snap(ds.spacing)}px ${snap(ds.spacing * 1.2)}px`,
      })}${atomic}>${label(ctx.roles.highlight)}${statement}${basis}</div>`;

    case 'margin':
      return `<div${style({
        display: 'grid',
        'grid-template-columns': '28mm minmax(0, 1fr)',
        'column-gap': `${snap(ds.spacing * 1.5)}px`,
        'padding-top': `${snap(ds.spacing * 0.6)}px`,
        'border-top': softRule(ctx),
      })}${atomic}>${label(ds.colors.inkMuted)}<div><div${style(small(ctx, ds.colors.ink))}>${escCited(block.statement, ctx.sourceCount)}</div>${basis}</div></div>`;

    case 'inline':
      return `<div${atomic}>
  <p${style(small(ctx, ds.colors.ink, { margin: 0, 'max-width': MEASURE.prose }))}><span${style({ 'font-weight': 700 })}>Hypothèse — </span>${escCited(block.statement, ctx.sourceCount)}</p>
  ${block.basis ? `<div${style(small(ctx, ds.colors.inkMuted, { 'font-size': `${ds.typeScale.xs}px`, 'font-style': 'italic', 'margin-top': '2px' }))}>Base : ${esc(block.basis)}</div>` : ''}
</div>`;

    case 'edge':
      return `<div${style({
        'border-left': `3px solid ${ctx.roles.highlight}`,
        padding: `${snap(ds.spacing * 0.3)}px 0 ${snap(ds.spacing * 0.3)}px ${snap(ds.spacing)}px`,
      })}${atomic}>${label(ds.colors.inkMuted)}${statement}${basis}</div>`;

    // Le libellé en onglet sur un cadre d'encre.
    case 'tab': {
      const radius = cornerRadius(ctx);
      return `<div${atomic}>
  <div${style({
        ...labelStyle(ctx, ds.colors.surface),
        display: 'inline-block',
        'background-color': ds.colors.ink,
        color: ds.colors.surface,
        padding: `${snap(ds.spacing * 0.3)}px ${snap(ds.spacing * 0.8)}px`,
        'border-radius': `${radius}px ${radius}px 0 0`,
      })}>Hypothèse</div>
  <div${style({ border: `1px solid ${ds.colors.ink}`, padding: `${snap(ds.spacing * 0.8)}px ${snap(ds.spacing)}px`, 'border-radius': `0 ${radius}px ${radius}px ${radius}px` })}>
    <div${style(small(ctx, ds.colors.ink))}>${escCited(block.statement, ctx.sourceCount)}</div>${basis}
  </div>
</div>`;
    }

    // Une note de bas de bloc, sous un filet court : l'hypothèse se lit comme
    // la réserve qu'elle est.
    case 'footnote':
      return `<div${style({ 'padding-top': `${snap(ds.spacing * 0.5)}px` })}${atomic}>
  <div${style({ width: '28mm', height: '0', 'border-top': `1px solid ${ds.colors.inkMuted}`, 'margin-bottom': `${snap(ds.spacing * 0.5)}px` })}></div>
  <p${style(small(ctx, ds.colors.inkMuted, { margin: 0, 'font-size': `${ds.typeScale.xs}px`, 'max-width': MEASURE.prose }))}><span${style({ color: ctx.roles.highlight, 'font-weight': 700 })}>*</span> <span${style({ 'font-style': 'italic' })}>Hypothèse</span> — ${escCited(block.statement, ctx.sourceCount)}${
        block.basis ? ` Base : ${esc(block.basis)}` : ''
      }</p>
</div>`;

    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Texte courant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La prose de la famille. Renvoie une chaîne vide pour `plain` : c'est alors le
 * dessin historique qui s'applique.
 */
export function renderFamilyProse(block: Of<'prose'>, ctx: Ctx): string {
  const { ds } = ctx;
  const cramped = ctx.options.multiPage === false;
  const base: Css = {
    margin: `0 0 ${snap(ds.spacing)}px`,
    'font-size': `${ds.typeScale.base}px`,
    'line-height': 1.55,
    color: ds.colors.ink,
    'max-width': MEASURE.prose,
    ...PROSE_WRAP,
  };
  const plain = (extra: Css = {}): string =>
    block.paragraphs.map((paragraph) => `<p${style({ ...base, ...extra })}>${escCited(paragraph, ctx.sourceCount)}</p>`).join('');

  switch (ctx.family.prose) {
    // Une lettrine, UNE fois par section : sur chaque bloc, elle cesserait
    // d'ouvrir quoi que ce soit. Jamais sur un paragraphe court, où elle
    // dépasserait le texte qu'elle est censée ouvrir.
    case 'drop-cap':
      return block.paragraphs
        .map((paragraph, index) => {
          const text = paragraph.trim();
          const first = text.charAt(0);
          if (index > 0 || ctx.state.dropCapUsed || text.length < 160 || !/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(first)) {
            return `<p${style(base)}>${escCited(text, ctx.sourceCount)}</p>`;
          }
          ctx.state.dropCapUsed = true;
          const size = Math.round(ds.typeScale.base * 1.55 * 2.6);
          return `<p${style(base)}><span${style({
            float: 'left',
            'font-family': displayFont(ds),
            'font-size': `${size}px`,
            'line-height': 0.8,
            'font-weight': 700,
            color: ctx.roles.highlight,
            padding: `4px ${snap(ds.spacing * 0.75)}px 0 0`,
          })}>${esc(first)}</span>${escCited(text.slice(1), ctx.sourceCount)}</p>`;
        })
        .join('');

    // La première phrase de chaque bloc en gras : le lecteur pressé lit les
    // attaques et sait de quoi parle chaque paragraphe.
    case 'lead-in':
      return block.paragraphs
        .map((paragraph, index) => {
          const text = paragraph.trim();
          if (index > 0) return `<p${style(base)}>${escCited(text, ctx.sourceCount)}</p>`;
          const sentence = text.match(/^(.{24,180}?[.!?:])(\s+)([\s\S]+)$/);
          const lead = sentence ? sentence[1] : text.split(/\s+/).slice(0, 7).join(' ');
          const rest = sentence ? sentence[3] : text.split(/\s+/).slice(7).join(' ');
          return `<p${style(base)}><span${style({ 'font-weight': 700 })}>${escCited(lead, ctx.sourceCount)}</span>${rest ? ` ${escCited(rest, ctx.sourceCount)}` : ''}</p>`;
        })
        .join('');

    // Deux colonnes, seulement quand la matière les justifie et que le bloc
    // tient bien en dessous d'une page : le paginateur ne coupe pas une rangée
    // de colonnes, il la déplace entière.
    case 'columns': {
      const total = block.paragraphs.join(' ').length;
      if (cramped || total < 600 || total > 2600 || ctx.contentWidthPx < 520) return plain();
      return `<div${style({ 'column-count': 2, 'column-gap': `${snap(ds.spacing * 2)}px`, 'column-fill': 'balance' })}>${plain({ 'max-width': 'none' })}</div>`;
    }

    // Composition de livre : alinéas en retrait, aucun blanc entre paragraphes.
    case 'indented':
      return block.paragraphs
        .map(
          (paragraph, index) =>
            `<p${style({
              ...base,
              margin: 0,
              'line-height': 1.6,
              'text-indent': index === 0 ? undefined : '1.6em',
            })}>${escCited(paragraph, ctx.sourceCount)}</p>`
        )
        .join('');

    // Corps d'essai : plus grand, plus aéré, mesure plus courte. Pas sur une page
    // rognée, dont le budget a été calculé au corps courant.
    case 'essay':
      return plain({
        'font-size': `${cramped ? ds.typeScale.base : Math.min(ds.typeScale.lg, Math.round(ds.typeScale.base * 1.18))}px`,
        'line-height': 1.62,
        'max-width': '60ch',
        margin: `0 0 ${snap(ds.spacing * 1.2)}px`,
      });

    // Le premier paragraphe de la SECTION composé plus grand : il porte le
    // constat, les suivants le développent. Une fois par section.
    case 'large-lead':
      return block.paragraphs
        .map((paragraph, index) => {
          const lead = index === 0 && !ctx.state.leadUsed && !cramped;
          if (lead) ctx.state.leadUsed = true;
          return `<p${style({
            ...base,
            ...(lead
              ? { 'font-size': `${Math.min(ds.typeScale.lg, Math.round(ds.typeScale.base * 1.25))}px`, 'line-height': 1.5, 'max-width': '58ch' }
              : {}),
          })}>${escCited(paragraph, ctx.sourceCount)}</p>`;
        })
        .join('');

    // Des paragraphes séparés par un filet court plutôt que par un blanc.
    case 'rule-separated':
      return block.paragraphs
        .map(
          (paragraph, index) =>
            `${index > 0 ? `<div${style({ width: '14mm', height: '0', 'border-top': `1px solid ${ds.colors.rule}`, margin: `0 0 ${snap(ds.spacing)}px` })}></div>` : ''}<p${style(base)}>${escCited(paragraph, ctx.sourceCount)}</p>`
        )
        .join('');

    default:
      return '';
  }
}
