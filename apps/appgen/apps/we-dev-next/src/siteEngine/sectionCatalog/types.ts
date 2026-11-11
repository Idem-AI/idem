/**
 * LE CATALOGUE ICODE DES SITES VITRINES — ses nœuds et ses règles (les mêmes que
 * `idem-templates/scripts/icode-rules.mjs`, rejouées au chargement : un nœud qui les enfreint est écarté et dit).
 *
 *   kind     le schéma de contenu d'une composition du manifeste (`split-media`, `faq`…) : les champs à rédiger ;
 *   section  une variante de cette composition : un composant React (TSX) à jetons qui lit ces champs ;
 *   header / footer  l'en-tête et le pied de page, qui ne lisent que les données du site (`@/site/data`).
 */
import type { LayoutId } from '../manifest.js';

export type FieldDef =
  | { type: 'text'; max: number; required?: boolean }
  | { type: 'list'; min: number; max: number; of: 'text' | Record<string, FieldDef> }
  | { type: 'action' };

export interface NodeDoc {
  title: string;
  summary: string;
  use?: string;
  avoid?: string;
}

export interface KindNode {
  id: string;
  kind: 'kind';
  medium: 'icode';
  layout: LayoutId;
  doc: NodeDoc;
  fields: Record<string, FieldDef>;
}

export interface SectionNode {
  id: string;
  kind: 'section';
  medium: 'icode';
  layout: LayoutId;
  doc: NodeDoc;
  /** `required` : la variante n'a de sens qu'avec un visuel ; `none` : elle n'en montre pas. */
  visual: 'required' | 'optional' | 'none';
  /** Les nombres d'éléments que la variante sait mettre en page (`tiles: [3, 6]`, `gallery: [3, 12]`). */
  fits?: Record<string, [number, number]>;
  template: string;
}

export interface ShellNode {
  id: string;
  kind: 'header' | 'footer';
  medium: 'icode';
  doc: NodeDoc;
  template: string;
}

export interface LoadedSectionCatalog {
  version: string;
  source: 'dir' | 'url' | 'cache' | 'snapshot' | 'none';
  kinds: Map<string, KindNode>;
  sections: SectionNode[];
  headers: ShellNode[];
  footers: ShellNode[];
  rejected: Array<{ id: string; reason: string }>;
}

// ── Les règles ───────────────────────────────────────────────────────────────────────────────

