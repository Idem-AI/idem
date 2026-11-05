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
import { authorSystem, authorUser } from '../src/author/prompts';
import { assembleLayout, parseLayout } from '../src/author/zones';
import { expandPage, extractHtml, sanitizeHtml } from '../src/runtime/expand';
import { compileTailwind } from '../src/runtime/tailwind';
import { chartHtml, tableHtml } from '../src/runtime/primitives';
import { closeBrowser } from '../src/runtime/browser';
import { QUALITY } from '../src/runtime/check';
import { configureGraphicEngine } from '../src/host';
import { cardFaces } from '../src/adapters/sections';
import { createDocument, GraphicRenderError, renderSingle } from '../src/engine';
import { applyTextEdits } from '../src/runtime/content-map';
import { exportPptx } from '../src/export/pptx';
import { sectionHtml } from '../src/adapters/sections';
import { BRANDS, CARD_BACK, CARD_FRONT, FINANCE_BP, MARKET } from './fixtures';
import { TEXT_BUDGETS } from '../src/content/analyze';
import { slideEssentials } from '../src/content/slide-diet';
import { chartFromTable, parseFigure, withDataChart } from '../src/content/data-charts';
import { coverContent, sectionFromModel } from '../src/adapters/sections';
import { planAssets, resolveAssets } from '../src/asset-planner';

