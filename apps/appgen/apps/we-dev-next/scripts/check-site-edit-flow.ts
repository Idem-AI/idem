/**
 * `npm run check:site-edit` (2e partie) — une retouche de site de bout en bout, SANS modèle : les réponses du modèle
 * sont jouées par un script, tout le reste est réel (aiguillage, blocs, réécriture, juge des garde-fous, catalogue
 * d'idem-templates, montage des sections, pages).
 *
 * Ce que l'utilisateur vivait : « je n'ai jamais fait de prompt de modification qui a modifié ce que je veux ». Chaque
 * scénario ci-dessous rejoue une des causes, et vérifie que le site change VRAIMENT comme demandé.
 */
import type { Response } from 'express';
import { createSiteEditStream, editableFile, foreignImports, isEditableSite, projectFromSite, removeSectionFromPage, reorderSections, restoreDesignSystemModules } from '../src/siteEngine/edit.js';
import { templateFiles, DESIGN_SYSTEM_PATHS } from '../src/siteEngine/template.js';
import { handleBuilderMode } from '../src/handlers/builderHandler.js';
import { ModelCaller } from '../src/siteEngine/modelCaller.js';
import { seedDesignSystemFiles } from '../src/siteEngine/designConfig.js';
import { renderBrandModule, renderDataModule, renderMediaModule } from '../src/siteEngine/siteData.js';
import { localizeCode } from '../src/siteEngine/i18n.js';
import { assembleSection } from '../src/siteEngine/sectionCatalog/assemble.js';
import { sectionCatalog } from '../src/siteEngine/sectionCatalog/registry.js';
import { buildSiteMap, mapIds } from '../src/siteEngine/siteMap.js';
import { renderCheckAvailable } from '../src/siteEngine/renderCheck.js';
import type { SiteFacts } from '../src/siteEngine/siteFacts.js';
import type { SiteManifest } from '../src/siteEngine/manifest.js';
import { applyPatches } from '../src/siteEngine/editPlan.js';
import { grounded, lineDiff } from '../src/siteEngine/editVerify.js';

let passes = 0;
let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ── Le modèle joué par un script : pour chaque appel (par son étiquette), les réponses des essais successifs ──
type Script = (label: string, prompt: string) => string[];
let script: Script = () => [];
const calls: string[] = [];
(ModelCaller.prototype as unknown as { call: unknown }).call = async function (
  label: string,
  _system: string,
  prompt: string,
  judge: (text: string) => unknown,
  _max?: number,
  _temp?: number,
  maxAttempts = 3
) {
  calls.push(label);
  const answers = script(label, prompt);
  for (let i = 0; i < Math.min(answers.length, maxAttempts); i++) {
    const verdict = (await judge(answers[i])) as { value?: unknown; problem?: string };
    if (verdict && 'value' in verdict && !verdict.problem) return { value: verdict.value, attempts: i + 1, providerDown: false };
  }
  return { value: null, attempts: answers.length, providerDown: false };
};

function fakeResponse(): { res: Response; text: () => string } {
  let out = '';
  const res = {
    writableEnded: false,
    writeHead() {
      return res;
    },
    write(chunk: string) {
      out += chunk;
      return true;
    },
    end() {
      res.writableEnded = true;
    },
    on() {
      return res;
    },
  };
  // Le flux de données encode chaque morceau de texte en JSON : on le relit en clair.
  const text = () =>
    out
      .split('\n')
      .filter((line) => line.startsWith('0:'))
      .map((line) => JSON.parse(line.slice(2)) as string)
      .join('');
  return { res: res as unknown as Response, text };
}

/** Les fichiers écrits par une réponse. */
function written(stream: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of stream.matchAll(/<boltAction type="file" filePath="([^"]+)">\n([\s\S]*?)<\/boltAction>/g)) out[m[1]] = m[2];
  return out;
}

const json = (value: unknown) => JSON.stringify(value);

