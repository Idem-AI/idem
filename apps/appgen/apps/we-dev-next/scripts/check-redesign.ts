/**
 * Contrôle de la refonte iCode (21/11/2026) — sans réseau ni modèle.
 *
 *   npm run check:redesign
 *
 *   1. la forme qu'avait chaque section sur l'ancien site est devinée par le code (`oldShapeOf`) ;
 *   2. une section qui remet un contenu dans sa forme d'avant en reçoit une autre (`departFromOld`) ;
 *   3. la règle de l'architecte : architecture libre (refonte complète), structure gardée (« surtout le design ») ;
 *   4. chaque refonte est une nouvelle session : un projet qui en porte déjà une n'est jamais réécrit (`redesignTarget`) ;
 *   5. la marque de l'en-tête : logotype seul, icône + nom, pastille pour un logo clair, nom sans logo (TSX valide).
 */
import { transformSync } from 'esbuild';
import { departFromOld, SiteManifest } from '../src/siteEngine/manifest.js';
import { InventorySection, oldShapeOf, oldShapes, inventoryOutline, SiteInventory, linkMapper } from '../src/siteEngine/redesign/inventory.js';
import { oldMenuOf } from '../src/siteEngine/orchestrator.js';
import { siteDataOf } from '../src/siteEngine/siteData.js';
import { redesignArchitect, redesignDesign } from '../src/siteEngine/redesign/brief.js';
import { redesignTarget } from '../src/commands/workflows/redesign.js';
import { renderBrandModule } from '../src/siteEngine/siteData.js';
import type { ProjectModel } from '../src/types/project.js';
import type { SiteContent } from '../src/siteEngine/redesign/idemClient.js';
import { readFonts } from '../src/design/charter.js';
import { FONT_PAIRINGS } from '../src/design/artDirections.js';

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const img = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://x/${i}.jpg`, alt: '', width: 800, height: 600, kind: 'img' as const }));
const section = (id: string, over: Partial<InventorySection>): InventorySection => ({ id, headings: ['Titre'], texts: [], items: [], ctas: [], images: [], ...over });

// 1. Formes de l'ancien site
const cards = section('p0.s1', { items: ['A', 'B', 'C'], images: img(3), texts: ['x'] });
const list = section('p0.s2', { items: ['A', 'B', 'C', 'D'] });
const split = section('p0.s3', { texts: ['Notre histoire…'], images: img(1) });
const gallery = section('p1.s0', { images: img(8) });
const form = section('p2.s0', { form: ['nom', 'email'] });
const band = section('p0.s4', { ctas: [{ label: 'Appeler', href: 'tel:1', kind: 'phone' }], texts: ['Une question ?'] });
const text = section('p1.s1', { texts: ['Paragraphe', 'Paragraphe 2'] });
check('cartes illustrées → cards', oldShapeOf(cards) === 'cards');
check('liste sans images → features', oldShapeOf(list) === 'features');
check('texte + image → split-media', oldShapeOf(split) === 'split-media');
check('beaucoup d’images → gallery', oldShapeOf(gallery) === 'gallery');
check('formulaire → form', oldShapeOf(form) === 'form');
check('phrase + bouton → cta-band', oldShapeOf(band) === 'cta-band');
check('texte seul → intro', oldShapeOf(text) === 'intro');

const inventory: SiteInventory = {
  origin: 'https://exemple.cm',
  language: 'fr',
  pages: [
    { url: 'https://exemple.cm/', path: '/', title: 'Accueil', sections: [section('p0.s0', { texts: ['Bienvenue'], images: img(1) }), cards, list, split, band] },
    { url: 'https://exemple.cm/galerie', path: '/galerie', title: 'Galerie', sections: [gallery, text] },
    { url: 'https://exemple.cm/contact', path: '/contact', title: 'Contact', sections: [form] },
  ],
  skipped: [],
  navigation: [],
  footer: { texts: [], links: [] },
  contact: { phones: [], emails: [], whatsapp: [], addresses: [], socials: [] },
  assets: { images: [] },
};
const shapes = oldShapes(inventory);
const outline = inventoryOutline(inventory, true);
check('le plan dit la forme actuelle de chaque section', /p0\.s1 : .*forme actuelle : grille de cartes/.test(outline) && /p0\.s3 : .*texte à côté d’une image/.test(outline));

