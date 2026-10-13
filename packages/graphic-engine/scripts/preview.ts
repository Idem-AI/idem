/**
 * APERÇU — fait passer des livrables complets par TOUT le moteur (plan, composition, compilation, mesure,
 * réparation) et assemble des planches contact, pour REGARDER les rendus (c'est le seul verdict).
 *
 *   npm run preview --prefix packages/graphic-engine [-- --level high] [-- --only deck,bp]
 *
 * Écrit dans `scratch/graphic-engine-preview/` (ignoré par git).
 */
import fs from 'fs';
import path from 'path';
import type { CreativityLevel, DocumentType, FormatId } from '../src/contracts/common';
import type { SectionContent } from '../src/contracts/content-model';
import { createDocument } from '../src/engine';
import { closeBrowser, pageDocument, screenshot } from '../src/quality-engine/browser';
import { FORMATS } from '../src/design-system/formats';
import { BRANDS, CARD_BACK, CARD_FRONT, CARD_VALUES, CHARTER, coverSection, FINANCE_BP, flyer, MARKET, PROBLEM, SUMMARY_BP, SWOT_BP, TEAM, TRACTION, ASK } from './fixtures';

// Outil de développement : sharp est installé par l'API (planches contact seulement, jamais dans le moteur).
import sharp from 'sharp';

const OUT = path.resolve(__dirname, '../../../scratch/graphic-engine-preview');
const args = process.argv.slice(2);
const level = (args[args.indexOf('--level') + 1] as CreativityLevel) && args.includes('--level') ? (args[args.indexOf('--level') + 1] as CreativityLevel) : 'medium';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

interface Job {
  name: string;
  documentType: DocumentType;
  format: FormatId;
  brand: keyof typeof BRANDS;
  label: string;
  sections: SectionContent[];
  bindings?: 'values' | 'markers';
}

const JOBS: Job[] = [
  { name: 'deck-kora', documentType: 'pitch-deck', format: 'slide-16x9', brand: 'kora', label: 'Pitch deck', sections: [coverSection('Kora', 'Pitch deck', 'Torréfaction artisanale', 'Le goût du Cameroun, torréfié chaque semaine à Douala'), PROBLEM, MARKET, TRACTION, TEAM, ASK] },
  { name: 'deck-kofi', documentType: 'pitch-deck', format: 'slide-16x9', brand: 'kofi', label: 'Pitch deck', sections: [coverSection('Kofi', 'Pitch deck', 'Formation numérique', 'Former 10 000 femmes au numérique d’ici 2028'), PROBLEM, MARKET, TRACTION, TEAM, ASK] },
  { name: 'bp-baobab', documentType: 'business-plan', format: 'a4-portrait', brand: 'baobab', label: 'Business plan', sections: [coverSection('Baobab Agro', 'Business plan', 'Agriculture durable', 'Transformer le manioc de l’Est en farine certifiée'), SUMMARY_BP, FINANCE_BP, SWOT_BP] },
  { name: 'charter-kora', documentType: 'brand-charter', format: 'slide-16x9', brand: 'kora', label: 'Charte graphique', sections: [coverSection('Kora', 'Charte graphique', 'Torréfaction artisanale', 'Le goût du Cameroun, torréfié chaque semaine à Douala'), ...CHARTER(BRANDS.kora)] },
  { name: 'card-kora', documentType: 'business-card', format: 'card-landscape', brand: 'kora', label: 'Carte', sections: [CARD_FRONT, CARD_BACK], bindings: 'markers' },
  { name: 'card-kora-values', documentType: 'business-card', format: 'card-landscape', brand: 'kora', label: 'Carte', sections: [CARD_VALUES], bindings: 'values' },
  { name: 'flyer-kofi-square', documentType: 'flyer', format: 'flyer-square', brand: 'kofi', label: 'Visuel', sections: [flyer(true, { a: '#3a1c4a', b: '#d6246e', c: '#1f1530' })] },
  { name: 'flyer-kofi-type', documentType: 'flyer', format: 'flyer-square', brand: 'kofi', label: 'Visuel', sections: [flyer(false, { a: '#000', b: '#000', c: '#000' })] },
  { name: 'flyer-kora-story', documentType: 'flyer', format: 'flyer-story', brand: 'kora', label: 'Visuel', sections: [flyer(true, { a: '#1a2a4f', b: '#c9a227', c: '#0b1426' })] },
];

async function sheet(files: string[], target: string, columns: number): Promise<void> {
  const thumbs = await Promise.all(files.map(async (f) => sharp(f).resize({ width: 560, withoutEnlargement: false }).png().toBuffer({ resolveWithObject: true })));
  const w = 560;
  const rows: number[] = [];
  thumbs.forEach((t, i) => {
    const r = Math.floor(i / columns);
    rows[r] = Math.max(rows[r] ?? 0, t.info.height);
  });
  const gap = 16;
  const width = columns * w + (columns + 1) * gap;
  const height = rows.reduce((a, b) => a + b, 0) + (rows.length + 1) * gap;
  const composite = thumbs.map((t, i) => {
    const r = Math.floor(i / columns);
    const top = gap + rows.slice(0, r).reduce((a, b) => a + b + gap, 0);
    return { input: t.data, left: gap + (i % columns) * (w + gap), top };
  });
  await sharp({ create: { width, height, channels: 3, background: '#3a3a3a' } }).composite(composite).png().toFile(target);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const job of JOBS) {
    if (only && !only.some((o) => job.name.startsWith(o))) continue;
    const brand = BRANDS[job.brand];
    const doc = await createDocument({ documentType: job.documentType, format: job.format, locale: 'fr', brand, direction: { styleId: brand.styleId }, creativity: level, seed: `preview:${job.name}`, documentLabel: job.label, sections: job.sections.map((s) => ({ id: s.id, role: s.role })), bindings: job.bindings });
    const dir = path.join(OUT, job.name);
    fs.mkdirSync(dir, { recursive: true });
    const files: string[] = [];
    let i = 0;
    for (const section of job.sections) {
      i += 1;
      const out = await doc.composeSection(section, { index: i, total: job.sections.length });
      const f = FORMATS[job.format];
      const png = await screenshot(pageDocument(out.result.html, doc.head), { width: f.width, height: f.height, scale: job.format.startsWith('card') ? 2 : 1 });
      const file = path.join(dir, `${String(i).padStart(2, '0')}-${section.id}.png`);
      fs.writeFileSync(file, png);
      fs.writeFileSync(file.replace(/\.png$/, '.html'), pageDocument(out.result.html, doc.head));
      files.push(file);
      const blocking = out.result.issues.filter((x) => x.severity === 'blocking').map((x) => x.code);
      console.log(`${job.name.padEnd(18)} ${section.id.padEnd(16)} ${out.spec.pattern.id.padEnd(22)} ${out.spec.strategy.padEnd(18)} ${out.spec.tension.padEnd(13)} ${out.spec.accent.padEnd(9)} fill=${out.result.measured?.fill ?? '-'} over=${out.result.measured?.overflowPx ?? '-'} rep=${out.result.repairs.length}${blocking.length ? ` BLOQUANT=${blocking.join(',')}` : ''}`);
    }
    await sheet(files, path.join(OUT, `${job.name}.png`), job.format === 'a4-portrait' ? 4 : job.format.startsWith('flyer-story') ? 1 : 3);
  }
  await closeBrowser();
  console.log(`\n→ ${OUT}`);
})().catch(async (error) => {
  console.error(error);
  await closeBrowser();
  process.exit(1);
});
