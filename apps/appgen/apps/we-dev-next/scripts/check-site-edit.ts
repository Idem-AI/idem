/**
 * `npm run check:site-edit` — la retouche ciblée d'un site vitrine, SANS modèle (règles pures, zéro jeton) :
 * aiguillage de la demande, retouches courantes du design system (recompilé), blocs RECHERCHER / REMPLACER,
 * garde-fous (police, couleurs, nom, section vidée) et pose d'une nouvelle section dans sa page.
 */
import { applyPatches, applyTheme, guardEdit, guardTheme, NOTHING_ALLOWED, parsePatches, quotedOwners, themeChanges } from '../src/siteEngine/editPlan.js';
import { buildSiteMap, mapIds, readSiteData, renderSiteMap, writeSiteData } from '../src/siteEngine/siteMap.js';
import { checkDataValue, pointedScope } from '../src/siteEngine/edit.js';
import { locateElement, readPointed, touchesElement } from '../src/siteEngine/pointed.js';
import { buildCodeMap } from '../src/utils/codeMap.js';
import { isAccountLimitError, isTransientModelError } from '../src/utils/resilientStream.js';
import { accountLimitMessage } from '../src/siteEngine/modelCaller.js';
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
// Aucune demande n'est aiguillée par le code : un texte cité n'est qu'un indice donné à l'agent (où il se trouve).
const quoted = quotedOwners('Remplace « Des grains torréfiés chaque semaine » par « Torréfié à Cocody »', files);
check('texte cité : l’agent apprend où il se trouve', quoted.length === 1 && quoted[0].paths.join() === 'src/sections/home/Hero.tsx', JSON.stringify(quoted));
check('aucun indice inventé pour une demande sans citation', quotedOwners('Tu as dupliqué les éléments de la navbar', files).length === 0);

