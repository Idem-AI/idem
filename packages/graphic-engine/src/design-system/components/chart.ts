/**
 * Les GRAPHIQUES, dessinés par le code en SVG à partir des données du contenu.
 *
 * Aucun modèle ne dessine un graphique, aucun script n'est nécessaire au rendu : le SVG est exact dans
 * l'aperçu, dans le PDF et à l'impression, et il survit au déplacement d'une page à l'autre.
 *
 * Méthode (compétence dataviz) :
 *  · la FORME suit la donnée : des étiquettes longues font passer des barres à l'horizontale ;
 *  · la palette catégorielle est VALIDÉE par le calcul (`charts/palette.ts`) ;
 *  · marques fines : barres ≤ 24 px à bout arrondi de 4 px (carré sur la ligne de base), lignes de 2 px,
 *    marqueurs ≥ 8 px cerclés de la surface, aires à ~10 % ; 2 px de surface entre deux aplats ;
 *  · une légende dès deux séries, des étiquettes directes SÉLECTIVES (jamais un chiffre sur chaque point) ;
 *  · le texte porte les encres de texte, jamais la couleur d'une série ; grille et axes en retrait ;
 *  · un seul axe des valeurs, qui part de zéro pour les barres et les aires.
 *
 * Écart assumé : un livrable imprimé n'a pas de calque de survol scripté (le HTML des sections est
 * nettoyé de tout script). Chaque marque porte un `<title>` (infobulle native) et le SVG un `<desc>` qui
 * restitue toutes les valeurs : l'équivalent « vue tableau » pour les lecteurs d'écran.
 */
import type { ChartType } from '../../contracts/content-model';
import { mixHex, readableInk, contrastRatio } from '../../foundation/color';
import { css, esc } from '../../foundation/html';
import { estimateWidthPx } from '../../foundation/typeset';
import type { CompileContext, Env } from '../../html-css-compiler/context';
import { chartPalette, PairMode } from '../charts/palette';
import { formatNumber, ink, label, txt } from './kit';
import { registerComponent } from './registry';
import type { ComponentFor } from './types';

type ChartBlock = Parameters<ComponentFor<'chart'>['render']>[0]['block'];

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Graduations « rondes » (1, 2, 2,5, 5 × 10ⁿ) couvrant [min, max], au plus `count + 1` intervalles :
 * parmi les pas admis, celui dont la dernière graduation colle au maximum (un pas trop grossier montait
 * à 3 000 pour un maximum de 2 240 — un quart du graphique vide).
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) max = min + 1;
  const span = max - min;
  const mag = Math.pow(10, Math.floor(Math.log10(span / Math.max(1, count))));
  const candidates = [0.5, 1, 2, 2.5, 5, 10, 20].map((m) => m * mag);
  let best: number[] = [];
  let bestWaste = Infinity;
  for (const step of candidates) {
    const start = Math.floor(min / step + 1e-9) * step;
    const end = Math.ceil(max / step - 1e-9) * step;
    const intervals = Math.round((end - start) / step);
    if (intervals < 2 || intervals > count + 1) continue;
    const waste = (end - start - span) / span + intervals * 0.002;
    if (waste < bestWaste) {
      bestWaste = waste;
      best = Array.from({ length: intervals + 1 }, (_, i) => Math.round((start + i * step) / step) * step);
    }
  }
  return best.length ? best : [min, max];
}

interface Geometry {
  W: number;
  H: number;
  font: string;
  tick: number;
  surface: string;
  text: string;
  muted: string;
  grid: string;
  axis: string;
  colors: string[];
  fmt: (v: number) => string;
  fmtTick: (v: number) => string;
}

function textEl(x: number, y: number, value: string, g: Geometry, opts: { anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: number; color?: string; baseline?: 'auto' | 'middle' | 'hanging' } = {}): string {
  return `<text x="${r1(x)}" y="${r1(y)}" font-family="${esc(g.font)}" font-size="${opts.size ?? g.tick}" font-weight="${opts.weight ?? 400}" fill="${opts.color ?? g.muted}" text-anchor="${opts.anchor ?? 'start'}"${opts.baseline && opts.baseline !== 'auto' ? ` dominant-baseline="${opts.baseline === 'middle' ? 'central' : 'hanging'}"` : ''}>${esc(value)}</text>`;
}

