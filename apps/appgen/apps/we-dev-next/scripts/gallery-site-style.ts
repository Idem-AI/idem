/**
 * La GALERIE du style des sites : pour N projets, la même « planche » (boutons, badge, cartes écrites à la main comme
 * dans le catalogue, carte du design system, tuile d'image, liens, traits) rendue par l'aperçu instantané dans Chrome,
 * avec le survol d'un bouton et d'une carte. Rien n'est appelé sur un modèle.
 *
 *   PREVIEW_RUNTIME_DIR=<node_modules> npm run gallery:site-style -- --out <dossier> [--count 12]
 *
 * Écrit `sheet-1.png`, `sheet-2.png`… (quatre projets par planche : le repos, puis le survol du bouton et de la carte)
 * et `styles.json` (le style de chaque projet).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeStyle, personalityOf, seedConfig, type Family } from '../src/siteEngine/designConfig.js';
import { markSurface } from '../src/siteEngine/sectionCatalog/assemble.js';
import { renderEntry } from '../src/siteEngine/project.js';
import { renderBrandModule, renderMediaModule } from '../src/siteEngine/siteData.js';
import { designSystemFiles, templateFiles } from '../src/siteEngine/template.js';
import { openPreviewSession } from '../src/routes/preview.js';
import { availability } from '../src/preview/engine.js';
import { forgeDesignSystem } from '../src/design/tokenForge.js';
import type { ProjectModel } from '../src/types/project.js';

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = option('out') ?? join(process.cwd(), 'gallery');
const COUNT = Number(option('count') ?? 12);
mkdirSync(OUT, { recursive: true });

const state = availability();
if (!state.available) {
  console.log(`Aperçu instantané indisponible : ${state.reason}`);
  process.exit(2);
}

// Des projets de familles différentes (la direction artistique de la charte décide de la famille).
const DIRECTIONS = ['swiss', 'pop-art', 'handwritten', 'editorial', 'maximalism', 'bohemian', 'minimalism', 'y2k', 'surreal', 'victorian', 'graffiti', 'clay'];
const COLORS = ['#2563eb', '#e11d48', '#059669', '#7c3aed', '#d97706', '#0891b2', '#be185d', '#4d7c0f', '#b45309', '#1d4ed8', '#c2410c', '#0f766e'];
const NAMES = ['Lumière', 'Kora Studio', 'Baobab Café', 'Nuru Solaire', 'Atelier Mboa', 'Sahel Voyages', 'Pili Pili', 'Cité Verte', 'Ndolo Design', 'Maison Ébène', 'Fika Tech', 'Dala Clinique'];

const projects: ProjectModel[] = Array.from({ length: COUNT }, (_, n) => ({
  id: `gallery-${n}`,
  name: NAMES[n % NAMES.length],
  description: 'Un site vitrine',
  type: 'web',
  analysisResultModel: { branding: { artDirection: { styleId: DIRECTIONS[n % DIRECTIONS.length] }, colors: { primary: COLORS[n % COLORS.length] } } },
} as unknown as ProjectModel));

/** La planche : tout ce qui dépend des formes, des survols et des bordures, avec les classes du catalogue. */
const kit = (name: string) => {
  const card = (title: string, text: string) => `<div className="${markSurface('flex flex-col gap-3 rounded-card border border-border bg-card p-6')}" data-gallery="card"><h3 className="font-heading text-h4 text-foreground">${title}</h3><p className="text-body text-muted-foreground">${text}</p><a href="#" className="text-small text-primary">En savoir plus</a></div>`;
  return `import { Button, Badge, Card, CardHeader, CardTitle, CardDescription, Input } from '@/components/ui';
export default function Page() {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground" style={{ width: 760 }}>
      <header className="mb-5 flex items-center justify-between border-b border-border pb-3">
        <strong className="font-heading text-h4">${name}</strong>
        <nav className="flex gap-5 text-small text-muted-foreground"><a href="#">Accueil</a><a href="#">Services</a><a href="#">Contact</a></nav>
      </header>
      <h1 className="mb-3 font-heading text-h2">Une page, un caractère</h1>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button data-gallery="button">Réserver une séance</Button>
        <Button variant="secondary">Voir les offres</Button>
        <Button variant="outline">Nous écrire</Button>
        <Badge>Nouveau</Badge>
        <Input placeholder="Votre e-mail" className="w-44" />
      </div>
      <div className="mb-5 grid grid-cols-3 gap-4">
        ${card('Conseil', 'Un accompagnement sur mesure.')}
        ${card('Atelier', 'Des ateliers en petit groupe.')}
        ${card('Suivi', 'Un point toutes les deux semaines.')}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Carte du système</CardTitle><CardDescription>Le composant Card.</CardDescription></CardHeader></Card>
        <div className="${markSurface('relative overflow-hidden rounded-card')}" style={{ height: 96, background: 'linear-gradient(135deg, rgb(var(--primary)) , rgb(var(--accent)))' }} />
        <div className="rounded-card border-2 border-primary p-4 text-small">Encadré</div>
      </div>
    </div>
  );
}
`;
};

