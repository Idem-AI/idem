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
import { expandPage, extractHtml, sanitizeHtml } from '../src/runtime/expand';
import { compileTailwind } from '../src/runtime/tailwind';
import { chartHtml, tableHtml } from '../src/runtime/primitives';
import { closeBrowser } from '../src/runtime/browser';
import { configureGraphicEngine } from '../src/host';
import { cardFaces } from '../src/adapters/sections';
import { createDocument, GraphicRenderError, renderSingle } from '../src/engine';
import { BRANDS, CARD_FRONT, FINANCE_BP, MARKET } from './fixtures';

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
type Mode = 'ok' | 'blank' | 'blank-once' | 'garbage' | 'down';
let mode: Mode = 'ok';
const calls: Array<{ role: string; level?: CreativityLevel; repair: boolean; user: string }> = [];
const fakePage = (user: string): string => {
  const keys = [...user.matchAll(/^\{\{([\w.]+)\}\} = /gm)].map((m) => m[1]).filter((k) => !['kicker', 'title', 'lede'].includes(k));
  const prims = [...user.matchAll(/<idem-(chart|table) data-block="([^"]+)">/g)].map((m) => `<idem-${m[1]} data-block="${m[2]}" class="w-full text-[12px]"></idem-${m[1]}>`);
  const body = `<p class="text-[12px] uppercase text-brand-primary">{{kicker}}</p><h2 class="font-display text-[36px] font-bold text-ink">{{title}}</h2><p class="text-muted">{{lede}}</p>${keys.map((k) => `<p data-field="${k}" class="text-[12px]">{{${k}}}</p>`).join('')}${prims.join('')}<idem-logo class="h-[20px]"></idem-logo>`;
  return /A4 page that GROWS/.test(user) ? `\`\`\`html\n${body}\n\`\`\`` : `\`\`\`html\n<div class="relative flex h-full w-full flex-col gap-[8px] bg-ground p-[5%]">${body}</div>\n\`\`\``;
};
configureGraphicEngine({
  agentCall: () => async ({ role, user, level }) => {
    const repair = /DID NOT DISPLAY|did not display/.test(user);
    calls.push({ role, level, repair, user });
    if (mode === 'down') throw new Error('quota');
    if (role === 'graphic.director') return 'BIBLE:\n- Big display titles in brand-primary, generous margins, one soft circle per page.';
    if (/CHANGE REQUESTED BY THE CLIENT/.test(user)) return '```html\n<div class="relative h-full w-full bg-brand-primary p-[40px]"><h2 class="text-[60px] text-on-brand">{{title}}</h2></div>\n```';
    if (mode === 'garbage') return 'je ne sais pas';
    if (mode === 'blank' || (mode === 'blank-once' && !repair)) return '```html\n<div class="hidden">{{title}}</div>\n```';
    return fakePage(user);
  },
});

