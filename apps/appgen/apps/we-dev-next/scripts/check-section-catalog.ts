/**
 * Vérifie le catalogue iCode des sites vitrines (idem-templates/catalog/icode) SANS AUCUN APPEL DE MODÈLE :
 *   - chaque variante de section, assemblée avec un contenu fictif tiré de son schéma (avec et sans visuel, page
 *     ouverte ou non, listes au plus court et au plus long qu'elle accepte), passe la VRAIE vérification du moteur
 *     (`reviewComponent` : correction, anti-« site d'IA », forme, montage jsdom, faits), puis `t()` et la pseudo-langue ;
 *   - chaque texte du contenu reste affiché (rien d'avalé par le nettoyage) ;
 *   - chaque en-tête et pied de page passe la même vérification ;
 *   - les règles refusent ce qu'elles doivent refuser, l'assembleur échappe ce qu'il doit échapper, le rédacteur
 *     refuse ce qui casserait une composition.
 *
 *   IDEM_TEMPLATES_DIR=../../../../idem-templates npm run check:section-catalog
 *   (sans IDEM_TEMPLATES_DIR : l'instantané embarqué `src/siteEngine/sectionCatalog/snapshot.json`)
 */
import path from 'node:path';
import { reviewComponent, type ReviewContext } from '../src/siteEngine/authoring.js';
import { themeColorsFromCss } from '../src/siteEngine/autocorrect.js';
import { seedDesignSystemFiles } from '../src/siteEngine/designConfig.js';
import { cleanSlop } from '../src/siteEngine/slopGuard.js';
import { createFactGuard } from '../src/siteEngine/factGuard.js';
import { localizeCode, pseudoLocaleFiles } from '../src/siteEngine/i18n.js';
import type { SiteManifest } from '../src/siteEngine/manifest.js';
import { renderCheck, renderCheckAvailable } from '../src/siteEngine/renderCheck.js';
import { importPolicy } from '../src/siteEngine/repair.js';
import { renderBrandModule, renderDataModule, renderMediaModule } from '../src/siteEngine/siteData.js';
import type { SiteFacts } from '../src/siteEngine/siteFacts.js';
import { templateFiles } from '../src/siteEngine/template.js';
import { assembleSection, assembleShell, jsxText } from '../src/siteEngine/sectionCatalog/assemble.js';
import { fitContent } from '../src/siteEngine/sectionCatalog/compose.js';
import { readCopy, type CopyTask } from '../src/siteEngine/sectionCatalog/copy.js';
import { buildSectionCatalog, readIcodeTemplatesDir, sectionCatalog } from '../src/siteEngine/sectionCatalog/registry.js';
import type { FieldDef, KindNode, SectionNode } from '../src/siteEngine/sectionCatalog/types.js';

let failures = 0;
let passes = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) passes++;
  else {
    failures++;
    console.log(`✗ ${name}${detail ? `\n    ${detail}` : ''}`);
  }
};

// ── Le site fictif ───────────────────────────────────────────────────────────────────────────────
const facts: SiteFacts = {
  name: 'Atelier',
  description: 'couture sur mesure et retouches',
  story: '',
  audience: '',
  city: 'Douala',
  country: 'Cameroun',
  offers: [
    { name: 'retouche simple', price: '2 000 FCFA', notes: 'ourlet' },
    { name: 'tenue sur mesure', price: '25 000 FCFA', notes: '' },
  ],
  team: [],
  channels: [{ label: 'WhatsApp', value: '+237 690 00 00 00', href: 'https://wa.me/237690000000' }],
  email: '',
  phone: '',
  background: '',
} as unknown as SiteFacts;
const manifest = { pages: [{ key: 'home', path: '/', label: 'Accueil', sections: [] }, { key: 'contact', path: '/contact/', label: 'Contact', sections: [] }], dependencies: [] } as unknown as SiteManifest;
const KEY = 'home-demo';
const mediaAssets = Array.from({ length: 8 }, (_, i) => ({ kind: 'image' as const, src: `/media/demo-${i + 1}.jpg`, alt: 'une table de couture' }));
const ds = seedDesignSystemFiles(undefined);
const baseFiles = {
  ...ds,
  'src/site/data.ts': renderDataModule(facts, manifest, 'fr'),
  'src/site/brand.tsx': renderBrandModule(undefined, facts.name),
};
const filesWith = (visuals: number) => ({ ...baseFiles, 'src/site/media.ts': renderMediaModule(visuals ? { [KEY]: mediaAssets.slice(0, visuals) } : {}) });
const css = Object.entries(ds).find(([p]) => p.endsWith('.css'))?.[1] ?? '';

