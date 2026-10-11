/**
 * MODULE D — MASCOTTES : des personnages construits à partir de formes réutilisables et d'une
 * règle de style unique (aplats, yeux et bouche en découpe, pas de dégradé, pas de contour fin).
 *
 * Une mascotte est une tête (ou un buste) assemblée à partir de : silhouette, oreilles/crinière,
 * museau, yeux, bouche. Chaque espèce est un générateur ; l'humeur (`mood`) et les accessoires
 * sont des paramètres communs : la même famille de règles garantit qu'aucune mascotte ne
 * « détonne » à côté d'une autre, et que chacune reste lisible à 32 px.
 */
import type { GeometryKernel } from '../../kernel/geometry';
import { arcBandPath, circlePath, ellipsePath, linePath, polar, polyPath, rectPath } from '../../kernel/primitives';
import type { Pt } from '../../kernel/primitives';
import { combineD, mirrored, rotated } from './abstract';
import { bool, GenPart, num, opt, register, Tone } from './registry';

const part = (d: string, tone: Tone = 'a'): GenPart => ({ d, tone });
const cut = (d: string): GenPart => ({ d, tone: 'knockout' });

const MOODS = ['happy', 'calm', 'wink', 'bold'] as const;

/** Paire d'yeux symétriques ; l'humeur règle leur forme. `ink` : la couleur de la pupille quand l'œil est plein. */
function eyes(k: GeometryKernel, cx: number, cy: number, gap: number, size: number, mood: string): GenPart[] {
  const out: GenPart[] = [];
  const left: Pt = [cx - gap, cy];
  const right: Pt = [cx + gap, cy];
  const open = (p: Pt) => cut(ellipsePath(p[0], p[1], size, size * (mood === 'calm' ? 0.55 : mood === 'bold' ? 0.8 : 1.05)));
  out.push(open(left));
  if (mood === 'wink') out.push(cut(arcBandPath(right[0], right[1] + size * 0.5, size * 1.1, size * 0.45, -80, 80, true)));
  else out.push(open(right));
  if (mood === 'bold') {
    // sourcils inclinés vers le centre
    out.push(cut(linePath(left[0] - size * 1.4, cy - size * 1.9, left[0] + size * 1.2, cy - size * 1.2, size * 0.5, true)));
    out.push(cut(linePath(right[0] + size * 1.4, cy - size * 1.9, right[0] - size * 1.2, cy - size * 1.2, size * 0.5, true)));
  }
  void k;
  return out;
}

/** Sourire : un arc de bande à bouts ronds. */
const smile = (cx: number, cy: number, r: number, mood: string): GenPart[] =>
  mood === 'calm' ? [cut(linePath(cx - r * 0.7, cy, cx + r * 0.7, cy, r * 0.22, true))] : [cut(arcBandPath(cx, cy - r * 0.55, r, r * 0.24, 125, 235, true))];

register({
  id: 'lion',
  label: 'Lion',
  family: 'mascot',
  tags: ['lion', 'roi', 'king', 'force', 'strength', 'courage', 'leader', 'afrique', 'africa', 'fierté', 'pride', 'sport', 'banque', 'assurance', 'savane', 'sécurité', 'autorité', 'équipe'],
  tones: 3,
  params: { mood: opt(MOODS), mane: num(10, 16, 12, true), fullness: num(0.8, 1.2, 1), nose: bool(true) },
  build: (p, { kernel: k }) => {
    const n = p.mane as number;
    const R = 31 * (p.fullness as number);
    let mane = circlePath(50, 52, R);
    for (let i = 0; i < n; i++) {
      const [x, y] = polar(50, 52, R, (360 / n) * i);
      mane = combineD(k, 'union', mane, circlePath(x, y, 11.5));
    }
    const mood = p.mood as string;
    const parts: GenPart[] = [part(mane, 'a'), part(circlePath(50, 54, 24), 'c'), part(circlePath(30, 33, 7), 'c'), part(circlePath(70, 33, 7), 'c')];
    parts.push(cut(circlePath(30, 33, 3.4)), cut(circlePath(70, 33, 3.4)));
    parts.push(...eyes(k, 50, 50, 10, 3.6, mood));
    if (p.nose) parts.push(part(polyPath([[44, 59], [56, 59], [50, 66]], 1.5), 'a'));
    parts.push(...smile(50, 71, 9, mood));
    return parts;
  },
});