// Les contrôles historiques (§1–§9) comptent les appels d'un auteur unique : le plan qualité créative (exploration,
// variantes, retouche mesurée) y est coupé, puis rallumé et contrôlé à part (§10).
process.env.IDEM_QUALITY_EXPLORE = '0';
process.env.IDEM_QUALITY_SELECT = '0';
process.env.IDEM_QUALITY_REFINE = '0';
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
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
type Mode = 'ok' | 'blank' | 'blank-once' | 'garbage' | 'down' | 'cut-once' | 'cut' | 'cover-once' | 'overlap-once' | 'empty-once' | 'decor-once' | 'crop-once' | 'tiny-once' | 'nochart-once' | 'loud-once' | 'narrow-once' | 'invent' | 'loop-once' | 'iconcard-once' | 'raw-once' | 'zone-incomplete';
let mode: Mode = 'ok';
/** La page que l'auteur simulé rend au premier appel en mode `raw-once` (un défaut relevé sur un PDF réel). */
let rawPage = '';
const calls: Array<{
  role: string;
  level?: CreativityLevel;
  repair: boolean;
  user: string;
  system?: string;
}> = [];
const pageDirections: typeof calls = [];
const layoutCalls: typeof calls = [];
const zoneCalls: typeof calls = [];
/** Le plan simulé : l'en-tête en haut, puis une zone par bloc, empilées (toile fixe) ou en rangées (flux). */
const fakeLayout = (user: string): string => {
  const units = [...user.matchAll(/^- ([\w.:-]+): /gm)].map((m) => m[1]);
  const head = units.filter((u) => ['kicker', 'title', 'lede'].includes(u));
  const rest = units.filter((u) => !head.includes(u)).slice(0, 4);
  const groups = [head, ...rest.map((u) => [u])].filter((g) => g.length);
  // L'en-tête a la hauteur de son titre (le code refuse une zone trop basse pour lui) ; les blocs se partagent le reste.
  const each = Math.max(2, Math.floor((12 - (head.length ? 3 : 0)) / Math.max(1, rest.length)));
  const span = groups.map((g) => (g === head ? 3 : each));
  const starts = span.map((_, i) => 1 + span.slice(0, i).reduce((a, b) => a + b, 0));
  const rows = Math.min(12, span.reduce((a, b) => a + b, 0));
  return JSON.stringify({ columns: 12, rows, background: 'ground', zones: groups.map((g, i) => ({ units: g, col: 1, span: 12, row: starts[i], rows: span[i], align: 'start', intent: 'zone' })) });
};
/** Une zone simulée : chacune de ses clés, ses primitives, à la taille de la zone. */
const fakeZone = (user: string): string => {
  const keys = [...user.matchAll(/^\{\{([\w.:-]+)\}\} = /gm)].map((m) => m[1]);
  const prims = primsOf(user);
  const body = keys.map((k) => (k === 'title' ? `<h2 class="font-display text-[30px] font-bold text-ink">{{title}}</h2>` : /\.url$/.test(k) ? `<img src="{{${k}}}" alt="" class="h-[60px] w-auto self-start object-contain">` : `<p class="text-[12px]">{{${k}}}</p>`)).join('');
  return `\`\`\`html\n<div class="flex h-full w-full flex-col gap-[4px]">${body}${prims.join('')}</div>\n\`\`\``;
};
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
  // Une couleur du nuancier se PEINT (aplat), en plus de son code écrit.
  const hexOf = (k: string) => user.match(new RegExp(`^\\{\\{${k.replace(/[.]/g, '\\.')}\\}\\} = "?(#[0-9a-fA-F]{3,8})`, 'm'))?.[1];
  const swatch = (k: string) => (/\.hex$/.test(k) && hexOf(k) ? `<div class="h-[100px] w-[100px] shrink-0 border border-rule bg-[${hexOf(k)}]"></div>` : '');
  // Une adresse d'image se pose en image (un actif de la marque, en grand), un texte en paragraphe.
  const body = `<p class="text-[12px] uppercase text-brand-primary">{{kicker}}</p><h2 class="font-display text-[36px] font-bold text-ink">{{title}}</h2><p class="text-muted">{{lede}}</p>${keys.map((k) => (/\.url$/.test(k) ? `<img src="{{${k}}}" alt="" class="h-[40%] w-auto self-start object-contain">` : `${swatch(k)}<p data-field="${k}" class="text-[12px]">{{${k}}}</p>`)).join('')}${prims.join('')}<idem-logo class="h-[20px]"></idem-logo>`;
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
      // Le travail divisé : le plan de mise en page et les zones (comptés à part, comme le directeur de page).
      if (role === 'graphic.layout') {
        layoutCalls.push({ role, level, repair, user, system });
        // Dans un mode de défaut, pas de plan : la page retombe sur l'auteur unique (les tests de défauts le visent).
        if (mode !== 'ok' && mode !== 'zone-incomplete') return 'pas de plan';
        return fakeLayout(user);
      }
      if (role === 'graphic.zone') {
        zoneCalls.push({ role, level, repair, user, system });
        // Une zone qui oublie ses contenus au premier essai (redemandée par le code avec la liste de ce qui manque).
        if (mode === 'zone-incomplete' && !/IT IS MISSING/.test(user)) return '```html\n<div class="h-full w-full"></div>\n```';
        return fakeZone(user);
      }
      // Le directeur de page (une petite tâche avant l'auteur) : ses appels sont comptés à part.
      if (role === 'graphic.page-director') {
        pageDirections.push({ role, level, repair, user, system });
        return mode === 'down' ? 'je ne sais pas' : 'FOCAL: the title, large, top left\nZONES: top 30%: title and lede; bottom 70%: the content keys in order\nGROUPS: each figure with its label\nAVOID: decoration';
      }
      calls.push({ role, level, repair, user, system });
      if (mode === 'down') throw new Error('quota');
      if (role === 'graphic.explore')
        return 'TRACK 1: Market stage — the market stall becomes a stage and the trader is the hero of every page.\nTRACK 2: Woven rows — every page is built from narrow woven strips of figures and photos, sewn side by side.\nTRACK 3: One big number — each page is dominated by one huge figure, the rest whispers.\nTRACK 4: Field notebook — pages read like a hand-annotated field notebook with photos pinned on a grid.';
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
      if (!repair && mode === 'raw-once') return `\`\`\`html\n${rawPage}\n\`\`\``;
      if (!repair && mode === 'nochart-once') return '```html\n<div class="flex h-full w-full flex-col bg-ground p-[60px]"><h2 class="text-[40px] text-ink">{{title}}</h2></div>\n```';
      if (mode === 'cut' || (mode === 'cut-once' && !repair))
        return '```html\n<div class="relative h-full w-full bg-ground p-[40px]"><h2 class="absolute left-[40px] top-[1000px] text-[900px] leading-[1]">{{title}}</h2></div>\n```';
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
  layoutCalls.length = 0;
  zoneCalls.length = 0;
  const [m, f] = await Promise.all([
    deck.composeSection(MARKET, { index: 1, total: 2 }),
    deck.composeSection({ ...FINANCE_BP, id: 'finance' }, { index: 2, total: 2 }),
  ]);
  ok(
    'travail divisé : langage et plan (deux appels du directeur), puis par page un plan de mise en page et une zone par agent — aucun auteur de page entière, au cran choisi',
    calls.filter((c) => c.role === 'graphic.director').length === 2 &&
      // (une correction bornée, à partir de la page assemblée, reste possible : elle n'écrit pas la page)
      !calls.some((c) => c.role === 'graphic.author' && !c.repair) &&
      layoutCalls.length === 2 &&
      zoneCalls.length >= 4 &&
      [...calls, ...layoutCalls, ...zoneCalls].every((c) => c.level === 'low'),
    `directeur ${calls.filter((c) => c.role === 'graphic.director').length}, auteur ${calls.filter((c) => c.role === 'graphic.author').length}, plans ${layoutCalls.length}, zones ${zoneCalls.length}, crans ${[...new Set([...calls, ...layoutCalls, ...zoneCalls].map((c) => c.level))].join('/')}, réparations ${[m, f].map((o) => o.result.repairs.map((r) => r.code).join('+')).join(' | ')}`
  );
  ok(
    'le plan de mise en page reçoit le langage de la marque, la grammaire, SA ligne du plan et le support ; chaque zone sa taille, ses seules clés et l’échelle typographique de la page',
    layoutCalls.every((c) => c.user.includes('BRAND VISUAL LANGUAGE') && c.user.includes('THIS PAGE IN THE DOCUMENT PLAN') && c.user.includes('CANVAS:') && c.user.includes('- title:')) &&
      zoneCalls.every((c) => /THIS ZONE: \d+px wide/.test(c.user) && c.user.includes('TYPE SCALE OF THE PAGE')) &&
      zoneCalls.filter((c) => c.user.includes('{{title}} = ')).length === 2
  );
  ok(
    'outils à la demande : une zone sans tableau ne reçoit pas la documentation du tableau',
    zoneCalls.some((c) => c.user.includes('<idem-chart data-block="b2"') && !c.user.includes('<idem-table')) && zoneCalls.some((c) => c.user.includes('<idem-table data-block="b1"'))
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
  layoutCalls.length = 0;
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
      [...calls.slice(before2), ...layoutCalls]
        .some(
          (c) =>
            (c.role === 'graphic.author' || c.role === 'graphic.layout') &&
            c.user.includes('THE CLIENT ASKS FOR THIS LAYOUT: plus aérée')
        )
  );

  zoneCalls.length = 0;
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
  const assetAuthors = [...calls.filter((c) => c.role === 'graphic.author' && !c.repair), ...zoneCalls];
  ok(
    'chaque page d’actif est composée par les agents (plan puis zones, ou auteur) : aucun gabarit du code',
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
  const directed = await createDocument({ documentType: 'flyer', format: 'flyer-square', brand: BRANDS.kora, seed: 'pd', sections: [{ id: 'market' }] });
  await directed.composeSection(MARKET, { index: 1, total: 1 });
  ok(
    'travail divisé (visuel, auteur unique) : le directeur de page décide la hiérarchie, l’auteur la construit',
    pageDirections.length === 1 &&
      /FOCAL: .+\nZONES: /.test(pageDirections[0].system ?? '') &&
      calls.some((c) => c.role === 'graphic.author' && c.user.includes('PAGE LAYOUT DECIDED BY THE ART DIRECTOR') && c.user.includes('FOCAL: the title'))
  );
  const fixedBy = async (m: Mode, content: SectionContent, format: 'slide-16x9' | 'flyer-square' | 'a4-portrait' = 'slide-16x9', documentType: 'pitch-deck' | 'brand-charter' | 'flyer' | 'business-plan' = 'pitch-deck') => {
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
  ok('un logo minuscule sur la page qui le montre : renvoyé à l’auteur (30 % au moins)', tiny.out.result.repairs.some((x) => x.code === 'render_fix') && /shown small|missing or tiny/.test(tiny.prompt));
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
  section('§9 quater Les défauts de la charte AgriLink (30/10/2026), un par un : chacun renvoyé à l’auteur');
  const IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMWI3YTdhIi8+PC9zdmc+';
  const IMG2 = IMG.replace('MWI3YTdh', 'ZmZmZmZm');
  const IMG3 = IMG.replace('MWI3YTdh', 'MDAwMDAw');
  const rawFix = async (html: string, content: SectionContent, page: 'slide-16x9' | 'a4-portrait' = 'slide-16x9') => {
    rawPage = html;
    return page === 'a4-portrait'
      ? fixedBy('raw-once', content, 'a4-portrait', 'business-plan')
      : fixedBy('raw-once', content, 'slide-16x9', 'brand-charter');
  };
  const paletteContent: SectionContent = { id: 'pal', title: 'Palette de couleurs', blocks: [{ id: 'sys-1', kind: 'swatches', origin: 'system', items: [{ hex: '#1B7A7A', name: 'Primaire' }, { hex: '#D4A017', name: 'Secondaire' }] }] };
  const unpainted = await rawFix('<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[60px]"><h2 class="text-[44px]">{{title}}</h2><p>{{sys-1.items.0.name}} {{sys-1.items.0.hex}}</p><p>{{sys-1.items.1.name}} {{sys-1.items.1.hex}}</p></div>', paletteContent);
  ok('palette écrite mais pas peinte (page 7) : renvoyée — chaque couleur en aplat', unpainted.out.result.repairs.some((x) => x.code === 'render_fix') && /palette colours are written but not shown/.test(unpainted.prompt));
  // ── Le texte comprimé (business plan réel, 05/11/2026) ────────────────────────────────────────
  // Un sur-titre insécable prend la largeur de sa ligne entière et renvoie le titre voisin dans une colonne
  // d'un mot de large, sur toute la hauteur. Quinze mots : l'ancien contrôle, qui ne regardait que les
  // paragraphes de trente mots et plus, ne le voyait pas.
  const crushed: SectionContent = { id: 'crush', title: 'AgriLink reaches farmers where they already gather, with a message that costs nothing to understand', kicker: 'FROM STRANGER TO REPEAT BUYER — ACQUISITION CHANNELS', blocks: [{ id: 'c0', kind: 'cards', items: [{ title: 'Canal', body: 'Agents villageois.' }] }] };
  const crushedOut = await rawFix('<div class="flex h-full w-full items-start gap-[40px] bg-ground p-[56px]"><div class="flex-1"><h2 class="font-display text-[44px] font-bold leading-[1.05] text-ink">{{title}}</h2><p class="text-[13px]">{{c0.items.0.title}} {{c0.items.0.body}}</p></div><p class="whitespace-nowrap text-[12px] uppercase tracking-[0.14em] text-brand-primary">{{kicker}}</p></div>', crushed, 'a4-portrait');
  // L'invariant est le REFUS, pas le libellé : un sur-titre insécable sort du cadre ou écrase son voisin selon la
  // page, et les deux constats sont bloquants. Affirmer un message précis rendait ce contrôle fragile.
  ok('un titre de 15 mots écrasé par un sur-titre insécable : la page est renvoyée à l’auteur', /ERROR: /.test(crushedOut.prompt), crushedOut.prompt.match(/ERROR: .*/)?.[0]?.slice(0, 200));
  // Le contrôle géométrique voit un texte cassé mot par mot, que l'ancien (paragraphes de 30 mots et plus) ratait.
  const urlSide: SectionContent = { id: 'url', title: 'The offline farmer is the last untapped node in the value chain', blocks: [{ id: 'p1', kind: 'prose', paragraphs: ['https://documents.worldbank.org/curated/en/agricultural-gdp-cameroon-2022-smallholder-share'] }] };
  const withUrl = await rawFix('<div class="flex h-full w-full items-start gap-[32px] bg-ground p-[56px]"><div class="flex-[2]"><h2 class="font-display text-[40px] font-bold leading-[1.05] text-ink">{{title}}</h2></div><div class="flex-1"><p class="text-[13px] text-muted">{{p1.paragraphs.0}}</p></div></div>', urlSide, 'a4-portrait');
  ok('une URL insécable qui écrase le titre voisin : vue par le contrôle géométrique (12 mots sur 8 lignes)', /crushed into a narrow column/.test(withUrl.prompt), withUrl.prompt.match(/ERROR: .*/)?.[0]?.slice(0, 160));

  const rules: SectionContent = { id: 'rules', title: 'Règles d’usage', blocks: [{ id: 'c1', kind: 'cards', items: [{ title: 'Zone de protection', body: 'Égale à la hauteur du A.' }] }] };
  const shouting = await rawFix('<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[60px]"><h2 class="text-[28px]">{{title}}</h2><p class="text-[30px]">{{c1.items.0.title}}</p><p class="text-[40px] font-bold">{{c1.items.0.body}}</p></div>', rules);
  ok('un texte simple composé comme un titre : renvoyé (taille de texte, seul le titre est grand)', shouting.out.result.repairs.some((x) => x.code === 'render_fix') && /plain text is set like a title/.test(shouting.prompt));
  const darkLogo: SectionContent = { id: 'dark', title: 'Déclinaison sur fond sombre', blocks: [{ id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: IMG2, label: 'Sur fond sombre', background: 'dark' }] }] };
  const onLight = await rawFix('<div class="flex h-full w-full flex-col items-center gap-[16px] bg-ground p-[60px]"><h2 class="text-[40px]">{{title}}</h2><img src="{{sys-1.variants.0.url}}" alt="" class="h-[300px] w-[300px] object-contain"><p>{{sys-1.variants.0.label}}</p></div>', darkLogo);
  ok('le logo « fond sombre » posé sur fond clair (page 5) : renvoyé (aplat sombre autour du logo)', /dark-ground logo sits on a light ground/.test(onLight.prompt), onLight.prompt.match(/ERROR: .*/)?.[0]?.slice(0, 200));
  const symbolPage: SectionContent = { id: 'sym', title: 'Symbole seul', blocks: [{ id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: IMG, label: 'Symbole', background: 'light' }] }] };
  const darkPage = await rawFix('<div class="flex h-full w-full flex-col items-center gap-[16px] bg-[#1A2E2E] p-[60px]"><img src="{{sys-1.variants.0.url}}" alt="" class="h-[300px] w-[300px] object-contain"><h2 class="text-[40px] text-white">{{title}}</h2></div>', symbolPage);
  ok('une page entière sur fond sombre (page 3) : renvoyée (surface claire)', darkPage.out.result.repairs.some((x) => x.code === 'render_fix') && /page is dark/.test(darkPage.prompt));
  const variants: SectionContent = { id: 'usage', title: 'Règles d’usage du logo', blocks: [{ id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: IMG, label: 'Sur fond clair', background: 'neutral' }, { url: IMG2, label: 'Sur fond sombre', background: 'neutral' }, { url: IMG3, label: 'Monochrome', background: 'neutral' }] }] };
  const labelsOnly = await rawFix('<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[60px]"><h2 class="text-[40px]">{{title}}</h2><img src="{{sys-1.variants.0.url}}" alt="" class="h-[200px] w-[200px] object-contain"><p>{{sys-1.variants.0.label}} {{sys-1.variants.1.label}} {{sys-1.variants.2.label}}</p></div>', variants);
  ok('des déclinaisons nommées mais absentes (page 19) : renvoyé (chaque logo montré)', labelsOnly.out.result.repairs.some((x) => x.code === 'render_fix') && /content is missing|missing or tiny/.test(labelsOnly.prompt));
  const debris = await rawFix('<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[60px]">\')]"&gt;<h2 class="text-[40px]">{{title}}</h2><p>{{p1.paragraphs.0}}</p></div>', plain);
  ok('des débris de code dans la page (« \')]"> », page 12) : retirés par le code', !/\)\]/.test(debris.out.result.html) && debris.out.result.html.includes('Un paragraphe.'));
  const untitled = await rawFix('<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[60px]"><p>{{p1.paragraphs.0}}</p></div>', plain);
  ok('une page sans son titre (page 14) : renvoyée', untitled.out.result.repairs.some((x) => x.code === 'render_fix') && /\{\{title\}\}/.test(untitled.prompt));
  const bleeding = await rawFix(`<div class="relative h-full w-full bg-ground p-[60px]"><h2 class="text-[40px]">{{title}}</h2><p>{{p1.paragraphs.0}}</p><img src="${IMG}" alt="" class="absolute bottom-[-120px] left-[100px] h-[240px] w-[240px]"></div>`, plain);
  ok('une image coupée par le bas de la page (page 13) : renvoyée', /cut by the page edge/.test(bleeding.prompt), bleeding.prompt.match(/ERROR: .*/)?.[0]?.slice(0, 200) ?? bleeding.out.result.html.slice(-500));

  const overflowing = await rawFix(`<div class="flex h-full w-full flex-col gap-[20px] bg-ground p-[40px]"><h2 class="text-[56px]">{{title}}</h2>${'<div class="h-[150px] shrink-0 bg-brand-soft"><p class="p-[12px]">{{p1.paragraphs.0}}</p></div>'.repeat(4)}</div>`, plain);
  ok(
    'un contenu qui déborde un peu : le CODE le fait tenir (réduction exacte), sans appel de modèle ni texte coupé',
    overflowing.out.result.repairs.some((x) => x.code === 'auto_fit') && !overflowing.prompt && !overflowing.out.result.issues.some((i) => i.severity === 'blocking') && /\[zoom:0\.\d+\]/.test(overflowing.out.spec.html),
    overflowing.out.result.repairs.map((x) => x.code).join(',')
  );

  const straddling = await rawFix('<div class="relative h-full w-full bg-ground p-[60px]"><div class="absolute left-[300px] top-[40px] h-[200px] w-[300px] bg-brand-primary"></div><h2 class="relative text-[48px]">{{title}}</h2><p class="mt-[220px]">{{p1.paragraphs.0}}</p></div>', plain);
  ok('un titre à cheval sur un aplat de couleur (palette réelle) : renvoyé', /straddles the edge of a coloured block/.test(straddling.prompt), straddling.prompt.match(/ERROR: .*/)?.[0]?.slice(0, 160));
  const tablePage: SectionContent = { id: 'tab', title: 'Plan financier', blocks: [{ id: 't1', kind: 'table', headers: ['Indicateur', '2026', '2027', '2028'], rows: [['Chiffre d’affaires (XAF)', '6 650 000', '31 680 000', '81 750 000']] }] };
  const squeezed = await rawFix('<div class="flex h-full w-full gap-[16px] bg-ground p-[60px]"><h2 class="text-[40px]">{{title}}</h2><div class="w-[230px] shrink-0"><idem-table data-block="t1" class="text-[13px]"></idem-table></div></div>', tablePage);
  ok('les chiffres d’un tableau serré qui passent sur deux lignes (BP réel) : renvoyé', /figures of a table wrap/.test(squeezed.prompt), squeezed.prompt.match(/ERROR: .*/)?.[0]?.slice(0, 160) ?? JSON.stringify([squeezed.out.result.repairs, squeezed.out.result.issues]).slice(0, 400));

  {
    const ctx = { documentType: 'brand-charter' as const, locale: 'fr', tokens: kora, format: FORMATS['slide-16x9'], allowDark: false, bindings: 'values' as const, direction: { styleId: 'swiss', grammar: 'SIGNATURE MOVE (visible on every page): a thick rule under every title' } };
    const user = authorUser(ctx, { section: plain, listing: '{{title}} = "x"', tools: '', language: '- brand-primary for structure' });
    ok('chaque page reçoit le langage de la marque ET la grammaire complète de la direction artistique', user.includes('BRAND VISUAL LANGUAGE') && user.includes('a thick rule under every title'));
  }

  section('§9 sexies Le plan de mise en page, vérifié par le code');
  {
    const units = ['title', 'b1', 'b2'];
    const overlap = parseLayout(JSON.stringify({ columns: 12, rows: 8, zones: [{ units: ['title'], col: 1, span: 8, row: 1, rows: 3 }, { units: ['b1'], col: 6, span: 7, row: 2, rows: 4 }] }), units, FORMATS['slide-16x9']);
    ok('deux zones qui se chevauchent : plan refusé, avec la cellule en cause (l’agent recommence)', !overlap.layout && /overlap at row 2, column 6/.test(overlap.error ?? ''), overlap.error);
    const partial = parseLayout(JSON.stringify({ columns: 12, rows: 8, zones: [{ units: ['title', 'b1', 'b1', 'inconnu'], col: 1, span: 12, row: 1, rows: 4 }] }), units, FORMATS['slide-16x9']);
    ok('un contenu oublié rejoint la zone du titre ; un doublon et une unité inconnue sont retirés', Boolean(partial.layout && partial.layout.zones[0].units.join() === 'title,b1,b2'));
    const tall = (u: string) => (u === 'title' ? 150 : 0);
    const thin = parseLayout(JSON.stringify({ columns: 8, rows: 12, zones: [{ units: ['title'], col: 1, span: 4, row: 1, rows: 1 }, { units: ['b1', 'b2'], col: 1, span: 7, row: 2, rows: 9 }] }), units, FORMATS['slide-16x9'], { height: tall });
    ok('le titre de 68 px sur deux lignes dans une rangée de 21 px (charte réelle) : plan refusé, avec la hauteur qu’il demande', !thin.layout && /needs about 150px/.test(thin.error ?? ''), thin.error);
    const small = parseLayout(JSON.stringify({ columns: 8, rows: 10, zones: [{ units: ['title'], col: 2, span: 4, row: 1, rows: 3 }, { units: ['b1'], col: 2, span: 6, row: 4, rows: 5 }, { units: ['b2'], col: 1, span: 8, row: 9, rows: 2 }] }), units, FORMATS['slide-16x9'], { galleries: ['b1'] });
    ok('des maquettes reléguées à une petite zone (bannières réelles) : plan refusé — elles sont la page', !small.layout && /mockups \(b1\) get only/.test(small.error ?? ''), small.error);
    const big = parseLayout(JSON.stringify({ columns: 12, rows: 6, zones: [{ units: ['title', 'b2'], col: 1, span: 12, row: 1, rows: 1 }, { units: ['b1'], col: 1, span: 12, row: 2, rows: 5 }] }), units, FORMATS['slide-16x9'], { galleries: ['b1'], height: (u) => (u === 'title' ? 40 : 0) });
    ok('maquettes sur l’essentiel de la page, titre dans sa zone : plan accepté', Boolean(big.layout), big.error);
    const html = partial.layout ? assembleLayout(partial.layout, new Map([['z1', '<p>{{title}}</p>']]), FORMATS['slide-16x9'], new Map([['z1', 0.8]])) : '';
    ok('assemblage : la grille du plan, chaque zone à sa case, la zone qui déborde réduite par le code', /grid-cols-\[repeat\(12,minmax\(0,1fr\)\)\]/.test(html) && /data-ge-zone="z1" class="col-start-1 col-span-12 row-start-1 row-span-4/.test(html) && /\[zoom:0\.8\]/.test(html));
  }

  section('§9 septies Les blocs posés par le code occupent la place en premier (slide des projections)');
  {
    // Les chiffres réels du module Finance, posés par le code, et le jeu que le rédacteur écrivait en double.
    const financeChart = { kind: 'chart' as const, chartType: 'bar' as const, title: 'Trajectoire', labels: ['2026', '2027', '2028'], series: [{ name: 'CA', data: [120, 340, 780] }], unit: 'M FCFA', readingKey: 'Le CA sextuple en trois ans.' };
    const financeMetrics = { kind: 'metrics' as const, items: [{ value: '120 M FCFA', label: "Chiffre d'affaires 2026" }, { value: '18 M FCFA', label: 'Résultat net 2026' }, { value: '450 M FCFA', label: 'Coût total du projet' }] };
    const doubled = sectionFromModel(
      { title: 'Le CA sextuple en trois ans', blocks: [{ kind: 'chart', chartType: 'line', labels: ['2026', '2027', '2028'], series: [{ name: 'CA', data: [100, 300, 700] }], readingKey: 'Croissance.' }, { kind: 'metrics', items: [{ value: '780 M', label: 'CA 2028' }] }], notes: 'Hypothèses : 3 000 clients.' },
      { id: 'financials', prepend: [financeChart, financeMetrics], intent: { visualStrategy: 'data-visualization', textBudget: TEXT_BUDGETS.data } }
    );
    const lean = doubled.section ? slideEssentials(doubled.section).section : null;
    const charts = (s: SectionContent | null) => (s?.blocks ?? []).filter((b) => b.kind === 'chart');
    ok(
      'deux graphiques sur une slide 16/9 (le code et le rédacteur) : celui du CODE reste, celui du rédacteur part dans les notes',
      Boolean(lean) && charts(lean).length === 1 && charts(lean)[0].origin === 'system' && (lean?.blocks.length ?? 0) === 2 && /780 M/.test(lean?.notes ?? ''),
      `${charts(lean).length} graphique(s), ${lean?.blocks.length} bloc(s)`
    );
    // Le brief dit désormais au rédacteur de ne plus écrire de graphique : il ne reste qu'un titre et des notes.
    const titleOnly = sectionFromModel(
      { title: 'Rentable dès le deuxième exercice', notes: 'Hypothèses : 3 000 clients à 4 000 F, 12 % de désabonnement.' },
      { id: 'financials', prepend: [financeChart, financeMetrics] }
    );
    ok(
      'le rédacteur n’écrit plus qu’un titre et des notes : la page vit des blocs du code (elle échouait, « contenu illisible »)',
      Boolean(titleOnly.section) && titleOnly.section?.blocks.length === 2 && titleOnly.section?.blocks.every((b) => b.origin === 'system') && titleOnly.section?.title === 'Rentable dès le deuxième exercice' && /3 000 clients/.test(titleOnly.section?.notes ?? ''),
      titleOnly.notes.map((n) => n.code).join(', ')
    );
    ok(
      'sans bloc du code, une sortie sans bloc exploitable reste refusée (jamais une page vide)',
      sectionFromModel({ title: 'Problème', notes: 'Rien.' }, { id: 'pb' }).section === null
    );
    // L'illustration d'une slide : demandée par la STRATÉGIE, même quand le rédacteur a omis la clé `image`.
    const silent: SectionContent = { id: 'problem', title: 'Les producteurs perdent 30 % de leur récolte', blocks: [{ id: 'b1', kind: 'points', items: [{ label: 'Pas de stockage', detail: '30 % perdus', visual: 'coffee beans' }, { label: 'Prix imposé', detail: 'Marge divisée par deux', visual: 'market stall' }] }], intent: { visualStrategy: 'illustration', keyMessage: 'La perte est mesurable.' } };
    const planned = planAssets(silent, FORMATS['slide-16x9']);
    ok(
      'stratégie « illustration » sans clé `image` du rédacteur : l’illustration est demandée quand même, sur le sujet de la page',
      planned.some((r) => r.role === 'illustration' && r.subject === silent.title),
      planned.map((r) => r.role).join(', ')
    );
    ok(
      'une slide qui porte déjà sa photo n’en demande pas une seconde',
      !planAssets({ ...silent, blocks: [...silent.blocks, { id: 'f1', kind: 'figure', url: 'https://x/p.jpg', alt: 'Récolte' }] }, FORMATS['slide-16x9']).some((r) => r.role === 'illustration')
    );
  }

  {
    mode = 'zone-incomplete';
    zoneCalls.length = 0;
    const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, seed: 'zi', sections: [{ id: 'market' }] });
    const out = await doc.composeSection(MARKET);
    mode = 'ok';
    ok(
      'une zone qui oublie ses contenus : le code le voit avant l’assemblage et redemande CETTE zone, avec la liste exacte',
      zoneCalls.some((c) => /IT IS MISSING: .*\{\{b1\.items\.0\.value\}\}/.test(c.user)) && out.result.repairs.some((r) => r.code === 'zone_completed') && out.result.html.includes('2,3 Md FCFA')
    );
    const drawn = await rawFix('<div class="flex h-full w-full flex-col gap-[16px] bg-ground p-[60px]"><h2 class="text-[40px]">{{title}}</h2><p>{{p1.paragraphs.0}}</p><svg viewBox="0 0 10 10"><path d="M1 5 L4 8 L9 2"/></svg></div>', plain);
    ok('un dessin SVG écrit par l’auteur (la coche du BP réel) : retiré par le code', !/<path d="M1 5/.test(drawn.out.result.html) && drawn.out.result.issues.some((i) => i.code === 'invented_drawing_removed'));
  }

  {
    const real: SectionContent = { id: 'pal2', title: 'Palette de couleurs', blocks: [{ id: 'sys-1', kind: 'swatches', origin: 'system', items: [{ hex: '#1B7A7A', name: 'Primaire', role: 'Identité, titres' }, { hex: '#D4A017', name: 'Secondaire', role: 'Zones calmes' }] }] };
    const col = (i: number, hex: string) => `<div class="flex w-[300px] flex-col gap-[8px]"><div class="h-[120px] w-full rounded-[8px] bg-[${hex}]"></div><p class="text-[13px] font-semibold">{{sys-1.items.${i}.name}}</p><p class="text-[11px]">{{sys-1.items.${i}.role}}</p><p class="text-[11px]">{{sys-1.items.${i}.hex}}</p></div>`;
    const good = await rawFix(`<div class="flex h-full w-full flex-col gap-[32px] bg-ground p-[48px]"><h2 class="text-[44px]">{{title}}</h2><div class="flex gap-[16px]">${col(0, '#1B7A7A')}${col(1, '#D4A017')}</div></div>`, real);
    ok('la palette réelle (grands aplats, nom, rôle et code dessous) passe sans aucune correction', !good.prompt && !good.out.result.issues.some((i) => i.severity === 'blocking'), good.prompt.match(/ERROR: .*/)?.[0]?.slice(0, 200));
  }

  section('§9 quinquies La couverture');
  calls.length = 0;
  pageDirections.length = 0;
  const coverDoc = await createDocument({ documentType: 'business-plan', format: 'a4-portrait', brand: BRANDS.kora, creativity: 'low', seed: 'cov', sections: [{ id: 'cover', role: 'cover' }] });
  const coverOut = await coverDoc.composeSection(coverContent({ id: 'cover', brandName: 'Kora', documentLabel: 'Business plan' }));
  const coverAuthor = calls.find((c) => !c.repair);
  ok(
    'couverture : le modèle Ultra même au cran Low, rôle graphic.cover, consigne libre, aucun directeur de page, aucune relecture par un autre modèle',
    coverAuthor?.role === 'graphic.cover' && coverAuthor.level === 'ultra' && /Total creative freedom/.test(coverAuthor.system ?? '') && pageDirections.length === 0 && !coverOut.trace.tasks.some((t) => (t.task as string) === 'review') && (coverOut.result.measured?.height ?? 0) > 1000
  );

  section('§10 Plan qualité créative : exploration, axe de départ, variantes choisies par la mesure, retouche mesurée');
  process.env.IDEM_QUALITY_EXPLORE = '1';
  process.env.IDEM_QUALITY_SELECT = '1';
  process.env.IDEM_QUALITY_REFINE = '1';
  mode = 'ok';
  const remembered: string[] = [];
  const judged: string[] = [];
  configureGraphicEngine({
    // La marque a déjà eu l'idée « marché-scène » : l'exploration doit en retenir une autre.
    recentFingerprints: async () => ['idea:Market stage — the market stall becomes a stage and the trader is the hero'],
    rememberFingerprints: async (_scope, marks) => {
      remembered.push(...marks);
    },
    // Le juge simulé : la première capture a « deux foyers », les suivantes rien.
    judgeImage: async (_b64, mime) => {
      judged.push(mime);
      return judged.length === 1 ? '1: no\n2: yes\n3: no\n4: no\n5: no' : '1: no\n2: no\n3: no\n4: no\n5: no';
    },
  });
  calls.length = 0;
  const explored = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, creativity: 'medium', seed: 'q10', country: 'SN', memoryScope: { documentType: 'pitch-deck', key: 'kora' }, memoryScopes: [{ documentType: 'pitch-deck', key: 'sector:agri' }], sections: [{ id: 's1', purpose: 'the problem' }, { id: 's2', purpose: 'the market' }] });
  await explored.composeSection(MARKET, { index: 2, total: 2 });
  const exploreCall = calls.find((c) => c.role === 'graphic.explore');
  const planCall = calls.find((c) => c.role === 'graphic.director' && /PAGES:/.test(c.user));
  ok('exploration : quatre pistes demandées avant le plan, au rôle graphic.explore, avec le point de départ tiré par le code', !!exploreCall && /FOUR clearly different/.test(exploreCall.system ?? '') && /STARTING POINT/.test(exploreCall.user));
  ok('exploration : le code écarte la piste déjà faite et transmet la piste retenue au plan', !!planCall && /THE IDEA CHOSEN/.test(planCall.user) && !/Market stage/.test(planCall.user.split('THE IDEA CHOSEN')[1] ?? ''), (planCall?.user.match(/THE IDEA CHOSEN[^\n]*\n([^\n]*)/)?.[1] ?? '').slice(0, 80));
  ok('axe de départ : déterministe et tiré pour le pays de la marque ou une forme', !!explored.axis && (explored.axis.country === 'SEN' || !explored.axis.country), explored.axis?.id);
  await explored.remember();
  ok('mémoire : idée et axe écrits dans la marque ET le secteur', remembered.filter((m) => m.startsWith('idea:')).length === 2 && remembered.filter((m) => m.startsWith('axis:')).length === 2);

  if (!fast) {
    calls.length = 0;
    judged.length = 0;
    const flyer = await renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: BRANDS.kora, creativity: 'high', seed: 'q10-flyer', content: { id: 'v1', title: 'Récoltez plus', lede: 'Des semences adaptées à votre sol', blocks: [{ id: 'b1', kind: 'prose', paragraphs: ['Livraison en 48 h dans tout le pays.'] }] } });
    const authorCalls = calls.filter((c) => c.role === 'graphic.author' && !c.repair);
    ok('variantes : 3 au cran High pour une toile seule, la 2e et la 3e invitées à composer autrement', authorCalls.filter((c) => !/THE PAGE DISPLAYS, BUT/.test(c.user)).length === 3 && authorCalls.some((c) => /VARIANT 2 OF 3/.test(c.user)));
    ok('variantes : chaque variante mesurée et jugée sur sa capture (PNG)', judged.length >= 3 && judged.every((m) => m === 'image/png'), `${judged.length} capture(s) jugée(s)`);
    ok('variantes : le choix est dit dans la trace', flyer.result.repairs.some((r) => r.code === 'variant_selected'), flyer.result.repairs.map((r) => r.code).join(', '));
    ok('toile seule : le point de départ parvient à l’auteur (pas de plan)', authorCalls.some((c) => /STARTING POINT/.test(c.user)));

    // La retouche mesurée : un seul auteur (Medium, document), le juge voit deux foyers → une retouche, gardée si meilleure.
    calls.length = 0;
    judged.length = 0;
    process.env.IDEM_QUALITY_VARIANTS = '1';
    const one = await renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: BRANDS.kora, creativity: 'medium', seed: 'q10-refine', content: { id: 'v2', title: 'Récoltez plus', blocks: [{ id: 'b1', kind: 'prose', paragraphs: ['Livraison en 48 h.'] }] } });
    const refineCall = calls.find((c) => /THE PAGE DISPLAYS, BUT THESE PROBLEMS WERE MEASURED/.test(c.user));
    ok('retouche mesurée : le défaut vu par le juge est renvoyé à l’auteur, une seule fois', !!refineCall && /two elements compete/.test(refineCall.user) && calls.filter((c) => /THE PAGE DISPLAYS, BUT/.test(c.user)).length === 1);
    ok('retouche mesurée : la page livrée s’affiche', !one.result.issues.some((i) => i.severity === 'blocking'));
    delete process.env.IDEM_QUALITY_VARIANTS;

    // Au cran Low : pas de retouche mesurée ; interrupteur coupé : une seule écriture.
    calls.length = 0;
    process.env.IDEM_QUALITY_SELECT = '0';
    await renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: BRANDS.kora, creativity: 'low', seed: 'q10-low', content: { id: 'v3', title: 'Récoltez plus', blocks: [{ id: 'b1', kind: 'prose', paragraphs: ['Livraison.'] }] } });
    ok('interrupteurs : IDEM_QUALITY_SELECT=0 et cran Low → une seule écriture, aucune retouche', calls.filter((c) => c.role === 'graphic.author').length === 1);
  }
  // La bibliothèque d'exemples (phase 5) : deux principes proches de l'intention, éloignés entre eux ; anti-copie.
  {
    const { pickExamples, examplesLines, isCopy } = await import('../src/examples/library');
    const { encodeVector, normalize } = await import('@idem/design-tools');
    const v = (k: number) => normalize(Float32Array.from({ length: 512 }, (_, i) => (i % 7 === k ? 1 : 0.01)));
    const file = path.join(require('os').tmpdir(), `ge-examples-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({ examples: [
      { id: 'a', nature: 'slide', intent: 'one key figure that proves traction', html: '<div class="grid">…</div>', vector: encodeVector(v(1)) },
      { id: 'b', nature: 'slide', intent: 'one key figure that proves traction, giant number', html: '<div class="flex">…</div>', vector: encodeVector(v(1)) },
      { id: 'c', nature: 'slide', intent: 'key figure shown as a growth chart', html: '<div class="relative">…</div>', vector: encodeVector(v(3)) },
      { id: 'd', nature: 'document', intent: 'a financial table', html: '<table>…</table>' },
    ] }));
    process.env.IDEM_EXAMPLES_FILE = file;
    const picked = pickExamples({ nature: 'slide', intent: 'a key figure proving traction' });
    ok('exemples : deux exemples de la bonne toile, le second choisi pour sa différence', picked.length === 2 && picked.every((e) => e.nature === 'slide') && picked[0].id !== picked[1].id, picked.map((e) => e.id).join(','));
    ok('exemples : la consigne interdit de reproduire la mise en page', /never reproduce their layout/.test(examplesLines(picked)));
    ok('anti-copie : une page à l’empreinte d’un exemple montré est reconnue, une autre non', isCopy(v(1), picked.filter((e) => e.id !== 'c').slice(0, 1)) && !isCopy(v(5), picked));
    process.env.IDEM_QUALITY_EXAMPLES = '0';
    ok('exemples : IDEM_QUALITY_EXAMPLES=0 les coupe', pickExamples({ nature: 'slide', intent: 'traction' }).length === 0);
    delete process.env.IDEM_QUALITY_EXAMPLES;
    delete process.env.IDEM_EXAMPLES_FILE;
    fs.rmSync(file, { force: true });
  }
  // Les visuels (plan qualité créative) : motif procédural, police d'accroche, idée de l'hôte, variantes renvoyées.
  {
    const tokens = buildTokens({ brand: BRANDS.kora, format: 'flyer-square' });
    const map = buildContentMap({ id: 'v', title: 'Récoltez plus', blocks: [] } as SectionContent, 'values');
    const page = expandPage('<div class="relative h-full w-full"><idem-pattern kind="flow" density="0.4" class="absolute inset-0 opacity-[0.14]"></idem-pattern><h1>{{title}}</h1></div>', map, tokens, FORMATS['flyer-square'], { sectionId: 'v', locale: 'fr', engine: 'x' });
    ok('motif procédural : dessiné par le code (SVG en ligne aux couleurs de la marque), reconnu comme primitive', /data-ge-pattern="procedural"/.test(page.html) && /data:image\/svg\+xml;base64,/.test(page.html));
    calls.length = 0;
    process.env.IDEM_QUALITY_SELECT = '1';
    process.env.IDEM_QUALITY_VARIANTS = '2';
    const v = await renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: BRANDS.kora, creativity: 'medium', seed: 'q10-visual', concept: 'Morning ritual — a steaming cup seen from above', accentFont: 'Bebas Neue', content: { id: 'v1', title: 'Récoltez plus', blocks: [{ id: 'b1', kind: 'prose', paragraphs: ['Livraison en 48 h.'] }] } });
    const authorUserText = calls.filter((c) => c.role === 'graphic.author').map((c) => c.user).join('\n');
    ok('visuel : l’idée de l’hôte parvient à l’auteur (au lieu du point de départ)', /THE IDEA OF THIS VISUAL/.test(authorUserText) && /Morning ritual/.test(authorUserText) && !/STARTING POINT/.test(authorUserText));
    ok('visuel : la police d’accroche est proposée à l’auteur et chargée avec la page', /font-accent: an expressive face \("Bebas Neue"\)/.test(authorUserText) && /Bebas\+Neue|Bebas Neue/.test(v.result.head ?? ''));
    ok('motif procédural : proposé à l’auteur', /<idem-pattern kind="flow\|scatter/.test(authorUserText));
    if (!fast) {
      ok('variantes : la composition écartée est renvoyée (spec, rendu, image, score) pour le choix du client', (v.alternatives?.length ?? 0) === 1 && !!v.alternatives![0].png && typeof v.alternatives![0].score === 'number' && typeof v.score === 'number', String(v.alternatives?.length));
      calls.length = 0;
      await renderSingle({ documentType: 'brand-charter', format: 'flyer-square', brand: BRANDS.kora, creativity: 'high', seed: 'q10-one', variants: 1, content: { id: 'v2', title: 'Bannière', blocks: [] } as unknown as SectionContent }).catch(() => undefined);
      ok('variantes : l’hôte peut imposer une seule écriture (fichiers de la charte)', calls.filter((c) => (c.role === 'graphic.author' || c.role === 'graphic.cover') && !c.repair && !/THE PAGE DISPLAYS, BUT/.test(c.user)).length === 1, String(calls.filter((c) => c.role === 'graphic.author').length));
    }
    delete process.env.IDEM_QUALITY_VARIANTS;
  }
  configureGraphicEngine({ recentFingerprints: undefined, rememberFingerprints: undefined, judgeImage: undefined });
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
