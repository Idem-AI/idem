/**
 * LE MINIMUM INTÉGRÉ — ce qui reste quand aucun catalogue n'est joignable (ni dépôt, ni CDN, ni instantané) : une page
 * empilée, sobre, à la charte. Aucune génération ne s'arrête faute de gabarit, et aucune ne repart vers l'écriture
 * libre par un modèle. Les composants manquants sont dessinés par le code (`assemble.ts`, `genericComponent`).
 */
import type { CatalogNode } from './types';

const doc = (title: string, summary: string) => ({ title, summary });

export const BUILTIN_NODES: CatalogNode[] = [
  {
    id: 'builtin.stack-flow',
    version: 1,
    kind: 'layout',
    doc: doc('Page empilée (flux)', 'En-tête puis contenus les uns sous les autres, pleine largeur.'),
    elements: ['business-plan', 'pitch-deck', 'brand-charter', 'business-card', 'social-visual', 'social-cover', 'print-flyer', 'web-banner'],
    shape: { kind: 'flow' },
    roles: ['*'],
    grid: { columns: 1, rows: 1 },
    zones: [
      { id: 'head', accepts: ['header'], col: 1, span: 1, row: 1, rows: 1, align: 'start', optional: true },
      { id: 'main', accepts: ['main', 'side', 'media', 'any'], col: 1, span: 1, row: 2, rows: 1, align: 'start', optional: true },
    ],
    capacity: { minBlocks: 0, maxBlocks: 40 },
    mirrorable: false,
  },
  {
    id: 'builtin.stack-fixed',
    version: 1,
    kind: 'layout',
    doc: doc('Toile empilée', 'En-tête en haut, contenus dessous sur toute la largeur.'),
    elements: ['business-plan', 'pitch-deck', 'brand-charter', 'business-card', 'social-visual', 'social-cover', 'print-flyer', 'web-banner'],
    shape: { kind: 'fixed' },
    roles: ['*'],
    grid: { columns: 12, rows: 6 },
    zones: [
      { id: 'head', accepts: ['header'], col: 1, span: 12, row: 1, rows: 2, align: 'end', optional: true },
      { id: 'main', accepts: ['main', 'side', 'media', 'any'], col: 1, span: 12, row: 3, rows: 4, align: 'start', optional: true },
    ],
    capacity: { minBlocks: 0, maxBlocks: 40 },
    mirrorable: false,
  },
  {
    id: 'builtin.plain',
    version: 1,
    kind: 'skin',
    doc: doc('Sobre', 'Typographie de la marque, filets fins, aucune décoration.'),
    classes: {
      page: 'bg-ground',
      kicker: 'font-semibold uppercase tracking-[0.12em] [[accent]]',
      title: 'font-display font-bold leading-[1.08] [[ink]]',
      lede: 'leading-[1.5] [[muted]]',
      heading: 'font-display font-semibold leading-[1.2] [[ink]]',
      body: 'leading-[1.6] [[ink]]',
      caption: 'leading-[1.4] [[muted]]',
      value: 'font-display font-bold leading-[1] tabular-nums [[accent]]',
      label: 'leading-[1.35] [[muted]]',
      quote: 'font-display leading-[1.3] [[ink]]',
      card: 'border-t-[2px] [[rule]] pt-[12px]',
      cardEmph: 'border-t-[3px] [[ruleStrong]] pt-[12px]',
      panel: '[[tint]] p-[20px]',
      rule: 'border-t-[1px] [[rule]]',
      figure: 'overflow-hidden',
      chip: 'border-[1px] [[rule]] px-[10px] py-[4px]',
      index: 'font-display font-bold tabular-nums [[accent]]',
      list: 'flex flex-col gap-[8px]',
    },
    sizes: { kicker: 'sm', title: '4xl', lede: 'lg', heading: 'xl', body: 'base', caption: 'sm', value: '4xl', label: 'sm', quote: '2xl', index: 'xl' },
  },
];

/** Les squelettes de repli, par nature de toile. */
export const BUILTIN_LAYOUT = { flow: 'builtin.stack-flow', fixed: 'builtin.stack-fixed' } as const;
export const BUILTIN_SKIN = 'builtin.plain';
