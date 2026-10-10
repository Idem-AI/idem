/**
 * `npm run check:video:layouts` — chaque mise en page de la vidéo, textes à la longueur
 * MAXIMALE de leurs cases, dans les quatre formats : aucun texte hors cadre, aucun texte trop
 * large pour sa boîte.
 *
 * Le pipeline tire sa graine au hasard (variété voulue) : `check:video` n'essaie qu'une
 * combinaison par passage, et un débordement rare ne s'y montre qu'une fois sur plusieurs. Ici,
 * toutes les combinaisons que le serveur peut attribuer sont rendues, au pire cas de longueur.
 * Les icônes sont posées comme en production. Option : liste de mises en page en argument
 * (`-- gridCards,circleStage`).
 */
import puppeteer from 'puppeteer';
import { buildVideoTheme } from '../../../ivision/core/src/video/video.theme';
import { buildStoryboard } from '../../../ivision/core/src/video/video.storyboard';
import { composeVideoHtml, inlineAssets } from '../../../ivision/core/src/video/video.composer';
import { assignIcons } from '../../../ivision/core/src/video/video.capabilities';
import { SCENES } from '../../../ivision/core/src/video/video.scenes';
import { LAYOUT_CATALOGUE, layoutFits } from '../../../ivision/core/src/video/video.layouts';
import { DIRECTION_IDS } from '../../../ivision/core/src/video/video.direction';
import { brandById } from './fixtures/motion-video/brands';
const WORDS = 'Ouverture de notre deuxième boutique à Cocody samedi avec des prix justes livrés chez vous partout en ville depuis Lomé et Abidjan'.split(' ');
const fill = (max: number, key: string) => {
  if (key === 'price' || key === 'oldPrice') return '15 000 F CFA'.slice(0, max);
  if (key === 'value') return '12 000'.slice(0, max);
  if (key === 'badge') return '-25 %';
  let out = '';
  for (let i = 0; ; i++) { const w = WORDS[i % WORDS.length]; if ((out ? out.length + 1 : 0) + w.length > max) break; out = out ? `${out} ${w}` : w; }
  return out;
};
const baseKit = (): any => ({ background: 'none', backdropScenes: [], annotate: 'none', logo: 'classic', iconSet: 'lucide', icons: {}, postfx: [], addons: [], trace: [] });
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const brand = brandById('wax');
  const theme = buildVideoTheme(brand.branding, brand.name);
  let fails = 0;
  let total = 0;
  console.log('Mises en page de la vidéo, textes au plus long (Chromium)');
  const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const layouts = only ? only.split(',') : [...Object.keys(LAYOUT_CATALOGUE), 'classic'];
  for (const layout of layouts) {
    const scenes = layout === 'classic' ? ['hook', 'statement', 'benefits', 'stat', 'cta', 'event', 'offer', 'quote'] : (LAYOUT_CATALOGUE as any)[layout].scenes;
    for (const sceneId of scenes) {
      const def = (SCENES as any)[sceneId];
      if (!def) continue;
      const slots: Record<string, string> = {};
      for (const sl of def.slots) if (sl.key !== 'icons') slots[sl.key] = fill(sl.max, sl.key);
      const direction = layout === 'classic' ? 'precision' : DIRECTION_IDS.find((d) => layoutFits(layout, { sceneId, slots } as any, { direction: d, excluded: [] } as any));
      // Contenu que le serveur n'attribuerait pas à cette mise en page (ex. prix trop long pour le chiffre géant).
      if (!direction) continue;
      for (const format of ['square', 'portrait', 'story', 'landscape'] as const) {
        total++;
        const sb = buildStoryboard({ sceneIds: [sceneId, 'logo'], slots: [slots, {}], durationSec: 8, style: 'premium', seed: 7, images: [], direction: direction as any });
        sb.kit = { ...baseKit(), icons: assignIcons(sb.scenes as any) };
        if (layout !== 'classic') sb.scenes[0].layout = layout as any;
        else delete (sb.scenes[0] as any).layout;
        sb.beat = { bpm: 120, offset: 0, confidence: 1 } as any;
        const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format, quality: 'standard', mode: 'render' });
        const page = await browser.newPage();
        await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
        await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), sb.scenes[0].duration * 0.8);
        const out = await page.evaluate(() => {
          const res: string[] = [];
          const scene = document.querySelectorAll('section.scene')[0] as HTMLElement;
          const stage = document.getElementById('stage')!.getBoundingClientRect();
          scene.querySelectorAll('[data-fit]').forEach((el) => { const e = el as HTMLElement; if (e.scrollWidth > e.clientWidth + 2) res.push(`large « ${e.textContent?.trim().slice(0, 24)} »`); });
          scene.querySelectorAll('.safe .kt, .safe .btn, .safe .price, .safe .badge, .safe .tagline').forEach((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            if (!r.width) return;
            if (r.left < stage.left - 2 || r.right > stage.right + 2 || r.top < stage.top - 2 || r.bottom > stage.bottom + 2) res.push(`hors cadre « ${(el as HTMLElement).textContent?.trim().slice(0, 24)} »`);
          });
          return res;
        });
        if (out.length) {
          fails++;
          console.log(`  ✗ ${layout} / ${sceneId} / ${direction} · ${format} : ${out.slice(0, 3).join(' ; ')}`);
        }
        await page.close();
      }
    }
  }
  console.log(fails ? `\n✗ ${fails}/${total} rendu(s) avec débordement.` : `\n✓ ${total}/${total} rendus : rien ne déborde, textes au plus long.`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
