/**
 * Vérification du rendu par gabarit — `npm run check:render`.
 *
 * Deux sorties, complémentaires :
 *
 *   1. des ASSERTIONS, qui vérifient ce qui doit être vrai quel que soit le
 *      contenu : balisage équilibré, palette respectée, contrastes atteints,
 *      douze archétypes réellement distincts, aucune violation de charte ;
 *   2. un FICHIER HTML ouvrable, qui rend les douze archétypes côte à côte avec
 *      un contenu identique — c'est-à-dire exactement ce qu'il faut pour juger à
 *      l'œil ce qu'aucune assertion ne peut juger.
 *
 * Aucun réseau, aucune base, aucun modèle : le rendu est déterministe, donc il
 * se vérifie sans rien démarrer.
 *
 *   npx ts-node --transpile-only api/scripts/checkSectionRenderer.ts
 *   open logs/render-preview.html
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import { ART_DIRECTION_STYLE_IDS } from '../services/design/artDirection.catalog';
import { contrastRatio } from '../services/design/color';
import { buildDocumentSeed, buildSectionSeed } from '../services/design/designSeed';
import {
  buildDocumentDesignSystem,
  derivedPalette,
  describeDesignSystem,
} from '../services/design/documentDesignSystem';
import { normalizeSectionContent, SectionContent } from '../services/design/sectionContent';
import { IMPLEMENTED_ARCHETYPES, renderSection } from '../services/design/sectionRenderer';
import { lintHtml } from '../services/design/slopLint.service';
import { inspectOutput } from '../services/agents/quality-gate';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Charte d'exemple : volontairement éloignée d'un bleu générique. */
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

/** Contenu d'exemple : il exerce les huit types de blocs. */
const CONTENT: SectionContent = {
  kicker: 'Marché',
  title: 'Le café de spécialité arrive au Cameroun',
  lede: 'La torréfaction locale capte pour la première fois la valeur qui partait à l\'export.',
  blocks: [
    {
      kind: 'metrics',
      items: [
        { value: '2,3 Md FCFA', label: 'marché urbain du café torréfié', note: '2025' },
        { value: '+18 %/an', label: 'croissance du segment premium', note: '2022-2025' },
        { value: '4 200 t', label: 'volume torréfié localement', note: '2025' },
      ],
    },
    {
      kind: 'prose',
      paragraphs: [
        'Douala et Yaoundé concentrent 71 % de la consommation de café torréfié du pays, pour 22 % de la population. Trois torréfacteurs y opèrent à l\'échelle industrielle, aucun sur le segment de spécialité.',
        'Le prix moyen au kilo a doublé en quatre ans sur le circuit des cafés urbains, sans que la part revenant au producteur ne progresse — c\'est cet écart que le projet vient prendre.',
      ],
    },
    {
      kind: 'chart',
      chartType: 'bar',
      labels: ['2023', '2024', '2025', '2026e'],
      series: [
        { name: 'Volume premium', data: [420, 610, 890, 1280] },
        { name: 'Volume standard', data: [3100, 3180, 3310, 3400] },
      ],
      unit: 'tonnes',
      readingKey:
        'Le premium triple quand le standard stagne : la croissance du marché est entièrement portée par le segment que nous visons.',
    },
    {
      kind: 'table',
      headers: ['Segment', 'Volume annuel', 'Prix moyen/kg', 'Circuit dominant'],
      rows: [
        ['Spécialité', '890 t', '9 400 FCFA', 'Cafés urbains'],
        ['Premium', '1 260 t', '5 200 FCFA', 'Grande distribution'],
        ['Standard', '3 310 t', '2 100 FCFA', 'Marchés de quartier'],
      ],
      caption: 'Source : douanes camerounaises et relevés terrain, 2025.',
    },
    {
      kind: 'cards',
      items: [
        { title: 'Torréfaction à Douala', body: 'Unité de 200 kg/jour, à 40 km des coopératives.', emphasis: true },
        { title: 'Circuit court', body: 'Achat direct auprès de six coopératives de l\'Ouest.' },
        { title: 'Traçabilité', body: 'Lot, parcelle et date de récolte sur chaque paquet.' },
      ],
    },
    {
      kind: 'assumption',
      statement: 'Une conversion de 12 % des clients des cafés urbains vers le paquet à emporter.',
      basis: 'Taux observé sur un pilote de trois mois à Bonapriso.',
    },
    {
      kind: 'timeline',
      steps: [
        { date: 'T1 2026', title: 'Unité pilote', body: 'Mise en service de la torréfaction.' },
        { date: 'T3 2026', title: 'Premier circuit', body: 'Douze points de vente à Douala.' },
        { date: 'T2 2027', title: 'Yaoundé', body: 'Extension du circuit à la capitale.' },
      ],
    },
    {
      kind: 'quote',
      text: 'Nous vendions notre récolte sans jamais savoir où elle finissait.',
      attribution: 'Coopérative de Bafoussam',
    },
  ],
};

