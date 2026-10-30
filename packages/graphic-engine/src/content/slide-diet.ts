/**
 * LE RÉGIME D'UNE DIAPOSITIVE — la garantie, par le code, qu'une slide reste lisible du fond de la salle.
 *
 * Quand une slide dépasse encore son budget de texte (après la réécriture ciblée par le rédacteur), le code
 * DÉPLACE ce qui déborde vers les NOTES DE L'ORATEUR — il ne supprime rien : « le détail va dans votre voix »
 * (règle 10/20/30 de Guy Kawasaki ; structure affirmation-preuve). Dans l'ordre, jusqu'à tenir le budget :
 *
 *   1. le chapô (la slide garde son titre-affirmation) ;
 *   2. les phrases au-delà de la première dans la prose, les cartes, les étapes, la chronologie ;
 *   3. les détails des points et des cartes (les libellés restent) ;
 *   4. la légende des tableaux et les notes des chiffres-clés.
 *
 * Les chiffres, les libellés, les tableaux de données et les blocs posés par le code (`origin: system`) ne
 * bougent jamais.
 */
import type { Block, SectionContent } from '../contracts/content-model';
import type { TextBudget } from '../contracts/slide-intent';
import { analyzeSection, textLoad } from './analyze';

const firstSentence = (text: string): { kept: string; rest: string } => {
  const m = text.match(/^([\s\S]+?[.!?…])(\s+)([\s\S]+)$/);
  return m ? { kept: m[1].trim(), rest: m[3].trim() } : { kept: text, rest: '' };
};

const over = (section: SectionContent, budget: TextBudget): number => textLoad(analyzeSection(section), budget).over;

export function slideDiet(section: SectionContent, budget: TextBudget = section.intent?.textBudget as TextBudget): { section: SectionContent; moved: string[] } {
  const moved: string[] = [];
  if (!budget || over(section, budget) <= 1) return { section, moved };
  let s: SectionContent = JSON.parse(JSON.stringify(section));
  const mutable = (b: Block) => b.origin !== 'system';

  const steps: Array<(x: SectionContent) => void> = [
    // 1. Le chapô : le titre affirme déjà.
    (x) => {
      if (x.lede) {
        moved.push(x.lede);
        delete x.lede;
      }
    },
    // 2. Une phrase par paragraphe, par carte, par étape.
    (x) => {
      for (const b of x.blocks.filter(mutable)) {
        if (b.kind === 'prose') {
          const keep = firstSentence(b.paragraphs[0] ?? '');
          moved.push(...[keep.rest, ...b.paragraphs.slice(1)].filter(Boolean));
          b.paragraphs = [keep.kept];
        }
        if (b.kind === 'cards') for (const it of b.items) { const k = firstSentence(it.body); if (k.rest) { moved.push(`${it.title} : ${k.rest}`); it.body = k.kept; } }
        if (b.kind === 'steps') for (const it of b.items) { const k = firstSentence(it.body); if (k.rest) { moved.push(`${it.title} : ${k.rest}`); it.body = k.kept; } }
        if (b.kind === 'timeline') for (const it of b.steps) { const k = firstSentence(it.body); if (k.rest) { moved.push(`${it.title} : ${k.rest}`); it.body = k.kept; } }
        if (b.kind === 'assumption') { const k = firstSentence(b.basis); if (k.rest) { moved.push(k.rest); b.basis = k.kept; } }
      }
    },
    // 3. Les détails des points ; le corps des cartes réduit à leur titre quand il le faut.
    (x) => {
      for (const b of x.blocks.filter(mutable)) {
        if (b.kind === 'points') for (const it of b.items) if (it.detail) { moved.push(`${it.label} : ${it.detail}`); delete it.detail; }
      }
    },
    (x) => {
      for (const b of x.blocks.filter(mutable)) {
        if (b.kind === 'cards') for (const it of b.items) if (it.body && it.body !== it.title) { moved.push(`${it.title} : ${it.body}`); it.body = it.title; }
        if (b.kind === 'prose' && b.paragraphs.join(' ').split(/\s+/).length > 12) { moved.push(b.paragraphs.join(' ')); b.paragraphs = [firstSentence(b.paragraphs[0]).kept.split(/\s+/).slice(0, 12).join(' ') + '…']; }
      }
    },
    // 4. Légendes et notes.
    (x) => {
      for (const b of x.blocks.filter(mutable)) {
        if (b.kind === 'table' && b.caption) { moved.push(b.caption); delete b.caption; }
        if (b.kind === 'metrics') for (const it of b.items) if (it.note) { moved.push(`${it.value} ${it.label} : ${it.note}`); delete it.note; }
      }
    },
  ];
  for (const step of steps) {
    if (over(s, budget) <= 1) break;
    step(s);
  }
  if (moved.length) s.notes = [section.notes, ...moved].filter(Boolean).join('\n').slice(0, 4000);
  return { section: s, moved };
}

