/**
 * LA RÉGULARITÉ DES COURBES — continuité G1 aux raccords des tracés libres.
 *
 * Deux segments qui se rejoignent peuvent :
 *   G0  se toucher (une cassure de direction : un angle),
 *   G1  partager la même tangente (aucune cassure visible),
 *   G2  partager aussi la courbure (raccord parfaitement doux).
 * Un angle franc est un choix de dessin. Une cassure de QUELQUES degrés n'en est pas un : c'est la
 * main qui a tremblé — l'œil la voit comme une bosse. On détecte ces raccords « presque lisses »
 * (2° à 20°) sur les tracés libres de l'auteur, et on les rend G1 en alignant les deux poignées de
 * Bézier sur leur bissectrice, longueurs conservées. Les angles francs ne sont jamais touchés.
 *
 * Référence : Albayari, Gobithaasan & Miura, courbes log-esthétiques et Bézier G2 (2023) — on en
 * retient le critère de continuité, pas la construction des courbes (nos primitives sont déjà régulières).
 */

type P = [number, number];
interface Seg {
  kind: 'L' | 'C';
  p0: P;
  c1: P;
  c2: P;
  p1: P;
}
interface SubPath {
  segs: Seg[];
  closed: boolean;
}

/** Lit un tracé SVG (M L H V C S Q T Z, absolus et relatifs) en segments absolus. Les arcs (A) rendent `null`. */
export function parsePath(d: string): SubPath[] | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  if (!tokens) return null;
  const subs: SubPath[] = [];
  let cur: SubPath | null = null;
  let pos: P = [0, 0];
  let start: P = [0, 0];
  let lastCtrl: P | null = null;
  let cmd = '';
  let i = 0;
  const n = () => Number(tokens[i++]);
  const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const at = (x: number, y: number): P => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);
    if (C === 'A') return null;
    if (C === 'Z') {
      if (cur) {
        if (Math.hypot(pos[0] - start[0], pos[1] - start[1]) > 1e-6) cur.segs.push({ kind: 'L', p0: pos, c1: pos, c2: start, p1: start });
        cur.closed = true;
      }
      pos = start;
      lastCtrl = null;
      cmd = '';
      continue;
    }
    if (C === 'M') {
      pos = at(n(), n());
      start = pos;
      cur = { segs: [], closed: false };
      subs.push(cur);
      cmd = rel ? 'l' : 'L';
      lastCtrl = null;
      continue;
    }
    if (!cur) return null;
    let seg: Seg;
    if (C === 'L' || C === 'H' || C === 'V') {
      const p1: P = C === 'L' ? at(n(), n()) : C === 'H' ? [rel ? pos[0] + n() : n(), pos[1]] : [pos[0], rel ? pos[1] + n() : n()];
      seg = { kind: 'L', p0: pos, c1: pos, c2: p1, p1 };
      lastCtrl = null;
    } else if (C === 'C' || C === 'S') {
      const c1: P = C === 'C' ? at(n(), n()) : lastCtrl ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]] : pos;
      const c2 = at(n(), n());
      const p1 = at(n(), n());
      seg = { kind: 'C', p0: pos, c1, c2, p1 };
      lastCtrl = c2;
    } else if (C === 'Q' || C === 'T') {
      const q: P = C === 'Q' ? at(n(), n()) : lastCtrl ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]] : pos;
      const p1 = at(n(), n());
      // Quadratique → cubique exacte.
      seg = { kind: 'C', p0: pos, c1: lerp(pos, q, 2 / 3), c2: lerp(p1, q, 2 / 3), p1 };
      lastCtrl = q;
    } else return null;
    cur.segs.push(seg);
    pos = seg.p1;
  }
  return subs;
}

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const len = (v: P) => Math.hypot(v[0], v[1]);
const norm = (v: P): P => {
  const l = len(v);
  return l ? [v[0] / l, v[1] / l] : [0, 0];
};

/** Tangente sortante au début d'un segment, entrante à sa fin. */
const outTangent = (s: Seg): P => norm(len(sub(s.c1, s.p0)) > 1e-6 ? sub(s.c1, s.p0) : sub(s.c2, s.p0));
const inTangent = (s: Seg): P => norm(len(sub(s.p1, s.c2)) > 1e-6 ? sub(s.p1, s.c2) : sub(s.p1, s.c1));

const angleBetween = (a: P, b: P) => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) * 180) / Math.PI;

/** Un raccord « presque lisse » : ni lisse, ni angle voulu. */
export const KINK_RANGE: [number, number] = [2, 20];

function joints(sp: SubPath): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 1; k < sp.segs.length; k++) out.push([k - 1, k]);
  if (sp.closed && sp.segs.length > 1) out.push([sp.segs.length - 1, 0]);
  return out;
}

/** Nombre de raccords « presque lisses » d'un tracé (0 si illisible). */
export function countKinks(d: string): number {
  const subs = parsePath(d);
  if (!subs) return 0;
  let count = 0;
  for (const sp of subs)
    for (const [a, b] of joints(sp)) {
      const ang = angleBetween(inTangent(sp.segs[a]), outTangent(sp.segs[b]));
      if (ang > KINK_RANGE[0] && ang < KINK_RANGE[1]) count++;
    }
  return count;
}

const f = (v: number) => Math.round(v * 1000) / 1000;

function emit(subs: SubPath[]): string {
  let d = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    d += `M${f(sp.segs[0].p0[0])} ${f(sp.segs[0].p0[1])}`;
    sp.segs.forEach((s, i) => {
      // Le segment de fermeture implicite (ajouté pour Z) n'est pas réécrit.
      if (sp.closed && i === sp.segs.length - 1 && s.kind === 'L') return;
      d += s.kind === 'L' ? `L${f(s.p1[0])} ${f(s.p1[1])}` : `C${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(s.p1[0])} ${f(s.p1[1])}`;
    });
    if (sp.closed) d += 'Z';
  }
  return d;
}

/**
 * Rend G1 les raccords « presque lisses » entre deux courbes : les deux poignées s'alignent sur la
 * bissectrice des tangentes, chacune garde sa longueur. Une droite n'a pas de poignée : un raccord
 * qui en touche une reste tel quel. Renvoie le tracé d'origine s'il n'y a rien à faire.
 */
export function smoothKinks(d: string): { d: string; fixed: number } {
  const subs = parsePath(d);
  if (!subs) return { d, fixed: 0 };
  let fixed = 0;
  for (const sp of subs)
    for (const [a, b] of joints(sp)) {
      const sa = sp.segs[a];
      const sb = sp.segs[b];
      if (sa.kind !== 'C' || sb.kind !== 'C') continue;
      const tin = inTangent(sa);
      const tout = outTangent(sb);
      const ang = angleBetween(tin, tout);
      if (!(ang > KINK_RANGE[0] && ang < KINK_RANGE[1])) continue;
      const dir = norm([tin[0] + tout[0], tin[1] + tout[1]]);
      const joint = sb.p0;
      const la = len(sub(sa.p1, sa.c2));
      const lb = len(sub(sb.c1, sb.p0));
      sa.c2 = [joint[0] - dir[0] * la, joint[1] - dir[1] * la];
      sb.c1 = [joint[0] + dir[0] * lb, joint[1] + dir[1] * lb];
      fixed++;
    }
  return fixed ? { d: emit(subs), fixed } : { d, fixed: 0 };
}
