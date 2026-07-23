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

/**
 * Indentation (espaces/tabs) précédant `pos` sur sa ligne.
 * Retourne null si un caractère non-blanc précède `pos` sur la ligne (donc `pos`
 * n'est pas en début de ligne → élément « inline »).
 */
function lineIndentBefore(code: string, pos: number): string | null {
  let i = pos - 1;
  let ws = '';
  while (i >= 0) {
    const c = code[i];
    if (c === '\n') return ws;
    if (c === ' ' || c === '\t') {
      ws = c + ws;
      i--;
      continue;
    }
    return null; // caractère non-blanc → inline
  }
  return ws; // début de fichier
}

/** Est-ce que `element` est un enfant JSX direct de `parent` (pas dans une expression) ? */
function isDirectChild(parent: Node, element: Node): boolean {
  const children = (parent.children as Node[]) || [];
  return children.some((c) => c.type === 'JSXElement' && c.start === element.start);
}

/**
 * Région à retirer pour supprimer proprement un élément : l'élément lui-même,
 * plus l'indentation de sa ligne et le retour à la ligne, afin de ne pas laisser
 * de ligne vide. Fonctionne aussi pour les éléments « inline ».
 */
function computeRemoval(code: string, node: Node): { remStart: number; remEnd: number } {
  const indent = lineIndentBefore(code, node.start);
  if (indent !== null) {
    let remStart = node.start - indent.length; // début de ligne
    let remEnd = node.end;
    if (code[remEnd] === '\r') remEnd++;
    if (code[remEnd] === '\n') {
      remEnd++; // consomme le retour à la ligne suivant
    } else {
      // Pas de retour à la ligne après : on consomme celui d'avant.
      if (remStart > 0 && code[remStart - 1] === '\n') remStart--;
      if (remStart > 0 && code[remStart - 1] === '\r') remStart--;
    }
    return { remStart, remEnd };
  }
  // Inline : retire l'élément + un espace adjacent.
  let remStart = node.start;
  let remEnd = node.end;
  if (code[remEnd] === ' ') remEnd++;
  else if (remStart > 0 && code[remStart - 1] === ' ') remStart--;
  return { remStart, remEnd };
}

/**
 * Applique simultanément un retrait [remStart,remEnd) et une insertion de `insText`
 * à `insPos`, sur la chaîne d'origine. Les deux zones ne doivent pas se chevaucher.
 */
