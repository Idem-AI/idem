/**
 * CONTRÔLE DU MOTEUR GRAPHIQUE — `npm run check --prefix packages/graphic-engine` (`--fast` : sans Chromium).
 *
 *  §1 contrats ; §2 normalisation d'une sortie de petit modèle ; §3 jetons de la marque ;
 *  §4 la matière à plat (clés exactes, primitives, gabarit de carte) ;
 *  §5 assainissement (Tailwind seul : CSS natif, scripts, adresses étrangères retirés) ;
 *  §6 Tailwind compilé côté serveur (thème de la marque, portée `.ge-page`, px) ;
 *  §7 primitives : les graphiques, le tableau exact ; défauts relevés sur des documents réels ;
 *  §8 le flux complet SANS MODÈLE (catalogue, cran Low : le code choisit) : pages affichées, rejeu, carte ;
 *  §9 export PowerPoint, chiffres montrés, médias.
 *
 * Aucun réseau, aucun modèle. Le catalogue a son propre contrôle de rendu (`npm run check:catalog`).
 */
import fs from 'fs';
import path from 'path';
import { validateContent, validateDesignSpec } from '../src/contracts/validate';
import { normalizeSection } from '../src/contracts/normalize';
import { isAuthoredSpec } from '../src/contracts/design-spec';
import type { ChartType, SectionContent } from '../src/contracts/content-model';
import { buildTokens } from '../src/design-system/tokens';
import { FORMATS } from '../src/design-system/formats';
import { contrastRatio, isDeep } from '../src/foundation/color';
import { buildContentMap } from '../src/runtime/content-map';
import { expandPage, sanitizeHtml } from '../src/runtime/expand';
import { compileTailwind } from '../src/runtime/tailwind';
import { chartHtml, tableHtml } from '../src/runtime/primitives';
import { closeBrowser } from '../src/runtime/browser';
import { QUALITY } from '../src/runtime/check';
import { configureGraphicEngine } from '../src/host';
import { cardFaces } from '../src/adapters/sections';
import { createDocument, renderSingle } from '../src/engine';
import { applyTextEdits } from '../src/runtime/content-map';
import { exportPptx } from '../src/export/pptx';
import { sectionHtml } from '../src/adapters/sections';
import { BRANDS, CARD_BACK, CARD_FRONT, FINANCE_BP, MARKET } from './fixtures';
import { chartFromTable, parseFigure, withDataChart } from '../src/content/data-charts';
import { coverContent, sectionFromModel } from '../src/adapters/sections';
import { planAssets, resolveAssets } from '../src/asset-planner';

process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_QUALITY_MEMORY = '0';
// Le catalogue local (dépôt idem-templates voisin), comme `check:catalog`.
process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../idem-templates');
const fast = process.argv.includes('--fast');
let failures = 0;
let passed = 0;
const ok = (label: string, cond: boolean, detail = ''): void => {
  if (cond) passed += 1;
  else failures += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const section = (title: string) => console.log(`\n${title}`);
const EX = path.resolve(__dirname, '../contracts/examples');
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(EX, rel), 'utf8'));

// Aucun modèle branché : au cran Low, le code choisit seul dans le catalogue (0 jeton).
const modelCalls: string[] = [];
configureGraphicEngine({ agentCall: () => async ({ role }) => (modelCalls.push(role), '') });

