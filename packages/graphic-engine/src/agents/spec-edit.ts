/**
 * LA RETOUCHE D'UNE PAGE DÉJÀ COMPOSÉE — « agrandis le titre », « enlève le sous-titre », « mets le logo en
 * bas », « ajoute le prix ».
 *
 * Une page du moteur est un ARBRE (`SectionSpec.root`, la vérité du rendu). La retouche ne recompose pas : elle
 * MODIFIE cet arbre, nœud par nœud, puis le moteur le rejoue tel quel (`renderSingle({ replay })`) — mesure et
 * réparations du code comprises (un titre plus long est ajusté, un contraste rattrapé). Le reste de la page ne
 * bouge pas d'un pixel.
 *
 *   `specOutline`  l'arbre montré au modèle, chaque nœud numéroté (`"#": "n3"`) ;
 *   `applySpecOps` ses opérations (`set`, `remove`, `move`, `add`) appliquées une à une — une opération qui
 *                  rendrait l'arbre invalide est refusée seule, les autres passent ;
 *   `settleTree`   l'arbre rapproché du contenu : références mortes retirées, champ nouveau posé à côté de ses
 *                  voisins, photo nouvelle posée, logo garanti.
 */
import type { SectionContent } from '../contracts/content-model';
import type { DecorItem, NodeT, SectionSpec } from '../contracts/design-spec';
import { Node } from '../contracts/design-spec';
import { textRefResolves, validateNode, walk } from '../contracts/validate';
import { fieldPathsOf } from './creative-planner';
import { ensureLogo } from './logo-guard';

export { ensureLogo };

export interface SpecOp {
  op: 'set' | 'remove' | 'move' | 'add';
  /** Le nœud visé (`n3`, `d0` pour un décor). */
  id?: string;
  /** `set` : les propriétés à changer (jetons du moteur) ; `at` pour un nœud posé dans un calque. */
  props?: Record<string, unknown>;
  /** `move` : à placer avant ou après ce nœud. */
  before?: string;
  after?: string;
  /** `add` : le conteneur, la position, le nœud ; `at` pour un calque. */
  parent?: string;
  index?: number;
  node?: unknown;
  at?: { x: number; y: number; w: number; h: number };
}

type Annotated = Record<string, unknown> & { '#'?: string };

/** Ce qu'une opération `set` ne peut jamais toucher : la structure et le contenu passent par d'autres voies. */
const LOCKED = new Set(['t', 'children', 'items', 'ref', 'url', 'text', 'bind', '#', 'component']);

/** Un clone de l'arbre et des décors, chaque nœud numéroté dans l'ordre du parcours (déterministe). */
function annotate(spec: Pick<SectionSpec, 'root' | 'decor'>): { root: Annotated; decor: Array<{ at: DecorItem['at']; z?: number; node: Annotated }> } {
  let n = 0;
  const mark = (node: unknown): Annotated => {
    // L'identifiant en tête : le modèle lit « "#":"n3","t":"text"… » avant les propriétés.
    const copy: Annotated = { '#': `n${++n}`, ...(node as Annotated) };
    if (Array.isArray(copy.children)) copy.children = (copy.children as unknown[]).map(mark);
    if (copy.t === 'layer' && Array.isArray(copy.items)) copy.items = (copy.items as Array<{ at: unknown; z?: number; node: unknown }>).map((it) => ({ ...it, node: mark(it.node) }));
    return copy;
  };
  const root = mark(spec.root);
  const decor = (spec.decor ?? []).map((d, i) => ({ ...d, node: { '#': `d${i}`, ...(d.node as Annotated) } }));
  return { root, decor };
}

function strip(node: Annotated): NodeT {
  const { '#': _mark, ...rest } = node;
  if (Array.isArray(rest.children)) rest.children = (rest.children as Annotated[]).map(strip);
  if (rest.t === 'layer' && Array.isArray(rest.items)) rest.items = (rest.items as Array<{ node: Annotated }>).map((it) => ({ ...it, node: strip(it.node) }));
  return rest as unknown as NodeT;
}

