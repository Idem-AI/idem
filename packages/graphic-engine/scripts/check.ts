/**
 * CONTRÔLE DU MOTEUR GRAPHIQUE — `npm run check --prefix packages/graphic-engine` (`--fast` : sans Chromium).
 *
 *  §1 contrats ; §2 normalisation d'une sortie de petit modèle ; §3 jetons de la marque ;
 *  §4 la matière à plat (clés exactes, primitives, gabarit de carte) ;
 *  §5 assainissement (Tailwind seul : CSS natif, scripts, adresses étrangères retirés) ;
 *  §6 Tailwind compilé côté serveur (thème de la marque, portée `.ge-page`, px) ;
 *  §7 primitives : les 9 graphiques, le tableau exact ;
 *  §8 le flux complet avec un auteur SIMULÉ (Chromium) : bible, page, rejeu sans modèle, retouche écrite,
 *     cran transmis, correction bornée puis erreur dite.
 *
 * Aucun réseau, aucun modèle : l'auteur est simulé. Ce contrôle ne juge aucune esthétique.
 */
import fs from 'fs';
import path from 'path';
import { validateContent, validateDesignSpec } from '../src/contracts/validate';
import { normalizeSection } from '../src/contracts/normalize';
import { isAuthoredSpec } from '../src/contracts/design-spec';
import type { ChartType, SectionContent } from '../src/contracts/content-model';
import type { CreativityLevel } from '../src/contracts/common';
import { buildTokens } from '../src/design-system/tokens';
import { FORMATS } from '../src/design-system/formats';
import { contrastRatio, isDeep } from '../src/foundation/color';
import { buildContentMap } from '../src/runtime/content-map';
import { authorSystem } from '../src/author/prompts';
import { expandPage, extractHtml, sanitizeHtml } from '../src/runtime/expand';
import { compileTailwind } from '../src/runtime/tailwind';
import { chartHtml, tableHtml } from '../src/runtime/primitives';
import { closeBrowser } from '../src/runtime/browser';
import { configureGraphicEngine } from '../src/host';
import { cardFaces } from '../src/adapters/sections';
import { createDocument, GraphicRenderError, renderSingle } from '../src/engine';
import { applyTextEdits } from '../src/runtime/content-map';
import { exportPptx } from '../src/export/pptx';
import { sectionHtml } from '../src/adapters/sections';
import { BRANDS, CARD_BACK, CARD_FRONT, FINANCE_BP, MARKET } from './fixtures';
import { TEXT_BUDGETS } from '../src/content/analyze';
import { chartFromTable, parseFigure, withDataChart } from '../src/content/data-charts';
import { coverContent, sectionFromModel } from '../src/adapters/sections';
import { planAssets, resolveAssets } from '../src/asset-planner';

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

// ── L'auteur simulé : il place chaque clé reçue, et sait rendre une page vide ou une réponse sans HTML ─────
type Mode = 'ok' | 'blank' | 'blank-once' | 'garbage' | 'down' | 'cut-once' | 'cut' | 'cover-once' | 'overlap-once' | 'empty-once' | 'decor-once' | 'crop-once' | 'tiny-once' | 'nochart-once' | 'loud-once' | 'narrow-once' | 'invent' | 'loop-once' | 'iconcard-once';
let mode: Mode = 'ok';
const calls: Array<{
  role: string;
  level?: CreativityLevel;
  repair: boolean;
  user: string;
  system?: string;
}> = [];
const pageDirections: typeof calls = [];
/** Les primitives (graphiques, tableaux, galeries) que la page doit poser. */
const primsOf = (user: string): string[] =>
  [...user.matchAll(/<idem-(chart|table|gallery) data-block="([^"]+)">/g)].map(
    (m) => `<idem-${m[1]} data-block="${m[2]}" class="w-full text-[12px]"></idem-${m[1]}>`
  );
