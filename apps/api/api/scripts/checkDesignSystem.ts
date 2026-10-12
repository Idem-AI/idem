/**
 * Vérification du socle de direction artistique — `npm run check:design`.
 *
 * Même rôle que `checkAgentPipeline` : le projet n'a pas de harnais de tests, et
 * ce socle est PUR (aucun réseau, aucun modèle, aucune base) mais ses
 * régressions seraient silencieuses. Un style ajouté au catalogue sans son
 * pendant dans le moteur graphique, ou une marque sombre qui ferait passer un
 * business plan en noir, ne casse rien : ça dégrade seulement les livrables,
 * sans erreur.
 *
 * Les rendus eux-mêmes (pages, visuels, cartes) sont contrôlés par le moteur :
 * `npm run check:graphic-engine` à la racine du dépôt.
 *
 *   npx ts-node --transpile-only api/scripts/checkDesignSystem.ts
 */

import {
  brandFromIdem,
  buildTokens,
  contrastRatio,
  DEFAULT_STYLE_ID,
  logosFromIdem,
  resolveStyle as engineStyle,
  STYLE_DATA,
} from '@idem/graphic-engine';
import {
  ART_DIRECTION_STYLES,
  ART_DIRECTION_STYLE_IDS,
  buildStyleCatalogBrief,
  resolveStyle,
  SELECTABLE_ART_DIRECTION_STYLE_IDS,
} from '../services/brand/artDirection.catalog';
import { ArtDirectionModel } from '../models/art-direction.model';
import { buildImageNegativePrompt, buildImageStyleModifier } from '../utils/art-direction.util';
import { resolveLogoDeclensions } from '../utils/brand-context.util';
import { brandFontLinks, brandFontsHref, buildGoogleFontLinks } from '../utils/google-fonts.util';
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

// 1. Le catalogue (que le directeur artistique choisit) et la table du moteur (que les pages lisent)
//    parlent des MÊMES styles. Un style présent d'un seul côté retomberait en silence sur l'éditorial.
console.log('\n[1] Catalogue et moteur graphique');
const engineIds = Object.keys(STYLE_DATA);
check(
  'chaque style du catalogue est connu du moteur, et réciproquement',
  ART_DIRECTION_STYLE_IDS.every((id) => engineIds.includes(id)) && engineIds.every((id) => (ART_DIRECTION_STYLE_IDS as string[]).includes(id)),
  `catalogue seul : ${ART_DIRECTION_STYLE_IDS.filter((id) => !engineIds.includes(id)).join(', ') || '—'} · moteur seul : ${engineIds.filter((id) => !(ART_DIRECTION_STYLE_IDS as string[]).includes(id)).join(', ') || '—'}`
);
for (const id of ART_DIRECTION_STYLE_IDS) {
  const style = ART_DIRECTION_STYLES[id];
  const data = STYLE_DATA[id];
  if (!data) continue;
  check(
    `${id}: même rayon, même ratio, même fond des deux côtés`,
    data.radius === style.radius && data.typeRatio === style.typeRatio && data.surface === style.surface,
    `catalogue ${style.radius}px · ${style.typeRatio} · ${style.surface} ; moteur ${data.radius}px · ${data.typeRatio} · ${data.surface}`
  );
  // Un style à fond sombre imposé n'est jamais proposé : la plateforme est à surface claire.
  check(`${id}: proposable si et seulement si son fond n'est pas imposé sombre`, data.selectable === (style.surface !== 'dark'));
  check(
    `${id}: fiche complète`,
    !!(style.name && style.essence && style.fitsBrands && style.imagePromptModifier && style.imageNegativePrompt && style.bans.length && style.typeRatio >= 1.25)
  );
  // Les appariements du moteur servent de typographie à une marque qui n'en a pas encore : une police de la
  // liste anti-générique y annulerait tout le reste.
  check(
    `${id}: aucun appariement du moteur ne repose sur une police bannie`,
    data.pairings.length >= 2 && !/\b(Inter|Roboto|Open Sans|Lato|Montserrat|Poppins|Space Grotesk|Arial|Helvetica)\b/.test(data.pairings.join(' ')),
    data.pairings.join(' · ')
  );
}

console.log('\n[2] Résolution et sélection');
check('style inconnu → repli éditorial dans le catalogue, jamais une exception', resolveStyle('inexistant').id === 'editorial');
check('style inconnu → repli éditorial dans le moteur', engineStyle('inexistant').id === DEFAULT_STYLE_ID && DEFAULT_STYLE_ID === 'editorial');
const brief = buildStyleCatalogBrief();
check(
  'le catalogue condensé propose les styles à fond clair, et eux seuls',
  brief.split('\n').length === SELECTABLE_ART_DIRECTION_STYLE_IDS.length &&
    ART_DIRECTION_STYLE_IDS.filter((id) => ART_DIRECTION_STYLES[id].surface === 'dark').every((id) => !brief.includes(`- ${id} —`)),
  `${brief.split('\n').length} lignes`
);

