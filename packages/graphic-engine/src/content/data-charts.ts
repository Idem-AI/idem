/**
 * LES CHIFFRES MONTRÉS, garantis par le code :
 *
 *   · `figuresOnly`   un chiffre-clé est un CHIFFRE : un « chiffre » sans chiffre (« Échec », un libellé recopié
 *                     dans la valeur) n'est pas montré comme un indicateur, ni un graphique aux valeurs toutes égales ;
 *   · `withDataChart` une section de business plan qui porte un tableau de chiffres mais aucun graphique reçoit
 *                     le graphique de ce tableau — mêmes valeurs, tracées par Chart.js ; aucune donnée inventée.
 */
import type { Block, SectionContent } from '../contracts/content-model';

type Table = Extract<Block, { kind: 'table' }>;
type Chart = Extract<Block, { kind: 'chart' }>;

/** Les blocs de chiffres-clés sans chiffre retirés (et le bloc entier s'il ne reste rien). */
export function figuresOnly(blocks: Block[]): { blocks: Block[]; dropped: string[] } {
  const dropped: string[] = [];
  const out: Block[] = [];
  for (const block of blocks) {
    // Un graphique dont toutes les valeurs sont égales (ou nulles) ne dit rien : des chiffres de remplissage
    // (« TAM = SAM = SOM = 2 000 » quand la taille est « à préciser »). Il n'est pas montré.
    if (block.kind === 'chart') {
      const values = block.series.flatMap((s) => s.data);
      if (values.length > 1 && values.every((v) => v === values[0])) {
        dropped.push(block.title ?? 'graphique sans information');
        continue;
      }
    }
    if (block.kind !== 'metrics') {
      out.push(block);
      continue;
    }
    const items = block.items.filter((item) => {
      const ok = /\d/.test(item.value);
      if (!ok) dropped.push(item.value);
      return ok;
    });
    if (items.length) out.push({ ...block, items });
  }
  return { blocks: out, dropped };
}

const SCALE: Record<string, number> = { k: 1e3, m: 1e6, md: 1e9, mds: 1e9, mrd: 1e9, bn: 1e9, b: 1e9 };

/**
 * Un nombre de cellule, avec son unité — ou `null` si la cellule n'est pas un chiffre (une phrase qui contient un
 * nombre n'en est pas un : « Faible : < 1 000 XAF par transaction »).
 */
export function parseFigure(cell: string): { value: number; unit: string } | null {
  const text = cell.replace(/[  ]/g, ' ').replace(/−/g, '-').trim();
  const m = text.match(/^([-+]?\s*\d[\d\s]*(?:[.,]\d+)?)\s*(%|k|m|md|mds|mrd|bn|b|millions?|milliards?)?\s*([A-Za-z€$%]{0,5})\.?$/i);
  if (!m) return null;
  const digits = m[1].replace(/\s/g, '');
  // « 1.250 » ou « 1,5 » : une seule virgule ou un seul point = décimale ; des groupes de 3 = milliers.
  const value = Number(/^[-+]?\d{1,3}([.,]\d{3})+$/.test(digits) ? digits.replace(/[.,]/g, '') : digits.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const scaleWord = (m[2] ?? '').toLowerCase();
  const scale = scaleWord === '%' ? 1 : scaleWord.startsWith('million') ? 1e6 : scaleWord.startsWith('milliard') ? 1e9 : SCALE[scaleWord] ?? 1;
  const unit = scaleWord === '%' ? '%' : (m[3] ?? '').toUpperCase();
  return { value: value * scale, unit };
}

const PERIOD = /^(?:(?:exercice|année|year|an)\s*)?(?:19|20)\d{2}(?:\s*[-/–]\s*(?:19|20)?\d{2})?p?$|^(?:T|Q|S|H)[1-4]\s*(?:19|20)\d{2}$|^(?:an|année|year)\s*\d{1,2}$/i;

const fmt = (v: number, locale: string) => new Intl.NumberFormat(locale.startsWith('en') ? 'en-US' : 'fr-FR', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 }).format(v);