const fakePage = (user: string): string => {
  const keys = [...user.matchAll(/^\{\{([\w.:-]+)\}\} = /gm)]
    .map((m) => m[1])
    .filter((k) => !['kicker', 'title', 'lede'].includes(k));
  const prims = primsOf(user);
  // Une adresse d'image se pose en image (un actif de la marque, en grand), un texte en paragraphe.
  const body = `<p class="text-[12px] uppercase text-brand-primary">{{kicker}}</p><h2 class="font-display text-[36px] font-bold text-ink">{{title}}</h2><p class="text-muted">{{lede}}</p>${keys.map((k) => (/\.url$/.test(k) ? `<img src="{{${k}}}" alt="" class="h-[40%] w-auto self-start object-contain">` : `<p data-field="${k}" class="text-[12px]">{{${k}}}</p>`)).join('')}${prims.join('')}<idem-logo class="h-[20px]"></idem-logo>`;
  if (/business card/.test(user))
    return `\`\`\`html\n<div class="grid h-full w-full grid-cols-2 gap-x-[8px] bg-ground p-[12px] text-[8.5px] leading-[1.15]"><idem-logo class="h-[14px]"></idem-logo><div>${keys.map((k) => `<p data-field="${k}" class="break-all">{{${k}}}</p>`).join('')}</div></div>\n\`\`\``;
  return /A4 page that GROWS/.test(user)
    ? `\`\`\`html\n${body}\n\`\`\``
    : `\`\`\`html\n<div class="relative flex h-full w-full flex-col gap-[8px] bg-ground p-[5%]">${body}</div>\n\`\`\``;
};
configureGraphicEngine({
  agentCall:
    () =>
    async ({ role, user, level, system }) => {
      const repair = /DID NOT DISPLAY|did not display/.test(user);
      // Le directeur de page (une petite tâche avant l'auteur) : ses appels sont comptés à part.
      if (role === 'graphic.page-director') {
        pageDirections.push({ role, level, repair, user, system });
        return mode === 'down' ? 'je ne sais pas' : 'FOCAL: the title, large, top left\nZONES: top 30%: title and lede; bottom 70%: the content keys in order\nGROUPS: each figure with its label\nAVOID: decoration';
      }
      calls.push({ role, level, repair, user, system });
      if (mode === 'down') throw new Error('quota');
      if (role === 'graphic.director')
        return /PAGES:/.test(user)
          ? `IDEA: Large figures, one brand-primary rule per page.\n${[...user.matchAll(/^(\d+)\. /gm)].map((m) => `PAGE ${m[1]}: the key figure dominates, text in a narrow column`).join('\n')}`
          : 'LANGUAGE:\n- brand-primary for structure, ink for text, generous margins, a 4px brand-primary rule as signature.';
      if (/CHANGE REQUESTED BY THE CLIENT/.test(user))
        return `\`\`\`html\n<div class="relative flex h-full w-full flex-col bg-brand-primary p-[40px]"><h2 class="text-[60px] text-on-brand">{{title}}</h2><div class="bg-ground">${primsOf(user).join('')}</div></div>\n\`\`\``;
      if (mode === 'garbage') return 'je ne sais pas';
      if (mode === 'blank' || (mode === 'blank-once' && !repair))
        return '```html\n<div class="hidden">{{title}}</div>\n```';
      if (mode === 'cover-once' && !repair)
        return '```html\n<div class="relative h-full w-full bg-ground p-[60px]"><h2 class="text-[48px] text-ink">{{title}}</h2><div class="absolute left-[40px] top-[40px] h-[200px] w-[900px] bg-brand-primary"></div></div>\n```';
      // Les pages désordonnées que le code mesure (une fois chacune, puis la page juste).
      if (!repair && mode === 'overlap-once')
        return '```html\n<div class="relative h-full w-full bg-ground p-[60px]"><h2 class="absolute left-[60px] top-[80px] text-[48px] text-ink">{{title}}</h2><p class="absolute left-[60px] top-[90px] text-[40px] text-muted">{{p1.paragraphs.0}}</p></div>\n```';
      if (!repair && mode === 'empty-once')
        return '```html\n<div class="flex h-full w-full flex-col gap-[24px] bg-ground p-[60px]"><h2 class="text-[48px] text-ink">{{title}}</h2><div class="flex gap-[24px]"><div class="h-[220px] w-[300px] rounded-[16px] bg-brand-soft"></div><div class="h-[220px] w-[300px] rounded-[16px] bg-brand-soft"></div></div></div>\n```';
      if (!repair && mode === 'decor-once')
        return `\`\`\`html\n<div class="flex h-full w-full flex-col gap-[24px] bg-ground p-[60px]"><h2 class="text-[48px] text-ink">{{title}}</h2><div class="flex flex-wrap gap-[12px]">${'<span class="block size-[14px] rounded-full bg-brand-primary"></span>'.repeat(14)}</div></div>\n\`\`\``;
      if (!repair && (mode === 'crop-once' || mode === 'tiny-once')) {
        const url = user.match(/^\{\{([\w.:-]+\.url)\}\} = /m)?.[1] ?? 'sys-1.variants.0.url';
        return mode === 'crop-once'
          ? `\`\`\`html\n<div class="flex h-full w-full flex-col bg-ground p-[60px]"><h2 class="text-[40px] text-ink">{{title}}</h2><div class="h-[60px] w-[500px] overflow-hidden"><img src="{{${url}}}" alt="" class="h-[500px] w-[500px]"></div></div>\n\`\`\``
          : `\`\`\`html\n<div class="flex h-full w-full flex-col bg-ground p-[60px]"><h2 class="text-[40px] text-ink">{{title}}</h2><img src="{{${url}}}" alt="" class="h-[30px] w-[30px] object-contain"></div>\n\`\`\``;
      }
      if (!repair && mode === 'loud-once')
        return '```html\n<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[40px]"><h2 class="text-[32px] text-ink">{{title}}</h2><p class="text-[30px] leading-[1.2] text-ink">{{p1.paragraphs.0}}</p></div>\n```';
      if (!repair && mode === 'narrow-once')
        return '```html\n<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[40px]"><h2 class="text-[32px] text-ink">{{title}}</h2><p class="w-[160px] text-[13px] text-ink">{{p1.paragraphs.0}}</p></div>\n```';
      if (mode === 'invent')
        return '```html\n<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[40px]"><p class="text-[12px] uppercase">SYS-1 · Signature de la marque</p><h2 class="text-[40px] text-ink">{{title}}</h2><p class="text-[16px]">« {{p1.paragraphs.0}} »</p><p class="text-[16px]">01</p></div>\n```';
      if (!repair && mode === 'loop-once')
        return '```html\n<div class="flex h-full w-full flex-col bg-ground p-[40px]"><h2 class="text-[40px] text-ink">{{title}}</h2>{{#each p1.paragraphs}}<p>{{this}}</p>{{/each}}</div>\n```';
      if (!repair && mode === 'iconcard-once')
        return '```html\n<div class="flex h-full w-full flex-col gap-[24px] bg-ground p-[60px]"><h2 class="text-[48px] text-ink">{{title}}</h2><p>{{p1.paragraphs.0}}</p><div class="flex gap-[24px]"><div class="relative h-[220px] w-[300px] rounded-[16px] border border-rule"><idem-icon name="check" class="absolute bottom-[12px] left-[12px] size-[14px]"></idem-icon></div><div class="relative h-[220px] w-[300px] rounded-[16px] border border-rule"><idem-icon name="check" class="absolute bottom-[12px] left-[12px] size-[14px]"></idem-icon></div></div></div>\n```';
      if (!repair && mode === 'nochart-once') return '```html\n<div class="flex h-full w-full flex-col bg-ground p-[60px]"><h2 class="text-[40px] text-ink">{{title}}</h2></div>\n```';
      if (mode === 'cut' || (mode === 'cut-once' && !repair))
        return '```html\n<div class="relative h-full w-full bg-ground p-[40px]"><h2 class="absolute left-[40px] top-[1050px] text-[48px]">{{title}}</h2></div>\n```';
      return fakePage(user);
    },
});