// 3. La politique de surface claire est garantie en CODE, pas demandée au modèle : une marque dont la
//    palette est sombre garde des documents clairs, sauf demande explicite (`allowDark`).
console.log('\n[3] Surface claire');
const darkPalette = { primary: '#1447e6', secondary: '#000060', accent: '#22d3ee', background: '#0b0b0b', text: '#f1f1f1' };
const darkened: string[] = [];
for (const id of ART_DIRECTION_STYLE_IDS) {
  const { brand, direction } = brandFromIdem({ name: 'Acme', branding: { colors: { colors: darkPalette }, artDirection: { styleId: id } } });
  const tokens = buildTokens({ brand, direction, format: 'a4-portrait' });
  if (tokens.color.dark || contrastRatio(tokens.color.ink, tokens.color.ground) < 4.5) darkened.push(`${id} (${tokens.color.ground} / ${tokens.color.ink})`);
}
check('palette sombre, 20 styles : fond clair et encre lisible (≥ 4,5:1) sans demande explicite', darkened.length === 0, darkened.join(' · '));
const asked = buildTokens({ brand: { name: 'Acme', palette: darkPalette }, direction: { styleId: 'cyberpunk' }, format: 'a4-portrait', allowDark: true });
check('demande explicite : le fond sombre de la marque est honoré, toujours lisible', asked.color.dark && contrastRatio(asked.color.ink, asked.color.ground) >= 4.5, `${asked.color.ground} / ${asked.color.ink}`);

console.log("\n[4] Direction artistique des images");
const direction: ArtDirectionModel = {
  styleId: 'swiss',
  styleName: 'Design Suisse',
  tagline: 'La grille comme preuve de fiabilité',
  rationale: "Un opérateur logistique vend la fiabilité, pas l'audace.",
  keywords: ['grille', 'encre', 'papier kraft'],
  layout: { grid: '12 colonnes', density: 'balanced', whitespace: '40%', signatureMove: 'filet de 4px' },
  color: { distribution: '70/20/10', application: 'aplats', contrast: 'franc' },
  typography: { scaleContrast: '1.25', caseAndTracking: 'bas de casse', treatment: 'aucun' },
  imagery: { medium: 'photography', subjects: 'entrepôts et gestes du métier', treatment: 'noir et blanc', lighting: 'diffuse', framing: 'frontal' },
  graphicDevices: ['filets épais'],
  dos: ['aligner tout à gauche'],
  donts: ['aucun arrondi'],
  imagePromptModifier: 'swiss international style photography',
};
const modifier = buildImageStyleModifier(direction);
check("modificateur d'image : le rendu du style, la lumière et le traitement de la marque", modifier.includes('swiss international') && modifier.includes('diffuse') && modifier.includes('noir et blanc'), modifier);
check('prompt négatif non vide', buildImageNegativePrompt(direction).length > 20);
check('aucune direction → aucun modificateur', buildImageStyleModifier(null) === '');

console.log('\n[5] Déclinaisons du logo');
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
const declensions = resolveLogoDeclensions(logo);
check('déclinaisons résolues', !!declensions && new Set(Object.values(declensions)).size >= 4);
check('déclinaison manquante → repli sur le primaire, jamais un trou', declensions?.iconMono === 'https://cdn.example/logo-primary.png');
check('sans logo → aucune déclinaison (le moteur compose la signature en lettres)', resolveLogoDeclensions(null) === null);
check(
  'un SVG brut devient une image affichable, jamais du balisage collé dans la page',
  resolveLogoDeclensions({ ...logo, assetUrls: undefined, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' } as LogoModel)?.primary.startsWith('data:image/svg+xml;base64,') === true
);
const logos = logosFromIdem(declensions);
check(
  'le moteur reçoit la bonne encre pour chaque fond (clair → encre sombre, sombre → encre claire)',
  logos?.onLight === 'https://cdn.example/logo-wt-light.png' && logos?.onDark === 'https://cdn.example/logo-wt-dark.png' && logos?.icon === 'https://cdn.example/logo-icon.png'
);
check('pas de logo → le moteur n’en reçoit aucun (jamais un faux)', logosFromIdem(null) === undefined && brandFromIdem({ name: 'Acme' }).brand.logos === undefined);

console.log('\n[6] Chargement des polices de marque');
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

// Vilevile est fabriquée par IDEM : Google ne la connaît pas. La demander doit
// produire la police embarquée, jamais un lien qui ne chargerait rien.
const vilevile = buildGoogleFontLinks(['Vilevile']);
check('la police de marque est embarquée, pas demandée à Google', !vilevile.includes('fonts.googleapis.com'));
check('la police de marque arrive bien dans le document', vilevile.includes("font-family: 'Vilevile'"));
check("l'approche de la police est publiée aux gabarits", vilevile.includes('--idem-font-tracking'));

// Les dessins de PrimeIcons sont dans Vilevile : un document rendu côté serveur
// doit pouvoir poser un `<i class="pi pi-check">` sans rien charger de plus.
check('les icônes voyagent avec la police', vilevile.includes('.pi-check:before'));
check('les icônes pointent sur la police de marque', /\.pi \{[^}]*Vilevile/.test(vilevile));

console.log(failures === 0 ? '\n✅ Socle de direction artistique conforme\n' : `\n❌ ${failures} vérification(s) en échec\n`);
process.exit(failures === 0 ? 0 : 1);
