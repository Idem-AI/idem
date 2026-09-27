/**
 * Contrôle des couvertures composées par le code (`design/coverComposer.ts`).
 *
 * Pour chaque composition, en paysage (charte, deck) et en portrait (plan),
 * avec un nom court et un nom long :
 *   · la page porte le nom, la promesse, la mention du document et le logo ;
 *   · aucun élément ne sort de la page ;
 *   · aucun texte n'est rogné (hauteur de contenu ≤ hauteur de sa boîte).
 * Les rendus sont écrits dans le dossier temporaire, pour relecture.
 *
 *   npm run check:covers
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { buildDocumentSeed } from '../services/design/designSeed';
import { composeCover, coverDateLabel } from '../services/design/coverComposer';
import { LANDSCAPE_SLIDE, PORTRAIT_A4 } from '../services/design/sectionRenderer';
import { designFontLinks } from '../utils/google-fonts.util';

let failures = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const svg = (markup: string) => `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
const LOGO_DARK_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect x="10" y="14" width="40" height="56" fill="#1A2A4F"/><text x="70" y="66" font-family="sans-serif" font-size="48" font-weight="700" fill="#1A2A4F">Kora</text></svg>');
const LOGO_LIGHT_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect x="10" y="14" width="40" height="56" fill="#fff"/><text x="70" y="66" font-family="sans-serif" font-size="48" font-weight="700" fill="#fff">Kora</text></svg>');

const BRIEF = {
  kicker: 'Torréfaction artisanale',
  promise: 'Le goût du Cameroun, torréfié chaque semaine à Douala',
  highlight: 'Cameroun',
};

async function main(): Promise<void> {
  const out = path.join(os.tmpdir(), 'idem-covers-check');
  fs.mkdirSync(out, { recursive: true });

  const ds = buildDocumentDesignSystem(
    {
      colors: { colors: { primary: '#1A2A4F', secondary: '#F4F6FA', accent: '#C79100', background: '#F8F9FB', text: '#0B1220' } },
      typography: { primaryFont: 'Syne', secondaryFont: 'Figtree' },
    } as never,
    { styleId: 'swiss' } as never,
    buildDocumentSeed('swiss', 'check:covers')
  );

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  for (const format of [LANDSCAPE_SLIDE, PORTRAIT_A4]) {
    console.log(`\n${format.orientation === 'landscape' ? 'Paysage 16:9' : 'A4 portrait'}`);
    for (const brandName of ['Kora', 'Maison Kora Torréfaction Artisanale de Douala']) {
      for (let variant = 0; variant < 4; variant++) {
        const html = composeCover({
          brief: BRIEF,
          brandName,
          ds,
          page: format,
          logos: { lightGround: LOGO_DARK_INK, darkGround: LOGO_LIGHT_INK },
          documentLabel: 'Charte graphique',
          detail: 'Version 1.0',
          dateLabel: coverDateLabel(new Date('2026-09-26')),
          variant,
        });
        await page.setContent(
          `<!doctype html><html><head><meta charset="utf-8">${designFontLinks(ds.fonts)}<style>html,body{margin:0}</style></head><body>${html}</body></html>`,
          { waitUntil: 'load', timeout: 60000 }
        );
        await page.evaluate(() => document.fonts.ready);
        const report = await page.evaluate(() => {
          const root = document.querySelector('[data-idem-cover]') as HTMLElement;
          const box = root.getBoundingClientRect();
          const outside = [...root.querySelectorAll('*')].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1);
          }).length;
          // Un texte est « rogné » s'il déborde de la boîte absolue qui le porte :
          // c'est elle qui a une hauteur, pas le paragraphe.
          const clippedList = [...root.querySelectorAll('h1, p')]
            .map((el) => {
              const r = el.getBoundingClientRect();
              let holder = el.parentElement;
              while (holder && holder !== root && getComputedStyle(holder).position !== 'absolute') holder = holder.parentElement;
              const h = (holder ?? root).getBoundingClientRect();
              return r.bottom > h.bottom + 2 || r.top < h.top - 2 ? `${el.tagName} ${Math.round(r.bottom - h.bottom)}px` : '';
            })
            .filter(Boolean);
          const clipped = clippedList.length;
          return {
            outside,
            clipped,
            clippedList,
            // Présent ET affiché : une balise sans taille ne se voit pas.
            hasLogo: [...root.querySelectorAll('img')].some((img) => {
              const r = img.getBoundingClientRect();
              return (img as HTMLImageElement).naturalWidth > 0 && r.width > 8 && r.height > 4;
            }),
            text: root.innerText,
            width: box.width,
            height: box.height,
          };
        });
        const label = `composition ${variant}, « ${brandName.length > 12 ? 'nom long' : 'nom court'} »`;
        check(
          `${label} : tient dans la page`,
          report.outside === 0 && report.clipped === 0,
          report.outside || report.clipped ? `${report.outside} hors page, rogné : ${report.clippedList.join(', ')}` : ''
        );
        check(
          `${label} : nom, promesse, document et logo présents`,
          report.hasLogo && report.text.includes(brandName) && report.text.includes('Cameroun') && /charte graphique/i.test(report.text)
        );
        const shot = path.join(out, `${format.orientation}-${brandName.length > 12 ? 'long' : 'short'}-${variant}.png`);
        await page.setViewport({ width: Math.ceil(report.width), height: Math.ceil(report.height) });
        await page.screenshot({ path: shot as `${string}.png`, clip: { x: 0, y: 0, width: report.width, height: report.height } });
      }
    }
  }

  await browser.close();
  console.log(`\n  Rendus : ${out}`);
  console.log(failures === 0 ? '\n✓ Couvertures conformes\n' : `\n✗ ${failures} contrôle(s) en échec\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
