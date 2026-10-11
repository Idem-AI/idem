/**
 * VALIDATION TECHNIQUE — le SVG est-il exploitable tel quel ?
 *
 * Un fichier valide n'est pas un bon logo, mais un fichier invalide n'est pas un logo. Ces
 * contrôles sont factuels, instantanés et gratuits :
 *
 *   structure     XML bien formé, une racine <svg> avec xmlns et viewBox, dimensions cohérentes
 *   autonomie     aucun <text>, <image>, <script>, <style>, <foreignObject>, aucune référence
 *                 externe (href, url(), @import), aucun attribut d'événement, aucune police
 *   couleurs      uniquement des hexadécimaux, tous issus de la palette (ou de ses dérivées)
 *   tracés        nombres finis, budget de tracés et d'octets
 *   conversion    le rasteriseur sait le rendre, le résultat n'est pas vide, le fond reste transparent
 */
import { inspectSvg } from '../../design/svgGate';
import type { Rasterizer } from '../raster/rasterizer';
import { defaultRasterizer } from '../raster/rasterizer';
import { inkCoverage } from '../raster/measure';

export type Severity = 'blocker' | 'warn';

export interface Defect {
  code: string;
  severity: Severity;
  message: string;
  layerId?: string;
}

const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'title', 'desc', 'defs', 'clipPath', 'mask']);
const FORBIDDEN_TAGS = new Set(['text', 'tspan', 'image', 'script', 'style', 'foreignObject', 'use', 'iframe', 'link', 'a', 'animate', 'set', 'filter', 'font-face']);

/** Budgets : un logo n'est pas une illustration. */
export const SVG_BUDGET = { bytes: 40_000, paths: 80, nodes: 2400 } as const;

interface ParsedTag {
  name: string;
  attrs: Record<string, string>;
  closing: boolean;
  selfClosing: boolean;
}

/** Découpe le SVG en balises ; `null` + message si le XML n'est pas bien formé. */
function tokenize(svg: string): { tags: ParsedTag[]; error?: string } {
  const tags: ParsedTag[] = [];
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(svg))) {
    if (m.index !== consumed) return { tags, error: `balise illisible près de « ${svg.slice(consumed, consumed + 30).replace(/\s+/g, ' ')} »` };
    consumed = re.lastIndex;
    if (m[5] !== undefined || !m[2]) continue;
    const attrs: Record<string, string> = {};
    for (const a of (m[3] || '').matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = a[2] ?? a[3] ?? '';
    const tag: ParsedTag = { name: m[2], attrs, closing: m[1] === '/', selfClosing: m[4] === '/' };
    tags.push(tag);
    if (tag.closing) {
      if (stack.pop() !== tag.name) return { tags, error: `balise </${tag.name}> sans ouverture correspondante` };
    } else if (!tag.selfClosing) stack.push(tag.name);
  }
  if (consumed !== svg.length) return { tags, error: 'contenu illisible en fin de fichier' };
  if (stack.length) return { tags, error: `balise <${stack[stack.length - 1]}> jamais refermée` };
  return { tags };
}

export interface TechnicalOptions {
  /** Couleurs autorisées (hex). Vide : contrôle ignoré. */
  palette?: string[];
  rasterizer?: Rasterizer;
  /** Rendu transparent attendu (défaut) : les 4 coins doivent être vides. */
  expectTransparent?: boolean;
}

export interface TechnicalReport {
  ok: boolean;
  defects: Defect[];
  bytes: number;
  paths: number;
  nodes: number;
}