register({
  id: 'owl',
  label: 'Hibou',
  family: 'mascot',
  tags: ['hibou', 'owl', 'sagesse', 'wisdom', 'savoir', 'knowledge', 'éducation', 'education', 'nuit', 'night', 'conseil', 'consulting', 'juridique', 'legal', 'lecture', 'formation', 'mentor', 'recherche', 'école', 'tutorat'],
  tones: 3,
  params: { mood: opt(MOODS), tufts: bool(true), belly: opt(['chevrons', 'dots', 'none']) },
  build: (p, { kernel: k }) => {
    const mood = p.mood as string;
    const body = 'M50 6C26 6 12 22 12 46C12 74 28 94 50 94C72 94 88 74 88 46C88 22 74 6 50 6Z';
    const parts: GenPart[] = [part(body, 'a')];
    if (p.tufts) parts.push(part(polyPath([[16, 24], [14, 4], [34, 14]], 1.5), 'a'), part(polyPath([[84, 24], [86, 4], [66, 14]], 1.5), 'a'));
    parts.push(part(circlePath(34, 40, 17), 'b'), part(circlePath(66, 40, 17), 'b'));
    parts.push(cut(circlePath(34, 40, 12)), cut(circlePath(66, 40, 12)));
    const pupil = mood === 'calm' ? 4.2 : mood === 'bold' ? 7 : 6;
    parts.push(part(circlePath(34, 40, pupil), 'a'), part(circlePath(66, 40, pupil), 'a'));
    if (mood === 'wink') parts.push(cut(circlePath(66, 40, 12.5)), part(arcBandPath(66, 44, 10, 3.4, -80, 80, true), 'a'));
    parts.push(part(polyPath([[44, 52], [56, 52], [50, 64]], 1.5), 'c'));
    if (p.belly === 'chevrons') for (let i = 0; i < 3; i++) parts.push(cut(arcBandPath(50, 70 + i * 8 - 12, 14, 3, 140, 220, true)));
    if (p.belly === 'dots') for (const [x, y] of [[40, 74], [50, 70], [60, 74], [45, 84], [55, 84]] as Pt[]) parts.push(cut(circlePath(x, y, 2.4)));
    void k;
    return parts;
  },
});

register({
  id: 'cat',
  label: 'Chat',
  family: 'mascot',
  tags: ['chat', 'cat', 'félin', 'agile', 'agilité', 'curieux', 'curiosity', 'indépendant', 'animal', 'pets', 'créatif', 'creative', 'studio', 'jeu', 'game', 'malin', 'café', 'mode', 'tech'],
  tones: 3,
  params: { mood: opt(MOODS), whiskers: bool(true), ears: num(0.7, 1.3, 1), collar: bool(false) },
  build: (p, { kernel: k }) => {
    const mood = p.mood as string;
    const e = p.ears as number;
    const parts: GenPart[] = [
      part(polyPath([[14, 46], [16 + 2, 46 - 40 * e], [44, 20]], 3), 'a'),
      part(polyPath([[86, 46], [84 - 2, 46 - 40 * e], [56, 20]], 3), 'a'),
      part(ellipsePath(50, 56, 38, 34), 'a'),
      part(polyPath([[22, 40], [22, 40 - 18 * e], [38, 28]], 1.5), 'c'),
      part(polyPath([[78, 40], [78, 40 - 18 * e], [62, 28]], 1.5), 'c'),
    ];
    parts.push(...eyes(k, 50, 52, 15, 4.6, mood));
    parts.push(part(polyPath([[45, 62], [55, 62], [50, 68]], 1.5), 'c'));
    parts.push(...smile(50, 76, 7, mood === 'calm' ? 'calm' : 'happy'));
    if (p.whiskers) for (const s of [-1, 1]) for (const dy of [-3, 3]) parts.push(cut(linePath(50 + s * 22, 64 + dy, 50 + s * 38, 64 + dy * 2.2, 1.7, true)));
    if (p.collar) parts.push(part(rectPath(26, 86, 48, 7, 3.5), 'c'));
    return parts;
  },
});