/** L'ordre de préférence des PREUVES d'une slide : la donnée d'abord, l'explication en dernier. */
const EVIDENCE_ORDER: Block['kind'][] = ['chart', 'metrics', 'table', 'comparison', 'funnel', 'businessModel', 'points', 'timeline', 'steps', 'cards', 'swot', 'riskMatrix', 'persona', 'quote', 'prose', 'assumption'];
/** Les blocs qui ne sont pas du texte (une image) ne comptent pas dans le nombre de blocs. */
const MEDIA_KINDS = new Set<Block['kind']>(['figure']);
const LISTS: Partial<Record<Block['kind'], string>> = { points: 'items', cards: 'items', steps: 'items', timeline: 'steps' };

/** Les mots d'un bloc, en une ligne lisible pour les notes de l'orateur. */
function blockText(block: Block): string {
  const out: string[] = [];
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'string') {
      if (!['id', 'kind', 'origin', 'url', 'icon', 'chartType', 'unit'].includes(key) && !/^(https?:|data:)/.test(v)) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['series', 'labels', 'focal'].includes(k)) walk(x, k);
  };
  walk(block);
  return out.join(' — ');
}

/**
 * L'ESSENTIEL D'UNE SLIDE — garanti par le code, à tous les crans (décision du 15/10/2026 : « on n'affiche que
 * l'essentiel : pas d'éléments futiles, pas de contenus trop explicatifs ; précis, concis »).
 *
 *   1. pas de chapô : le titre affirme déjà ;
 *   2. au plus `maxBlocks` blocs de texte (2), les preuves gardées dans l'ordre donnée › liste › explication ;
 *   3. au plus `maxBullets` éléments par liste (3) ;
 *   4. puis le régime de texte (`slideDiet`) quand la slide dépasse encore son budget.
 *
 * Rien n'est perdu : ce qui quitte la slide va dans les NOTES DE L'ORATEUR. Les blocs posés par le code
 * (`origin: system`) et les images ne bougent jamais.
 */
export function slideEssentials(section: SectionContent, o: { maxBlocks?: number; maxBullets?: number; budget?: TextBudget } = {}): { section: SectionContent; moved: string[] } {
  const maxBlocks = o.maxBlocks ?? 2;
  const budget = o.budget ?? (section.intent?.textBudget as TextBudget | undefined);
  const maxBullets = o.maxBullets ?? (budget?.maxBullets || 3);
  const moved: string[] = [];
  const s: SectionContent = JSON.parse(JSON.stringify(section));

  if (s.lede && s.blocks.length) {
    moved.push(s.lede);
    delete s.lede;
  }
  const text = s.blocks.filter((b) => b.origin !== 'system' && !MEDIA_KINDS.has(b.kind));
  if (text.length > maxBlocks) {
    const rank = (b: Block) => (EVIDENCE_ORDER.indexOf(b.kind) + 1 || EVIDENCE_ORDER.length + 1) * 100 + text.indexOf(b);
    const keep = new Set([...text].sort((a, b) => rank(a) - rank(b)).slice(0, maxBlocks));
    for (const b of text) if (!keep.has(b)) moved.push(blockText(b));
    s.blocks = s.blocks.filter((b) => b.origin === 'system' || MEDIA_KINDS.has(b.kind) || keep.has(b));
  }
  for (const b of s.blocks) {
    const field = LISTS[b.kind];
    if (!field || b.origin === 'system') continue;
    const list = (b as unknown as Record<string, unknown[]>)[field];
    if (Array.isArray(list) && list.length > maxBullets) {
      for (const extra of list.splice(maxBullets)) moved.push(blockText({ ...(extra as object), kind: b.kind } as Block));
    }
  }
  const lean = moved.length ? { ...s, notes: [section.notes, ...moved].filter(Boolean).join('\n').slice(0, 4000) } : s;
  const diet = budget ? slideDiet(lean, budget) : { section: lean, moved: [] };
  return { section: diet.section, moved: [...moved, ...diet.moved] };
}
