/**
 * LES PRIMITIVES — ce que le code dessine pour l'auteur, parce que l'exactitude l'exige :
 *
 *   <idem-chart data-block="b3" class="…">   un graphique Chart.js des vraies données (9 types), palette de la marque
 *   <idem-table data-block="b4" class="…">   le tableau, cellule pour cellule ; l'auteur le stylise par
 *                                            `[&_th]:…`, `[&_td]:…`, `[&_tr:nth-child(even)]:…` sur la balise
 *   <idem-logo variant="primary" class="…">  le logo de la marque (primary, onLight, onDark, mono, icon)
 *   <idem-icon name="truck" class="…">       une icône vectorielle locale (trait, couleur = `text-*`)
 *   <idem-pattern index="0" class="…">       la tuile de motif de la marque, répétée
 *
 * Ce sont des OUTILS, jamais des mises en page : la place, la taille et le style restent ceux de l'auteur
 * (ses classes Tailwind passent sur l'élément produit).
 */
import type { Block } from '../contracts/content-model';
import { chartPalette, PairMode } from '../design-system/charts/palette';
import type { DesignTokens } from '../design-system/tokens';
import { iconSvg } from '../capability-registry/local/icons';
import { motifCss } from '../design-system/kit/motifs';

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cls = (c: string | undefined) => (c && c.trim() ? ` class="${esc(c.trim())}"` : '');
let numLocale = 'fr-FR';

type Chart = Extract<Block, { kind: 'chart' }>;
type Table = Extract<Block, { kind: 'table' }>;

/** Les représentations qu'une donnée admet : l'auteur choisit, le code refuse ce qui la trahirait. */
function representable(c: Chart, wanted: string | undefined): Chart['chartType'] {
  const all: Chart['chartType'][] = ['bar', 'groupedBar', 'stacked', 'horizontalBar', 'line', 'area', 'pie', 'doughnut', 'radar'];
  const t = all.find((x) => x.toLowerCase() === (wanted ?? '').trim().toLowerCase());
  if (!t) return c.chartType;
  const positive = c.series.every((s) => s.data.every((v) => v >= 0));
  if ((t === 'pie' || t === 'doughnut') && (c.series.length !== 1 || !positive)) return c.chartType;
  if (t === 'radar' && c.labels.length < 3) return c.chartType;
  if (t === 'stacked' && !positive) return c.chartType;
  return t;
}

/**
 * Un graphique : TOUJOURS Chart.js (aucun dessin de repli). Le canvas prend la place que l'auteur lui donne
 * (`class`, `data-aspect="16/9"`), sa hauteur suit sa largeur et reste plafonnée par son conteneur. L'auteur
 * peut choisir une autre représentation des MÊMES données (`data-type`) et mettre une catégorie en avant
 * (`data-highlight`) ; les valeurs, elles, ne passent jamais par lui : la configuration est écrite par le code.
 */
