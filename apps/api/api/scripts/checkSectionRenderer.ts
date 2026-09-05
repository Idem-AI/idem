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

import { mkdirSync, readFileSync, writeFileSync } from 'fs';

import { parseLlmJson } from '../utils/llm-json.util';
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
import {
  IMPLEMENTED_ARCHETYPES,
  LANDSCAPE_SLIDE,
  renderSection,
} from '../services/design/sectionRenderer';
import { lintHtml } from '../services/design/slopLint.service';
import { inspectOutput } from '../services/agents/quality-gate';

/**
 * Retire les `<link>` de polices d'un rendu, comme le fait le paginateur.
 *
 * Modéliser ici ce que le runtime fait vraiment est le point : le harnais ne
 * doit pas vérifier une structure PLUS stricte que celle qui est exigée en
 * production, sinon il refuse des rendus corrects et finit par être désactivé.
 */
function stripFontLinks(html: string): string {
  return html.replace(/<link\b[^>]*>\s*/g, '');
}


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
console.log('\nCompatibilité du paginateur (portrait, multi-pages)');
{
  const seed = buildDocumentSeed('editorial', 'businessplan:demo');
  const ds = buildDocumentDesignSystem(CHARTER, { styleId: 'editorial' } as any, seed);
  const base = buildSectionSeed('editorial', 'businessplan:demo', 'Opportunity', new Set());

  // Le paginateur prend les ENFANTS DIRECTS de la racine pour blocs : si le flux
  // est enveloppé, il ne voit qu'un bloc géant, insécable, et une section de
  // plus d'une page est réduite à l'échelle ou rognée.
  const html = renderSection(CONTENT, ds, base, { brandName: 'Café des Hauts' });
  // Le rendu émet d'abord les `<link>` de chargement des polices. Le paginateur
  // les ignore — il ne retient que les enfants dont le `display` calculé n'est
  // pas `none`, et la feuille de style utilisateur pose `link { display: none }`
  // — mais l'analyse textuelle ci-dessous, elle, doit les écarter explicitement,
  // sans quoi elle prendrait un `<link>` pour la racine de la page.
  const root = stripFontLinks(html).trim();
  const inner = root.slice(root.indexOf('>') + 1, root.lastIndexOf('</div>'));
  // Compte les éléments de PREMIER niveau du corps de la racine.
  let depth = 0;
  let topLevel = 0;
  for (const match of inner.matchAll(/<(\/?)div\b/g)) {
    if (match[1] === '/') depth -= 1;
    else {
      if (depth === 0) topLevel += 1;
      depth += 1;
    }
  }
  check(
    'les blocs sont des enfants DIRECTS de la racine',
    topLevel >= CONTENT.blocks.length,
    `${topLevel} enfants de premier niveau pour ${CONTENT.blocks.length} blocs + en-tête + pied`
  );

  // Le décor doit rester hors flux, sinon il compte comme un bloc.
  const withBackdrop = stripFontLinks(renderSection(CONTENT, ds, { ...base, archetype: 'J' }, {}));
  check('le décor de fond est hors flux (position absolue)',
    /position:absolute/.test(withBackdrop));

  // Le retrait de l'archétype doit être sur la racine : c'est `insetsOf(root)`
  // que le paginateur lit pour calculer la capacité d'une page.
  const inset = stripFontLinks(renderSection(CONTENT, ds, { ...base, archetype: 'E' }, {}));
  const rootTag = inset.slice(0, inset.indexOf('>'));
  check('le retrait de l\'archétype est porté par le padding de la racine',
    /padding:[^;"]*mm[^;"]*mm/.test(rootTag), rootTag.match(/padding:[^;"]*/)?.[0] ?? 'absent');

  // Aucune colonne CSS sur la racine : `column-count` casserait la mesure en
  // lignes du paginateur.
  check('aucune colonne CSS sur la racine en portrait', !/column-count/.test(html));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nPaysage (16:9, page rognée)');
{
  const seed = buildDocumentSeed('futuristic', 'pitchdeck:demo');
  const ds = buildDocumentDesignSystem(CHARTER, { styleId: 'futuristic' } as any, seed);
  const base = buildSectionSeed('futuristic', 'pitchdeck:demo', 'Market', new Set());

  // Un slide porte moins de matière qu'une page A4 : le contenu d'exemple est
  // tronqué pour rester réaliste.
  const slideContent = { ...CONTENT, blocks: CONTENT.blocks.slice(0, 4) };

  const slides = IMPLEMENTED_ARCHETYPES.map((archetype) =>
    renderSection(slideContent, ds, { ...base, archetype }, {
      page: LANDSCAPE_SLIDE,
      multiPage: false,
      brandName: 'Café des Hauts',
    })
  );

  check('chaque archétype produit un slide distinct',
    new Set(slides).size === slides.length);

  check('le format 16:9 est appliqué',
    slides.every((html) => html.includes('width:297mm') && html.includes('167mm')));

  // Sur une page ROGNÉE, la hauteur est FIXE : sans cela le contenu déborderait
  // silencieusement au lieu d'être visiblement coupé.
  check('la hauteur est fixée et le débordement masqué',
    slides.every((html) => /height:167mm/.test(html) && /overflow:hidden/.test(html)));

  // La composition doit exploiter la largeur : un flux vertical sur un 16:9
  // laisse une bande vide à droite.
  check('la composition utilise des colonnes',
    slides.every((html) => /grid-template-columns/.test(html)));

  const lintFailures = slides.filter(
    (html) =>
      lintHtml(html, {
        palette: CHARTER.colors.colors,
        extraAllowedColors: derivedPalette(ds),
        fonts: [CHARTER.typography.primaryFont, CHARTER.typography.secondaryFont],
        styleId: 'futuristic',
      }).errorCount > 0
  );
  check('aucun slide ne viole la charte', lintFailures.length === 0);

  // L'échelle resserrée doit rester lisible.
  check('l\'échelle resserrée reste lisible (≥ 9px)',
    !/font-size:[0-8]px/.test(slides.join('')));

  // ── AJUSTEMENT À LA PAGE ────────────────────────────────────────────────
  // Sur un format rogné, ce qui dépasse est COUPÉ, souvent en pleine phrase.
  // Le rendu doit donc écarter les blocs qui ne tiennent pas — visiblement,
  // pas silencieusement.
  const overloaded = {
    ...CONTENT,
    blocks: [...CONTENT.blocks, ...CONTENT.blocks, ...CONTENT.blocks],
  };
  const fitted = renderSection(overloaded as any, ds, base, {
    page: LANDSCAPE_SLIDE,
    multiPage: false,
    brandName: 'Café des Hauts',
  });
  const full = renderSection(overloaded as any, ds, base, { brandName: 'Café des Hauts' });

  check(
    'une page rognée écarte le surplus au lieu de le laisser couper',
    fitted.length < full.length * 0.6,
    `${Math.round(fitted.length / 4)} tok rognée contre ${Math.round(full.length / 4)} tok paginée`
  );

  // …et le poids retenu doit rester sous la capacité du format.
  const kept = (fitted.match(/data-keep-together/g) || []).length;
  check('la page rognée ne retient qu\'une poignée de blocs', kept <= 6, `${kept} blocs insécables`);

  // Le format PAGINÉ, lui, ne doit RIEN écarter : le paginateur s'en charge.
  check(
    'un format paginé conserve tout le contenu',
    full.includes('Bafoussam') && full.includes('2,3 Md FCFA'),
    'du contenu a été écarté alors que la pagination pouvait l\'absorber'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nBlocs spécimens (charte)');
{
  const seed = buildDocumentSeed('editorial', 'branding:demo');
  const ds = buildDocumentDesignSystem(CHARTER, { styleId: 'editorial' } as any, seed);
  const base = buildSectionSeed('editorial', 'branding:demo', 'Color Palette', new Set());
  const palette = CHARTER.colors.colors;

  // Un spécimen ne vient JAMAIS du modèle : la normalisation doit le refuser.
  const fromModel = normalizeSectionContent({
    title: 'Palette',
    blocks: [
      { kind: 'swatches', items: [{ hex: '#BADA55', name: 'Inventée' }] },
      { kind: 'prose', paragraphs: ['une règle'] },
    ],
  });
  check(
    'un bloc spécimen produit par le MODÈLE est refusé',
    fromModel?.blocks.length === 1 && fromModel.blocks[0].kind === 'prose'
  );

  const html = renderSection(
    {
      title: 'La palette',
      blocks: [
        { kind: 'swatches', items: [
          { hex: palette.primary, name: 'Primaire', role: 'Surfaces' },
          { hex: palette.accent, name: 'Accent', role: 'Emphase' }] },
        { kind: 'typeSpecimen', specimens: [
          { family: CHARTER.typography.primaryFont, role: 'Titres', sample: 'Café des Hauts' }] },
        { kind: 'logoDisplay', variants: [
          { url: 'https://example.test/logo.svg', label: 'Sur fond clair', background: 'light' }] },
      ],
    },
    ds,
    base,
    { page: LANDSCAPE_SLIDE, multiPage: false, brandName: 'Café des Hauts' }
  );

  check('les valeurs hexadécimales du nuancier sont EXACTES',
    html.includes(palette.primary.toUpperCase()) && html.includes(palette.accent.toUpperCase()));
  check('le contraste de chaque teinte est affiché', /contraste \d/.test(html));
  check('le spécimen est rendu dans la vraie police',
    html.includes(`'${CHARTER.typography.primaryFont}'`));
  check('la déclinaison du logo porte un alt', /<img[^>]*alt="Sur fond clair"/.test(html));
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

  const section = (label: string, html: string) =>
    `<figure style="margin:0"><figcaption style="font:600 13px/1.4 system-ui;color:#555;margin-bottom:8px">${label}</figcaption>${html}</figure>`;

  // 1. Les douze archétypes en PORTRAIT (business plan).
  const portrait = IMPLEMENTED_ARCHETYPES.map((archetype) =>
    section(
      `Portrait A4 — archétype ${archetype}`,
      renderSection(CONTENT, ds, { ...base, archetype }, {
        brandName: 'Café des Hauts',
        index: 3,
      })
    )
  );

  // 2. Les douze archétypes en PAYSAGE (deck, charte).
  const slideSeed = buildDocumentSeed('futuristic', 'pitchdeck:demo');
  const slideDs = buildDocumentDesignSystem(CHARTER, { styleId: 'futuristic' } as any, slideSeed);
  const slideBase = buildSectionSeed('futuristic', 'pitchdeck:demo', 'Market', new Set());
  const slideContent = { ...CONTENT, blocks: CONTENT.blocks.slice(0, 4) };

  const landscape = IMPLEMENTED_ARCHETYPES.map((archetype) =>
    section(
      `Paysage 16:9 — archétype ${archetype}`,
      renderSection(slideContent, slideDs, { ...slideBase, archetype }, {
        page: LANDSCAPE_SLIDE,
        multiPage: false,
        brandName: 'Café des Hauts',
      })
    )
  );

  // 3. Les pages SPÉCIMENS de la charte : nuancier, typographie, logo. Ce sont
  //    celles où un modèle se trompe le plus, et elles sont ici entièrement
  //    produites par le code.
  const palette = CHARTER.colors.colors;
  const specimenPages = [
    {
      label: 'Charte — nuancier (valeurs exactes, contrastes calculés)',
      content: {
        kicker: 'Couleur',
        title: 'La palette',
        lede: 'Cinq valeurs, un rôle chacune. Les teintes viennent de l\'opacité, jamais d\'un décalage de teinte.',
        blocks: [
          {
            kind: 'swatches' as const,
            items: [
              { hex: palette.primary, name: 'Primaire', role: 'Identité, titres, aplats' },
              { hex: palette.secondary, name: 'Secondaire', role: 'Support, zones calmes' },
              { hex: palette.accent, name: 'Accent', role: 'Chiffres, appels, filets' },
              { hex: palette.background, name: 'Fond', role: 'Surface de page' },
              { hex: palette.text, name: 'Encre', role: 'Texte courant' },
            ],
          },
          {
            kind: 'prose' as const,
            paragraphs: [
              'La primaire tient les surfaces et les titres. L\'accent ne sert qu\'à ce qui doit être lu en premier : un chiffre, un filet, un appel. Une page qui accentue tout n\'accentue rien.',
            ],
          },
        ],
      },
    },
    {
      label: 'Charte — typographie (spécimens dans la vraie police)',
      content: {
        kicker: 'Typographie',
        title: 'Deux familles, trois registres',
        blocks: [
          {
            kind: 'typeSpecimen' as const,
            specimens: [
              { family: CHARTER.typography.primaryFont, role: 'Titres', sample: 'Café des Hauts' },
              {
                family: CHARTER.typography.secondaryFont,
                role: 'Texte courant',
                sample: 'La typographie porte la voix de la marque avant les mots.',
              },
            ],
          },
        ],
      },
    },
  ];

  const specimens = specimenPages.map((page, index) =>
    section(
      page.label,
      renderSection(
        page.content as any,
        ds,
        buildSectionSeed('editorial', 'branding:demo', page.label, new Set()),
        { page: LANDSCAPE_SLIDE, multiPage: false, brandName: 'Café des Hauts', index: index + 1 }
      )
    )
  );

  const fonts = [CHARTER.typography.primaryFont, CHARTER.typography.secondaryFont]
    .map((family) => `family=${family.replace(/ /g, '+')}:wght@300;400;500;700;800;900`)
    .join('&');

  const group = (title: string, items: string[]) =>
    `<h2 style="font:700 20px/1.3 system-ui;color:#222;width:100%;margin:40px 0 4px">${title}</h2>
     <div style="display:flex;flex-wrap:wrap;gap:32px;justify-content:center;width:100%">${items.join('')}</div>`;

  const preview = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Aperçu — rendu par gabarit</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>body{margin:0;padding:32px;background:#e8e8e8;display:flex;flex-wrap:wrap;gap:0;justify-content:center;font-family:system-ui}</style>
</head><body>
${group('Portrait A4 — business plan (paginé)', portrait)}
${group('Paysage 16:9 — pitch deck et charte (une page, rognée)', landscape)}
${group('Pages spécimens — produites entièrement par le code', specimens)}
</body></html>`;

  const target = resolve(__dirname, '../../logs/render-preview.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, preview, 'utf-8');
  console.log(`\n     Aperçu écrit : ${target}`);
  console.log(`     ${portrait.length} portraits + ${landscape.length} paysages + ${specimens.length} pages spécimens.`);
  console.log('     À ouvrir dans un navigateur pour juger ce qu\'aucune assertion ne juge.');
}


// ── DÉFAUTS CONSTATÉS SUR UN LIVRABLE RÉEL ─────────────────────────────────
//
// Chacune de ces vérifications répond à un défaut observé sur un business plan
// livré, pas à une crainte. Elles sont écrites après coup, ce qui est le seul
// moment où l'on sait ce qu'il fallait vérifier.
console.log('\n  Défauts observés sur un business plan livré');

{
  const dsx = buildDocumentDesignSystem(CHARTER, { styleId: 'editorial' } as any,
    buildDocumentSeed('editorial', 'businessplan:demo'));
  const sx = () => buildSectionSeed('editorial', 'bp:demo', 'S');

  // 1. LE JSON TRONQUÉ EST RÉCUPÉRÉ. Trois pages sont sorties en JSON brut parce
  //    que la réponse avait été coupée par le budget et que rien ne la refermait.
  const truncated =
    '{"kicker":"K","title":"T","lede":"L","blocks":[' +
    '{"kind":"prose","paragraphs":["Un paragraphe complet."]},' +
    '{"kind":"table","headers":["A","B"],"rows":[["1","2"]],"caption":"C"},' +
    '{"kind":"cards","items":[{"title":"Titre coupe","body":"corps inach';
  const salvaged = normalizeSectionContent(parseLlmJson(truncated));
  check('un contenu TRONQUÉ est récupéré au dernier bloc complet',
    salvaged !== null && salvaged.blocks.length === 2,
    salvaged ? `${salvaged.blocks.length} bloc(s)` : 'perdu');

  // 2. LES POLICES DE LA CHARTE SONT CHARGÉES. Elles étaient nommées dans le CSS
  //    et jamais chargées : tous les projets sortaient dans le même serif.
  const withFonts = renderSection(CONTENT, dsx, sx(), {});
  check('les polices de la charte sont réellement chargées',
    /fonts\.googleapis\.com\/css2\?family=/.test(withFonts),
    withFonts.includes('<link') ? 'liens présents' : 'AUCUN lien');
  check('les liens de police précèdent la racine (invisibles du paginateur)',
    withFonts.indexOf('<link') >= 0 && withFonts.indexOf('<link') < withFonts.indexOf('<div'));

  // 3. LE TYPE DE GRAPHIQUE EST HONORÉ. Tout sortait en barres, y compris les
  //    parts d'un tout et les évolutions dans le temps.
  const chartOf = (kind: string) => renderSection(
    { kicker: 'K', title: 'T', lede: 'L', blocks: [{ kind: 'chart', chartType: kind,
      labels: ['A', 'B'], series: [{ name: 'S', data: [1, 2] }], readingKey: 'R' }] } as any,
    dsx, sx(), {}).replace(/&quot;/g, '"');
  const expectations: Array<[string, string]> = [
    ['line', '"type":"line"'], ['area', '"fill":true'], ['pie', '"type":"pie"'],
    ['doughnut', '"type":"doughnut"'], ['radar', '"type":"radar"'],
    ['stacked', '"stacked":true'], ['horizontalBar', '"indexAxis":"y"'],
  ];
  for (const [kind, expected] of expectations) {
    check(`graphique « ${kind} » : configuration Chart.js conforme`,
      chartOf(kind).includes(expected), expected);
  }
  check('un repli statique subsiste sous le canvas (éditeurs sans Chart.js)',
    /data-chart-fallback/.test(chartOf('pie')));

  // 4. LES TITRES NE FONT PLUS L'ESCALIER. « Goal Planning & Operational
  //    Milestones » occupait cinq lignes, soit la moitié de la page.
  for (const long of ['Goal Planning & Operational Milestones',
                      'Appendix: Operational & Financial Records']) {
    let stacked = false;
    for (const archetype of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
      const html = renderSection({ kicker: 'K', title: long, lede: 'L',
        blocks: [{ kind: 'prose', paragraphs: ['x'] }] } as any,
        dsx, { ...sx(), archetype } as any, {});
      const h1 = /<h1[^>]*>([^]*?)<[/]h1>/.exec(html);
      if (h1 && h1[1].indexOf('<br>') >= 0) stacked = true;
    }
    check(`« ${long.slice(0, 26)}… » n'est jamais empilé mot à mot`, !stacked);
  }

  // 5. LA SORTIE BRUTE NE REDEVIENT JAMAIS UNE PAGE. C'est la règle la plus
  //    stricte du rendu, et elle ne se vérifie pas depuis une valeur de retour :
  //    elle vit dans deux chemins de service qui doivent LEVER plutôt que
  //    renvoyer ce qu'ils n'ont pas su lire. On garde donc les deux endroits par
  //    leur source — c'est une vérification de non-régression sur une ligne
  //    précise qui a été retirée, pas un contrôle de style.
  const guarded: Array<[string, string]> = [
    ['generic.service.ts', '../services/common/generic.service.ts'],
    ['research-team.service.ts', '../services/research/research-team.service.ts'],
  ];
  for (const [label, rel] of guarded) {
    const src = readFileSync(resolve(__dirname, rel), 'utf-8');
    // Le repli fautif renvoyait/conservait `content` quand l'analyse échouait.
    const hasRawFallback = /sortie brute conservée|repli sur la sortie brute/.test(src);
    check(`${label} : la sortie illisible n'est jamais conservée`, !hasRawFallback);
    check(`${label} : la sortie illisible fait LEVER`,
      /jamais une page|jamais UNE PAGE/i.test(src) && /throw new Error/.test(src));
  }

  const orphan = renderSection({ kicker: 'K', title: 'Products & Service Infrastructure',
    lede: 'L', blocks: [{ kind: 'prose', paragraphs: ['x'] }] } as any, dsx, sx(), {});
  check('une esperluette ne reste jamais seule en bout de ligne',
    orphan.indexOf('\u00A0') >= 0);
}

console.log('');
if (failures > 0) {
  console.error(`Rendu: ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('Rendu: toutes les vérifications passent.\n');