const authorSystemOf = (list: typeof calls) => list.map((c) => c.system ?? '').join('\n');

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
  const clean = sanitizeHtml(extractHtml(raw));
  ok('bloc de code extrait de la réponse', clean.html.startsWith('<div'));
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
  const sys = authorSystem({
    documentType: 'pitch-deck',
    locale: 'fr',
    tokens: kora,
    format: FORMATS['slide-16x9'],
    allowDark: false,
    bindings: 'values',
  });
  ok(
    'consignes : logo à la même place, pas de numéros géants, pas de cadre vide pour une image absente, rien coupé par le bord',
    /SAME place/.test(sys) &&
      /No giant faded numerals/.test(sys) &&
      /never leave an empty frame/.test(sys) &&
      /nothing cut by the edge/.test(sys)
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
  section('§8 Le flux complet (Chromium, auteur simulé)');
  calls.length = 0;
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
  ok(
    'sans mémoire : le langage de la marque et le plan (deux appels du directeur, pages en parallèle), un appel d’auteur par page, au cran choisi',
    calls.filter((c) => c.role === 'graphic.director').length === 2 &&
      calls.filter((c) => c.role === 'graphic.author').length === 2 &&
      calls.every((c) => c.level === 'low')
  );
  const authorCalls = calls.filter((c) => c.role === 'graphic.author');
  ok(
    'l’auteur reçoit le langage de la marque, SA ligne du plan et celle de sa voisine, le support et la matière',
    authorCalls.every(
      (c) =>
        c.user.includes('BRAND VISUAL LANGUAGE') &&
        c.user.includes('THIS PAGE:') &&
        /(previous|next) page:/.test(c.user) &&
        c.user.includes('CANVAS:') &&
        c.user.includes('{{title}}')
    )
  );
  ok(
    'outils à la demande : une page sans tableau ne reçoit pas la documentation du tableau',
    authorCalls.some(
      (c) => c.user.includes('<idem-chart data-block="b2"') && !c.user.includes('<idem-table')
    ) && authorCalls.some((c) => c.user.includes('<idem-table data-block="b1"'))
  );
  ok(
    'pages affichées, photographiées, textes exacts, aucun constat bloquant',
    Boolean(m.png && f.png) &&
      m.result.html.includes('2,3 Md FCFA') &&
      [m, f].every((o) => !o.result.issues.some((i) => i.severity === 'blocking'))
  );
  ok(
    'le fragment porte sa feuille Tailwind avant la racine',
    /<style data-ge-tailwind>/.test(m.result.head ?? '') &&
      m.result.html.startsWith('<div class="ge-page')
  );
  const before = calls.length;
  const replay = await deck.composeSection(
    { ...MARKET, title: 'Un marché de 3 milliards' },
    { replay: m.spec }
  );
  ok(
    'retouche de texte : la page est rejouée sans modèle',
    calls.length === before &&
      replay.result.html.includes('Un marché de 3 milliards') &&
      replay.spec.html === m.spec.html
  );
  const revised = await deck.composeSection(MARKET, {
    revise: { spec: m.spec, instruction: 'make the title much bigger on a brand background' },
  });
  ok(
    'retouche écrite : l’auteur reçoit son code et la consigne',
    calls[calls.length - 1].user.includes('CURRENT PAGE CODE') &&
      revised.spec.html.includes('text-[60px]')
  );
  const old = await deck.composeSection(MARKET, {
    replay: { ref: 'market', pattern: { id: 'slide.split' }, root: {} } as never,
  });
  ok(
    'une page de l’ancien moteur ne se rejoue pas : elle est réécrite',
    old.spec.version === 2 && calls[calls.length - 1].role === 'graphic.author'
  );

  // La mémoire de la marque : le langage est écrit une fois, puis relu par les autres livrables.
  const memory = new Map<string, string>();
  configureGraphicEngine({
    brandMemory: { read: async (k) => memory.get(k), write: async (k, v) => void memory.set(k, v) },
  });
  calls.length = 0;
  const scope = { documentType: 'pitch-deck', key: 'project-kora' };
  const d1 = await createDocument({
    documentType: 'pitch-deck',
    format: 'slide-16x9',
    brand: BRANDS.kora,
    direction: { styleId: 'swiss' },
    seed: 'm1',
    sections: [{ id: 'market' }, { id: 'finance' }],
    memoryScope: scope,
  });
  await d1.composeSection(MARKET, { index: 1, total: 2 });
  const firstDirector = calls.filter((c) => c.role === 'graphic.director').length;
  calls.length = 0;
  await renderSingle({
    documentType: 'flyer',
    format: 'flyer-square',
    brand: BRANDS.kora,
    direction: { styleId: 'swiss' },
    seed: 'm2',
    memoryScope: { documentType: 'flyer', key: 'project-kora' },
    content: { id: 'v', role: 'visual', title: 'Promo', blocks: [] },
  });
  ok(
    'langage écrit une fois et gardé ; un flyer de la même marque le relit (aucun appel du directeur) et l’applique',
    firstDirector === 2 &&
      memory.size === 1 &&
      calls.length === 1 &&
      calls[0].role === 'graphic.author' &&
      calls[0].user.includes('BRAND VISUAL LANGUAGE')
  );
  calls.length = 0;
  await renderSingle({
    documentType: 'flyer',
    format: 'flyer-square',
    brand: { ...BRANDS.kora, palette: { ...BRANDS.kora.palette, primary: '#7A1F3D' } },
    direction: { styleId: 'swiss' },
    seed: 'm3',
    memoryScope: { documentType: 'flyer', key: 'project-kora' },
    content: { id: 'v', role: 'visual', title: 'Promo', blocks: [] },
  });
  ok(
    'une charte changée appelle un nouveau langage',
    calls.filter((c) => c.role === 'graphic.director').length === 1 && memory.size === 2
  );
  configureGraphicEngine({ brandMemory: undefined });
  ok(
    'consigne professionnelle : aucune décoration gratuite, système identique d’une page à l’autre',
    calls.length > 0 && /Never random circles, blobs, glows, gradients/.test(authorSystemOf(calls))
  );

  ok(
    'le document garde le contenu et le code de chaque page (remise en page sans réécriture)',
    Boolean(deck.page('market')?.content.blocks.length && deck.page('market')?.spec.html)
  );
  const before2 = calls.length;
  const relaid = await (
    await createDocument({
      documentType: 'pitch-deck',
      format: 'slide-16x9',
      brand: BRANDS.kora,
      seed: 'r',
      sections: [{ id: 'market' }],
      layoutNote: 'plus aérée',
    })
  ).composeSection(deck.page('market')!.content);
  ok(
    'nouvelle mise en page : l’auteur repart du contenu gardé et reçoit le souhait du client',
    relaid.result.html.includes('2,3 Md FCFA') &&
      calls
        .slice(before2)
        .some(
          (c) =>
            c.role === 'graphic.author' &&
            c.user.includes('THE CLIENT ASKS FOR THIS LAYOUT: plus aérée')
        )
  );

  section('§8 ter Pages d’actif de la charte : composées par l’auteur, aucun gabarit');
  const img =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIvPg==';
  const book = await createDocument({
    documentType: 'brand-charter',
    format: 'slide-16x9',
    brand: BRANDS.kora,
    seed: 'a',
    sections: [],
  });
  calls.length = 0;
  const symbol = await book.composeSection({
    id: 'mark',
    title: 'Symbole seul',
    blocks: [
      {
        id: 'sys-1',
        kind: 'logoDisplay',
        origin: 'system',
        variants: [{ url: img, label: 'Icône', background: 'light' }],
      },
    ],
  });
  const posts = await book.composeSection({
    id: 'posts',
    title: 'Publications sociales',
    blocks: [
      {
        id: 'sys-1',
        kind: 'mockupShowcase',
        origin: 'system',
        items: [
          { url: img, label: 'LinkedIn', ratio: 0.8 },
          { url: img, label: 'Facebook', ratio: 0.8 },
        ],
      },
    ],
  });
  const tiles = await book.composeSection({
    id: 'patterns',
    title: 'Motifs',
    blocks: [
      {
        id: 'sys-1',
        kind: 'patternGrid',
        origin: 'system',
        patterns: [
          {
            name: 'Motif principal',
            motif: 'dots',
            ink: '#2d6a4f',
            ground: '#f9fbfb',
            url: img,
            tile: 40,
          },
          { name: 'Trame', motif: 'grid', ink: '#2d6a4f', ground: '#eef2ef' },
        ],
      },
    ],
  });
  const palette = await book.composeSection({
    id: 'palette',
    title: 'Palette',
    blocks: [
      {
        id: 'sys-1',
        kind: 'swatches',
        origin: 'system',
        items: [
          { hex: '#1B5E20', name: 'Primaire' },
          { hex: '#FFFFFF', name: 'Fond' },
        ],
      },
    ],
  });
  const scale = await book.composeSection({
    id: 'scale',
    title: 'Hiérarchie',
    blocks: [
      {
        id: 'sys-1',
        kind: 'typeScale',
        origin: 'system',
        levels: [
          { label: 'Titre', family: 'Inter', step: '3xl', weight: 700, sample: 'Kora' },
          {
            label: 'Texte',
            family: 'Inter',
            step: 'base',
            weight: 400,
            sample: 'Le texte courant',
          },
        ],
      },
    ],
  });
  const assets = [symbol, posts, tiles, palette, scale];
  const assetAuthors = calls.filter((c) => c.role === 'graphic.author' && !c.repair);
  ok(
    'chaque page d’actif est composée par l’auteur (logo, mockups, motifs, palette, échelle) : aucun gabarit du code',
    assetAuthors.length >= assets.length && !assets.some((o) => o.result.repairs.some((r) => r.code === 'asset_page'))
  );
  ok(
    'l’auteur reçoit les outils exacts de l’actif : le logo à montrer en grand, les vraies tuiles de motif, la galerie de mockups',
    assetAuthors.some((c) => c.user.includes('the logo is the subject of this page')) &&
      assetAuthors.some((c) => c.user.includes('<idem-pattern-tile data-block="sys-1"')) &&
      assetAuthors.some((c) => c.user.includes('<idem-gallery data-block="sys-1">'))
  );
  ok(
    'mockups : posés par la galerie du code (images entières)',
    (posts.result.html.match(/<img /g) ?? []).length >= 2
  );
  ok(
    'palette : codes exacts recopiés par le code',
    palette.result.html.includes('#1B5E20')
  );
  ok(
    'aucun constat bloquant sur les pages d’actif',
    assets.every((o) => !o.result.issues.some((i) => i.severity === 'blocking')),
    assets.flatMap((o) => o.result.issues.filter((i) => i.severity === 'blocking').map((i) => `${o.result.sectionId}: ${i.message}`)).join(' / ').slice(0, 600)
  );

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

  const card = await renderSingle({
    documentType: 'business-card',
    format: 'card-landscape',
    brand: BRANDS.Makam,
    seed: 'card',
    bindings: 'markers',
    content: cardFaces({ binding: 'markers' }).back,
  });
  ok(
    'carte : gabarit à marqueurs (data-field)',
    /data-field="fullName"[^>]*>\{\{fullName\}\}|<span data-field="fullName">\{\{fullName\}\}/.test(
      card.result.html
    )
  );

  for (const level of ['low', 'medium', 'high', 'ultra'] as const) {
    calls.length = 0;
    await renderSingle({
      documentType: 'flyer',
      format: 'flyer-square',
      brand: BRANDS.baobab,
      creativity: level,
      seed: `l:${level}`,
      content: { id: 'v', role: 'visual', title: 'Promo de saison', blocks: [] },
    });
    ok(
      `${level} : même travail (un appel d’auteur), cran transmis au modèle`,
      calls.length === 1 && calls[0].level === level
    );
  }

  mode = 'cut-once';
  calls.length = 0;
  const cutFixed = await renderSingle({
    documentType: 'flyer',
    format: 'flyer-square',
    brand: BRANDS.baobab,
    creativity: 'medium',
    seed: 'cut',
    content: { id: 'v', role: 'visual', title: 'Promo de saison', blocks: [] },
  });
  ok(
    'un texte coupé par le bord de la toile ne s’affiche pas : corrigé par l’auteur (même cran), avec le texte en cause',
    cutFixed.result.repairs.some((r) => r.code === 'render_fix') &&
      calls[1]?.repair &&
      /cut off by the edge/.test(calls[1].user) &&
      /Promo de saison/.test(calls[1].user)
  );

  mode = 'cut';
  const stillCut = await renderSingle({
    documentType: 'flyer',
    format: 'flyer-square',
    brand: BRANDS.baobab,
    creativity: 'medium',
    seed: 'cut2',
    png: true,
    content: { id: 'v', role: 'visual', title: 'Promo de saison', blocks: [] },
  });
  ok(
    'un texte toujours coupé après la correction : la page est livrée (photographiée) et le défaut SIGNALÉ, jamais la slide perdue',
    Boolean(stillCut.png) &&
      stillCut.result.issues.some((i) => i.code === 'text_cut' && i.severity === 'blocking') &&
      stillCut.result.repairs.some((r) => r.code === 'render_partial')
  );

  mode = 'cover-once';
  calls.length = 0;
  const uncovered = await renderSingle({
    documentType: 'flyer',
    format: 'flyer-square',
    brand: BRANDS.baobab,
    creativity: 'medium',
    seed: 'cover',
    content: { id: 'v', role: 'visual', title: 'Promo de saison', blocks: [] },
  });
  ok(
    'un texte recouvert par une forme : corrigé par l’auteur, avec le texte en cause',
    uncovered.result.repairs.some((r) => r.code === 'render_fix') &&
      /covered by another element/.test(calls[1]?.user ?? '') &&
      /Promo de saison/.test(calls[1]?.user ?? '')
  );

  mode = 'blank-once';
  calls.length = 0;
  const fixedOut = await renderSingle({
    documentType: 'flyer',
    format: 'flyer-story',
    brand: BRANDS.baobab,
    creativity: 'medium',
    seed: 'fix',
    content: { id: 'v', role: 'visual', title: 'Promo', blocks: [] },
  });
  ok(
    'page vide : corrigée par l’auteur au même cran, dite dans les réparations',
    fixedOut.result.repairs.some((r) => r.code === 'render_fix') &&
      calls.length === 2 &&
      calls[1].repair &&
      calls[1].level === 'medium'
  );
  for (const m2 of ['blank', 'garbage', 'down'] as const) {
    mode = m2;
    calls.length = 0;
    let error: unknown = null;
    try {
      await renderSingle({
        documentType: 'flyer',
        format: 'flyer-square',
        brand: BRANDS.baobab,
        creativity: 'high',
        seed: `fail:${m2}`,
        content: { id: 'v', role: 'visual', title: 'Promo', blocks: [] },
      });
    } catch (e) {
      error = e;
    }
    ok(
      `${m2} : au plus 1 + 3 tentatives, une à la fois, réécriture au cran au-dessus (ultra), puis GraphicRenderError`,
      error instanceof GraphicRenderError &&
        calls.length <= 4 &&
        calls.slice(2).every((c) => c.level === 'ultra'),
      `${calls.map((c) => c.level).join(',')}`
    );
  }
  mode = 'ok';

  section('§9 L’ordre de la page, mesuré par le code (la page repart à l’auteur, la mise en page reste la sienne)');
  pageDirections.length = 0;
  calls.length = 0;
  const directed = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, seed: 'pd', sections: [{ id: 'market' }, { id: 'finance' }] });
  await directed.composeSection(MARKET, { index: 1, total: 2 });
  ok(
    'travail divisé : le directeur de page décide la hiérarchie (petite tâche), l’auteur la construit',
    pageDirections.length === 1 &&
      /FOCAL: .+\nZONES: /.test(pageDirections[0].system ?? '') &&
      calls.some((c) => c.role === 'graphic.author' && c.user.includes('PAGE LAYOUT DECIDED BY THE ART DIRECTOR') && c.user.includes('FOCAL: the title'))
  );
  const fixedBy = async (m: Mode, content: SectionContent, format: 'slide-16x9' | 'flyer-square' = 'slide-16x9', documentType: 'pitch-deck' | 'brand-charter' | 'flyer' = 'pitch-deck') => {
    mode = m;
    calls.length = 0;
    const doc = await createDocument({ documentType, format, brand: BRANDS.kora, seed: `q:${m}`, sections: [{ id: content.id }] });
    const out = await doc.composeSection(content);
    mode = 'ok';
    const repair = calls.find((c) => c.repair);
    return { out, prompt: repair?.user ?? '' };
  };
  const plain: SectionContent = { id: 'q', title: 'Une page simple', blocks: [{ id: 'p1', kind: 'prose', paragraphs: ['Un paragraphe.'] }] };
  for (const [m, pattern, label] of [
    ['overlap-once', /on top of each other/, 'un texte posé sur un autre texte'],
    ['empty-once', /empty frames/, 'des cadres vides (cartes, avatars, emplacements)'],
    ['decor-once', /decoration noise/, 'un semis de formes décoratives'],
  ] as const) {
    const r = await fixedBy(m, plain);
    ok(`${label} : renvoyé à l’auteur avec la consigne, puis page juste`, r.out.result.repairs.some((x) => x.code === 'render_fix') && pattern.test(r.prompt));
  }
  const logoPage: SectionContent = { id: 'logo', title: 'Le symbole', blocks: [{ id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIvPg==', label: 'Icône', background: 'light' }] }] };
  const cropped = await fixedBy('crop-once', logoPage, 'slide-16x9', 'brand-charter');
  ok('un logo rogné par son conteneur : renvoyé à l’auteur (entier, object-contain)', cropped.out.result.repairs.some((x) => x.code === 'render_fix') && /brand asset is cropped/.test(cropped.prompt));
  const tiny = await fixedBy('tiny-once', logoPage, 'slide-16x9', 'brand-charter');
  ok('un logo minuscule sur la page qui le montre : renvoyé à l’auteur (30 % au moins)', tiny.out.result.repairs.some((x) => x.code === 'render_fix') && /shown small/.test(tiny.prompt));
  const noChart = await fixedBy('nochart-once', MARKET);
  ok('un graphique oublié par l’auteur : renvoyé (la page perd sa preuve)', noChart.out.result.repairs.some((x) => x.code === 'render_fix') && /content is missing/.test(noChart.prompt) && /<idem-chart data-block="b2">/.test(noChart.prompt));

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

  section('§9 ter Les mots viennent du contenu ; un texte long se lit au corps du texte');
  const long: SectionContent = { id: 'long', title: 'Une page de texte', blocks: [{ id: 'p1', kind: 'prose', paragraphs: [Array.from({ length: 60 }, (_, i) => `mot${i}`).join(' ')] }] };
  const loud = await fixedBy('loud-once', long);
  ok('un paragraphe long à la taille d’un titre : renvoyé (corps du texte)', loud.out.result.repairs.some((x) => x.code === 'render_fix') && /long text is set at title size/.test(loud.prompt));
  const narrowCol = await fixedBy('narrow-once', long);
  ok('un paragraphe long serré dans une colonne étroite : renvoyé (largeur de lecture)', narrowCol.out.result.repairs.some((x) => x.code === 'render_fix') && /squeezed into a narrow column/.test(narrowCol.prompt));
  const invented = await fixedBy('invent', plain);
  ok(
    'texte écrit en dur par l’auteur (« SYS-1 · Signature… ») : retiré par le code, la ponctuation et les numéros restent',
    !/SYS-1|Signature/.test(invented.out.result.html) && invented.out.result.html.includes('Un paragraphe.') && invented.out.result.html.includes('01') && invented.out.result.issues.some((i) => i.code === 'invented_text_removed')
  );
  const looped = await fixedBy('loop-once', plain);
  ok('une boucle de gabarit ({{#each}}) : renvoyée, l’auteur écrit chaque clé', looped.out.result.repairs.some((x) => x.code === 'render_fix') && /template loops/.test(looped.prompt) && !looped.out.result.html.includes('{{'));
  const iconCards = await fixedBy('iconcard-once', plain);
  ok('des cartes vides avec une seule pastille d’icône : des cadres vides, renvoyés', iconCards.out.result.repairs.some((x) => x.code === 'render_fix') && /empty frames/.test(iconCards.prompt));
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