// Le contenu fictif : des mots en minuscules (aucun nom propre, aucun chiffre) — tout figure dans la référence.
const WORDS = 'des coutures soignées pour chaque silhouette avec des tissus choisis ensemble et des finitions nettes qui durent longtemps au quotidien comme pour les grandes occasions'.split(' ');
let cursor = 0;
const phrase = (max: number) => {
  const words: string[] = [];
  while (words.join(' ').length < Math.min(max - 2, 90)) words.push(WORDS[cursor++ % WORDS.length]);
  let out = words.join(' ');
  while (out.length > max - 1) out = out.split(' ').slice(0, -1).join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1) + '.';
};
function fixture(fields: Record<string, FieldDef>, counts: (name: string, def: Extract<FieldDef, { type: 'list' }>) => number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(fields)) {
    if (def.type === 'text') out[name] = phrase(def.max);
    else if (def.type === 'action') out[name] = { label: 'Prendre rendez-vous', target: '/contact/' };
    else {
      const n = counts(name, def);
      out[name] = Array.from({ length: n }, () => (def.of === 'text' ? phrase(160) : fixture(def.of, counts)));
    }
  }
  return out;
}
const textsOf = (value: unknown): string[] => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(textsOf) : value && typeof value === 'object' ? Object.entries(value).filter(([k]) => k !== 'target').flatMap(([, v]) => textsOf(v)) : []);

