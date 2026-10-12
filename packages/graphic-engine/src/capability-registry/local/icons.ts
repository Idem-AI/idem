/**
 * Les ICÔNES LOCALES (niveau « local » du registre) : Tabler (MIT, ~5 000 icônes au trait) et Lucide (ISC),
 * lues dans `node_modules`, sans réseau. Une icône est posée au trait, à l'encre de texte du fond où elle
 * se trouve ; elle est décorative (`aria-hidden`) : le mot voisin porte le sens.
 */
import fs from 'fs';
import path from 'path';

export type IconSet = 'tabler' | 'lucide';

const SET_DIRS: Record<IconSet, string[]> = {
  tabler: ['@tabler/icons/icons/outline'],
  lucide: ['lucide-static/icons'],
};

const cache = new Map<string, string | null>();
let roots: string[] | null = null;

/** Les dossiers `node_modules` au-dessus du paquet (monorepo : la racine porte les dépendances). */
function nodeModules(): string[] {
  if (roots) return roots;
  const out: string[] = [];
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const nm = path.join(dir, 'node_modules');
    if (fs.existsSync(nm)) out.push(nm);
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  roots = out;
  return out;
}

export function iconDir(set: IconSet): string | null {
  for (const nm of nodeModules()) for (const rel of SET_DIRS[set]) {
    const dir = path.join(nm, rel);
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

export const iconSetAvailable = (set: IconSet): boolean => iconDir(set) !== null;

/** Le SVG d'une icône, nettoyé (aucun script, aucun gestionnaire d'évènement), ou `null`. */
export function iconSvg(name: string, set: IconSet = 'tabler'): string | null {
  const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const key = `${set}:${safe}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const dir = iconDir(set);
  const file = dir ? path.join(dir, `${safe}.svg`) : '';
  let svg: string | null = null;
  if (file && fs.existsSync(file)) {
    svg = fs
      .readFileSync(file, 'utf8')
      .replace(/<\?xml[^>]*>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace(/\sclass="[^"]*"/g, '')
      .trim();
  }
  cache.set(key, svg);
  return svg;
}

/** Recherche par mots du nom de fichier (« coffee », « chart bar ») : les noms d'icônes, les plus courts d'abord. */
export function searchIcons(query: string, set: IconSet = 'tabler', limit = 12): string[] {
  const dir = iconDir(set);
  if (!dir) return [];
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4))
    .filter((n) => words.every((w) => n.includes(w)))
    .sort((a, b) => a.length - b.length)
    .slice(0, limit);
}

export function iconCount(set: IconSet): number {
  const dir = iconDir(set);
  return dir ? fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).length : 0;
}