/** Une étiquette sur deux lignes au plus (mots entiers), pour tenir dans une bande. */
function wrapLabel(text: string, width: number, size: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateWidthPx(next, size) <= width || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length <= 2 ? lines : [lines[0], lines.slice(1).join(' ')];
}

/** Un rectangle dont le bout « données » est arrondi (4 px) et la base carrée. */
function barPath(x: number, y: number, w: number, h: number, direction: 'up' | 'down' | 'right' | 'left', radius = 4): string {
  const r = Math.max(0, Math.min(radius, w / 2, h));
  if (h <= 0 || w <= 0) return '';
  if (direction === 'up') return `M${r1(x)},${r1(y + h)} L${r1(x)},${r1(y + r)} Q${r1(x)},${r1(y)} ${r1(x + r)},${r1(y)} L${r1(x + w - r)},${r1(y)} Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + r)} L${r1(x + w)},${r1(y + h)} Z`;
  if (direction === 'down') return `M${r1(x)},${r1(y)} L${r1(x + w)},${r1(y)} L${r1(x + w)},${r1(y + h - r)} Q${r1(x + w)},${r1(y + h)} ${r1(x + w - r)},${r1(y + h)} L${r1(x + r)},${r1(y + h)} Q${r1(x)},${r1(y + h)} ${r1(x)},${r1(y + h - r)} Z`;
  const rh = Math.max(0, Math.min(radius, h / 2, w));
  if (direction === 'right') return `M${r1(x)},${r1(y)} L${r1(x + w - rh)},${r1(y)} Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + rh)} L${r1(x + w)},${r1(y + h - rh)} Q${r1(x + w)},${r1(y + h)} ${r1(x + w - rh)},${r1(y + h)} L${r1(x)},${r1(y + h)} Z`;
  return `M${r1(x + w)},${r1(y)} L${r1(x + rh)},${r1(y)} Q${r1(x)},${r1(y)} ${r1(x)},${r1(y + rh)} L${r1(x)},${r1(y + h - rh)} Q${r1(x)},${r1(y + h)} ${r1(x + rh)},${r1(y + h)} L${r1(x + w)},${r1(y + h)} Z`;
}

const tip = (text: string): string => `<title>${esc(text)}</title>`;

// ── Barres verticales (simples, groupées, empilées) ───────────────────────────────────────

