/**
 * Contrôle des couvertures composées par le moteur graphique (@idem/graphic-engine).
 *
 * Pour chaque toile — charte et deck (16:9), charte A4, business plan (A4 portrait) —, avec un nom
 * court et un nom long, sur quatre projets :
 *   · la couverture est rendue et MESURÉE dans Chromium par le moteur : rien hors de la page, aucun
 *     texte rogné, aucun constat bloquant ;
 *   · elle porte le nom, la promesse, la mention du document et le logo (une image réellement posée) ;
 *   · quatre projets ne reçoivent pas la même couverture.
 * Les rendus sont écrits dans le dossier temporaire, pour relecture.
 *
 *   npm run check:covers
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { brandFromIdem, closeBrowser, coverContent, createDocument, DocumentType, FormatId } from '@idem/graphic-engine';

let failures = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const svg = (markup: string) => `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
const LOGO_DARK_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect x="10" y="14" width="40" height="56" fill="#1A2A4F"/><text x="70" y="66" font-family="sans-serif" font-size="48" font-weight="700" fill="#1A2A4F">Kora</text></svg>');
const LOGO_LIGHT_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect x="10" y="14" width="40" height="56" fill="#fff"/><text x="70" y="66" font-family="sans-serif" font-size="48" font-weight="700" fill="#fff">Kora</text></svg>');

const CANVASES: Array<{ label: string; documentType: DocumentType; format: FormatId; documentLabel: string }> = [
  { label: 'Charte (16:9)', documentType: 'brand-charter', format: 'slide-16x9', documentLabel: 'Charte graphique' },
  { label: 'Charte (A4)', documentType: 'brand-charter', format: 'page-a4', documentLabel: 'Charte graphique' },
  { label: 'Pitch deck (16:9)', documentType: 'pitch-deck', format: 'slide-16x9', documentLabel: 'Pitch deck' },
  { label: 'Business plan (A4 portrait)', documentType: 'business-plan', format: 'a4-portrait', documentLabel: 'Business plan' },
];

const NAMES = ['Kora', 'Maison Kora Torréfaction Artisanale de Douala'];
const PROJECTS = 4;

/** Le texte lisible d'une page (balises retirées, entités et espaces insécables normalisés). */
const textOf = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;| | /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ');

async function main(): Promise<void> {
  const out = path.join(os.tmpdir(), 'idem-covers-check');
  fs.mkdirSync(out, { recursive: true });

  const { brand, direction } = brandFromIdem({
    name: 'Kora',
    branding: {
      colors: { colors: { primary: '#1A2A4F', secondary: '#F4F6FA', accent: '#C79100', background: '#F8F9FB', text: '#0B1220' } },
      typography: { primaryFont: 'Syne', secondaryFont: 'Figtree' },
      artDirection: { styleId: 'swiss' },
    },
    logos: { primary: LOGO_DARK_INK, withTextLight: LOGO_DARK_INK, withTextDark: LOGO_LIGHT_INK },
  });

  for (const canvas of CANVASES) {
    console.log(`\n${canvas.label}`);
    for (const brandName of NAMES) {
      const patterns = new Set<string>();
      const size = brandName.length > 12 ? 'nom long' : 'nom court';
      for (let project = 0; project < PROJECTS; project++) {
        const doc = await createDocument({
          documentType: canvas.documentType,
          format: canvas.format,
          brand: { ...brand, name: brandName },
          direction,
          seed: `check:covers:${canvas.format}:${project}`,
          sections: [{ id: 'cover', role: 'cover' }],
          documentLabel: canvas.documentLabel,
          locale: 'fr',
          png: true,
        });
        const cover = coverContent({
          brandName,
          documentLabel: canvas.documentLabel,
          kicker: 'Torréfaction artisanale',
          promise: 'Le goût du Cameroun, torréfié chaque semaine à Douala',
          detail: 'Version 1.0',
          dateLabel: 'Septembre 2026',
        });
        const { result, png, spec } = await doc.composeSection(cover, { index: 1, total: 10 });
        patterns.add(spec.pattern.id);
        const label = `projet ${project + 1}, ${size} (${spec.pattern.id})`;
        const blocking = result.issues.filter((issue) => issue.severity === 'blocking');
        check(
          `${label} : tient dans la page, mesurée`,
          blocking.length === 0 && (result.measured?.overflowPx ?? 0) <= 1,
          blocking.map((issue) => `${issue.code} : ${issue.message}`).join(' | ') || `débordement ${result.measured?.overflowPx ?? '?'} px`
        );
        const text = textOf(result.html);
        const hasLogo = result.html.includes(LOGO_DARK_INK) || result.html.includes(LOGO_LIGHT_INK);
        check(
          `${label} : nom, promesse, document et logo présents`,
          hasLogo && text.includes(brandName) && text.includes('Cameroun') && text.toLowerCase().includes(canvas.documentLabel.toLowerCase()),
          `${hasLogo ? '' : 'logo absent · '}${text.slice(0, 160)}`
        );
        if (png) fs.writeFileSync(path.join(out, `${canvas.format}-${canvas.documentType}-${size.replace(' ', '-')}-${project + 1}.png`), png);
      }
      // Quatre projets, quatre graines : la couverture ne doit pas être la même pour tous.
      check(`${size} : ${PROJECTS} projets ne reçoivent pas tous la même couverture`, patterns.size >= 2, [...patterns].join(', '));
    }
  }

  await closeBrowser();
  console.log(`\n  Rendus : ${out}`);
  console.log(failures === 0 ? '\n✓ Couvertures conformes\n' : `\n✗ ${failures} contrôle(s) en échec\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await closeBrowser().catch(() => undefined);
  process.exit(1);
});
