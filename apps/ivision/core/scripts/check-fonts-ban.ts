/**
 * Contrôle des polices (22/11/2026) — sans réseau ni modèle.
 *
 *   npm run check:fonts-ban
 *
 *   - Bricolage Grotesque n'est jamais proposée, ni chargée : site qui l'emploie, typographie enregistrée, liens ;
 *   - les polices par défaut (Inter, Roboto, Poppins…) sont reconnues : la refonte demande alors s'il faut en changer.
 */
import { brandFontLinks, brandFontsHref, buildGoogleFontsHref } from '../src/design/google-fonts';
import { isDefaultFont, typographyProposals, GOOGLE_FONTS } from '../src/site/typography';
import { withoutBannedFonts } from '../src/site/banned-fonts';

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const fromSite = typographyProposals([{ family: 'Bricolage Grotesque', usage: 'heading', weight: 800, area: 9000 }, { family: 'Inter', usage: 'body', weight: 400, area: 50000 }]);
check('site qui l’emploie : jamais reprise ni proposée', !fromSite.proposals.some((p) => /bricolage/i.test(`${p.display} ${p.body} ${p.displayCss}`)), fromSite.proposals.map((p) => p.display).join(', '));
check('absente du catalogue des familles', !Object.values(GOOGLE_FONTS).flat().some((f) => /bricolage/i.test(f)));
const stored = { primaryFont: 'Bricolage Grotesque', secondaryFont: 'Figtree', url: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400&display=swap' };
check('liens de marque : jamais chargée', !/bricolage/i.test(brandFontLinks(stored)) && !/bricolage/i.test(brandFontsHref(stored)), brandFontsHref(stored));
check('lien Google par nom : jamais chargée', !/bricolage/i.test(buildGoogleFontsHref(['Bricolage Grotesque'])));
check('typographie enregistrée réécrite', withoutBannedFonts(stored).primaryFont === 'Epilogue');
check('polices par défaut reconnues', ['Inter', 'Roboto', 'Poppins', 'Open Sans', 'Arial'].every(isDefaultFont));
check('polices de marque non par défaut', !['Fraunces', 'Epilogue', 'Young Serif', 'Satoshi'].some(isDefaultFont));

console.log(failed ? `\n${failed} contrôle(s) en échec` : '\nTout est bon');
process.exit(failed ? 1 : 0);
