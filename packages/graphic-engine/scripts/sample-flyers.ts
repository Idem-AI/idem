/**
 * PLANCHE-CONTACT DES FLYERS — `npm run sample:flyers -- --out <dossier> [--only visual.] [--photos <dossier>]`
 *
 * Chaque gabarit de visuel, rendu SEUL (les autres retirés par surcharge), sur quatre messages types (événement,
 * offre, témoignage, lancement), trois formats (carré, story, A4 — plus la bannière quand le squelette l'admet) et
 * trois marques de directions artistiques différentes. Les photos : de vraies photos JPEG d'un dossier
 * (`--photos`), sinon le dégradé des fixtures. Aucun modèle, aucun réseau : c'est le cran Low (le code choisit).
 *
 * Sortie : un PNG par rendu (`<gabarit>--<message>--<format>.png`) et `index.json` (gabarit choisi, problèmes
 * d'affichage relevés par le moteur). À REGARDER avant de dire qu'un gabarit est bon.
 */
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_QUALITY_MEMORY = '0';

import fs from 'fs';
import path from 'path';
import { catalog, resetCatalog } from '../src/catalog/registry';
import type { GabaritNode } from '../src/catalog/types';
import { configureGraphicEngine } from '../src/host';
import { closeBrowser } from '../src/runtime/browser';
import { createDocument } from '../src/engine';
import { FORMATS } from '../src/design-system/formats';
import type { FormatId } from '../src/contracts/common';
import type { SectionContent } from '../src/contracts/content-model';
import { BRANDS, photo } from './fixtures';

const DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../idem-templates');
process.env.IDEM_TEMPLATES_DIR = DIR;

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const out = arg('--out') ?? path.resolve('flyer-samples');
const only = (arg('--only') ?? 'visual.').split(',').filter(Boolean);
const formatList = arg('--formats')?.split(',').map((f) => `flyer-${f}` as FormatId);
const photosDir = arg('--photos');
fs.mkdirSync(out, { recursive: true });

