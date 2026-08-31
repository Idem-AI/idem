/**
 * Vérification du socle de direction artistique — `npm run check:design`.
 *
 * Même rôle que `checkAgentPipeline` : le projet n'a pas de harnais de tests, et
 * ce socle est PUR (aucun réseau, aucun modèle, aucune base) mais ses
 * régressions seraient silencieuses. Une graine qui sortirait de l'espace de son
 * style, ou un linter qui se mettrait à signaler du HTML conforme, ne casse rien
 * : ça dégrade seulement tous les livrables, sans erreur.
 *
 *   npx ts-node api/scripts/checkDesignSystem.ts
 */

import {
  ART_DIRECTION_STYLES,
  ART_DIRECTION_STYLE_IDS,
  buildStyleCatalogBrief,
  buildStyleSheet,
  resolveStyle,
} from '../services/design/artDirection.catalog';
import { buildDesignSeed, describeSeed } from '../services/design/designSeed';
import { lintHtml, repairHtml } from '../services/design/slopLint.service';
import { ArtDirectionModel } from '../models/art-direction.model';
import {
  buildArtDirectionBlock,
  buildImageNegativePrompt,
  buildImageStyleModifier,
} from '../utils/art-direction.util';
import { buildLogoBlock, collectLogoUrls } from '../utils/brand-context.util';
import {
  brandFontLinks,
  brandFontsHref,
  buildGoogleFontLinks,
} from '../utils/google-fonts.util';
import {
  EDITORIAL_RESTRAINT_BLOCK,
  RESTRAINT_SELF_REVIEW_BLOCK,
} from '../services/design/editorialRestraint.prompt';
import { LogoModel } from '../models/logo.model';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log(`\nCatalogue: ${ART_DIRECTION_STYLE_IDS.length} styles`);

// 1. Chaque style doit être complet et tirer une graine DANS son propre espace.
//    C'est l'invariant qui empêche un « Design Suisse » de sortir en néon.
console.log('\n[1] Cohérence des styles et des graines');
for (const id of ART_DIRECTION_STYLE_IDS) {
  const style = ART_DIRECTION_STYLES[id];
  const seed = buildDesignSeed(id, `check:${id}`);
  const inSpace =
    style.seedSpace.archetypes.includes(seed.archetype) &&
    style.seedSpace.colorStrategies.includes(seed.colorStrategy) &&
    style.seedSpace.typographyMoods.includes(seed.typographyMood) &&
    style.seedSpace.layoutTensions.includes(seed.layoutTension) &&
    style.seedSpace.contentDensities.includes(seed.contentDensity) &&
    style.seedSpace.graphicAccents.includes(seed.graphicAccent);
  check(`${id}: graine dans l'espace du style`, inSpace, JSON.stringify(seed));
  // Le vocabulaire de composants est ce qui remplace l'invention de décoration :
  // s'il manque une primitive, le modèle en rebricole une par bloc.
  const recipe = style.tailwindRecipe || '';
  check(
    `${id}: vocabulaire de composants complet`,
    ['page:', 'sectionTitle:', 'body:', 'rule:', 'kpi:', 'caption:'].every((k) => recipe.includes(k)),
    recipe.slice(0, 60)
  );
  check(
    `${id}: la fiche de style expose le vocabulaire`,
    buildStyleSheet(id).includes('Component vocabulary')
  );
  check(
    `${id}: appariements typographiques proposés`,
    (style.typePairings || []).length >= 2
  );
  // Une police de la liste anti-générique dans le catalogue annulerait tout le
  // reste : c'est le levier le plus rapide pour qu'une marque cesse d'être
  // reconnaissable comme une sortie de machine.
  check(
    `${id}: aucun appariement ne repose sur une police bannie`,
    !/\b(Inter|Roboto|Open Sans|Lato|Montserrat|Poppins|Space Grotesk|Arial|Helvetica)\b/.test(
      (style.typePairings || []).join(' ')
    ),
    (style.typePairings || []).join(' · ')
  );
  check(
    `${id}: fiche de style complète`,
    !!(style.name && style.imagePromptModifier && style.bans.length && style.typeRatio >= 1.25) &&
      buildStyleSheet(id).includes(style.name)
  );
  // Une graine développée en consignes : transmettre « archetype: D » ne
  // contraint rien, le modèle ignore ce que D recouvre.
  check(`${id}: graine lisible par un modèle`, describeSeed(seed).includes('—'));
}

console.log('\n[2] Déterminisme et variabilité');
const seedA1 = buildDesignSeed('swiss', 'projet-A');
const seedA2 = buildDesignSeed('swiss', 'projet-A');
const seedB = buildDesignSeed('swiss', 'projet-B');
check('même clé → même graine (un document régénéré garde sa mise en page)',
  JSON.stringify(seedA1) === JSON.stringify(seedA2));
check('clé différente → graine différente (deux projets ne se ressemblent pas)',
  JSON.stringify(seedA1) !== JSON.stringify(seedB));
check('style inconnu → repli éditorial, jamais une exception',
  resolveStyle('inexistant').id === 'editorial');
