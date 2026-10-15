/**
 * LES EXEMPLES DONNÉS À L'AUTEUR — de courtes scènes exécutables (`motion/examples/*.tsx`), choisies
 * par pertinence pour la scène à écrire.
 *
 * Ce ne sont pas des gabarits : l'auteur y lit COMMENT écrire du Motion Canvas correct (refs, temps,
 * contexte, kit), pas à quoi sa scène doit ressembler. Chacun est compilé et rendu par `check:motion`.
 */
import fs from 'fs';
import path from 'path';
import { MOTION_ROOT } from '../rendering/compiler';

export interface MotionExample {
  id: string;
  tags: string[];
  shows: string;
  code: string;
}

let cache: MotionExample[] | null = null;

export function loadExamples(): MotionExample[] {
  if (cache) return cache;
  const dir = path.join(MOTION_ROOT, 'examples');
  cache = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .sort()
    .map((f) => {
      const code = fs.readFileSync(path.join(dir, f), 'utf8');
      return {
        id: code.match(/@example\s+([\w-]+)/)?.[1] || f.replace('.tsx', ''),
        tags: (code.match(/@tags\s+(.+)/)?.[1] || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        shows: code.match(/@shows\s+(.+)/)?.[1]?.trim() || '',
        // Les lignes d'en-tête (@example, @tags) ne servent qu'à l'index.
        code: code.replace(/^\/\/ @(example|tags).*\n/gm, '').trim(),
      };
    });
  return cache;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Les `count` exemples les plus proches de la scène : mots de son intention et de ses idées
 * (visuel, mouvement), types de médias. Toujours au moins un (celui de la typographie à défaut).
 */
export function pickExamples(scene: { purpose: string; visual: string; motion: string; transition?: string; mediaKinds: string[]; first: boolean; last: boolean }, count: number): MotionExample[] {
  const all = loadExamples();
  const text = fold([scene.purpose, scene.visual, scene.motion, scene.transition || ''].join(' '));
  const scored = all.map((ex) => {
    let score = ex.tags.reduce((s, tag) => s + (text.includes(fold(tag)) ? 2 : 0), 0);
    if (scene.mediaKinds.includes('video') && ex.tags.includes('video')) score += 4;
    if (scene.mediaKinds.includes('image') && ex.tags.includes('image')) score += 3;
    if (scene.last && ex.tags.includes('logo')) score += 3;
    if (!scene.first && scene.transition && ex.tags.includes('transition')) score += 1;
    return { ex, score };
  });
  scored.sort((a, b) => b.score - a.score || a.ex.id.localeCompare(b.ex.id));
  const picked = scored.filter((s) => s.score > 0).slice(0, count).map((s) => s.ex);
  if (!picked.length) picked.push(all.find((e) => e.id === 'typography') || all[0]);
  return picked;
}
