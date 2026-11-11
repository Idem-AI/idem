/**
 * Embarque le catalogue iCode (idem-templates/catalog/icode) dans `src/siteEngine/sectionCatalog/snapshot.json` :
 * le repli quand ni le dépôt (IDEM_TEMPLATES_DIR) ni le CDN (IDEM_TEMPLATES_URL) ne répondent.
 *
 *   IDEM_TEMPLATES_DIR=../../../../../idem-templates npm run catalog:snapshot
 *
 * Le manifeste construit et signé du dépôt (`dist/icode/manifest.json`, `npm run build` là-bas) est repris tel quel
 * s'il existe ; sinon les nœuds sont lus et vérifiés ici (instantané non signé).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSectionCatalog, ICODE_CATALOG_ENGINE, readDirectionsDir, readIcodeTemplatesDir } from '../src/siteEngine/sectionCatalog/registry.js';

const dir = path.resolve(process.env.IDEM_TEMPLATES_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../idem-templates'));
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'siteEngine', 'sectionCatalog', 'snapshot.json');
const built = path.join(dir, 'dist', 'icode', 'manifest.json');

let manifest: { version: string; entries: unknown[]; directions?: Array<Record<string, unknown>> };
if (fs.existsSync(built)) manifest = JSON.parse(fs.readFileSync(built, 'utf8'));
else {
  const entries = readIcodeTemplatesDir(dir);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version?: string };
  manifest = { schema: 1, version: `${pkg.version ?? '0.0.0'}+snapshot`, engine: ICODE_CATALOG_ENGINE, directions: readDirectionsDir(dir), entries } as typeof manifest;
}
const check = buildSectionCatalog(manifest.entries as never, manifest.version, 'snapshot', (manifest.directions ?? []) as never);
if (check.rejected.length) {
  console.error('✗ nœuds refusés :', check.rejected);
  process.exit(1);
}
fs.writeFileSync(out, JSON.stringify(manifest));
console.log(`✓ instantané ${manifest.version} : ${check.kinds.size} schémas, ${check.sections.length} sections, ${check.headers.length} en-têtes, ${check.footers.length} pieds de page → ${path.relative(process.cwd(), out)}`);
