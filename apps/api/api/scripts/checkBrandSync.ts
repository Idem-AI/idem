/**
 * Vérification de la propagation d'identité — `npm run check:brand`.
 *
 * Aucun réseau, aucune base, aucun modèle : l'harmonisation et la traduction
 * sont déterministes, elles se vérifient donc sans rien démarrer.
 *
 * Le test central est le plus exigeant qu'on puisse écrire : de VRAIES pages,
 * rendues par le moteur de production avec l'ancienne marque, puis traduites.
 * Après traduction, aucune couleur propre à l'ancienne marque ne doit rester,
 * et aucun texte ne doit être devenu moins lisible.
 *
 *   npx ts-node --transpile-only api/scripts/checkBrandSync.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import { BrandIdentityModel } from '../models/brand-identity.model';
import {
  buildBrandRewriteMap,
  emptyStats,
  repairContrast,
  rewriteBrandDeep,
  rewriteBrandString,
} from '../services/brand/brandRewrite';
import { computeBrandTokens, normalizeHex } from '../services/brand/brandTokens';
import { harmonizePalette, paletteFromLogoColors, transportColor } from '../services/brand/paletteHarmony';
import { hashContent } from '../services/brand/siteBrandSync';
import { adaptLogo, buildLogoColorMapping } from '../services/brand/logoAdapt';
import { contrastRatio, hexToOklch } from '../services/design/color';
import { buildDocumentSeed, buildSectionSeed } from '../services/design/designSeed';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { isLightSurface } from '../services/design/lightSurface';
import { areRolesDistinct } from '../services/design/paletteRoles';
import { SectionContent } from '../services/design/sectionContent';
import { IMPLEMENTED_ARCHETYPES, LANDSCAPE_SLIDE, renderSection } from '../services/design/sectionRenderer';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const STORAGE = 'https://storage.idem.africa/idem/users/u1/projects/p1/logos';

const BEFORE: Partial<BrandIdentityModel> = {
  colors: {
    id: 'c1',
    name: 'Terre et Océan',
    url: '',
    colors: { primary: '#1F4E5F', secondary: '#4A5A60', accent: '#C6553D', background: '#FAF7F2', text: '#0F1B1F' },
  },
  typography: {
    id: 't1',
    name: 'Éditorial',
    url: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Public+Sans:wght@400;600&display=swap',
    primaryFont: 'Fraunces',
    secondaryFont: 'Public Sans',
  },
  logo: {
    id: 'l1',
    name: 'Ancien',
    svg: `${STORAGE}/old.svg`,
    concept: '',
    colors: ['#1f4e5f'],
    fonts: [],
    variations: {
      withText: {
        lightBackground: `${STORAGE}/old-light.svg`,
        darkBackground: `${STORAGE}/old-dark.svg`,
        monochrome: `${STORAGE}/old-mono.svg`,
      },
    },
    assetUrls: { primary: `${STORAGE}/old.png`, withText: { darkBackground: `${STORAGE}/old-dark.png` } },
  },
};

const HOSTED_FONT = 'https://api.fontshare.com/v2/css?f[]=satoshi@400,700&display=swap';

function afterWith(palette: Record<string, string>): Partial<BrandIdentityModel> {
  return {
    ...BEFORE,
    colors: { ...BEFORE.colors!, colors: palette as any },
    typography: {
      id: 't1',
      name: 'Perso',
      url: HOSTED_FONT,
      primaryFont: 'Satoshi',
      secondaryFont: 'Public Sans',
      primary: { family: 'Satoshi', source: 'fontshare', cssUrl: HOSTED_FONT },
    },
    logo: {
      id: 'l2',
      name: 'Nouveau',
      svg: `${STORAGE}/new.svg`,
      concept: '',
      colors: ['#b3261e'],
      fonts: [],
      variations: {
        withText: {
          lightBackground: `${STORAGE}/new-light.svg`,
          darkBackground: `${STORAGE}/new-dark.svg`,
          monochrome: `${STORAGE}/new-mono.svg`,
        },
      },
      assetUrls: { primary: `${STORAGE}/new.png`, withText: { darkBackground: `${STORAGE}/new-dark.png` } },
    },
  };
}

// ─── 1. Harmonisation ───────────────────────────────────────────────────────

console.log('\n1. Harmonisation d’une palette modifiée');
{
  const current = BEFORE.colors!.colors;
  const result = harmonizePalette({ current, changes: { primary: '#B3261E' } });
  const p = result.palette;

  check('la primaire choisie est respectée', p.primary === '#b3261e');
  check('le fond reste clair', isLightSurface(p.background));
  check('encre ≥ 7:1 sur le fond', contrastRatio(p.text, p.background) >= 7, `${contrastRatio(p.text, p.background)}`);
  check('secondaire visible (≥ 3:1)', contrastRatio(p.secondary, p.background) >= 3);
  check('accent visible (≥ 3:1)', contrastRatio(p.accent, p.background) >= 3);
  check('rôles distincts', areRolesDistinct(p.primary, p.secondary) && areRolesDistinct(p.accent, p.primary));

  // Le TRANSPORT garde la relation de teinte : l'accent terracotta était à
  // ~+190° de la primaire bleu-pétrole ; il doit rester à ~+190° du rouge.
  const hue = (hex: string) => hexToOklch(hex)!.h;
  const delta = (a: number, b: number) => ((a - b + 540) % 360) - 180;
  const before = delta(hue(current.accent), hue(current.primary));
  const after = delta(hue(p.accent), hue(p.primary));
  // Écart CIRCULAIRE, tolérance de 20° : un rouge très saturé sort du gamut
  // sRGB et l'écrêtage déplace légèrement la teinte.
  const drift = Math.abs(delta(after, before));
  check('l’accent garde son écart de teinte à la primaire', drift < 20, `${before.toFixed(0)}° → ${after.toFixed(0)}° (dérive ${drift.toFixed(0)}°)`);

  const kept = harmonizePalette({ current, changes: { primary: '#B3261E' }, keep: ['accent'] });
  check('un rôle conservé n’est pas transporté', kept.palette.accent === normalizeHex(current.accent));

  const dark = harmonizePalette({ current, changes: { primary: '#B3261E', background: '#101010' } });
  check('un fond sombre explicite est respecté mais signalé', dark.palette.background === '#101010' && dark.warnings.length > 0);
  check('et l’encre y reste lisible', contrastRatio(dark.palette.text, dark.palette.background) >= 7);

  const unreadable = harmonizePalette({ current, changes: { text: '#EEEEEE' } });
  check('une encre explicite illisible est remontée au plancher 4,5:1', contrastRatio(unreadable.palette.text, unreadable.palette.background) >= 4.5);

  const mono = harmonizePalette({ current, changes: { primary: '#111111' } });
  check('marque monochrome : l’accent garde sa couleur', mono.palette.accent === normalizeHex(current.accent));
  check('marque monochrome : palette valide', contrastRatio(mono.palette.text, mono.palette.background) >= 7);

  const fromLogo = paletteFromLogoColors(['#ffffff', '#0B6E4F', '#F2A541'], current);
  check('palette depuis le logo : la première couleur vive devient la primaire', fromLogo.palette.primary === '#0b6e4f');

  check('un fond teinté d’une autre teinte que la marque reste tel quel (crème reste crème)',
    transportColor('#FAF7F2', '#1F4E5F', '#B3261E', 'background') === '#FAF7F2');
  check('un fond teinté de la marque suit la marque sans changer de clarté', (() => {
    const tinted = '#EEF4F6'; // blanc bleu-pétrole, teinte de #1F4E5F
    const moved = transportColor(tinted, '#1F4E5F', '#B3261E', 'background');
    const hueGap = Math.abs(((hexToOklch(moved)!.h - hexToOklch('#B3261E')!.h + 540) % 360) - 180);
    return moved !== tinted && Math.abs(hexToOklch(moved)!.l - hexToOklch(tinted)!.l) < 0.01 && hueGap < 40;
  })());

  const empty = harmonizePalette({ current: {}, changes: {} });
  check('sans palette, une palette complète est construite', Object.values(empty.palette).every((hex) => /^#[0-9a-f]{6}$/.test(hex)));
}

// ─── 2. Syntaxes de couleur ─────────────────────────────────────────────────

console.log('\n2. Traduction : toutes les écritures d’une couleur');
{
  const after = afterWith({ primary: '#B3261E', secondary: '#4A5A60', accent: '#C6553D', background: '#FAF7F2', text: '#0F1B1F' });
  const map = buildBrandRewriteMap(BEFORE, after);
  const newPrimary = '#b3261e';

  const cases: Array<[string, string, string]> = [
    ['hex minuscule', 'color:#1f4e5f', `color:${newPrimary}`],
    ['hex en capitales (casse gardée)', '<div>#1F4E5F</div>', `<div>${newPrimary.toUpperCase()}</div>`],
    ['hex + opacité', 'background:#1f4e5f33', `background:${newPrimary}33`],
    ['SVG encodé', "url(\"data:image/svg+xml,%3Csvg fill='%231f4e5f'\")", `url("data:image/svg+xml,%3Csvg fill='%23${newPrimary.slice(1)}'")`],
    ['rgba()', 'box-shadow:0 8px 32px rgba(31,78,95,0.12)', 'box-shadow:0 8px 32px rgba(179, 38, 30, 0.12)'],
    ['rgb() en espaces', 'color: rgb(31 78 95 / 50%)', 'color: rgb(179 38 30 / 50%)'],
    ['classe Tailwind arbitraire', 'class="bg-[#1f4e5f]"', `class="bg-[${newPrimary}]"`],
  ];
  for (const [label, input, expected] of cases) {
    const output = rewriteBrandString(input, map);
    check(label, output === expected, `${input} → ${output}`);
  }

  check('une ancre qui ressemble à un hex n’est pas touchée', rewriteBrandString('href="#faq"', map) === 'href="#faq"');
  check('blanc et noir purs ne sont pas traduits', rewriteBrandString('color:#ffffff;background:#000', map) === 'color:#ffffff;background:#000');
  check('rien à traduire ⇒ même référence', (() => { const s = '<p>bonjour</p>'; return rewriteBrandString(s, map) === s; })());
}

// ─── 3. Polices ────────────────────────────────────────────────────────────

console.log('\n3. Traduction : polices');
{
  const after = afterWith({ ...BEFORE.colors!.colors });
  const map = buildBrandRewriteMap(BEFORE, after);

  check('famille entre guillemets', rewriteBrandString("font-family:'Fraunces',serif", map) === "font-family:'Satoshi',serif");
  check('famille échappée dans un attribut', rewriteBrandString('style="font-family:&quot;Fraunces&quot;"', map) === 'style="font-family:&quot;Satoshi&quot;"');
  check('classe Tailwind font-[…]', rewriteBrandString("font-['Fraunces']", map) === "font-['Satoshi']");
  check('famille nue dans font-family', rewriteBrandString('font-family: Fraunces, serif;', map) === 'font-family: Satoshi, serif;');
  check('police inchangée laissée telle quelle', rewriteBrandString("font-family:'Public Sans'", map) === "font-family:'Public Sans'");

  const html =
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&amp;display=swap" rel="stylesheet">' +
    '<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400&amp;display=swap" rel="stylesheet"><p>x</p>';
  const out = rewriteBrandString(html, map);
  check('le lien Google de l’ancienne famille disparaît', !/family=Fraunces/.test(out), out);
  check('la feuille hébergée de la nouvelle famille est posée', out.includes('api.fontshare.com'), out);
  check('le texte du document est intact', out.endsWith('<p>x</p>'));

  const swapped = buildBrandRewriteMap(BEFORE, {
    ...BEFORE,
    typography: { ...BEFORE.typography!, primaryFont: 'Public Sans', secondaryFont: 'Fraunces' },
  });
  check(
    'échange titre ↔ texte en une passe',
    rewriteBrandString("a{font-family:'Fraunces'}b{font-family:'Public Sans'}", swapped) ===
      "a{font-family:'Public Sans'}b{font-family:'Fraunces'}"
  );
}

// ─── 4. Logos ──────────────────────────────────────────────────────────────

console.log('\n4. Traduction : logos');
{
  const after = afterWith({ ...BEFORE.colors!.colors });
  const map = buildBrandRewriteMap(BEFORE, after);

  check('la déclinaison fond sombre devient la nouvelle déclinaison fond sombre',
    rewriteBrandString(`<img src="${STORAGE}/old-dark.png">`, map) === `<img src="${STORAGE}/new-dark.png">`);
  check('le logo primaire devient le nouveau primaire',
    rewriteBrandString(`<img src="${STORAGE}/old.png">`, map) === `<img src="${STORAGE}/new.png">`);

  const inlineBefore = { ...BEFORE, logo: { ...BEFORE.logo!, svg: '<svg><path fill="#1f4e5f"/></svg>', assetUrls: undefined, variations: undefined } };
  const inlineMap = buildBrandRewriteMap(inlineBefore, after);
  const dataUri = `data:image/svg+xml;base64,${Buffer.from('<svg><path fill="#1f4e5f"/></svg>').toString('base64')}`;
  check('un logo en data: URI est remplacé', rewriteBrandString(`<img src="${dataUri}">`, inlineMap).includes(`${STORAGE}/new`));

  const without = afterWith({ ...BEFORE.colors!.colors });
  without.logo = { ...without.logo!, variations: undefined, assetUrls: { primary: `${STORAGE}/new.png` } };
  const fallback = buildBrandRewriteMap(BEFORE, without);
  check('déclinaison absente : repli sur le nouveau logo, jamais l’ancien',
    rewriteBrandString(`<img src="${STORAGE}/old-mono.svg">`, fallback) !== `<img src="${STORAGE}/old-mono.svg">`);
}

// ─── 5. Pages réelles ──────────────────────────────────────────────────────

console.log('\n5. Pages réelles rendues par le moteur de production');

const CONTENT: SectionContent = {
  kicker: 'Couleurs',
  title: 'La palette de la marque',
  lede: 'Cinq valeurs, chacune avec un rôle.',
  blocks: [
    {
      kind: 'swatches',
      items: [
        { hex: '#1F4E5F', name: 'Primaire', role: 'Titres et aplats' },
        { hex: '#4A5A60', name: 'Secondaire', role: 'Surfaces' },
        { hex: '#C6553D', name: 'Accent', role: 'Appel à l’action' },
        { hex: '#FAF7F2', name: 'Fond', role: 'Page' },
        { hex: '#0F1B1F', name: 'Encre', role: 'Texte' },
      ],
    },
    {
      kind: 'metrics',
      items: [
        { value: '3', label: 'couleurs de marque' },
        { value: '7:1', label: 'contraste de l’encre' },
      ],
    },
    { kind: 'prose', paragraphs: ['La primaire porte les titres ; l’accent est réservé à un seul appel par page.'] },
    {
      kind: 'cards',
      items: [
        { title: 'Aplats', body: 'La primaire en grand.', emphasis: true },
        { title: 'Filets', body: 'La secondaire en fin.' },
      ],
    },
  ],
} as SectionContent;

/** Palettes cibles volontairement difficiles : clair, vif, sombre, gris. */
const TARGETS: Record<string, string> = {
  rouge: '#B3261E',
  'jaune clair': '#F2D35B',
  'vert profond': '#0B3D2E',
  anthracite: '#2B2B2B',
};

