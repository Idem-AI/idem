/**
 * L'INSTANTANÉ EMBARQUÉ du catalogue — `npm run catalog:snapshot -- <dossier idem-templates>`.
 *
 * Copie le dépôt de gabarits dans `catalog/snapshot.json` (HTML compris) : c'est le repli quand ni le dépôt, ni le CDN,
 * ni le cache disque ne répondent. À relancer de temps en temps (le catalogue en ligne reste la source vivante).
 */
import fs from 'fs';
import path from 'path';
import { buildCatalog, readTemplatesDir } from '../src/catalog/registry';
import { ENGINE_VERSION } from '../src/version';

const dir = process.argv[2] || process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../idem-templates');
const raw = readTemplatesDir(dir);
const checked = buildCatalog(raw, { version: 'snapshot', source: 'dir' });
if (checked.rejected.length) {
  console.error(`✗ ${checked.rejected.length} nœud(s) écarté(s) :\n  ${checked.rejected.map((r) => `${r.id}: ${r.reason}`).join('\n  ')}`);
  process.exit(1);
}
const now = new Date().toISOString();
const snapshot = { schema: 1, version: `snapshot-${now.slice(0, 10)}`, builtAt: now, engine: ENGINE_VERSION, license: 'Apache-2.0 + Commons Clause', entries: raw.map((r) => ({ node: r.node as Record<string, unknown> })) };
const out = path.resolve(__dirname, '../catalog/snapshot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(snapshot));
console.log(`✓ ${path.relative(process.cwd(), out)} — ${raw.length} nœuds (${Math.round(fs.statSync(out).size / 1024)} Ko)`);
