/**
 * LE MINIMUM INTÉGRÉ — ce que le moteur vidéo sait faire sans aucun catalogue (dépôt, CDN, instantané absents) : une
 * mise en page empilée qui accepte tout, un thème sobre, une montée en fondu, une coupe. Aucun film ne s'arrête faute
 * de catalogue ; ce minimum n'est jamais choisi quand le catalogue répond.
 */
import type { VideoNode } from './types';

const doc = (title: string, summary: string) => ({ title, summary });

export const BUILTIN_VIDEO_NODES: VideoNode[] = [
  {
    id: 'builtin.stack',
    version: 1,
    medium: 'video',
    kind: 'layout',
    doc: doc('Empilement sobre', 'Image en haut si elle existe, puis le titre, le texte, la liste et l’action, alignés à gauche.'),
    formats: ['story', 'square', 'portrait', 'landscape'],
    roles: ['*'],
    energy: [1, 5],
    weight: 0.1,
    slots: { title: { need: 'optional' }, body: { need: 'optional' }, cta: { need: 'optional' }, figure: { need: 'optional' }, label: { need: 'optional' }, attribution: { need: 'optional' }, items: { need: 'optional', max: 6 }, media: { need: 'optional', kinds: ['image', 'video'] }, logo: { need: 'optional' } },
    html: [
      '[[if media]]<div data-v="media" class="absolute inset-x-0 top-0 h-[40%] overflow-hidden [[ls:inset-x-auto left-0 h-full w-[45%]]]">[[media]]</div>[[/if]]',
      '<div data-safe class="[[safe]] flex flex-col justify-center gap-[2.6cqmin] [[if media]]top-[44%] [[sq:top-[44%]]] [[po:top-[44%]]] [[ls:top-[8%] left-[50%]]][[/if]]">',
      '[[if figure]]<p data-v="figure" data-fit="figure" data-fk="0.16" data-fmin="0.08" class="whitespace-nowrap tabular-nums [[t.figure]] [[t.accentInk]]">{{figure}}</p>[[/if]]',
      '[[if label]]<p data-v="label" data-fit="label" data-fk="0.036" data-fmin="0.026" class="[[t.label]] [[t.ink]]">{{label}}</p>[[/if]]',
      '[[if title]]<h1 data-v="title" data-fit="title" data-fk="0.075" data-fmin="0.04" class="text-balance [[t.title]] [[t.ink]]">{{title}}</h1>[[/if]]',
      '[[if body]]<p data-v="body" data-fit="body" data-fk="0.038" data-fmin="0.027" class="text-pretty [[t.body]] [[t.soft]]">{{body}}</p>[[/if]]',
      '[[if items]]<ul data-v="items" class="flex flex-col gap-[1.6cqmin]">[[each items]]<li data-v="item" data-fit="item" data-fk="0.036" data-fmin="0.026" class="[[t.item]] [[t.ink]]">{{item}}</li>[[/each]]</ul>[[/if]]',
      '[[if attribution]]<p data-v="attribution" data-fit="attribution" data-fk="0.03" data-fmin="0.023" class="[[t.label]] [[t.soft]]">{{attribution}}</p>[[/if]]',
      '[[if cta]]<p data-v="cta" class="self-start px-[4cqmin] py-[2cqmin] [[t.button]]"><span data-fit="cta" data-fk="0.036" data-fmin="0.027" class="[[t.cta]]">{{cta}}</span></p>[[/if]]',
      '[[if logo]]<div data-v="logo" class="h-[6cqmin]">[[logo]]</div>[[/if]]',
      '</div>',
    ].join(''),
  },
  {
    id: 'builtin.plain',
    version: 1,
    medium: 'video',
    kind: 'theme',
    doc: doc('Sobre', 'Fond clair, montées en fondu, coupes franches.'),
    ground: 'light',
    motion: { dIn: 0.7, dOut: 0.45, stagger: 0.06, dist: 32, easeOut: 'power3.out', easeIn: 'power2.in', easeMove: 'power3.inOut', drift: 0.02 },
    classes: {},
    defaults: { text: 'builtin.rise', body: 'builtin.rise', media: 'builtin.rise', rule: 'builtin.rise', figure: 'builtin.rise', items: 'builtin.rise', logo: 'builtin.rise', cta: 'builtin.rise', block: 'builtin.rise' },
    transitions: ['builtin.cut'],
  },
  {
    id: 'builtin.rise',
    version: 1,
    medium: 'video',
    kind: 'animation',
    doc: doc('Montée en fondu', 'Monte de quelques unités en apparaissant.'),
    targets: ['text', 'block', 'items', 'figure', 'logo', 'cta', 'media', 'rule'],
    split: 'none',
    steps: { in: [{ from: { y: '$dist', opacity: 0 }, to: { y: 0, opacity: 1 }, duration: '$dIn', ease: '$easeOut', stagger: '$stagger' }], out: [{ to: { opacity: 0 }, duration: '$dOut', ease: '$easeIn' }] },
  },
  {
    id: 'builtin.cut',
    version: 1,
    medium: 'video',
    kind: 'transition',
    doc: doc('Coupe franche', 'Aucune transition.'),
    duration: 0,
    overlays: [],
    steps: { out: [], in: [] },
  },
];