// 2. Départ des formes d'avant
const manifest = {
  pages: [
    {
      key: 'home',
      path: '/',
      label: 'Accueil',
      purpose: '',
      seoTitle: '',
      seoDescription: '',
      source: 0,
      sections: [
        { id: 'hero', component: 'Hero', brief: '', visual: 'photo', layout: 'hero', sources: ['p0.s0'] },
        { id: 'services', component: 'Services', brief: '', visual: 'photo', layout: 'cards', sources: ['p0.s1'] },
        { id: 'atouts', component: 'Atouts', brief: '', visual: 'none', layout: 'features', sources: ['p0.s2'] },
        { id: 'histoire', component: 'Histoire', brief: '', visual: 'photo', layout: 'split-media', sources: ['p0.s3'] },
        { id: 'galerie', component: 'Galerie', brief: '', visual: 'photo', layout: 'gallery', sources: ['p1.s0'] },
        { id: 'contact', component: 'Contact', brief: '', visual: 'none', layout: 'form', sources: ['p2.s0'] },
        { id: 'neuf', component: 'Neuf', brief: '', visual: 'none', layout: 'features', sources: [] },
      ],
    },
  ],
} as unknown as SiteManifest;
const changed = departFromOld(manifest, shapes);
const layouts = Object.fromEntries(manifest.pages[0].sections.map((s) => [s.id, s.layout]));
check('cartes d’avant → autre composition', layouts.services !== 'cards', String(layouts.services));
check('liste d’avant → autre composition', layouts.atouts !== 'features', String(layouts.atouts));
check('texte + image d’avant → autre composition', layouts.histoire !== 'split-media', String(layouts.histoire));
check('ouverture gardée', layouts.hero === 'hero');
check('galerie et formulaire gardés', layouts.galerie === 'gallery' && layouts.contact === 'form');
check('section sans origine intouchée', layouts.neuf === 'features');
check('section sans visuel : jamais une composition à visuel', !['full-bleed-media', 'feature-rows'].includes(String(layouts.atouts)), String(layouts.atouts));
check('aucune composition répétée de suite', manifest.pages[0].sections.every((s, i, all) => i === 0 || s.layout !== all[i - 1].layout));
check('nombre de changements rendu', changed === 3, String(changed));