export async function validateSvgTechnical(svg: string, options: TechnicalOptions = {}): Promise<TechnicalReport> {
  const defects: Defect[] = [];
  const add = (code: string, message: string, severity: Severity = 'blocker') => defects.push({ code, severity, message });
  const source = (svg ?? '').trim();
  const bytes = Buffer.byteLength(source, 'utf8');

  if (!source) {
    add('empty', 'SVG vide.');
    return { ok: false, defects, bytes, paths: 0, nodes: 0 };
  }

  const { tags, error } = tokenize(source);
  if (error) add('malformed_xml', `XML mal formé : ${error}.`);
  const root = tags.find((t) => !t.closing);
  if (!root || root.name !== 'svg') add('no_root', 'La racine du document n\'est pas <svg>.');
  else {
    if (root.attrs.xmlns !== 'http://www.w3.org/2000/svg') add('no_xmlns', 'xmlns="http://www.w3.org/2000/svg" absent : le fichier ne s\'ouvre pas hors navigateur.');
    const vb = (root.attrs.viewBox || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some((v) => !Number.isFinite(v)) || vb[2] <= 0 || vb[3] <= 0) add('bad_viewbox', 'viewBox absent ou invalide : le logo ne peut pas être mis à l\'échelle.');
    else {
      const w = Number(root.attrs.width);
      const h = Number(root.attrs.height);
      if (Number.isFinite(w) && Number.isFinite(h) && Math.abs(w / h - vb[2] / vb[3]) > 0.01) add('aspect_mismatch', 'width/height ne suivent pas le rapport du viewBox.', 'warn');
    }
  }

  let paths = 0;
  for (const tag of tags) {
    if (tag.closing) continue;
    if (FORBIDDEN_TAGS.has(tag.name)) add('forbidden_tag', `<${tag.name}> interdit : le logo doit être autonome (pas de texte vivant, d'image ni de script).`);
    else if (!ALLOWED_TAGS.has(tag.name)) add('unknown_tag', `<${tag.name}> n'est pas une balise du moteur.`, 'warn');
    if (tag.name === 'path') paths++;
    for (const [name, value] of Object.entries(tag.attrs)) {
      if (/^on/i.test(name)) add('event_handler', `Attribut d'événement « ${name} » interdit.`);
      if (/href$/i.test(name)) add('external_ref', `Référence « ${name} » interdite : le fichier doit être autonome.`);
      if (/url\(|@import|javascript:|data:/i.test(value)) add('external_ref', `Référence externe dans « ${name} » (url(), data:, @import).`);
      if ((name === 'fill' || name === 'stroke') && value !== 'none' && !/^#[0-9a-fA-F]{3,8}$/.test(value)) add('non_hex_color', `Couleur « ${value} » : seuls les hexadécimaux sont admis.`, 'warn');
    }
  }
  if (paths === 0) add('no_paths', 'Aucun tracé dans le fichier.');
  if (paths > SVG_BUDGET.paths) add('too_many_paths', `${paths} tracés (budget ${SVG_BUDGET.paths}).`, 'warn');
  if (bytes > SVG_BUDGET.bytes) add('too_heavy', `${Math.round(bytes / 1024)} Ko (budget ${SVG_BUDGET.bytes / 1000} Ko) : trop lourd pour un logo.`, 'warn');

  let nodes = 0;
  for (const m of source.matchAll(/\sd="([^"]*)"/g)) {
    if (/NaN|Infinity|undefined/.test(m[1])) add('invalid_path_data', 'Un tracé contient une valeur non numérique.');
    nodes += (m[1].match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length;
  }
  if (nodes > SVG_BUDGET.nodes) add('too_many_nodes', `${nodes} nœuds (budget ${SVG_BUDGET.nodes}) : construction trop détaillée.`, 'warn');

  // Palette : on réutilise la grille historique (même vocabulaire que les logos dessinés par l'IA).
  const gate = inspectSvg(source, { palette: options.palette });
  for (const d of gate.defects) {
    if (d.code === 'off_palette') add('off_palette', d.message, 'warn');
    else if (d.code === 'raster_embedded' || d.code === 'live_text') continue; // déjà signalés par les balises
  }

  // Conversion : le rasteriseur sait-il le rendre, et le fond est-il transparent ?
  if (!defects.some((d) => d.severity === 'blocker')) {
    try {
      const r = options.rasterizer ?? defaultRasterizer();
      const image = await r.render(source, 128, null);
      const coverage = inkCoverage(image);
      if (coverage < 0.005) add('blank_render', 'Le rendu est vide : aucune encre visible.');
      if (options.expectTransparent !== false) {
        const corners = [0, (image.width - 1) * 4, (image.height - 1) * image.width * 4, ((image.height - 1) * image.width + image.width - 1) * 4];
        if (corners.every((c) => image.rgba[c + 3] > 200)) add('opaque_background', 'Le fond est opaque : le logo doit rester transparent.', 'warn');
      }
    } catch (error) {
      add('render_failed', `Le rasteriseur refuse le fichier : ${(error as Error).message}`);
    }
  }

  return { ok: !defects.some((d) => d.severity === 'blocker'), defects, bytes, paths, nodes };
}
