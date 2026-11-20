/**
 * ROLL-UP DE LA CHARTE — `npm run sample:rollup -- --out <dossier>`
 *
 * Rend le roll-up (850 × 2000 px) pour les trois marques de test, comme le service des bannières de la charte
 * (`composeRollup`). À REGARDER avant de dire « corrigé » : le PNG doit faire exactement 850 × 2000.
 */
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_QUALITY_MEMORY = '0';

import fs from 'fs';
import path from 'path';
import { configureGraphicEngine } from '../src/host';
import { closeBrowser } from '../src/runtime/browser';
import { composeRollup } from '../src/runtime/rollup';
import { BRANDS } from './fixtures';

const DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../idem-templates');
process.env.IDEM_TEMPLATES_DIR = DIR;
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const out = arg('--out') ?? path.resolve('rollup-samples');
fs.mkdirSync(out, { recursive: true });

configureGraphicEngine({ agentCall: () => async () => '{"pick":"A"}' });

const KITS = [
  { headline: 'Le marché vient à vous', tagline: 'AgriLink relie 2 000 producteurs aux acheteurs de Douala.', points: ['Commandez par un simple appel', 'Payez à la livraison', 'Suivi de chaque colis par SMS'], handle: 'agrilink.cm' },
  { headline: 'Cultivons ensemble un avenir rentable pour chaque famille', tagline: 'Intrants, conseils et débouchés au même endroit.', points: ['Des intrants livrés au village en 48 h', 'Un conseiller agricole au téléphone'], handle: '@agrilink' },
  { headline: 'Ouvrez, nous livrons', points: ['Livraison express', 'Paiement mobile money'] },
];

async function main(): Promise<void> {
  for (const [i, key] of (['kora', 'Makam', 'baobab'] as const).entries()) {
    const brand = BRANDS[key];
    const res = await composeRollup({ brand, direction: { styleId: brand.styleId }, seed: `rollup:${key}`, ...KITS[i] });
    fs.writeFileSync(path.join(out, `rollup-${key}.png`), res.png);
    console.log(key, brand.styleId, `${res.png.length} o`, res.overflow.length ? `DÉBORDE : ${res.overflow.join(', ')}` : 'tout tient');
  }
  await closeBrowser();
}
main().catch((e) => { console.error(e); process.exit(1); });