function columns(block: ChartBlock, g: Geometry, kind: 'bar' | 'groupedBar' | 'stacked'): string {
  const n = block.labels.length;
  const k = block.series.length;
  const stacked = kind === 'stacked' && k > 1;
  const totals = block.labels.map((_, i) => block.series.reduce((s, ser) => s + Math.max(0, ser.data[i]), 0));
  const negatives = block.labels.map((_, i) => block.series.reduce((s, ser) => s + Math.min(0, ser.data[i]), 0));
  const values = block.series.flatMap((s) => s.data);
  const maxV = stacked ? Math.max(0, ...totals) : Math.max(0, ...values);
  const minV = stacked ? Math.min(0, ...negatives) : Math.min(0, ...values);
  // Une seule série et peu de barres : chaque barre porte sa valeur, la grille s'efface (et l'échelle
  // n'a plus besoin de graduations rondes : la plus haute barre occupe la hauteur).
  const direct = k === 1 && n <= 8;
  const ticks = direct ? [Math.min(0, minV * 1.08), maxV * 1.04 || 1] : niceTicks(minV, maxV, 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const tickWidth = Math.max(...ticks.map((t) => estimateWidthPx(g.fmtTick(t), g.tick)));
  const left = direct ? 2 : tickWidth + 10;
  const band = (g.W - left - 4) / n;
  const labelLines = block.labels.map((l) => wrapLabel(l, band * 0.94, g.tick));
  const bottom = Math.max(...labelLines.map((l) => l.length)) * g.tick * 1.25 + 8;
  const top = direct || stacked ? g.tick * 1.8 : 6;
  const plotH = g.H - top - bottom;
  const y = (v: number) => top + plotH * (1 - (v - lo) / (hi - lo || 1));
  const base = y(0);
  let out = '';
  if (!direct) for (const t of ticks) out += `<line x1="${left}" x2="${g.W}" y1="${r1(y(t))}" y2="${r1(y(t))}" stroke="${t === 0 ? g.axis : g.grid}" stroke-width="1"/>` + textEl(left - 6, y(t), g.fmtTick(t), g, { anchor: 'end', baseline: 'middle' });
  else out += `<line x1="0" x2="${g.W}" y1="${r1(base)}" y2="${r1(base)}" stroke="${g.axis}" stroke-width="1"/>`;

  const groupWidth = Math.min(band * 0.72, stacked ? 24 : k * 24 + (k - 1) * 2);
  const barW = stacked ? groupWidth : Math.min(24, (groupWidth - (k - 1) * 2) / k);
  block.labels.forEach((labelText, i) => {
    const cx = left + band * i + band / 2;
    if (stacked) {
      let up = 0;
      let down = 0;
      const lastPositive = block.series.map((s, j) => (s.data[i] > 0 ? j : -1)).reduce((a, b) => Math.max(a, b), -1);
      block.series.forEach((s, j) => {
        const v = s.data[i];
        if (!v) return;
        const from = v >= 0 ? up : down;
        const to = from + v;
        if (v >= 0) up = to;
        else down = to;
        const y0 = y(from);
        const y1 = y(to);
        const top_ = Math.min(y0, y1);
        // 2 px de surface entre deux segments empilés.
        const h = Math.abs(y1 - y0) - (j > 0 ? 2 : 0);
        const path = j === lastPositive && v > 0 ? barPath(cx - barW / 2, top_, barW, h, 'up') : `M${r1(cx - barW / 2)},${r1(top_)} h${r1(barW)} v${r1(Math.max(0, h))} h${r1(-barW)} Z`;
        out += `<path d="${path}" fill="${g.colors[j]}">${tip(`${labelText} — ${s.name} : ${g.fmt(v)}`)}</path>`;
      });
      if (n <= 8) out += textEl(cx, y(totals[i]) - 6, g.fmt(totals[i]), g, { anchor: 'middle', weight: 600, color: g.text });
    } else {
      block.series.forEach((s, j) => {
        const v = s.data[i];
        const x = cx - groupWidth / 2 + j * (barW + 2);
        const yv = y(v);
        const h = Math.abs(base - yv);
        out += `<path d="${barPath(x, Math.min(base, yv), barW, h, v >= 0 ? 'up' : 'down')}" fill="${g.colors[j]}">${tip(`${labelText}${k > 1 ? ` — ${s.name}` : ''} : ${g.fmt(v)}`)}</path>`;
        if (direct) out += textEl(x + barW / 2, v >= 0 ? yv - 6 : yv + g.tick + 4, g.fmt(v), g, { anchor: 'middle', weight: 600, color: g.text });
      });
    }
    // Sous la zone de tracé (et non sous la ligne de zéro) : une barre négative ne recouvre jamais son étiquette.
    labelLines[i].forEach((line, li) => (out += textEl(cx, top + plotH + 8 + g.tick * (li + 0.85) * 1.2, line, g, { anchor: 'middle' })));
  });
  return out;
}

// ── Barres horizontales ────────────────────────────────────────────────────────────────────

function bars(block: ChartBlock, g: Geometry): { svg: string; height: number } {
  const n = block.labels.length;
  const k = block.series.length;
  const thick = Math.min(24, Math.max(10, g.tick * 1.4));
  const rowGap = Math.round(thick * 0.75);
  const rowH = k * thick + (k - 1) * 2;
  const labelWidth = Math.min(g.W * 0.36, Math.max(...block.labels.map((l) => estimateWidthPx(l, g.tick))) + 10);
  const values = block.series.flatMap((s) => s.data);
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const valueRoom = Math.max(...values.map((v) => estimateWidthPx(g.fmt(v), g.tick))) + 10;
  const plotW = g.W - labelWidth - valueRoom;
  const x = (v: number) => labelWidth + (plotW * (v - minV)) / (maxV - minV || 1);
  const base = x(0);
  const height = n * rowH + (n - 1) * rowGap + 4;
  let out = `<line x1="${r1(base)}" x2="${r1(base)}" y1="0" y2="${height}" stroke="${g.axis}" stroke-width="1"/>`;
  block.labels.forEach((labelText, i) => {
    const y0 = i * (rowH + rowGap);
    out += textEl(0, y0 + rowH / 2, labelText, g, { baseline: 'middle', color: g.text });
    block.series.forEach((s, j) => {
      const v = s.data[i];
      const yy = y0 + j * (thick + 2);
      const xv = x(v);
      const w = Math.abs(xv - base);
      out += `<path d="${barPath(Math.min(base, xv), yy, w, thick, v >= 0 ? 'right' : 'left')}" fill="${g.colors[j]}">${tip(`${labelText}${k > 1 ? ` — ${s.name}` : ''} : ${g.fmt(v)}`)}</path>`;
      out += textEl(v >= 0 ? xv + 6 : xv - 6, yy + thick / 2, g.fmt(v), g, { anchor: v >= 0 ? 'start' : 'end', baseline: 'middle', weight: 600, color: g.text });
    });
  });
  return { svg: out, height };
}

// ── Courbes et aires ───────────────────────────────────────────────────────────────────────

function lines(block: ChartBlock, g: Geometry, area: boolean): string {
  const n = block.labels.length;
  const k = block.series.length;
  const values = block.series.flatMap((s) => s.data);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Une aire part de zéro ; une courbe peut ne pas en partir quand toutes les valeurs en sont loin.
  const zero = area || rawMin <= 0 || rawMin < rawMax * 0.5;
  const ticks = niceTicks(zero ? Math.min(0, rawMin) : rawMin, rawMax, 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const tickWidth = Math.max(...ticks.map((t) => estimateWidthPx(g.fmtTick(t), g.tick)));
  const left = tickWidth + 10;
  const endLabels = k <= 4;
  const endWidth = endLabels ? Math.max(...block.series.map((s) => estimateWidthPx(`${g.fmt(s.data[n - 1])}${k > 1 ? ` ${s.name}` : ''}`, g.tick))) + 14 : 10;
  const right = Math.min(g.W * 0.32, endWidth);
  const step = n > 1 ? (g.W - left - right) / (n - 1) : 0;
  const bottom = g.tick * 2 + 6;
  const top = 8;
  const plotH = g.H - top - bottom;
  const y = (v: number) => top + plotH * (1 - (v - lo) / (hi - lo || 1));
  const x = (i: number) => left + step * i;
  let out = '';
  for (const t of ticks) out += `<line x1="${left}" x2="${r1(g.W - right + 4)}" y1="${r1(y(t))}" y2="${r1(y(t))}" stroke="${t === 0 ? g.axis : g.grid}" stroke-width="1"/>` + textEl(left - 6, y(t), g.fmtTick(t), g, { anchor: 'end', baseline: 'middle' });
  // Étiquettes de l'axe des catégories : au plus huit, régulièrement espacées (jamais toutes si elles se chevauchent).
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((g.W - left - right) / (Math.max(...block.labels.map((l) => estimateWidthPx(l, g.tick))) + 12)))));
  block.labels.forEach((l, i) => {
    if (i % every === 0 || i === n - 1) out += textEl(x(i), g.H - bottom + g.tick + 6, l, g, { anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
  });
  const placed: number[] = [];
  block.series.forEach((s, j) => {
    const pts = s.data.map((v, i) => `${r1(x(i))},${r1(y(v))}`);
    if (area) out += `<path d="M${r1(x(0))},${r1(y(Math.max(lo, 0)))} L${pts.join(' L')} L${r1(x(n - 1))},${r1(y(Math.max(lo, 0)))} Z" fill="${g.colors[j]}" fill-opacity="0.1"/>`;
    out += `<polyline points="${pts.join(' ')}" fill="none" stroke="${g.colors[j]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const markers = n <= 6 && k <= 3;
    s.data.forEach((v, i) => {
      if (markers || i === n - 1) out += `<circle cx="${r1(x(i))}" cy="${r1(y(v))}" r="4.5" fill="${g.colors[j]}" stroke="${g.surface}" stroke-width="2">${tip(`${block.labels[i]}${k > 1 ? ` — ${s.name}` : ''} : ${g.fmt(v)}`)}</circle>`;
    });
    if (endLabels) {
      const yy = y(s.data[n - 1]);
      // Deux étiquettes de fin qui se chevauchent : on n'empile pas, la légende porte la seconde.
      if (placed.every((p) => Math.abs(p - yy) > g.tick * 1.15)) {
        placed.push(yy);
        out += textEl(x(n - 1) + 9, yy, `${g.fmt(s.data[n - 1])}${k > 1 ? ` ${s.name}` : ''}`, g, { baseline: 'middle', weight: 600, color: g.text });
      }
    }
  });
  return out;
}

// ── Secteurs et anneaux ────────────────────────────────────────────────────────────────────

function pie(block: ChartBlock, g: Geometry, doughnut: boolean, ctx: CompileContext): { svg: string; legend: Array<{ color: string; label: string; value: string; share: string }> } {
  // Une part d'un tout : la première série seule. Au-delà de six parts, les plus petites deviennent « Autres ».
  const raw = block.labels.map((l, i) => ({ label: l, value: Math.max(0, block.series[0].data[i]) })).filter((p) => p.value > 0);
  raw.sort((a, b) => b.value - a.value);
  const parts = raw.length > 6 ? [...raw.slice(0, 5), { label: label(ctx, 'other'), value: raw.slice(5).reduce((s, p) => s + p.value, 0) }] : raw;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const size = Math.min(g.H, g.W * 0.5);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 2;
  const inner = doughnut ? R * 0.6 : 0;
  let angle = -Math.PI / 2;
  let out = '';
  const legend: Array<{ color: string; label: string; value: string; share: string }> = [];
  parts.forEach((p, i) => {
    const sweep = (p.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const large = sweep > Math.PI ? 1 : 0;
    const pt = (a: number, r: number) => `${r1(cx + Math.cos(a) * r)},${r1(cy + Math.sin(a) * r)}`;
    const path =
      parts.length === 1
        ? doughnut
          ? `M${r1(cx + R)},${r1(cy)} A${r1(R)},${r1(R)} 0 1 1 ${r1(cx - R)},${r1(cy)} A${r1(R)},${r1(R)} 0 1 1 ${r1(cx + R)},${r1(cy)} M${r1(cx + inner)},${r1(cy)} A${r1(inner)},${r1(inner)} 0 1 0 ${r1(cx - inner)},${r1(cy)} A${r1(inner)},${r1(inner)} 0 1 0 ${r1(cx + inner)},${r1(cy)} Z`
          : `M${r1(cx + R)},${r1(cy)} A${r1(R)},${r1(R)} 0 1 1 ${r1(cx - R)},${r1(cy)} A${r1(R)},${r1(R)} 0 1 1 ${r1(cx + R)},${r1(cy)} Z`
        : doughnut
          ? `M${pt(a0, R)} A${r1(R)},${r1(R)} 0 ${large} 1 ${pt(a1, R)} L${pt(a1, inner)} A${r1(inner)},${r1(inner)} 0 ${large} 0 ${pt(a0, inner)} Z`
          : `M${r1(cx)},${r1(cy)} L${pt(a0, R)} A${r1(R)},${r1(R)} 0 ${large} 1 ${pt(a1, R)} Z`;
    const share = `${formatNumber((p.value / total) * 100, ctx.locale, { digits: p.value / total < 0.1 ? 1 : 0 })}${ctx.locale.startsWith('fr') ? ' %' : '%'}`;
    // 2 px de surface entre deux parts : le trait est à la couleur du fond, jamais une bordure d'encre.
    out += `<path d="${path}" fill="${g.colors[i]}" stroke="${g.surface}" stroke-width="2" stroke-linejoin="round" fill-rule="evenodd">${tip(`${p.label} : ${g.fmt(p.value)} (${share})`)}</path>`;
    if (sweep >= Math.PI * 0.24 && R > 60) {
      const mid = (a0 + a1) / 2;
      const rr = doughnut ? (R + inner) / 2 : R * 0.62;
      const onFill = readableInk(contrastRatio('#ffffff', g.colors[i]) > contrastRatio('#000000', g.colors[i]) ? '#ffffff' : '#111111', g.colors[i], 4.5);
      out += textEl(cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr, share, g, { anchor: 'middle', baseline: 'middle', weight: 700, color: onFill });
    }
    legend.push({ color: g.colors[i], label: p.label, value: g.fmt(p.value), share });
  });
  if (doughnut) {
    out += textEl(cx, cy - g.tick * 0.2, g.fmt(total), g, { anchor: 'middle', size: Math.round(g.tick * 1.9), weight: 700, color: g.text });
  }
  return { svg: `<g>${out}</g>`, legend };
}

// ── Radar ──────────────────────────────────────────────────────────────────────────────────

function radar(block: ChartBlock, g: Geometry): string {
  const n = block.labels.length;
  const size = Math.min(g.H, g.W * 0.62);
  const cx = g.W / 2;
  const cy = size / 2;
  const labelRoom = g.tick * 4.2;
  const R = size / 2 - labelRoom / 2;
  const maxV = Math.max(...block.series.flatMap((s) => s.data), 0);
  const ticks = niceTicks(0, maxV, 4).filter((t) => t > 0);
  const top = ticks[ticks.length - 1] || 1;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  let out = '';
  for (const t of ticks) out += `<polygon points="${block.labels.map((_, i) => pt(i, (R * t) / top).map(r1).join(',')).join(' ')}" fill="none" stroke="${g.grid}" stroke-width="1"/>`;
  block.labels.forEach((l, i) => {
    const [x, y] = pt(i, R);
    out += `<line x1="${r1(cx)}" y1="${r1(cy)}" x2="${r1(x)}" y2="${r1(y)}" stroke="${g.grid}" stroke-width="1"/>`;
    const [lx, ly] = pt(i, R + g.tick * 1.1);
    out += textEl(lx, ly, l, g, { anchor: Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end', baseline: 'middle', color: g.text });
  });
  block.series.forEach((s, j) => {
    const points = s.data.map((v, i) => pt(i, (R * Math.max(0, v)) / top).map(r1).join(',')).join(' ');
    out += `<polygon points="${points}" fill="${g.colors[j]}" fill-opacity="0.1" stroke="${g.colors[j]}" stroke-width="2" stroke-linejoin="round">${tip(`${s.name} : ${s.data.map((v, i) => `${block.labels[i]} ${g.fmt(v)}`).join(', ')}`)}</polygon>`;
  });
  return out;
}

// ── Le composant ───────────────────────────────────────────────────────────────────────────

/** La forme réellement dessinée : des étiquettes longues font passer des barres verticales à l'horizontale. */
export function resolvedChartType(block: ChartBlock, width: number, tick: number): ChartType {
  if ((block.chartType === 'bar' || block.chartType === 'groupedBar') && block.labels.length > 1) {
    const band = width / block.labels.length;
    const longest = Math.max(...block.labels.map((l) => estimateWidthPx(l.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? l, tick)));
    const avg = block.labels.reduce((s, l) => s + estimateWidthPx(l, tick), 0) / block.labels.length;
    if (longest > band * 0.96 || avg > band * 1.7) return 'horizontalBar';
  }
  if ((block.chartType === 'pie' || block.chartType === 'doughnut') && block.series[0].data.some((v) => v < 0)) return 'bar';
  return block.chartType;
}

function chartHeight(ctx: CompileContext, env: Env, type: ChartType): number {
  const W = env.width;
  const ratio = type === 'pie' || type === 'doughnut' ? 0.42 : type === 'radar' ? 0.58 : ctx.tokens.format.family === 'document' ? 0.46 : 0.52;
  const min = ctx.tokens.size.base * 9;
  const max = ctx.tokens.format.family === 'document' ? ctx.tokens.size.base * 24 : ctx.tokens.size.base * 30;
  const h = Math.min(max, Math.max(min, W * ratio));
  // Toile fixe : le graphique cède la place au titre, à la légende et à la clé de lecture.
  return env.height !== undefined ? Math.max(min * 0.8, Math.min(h, env.height - ctx.tokens.size.base * 6)) : h;
}

export const chart: ComponentFor<'chart'> = registerComponent({
  id: 'ui.chart',
  elastic: { minHeight: (block, ctx) => ctx.tokens.size.base * 8 + (block.title ? ctx.tokens.size.base * 1.6 : 0) + (block.series.length > 1 ? ctx.tokens.size.sm * 2 : 0) + ctx.tokens.size.xs * 2.4 },
  kinds: ['chart'],
  summary: 'Graphique SVG dessiné depuis les données (barres, courbes, aires, secteurs, radar) ; palette validée, légende, clé de lecture.',
  variants: { frame: ['none', 'panel'], legend: ['top', 'bottom'] },
  defaults: { frame: 'none', legend: 'top' },
  minWidth: 240,
  estimate(block, ctx, width) {
    const type = resolvedChartType(block, width, ctx.tokens.size.xs);
    const plot = type === 'horizontalBar' ? block.labels.length * block.series.length * 22 + block.labels.length * 14 : chartHeight(ctx, { surface: '#ffffff', width }, type);
    return plot + (block.title ? ctx.tokens.size.base * 1.8 : 0) + (block.series.length > 1 ? ctx.tokens.size.sm * 2 : 0) + ctx.tokens.size.xs * 3.2;
  },
  render({ block, ctx, env, variant }) {
    const panel = variant.frame === 'panel';
    const surface = panel ? ctx.tokens.color.raised : env.surface;
    const inner: Env = { ...env, surface, width: env.width - (panel ? ctx.tokens.space.md * 2 : 0) };
    const tick = Math.max(ctx.tokens.format.minSize, ctx.tokens.size.xs);
    const type = resolvedChartType(block, inner.width, tick);
    const pairMode: PairMode = type === 'pie' || type === 'doughnut' ? 'cycle' : type === 'radar' ? 'all' : 'adjacent';
    const slots = type === 'pie' || type === 'doughnut' ? Math.min(6, block.labels.length) : block.series.length;
    const palette = chartPalette({ primary: ctx.tokens.color.primary, accent: ctx.tokens.color.accent, secondary: ctx.tokens.color.secondary }, slots, surface, pairMode);
    if (!palette.report.ok && slots > 1) ctx.issues.push({ code: 'chart_palette', severity: 'advisory', message: `Palette du graphique « ${block.title ?? block.id} » : séparation ${palette.report.worstCvd} (daltonisme), ${palette.report.worstNormal} (vision normale).` });
    const unit = block.unit && block.unit.length <= 4 ? block.unit : undefined;
    const g: Geometry = {
      W: Math.round(inner.width),
      H: Math.round(chartHeight(ctx, inner, type)),
      font: ctx.tokens.font.bodyStack.replace(/"/g, "'"),
      tick,
      surface,
      text: ink(ctx, inner, 'ink'),
      muted: ink(ctx, inner, 'muted'),
      grid: mixHex(surface, ink(ctx, inner, 'ink'), 0.1),
      axis: mixHex(surface, ink(ctx, inner, 'ink'), 0.35),
      colors: palette.colors,
      fmt: (v) => formatNumber(v, ctx.locale, { compact: Math.abs(v) >= 1e4, unit }),
      fmtTick: (v) => formatNumber(v, ctx.locale, { compact: Math.abs(v) >= 1e4 }),
    };

    let svgBody = '';
    let height = g.H;
    let pieLegend: ReturnType<typeof pie>['legend'] = [];
    switch (type) {
      case 'horizontalBar': {
        const b = bars(block, g);
        svgBody = b.svg;
        height = b.height;
        break;
      }
      case 'line':
      case 'area':
        svgBody = lines(block, g, type === 'area');
        break;
      case 'pie':
      case 'doughnut': {
        const p = pie(block, g, type === 'doughnut', ctx);
        svgBody = p.svg;
        pieLegend = p.legend;
        height = Math.min(g.H, g.W * 0.5);
        break;
      }
      case 'radar':
        svgBody = radar(block, g);
        height = Math.min(g.H, g.W * 0.62);
        break;
      default:
        svgBody = columns(block, g, type === 'stacked' ? 'stacked' : type === 'groupedBar' ? 'groupedBar' : 'bar');
    }

    const titleId = ctx.uid('ct');
    const descId = ctx.uid('cd');
    const desc = block.labels.map((l, i) => `${l} : ${block.series.map((s) => `${block.series.length > 1 ? `${s.name} ` : ''}${g.fmt(s.data[i])}`).join(', ')}`).join(' ; ');
    const pieMode = type === 'pie' || type === 'doughnut';
    const svgWidth = pieMode ? Math.round(Math.min(g.H, g.W * 0.5)) : g.W;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${svgWidth} ${Math.round(height)}" width="${pieMode ? svgWidth : '100%'}" style="${css({ display: 'block', overflow: 'visible', 'max-width': '100%', height: 'auto' })}"><title id="${titleId}">${esc(block.title ?? block.readingKey)}</title><desc id="${descId}">${esc(desc)}</desc>${svgBody}</svg>`;

    // Légende : dès deux séries (identité jamais portée par la seule couleur) ; le texte reste à l'encre de texte.
    const swatch = (color: string, round = false) => `<span aria-hidden="true" style="${css({ display: 'inline-block', width: 10, height: 10, 'border-radius': round ? '50%' : 2, background: color, 'flex-shrink': 0 })}"></span>`;
    const legend =
      !pieMode && block.series.length > 1
        ? `<div style="${css({ display: 'flex', 'flex-wrap': 'wrap', gap: `${ctx.tokens.space.xs}px ${ctx.tokens.space.md}px`, 'font-size': tick, color: g.text })}">${block.series.map((s, j) => `<span style="${css({ display: 'inline-flex', 'align-items': 'center', gap: 6 })}">${swatch(g.colors[j], type === 'line')}${esc(s.name)}</span>`).join('')}</div>`
        : '';
    const pieList = pieMode
      ? `<ul style="${css({ margin: 0, padding: 0, 'list-style': 'none', display: 'flex', 'flex-direction': 'column', gap: 6, flex: '1 1 0%', 'min-width': 0, 'font-size': ctx.tokens.size.sm })}">${pieLegend
          .map((p) => `<li style="${css({ display: 'flex', 'align-items': 'center', gap: 8, color: g.text })}">${swatch(p.color)}<span style="flex:1 1 auto;min-width:0">${esc(p.label)}</span><span style="${css({ 'font-variant-numeric': 'tabular-nums', 'font-weight': 600 })}">${esc(p.share)}</span><span style="${css({ color: g.muted, 'font-variant-numeric': 'tabular-nums' })}">${esc(p.value)}</span></li>`)
          .join('')}</ul>`
      : '';
    const plot = pieMode ? `<div style="${css({ display: 'flex', 'align-items': 'center', gap: ctx.tokens.space.lg })}">${svg}${pieList}</div>` : svg;
    const unitNote = block.unit && !unit ? txt(ctx, inner, 'caption', block.unit, { ink: 'muted' }) : '';
    const reading = txt(ctx, inner, 'caption', `→ ${block.readingKey}`, { ink: 'muted' });
    const parts = [txt(ctx, inner, 'subtitle', block.title, { size: 'base' }), variant.legend !== 'bottom' ? legend : '', unitNote, plot, variant.legend === 'bottom' ? legend : '', reading];
    // La palette est déclarée sur la figure : quand la marque change, la traduction des livrables la RECALCULE
    // (`chartPalette` pour la nouvelle marque) au lieu de garder des teintes choisies contre l'ancienne.
    return `<figure data-ge-chart="${esc(type)}" data-ge-palette="${palette.colors.join(',')}" data-ge-palette-mode="${pairMode}" data-ge-surface="${surface}" style="${css({ margin: 0, display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm, background: panel ? surface : undefined, padding: panel ? ctx.tokens.space.md : undefined, 'border-radius': panel ? ctx.tokens.radius.md : undefined, 'box-sizing': 'border-box' })}">${parts.filter(Boolean).join('')}</figure>`;
  },
});
