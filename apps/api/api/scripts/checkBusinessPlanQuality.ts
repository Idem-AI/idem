/**
 * Contrôle QUALITÉ du business plan imprimé — `npm run check:bpquality`.
 *
 * Reproduit, avec le vrai gabarit et le vrai Chrome, les défauts relevés le
 * 13 septembre 2026 sur des plans livrés :
 *
 *  1. PAGE VIDE — le pied de section (logo, titre courant) seul sur sa page,
 *     93 % de blanc ;
 *  2. FIN DE SECTION CREUSE — quelques lignes, puis 64 à 77 % de blanc, et la
 *     section suivante sur une page neuve.
 *
 * Les deux défauts dépendent de la quantité exacte de texte : le harnais
 * CHERCHE d'abord, dans Chrome et contrôle éteint, les volumes qui les
 * produisent. Le même plan est ensuite imprimé deux fois par le vrai
 * `PdfService` — contrôle éteint, pour prouver que les défauts sont bien
 * reproduits, puis avec les réglages du business plan. Sur ce second PDF :
 *
 *  · aucune page (hors signature) sans contenu lisible ;
 *  · aucune page de flux sous 35 % de remplissage, hors fin de document ;
 *  · aucune bande blanche d'au moins 35 % de la page, mesurée sur le PDF
 *    imprimé, hors fin de document ;
 *  · AUCUN MOT PERDU : chaque phrase du contenu se retrouve dans le PDF ;
 *  · le PDF compte autant de pages que le paginateur en a composé.
 *
 * Audit d'un PDF existant, sans rien réimprimer :
 *
 *   npx ts-node --transpile-only api/scripts/checkBusinessPlanQuality.ts --pdf a.pdf b.pdf
 */

import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

import puppeteer, { Browser } from 'puppeteer';

import { SectionModel } from '../models/section.model';
import { BUSINESS_PLAN_PAGINATION } from '../services/BusinessPlan/businessPlanPdf.options';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { buildDocumentSeed, buildSectionSeed } from '../services/design/designSeed';
import { SectionContent } from '../services/design/sectionContent';
import { renderSection } from '../services/design/sectionRenderer';
import { PdfService } from '../services/pdf.service';
import { FLOW_PAGINATION_RUNTIME, FlowPaginationReport } from '../services/pdf/flow-pagination.runtime';
import {
  HOLE_MIN,
  measurePdfPages,
  PdfPageInk,
  PdfQualityGateReport,
} from '../services/pdf/pdfQualityGate';

/** Rangées encrées sous lesquelles une page (hors signature) n'a rien à lire. */
const NEAR_BLANK_ROWS = 0.05;

/** Remplissage minimal d'une page de flux qui ne termine pas le document. */
const MIN_FILL = 0.35;

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Contenu d'épreuve
// ---------------------------------------------------------------------------