// La carte du site : ce que l'agent d'aiguillage lit.
const HEADER = `import { site } from '@/site/data';\nexport default function SiteHeader({ current }: { current: string }) {\n  return <header><nav>{site.navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav></header>;\n}\n`;
const DATA = `import { localize } from '@/i18n';\n\nexport const site = localize(${JSON.stringify({ name: 'Café Awa', navigation: [{ label: 'Accueil', href: '/' }, { label: 'Services', href: '/services/' }, { label: 'Accueil', href: '/accueil-2/' }, { label: 'Services', href: '/services-2/' }], contact: { phone: '+225 07 00 00 00 01', email: '', channels: [] } }, null, 2)});\n\nexport type Site = typeof site;\n`;
const mapped = { ...files, 'src/components/site/SiteHeader.tsx': HEADER, 'src/site/data.ts': DATA };
const map = buildSiteMap(mapped);
const text = renderSiteMap(map);
check('carte : le menu (données) et ses doublons visibles', /\[data\.navigation\][^\n]*Accueil → \/ · Services → \/services\/ · Accueil → \/accueil-2\//.test(text), text);
check('carte : l’en-tête dit qu’il affiche le menu', /\[SiteHeader\][^\n]*lit site\.navigation/.test(text));
check('carte : sections dans l’ordre de la page, avec leurs textes', /1\. \[home\/Hero\][^\n]*Des grains torréfiés/.test(text) && /2\. \[home\/Services\]/.test(text), text);
const ids = mapIds(map);
check('carte : identifiants des parties modifiables', ids.components.has('home/Hero') && ids.components.has('SiteHeader') && ids.components.has('SiteFooter') && ids.data.includes('navigation') && ids.data.includes('contact'));

// Les données : lues, vérifiées, réécrites sans toucher au reste du module.
const data = readSiteData(DATA)!;
const rewritten = writeSiteData(DATA, { ...data, name: 'Café Awa & Fils' });
check('données : relues puis réécrites, le module intact autour', readSiteData(rewritten)?.name === 'Café Awa & Fils' && rewritten.startsWith("import { localize } from '@/i18n';") && rewritten.includes('export type Site = typeof site;'));
const menu = checkDataValue('navigation', [{ label: 'Accueil', href: '/' }, { label: 'Services', href: '/services/' }, { label: 'Accueil', href: '/' }], '');
check('menu : une page n’y figure qu’une fois', 'value' in menu && (menu.value as unknown[]).length === 2, JSON.stringify(menu));
check('menu : une phrase n’est pas un libellé', 'problem' in checkDataValue('navigation', [{ label: 'VACANCES’NUMERIK 2026 : Compte-rendu de l’Atelier Programmation Jeux Vidéos', href: '/a/' }], ''));
check('coordonnées : un numéro inventé est refusé', 'problem' in checkDataValue('contact', { phone: '+225 01 23 45 67 89', email: '', channels: [] }, 'Ajoute mon numéro'));
check('coordonnées : un numéro donné dans la demande est admis', 'value' in checkDataValue('contact', { phone: '+225 01 23 45 67 89', email: '', channels: [] }, 'Mon numéro est le +225 01 23 45 67 89'));

// Ce que la personne a désigné dans l'aperçu (outil Dessin) : la retouche s'y tient.
{
  const navAt = HEADER.indexOf('<nav>');
  const scope = pointedScope(map, readPointed({ elements: [{ tag: 'nav', kind: 'container', text: 'Accueil Services Accueil Services', filePath: 'src/components/site/SiteHeader.tsx', start: navAt, owner: 'src/components/site/SiteHeader.tsx', ownerStart: 0, how: 'area' }] }) ?? undefined);
  check('désigné : l’en-tête et le menu qu’il affiche, rien d’autre', !!scope && scope.ids.has('SiteHeader') && scope.ids.has('data.navigation') && !scope.ids.has('home/Hero') && !scope.ids.has('data.contact'), JSON.stringify(scope && [...scope.ids]));
  check('désigné : un chemin hors du projet est ignoré', readPointed({ elements: [{ filePath: '../../etc/passwd', owner: 'x', start: 1 }] }) === null);
  const heroPath = 'src/sections/home/Hero.tsx';
  const buttonAt = HERO.indexOf('<Button');
  const span = locateElement(HERO, heroPath, { start: buttonAt, text: '' });
  check('désigné : l’élément retrouvé à sa position exacte', span?.tag === 'Button' && span.start === buttonAt);
  const moved = locateElement(HERO, heroPath, { start: 99999, text: span ? HERO.slice(span.start, span.end).replace(/<[^>]+>/g, ' ').trim() : '' });
  check('désigné : retrouvé par son texte si le fichier a bougé', !!moved && moved.start === buttonAt, JSON.stringify(moved));
  const inside = HERO.slice(0, buttonAt + 7) + ' variant="secondary"' + HERO.slice(buttonAt + 7);
  check('désigné : une retouche de l’élément le touche…', !!span && touchesElement(HERO, inside, span));
  check('… une retouche ailleurs dans le fichier est refusée', !!span && !touchesElement(HERO, HERO.replace('export default function', '// x\nexport default function'), span));
}

// Le compte du fournisseur bloqué (plafond de la clé) : reconnu, pas pris pour une saturation passagère.
{
  const limit = Object.assign(new Error('Key limit exceeded (monthly limit). Manage it using https://openrouter.ai/workspaces/default/keys/x $50.04 of $50.00 used; resets 2026-11'), { statusCode: 403 });
  check('compte bloqué : plafond de la clé reconnu', isAccountLimitError(limit) && !isTransientModelError(limit));
  check('compte bloqué : crédits épuisés (402) reconnus', isAccountLimitError(Object.assign(new Error('Payment Required'), { statusCode: 402 })));
  check('une saturation n’est pas un compte bloqué', !isAccountLimitError(Object.assign(new Error('Provider returned error: high demand'), { statusCode: 429 })));
  check('compte bloqué : la personne lit la vérité', /limite de dépense/.test(accountLimitMessage(true)) && !/réessayez dans un instant/.test(accountLimitMessage(true)));
}

// La carte d'une application : une ligne par fichier, ce qu'il fait.
const appMap = buildCodeMap({
  'frontend/src/pages/Login.jsx': "import { api } from '../lib/api';\nexport default function Login() { const go = () => fetch('/api/auth/login'); return <button onClick={go}>Se connecter</button>; }\n",
  'backend/src/routes/auth.js': "router.post('/api/auth/login', handler);\n",
  'frontend/src/App.jsx': '<Route path="/login" element={<Login />} />',
});
check('application : écran, texte affiché et API appelée', /Login\.jsx — déclare Login ; appelle \/api\/auth\/login ; affiche « Se connecter » ; importe \.\.\/lib\/api/.test(appMap), appMap);
check('application : route servie et écrans routés', /auth\.js — sert POST \/api\/auth\/login/.test(appMap) && /App\.jsx — écrans \/login/.test(appMap), appMap);

// ── 2. Design system ──
// Le réglage est choisi par le modèle (il a compris la demande) ; le code l'applique et le recompile.
const smaller = { set: { 'tokens.typography.scale': 1.19 } };
const before = designSystemFiles(config).files[DESIGN_SYSTEM_PATHS.css];
const after = designSystemFiles(applyTheme(config, smaller!.set)).files[DESIGN_SYSTEM_PATHS.css];
const fontLines = (css: string) => css.split('\n').filter((l) => /font-(heading|body|family)|--font/.test(l)).join('\n');
check('recompilé : les tailles de titres changent…', before !== after);
check('… et les polices restent les mêmes', fontLines(before) === fontLines(after));
check('le réglage modifié est le seul changé', themeChanges(config, smaller!.set).join() === 'tokens.typography.scale');
// Ce que la demande autorise vient de l'agent qui l'a comprise, plus d'une liste de mots.
const guarded = guardTheme(NOTHING_ALLOWED, { 'tokens.typography.scale': 1.2, 'tokens.typography.headingFont': 'Roboto', 'tokens.colors.primary': '#000' });
check('sans autorisation, ni police ni couleurs', Object.keys(guarded.allowed).join() === 'tokens.typography.scale' && guarded.refused.length === 2);
check('« donne plus de peps » compris comme couleurs → admis', 'tokens.colors.primary' in guardTheme({ ...NOTHING_ALLOWED, colors: true }, { 'tokens.colors.primary': '#e4572e' }).allowed);
check('une police autorisée est admise', 'tokens.typography.headingFont' in guardTheme({ ...NOTHING_ALLOWED, fonts: true }, { 'tokens.typography.headingFont': 'Roboto' }).allowed);
check('le thème sombre seulement s’il est compris dans la demande', guardTheme(NOTHING_ALLOWED, { 'appearance.colorMode': 'dark' }).refused.length === 1);
check('un réglage inconnu est refusé', guardTheme({ fonts: true, colors: true, removal: true, dark: true }, { 'tokens.hack': 1 }).refused.length === 1);

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
check('police changée sans demande → refusé', guardEdit(HERO, fontSwap, NOTHING_ALLOWED).some((p) => /police/i.test(p)));
check('taille seule changée → accepté', guardEdit(HERO, HERO.replace('text-display', 'text-h1'), NOTHING_ALLOWED).length === 0);
const colorSwap = HERO.replace('bg-background', 'bg-blue-600');
check('couleur changée sans demande → refusé', guardEdit(HERO, colorSwap, NOTHING_ALLOWED).some((p) => /couleur/i.test(p)));
check('couleurs comprises dans la demande → accepté', guardEdit(HERO, colorSwap, { ...NOTHING_ALLOWED, colors: true }).length === 0);
check('nom du composant changé → refusé', guardEdit(HERO, HERO.replace('function Hero', 'function Banner'), NOTHING_ALLOWED).length === 1);
const gutted = HERO.replace(/<div[\s\S]*<\/div>/, '<div />');
check('section vidée sans demande → refusé', guardEdit(HERO, gutted, NOTHING_ALLOWED).length === 1);
check('retrait compris dans la demande → admis', guardEdit(HERO, gutted, { ...NOTHING_ALLOWED, removal: true }).length === 0);

// ── 5. Nouvelle section ──
const placed = insertSection(PAGE, 'Testimonials', '@/sections/home/Testimonials.tsx', 'Hero');
check('nouvelle section : son import ajouté', placed.includes("import Testimonials from '@/sections/home/Testimonials.tsx';"));
check('posée juste après la section nommée', placed.indexOf('<Testimonials />') > placed.indexOf('<Hero />') && placed.indexOf('<Testimonials />') < placed.indexOf('<Services />'));
check('le reste de la page est intact', placed.replace(/\n\s*<SectionBoundary name="Testimonials">\n\s*<Testimonials \/>\n\s*<\/SectionBoundary>/, '').replace("import Testimonials from '@/sections/home/Testimonials.tsx';\n", '') === PAGE);
const atEnd = insertSection(PAGE, 'Faq', '@/sections/home/Faq.tsx');
check('sans section nommée : à la fin du contenu', atEnd.indexOf('<Faq />') > atEnd.indexOf('<Services />') && atEnd.indexOf('<Faq />') < atEnd.indexOf('</main>'));

console.log(`\n${passes} vérifications réussies, ${failures} en échec`);
process.exit(failures ? 1 : 0);