console.log('\nRendu par gabarit\n');

// ─────────────────────────────────────────────────────────────────────────────
console.log('Contrat de contenu');
{
  check('un contenu valide traverse la normalisation', normalizeSectionContent(CONTENT) !== null);
  check('un objet sans titre est rejeté', normalizeSectionContent({ blocks: [] }) === null);
  check('un objet sans bloc est rejeté', normalizeSectionContent({ title: 'x', blocks: [] }) === null);

  // La propriété qui compte pour un petit modèle : un bloc cassé n'emporte pas
  // la page, il est simplement écarté.
  const partial = normalizeSectionContent({
    title: 'Titre',
    blocks: [
      { kind: 'prose', paragraphs: ['un paragraphe valide'] },
      { kind: 'table', headers: [], rows: [] },
      { kind: 'inconnu', foo: 1 },
      { kind: 'metrics', items: [{ value: '10', label: 'unités' }] },
    ],
  });
  check('un bloc invalide est écarté sans perdre les autres', partial?.blocks.length === 2);

  // Une ligne de tableau plus courte que son en-tête casserait la grille.
  const ragged = normalizeSectionContent({
    title: 'Titre',
    blocks: [{ kind: 'table', headers: ['a', 'b', 'c'], rows: [['1'], ['1', '2', '3', '4']] }],
  });
  const table = ragged?.blocks[0];
  check(
    'les lignes de tableau sont recalibrées sur l\'en-tête',
    table?.kind === 'table' && table.rows.every((row) => row.length === 3)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nDesign system calculé');
{
  const seed = buildDocumentSeed('editorial', 'businessplan:demo');
  const ds = buildDocumentDesignSystem(CHARTER, { styleId: 'editorial' } as any, seed);
  console.log(`     ${describeDesignSystem(ds)}`);

  check('l\'encre principale atteint AAA (≥ 7:1)', ds.contrast.inkOnSurface >= 7,
    `${ds.contrast.inkOnSurface}:1`);
  check('l\'encre secondaire atteint AA (≥ 4,5:1)', ds.contrast.mutedOnSurface >= 4.5,
    `${ds.contrast.mutedOnSurface}:1`);
  check('l\'encre sur accent atteint AA (≥ 4,5:1)', ds.contrast.inkOnAccent >= 4.5,
    `${ds.contrast.inkOnAccent}:1`);
  check('l\'échelle typographique est réellement contrastée',
    ds.typeScale['3xl'] / ds.typeScale.base >= 2.4,
    `rapport ${(ds.typeScale['3xl'] / ds.typeScale.base).toFixed(2)}`);

  // La garantie tient-elle sur une charte HOSTILE ? C'est le cas qui compte :
  // une palette pâle sur fond pâle est exactement ce qu'un modèle produit seul.
  const hostile = buildDocumentDesignSystem(
    { colors: { colors: { primary: '#DDEEFF', accent: '#FFEE99', background: '#FFFFFF', text: '#CCCCCC' } } },
    { styleId: 'minimalism' } as any,
    seed
  );
  check('une charte à faible contraste est CORRIGÉE, pas subie',
    hostile.contrast.inkOnSurface >= 7 && hostile.contrast.mutedOnSurface >= 4.5,
    `${hostile.contrast.inkOnSurface}:1 / ${hostile.contrast.mutedOnSurface}:1`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nArchétypes');
{
  check('les douze archétypes du catalogue sont implémentés',
    IMPLEMENTED_ARCHETYPES.length === 12,
    `${IMPLEMENTED_ARCHETYPES.length} implémenté(s)`);

  const seed = buildDocumentSeed('editorial', 'businessplan:demo');
  const ds = buildDocumentDesignSystem(CHARTER, { styleId: 'editorial' } as any, seed);
  const base = buildSectionSeed('editorial', 'businessplan:demo', 'Opportunity', new Set());

  const rendered = IMPLEMENTED_ARCHETYPES.map((archetype) =>
    renderSection(CONTENT, ds, { ...base, archetype }, { brandName: 'Café des Hauts', index: 3 })
  );

  check('chaque archétype produit une page distincte',
    new Set(rendered).size === rendered.length,
    `${new Set(rendered).size} pages distinctes sur ${rendered.length}`);

  // Ce que le gabarit rend IMPOSSIBLE, et qui occupait des dizaines de lignes de
  // prompt : troncature, balises déséquilibrées, gabarits non remplis.
  const gateFailures = rendered.filter(
    (html) => !inspectOutput(html, { format: 'html', minChars: 400 }).ok
  );
  check('aucune page n\'échoue la grille qualité', gateFailures.length === 0,
    `${gateFailures.length} page(s) en échec`);

  // …et la charte, qui occupait les dizaines de lignes suivantes.
  const palette = CHARTER.colors.colors;
  const lintFailures = rendered
    .map((html, index) => ({
      archetype: IMPLEMENTED_ARCHETYPES[index],
      report: lintHtml(html, {
        palette,
        // Les teintes des rampes DÉRIVENT de la charte (teinte et chroma de la
        // marque, clarté balayée) : les traiter comme des couleurs inventées
        // reviendrait à reprocher au design system d'avoir des nuances.
        extraAllowedColors: derivedPalette(ds),
        fonts: [CHARTER.typography.primaryFont, CHARTER.typography.secondaryFont],
        styleId: 'editorial',
      }),
    }))
    .filter((entry) => entry.report.errorCount > 0);
  check('aucune page ne viole la charte', lintFailures.length === 0,
    lintFailures.map((e) => `${e.archetype}: ${e.report.violations.map((v) => v.rule).join(',')}`).join(' | '));

  // Toute image porte un alt : l'accessibilité cesse d'être une consigne.
  const missingAlt = rendered.filter((html) => /<img\b(?![^>]*\balt=)/.test(html));
  check('toute image porte un attribut alt', missingAlt.length === 0);

  // Le texte du modèle est ÉCHAPPÉ : un contenu hostile ne peut pas injecter
  // de balisage dans la page.
  const injected = renderSection(
    { title: '<script>alert(1)</script>', blocks: [{ kind: 'prose', paragraphs: ['<img src=x onerror=1>'] }] },
    ds,
    base,
    {}
  );
  // Ce qui compte n'est pas l'absence des mots, c'est l'absence de BALISE : un
  // « onerror= » en texte échappé est du texte, pas un gestionnaire d'événement.
  const injectedBody = injected.replace(/ style="[^"]*"/g, '');
  check('le contenu du modèle est échappé, aucune balise injectée',
    !/<script|<img\b(?![^>]*\balt=)/i.test(injectedBody) &&
      injectedBody.includes('&lt;script&gt;'));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nUnicité du rendu');
{
  // Deux projets, deux chartes, deux styles : les pages doivent différer sur
  // plus que leur texte.
  const pages = ['projet-a', 'projet-b', 'projet-c'].map((projectId, index) => {
    const styleId = ART_DIRECTION_STYLE_IDS[index * 5 % ART_DIRECTION_STYLE_IDS.length];
    const documentSeed = buildDocumentSeed(styleId, `businessplan:${projectId}`);
    const ds = buildDocumentDesignSystem(CHARTER, { styleId } as any, documentSeed);
    const seed = buildSectionSeed(styleId, `businessplan:${projectId}`, 'Opportunity', new Set());
    return renderSection(CONTENT, ds, seed, { brandName: projectId });
  });

  check('trois projets produisent trois pages distinctes', new Set(pages).size === 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aperçu ouvrable — ce que les assertions ne peuvent pas juger.
{
  const seed = buildDocumentSeed('editorial', 'businessplan:demo');
  const ds = buildDocumentDesignSystem(CHARTER, { styleId: 'editorial' } as any, seed);
  const base = buildSectionSeed('editorial', 'businessplan:demo', 'Opportunity', new Set());

  const pages = IMPLEMENTED_ARCHETYPES.map((archetype) => {
    const html = renderSection(CONTENT, ds, { ...base, archetype }, {
      brandName: 'Café des Hauts',
      index: 3,
    });
    return `<figure style="margin:0 0 32px"><figcaption style="font:600 13px/1.4 system-ui;color:#555;margin-bottom:8px">Archétype ${archetype}</figcaption>${html}</figure>`;
  });

  const fonts = [CHARTER.typography.primaryFont, CHARTER.typography.secondaryFont]
    .map((family) => `family=${family.replace(/ /g, '+')}:wght@300;400;500;700;800;900`)
    .join('&');

  const preview = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Aperçu — 12 archétypes</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>body{margin:0;padding:32px;background:#e8e8e8;display:flex;flex-wrap:wrap;gap:32px;justify-content:center}</style>
</head><body>
${pages.join('\n')}
</body></html>`;

  const target = resolve(__dirname, '../../logs/render-preview.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, preview, 'utf-8');
  console.log(`\n     Aperçu écrit : ${target}`);
  console.log('     À ouvrir dans un navigateur pour juger ce qu\'aucune assertion ne juge.');
}

console.log('');
if (failures > 0) {
  console.error(`Rendu: ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('Rendu: toutes les vérifications passent.\n');
