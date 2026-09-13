/**
 * Contrôle de la bibliothèque de mockups de réseaux sociaux.
 *
 * Un gabarit HTML se retouche à la main : c'est son intérêt, et c'est aussi ce
 * qui le fait dériver. Un emplacement renommé, une largeur de couverture
 * modifiée dans le CSS mais pas dans le manifeste, et la bannière sort
 * recadrée — sans erreur nulle part. Ce contrôle rend chaque gabarit dans un
 * vrai Chrome et vérifie :
 *
 *   1. que ses marqueurs sont connus et que ses emplacements déclarés existent ;
 *   2. que la taille du `body` est celle du manifeste ;
 *   3. qu'il ne déborde pas en largeur une fois rempli ;
 *   4. que la couverture et le visuel ont EXACTEMENT la taille à laquelle la
 *      bannière et le visuel sont composés ;
 *   5. que le service rend deux profils et deux publications de bout en bout.
 *
 * Les images du point 5 sont écrites dans le dossier temporaire, pour relecture.
 *
 *   npm run check:mockups
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { buildDocumentSeed } from '../services/design/designSeed';
import {
  fillMockupTemplate,
  loadSocialMockupLibrary,
  MockupValues,
  readMockupTemplate,
} from '../services/BandIdentity/socialMockups/library';
import {
  SocialBrandKit,
  socialMockupService,
} from '../services/BandIdentity/socialMockups/socialMockup.service';
import { flyerRenderService } from '../services/Communication/flyerRender.service';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
};

const KNOWN = new Set([
  'brandName', 'handle', 'category', 'bio', 'postText', 'caption', 'hashtags', 'title',
  'avatarSrc', 'avatarGround', 'mediaSrc', 'coverHtml', 'mediaHtml', 'tiles', 'fontLinks',
]);

const svg = (markup: string) => `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
const LOGO = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="22" y="14" width="40" height="56" fill="#fff"/><rect x="42" y="56" width="20" height="30" fill="#fff"/></svg>');
const LOGO_DARK_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect x="10" y="14" width="40" height="56" fill="#1A2A4F"/><text x="70" y="66" font-family="sans-serif" font-size="48" font-weight="700" fill="#1A2A4F">Kora</text></svg>');
const LOGO_LIGHT_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect x="10" y="14" width="40" height="56" fill="#fff"/><text x="70" y="66" font-family="sans-serif" font-size="48" font-weight="700" fill="#fff">Kora</text></svg>');
const MEDIA_MARK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2L//PwAHAwMCP3DkqQAAAABJRU5ErkJggg==';

const LONG_NAME = 'Maison Kora Torréfaction Artisanale de Douala';

async function main() {
  const templates = loadSocialMockupLibrary();
  console.log(`\nBibliothèque : ${templates.length} gabarit(s)`);
  check('la bibliothèque contient des gabarits', templates.length > 0);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const template of templates) {
      console.log(`\n${template.id} (${template.width} × ${template.height})`);
      const html = readMockupTemplate(template);

      const markers = [...html.matchAll(/\{\{\{?\s*([A-Za-z]+)\s*\}?\}\}/g)].map((match) => match[1]);
      const unknown = [...new Set(markers.filter((marker) => !KNOWN.has(marker)))];
      check('marqueurs connus', unknown.length === 0, unknown.join(', '));
      if (template.cover) check('emplacement de couverture présent', html.includes('{{{coverHtml}}}'));
      if (template.media?.format === 'thumbnail') check('emplacement de vignette présent', html.includes('{{{mediaHtml}}}'));
      if (template.media && template.media.format !== 'thumbnail') check('emplacement de visuel présent', html.includes('{{mediaSrc}}'));
      if (template.tiles) check('emplacement de tuiles présent', html.includes('{{{tiles}}}'));

      const body = html.match(/body\{width:(\d+)px;height:(\d+)px/);
      check(
        'taille du body = manifeste',
        Boolean(body) && Number(body![1]) === template.width && Number(body![2]) === template.height,
        body ? `${body[1]} × ${body[2]}` : 'body sans taille'
      );

      // Rempli avec des textes LONGS : c'est là qu'un gabarit déborde.
      const values: MockupValues = {
        brandName: LONG_NAME,
        handle: 'maisonkoratorrefactionartisanale',
        category: 'Torréfaction artisanale et distribution de café',
        bio: 'Le goût du Cameroun, torréfié chaque semaine à Douala pour les cafés, les bureaux et les maisons de la ville.',
        postText: 'Notre nouvelle identité est en ligne. Découvrez nos cafés de spécialité, torréfiés chaque semaine à Douala pour les cafés et les bureaux de la ville, livrés en vingt-quatre heures.',
        caption: 'Nouvelle identité, même exigence pour chaque tasse servie à Douala.',
        hashtags: '#cafe #douala #torrefaction',
        title: 'Maison Kora, du grain à la tasse, une histoire de torréfaction',
        avatarSrc: LOGO,
        avatarGround: '#1A2A4F',
        mediaSrc: MEDIA_MARK,
        coverHtml: '<div data-check="cover" style="width:100%;height:100%;background:#1A2A4F"></div>',
        mediaHtml: '<div data-check="media" style="width:100%;height:100%;background:#C79100"></div>',
        tiles: Array.from({ length: template.tiles?.count ?? 0 }, () => '<div style="width:100%;height:100%;background:#C79100"></div>').join(''),
        fontLinks: '',
      };

      const page = await browser.newPage();
      await page.setViewport({ width: template.width, height: template.height });
      await page.setContent(fillMockupTemplate(html, values, template.id), { waitUntil: 'load' });
      const measured = await page.evaluate((mediaMark: string) => {
        const rect = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
        const cover = rect(document.querySelector('[data-check="cover"]'));
        const thumb = rect(document.querySelector('[data-check="media"]'));
        const media = rect(Array.from(document.images).find((img) => img.getAttribute('src') === mediaMark)?.parentElement ?? null);
        return {
          scrollWidth: document.documentElement.scrollWidth,
          cover: cover && { w: Math.round(cover.width), h: Math.round(cover.height) },
          thumb: thumb && { w: Math.round(thumb.width), h: Math.round(thumb.height) },
          media: media && { w: Math.round(media.width), h: Math.round(media.height) },
        };
      }, MEDIA_MARK);
      await page.close();

      check('aucun débordement en largeur', measured.scrollWidth <= template.width, `${measured.scrollWidth} px`);
      if (template.cover) {
        check(
          `couverture ${template.cover.width} × ${template.cover.height}`,
          measured.cover?.w === template.cover.width && measured.cover?.h === template.cover.height,
          measured.cover ? `${measured.cover.w} × ${measured.cover.h}` : 'introuvable'
        );
      }
      if (template.media) {
        const got = template.media.format === 'thumbnail' ? measured.thumb : measured.media;
        check(
          `visuel ${template.media.width} × ${template.media.height}`,
          got?.w === template.media.width && got?.h === template.media.height,
          got ? `${got.w} × ${got.h}` : 'introuvable'
        );
      }
    }
  } finally {
    await browser.close();
  }

  // ── BOUT EN BOUT ────────────────────────────────────────────────────────
  console.log('\nService : sélection, bannière, visuel de secours, rendu');
  const out = path.join(os.tmpdir(), 'idem-social-mockups-check');
  fs.mkdirSync(out, { recursive: true });

  const seed = buildDocumentSeed('swiss', 'check:mockups');
  const ds = buildDocumentDesignSystem(
    {
      colors: { colors: { primary: '#1A2A4F', secondary: '#F4F6FA', accent: '#C79100', background: '#F8F9FB', text: '#0B1220' } },
      typography: { primaryFont: 'Syne', secondaryFont: 'Figtree' },
    } as never,
    { styleId: 'swiss' } as never,
    seed
  );

  for (const audience of ['b2b', 'b2c'] as const) {
    const kit: SocialBrandKit = {
      projectKey: `check-${audience}`,
      brandName: 'Maison Kora',
      handle: 'maisonkora',
      category: 'Torréfaction artisanale',
      promise: 'Le goût du Cameroun, torréfié à Douala',
      bio: 'Cafés de spécialité torréfiés chaque semaine à Douala.',
      posts: [
        { title: 'Notre nouvelle identité', hook: 'Même exigence, nouvelle signature.', description: 'Des cafés torréfiés chaque semaine à Douala.', hashtags: ['cafe', 'douala'] },
        { title: 'Du grain à la tasse', hook: 'Chaque lot est torréfié à la commande.', description: 'La torréfaction se fait à Douala, en petits lots.', hashtags: ['torrefaction'] },
      ],
      audience,
      videoLed: audience === 'b2c',
      ds,
      logos: { lightGround: LOGO_DARK_INK, darkGround: LOGO_LIGHT_INK },
    };
    const upload = async (image: Buffer, name: string) => {
      const file = path.join(out, `${audience}-${name}.jpg`);
      fs.writeFileSync(file, image);
      return file;
    };
    const profiles = await socialMockupService.renderProfileMockups(kit, upload);
    check(`${audience} : deux profils rendus (${profiles.map((p) => p.label).join(', ')})`, profiles.length === 2);
    const posts = await socialMockupService.renderPostMockups(kit, async () => null, upload);
    check(`${audience} : deux publications rendues (${posts.map((p) => p.label).join(', ')})`, posts.length === 2);
  }
  console.log(`\n  Images : ${out}`);

  await (flyerRenderService as any).constructor.browser?.close?.();
  console.log(failures === 0 ? '\n✓ Bibliothèque de mockups conforme\n' : `\n✗ ${failures} contrôle(s) en échec\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
