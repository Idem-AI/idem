/**
 * CE QUE LA PERSONNE A DÉSIGNÉ DANS L'APERÇU (outil Dessin) — résolu par l'aperçu en éléments du code : le fichier
 * et la position de chaque élément, et la partie qui le porte (section, en-tête, pied de page, composant).
 *
 * La retouche s'y tient : seules ces parties (et les données qu'elles affichent) peuvent changer, le modèle reçoit
 * le code exact de l'élément, et une modification qui ne le touche pas est refusée. Encadrer un bouton ne peut plus
 * modifier tout le site, ni une autre section.
 */
import ts from 'typescript';

export interface PointedElement {
  tag: string;
  kind: string;
  text: string;
  filePath: string;
  start: number;
  owner: string;
  ownerStart: number;
  how: 'point' | 'area';
}

export interface Pointed {
  elements: PointedElement[];
}

const PATH = /^[\w@./-]{1,200}$/;

/** La désignation reçue du client, nettoyée (chemins sûrs, textes bornés). `null` si elle ne désigne rien. */
export function readPointed(raw: unknown): Pointed | null {
  const list = (raw as { elements?: unknown })?.elements;
  if (!Array.isArray(list)) return null;
  const elements: PointedElement[] = [];
  for (const item of list.slice(0, 8) as Array<Record<string, unknown>>) {
    const filePath = String(item?.filePath ?? '');
    const owner = String(item?.owner ?? filePath);
    if (!PATH.test(filePath) || !PATH.test(owner) || filePath.includes('..') || owner.includes('..')) continue;
    elements.push({
      tag: String(item.tag ?? '').slice(0, 30),
      kind: String(item.kind ?? '').slice(0, 20),
      text: String(item.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
      filePath,
      start: Math.max(0, Math.floor(Number(item.start) || 0)),
      owner,
      ownerStart: Math.max(0, Math.floor(Number(item.ownerStart) || 0)),
      how: item.how === 'point' ? 'point' : 'area',
    });
  }
  return elements.length ? { elements } : null;
}

/** Les balises JSX d'un fichier, avec leur étendue (de la balise ouvrante à la fermante). */
function jsxElements(code: string, path: string): Array<{ start: number; end: number; tag: string }> {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') || path.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Array<{ start: number; end: number; tag: string }> = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) out.push({ start: node.getStart(source), end: node.getEnd(), tag: node.openingElement.tagName.getText(source) });
    else if (ts.isJsxSelfClosingElement(node)) out.push({ start: node.getStart(source), end: node.getEnd(), tag: node.tagName.getText(source) });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * L'élément désigné dans le code : la balise qui commence à la position donnée par l'aperçu. Si le fichier a bougé
 * depuis (une retouche entre-temps), la balise la plus petite qui contient son texte affiché.
 */
export function locateElement(code: string, path: string, element: Pick<PointedElement, 'start' | 'text'>): { start: number; end: number; tag: string } | null {
  let elements: Array<{ start: number; end: number; tag: string }>;
  try {
    elements = jsxElements(code, path);
  } catch {
    return null;
  }
  const exact = elements.find((candidate) => candidate.start === element.start);
  if (exact) return exact;
  const words = fold(element.text).split(' ').filter((word) => word.length > 2).slice(0, 6);
  if (!words.length) return null;
  const containing = elements
    .filter((candidate) => {
      const inside = fold(code.slice(candidate.start, candidate.end));
      return words.every((word) => inside.includes(word));
    })
    .sort((a, b) => a.end - a.start - (b.end - b.start));
  return containing[0] ?? null;
}

/** Le code de l'élément désigné, pour le modèle : sa ligne et un extrait borné. */
export function elementSnippet(code: string, span: { start: number; end: number }): { line: number; code: string } {
  const line = code.slice(0, span.start).split('\n').length;
  const from = code.lastIndexOf('\n', span.start) + 1;
  const text = code.slice(from, span.end);
  return { line, code: text.length > 1500 ? `${text.slice(0, 1500)}\n…` : text };
}

/**
 * La retouche touche-t-elle l'élément désigné ? Le passage changé (entre le début et la fin communs des deux
 * versions) doit recouper l'étendue de l'élément.
 */
export function touchesElement(before: string, after: string, span: { start: number; end: number }): boolean {
  if (before === after) return false;
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const changedStart = prefix;
  const changedEnd = Math.max(prefix, before.length - suffix);
  return changedStart <= span.end && changedEnd >= span.start;
}

/** La désignation en clair pour le modèle (applications) : chaque élément, son fichier, sa ligne et son code. */
export function describePointedForModel(pointed: Pointed, files: Record<string, string>): string {
  const lines = ['# What the person pointed at in the preview (make the change THERE, and only there)'];
  for (const element of pointed.elements) {
    const code = files[element.filePath];
    const span = typeof code === 'string' ? locateElement(code, element.filePath, element) : null;
    const snippet = span && code ? elementSnippet(code, span) : null;
    lines.push(`- <${element.tag}>${element.text ? ` « ${element.text.slice(0, 120)} »` : ''} — ${element.filePath}${snippet ? `, line ${snippet.line}:\n\`\`\`tsx\n${snippet.code}\n\`\`\`` : ''}`);
  }
  return lines.join('\n');
}
