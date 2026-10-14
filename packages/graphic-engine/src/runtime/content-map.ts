/**
 * LA MATIÈRE D'UNE PAGE, À PLAT — chaque texte du contenu reçoit une clé (`title`, `b2.items.0.value`).
 *
 * L'auteur n'écrit jamais un mot du contenu : il place `{{clé}}` dans son HTML et le code remplace. Les chiffres,
 * les noms et les sources restent donc EXACTS, et une retouche de texte est un nouveau rendu du même code, sans
 * appel au modèle. Les graphiques et les tableaux ne passent pas par les clés : ce sont des primitives dessinées
 * par le code (`<idem-chart>`, `<idem-table>`).
 */
import type { Block, SectionContent } from '../contracts/content-model';
import { CARD_FIELDS } from '../contracts/content-model';

export type EntryKind = 'text' | 'url' | 'icon';

export interface ContentEntry {
  key: string;
  value: string;
  kind: EntryKind;
  /** Ce que montre une image (pour l'auteur, qui ne voit pas l'adresse). */
  alt?: string;
}

export interface ContentMap {
  entries: Map<string, ContentEntry>;
  /** Les blocs dessinés par le code : graphiques et tableaux. */
  primitives: Map<string, Block>;
  /** Les champs de carte en mode gabarit : `{{champ}}` reste tel quel dans un élément `data-field`. */
  markers: Set<string>;
  /** L'inventaire lisible donné à l'auteur. */
  listing: string;
}

const URL_KEYS = new Set(['url', 'logoUrl', 'imageUrl']);
/** Les données de structure, pas des textes : jamais exposées en clé. */
const SKIP_KEYS = new Set(['id', 'kind', 'origin', 'focal', 'binding', 'side']);
/** Les blocs que l'auteur pose comme une primitive du code. */
export const PRIMITIVE_KINDS = new Set<Block['kind']>(['chart', 'table']);

const oneLine = (v: string, max = 600) => {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

export function buildContentMap(section: SectionContent, bindings: 'values' | 'markers' = 'values'): ContentMap {
  const entries = new Map<string, ContentEntry>();
  const primitives = new Map<string, Block>();
  const markers = new Set<string>();
  const lines: string[] = [];
  const put = (key: string, value: unknown, alt?: string) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    const leaf = key.split('.').pop() ?? key;
    const kind: EntryKind = URL_KEYS.has(leaf) ? 'url' : leaf === 'icon' ? 'icon' : 'text';
    const text = value === true ? 'yes' : String(value);
    entries.set(key, { key, value: text, kind, ...(alt ? { alt } : {}) });
    lines.push(`{{${key}}} = ${kind === 'url' ? `<image${alt ? `: ${oneLine(alt, 120)}` : ''}>` : kind === 'icon' ? `<icon name: ${text}>` : JSON.stringify(oneLine(text))}`);
  };
  const walk = (prefix: string, value: unknown) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${prefix}.${i}`, v));
    else if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (SKIP_KEYS.has(k)) continue;
        if (URL_KEYS.has(k) && typeof v === 'string') {
          put(`${prefix}.${k}`, v, typeof obj.alt === 'string' ? obj.alt : typeof obj.label === 'string' ? obj.label : undefined);
          // Le sujet de la photo (point d'intérêt) : l'auteur recadre sans le couper.
          const f = obj.focal as { x?: number; y?: number } | undefined;
          if (f && typeof f.x === 'number' && typeof f.y === 'number') lines.push(`   (its subject is at ${Math.round(f.x * 100)}% × ${Math.round(f.y * 100)}%: crop with object-cover object-[${Math.round(f.x * 100)}%_${Math.round(f.y * 100)}%])`);
        } else walk(`${prefix}.${k}`, v);
      }
    } else put(prefix, value);
  };

  for (const k of ['kicker', 'title', 'lede'] as const) put(k, section[k]);
  for (const block of section.blocks) {
    if (block.kind === 'chart') {
      primitives.set(block.id, block);
      lines.push(`\n# block ${block.id} — chart (${block.chartType}, ${block.series.length} series × ${block.labels.length} labels${block.unit ? `, unit ${block.unit}` : ''}): draw it with <idem-chart data-block="${block.id}">`);
      put(`${block.id}.title`, block.title);
      put(`${block.id}.readingKey`, block.readingKey);
      continue;
    }
    if (block.kind === 'table') {
      primitives.set(block.id, block);
      lines.push(`\n# block ${block.id} — table (${block.headers.length} columns × ${block.rows.length} rows; headers: ${block.headers.map((h) => oneLine(h, 40)).join(' | ')}): draw it with <idem-table data-block="${block.id}">`);
      put(`${block.id}.caption`, block.caption);
      continue;
    }
    if (block.kind === 'contact') {
      lines.push(`\n# block ${block.id} — business card fields (${block.side} side). Each field in its own element with data-field="<field>":`);
      for (const field of CARD_FIELDS) {
        const value = block.fields[field];
        if (bindings === 'markers') {
          markers.add(field);
          entries.set(field, { key: field, value: `{{${field}}}`, kind: 'text' });
          lines.push(`{{${field}}} = <the holder's ${field}>`);
        } else if (value) put(field, value);
      }
      continue;
    }
    lines.push(`\n# block ${block.id} — ${block.kind}${block.origin === 'system' ? ' (exact data: keep every item)' : ''}`);
    walk(block.id, block);
  }
  return { entries, primitives, markers, listing: lines.join('\n').trim() };
}