const STYLE = 'editorial';
const DOC_KEY = 'bpquality:fixture';
const BRAND = 'Café des Hauts';
const LOGO = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><rect x="4" y="8" width="40" height="44" fill="#1F4E5F"/><text x="56" y="42" font-family="sans-serif" font-size="30" font-weight="700" fill="#1F4E5F">Hauts</text></svg>'
).toString('base64')}`;

const CHARTER = {
  colors: {
    colors: {
      primary: '#1F4E5F',
      secondary: '#4A5A60',
      accent: '#C6553D',
      background: '#FAF7F2',
      text: '#0F1B1F',
    },
  },
  typography: { primaryFont: 'Fraunces', secondaryFont: 'Public Sans' },
};

const POOL = [
  "Douala et Yaoundé concentrent l'essentiel de la consommation urbaine de café torréfié, pour une part minoritaire de la population.",
  "Trois torréfacteurs opèrent à l'échelle industrielle, aucun sur le segment de spécialité.",
  'Le prix moyen au kilo a doublé en quatre ans sur le circuit des cafés urbains, sans que la part revenant au producteur ne progresse.',
  "C'est cet écart que le projet vient prendre, en achetant directement aux coopératives de l'Ouest et en torréfiant à Douala.",
  'Les cafés urbains importent encore la moitié de leurs grains torréfiés.',
  "Une torréfaction locale réduit le délai entre récolte et tasse de plusieurs mois à quelques semaines, ce que les établissements de spécialité mettent en avant.",
  "Les trois premiers clients pressentis ont confirmé par écrit leur intention d'achat pour la première année.",
  "L'engagement reste soumis à la validation d'un profil de torréfaction à la dégustation.",
  "L'unité pilote traite deux cents kilogrammes par jour, à quarante kilomètres des coopératives partenaires.",
  'Chaque paquet porte le lot, la parcelle et la date de récolte.',
  "Le fonds de roulement couvre quatre mois d'achats de café vert, au rythme de la récolte principale.",
  "La saisonnalité des achats impose un stock tampon constitué entre novembre et février.",
  "La marge brute visée tient compte d'une perte au séchage de dix-huit pour cent.",
  "Le circuit court supprime deux intermédiaires entre la coopérative et le point de vente.",
  "Les établissements partenaires s'engagent sur un volume minimal mensuel révisé chaque trimestre.",
  "Un torréfacteur formé à Addis-Abeba encadre la production et la formation de deux assistants.",
  "Le local de Bonapriso sert à la fois d'atelier, de salle de dégustation et de point de retrait.",
  "La première année, le chiffre d'affaires repose à soixante pour cent sur les ventes aux cafés.",
  "La vente directe aux particuliers démarre au deuxième semestre, par abonnement mensuel.",
  "Le prix de l'abonnement intègre la livraison dans les quartiers desservis à Douala.",
  "Le plan de trésorerie reste positif dès le quatorzième mois, sous les hypothèses de volume retenues.",
  "Un retard de trois mois sur la montée en charge décale ce point au dix-huitième mois.",
  "Les équipements sont amortis sur cinq ans selon le référentiel SYSCOHADA.",
  "Le besoin de financement couvre la torréfacteuse, le séchoir et le premier stock de café vert.",
  "La banque partenaire a demandé un apport personnel équivalent à vingt pour cent du besoin.",
  "Les coopératives de Bafoussam et de Dschang fournissent les premiers lots certifiés.",
  "Un contrôle qualité est réalisé à la réception de chaque lot, avant paiement.",
  "Le taux d'humidité admis à la réception est plafonné à douze pour cent.",
  "Les lots refusés sont retournés à la coopérative sans frais pour le projet.",
  "La marque vise d'abord les établissements qui revendiquent une origine camerounaise.",
  "La communication s'appuie sur des dégustations publiques organisées chaque mois.",
  "Les retours des dégustations orientent les profils de torréfaction proposés à la vente.",
  "Deux profils sont maintenus en permanence, un troisième change avec la saison.",
  "L'emballage est produit à Douala par un imprimeur partenaire, en lots de cinq mille.",
  "La valve de dégazage est importée, faute de fournisseur local à ce jour.",
  "Le risque de change sur cet achat est couvert par un stock de six mois.",
  "Le projet crée quatre emplois directs la première année et six la troisième.",
  "Les recrutements suivent la montée en volume, validée trimestre par trimestre.",
  "Une assurance couvre le stock et l'équipement contre l'incendie et le vol.",
  "Le suivi mensuel des ventes par établissement déclenche les ajustements de production.",
];

const LEDE = "La torréfaction locale capte pour la première fois la valeur qui partait à l'export.";

function prose(title: string, kicker: string, offset: number, sentences: number): SectionContent {
  const picked = Array.from({ length: sentences }, (_, index) => POOL[(offset + index) % POOL.length]);
  const paragraphs: string[] = [];
  for (let index = 0; index < picked.length; index += 3) {
    paragraphs.push(picked.slice(index, index + 3).join(' '));
  }
  return { kicker, title, lede: LEDE, blocks: [{ kind: 'prose', paragraphs }] };
}

/** Section chiffrée : les blocs insécables (tableau, cartes, graphique) du plan. */
const FINANCE: SectionContent = {
  kicker: 'Finances',
  title: 'Un besoin de financement couvert à quatorze mois',
  lede: 'Le plan de trésorerie reste positif sous les hypothèses de volume retenues.',
  blocks: [
    {
      kind: 'metrics',
      items: [
        { value: '48,5 M FCFA', label: 'besoin de financement', note: '2027' },
        { value: '14 mois', label: 'retour à une trésorerie positive', note: 'hypothèse centrale' },
        { value: '31 %', label: 'marge brute visée', note: 'année 2' },
      ],
    },
    {
      kind: 'prose',
      paragraphs: [POOL[20] + ' ' + POOL[21] + ' ' + POOL[22], POOL[23] + ' ' + POOL[24]],
    },
    {
      kind: 'table',
      headers: ['Poste', '2027', '2028', '2029'],
      rows: [
        ["Chiffre d'affaires", '62,0 M', '88,4 M', '117,9 M'],
        ['Achats de café vert', '24,8 M', '34,1 M', '44,3 M'],
        ['Charges de personnel', '14,4 M', '19,2 M', '21,6 M'],
        ["Résultat d'exploitation", '3,1 M', '11,7 M', '22,4 M'],
      ],
      caption: 'Montants en FCFA, exercices du 1er janvier au 31 décembre.',
    },
    {
      kind: 'cards',
      items: [
        { title: 'Torréfacteuse', body: 'Capacité de 15 kg par fournée, amortie sur cinq ans.' },
        { title: 'Séchoir', body: "Réduit la perte au séchage sous dix-huit pour cent." },
        { title: 'Stock de café vert', body: "Quatre mois d'achats, constitué à la récolte." },
      ],
    },
    {
      kind: 'chart',
      chartType: 'bar',
      labels: ['2027', '2028', '2029'],
      series: [{ name: "Chiffre d'affaires (M FCFA)", data: [62, 88.4, 117.9] }],
      unit: 'M FCFA',
      readingKey: "Le chiffre d'affaires double en trois exercices.",
    },
    {
      kind: 'assumption',
      statement: 'Une conversion de 12 % des clients des cafés urbains vers le paquet à emporter.',
      basis: 'Pilote de trois mois à Bonapriso.',
    },
  ],
};

const designSystem = buildDocumentDesignSystem(
  CHARTER,
  { styleId: STYLE } as never,
  buildDocumentSeed(STYLE, DOC_KEY)
);

interface Planned {
  name: string;
  content: SectionContent;
}

/** Rend les sections dans l'ordre, graines tirées comme le service les tire. */
function renderAll(sections: Planned[]): SectionModel[] {
  const used = new Set<string>();
  return sections.map(
    (section, index) =>
      ({
        name: section.name,
        data: renderSection(section.content, designSystem, buildSectionSeed(STYLE, DOC_KEY, section.name, used), {
          logoUrl: LOGO,
          brandName: BRAND,
          index: index + 1,
        }),
      }) as unknown as SectionModel
  );
}

/** Phrases d'un contenu, réduites à leurs lettres. */
function sentencesOf(content: SectionContent): string[] {
  const out: string[] = [];
  for (const block of content.blocks) {
    if (block.kind !== 'prose') continue;
    for (const paragraph of block.paragraphs) {
      for (const sentence of POOL) if (paragraph.includes(sentence)) out.push(letters(sentence));
    }
  }
  return out;
}

function letters(text: string): string {
  let out = '';
  for (const char of text.toLowerCase()) {
    if (char.toUpperCase() !== char.toLowerCase()) out += char;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Recherche des volumes qui produisent les défauts
// ---------------------------------------------------------------------------

interface Shape {
  sentences: number;
  pages: number;
  lastFill: number;
  folioOnly: boolean;
}

/**
 * Pagine, contrôle ÉTEINT, une section candidate par volume de texte, dans la
 * structure HTML exacte du PDF (même générateur que `PdfService`).
 */
async function shapes(
  browser: Browser,
  prefix: string[],
  name: string,
  build: (sentences: number) => SectionContent,
  volumes: number[]
): Promise<Shape[]> {
  const sections = volumes.map((sentences) => {
    const rendered = renderAll([
      ...prefix.map((prior) => ({ name: prior, content: build(1) })),
      { name, content: build(sentences) },
    ]);
    return { ...rendered[rendered.length - 1], name: `cand-${sentences}` } as SectionModel;
  });

  const generator = new PdfService() as unknown as {
    generateOptimizedHtmlFromSections(options: object): string;
  };
  const html = generator.generateOptimizedHtmlFromSections({
    title: 'Recherche',
    projectName: BRAND,
    sections,
    footerText: '',
    multiPage: true,
  });

  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.addScriptTag({ content: FLOW_PAGINATION_RUNTIME });
    await page.evaluate((cfg) => (window as any).__idemFlow.prepare(cfg), {
      tailwindTimeout: 50,
      imageTimeout: 4000,
      chartTimeout: 50,
    });
    const report = (await page.evaluate((cfg) => (window as any).__idemFlow.paginate(cfg), {
      pageWidthMm: 210,
      pageHeightMm: 297,
      ...BUSINESS_PLAN_PAGINATION,
      compact: undefined,
    })) as FlowPaginationReport;

    const folioOnly = (await page.evaluate(() => {
      const out: Record<string, boolean> = {};
      for (const el of Array.from(document.querySelectorAll('.idem-page[data-idem-kind="flow"]'))) {
        const host = el.firstElementChild;
        if (!host) continue;
        const kids = Array.from(host.children).filter((kid) => {
          const style = getComputedStyle(kid);
          return style.position !== 'absolute' && style.display !== 'none';
        });
        out[el.getAttribute('data-section-name') || ''] =
          kids.length > 0 && kids.every((kid) => kid.hasAttribute('data-idem-folio'));
      }
      return out;
    })) as Record<string, boolean>;

    return volumes.map((sentences) => {
      const entry = report.sections.find((section) => section.name === `cand-${sentences}`);
      return {
        sentences,
        pages: entry?.pages ?? 0,
        lastFill: entry?.fills[entry.fills.length - 1] ?? 1,
        folioOnly: folioOnly[`cand-${sentences}`] ?? false,
      };
    });
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Impression par le vrai PdfService
// ---------------------------------------------------------------------------

interface Printed {
  file: string;
  report: FlowPaginationReport;
  gate: PdfQualityGateReport | null;
  pages: PdfPageInk[];
  text: string;
}

async function print(label: string, sections: SectionModel[], compact: boolean, outDir: string): Promise<Printed> {
  let report: FlowPaginationReport | null = null;
  let gate: PdfQualityGateReport | null = null;
  const file = await new PdfService().generatePdf({
    title: 'Business Plan',
    projectName: BRAND,
    sections,
    sectionDisplayOrder: sections.map((section) => section.name),
    footerText: 'Generated by Idem',
    multiPage: true,
    pagination: compact ? BUSINESS_PLAN_PAGINATION : { ...BUSINESS_PLAN_PAGINATION, compact: undefined },
    qualityGate: compact,
    onPaginationReport: (value) => {
      report = value;
    },
    onQualityReport: (value) => {
      gate = value;
    },
  });
  const kept = resolve(outDir, `${label}.pdf`);
  copyFileSync(file, kept);

  const bytes = new Uint8Array(readFileSync(kept));
  const pages = (await measurePdfPages(bytes)) ?? [];
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  let text = '';
  for (let index = 1; index <= document.numPages; index++) {
    const content = await (await document.getPage(index)).getTextContent();
    text += content.items.map((item) => ('str' in item ? item.str : '')).join('');
  }
  await document.destroy();

  if (!report) throw new Error(`${label} : aucun rapport de pagination reçu`);
  return { file: kept, report, gate, pages, text: letters(text) };
}

function describe(label: string, printed: Printed): void {
  console.log(`\n  ${label} — ${printed.pages.length} pages · ${printed.file}`);
  for (const section of printed.report.sections) {
    const flags = [
      section.continued ? 'commence sur la page précédente' : '',
      section.pulledBack ? 'écarts resserrés' : '',
      section.droppedFolio ? 'pied de section retiré' : '',
      section.fitted ? `${section.fitted} bloc(s) ajusté(s)` : '',
    ].filter(Boolean);
    console.log(
      `    ${section.name.padEnd(18)} ${String(section.pages).padStart(2)} p.  ` +
        `${section.fills.map((fill) => `${Math.round(fill * 100)} %`).join(' · ')}` +
        (flags.length ? `  (${flags.join(', ')})` : '')
    );
  }
}

/** Pages sans contenu lisible, signature (dernière page) exclue. */
function nearBlank(pages: PdfPageInk[]): number[] {
  return pages.filter((page) => page.page < pages.length && page.inkedRows < NEAR_BLANK_ROWS).map((page) => page.page);
}

/** Pages de flux sous le remplissage minimal, dernière page du document exclue. */
function underfilled(report: FlowPaginationReport): string[] {
  const flow = report.sections.filter((section) => !section.fixed);
  const entries = flow.flatMap((section) =>
    section.fills.map((fill, index) => ({ label: `${section.name} p.${index + 1}`, fill }))
  );
  return entries
    .slice(0, -1)
    .filter((entry) => entry.fill < MIN_FILL)
    .map((entry) => `${entry.label} à ${Math.round(entry.fill * 100)} %`);
}

// ---------------------------------------------------------------------------
// Contrôle
// ---------------------------------------------------------------------------

async function checkFixture(): Promise<void> {
  const outDir = resolve(process.cwd(), 'tmp', 'bp-quality');
  mkdirSync(outDir, { recursive: true });
  console.log('\nBUSINESS PLAN — pages vides et grands blancs\n');

  const volumes = Array.from({ length: 60 }, (_, index) => index + 6);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  let orphan: Shape | undefined;
  let tail: Shape | undefined;
  try {
    const summary = await shapes(browser, [], 'Company Summary', (n) => prose("Une torréfaction de spécialité à Douala", 'Projet', 0, n), volumes);
    orphan = summary.find((shape) => shape.pages >= 2 && shape.folioOnly);
    const market = await shapes(browser, ['Company Summary'], 'Market Analysis', (n) => prose('Le café de spécialité arrive au Cameroun', 'Marché', 13, n), volumes);
    tail = market.find((shape) => shape.pages >= 2 && !shape.folioOnly && shape.lastFill < 0.3);
  } finally {
    await browser.close();
  }

  check(
    'Le harnais trouve un volume qui laisse le pied de section seul sur sa page',
    Boolean(orphan),
    'aucun volume de 6 à 65 phrases ne le reproduit — le gabarit a changé, le harnais doit suivre'
  );
  check(
    'Le harnais trouve un volume qui laisse une fin de section sous 30 %',
    Boolean(tail),
    'aucun volume de 6 à 65 phrases ne le reproduit'
  );
  if (!orphan || !tail) return;
  console.log(`  (pied orphelin à ${orphan.sentences} phrases, fin creuse à ${tail.sentences} phrases à ${Math.round(tail.lastFill * 100)} %)`);

  const plan: Planned[] = [
    { name: 'Company Summary', content: prose('Une torréfaction de spécialité à Douala', 'Projet', 0, orphan.sentences) },
    { name: 'Market Analysis', content: prose('Le café de spécialité arrive au Cameroun', 'Marché', 13, tail.sentences) },
    { name: 'Financial Plan', content: FINANCE },
    { name: 'Ressources', content: prose('Ce que le projet mobilise déjà', 'Ressources', 27, 5) },
  ];
  const sections = renderAll(plan);

  await PdfService.initialize();
  try {
    const before = await print('controle-eteint', sections, false, outDir);
    const after = await print('controle-actif', sections, true, outDir);
    describe('Contrôle éteint', before);
    describe('Contrôle actif', after);
    console.log('');

    check(
      'Contrôle éteint : le défaut « page vide » est bien reproduit',
      nearBlank(before.pages).length > 0,
      'aucune page vide dans le PDF de référence'
    );
    check(
      'Contrôle éteint : le défaut « fin de section creuse » est bien reproduit',
      underfilled(before.report).length > 0,
      'aucune page sous 35 % dans le PDF de référence'
    );

    check(
      'Aucune page sans contenu lisible (signature exclue)',
      nearBlank(after.pages).length === 0,
      `page(s) ${nearBlank(after.pages).join(', ')}`
    );
    check(
      `Aucune page de flux sous ${Math.round(MIN_FILL * 100)} % hors fin de document`,
      underfilled(after.report).length === 0,
      underfilled(after.report).join(', ')
    );
    check(
      'Le PDF a moins de pages que le PDF de référence',
      after.pages.length < before.pages.length,
      `${after.pages.length} contre ${before.pages.length}`
    );

    const lost = plan.flatMap((section) => sentencesOf(section.content)).filter((sentence) => !after.text.includes(sentence));
    check('Aucune phrase perdue', lost.length === 0, `${lost.length} phrase(s) absente(s) du PDF`);

    check('Le PDF imprimé a été mesuré', after.gate?.measured === true, after.gate?.skipped ?? 'aucun rapport');
    check(
      'Chrome a imprimé exactement les pages composées',
      after.gate?.pageCountMismatch === false,
      `${after.gate?.pagesBefore} imprimée(s)`
    );
    const holes = after.gate?.holes ?? [];
    check(
      `Aucune bande blanche ≥ ${Math.round(HOLE_MIN * 100)} % hors fin de document`,
      holes.length === 0,
      holes.map((hole) => `p.${hole.page} « ${hole.section} » ${Math.round(hole.blank * 100)} %`).join(' · ')
    );
  } finally {
    await PdfService.closeBrowser();
  }
}

/** Audit d'un PDF déjà produit : pages sans contenu, trous. */
async function auditFiles(files: string[]): Promise<void> {
  console.log('\nAUDIT DE PDF — pages vides et grands blancs\n');
  for (const file of files) {
    const pages = await measurePdfPages(new Uint8Array(readFileSync(file)));
    if (!pages) {
      check(file, false, 'module canvas indisponible : mesure impossible');
      continue;
    }
    const blank = nearBlank(pages);
    const holes = pages.filter((page) => page.page < pages.length - 1 && page.largestBlank >= HOLE_MIN);
    check(`${file} (${pages.length} pages) sans page vide`, blank.length === 0, `page(s) ${blank.join(', ')}`);
    if (holes.length) {
      console.log(
        `      trous ≥ ${Math.round(HOLE_MIN * 100)} % : ` +
          holes.map((page) => `p.${page.page} ${Math.round(page.largestBlank * 100)} %`).join(' · ')
      );
    }
  }
}

const pdfFlag = process.argv.indexOf('--pdf');
const run = pdfFlag >= 0 ? auditFiles(process.argv.slice(pdfFlag + 1)) : checkFixture();

run
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} contrôle(s) en échec.\n`);
      process.exit(1);
    }
    console.log('\nContrôle terminé.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
