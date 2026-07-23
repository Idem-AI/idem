/**
 * Réécriture déterministe du code source JSX/TSX.
 *
 * Toutes les opérations localisent un élément par l'offset (`start`) de sa balise
 * ouvrante — la même valeur que celle encodée dans `data-idem-id` par
 * l'instrumentation. On applique UN SEUL edit par appel (le parent re-parse le
 * fichier propre à chaque message reçu), puis on modifie la chaîne source par
 * découpe (`slice`) autour des offsets des nœuds : le formatage d'origine est
 * intégralement préservé (pas de re-génération de code).
 */
import { parse } from '@babel/parser';
import traverseDefault from '@babel/traverse';
import type { StyleProperty } from './idemProtocol';

// Interop CJS/ESM : @babel/traverse expose parfois la fonction sous .default.
const traverse = ((traverseDefault as unknown as { default?: typeof traverseDefault })
  .default || traverseDefault) as typeof traverseDefault;

// Nœud AST minimal (on évite la dépendance @babel/types côté client).
type Node = { type: string; start: number; end: number; [k: string]: unknown };

export interface EditResult {
  ok: boolean;
  /** Contenu du fichier après édition (si ok). */
  code?: string;
  reason?: string;
}

const CSS_PROPERTY: Record<StyleProperty, string> = {
  color: 'color',
  fontSize: 'fontSize',
  fontWeight: 'fontWeight',
  textAlign: 'textAlign',
  backgroundColor: 'backgroundColor',
};

function parseCode(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  });
}

/** Localise le JSXElement dont la balise ouvrante commence à l'offset `start`. */
function findByStart(ast: ReturnType<typeof parseCode>, start: number) {
  let found: { element: Node; opening: Node; parent: Node | null } | null = null;
  traverse(ast, {
    JSXOpeningElement(path) {
      const opening = path.node as unknown as Node;
      if (opening.start !== start) return;
      const element = path.parent as unknown as Node; // JSXElement
      // Parent contenant : remonte jusqu'au JSXElement / JSXFragment englobant.
      let p = path.parentPath?.parentPath ?? null;
      while (p && p.node.type !== 'JSXElement' && p.node.type !== 'JSXFragment') {
        p = p.parentPath ?? null;
      }
      found = {
        element,
        opening,
        parent: p ? (p.node as unknown as Node) : null,
      };
      path.stop();
    },
  });
  return found;
}

function getAttributes(opening: Node): Node[] {
  return (opening.attributes as Node[]) || [];
}

function findAttribute(opening: Node, name: string): Node | undefined {
  return getAttributes(opening).find(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      (attr.name as Node | undefined)?.type === 'JSXIdentifier' &&
      (attr.name as unknown as { name: string }).name === name
  );
}

function splice(code: string, start: number, end: number, insert: string): string {
  return code.slice(0, start) + insert + code.slice(end);
}

/* ------------------------------------------------------------------ */
/* Édition de texte                                                    */
/* ------------------------------------------------------------------ */

/** Vrai si le texte peut être écrit tel quel dans un enfant JSX (sans casser la syntaxe). */
function isSafeJsxText(text: string): boolean {
  return !/[<>{}]/.test(text);
}

export function editText(code: string, start: number, newText: string): EditResult {
  let ast;
  try {
    ast = parseCode(code);
  } catch (e) {
    return { ok: false, reason: `parse error: ${(e as Error).message}` };
  }
  const hit = findByStart(ast, start);
  if (!hit) return { ok: false, reason: 'element introuvable' };

  const element = hit.element;
  const opening = hit.opening;
  const closing = element.closingElement as Node | undefined;
  if (!closing) return { ok: false, reason: 'element auto-fermant, pas de texte' };

  // Zone interne = entre la fin de la balise ouvrante et le début de la fermante.
  const innerStart = opening.end;
  const innerEnd = closing.start;

  // Rendu du nouveau texte : brut si sûr, sinon en conteneur d'expression.
  const replacement = isSafeJsxText(newText) ? newText : `{${JSON.stringify(newText)}}`;
  return { ok: true, code: splice(code, innerStart, innerEnd, replacement) };
}

/* ------------------------------------------------------------------ */
/* Remplacement de source d'image                                      */
/* ------------------------------------------------------------------ */

export function editImageSrc(code: string, start: number, newSrc: string): EditResult {
  let ast;
  try {
    ast = parseCode(code);
  } catch (e) {
    return { ok: false, reason: `parse error: ${(e as Error).message}` };
  }
  const hit = findByStart(ast, start);
  if (!hit) return { ok: false, reason: 'element introuvable' };

  const opening = hit.opening;
  const srcAttr = findAttribute(opening, 'src');
  const literal = JSON.stringify(newSrc); // gère l'échappement des guillemets

  if (!srcAttr) {
    // Insère src juste après le nom de la balise.
    const nameNode = opening.name as unknown as Node;
    return { ok: true, code: splice(code, nameNode.end, nameNode.end, ` src=${literal}`) };
  }
  const value = srcAttr.value as Node | null;
  if (!value) {
    return { ok: false, reason: 'attribut src sans valeur' };
  }
  return { ok: true, code: splice(code, value.start, value.end, literal) };
}

