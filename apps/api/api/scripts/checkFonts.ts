/**
 * Vérification du socle typographique — `npm run check:fonts`.
 *
 * Même rôle que `checkDesignSystem` : tout ce qui est vérifié ici est PUR
 * (aucun réseau, aucun modèle, aucune base), et ses régressions seraient
 * silencieuses. Une police qui ne se charge pas ne lève aucune erreur : le
 * document sort simplement dans la police système — la panne exacte que
 * `google-fonts.util` avait déjà été écrite pour éliminer, et qui revient dès
 * qu'une famille ne vient plus de Google.
 *
 *   npx ts-node api/scripts/checkFonts.ts
 */

import {
  brandFontLinks,
  brandFontsHref,
  designFontLinks,
  isStylesheetHref,
} from '../utils/google-fonts.util';
import { googleCssUrl } from '../services/font-catalog.service';
import { fontshareCssUrl } from '../services/fontshare.service';
import { fontsourceCssUrl } from '../services/fontsource.service';
import {
  buildFontFaceCss,
  detectFormat,
  inferStyle,
  inferWeight,
  sanitizeFamily,
} from '../services/customFont.service';
import { BrandFontFileModel } from '../models/brand-identity.model';
import { fontshareService } from '../services/fontshare.service';
import { fontsourceService } from '../services/fontsource.service';
import { TYPOGRAPHY_GENERATION_PROMPT } from '../services/BandIdentity/prompts/singleGenerations/typography-generation.prompt';
import { TYPOGRAPHY_FROM_LOGO_PROMPT } from '../services/BandIdentity/prompts/singleGenerations/colors-from-logo.prompt';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// 1. Les URLs de feuilles, source par source.
console.log('\n[1] Feuilles de style des fonderies');
check(
  'Google énumère les graisses réellement publiées',
  googleCssUrl('Playfair Display', [400, 700, 900]) ===
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap'
);
check(
  'une famille sans graisse connue reste demandable',
  googleCssUrl('Jura') === 'https://fonts.googleapis.com/css2?family=Jura&display=swap'
);
// Fontshare mélange dans ses graisses des valeurs qui n'en sont pas (1, 2, 201 :
// des marqueurs de variable et d'italique). Les laisser passer produit une URL
// que l'API rejette, donc une police qui ne se charge jamais.
const fontshare = fontshareCssUrl('general-sans', [1, 2, 200, 201, 400, 700]);
check('Fontshare ne demande que des graisses CSS', !/@.*\b(1|2|201)\b/.test(fontshare), fontshare);
check('Fontshare demande bien les graisses valides', fontshare.includes('general-sans%40200%2C400%2C700'), fontshare);
check(
  'Fontsource passe par jsDelivr',
  fontsourceCssUrl('apfel-grotezk') ===
    'https://cdn.jsdelivr.net/npm/@fontsource/apfel-grotezk@latest/index.css'
);

// 2. Toutes ces formes doivent être reconnues comme des feuilles utilisables :
//    une seule oubliée, et la police correspondante n'est jamais chargée.
console.log('\n[2] Reconnaissance des feuilles');
check('Google', isStylesheetHref(googleCssUrl('Jura')));
check('Fontshare (pas de .css dans l\'URL)', isStylesheetHref(fontshareCssUrl('satoshi', [400])));
check('Fontsource', isStylesheetHref(fontsourceCssUrl('geist-sans')));
check('notre bucket', isStylesheetHref('https://cdn.idem.africa/idem/users/u1/fonts/f1/fontface.css'));
check('un slug n\'est pas une feuille', !isStylesheetHref('typography/systeme-premium'));

// 3. Le bloc <link> d'une marque, selon la provenance de ses polices.
console.log('\n[3] Chargement des polices de la marque');
const mixed = brandFontLinks({
  url: 'typography/systeme-premium',
  primaryFont: 'Satoshi',
  secondaryFont: 'Work Sans',
  primary: { family: 'Satoshi', source: 'fontshare', cssUrl: fontshareCssUrl('satoshi', [400, 700]) },
});
check('la famille non-Google est chargée depuis sa fonderie', mixed.includes('api.fontshare.com'));
check('la famille Google restante est reconstruite', mixed.includes('family=Work+Sans'));
// Le doublon n'est pas qu'un gaspillage : le lien Google d'une famille absente
// de Google est un lien MORT, et il masque la vraie feuille dans les journaux.
check('la famille non-Google n\'est PAS redemandée à Google', !mixed.includes('Satoshi'));
check('le slug ne produit toujours aucun lien', !mixed.includes('systeme-premium'));