register({
  id: 'bear',
  label: 'Ours',
  family: 'mascot',
  tags: ['ours', 'bear', 'câlin', 'doux', 'friendly', 'enfant', 'kids', 'famille', 'family', 'miel', 'honey', 'jouet', 'toy', 'garderie', 'crèche', 'protecteur', 'chaleureux', 'boulangerie', 'assurance'],
  tones: 3,
  params: { mood: opt(MOODS), ears: num(0.8, 1.3, 1), muzzle: bool(true), bowtie: bool(false) },
  build: (p, { kernel: k }) => {
    const mood = p.mood as string;
    const er = 13 * (p.ears as number);
    const parts: GenPart[] = [part(circlePath(24, 24, er), 'a'), part(circlePath(76, 24, er), 'a'), part(circlePath(50, 54, 38), 'a'), part(circlePath(24, 24, er * 0.5), 'c'), part(circlePath(76, 24, er * 0.5), 'c')];
    if (p.muzzle) parts.push(part(ellipsePath(50, 66, 17, 13), 'c'));
    parts.push(...eyes(k, 50, 48, 14, 3.8, mood));
    parts.push(part(polyPath([[44, 59], [56, 59], [50, 66]], 3), 'a'));
    parts.push(...smile(50, 74, 7, mood).map((q) => ({ ...q, tone: p.muzzle ? ('a' as Tone) : q.tone })));
    if (p.bowtie) parts.push(part(polyPath([[50, 94], [30, 86], [30, 100], [50, 94], [70, 86], [70, 100]]), 'b'));
    return parts;
  },
});

register({
  id: 'elephant',
  label: 'Éléphant',
  family: 'mascot',
  tags: ['éléphant', 'elephant', 'mémoire', 'memory', 'sagesse', 'force', 'strength', 'afrique', 'africa', 'savane', 'safari', 'fiabilité', 'reliable', 'durable', 'long terme', 'banque', 'logistique', 'transport', 'ong', 'protection'],
  tones: 3,
  params: { mood: opt(MOODS), trunk: opt(['curl', 'down']), tusks: bool(true) },
  build: (p, { kernel: k }) => {
    const mood = p.mood as string;
    const parts: GenPart[] = [
      part(ellipsePath(17, 44, 17, 30), 'b'),
      part(ellipsePath(83, 44, 17, 30), 'b'),
      part(ellipsePath(17, 46, 9, 19), 'c'),
      part(ellipsePath(83, 46, 9, 19), 'c'),
      part(circlePath(50, 42, 30), 'a'),
    ];
    parts.push(...eyes(k, 50, 36, 14, 3.8, mood));
    const trunk = p.trunk === 'curl' ? 'M37 56C37 74 38 82 44 90C49 96 60 95 60 87C60 81 53 82 53 76C53 68 63 66 63 56Z' : 'M38 56C38 74 40 86 43 94C44 98 55 98 56 94C58 86 62 74 62 56Z';
    parts.push(part(trunk, 'a'), cut(linePath(43, 68, 54, 68, 1.6, true)), cut(linePath(43, 76, 53, 76, 1.6, true)));
    if (p.tusks) parts.push(part(polyPath([[30, 60], [18, 82], [27, 82], [38, 64]], 1.5), 'c'), part(polyPath([[70, 60], [82, 82], [73, 82], [62, 64]], 1.5), 'c'));
    return parts;
  },
});

