/**
 * Les SCHÉMAS JSON des trois contrats (ContentModel, DesignSpec, RenderResult), tirés des schémas zod :
 * une seule source, et des fichiers lisibles par n'importe quel outil (validation, génération de types,
 * documentation, sortie structurée d'un modèle).
 *
 *   npm run schemas --prefix packages/graphic-engine            (réécrit contracts/*.schema.json)
 *   npm run schemas --prefix packages/graphic-engine -- --check (vérifie qu'ils sont à jour)
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod/v4';
import { ContentModel } from '../src/contracts/content-model';
import { DesignSpec } from '../src/contracts/design-spec';
import { RenderResult } from '../src/contracts/render-result';
import { CONTRACT_VERSIONS } from '../src/version';

const DIR = path.resolve(__dirname, '../contracts');
const check = process.argv.includes('--check');

const contracts = [
  { file: 'content-model.schema.json', schema: ContentModel, title: 'IDEM — ContentModel', version: CONTRACT_VERSIONS.contentModel },
  { file: 'design-spec.schema.json', schema: DesignSpec, title: 'IDEM — DesignSpec', version: CONTRACT_VERSIONS.designSpec },
  { file: 'render-result.schema.json', schema: RenderResult, title: 'IDEM — RenderResult', version: CONTRACT_VERSIONS.renderResult },
];

let stale = 0;
for (const c of contracts) {
  const json = { ...z.toJSONSchema(c.schema as z.ZodType, { unrepresentable: 'any', cycles: 'ref', reused: 'ref' }), title: c.title, $comment: `Version ${c.version} — généré depuis src/contracts (zod). Ne pas modifier à la main.` };
  const text = `${JSON.stringify(json, null, 2)}\n`;
  const target = path.join(DIR, c.file);
  if (check) {
    const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text;
    console.log(`  ${same ? '✓' : '✗'} ${c.file}${same ? '' : ' — périmé : lancer `npm run schemas`'}`);
    if (!same) stale += 1;
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(target, text);
    console.log(`  → contracts/${c.file} (${(text.length / 1024).toFixed(1)} Ko)`);
  }
}
process.exit(stale ? 1 : 0);