const imported = brandFontLinks({
  url: 'https://cdn.idem.africa/idem/users/u1/fonts/f1/fontface.css',
  primaryFont: 'Fonderie Maison',
  secondaryFont: 'Fonderie Maison',
  primary: {
    family: 'Fonderie Maison',
    source: 'custom',
    cssUrl: 'https://cdn.idem.africa/idem/users/u1/fonts/f1/fontface.css',
  },
  secondary: {
    family: 'Fonderie Maison',
    source: 'custom',
    cssUrl: 'https://cdn.idem.africa/idem/users/u1/fonts/f1/fontface.css',
  },
});
check('une police importée n\'est jamais demandée à Google', !imported.includes('fonts.googleapis.com'));
check('sa feuille n\'est insérée qu\'une fois', imported.match(/fontface\.css/g)?.length === 1, imported);

check(
  'une URL réelle déjà stockée est honorée',
  brandFontsHref({ url: 'https://fonts.googleapis.com/css2?family=Jura&display=swap' }) ===
    'https://fonts.googleapis.com/css2?family=Jura&display=swap'
);
check(
  'à défaut, la feuille de la police de titre fait foi',
  brandFontsHref({
    primaryFont: 'Satoshi',
    primary: { family: 'Satoshi', source: 'fontshare', cssUrl: fontshareCssUrl('satoshi', [400]) },
  }).includes('api.fontshare.com')
);

// Le même contrat, exprimé dans le vocabulaire du design system : c'est ce que
// voient le renderer de sections et les visuels sociaux.
const design = designFontLinks({
  display: 'Clash Display',
  body: 'Karla',
  displayCss: fontshareCssUrl('clash-display', [400, 700]),
});
check('le design system charge sa police de titre depuis sa fonderie', design.includes('clash-display'));
check('et sa police de texte chez Google', design.includes('family=Karla'));
check(
  'une charte sans police n\'émet rien',
  designFontLinks({ display: 'Georgia', body: 'Helvetica Neue' }) === ''
);

// 4. Import : le format est lu DANS le fichier, jamais dans son extension.
console.log('\n[4] Lecture des fichiers importés');
const signature = (tag: string): Buffer => Buffer.concat([Buffer.from(tag, 'latin1'), Buffer.alloc(8)]);
check('woff2', detectFormat(signature('wOF2')) === 'woff2');
check('woff', detectFormat(signature('wOFF')) === 'woff');
check('otf', detectFormat(signature('OTTO')) === 'otf');
check('ttf (version 1.0)', detectFormat(Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0])) === 'ttf');
// Un PNG renommé en .woff2 casserait le rendu sans le moindre message : c'est
// exactement ce que la signature permet de refuser à l'entrée.
check('un fichier qui n\'est pas une police est refusé', detectFormat(signature('%PNG')) === null);
check('un fichier tronqué est refusé', detectFormat(Buffer.from([0x00])) === null);

