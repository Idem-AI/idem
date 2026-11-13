/**
 * L'INSTANTANÉ EMBARQUÉ du catalogue VIDÉO — `npm run catalog:video-snapshot [-- <dossier idem-templates>]`.
 *
 * Copie `catalog/videos/` du dépôt de gabarits dans `catalog/video-snapshot.json` (HTML des mises en page compris) :
 * c'est le repli quand ni le dépôt, ni le CDN, ni le cache disque ne répondent. À relancer de temps en temps (le
 * catalogue en ligne reste la source vivante). Refuse d'écrire un instantané dont un nœud serait écarté.
 */
import fs from 'fs';
import path from 'path';
import { readDirectionsDir } from '@idem/graphic-engine';
import { buildVideoCatalog, readVideoTemplatesDir, VIDEO_CATALOG_ENGINE } from '../src/video/catalog/registry';

const dir = process.argv[2] || process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../../idem-templates');
const raw = readVideoTemplatesDir(dir);
// La liste des DA voyage avec l'instantané : chaque nœud s'y vérifie, et le filtre par DA reste actif hors ligne.
const directions = (readDirectionsDir(dir) as Array<Record<string, any>>).map((n) => ({ id: n.id, name: n.name, surface: n.surface, selectable: n.selectable, radius: n.radius, typeRatio: n.typeRatio, neighbors: n.neighbors, tags: n.tags }));
const checked = buildVideoCatalog(raw, 'snapshot', 'dir', directions);
if (checked.rejected.length || !raw.length) {
  console.error(`✗ ${raw.length ? `${checked.rejected.length} nœud(s) écarté(s) :\n  ${checked.rejected.map((r) => `${r.id}: ${r.reason}`).join('\n  ')}` : `aucun nœud vidéo dans ${dir}`}`);
  process.exit(1);
}
const now = new Date().toISOString();
const snapshot = { schema: 1, medium: 'video', version: `snapshot-${now.slice(0, 10)}`, builtAt: now, engine: VIDEO_CATALOG_ENGINE, license: 'Apache-2.0 + Commons Clause', directions, entries: raw };
const out = path.resolve(__dirname, '../catalog/video-snapshot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(snapshot));
console.log(`✓ ${path.relative(process.cwd(), out)} — ${raw.length} nœuds (${Math.round(fs.statSync(out).size / 1024)} Ko)`);