/** L'arbre numéroté, en JSON compact : ce que le modèle lit pour désigner un nœud. */
export function specOutline(spec: Pick<SectionSpec, 'root' | 'decor'>): string {
  const { root, decor } = annotate(spec);
  return JSON.stringify({ root, ...(decor.length ? { decor } : {}) });
}

interface Slot {
  node: Annotated;
  /** Le tableau qui le porte et sa position (enfants d'un conteneur, éléments d'un calque, décors). */
  list?: unknown[];
  index?: number;
  kind?: 'children' | 'items' | 'decor';
}

function find(root: Annotated, decor: Array<{ node: Annotated }>, id: string): Slot | null {
  if (root['#'] === id) return { node: root };
  let found: Slot | null = null;
  const visit = (node: Annotated): void => {
    if (found) return;
    const children = Array.isArray(node.children) ? (node.children as Annotated[]) : null;
    children?.forEach((child, index) => {
      if (found) return;
      if (child['#'] === id) found = { node: child, list: children, index, kind: 'children' };
      else visit(child);
    });
    const items = node.t === 'layer' && Array.isArray(node.items) ? (node.items as Array<{ node: Annotated }>) : null;
    items?.forEach((item, index) => {
      if (found) return;
      if (item.node['#'] === id) found = { node: item.node, list: items, index, kind: 'items' };
      else visit(item.node);
    });
  };
  visit(root);
  if (found) return found;
  const at = decor.findIndex((d) => d.node['#'] === id);
  return at >= 0 ? { node: decor[at].node, list: decor, index: at, kind: 'decor' } : null;
}

const validAt = (at: unknown): at is { x: number; y: number; w: number; h: number } => {
  const a = at as Record<string, unknown> | null;
  return !!a && ['x', 'y', 'w', 'h'].every((k) => typeof a[k] === 'number' && Number.isFinite(a[k] as number)) && (a.x as number) >= -20 && (a.y as number) >= -20 && (a.x as number) <= 120 && (a.y as number) <= 120 && (a.w as number) > 0 && (a.h as number) > 0 && (a.w as number) <= 140 && (a.h as number) <= 140;
};

/** Le nœud d'un `add` : un nœud valide du moteur, sans texte libre ni adresse d'image. */
function newNode(raw: unknown): Annotated | null {
  if (!raw || typeof raw !== 'object') return null;
  const clean = (n: unknown): unknown => {
    if (!n || typeof n !== 'object') return n;
    const { text: _t, url: _u, bind: _b, '#': _m, ...rest } = n as Record<string, unknown>;
    if (Array.isArray(rest.children)) rest.children = rest.children.map(clean);
    return rest;
  };
  const parsed = Node.safeParse(clean(raw));
  return parsed.success ? (parsed.data as unknown as Annotated) : null;
}

/**
 * Applique les opérations une à une ; une opération qui casserait l'arbre est REFUSÉE seule (les autres
 * passent). Renvoie le nouvel arbre et ce qui a été fait ou refusé, pour la réponse à l'utilisateur.
 */
