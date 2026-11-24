/**
 * LA DIVERSITÉ DU CATALOGUE — `npm run check:variety` (IDEM_TEMPLATES_DIR=../idem-templates).
 *
 * Sans un jeton ni un rendu : pour chaque DA sélectionnable et plusieurs marques, ce que le code met en tête pour trois
 * pages qui se ressemblaient d'une charte à l'autre (la page palette, la couverture, une diapositive de chiffres), d'abord
 * pour des marques sans passé, puis pour une même marque qui enchaîne les documents (mémoire des nœuds).
 *
 * Mesures : nombre de gabarits distincts servis en tête, part du plus servi, et renouvellement sur 4 documents successifs.
 */
import { catalog } from '../src/catalog/registry';
import { brandTraits, newCatalogState, nodeMark, rankSkins, readNodeMarks, shortlist } from '../src/catalog/graph';
import { pageUnits } from '../src/catalog/assemble';
import { FORMATS } from '../src/design-system/formats';
import type { CatalogElement } from '../src/catalog/types';
import type { SectionContent } from '../src/contracts/content-model';

const PALETTE: SectionContent = { id: 'palette', role: 'specimen', title: 'Palette de couleurs', blocks: [{ id: 's', kind: 'swatches', origin: 'system', items: [{ hex: '#1A2A4F', name: 'Primaire', role: 'Titres' }, { hex: '#7F9CE5', name: 'Secondaire', role: 'Aplats' }, { hex: '#C9A227', name: 'Accent', role: 'Chiffres' }, { hex: '#F8F9FB', name: 'Fond', role: 'Page' }, { hex: '#0F172A', name: 'Encre', role: 'Texte' }] }] } as SectionContent;
const COVER: SectionContent = { id: 'cover', role: 'cover', title: 'Kora', blocks: [{ id: 'c', kind: 'cover', brandName: 'Kora', promise: 'Le crédit simple', documentLabel: 'Pitch deck', dateLabel: 'Novembre 2026' }] } as SectionContent;
const METRICS: SectionContent = { id: 'market', role: 'data', title: 'Un marché de 40 000 commerçants', blocks: [{ id: 'm', kind: 'metrics', items: [{ value: '40 000', label: 'commerçants' }, { value: '72 %', label: 'paient en mobile money' }, { value: '0', label: 'crédit bancaire' }] }] } as SectionContent;

const FLYER: SectionContent = { id: 'offre', role: 'visual', title: 'Visuel', blocks: [{ id: 'copy', kind: 'copy', headline: 'Vos intrants livrés au village', subhead: 'Commandez par un simple appel', offer: '−20 %', facts: [{ text: 'Livraison en 48 h' }] }] } as SectionContent;

import fs from 'fs';
import path from 'path';
const BLOCKS = JSON.parse(fs.readFileSync(path.join(process.env.IDEM_TEMPLATES_DIR ?? '', 'catalog/preview/images/blocks.json'), 'utf8'));
const charterPage = (kind: string): SectionContent => ({ id: kind, role: 'specimen', title: kind, blocks: [{ ...BLOCKS[kind], id: 'b' }] }) as SectionContent;
const CHARTER_KINDS = ['logoDisplay', 'logoStory', 'typeSpecimen', 'typeScale', 'patternGrid', 'mockupShowcase', 'socialPosts', 'socialBanners', 'artDirectionStance', 'artDirectionRules', 'imageryShowcase'];

