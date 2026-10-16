/**
 * Vérifie la vérification d'exécution des sites (`src/siteEngine/renderCheck.ts`).
 *
 * Des composants qui se compilent mais plantent dans le navigateur — les cas
 * vus dans les sites générés — doivent être refusés avec leur cause ; un
 * composant sain doit passer. À relancer après toute mise à jour du template
 * ou de `site-runtime/`.
 *
 *   npm run site:runtime && npm run check:site-render
 */

import { renderCheck, renderCheckAvailable } from '../src/siteEngine/renderCheck.js';
import { seedDesignSystemFiles } from '../src/siteEngine/designConfig.js';
import { renderBrandModule, renderDataModule, renderMediaModule } from '../src/siteEngine/siteData.js';
import type { SiteFacts } from '../src/siteEngine/siteFacts.js';
import type { SiteManifest } from '../src/siteEngine/manifest.js';

const facts: SiteFacts = {
  name: 'Light',
  description: 'Coaching de transformation personnelle',
  story: '',
  audience: '',
  city: 'Douala',
  country: 'Cameroun',
  offers: [],
  team: [],
  channels: [],
  email: '',
  phone: '',
  background: '',
};
const manifest = { pages: [{ key: 'home', path: '/', label: 'Accueil', sections: [] }] } as unknown as SiteManifest;
const files = {
  ...seedDesignSystemFiles(undefined),
  'src/site/data.ts': renderDataModule(facts, manifest, 'fr'),
  'src/site/media.ts': renderMediaModule({}),
  'src/site/brand.tsx': renderBrandModule(undefined, facts.name),
};

/** Le composant, et ce que la vérification doit en dire (un extrait du problème, « vide » ou « ok »). */
const CASES: Array<{ name: string; expect: string; code: string }> = [
  {
    name: 'composant sain (Motion, Button asChild, action protégée)',
    expect: 'ok',
    code: `import { Section, Container, Heading, Text, Button } from '@/components/ui';
import { motion } from 'motion/react';
import { site } from '@/site/data';
import { ArrowRight } from 'lucide-react';
export default function Hero() {
  return (
    <Section id="hero"><Container>
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}>
        <Heading level={1}>{site.name}</Heading><Text>{site.description}</Text>
        {site.primaryAction && <Button asChild><a href={site.primaryAction.href}>{site.primaryAction.label} <ArrowRight /></a></Button>}
      </motion.div>
    </Container></Section>
  );
}`,
  },
  {
    name: 'action principale nulle',
    expect: 'ligne 4',
    code: `import { Button } from '@/components/ui/button';
import { site } from '@/site/data';
export default function Cta() {
  return <section id="cta"><Button asChild><a href={site.primaryAction.href}>Contact</a></Button></section>;
}`,
  },
  {
    name: 'asChild à deux enfants',
    expect: 'UN SEUL enfant',
    code: `import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
export default function Cta() { return <section id="cta"><Button asChild><a href="#contact">Contact</a><ArrowRight /></Button></section>; }`,
  },
  {
    name: 'composant hors de son parent',
    expect: 'hors de son parent',
    code: `import { TabsContent } from '@/components/ui/tabs';
export default function T() { return <section id="t"><TabsContent value="a">Bonjour</TabsContent></section>; }`,
  },
  {
    name: 'objet affiché comme texte',
    expect: 'Un objet est affiché',
    code: `import { site } from '@/site/data';
export default function O() { return <section id="o"><p>{site.location as unknown as string}</p></section>; }`,
  },
  {
    name: 'setState pendant le rendu',
    expect: 'redessine sans fin',
    code: `import { useState } from 'react';
export default function L() { const [n, setN] = useState(0); setN(n + 1); return <section id="l">{n}</section>; }`,
  },
  {
    name: 'erreur dans un effet',
    expect: 'ligne 3',
    code: `import { useEffect } from 'react';
export default function X() {
  useEffect(() => { document.querySelector('#absent')!.classList.add('a'); }, []);
  return <section id="x">texte</section>;
}`,
  },
  {
    name: 'liste vide lue au chargement du module',
    expect: 'ligne 2',
    code: `import { site } from '@/site/data';
const first = site.offers[0].name;
export default function M() { return <section id="m">{first}</section>; }`,
  },
  {
    name: 'rien d’affiché avec les données du site',
    expect: 'vide',
    code: `import { site } from '@/site/data';
export default function E() { if (!site.team.length) return null; return <section id="e">x</section>; }`,
  },
  {
    name: 'boucle infinie',
    expect: 'ne se termine pas',
    code: `export default function I() { while (true) {} }`,
  },
];

if (!renderCheckAvailable()) {
  console.error('✗ site-runtime absent : lancez `npm run site:runtime`.');
  process.exit(1);
}

const started = Date.now();
const results = await Promise.all(
  CASES.map(async (item, index) => ({ item, result: await renderCheck({ path: `src/sections/home/Case${index}.tsx`, code: item.code, files }) }))
);

let failures = 0;
for (const { item, result } of results) {
  const said = result.skipped ? 'sautée' : result.problems.length ? result.problems.join(' ') : result.empty ? 'vide' : 'ok';
  const passed = !result.skipped && (item.expect === 'ok' || item.expect === 'vide' ? said === item.expect : said.includes(item.expect));
  if (!passed) failures += 1;
  console.log(`${passed ? '✓' : '✗'} ${item.name}${passed ? '' : `\n    attendu : ${item.expect}\n    obtenu  : ${said.slice(0, 300)}`}`);
}

// Après une boucle infinie, le fil coupé est remplacé : la vérification suivante doit passer.
const after = await renderCheck({ path: 'src/sections/home/After.tsx', code: CASES[0].code, files });
const recovered = !after.skipped && !after.problems.length;
if (!recovered) failures += 1;
console.log(`${recovered ? '✓' : '✗'} vérification normale après un fil coupé`);

console.log(`\n${failures ? `✗ ${failures} échec(s)` : '✓ tout est conforme'} en ${Math.round((Date.now() - started) / 100) / 10} s`);
process.exit(failures ? 1 : 0);
