/**
 * Banc d'essai des sites vitrines : l'ancien template contre le nouveau, sur le MÊME site.
 *
 * Aucun modèle n'est appelé : le site d'essai (accueil + à propos, 7 sections, en-tête, pied de page, 4 photos
 * Pexels, polices Google) est écrit ici, puis assemblé par le code de chaque version du moteur (`project.ts`,
 * `template/`) — l'ancienne lue dans git (`--old`, HEAD par défaut), la nouvelle dans l'arbre de travail.
 *
 * Mesures :
 *   construction  durée de `npm run build` (Vite + pré-rendu + après-construction), poids de dist/
 *   affichage     Chrome sans tête, profil « mobile 4G lent » de Lighthouse (150 ms, 1,6 Mbit/s, CPU ×4, 412 px à
 *                 2,625 dpr), cache vide : FCP, LCP, CLS, TBT, octets transférés par type, requêtes ; puis visite
 *                 d'une seconde page (cache chaud)
 *   stabilité     erreurs de console et de page, reprise React sans écart, animations jouées jusqu'au bout,
 *                 accordéon d'une section différée qui s'ouvre au clic
 *
 * Trois configurations : A = ancien template servi comme iDeploy le servait (sans compression, sans cache),
 * B = nouveau template servi pareil (l'effet du template seul), C = nouveau template + nouveau serveur.
 *
 * Les tiers (fonts.googleapis.com, fonts.gstatic.com, images.pexels.com) sont imités en local (HTTPS, mêmes
 * adresses, établissement de connexion facturé), Pexels redimensionnant comme le vrai (`w`, `dpr`).
 *
 *   npm run bench:site -- --modules <node_modules avec vite, @vitejs/plugin-react, tailwindcss@3…> [--runs 5] [--old HEAD]
 */
import { execFileSync, execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';

/* -------------------------------------------------------------------------- */
/*  Options                                                                    */
/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const RUNS = Number(option('runs', '5'));
const OLD_REF = option('old', 'HEAD')!;
const WORK = resolve(option('work', join(tmpdir(), 'idem-bench-site'))!);
const MODULES = option('modules');
const FONTS_DIR = option('fonts');
const OUT = option('out', join(WORK, 'bench-report.json'))!;

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP = resolve(HERE, '..');
const REPO = execSync('git rev-parse --show-toplevel', { cwd: APP }).toString().trim();

/** Profil « mobile lent » de Lighthouse. */
const RTT_MS = 150;
const DOWN_BPS = (1.6 * 1024 * 1024) / 8;
const UP_BPS = (750 * 1024) / 8;
const CPU_SLOWDOWN = 4;
/** DNS + TCP + TLS sur un nouveau domaine : trois allers-retours. */
const CONNECT_MS = 3 * RTT_MS;

if (!MODULES || !existsSync(join(MODULES, 'vite')) || !existsSync(join(MODULES, 'tailwindcss'))) {
  console.error('--modules <dossier node_modules> est requis : vite 5, @vitejs/plugin-react, tailwindcss 3, postcss, autoprefixer, tailwindcss-animate et les dépendances du site (site-runtime).');
  process.exit(2);
}

mkdirSync(WORK, { recursive: true });

/* -------------------------------------------------------------------------- */
/*  Les deux moteurs                                                           */
/* -------------------------------------------------------------------------- */

type Engine = {
  project: typeof import('../src/siteEngine/project.js');
  template: typeof import('../src/siteEngine/template.js');
  siteData: typeof import('../src/siteEngine/siteData.js');
  designConfig: typeof import('../src/siteEngine/designConfig.js');
};

async function loadEngine(src: string): Promise<Engine> {
  const load = (path: string) => import(pathToFileURL(join(src, path)).href);
  return {
    project: await load('siteEngine/project.ts'),
    template: await load('siteEngine/template.ts'),
    siteData: await load('siteEngine/siteData.ts'),
    designConfig: await load('siteEngine/designConfig.ts'),
  };
}

/** L'ancien moteur : `src/` tel qu'il est dans git, posé à côté de `node_modules` pour que ses imports se résolvent. */
function extractOldSource(ref: string): string {
  const root = join(APP, '.bench-old');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const prefix = `${APP.slice(REPO.length + 1)}/src`;
  execSync(`git archive ${ref} ${JSON.stringify(prefix)} | tar -x -C ${JSON.stringify(root)} --strip-components=${prefix.split('/').length - 1}`, { cwd: REPO, shell: '/bin/sh' });
  return join(root, 'src');
}

/* -------------------------------------------------------------------------- */
/*  Le site d'essai                                                            */
/* -------------------------------------------------------------------------- */

const pexels = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940`;

const facts = {
  name: 'Lumière',
  description: 'Coaching de transformation personnelle à Douala : séances individuelles, ateliers en groupe et suivi sur trois mois.',
  story: '',
  audience: 'Femmes et hommes actifs de Douala',
  city: 'Douala',
  country: 'Cameroun',
  offers: [],
  team: [],
  channels: [],
  email: 'bonjour@lumiere.example',
  phone: '+237 6 00 00 00 00',
  background: '',
};

const SECTIONS: Record<string, Record<string, string>> = {
  home: {
    Hero: `import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, Container, Heading, Media, Section, Text } from '@/components/ui';
