/**
 * LA RÉUTILISATION DU CODE DÉJÀ ÉCRIT — des fonctions, jamais des compositions.
 *
 * Les scènes des vidéos précédentes de la marque sont gardées avec leur code. Une scène peut y
 * avoir défini des fonctions auxiliaires (une révélation de mots, un compteur, un tracé…) : elles
 * sont proposées à l'auteur d'une nouvelle scène quand leur nom ou leur commentaire rejoint son
 * idée de mouvement. Il les recopie s'il veut, les adapte ou les ignore.
 */
import type { MotionVideo } from '../contracts/model';

export interface CodeSnippet {
  name: string;
  /** Le commentaire qui précède la fonction (ce qu'elle fait). */
  doc: string;
  code: string;
}

/** Les fonctions de premier niveau d'un fichier de scène (hors `export default`), avec leur commentaire. */
export function extractHelpers(code: string): CodeSnippet[] {
  const out: CodeSnippet[] = [];
  const re = /((?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*)(?:export\s+)?function\*?\s+([A-Za-z_]\w*)\s*\(/g;
  for (const m of code.matchAll(re)) {
    const at = (m.index ?? 0) + m[1].length;
    if (/export\s+default/.test(code.slice(Math.max(0, at - 20), at + 20))) continue;
    // Le corps : jusqu'à l'accolade fermante correspondante.
    const open = code.indexOf('{', at);
    if (open < 0) continue;
    let depth = 0;
    let end = -1;
    for (let i = open; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}' && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    if (end < 0 || end - at > 2500) continue;
    out.push({ name: m[2], doc: m[1].replace(/\/\/|\/\*|\*\//g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200), code: code.slice(at, end) });
  }
  return out;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (s: string) => new Set(fold(s).replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^a-z0-9]+/).filter((w) => w.length > 3));

/** Les fonctions des vidéos de la marque les plus proches de l'idée de la scène (au plus `max`). */
export function pickSnippets(videos: MotionVideo[], idea: string, max = 2): CodeSnippet[] {
  const want = tokens(idea);
  if (!want.size) return [];
  const seen = new Set<string>();
  const scored: { s: CodeSnippet; score: number }[] = [];
  for (const v of videos) {
    for (const scene of v.film?.scenes || []) {
      if (!scene.code || scene.status !== 'ready') continue;
      for (const s of extractHelpers(scene.code)) {
        if (seen.has(s.name)) continue;
        seen.add(s.name);
        const have = tokens(`${s.name.replace(/([a-z])([A-Z])/g, '$1 $2')} ${s.doc}`);
        const score = [...have].filter((w) => want.has(w)).length;
        if (score > 0) scored.push({ s, score });
      }
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.s);
}
