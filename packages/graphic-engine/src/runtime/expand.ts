/**
 * DU CODE DE L'AUTEUR À LA PAGE — trois opérations déterministes, sans aucun jugement :
 *
 *   extraire   la réponse du modèle → le fragment HTML (balises de code, document complet tolérés) ;
 *   assainir   rien qui s'exécute ni ne sort de la page : scripts, gestionnaires `on*`, cadres, adresses
 *              étrangères retirés ; le CSS natif (`<style>`, `style=""`) retiré et COMPTÉ — la page est en
 *              Tailwind ;
 *   remplir    `{{clé}}` → le texte exact (échappé), les primitives → le dessin du code, et la racine
 *              `.ge-page` aux cotes du format.
 *
 * Le gabarit assaini (clés et primitives encore en place) est ce qui est gardé : le rejouer avec un contenu
 * retouché refait la page sans modèle.
 */
import type { DesignTokens } from '../design-system/tokens';
import type { FormatDef } from '../design-system/formats';
import type { ContentMap } from './content-map';
import { chartHtml, galleryHtml, iconHtml, logoHtml, patternHtml, tableHtml } from './primitives';

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** La réponse d'un modèle → le fragment (le plus long bloc de code HTML, ou le texte à partir de la première balise). */
export function extractHtml(raw: string): string {
  let text = (raw || '').trim();
  const fences = [...text.matchAll(/```[a-zA-Z]*\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (fences.length) text = fences.sort((a, b) => b.length - a.length)[0];
  else text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '');
  const body = text.match(/<body\b[^>]*>([\s\S]*?)(<\/body>|$)/i);
  if (body) text = body[1];
  text = text.replace(/<!doctype[^>]*>/gi, '').replace(/<\/?html\b[^>]*>/gi, '').replace(/<head\b[\s\S]*?<\/head>/gi, '');
  const first = text.indexOf('<');
  return first > 0 ? text.slice(first).trim() : text.trim();
}

export interface Sanitized {
  html: string;
  /** Blocs `<style>` et attributs `style` retirés (la consigne est Tailwind seul). */
  nativeCss: number;
  removed: string[];
}

const SAFE_URL = /^\s*(\{\{\s*[\w.:-]+\s*\}\}|#[\w-]*|data:image\/(png|jpe?g|gif|webp|svg\+xml|avif)[;,])/i;

export function sanitizeHtml(input: string): Sanitized {
  const removed: string[] = [];
  let nativeCss = 0;
  let html = input.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<style\b[\s\S]*?(<\/style>|$)/gi, () => {
    nativeCss++;
    return '';
  });
  for (const tag of ['script', 'iframe', 'object', 'embed', 'noscript', 'template', 'frameset', 'frame', 'applet']) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(<\\/${tag}>|$)`, 'gi'), () => {
      removed.push(tag);
      return '';
    });
  }
  html = html.replace(/<\/?(link|meta|base|form|input|button|textarea|select)\b[^>]*>/gi, (m) => {
    removed.push(m.slice(1, 12).replace(/[\s/>].*$/, ''));
    return '';
  });
  // Les attributs, balise par balise.
  html = html.replace(/<([a-zA-Z][\w:-]*)(\s[^<>]*?)?(\/?)>/g, (_m, name: string, attrs: string | undefined, self: string) => {
    if (!attrs) return `<${name}${self}>`;
    const kept: string[] = [];
    for (const a of attrs.matchAll(/([^\s"'=<>`/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)) {
      const key = a[1].toLowerCase();
      const raw = a[2] ?? '';
      const value = raw.replace(/^["']|["']$/g, '');
      if (key.startsWith('on') || key === 'srcset' || key === 'formaction') {
        removed.push(key);
        continue;
      }
      if (key === 'style') {
        nativeCss++;
        continue;
      }
      if ((key === 'src' || key === 'href' || key === 'xlink:href' || key === 'poster' || key === 'action') && !SAFE_URL.test(value)) {
        removed.push(`${key}=${value.slice(0, 40)}`);
        continue;
      }
      kept.push(raw ? `${a[1]}="${value.replace(/"/g, '&quot;')}"` : a[1]);
    }
    return `<${name}${kept.length ? ` ${kept.join(' ')}` : ''}${self}>`;
  });
  return { html: html.trim(), nativeCss, removed };
}

export interface Expanded {
  /** La page complète : la racine `.ge-page` et son contenu. */
  html: string;
  used: Set<string>;
  unknown: string[];
  /** Primitives qui désignent un bloc absent (retirées). */
  orphans: string[];
}

function attrOf(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

export interface PageFrame {
  sectionId: string;
  locale: string;
  engine: string;
}

/** Les classes de la racine : les cotes du support (contrainte d'impression, pas de design). */
export function rootClasses(format: FormatDef): string {
  const flow = format.kind === 'flow';
  const w = format.mm ? `${format.mm.width}mm` : `${format.width}px`;
  const h = format.mm ? `${format.mm.height}mm` : `${format.height}px`;
  if (flow) return `ge-page relative w-[${w}] min-h-[${h}] p-[12mm] bg-ground text-ink font-body text-[${format.base}px] leading-[1.5]`;
  return `ge-page relative overflow-hidden w-[${w}] h-[${h}] bg-ground text-ink font-body text-[${format.base}px] leading-[1.45]`;
}

/** Les cotes CSS d'un format qui n'en a pas (toile imposée par l'hôte). */
export function withSize(format: FormatDef, size?: { width: number; height: number }): FormatDef {
  return size ? { ...format, width: size.width, height: size.height, mm: undefined } : format;
}

export function expandPage(template: string, map: ContentMap, tokens: DesignTokens, format: FormatDef, frame: PageFrame): Expanded {
  const used = new Set<string>();
  const unknown: string[] = [];
  const orphans: string[] = [];
  // 1. Les primitives (avec ou sans balise fermante).
  let html = template.replace(/<idem-(chart|table|gallery|logo|icon|pattern)\b([^>]*?)\/?>(?:\s*<\/idem-\1>)?/gi, (_m, kind: string, attrs: string) => {
    const className = attrOf(attrs, 'class');
    const k = kind.toLowerCase();
    if (k === 'logo') return logoHtml(tokens, attrOf(attrs, 'variant') ?? 'primary', { className });
    if (k === 'icon') {
      let name = attrOf(attrs, 'name') ?? '';
      const key = name.match(/^\{\{\s*([\w.:-]+)\s*\}\}$/)?.[1];
      if (key) {
        used.add(key);
        name = map.entries.get(key)?.value ?? '';
      }
      return iconHtml(name, { className });
    }
    if (k === 'pattern') return patternHtml(tokens, Number(attrOf(attrs, 'index') ?? 0), { className });
    const id = attrOf(attrs, 'data-block') ?? '';
    const block = map.primitives.get(id);
    if (!block) {
      orphans.push(`${k}:${id}`);
      return '';
    }
    used.add(`#${id}`);
    if (block.kind === 'chart') return chartHtml(block, tokens, { className, aspect: attrOf(attrs, 'data-aspect'), locale: frame.locale, type: attrOf(attrs, 'data-type'), highlight: attrOf(attrs, 'data-highlight') });
    if (block.kind === 'table') return tableHtml(block, { className });
    if (block.kind === 'mockupShowcase') return galleryHtml(block, { className });
    return '';
  });
  // 2. Les clés : dans une balise (attribut) ou dans le texte.
  const fill = (segment: string, inTag: boolean) =>
    segment.replace(/\{\{\s*([\w.:-]+)\s*\}\}/g, (_m, key: string) => {
      const entry = map.entries.get(key);
      if (!entry) {
        unknown.push(key);
        return '';
      }
      used.add(key);
      if (map.markers.has(key)) return inTag ? `{{${key}}}` : `<span data-field="${key}">{{${key}}}</span>`;
      // Une adresse ne s'imprime jamais : elle n'a de sens que dans un attribut (src).
      if (entry.kind === 'url') return inTag ? esc(entry.value) : '';
      return inTag ? esc(entry.value) : esc(entry.value).replace(/\n/g, '<br>');
    });
  html = html
    .split(/(<[^>]*>)/)
    .map((part, i) => fill(part, i % 2 === 1))
    .join('');
  // Une image sans adresse (clé inconnue, adresse retirée) ne s'affiche jamais : retirée plutôt que laissée cassée.
  html = html.replace(/<img\b[^>]*>/gi, (tag) => (/\ssrc\s*=\s*"(?!\s*")[^"]+"/i.test(tag) ? tag : (orphans.push('img:no-src'), '')));
  const attrs = [`class="${rootClasses(format)}"`, ...(format.kind === 'fixed' ? ['data-ge-fixed="1"'] : []), `lang="${esc(frame.locale)}"`, `data-ge-engine="${esc(frame.engine)}"`, `data-ge-pattern="authored"`, `data-ge-section="${esc(frame.sectionId)}"`, `data-ge-format="${esc(format.id)}"`];
  return { html: `<div ${attrs.join(' ')}>${html}</div>`, used, unknown: [...new Set(unknown)], orphans };
}