function spliceMove(
  code: string,
  remStart: number,
  remEnd: number,
  insPos: number,
  insText: string
): EditResult {
  if (insPos > remStart && insPos < remEnd) {
    return { ok: false, reason: 'zones de déplacement chevauchantes' };
  }
  if (insPos <= remStart) {
    return {
      ok: true,
      code: code.slice(0, insPos) + insText + code.slice(insPos, remStart) + code.slice(remEnd),
    };
  }
  // insPos >= remEnd
  return {
    ok: true,
    code: code.slice(0, remStart) + code.slice(remEnd, insPos) + insText + code.slice(insPos),
  };
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
/* Édition d'attribut générique (href, alt, target, placeholder…)      */
/* ------------------------------------------------------------------ */

/**
 * Définit / remplace un attribut. `value === null` retire l'attribut
 * (utile pour un toggle, ex. target="_blank"). Ne gère que les valeurs chaînes
 * (les attributs à valeur d'expression `{...}` sont remplacés par une chaîne).
 */
export function editAttribute(
  code: string,
  start: number,
  name: string,
  value: string | null
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
  const attr = findAttribute(opening, name);

  if (value === null) {
    if (!attr) return { ok: true, code }; // rien à retirer
    let s = attr.start;
    if (s > 0 && /\s/.test(code[s - 1])) s--; // consomme l'espace précédent
    return { ok: true, code: code.slice(0, s) + code.slice(attr.end) };
  }

  const literal = JSON.stringify(value);
  if (!attr) {
    const nameNode = opening.name as unknown as Node;
    return { ok: true, code: splice(code, nameNode.end, nameNode.end, ` ${name}=${literal}`) };
  }
  const val = attr.value as Node | null;
  if (!val) {
    // attribut booléen sans valeur -> le transforme en name="value"
    return { ok: true, code: splice(code, attr.start, attr.end, `${name}=${literal}`) };
  }
  return { ok: true, code: splice(code, val.start, val.end, literal) };
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

/**
 * Modifie une propriété CSS via l'attribut `style` inline. `cssProp` est une clé
 * camelCase quelconque (color, fontSize, borderRadius, flexDirection, objectFit,
 * backgroundImage…) : n'importe quelle propriété CSS est acceptée.
 */
export function editStyle(
  code: string,
  start: number,
  cssProp: string,
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
  // On ne réordonne QUE les éléments JSX enfants directs du parent. Les nœuds
  // texte / expressions ({...}) entre eux sont laissés en place : le déplacement
  // ne touche que la plage source de l'élément déplacé et son point d'insertion.
  const elements = ((parent.children as Node[]) || []).filter((c) => c.type === 'JSXElement');
  if (elements.length < 2) return { ok: false, reason: 'pas assez de frères' };

  const movedIdx = elements.findIndex((el) => el.start === hit.element.start);
  if (movedIdx === -1) return { ok: false, reason: 'element déplacé non direct' };
  const moved = elements[movedIdx];

  // Cible.
  let targetIdx = -1;
  if (beforeStart !== null) {
    targetIdx = elements.findIndex((el) => (el.openingElement as Node).start === beforeStart);
    if (targetIdx === -1) return { ok: false, reason: 'cible introuvable' };
  }

  // No-op : déjà à la bonne place.
  if (beforeStart !== null && (targetIdx === movedIdx || targetIdx === movedIdx + 1)) {
    return { ok: true, code };
  }
  if (beforeStart === null && movedIdx === elements.length - 1) {
    return { ok: true, code };
  }

  const block = code.slice(moved.start, moved.end);
  const { remStart, remEnd } = computeRemoval(code, moved);

  let insPos: number;
  let insText: string;
  if (beforeStart !== null) {
    const target = elements[targetIdx];
    const tIndent = lineIndentBefore(code, target.start);
    if (tIndent !== null) {
      insPos = target.start - tIndent.length; // début de ligne de la cible
      insText = tIndent + block + '\n';
    } else {
      insPos = target.start;
      insText = block + ' ';
    }
  } else {
    // Placer en dernier : après le dernier élément qui n'est pas celui déplacé.
    const last = elements[elements.length - 1];
    const lIndent = lineIndentBefore(code, last.start);
    if (lIndent !== null) {
      insPos = last.end;
      insText = '\n' + lIndent + block;
    } else {
      insPos = last.end;
      insText = ' ' + block;
    }
  }

  return spliceMove(code, remStart, remEnd, insPos, insText);
}

/* ------------------------------------------------------------------ */
/* Suppression d'élément                                               */
/* ------------------------------------------------------------------ */

export function deleteElement(code: string, start: number): EditResult {
  let ast;
  try {
    ast = parseCode(code);
  } catch (e) {
    return { ok: false, reason: `parse error: ${(e as Error).message}` };
  }
  const hit = findByStart(ast, start);
  if (!hit) return { ok: false, reason: 'element introuvable' };
  if (!hit.parent) return { ok: false, reason: 'parent introuvable' };

  // On ne supprime que les éléments enfants JSX directs : retirer un élément
  // niché dans une expression ({cond && <X/>}, .map(...)) casserait la syntaxe.
  if (!isDirectChild(hit.parent, hit.element)) {
    return { ok: false, reason: 'suppression non supportée ici' };
  }

  const { remStart, remEnd } = computeRemoval(code, hit.element);
  return { ok: true, code: code.slice(0, remStart) + code.slice(remEnd) };
}