import { motionTokens as m } from '@/design-system';
import { media } from '@/site/media';

export default function Hero() {
  return (
    <Section id="accueil" className="pt-8">
      <Container className="grid items-center gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Badge>Coaching à Douala</Badge>
          <Heading level={1}>Changer de vie, pas à pas, avec un coach qui vous connaît</Heading>
          <motion.div initial={{ opacity: 0, y: m.distance }} animate={{ opacity: 1, y: 0 }} transition={{ duration: m.duration, ease: m.ease }} data-bench="hero-lead">
            <Text variant="lead">Des séances individuelles, des ateliers en petit groupe et un suivi sur trois mois pour tenir vos décisions dans la durée.</Text>
          </motion.div>
          <div className="flex flex-wrap gap-3">
            <Button asChild><a href="#contact">Réserver une séance <ArrowRight className="size-4" /></a></Button>
            <Button variant="outline" asChild><a href="/a-propos/">Notre approche</a></Button>
          </div>
        </div>
        <Media asset={media['home-hero']} priority className="aspect-[4/3] rounded-card" />
      </Container>
    </Section>
  );
}
`,
    Services: `import { motion } from 'motion/react';
import { Compass, HeartHandshake, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Container, Heading, Section, Text } from '@/components/ui';
import { motionTokens as m } from '@/design-system';

const services = [
  { icon: Compass, title: 'Séances individuelles', text: 'Une heure par semaine pour clarifier ce que vous voulez et décider de la prochaine étape.' },
  { icon: HeartHandshake, title: 'Ateliers en groupe', text: 'Six personnes au plus, un thème par mois : confiance, organisation, prise de parole.' },
  { icon: Sparkles, title: 'Suivi sur trois mois', text: 'Un point toutes les deux semaines et un carnet de route pour mesurer vos progrès.' },
];