export function applySpecOps(spec: Pick<SectionSpec, 'root' | 'decor'>, ops: SpecOp[]): { root: NodeT; decor: DecorItem[]; applied: string[]; rejected: string[] } {
  let { root, decor } = annotate(spec);
  const applied: string[] = [];
  const rejected: string[] = [];
  for (const op of ops.slice(0, 24)) {
    const before = JSON.stringify({ root, decor });
    const label = `${op.op} ${op.id ?? op.parent ?? ''}`.trim();
    let ok = false;
    try {
      if (op.op === 'set' && op.id && op.props && typeof op.props === 'object') {
        const slot = find(root, decor, op.id);
        if (slot) {
          for (const [key, value] of Object.entries(op.props)) {
            if (key === 'at') {
              if (slot.kind === 'items' || slot.kind === 'decor') {
                const holder = (slot.list as Array<{ at: unknown }>)[slot.index!];
                if (validAt(value)) holder.at = value;
              }
              continue;
            }
            if (LOCKED.has(key)) continue;
            if (value === null) delete slot.node[key];
            else slot.node[key] = value;
          }
          ok = true;
        }
      } else if (op.op === 'remove' && op.id) {
        const slot = find(root, decor, op.id);
        if (slot?.list && slot.index !== undefined) {
          slot.list.splice(slot.index, 1);
          ok = true;
        }
      } else if (op.op === 'move' && op.id && (op.before || op.after)) {
        const slot = find(root, decor, op.id);
        const target = find(root, decor, (op.before || op.after)!);
        if (slot?.kind === 'children' && target?.kind === 'children' && slot.node !== target.node) {
          slot.list!.splice(slot.index!, 1);
          const again = find(root, decor, (op.before || op.after)!)!;
          again.list!.splice(again.index! + (op.after ? 1 : 0), 0, slot.node);
          ok = true;
        } else if (slot?.kind === 'items' && validAt(op.at)) {
          (slot.list as Array<{ at: unknown }>)[slot.index!].at = op.at;
          ok = true;
        }
      } else if (op.op === 'add' && op.parent) {
        const parent = find(root, decor, op.parent);
        const node = newNode(op.node);
        if (parent && node) {
          if (Array.isArray(parent.node.children)) {
            const list = parent.node.children as unknown[];
            const at = typeof op.index === 'number' ? Math.max(0, Math.min(list.length, Math.round(op.index))) : list.length;
            list.splice(at, 0, node);
            ok = true;
          } else if (parent.node.t === 'layer' && Array.isArray(parent.node.items) && validAt(op.at)) {
            (parent.node.items as unknown[]).push({ at: op.at, z: 6, node });
            ok = true;
          }
        }
      }
      // L'arbre doit rester un arbre du moteur après CHAQUE opération.
      if (ok && !validateNode(strip(root)).ok) ok = false;
    } catch {
      ok = false;
    }
    if (ok) applied.push(label);
    else {
      rejected.push(label);
      ({ root, decor } = JSON.parse(before));
    }
  }
  return { root: strip(root), decor: decor.map((d) => ({ ...d, node: strip(d.node) }) as DecorItem), applied, rejected };
}

/**
 * L'arbre retouché, rapproché du contenu retouché : un texte dont le champ a disparu s'efface, une photo retirée
 * aussi ; un champ NOUVEAU d'un bloc posé champ par champ se pose juste après son voisin ; une photo nouvelle se
 * pose ; le logo d'un visuel reste.
 */