export function chartHtml(block: Chart, tokens: DesignTokens, o: { className?: string; aspect?: string; surface?: string; locale?: string; type?: string; highlight?: string }): string {
  numLocale = o.locale === 'en' ? 'en-US' : o.locale && /^[a-z]{2}/.test(o.locale) ? o.locale : 'fr-FR';
  const c: Chart = { ...block, chartType: representable(block, o.type) };
  const hi = o.highlight ? c.labels.findIndex((l) => l.trim().toLowerCase() === o.highlight!.trim().toLowerCase()) : -1;
  const pie = c.chartType === 'pie' || c.chartType === 'doughnut';
  const count = pie ? c.series[0].data.length : c.series.length;
  const mode: PairMode = pie ? 'cycle' : 'adjacent';
  const surface = o.surface ?? tokens.color.ground;
  const palette = chartPalette({ primary: tokens.color.primary, accent: tokens.color.accent, secondary: tokens.color.secondary }, count, surface, mode);
  const [aw, ah] = (o.aspect ?? '').split('/').map(Number);
  const W = 640;
  const H = aw > 0 && ah > 0 ? Math.round(Math.min(1200, Math.max(200, (W * ah) / aw))) : pie ? 300 : c.chartType === 'radar' ? 420 : 360;
  const config = chartJsConfig(c, palette.colors, tokens, hi, surface);
  const label = esc(c.title ?? c.readingKey);
  // La boîte porte le ratio (la page se mesure avant que Chart.js ne dessine) ; le canvas la remplit.
  return `<figure data-ge-chart="${esc(c.chartType)}" data-ge-block="${esc(c.id)}" data-ge-palette="${palette.colors.join(',')}" data-ge-palette-mode="${mode}" data-ge-surface="${surface}" class="${esc(`flex min-h-0 min-w-0 items-center justify-center ${o.className ?? ''}`.trim())}"><div class="relative w-full max-h-full" style="aspect-ratio:${W}/${H}"><canvas data-idem-chart="${esc(JSON.stringify(config))}" role="img" aria-label="${label}" class="absolute inset-0 h-full w-full"></canvas></div></figure>`;
}

/** La configuration Chart.js des mêmes données, aux couleurs et à la police de la marque (sans fonction : du JSON). */
function chartJsConfig(c: Chart, colors: string[], tokens: DesignTokens, hi: number, surface: string): Record<string, unknown> {
  const pie = c.chartType === 'pie' || c.chartType === 'doughnut';
  const dimmed = (hex: string, i: number) => (hi >= 0 && i !== hi ? `${hex}52` : hex);
  const ink = tokens.color.ink;
  const font = { family: tokens.font.bodyStack, size: 12 };
  const legend = { display: pie || c.series.length > 1, position: pie ? 'right' : 'top', align: 'start', labels: { color: ink, font, boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'rectRounded' } };
  const base = { locale: numLocale, animation: false, responsive: true, maintainAspectRatio: false, color: ink, font, plugins: { legend, tooltip: { enabled: false }, title: { display: false } } };
  if (pie) {
    const s = c.series[0];
    return {
      type: c.chartType,
      data: { labels: c.labels, datasets: [{ label: s.name, data: s.data, backgroundColor: s.data.map((_, i) => dimmed(colors[i], i)), borderColor: surface, borderWidth: 2 }] },
      options: { ...base, ...(c.chartType === 'doughnut' ? { cutout: '58%' } : {}) },
    };
  }
  if (c.chartType === 'radar') {
    return {
      type: 'radar',
      data: { labels: c.labels, datasets: c.series.map((s, si) => ({ label: s.name, data: s.data, borderColor: colors[si], backgroundColor: `${colors[si]}33`, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: colors[si] })) },
      options: { ...base, scales: { r: { beginAtZero: true, grid: { color: tokens.color.rule }, angleLines: { color: tokens.color.rule }, pointLabels: { color: ink, font }, ticks: { display: false } } } },
    };
  }
  const line = c.chartType === 'line' || c.chartType === 'area';
  const horizontal = c.chartType === 'horizontalBar';
  const stacked = c.chartType === 'stacked';
  const datasets = c.series.map((s, si) =>
    line
      ? { label: s.name, data: s.data, borderColor: colors[si], backgroundColor: `${colors[si]}${c.series.length > 1 ? '38' : '4d'}`, fill: c.chartType === 'area' ? 'origin' : false, tension: 0.3, borderWidth: 3, pointRadius: s.data.map((_, i) => (i === hi ? 6.5 : s.data.length <= 14 ? 4 : 0)), pointBackgroundColor: colors[si] }
      : { label: s.name, data: s.data, backgroundColor: c.series.length === 1 ? s.data.map((_, i) => dimmed(colors[si], i)) : colors[si], borderRadius: 3, categoryPercentage: 0.72, barPercentage: 0.94 },
  );
  const valueAxis = { beginAtZero: true, stacked, grid: { color: tokens.color.rule }, border: { display: false }, ticks: { color: tokens.color.muted, font }, ...(c.unit ? { title: { display: true, text: c.unit, color: tokens.color.muted, font } } : {}) };
  const categoryAxis = { stacked, grid: { display: false }, border: { color: tokens.color.ruleStrong }, ticks: { color: ink, font, autoSkip: false, maxRotation: 32 } };
  return {
    type: line ? 'line' : 'bar',
    data: { labels: c.labels, datasets },
    options: { ...base, ...(horizontal ? { indexAxis: 'y' } : {}), scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis } },
  };
}

