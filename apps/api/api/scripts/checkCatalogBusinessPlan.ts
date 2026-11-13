/**
 * LE BUSINESS PLAN DU CATALOGUE, IMPRIMÉ — `npm run check:bpcatalog [-- --shots <dossier>]`.
 *
 * Compose un business plan réaliste (texte long, chiffres-clés, frise, personas, tableaux, graphique, hypothèses) par le
 * catalogue de gabarits, gabarit par gabarit, puis l'imprime avec le VRAI service PDF (même paginateur que
 * l'application). Ce qu'il exige, pour chaque gabarit :
 *   - aucune page presque vide au milieu du document, aucune page de section remplie à moins de 60 % ;
 *   - aucun bloc repoussé par le filet de sécurité du paginateur (mesure = page construite) ;
 *   - aucun bloc réduit faute de pouvoir être coupé (une colonne écrasée en bas de page) ;
 *   - tout le texte du contenu présent dans le PDF.
 * `--shots` : chaque page en PNG, pour la regarder.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { brandFromIdem, catalog, closeBrowser, configureGraphicEngine, createDocument, resetCatalog, SectionContent, sectionHtml } from '@idem/graphic-engine';
import { SectionModel } from '../models/section.model';
import { BUSINESS_PLAN_PAGINATION } from '../services/BusinessPlan/businessPlanPdf.options';
import { PdfService } from '../services/pdf.service';
import { FlowPaginationReport } from '../services/pdf/flow-pagination.runtime';
import { measurePdfPages } from '../services/pdf/pdfQualityGate';
import puppeteer from 'puppeteer';
import type { buildIframeDocument as BuildIframeDocument } from '../../../../packages/shared-document-editor/src/angular/runtime/editor-iframe';

process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_QUALITY_MEMORY = '0';
delete process.env.GRAPHIC_ENGINE_MODE;
process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || resolve(__dirname, '../../../../../idem-templates');
const shotsAt = process.argv.indexOf('--shots');
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : undefined;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;

let failures = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  if (!cond) failures++;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const LOGO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><circle cx="20" cy="20" r="16" fill="#1b7a7a"/><text x="44" y="27" font-size="18" font-family="Arial" fill="#163332">AgriLink</text></svg>').toString('base64');
const PHOTO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#d9e8e3"/><path d="M0 380 Q200 300 400 360 T800 330 V500 H0Z" fill="#1b7a7a"/><circle cx="620" cy="140" r="70" fill="#e3b45a"/></svg>').toString('base64');

const para = (topic: string, n: number) => `${topic} : ${'Les petits exploitants du Moungo achètent leurs intrants au marché hebdomadaire, à douze kilomètres en moyenne. '.repeat(n)}La borne tactile remplace ce trajet par un point de vente sûr, au village.`;
const prose = (id: string, topic: string, paragraphs: number, len = 3) => ({ id, kind: 'prose' as const, paragraphs: Array.from({ length: paragraphs }, (_, i) => para(`${topic} ${i + 1}`, len)) });

const SECTIONS: SectionContent[] = [
  { id: 'cover', role: 'cover', title: 'AgriLink', blocks: [{ id: 'c', kind: 'cover', brandName: 'AgriLink', promise: 'Les intrants à portée de main, sans smartphone', documentLabel: 'Business plan', dateLabel: 'Novembre 2026' }] },
  {
    id: 'company-summary', role: 'opening', title: 'AgriLink : un pont tactile pour les exploitants exclus', lede: 'Une entreprise camerounaise qui met les intrants et les marchés à portée des exploitants sans smartphone.',
    blocks: [
      { id: 'ph', kind: 'figure', url: PHOTO, alt: 'Une borne AgriLink au marché' },
      prose('b1', 'Présentation', 3, 4),
      { id: 'b2', kind: 'metrics', items: [{ value: '2023', label: 'Année de création', note: 'Douala' }, { value: '6', label: 'Salariés', note: 'T1 2025' }, { value: '47', label: 'Exploitations visitées' }, { value: '30–40 %', label: 'Décote subie sans smartphone' }] },
      { id: 'b3', kind: 'table', headers: ['Valeur', 'Ce que cela veut dire'], rows: [['Accès d’abord', 'Chaque choix part de l’exploitant sans smartphone.'], ['Confiance tangible', 'Des bornes dans des lieux tenus.'], ['Souveraineté des données', 'L’historique appartient à l’exploitant.'], ['Résilience locale', 'Énergie solaire et 72 h de stockage local.']], caption: 'Six valeurs qui guident le produit.' },
      { id: 'b4', kind: 'cards', items: [{ title: 'Marcel Nkeng — cofondateur', body: 'Ancien agent de vulgarisation agricole, il a mené l’étude de terrain sur 47 exploitations.' }, { title: 'Amina Bello — cofondatrice', body: 'Ingénieure logicielle, cinq ans d’applications USSD hors ligne chez un opérateur.' }] },
    ],
  },
  {
    id: 'opportunity', role: 'data', title: 'Pourquoi l’exploitant hors ligne est la prochaine frontière', lede: 'Le problème n’est pas la demande : c’est l’accès.',
    blocks: [
      prose('b1', 'Marché', 2, 4),
      { id: 'b2', kind: 'metrics', items: [{ value: '~80 %', label: 'Exploitants sans smartphone', note: 'UIT' }, { value: '33 M', label: 'Exploitations en Afrique subsaharienne', note: 'FAO 2022' }, { value: '60 %', label: 'Part de l’emploi agricole au Cameroun', note: 'Banque mondiale' }] },
      { id: 'b3', kind: 'assumption', statement: 'Un exploitant dépense en moyenne 35 000 XAF d’intrants par saison.', basis: 'Fourchette médiane de trois distributeurs à Douala et Yaoundé, T4 2024.' },
      { id: 'b4', kind: 'timeline', steps: [{ date: 'T2 2025', title: 'Pilote sur deux marchés', body: 'Douala et Yaoundé : volume, panier moyen, fidélité.' }, { date: 'T1 2026', title: 'Première extension', body: 'Villes secondaires, premières négociations avec des acheteurs.' }, { date: 'T4 2026', title: 'Réseau cible', body: 'Trois régions, part de marché mesurable.' }] },
      prose('b5', 'Concurrence', 2, 3),
    ],
  },
  {
    id: 'target-audience', role: 'narrative', title: 'Trois profils, une majorité mal servie', lede: 'L’exploitant qui possède une parcelle, cultive une culture vivrière et n’a pas de smartphone.',
    blocks: [
      { id: 'p1', kind: 'persona', name: 'Marie Ngo', role: 'Productrice de manioc, 42 ans', traits: ['Téléphone basique', 'Épargne en tontine', 'Pertes après récolte'], needs: ['Acheter avant la saison', 'Vendre en une semaine'], quote: 'Si je pouvais acheter sans marcher douze kilomètres, je nourrirais mes enfants toute l’année.' },
      { id: 'p2', kind: 'persona', name: 'Paul Abanda', role: 'Président de coopérative, 55 ans', traits: ['Smartphone, mais pas ses membres', 'Commandes collectées à pied'], needs: ['Un point de commande unique', 'Des prix transparents'], quote: 'Je passe trois jours à collecter les commandes à pied.' },
      prose('b3', 'Douleurs', 3, 3),
      { id: 'b4', kind: 'table', headers: ['Segment', 'Description', 'Taille estimée', 'Besoin'], rows: [['Exploitants', 'Moins de 2 ha, sans smartphone', '1,8 M ménages', 'Accès aux intrants'], ['Coopératives', '15 à 50 membres', '12 000', 'Commandes groupées'], ['Revendeurs', 'Boutiques de village', '8 000', 'Clients éloignés']] },
      { id: 'b5', kind: 'steps', items: [{ title: 'Premier contact', body: 'Démonstration au marché hebdomadaire.' }, { title: 'Premier achat', body: 'L’exploitant achète ses intrants et repart avec un reçu.' }, { title: 'Première vente', body: 'Il dépose sa récolte et il est payé sous 24 h.' }, { title: 'Usage régulier', body: 'Deux saisons d’historique ouvrent le microcrédit.' }] },
    ],
  },
  {
    id: 'financial-plan', role: 'data', title: 'Trois années d’investissement avant l’équilibre', lede: 'Le réseau doit atteindre sa densité avant que la marge couvre les coûts fixes.',
    blocks: [
      { id: 'b1', kind: 'metrics', items: [{ value: '7 M XAF', label: 'Chiffre d’affaires 2026' }, { value: '−84 M XAF', label: 'Résultat net 2026' }, { value: '50 M XAF', label: 'Coût total du projet' }, { value: '20 M XAF', label: 'Besoin de financement' }] },
      prose('b2', 'Modèle de revenus', 3, 4),
      { id: 'b3', kind: 'chart', chartType: 'line', title: 'Chiffre d’affaires et résultat net', labels: ['2026', '2027', '2028'], series: [{ name: 'Chiffre d’affaires', data: [6650000, 31680000, 81750000] }, { name: 'Résultat net', data: [-83811333, -67285607, -33705608] }], readingKey: 'Le résultat se rapproche de l’équilibre à mesure que le réseau grandit.', unit: 'XAF' },
      { id: 'b4', kind: 'table', headers: ['Poste', '2026', '2027', '2028'], rows: [['Chiffre d’affaires', '6 650 000', '31 680 000', '81 750 000'], ['Charges variables', '−2 327 500', '−10 944 000', '−27 468 000'], ['Charges fixes', '−77 928 000', '−77 928 000', '−77 928 000'], ['Résultat net', '−83 811 333', '−67 285 607', '−33 705 608']], caption: 'Compte d’exploitation prévisionnel, en XAF.' },
      { id: 'b5', kind: 'assumption', statement: 'Une borne traite 70 transactions par mois après trois mois d’activité.', basis: 'Points de service comparables en zone rurale : 60 à 90 opérations par mois.' },
      { id: 'b6', kind: 'quote', text: 'Le plan est le prix à payer pour atteindre l’échelle.', attribution: 'Direction financière' },
    ],
  },
];

const textOf = (s: SectionContent): string[] => {
  const out: string[] = [];
  for (const b of s.blocks) if (b.kind === 'prose') out.push(...b.paragraphs.map((p) => p.slice(0, 60)));
  return out;
};
const letters = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Le document de l'aperçu, tel que l'éditeur partagé (paquet ESM) le construit : transpilé ici pour ce contrôle. */
function loadIframeBuilder(): typeof BuildIframeDocument {
  const ts = require('typescript') as typeof import('typescript');
  const file = resolve(__dirname, '../../../../packages/shared-document-editor/src/angular/runtime/editor-iframe.ts');
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
  return mod.exports.buildIframeDocument as typeof BuildIframeDocument;
}

