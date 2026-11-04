/**
 * LE PROFESSEUR DE LA BIBLIOTHÈQUE D'EXEMPLES (phase 5) — VRAIS MODÈLES au cran Ultra, donc PAYANT. Une seule fois,
 * hors production, sur demande de l'utilisateur :
 *
 *   npm run teach:examples -- <dossier de sortie> [nombre de pages, défaut 60]
 *
 * Il compose des pages variées (toiles : diapositive, page A4, visuel, carte ; rôles : couverture, chiffres, texte,
 * tableau…) pour des marques fictives, au modèle le plus fort, et range pour chacune `<id>.html` (le code de la page,
 * textes en clés), `<id>.json` ({ nature, role, intent, blocking }) et `<id>.png`. Puis :
 *
 *   npx ts-node --transpile-only packages/graphic-engine/scripts/build-examples.ts <dossier> <bibliothèque.json>
 *
 * et `IDEM_EXAMPLES_FILE=<bibliothèque.json>` branche la bibliothèque. Les marques et les textes sont fictifs ; les
 * exemples ne portent ensuite que la STRUCTURE des pages (les mots sont retirés à l'assemblage).
 */
import { loadSecrets } from '../config/secrets';
import fs from 'fs';
import path from 'path';
import '../services/graphic/engine.host';
import { brandFromIdem, coverContent, createDocument, SectionContent } from '@idem/graphic-engine';
import { GRAPHIC_SAMPLES, sampleLogo } from './quality/samples';

const OUT = process.argv[2];
const COUNT = Math.max(4, Number(process.argv[3]) || 60);

/** Les intentions de page à couvrir (une par tour), sur trois toiles. */
const INTENTS: Array<{ format: 'slide-16x9' | 'a4-portrait' | 'flyer-square'; documentType: 'pitch-deck' | 'business-plan' | 'flyer'; role?: 'cover'; intent: string; content: (name: string) => SectionContent }> = [
  { format: 'slide-16x9', documentType: 'pitch-deck', role: 'cover', intent: 'cover of an investor deck', content: (name) => coverContent({ id: 'cover', brandName: name, documentLabel: 'Investor deck', promise: 'The simplest way to get paid at the market.', dateLabel: '2026' }) },
  { format: 'slide-16x9', documentType: 'pitch-deck', intent: 'one key figure that proves traction', content: () => ({ id: 'traction', title: 'Traction', lede: '12 400 traders in 9 months', blocks: [{ id: 'p1', kind: 'prose', paragraphs: ['Monthly volume grew 38 % on average since launch, with no paid acquisition.'] }] }) as SectionContent },
  { format: 'slide-16x9', documentType: 'pitch-deck', intent: 'three steps of how the product works', content: () => ({ id: 'how', title: 'How it works', blocks: [{ id: 'c1', kind: 'cards', items: [{ title: 'Scan', body: 'The buyer scans the stall code.' }, { title: 'Pay', body: 'Mobile money confirms in seconds.' }, { title: 'Done', body: 'The trader gets a receipt by SMS.' }] }] }) as SectionContent },
  { format: 'a4-portrait', documentType: 'business-plan', intent: 'a text-heavy page with a pull quote', content: () => ({ id: 'vision', title: 'Vision', blocks: [{ id: 'p1', kind: 'prose', paragraphs: ['We want every market trader to accept digital payments without a smartphone.', 'Our network of agents trains traders on site and keeps the devices running.', 'The model pays for itself with a 1 % fee on volume.'] }] }) as SectionContent },
  { format: 'a4-portrait', documentType: 'business-plan', intent: 'a financial table that must read clearly', content: () => ({ id: 'fin', title: 'Financial plan', blocks: [{ id: 't1', kind: 'table', headers: ['Indicator', '2026', '2027', '2028'], rows: [['Revenue', '18 M', '46 M', '92 M'], ['Gross margin', '41 %', '47 %', '52 %'], ['Net result', '-9,5 M', '3,2 M', '17,8 M']] }] }) as SectionContent },
  { format: 'flyer-square', documentType: 'flyer', intent: 'a promotional visual with one offer', content: () => ({ id: 'visual', title: 'Fresh every morning', lede: 'Delivered in 30 minutes', blocks: [{ id: 'p1', kind: 'prose', paragraphs: ['Order on WhatsApp.'] }] }) as SectionContent },
];

(async () => {
  if (!OUT) throw new Error('usage : npm run teach:examples -- <dossier> [nombre]');
  await loadSecrets();
  fs.mkdirSync(OUT, { recursive: true });
  for (let k = 0; k < COUNT; k++) {
    const sample = GRAPHIC_SAMPLES[k % GRAPHIC_SAMPLES.length];
    const goal = INTENTS[k % INTENTS.length];
    const logo = sampleLogo(sample.brand);
    const { brand, direction } = brandFromIdem({ name: sample.brand.name, branding: { colors: { colors: sample.brand.palette }, typography: { primaryFont: sample.brand.fonts.display, secondaryFont: sample.brand.fonts.body } } as never, logos: { primary: logo, withTextLight: logo, withTextDark: sampleLogo(sample.brand, 'dark'), withTextMono: logo, icon: logo } });
    const content = goal.content(sample.brand.name);
    const id = `ex${String(k + 1).padStart(3, '0')}`;
    try {
      const doc = await createDocument({ documentType: goal.documentType, format: goal.format, brand, direction, creativity: 'ultra', seed: `teach-${id}`, png: true, locale: 'en', country: sample.brand.country, sections: [{ id: content.id, role: content.role }] });
      const out = await doc.composeSection(content, { index: 1, total: 1 });
      fs.writeFileSync(path.join(OUT, `${id}.html`), out.spec.html ?? '');
      if (out.png) fs.writeFileSync(path.join(OUT, `${id}.png`), out.png);
      const nature = goal.role === 'cover' ? 'cover' : goal.format === 'a4-portrait' ? 'document' : goal.format === 'flyer-square' ? 'visual' : 'slide';
      fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify({ nature, ...(goal.role ? { role: goal.role } : {}), intent: goal.intent, blocking: out.result.issues.filter((i) => i.severity === 'blocking').length }));
      console.log(`${id} ${nature} — ${goal.intent} (${sample.brand.name})`);
    } catch (error) {
      console.log(`${id} ÉCHEC : ${(error as Error).message}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('ÉCHEC', e?.message ?? e);
  process.exit(1);
});