check('catalogue condensé non vide', buildStyleCatalogBrief().split('\n').length === 20);

console.log('\n[3] Bloc de direction artistique');
const direction: ArtDirectionModel = {
  styleId: 'swiss',
  styleName: 'Design Suisse',
  tagline: 'La grille comme preuve de fiabilité',
  rationale: "Un opérateur logistique vend la fiabilité, pas l'audace.",
  keywords: ['grille', 'encre', 'papier kraft'],
  layout: { grid: '12 colonnes', density: 'balanced', whitespace: '40%', signatureMove: 'filet de 4px' },
  color: { distribution: '70/20/10', application: 'aplats', contrast: 'franc' },
  typography: { scaleContrast: '1.25', caseAndTracking: 'bas de casse', treatment: 'aucun' },
  imagery: {
    medium: 'photography',
    subjects: 'entrepôts et gestes du métier',
    treatment: 'noir et blanc',
    lighting: 'diffuse',
    framing: 'frontal',
  },
  graphicDevices: ['filets épais'],
  dos: ['aligner tout à gauche'],
  donts: ['aucun arrondi'],
  imagePromptModifier: 'swiss international style photography',
};
const block = buildArtDirectionBlock(direction, { medium: 'poster' });
check('bloc produit une fiche de style', block.includes('<style_sheet>'));
check('bloc porte le geste signature', block.includes('filet de 4px'));
check('bloc porte le rayon de bordure du style', block.includes('Border radius'));
check('modificateur d\'image non vide', buildImageStyleModifier(direction).length > 20);
check('prompt négatif non vide', buildImageNegativePrompt(direction).length > 20);
// Sans direction, mieux vaut aucun bloc qu'un bloc de « non spécifié », qui
// apprend au modèle que la consigne est facultative.
check('aucune direction → aucun bloc', buildArtDirectionBlock(null) === '');

console.log('\n[4] Bloc logo');
const logo = {
  id: 'l1',
  name: 'Acme',
  svg: 'https://cdn.example/logo.svg',
  concept: '',
  colors: [],
  fonts: [],
  assetUrls: {
    primary: 'https://cdn.example/logo-primary.png',
    icon: 'https://cdn.example/logo-icon.png',
    withText: {
      lightBackground: 'https://cdn.example/logo-wt-light.png',
      darkBackground: 'https://cdn.example/logo-wt-dark.png',
    },
  },
} as LogoModel;
const logoBlock = buildLogoBlock(logo, { placement: 'sur la couverture' });
check('déclinaisons résolues', collectLogoUrls(logo).length >= 4);
check('le bloc porte une OBLIGATION, pas seulement des URLs', logoBlock.includes('MUST appear'));
check('le bloc explique le choix encre/fond', logoBlock.includes('LIGHT background'));
check('déclinaison manquante → repli sur le primaire, jamais un trou',
  logoBlock.includes('logo-primary.png'));
check('sans logo → consigne typographique explicite',
  buildLogoBlock(null).includes('NO logo asset'));

console.log('\n[5] Chargement des polices de marque');
// LE bug qui faisait que toutes les générations sortaient dans une police
// système : `typography.url` est un slug, pas une feuille de style, et les
// quatre moteurs de rendu l'injectaient tel quel dans un <link>.
const slugTypo = { url: 'typography/systeme-premium', primaryFont: 'Playfair Display', secondaryFont: 'Work Sans' };
const links = brandFontLinks(slugTypo);
check('un slug ne produit jamais un <link> mort', !links.includes('typography/systeme-premium'));
check('les deux familles sont chargées', links.includes('Playfair+Display') && links.includes('Work+Sans'));
check('le préchargement gstatic est présent', links.includes('fonts.gstatic.com'));
check(
  'chaque famille est demandée sans graisse ET avec la plage complète',
  links.includes('family=Work+Sans&display=swap') && links.includes('Work+Sans:wght@100;200;300;400;500;600;700;800;900')
);
check(
  'une URL réelle déjà stockée est honorée',
  brandFontsHref({ url: 'https://fonts.googleapis.com/css2?family=Jura&display=swap' }) ===
    'https://fonts.googleapis.com/css2?family=Jura&display=swap'
);
check('les piles système ne sont jamais demandées à Google', buildGoogleFontLinks(['Arial, sans-serif', 'system-ui']) === '');
check('sans typographie, un repli non générique est servi', !brandFontsHref({}).includes('family=Roboto'));

console.log('\n[6] Retenue éditoriale');
check('le bloc impose le test de soustraction', EDITORIAL_RESTRAINT_BLOCK.includes('SUBTRACTION TEST'));
check('le bloc interdit le remplissage au quota', EDITORIAL_RESTRAINT_BLOCK.includes('never a quota'));
check('la relecture demande de SUPPRIMER', RESTRAINT_SELF_REVIEW_BLOCK.includes('DELETE'));

