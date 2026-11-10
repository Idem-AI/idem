import fs from 'fs';
const S = process.argv[2];
process.env.IDEM_TEMPLATES_URL = 'http://127.0.0.1:8765';
process.env.IDEM_TEMPLATES_PUBKEY = fs.readFileSync(`${S}/pub.txt`, 'utf8').trim();
process.env.IDEM_TEMPLATES_CACHE = `${S}/tplcache`;
delete process.env.IDEM_TEMPLATES_DIR;
import { catalog, ensureHtml, refreshCatalog, resetCatalog } from '../../src/catalog/registry';
(async () => {
  fs.rmSync(`${S}/tplcache`, { recursive: true, force: true });
  let c = await catalog();
  console.log('1 source', c.source, 'nodes', c.nodes.size, 'rejected', c.rejected.length, 'htmlRefs', c.htmlRefs.size);
  const ids = ['metrics.row', 'cards.grid', 'cover.stack'];
  console.log('2 html', [...(await ensureHtml(c, ids)).entries()].join(' '), 'cached files', fs.readdirSync(`${S}/tplcache/html`).length);
  // Altération d'un HTML servi : refusé par l'empreinte
  const f = `${S}/served/html/quote.big.html`;
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('flex', 'flex-row'));
  console.log('3 tampered html accepted?', (await ensureHtml(c, ['quote.big'])).get('quote.big'));
  // Manifeste altéré : refusé, l'ancien reste servi
  const m = JSON.parse(fs.readFileSync(`${S}/served/manifest.json`, 'utf8'));
  m.version = 'forged'; fs.writeFileSync(`${S}/served/manifest.json`, JSON.stringify(m));
  const r = await refreshCatalog();
  console.log('4 after forged manifest: version', r.version, '(forged refused =', r.version !== 'forged', ')');
  // CDN injoignable au démarrage : le cache disque prend le relais
  resetCatalog();
  process.env.IDEM_TEMPLATES_URL = 'http://127.0.0.1:9';
  c = await catalog();
  console.log('5 cdn down → source', c.source, 'nodes', c.nodes.size);
})();
