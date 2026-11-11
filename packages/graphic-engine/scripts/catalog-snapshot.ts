/**
 * L'INSTANTANÉ EMBARQUÉ du catalogue — `npm run catalog:snapshot -- <dossier idem-templates>`.
 *
 * Copie le dépôt de gabarits dans `catalog/snapshot.json` (HTML compris) : c'est le repli quand ni le dépôt, ni le CDN,
 * ni le cache disque ne répondent. À relancer de temps en temps (le catalogue en ligne reste la source vivante).
 */
import fs from 'fs';
import path from 'path';
import { buildCatalog, readTemplatesDir } from '../src/catalog/registry';
import { DirectionNode, DIRECTIONS_ENGINE, readDirectionsDir } from '../src/directions';
import { ENGINE_VERSION } from '../src/version';

const dir = process.argv[2] || process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../idem-templates');
const raw = readTemplatesDir(dir);
// Les DA d'abord : les nœuds s'y vérifient, et leurs fiches forment le second instantané.
const rawDirections = readDirectionsDir(dir);
const badDirections = rawDirections.map((d) => ({ d, r: DirectionNode.safeParse(d) })).filter((x) => !x.r.success);
if (badDirections.length) {
  console.error(`✗ ${badDirections.length} direction(s) écartée(s) :\n  ${badDirections.map((x) => `${(x.d as { id?: string }).id}: ${x.r.error?.issues[0]?.path.join('.')} ${x.r.error?.issues[0]?.message}`).join('\n  ')}`);
  process.exit(1);
}
const directionList = (rawDirections as Array<Record<string, any>>).map((n) => ({ id: n.id, name: n.name, surface: n.surface, selectable: n.selectable, radius: n.radius, typeRatio: n.typeRatio, neighbors: n.neighbors, tags: n.tags }));
const checked = buildCatalog(raw, { version: 'snapshot', source: 'dir' }, directionList);
if (checked.rejected.length) {
  console.error(`✗ ${checked.rejected.length} nœud(s) écarté(s) :\n  ${checked.rejected.map((r) => `${r.id}: ${r.reason}`).join('\n  ')}`);
  process.exit(1);
}
const now = new Date().toISOString();
const snapshot = { schema: 1, version: `snapshot-${now.slice(0, 10)}`, builtAt: now, engine: ENGINE_VERSION, license: 'Apache-2.0 + Commons Clause', directions: directionList, entries: raw.map((r) => ({ node: r.node as Record<string, unknown> })) };
const out = path.resolve(__dirname, '../catalog/snapshot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(snapshot));
console.log(`✓ ${path.relative(process.cwd(), out)} — ${raw.length} nœuds (${Math.round(fs.statSync(out).size / 1024)} Ko)`);

const directionsOut = path.resolve(__dirname, '../catalog/directions-snapshot.json');
fs.writeFileSync(directionsOut, JSON.stringify({ schema: 1, medium: 'direction', version: `snapshot-${now.slice(0, 10)}`, builtAt: now, engine: DIRECTIONS_ENGINE, license: 'Apache-2.0 + Commons Clause', entries: rawDirections.map((node) => ({ node })) }));
console.log(`✓ ${path.relative(process.cwd(), directionsOut)} — ${rawDirections.length} directions (${Math.round(fs.statSync(directionsOut).size / 1024)} Ko)`);
