/**
 * LE LOGO D'UN VISUEL — toujours présent. Un arbre composé par un auteur (ou retouché) qui l'a oublié reçoit le
 * logo de la marque là où il gêne le moins.
 */
import type { DecorItem, NodeT } from '../contracts/design-spec';
import { walk } from '../contracts/validate';

export const hasLogo = (root: NodeT, decor: DecorItem[] = []): boolean => {
  let found = false;
  const look = (n: NodeT) => walk(n, (x) => (found = found || x.t === 'logo'));
  look(root);
  decor.forEach((d) => look(d.node));
  return found;
};

/**
 * Le LOGO d'un visuel est obligatoire. Absent de l'arbre : posé là où il gêne le moins — dans un coin libre d'un
 * calque, sinon en tête du conteneur racine.
 */
export function ensureLogo(root: NodeT, decor: DecorItem[] = []): { root: NodeT; added: boolean } {
  if (hasLogo(root, decor)) return { root, added: false };
  const logo: NodeT = { t: 'logo', height: 'md' };
  if (root.t === 'layer') {
    // Les zones déjà prises par des mots, des blocs ou des panneaux (une photo, un motif, une forme ne comptent pas).
    const taken = root.items.filter((it) => !['image', 'pattern', 'shape'].includes(it.node.t)).map((it) => it.at);
    const corners = [
      { x: 6, y: 5, w: 22, h: 9 },
      { x: 72, y: 5, w: 22, h: 9 },
      { x: 6, y: 86, w: 22, h: 9 },
      { x: 72, y: 86, w: 22, h: 9 },
    ];
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const free = corners.find((c) => !taken.some((t) => overlaps(c, t)));
    if (free) return { root: { ...root, items: [...root.items, { at: free, z: 8, node: logo }] }, added: true };
    return { root: { t: 'stack', gap: 'md', grow: true, children: [{ t: 'row', children: [logo] }, root] }, added: true };
  }
  if ('children' in root) return { root: { ...root, children: [{ t: 'row', children: [logo] }, ...root.children] } as NodeT, added: true };
  return { root: { t: 'stack', gap: 'md', grow: true, children: [{ t: 'row', children: [logo] }, root] }, added: true };
}