async function main() {
  const dir = process.env.IDEM_TEMPLATES_DIR?.trim();
  const catalog = dir ? buildSectionCatalog(readIcodeTemplatesDir(path.resolve(dir)), 'dir', 'dir') : await sectionCatalog();
  console.log(`Catalogue ${catalog.version} (${catalog.source}) : ${catalog.kinds.size} schémas, ${catalog.sections.length} sections, ${catalog.headers.length} en-têtes, ${catalog.footers.length} pieds de page`);
  ok('catalogue chargé', catalog.sections.length >= 45 && catalog.kinds.size === 15 && catalog.headers.length >= 3 && catalog.footers.length >= 3, `${catalog.sections.length} sections`);
  ok('aucun nœud écarté', catalog.rejected.length === 0, JSON.stringify(catalog.rejected.slice(0, 3)));
  if (!renderCheckAvailable()) {
    console.log('✗ site-runtime absent : npm run site:runtime');
    process.exit(1);
  }

  // ── Chaque variante, dans chaque situation qu'elle accepte ──
  const jobs: Array<() => Promise<void>> = [];
  for (const node of catalog.sections) {
    const kind = catalog.kinds.get(node.layout)!;
    const visualsCases = node.visual === 'none' ? [0] : node.visual === 'required' ? [node.fits?.gallery?.[1] ? Math.min(node.fits.gallery[1], 6) : 1] : [0, 1];
    if (node.fits?.gallery) visualsCases.push(node.fits.gallery[0]);
    for (const visuals of visualsCases)
      for (const extreme of ['min', 'max'] as const) {
        const opening = extreme === 'max' && visuals > 0;
        jobs.push(async () => {
          const content = fixture(kind.fields, (name, def) => {
            const fit = node.fits?.[name];
            const lo = Math.max(def.min, fit?.[0] ?? 0, 1);
            const hi = Math.min(def.max, fit?.[1] ?? def.max);
            return extreme === 'min' ? lo : hi;
          });
          const fitted = fitContent(node, content, visuals);
          const label = `${node.id} · ${visuals} visuel(s) · listes ${extreme}${opening ? ' · ouvre la page' : ''}`;
          if (!fitted) return ok(`${label} : contenu accepté par la variante`, false);
          const code = assembleSection(node.template, {
            component: 'DemoSection',
            id: 'demo',
            opening,
            content: fitted,
            mediaKeys: Array.from({ length: visuals }, (_, i) => (i ? `${KEY}-${i + 1}` : KEY)),
            resolveHref: (a) => a.target ?? '/contact/',
          });
          const reference = `${facts.description} ${facts.city} ${textsOf(fitted).join(' ')} Prendre rendez-vous`;
          const review: ReviewContext = { policy: importPolicy([]), check: createFactGuard(reference, 'fr'), reference, theme: themeColorsFromCss(css), siteFiles: () => filesWith(visuals) };
          const r = await reviewComponent(code, review, { path: 'src/sections/home/DemoSection.tsx' });
          ok(`${label} : passe la vérification`, !r.problems.length && !r.empty, r.problems.slice(0, 2).join(' · ') || (r.empty ? "n'affiche rien" : ''));
          ok(`${label} : rien d'inventé`, !r.invented.length, r.invented.join(', '));
          const slop = cleanSlop(code).fixes;
          ok(`${label} : rien retiré par le nettoyage anti-« site d'IA »`, !slop.length, slop.join(' · '));
          // Une variante qui affiche les offres réelles (`site.offers`) ne montre ses rangées rédigées qu'à défaut.
          // Un champ que la variante ne lit pas (les en-têtes d'un tableau qu'elle n'a pas) n'est pas attendu.
          const reads = (k: string) => new RegExp(`\\{\\{\\s*${k}\\b|\\[\\[each ${k}\\]\\]`).test(node.template);
          const shown = Object.fromEntries(Object.entries(fitted).filter(([k]) => reads(k) && !(k === 'rows' && node.template.includes('site.offers'))));
          const missing = textsOf(shown).filter((t) => !r.code.includes(jsxText(t)) && !r.code.includes(JSON.stringify(t)));
          ok(`${label} : chaque texte est affiché`, !missing.length, missing.slice(0, 2).join(' | '));
          const localized = localizeCode(r.code, 'src/sections/home/DemoSection.tsx');
          ok(`${label} : textes passés dans t()`, localized.changed && localized.texts.length > 0);
          const pseudo = await renderCheck({ path: 'src/sections/home/DemoSection.tsx', code: localized.code, files: { ...filesWith(visuals), ...pseudoLocaleFiles(localized.texts, templateFiles()['src/i18n/index.ts'] ?? '') } });
          ok(`${label} : s'affiche une fois traduite`, !pseudo.problems.length, pseudo.problems.slice(0, 1).join(''));
        });
      }
  }
  for (const shell of [...catalog.headers, ...catalog.footers]) {
    jobs.push(async () => {
      const filePath = shell.kind === 'header' ? 'src/components/site/SiteHeader.tsx' : 'src/components/site/SiteFooter.tsx';
      const review: ReviewContext = { policy: importPolicy([]), check: createFactGuard(facts.description, 'fr'), reference: facts.description, theme: themeColorsFromCss(css), siteFiles: () => filesWith(0) };
      const r = await reviewComponent(assembleShell(shell.template), review, { path: filePath, props: shell.kind === 'header' ? { current: '/' } : undefined });
      ok(`${shell.id} : passe la vérification`, !r.problems.length && !r.empty, r.problems.slice(0, 2).join(' · '));
    });
  }
  const started = Date.now();
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < jobs.length) await jobs[next++]();
  }));
  console.log(`${jobs.length} assemblages montés en ${Math.round((Date.now() - started) / 1000)} s`);

  // ── Les refus ──
  const kinds = catalog.kinds;
  const base = catalog.sections.find((s) => s.layout === 'statement')!;
  const bad = (tpl: string) => buildSectionCatalog([...[...kinds.values()].map((k) => ({ node: k as unknown as Record<string, unknown> })), { node: { ...base, template: undefined } as unknown as Record<string, unknown>, template: tpl }], 't', 'dir').rejected.length > 0;
  ok('règle : couleur de la palette refusée', bad(base.template.replace('className="', 'className="bg-blue-600 ')));
  ok('règle : mot écrit en dur refusé', bad(base.template.replace('{{title}}', 'Bienvenue chez nous')));
  ok('règle : appel réseau refusé', bad(base.template.replace('export default', "fetch('/x');\nexport default")));
  ok('règle : champ hors schéma refusé', bad(base.template.replace('{{title}}', '{{prix}}')));
  ok('règle : import étranger refusé', bad(`import x from 'axios';\n${base.template}`));

  const tricky = assembleSection(base.template, { component: 'S', id: 's', opening: false, content: { title: 'Prix {site.secret} <b>gras</b> & co' }, mediaKeys: [], resolveHref: () => null });
  ok('assembleur : accolades et chevrons échappés', !tricky.includes('{site.secret}') && !tricky.includes('<b>') && tricky.includes('&#123;site.secret&#125;'));
  ok('assembleur : action sans destination → bloc retiré', !/href=/.test(assembleSection(base.template, { component: 'S', id: 's', opening: false, content: { title: 'Un titre', cta: { label: 'Voir' } }, mediaKeys: [], resolveHref: () => null })));
  ok('assembleur : aucun jeton restant', !/\[\[|\{\{\s*\.?[a-zA-Z.]+\s*\}\}/.test(tricky));

  const faq = kinds.get('faq') as KindNode;
  const task: CopyTask = { section: { id: 'q', component: 'Q', brief: '', visual: 'none', layout: 'faq' }, kind: faq, visuals: 0 };
  const tooLong = readCopy({ sections: { q: { title: 'x'.repeat(400), faqs: [] } } }, [task], ['/']);
  ok('rédacteur : texte trop long et liste trop courte signalés', (tooLong.problems.q ?? []).length >= 2, JSON.stringify(tooLong.problems));
  const fine = readCopy({ sections: { q: { title: 'Vos questions — nos réponses', faqs: Array.from({ length: 3 }, () => ({ question: 'Une question ?', answer: 'Une réponse **utile**.' })) } } }, [task], ['/']);
  ok('rédacteur : contenu juste accepté, tiret cadratin et Markdown nettoyés', !fine.problems.q && (fine.sections.q.title as string) === 'Vos questions, nos réponses' && !JSON.stringify(fine.sections.q).includes('**'));
  const statement = catalog.sections.filter((s: SectionNode) => s.layout === 'gallery' && s.visual === 'required')[0];
  ok('aiguilleur : galerie sans visuel écartée', !!statement && fitContent(statement, {}, 0) === null);

  console.log(`\n${passes} contrôles réussis, ${failures} échec(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