const OLD_DS = buildDocumentDesignSystem(BEFORE as any, null, buildDocumentSeed('editorial', 'check'));
const HEX_IN = /#[0-9a-fA-F]{6}\b/g;

function hexesOf(html: string): Set<string> {
  return new Set((html.match(HEX_IN) ?? []).map((hex) => hex.toLowerCase()));
}

const previews: string[] = [];

for (const [label, primary] of Object.entries(TARGETS)) {
  const harmonized = harmonizePalette({ current: BEFORE.colors!.colors, changes: { primary } }).palette;
  const after = afterWith(harmonized);
  const map = buildBrandRewriteMap(BEFORE, after);
  const newTokens = new Set(computeBrandTokens(after).colors.map(([, hex]) => hex));
  // Les couleurs PROPRES à l'ancienne marque : absentes de la nouvelle.
  const stale = [...map.colors.keys()].filter((hex) => !newTokens.has(hex));

  let pages = 0;
  let leaks = 0;
  let unreadable = 0;
  let staleLabels = 0;
  for (const archetype of IMPLEMENTED_ARCHETYPES) {
    for (const landscape of [false, true]) {
      const seed = { ...buildSectionSeed('editorial', 'check', `Couleurs ${archetype}`, new Set()), archetype };
      const html = renderSection(CONTENT, OLD_DS, seed, {
        logoUrl: `${STORAGE}/old-dark.png`,
        brandName: 'Café des Hauts',
        ...(landscape ? { page: LANDSCAPE_SLIDE, multiPage: false } : {}),
      });
      const stats = emptyStats();
      const out = rewriteBrandString(html, map, stats);
      pages++;

      const remaining = [...hexesOf(out)].filter((hex) => stale.includes(hex));
      if (remaining.length) leaks++;
      if (out.includes('old-dark.png')) leaks++;

      // Aucun texte moins lisible qu'avant (plafond 4,5:1).
      const probe = emptyStats();
      if (repairContrast(html, out, probe) !== out) unreadable++;

      // Chaque « contraste N:1 » annonce le ratio de SA nouvelle teinte.
      for (const [, hex, ratio] of out.matchAll(/data-contrast-of="(#[0-9a-fA-F]{6})"[^>]*>[^<]*?(\d+(?:\.\d+)?):1/g)) {
        const ink = contrastRatio('#ffffff', hex) >= 4.5 ? '#ffffff' : '#000000';
        if (Math.abs(Number(ratio) - Math.round(contrastRatio(ink, hex) * 10) / 10) > 0.05) staleLabels++;
      }

      if (archetype === IMPLEMENTED_ARCHETYPES[0] && !landscape) {
        previews.push(`<section><h2>${label} — avant</h2>${html}<h2>${label} — après</h2>${out}</section>`);
      }
    }
  }
  check(`${label} : aucune couleur ni logo de l’ancienne marque sur ${pages} pages`, leaks === 0, `${leaks} page(s) avec résidu`);
  check(`${label} : aucun texte devenu moins lisible`, unreadable === 0, `${unreadable} page(s)`);
  check(`${label} : les ratios de contraste affichés sont recalculés`, staleLabels === 0, `${staleLabels} mention(s) périmée(s)`);
}

