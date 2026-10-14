/**
 * LES PRIMITIVES — ce que le code dessine pour l'auteur, parce que l'exactitude l'exige :
 *
 *   <idem-chart data-block="b3" class="…">   un graphique SVG des vraies données (9 types), palette de la marque
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

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cls = (c: string | undefined) => (c && c.trim() ? ` class="${esc(c.trim())}"` : '');
let numLocale = 'fr-FR';
const num = (v: number) => new Intl.NumberFormat(numLocale, { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 }).format(v);
const r1 = (v: number) => Math.round(v * 10) / 10;

type Chart = Extract<Block, { kind: 'chart' }>;
type Table = Extract<Block, { kind: 'table' }>;

/** Une échelle « ronde » de 0 (ou du minimum négatif) au maximum. */
function niceScale(min: number, max: number, ticks = 5): { lo: number; hi: number; step: number } {
  const lo0 = Math.min(0, min);
  const span = Math.max(1e-9, max - lo0);
  const raw = span / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return { lo: Math.floor(lo0 / step) * step, hi: Math.ceil(max / step) * step || step, step };
}

function legend(names: string[], colors: string[], x: number, y: number, width: number): string {
  if (names.length < 2) return '';
  const items: string[] = [];
  let cx = x;
  let cy = y;
  for (let i = 0; i < names.length; i++) {
    const w = 22 + Math.min(180, names[i].length * 7.4);
    if (cx + w > x + width && cx > x) {
      cx = x;
      cy += 20;
    }
    items.push(`<rect x="${r1(cx)}" y="${r1(cy - 9)}" width="11" height="11" rx="2" fill="${colors[i]}"/><text x="${r1(cx + 16)}" y="${r1(cy)}" font-size="13">${esc(names[i])}</text>`);
    cx += w + 10;
  }
  return `<g fill="currentColor">${items.join('')}</g>`;
}

