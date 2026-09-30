/**
 * Dessine toutes les images de partage dans un dossier, pour les regarder
 * d'un coup après une retouche du gabarit, des textes ou des illustrations.
 *
 *   npm run og:render -- <dossier>      (défaut : tmp/og)
 */
import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { ogImageService } from '../services/og/ogImage.service';
import { PdfService } from '../services/pdf.service';

async function main(): Promise<void> {
  const out = path.resolve(process.argv[2] || path.join('tmp', 'og'));
  mkdirSync(out, { recursive: true });
  const ogDir = path.join(process.cwd(), 'public', 'og');
  const langs = readdirSync(path.join(ogDir, 'i18n')).map((f) => path.basename(f, '.json'));
  const keys = readdirSync(path.join(ogDir, 'illustrations')).map((f) => path.basename(f, '.svg'));
  for (const lang of langs) {
    for (const key of keys) {
      if (!ogImageService.has(lang, key)) {
        console.warn(`✘ ${lang}/${key} : textes manquants`);
        continue;
      }
      const { png } = await ogImageService.renderPng(lang, key);
      writeFileSync(path.join(out, `${lang}-${key}.png`), png);
      console.log(`✔ ${lang}/${key}`);
    }
  }
  console.log(`\n${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => PdfService.closeBrowser().catch(() => undefined).finally(() => process.exit()));