// ─── 6. Données profondes ──────────────────────────────────────────────────

console.log('\n6. Traduction de structures enregistrées');
{
  const after = afterWith({ ...BEFORE.colors!.colors, primary: '#B3261E' });
  const map = buildBrandRewriteMap(BEFORE, after);
  const stored = {
    sections: [
      { id: '#1f4e5f', name: 'Couverture', data: '<div style="background:#1f4e5f">x</div>' },
      { id: 's2', name: 'Texte', data: '<p>sans couleur</p>' },
    ],
    createdAt: new Date(),
  };
  const stats = emptyStats();
  const out = rewriteBrandDeep(stored, map, stats);
  check('la page colorée est traduite', out.sections[0].data.includes('#b3261e'));
  check('un identifiant n’est jamais traduit', out.sections[0].id === '#1f4e5f');
  check('une page inchangée garde sa référence', out.sections[1] === stored.sections[1]);
  check('une date reste une date', out.createdAt instanceof Date);
  check('structure intacte ⇒ même référence', rewriteBrandDeep(stored.sections[1], map) === stored.sections[1]);
}

// ─── 7 bis. Logo adapté sans IA ─────────────────────────────────────────────

console.log('\n7 bis. Logo recoloré sans IA');
async function checkLogoAdaptation(): Promise<void> {
  const oldPalette = BEFORE.colors!.colors;
  const newPalette = harmonizePalette({ current: oldPalette, changes: { primary: '#B3261E' } }).palette;

  const mapping = buildLogoColorMapping(['#1F4E5F', '#2A6478', '#C6553D', '#333333', '#FFFFFF'], oldPalette, newPalette);
  check('la couleur principale du logo devient la nouvelle principale', mapping['#1f4e5f'] === newPalette.primary);
  check('une nuance de la principale reste une nuance de la nouvelle', !!mapping['#2a6478'] && mapping['#2a6478'] !== newPalette.primary);
  check('l’accent du logo devient le nouvel accent', mapping['#c6553d'] === newPalette.accent);
  check('gris et blanc ne bougent pas', !('#333333' in mapping) && !('#ffffff' in mapping));

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<style>.a{fill:#1F4E5F}</style>' +
    '<defs><linearGradient id="g"><stop offset="0" stop-color="#1F4E5F"/><stop offset="1" stop-color="#C6553D"/></linearGradient></defs>' +
    '<rect class="a" width="40" height="40"/><circle cx="70" cy="70" r="20" fill="url(#g)"/>' +
    '<path d="M0 90h100" stroke="#333333"/></svg>';
  const logo = { id: 'l', name: 'L', svg, concept: '', colors: ['#1F4E5F', '#C6553D'], fonts: [] };
  const adapted = await adaptLogo(logo as any, { palette: { before: oldPalette, after: newPalette } });
  const out = (adapted?.svg ?? '').toLowerCase();
  check('logo recoloré', !!adapted?.recolored);
  check('classe CSS recolorée', out.includes(newPalette.primary) && !out.includes('#1f4e5f'), out.slice(0, 200));
  check('dégradé recoloré', out.includes(newPalette.accent) && !out.includes('#c6553d'));
  check('filet gris intact', out.includes('#333333') || out.includes('#333'));
  check('couleurs du logo mises à jour', adapted?.colors[0] === newPalette.primary);

  const untouched = await adaptLogo(logo as any, { palette: { before: oldPalette, after: oldPalette } });
  check('palette inchangée ⇒ pas d’adaptation', untouched === null);
}

// ─── 7. Manifeste du site ──────────────────────────────────────────────────

console.log('\n7. Empreinte du manifeste iCode');
// Valeurs calculées par `hashContent` du CLIENT (we-dev-client/src/utils/codeSync.ts).
check('cyrb53 identique au client', hashContent('export default {}') === '1jri2lv0s08' && hashContent('body{color:#1f4e5f}') === '133xxb428vq');

void checkLogoAdaptation().then(() => {
  const out = resolve(__dirname, '../../logs/brand-sync-preview.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Propagation d'identité</title><body style="margin:0">${previews.join('')}</body>`);
  console.log(`\nAperçu avant/après : ${out}`);

  if (failures > 0) {
    console.error(`\n${failures} échec(s).`);
    process.exit(1);
  }
  console.log('\nTout est vert.');
});