async function main() {
  if (!renderCheckAvailable()) {
    console.log('✗ site-runtime absent : npm run site:runtime');
    process.exit(1);
  }
  const catalog = await sectionCatalog();

  // ── Un site du moteur, assemblé depuis le catalogue, SANS projet IDEM (créé depuis l'accueil) ──
  const facts = { name: 'Boulangerie Akwa', description: 'boulangerie de quartier à Douala : pain frais et viennoiseries', story: '', audience: '', city: 'Douala', country: 'Cameroun', offers: [], team: [], channels: [], email: '', phone: '', background: '' } as unknown as SiteFacts;
  const manifest = {
    pages: [
      {
        key: 'home',
        path: '/',
        label: 'Accueil',
        purpose: '',
        seoTitle: '',
        seoDescription: '',
        sections: [
          { id: 'hero', component: 'Hero', brief: 'ouverture', visual: 'none', layout: 'hero-checklist' },
          { id: 'services', component: 'Services', brief: 'ce que propose la boulangerie', visual: 'none' },
        ],
      },
      { key: 'contact', path: '/contact/', label: 'Contact', purpose: '', seoTitle: '', seoDescription: '', sections: [] },
    ],
    header: '',
    footer: '',
    components: [],
    dependencies: [],
    keywords: [],
    businessType: '',
    languages: [],
  } as unknown as SiteManifest;
  const heroNode = catalog.sections.find((s) => s.layout === 'hero-checklist' && s.visual !== 'required')!;
  const heroContent = { title: 'Le pain frais de Akwa, chaque matin', lede: 'Des baguettes croustillantes et des viennoiseries faites sur place.', cta: { label: 'Commander', target: '/contact/' }, items: ['Pain cuit sur place', 'Viennoiseries du jour'] };
  const hero = localizeCode(assembleSection(heroNode.template, { component: 'Hero', id: 'hero', opening: true, content: heroContent, mediaKeys: [], resolveHref: (a) => a.target ?? '/contact/' }), 'src/sections/home/Hero.tsx').code;
  const services = localizeCode(
    `import { Section, Container, Heading, Text } from '@/components/ui';\n\nexport default function Services() {\n  return (\n    <Section id="services">\n      <Container>\n        <Heading level={2} size="h2">Nos pains et viennoiseries</Heading>\n        <Text>Baguettes, pains complets et croissants, cuits chaque matin.</Text>\n      </Container>\n    </Section>\n  );\n}\n`,
    'src/sections/home/Services.tsx'
  ).code;
  const page = `import SectionBoundary from '@/components/site/section-boundary';
import Hero from '@/sections/home/Hero.tsx';
import Services from '@/sections/home/Services.tsx';

export default function HomePage() {
  return (
    <>
      <main id="contenu">
        <SectionBoundary name="Hero">
          <Hero />
        </SectionBoundary>
        <SectionBoundary name="Services" defer>
          <Services />
        </SectionBoundary>
      </main>
    </>
  );
}
`;
  const files: Record<string, string> = {
    ...seedDesignSystemFiles(undefined),
    'src/site/pages.json': json({ pages: [{ path: '/', module: 'src/pages/home.tsx' }, { path: '/contact/', module: 'src/pages/contact.tsx' }] }),
    'src/pages/home.tsx': page,
    'src/pages/contact.tsx': 'export default function ContactPage() { return <main />; }\n',
    'src/sections/home/Hero.tsx': hero,
    'src/sections/home/Services.tsx': services,
    'src/site/data.ts': renderDataModule(facts, manifest, 'fr'),
    'src/site/media.ts': renderMediaModule({}),
    'src/site/brand.tsx': renderBrandModule(undefined, facts.name),
    '.idem/manifest.json': json({ manifest, mediaStyle: {}, themeSummary: '' }),
  };
  check('le site sert de base : retouchable', isEditableSite(files));
  check('projet relu dans le site (sans projet IDEM)', projectFromSite(files).name === 'Boulangerie Akwa', projectFromSite(files).name);
  check('fichiers « code » : le site oui, les notes du moteur non', editableFile(files, 'src/pages/home.tsx') && editableFile(files, 'src/site/media.ts') && !editableFile(files, '.idem/manifest.json'));

  const run = async (request: string, play: Script, recent = '') => {
    script = play;
    calls.length = 0;
    const { res, text } = fakeResponse();
    await createSiteEditStream({ language: 'fr', request, recent, files, model: 'test', userId: null }).pipeDataStreamToResponse(res);
    return { out: text(), files: written(text()) };
  };

  // 1. Le bouton en vert : les blocs sont faux deux fois (le modèle cite mal le fichier), la couleur n'avait pas été
  //    vue par l'aiguillage. Avant : « je l'ai laissé tel quel ». Maintenant : réécrit, le juge confirme la couleur.
  {
    const green = hero.replace(/<Button asChild size="lg">/, '<Button asChild size="lg" className="bg-[#1f7a4d] text-white">');
    const r = await run('Mets le bouton Commander en vert', (label) => {
      if (label === 'edit:plan') return [json({ targets: [{ id: 'home/Hero', change: 'le bouton Commander en vert' }], allows: { colors: false } })];
      if (label === 'edit:src/sections/home/Hero.tsx') return ['<<<<<<< SEARCH\n<Button size="lg">Commander</Button>\n=======\n<Button className="bg-green-600">Commander</Button>\n>>>>>>> REPLACE\nREPLY: x', 'pas de bloc'];
      if (label === 'rewrite:src/sections/home/Hero.tsx') return [`\`\`\`tsx\n${green}\`\`\`\nREPLY: Le bouton Commander est maintenant vert.`];
      if (label === 'edit:allow:colors') return [json({ asked: true })];
      return [];
    });
    const code = r.files['src/sections/home/Hero.tsx'] ?? '';
    check('bouton en vert : la section est réécrite quand les blocs échouent', code.includes('bg-[#1f7a4d]'), r.out.slice(-300));
    check('… le juge a relu la demande pour la couleur', calls.includes('edit:allow:colors'));
    check('… la réponse dit ce qui a changé', /vert/.test(r.out));
  }

  // 2. Une couleur que la demande n'appelle pas reste refusée (le juge dit non) : le site ne change pas.
  {
    const red = hero.replace(/<Button asChild size="lg">/, '<Button asChild size="lg" className="bg-red-600">');
    const r = await run('Corrige la faute dans le titre', (label) => {
      if (label === 'edit:plan') return [json({ targets: [{ id: 'home/Hero', change: 'corriger le titre' }], allows: {} })];
      if (label === 'edit:src/sections/home/Hero.tsx') return [`<<<<<<< SEARCH\n<Button asChild size="lg">\n=======\n<Button asChild size="lg" className="bg-red-600">\n>>>>>>> REPLACE\nREPLY: x`];
      if (label === 'rewrite:src/sections/home/Hero.tsx') return [`\`\`\`tsx\n${red}\`\`\`\nREPLY: x`];
      if (label === 'edit:allow:colors') return [json({ asked: false })];
      return [];
    });
    check('couleur non demandée : refusée après relecture de la demande', !r.files['src/sections/home/Hero.tsx'] && /laissé tel quel/.test(r.out), r.out.slice(-200));
  }

  // 3. Une réponse qui ne change rien n'est jamais acceptée comme « fait ».
  {
    const r = await run('Rends le titre plus grand', (label) => {
      if (label === 'edit:plan') return [json({ targets: [{ id: 'home/Hero', change: 'titre plus grand' }], allows: {} })];
      if (label === 'edit:src/sections/home/Hero.tsx') return [`<<<<<<< SEARCH\n<Button asChild size="lg">\n=======\n<Button asChild size="lg">\n>>>>>>> REPLACE\nREPLY: Le titre est plus grand.`, `<<<<<<< SEARCH\n<Button asChild size="lg">\n=======\n<Button asChild size="lg">\n>>>>>>> REPLACE\nREPLY: Le titre est plus grand.`];
      if (label === 'rewrite:src/sections/home/Hero.tsx') return [`\`\`\`tsx\n${hero.replace('size="display"', 'size="display" className="text-[5rem]"')}\`\`\`\nREPLY: Le titre est plus grand.`];
      return [];
    });
    check('réponse sans effet : refusée, puis la vraie retouche faite', (r.files['src/sections/home/Hero.tsx'] ?? '').includes('text-[5rem]'), r.out.slice(-200));
  }

  // 4. « Enlève la partie services » : la section quitte la page (par le code), le reste ne bouge pas.
  {
    const r = await run('Enlève la partie sur les pains', (label) => (label === 'edit:plan' ? [json({ targets: [], remove: ['home/Services'] })] : []));
    const next = r.files['src/pages/home.tsx'] ?? '';
    check('section retirée de la page, avec son import', !!next && !next.includes('<Services />') && !next.includes('import Services') && next.includes('<Hero />'), next);
    check('… la carte ne la montre plus', !mapIds(buildSiteMap({ ...files, 'src/pages/home.tsx': next })).components.has('home/Services'));
  }

  // 5. « Mets les services avant » : l'ordre change, la première section n'est plus différée.
  {
    const swapped = reorderSections(page, ['Services', 'Hero']);
    check('sections réordonnées', swapped.indexOf('<Services />') < swapped.indexOf('<Hero />'));
    check('… la nouvelle première section ouvre la page (pas différée)', /<SectionBoundary name="Services">/.test(swapped) && /<SectionBoundary name="Hero" defer>/.test(swapped), swapped);
    check('retrait pur : rien d’autre ne change', removeSectionFromPage(page, 'Services').replace(/\s+/g, '') === page.replace("import Services from '@/sections/home/Services.tsx';\n", '').replace(/<SectionBoundary name="Services" defer>\s*<Services \/>\s*<\/SectionBoundary>/, '').replace(/\s+/g, ''));
  }

  // 6. « Change la mise en page du haut » : une autre variante du catalogue d'idem-templates, textes gardés.
  {
    const kind = catalog.kinds.get('hero-checklist')!;
    const content = { title: 'Le pain frais de Akwa, chaque matin', lede: 'Des baguettes croustillantes et des viennoiseries faites sur place.', cta: { label: 'Commander', target: '/contact/' }, items: ['Pain cuit sur place', 'Viennoiseries du jour'] };
    const other = catalog.sections.find((s) => s.layout === 'hero-checklist' && s.id !== heroNode.id && s.visual !== 'required');
    const r = await run('Change la mise en page du haut de la page', (label) => {
      if (label === 'edit:plan') return [json({ targets: [], restyle: [{ id: 'home/Hero', change: 'une autre mise en page' }] })];
      if (label === 'restyle:home/Hero') return [json({ variant: other?.id, sections: { hero: content }, reply: 'J’ai changé la mise en page du haut de la page.' })];
      return [];
    });
    const code = r.files['src/sections/home/Hero.tsx'] ?? '';
    check('mise en page changée avec le catalogue', !!code && code !== hero && !calls.some((c) => c.startsWith('edit:src')), `${Object.keys(kind.fields).join(',')} · ${r.out.slice(-200)}`);
    check('… les textes sont gardés', code.includes('Le pain frais de Akwa, chaque matin') && code.includes('Commander'));
  }

  // 7. Aucune variante ne convient (la demande est trop précise) : le code est retouché directement.
  {
    const custom = hero.replace('items-center gap-10 text-center', 'items-start gap-10 text-left md:flex-row');
    const r = await run('Mets le titre à gauche et le bouton à droite', (label) => {
      if (label === 'edit:plan') return [json({ targets: [], restyle: [{ id: 'home/Hero', change: 'titre à gauche, bouton à droite' }] })];
      if (label === 'restyle:home/Hero') return ['{}'];
      if (label === 'edit:src/sections/home/Hero.tsx') return [`<<<<<<< SEARCH\nitems-center gap-10 text-center\n=======\nitems-start gap-10 text-left md:flex-row\n>>>>>>> REPLACE\nREPLY: Le titre est à gauche et le bouton à droite.`];
      return [];
    });
    check('hors catalogue : la section est modifiée directement', (r.files['src/sections/home/Hero.tsx'] ?? '') === custom || (r.files['src/sections/home/Hero.tsx'] ?? '').includes('md:flex-row'), r.out.slice(-200));
  }

  // 8. Un fichier hors carte (« code ») : modifié directement.
  {
    const r = await run('Le titre de la page contact doit être « Nous trouver »', (label) => {
      if (label === 'edit:plan') return [json({ targets: [], code: [{ path: 'src/pages/contact.tsx', change: 'titre Nous trouver' }] })];
      if (label === 'edit:src/pages/contact.tsx') return [`<<<<<<< SEARCH\nreturn <main />;\n=======\nreturn <main><h1>Nous trouver</h1></main>;\n>>>>>>> REPLACE\nREPLY: La page contact s’appelle « Nous trouver ».`];
      return [];
    });
    check('fichier hors carte modifié directement', (r.files['src/pages/contact.tsx'] ?? '').includes('Nous trouver'), r.out.slice(-200));
  }

  // 9. L'aiguillage : un site sans projet IDEM et sans `?product=site` va bien au moteur de retouche.
  {
    script = (label) => (label === 'edit:plan' ? [json({ targets: [], remove: ['home/Services'] })] : []);
    const { res, text } = fakeResponse();
    const messages = [
      { id: '1', role: 'user', content: 'je veux un site pour ma boulangerie' },
      { id: '2', role: 'assistant', content: 'Votre site est prêt.' },
      { id: '3', role: 'user', content: 'Enlève la partie sur les pains' },
    ];
    const stream = await handleBuilderMode(messages as never, 'test', null, undefined, undefined, undefined, 'fr', undefined, 'web-app', undefined, undefined, undefined, { files });
    await stream.pipeDataStreamToResponse(res);
    check('sans projet ni ?product=site : la retouche passe par le moteur ciblé', !!written(text())['src/pages/home.tsx'], text().slice(-200));
  }

  // 10. « Change la police » : la famille change dans le design system, recompilé ; l'ancienne adresse de police est
  //     retirée ; aucun paquet n'est importé (avant : `@fontsource/sora/400.css` dans config.ts, aperçu en erreur).
  {
    const source = JSON.parse(files[DESIGN_SYSTEM_PATHS.source]);
    source.tokens.typography.headingFontUrl = 'https://fonts.googleapis.com/css2?family=Ancienne&display=swap';
    const withUrl = { ...files, [DESIGN_SYSTEM_PATHS.source]: JSON.stringify(source) };
    script = (label) => {
      if (label === 'edit:plan') return [json({ targets: [], theme: 'titres en Sora', allows: { fonts: true } })];
      if (label === 'edit:theme') return [json({ set: { 'tokens.typography.headingFont': 'Sora', 'tokens.typography.headingFontUrl': 'https://cdn.example/sora.css' }, reply: 'Les titres sont en Sora.' })];
      return [];
    };
    const { res, text } = fakeResponse();
    await createSiteEditStream({ language: 'fr', request: 'Mets les titres en Sora', files: withUrl, model: 'test', userId: null }).pipeDataStreamToResponse(res);
    const out = written(text());
    const config = JSON.parse(out[DESIGN_SYSTEM_PATHS.source] ?? '{}');
    check('police : la famille change dans le design system', config.tokens?.typography?.headingFont === 'Sora', JSON.stringify(config.tokens?.typography ?? {}).slice(0, 200));
    check('… l’adresse de l’ancienne police est retirée, celle inventée par le modèle jamais reprise', !config.tokens?.typography?.headingFontUrl, String(config.tokens?.typography?.headingFontUrl));
    check('… aucun fichier du site n’importe un paquet de police', !Object.values(out).some((code) => /@fontsource/.test(code)));
  }

  // 11. Les imports : un paquet que le site n'a pas est refusé ; le design system ne se retouche pas à la main ;
  //     un config.ts abîmé par une retouche passée est remis d'origine.
  {
    check('import de paquet absent repéré', foreignImports("import '@fontsource/sora/400.css';\nimport { motion } from 'motion/react';\nimport x from '@/site/data';").join() === '@fontsource/sora/400.css');
    check('design system jamais retouché à la main', !editableFile({ 'src/design-system/config.ts': 'x' }, 'src/design-system/config.ts'));
    const original = templateFiles()['src/design-system/config.ts'];
    const broken = `import '@fontsource/sora/400.css';\n${original}`;
    const restored = restoreDesignSystemModules({ 'src/design-system/config.ts': broken });
    check('config.ts abîmé remis d’origine', restored['src/design-system/config.ts'] === original);
    check('config.ts intact laissé tel quel', !Object.keys(restoreDesignSystemModules({ 'src/design-system/config.ts': original })).length);
    const r = await run('Le titre de la page contact doit être « Nous trouver »', (label) => {
      if (label === 'edit:plan') return [json({ targets: [], code: [{ path: 'src/pages/contact.tsx', change: 'titre' }] })];
      if (label === 'edit:src/pages/contact.tsx') return [`<<<<<<< SEARCH\nexport default function\n=======\nimport '@fontsource/sora/400.css';\nexport default function\n>>>>>>> REPLACE\nREPLY: x`, 'rien'];
      if (label === 'rewrite:src/pages/contact.tsx') return [`\`\`\`tsx\nimport '@fontsource/sora/400.css';\nexport default function ContactPage() { return <main />; }\n\`\`\`\nREPLY: x`];
      return [];
    });
    check('retouche « code » qui importe un paquet absent : refusée', !r.files['src/pages/contact.tsx']);
  }

  // ── 26/11/2026 : « ça générait des éléments sans rapport avec ce que j'ai demandé » ──────────────────────────────
  const SERVICES = 'src/sections/home/Services.tsx';
  const addLine = `<<<<<<< SEARCH\n      <Container>\n=======\n      <Container>\n        <Text>Tout est fait maison</Text>\n>>>>>>> REPLACE`;
  const roomy = `<<<<<<< SEARCH\n    <Section id="services">\n=======\n    <Section id="services" className="py-24">\n>>>>>>> REPLACE`;

  // 12. Une partie que rien dans la demande n'appelle est écartée (l'aiguillage cite les mots de la personne).
  {
    const r = await run('Ajoute le sous-titre « Tout est fait maison » dans la partie sur les pains', (label) => {
      if (label === 'edit:plan')
        return [json({ targets: [{ id: 'home/Services', quote: 'la partie sur les pains', change: 'ajouter le sous-titre' }, { id: 'home/Hero', quote: 'un look plus moderne', change: 'moderniser' }], allows: {} })];
      if (label === `edit:${SERVICES}`) return [`${addLine}\nREPLY: J’ai ajouté le sous-titre.`];
      if (label === 'edit:src/sections/home/Hero.tsx') return [`<<<<<<< SEARCH\n<Button asChild size="lg">\n=======\n<Button asChild size="lg" className="uppercase">\n>>>>>>> REPLACE\nREPLY: x`];
      return [];
    });
    check('partie sans rapport (citation absente de la demande) : écartée', !calls.includes('edit:src/sections/home/Hero.tsx') && !r.files['src/sections/home/Hero.tsx'], calls.join(', '));
    check('… la partie demandée est bien modifiée', (r.files[SERVICES] ?? '').includes('Tout est fait maison'));
  }

  // 13. Une même section à la fois retouchée et remise en forme : refusé, l'aiguillage choisit l'une des deux.
  {
    const r = await run('Ajoute le sous-titre « Tout est fait maison » dans la partie sur les pains', (label) => {
      if (label === 'edit:plan')
        return [
          json({ targets: [{ id: 'home/Services', quote: 'la partie sur les pains', change: 'sous-titre' }], restyle: [{ id: 'home/Services', quote: 'la partie sur les pains', change: 'en cartes' }] }),
          json({ targets: [{ id: 'home/Services', quote: 'la partie sur les pains', change: 'sous-titre' }] }),
        ];
      if (label === `edit:${SERVICES}`) return [`${addLine}\nREPLY: J’ai ajouté le sous-titre.`];
      return [];
    });
    check('une partie = une sorte de changement (pas retouchée ET remise en forme)', !calls.includes('restyle:home/Services') && (r.files[SERVICES] ?? '').includes('Tout est fait maison'), calls.join(', '));
  }

  // 14. Des blocs posés à moitié ne passent plus : la retouche entière, ou un nouvel essai.
  {
    const r = await run('Ajoute le sous-titre « Tout est fait maison » et espace davantage la partie sur les pains', (label) => {
      if (label === 'edit:plan') return [json({ targets: [{ id: 'home/Services', quote: 'la partie sur les pains', change: 'sous-titre et plus d’espace' }] })];
      if (label === `edit:${SERVICES}`) return [`${addLine}\n<<<<<<< SEARCH\n    <Section id="pains">\n=======\n    <Section id="pains" className="py-24">\n>>>>>>> REPLACE\nREPLY: x`, `${addLine}\n${roomy}\nREPLY: J’ai ajouté le sous-titre et de l’espace.`];
      if (label === 'edit:verify') return [json({ done: true, missing: '', unrelated: [] })];
      return [];
    });
    const code = r.files[SERVICES] ?? '';
    check('blocs posés à moitié : refusés, le second essai fait TOUTE la demande', code.includes('Tout est fait maison') && code.includes('py-24'), code.slice(0, 200));
  }

  // 15. La relecture : une demande à moitié faite repart une fois, avec ce qui manque, depuis la version retouchée.
  {
    let reviewed = '';
    const r = await run('Ajoute le sous-titre « Tout est fait maison » et espace davantage la partie sur les pains', (label, prompt) => {
      if (label === 'edit:plan') return [json({ targets: [{ id: 'home/Services', quote: 'la partie sur les pains', change: 'sous-titre et plus d’espace', expect: 'un sous-titre et une section plus aérée' }] })];
      if (label === `edit:${SERVICES}`) return prompt.includes('A reviewer checked') ? [`${roomy}\nREPLY: J’ai ajouté de l’espace.`] : [`${addLine}\nREPLY: J’ai ajouté le sous-titre.`];
      if (label === 'edit:verify') {
        reviewed = prompt;
        return [json({ done: false, missing: 'la section n’est pas plus espacée', unrelated: [] })];
      }
      return [];
    });
    const code = r.files[SERVICES] ?? '';
    check('relecture : la partie manquante est faite à la seconde passe', code.includes('Tout est fait maison') && code.includes('py-24'), code.slice(0, 200));
    check('… le juge ne reçoit que les lignes changées (pas le fichier entier)', /\n\+ .*Tout est fait maison/.test(reviewed) && !reviewed.includes('export default function Services'), reviewed.slice(-400));
    check('… et ce qu’on devait voir (« expect » de l’aiguillage)', reviewed.includes('plus aérée'));
  }

  // 16. Une partie faite, une autre manquée : la réponse dit les deux (avant, « C'est fait » cachait la seconde).
  {
    const r = await run('Ajoute le sous-titre « Tout est fait maison » dans la partie sur les pains et mets le bouton en majuscules', (label) => {
      if (label === 'edit:plan')
        return [json({ targets: [{ id: 'home/Services', quote: 'la partie sur les pains', change: 'sous-titre' }, { id: 'home/Hero', quote: 'le bouton en majuscules', change: 'bouton en majuscules' }] })];
      if (label === `edit:${SERVICES}`) return [`${addLine}\nREPLY: J’ai ajouté le sous-titre.`];
      return [];
    });
    check('échec partiel : dit dans la réponse', (r.files[SERVICES] ?? '').includes('Tout est fait maison') && /pas réussi/.test(r.out), r.out.slice(-300));
    check('… la réécriture entière n’est tentée que si les blocs n’ont pas pu être posés', calls.filter((c) => c.startsWith('rewrite:')).length <= 1);
  }

  // 17. Les outils : pose tolérante des blocs, diff compact, citations vérifiées mot pour mot.
  {
    const file = 'a\n  <div className="x  y">\n    <p>Un</p>\n    <p>Deux</p>\n    <span>Trois</span>\n  </div>\nz\n';
    const squashed = applyPatches(file, [{ search: '<div className="x y">', replace: '<div className="x y z">' }]);
    check('bloc retrouvé aux espaces près à l’intérieur de la ligne', squashed.applied === 1 && squashed.code.includes('x y z'));
    const oneOff = applyPatches(file, [{ search: '<div className="x  y">\n<p>Un</p>\n<p>Deuxx</p>\n<span>Trois</span>', replace: 'NEW' }]);
    check('bloc de 4 lignes avec UNE ligne mal recopiée : retrouvé', oneOff.applied === 1 && oneOff.code.includes('NEW'));
    const far = applyPatches(file, [{ search: '<div className="x  y">\n<p>Autre chose</p>\n<p>Encore</p>\n<span>Trois</span>', replace: 'NEW' }]);
    check('bloc trop différent : jamais deviné', far.applied === 0);
    const d = lineDiff('a\nb\nc\nd\ne\nf\ng\nh\n', 'a\nb\nc\nD\ne\nf\ng\nh\n');
    check('diff compact : la ligne changée et son voisinage seulement', d.added === 1 && d.removed === 1 && d.text.includes('- d') && d.text.includes('+ D') && !d.text.includes('  a'), d.text);
    check('citation vérifiée mot pour mot (casse, accents, ponctuation)', grounded('la partie sur les PAINS', 'Ajoute un titre à la partie sur les pains !') && !grounded('un look plus moderne', 'Ajoute un titre à la partie sur les pains'));
  }

  console.log(`\n${passes} vérifications réussies, ${failures} en échec`);
  process.exit(failures ? 1 : 0);
}

void main();
