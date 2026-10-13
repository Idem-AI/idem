import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { buildVideoTheme } from '../../../../ivision/core/src/video/video.theme';
import { buildStoryboard } from '../../../../ivision/core/src/video/video.storyboard';
import { composeVideoHtml, inlineAssets } from '../../../../ivision/core/src/video/video.composer';
import { brandById } from '../fixtures/motion-video/brands';

const AUD = process.env.AUD!;
const OUT = process.env.OUT!;
(async () => {
  // Serveur de sons lent : 1,5 s avant chaque réponse (connexion modeste).
  const server = http.createServer((req, res) => {
    const file = path.join(AUD, path.basename(req.url || ''));
    setTimeout(() => {
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
      const buf = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length, 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'none' });
      res.end(buf);
    }, 1500);
  }).listen(4799);
  const brand = brandById('wax');
  const theme = buildVideoTheme(brand.branding, brand.name);
  const sb = buildStoryboard({ sceneIds: ['statement', 'statement', 'logo'], slots: [{ title: 'Une idée' }, { title: 'Une entreprise' }, {}], durationSec: 8, style: 'premium', seed: 4, images: [], direction: 'precision' });
  const u = (n: string) => `http://127.0.0.1:4799/${n}.mp3`;
  const { html } = await composeVideoHtml({ ...(await inlineAssets(sb, theme, 'preview')), format: 'square', quality: 'standard', mode: 'preview',
    music: { url: u('music'), startAt: 0 }, sfx: { enabled: true, sounds: { whoosh: { url: u('sfx'), gain: 0.8 } } }, voice: [{ url: u('v1'), at: 0.2, durationSec: 2.5 }, { url: u('v2'), at: 3.2, durationSec: 2 }] });
  fs.writeFileSync(path.join(OUT, 'preview.html'), html);
  const parent = `<!doctype html><html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" allow="autoplay" style="width:400px;height:400px;border:0"></iframe>
  <script>window.log=[];const t0=performance.now();window.addEventListener('message',e=>{if(e.source===document.getElementById('f').contentWindow&&/ivision:(loading|playable|ready)/.test(e.data.type))log.push([Math.round(performance.now()-t0),e.data.type,e.data.loaded,e.data.total])});</script></body></html>`;
  const browser = await puppeteer.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setContent(parent);
  await page.evaluate((h) => { (document.getElementById('f') as HTMLIFrameElement).srcdoc = h; }, html);
  const frameOf = async () => { for (;;) { const f = page.frames().find((x) => x !== page.mainFrame()); if (f) return f; await new Promise((r) => setTimeout(r, 50)); } };
  const frame = await frameOf();
  await new Promise((r) => setTimeout(r, 1200));
  const early = await frame.evaluate(() => { const b = document.querySelector('.pv-big') as HTMLButtonElement | null; return b ? { disabled: b.disabled, html: b.innerHTML } : null; }).catch((e) => String(e));
  console.log('pendant le chargement :', JSON.stringify(early));
  await page.waitForFunction(() => (window as any).log.some((x: any) => x[1] === 'ivision:playable'), { timeout: 60000 });
  const late = await frame.evaluate(() => { const b = document.querySelector('.pv-big') as HTMLButtonElement; return { disabled: b.disabled, html: b.innerHTML }; });
  console.log('après :', JSON.stringify(late));
  console.log('messages :', JSON.stringify(await page.evaluate(() => (window as any).log)));
  // Lecture demandée par le parent (bouton « Voir la vidéo »).
  await page.evaluate(() => (document.getElementById('f') as HTMLIFrameElement).contentWindow!.postMessage({ type: 'ivision:play' }, '*'));
  await new Promise((r) => setTimeout(r, 1500));
  console.log('lecture :', JSON.stringify(await frame.evaluate(() => ({ big: (document.querySelector('.pv-big') as HTMLElement).style.display, time: document.querySelector('.pv-time')?.textContent }))));
  await browser.close();
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
