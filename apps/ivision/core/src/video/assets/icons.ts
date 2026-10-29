/**
 * LES ICÔNES DES SCÈNES — le catalogue Lucide (ISC), indexé par mots-clés.
 *
 *   resolve   un nom d'icône → ses tracés (cercles, rectangles, lignes, polygones convertis en chemins SVG), dans la
 *             grille 24 × 24 de Lucide ; un nom approchant est accepté s'il est sans ambiguïté (« chart-bar » → « bar-chart ») ;
 *   menu      les icônes dont les mots-clés rejoignent la scène : un court menu proposé à l'auteur (une recherche,
 *             comme une banque d'images — jamais une lecture de la demande).
 *
 * Le langage reçoit un nœud `icon` ; la validation le développe en tracé (`dsl/validate.ts`, `scalePath`).
 */
import fs from 'fs';
import path from 'path';
import type { ResolvedIcon } from '../../../../../../packages/motion-compiler/src';

type IconNode = [string, Record<string, string>];
let nodes: Record<string, IconNode[]> | null = null;
let tags: Record<string, string[]> | null = null;

function lucideDir(): string | null {
  try {
    return path.dirname(require.resolve('lucide-static/package.json'));
  } catch {
    return null;
  }
}

function load(): Record<string, IconNode[]> {
  if (nodes) return nodes;
  const dir = lucideDir();
  try {
    nodes = dir ? (JSON.parse(fs.readFileSync(path.join(dir, 'icon-nodes.json'), 'utf8')) as Record<string, IconNode[]>) : {};
  } catch {
    nodes = {};
  }
  return nodes;
}

function loadTags(): Record<string, string[]> {
  if (tags) return tags;
  const dir = lucideDir();
  try {
    tags = dir ? (JSON.parse(fs.readFileSync(path.join(dir, 'tags.json'), 'utf8')) as Record<string, string[]>) : {};
  } catch {
    tags = {};
  }
  return tags;
}

const n = (v: string | undefined, d = 0) => (v === undefined ? d : Number(v));

/** Un élément SVG simple → données de chemin. */
function toPath([tag, a]: IconNode): string | null {
  switch (tag) {
    case 'path':
      return a.d || null;
    case 'circle': {
      const cx = n(a.cx), cy = n(a.cy), r = n(a.r);
      return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case 'ellipse': {
      const cx = n(a.cx), cy = n(a.cy), rx = n(a.rx), ry = n(a.ry);
      return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    case 'rect': {
      const x = n(a.x), y = n(a.y), w = n(a.width), h = n(a.height), r = Math.min(n(a.rx, n(a.ry)), w / 2, h / 2);
      if (!r) return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
      return `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
    }
    case 'line':
      return `M${n(a.x1)} ${n(a.y1)} L${n(a.x2)} ${n(a.y2)}`;
    case 'polyline':
    case 'polygon': {
      const pts = String(a.points || '').trim().split(/[\s,]+/).map(Number);
      if (pts.length < 4) return null;
      const pairs: string[] = [];
      for (let i = 0; i + 1 < pts.length; i += 2) pairs.push(`${pts[i]} ${pts[i + 1]}`);
      return `M${pairs.join(' L')}${tag === 'polygon' ? ' Z' : ''}`;
    }
    default:
      return null;
  }
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Le vrai nom d'une icône (exact, mots inversés, ou à deux lettres près s'il n'y en a qu'un), ou null. */
export function iconName(raw: string): string | null {
  const all = load();
  const want = String(raw || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (!want) return null;
  if (all[want]) return want;
  const swapped = want.split('-').reverse().join('-');
  if (all[swapped]) return swapped;
  const close = Object.keys(all).filter((k) => Math.abs(k.length - want.length) <= 2 && distance(k, want) <= 2);
  return close.length === 1 ? close[0] : null;
}

/** Les tracés d'une icône (grille 24 × 24), ou null. */
export function resolveIcon(raw: string): ResolvedIcon | null {
  const name = iconName(raw);
  if (!name) return null;
  const paths = (load()[name] || []).map(toPath).filter((d): d is string => !!d);
  return paths.length ? { paths, box: 24 } : null;
}

/** Un court menu d'icônes pour une scène : celles dont le nom ou les mots-clés rejoignent les mots donnés. */
export function iconMenu(words: string, k = 12): string[] {
  const t = loadTags();
  const q = new Set(String(words || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  if (!q.size) return [];
  const scored = Object.keys(load()).map((name) => {
    const bag = [...name.split('-'), ...(t[name] || [])].map((w) => w.toLowerCase());
    return { name, s: bag.filter((w) => q.has(w)).length + (name.split('-').some((w) => q.has(w)) ? 1 : 0) };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.name.length - b.name.length).slice(0, k).map((x) => x.name);
}