const require = createRequire(join(process.cwd(), '..', '..', '..', '..', 'package.json'));
const puppeteer = require('puppeteer');
const sharp = require('sharp');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const shots: Array<{ title: string; rest: Buffer; button: Buffer; card: Buffer }> = [];
  const styles: unknown[] = [];

  for (const project of projects) {
    const system = forgeDesignSystem(project);
    const seed = seedConfig(project, system);
    const { files: ds } = designSystemFiles(seed, seed);
    const family = ({ swiss: 'structured', editorial: 'structured', minimalism: 'structured', victorian: 'structured', 'pop-art': 'expressive', maximalism: 'expressive', y2k: 'expressive', graffiti: 'expressive', clay: 'expressive', handwritten: 'soft', bohemian: 'soft', surreal: 'soft' } as Record<string, Family>)[
      (project.analysisResultModel as any).branding.artDirection.styleId
    ];
    const personality = personalityOf(project, family);
    styles.push({ name: project.name, family, style: describeStyle(personality) });

    const files: Record<string, string> = {
      ...templateFiles(),
      ...ds,
      'src/site/brand.tsx': renderBrandModule(project, project.name),
      'src/site/media.ts': renderMediaModule({}),
      'src/site/data.ts': 'export const site = { name: "x" };\n',
      'src/entries/home.tsx': renderEntry('home'),
      'src/pages/home.tsx': kit(project.name),
      'src/site/pages.json': JSON.stringify({ languages: ['fr'], pages: [{ path: '/', lang: 'fr', module: 'src/pages/home.tsx', entry: '/src/entries/home.tsx', html: 'index.html', title: project.name }] }),
      'index.html': '<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>x</title></head><body><div id="root"></div></body></html>',
    };
    const session = await openPreviewSession('gallery', files);
    if (!session.state.ok) {
      console.log(`${project.name} : ${session.state.error}`);
      continue;
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 620, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', (r: { url(): string; continue(): void; abort(): void }) => (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(r.url()) ? r.continue() : r.abort()));
    // Le serveur de l'aperçu, monté ici le temps de la galerie.
    const { default: express } = await import('express');
    const previewRouter = (await import('../src/routes/preview.js')).default;
    const app = express();
    app.use('/api/preview', previewRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((done) => server.once('listening', done));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    await page.goto(base + session.url, { waitUntil: 'load' });
    await page.waitForSelector('[data-gallery="button"]', { timeout: 20_000 });
    await new Promise((r) => setTimeout(r, 900));
    const rest = (await page.screenshot({ clip: { x: 0, y: 0, width: 760, height: 480 } })) as Buffer;
    const crop = async (selector: string, pad: number) => {
      await page.hover(selector);
      await new Promise((r) => setTimeout(r, 700));
      const box = await (await page.$(selector))!.boundingBox();
      const buffer = (await page.screenshot({ clip: { x: Math.max(0, box!.x - pad), y: Math.max(0, box!.y - pad), width: box!.width + pad * 2, height: box!.height + pad * 2 } })) as Buffer;
      await page.mouse.move(790, 610);
      return buffer;
    };
    const button = await crop('[data-gallery="button"]', 14);
    const card = await crop('[data-gallery="card"]', 14);
    shots.push({ title: `${project.name} — ${describeStyle(personality)}`, rest, button, card });
    await page.close();
    server.close();
    await session.session.dispose();
    console.log(`  ${project.name.padEnd(14)} ${describeStyle(personality)}`);
  }
  await browser.close();
  writeFileSync(join(OUT, 'styles.json'), JSON.stringify(styles, null, 2));

  // Quatre projets par planche : le repos (760 × 480), le survol du bouton et de la carte à droite.
  const perSheet = 4;
  for (let s = 0; s * perSheet < shots.length; s++) {
    const group = shots.slice(s * perSheet, (s + 1) * perSheet);
    const rows = await Promise.all(
      group.map(async (shot) => {
        const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="26"><rect width="1240" height="26" fill="#111"/><text x="8" y="18" font-family="Helvetica" font-size="13" fill="#fff">${shot.title.replace(/&/g, '&amp;')}</text></svg>`);
        const b = await sharp(shot.button).resize({ width: 240, height: 110, fit: 'contain', background: '#f3f3f3' }).png().toBuffer();
        const c = await sharp(shot.card).resize({ width: 240, height: 360, fit: 'contain', background: '#f3f3f3' }).png().toBuffer();
        return sharp({ create: { width: 1240, height: 506, channels: 3, background: '#e5e5e5' } })
          .composite([{ input: label, top: 0, left: 0 }, { input: shot.rest, top: 26, left: 0 }, { input: b, top: 26, left: 770 }, { input: c, top: 140, left: 770 }])
          .png()
          .toBuffer();
      })
    );
    await sharp({ create: { width: 1240, height: 506 * rows.length, channels: 3, background: '#fff' } })
      .composite(rows.map((input, i) => ({ input, top: i * 506, left: 0 })))
      .png()
      .toFile(join(OUT, `sheet-${s + 1}.png`));
  }
  console.log(`Planches écrites dans ${OUT}`);
  process.exit(0);
})();
