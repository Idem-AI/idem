/**
 * `npm run check:site-edit` — la retouche ciblée d'un site vitrine, SANS modèle (règles pures, zéro jeton) :
 * aiguillage de la demande, retouches courantes du design system (recompilé), blocs RECHERCHER / REMPLACER,
 * garde-fous (police, couleurs, nom, section vidée) et pose d'une nouvelle section dans sa page.
 */
import { applyPatches, applyTheme, guardEdit, guardTheme, parsePatches, quickTheme, routeEdit, themeChanges } from '../src/siteEngine/editPlan.js';
import { insertSection } from '../src/siteEngine/edit.js';
import { designSystemFiles, DESIGN_SYSTEM_PATHS } from '../src/siteEngine/template.js';

let passes = 0;
let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const HERO = `import { Button } from '@/components/ui/button';

export default function Hero() {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="font-heading text-display text-foreground">Le café qui réveille Abidjan</h1>
        <p className="text-lead text-muted-foreground mt-4">Des grains torréfiés chaque semaine.</p>
        <Button className="mt-8">Commander</Button>
      </div>
    </section>
  );
}
`;
const FOOTER = `export default function SiteFooter() {
  return <footer className="bg-primary text-primary-foreground py-10"><p>Kora Café</p></footer>;
}
`;
const PAGE = `import SiteHeader from '@/components/site/SiteHeader.tsx';
import SiteFooter from '@/components/site/SiteFooter.tsx';
import SectionBoundary from '@/components/site/section-boundary';
import Hero from '@/sections/home/Hero.tsx';
import Services from '@/sections/home/Services.tsx';

export default function HomePage() {
  return (
    <>
      <main id="contenu">
        <SectionBoundary name="Hero">
          <Hero />
        </SectionBoundary>
        <SectionBoundary name="Services">
          <Services />
        </SectionBoundary>
      </main>
    </>
  );
}
`;
const config = {
  schemaVersion: 1,
  appearance: { colorMode: 'light', density: 'comfortable' },
  tokens: {
    colors: { background: '#fbf7f2', foreground: '#2a1d17', primary: '#b4532a' },
    typography: { headingFont: 'Playfair Display', bodyFont: 'Inter', scale: 1.25 },
    radius: { base: '0.5rem' },
  },
};
const files: Record<string, string> = {
  'idem.pages.json': JSON.stringify({ pages: [{ path: '/', module: 'src/pages/home.tsx' }] }),
  'src/pages/home.tsx': PAGE,
  'src/sections/home/Hero.tsx': HERO,
  'src/sections/home/Services.tsx': 'export default function Services() { return <section><h2 className="text-h2">Nos services</h2></section>; }\n',
  'src/components/site/SiteFooter.tsx': FOOTER,
  [DESIGN_SYSTEM_PATHS.source]: JSON.stringify(config),
};

// ── 1. Aiguillage ──
check('« diminue la taille des titres » → le design system (aucune section réécrite)', routeEdit('Diminue la taille des titres', files)?.scope === 'theme');
check('« change la police » → le design system', routeEdit('Change la police du site', files)?.scope === 'theme');
const hero = routeEdit('Dans le hero, mets le bouton en plus grand', files);
check('« dans le hero… » → la section Hero seule', hero?.scope === 'files' && hero.paths.join() === 'src/sections/home/Hero.tsx', JSON.stringify(hero));
const footer = routeEdit('Ajoute mon numéro dans le pied de page', files);
check('« le pied de page » → SiteFooter', footer?.scope === 'files' && footer.paths[0] === 'src/components/site/SiteFooter.tsx');
const quoted = routeEdit('Remplace « Des grains torréfiés chaque semaine » par « Torréfié à Cocody »', files);
check('un texte cité → la section qui le contient', quoted?.scope === 'files' && quoted.paths[0] === 'src/sections/home/Hero.tsx');
check('« ajoute une section témoignages » → nouvelle section sur la page d’accueil', JSON.stringify(routeEdit('Ajoute une section témoignages', files)) === JSON.stringify({ scope: 'new-section', page: 'home' }));
check('une demande floue → aiguillée par le modèle (null)', routeEdit('Rends ça plus joli', files) === null);

