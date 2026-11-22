/**
 * Contrôle de l'accès aux sites (`site/site-reach.ts`, `resolveHost`) — réseau réel, aucun modèle.
 *
 *   npx tsx scripts/check-site-reach.ts [url…]
 *
 * Pour chaque adresse : la résolution (système, DNS direct, résolveurs publics), l'adresse retenue, les noms épinglés
 * dans Chrome, puis l'ouverture réelle de la page derrière la garde réseau du scan (titre, statut, adresse finale).
 * Sans argument : eknumerik.org (inconnu de certaines box ; depuis le 21/11/2026 son `www` redirige vers un nom nu sans
 * adresse : le message doit le DIRE), son adresse provisoire Hostinger (lente : ne doit jamais être « ne répond pas »),
 * un site courant, et un nom inexistant. L'ouverture est celle du relevé (`openDocument`).
 */
import puppeteer from 'puppeteer';
import { installRenderNetworkGuard, RENDER_BROWSER_ARGS, resolveHost } from '../src/render/network-guard';
import { safeFetch } from '../src/render/safe-fetch';
import { reachSite, unreachableMessage } from '../src/site/site-reach';
import { openDocument } from '../src/site/site-crawler';

const urls = process.argv.slice(2).length ? process.argv.slice(2) : ['https://eknumerik.org/', 'https://lightpink-wombat-204826.hostingersite.com/', 'https://www.wikipedia.org/', 'https://ce-domaine-n-existe-pas-idem-9431.cm/'];

(async () => {
  let failed = 0;
  for (const raw of urls) {
    const host = new URL(raw).hostname;
    const resolved = await resolveHost(host);
    const reach = await reachSite(raw);
    console.log(`\n${raw}\n  résolution : ${resolved.via} ${resolved.addresses.slice(0, 2).join(', ')}`);
    if (!reach.ok) {
      console.log(`  injoignable (${reach.reason}) : ${unreachableMessage(reach)}`);
      if (!/n-existe-pas/.test(raw)) failed += 1;
      continue;
    }
    console.log(`  départ : ${reach.url}${reach.pinned.length ? `\n  épinglé dans Chrome : ${reach.pinned.join(' ; ')}` : ''}`);
    const browser = await puppeteer.launch({ headless: true, args: [...RENDER_BROWSER_ARGS, '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable', ...reach.chromeArgs] });
    try {
      const page = await browser.newPage();
      await installRenderNetworkGuard(page);
      const response = await openDocument(page, reach.url, 25_000);
      const title = await page.title();
      console.log(`  ✓ ouvert : HTTP ${response?.status()} — « ${title.slice(0, 70)} » — ${page.url()}`);
      const image = await page.evaluate(() => (Array.from(document.images).find((i) => i.currentSrc && i.currentSrc.startsWith('http')) as HTMLImageElement | undefined)?.currentSrc ?? '');
      if (image) {
        const file = await safeFetch(image, { accept: ['image/'], timeoutMs: 20_000 }).catch((e: Error) => e);
        console.log(file instanceof Error ? `  ✗ image : ${file.message}` : `  ✓ image recopiable : ${file.mimeType} ${Math.round(file.buffer.length / 1024)} Ko`);
        if (file instanceof Error) failed += 1;
      }
    } catch (error) {
      const message = (error as Error).message;
      // Une redirection vers un nom sans adresse est une panne du site : bien expliquée, ce n'est pas un échec.
      if (/redirige vers .+ aucune adresse/.test(message)) console.log(`  ✓ panne du site expliquée : ${message.replace(/^unreachable: /, '')}`);
      else {
        failed += 1;
        console.log(`  ✗ ${message.slice(0, 160)}`);
      }
    } finally {
      await browser.close();
    }
  }
  console.log(failed ? `\n${failed} échec(s)` : '\nTout est bon');
  process.exit(failed ? 1 : 0);
})();