/** Le graphique d'un tableau de chiffres, ou `null` s'il n'en porte pas assez (deux valeurs comparables au moins). */
export function chartFromTable(table: Table, locale = 'fr'): Omit<Chart, 'id'> | null {
  const headers = table.headers.slice(1);
  const byPeriod = headers.length >= 2 && headers.every((h) => PERIOD.test(h.trim()));
  if (byPeriod) {
    // Indicateurs × périodes : chaque ligne est une série dans le temps ; les deux premières de même unité.
    const rows = table.rows
      .map((row) => ({ name: (row[0] ?? '').trim(), figures: row.slice(1, headers.length + 1).map(parseFigure) }))
      .filter((r) => r.name && r.figures.length === headers.length && r.figures.every(Boolean));
    if (!rows.length) return null;
    const unit = rows[0].figures[0]!.unit;
    const series = rows.filter((r) => r.figures.every((f) => f!.unit === unit) && r.figures.some((f) => f!.value !== 0)).slice(0, 2);
    if (!series.length) return null;
    const first = series[0];
    const a = first.figures[0]!.value;
    const b = first.figures[first.figures.length - 1]!.value;
    const en = locale.startsWith('en');
    return {
      kind: 'chart',
      origin: 'system',
      chartType: headers.length > 2 ? 'line' : 'bar',
      labels: headers.map((h) => h.trim().slice(0, 48)),
      series: series.map((r) => ({ name: r.name.slice(0, 64), data: r.figures.map((f) => f!.value) })),
      ...(unit ? { unit } : {}),
      readingKey: (en ? `${first.name}: from ${fmt(a, locale)} to ${fmt(b, locale)}${unit ? ` ${unit}` : ''} between ${headers[0]} and ${headers[headers.length - 1]}.` : `${first.name} : de ${fmt(a, locale)} à ${fmt(b, locale)}${unit ? ` ${unit}` : ''} entre ${headers[0]} et ${headers[headers.length - 1]}.`).slice(0, 240),
    };
  }
  // Catégories × une mesure : la première colonne de chiffres de même unité, deux lignes au moins.
  for (let c = 1; c < table.headers.length; c++) {
    const rows = table.rows.map((row) => ({ label: (row[0] ?? '').trim(), figure: parseFigure(row[c] ?? '') })).filter((r) => r.label && r.figure);
    if (rows.length < 2 || rows.length < table.rows.length * 0.6 || rows.length > 12) continue;
    const unit = rows[0].figure!.unit;
    if (!rows.every((r) => r.figure!.unit === unit)) continue;
    const top = rows.reduce((best, r) => (r.figure!.value > best.figure!.value ? r : best));
    const en = locale.startsWith('en');
    return {
      kind: 'chart',
      origin: 'system',
      chartType: rows.some((r) => r.label.length > 14) ? 'horizontalBar' : 'bar',
      labels: rows.map((r) => r.label.slice(0, 48)),
      series: [{ name: table.headers[c].slice(0, 64), data: rows.map((r) => r.figure!.value) }],
      ...(unit ? { unit } : {}),
      readingKey: (en ? `${top.label} leads with ${fmt(top.figure!.value, locale)}${unit ? ` ${unit}` : ''} (${table.headers[c]}).` : `${top.label} en tête : ${fmt(top.figure!.value, locale)}${unit ? ` ${unit}` : ''} (${table.headers[c]}).`).slice(0, 240),
    };
  }
  return null;
}

/** La section reçoit le graphique de son premier tableau de chiffres si elle n'a aucun graphique. */
export function withDataChart(section: SectionContent, locale = 'fr'): SectionContent {
  if (section.blocks.some((b) => b.kind === 'chart')) return section;
  const at = section.blocks.findIndex((b) => b.kind === 'table' && chartFromTable(b, locale));
  if (at < 0) return section;
  const table = section.blocks[at] as Table;
  const chart = { ...chartFromTable(table, locale)!, id: `${table.id}-chart`.slice(0, 64) } as Chart;
  return { ...section, blocks: [...section.blocks.slice(0, at), chart, ...section.blocks.slice(at)] };
}
