import { catalog } from '../../src/catalog/registry';
import { brandTraits, compatibleLayouts, newCatalogState, shortlist } from '../../src/catalog/graph';
import { pageUnits, assignUnits } from '../../src/catalog/assemble';
import { FORMATS } from '../../src/design-system/formats';
import * as F from '../fixtures';
(async () => {
  const cat = await catalog();
  const facts = { element: 'business-card' as const, format: FORMATS['card-landscape'], role: F.CARD_BACK.role, units: pageUnits(F.CARD_BACK), index: 1, total: 1 };
  console.log(facts.units.map((u) => u.id + ':' + u.kind + ':' + u.category));
  const l = cat.nodes.get('card.left-stack') as any;
  console.log(l ? assignUnits(l, facts.units).error : 'no layout', FORMATS['card-landscape'].kind, l?.shape);
  console.log(compatibleLayouts(cat, facts, new Set()).map((x) => x.id));
  console.log(shortlist(cat, facts, { level: 'low', skin: 'skin.swiss-rule', traits: brandTraits({}, false), state: newCatalogState(), seed: 'x', overrides: {} }).map((c) => c.config.gabarit + ' ' + c.layout.id));
})();