const LAYOUT_IDS = new Set<string>(['split-media', 'full-bleed-media', 'editorial', 'statement', 'list-rows', 'timeline', 'bento', 'gallery', 'stats-band', 'quote', 'faq', 'form', 'table', 'cards', 'cta-band']);
export const ALLOWED_IMPORTS = new Set(['react', 'motion/react', 'lucide-react', '@/components/ui', '@/design-system', '@/site/data', '@/site/media', '@/site/brand', '@/lib/contact', '@/lib/utils', '@/components/site/language-switcher']);
const TOKEN_FORMS = [/^Component$/, /^id$/, /^h2?$/, /^reveal(Item)?$/, /^i1?$/, /^n$/, /^span$/, /^mkey$/, /^else$/, /^\/(if|each|ifi0|ifnoti0)$/, /^(ifi0|ifnoti0)$/, /^if(not)? \.?[a-zA-Z]+$/, /^each [a-zA-Z]+$/, /^href [a-zA-Z]+$/, /^media( class="[^"]*")?$/];
const FORBIDDEN: Array<[RegExp, string]> = [
  [/dangerouslySetInnerHTML|innerHTML|outerHTML|document\.write/, 'HTML injecté'],
  [/\beval\s*\(|new Function\s*\(/, 'code évalué'],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/, 'appel réseau'],
  [/https?:\/\/|\/\/[a-z0-9-]+\.[a-z]{2,}/i, 'adresse étrangère'],
  [/<\s*(script|iframe|style|link|meta|object|embed)\b/i, 'balise interdite'],
  [/\blocalStorage\b|\bsessionStorage\b|document\.cookie/, 'stockage du navigateur'],
];
const PALETTE = /(?:^|[\s"'`:])(?:bg|text|border|from|via|to|ring|fill|stroke|outline|divide|shadow|decoration|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;
const HEX = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;

export const templateTokens = (tpl: string): string[] => [...tpl.matchAll(/\[\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\]/g)].map((m) => m[1].trim());

/** Les mots écrits en dur dans le JSX d'un gabarit (hors jetons, expressions et code). */
export function hardcodedJsxWords(tpl: string): string[] {
  const body = tpl
    .replace(/^import[^\n]*$/gm, '')
    .replace(/\[\[[^\]]*(?:\[[^\]]*\][^\]]*)*\]\]/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/=>/g, ' ');
  const words: string[] = [];
  for (const m of body.matchAll(/>([^<>{}]+)</g)) {
    if (/[()?.=:;]/.test(m[1])) continue;
    for (const w of m[1].matchAll(/\p{L}{2,}/gu)) words.push(w[0]);
  }
  return words;
}

function fieldErrors(fields: Record<string, FieldDef> | undefined, where: string): string[] {
  const errors: string[] = [];
  for (const [name, def] of Object.entries(fields ?? {})) {
    if (!/^[a-z][a-zA-Z]*$/.test(name)) errors.push(`${where} : champ « ${name} »`);
    if (def?.type === 'text' && !(Number.isInteger(def.max) && def.max >= 4 && def.max <= 2000)) errors.push(`${where}.${name} : max`);
    else if (def?.type === 'list') {
      if (!(Number.isInteger(def.min) && Number.isInteger(def.max) && def.min >= 0 && def.max >= def.min && def.max <= 16)) errors.push(`${where}.${name} : min/max`);
      if (def.of !== 'text') errors.push(...fieldErrors(def.of, `${where}.${name}`));
    } else if (def?.type !== 'action' && def?.type !== 'text') errors.push(`${where}.${name} : type`);
  }
  return errors;
}

/** Les défauts d'un nœud, avec les schémas déjà lus (une section ne lit que les champs de sa composition). */
export function nodeErrors(node: KindNode | SectionNode | ShellNode, kinds: Map<string, KindNode>): string[] {
  if (node.medium !== 'icode') return ['medium « icode » attendu'];
  if (!node.doc?.title || !node.doc?.summary) return ['doc.title et doc.summary obligatoires'];
  if (node.kind === 'kind') return [...(LAYOUT_IDS.has(node.layout) ? [] : [`composition inconnue « ${node.layout} »`]), ...fieldErrors(node.fields, 'fields')];
  const tpl = node.template ?? '';
  if (!tpl) return ['template.tsx manquant'];
  const errors: string[] = [];
  for (const [re, why] of FORBIDDEN) if (re.test(tpl)) errors.push(why);
  if (PALETTE.test(tpl) || HEX.test(tpl)) errors.push('couleur hors thème');
  for (const m of tpl.matchAll(/^import[^\n]*from\s+['"]([^'"]+)['"]/gm)) if (!ALLOWED_IMPORTS.has(m[1]) && !m[1].startsWith('@/components/ui/')) errors.push(`import interdit « ${m[1]} »`);
  for (const t of templateTokens(tpl)) if (!TOKEN_FORMS.some((re) => re.test(t))) errors.push(`jeton inconnu [[${t}]]`);
  const words = hardcodedJsxWords(tpl);
  if (words.length) errors.push(`mots écrits en dur : ${words.slice(0, 6).join(' ')}`);
  if (node.kind === 'section') {
    if (!/export default function \[\[Component\]\]\(/.test(tpl)) errors.push('export default function [[Component]]()');
    if (!/id="\[\[id\]\]"/.test(tpl)) errors.push('id="[[id]]" sur la racine');
    if (!['required', 'optional', 'none'].includes(node.visual)) errors.push('visual');
    const kind = kinds.get(node.layout);
    if (!kind) errors.push(`schéma absent pour « ${node.layout} »`);
    else {
      const top = new Set(Object.keys(kind.fields));
      const sub = new Set(Object.values(kind.fields).flatMap((f) => (f.type === 'list' && f.of !== 'text' ? Object.keys(f.of) : f.type === 'action' ? ['label'] : [])));
      for (const [, name] of tpl.matchAll(/\{\{\s*([a-zA-Z]+)(?:\.[a-zA-Z]+)?\s*\}\}/g)) if (!top.has(name)) errors.push(`{{${name}}} hors schéma`);
      for (const [, name] of tpl.matchAll(/\{\{\s*\.([a-zA-Z]+)\s*\}\}/g)) if (!sub.has(name)) errors.push(`{{.${name}}} hors schéma`);
      for (const [, name] of tpl.matchAll(/\[\[each ([a-zA-Z]+)\]\]/g)) if (name !== 'gallery' && kind.fields[name]?.type !== 'list') errors.push(`[[each ${name}]] hors schéma`);
      for (const list of Object.keys(node.fits ?? {})) if (list !== 'gallery' && kind.fields[list]?.type !== 'list') errors.push(`fits.${list} hors schéma`);
    }
  }
  if (node.kind === 'header' && !/export default function SiteHeader\(\{ current \}: \{ current: string \}\)/.test(tpl)) errors.push('signature de SiteHeader');
  if (node.kind === 'footer' && !/export default function SiteFooter\(\)/.test(tpl)) errors.push('signature de SiteFooter');
  return errors;
}