console.log('\n[7] Linter anti-générique');
const palette = {
  primary: '#1447e6',
  secondary: '#000060',
  accent: '#22d3ee',
  background: '#ffffff',
  text: '#1f2937',
};
const options = {
  palette,
  fonts: ['Archivo', 'Lora'],
  expectedLogoUrls: ['https://cdn.example/logo-primary.png'],
};
const slop = [
  `<div class="rounded-2xl shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600 font-['Inter']">`,
  `<h1 class="bg-clip-text text-transparent" style="color:#8b5cf6">Elevate your business</h1>`,
  `<img src="https://cdn.example/photo.png"><p class="text-gray-400">Lorem ipsum dolor</p>`,
  `<a href="#">Get started</a></div>`,
].join('');
const report = lintHtml(slop, options);
const rules = new Set(report.violations.map((v) => v.rule));
for (const rule of [
  'purple-gradient',
  'gradient-text',
  'default-font',
  'off-palette-color',
  'light-gray-body',
  'placeholder-content',
  'img-without-alt',
  'dead-link',
  'logo-missing',
]) {
  check(`détecte ${rule}`, rules.has(rule));
}
check('produit une consigne de correction réinjectable', !!report.repairPrompt);

// La décoration accumulée est le défaut que l'utilisateur voyait en premier :
// le prompt la décourage, le linter doit la MESURER.
const cluttered =
  `<div class="absolute rounded-full blur-3xl bg-[#1447e6]/30"></div>` +
  Array.from({ length: 6 }, (_, i) => `<i class="pi pi-check text-[#1447e6]"></i><p>Point ${i}</p>`).join('') +
  `<span class="rounded-full bg-[#22d3ee] px-2">Innovant</span>` +
  `<img src="https://cdn.example/logo-primary.png" alt="l" />`;
const clutterRules = new Set(lintHtml(cluttered, options).violations.map((v) => v.rule));
check('détecte les icônes en surnombre', clutterRules.has('icon-overload'));
check('détecte la forme décorative de remplissage', clutterRules.has('decorative-shape'));
check('détecte la pastille sans donnée', clutterRules.has('empty-badge'));
// Le faux positif reste le pire défaut : une pastille qui PORTE une donnée est
// un élément légitime, pas de la décoration.
check(
  'une pastille chiffrée n\'est pas signalée',
  !lintHtml(
    `<span class="rounded-full bg-[#22d3ee] px-2">+18%</span><img src="https://cdn.example/logo-primary.png" alt="l" />`,
    options
  ).violations.some((v) => v.rule === 'empty-badge')
);

const repaired = repairHtml(slop, options);
check('répare la couleur hors charte', !/#8b5cf6/.test(repaired.html));
check('répare la police écrite en dur', !/Inter/.test(repaired.html));
check('répare l\'image sans alt', /<img[^>]*alt=/.test(repaired.html));
check('répare le titre en dégradé', !/bg-clip-text/.test(repaired.html));

// Le pire défaut d'un linter est le faux positif : il apprend à ignorer ses
// propres alertes. Un HTML conforme doit sortir absolument propre.
const clean =
  `<div class="relative w-[1080px] h-[1080px] bg-[#ffffff]">` +
  `<h1 class="font-primary text-[#1447e6]">Livraison en 24h à Douala</h1>` +
  `<img src="https://cdn.example/logo-primary.png" alt="logo Acme" class="w-[140px] h-auto" /></div>`;
const cleanReport = lintHtml(clean, options);
check(
  'aucun faux positif sur un HTML conforme',
  cleanReport.violations.length === 0,
  cleanReport.violations.map((v) => v.rule).join(', ')
);

// Les teintes de la photo sont légitimes sur un visuel (duotone, voile) : les
// ramener à la charte détruirait les stratégies IMAGE_EXTRACTED / SPLIT_COMPLEMENTARY.
const duotone = `<div style="background:#c47a3f"><img src="https://cdn.example/logo-primary.png" alt="l" style="filter:sepia(1)" /></div>`;
check(
  'les couleurs tolérées ne sont pas signalées',
  !lintHtml(duotone, { ...options, extraAllowedColors: ['#c47a3f'] }).violations.some(
    (v) => v.rule === 'off-palette-color'
  )
);
check(
  'et ne sont pas réécrites',
  repairHtml(duotone, { ...options, extraAllowedColors: ['#c47a3f'] }).html.includes('#c47a3f')
);
check(
  'mais restent signalées sans tolérance déclarée',
  lintHtml(duotone, options).violations.some((v) => v.rule === 'off-palette-color')
);

// Un style qui REVENDIQUE un marqueur ne doit pas être puni pour l'appliquer.
const glass = `<div class="backdrop-blur bg-white/20 rounded-3xl"></div>`;
check(
  'exemption de style: le glassmorphisme est permis au style glassmorphism',
  !lintHtml(glass, { ...options, styleId: 'glassmorphism' }).violations.some(
    (v) => v.rule === 'glassmorphism'
  )
);
check(
  'et reste signalé ailleurs',
  lintHtml(glass, { ...options, styleId: 'swiss' }).violations.some((v) => v.rule === 'glassmorphism')
);

console.log(
  failures === 0
    ? '\n✅ Socle de direction artistique conforme\n'
    : `\n❌ ${failures} vérification(s) en échec\n`
);
process.exit(failures === 0 ? 0 : 1);
