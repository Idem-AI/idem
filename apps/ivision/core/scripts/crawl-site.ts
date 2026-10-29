/**
 * Diagnostic du relevé d'un site (sans modèle) : `npm run crawl -- https://exemple.com [pages] [sortie.json]`.
 * Affiche les pages, leurs sections, les images et coordonnées trouvées : ce que la refonte d'iCode recevra.
 */
import fs from 'fs';
import { crawlWebsite } from '../src/site/site-crawler';
(async () => {
  const started = Date.now();
  const inv = await crawlWebsite({ url: process.argv[2], maxPages: Number(process.argv[3] || 20), onProgress: (d, t, u) => console.log(`${d}/${t} ${u}`) });
  if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(inv, null, 2));
  console.log('pages', inv.pages.length, 'sections', inv.pages.reduce((n, p) => n + p.sections.length, 0), 'images', inv.assets.images.length, 'skipped', inv.skipped.length, 's', Math.round((Date.now() - started) / 1000));
  for (const p of inv.pages) console.log('%s | %s | %d sections | %s', p.path, p.title, p.sections.length, p.sections.map((s) => s.headings[0] || s.texts[0]?.slice(0, 30) || `[${s.images.length} img]`).join(' / ').slice(0, 300));
  console.log('languages', JSON.stringify(inv.languages));
  console.log('nav', inv.navigation.map((n) => n.label).join(', '));
  console.log('contact', JSON.stringify(inv.contact));
  console.log('favicon', inv.assets.favicon, 'og', inv.assets.ogImage);
})().catch((e) => { console.error(e); process.exit(1); });
