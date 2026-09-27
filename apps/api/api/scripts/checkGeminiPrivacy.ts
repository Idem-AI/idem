/**
 * Contrôle de ce qui part chez Gemini pour une mise en situation
 * (`BandIdentity/mockupPrivacy.ts`). Aucun appel réseau.
 *
 *   npm run check:gemini-privacy
 *
 * 1. Toutes les combinaisons des catalogues (style × secteur × support)
 *    produisent une consigne propre, sans déclencher le repli minimal : un
 *    catalogue mal édité (un chiffre, un nom) est attrapé ici, pas en production.
 * 2. Rien d'un projet témoin ne part : ni son nom, ni sa ville, ni les mots de
 *    sa description ou de la direction artistique rédigée pour lui.
 * 3. Le logo part ré-encodé, sans métadonnées, borné à 1024 px.
 * 4. Les refus de facturation de Gemini sont reconnus (bascule sur GLM), les
 *    pannes ordinaires ne le sont pas.
 */

import sharp from 'sharp';
import { ART_DIRECTION_STYLES } from '../services/design/artDirection.catalog';
import { INDUSTRY_MOCKUP_CATEGORIES, PHYSICAL_SUPPORT_TYPES, SupportTypeKey } from '../config/mockup.config';
import { buildGeminiMockupPayload, findLeaks } from '../services/BandIdentity/mockupPrivacy';
import { isGeminiBillingError } from '../services/glm-media.service';
import type { SelectedMockupSupport } from '../services/BandIdentity/mockupAnalyzer.service';

let failures = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/** Un projet témoin, dont chaque mot distinctif est traqué dans la consigne. */
const PROJECT = {
  name: 'Verdalys',
  description:
    'Startup de recyclage de déchets plastiques à Douala. Collecte auprès de 4 200 ménages, contact@verdalys.cm, +237 699 12 34 56.',
  // Direction artistique RÉDIGÉE pour le projet : elle ne doit jamais partir.
  writtenArtDirection:
    'Matières plastiques transformées, mains au travail, paysages industriels de Douala, ménages du quartier Akwa',
};
const PROJECT_TERMS = ['Verdalys', 'Douala', 'Akwa', 'ménages', 'plastiques', 'recyclage', 'déchets', '4 200', 'verdalys.cm'];

const support = (type: SupportTypeKey, industryContext: string, skipLogo = false): SelectedMockupSupport => ({
  supportType: type,
  supportName: PHYSICAL_SUPPORT_TYPES[type].name,
  examples: [],
  // Le contexte rédigé à partir du projet, tel que l'analyseur peut le porter :
  // il ne doit pas suivre.
  context: PROJECT.writtenArtDirection,
  priority: 'primary',
  mockupIndex: 1,
  industryContext,
  skipLogo,
});

async function main(): Promise<void> {
  const colors = { primary: '#2D6A4F', secondary: '#D8E2DC', accent: '#F4A261' };
  const stagedSupports = (Object.keys(PHYSICAL_SUPPORT_TYPES) as SupportTypeKey[]).filter(
    (type) => 'scene' in PHYSICAL_SUPPORT_TYPES[type]
  );

  console.log('\nCatalogues : toutes les combinaisons');
  let combos = 0;
  const dirty: string[] = [];
  for (const styleId of Object.keys(ART_DIRECTION_STYLES)) {
    for (const category of Object.values(INDUSTRY_MOCKUP_CATEGORIES)) {
      for (const type of [...stagedSupports, 'brand_imagery' as SupportTypeKey]) {
        combos += 1;
        const payload = await buildGeminiMockupPayload({
          support: support(type, category.context, type === 'brand_imagery'),
          colors,
          styleId,
          forbidden: [PROJECT.name],
        });
        const leaks = findLeaks(payload.prompt, PROJECT_TERMS);
        if (payload.audit.fallback || leaks.length > 0) {
          dirty.push(`${styleId}/${type}${leaks.length ? ` (${leaks.join(', ')})` : ' (repli)'}`);
        }
      }
    }
  }
  check(`${combos} consignes composées des seuls catalogues, sans repli`, dirty.length === 0, dirty.slice(0, 5).join('; '));

  console.log('\nProjet témoin : rien ne part');
  const payload = await buildGeminiMockupPayload({
    support: support('tote_bags', 'retail, shopping, e-commerce, store'),
    colors,
    styleId: 'collage-art',
    forbidden: [PROJECT.name],
  });
  const leaked = PROJECT_TERMS.filter((term) => payload.prompt.toLowerCase().includes(term.toLowerCase()));
  check('ni nom, ni ville, ni description, ni direction rédigée', leaked.length === 0, leaked.join(', '));
  check('le contexte rédigé par l\'analyseur ne suit pas', !payload.prompt.includes('mains au travail'));
  check('le rendu vient du catalogue des styles', /collage|paper/i.test(payload.prompt));

  console.log('\nGarde : ce qu\'elle attrape');
  check('le nom de la marque', findLeaks('A bag for Verdalys lovers', ['Verdalys']).length > 0);
  check('une URL', findLeaks('see https://verdalys.cm', []).length > 0);
  check('un e-mail', findLeaks('write to contact@verdalys.cm', []).length > 0);
  check('un numéro', findLeaks('call +237 699 12 34 56', []).length > 0);
  check('un chiffre', findLeaks('serving 4200 homes', []).length > 0);
  check('pas une couleur ni un format', findLeaks('Colours: #2D6A4F, frame 16:9', []).length === 0);

  console.log('\nLogo');
  const tagged = await sharp({ create: { width: 2400, height: 1200, channels: 4, background: '#2D6A4F' } })
    .png()
    .withMetadata({ exif: { IFD0: { Artist: 'Verdalys SARL', Copyright: 'Verdalys 2026' } } })
    .toBuffer();
  check('le témoin porte bien des métadonnées', Boolean((await sharp(tagged).metadata()).exif));
  const withLogo = await buildGeminiMockupPayload({
    support: support('tote_bags', 'retail, shopping, e-commerce, store'),
    colors,
    styleId: 'swiss',
    logo: tagged,
    forbidden: [PROJECT.name],
  });
  const sent = await sharp(withLogo.images[0].buffer).metadata();
  check('métadonnées retirées', !sent.exif && !sent.xmp && !sent.iptc);
  check('borné à 1024 px', (sent.width ?? 0) <= 1024 && (sent.height ?? 0) <= 1024, `${sent.width}x${sent.height}`);
  const imagery = await buildGeminiMockupPayload({
    support: support('brand_imagery', 'retail, shopping, e-commerce, store', true),
    colors,
    styleId: 'swiss',
    logo: tagged,
    forbidden: [PROJECT.name],
  });
  check('aucun logo pour la photographie d\'univers', imagery.images.length === 0);

  console.log('\nRefus de facturation → bascule sur GLM');
  const billing = [
    { status: 429, message: 'Your prepayment credits are depleted. Please go to AI Studio to manage your project and billing.' },
    { status: 403, message: 'This API method requires billing to be enabled. BILLING_DISABLED' },
    { status: 429, message: 'You exceeded your current quota, please check your plan and billing details.' },
    { status: 402, message: 'Payment required' },
  ];
  check('reconnus', billing.every((error) => isGeminiBillingError(error)));
  const ordinary = [new Error('fetch failed'), { status: 500, message: 'Internal error' }, { status: 400, message: 'Invalid argument' }];
  check('pannes ordinaires non confondues', ordinary.every((error) => !isGeminiBillingError(error)));

  console.log(failures === 0 ? '\n✓ Envoi Gemini minimal conforme\n' : `\n✗ ${failures} contrôle(s) en échec\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
