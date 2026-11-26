/**
 * LES REPÈRES DU MODE ÉDITION dans l'aperçu instantané.
 *
 * Chaque balise JSX du site reçoit `data-idem-id="<fichier>|<position du « < »>"`, la même marque que posait le
 * plugin Vite du mode Édition (`we-dev-client/src/components/EditMode/instrumentation.ts`) : l'atelier retrouve
 * l'élément cliqué dans le code et le modifie par l'AST.
 *
 * Posés en permanence, au regroupement : passer en « Sélectionner » ou « Dessiner » ne réécrit plus `vite.config`,
 * ne redémarre plus Vite et ne quitte plus l'aperçu instantané — le mode s'allume par un simple message, sur la page
 * et à l'endroit où se trouve la personne (même approche que les éditeurs visuels du marché : un identifiant stable
 * par composant, posé à la compilation).
 *
 * Les positions sont celles du source PROPRE, tel que l'atelier le garde (`fileStore`). Résultat gardé par contenu :
 * esbuild relit chaque module à chaque reconstruction, seul un fichier modifié est réanalysé.
 */
import { createHash } from 'node:crypto';
import ts from 'typescript';

const ATTR = 'data-idem-id';
/** Une marque sur un fragment ne désigne rien à l'écran, et React s'en plaint. */
const SKIPPED_TAGS = new Set(['Fragment', 'React.Fragment']);
const MAX_ENTRIES = 2000;
const cache = new Map<string, string>();

/** Les fichiers marqués : le JSX du projet, jamais les dépendances. */
export function isTaggable(path: string): boolean {
  return /\.(t|j)sx$/.test(path) && !/(^|\/)node_modules\//.test(path);
}

/** Le code avec une marque après le nom de chaque balise ouvrante. En cas d'échec d'analyse, le code tel quel. */
export function tagJsx(path: string, code: string): string {
  const key = createHash('sha1').update(path).update('\0').update(code).digest('base64');
  const hit = cache.get(key);
  if (hit !== undefined) {
    // Remis en fin de file : les fichiers de la session ouverte restent en cache.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  let out = code;
  try {
    const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, false, path.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX);
    const inserts: Array<{ pos: number; id: string }> = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const name = node.tagName.getText(source);
        const already = node.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(source) === ATTR);
        if (!SKIPPED_TAGS.has(name) && !already) {
          // Après les arguments de type éventuels (`<Select<Option>`), sinon juste après le nom.
          const after = node.typeArguments?.end ?? node.tagName.end;
          const pos = node.typeArguments ? code.indexOf('>', after) + 1 : after;
          inserts.push({ pos, id: `${path}|${node.getStart(source)}` });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    inserts.sort((a, b) => b.pos - a.pos);
    for (const { pos, id } of inserts) out = `${out.slice(0, pos)} ${ATTR}=${JSON.stringify(id)}${out.slice(pos)}`;
  } catch {
    out = code;
  }
  cache.set(key, out);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return out;
}