const NUMERIC = /^[\s(+−-]*[\d\s.,]+\s*(%|[A-Za-z€$£₦]{0,4}|F\s?CFA|FCFA|XAF|XOF)?\)?\s*$/;

/** Un tableau exact. Les colonnes chiffrées s'alignent à droite ; le reste du style vient de l'auteur. */
export function tableHtml(t: Table, o: { className?: string }): string {
  const numeric = t.headers.map((_, ci) => t.rows.filter((r) => (r[ci] ?? '').trim()).every((r) => NUMERIC.test(r[ci] ?? '')) && t.rows.some((r) => (r[ci] ?? '').trim()));
  const align = (ci: number) => (numeric[ci] ? ' class="text-right tabular-nums"' : '');
  const head = `<thead><tr>${t.headers.map((h, ci) => `<th${align(ci)}>${esc(h)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${t.rows.map((r) => `<tr>${t.headers.map((_, ci) => `<td${align(ci)}>${esc(r[ci] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`;
  // Des valeurs de départ lisibles ; les variantes de l'auteur sur la balise (`[&_th]:…`) passent devant.
  const base = 'w-full border-collapse text-left [&_th]:font-semibold [&_th]:py-[0.45em] [&_th]:px-[0.6em] [&_th]:border-b-2 [&_th]:border-current [&_td]:py-[0.4em] [&_td]:px-[0.6em] [&_td]:border-b [&_td]:border-rule';
  return `<table data-ge-block="${esc(t.id)}" class="${esc(`${base} ${o.className ?? ''}`.trim())}">${head}${body}</table>`;
}

type LogoVariant = 'primary' | 'onLight' | 'onDark' | 'mono' | 'icon';

export function logoHtml(tokens: DesignTokens, variant: string, o: { className?: string }): string {
  const l = tokens.brand.logos;
  const v = (['primary', 'onLight', 'onDark', 'mono', 'icon'].includes(variant) ? variant : 'primary') as LogoVariant;
  const url = v === 'icon' ? l.icon ?? l.iconOnLight ?? l.primary : l[v] ?? l.primary ?? l.onLight;
  if (url) return `<img data-ge-logo src="${esc(url)}" alt="${esc(`Logo ${tokens.brand.name}`)}" class="${esc(`w-auto object-contain ${o.className ?? 'h-[48px]'}`)}">`;
  return `<span data-ge-wordmark class="${esc(`font-display font-bold leading-none whitespace-nowrap ${o.className ?? ''}`.trim())}">${esc(tokens.brand.name)}</span>`;
}

export function iconHtml(name: string, o: { className?: string }): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const svg = (clean && (iconSvg(clean, 'tabler') ?? iconSvg(clean, 'lucide'))) || iconSvg('circle', 'tabler') || '';
  if (!svg) return '';
  return `<span aria-hidden="true" data-ge-icon="${esc(clean)}" class="${esc(`inline-flex shrink-0 [&>svg]:w-full [&>svg]:h-full ${o.className ?? 'size-[1.2em]'}`)}">${svg.replace(/\s(width|height)="[^"]*"/g, '')}</span>`;
}

/** Le motif reste DISCRET : son opacité est plafonnée par le code (demande de l'utilisateur, 15/10/2026). */
const PATTERN_MAX_OPACITY = 0.1;

function discreet(className: string | undefined): string {
  const classes = (className ?? '').split(/\s+/).filter(Boolean);
  let wanted = 0.06;
  const kept = classes.filter((c) => {
    const m = c.match(/^opacity-(?:\[([\d.]+)%?\]|(\d+))$/);
    if (!m) return true;
    const v = m[1] !== undefined ? parseFloat(m[1]) : Number(m[2]) / 100;
    wanted = v > 1 ? v / 100 : v;
    return false;
  });
  return [...kept, `opacity-[${Math.min(PATTERN_MAX_OPACITY, Math.max(0.03, wanted))}]`].join(' ');
}

export function patternHtml(tokens: DesignTokens, index: number, o: { className?: string }): string {
  const p = tokens.brand.patterns[Math.max(0, Math.min(tokens.brand.patterns.length - 1, index || 0))];
  if (!p) return '';
  o = { className: discreet(o.className) };
  // Le seul style en ligne : l'adresse de la tuile (une donnée du code, pas une décision de l'auteur).
  return `<div aria-hidden="true" data-ge-pattern${cls(o.className)} style="background-image:url('${p.url.replace(/'/g, '%27')}');background-size:${p.tile}px ${p.tile}px;background-repeat:repeat"></div>`;
}

type Mockups = Extract<Block, { kind: 'mockupShowcase' }>;

/**
 * Des MOCKUPS finis (publications, bannières, profils rendus dans le gabarit de leur réseau) : montrés ENTIERS, à leur
 * proportion, côte à côte — ou empilés quand ce sont des bannières. Jamais recadrés, pivotés ni recouverts : ils sont
 * la démonstration. `labels: false` : sans légende.
 */
export function galleryHtml(block: Mockups, o: { className?: string; labels?: boolean }): string {
  const wide = block.items.reduce((s, i) => s + (i.ratio || 1), 0) / Math.max(1, block.items.length) > 2.2;
  const items = block.items
    .map((item) => {
      const grow = wide ? '1' : Math.max(0.3, Math.min(6, item.ratio || 1)).toFixed(2);
      return `<figure class="flex min-h-0 min-w-0 flex-[${grow}_1_0%] flex-col items-center justify-center gap-[10px]"><img src="${esc(item.url)}" alt="${esc(item.label)}" class="min-h-0 max-h-full max-w-full flex-1 object-contain">${o.labels === false ? '' : `<figcaption class="text-center text-[12px] font-medium uppercase tracking-[0.08em] text-muted">${esc(item.label)}</figcaption>`}</figure>`;
    })
    .join('');
  return `<div data-ge-gallery data-ge-block="${esc(block.id)}" class="${esc(`flex min-h-0 w-full ${wide ? 'flex-col' : 'flex-row'} items-stretch justify-center gap-[28px] ${o.className ?? 'h-full'}`.trim())}">${items}</div>`;
}

type Patterns = Extract<Block, { kind: 'patternGrid' }>;

/**
 * Une TUILE de motif : le vrai motif de la marque (son fichier SVG déposé, répété à son pas), sinon le motif dessiné
 * par le code aux encres de la charte. Le style en ligne est celui du CODE (une donnée), jamais celui d'un auteur.
 */
export function patternTileHtml(block: Patterns, index: number, o: { className?: string }): string {
  const p = block.patterns[Math.max(0, Math.min(block.patterns.length - 1, index || 0))];
  if (!p) return '';
  const style = p.url
    ? `background-color:${p.ground};background-image:url('${p.url.replace(/'/g, '%27')}');background-size:${p.tile ?? 48}px ${p.tile ?? 48}px;background-repeat:repeat`
    : Object.entries(motifCss(p.motif, p.ink, p.ground, 1.6))
        .map(([k, v]) => `${k}:${v}`)
        .join(';');
  return `<div data-ge-pattern-tile class="${esc(`border border-rule ${o.className ?? 'h-full w-full'}`)}" style="${esc(style)}"></div>`;
}
