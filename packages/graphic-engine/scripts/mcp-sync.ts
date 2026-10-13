/**
 * MCP — démarre chaque serveur déclaré dans `.mcp.json` (racine du dépôt), liste ses outils et écrit le
 * manifeste compact que le registre de capacités expose aux agents (nom, une ligne, arguments requis :
 * jamais la documentation complète, chargée seulement à la demande).
 *
 *   npm run mcp:sync  --prefix packages/graphic-engine     (réécrit le manifeste)
 *   npm run mcp:check --prefix packages/graphic-engine     (vérifie que chaque serveur démarre et que le manifeste est à jour)
 */
import fs from 'fs';
import path from 'path';
import { listServers, connect, REPO_ROOT } from '../src/capability-registry/mcp/client';
import type { McpManifest } from '../src/capability-registry/mcp/types';

const MANIFEST = path.resolve(__dirname, '../src/capability-registry/mcp/manifest.json');
const check = process.argv.includes('--check');

(async () => {
  const servers = listServers();
  const manifest: McpManifest = { generatedFrom: '.mcp.json', servers: {} };
  let failures = 0;
  for (const name of Object.keys(servers)) {
    const started = Date.now();
    try {
      const session = await connect(name, { timeoutMs: 180_000 });
      const tools = await session.listTools();
      await session.close();
      manifest.servers[name] = {
        tools: tools.map((t) => ({ name: t.name, summary: (t.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 180), required: t.required })),
      };
      console.log(`  ✓ ${name.padEnd(16)} ${tools.length} outil(s) en ${Math.round((Date.now() - started) / 1000)} s — ${tools.map((t) => t.name).join(', ')}`);
    } catch (error) {
      failures += 1;
      console.log(`  ✗ ${name.padEnd(16)} ${(error as Error).message.slice(0, 200)}`);
    }
  }
  if (check) {
    const current = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : null;
    const same = JSON.stringify(current?.servers ?? null) === JSON.stringify(manifest.servers);
    console.log(same ? '  ✓ manifeste à jour' : '  ✗ manifeste périmé : lancer `npm run mcp:sync`');
    if (!same) failures += 1;
  } else {
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`\n→ ${path.relative(REPO_ROOT, MANIFEST)}`);
  }
  process.exit(failures ? 1 : 0);
})();