async function main(): Promise<void> {
  // ── §1 Contrats ──────────────────────────────────────────────────────────────────────────
  section('§1 Contrats (ContentModel, DesignSpec v2)');
  const validContent = validateContent(readJson('valid/content-pitch-deck.json'));
  ok(
    'exemple de ContentModel valide accepté',
    validContent.ok,
    validContent.issues.map((i) => i.message).join(' ')
  );
  const expectations = readJson('expectations.json') as Record<
    string,
    { contract: string; codes: string[] }
  >;
  for (const [file, exp] of Object.entries(expectations)) {
    if (file.startsWith('$')) continue;
    const report = validateContent(readJson(file));
    const codes = report.issues.map((i) => i.code);
    ok(
      `${file} refusé (${exp.codes.join(', ')})`,
      !report.ok && exp.codes.every((c) => codes.includes(c)),
      `obtenu : ${codes.join(', ') || 'accepté'}`
    );
  }
  const spec = {
    version: 2,
    ref: 'market',
    pattern: { id: 'authored' },
    html: '<div class="p-[8px]">{{title}}</div>',
    level: 'high',
  };
  ok(
    'une page gardée (v2) se valide et se reconnaît',
    isAuthoredSpec(spec) &&
      validateDesignSpec({
        version: 2,
        documentType: 'pitch-deck',
        format: 'slide-16x9',
        creativity: 'high',
        tokensHash: 'x',
        seed: 's',
        engine: { version: '2', components: '2' },
        sections: [spec],
      }).ok
  );
  ok(
    'un plan de l’ancien moteur (arbre v1) n’est pas une page gardée',
    !isAuthoredSpec({ ref: 'x', pattern: { id: 'slide.split' }, root: { t: 'stack' } })
  );
  const stale = ['content-model', 'design-spec', 'render-result'].filter(
    (n) => !fs.existsSync(path.resolve(__dirname, `../contracts/${n}.schema.json`))
  );
  ok('schémas JSON présents (npm run schemas)', stale.length === 0, stale.join(', '));

  // ── §2 Normalisation ─────────────────────────────────────────────────────────────────────
  section('§2 Normalisation d’une sortie de petit modèle');
  const messy = normalizeSection(readJson('model-outputs/messy-section.json'), { id: 'market' });
  const kinds = messy.section?.blocks.map((b) => b.kind) ?? [];
  ok('la section survit à une sortie sale', Boolean(messy.section));
  ok('alias « kpi » lu comme chiffres-clés', kinds[0] === 'metrics');
  const tbl = messy.section?.blocks.find((b) => b.kind === 'table') as
    | { rows: string[][] }
    | undefined;
  ok(
    'lignes de tableau recalibrées sur l’en-tête',
    Boolean(tbl) && tbl!.rows.every((r) => r.length === 3)
  );

  // ── §3 Jetons ────────────────────────────────────────────────────────────────────────────
  section('§3 Jetons de la marque');
  const night = {
    name: 'Nuit',
    palette: {
      primary: '#0B1020',
      secondary: '#1F2A44',
      accent: '#F2C14E',
      background: '#0E1424',
      text: '#E8E8E8',
    },
  };
  for (const brand of [BRANDS.kora, BRANDS.Makam, BRANDS.baobab, night]) {
    const t = buildTokens({ brand, format: 'slide-16x9' });
    ok(
      `${brand.name} : encre lisible sur le fond, encre lisible sur la marque`,
      contrastRatio(t.color.ink, t.color.ground) >= 7 &&
        contrastRatio(t.color.onBrand, t.color.primary) >= 4.5
    );
  }
  ok(
    'une charte à fond sombre ne donne pas un fond sombre sans autorisation',
    !isDeep(buildTokens({ brand: night, format: 'slide-16x9' }).color.ground)
  );

  // ── §4 La matière à plat ─────────────────────────────────────────────────────────────────
  section('§4 La matière à plat : chaque texte a sa clé, chiffres exacts');
  const map = buildContentMap(MARKET);
  ok(
    'titre, sur-titre, chapeau et chiffres-clés ont leur clé',
    ['title', 'kicker', 'lede', 'b1.items.0.value', 'b1.items.2.label'].every((k) =>
      map.entries.has(k)
    )
  );
  ok(
    'le graphique est une primitive (ses données ne passent pas par l’auteur)',
    map.primitives.has('b2') &&
      !map.listing.includes('1950') &&
      map.listing.includes('<idem-chart data-block="b2">')
  );
  const markers = buildContentMap(CARD_BACK, 'markers');
  ok(
    'carte en gabarit : les champs restent des marqueurs',
    markers.markers.has('fullName') && markers.entries.get('email')?.value === '{{email}}'
  );
  const recto = buildContentMap(CARD_FRONT, 'markers');
  ok(
    'carte : l’essentiel par face — le recto montre la marque (signature au plus), le verso la personne et ses coordonnées',
    [...recto.markers].join() === 'tagline' &&
      !markers.markers.has('tagline') &&
      !markers.markers.has('companyName')
  );
  const exp = expandPage(
    '<p class="x">{{title}}</p><p>{{fullName}}</p><a href="mailto:{{email}}">x</a><p>{{nope}}</p>',
    {
      ...markers,
      entries: new Map([
        ...markers.entries,
        ['title', { key: 'title', value: 'A & B <c>', kind: 'text' as const }],
      ]),
    },
    buildTokens({ brand: BRANDS.kora, format: 'card-landscape' }),
    FORMATS['card-landscape'],
    { sectionId: 'front', locale: 'fr', engine: 'x' }
  );
  ok(
    'texte échappé, marqueur dans un élément data-field, marqueur gardé dans un attribut, clé inconnue retirée',
    exp.html.includes('A &amp; B &lt;c&gt;') &&
      exp.html.includes('<span data-field="fullName">{{fullName}}</span>') &&
      exp.html.includes('mailto:{{email}}') &&
      exp.unknown.includes('nope')
  );
  ok(
    'la racine porte les cotes du support (85 × 55 mm)',
    /class="ge-page [^"]*w-\[85mm\] h-\[55mm\]/.test(exp.html)
  );

  // ── §5 Assainissement ────────────────────────────────────────────────────────────────────
  section('§5 Assainissement : Tailwind seul, rien qui s’exécute ni ne sort');
  const raw =
    'Voici la page :\n```html\n<div class="p-[10px]" style="color:red" onclick="x()"><style>p{}</style><script>alert(1)</script><img src="https://evil.example/a.png"><img src="{{b1.url}}"><a href="javascript:alert(1)">x</a><iframe src="x"></iframe></div>\n```';
  const clean = sanitizeHtml(raw.replace(/^[\s\S]*?```html\n|```[\s\S]*$/g, ''));
  ok('<style> et style="" retirés et comptés', clean.nativeCss === 2 && !/style/.test(clean.html));
  ok(
    'script, gestionnaire, cadre, adresses étrangères et javascript: retirés ; clé d’image gardée',
    !/script|onclick|iframe|evil|javascript/.test(clean.html) &&
      clean.html.includes('src="{{b1.url}}"')
  );

  // ── §6 Tailwind ──────────────────────────────────────────────────────────────────────────
  section('§6 Tailwind compilé côté serveur');
  const kora = buildTokens({ brand: BRANDS.kora, format: 'slide-16x9' });
  const css = await compileTailwind(
    '<div class="ge-page bg-brand-primary text-[42px] p-4 [&_th]:bg-brand-accent font-display bg-linear-to-br from-brand-primary to-brand-accent rotate-[-6deg] text-1.5rem"></div>',
    kora
  );
  ok(
    'couleurs et polices de la marque dans le thème, porté par .ge-page',
    css.includes('.ge-page {') &&
      css.toLowerCase().includes(`--color-brand-primary: ${kora.color.primary.toLowerCase()}`) &&
      css.includes('--font-display')
  );
  ok(
    'valeurs arbitraires, variantes et dégradés compilés',
    css.includes('.bg-brand-primary') &&
      css.includes('text-\\[42px\\]') &&
      css.includes('& th') &&
      css.includes('linear-gradient')
  );
  ok(
    'aucune unité rem (la taille racine de l’hôte ne change pas la page)',
    !/:\s*[^;{}]*\d+(\.\d+)?rem\b/.test(css)
  );
  ok(
    'la remise à zéro n’a aucun poids (toute classe passe devant)',
    /:where\(\.ge-page\)/.test(css) && !/^\.ge-page h1/m.test(css)
  );

  // ── §7 Primitives ────────────────────────────────────────────────────────────────────────
  section('§7 Primitives : graphiques et tableau exacts');
  const types: ChartType[] = [
    'bar',
    'groupedBar',
    'stacked',
    'horizontalBar',
    'line',
    'area',
    'pie',
    'doughnut',
    'radar',
  ];
  for (const chartType of types) {
    const multi = !['pie', 'doughnut'].includes(chartType);
    const svg = chartHtml(
      {
        id: 'c',
        kind: 'chart',
        chartType,
        labels: ['A', 'B', 'C', 'D'],
        series: multi
          ? [
              { name: 'S1', data: [12, 30, 22, 41] },
              { name: 'S2', data: [8, 14, 19, 25] },
            ]
          : [{ name: 'S', data: [40, 30, 20, 10] }],
        readingKey: 'x',
        unit: '%',
      },
      kora,
      { className: 'w-full' }
    );
    ok(
      `${chartType} : Chart.js seul (aucun SVG de repli), palette déclarée (recoloration de marque)`,
      svg.includes('<canvas data-idem-chart=') &&
        !svg.includes('<svg') &&
        /data-ge-palette="#[0-9a-f]{6}/i.test(svg) &&
        !/NaN|undefined/.test(svg)
    );
  }
  const base = {
    id: 'c',
    kind: 'chart' as const,
    chartType: 'bar' as const,
    labels: ['2024', '2025', '2026'],
    series: [{ name: 'CA', data: [10, 20, 35] }],
    readingKey: 'x',
  };
  ok(
    'l’auteur choisit une autre représentation des mêmes données (data-type)',
    chartHtml(base, kora, { type: 'line' }).includes('data-ge-chart="line"') &&
      chartHtml(base, kora, { type: 'doughnut' }).includes('data-ge-chart="doughnut"')
  );
  ok(
    'une représentation qui trahirait les données est refusée (deux séries en camembert)',
    chartHtml({ ...base, series: [...base.series, { name: 'B', data: [1, 2, 3] }] }, kora, {
      type: 'pie',
    }).includes('data-ge-chart="bar"')
  );
  const hi = chartHtml(base, kora, { highlight: '2026' });
  ok(
    'une catégorie mise en avant (data-highlight), les autres en retrait',
    (hi.match(/#[0-9a-f]{6}52&quot;/g) ?? []).length === 2
  );
  const table = FINANCE_BP.blocks.find((b) => b.kind === 'table');
  if (table && table.kind === 'table') {
    const t = tableHtml(table, { className: '[&_th]:bg-brand-primary' });
    ok(
      'tableau : chaque cellule exacte, colonnes chiffrées à droite, style de l’auteur sur la balise',
      table.rows.flat().every((c) => t.includes(c.replace(/&/g, '&amp;'))) &&
        t.includes('text-right') &&
        t.includes('[&amp;_th]:bg-brand-primary')
    );
  }

  section('§7 bis Retouche de mots par clé');
  const edited = applyTextEdits(FINANCE_BP, {
    title: 'Un résultat positif dès 2026',
    'b3.paragraphs.0': '',
    'b1.rows.0.1': '99',
  });
  ok(
    'titre et paragraphe retouchés par leur clé ; le tableau posé par le code reste intouchable',
    edited.section.title === 'Un résultat positif dès 2026' &&
      edited.applied.includes('b3.paragraphs.0') &&
      edited.refused.includes('b1.rows.0.1') &&
      JSON.stringify(edited.section.blocks.find((b) => b.id === 'b1')) ===
        JSON.stringify(FINANCE_BP.blocks.find((b) => b.id === 'b1'))
  );

  section('§7 ter Défauts relevés sur un deck réel (15/10/2026)');
  const real: SectionContent = {
    id: 'vision',
    title: 'LIGTH comble le vide entre motivation et action',
    blocks: [
      {
        id: 'asset-1',
        kind: 'figure',
        origin: 'system',
        url: 'data:image/png;base64,iVBORw0KGgo=',
        alt: 'Étudiante qui écrit',
      },
      {
        id: 'sys-1',
        kind: 'metrics',
        origin: 'system',
        items: [{ value: '350', label: 'Unités pour rentabilité' }],
      },
    ],
  };
  const realMap = buildContentMap(real);
  const realPage = expandPage(
    '<div><img src="{{asset-1.url}}" alt="{{asset-1.alt}}"><p>{{sys-1.items.0.value}}</p><img src="{{nope.url}}"></div>',
    realMap,
    kora,
    FORMATS['slide-16x9'],
    { sectionId: 'vision', locale: 'fr', engine: 'x' }
  );
  ok(
    'les clés à tiret (médias `asset-1`, blocs du code `sys-1`) sont remplies : photo et chiffre affichés, aucune clé en clair',
    realPage.html.includes('src="data:image/png') &&
      realPage.html.includes('>350<') &&
      !realPage.html.includes('{{')
  );
  ok(
    'une image sans adresse est retirée, jamais laissée cassée',
    (realPage.html.match(/<img/g) ?? []).length === 1
  );
  ok(
    'assainir garde l’adresse d’une image à clé à tiret',
    sanitizeHtml('<img src="{{asset-1.url}}">').html.includes('{{asset-1.url}}')
  );
  const { fixBrandNameTypos } = await import('../src/runtime/content-map');
  const typo = fixBrandNameTypos(real, 'Light');
  ok(
    'coquille du nom de marque (« LIGTH ») corrigée ; un mot seulement proche reste intact',
    typo.section.title.startsWith('LIGHT comble') &&
      typo.fixed === 1 &&
      fixBrandNameTypos({ ...real, title: 'Night shift' }, 'Light').fixed === 0
  );
  ok(
    'un graphique ne dépasse jamais sa place (hauteur plafonnée par son conteneur)',
    chartHtml(base, kora, {}).includes('max-h-full')
  );

  section('§7 quater Défauts relevés sur une charte réelle (15/10/2026)');
  const charter: SectionContent = {
    id: 'logos',
    title: 'Déclinaison sur fond sombre',
    blocks: [
      {
        id: 'sys-1',
        kind: 'logoDisplay',
        origin: 'system',
        variants: [
          {
            url: 'data:image/png;base64,iVBORw0KGgo=',
            label: 'Sur fond sombre',
            background: 'dark',
          },
        ],
      },
      {
        id: 'sys-2',
        kind: 'patternGrid',
        origin: 'system',
        patterns: [
          { name: 'Motif principal', motif: 'dots', ink: '#2d6a4f', ground: '#f9fbfb', tile: 103 },
        ],
      },
      {
        id: 'sys-3',
        kind: 'mockupShowcase',
        origin: 'system',
        items: [
          { url: 'data:image/png;base64,iVBORw0KGgo=', label: 'LinkedIn', ratio: 1 },
          { url: 'data:image/png;base64,iVBORw0KGgo=', label: 'Facebook', ratio: 1.9 },
        ],
      },
    ],
  };
  const cm = buildContentMap(charter);
  ok(
    'données techniques (fond, motif, tuile…) : des indications, jamais des clés à imprimer',
    !cm.entries.has('sys-1.variants.0.background') &&
      !cm.entries.has('sys-2.patterns.0.motif') &&
      !cm.entries.has('sys-2.patterns.0.tile') &&
      /background: dark/.test(cm.listing)
  );
  ok(
    'page de logo : le logo est désigné comme le sujet de la page, sans gabarit imposé',
    /the logo is the subject of this page/.test(cm.listing)
  );
  const urlText = expandPage(
    '<p>{{sys-1.variants.0.url}}</p><img src="{{sys-1.variants.0.url}}">',
    cm,
    kora,
    FORMATS['slide-16x9'],
    { sectionId: 'logos', locale: 'fr', engine: 'x' }
  );
  ok(
    'une adresse d’image ne s’imprime jamais comme texte',
    !/<p>data:/.test(urlText.html) && urlText.html.includes('src="data:image')
  );
  const gallery = expandPage(
    '<idem-gallery data-block="sys-3" class="h-[60%]"></idem-gallery>',
    cm,
    kora,
    FORMATS['slide-16x9'],
    { sectionId: 'logos', locale: 'fr', engine: 'x' }
  );
  ok(
    'mockups finis montrés entiers par le code (galerie), à leur proportion, avec leur nom',
    (gallery.html.match(/object-contain/g) ?? []).length === 2 &&
      gallery.html.includes('flex-[1.90_1_0%]') &&
      gallery.html.includes('>Facebook<')
  );
  const { patternHtml } = await import('../src/runtime/primitives');
  const kp = buildTokens({
    brand: { ...BRANDS.kora, patterns: [{ url: 'data:image/svg+xml;base64,PHN2Zy8+', tile: 40 }] },
    format: 'slide-16x9',
  });
  ok(
    'le motif reste discret : opacité plafonnée à 0,1 quoi que demande l’auteur',
    patternHtml(kp, 0, { className: 'absolute inset-0 opacity-60' }).includes('opacity-[0.1]') &&
      !patternHtml(kp, 0, { className: 'opacity-60' }).includes('opacity-60')
  );

  if (fast) return;

  // ── §8 Le flux complet ───────────────────────────────────────────────────────────────────
  section('§8 Le flux complet sans modèle (catalogue, cran Low)');
  if (fast) {
    console.log('  (--fast : Chromium sauté)');
    return;
  }
  const deck = await createDocument({
    documentType: 'pitch-deck',
    format: 'slide-16x9',
    brand: BRANDS.kora,
    direction: { styleId: 'swiss' },
    creativity: 'low',
    seed: 'check',
    sections: [{ id: 'market' }, { id: 'finance' }],
    png: true,
  });
  const [m, f] = await Promise.all([
    deck.composeSection(MARKET, { index: 1, total: 2 }),
    deck.composeSection({ ...FINANCE_BP, id: 'finance' }, { index: 2, total: 2 }),
  ]);
  ok('cran Low : aucun appel de modèle, le code choisit dans le catalogue', modelCalls.length === 0, modelCalls.join(', '));
  ok('pages assemblées depuis le catalogue (configuration gardée)', Boolean(m.spec.catalog?.config.layout && f.spec.catalog?.config.layout), `${m.spec.catalog?.config.gabarit ?? m.spec.catalog?.config.layout}`);
  ok(
    'pages affichées, photographiées, textes exacts, aucun constat bloquant',
    Boolean(m.png && f.png) &&
      m.result.html.includes('2,3 Md FCFA') &&
      [m, f].every((o) => !o.result.issues.some((i) => i.severity === 'blocking')),
    [m, f].flatMap((o) => o.result.issues.filter((i) => i.severity === 'blocking').map((i) => i.message)).join(' / ').slice(0, 300)
  );
  ok('le fragment porte sa feuille Tailwind', /<style data-ge-tailwind>/.test(m.result.head ?? ''));
  const replay = await deck.composeSection({ ...MARKET, title: 'Un marché de 3 milliards' }, { replay: m.spec });
  ok(
    'retouche de texte : la page est rejouée sans modèle, sa configuration du catalogue gardée',
    modelCalls.length === 0 && replay.result.html.includes('Un marché de 3 milliards') && replay.spec.html === m.spec.html && replay.spec.catalog?.config.layout === m.spec.catalog?.config.layout
  );
  const old = await deck.composeSection(MARKET, { replay: { ref: 'market', pattern: { id: 'slide.split' }, root: {} } as never });
  ok('une page de l’ancien moteur ne se rejoue pas : elle est recomposée depuis le catalogue', old.spec.version === 2 && Boolean(old.spec.catalog));
  ok('DesignSpec du document valide', validateDesignSpec(deck.designSpec()).ok && isAuthoredSpec(deck.designSpec().sections[0]));
  const card = await renderSingle({
    documentType: 'business-card',
    format: 'card-landscape',
    brand: BRANDS.Makam,
    seed: 'card',
    bindings: 'markers',
    content: cardFaces({ binding: 'markers' }).back,
  });
  ok('carte : gabarit à marqueurs (data-field)', /data-field="fullName"/.test(card.result.html) && card.result.html.includes('{{fullName}}'));

  section('§8 bis Export PowerPoint (le HTML reste la source)');
  const deckSlides = [
    { html: sectionHtml(m) },
    { html: `${sectionHtml(f)}\n<template data-speaker-notes>La marge atteint 60 %.</template>` },
  ];
  const fidelity = await exportPptx(deckSlides, { mode: 'fidelity', title: 'Kora' });
  const editable = await exportPptx(deckSlides, { mode: 'editable', title: 'Kora' });
  const zip = (b: Buffer) => b.subarray(0, 2).toString() === 'PK';
  ok(
    'fidèle : un fichier PowerPoint, une image par slide, aucun texte natif',
    zip(fidelity.buffer) && fidelity.slides === 2 && fidelity.textBoxes === 0
  );
  ok(
    'modifiable : les textes deviennent des zones natives (titres, cellules du tableau)',
    zip(editable.buffer) && editable.textBoxes >= 10
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip = require('jszip');
  const notesXml = async (b: Buffer) =>
    (await (await JSZip.loadAsync(b)).file('ppt/notesSlides/notesSlide2.xml')?.async('string')) ??
    '';
  ok(
    'les notes de l’orateur passent dans le fichier (deux modes)',
    (await notesXml(editable.buffer)).includes('La marge atteint 60') &&
      (await notesXml(fidelity.buffer)).includes('La marge atteint 60')
  );

  section('§9 bis Les chiffres montrés (business plan, deck)');
  const metricsRead = sectionFromModel({ title: 'Problème', blocks: [{ kind: 'metrics', items: [{ value: '60 %', label: 'Sans smartphone' }, { value: 'Échec', label: 'Solutions existantes' }] }] }, { id: 'pb' });
  const kept = metricsRead.section?.blocks.find((b) => b.kind === 'metrics');
  ok('un chiffre-clé sans chiffre (« Échec ») n’est pas montré comme un indicateur', Boolean(kept && kept.kind === 'metrics' && kept.items.length === 1 && kept.items[0].value === '60 %'));
  const yearly = chartFromTable({ id: 't1', kind: 'table', headers: ['Indicateur', '2026', '2027', '2028'], rows: [['Chiffre d’affaires (XAF)', '6 650 000', '31 680 000', '81 750 000'], ['Marge brute (%)', '65,0 %', '65,5 %', '66,4 %'], ['Résultat net (XAF)', '-83 811 333', '-67 285 607', '-33 705 608']] });
  ok(
    'tableau indicateurs × années → courbe des mêmes valeurs (mêmes unités seulement)',
    Boolean(yearly && yearly.chartType === 'line' && yearly.series.length === 2 && yearly.series[0].data.join() === '6650000,31680000,81750000' && yearly.series[1].name.startsWith('Résultat net') && /6 650 000 à 81 750 000/.test(yearly.readingKey.replace(/ | /g, ' '))),
    JSON.stringify(yearly?.series)
  );
  const segments = chartFromTable({ id: 't2', kind: 'table', headers: ['Segment', 'Exploitants', 'Disposition à payer'], rows: [['Vivriers', '1 200 000', 'Faible : < 1 000 XAF par transaction'], ['Maraîchers', '400 000', 'Moyenne'], ['Cultures de rente', '500 000', 'Élevée']] });
  ok('tableau catégories × mesure → barres ; une phrase qui contient un nombre n’est pas un chiffre', Boolean(segments && segments.series[0].name === 'Exploitants' && segments.series[0].data.join() === '1200000,400000,500000') && parseFigure('Faible : < 1 000 XAF par transaction') === null);
  const bp = withDataChart({ id: 'fin', title: 'Plan financier', blocks: [{ id: 'p', kind: 'prose', paragraphs: ['Analyse.'] }, { id: 't1', kind: 'table', headers: ['Indicateur', '2026', '2027'], rows: [['CA (XAF)', '6 650 000', '31 680 000']] }] });
  ok('une section de business plan sans graphique reçoit celui de son tableau, juste avant lui', bp.blocks.map((b) => b.kind).join() === 'prose,chart,table' && withDataChart(MARKET) === MARKET);
  const stock = await resolveAssets(
    [{ assetId: 'x.photo', role: 'photo', purpose: 'le produit', subject: 'a farmer at a kiosk', aspectRatio: 1.4, safeArea: 'none', sources: ['user', 'project', 'generated', 'stock'], fallback: 'skip', target: {} }],
    { stock: { resolve: async () => ({ url: 'https://stock/handshake.jpg', alt: 'x', provenance: { provider: 'stock' } }) } },
    { level: 'medium', documentType: 'business-plan' },
    { generationLeft: 0 }
  );
  ok('business plan : jamais un cliché de banque d’images (une vraie image du projet, une image faite pour lui, ou rien)', stock.resolved.length === 0);

  section('§9 ter Médias et graphiques montrés');
  const flat = sectionFromModel({ title: 'Marché', blocks: [{ kind: 'chart', chartType: 'bar', labels: ['TAM', 'SAM', 'SOM'], series: [{ name: 'Taille', data: [2000, 2000, 2000] }], readingKey: 'À préciser.' }, { kind: 'prose', paragraphs: ['Le marché.'] }] }, { id: 'mk' });
  ok('un graphique aux valeurs toutes égales (« à préciser ») n’est pas montré', Boolean(flat.section && !flat.section.blocks.some((b) => b.kind === 'chart')));
  const cover = coverContent({ brandName: 'Kora', documentLabel: 'Business plan', image: { subject: 'the world of Kora' } });
  ok('couverture : l’image du monde de la marque est demandée au planificateur (au traitement de la charte)', cover.intent?.visualStrategy === 'illustration' && cover.intent.image?.subject === 'the world of Kora' && planAssets(cover, FORMATS['a4-portrait']).some((r) => r.role === 'illustration'));
  const vector = await resolveAssets(
    [{ assetId: 'c.illustration', role: 'illustration', purpose: 'cover', subject: 'the world of Kora', aspectRatio: 1, safeArea: 'none', sources: ['user', 'project', 'generated', 'stock'], fallback: 'skip', target: {} }],
    { stock: { resolve: async () => ({ url: 'https://stock/photo.jpg', alt: 'x', provenance: { provider: 'stock' } }) } },
    { level: 'medium', documentType: 'pitch-deck', imageryMedium: 'illustration' },
    { generationLeft: 0 }
  );
  ok('une marque dont la charte n’est pas photographique ne reçoit jamais une photo de banque', vector.resolved.length === 0);

  {
    // La mesure s'exécute DANS le navigateur depuis une chaîne : un échappement perdu (« \\d » devenu « d ») la rendait
    // muette sans erreur. Elle doit compiler et garder ses classes de caractères.
    const probe = QUALITY({ swatches: ['#000000'], allowDark: false });
    let compiles = true;
    try {
      new Function(probe);
    } catch {
      compiles = false;
    }
    ok('la mesure de la page compile et garde ses expressions (\\d, \\s, \\()', compiles && probe.includes('/[\\d.]+/g') && probe.includes('rgba\\(') && !/\/\[d\.\]\+\/g/.test(probe));
  }
}

main()
  .catch((error) => {
    failures += 1;
    console.error(error);
  })
  .finally(async () => {
    await closeBrowser();
    console.log(
      `\n${failures ? '✗' : '✓'} Moteur graphique : ${passed} vérification(s) réussie(s), ${failures} en échec.`
    );
    process.exit(failures ? 1 : 0);
  });