function cartesian(c: Chart, colors: string[], W: number, H: number): string {
  const horizontal = c.chartType === 'horizontalBar';
  const stacked = c.chartType === 'stacked';
  const n = c.labels.length;
  const legendH = c.series.length > 1 ? 30 : 0;
  const values = stacked ? c.labels.map((_, i) => c.series.reduce((s, se) => s + Math.max(0, se.data[i] ?? 0), 0)) : c.series.flatMap((s) => s.data);
  const { lo, hi, step } = niceScale(Math.min(...values), Math.max(...values));
  const unit = c.unit ? ` ${c.unit}` : '';
  const longest = Math.max(...c.labels.map((l) => l.length));
  const left = horizontal ? Math.min(W * 0.34, 16 + longest * 7) : 14 + Math.max(...[lo, hi].map((v) => (num(v) + unit).length)) * 7.5;
  const top = 12 + legendH;
  const bottom = horizontal ? 26 : n > 8 || longest > 10 ? 48 : 30;
  const pw = W - left - 14;
  const ph = H - top - bottom;
  const out: string[] = [];
  out.push(legend(c.series.map((s) => s.name), colors, left, 16, pw));
  // Grille et graduations.
  for (let v = lo; v <= hi + step / 2; v += step) {
    const t = (v - lo) / (hi - lo || 1);
    if (horizontal) {
      const x = left + t * pw;
      out.push(`<line x1="${r1(x)}" y1="${top}" x2="${r1(x)}" y2="${top + ph}" stroke="currentColor" stroke-opacity="0.14"/><text x="${r1(x)}" y="${top + ph + 18}" font-size="12" text-anchor="middle" fill="currentColor" fill-opacity="0.75">${esc(num(v))}</text>`);
    } else {
      const y = top + ph - t * ph;
      out.push(`<line x1="${left}" y1="${r1(y)}" x2="${left + pw}" y2="${r1(y)}" stroke="currentColor" stroke-opacity="0.14"/><text x="${left - 8}" y="${r1(y + 4)}" font-size="12" text-anchor="end" fill="currentColor" fill-opacity="0.75">${esc(num(v) + (v === hi ? unit : ''))}</text>`);
    }
  }
  const scale = (v: number) => ((v - lo) / (hi - lo || 1)) * (horizontal ? pw : ph);
  const zero = scale(0);
  const band = (horizontal ? ph : pw) / n;
  if (c.chartType === 'line' || c.chartType === 'area') {
    c.series.forEach((s, si) => {
      const pts = s.data.map((v, i) => [left + band * (i + 0.5), top + ph - scale(v)] as const);
      const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)},${r1(y)}`).join(' ');
      if (c.chartType === 'area') out.push(`<path d="${d} L${r1(pts[pts.length - 1][0])},${r1(top + ph - zero)} L${r1(pts[0][0])},${r1(top + ph - zero)} Z" fill="${colors[si]}" fill-opacity="${c.series.length > 1 ? 0.22 : 0.3}"/>`);
      out.push(`<path d="${d}" fill="none" stroke="${colors[si]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
      if (pts.length <= 14) for (const [x, y] of pts) out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="4" fill="${colors[si]}"/>`);
    });
  } else {
    const groups = stacked || c.series.length === 1 ? 1 : c.series.length;
    const inner = band * 0.72;
    const bw = inner / groups;
    for (let i = 0; i < n; i++) {
      let acc = 0;
      c.series.forEach((s, si) => {
        const v = s.data[i] ?? 0;
        const len = Math.abs(scale(v) - zero);
        const from = stacked ? scale(acc) : Math.min(scale(v), zero);
        if (stacked) acc += Math.max(0, v);
        const offset = band * i + (band - inner) / 2 + (stacked ? 0 : bw * si);
        if (horizontal) out.push(`<rect x="${r1(left + from)}" y="${r1(top + offset)}" width="${r1(Math.max(0.5, len))}" height="${r1(Math.max(1, (stacked ? inner : bw) - 2))}" rx="2" fill="${colors[si]}"/>`);
        else out.push(`<rect x="${r1(left + offset)}" y="${r1(top + ph - from - len)}" width="${r1(Math.max(1, (stacked ? inner : bw) - 2))}" height="${r1(Math.max(0.5, len))}" rx="2" fill="${colors[si]}"/>`);
      });
      if (c.series.length === 1 && n <= 12) {
        const v = c.series[0].data[i] ?? 0;
        if (horizontal) out.push(`<text x="${r1(left + Math.max(scale(v), zero) + 6)}" y="${r1(top + band * (i + 0.5) + 4)}" font-size="12" fill="currentColor">${esc(num(v))}</text>`);
        else out.push(`<text x="${r1(left + band * (i + 0.5))}" y="${r1(top + ph - Math.max(scale(v), zero) - 6)}" font-size="12" text-anchor="middle" fill="currentColor">${esc(num(v))}</text>`);
      }
    }
  }
  // Étiquettes de catégories.
  c.labels.forEach((label, i) => {
    const text = esc(label.length > 18 ? `${label.slice(0, 17)}…` : label);
    if (horizontal) out.push(`<text x="${left - 8}" y="${r1(top + band * (i + 0.5) + 4)}" font-size="12.5" text-anchor="end" fill="currentColor">${text}</text>`);
    else if (bottom > 40) out.push(`<text transform="translate(${r1(left + band * (i + 0.5))},${top + ph + 14}) rotate(-32)" font-size="12" text-anchor="end" fill="currentColor">${text}</text>`);
    else out.push(`<text x="${r1(left + band * (i + 0.5))}" y="${top + ph + 19}" font-size="12.5" text-anchor="middle" fill="currentColor">${text}</text>`);
  });
  out.push(`<line x1="${left}" y1="${r1(top + ph - (horizontal ? 0 : zero))}" x2="${left + pw}" y2="${r1(top + ph - (horizontal ? 0 : zero))}" stroke="currentColor" stroke-opacity="0.4"/>`);
  return out.join('');
}

function radial(c: Chart, colors: string[], W: number, H: number): string {
  const s = c.series[0];
  const total = s.data.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const R = Math.min(H - 24, W * 0.5) / 2;
  const cx = R + 12;
  const cy = H / 2;
  const hole = c.chartType === 'doughnut' ? R * 0.58 : 0;
  const out: string[] = [];
  let a = -Math.PI / 2;
  s.data.forEach((v, i) => {
    const sweep = (Math.max(0, v) / total) * Math.PI * 2;
    if (sweep <= 0) return;
    const b = a + Math.min(sweep, Math.PI * 2 - 1e-4);
    const large = sweep > Math.PI ? 1 : 0;
    const p = (ang: number, r: number) => `${r1(cx + r * Math.cos(ang))},${r1(cy + r * Math.sin(ang))}`;
    const d = hole ? `M${p(a, R)} A${R},${R} 0 ${large} 1 ${p(b, R)} L${p(b, hole)} A${r1(hole)},${r1(hole)} 0 ${large} 0 ${p(a, hole)} Z` : `M${cx},${cy} L${p(a, R)} A${R},${R} 0 ${large} 1 ${p(b, R)} Z`;
    out.push(`<path d="${d}" fill="${colors[i]}" stroke="var(--color-ground, #fff)" stroke-width="2"/>`);
    a += sweep;
  });
  // Légende : chaque part, sa valeur et son pourcentage.
  const lx = cx + R + 28;
  const rows = s.data.length;
  const lh = Math.min(28, (H - 20) / rows);
  s.data.forEach((v, i) => {
    const y = cy - (rows * lh) / 2 + lh * i + lh / 2;
    out.push(`<rect x="${r1(lx)}" y="${r1(y - 7)}" width="13" height="13" rx="3" fill="${colors[i]}"/><text x="${r1(lx + 20)}" y="${r1(y + 4)}" font-size="13.5" fill="currentColor">${esc(c.labels[i] ?? '')} <tspan fill-opacity="0.7">${esc(num(v))}${c.unit ? ` ${esc(c.unit)}` : ''} · ${Math.round((Math.max(0, v) / total) * 100)} %</tspan></text>`);
  });
  return out.join('');
}

function radar(c: Chart, colors: string[], W: number, H: number): string {
  const n = c.labels.length;
  const legendH = c.series.length > 1 ? 30 : 0;
  const R = Math.min(W * 0.36, (H - legendH) / 2 - 30);
  const cx = W / 2;
  const cy = legendH + (H - legendH) / 2;
  const max = Math.max(...c.series.flatMap((s) => s.data), 1);
  const pt = (i: number, r: number) => [cx + r * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n), cy + r * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / n)] as const;
  const out: string[] = [legend(c.series.map((s) => s.name), colors, 16, 16, W - 32)];
  for (const f of [0.25, 0.5, 0.75, 1]) out.push(`<polygon points="${c.labels.map((_, i) => pt(i, R * f).map(r1).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-opacity="0.14"/>`);
  c.labels.forEach((label, i) => {
    const [x, y] = pt(i, R);
    const [lx, ly] = pt(i, R + 16);
    out.push(`<line x1="${cx}" y1="${cy}" x2="${r1(x)}" y2="${r1(y)}" stroke="currentColor" stroke-opacity="0.14"/><text x="${r1(lx)}" y="${r1(ly + 4)}" font-size="12.5" text-anchor="${Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}" fill="currentColor">${esc(label)}</text>`);
  });
  c.series.forEach((s, si) => {
    const pts = s.data.map((v, i) => pt(i, (Math.max(0, v) / max) * R).map(r1).join(',')).join(' ');
    out.push(`<polygon points="${pts}" fill="${colors[si]}" fill-opacity="0.2" stroke="${colors[si]}" stroke-width="2.5"/>`);
  });
  return out.join('');
}

/** Un graphique : une figure SVG qui prend la place que l'auteur lui donne (`class`, `data-aspect="16/9"`). */
export function chartHtml(c: Chart, tokens: DesignTokens, o: { className?: string; aspect?: string; surface?: string; locale?: string }): string {
  numLocale = o.locale === 'en' ? 'en-US' : o.locale && /^[a-z]{2}/.test(o.locale) ? o.locale : 'fr-FR';
  const pie = c.chartType === 'pie' || c.chartType === 'doughnut';
  const count = pie ? c.series[0].data.length : c.series.length;
  const mode: PairMode = pie ? 'cycle' : 'adjacent';
  const surface = o.surface ?? tokens.color.ground;
  const palette = chartPalette({ primary: tokens.color.primary, accent: tokens.color.accent, secondary: tokens.color.secondary }, count, surface, mode);
  const [aw, ah] = (o.aspect ?? '').split('/').map(Number);
  const W = 640;
  const H = aw > 0 && ah > 0 ? Math.round(Math.min(1200, Math.max(200, (W * ah) / aw))) : pie ? 300 : c.chartType === 'radar' ? 420 : 360;
  const body = pie ? radial(c, palette.colors, W, H) : c.chartType === 'radar' ? radar(c, palette.colors, W, H) : cartesian(c, palette.colors, W, H);
  return `<figure data-ge-chart="${esc(c.chartType)}" data-ge-block="${esc(c.id)}" data-ge-palette="${palette.colors.join(',')}" data-ge-palette-mode="${mode}" data-ge-surface="${surface}"${cls(o.className)}><svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(c.title ?? c.readingKey)}" class="block overflow-visible">${body}</svg></figure>`;
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

export function patternHtml(tokens: DesignTokens, index: number, o: { className?: string }): string {
  const p = tokens.brand.patterns[Math.max(0, Math.min(tokens.brand.patterns.length - 1, index || 0))];
  if (!p) return '';
  // Le seul style en ligne : l'adresse de la tuile (une donnée du code, pas une décision de l'auteur).
  return `<div aria-hidden="true" data-ge-pattern${cls(o.className)} style="background-image:url('${p.url.replace(/'/g, '%27')}');background-size:${p.tile}px ${p.tile}px;background-repeat:repeat"></div>`;
}
