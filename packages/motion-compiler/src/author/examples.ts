/**
 * LES EXEMPLES DE PROGRAMMES — des techniques correctes, jamais des gabarits.
 *
 * Chacun montre une façon de combiner les primitives (découpe en mots, répétition sur des données,
 * masque qui s'ouvre, travelling d'un média, tracé qui se dessine, caméra `world`). Le contexte de
 * l'auteur en joint deux, choisis par les mots de la scène — comme les exemples TSX de l'auteur actuel.
 * `npm run check` les valide, les compile et les exécute dans Motion Canvas.
 */
import type { MotionProgram } from '../dsl/types';

export interface ProgramExample {
  id: string;
  tags: string[];
  shows: string;
  /** Textes et médias que l'exemple suppose (pour le contrôle). */
  texts: string[];
  media: ('image' | 'video')[];
  program: MotionProgram;
}

export const PROGRAM_EXAMPLES: ProgramExample[] = [
  {
    id: 'kinetic-title',
    tags: ['text', 'title', 'headline', 'kinetic', 'typography', 'words', 'stagger', 'reveal', 'opening'],
    shows: 'titre découpé en mots qui montent un par un (split + stagger), trait qui se dessine (end 0→1), sous-titre qui glisse, léger travelling de toute la scène (world, dur "D") ; positions en fractions de la zone sûre (tous formats)',
    texts: ['headline', 'sub'],
    media: [],
    program: {
      bg: 'background',
      nodes: [
        { id: 'bar', type: 'rect', x: 'L', y: 'T', w: 1.6, h: 0, anchor: 'top-left', fill: 'accent' },
        { id: 'title', type: 'text', text: '$headline', split: 'words', x: 0, y: 'pick(-SH*0.08, -SH*0.12)', width: 'SW', size: 'pick(13, 11)', weight: 800, align: 'left', color: 'ink' },
        { id: 'rule', type: 'line', points: [['L', 'pick(SH*0.06, SH*0.1)'], ['L+SW*0.3', 'pick(SH*0.06, SH*0.1)']], stroke: 'accent', lineWidth: 1.2, end: 0 },
        { id: 'sub', type: 'text', text: '$sub', font: 'body', x: 0, y: 'pick(SH*0.13, SH*0.22)', width: 'SW', size: 4.6, align: 'left', color: 'ink/80' },
      ],
      timeline: [
        { at: 0, target: 'bar', dur: 0.7, ease: 'outExpo', to: { h: 'SH*0.25' } },
        { at: 0.15, target: 'title.*', dur: 0.55, ease: 'outBack', stagger: 0.07, from: { opacity: 0, y: '+=6', rotation: 4 }, to: { opacity: 1, rotation: 0 } },
        { at: 0.9, sfx: 'softwhoosh' },
        { at: 0.9, target: 'rule', dur: 0.6, ease: 'outCubic', to: { end: 1 } },
        { at: 1.1, target: 'sub', dur: 0.6, from: { opacity: 0, x: '-=8' }, to: {} },
        { at: 0, target: 'world', dur: 'D', ease: 'linear', to: { scale: 1.04 } },
      ],
    },
  },
  {
    id: 'data-bars',
    tags: ['data', 'chart', 'number', 'figure', 'stat', 'bars', 'infographic', 'counter', 'percent', 'growth'],
    shows: 'chiffre qui défile (effect count) et son étiquette groupés dans une pile (jamais de chevauchement), barres répétées sur des données qui poussent depuis leur base (repeat + data + anchor bottom + stagger) ; à côté en paysage, dessous en vertical (pick)',
    texts: ['figure', 'label'],
    media: [],
    program: {
      bg: 'background',
      nodes: [
        { id: 'head', type: 'stack', dir: 'column', gap: 1.5, x: 'pick(0, L+SW*0.22)', y: 'pick(T+SH*0.18, 0)', children: [
          { id: 'figure', type: 'text', text: '$figure', size: 'pick(16, 13)', width: 'pick(SW, SW*0.42)', weight: 800, color: 'primary' },
          { id: 'label', type: 'text', text: '$label', font: 'body', size: 4.6, width: 'pick(SW, SW*0.42)', color: 'ink' },
        ] },
        {
          id: 'bars', type: 'repeat', data: [0.35, 0.55, 0.72, 1], layout: 'row', w: 'pick(SW*0.8, SW*0.45)', x: 'pick(0, SW*0.25)', y: 'B-4',
          item: { type: 'rect', w: 'pick(12, 8)', h: 'v*pick(SH*0.4, SH*0.75)', anchor: 'bottom', radius: 1.5, fill: 'secondary' },
        },
      ],
      timeline: [
        { at: 0, target: 'head', dur: 0.5, from: { opacity: 0, scale: 0.94 }, to: {} },
        { at: 0, target: 'figure', effect: 'count', dur: 1.4, ease: 'outCubic' },
        { at: 0.3, target: 'bars.*', dur: 0.8, ease: 'outCubic', stagger: 0.12, from: { scaleY: 0 }, to: { scaleY: 1 } },
        { at: 1.2, target: 'bars.3', dur: 0.4, to: { fill: 'accent' } },
        { at: 1.2, sfx: 'pop' },
      ],
    },
  },
  {
    id: 'photo-reveal',
    tags: ['image', 'photo', 'media', 'product', 'picture', 'ken burns', 'mask', 'cover', 'crop', 'caption'],
    shows: 'photo dans un cadre qui s\'ouvre (h 0→plein), lent travelling avant (zoom, dur "D"), légende à côté en paysage et dessous en vertical (pick), bloc de couleur décalé',
    texts: ['caption'],
    media: ['image'],
    program: {
      bg: 'background',
      nodes: [
        { id: 'block', type: 'rect', x: 'pick(3, -SW*0.17+3)', y: 'pick(-SH*0.1+3, 3)', w: 'pick(SW, SW*0.62)', h: 'pick(SH*0.58, SH)', radius: 3, fill: 'accent/25' },
        { id: 'photo', type: 'image', media: 0, x: 'pick(0, -SW*0.17)', y: 'pick(-SH*0.1, 0)', w: 'pick(SW, SW*0.62)', h: 'pick(SH*0.58, SH)', radius: 3, zoom: 1.15 },
        { id: 'caption', type: 'text', text: '$caption', x: 'pick(0, SW*0.33)', y: 'pick(SH*0.32, 0)', width: 'pick(SW, SW*0.32)', size: 7, lines: 3, align: 'left', color: 'ink' },
      ],
      timeline: [
        { at: 0, target: ['block', 'photo'], dur: 0.8, ease: 'outExpo', stagger: 0.1, from: { h: 0 }, to: {} },
        { at: 0, target: 'photo', dur: 'D', ease: 'linear', to: { zoom: 1 } },
        { at: 0.7, target: 'caption', dur: 0.6, ease: 'outCubic', from: { opacity: 0, y: '+=4' }, to: {} },
      ],
    },
  },
  {
    id: 'interface-focus',
    tags: ['interface', 'screen', 'screenshot', 'app', 'website', 'dashboard', 'ui', 'demo', 'device', 'cursor'],
    shows: 'capture d\'écran dans un cadre d\'appareil (rect arrondi + image contain), la caméra (world) s\'approche d\'une zone de l\'IMAGE, un halo qui pulse (repeat yoyo), une bulle de texte (stack avec fond) posée hors de la zone zoomée',
    texts: ['headline'],
    media: ['image'],
    program: {
      bg: 'secondary',
      nodes: [
        { id: 'device', type: 'rect', y: 'pick(SH*0.08, 4)', w: 'pick(SW, SW*0.78)', h: 'pick(SW*0.64, SW*0.5)', radius: 2.5, fill: 'white', shadow: { color: 'black/30', blur: 6, y: 2 }, children: [
          { type: 'image', media: 0, w: 'pick(SW-2, SW*0.78-2)', h: 'pick(SW*0.64-2, SW*0.5-2)', fit: 'contain', radius: 2 },
        ] },
        { id: 'halo', type: 'circle', x: 'pick(SW*0.2, SW*0.16)', y: 'pick(SH*0.08, 4)', size: 12, fill: 'transparent', stroke: 'accent', lineWidth: 0.8, opacity: 0 },
        { id: 'tip', type: 'stack', dir: 'row', x: 0, y: 'pick(T+SH*0.12, T+6)', padding: 2.4, radius: 6, fill: 'accent', children: [
          { type: 'text', text: '$headline', size: 4.4, weight: 700, color: 'on-accent' },
        ] },
      ],
      timeline: [
        { at: 0, target: 'device', dur: 0.8, ease: 'outBack', from: { scale: 0.85, opacity: 0 }, to: {} },
        { at: 0.9, target: 'world', dur: 1.2, ease: 'inOutCubic', to: { scale: 1.2, x: 'pick(-SW*0.2, -SW*0.16)*1.2' } },
        { at: 1.6, target: 'halo', dur: 0.6, to: { opacity: 1 } },
        { at: 1.6, target: 'halo', dur: 0.7, repeat: 'yoyo', to: { scale: 1.25 } },
        { at: 2.0, target: 'tip', dur: 0.5, ease: 'outBack', from: { opacity: 0, scale: 0.6 }, to: {} },
        { at: 2.0, sfx: 'click' },
      ],
    },
  },
  {
    id: 'logo-signature',
    tags: ['logo', 'brand', 'signature', 'end', 'closing', 'cta', 'outro', 'tagline', 'website'],
    shows: 'cercle qui se trace autour du logo (circle end 0→1), logo qui apparaît à l\'échelle, slogan et adresse groupés dans une pile sous le logo, slogan écrit lettre par lettre (effect type), formes répétées sur un cercle qui tournent lentement (repeat circle + loop) ; tailles rapportées au petit côté (tous formats)',
    texts: ['tagline', 'cta'],
    media: [],
    program: {
      bg: 'primary',
      enter: { type: 'fade', dur: 0.5 },
      nodes: [
        { id: 'dots', type: 'repeat', count: 12, layout: 'circle', r: 'min(SW, SH)*0.36', y: '-min(SW, SH)*0.1', item: { type: 'circle', size: 1.6, fill: 'on-primary/40' } },
        { id: 'ring', type: 'circle', y: '-min(SW, SH)*0.1', size: 'min(SW, SH)*0.5', fill: 'transparent', stroke: 'on-primary', lineWidth: 0.5, end: 0 },
        { id: 'logo', type: 'logo', y: '-min(SW, SH)*0.1', w: 'min(SW, SH)*0.3', on: 'primary' },
        { id: 'words', type: 'stack', dir: 'column', gap: 1.6, y: 'min(SW, SH)*0.28', children: [
          { id: 'tagline', type: 'text', text: '$tagline', width: 'SW', size: 5.4, weight: 700, color: 'on-primary' },
          { id: 'cta', type: 'text', text: '$cta', font: 'body', size: 3.8, color: 'on-primary/80' },
        ] },
      ],
      timeline: [
        { at: 0, target: 'ring', dur: 1, ease: 'inOutCubic', to: { end: 1 } },
        { at: 0, target: 'dots', dur: 12, ease: 'linear', repeat: 'loop', to: { rotation: 360 } },
        { at: 0.3, target: 'logo', dur: 0.7, ease: 'outBack', from: { scale: 0.5, opacity: 0 }, to: {} },
        { at: 0.35, sfx: 'shimmer' },
        { at: 1.0, target: 'tagline', effect: 'type', dur: 0.9 },
        { at: 1.6, target: 'cta', dur: 0.5, from: { opacity: 0 }, to: {} },
      ],
    },
  },
];

/** Deux exemples proches de la scène (mots de l'intention, médias, place dans le film). */
export function pickProgramExamples(words: string, mediaKinds: string[], last: boolean, count = 2): ProgramExample[] {
  const text = words.toLowerCase();
  const scored = PROGRAM_EXAMPLES.map((ex, k) => {
    let score = ex.tags.reduce((s, t) => s + (text.includes(t) ? 2 : 0), 0);
    if (mediaKinds.length && ex.media.length) score += 3;
    if (!mediaKinds.length && ex.media.length) score -= 4;
    if (last && ex.id === 'logo-signature') score += 3;
    return { ex, score, k };
  });
  scored.sort((a, b) => b.score - a.score || a.k - b.k);
  return scored.slice(0, count).map((s) => s.ex);
}
