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
import { analyzeSection, textLoad } from '../composition-engine/analyze';

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