// ── 2. Design system ──
const smaller = quickTheme('Diminue la taille des titres', config);
check('titres plus petits : le rapport d’échelle baisse, sans modèle', smaller?.set['tokens.typography.scale'] === 1.19, JSON.stringify(smaller?.set));
check('titres plus grands : il monte', quickTheme('Mets les titres plus grands', config)?.set['tokens.typography.scale'] === 1.31);
check('coins plus arrondis', typeof quickTheme('Arrondis davantage les coins des cartes', config)?.set['tokens.radius.base'] === 'string');
const before = designSystemFiles(config).files[DESIGN_SYSTEM_PATHS.css];
const after = designSystemFiles(applyTheme(config, smaller!.set)).files[DESIGN_SYSTEM_PATHS.css];
const fontLines = (css: string) => css.split('\n').filter((l) => /font-(heading|body|family)|--font/.test(l)).join('\n');
check('recompilé : les tailles de titres changent…', before !== after);
check('… et les polices restent les mêmes', fontLines(before) === fontLines(after));
check('le réglage modifié est le seul changé', themeChanges(config, smaller!.set).join() === 'tokens.typography.scale');
const guarded = guardTheme('Diminue la taille des titres', { 'tokens.typography.scale': 1.2, 'tokens.typography.headingFont': 'Roboto', 'tokens.colors.primary': '#000' });
check('le modèle ne peut pas changer la police ni les couleurs sans demande', Object.keys(guarded.allowed).join() === 'tokens.typography.scale' && guarded.refused.length === 2);
check('une police demandée est admise', 'tokens.typography.headingFont' in guardTheme('Change la police des titres', { 'tokens.typography.headingFont': 'Roboto' }).allowed);
check('un réglage inconnu est refusé', guardTheme('x', { 'tokens.hack': 1 }).refused.length === 1);

// ── 3. Blocs RECHERCHER / REMPLACER ──
const answer = `<<<<<<< SEARCH
        <Button className="mt-8">Commander</Button>
=======
        <Button size="lg" className="mt-8">Commander</Button>
>>>>>>> REPLACE
REPLY: J’ai agrandi le bouton.`;
const patches = parsePatches(answer);
check('un bloc lu', patches.length === 1);
const applied = applyPatches(HERO, patches);
check('appliqué : seule la ligne visée change', applied.applied === 1 && applied.code.replace('size="lg" ', '') === HERO);
const loose = applyPatches(HERO, [{ search: '<Button className="mt-8">Commander</Button>', replace: '<Button className="mt-10">Commander</Button>' }]);
check('retrouvé aux espaces près (indentation)', loose.applied === 1 && loose.code.includes('mt-10'));
const missing = applyPatches(HERO, [{ search: '<h3>Inexistant</h3>', replace: 'x' }]);
check('un passage introuvable n’est jamais deviné', missing.applied === 0 && missing.code === HERO && missing.missed.length === 1);

// ── 4. Garde-fous ──
const fontSwap = HERO.replace('font-heading text-display', 'font-serif text-h1');
check('police changée sans demande → refusé', guardEdit(HERO, fontSwap, 'Diminue la taille du titre').some((p) => /police/i.test(p)));
check('taille seule changée → accepté', guardEdit(HERO, HERO.replace('text-display', 'text-h1'), 'Diminue la taille du titre').length === 0);
const colorSwap = HERO.replace('bg-background', 'bg-blue-600');
check('couleur changée sans demande → refusé', guardEdit(HERO, colorSwap, 'Agrandis le titre').some((p) => /couleur/i.test(p)));
check('couleur demandée → accepté', guardEdit(HERO, colorSwap, 'Mets le fond du hero en bleu').length === 0);
check('nom du composant changé → refusé', guardEdit(HERO, HERO.replace('function Hero', 'function Banner'), 'Change le titre').length === 1);
const gutted = HERO.replace(/<div[\s\S]*<\/div>/, '<div />');
check('section vidée sans demande → refusé', guardEdit(HERO, gutted, 'Change le titre').length === 1);
check('retrait demandé → admis', guardEdit(HERO, gutted, 'Supprime le texte et le bouton du hero').length === 0);

// ── 5. Nouvelle section ──
const placed = insertSection(PAGE, 'Testimonials', '@/sections/home/Testimonials.tsx', 'Hero');
check('nouvelle section : son import ajouté', placed.includes("import Testimonials from '@/sections/home/Testimonials.tsx';"));
check('posée juste après la section nommée', placed.indexOf('<Testimonials />') > placed.indexOf('<Hero />') && placed.indexOf('<Testimonials />') < placed.indexOf('<Services />'));
check('le reste de la page est intact', placed.replace(/\n\s*<SectionBoundary name="Testimonials">\n\s*<Testimonials \/>\n\s*<\/SectionBoundary>/, '').replace("import Testimonials from '@/sections/home/Testimonials.tsx';\n", '') === PAGE);
const atEnd = insertSection(PAGE, 'Faq', '@/sections/home/Faq.tsx');
check('sans section nommée : à la fin du contenu', atEnd.indexOf('<Faq />') > atEnd.indexOf('<Services />') && atEnd.indexOf('<Faq />') < atEnd.indexOf('</main>'));

console.log(`\n${passes} vérifications réussies, ${failures} en échec`);
process.exit(failures ? 1 : 0);