async function pagesToPng(pdf: Uint8Array, prefix: string): Promise<void> {
  const { createCanvas } = require('canvas');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0, isEvalSupported: false, useSystemFonts: true }).promise;
  for (let i = 1; i <= document.numPages; i++) {
    const page = await document.getPage(i);
    const viewport = page.getViewport({ scale: 0.6 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport } as never).promise;
    writeFileSync(`${prefix}-p${String(i).padStart(2, '0')}.png`, canvas.toBuffer('image/png'));
  }
  await document.destroy();
}

async function main(): Promise<void> {
  if (shots) mkdirSync(shots, { recursive: true });
  const cat = await catalog();
  const gabarits = [...cat.nodes.values()].filter((n) => n.kind === 'gabarit' && (n as { elements: string[] }).elements.includes('business-plan') && !(n as { roles: string[] }).roles.every((r) => r === 'cover')).map((n) => n.id);
  await PdfService.initialize();
  for (const gid of gabarits) {
    if (only && gid !== only) continue;
    console.log(`\n${gid}`);
    const disabled = gabarits.filter((g) => g !== gid);
    configureGraphicEngine({ catalogOverrides: async () => ({ disabled }) });
    resetCatalog();
    const { brand, direction } = brandFromIdem({ name: 'AgriLink', branding: { colors: { colors: { primary: '#1b7a7a', secondary: '#e3b45a', accent: '#e3b45a', background: '#f2f7f6', text: '#163332' } }, typography: { primaryFont: 'Fraunces', secondaryFont: 'Karla' }, artDirection: { styleId: 'editorial' } } as never, logos: { primary: LOGO, withTextLight: LOGO } } as never);
    const doc = await createDocument({ documentType: 'business-plan', format: 'a4-portrait', brand, direction, seed: `bp-${gid}`, sections: SECTIONS.map((s) => ({ id: s.id, role: s.role })), documentLabel: 'Business plan', locale: 'fr', creativity: 'low' });
    const models: SectionModel[] = [];
    const picked: string[] = [];
    // Diagnostic : DROP=company-summary:ph,b1 retire des blocs d'une section (bissection d'un défaut d'impression).
    const drop = (process.env.DROP ?? '').split(',').filter(Boolean);
    const sectionsUsed = SECTIONS.map((s) => ({ ...s, blocks: s.blocks.filter((b) => !drop.includes(`${s.id}:${b.id}`)) }));
    for (const [i, s] of sectionsUsed.entries()) {
      const out = await doc.composeSection(s, { index: i + 1, total: SECTIONS.length });
      picked.push(out.spec.catalog?.config.gabarit ?? out.spec.catalog?.config.layout ?? '?');
      models.push({ name: s.id, data: sectionHtml(out) } as unknown as SectionModel);
    }
    let report: FlowPaginationReport | null = null;
    const printOnce = () => new PdfService().generatePdf({ title: 'Business Plan', projectName: 'AgriLink', sections: models, sectionDisplayOrder: models.map((m) => m.name), footerText: '', multiPage: true, pagination: { ...BUSINESS_PLAN_PAGINATION, debug: process.env.PAGINATION_DEBUG === '1' }, qualityGate: false, onPaginationReport: (r: FlowPaginationReport) => (report = r) } as never);
    // Plusieurs impressions d'affilée dans un même processus : un délai de montage du document est repris une fois
    // (ce contrôle juge la mise en page, pas la charge de la machine).
    const file = await printOnce().catch((error: Error) => (/timeout/i.test(String(error?.message)) ? printOnce() : Promise.reject(error)));
    const bytes = new Uint8Array(readFileSync(file));
    const ink = (await measurePdfPages(bytes)) ?? [];
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const d = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
    let text = '';
    for (let i = 1; i <= d.numPages; i++) text += (await (await d.getPage(i)).getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join('');
    await d.destroy();
    const r = report as FlowPaginationReport | null;
    if (process.env.PAGINATION_DEBUG === '1' && r) { for (const sec of r.sections) console.log(`    ${sec.name}: ${sec.pages} p, remplissage ${sec.fills.map((f) => Math.round(f * 100)).join('/')} %, coupes ${sec.splits}, repoussés ${sec.repaired}${sec.continued ? ', suite de la précédente' : ''}`); for (const w of r.warnings.slice(0, 60)) console.log(`      ${w.slice(0, 220)}`); }
    const scaled = r ? r.sections.reduce((n, s) => n + s.scaled, 0) : -1;
    // La fin du document (dernière page de contenu, page de clôture) peut être courte : comme `check:bpquality`.
    const blank = ink.filter((p) => p.page < ink.length - 1 && p.inkedRows < 0.12).map((p) => p.page);
    const missing = SECTIONS.flatMap(textOf).filter((t) => !letters(text).includes(letters(t)));
    console.log(`  gabarits servis : ${picked.join(' · ')} — ${ink.length} pages`);
    ok('aucune page presque vide au milieu', !blank.length, blank.length ? `pages ${blank.join(', ')}` : '');
    ok('aucun bloc réduit faute de coupe', scaled === 0, `${scaled} bloc(s) réduit(s)`);
    const repaired = r ? r.sections.reduce((n, sec) => n + sec.repaired, 0) : -1;
    // Un bloc repoussé par le filet de sécurité du paginateur = une page qui déborde de ce qu'il avait prévu : un trou
    // à la page d'avant, une page insérée à moitié vide.
    ok('aucun bloc repoussé (mesure et page construite identiques)', repaired === 0, `${repaired} bloc(s) repoussé(s)`);
    const thin = r ? r.sections.filter((sec) => !sec.fixed).flatMap((sec) => sec.fills.slice(0, -1).map((f, i) => ({ f, at: `${sec.name} p.${i + 1}` }))).filter((x) => x.f < 0.6) : [];
    ok('aucune page de section remplie à moins de 60 % (sauf la dernière)', !thin.length, thin.map((x) => `${x.at} ${Math.round(x.f * 100)} %`).join(', '));
    // Les pages composées par le moteur : aucune grande bande blanche, sauf sur la dernière page d'une section.
    if (r) {
      let at = 0;
      const holes: string[] = [];
      for (const sec of r.sections) {
        for (let k = 0; k < sec.pages; k++) {
          const pg = ink[at + k];
          if (pg && k < sec.pages - 1 && pg.largestBlank > 0.4) holes.push(`${sec.name} p.${k + 1} (${Math.round(pg.largestBlank * 100)} % de blanc)`);
        }
        at += sec.pages;
      }
      ok('aucune page avec plus de 40 % de blanc (sauf la dernière d’une section)', !holes.length, holes.join(', '));
    }
    ok('tout le texte du contenu est imprimé', !missing.length, missing.slice(0, 2).join(' | '));
    // L'APERÇU du tableau de bord (même document que l'iframe de l'éditeur) : les mêmes pages, ni plus ni moins, aucune
    // ne déborde de sa feuille.
    if (r) {
      const html = loadIframeBuilder()(models.map((m) => ({ id: m.name, name: m.name, type: 'html', html: (m as unknown as { data: string }).data })), { dark: false }, { width: '210mm', height: '297mm' }, true, false, 'preview');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 900, height: 1200 });
        await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const preview = await page.evaluate(() => [...document.querySelectorAll('.idem-section')].map((sec) => {
          const sheets = [...sec.querySelectorAll(':scope > [data-ge-page]')] as HTMLElement[];
          return { paged: sheets.length > 0, pages: sheets.length || 1, overflow: sheets.filter((p) => p.scrollHeight > p.clientHeight + 2).length };
        }));
        const pdfPerSection = r.sections.map((sec) => sec.pages);
        const previewPerSection = preview.map((p) => p.pages);
        ok('l’aperçu montre les mêmes pages que le PDF', JSON.stringify(previewPerSection) === JSON.stringify(pdfPerSection), `aperçu ${previewPerSection.join('/')} · PDF ${pdfPerSection.join('/')}`);
        const over = preview.reduce((n, p) => n + p.overflow, 0);
        ok('aucune page de l’aperçu ne déborde de sa feuille', over === 0, `${over} page(s)`);
        if (shots) writeFileSync(resolve(shots, `${gid}-preview.png`), await page.screenshot({ fullPage: true, type: 'png' }));
      } finally {
        await browser.close();
      }
    }
    if (shots) await pagesToPng(bytes, resolve(shots, gid));
  }
  await PdfService.closeBrowser();
  await closeBrowser();
}

main()
  .catch((e) => {
    failures++;
    console.error(e);
  })
  .finally(() => {
    console.log(`\n${failures ? `✗ ${failures} échec(s)` : '✓ business plan du catalogue : impression conforme'}`);
    process.exit(failures ? 1 : 0);
  });