export function settleTree(root: NodeT, decor: DecorItem[], section: SectionContent, o: { requireLogo?: boolean } = {}): { root: NodeT; decor: DecorItem[]; notes: string[] } {
  const notes: string[] = [];
  const figures = new Set(section.blocks.filter((b) => b.kind === 'figure').map((b) => b.id));
  const blocks = new Set(section.blocks.map((b) => b.id));
  const valueAt = (ref: string): unknown => {
    const [id, ...path] = ref.split('.');
    if (!path.length) return id === 'title' || blocks.has(id) || (id === 'kicker' && section.kicker) || (id === 'lede' && section.lede) ? true : undefined;
    let cur: unknown = section.blocks.find((b) => b.id === id);
    for (const key of path) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined;
    return cur;
  };
  const alive = (n: NodeT): boolean => {
    if (n.t === 'text' && n.ref) return textRefResolves(n.ref, section) && valueAt(n.ref) !== undefined && valueAt(n.ref) !== '';
    if (n.t === 'image' && n.ref) return figures.has(n.ref);
    if (n.t === 'block') return blocks.has(n.ref);
    return true;
  };
  const prune = (n: NodeT): NodeT | null => {
    if (!alive(n)) {
      notes.push(`nœud ${n.t} ${'ref' in n ? n.ref : ''} retiré (son contenu n'existe plus)`);
      return null;
    }
    if ('children' in n) return { ...n, children: n.children.map(prune).filter((c): c is NodeT => !!c) } as NodeT;
    if (n.t === 'layer') return { ...n, items: n.items.map((it) => ({ ...it, node: prune(it.node) })).filter((it): it is typeof it & { node: NodeT } => !!it.node) };
    return n;
  };
  let tree = prune(root) ?? { t: 'stack', gap: 'md', grow: true, children: [] };
  const kept = decor.filter((d) => alive(d.node));

  // Les champs d'un bloc posé UN À UN : un champ ajouté par la retouche (un prix, un contact) se pose après le
  // dernier champ présent du même bloc, dans le même conteneur.
  const refs = new Set<string>();
  const placedBlocks = new Set<string>();
  walk(tree, (n) => {
    if (n.t === 'text' && n.ref) refs.add(n.ref);
    if (n.t === 'block') placedBlocks.add(n.ref);
    if (n.t === 'image' && n.ref) placedBlocks.add(n.ref);
  });
  for (const block of section.blocks) {
    if (placedBlocks.has(block.id)) continue;
    const fields = fieldPathsOf(block);
    const present = fields.filter((f) => refs.has(`${block.id}.${f.path}`));
    if (fields.length && present.length) {
      for (const f of fields.filter((x) => !refs.has(`${block.id}.${x.path}`))) {
        const anchor = `${block.id}.${present[present.length - 1].path}`;
        const node: NodeT = { t: 'text', role: f.role, ref: `${block.id}.${f.path}` };
        let placed = false;
        const insert = (n: NodeT): NodeT => {
          if (placed) return n;
          if ('children' in n) {
            const at = n.children.findIndex((c) => c.t === 'text' && c.ref === anchor);
            if (at >= 0) {
              placed = true;
              const children = [...n.children];
              children.splice(at + 1, 0, node);
              return { ...n, children } as NodeT;
            }
            return { ...n, children: n.children.map(insert) } as NodeT;
          }
          if (n.t === 'layer') {
            const at = n.items.findIndex((it) => it.node.t === 'text' && it.node.ref === anchor);
            if (at >= 0) {
              placed = true;
              const a = n.items[at].at;
              return { ...n, items: [...n.items, { at: { x: a.x, y: Math.min(110, a.y + a.h + 1), w: a.w, h: Math.max(6, Math.round(a.h * 0.6)) }, z: n.items[at].z, node }] };
            }
            return { ...n, items: n.items.map((it) => ({ ...it, node: insert(it.node) })) };
          }
          return n;
        };
        tree = insert(tree);
        if (!placed && 'children' in tree) tree = { ...tree, children: [...tree.children, node] } as NodeT;
        notes.push(`champ ${f.path} posé`);
        refs.add(`${block.id}.${f.path}`);
        present.push(f);
      }
      continue;
    }
    if (block.kind === 'figure' && !kept.some((d) => d.node.t === 'image' && d.node.ref === block.id)) {
      // Une photo ajoutée par la retouche : en fond d'un calque (voile en pied), sinon en tête de page.
      const image: NodeT = { t: 'image', ref: block.id, overlay: 'scrim-bottom' };
      if (tree.t === 'layer') tree = { ...tree, items: [{ at: { x: 0, y: 0, w: 100, h: 100 }, z: 0, node: image }, ...tree.items] };
      else if ('children' in tree) tree = { ...tree, children: [{ ...image, grow: true, overlay: 'none' } as NodeT, ...tree.children] } as NodeT;
      notes.push('photo posée');
    } else if (block.kind !== 'figure') {
      if ('children' in tree) tree = { ...tree, children: [...tree.children, { t: 'block', ref: block.id }] } as NodeT;
      notes.push(`bloc ${block.id} posé`);
    }
  }
  if (o.requireLogo) {
    const logo = ensureLogo(tree, kept);
    if (logo.added) notes.push('logo ajouté');
    tree = logo.root;
  }
  return { root: tree, decor: kept, notes };
}