async function main(): Promise<void> {
  // ── §1 Contrats ──────────────────────────────────────────────────────────────────────────
  section('§1 Contrats (ContentModel, DesignSpec v2)');
  const validContent = validateContent(readJson('valid/content-pitch-deck.json'));
  ok('exemple de ContentModel valide accepté', validContent.ok, validContent.issues.map((i) => i.message).join(' '));
  const expectations = readJson('expectations.json') as Record<string, { contract: string; codes: string[] }>;
  for (const [file, exp] of Object.entries(expectations)) {
    if (file.startsWith('$')) continue;
    const report = validateContent(readJson(file));
    const codes = report.issues.map((i) => i.code);
    ok(`${file} refusé (${exp.codes.join(', ')})`, !report.ok && exp.codes.every((c) => codes.includes(c)), `obtenu : ${codes.join(', ') || 'accepté'}`);
  }
  const spec = { version: 2, ref: 'market', pattern: { id: 'authored' }, html: '<div class="p-[8px]">{{title}}</div>', level: 'high' };
  ok('une page gardée (v2) se valide et se reconnaît', isAuthoredSpec(spec) && validateDesignSpec({ version: 2, documentType: 'pitch-deck', format: 'slide-16x9', creativity: 'high', tokensHash: 'x', seed: 's', engine: { version: '2', components: '2' }, sections: [spec] }).ok);
  ok('un plan de l’ancien moteur (arbre v1) n’est pas une page gardée', !isAuthoredSpec({ ref: 'x', pattern: { id: 'slide.split' }, root: { t: 'stack' } }));
  const stale = ['content-model', 'design-spec', 'render-result'].filter((n) => !fs.existsSync(path.resolve(__dirname, `../contracts/${n}.schema.json`)));
  ok('schémas JSON présents (npm run schemas)', stale.length === 0, stale.join(', '));

  // ── §2 Normalisation ─────────────────────────────────────────────────────────────────────
  section('§2 Normalisation d’une sortie de petit modèle');
  const messy = normalizeSection(readJson('model-outputs/messy-section.json'), { id: 'market' });
  const kinds = messy.section?.blocks.map((b) => b.kind) ?? [];
  ok('la section survit à une sortie sale', Boolean(messy.section));
  ok('alias « kpi » lu comme chiffres-clés', kinds[0] === 'metrics');
  const tbl = messy.section?.blocks.find((b) => b.kind === 'table') as { rows: string[][] } | undefined;
  ok('lignes de tableau recalibrées sur l’en-tête', Boolean(tbl) && tbl!.rows.every((r) => r.length === 3));

  // ── §3 Jetons ────────────────────────────────────────────────────────────────────────────
  section('§3 Jetons de la marque');
  const night = { name: 'Nuit', palette: { primary: '#0B1020', secondary: '#1F2A44', accent: '#F2C14E', background: '#0E1424', text: '#E8E8E8' } };
  for (const brand of [BRANDS.kora, BRANDS.kofi, BRANDS.baobab, night]) {
    const t = buildTokens({ brand, format: 'slide-16x9' });
    ok(`${brand.name} : encre lisible sur le fond, encre lisible sur la marque`, contrastRatio(t.color.ink, t.color.ground) >= 7 && contrastRatio(t.color.onBrand, t.color.primary) >= 4.5);
  }
  ok('une charte à fond sombre ne donne pas un fond sombre sans autorisation', !isDeep(buildTokens({ brand: night, format: 'slide-16x9' }).color.ground));

  // ── §4 La matière à plat ─────────────────────────────────────────────────────────────────
  section('§4 La matière à plat : chaque texte a sa clé, chiffres exacts');
  const map = buildContentMap(MARKET);
  ok('titre, sur-titre, chapeau et chiffres-clés ont leur clé', ['title', 'kicker', 'lede', 'b1.items.0.value', 'b1.items.2.label'].every((k) => map.entries.has(k)));
  ok('le graphique est une primitive (ses données ne passent pas par l’auteur)', map.primitives.has('b2') && !map.listing.includes('1950') && map.listing.includes('<idem-chart data-block="b2">'));
  const markers = buildContentMap(CARD_FRONT, 'markers');
  ok('carte en gabarit : les champs restent des marqueurs', markers.markers.has('fullName') && markers.entries.get('email')?.value === '{{email}}');
  const exp = expandPage('<p class="x">{{title}}</p><p>{{fullName}}</p><a href="mailto:{{email}}">x</a><p>{{nope}}</p>', { ...markers, entries: new Map([...markers.entries, ['title', { key: 'title', value: 'A & B <c>', kind: 'text' as const }]]) }, buildTokens({ brand: BRANDS.kora, format: 'card-landscape' }), FORMATS['card-landscape'], { sectionId: 'front', locale: 'fr', engine: 'x' });
  ok('texte échappé, marqueur dans un élément data-field, marqueur gardé dans un attribut, clé inconnue retirée', exp.html.includes('A &amp; B &lt;c&gt;') && exp.html.includes('<span data-field="fullName">{{fullName}}</span>') && exp.html.includes('mailto:{{email}}') && exp.unknown.includes('nope'));
  ok('la racine porte les cotes du support (85 × 55 mm)', /class="ge-page [^"]*w-\[85mm\] h-\[55mm\]/.test(exp.html));

  // ── §5 Assainissement ────────────────────────────────────────────────────────────────────
  section('§5 Assainissement : Tailwind seul, rien qui s’exécute ni ne sort');
  const raw = 'Voici la page :\n```html\n<div class="p-[10px]" style="color:red" onclick="x()"><style>p{}</style><script>alert(1)</script><img src="https://evil.example/a.png"><img src="{{b1.url}}"><a href="javascript:alert(1)">x</a><iframe src="x"></iframe></div>\n```';
  const clean = sanitizeHtml(extractHtml(raw));
  ok('bloc de code extrait de la réponse', clean.html.startsWith('<div'));
  ok('<style> et style="" retirés et comptés', clean.nativeCss === 2 && !/style/.test(clean.html));
  ok('script, gestionnaire, cadre, adresses étrangères et javascript: retirés ; clé d’image gardée', !/script|onclick|iframe|evil|javascript/.test(clean.html) && clean.html.includes('src="{{b1.url}}"'));

  // ── §6 Tailwind ──────────────────────────────────────────────────────────────────────────
  section('§6 Tailwind compilé côté serveur');
  const kora = buildTokens({ brand: BRANDS.kora, format: 'slide-16x9' });
  const css = await compileTailwind('<div class="ge-page bg-brand-primary text-[42px] p-4 [&_th]:bg-brand-accent font-display bg-linear-to-br from-brand-primary to-brand-accent rotate-[-6deg] text-1.5rem"></div>', kora);
  ok('couleurs et polices de la marque dans le thème, porté par .ge-page', css.includes('.ge-page {') && css.toLowerCase().includes(`--color-brand-primary: ${kora.color.primary.toLowerCase()}`) && css.includes('--font-display'));
  ok('valeurs arbitraires, variantes et dégradés compilés', css.includes('.bg-brand-primary') && css.includes('text-\\[42px\\]') && css.includes('& th') && css.includes('linear-gradient'));
  ok('aucune unité rem (la taille racine de l’hôte ne change pas la page)', !/:\s*[^;{}]*\d+(\.\d+)?rem\b/.test(css));
  ok('la remise à zéro n’a aucun poids (toute classe passe devant)', /:where\(\.ge-page\)/.test(css) && !/^\.ge-page h1/m.test(css));

  // ── §7 Primitives ────────────────────────────────────────────────────────────────────────
  section('§7 Primitives : graphiques et tableau exacts');
  const types: ChartType[] = ['bar', 'groupedBar', 'stacked', 'horizontalBar', 'line', 'area', 'pie', 'doughnut', 'radar'];
  for (const chartType of types) {
    const multi = !['pie', 'doughnut'].includes(chartType);
    const svg = chartHtml({ id: 'c', kind: 'chart', chartType, labels: ['A', 'B', 'C', 'D'], series: multi ? [{ name: 'S1', data: [12, 30, 22, 41] }, { name: 'S2', data: [8, 14, 19, 25] }] : [{ name: 'S', data: [40, 30, 20, 10] }], readingKey: 'x', unit: '%' }, kora, { className: 'w-full' });
    ok(`${chartType} : SVG dessiné, palette déclarée (recoloration de marque)`, svg.includes('<svg') && /data-ge-palette="#[0-9a-f]{6}/i.test(svg) && !/NaN|undefined/.test(svg));
  }
  const table = FINANCE_BP.blocks.find((b) => b.kind === 'table');
  if (table && table.kind === 'table') {
    const t = tableHtml(table, { className: '[&_th]:bg-brand-primary' });
    ok('tableau : chaque cellule exacte, colonnes chiffrées à droite, style de l’auteur sur la balise', table.rows.flat().every((c) => t.includes(c.replace(/&/g, '&amp;'))) && t.includes('text-right') && t.includes('[&amp;_th]:bg-brand-primary'));
  }

  if (fast) return;

  // ── §8 Le flux complet ───────────────────────────────────────────────────────────────────
  section('§8 Le flux complet (Chromium, auteur simulé)');
  calls.length = 0;
  const deck = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, direction: { styleId: 'swiss' }, creativity: 'low', seed: 'check', sections: [{ id: 'market' }, { id: 'finance' }], png: true });
  const [m, f] = await Promise.all([deck.composeSection(MARKET, { index: 1, total: 2 }), deck.composeSection({ ...FINANCE_BP, id: 'finance' }, { index: 2, total: 2 })]);
  ok('une bible pour le document (pages en parallèle), un appel d’auteur par page, au cran choisi', calls.filter((c) => c.role === 'graphic.director').length === 1 && calls.filter((c) => c.role === 'graphic.author').length === 2 && calls.every((c) => c.level === 'low'));
  ok('l’auteur reçoit la bible, le support et la matière', calls.filter((c) => c.role === 'graphic.author').every((c) => c.user.includes('BIBLE OF THE DOCUMENT') && c.user.includes('CANVAS:') && c.user.includes('{{title}}')));
  ok('pages affichées, photographiées, textes exacts, aucun constat bloquant', Boolean(m.png && f.png) && m.result.html.includes('2,3 Md FCFA') && [m, f].every((o) => !o.result.issues.some((i) => i.severity === 'blocking')));
  ok('le fragment porte sa feuille Tailwind avant la racine', /<style data-ge-tailwind>/.test(m.result.head ?? '') && m.result.html.startsWith('<div class="ge-page'));
  const before = calls.length;
  const replay = await deck.composeSection({ ...MARKET, title: 'Un marché de 3 milliards' }, { replay: m.spec });
  ok('retouche de texte : la page est rejouée sans modèle', calls.length === before && replay.result.html.includes('Un marché de 3 milliards') && replay.spec.html === m.spec.html);
  const revised = await deck.composeSection(MARKET, { revise: { spec: m.spec, instruction: 'make the title much bigger on a brand background' } });
  ok('retouche écrite : l’auteur reçoit son code et la consigne', calls[calls.length - 1].user.includes('CURRENT PAGE CODE') && revised.spec.html.includes('text-[60px]'));
  const old = await deck.composeSection(MARKET, { replay: { ref: 'market', pattern: { id: 'slide.split' }, root: {} } as never });
  ok('une page de l’ancien moteur ne se rejoue pas : elle est réécrite', old.spec.version === 2 && calls[calls.length - 1].role === 'graphic.author');

  const card = await renderSingle({ documentType: 'business-card', format: 'card-landscape', brand: BRANDS.kofi, seed: 'card', bindings: 'markers', content: cardFaces({ binding: 'markers' }).front });
  ok('carte : gabarit à marqueurs (data-field)', /data-field="fullName"[^>]*>\{\{fullName\}\}|<span data-field="fullName">\{\{fullName\}\}/.test(card.result.html));

  for (const level of ['low', 'medium', 'high', 'ultra'] as const) {
    calls.length = 0;
    await renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: BRANDS.baobab, creativity: level, seed: `l:${level}`, content: { id: 'v', role: 'visual', title: 'Promo de saison', blocks: [] } });
    ok(`${level} : même travail (un appel d’auteur), cran transmis au modèle`, calls.length === 1 && calls[0].level === level);
  }

  mode = 'blank-once';
  calls.length = 0;
  const fixedOut = await renderSingle({ documentType: 'flyer', format: 'flyer-story', brand: BRANDS.baobab, creativity: 'medium', seed: 'fix', content: { id: 'v', role: 'visual', title: 'Promo', blocks: [] } });
  ok('page vide : corrigée par l’auteur au même cran, dite dans les réparations', fixedOut.result.repairs.some((r) => r.code === 'render_fix') && calls.length === 2 && calls[1].repair && calls[1].level === 'medium');
  for (const m2 of ['blank', 'garbage', 'down'] as const) {
    mode = m2;
    calls.length = 0;
    let error: unknown = null;
    try {
      await renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: BRANDS.baobab, creativity: 'high', seed: `fail:${m2}`, content: { id: 'v', role: 'visual', title: 'Promo', blocks: [] } });
    } catch (e) {
      error = e;
    }
    ok(`${m2} : au plus 1 + 3 tentatives, une à la fois, réécriture au cran au-dessus (ultra), puis GraphicRenderError`, error instanceof GraphicRenderError && calls.length <= 4 && calls.slice(2).every((c) => c.level === 'ultra'), `${calls.map((c) => c.level).join(',')}`);
  }
  mode = 'ok';
}

main()
  .catch((error) => {
    failures += 1;
    console.error(error);
  })
  .finally(async () => {
    await closeBrowser();
    console.log(`\n${failures ? '✗' : '✓'} Moteur graphique : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
    process.exit(failures ? 1 : 0);
  });