const photos: string[] = photosDir
  ? fs
      .readdirSync(photosDir)
      .filter((f) => /\.jpe?g$/i.test(f))
      .sort()
      .map((f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(photosDir, f)).toString('base64')}`)
  : [photo('#1A2A4F', '#7F9CE5', '#C9A227')];
const pic = (i: number) => photos[i % photos.length];

/** Quatre messages types d'un flyer, avec et sans photo. */
const MESSAGES = (i: number): SectionContent[] => [
  {
    id: 'event',
    role: 'visual',
    title: 'Visuel',
    blocks: [
      { id: 'copy', kind: 'copy', headline: 'La tech au féminin prend le micro', subhead: 'Une soirée de témoignages et d’ateliers pour se lancer', facts: [{ label: 'Date', text: 'Samedi 18 octobre' }, { label: 'Heure', text: '18 h' }, { label: 'Lieu', text: 'Akwa, Douala' }] },
      { id: 'photo', kind: 'figure', url: pic(i), alt: 'Une intervenante sur scène' },
    ],
  },
  {
    id: 'offer',
    role: 'visual',
    title: 'Visuel',
    blocks: [{ id: 'copy', kind: 'copy', headline: 'Vos intrants livrés au village', subhead: 'Commandez par un simple appel, payez à la livraison', offer: '−20 %', facts: [{ text: 'Livraison en 48 h' }, { text: 'Sans smartphone' }] }],
  },
  {
    id: 'quote',
    role: 'visual',
    title: 'Visuel',
    blocks: [
      { id: 'copy', kind: 'copy', headline: 'Ils nous font confiance', quote: { text: 'Depuis que je commande par téléphone, je ne perds plus une journée de marché.', author: 'Awa N., productrice à Bafoussam' } },
      { id: 'photo', kind: 'figure', url: pic(i + 1), alt: 'Une productrice dans son champ' },
    ],
  },
  {
    id: 'launch',
    role: 'visual',
    title: 'Visuel',
    blocks: [
      { id: 'copy', kind: 'copy', headline: 'Le marché vient à vous', subhead: 'AgriLink relie 2 000 producteurs aux acheteurs de Douala', body: 'Un numéro, une commande, une livraison suivie par SMS.', footnote: 'agrilink.cm' },
      { id: 'photo', kind: 'figure', url: pic(i + 2), alt: 'Un étal de légumes au marché' },
    ],
  },
];

const BRAND_ORDER = ['kora', 'Makam', 'baobab'] as const;

let disabled: string[] = [];
configureGraphicEngine({
  agentCall: () => async () => '{"pick":"A"}',
  catalogOverrides: async () => ({ disabled }),
});

async function main(): Promise<void> {
  const cat = await catalog();
  const gabarits = [...cat.nodes.values()].filter((n): n is GabaritNode => n.kind === 'gabarit' && n.elements.includes('social-visual'));
  const index: Array<Record<string, unknown>> = [];
  console.log(`${cat.nodes.size} nœuds, ${gabarits.length} gabarits de visuel, rejetés : ${cat.rejected.length}`);
  for (const r of cat.rejected) console.log('  rejeté', JSON.stringify(r).slice(0, 220));
  for (const [gi, g] of gabarits.entries()) {
    if (!only.some((o) => g.id.startsWith(o))) continue;
    disabled = gabarits.filter((x) => x.id !== g.id).map((x) => x.id);
    resetCatalog();
    const layout = cat.nodes.get(g.config.layout);
    if (layout?.kind !== 'layout') continue;
    const formats: FormatId[] = formatList ?? ['flyer-square', 'flyer-story', 'flyer-a4', 'flyer-banner'];
    for (const [mi, message] of MESSAGES(gi).entries()) {
      for (const format of formats) {
        const fmt = FORMATS[format];
        if (layout.shape.orientations?.length && !layout.shape.orientations.includes(fmt.orientation)) continue;
        if (layout.shape.minAspect && fmt.width / fmt.height < layout.shape.minAspect) continue;
        if (layout.shape.maxAspect && fmt.width / fmt.height > layout.shape.maxAspect) continue;
        const brandKey = BRAND_ORDER[(gi + mi) % BRAND_ORDER.length];
        const brand = BRANDS[brandKey];
        // La DA du gabarit (un flyer signature n'appartient qu'à la sienne) ; sinon celle de la marque de test.
        const styleId = !g.directions?.length || g.directions.includes(brand.styleId) ? brand.styleId : g.directions[0];
        const darkGround = (layout as { darkGround?: boolean }).darkGround === true || (cat.nodes.get(g.config.skin) as { dark?: boolean } | undefined)?.dark === true;
        const doc = await createDocument({ documentType: 'flyer', format, brand, direction: { styleId }, creativity: 'low', ...(darkGround ? { allowDark: true } : {}), seed: `${g.id}|${message.id}|${format}`, png: true, sections: [{ id: message.id, role: 'visual' }] });
        const name = `${g.id}--${message.id}--${format.replace('flyer-', '')}`;
        try {
          const res = await doc.composeSection(message);
          const picked = res.spec.catalog?.config.gabarit;
          const issues = res.result.issues.map((i) => `${i.severity}:${i.code}${i.severity === "blocking" ? ` (${String(i.message).slice(0, 140)})` : ""}`);
          if (picked === g.id && res.png) fs.writeFileSync(path.join(out, `${name}.png`), res.png);
          index.push({ name, gabarit: g.id, picked, brand: brandKey, styleId, skin: res.spec.catalog?.config.skin, issues });
          console.log(`${picked === g.id ? '✓' : '·'} ${name} [${styleId} · ${res.spec.catalog?.config.skin}]${picked === g.id ? '' : ` (servi : ${picked})`}${issues.length ? ` — ${issues.join(', ')}` : ''}`);
        } catch (error) {
          index.push({ name, gabarit: g.id, error: String((error as Error)?.message ?? error).slice(0, 200) });
          console.log(`✗ ${name} — ${String((error as Error)?.message ?? error).slice(0, 160)}`);
        }
      }
    }
  }
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser().catch(() => undefined);
  });
