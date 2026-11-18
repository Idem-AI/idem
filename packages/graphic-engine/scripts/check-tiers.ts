/**
 * La GAMME des nœuds (18/11/2026) — `npm run check:tiers`. Aucun rendu, aucun appel.
 *
 * Vérifie que le registre accepte le champ `tier` (schéma strict), que chaque cran trouve des gabarits pour chaque
 * élément, et que le filtre de gamme sert d'abord la gamme demandée, puis la voisine la plus basse.
 */
import assert from 'assert';
import path from 'path';
import { buildCatalog, readTemplatesDir } from '../src/catalog/registry';
import { readDirectionsDir } from '../src/directions';
import { inTier, TIERS } from '../src/catalog/tier';
import { ALL_ELEMENTS } from '../src/catalog/types';

// Le filtre seul.
const pool = [{ id: 'a', tier: 'low' }, { id: 'b', tier: 'high' }, { id: 'c', tier: 'ultra' }, { id: 'd' }];
assert.deepEqual(inTier(pool, 'ultra').map((n) => n.id), ['c', 'd'], 'la gamme exacte, et les nœuds sans gamme');
assert.deepEqual(inTier(pool, 'medium').map((n) => n.id), ['a', 'b', 'd'], 'gamme absente : les deux voisines à distance 1');
assert.deepEqual(inTier(pool, 'high', 2).map((n) => n.id), ['b', 'c', 'd'], 'moins de `min` : la voisine s’ajoute');
assert.deepEqual(inTier(pool, undefined).length, 4, 'sans cran : aucun filtre');

const dir = process.env.IDEM_TEMPLATES_DIR;
if (!dir) {
  console.log('✓ Filtre de gamme. (IDEM_TEMPLATES_DIR absent : catalogue non relu.)');
  process.exit(0);
}
const raw = readTemplatesDir(dir);
const cat = buildCatalog(raw as never, { version: 'local', source: 'dir' as never }, readDirectionsDir(dir) as never);
const rejected = cat.rejected.filter((r) => /tier/i.test(r.reason));
assert.equal(rejected.length, 0, `nœuds rejetés à cause de la gamme : ${rejected.map((r) => `${r.id} (${r.reason})`).join(', ')}`);
const gabarits = [...cat.nodes.values()].filter((n) => n.kind === 'gabarit');
const tiered = gabarits.filter((n) => n.tier).length;
assert.ok(tiered === gabarits.length, `gabarits sans gamme : ${gabarits.length - tiered}`);
const rows: string[] = [];
for (const el of ALL_ELEMENTS) {
  const forEl = gabarits.filter((g) => !g.elements?.length || g.elements.includes(el as never));
  rows.push(`  ${String(el).padEnd(15)} ${TIERS.map((t) => `${t[0].toUpperCase()}${forEl.filter((g) => g.tier === t).length}`).join(' ')}`);
}
console.log(`✓ Registre ${path.basename(dir)} : ${cat.nodes.size} nœuds acceptés, ${cat.rejected.length} rejetés (aucun pour la gamme)`);
console.log(`  gabarits par élément et par gamme :\n${rows.join('\n')}`);