const PAGES: Array<{ name: string; element: CatalogElement; format: keyof typeof FORMATS; section: SectionContent }> = [
  { name: 'palette (charte A4)', element: 'brand-charter', format: 'page-a4', section: PALETTE },
  // (charte paysage, couvertures, deck, flyers : plus bas)
  { name: 'palette (charte paysage)', element: 'brand-charter', format: 'page-a4-landscape', section: PALETTE },
  { name: 'couverture (deck)', element: 'pitch-deck', format: 'slide-16x9', section: COVER },
  { name: 'couverture (charte A4)', element: 'brand-charter', format: 'page-a4', section: COVER },
  { name: 'chiffres (deck)', element: 'pitch-deck', format: 'slide-16x9', section: METRICS },
  ...CHARTER_KINDS.map((k) => ({ name: `charte · ${k}`, element: 'brand-charter' as const, format: 'page-a4' as const, section: charterPage(k) })),
  ...(['team-photos', 'problem-photos', 'vision-photo'] as const).map((label) => ({ name: `deck · ${label}`, element: 'pitch-deck' as const, format: 'slide-16x9' as const, section: JSON.parse(fs.readFileSync(path.join(process.env.IDEM_TEMPLATES_DIR ?? '', 'catalog/preview/images/elements/pitch-deck.json'), 'utf8')).cases.find((c: { label: string }) => c.label === label).content as SectionContent })),
  { name: 'flyer carré', element: 'social-visual', format: 'flyer-square', section: FLYER },
  { name: 'affiche imprimée', element: 'print-flyer', format: 'print-flyer-a4', section: FLYER },
];

async function main(): Promise<void> {
  const cat = await catalog();
  const das = [...cat.directions.keys()].filter((d) => d !== 'cyberpunk');
  let failed = 0;
  for (const page of PAGES) {
    const units = pageUnits(page.section);
    const facts = { element: page.element, format: FORMATS[page.format], role: page.section.role, units, index: 1, total: 12 };
    for (const level of ['low', 'medium', 'high', 'ultra'] as const) {
      const firsts: string[] = [];
      const looks: string[] = [];
      let renewed = 0;
      let chains = 0;
      for (const da of das) {
        const traits = brandTraits({ styleId: da }, false);
        for (let b = 0; b < 3; b++) {
          const seed = `${da}|brand${b}`;
          const skin = rankSkins(cat, page.element, traits, newCatalogState(), seed, {}, level)[0].id;
          const top = shortlist(cat, facts, { level, skin, traits, state: newCatalogState(), seed, overrides: {} })[0];
          firsts.push(top.config.gabarit ?? top.layout.id);
          // Ce que le lecteur VOIT : le squelette et le composant de la page (pas le seul nom du gabarit).
          looks.push(`${top.layout.id}|${Object.values(top.config.components).sort().join(',')}`);
        }
        // Une même marque, 4 documents de suite : la mémoire des nœuds écarte ce qui vient de servir.
        let memory: string[] = [];
        const seen: string[] = [];
        for (let d = 0; d < 4; d++) {
          const state = newCatalogState([], [], readNodeMarks(memory));
          const skin = rankSkins(cat, page.element, traits, state, `${da}|doc${d}`, {}, level)[0].id;
          const top = shortlist(cat, facts, { level, skin, traits, state, seed: `${da}|doc${d}`, overrides: {} })[0];
          const id = top.config.gabarit ?? top.layout.id;
          if (!seen.includes(id)) renewed++;
          seen.push(id);
          chains++;
          memory = [...memory, nodeMark([top.layout.id, ...(top.config.gabarit ? [top.config.gabarit] : []), ...Object.values(top.config.components)]) as string];
        }
      }
      const counts = new Map<string, number>();
      for (const f of firsts) counts.set(f, (counts.get(f) ?? 0) + 1);
      const max = Math.max(...counts.values());
      const leader = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const share = max / firsts.length;
      const renewal = renewed / chains;
      const distinctLooks = new Set(looks).size;
      const ok = counts.size >= 6 && share <= 0.3 && renewal >= 0.6;
      if (!ok) failed++;
      console.log(`${ok ? '✓' : '✗'} ${page.name.padEnd(26)} ${level.padEnd(6)} ${String(counts.size).padStart(3)} gabarits (${String(distinctLooks).padStart(3)} rendus) en tête · le plus servi ${(share * 100).toFixed(0).padStart(3)} % · renouvellement sur 4 documents ${(renewal * 100).toFixed(0)} % · en tête : ${leader}`);
    }
  }
  console.log(failed ? `\n${failed} mesure(s) sous le seuil (≥ 6 gabarits en tête, ≤ 30 % pour le plus servi, ≥ 60 % de renouvellement)` : '\nDiversité suffisante partout.');
  process.exit(failed ? 1 : 0);
}
main();