/* ------------------------------------------------------------------ */
/* Édition de style (attribut style inline — déterministe)             */
/* ------------------------------------------------------------------ */

/** Parse les propriétés d'un ObjectExpression en map clé -> texte source de la valeur. */
function readStyleObject(code: string, obj: Node): Map<string, string> {
  const map = new Map<string, string>();
  const props = (obj.properties as Node[]) || [];
  for (const prop of props) {
    if (prop.type !== 'ObjectProperty') continue;
    const key = prop.key as Node;
    let keyName: string | null = null;
    if (key.type === 'Identifier') keyName = (key as unknown as { name: string }).name;
    else if (key.type === 'StringLiteral')
      keyName = (key as unknown as { value: string }).value;
    if (!keyName) continue;
    const val = prop.value as Node;
    map.set(keyName, code.slice(val.start, val.end));
  }
  return map;
}

function serializeStyleObject(map: Map<string, string>): string {
  const entries = Array.from(map.entries()).map(([k, v]) => {
    const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
    return `${key}: ${v}`;
  });
  return `{{ ${entries.join(', ')} }}`;
}

export function editStyle(
  code: string,
  start: number,
  property: StyleProperty,
  value: string
): EditResult {
  let ast;
  try {
    ast = parseCode(code);
  } catch (e) {
    return { ok: false, reason: `parse error: ${(e as Error).message}` };
  }
  const hit = findByStart(ast, start);
  if (!hit) return { ok: false, reason: 'element introuvable' };

  const opening = hit.opening;
  const cssProp = CSS_PROPERTY[property];
  const valueLiteral = JSON.stringify(value);
  const styleAttr = findAttribute(opening, 'style');

  if (!styleAttr) {
    const nameNode = opening.name as unknown as Node;
    const insert = ` style={{ ${cssProp}: ${valueLiteral} }}`;
    return { ok: true, code: splice(code, nameNode.end, nameNode.end, insert) };
  }

  const attrValue = styleAttr.value as Node | null;
  if (!attrValue || attrValue.type !== 'JSXExpressionContainer') {
    return { ok: false, reason: 'style non éditable (pas une expression)' };
  }
  const expr = attrValue.expression as Node;
  if (expr.type !== 'ObjectExpression') {
    return { ok: false, reason: 'style non éditable (pas un objet littéral)' };
  }
  const map = readStyleObject(code, expr);
  map.set(cssProp, valueLiteral);
  const rebuilt = serializeStyleObject(map);
  // Remplace tout le conteneur {{...}} par la version reconstruite.
  return { ok: true, code: splice(code, attrValue.start, attrValue.end, rebuilt) };
}

/* ------------------------------------------------------------------ */
/* Réordonnancement de frères                                          */
/* ------------------------------------------------------------------ */

export function reorderSiblings(
  code: string,
  movedStart: number,
  beforeStart: number | null
): EditResult {
  let ast;
  try {
    ast = parseCode(code);
  } catch (e) {
    return { ok: false, reason: `parse error: ${(e as Error).message}` };
  }
  const hit = findByStart(ast, movedStart);
  if (!hit) return { ok: false, reason: 'element déplacé introuvable' };
  if (!hit.parent) return { ok: false, reason: 'parent introuvable' };

  const parent = hit.parent;
  const rawChildren = (parent.children as Node[]) || [];

  // On ne gère que le cas sûr : enfants = éléments JSX + espaces uniquement.
  const nonWhitespaceNonElement = rawChildren.some((c) => {
    if (c.type === 'JSXElement') return false;
    if (c.type === 'JSXText') {
      return (c as unknown as { value: string }).value.trim().length > 0;
    }
    return true; // expression container, etc.
  });
  if (nonWhitespaceNonElement) {
    return { ok: false, reason: 'réordonnancement non sûr (enfants mixtes)' };
  }

  const elements = rawChildren.filter((c) => c.type === 'JSXElement');
  if (elements.length < 2) return { ok: false, reason: 'pas assez de frères' };

  const movedIdx = elements.findIndex((el) => (el.openingElement as Node).start === movedStart);
  if (movedIdx === -1) return { ok: false, reason: 'element déplacé absent du parent' };

  let targetIdx = elements.length; // fin par défaut
  if (beforeStart !== null) {
    targetIdx = elements.findIndex((el) => (el.openingElement as Node).start === beforeStart);
    if (targetIdx === -1) return { ok: false, reason: 'cible introuvable' };
  }

  // Nouvel ordre.
  const order = elements.slice();
  const [moved] = order.splice(movedIdx, 1);
  // Après retrait, recalculer l'index d'insertion.
  let insertIdx = targetIdx;
  if (beforeStart !== null && targetIdx > movedIdx) insertIdx = targetIdx - 1;
  if (beforeStart === null) insertIdx = order.length;
  order.splice(insertIdx, 0, moved);

  // Séparateur inter-éléments : espace entre les 2 premiers éléments d'origine.
  const sep = code.slice(elements[0].end, elements[1].start);
  const regionStart = elements[0].start;
  const regionEnd = elements[elements.length - 1].end;
  const rebuilt = order.map((el) => code.slice(el.start, el.end)).join(sep);

  return { ok: true, code: splice(code, regionStart, regionEnd, rebuilt) };
}