export default function Services() {
  return (
    <Section id="services">
      <Container className="flex flex-col gap-10">
        <div className="max-w-2xl">
          <Heading level={2}>Trois façons d’avancer</Heading>
          <Text variant="lead">Choisissez le rythme qui vous convient ; vous pouvez changer en cours de route.</Text>
        </div>
        <ul className="grid gap-6 md:grid-cols-3">
          {services.map((service, index) => (
            <motion.li key={service.title} initial={{ opacity: 0, y: m.distance }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10% 0px' }} transition={{ duration: m.duration, ease: m.ease, delay: index * m.stagger }} data-bench="service">
              <Card className="h-full">
                <CardHeader>
                  <service.icon className="size-6 text-primary" aria-hidden />
                  <CardTitle>{service.title}</CardTitle>
                  <CardDescription>{service.text}</CardDescription>
                </CardHeader>
              </Card>
            </motion.li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
`,
    About: `import { motion } from 'motion/react';
import { Container, Heading, Media, Section, Text } from '@/components/ui';
import { motionTokens as m } from '@/design-system';
import { media } from '@/site/media';

export default function About() {
  return (
    <Section id="approche" className="bg-muted/40">
      <Container className="grid items-center gap-10 md:grid-cols-2">
        <Media asset={media['home-about']} className="aspect-square rounded-card" />
        <motion.div initial={{ opacity: 0, x: m.distance }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: m.duration, ease: m.ease }} className="flex flex-col gap-4">
          <Heading level={2}>Une méthode simple, éprouvée à Douala</Heading>
          <Text>Nous partons de votre quotidien : vos horaires, vos contraintes, vos envies. Chaque séance se termine par une action concrète, à faire avant la suivante.</Text>
          <Text>Depuis 2019, plus de quatre cents personnes ont suivi le programme, en français ou en anglais.</Text>
        </motion.div>
      </Container>
    </Section>
  );
}
`,
    Stats: `import { Container, Counter, Section, Text } from '@/components/ui';

const stats = [
  { value: '400+', label: 'personnes accompagnées' },
  { value: '92 %', label: 'recommandent le programme' },
  { value: '12', label: 'ateliers par an' },
];

export default function Stats() {
  return (
    <Section id="chiffres">
      <Container>
        <dl className="grid gap-8 text-center sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <dt className="order-2"><Text variant="muted" as="span">{stat.label}</Text></dt>
              <dd className="order-1 text-h2 font-semibold text-foreground"><Counter value={stat.value} /></dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
`,
    Testimonials: `import { motion } from 'motion/react';
import { Card, CardContent, Container, Heading, Media, Section, Text } from '@/components/ui';
import { motionTokens as m } from '@/design-system';
import { media } from '@/site/media';

const quotes = [
  { name: 'Aïcha, commerçante', text: 'En trois mois, j’ai réorganisé ma boutique et repris mes week-ends.' },
  { name: 'Serge, ingénieur', text: 'Les ateliers m’ont appris à parler en réunion sans trembler.' },
];

export default function Testimonials() {
  return (
    <Section id="temoignages">
      <Container className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
        <Media asset={media['home-people']} className="aspect-[4/5] rounded-card" />
        <div className="flex flex-col gap-6">
          <Heading level={2}>Ils ont franchi le pas</Heading>
          {quotes.map((quote, index) => (
            <motion.figure key={quote.name} initial={{ opacity: 0, y: m.distance }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: m.duration, delay: index * m.stagger }}>
              <Card><CardContent className="pt-6"><blockquote><Text>« {quote.text} »</Text></blockquote><figcaption className="mt-3 text-small text-muted-foreground">{quote.name}</figcaption></CardContent></Card>
            </motion.figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}
`,
    Faq: `import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Container, Heading, Section } from '@/components/ui';

const questions = [
  { q: 'Combien coûte une séance ?', a: 'Les tarifs sont donnés au premier appel, selon la formule choisie.' },
  { q: 'Les séances se font-elles en ligne ?', a: 'Oui, en visio ou dans notre salle de Bonapriso, au choix.' },
  { q: 'Puis-je arrêter en cours de route ?', a: 'Oui, sans frais : vous ne payez que les séances faites.' },
];

export default function Faq() {
  return (
    <Section id="questions">
      <Container className="max-w-3xl">
        <Heading level={2}>Vos questions</Heading>
        <Accordion type="single" collapsible className="mt-6" data-bench="faq">
          {questions.map((item, index) => (
            <AccordionItem key={item.q} value={String(index)}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  );
}
`,
    Contact: `import { Button, Container, Heading, Section, Text } from '@/components/ui';
import { site } from '@/site/data';

export default function Contact() {
  return (
    <Section id="contact" className="bg-primary text-primary-foreground">
      <Container className="flex flex-col items-start gap-5">
        <Heading level={2} className="text-primary-foreground">Parlons de votre projet</Heading>
        <Text className="text-primary-foreground/80">Un premier appel de vingt minutes, offert, pour voir si nous sommes faits pour travailler ensemble.</Text>
        <Button variant="secondary" asChild><a href={'mailto:' + ${JSON.stringify(facts.email)}}>Écrire à {site.name}</a></Button>
      </Container>
    </Section>
  );
}
`,
  },
  'a-propos': {
    Story: `import { Container, Heading, Media, Section, Text } from '@/components/ui';
import { media } from '@/site/media';

export default function Story() {
  return (
    <Section id="histoire" className="pt-8">
      <Container className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Heading level={1}>Notre histoire, depuis Bonapriso</Heading>
          <Text variant="lead">Lumière est née d’une conviction : on change plus facilement quand quelqu’un marche à côté de soi.</Text>
          <Text>Après dix ans en entreprise, notre fondatrice a ouvert une petite salle à Douala pour accompagner celles et ceux qui veulent reprendre la main sur leur vie professionnelle et personnelle.</Text>
        </div>
        <Media asset={media['about-founder']} priority className="aspect-[4/5] rounded-card" />
      </Container>
    </Section>
  );
}
`,
  },
};

const HEADER = `import * as React from 'react';
import { Menu } from 'lucide-react';
import { Button, Container, Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui';
import BrandMark from '@/site/brand';

const links = [
  { href: '/', label: 'Accueil' },
  { href: '/a-propos/', label: 'À propos' },
  { href: '/#questions', label: 'Questions' },
];

export default function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <a href="/" aria-label="Accueil"><BrandMark /></a>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} aria-current={current === link.href ? 'page' : undefined} className="text-small text-muted-foreground hover:text-foreground">{link.label}</a>
          ))}
        </nav>
        <Sheet>
          <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu"><Menu className="size-5" /></Button></SheetTrigger>
          <SheetContent><SheetTitle>Menu</SheetTitle><nav className="mt-6 flex flex-col gap-4">{links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav></SheetContent>
        </Sheet>
      </Container>
    </header>
  );
}
`;

const FOOTER = `import { Container, Text } from '@/components/ui';
import { site } from '@/site/data';

export default function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col gap-2 py-10 sm:flex-row sm:justify-between">
        <Text variant="small">© {site.name} — Douala, Cameroun</Text>
        <Text variant="small"><a href="/a-propos/">À propos</a></Text>
      </Container>
    </footer>
  );
}
`;

function siteFiles(engine: Engine): Record<string, string> {
  const { project, template, siteData, designConfig } = engine;
  const manifest = {
    pages: [
      { key: 'home', path: '/', label: 'Accueil', purpose: '', seoTitle: 'Lumière — coaching de vie à Douala', seoDescription: 'Séances individuelles, ateliers et suivi sur trois mois pour changer de vie à Douala.', sections: Object.keys(SECTIONS.home) },
      { key: 'a-propos', path: '/a-propos/', label: 'À propos', purpose: '', seoTitle: '', seoDescription: 'L’histoire de Lumière, coaching de transformation personnelle à Douala depuis 2019.', sections: Object.keys(SECTIONS['a-propos']) },
    ],
    header: 'SiteHeader',
    footer: 'SiteFooter',
    components: [],
    dependencies: [],
    keywords: ['coaching', 'Douala'],
    businessType: 'LocalBusiness',
    languages: [],
  };
  const files: Record<string, string> = {
    ...template.templateFiles(),
    'package.json': project.renderPackageJson(undefined),
    ...designConfig.seedDesignSystemFiles(undefined),
    'src/site/brand.tsx': siteData.renderBrandModule(undefined, facts.name),
    'src/site/data.ts': siteData.renderDataModule(facts as never, manifest as never, 'fr'),
    'src/site/seo.json': siteData.renderSeo(facts as never, manifest as never, 'fr'),
    'src/site/media.ts': siteData.renderMediaModule({
      'home-hero': [{ kind: 'image', src: pexels(3184291), alt: 'Une séance de coaching', origin: 'pexels' }],
      'home-about': [{ kind: 'image', src: pexels(3184292), alt: 'Notre salle à Bonapriso', origin: 'pexels' }],
      'home-people': [{ kind: 'image', src: pexels(3184293), alt: 'Des participants à un atelier', origin: 'pexels' }],
      'about-founder': [{ kind: 'image', src: pexels(3184294), alt: 'La fondatrice de Lumière', origin: 'pexels' }],
    } as never),
    ...project.renderPageShells({ manifest: manifest as never, language: 'fr', siteName: facts.name, description: facts.description }),
    'src/components/site/SiteHeader.tsx': HEADER,
    'src/components/site/SiteFooter.tsx': FOOTER,
  };
  for (const page of manifest.pages) {
    files[`src/pages/${page.key}.tsx`] = project.renderPage(page as never, page.sections.map((name) => ({ name, ok: true })));
    for (const [name, code] of Object.entries(SECTIONS[page.key])) files[`src/sections/${page.key}/${name}.tsx`] = code;
  }
  return files;
}

/* -------------------------------------------------------------------------- */
/*  Les tiers imités : Google Fonts et Pexels                                  */
/* -------------------------------------------------------------------------- */

const SUBSET_RANGES: Record<string, string> = {
  'cyrillic-ext': 'U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  cyrillic: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  'greek-ext': 'U+1F00-1FFF',
  greek: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF',
  vietnamese: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
  'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
};

/**
 * L'imitation de Google Fonts, écrite une fois en JavaScript : servie par le serveur HTTPS du banc (rendu à froid
 * de l'ancien site) ET répondant au `fetch` de Node pendant la construction (polices recopiées du nouveau) — les
 * mêmes feuilles et les mêmes fichiers des deux côtés. Les vrais fichiers Inter (un par alphabet et graisse) si
 * `--fonts` en donne ; sinon des octets de taille réaliste.
 */
function writeGoogleMock(): string {
  const path = join(WORK, 'third-party.mjs');
  writeFileSync(
    path,
    `import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const RANGES = ${JSON.stringify(SUBSET_RANGES)};
const FONTS = ${JSON.stringify(FONTS_DIR ? resolve(FONTS_DIR) : null)};

// Un fichier par famille, graisse et alphabet, comme chez Google : jamais deux identiques (sinon un site qui nomme
// ses polices par leur contenu les fusionnerait, ce que les vraies ne permettent pas). Avec --fonts, la TAILLE du
// vrai fichier Inter correspondant ; sinon 18 Ko (un sous-ensemble latin d'Inter).
export function fontBytes(key, subset, weight) {
  let size = 18000;
  if (FONTS) {
    const nearest = Number(weight) >= 600 ? '600' : '400';
    const file = readdirSync(FONTS).find((name) => name.startsWith('inter-' + subset + '-' + nearest + '-normal') && name.endsWith('.woff2'));
    if (file) size = readFileSync(join(FONTS, file)).length;
  }
  const chunks = [];
  for (let i = 0; chunks.length * 64 < size; i++) chunks.push(createHash('sha512').update(key + ':' + i).digest());
  return Buffer.concat(chunks).subarray(0, size);
}

export function googleCss(href) {
  const url = new URL(href);
  const blocks = [];
  for (const family of url.searchParams.getAll('family')) {
    const [name, weights = '400'] = family.split(':');
    for (const weight of weights.split(',')) {
      for (const [subset, range] of Object.entries(RANGES)) {
        blocks.push('/* ' + subset + ' */\\n@font-face {\\n  font-family: \\'' + name.replace(/\\+/g, ' ') + '\\';\\n  font-style: normal;\\n  font-weight: ' + weight + ';\\n  font-display: swap;\\n  src: url(https://fonts.gstatic.com/s/' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '/v13/' + subset + '-' + weight + '.woff2) format(\\'woff2\\');\\n  unicode-range: ' + range + ';\\n}');
      }
    }
  }
  return blocks.join('\\n');
}

export function respond(href) {
  const url = new URL(href);
  if (url.hostname === 'fonts.googleapis.com') return new Response(googleCss(href), { status: 200, headers: { 'content-type': 'text/css' } });
  const [, subset, weight] = url.pathname.match(/\\/([\\w-]+)-(\\d+)\\.woff2/) ?? [];
  return new Response(fontBytes(url.pathname, subset, weight), { status: 200, headers: { 'content-type': 'font/woff2' } });
}
`
  );
  return path;
}

let googleMock: { fontBytes: (key: string, subset: string, weight: string) => Buffer; googleCss: (href: string) => string };

/** Les octets imités ne sont pas une vraie police : Chrome le dit, pour les deux versions pareil. Pas une erreur du site. */
const FONT_DECODE = /OTS parsing error|Failed to decode downloaded font/i;

type SharpFactory = (input?: string | Buffer | { create: object }) => import('sharp').Sharp;
let sharp: SharpFactory | null = null;
const imageCache = new Map<string, Buffer>();
const BASE_IMAGE = join(WORK, 'photo-base.jpg');

/** Une photo d'essai (bruit adouci : se compresse comme une vraie photo), faite une fois, la même pour tous. */
async function baseImage(): Promise<void> {
  sharp = (await import('sharp')).default as unknown as SharpFactory;
  if (existsSync(BASE_IMAGE)) return;
  const noise = await sharp!({ create: { width: 2400, height: 1600, channels: 3, noise: { type: 'gaussian', mean: 120, sigma: 60 } } }).png().toBuffer();
  await sharp!(noise).blur(2.2).modulate({ saturation: 1.4 }).jpeg({ quality: 85 }).toFile(BASE_IMAGE);
}

/** Pexels : `w` × `dpr` de large (ou 940 × 2), comme le vrai CDN. */
async function pexelsImage(href: string): Promise<Buffer> {
  const url = new URL(href);
  const width = Math.round(Number(url.searchParams.get('w') || 940) * Number(url.searchParams.get('dpr') || 1));
  const key = `${url.pathname}:${width}`;
  if (!imageCache.has(key)) imageCache.set(key, await sharp!(BASE_IMAGE).resize({ width }).jpeg({ quality: 75, mozjpeg: true }).toBuffer());
  return imageCache.get(key)!;
}

/* -------------------------------------------------------------------------- */
/*  Serveurs                                                                    */
/* -------------------------------------------------------------------------- */

/** Le premier contact avec chaque domaine paie l'établissement de la connexion (réinitialisé à chaque visite à froid). */
const seenHosts = new Set<string>();
const connect = async (host: string) => {
  if (seenHosts.has(host)) return;
  seenHosts.add(host);
  await new Promise((done) => setTimeout(done, CONNECT_MS));
};

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg)/;

type ServerMode = 'old' | 'new';

/**
 * Le site, servi comme iDeploy le sert : `old` = l'ancienne configuration (ni compression ni Cache-Control, ETag
 * seulement), `new` = la nouvelle (gzip 6, fichiers à empreinte gardés un an, HTML revalidé).
 */
function siteServer(dist: string, mode: ServerMode) {
  return createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    await connect(`site:${req.headers.host}`);
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = join(dist, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) file = join(dist, 'index.html');
    const body = readFileSync(file);
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
    const headers: Record<string, string> = { 'content-type': type, etag, 'last-modified': statSync(file).mtime.toUTCString() };
    if (mode === 'new') {
      if (/^\/assets\/(.+-[A-Za-z0-9_-]{8,}\.(js|mjs|css|woff2?)|fonts\/font-[0-9a-f]{12}\.woff2?)$/i.test(path)) headers['cache-control'] = 'public, max-age=31536000, immutable';
      else if (type.startsWith('text/html')) headers['cache-control'] = 'no-cache';
    }
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers).end();
      return;
    }
    if (mode === 'new' && COMPRESSIBLE.test(type) && body.length >= 1024 && /gzip/.test(String(req.headers['accept-encoding']))) {
      res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' }).end(gzipSync(body, { level: 6 }));
      return;
    }
    res.writeHead(200, headers).end(body);
  });
}

/** Google Fonts et Pexels en HTTPS local (certificat auto-signé, Chrome lancé avec `--ignore-certificate-errors`). */
function thirdPartyServer(cert: { key: string; cert: string }) {
  return createHttpsServer(cert, async (req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    await connect(host);
    const href = `https://${host}${req.url}`;
    try {
      if (host === 'fonts.googleapis.com') {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'private, max-age=86400' }).end(googleMock.googleCss(href));
      } else if (host === 'fonts.gstatic.com') {
        const [, subset, weight] = (req.url || '').match(/\/([\w-]+)-(\d+)\.woff2/) ?? [];
        res.writeHead(200, { 'content-type': 'font/woff2', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=31536000' }).end(googleMock.fontBytes(new URL(href).pathname, subset, weight));
      } else if (host === 'images.pexels.com') {
        res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000' }).end(await pexelsImage(href));
      } else res.writeHead(404).end();
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });
}

const listen = (server: ReturnType<typeof createHttpServer>, port = 0) =>
  new Promise<number>((done) => server.listen(port, '127.0.0.1', () => done((server.address() as AddressInfo).port)));

/* -------------------------------------------------------------------------- */
/*  Construction                                                               */
/* -------------------------------------------------------------------------- */

/** Le `fetch` de Node pendant la construction : Google Fonts répond depuis l'imitation (pas de réseau ici). */
function fetchMock(googleModule: string): string {
  const path = join(WORK, 'fetch-mock.mjs');
  writeFileSync(
    path,
    `const real = globalThis.fetch;
const mock = await import(${JSON.stringify(pathToFileURL(googleModule).href)});
globalThis.fetch = async (input, init) => {
  const href = typeof input === 'string' ? input : input.url;
  if (/^https:\\/\\/fonts\\.(googleapis|gstatic)\\.com\\//.test(href)) return mock.respond(href);
  return real(input, init);
};
`
  );
  return path;
}

function writeProject(dir: string, files: Record<string, string>) {
  rmSync(dir, { recursive: true, force: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  symlinkSync(resolve(MODULES!), join(dir, 'node_modules'), 'dir');
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => (item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)]));
}

/** Construit un site ; rend la durée et le poids de ce que la page d'accueil charge. */
function build(dir: string, mock: string) {
  const runs: number[] = [];
  let output = '';
  for (let i = 0; i < 3; i++) {
    rmSync(join(dir, 'dist'), { recursive: true, force: true });
    rmSync(join(dir, 'node_modules/.vite'), { recursive: true, force: true });
    const start = performance.now();
    output = execFileSync('npm', ['run', 'build'], { cwd: dir, env: { ...process.env, NODE_OPTIONS: `--import ${pathToFileURL(mock).href}` }, stdio: 'pipe' }).toString();
    runs.push(performance.now() - start);
  }
  const dist = join(dir, 'dist');
  const home = readFileSync(join(dist, 'index.html'), 'utf8');
  const local = (pattern: RegExp) => [...home.matchAll(pattern)].map((match) => match[1]).filter((href) => href.startsWith('/'));
  const scripts = [...new Set([...local(/<script[^>]*src="([^"]+)"/g), ...local(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)])];
  const styles = local(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g);
  const size = (paths: string[]) => paths.reduce((sum, path) => sum + readFileSync(join(dist, path)).length, 0);
  const gz = (paths: string[]) => paths.reduce((sum, path) => sum + gzipSync(readFileSync(join(dist, path)), { level: 6 }).length, 0);
  const files = walk(dist);
  return {
    buildMs: median(runs),
    buildRunsMs: runs.map(Math.round),
    output: output.split('\n').filter((line) => /Référencement|référencement|pré-rendu|ERREUR|attention/.test(line)).join('\n'),
    dist: { files: files.length, bytes: files.reduce((sum, file) => sum + statSync(file).size, 0) },
    home: {
      html: { bytes: home.length, gzip: gzipSync(home).length },
      js: { files: scripts.length, bytes: size(scripts), gzip: gz(scripts) },
      css: { files: styles.length, bytes: size(styles), gzip: gz(styles) },
      externalStylesheets: (home.match(/<link[^>]*rel="stylesheet"[^>]*href="https?:/g) ?? []).length,
      fontPreloads: (home.match(/rel="preload"[^>]*as="font"/g) ?? []).length,
      deferredSections: (readFileSync(join(dir, 'src/pages/home.tsx'), 'utf8').match(/ defer>/g) ?? []).length,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Mesure dans Chrome                                                         */
/* -------------------------------------------------------------------------- */

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const OBSERVERS = `
window.__bench = { lcp: 0, cls: 0, fcp: 0, longTasks: [] };
new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__bench.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__bench.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__bench.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__bench.longTasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
`;

type Browser = Awaited<ReturnType<typeof import('puppeteer').default.launch>>;

async function visit(browser: Browser, base: string, withChecks: boolean) {
  seenHosts.clear();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`page: ${(error as Error).message}`));
  page.on('console', (message) => message.type() === 'error' && !FONT_DECODE.test(message.text()) && errors.push(`console: ${message.text()}`));
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT_MS, downloadThroughput: DOWN_BPS, uploadThroughput: UP_BPS });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(OBSERVERS);

  const types = new Map<string, { type: string; url: string; status: number }>();
  let bytes: Record<string, number> = {};
  let requests = 0;
  let log: Array<{ url: string; type: string; status: number; bytes: number }> = [];
  cdp.on('Network.responseReceived', (event: { requestId: string; type: string; response: { url: string; status: number } }) =>
    types.set(event.requestId, { type: event.type, url: event.response.url, status: event.response.status })
  );
  cdp.on('Network.loadingFinished', (event: { requestId: string; encodedDataLength: number }) => {
    const seen = types.get(event.requestId);
    const type = (seen?.type ?? 'Other').toLowerCase();
    bytes[type] = (bytes[type] ?? 0) + event.encodedDataLength;
    requests += 1;
    log.push({ url: (seen?.url ?? '?').replace(/^http:\/\/127\.0\.0\.1:\d+/, ''), type, status: seen?.status ?? 0, bytes: event.encodedDataLength });
  });

  const measure = async (url: string) => {
    bytes = {};
    requests = 0;
    log = [];
    await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    // Les sections différées s'hydratent au repos du navigateur, après le chargement : leur travail est compté.
    await new Promise((done) => setTimeout(done, 4000));
    // En texte : tsx ajoute aux fonctions une aide (`__name`) qui n'existe pas dans la page.
    const metrics = (await page.evaluate(`(() => {
      const b = window.__bench;
      const nav = performance.getEntriesByType('navigation')[0];
      const tbt = b.longTasks.filter(([start]) => start >= b.fcp).reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);
      return { fcp: b.fcp, lcp: b.lcp, cls: b.cls, tbt, load: nav.loadEventEnd, longTaskMs: b.longTasks.reduce((sum, [, d]) => sum + d, 0) };
    })()`)) as { fcp: number; lcp: number; cls: number; tbt: number; load: number; longTaskMs: number };
    const total = Object.values(bytes).reduce((sum, value) => sum + value, 0);
    return { ...metrics, bytes: { total, ...bytes }, requests, log: [...log] };
  };

  const cold = await measure(base + '/');

  let checks: Record<string, boolean> | null = null;
  if (withChecks) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    checks = (await page.evaluate(`(async () => {
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      const opacity = (selector) => Array.from(document.querySelectorAll(selector)).map((el) => Number(getComputedStyle(el).opacity));
      const heroVisible = opacity('[data-bench="hero-lead"]').every((value) => value > 0.99);
      document.querySelector('[data-bench="faq"]')?.scrollIntoView();
      await wait(1500);
      document.querySelector('#services')?.scrollIntoView();
      await wait(2000);
      const services = opacity('[data-bench="service"]');
      const servicesVisible = services.length === 3 && services.every((value) => value > 0.99);
      const trigger = document.querySelector('[data-bench="faq"] button');
      trigger?.click();
      await wait(800);
      const faqOpens = trigger?.getAttribute('aria-expanded') === 'true';
      return { heroVisible, servicesVisible, faqOpens, h1Prerendered: !!document.querySelector('h1')?.textContent?.trim() };
    })()`)) as Record<string, boolean>;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  }

  // Visite d'une seconde page, cache chaud.
  const warm = await measure(base + '/a-propos/');
  await context.close();
  return { cold, warm, errors, checks };
}

/**
 * L'aperçu de l'atelier : serveur Vite de développement (pré-regroupement déjà fait, comme avec les instantanés),
 * jusqu'au titre affiché dans la page. Hors WebContainer : l'écart entre versions compte, pas l'absolu.
 */
async function previewStart(browser: Browser, dir: string, runs = 5) {
  const times: Array<{ server: number; page: number }> = [];
  for (let run = 0; run < runs; run++) {
    const port = 5600 + Math.floor(Math.random() * 300);
    const start = performance.now();
    const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise<void>((done, fail) => {
        const timer = setTimeout(() => fail(new Error('Vite ne démarre pas')), 60_000);
        child.stdout.on('data', (chunk: Buffer) => {
          if (/ready in|Local:/.test(chunk.toString())) {
            clearTimeout(timer);
            done();
          }
        });
        child.on('exit', (code) => fail(new Error(`Vite s'est arrêté (${code})`)));
      });
      const server = performance.now() - start;
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(`!!document.querySelector('h1') && document.querySelector('h1').textContent.trim().length > 0`, { timeout: 60_000 });
      times.push({ server, page: performance.now() - start });
      await context.close();
    } finally {
      child.kill('SIGTERM');
      await new Promise((done) => setTimeout(done, 300));
    }
  }
  return { serverMs: median(times.map((t) => t.server)), pageMs: median(times.map((t) => t.page)), runs: times.map((t) => Math.round(t.page)) };
}

/* -------------------------------------------------------------------------- */
/*  Déroulé                                                                     */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log(`Banc d'essai — ${RUNS} visite(s) à froid par configuration, profil mobile 4G lent.`);
  await baseImage();
  const googleModule = writeGoogleMock();
  googleMock = await import(pathToFileURL(googleModule).href);
  const mock = fetchMock(googleModule);

  const oldSrc = extractOldSource(OLD_REF);
  const engines = { old: await loadEngine(oldSrc), new: await loadEngine(join(APP, 'src')) };
  console.log(`Moteurs : ancien = ${OLD_REF} (template ${engines.old.template.TEMPLATE_VERSION}), nouveau = arbre de travail (template ${engines.new.template.TEMPLATE_VERSION}).`);

  const builds: Record<string, ReturnType<typeof build>> = {};
  for (const name of ['old', 'new'] as const) {
    const dir = join(WORK, `site-${name}`);
    writeProject(dir, siteFiles(engines[name]));
    console.log(`Construction (${name})…`);
    builds[name] = build(dir, mock);
    console.log(`  ${Math.round(builds[name].buildMs)} ms (médiane de 3) · JS accueil ${builds[name].home.js.gzip} o gzip · CSS ${builds[name].home.css.bytes} o`);
    if (builds[name].output) console.log(builds[name].output.replace(/^/gm, '  '));
  }

  const certDir = join(WORK, 'cert');
  mkdirSync(certDir, { recursive: true });
  if (!existsSync(join(certDir, 'key.pem'))) {
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=bench" -keyout key.pem -out cert.pem 2>/dev/null`, { cwd: certDir });
  }
  const tls = { key: readFileSync(join(certDir, 'key.pem'), 'utf8'), cert: readFileSync(join(certDir, 'cert.pem'), 'utf8') };
  const third = thirdPartyServer(tls);
  const thirdPort = await new Promise<number>((done) => third.listen(0, '127.0.0.1', () => done((third.address() as AddressInfo).port)));

  const configs = [
    { id: 'A', label: 'ancien template, ancien serveur', dist: join(WORK, 'site-old/dist'), mode: 'old' as ServerMode },
    { id: 'B', label: 'nouveau template, ancien serveur', dist: join(WORK, 'site-new/dist'), mode: 'old' as ServerMode },
    { id: 'C', label: 'nouveau template, nouveau serveur', dist: join(WORK, 'site-new/dist'), mode: 'new' as ServerMode },
  ];

  const puppeteer = (await import('puppeteer')).default;
  const rules = ['fonts.googleapis.com', 'fonts.gstatic.com', 'images.pexels.com'].map((host) => `MAP ${host} 127.0.0.1:${thirdPort}`).join(', ');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', `--host-resolver-rules=${rules}`, '--ignore-certificate-errors'] });

  const results: Record<string, unknown> = {};
  for (const config of configs) {
    const server = siteServer(config.dist, config.mode);
    const port = await listen(server);
    const base = `http://127.0.0.1:${port}`;
    const visits = [];
    for (let run = 0; run < RUNS; run++) visits.push(await visit(browser, base, run === 0));
    server.close();
    const pick = (phase: 'cold' | 'warm', key: string) => median(visits.map((v) => (v[phase] as Record<string, number>)[key]));
    const pickBytes = (phase: 'cold' | 'warm', key: string) => median(visits.map((v) => (v[phase].bytes as Record<string, number>)[key] ?? 0));
    const summary = {
      label: config.label,
      cold: { fcp: pick('cold', 'fcp'), lcp: pick('cold', 'lcp'), cls: pick('cold', 'cls'), tbt: pick('cold', 'tbt'), load: pick('cold', 'load'), requests: pick('cold', 'requests'), bytes: { total: pickBytes('cold', 'total'), script: pickBytes('cold', 'script'), stylesheet: pickBytes('cold', 'stylesheet'), font: pickBytes('cold', 'font'), image: pickBytes('cold', 'image'), document: pickBytes('cold', 'document') } },
      warm: { lcp: pick('warm', 'lcp'), tbt: pick('warm', 'tbt'), requests: pick('warm', 'requests'), bytes: pickBytes('warm', 'total') },
      errors: [...new Set(visits.flatMap((v) => v.errors))],
      checks: visits[0].checks,
      requestsLog: { cold: visits[0].cold.log, warm: visits[0].warm.log },
      runs: visits.map((v) => ({ lcp: Math.round(v.cold.lcp), tbt: Math.round(v.cold.tbt), cls: Number(v.cold.cls.toFixed(3)) })),
    };
    results[config.id] = summary;
    console.log(`${config.id} — ${config.label} : LCP ${Math.round(summary.cold.lcp)} ms · FCP ${Math.round(summary.cold.fcp)} ms · TBT ${Math.round(summary.cold.tbt)} ms · CLS ${summary.cold.cls.toFixed(3)} · ${Math.round(summary.cold.bytes.total / 1024)} Ko · ${summary.cold.requests} requêtes · erreurs ${summary.errors.length}`);
  }
  const preview: Record<string, unknown> = {};
  for (const name of ['old', 'new'] as const) {
    // Le pré-regroupement de Vite fait une fois (comme le livrent les instantanés), puis mesuré.
    await previewStart(browser, join(WORK, `site-${name}`), 1).catch(() => null);
    preview[name] = await previewStart(browser, join(WORK, `site-${name}`)).catch((error) => ({ error: String(error) }));
    console.log(`Aperçu (${name}) : ${JSON.stringify(preview[name])}`);
  }

  await browser.close();
  third.close();

  writeFileSync(OUT, `${JSON.stringify({ date: new Date().toISOString(), profile: { rttMs: RTT_MS, downKbps: 1600, cpuSlowdown: CPU_SLOWDOWN, viewport: '412x823@2.625' }, runs: RUNS, builds, preview, results }, null, 2)}\n`);
  rmSync(join(APP, '.bench-old'), { recursive: true, force: true });
  console.log(`Rapport : ${OUT}`);
}

main().catch((error) => {
  rmSync(join(APP, '.bench-old'), { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