register({
  id: 'bird',
  label: 'Oiseau',
  family: 'mascot',
  tags: ['oiseau', 'bird', 'liberté', 'freedom', 'message', 'tweet', 'voyage', 'travel', 'vol', 'flight', 'léger', 'légèreté', 'chant', 'musique', 'social', 'communication', 'nature', 'rapide', 'coursier', 'courrier'],
  tones: 3,
  params: { mood: opt(MOODS), crest: bool(true), tail: num(0.7, 1.3, 1) },
  build: (p, { kernel: k }) => {
    const t = p.tail as number;
    const parts: GenPart[] = [part(polyPath([[22, 62], [2 + (1 - t) * 8, 40 - 8 * t], [4, 70]], 2), 'b'), part(ellipsePath(50, 58, 34, 30), 'a'), part(circlePath(66, 36, 22), 'a')];
    if (p.crest) parts.push(part(polyPath([[58, 18], [62, 3], [70, 16]], 1.2), 'c'), part(polyPath([[66, 16], [76, 4], [78, 18]], 1.2), 'c'));
    parts.push(part(polyPath([[84, 30], [99, 38], [84, 46]], 1.5), 'c'));
    parts.push(part(ellipsePath(44, 62, 20, 12), 'b'));
    parts.push(cut(circlePath(68, 33, 5)));
    void k;
    return parts;
  },
});

register({
  id: 'fox',
  label: 'Renard',
  family: 'mascot',
  tags: ['renard', 'fox', 'malin', 'smart', 'rusé', 'astucieux', 'clever', 'startup', 'tech', 'conseil', 'agilité', 'agile', 'marketing', 'créatif', 'jeu', 'vif', 'innovation', 'ruse'],
  tones: 3,
  params: { mood: opt(MOODS), ears: num(0.8, 1.3, 1) },
  build: (p, { kernel: k }) => {
    const mood = p.mood as string;
    const e = p.ears as number;
    const head = polyPath([[8, 38], [50, 96], [92, 38], [78, 32], [50, 40], [22, 32]], 4);
    const parts: GenPart[] = [
      part(polyPath([[8, 40], [10, 4 + (1 - e) * 10], [40, 30]], 2), 'a'),
      part(polyPath([[92, 40], [90, 4 + (1 - e) * 10], [60, 30]], 2), 'a'),
      part(head, 'a'),
      part(polyPath([[16, 38], [16, 18], [32, 32]], 1), 'c'),
      part(polyPath([[84, 38], [84, 18], [68, 32]], 1), 'c'),
      part(polyPath([[12, 56], [50, 96], [88, 56], [64, 58], [50, 72], [36, 58]], 3), 'b'),
    ];
    parts.push(...eyes(k, 50, 44, 15, 4.4, mood));
    parts.push(part(circlePath(50, 91, 4.2), 'c'));
    return parts;
  },
});

register({
  id: 'robot',
  label: 'Robot',
  family: 'mascot',
  tags: ['robot', 'tech', 'ia', 'ai', 'automatisation', 'automation', 'innovation', 'saas', 'startup', 'futur', 'future', 'numérique', 'digital', 'cloud', 'assistant', 'chatbot', 'data', 'logiciel', 'fintech'],
  tones: 3,
  params: { mood: opt(MOODS), antenna: bool(true), ears: bool(true), screen: opt(['eyes', 'visor']) },
  build: (p, { kernel: k }) => {
    const mood = p.mood as string;
    const parts: GenPart[] = [part(rectPath(14, 24, 72, 62, 18), 'a')];
    if (p.antenna) parts.push(part(linePath(50, 24, 50, 10, 4, true), 'b'), part(circlePath(50, 9, 5.5), 'c'));
    if (p.ears) parts.push(part(rectPath(4, 44, 10, 22, 4), 'b'), part(rectPath(86, 44, 10, 22, 4), 'b'));
    if (p.screen === 'visor') parts.push(cut(rectPath(24, 38, 52, 22, 11)), part(rectPath(30, 45, 12, 8, 4), 'c'), part(rectPath(58, 45, 12, 8, 4), 'c'));
    else parts.push(...eyes(k, 50, 50, 15, 5.5, mood));
    parts.push(...smile(50, 76, 9, mood === 'wink' ? 'happy' : mood));
    return parts;
  },
});

export const _mascotHelpers = { mirrored, rotated };