// 3. Les règles données aux agents
const content = { url: 'https://exemple.cm', title: '', language: 'fr', headings: [], paragraphs: [], voice: {}, styleEvidence: 'boutons carrés, ombres fortes', pages: ['/', '/galerie'], images: [], logo: true, inventory } as unknown as SiteContent;
check('architecte : contenu gardé, forme neuve', /le CONTENU reste|CONTENT stays/.test(redesignArchitect(content, true)) || /GARDES : le contenu/.test(redesignArchitect(content, true)));
check('architecte « surtout le design » : structure et textes gardés', /Garde la structure et les textes/.test(redesignArchitect(content, true, 'design')));
check('directeur artistique : n’imite pas l’exécution d’avant', /Ne reproduis PAS l'exécution/.test(redesignDesign(content, true)));

// 4. Nouvelle session à chaque refonte
const fresh = { id: 'p1', name: 'Acme', description: '', type: 'web' } as ProjectModel;
const redesigned = { ...fresh, id: 'p2', analysisResultModel: { branding: { siteSource: { url: 'https://acme.cm' } } } } as unknown as ProjectModel;
check('sans projet ouvert : un projet naît', redesignTarget(undefined) === undefined);
check('projet sans refonte : il la reçoit', redesignTarget(fresh, 'used')?.id === 'p1');
check('projet qui porte déjà une refonte : nouveau projet', redesignTarget(redesigned, 'used') === undefined);
check('projet né d’un site, atelier vierge (iVision) : il la reçoit', redesignTarget(redesigned, 'blank')?.id === 'p2');

// 5. La marque de l'en-tête
const withLogo = (header?: object, extra: object = {}) => ({ name: 'PromoWeb', description: '', type: 'web', analysisResultModel: { branding: { logo: { svg: 'https://x/l.svg', ...extra, ...(header ? { header } : {}) } } } }) as unknown as ProjectModel;
const cases: Array<[string, ProjectModel, RegExp]> = [
  ['logotype : le logo seul', withLogo({ src: 'https://x/h.svg', kind: 'wordmark' }), /BRAND_KIND = "wordmark"[\s\S]*alt=\{BRAND_NAME\}/],
  ['icône : l’icône ET le nom', withLogo({ src: 'https://x/h.svg', kind: 'icon' }), /BRAND_KIND = "icon"[\s\S]*aria-hidden="true"[\s\S]*\{BRAND_NAME\}<\/span>/],
  ['logo clair : posé sur une pastille', withLogo({ src: 'https://x/h.png', kind: 'icon', light: true }), /bg-foreground/],
  ['marque rognée préférée au logo enregistré', withLogo({ src: 'https://x/rogne.svg', kind: 'wordmark' }, { originalUrl: 'https://x/orig.png' }), /LOGO_SRC = "https:\/\/x\/rogne\.svg"/],
  ['sans logo : le nom', { id: 'n', name: 'Sans Logo', description: '', type: 'web' } as ProjectModel, /BRAND_KIND = "name"/],
];
for (const [label, project, expect] of cases) {
  const code = renderBrandModule(project, 'PromoWeb Africa');
  let valid = true;
  try {
    transformSync(code, { loader: 'tsx' });
  } catch {
    valid = false;
  }
  check(`marque — ${label}`, valid && expect.test(code));
}

// ── Le menu de l'ancien site, repris à l'identique (22/11/2026 : une refonte complète listait ses 17 pages) ──
{
  const origin = 'https://ancien.example';
  const inv = {
    origin,
    pages: [{ url: `${origin}/`, path: '/' }, { url: `${origin}/about/`, path: '/about/' }, { url: `${origin}/services/`, path: '/services/' }, { url: `${origin}/contact/`, path: '/contact/' }],
    navigation: [
      { label: 'Accueil', href: `${origin}/` },
      { label: 'À propos', href: `${origin}/about/` },
      { label: 'Services', href: '/services/' },
      { label: 'Blog', href: `${origin}/blog/` },
      { label: 'Contact', href: `${origin}/contact/` },
    ],
    headerActions: [{ label: 'Rejoignez-nous', href: '/contact/' }],
  } as unknown as SiteInventory;
  const newPaths = ['/', '/a-propos/', '/services/', '/contact/'];
  const mapLink = linkMapper(inv, (i) => newPaths[i]);
  check('lien relatif de l’ancien site → la nouvelle page', mapLink('/contact/') === '/contact/' && mapLink(`${origin}/about/`) === '/a-propos/');
  check('lien externe inchangé', mapLink('https://facebook.com/x') === 'https://facebook.com/x');
  const { menu, action } = oldMenuOf(inv, mapLink);
  check('menu : les entrées de l’ancien menu, dans l’ordre, avec leurs libellés', menu.map((m) => m.label).join('|') === 'Accueil|À propos|Services|Contact', JSON.stringify(menu));
  check('menu : une page sans équivalent (Blog) n’y met pas de lien mort', !menu.some((m) => m.label === 'Blog'));
  check('bouton d’action de l’en-tête repris', action?.label === 'Rejoignez-nous' && action.href === '/contact/', JSON.stringify(action));
  const manifest = { pages: Array.from({ length: 17 }, (_, i) => ({ key: `p${i}`, path: `/p${i}/`, label: `Page ${i}`, sections: [] })), menu, action } as unknown as SiteManifest;
  const data = siteDataOf({ name: 'X', description: '', city: '', country: '', phone: '', email: '', channels: [], offers: [], team: [] } as never, manifest, 'fr');
  check('17 pages, et pourtant le menu reste celui de l’ancien site', data.navigation.length === 4 && data.pages.length === 17);
  check('l’action principale est celle de l’ancien en-tête', data.primaryAction?.label === 'Rejoignez-nous');
}

// 6. Police interdite : Bricolage Grotesque n'est jamais écrite dans un site
const oldProject = readFonts({ typography: { primaryFont: 'Bricolage Grotesque', secondaryFont: 'Figtree', primary: { family: 'Bricolage Grotesque', cssUrl: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;800&display=swap' } } });
check('police interdite d’un projet ancien remplacée (nom)', oldProject.display === 'Epilogue', oldProject.display);
check('police interdite d’un projet ancien remplacée (feuille)', !/bricolage/i.test(String(oldProject.displayCss)), String(oldProject.displayCss));
check('aucun accord du catalogue iCode ne la propose', !FONT_PAIRINGS.some((p) => /bricolage/i.test(`${p.display} ${p.body}`)));

console.log(failed ? `\n${failed} contrôle(s) en échec` : '\nTout est bon');
process.exit(failed ? 1 : 0);