console.log('\n[5] Graisse et style déduits du nom de fichier');
check('Satoshi-Bold.woff2 → 700', inferWeight('Satoshi-Bold.woff2') === 700);
check('Satoshi-700.woff2 → 700', inferWeight('Satoshi-700.woff2') === 700);
check('Satoshi-Light.otf → 300', inferWeight('Satoshi-Light.otf') === 300);
// « ExtraBold » contient « Bold » : l'ordre des motifs décide, et une erreur ici
// ferait passer une 800 pour une 700 sans que rien ne le signale.
check('Satoshi-ExtraBold.ttf → 800', inferWeight('Satoshi-ExtraBold.ttf') === 800);
check('Satoshi-Black.ttf → 900', inferWeight('Satoshi-Black.ttf') === 900);
check('sans indication → 400', inferWeight('Satoshi.woff2') === 400);
check('italique reconnue', inferStyle('Satoshi-BoldItalic.woff2') === 'italic');
check('romaine par défaut', inferStyle('Satoshi-Bold.woff2') === 'normal');
// Le nom tapé par l'utilisateur finit dans un `font-family: '…'` de NOTRE
// feuille : tout ce qui pourrait refermer la déclaration doit disparaître.
const hostile = sanitizeFamily('Ma Police"; } body { display:none } @font-face { font-family:\'x');
check('un nom de famille ne peut pas casser la déclaration CSS', !/["'`;{}<>\\]/.test(hostile), hostile);
check('mais il reste lisible', hostile.startsWith('Ma Police'), hostile);

// 6. La feuille fabriquée pour une police importée.
console.log('\n[6] Feuille @font-face générée');
const files: BrandFontFileModel[] = [
  { url: 'https://cdn.idem.africa/f/regular.woff', weight: 400, style: 'normal', format: 'woff' },
  { url: 'https://cdn.idem.africa/f/regular.woff2', weight: 400, style: 'normal', format: 'woff2' },
  { url: 'https://cdn.idem.africa/f/bold.woff2', weight: 700, style: 'normal', format: 'woff2' },
  { url: 'https://cdn.idem.africa/f/italic.woff2', weight: 400, style: 'italic', format: 'woff2' },
];
const css = buildFontFaceCss('Fonderie Maison', files);
// Trois règles, pas quatre : deux `@font-face` de mêmes famille, graisse et
// style se remplacent l'un l'autre, et seul le dernier serait chargé.
check('une règle par couple graisse/style', (css.match(/@font-face/g) ?? []).length === 3, css);
check('les formats d\'une même graisse sont réunis', /regular\.woff2'\) format\('woff2'\),\n\s+url\('https:[^']+regular\.woff'\) format\('woff'\)/.test(css), css);
check('le woff2 est proposé en premier', css.indexOf('regular.woff2') < css.indexOf('regular.woff\''), css);
check('la graisse 700 est déclarée', css.includes('font-weight: 700'));
check('l\'italique est déclarée', css.includes('font-style: italic'));
// Sans `swap`, le texte reste INVISIBLE le temps du téléchargement : sur un PDF
// rendu par Puppeteer, cela peut simplement produire une page vide.
check('font-display: swap partout', (css.match(/font-display: swap/g) ?? []).length === 3);

/**
 * 7. Les familles CITÉES dans les prompts existent-elles vraiment ?
 *
 * Réseau requis, donc hors du `check:all` : `CHECK_FONTS_NETWORK=1`.
 * Une famille inventée ne lève aucune erreur — l'agent la propose, la
 * résolution ne la trouve pas, et la marque hérite d'un repli Google silencieux.
 * Les catalogues bougent (Fontshare a retiré des familles) : ce contrôle dit
 * quand la liste du prompt a pris du retard.
 */
async function checkPromptFamilies(): Promise<void> {
  console.log('\n[7] Familles citées dans les prompts (réseau)');

  const [fontshare, fontsource] = await Promise.all([
    fontshareService.getCatalog(),
    fontsourceService.getCatalog(),
  ]);
  const known = {
    fontshare: new Set(fontshare.map((font) => font.family.toLowerCase())),
    fontsource: new Set(fontsource.map((font) => font.family.toLowerCase())),
  };

  if (!fontshare.length || !fontsource.length) {
    console.log('  --    catalogue injoignable, vérification ignorée');
    return;
  }

  for (const [label, prompt] of [
    ['typographie', TYPOGRAPHY_GENERATION_PROMPT],
    ['typographie depuis le logo', TYPOGRAPHY_FROM_LOGO_PROMPT],
  ] as const) {
    for (const source of ['fontshare', 'fontsource'] as const) {
      const line = prompt.match(new RegExp(`- "${source}" — [^\n]+`))?.[0] ?? '';
      const families = (line.split(':').slice(1).join(':') || '')
        .replace(/\.$/, '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      const missing = families.filter((name) => !known[source].has(name.toLowerCase()));
      check(
        `${label} — ${families.length} familles ${source} existent`,
        families.length > 0 && missing.length === 0,
        missing.join(', ')
      );
    }
  }
}

async function main(): Promise<void> {
  if (process.env.CHECK_FONTS_NETWORK === '1') {
    await checkPromptFamilies();
  }

  console.log(
    failures === 0
      ? '\n✅ Socle typographique conforme\n'
      : `\n❌ ${failures} vérification(s) en échec\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
