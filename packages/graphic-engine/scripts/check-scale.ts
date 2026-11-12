/**
 * LE PARCOURS À L'ÉCHELLE — ce que coûte une page quand le catalogue grossit.
 *
 *   npx ts-node --transpile-only scripts/check-scale.ts
 *
 * Aucun modèle, aucun rendu : on mesure le CHOIX. Trois choses à prouver :
 *   1. un catalogue plus gros ne change pas la liste courte quand les nœuds ajoutés ne concernent pas la page ;
 *   2. le temps d'une page reste borné même quand des milliers de squelettes la concernent VRAIMENT
 *      (le budget de placement : on ne mesure le placement que des mieux pré-classés) ;
 *   3. ce que le modèle reçoit ne grossit pas avec le catalogue.
 */
import { catalog, resetCatalog } from '../src/catalog/registry';
import { brandTraits, catalogIndex, newCatalogState, shortlist, PLACEMENT_BUDGET } from '../src/catalog/graph';
import { pageUnits } from '../src/catalog/assemble';
import { chooseUser } from '../src/catalog/choose';
import { FORMATS } from '../src/design-system/formats';
import type { CatalogNode, LayoutNode, LoadedCatalog } from '../src/catalog/types';
import type { SectionContent } from '../src/contracts/content-model';

let failures = 0;
const ok = (what: string, pass: boolean, detail = ''): void => {
  console.log(`  ${pass ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures += 1;
};

const SECTION = {
  id: 'market',
  role: 'data',
  title: 'Le marché adressable',
  blocks: [
    { id: 'm', kind: 'metrics', items: [{ value: '2,3 Md FCFA', label: 'Marché adressable' }, { value: '+18 %', label: 'Croissance annuelle' }, { value: '1,4 M', label: 'Commerçants' }] },
    { id: 'p', kind: 'prose', paragraphs: ['Le marché du crédit court terme à Douala pèse 2,3 milliards de francs.'] },
  ],
} as unknown as SectionContent;

/** Un squelette de remplissage, calqué sur un vrai : même forme, mêmes zones, identifiant distinct. */
function clone(model: LayoutNode, id: string, element: LayoutNode['elements'][number]): LayoutNode {
  return { ...model, id, elements: [element], doc: { ...model.doc, title: `${model.doc.title} ${id}` } };
}

function grow(cat: LoadedCatalog, model: LayoutNode, n: number, element: LayoutNode['elements'][number]): LoadedCatalog {
  const nodes = new Map<string, CatalogNode>(cat.nodes);
  for (let i = 0; i < n; i += 1) {
    const id = `bench.${element}.${i}`;
    nodes.set(id, clone(model, id, element));
  }
  return { ...cat, nodes };
}

async function main(): Promise<void> {
  resetCatalog();
  const cat = await catalog();
  const format = FORMATS['a4-portrait'];
  const units = pageUnits(SECTION);
  const traits = brandTraits({ styleId: 'swiss', keywords: ['sobre', 'précis'] } as never, false);
  const facts = { element: 'business-plan' as const, format, role: 'data' as const, units, index: 2, total: 8 };
  const opts = { level: 'high' as const, skin: 'skin.swiss-rule', traits, state: newCatalogState(), seed: 'bench', overrides: {} };

  const index = catalogIndex(cat);
  console.log(`\n§1 L'index (${index.nodes} nœuds)`);
  ok('les squelettes sont rangés par élément', index.layoutsByElement.size > 0, `${[...index.layoutsByElement].map(([k, v]) => `${k}:${v.length}`).join(' ')}`);
  ok('les composants sont rangés par type de bloc', index.componentsByKind.size > 10, `${index.componentsByKind.size} types`);
  ok('l’index est construit une seule fois par version', catalogIndex(cat) === index);

  const time = (fn: () => void, runs = 40): number => {
    fn();
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < runs; i += 1) fn();
    return Number(process.hrtime.bigint() - t0) / 1e6 / runs;
  };

  console.log('\n§2 Un catalogue plus gros, la même page');
  const base = shortlist(cat, facts, opts);
  const baseIds = base.map((c) => c.config.gabarit ?? c.layout.id).join(',');
  const msBase = time(() => shortlist(cat, facts, opts));
  // 4 000 squelettes ajoutés, mais pour un AUTRE élément : la page ne doit pas les voir.
  const other = grow(cat, base[0].layout, 4000, 'social-visual');
  const otherList = shortlist(other, facts, opts);
  const msOther = time(() => shortlist(other, facts, opts));
  ok('la liste courte est identique', otherList.map((c) => c.config.gabarit ?? c.layout.id).join(',') === baseIds);
  ok('le temps ne bouge pas', msOther < msBase * 2 + 0.5, `${msBase.toFixed(2)} ms → ${msOther.toFixed(2)} ms pour ${other.nodes.size} nœuds`);

  console.log('\n§3 Des milliers de squelettes qui concernent VRAIMENT la page');
  const same = grow(cat, base[0].layout, 4000, 'business-plan');
  const sameList = shortlist(same, facts, opts);
  const msSame = time(() => shortlist(same, facts, opts), 10);
  ok('la liste courte reste de la bonne taille', sameList.length > 0 && sameList.length <= 8, `${sameList.length} candidats`);
  ok(`le placement n’est mesuré que sur ${PLACEMENT_BUDGET} squelettes`, msSame < msBase * 12 + 5, `${msBase.toFixed(2)} ms → ${msSame.toFixed(2)} ms pour ${same.nodes.size} nœuds`);

  console.log('\n§4 Ce que le modèle reçoit');
  const ask = (c: LoadedCatalog, list: ReturnType<typeof shortlist>): number =>
    chooseUser(c, { deliverable: 'business plan', brandLine: 'Kora — le crédit simple', traits }, { section: SECTION, units, candidates: list, level: 'high' }).length;
  const small = ask(cat, base);
  const big = ask(same, sameList);
  ok('la demande au modèle ne grossit pas avec le catalogue', big < small * 1.6 + 200, `${small} → ${big} signes`);
  ok('elle tient dans un petit budget', big < 4000, `${big} signes ≈ ${Math.round(big / 4)} jetons`);

  console.log(`\n${failures ? '✗' : '✓'} ${failures} échec(s)\n`);
  process.exit(failures ? 1 : 0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
