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

/**
 * Applique des retouches de MOTS par clé (`title`, `b2.paragraphs.0`, `b1.items.1.label`) : la même adresse que celle
 * que voit l'auteur. Une valeur vide retire le texte (un élément de liste disparaît). Les blocs posés par le code
 * (`origin: 'system'` : tableaux financiers, spécimens) ne se retouchent jamais ainsi. Rend la section et les clés
 * réellement appliquées.
 */
export function applyTextEdits(section: SectionContent, edits: Record<string, string | null | undefined>): { section: SectionContent; applied: string[]; refused: string[] } {
  const next = JSON.parse(JSON.stringify(section)) as SectionContent & Record<string, unknown>;
  const applied: string[] = [];
  const refused: string[] = [];
  const removals: Array<{ parent: unknown[]; index: number }> = [];
  for (const [key, raw] of Object.entries(edits)) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    const parts = key.split('.');
    if (parts.length === 1 && ['kicker', 'title', 'lede'].includes(parts[0])) {
      if (value) next[parts[0]] = value.slice(0, parts[0] === 'title' ? 160 : parts[0] === 'kicker' ? 80 : 320);
      else if (parts[0] !== 'title') delete next[parts[0]];
      else {
        refused.push(key);
        continue;
      }
      applied.push(key);
      continue;
    }
    const block = next.blocks.find((b) => b.id === parts[0]) as (Record<string, unknown> & { origin?: string }) | undefined;
    if (!block || block.origin === 'system' || parts.length < 2) {
      refused.push(key);
      continue;
    }
    let parent: unknown = block;
    for (let i = 1; i < parts.length - 1 && parent && typeof parent === 'object'; i++) parent = (parent as Record<string, unknown>)[parts[i]];
    const leaf = parts[parts.length - 1];
    if (!parent || typeof parent !== 'object' || !(leaf in (parent as object)) || typeof (parent as Record<string, unknown>)[leaf] === 'object') {
      refused.push(key);
      continue;
    }
    if (value) (parent as Record<string, unknown>)[leaf] = value;
    else if (Array.isArray(parent)) removals.push({ parent, index: Number(leaf) });
    else delete (parent as Record<string, unknown>)[leaf];
    applied.push(key);
  }
  // Les éléments de liste retirés, du dernier au premier (les index restent justes).
  for (const r of removals.sort((a, b) => b.index - a.index)) r.parent.splice(r.index, 1);
  return { section: next, applied, refused };
}

/** Deux lettres voisines inversées (« LIGTH » pour « LIGHT ») : la seule coquille corrigée sans ambiguïté. */
function isTransposition(word: string, name: string): boolean {
  if (word.length !== name.length || word === name) return false;
  const diff: number[] = [];
  for (let i = 0; i < word.length; i++) if (word[i] !== name[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && word[diff[0]] === name[diff[1]] && word[diff[1]] === name[diff[0]];
}

/**
 * Le NOM DE LA MARQUE écrit juste partout : une coquille par inversion de deux lettres voisines, dans un texte du
 * rédacteur, est remplacée par le nom (dans la casse du mot). Rien d'autre n'est touché — un mot seulement proche
 * (« Night » pour « Light ») reste ce qu'il est. Rend la section et le nombre de corrections.
 */
export function fixBrandNameTypos(section: SectionContent, brandName: string): { section: SectionContent; fixed: number } {
  const names = brandName
    .split(/\s+/)
    .map((n) => n.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((n) => n.length >= 4);
  if (!names.length) return { section, fixed: 0 };
  let fixed = 0;
  const fixText = (text: string) =>
    text.replace(/[\p{L}\p{N}]{4,}/gu, (word) => {
      for (const name of names) {
        if (isTransposition(word.toLowerCase(), name.toLowerCase())) {
          fixed++;
          return word === word.toUpperCase() ? name.toUpperCase() : word[0] === word[0].toUpperCase() ? name[0].toUpperCase() + name.slice(1) : name.toLowerCase();
        }
      }
      return word;
    });
  const walk = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') return URL_KEYS.has(key) || key === 'icon' || key === 'id' || key === 'kind' ? value : fixText(value);
    if (Array.isArray(value)) return value.map((v) => walk(v, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v, k)]));
    return value;
  };
  const next = walk(section) as SectionContent;
  return { section: fixed ? next : section, fixed };
}
