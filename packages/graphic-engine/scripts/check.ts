/**
 * CONTRÔLES du moteur graphique — `npm run check --prefix packages/graphic-engine` (`-- --fast` : sans Chromium).
 *
 * Aucun modèle réel : les agents sont simulés (réponses valides, invalides, muettes), ce qui permet de
 * vérifier chaque chemin de repli. Les rendus sont mesurés dans le vrai Chromium (celui des PDF).
 */
import fs from 'fs';
import path from 'path';
import type { SectionContent } from '../src/contracts/content-model';
import { normalizeSection, validateContent, validateDesignSpec } from '../src/contracts';
import { buildTokens } from '../src/design-system/tokens';
import { resolveLook } from '../src/design-system/look';
import { contrastRatio, isDeep } from '../src/foundation/color';
import { typographize } from '../src/foundation/typeset';
import { chartPalette } from '../src/design-system/charts/palette';
import { createContext } from '../src/html-css-compiler/context';
import { compileSection } from '../src/html-css-compiler/compile';
import { allPatterns } from '../src/design-system/patterns/registry';
import { analyzeSection } from '../src/composition-engine/analyze';

import { planDocument } from '../src/composition-engine/plan';
import { POLICIES } from '../src/composition-engine/profiles';
import { diversityStats, parse as parseFingerprint } from '../src/composition-engine/diversity';
import { buildCandidate, createComposeContext, specOf } from '../src/composition-engine/compose';
import { DiversityMemory } from '../src/composition-engine/diversity';
import { capabilities } from '../src/capability-registry';
import { parseAuthored, parsePick } from '../src/agents/creative-planner';
import { parseCritique } from '../src/agents/critic';
import { parseRepair } from '../src/agents/targeted-repair';
import { configureGraphicEngine } from '../src/host';
import { createDocument } from '../src/engine';
import { closeBrowser } from '../src/quality-engine/browser';
import { fitAndMeasure } from '../src/quality-engine/measure';
import { FORMATS } from '../src/design-system/formats';
import type { GenerationTrace } from '../src/observability/traces';
import { ASK, BRANDS, capture, CARD_BACK, CARD_FRONT, CHARTER, coverSection, FINANCE_BP, flyer, MARKET, MODEL_HUB, photo, PROBLEM, PROBLEM_VISUAL, PRODUCT_CAPTURE, SUMMARY_BP, SWOT_BP, TEAM, TRACTION, VISION_BLEED } from './fixtures';
import { applyAssets, GENERATION_CAP, iconFor, matchAsset, planAssets, resolveAssets } from '../src/asset-planner';
import type { AssetProviders, AssetRegistry } from '../src/asset-planner';
import type { AssetRecord } from '../src/contracts/slide-intent';
import { recordFromTraces } from '../src/observability/record';
import { sectionTextLoad, TEXT_BUDGETS } from '../src/composition-engine/analyze';
import { sectionFromModel } from '../src/adapters/sections';
import { contentContract } from '../src/agents/content-contract';

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

async function main(): Promise<void> {
  // ── §1 Contrats ──────────────────────────────────────────────────────────────────────────
  section('§1 Contrats (ContentModel, DesignSpec, RenderResult)');
  const validContent = validateContent(readJson('valid/content-pitch-deck.json'));
  ok('exemple de ContentModel valide accepté', validContent.ok, validContent.issues.map((i) => i.message).join(' '));
  const validSpec = validateDesignSpec(readJson('valid/design-spec-slide.json'), { content: validContent.value, knownPatterns: new Set(allPatterns().map((p) => p.id)) });
  ok('exemple de DesignSpec valide accepté (sans modèle, sans HTML)', validSpec.ok, validSpec.issues.map((i) => i.message).join(' '));
  const expectations = readJson('expectations.json') as Record<string, { contract: string; codes: string[]; with?: string }>;
  for (const [file, exp] of Object.entries(expectations)) {
    if (file.startsWith('$')) continue;
    const raw = readJson(file);
    const report = exp.contract === 'content' ? validateContent(raw) : validateDesignSpec(raw, exp.with ? { content: validateContent(readJson(exp.with)).value } : {});
    const codes = report.issues.map((i) => i.code);
    ok(`${file} refusé (${exp.codes.join(', ')})`, !report.ok && exp.codes.every((c) => codes.includes(c)), `obtenu : ${codes.join(', ') || 'accepté'}`);
  }
  const stale = ['content-model', 'design-spec', 'render-result'].filter((n) => !fs.existsSync(path.resolve(__dirname, `../contracts/${n}.schema.json`)));
  ok('schémas JSON présents (npm run schemas)', stale.length === 0, stale.join(', '));

  // ── §2 Normalisation ─────────────────────────────────────────────────────────────────────
  section('§2 Normalisation d’une sortie de petit modèle');
  const messy = normalizeSection(readJson('model-outputs/messy-section.json'), { id: 'market' });
  const kinds = messy.section?.blocks.map((b) => b.kind) ?? [];
  ok('la section survit à une sortie sale', Boolean(messy.section));
  ok('alias « kpi » lu comme chiffres-clés, chiffre vide écarté', kinds[0] === 'metrics' && (messy.section?.blocks[0] as { items: unknown[] }).items.length === 1);
  const tbl = messy.section?.blocks.find((b) => b.kind === 'table') as { rows: string[][] } | undefined;
  ok('lignes de tableau recalibrées sur l’en-tête', Boolean(tbl) && tbl!.rows.every((r) => r.length === 3));
  const ch = messy.section?.blocks.find((b) => b.kind === 'chart') as { chartType: string; series: { data: number[] }[]; readingKey: string } | undefined;
  ok('graphique : type inconnu → déduit, série complétée, clé de lecture fournie', Boolean(ch) && ch!.chartType === 'bar' && ch!.series[0].data.length === 3 && ch!.series[0].data[1] === 35.5 && ch!.readingKey.length > 0);
  ok('carte sans corps complétée, paragraphe vide et spécimen inventé écartés', kinds.includes('cards') && !kinds.includes('prose') && !kinds.includes('swatches'));
  ok('le titre est nettoyé (espaces)', messy.section?.title === 'Notre marché en croissance');

  // ── §3 Jetons ────────────────────────────────────────────────────────────────────────────
  section('§3 Jetons : contrastes garantis, surface claire');
  const tricky = [
    BRANDS.kora,
    BRANDS.kofi,
    BRANDS.baobab,
    { name: 'Neon', palette: { primary: '#39FF14', secondary: '#FF00FF', accent: '#00FFFF', background: '#FFFFFF', text: '#777777' } },
    { name: 'Nuit', palette: { primary: '#0B1020', secondary: '#1F2A44', accent: '#F2C14E', background: '#0E1424', text: '#E8E8E8' } },
    { name: 'Gris', palette: { primary: '#6B6B6B', secondary: '#9A9A9A', accent: '#BDBDBD', background: '#F2F2F2', text: '#8A8A8A' } },
  ];
  for (const brand of tricky) {
    for (const format of ['slide-16x9', 'a4-portrait', 'card-landscape'] as const) {
      const t = buildTokens({ brand, format });
      const good = contrastRatio(t.color.ink, t.color.ground) >= 7 && contrastRatio(t.color.muted, t.color.ground) >= 4.5 && contrastRatio(t.color.onBrand, t.color.primary) >= 4.5;
      if (!good) ok(`${brand.name} ${format} : encres`, false, `${t.contrast.inkOnGround} / ${t.contrast.mutedOnGround} / ${t.contrast.onBrand}`);
    }
  }
  ok('encre ≥ 7:1, secondaire ≥ 4,5:1, encre sur marque ≥ 4,5:1 (6 marques dont fluo, nuit, grise)', true);
  const night = buildTokens({ brand: tricky[4], format: 'slide-16x9' });
  ok('une charte à fond sombre ne donne PAS une page sombre sans autorisation', !night.color.dark && !isDeep(night.color.ground));
  ok('… mais la donne quand le fond sombre est explicitement admis', buildTokens({ brand: tricky[4], format: 'slide-16x9', allowDark: true }).color.dark);
  const navy = buildTokens({ brand: BRANDS.kora, format: 'slide-16x9' });
  ok('page d’inversion refusée sur une couleur de marque profonde (bleu nuit)', !resolveLook(navy, { strategy: 'inverse', mood: 'neutral', tension: 'calm', accent: 'none', density: 'balanced', allowInverted: true }).inverted);
  ok('page d’inversion admise sur une couleur vive (magenta)', resolveLook(buildTokens({ brand: BRANDS.kofi, format: 'slide-16x9' }), { strategy: 'inverse', mood: 'neutral', tension: 'calm', accent: 'none', density: 'balanced', allowInverted: true }).inverted);

  // ── §4 Palettes des graphiques ───────────────────────────────────────────────────────────
  section('§4 Palettes des graphiques (contrôles dataviz calculés)');
  let palettesOk = 0;
  let palettesTotal = 0;
  for (const brand of tricky) for (const n of [2, 3, 5, 8]) {
    palettesTotal += 1;
    const t = buildTokens({ brand, format: 'a4-portrait' });
    const p = chartPalette({ primary: t.color.primary, accent: t.color.accent, secondary: t.color.secondary }, n, t.color.ground);
    if (p.colors.length === n && p.report.ok) palettesOk += 1;
    else console.log(`    ${brand.name} n=${n} : ${p.colors.length} couleurs, cvd ${p.report.worstCvd}, normal ${p.report.worstNormal}`);
  }
  ok(`palettes validées (bande de clarté, chroma, daltonisme ≥ 6, vision normale ≥ 15) : ${palettesOk}/${palettesTotal}`, palettesOk === palettesTotal);

  // ── §5 Compilateur ───────────────────────────────────────────────────────────────────────
  section('§5 Compilateur : déterminisme, sécurité, fidélité');
  const tokens = buildTokens({ brand: BRANDS.kora, direction: { styleId: 'swiss' }, format: 'slide-16x9' });
  const spec = readJson('valid/design-spec-slide.json').sections[0];
  const market = validContent.value!.sections[1];
  const look = resolveLook(tokens, { strategy: spec.strategy, mood: spec.mood, tension: spec.tension, accent: spec.accent, density: spec.density, allowInverted: true });
  const compileOnce = () => compileSection(spec, createContext({ tokens, look, section: market, documentType: 'pitch-deck', locale: 'fr', bindings: 'values', meta: { brandName: 'Kora' } })).html;
  const h1 = compileOnce();
  const h2 = compileOnce();
  ok('même plan, mêmes jetons, même contenu ⇒ même HTML', h1 === h2, `${h1.length} signes`);
  ok('aucun script, aucun gestionnaire d’évènement', !/<script|\son[a-z]+=/i.test(h1));
  const urls = [...h1.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
  ok('aucune adresse externe dans le rendu (les polices vont dans le <head>)', urls.length === 0, urls.join(', '));
  // Le moteur pose des espaces insécables et des apostrophes typographiques : on compare le texte normalisé.
  const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/[  ]/g, ' ').replace(/’/g, "'").replace(/\s+/g, ' ');
  const wanted = ['2,3 Md FCFA', 'Croissance annuelle', 'Marché adressable', 'Les ventes progressent chaque mois.', market.title];
  ok('chaque texte du contenu est présent (fidélité, texte normalisé)', wanted.every((t) => plain(h1).includes(t.replace(/’/g, "'"))), wanted.filter((t) => !plain(h1).includes(t)).join(' | '));
  ok('le graphique est un SVG dessiné par le code (jamais un canvas)', h1.includes('<svg') && h1.includes('role="img"') && !h1.includes('<canvas'));
  const bound = ['Des producteurs isolés', 'Une offre locale pauvre', 'Le marché'].map((t) => typographize(t, 'fr'));
  ok('typographie : un titre de trois mots garde une espace sécable', bound[0].includes(' ') && bound[1].includes(' '), bound.map((b) => JSON.stringify(b)).join(' '));
  // Le contrat du PDF : sur une page paginée, le paginateur lit les marqueurs sur les RANGÉES (enfants directs
  // de la racine). Un bloc insécable et le pied de section ne doivent pas y être enfouis d'un niveau.
  const flowDoc = await createDocument({ documentType: 'business-plan', format: 'a4-portrait', brand: BRANDS.baobab, direction: { styleId: 'editorial' }, seed: 'contrat-pdf', sections: [{ id: FINANCE_BP.id }], validate: false });
  const flowHtml = (await flowDoc.composeSection(FINANCE_BP, { index: 2, total: 6 })).result.html;
  // Chaque RANGÉE (enfant direct de la racine `.ge-page`) et la balise de son premier enfant.
  const rows = (() => {
    const out: Array<{ row: string; first?: string }> = [];
    // Balises vides du HTML seulement : un élément SVG se ferme lui-même (`/>`) ou porte des enfants (un `<path>` a sa bulle `<title>`).
    const voids = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr']);
    let depth = 0;
    for (const m of flowHtml.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
      const [tag, closing, name, selfClosing] = m;
      if (closing) {
        depth--;
        continue;
      }
      if (depth === 1) out.push({ row: tag });
      else if (depth === 2 && out.length && out[out.length - 1].first === undefined) out[out.length - 1].first = tag;
      if (!voids.has(name.toLowerCase()) && !selfClosing) depth++;
    }
    return out;
  })();
  const buried = rows.filter((r) => r.first && /\sdata-keep-together/.test(r.first) && !/\sdata-keep-together/.test(r.row));
  ok('page paginée : le pied de section est une RANGÉE marquée (data-idem-folio)', rows.some((r) => /data-idem-folio="1"/.test(r.row)), `${rows.length} rangées`);
  ok('page paginée : une rangée qui enveloppe un bloc insécable est elle-même insécable', rows.length > 2 && buried.length === 0, buried.map((r) => r.first?.slice(0, 80)).join(' | '));

  // ── §6 Motifs ────────────────────────────────────────────────────────────────────────────
  section('§6 Motifs : chacun construit un DesignSpec valide');
  // Chaque motif est essayé avec un contenu qu'il ACCEPTE (son `fit` > 0) : un motif typographique n'est
  // jamais retenu quand une photo est fournie — il l'ignorerait.
  const photoUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const familyContents: Record<string, SectionContent[]> = {
    slide: [MARKET, PROBLEM, TRACTION, TEAM, ASK, coverSection('Kora', 'Pitch deck', 'Torréfaction', 'Le goût du Cameroun'), PROBLEM_VISUAL, MODEL_HUB, VISION_BLEED(photoUrl), PRODUCT_CAPTURE(photoUrl)],
    document: [SUMMARY_BP, FINANCE_BP, SWOT_BP, coverSection('Kora', 'Business plan', 'Torréfaction', 'Le goût du Cameroun')],
    card: [CARD_FRONT, CARD_BACK],
    visual: [flyer(true, { a: '#123', b: '#456', c: '#789' }), flyer(false, { a: '#123', b: '#456', c: '#789' })],
    cover: [
      { id: 'banner', role: 'visual', title: 'Bannière', blocks: [{ id: 'copy', kind: 'copy', headline: 'Le goût du Cameroun', subhead: 'Torréfié chaque semaine' }, { id: 'photo', kind: 'figure', url: photoUrl, alt: 'photo' }] },
      { id: 'banner', role: 'visual', title: 'Bannière', blocks: [{ id: 'copy', kind: 'copy', headline: 'Le goût du Cameroun', subhead: 'Torréfié chaque semaine' }] },
      { id: 'avatar', role: 'visual', title: 'Kora', blocks: [] },
    ],
  };
  const formatOf: Record<string, 'slide-16x9' | 'a4-portrait' | 'card-landscape' | 'flyer-square' | 'cover-facebook'> = { slide: 'slide-16x9', document: 'a4-portrait', card: 'card-landscape', visual: 'flyer-square', cover: 'cover-facebook' };
  let patternsOk = 0;
  const broken: string[] = [];
  for (const pattern of allPatterns()) {
    const format = pattern.id === 'avatar.logo' ? 'avatar-square' : formatOf[pattern.family];
    const content = familyContents[pattern.family].find((s) => {
      const a = analyzeSection(s);
      return (!pattern.roles || (s.role && pattern.roles.includes(s.role))) && pattern.fit(a, FORMATS[format]) > 0;
    });
    if (!content) {
      broken.push(`${pattern.id}: aucun contenu de test adapté`);
      continue;
    }
    const t = buildTokens({ brand: BRANDS.kora, format });
    const plan = planDocument({ documentType: 'pitch-deck', format, seed: 'check' });
    const ctx = createComposeContext({ section: content, plan, slot: { index: 2, strategy: 'monochrome-accent', tension: 'calm', accent: 'underline', prefer: [], avoid: [] }, tokens: t, meta: { brandName: 'Kora', index: 2, total: 6 }, memory: new DiversityMemory(), policy: POLICIES.medium });
    const params = Object.fromEntries(Object.entries(pattern.params).map(([k, v]) => [k, v[0]]));
    const s = specOf(buildCandidate(ctx, pattern, params), content.id);
    const report = validateDesignSpec({ version: '1.0', documentType: 'pitch-deck', format, creativity: 'medium', direction: {}, tokensHash: 'x', seed: 'x', engine: { version: '1', components: '1' }, sections: [s] }, { content: { version: '1.0', documentType: 'pitch-deck', locale: 'fr', sections: [content] } });
    if (report.ok) patternsOk += 1;
    else broken.push(`${pattern.id}: ${report.issues.filter((i) => i.severity === 'blocking').map((i) => i.code).join(',')}`);
  }
  ok(`motifs valides : ${patternsOk}/${allPatterns().length}`, patternsOk === allPatterns().length, broken.slice(0, 20).join(' | '));
  ok('au moins 60 motifs inscrits (diapositives, documents, couvertures, cartes, visuels)', allPatterns().length >= 60);
  const strategies = new Set(allPatterns().flatMap((p) => p.strategies ?? []));
  ok('chaque stratégie visuelle d’une diapositive a au moins un motif qui la sert', ['illustration', 'full-bleed', 'product-capture', 'diagram', 'data-visualization', 'editorial'].every((x) => strategies.has(x as never)), [...strategies].join(', '));

  // ── §7 Composition et diversité ──────────────────────────────────────────────────────────
  section('§7 Composition et diversité (sans rendu)');
  const deckSections = [coverSection('Kora', 'Pitch deck', 'Torréfaction', 'Promesse'), PROBLEM, MARKET, TRACTION, TEAM, ASK];
  const suite = async (seed: string, level: 'low' | 'medium' | 'high' = 'medium') => {
    const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, direction: { styleId: 'swiss' }, creativity: level, seed, sections: deckSections.map((s) => ({ id: s.id, role: s.role })), validate: false });
    const out: string[] = [];
    for (const [i, s] of deckSections.entries()) out.push((await doc.composeSection(s, { index: i + 1, total: deckSections.length })).result.provenance.fingerprint);
    return out;
  };
  const a = await suite('projet-a');
  const prints = a.map((f) => parseFingerprint(f)!).filter(Boolean);
  const stats = diversityStats(prints.slice(1));
  ok(`un deck de six pages emploie ≥ 4 compositions distinctes (hors couverture)`, stats.distinctPatterns >= 4, `${stats.distinctPatterns} motifs, distance moyenne ${stats.meanDistance}`);
  ok('distance moyenne entre pages ≥ 0,45', stats.meanDistance >= 0.45);
  const b = await suite('projet-b');
  const c = await suite('projet-c');
  const seq = (x: string[]) => x.map((f) => f.split('|')[0]).join(',');
  ok('trois projets du même style ⇒ trois suites de compositions différentes', new Set([seq(a), seq(b), seq(c)]).size === 3);
  // Une page qui n'a pas pu prendre le motif réservé ne doit pas prendre celui de sa voisine.
  const neighbours = [];
  for (let i = 0; i < 12; i++) neighbours.push((await suite(`voisins-${i}`)).map((f) => f.split('|')[0]));
  const twins = neighbours.filter((x) => x.some((p, k) => k > 1 && p === x[k - 1]));
  ok('deux diapositives voisines n’ont jamais la même composition (12 decks)', twins.length === 0, twins.map((x) => x.join(' ')).join(' / '));
  ok('même projet ⇒ même suite (déterminisme au cran Low)', seq(await suite('projet-a', 'low')) === seq(await suite('projet-a', 'low')));
  const cs = [planDocument({ documentType: 'business-plan', format: 'a4-portrait', seed: 'x', styleId: 'editorial' })];
  ok('un business plan n’a ni lettre ornée ni contour sur ses titres', !['letter-anchor', 'outline-mix', 'wide-whisper', 'lowercase'].includes(cs[0].mood));

  // ── §8 Profils de créativité ─────────────────────────────────────────────────────────────
  section('§8 Profils de créativité (jauge Low → Ultra)');
  const order = ['low', 'medium', 'high', 'max', 'ultra'] as const;
  ok('l’exploration croît avec le cran (combinaisons, menu, dispersion)', order.every((l, i) => i === 0 || (POLICIES[l].paramSamples >= POLICIES[order[i - 1]].paramSamples && POLICIES[l].menu >= POLICIES[order[i - 1]].menu && POLICIES[l].noise >= POLICIES[order[i - 1]].noise)));
  ok('aucun appel de modèle à Low et Medium', !POLICIES.low.agents.pick && !POLICIES.medium.agents.pick);
  ok('High+ : l’auteur compose (repli choisi à High, réglé à Max) ; révisions sur critique à Max et Ultra', order.every((l) => POLICIES[l].agents.author === (l === 'high' || l === 'max' || l === 'ultra')) && POLICIES.high.agents.pick && !POLICIES.high.agents.tune && POLICIES.max.agents.tune && POLICIES.high.authorRevisions === 0 && POLICIES.max.authorRevisions >= 1 && POLICIES.ultra.authorRevisions > POLICIES.max.authorRevisions);
  ok('le jugement ne bloque qu’à Low et Medium ; la validation reste stricte partout', POLICIES.low.judgementBlocks && POLICIES.medium.judgementBlocks && !POLICIES.high.judgementBlocks && order.every((l) => POLICIES[l].validationPolicy === 'strict' && POLICIES[l].allowCustomCss === false));

  // ── §9 Agents simulés ────────────────────────────────────────────────────────────────────
  section('§9 Agents (simulés) : choix, réglage, arbre d’auteur, critique, budget');
  ok('choix : « 2 » dans un menu de 3 → indice 1', parsePick('{"choice": 2, "why": "x"}', 3) === 1);
  ok('choix hors menu → refusé (repli du code)', parsePick('{"choice": 9}', 3) === undefined && parsePick('blabla', 3) === undefined);
  const authored = parseAuthored(JSON.stringify({ root: { t: 'stack', children: [{ t: 'text', role: 'title', ref: 'title', text: 'Un titre INVENTÉ' }, { t: 'block', ref: 'b1' }, { t: 'block', ref: 'b1' }, { t: 'block', ref: 'zz' }] }, decor: [{ at: { x: 70, y: 0, w: 30, h: 30 }, node: { t: 'shape', shape: 'rings', opacity: 0.9 } }] }), MARKET, FORMATS['slide-16x9']);
  const authoredText = JSON.stringify(authored?.root ?? {});
  ok('arbre d’auteur : texte libre retiré, doublon et bloc inconnu écartés, bloc oublié ajouté', Boolean(authored) && !authoredText.includes('INVENTÉ') && (authoredText.match(/"ref":"b1"/g) ?? []).length === 1 && authoredText.includes('"ref":"b2"') && !authoredText.includes('"zz"'));
  ok('arbre d’auteur : un décor ne dépasse pas 0,15 d’opacité', (authored?.decor[0]?.node as { opacity?: number } | undefined)?.opacity === 0.15);
  const capSection = PRODUCT_CAPTURE('/shot.png');
  const withIcons = { ...PROBLEM_VISUAL, blocks: [{ ...PROBLEM_VISUAL.blocks[0], items: (PROBLEM_VISUAL.blocks[0] as { items: Array<Record<string, unknown>> }).items.map((it, i) => ({ ...it, icon: ['ship', 'coffee', 'plant'][i] })) }] } as SectionContent;
  const layered = parseAuthored(JSON.stringify({ root: { t: 'layer', items: [{ at: { x: 0, y: 0, w: 100, h: 100 }, node: { t: 'image', ref: 'shot', url: 'https://evil.example/x.png' } }, { at: { x: 5, y: 10, w: 40, h: 60 }, z: 2, node: { t: 'box', surface: 'ground', children: [{ t: 'text', role: 'title', ref: 'title' }, { t: 'block', ref: 'b1' }] } }] } }), capSection, FORMATS['slide-16x9']);
  const layeredText = JSON.stringify(layered?.root ?? {});
  ok('auteur : calque superposé, image d’une figure du contenu (adresse écrite par le modèle retirée)', Boolean(layered) && layeredText.includes('"t":"layer"') && layeredText.includes('"ref":"shot"') && !layeredText.includes('evil.example'));
  const byField = parseAuthored(JSON.stringify({ root: { t: 'grid', cols: 3, children: [0, 1, 2].map((i) => ({ t: 'stack', children: [{ t: 'icon', name: ['ship', 'coffee', 'plant'][i] }, { t: 'text', role: 'subtitle', ref: `b1.items.${i}.label` }, { t: 'text', role: 'small', ref: `b1.items.${i}.detail` }] })).concat([{ t: 'stack', children: [{ t: 'icon', name: 'rocket' }] }]) } }), withIcons, FORMATS['slide-16x9']);
  const byFieldText = JSON.stringify(byField?.root ?? {});
  ok('auteur : points posés un à un avec leurs icônes, sans doublon ; icône étrangère retirée', Boolean(byField) && !byFieldText.includes('"t":"block"') && !byFieldText.includes('rocket') && (byFieldText.match(/"t":"icon"/g) ?? []).length === 3);
  const partial = parseAuthored(JSON.stringify({ root: { t: 'stack', children: [{ t: 'text', role: 'subtitle', ref: 'b1.items.0.label' }] } }), withIcons, FORMATS['slide-16x9']);
  ok('auteur : un bloc posé à moitié champ par champ est reposé en entier', Boolean(partial) && JSON.stringify(partial?.root).includes('"t":"block","ref":"b1"') && !JSON.stringify(partial?.root).includes('items.0.label'));
  const critique = parseCritique('{"hierarchy":4,"alignment":5,"legibility":2,"brand":4,"balance":4,"fit":4}');
  ok('critique : six critères, le plus faible compte double', critique?.weakest === 'legibility' && critique.score === Math.round(((4 + 5 + 2 + 4 + 4 + 4 + 2) / 7) * 100) / 100);
  ok('réparation ciblée : action du menu lue, action inventée refusée', parseRepair('{"action":"compact:b1"}', 2, ['b1'])?.kind === 'compact' && parseRepair('{"action":"rewrite everything"}', 2, ['b1']) === undefined);

  const traces: GenerationTrace[] = [];
  configureGraphicEngine({
    onTrace: (t) => traces.push(t),
    agentCall: () => async ({ role, system }) => {
      if (role === 'graphic.artDirector') return system.includes('"params"') ? '{"choice": 2, "params": {}, "tension": "calm", "accent": "none"}' : '{"choice": 2, "why": "variété"}';
      if (role === 'graphic.director') return JSON.stringify({ root: { t: 'stack', grow: true, gap: 'lg', children: [{ t: 'text', role: 'kicker', ref: 'kicker' }, { t: 'text', role: 'display', ref: 'title', size: '3xl' }, { t: 'grid', cols: [5, 7], gap: 'xl', grow: true, children: [{ t: 'block', ref: 'b1' }, { t: 'block', ref: 'b2' }] }] } });
      return '';
    },
  });
  const run = async (level: 'high' | 'max' | 'ultra') => {
    const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, creativity: level, seed: `agents-${level}`, sections: [{ id: 'market' }], validate: false });
    return doc.composeSection(MARKET, { index: 2, total: 6 });
  };
  const high = await run('high');
  ok('High : l’auteur compose (motif « authored »), le choix du directeur sert de repli', high.spec.pattern.id === 'authored' && high.trace.tasks.some((t) => t.task === 'creative.pick' && t.source === 'llm') && high.trace.tasks.some((t) => t.task === 'creative.author' && t.source === 'llm'));
  const max = await run('max');
  ok('Max : repli choisi et réglé en UN appel, puis l’arbre d’auteur', max.trace.tasks.filter((t) => t.source === 'llm').length === 2 && max.trace.tasks.some((t) => t.task === 'creative.tune') && max.spec.pattern.id === 'authored');
  const ultra = await run('ultra');
  ok('Ultra : l’arbre d’auteur est retenu (motif « authored »)', ultra.spec.pattern.id === 'authored' && ultra.trace.tasks.some((t) => t.task === 'creative.author' && t.source === 'llm'));
  configureGraphicEngine({ agentCall: () => async () => 'je ne sais pas' });
  const refused = await run('high');
  ok('réponse illisible → repli du code, jamais d’erreur', refused.trace.tasks.some((t) => t.task === 'creative.pick' && t.outcome === 'refused') && Boolean(refused.result.html));
  const lowDoc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, creativity: 'low', seed: 'low', validate: false });
  const low = await lowDoc.composeSection(MARKET);
  ok('Low : aucun appel de modèle, zéro jeton', low.result.usage.agentCalls === 0 && low.result.usage.inputTokens === 0);
  configureGraphicEngine({ agentCall: undefined });

  // ── §10 Registre de capacités ────────────────────────────────────────────────────────────
  section('§10 Registre de capacités');
  const reg = capabilities();
  ok('composants, motifs, formes, icônes, polices et outils MCP inscrits', reg.list({ kind: 'component' }).length >= 33 && reg.list({ kind: 'pattern' }).length >= 60 && reg.list({ kind: 'icons' }).length >= 1 && reg.list({ kind: 'mcp-tool' }).length >= 1);
  ok('priorité : une icône locale avant l’outil MCP', reg.resolve('icons')?.tier === 'local');
  ok('l’index d’un agent reste court (≤ 1 200 signes)', reg.index({ deliverable: 'pitch-deck' }, 1200).length <= 1200);
  ok('la documentation détaillée se charge à la demande', reg.docs('ui.chart').includes('Variantes'));


  // ── §12 Pitch deck : intention de page, points illustrés, médias, budget de texte ──────────
  section('§12 Pitch deck : montrer plutôt qu’écrire (intention, points, médias, texte)');
  {
    // Le rédacteur : bloc « points » et clé « visual » lus ; la stratégie du modèle n'est admise que si la jauge la laisse choisir.
    const raw = JSON.stringify({ title: 'Trois freins', blocks: [{ kind: 'points', items: [{ label: 'Coût', detail: 'Trop cher', visual: 'money' }, { title: 'Délai', body: 'Trois semaines' }] }], visual: { strategy: 'diagram', keyMessage: 'Trois freins bloquent l’achat.', image: { subject: 'a shopkeeper counting coins' } } });
    const locked = sectionFromModel(raw, { id: 's', intent: { visualStrategy: 'illustration', textBudget: TEXT_BUDGETS.points } }).section;
    const free = sectionFromModel(raw, { id: 's', intent: { visualStrategy: 'illustration', textBudget: TEXT_BUDGETS.points, allowStrategies: ['illustration', 'diagram', 'full-bleed'] } }).section;
    ok('points : libellé, détail et image voulue lus (title/body acceptés en alias)', locked?.blocks[0]?.kind === 'points' && locked.blocks[0].items[1].label === 'Délai' && locked.blocks[0].items[0].visual === 'money');
    ok('Low/Medium : la stratégie du code est gardée, celle du modèle refusée', locked?.intent?.visualStrategy === 'illustration');
    ok('High+ : la stratégie proposée par le modèle est admise', free?.intent?.visualStrategy === 'diagram' && free.intent.keyMessage === 'Trois freins bloquent l’achat.' && free.intent.image?.subject === 'a shopkeeper counting coins');
    ok('le budget de texte posé par le code survit à la seconde normalisation', locked?.intent?.textBudget?.bodyWords === TEXT_BUDGETS.points.bodyWords);
    ok('le contrat du deck propose les points en premier et demande la clé « visual »', contentContract({ deliverable: 'pitch-deck', visual: { strategies: ['illustration', 'diagram'] } }).includes('"visual"') && contentContract({ deliverable: 'pitch-deck' }).indexOf('"kind":"points"') < contentContract({ deliverable: 'pitch-deck' }).indexOf('"kind":"cards"'));

    // Le budget de texte : la page de cartes de paragraphes déborde, la même idée en points illustrés tient.
    const heavy = sectionTextLoad({ ...PROBLEM, intent: { visualStrategy: 'illustration' } }, { headlineWords: 12, bodyWords: 40, maxBullets: 4 });
    const light = sectionTextLoad(PROBLEM_VISUAL);
    const wordyTable = sectionTextLoad({ id: 't', title: 'Concurrence', intent: { visualStrategy: 'editorial' }, blocks: [{ id: 'b1', kind: 'table', headers: ['Acteur', 'Force', 'Faiblesse'], rows: [['Nescafé', 'Distribution dans toutes les boutiques du pays', 'Café soluble importé sans origine locale'], ['Vracs du marché', 'Prix très bas pour les ménages modestes', 'Aucune traçabilité ni régularité de goût'], ['Torréfacteurs artisanaux', 'Goût local apprécié des connaisseurs', 'Pas de marque ni de livraison en bureau']] }] }, TEXT_BUDGETS.statement);
    ok('charge de texte : les phrases d’un tableau comptent (les chiffres non)', wordyTable.over > 1, wordyTable.detail);
    ok('charge de texte : cartes de paragraphes au-dessus du budget, points illustrés dessous', heavy.over > 1 && light.over <= 1, `${heavy.detail} | ${light.detail}`);

    // Le plan des médias : jamais de capture générée ; les points reçoivent une icône locale.
    const capReq = planAssets({ ...PRODUCT_CAPTURE(photo('#111', '#222', '#333')), blocks: PRODUCT_CAPTURE('/x.png').blocks.filter((b) => b.kind !== 'figure') }, FORMATS['slide-16x9']);
    const shot = capReq.find((r) => r.role === 'product-capture');
    ok('capture produit : sources utilisateur, projet, capture — jamais générée ni prise en banque', Boolean(shot) && !shot!.sources.includes('generated') && !shot!.sources.includes('stock'));
    ok('icônes locales trouvées par le mot (ship, coffee, farmer, delivery)', ['ship', 'coffee', 'farmer', 'delivery'].every((w) => Boolean(iconFor(w))), ['ship', 'coffee', 'farmer', 'delivery'].map((w) => `${w}→${iconFor(w)}`).join(' '));

    // La résolution : l'ordre des sources, la génération réservée à High+ et plafonnée, le repli dit.
    const calls: string[] = [];
    const stub = (source: string, url?: string) => ({ resolve: async () => { calls.push(source); return url ? { url, alt: source, provenance: { provider: source } } : null; } });
    const providers: AssetProviders = { user: stub('user'), project: stub('project'), generated: stub('generated', photo('#123', '#456', '#789')), stock: stub('stock', photo('#abc', '#def', '#123')) };
    const bleed = { ...VISION_BLEED('/x.png'), blocks: [] as SectionContent['blocks'] };
    const bleedReqs = planAssets(bleed, FORMATS['slide-16x9']);
    const medium = await resolveAssets(bleedReqs, providers, { level: 'medium', documentType: 'pitch-deck' }, { generationLeft: GENERATION_CAP.medium });
    ok('Medium : utilisateur, projet, puis banque — aucune génération', calls.join(',') === 'user,project,stock' && medium.resolved[0]?.source === 'stock' && medium.generated === 0, calls.join(','));
    calls.length = 0;
    const high = await resolveAssets(bleedReqs, providers, { level: 'high', documentType: 'pitch-deck' }, { generationLeft: GENERATION_CAP.high });
    ok('High : la génération passe avant la banque, et se compte', high.resolved[0]?.source === 'generated' && high.generated === 1);
    calls.length = 0;
    const capped = await resolveAssets(bleedReqs, providers, { level: 'high', documentType: 'pitch-deck' }, { generationLeft: 0 });
    ok('plafond de génération atteint : la banque prend le relais', capped.resolved[0]?.source === 'stock' && !calls.includes('generated'));
    const none = await resolveAssets(bleedReqs, {}, { level: 'high', documentType: 'pitch-deck' }, { generationLeft: 3 });
    const fallen = applyAssets(bleed, none, bleedReqs);
    ok('pleine image sans image : la page redevient éditoriale, et le repli est dit', fallen.section.intent?.visualStrategy === 'editorial' && fallen.notes.length === 1);
    const placed = applyAssets(bleed, high, bleedReqs);
    ok('le média trouvé devient une figure posée par le code (origine système)', placed.section.blocks.some((b) => b.kind === 'figure' && b.origin === 'system'));

    // Le registre du projet : une image déjà obtenue par un autre livrable est reprise avant toute génération.
    const record = (o: Partial<AssetRecord>): AssetRecord => ({ id: 'r', url: '/r.png', kind: 'image', role: 'photo', source: 'generated', subject: 'coffee plantation at sunrise in Cameroon', origin: 'video', provenance: { provider: 'openrouter' }, ...o });
    const coffeeReq = { ...bleedReqs[0], subject: 'a coffee plantation at dawn, Cameroon', purpose: 'local coffee' };
    ok('registre : sujet proche apparié, sujet étranger refusé, capture réservée aux captures', matchAsset(coffeeReq, [record({ url: '/a.png', subject: 'busy office in Lagos' }), record({ url: '/b.png' })])?.url === '/b.png' && matchAsset(coffeeReq, [record({ subject: 'a red sports car' })]) === null && matchAsset({ ...coffeeReq, role: 'product-capture', sources: ['capture'] }, [record({ role: 'photo', source: 'capture' })]) === null);
    const remembered: AssetRecord[] = [];
    const registry: AssetRegistry = { list: async () => [record({ url: '/reuse.png' })], remember: async (_c, r) => void remembered.push(...r) };
    calls.length = 0;
    const reused = await resolveAssets([coffeeReq], providers, { level: 'medium', documentType: 'pitch-deck' }, { generationLeft: 0, registry });
    ok('registre : image déjà générée reprise même à Medium, sans appeler la génération ni la banque', reused.resolved[0]?.url === '/reuse.png' && !calls.includes('generated') && !calls.includes('stock') && reused.log[0].includes('registre'));
    await resolveAssets(bleedReqs, providers, { level: 'high', documentType: 'pitch-deck' }, { generationLeft: 3, registry: { list: async () => [], remember: async (_c, r) => void remembered.push(...r) } });
    ok('registre : ce qui vient d’être généré y est inscrit avec sa provenance', remembered.some((r) => r.source === 'generated' && r.origin === 'deck' && r.provenance.provider === 'generated'));

    // La composition : l'intention fait choisir un motif qui la sert (12 projets, sans rendu).
    const serves = async (content: SectionContent, wanted: string): Promise<number> => {
      let hits = 0;
      for (let i = 0; i < 12; i++) {
        const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, direction: { styleId: 'swiss' }, creativity: 'medium', seed: `intent-${wanted}-${i}`, sections: [{ id: 'cover', role: 'cover' }, { id: content.id }], validate: false });
        const out = await doc.composeSection(content, { index: 2, total: 6 });
        if (allPatterns().find((p) => p.id === out.spec.pattern.id)?.strategies?.includes(wanted as never)) hits += 1;
      }
      return hits;
    };
    const ill = await serves(PROBLEM_VISUAL, 'illustration');
    const hub = await serves(MODEL_HUB, 'diagram');
    const fb = await serves(VISION_BLEED(photo('#1a2a4f', '#c9a227', '#0b1426')), 'full-bleed');
    const cap = await serves(PRODUCT_CAPTURE(capture('#1A2A4F', '#E5EAF7')), 'product-capture');
    ok('l’intention oriente la composition (≥ 10/12 projets par stratégie)', ill >= 10 && hub >= 10 && fb >= 10 && cap >= 10, `illustration ${ill}, schéma ${hub}, pleine image ${fb}, capture ${cap}`);

    // De bout en bout : un fournisseur « utilisateur » branché sur l'hôte, la photo posée, la trace qui le dit.
    configureGraphicEngine({ assetProviders: { user: { resolve: async () => ({ url: photo('#1a2a4f', '#c9a227', '#0b1426'), alt: 'Photo fournie', provenance: { provider: 'upload' } }) } } });
    const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, creativity: 'medium', seed: 'assets-e2e', validate: false });
    const out = await doc.composeSection(bleed, { index: 2, total: 6 });
    configureGraphicEngine({ assetProviders: undefined });
    ok('moteur : la photo de l’utilisateur est posée et tracée (provenance)', out.spec.pattern.id === 'slide.full-bleed' && (out.trace.assets ?? []).some((a) => a.includes('← user (upload)')), `${out.spec.pattern.id} ${(out.trace.assets ?? []).join(' ')}`);
    const iconsDoc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, creativity: 'low', seed: 'icons', validate: false });
    const iconsOut = await iconsDoc.composeSection(PROBLEM_VISUAL, { index: 2, total: 6 });
    ok('moteur : chaque point reçoit son icône locale, sans réseau ni appel', (iconsOut.result.html.match(/data-ge-icon=/g) ?? []).length === 3 && iconsOut.result.usage.agentCalls === 0);
    const heavyOut = await iconsDoc.composeSection({ ...TEAM, intent: { visualStrategy: 'illustration', textBudget: TEXT_BUDGETS.statement } }, { index: 3, total: 6 });
    ok('moteur : une page au-dessus de son budget porte le conseil « text_heavy » (jamais bloquant)', heavyOut.result.issues.some((i) => i.code === 'text_heavy' && i.severity === 'advisory'));

    // L'enregistrement d'une génération : décisions (code / modèle, rôle, modèle résolu), médias, replis, constats séparés.
    const outs = [out, iconsOut, heavyOut];
    const rec = recordFromTraces({ deliverable: 'pitch-deck', level: 'medium', traces: [...outs.map((o) => o.trace), { ...out.trace, sectionId: 'authored-page', tasks: [...out.trace.tasks, { task: 'creative.author' as const, source: 'llm' as const, role: 'graphic.director', inputTokens: 900, outputTokens: 400, ms: 12, outcome: 'accepted' as const }], repairs: [{ code: 'author_fallback', detail: 'arbre bloquant : repli sur slide.stacked', by: 'code' as const }] }], issues: outs.flatMap((o) => o.result.issues.map((i) => ({ scope: o.result.sectionId ?? '?', code: i.code, severity: i.severity }))), modelOf: (role) => (role === 'graphic.director' ? 'test/model' : undefined) });
    ok('enregistrement : décisions du code et du modèle (avec le modèle résolu), médias tracés, repli dit, conseil séparé des bloquants', rec.decisions.some((d) => d.source === 'code') && rec.decisions.some((d) => d.source === 'llm' && d.model === 'test/model') && rec.assets.some((a) => a.includes('← user')) && rec.fallbacks.some((f) => f.includes('repli sur slide.stacked')) && rec.issues.advisory.some((i) => i.includes('text_heavy')) && rec.issues.blocking.length === 0);
  }

  // ── §11 Rendus mesurés dans Chromium ─────────────────────────────────────────────────────
  if (fast) {
    console.log('\n§11 Rendus Chromium — ignorés (--fast)');
  } else {
    section('§11 Rendus mesurés dans Chromium (corpus)');
    // Réparer, pas refuser : un texte trop pâle sur son fond réel est ramené vers l'encre de la charte.
    const pale = `<div class="ge-page" style="width:640px;height:360px;box-sizing:border-box;padding:24px;background:#ffffff;position:relative;overflow:hidden"><p style="margin:0;font-size:14px;color:#c9c9c9">Un texte trop pâle pour être lu</p><p style="margin:12px 0 0;font-size:14px;color:#1f6f43">Un texte lisible, à la couleur de la marque</p></div>`;
    const recolored = await fitAndMeasure(pale, '', FORMATS['chart-free'], { fixed: true, inks: { dark: '#1a1a1a', light: '#ffffff' } });
    ok(
      'contraste : le texte trop pâle est ramené au seuil de lecture, le texte lisible reste à sa couleur',
      recolored.measurement.fitted.recolored === 1 && recolored.measurement.lowContrast.length === 0 && recolored.html.includes('color:#1f6f43') && !recolored.html.includes('color:#c9c9c9'),
      `${recolored.measurement.fitted.recolored} recoloré(s), contraste minimal ${recolored.measurement.minContrast}:1`
    );
    const jobs = [
      { name: 'deck Kora', documentType: 'pitch-deck' as const, format: 'slide-16x9' as const, brand: BRANDS.kora, sections: deckSections },
      { name: 'deck Kofi', documentType: 'pitch-deck' as const, format: 'slide-16x9' as const, brand: BRANDS.kofi, sections: deckSections },
      { name: 'deck visuel', documentType: 'pitch-deck' as const, format: 'slide-16x9' as const, brand: BRANDS.kora, sections: [coverSection('Kora', 'Pitch deck', 'Torréfaction', 'Promesse'), VISION_BLEED(photo('#1a2a4f', '#c9a227', '#0b1426')), PROBLEM_VISUAL, MODEL_HUB, PRODUCT_CAPTURE(capture('#1A2A4F', '#E5EAF7')), MARKET] },
      { name: 'business plan', documentType: 'business-plan' as const, format: 'a4-portrait' as const, brand: BRANDS.baobab, sections: [coverSection('Baobab Agro', 'Business plan', 'Agriculture', 'Promesse'), SUMMARY_BP, FINANCE_BP, SWOT_BP] },
      { name: 'charte', documentType: 'brand-charter' as const, format: 'slide-16x9' as const, brand: BRANDS.kora, sections: [coverSection('Kora', 'Charte graphique', 'Torréfaction', 'Promesse'), ...CHARTER(BRANDS.kora)] },
      { name: 'carte', documentType: 'business-card' as const, format: 'card-landscape' as const, brand: BRANDS.kora, sections: [CARD_FRONT, CARD_BACK], bindings: 'markers' as const },
      { name: 'visuel', documentType: 'flyer' as const, format: 'flyer-square' as const, brand: BRANDS.kofi, sections: [flyer(true, { a: '#3a1c4a', b: '#d6246e', c: '#1f1530' })] },
    ];
    for (const job of jobs) {
      const doc = await createDocument({ documentType: job.documentType, format: job.format, brand: job.brand, direction: { styleId: (job.brand as { styleId?: string }).styleId }, seed: `check:${job.name}`, sections: job.sections.map((s) => ({ id: s.id, role: s.role })), bindings: 'bindings' in job ? job.bindings : undefined });
      const silhouettes: string[] = [];
      let blocking = 0;
      let light = true;
      for (const [i, s] of job.sections.entries()) {
        const out = await doc.composeSection(s, { index: i + 1, total: job.sections.length });
        blocking += out.result.issues.filter((x) => x.severity === 'blocking').length;
        if (out.result.measured?.silhouette) silhouettes.push(out.result.measured.silhouette);
        const ground = (out.result.html.match(/class="ge-page"[^>]*background:(#[0-9a-f]{6})/i) ?? [])[1];
        if (ground && isDeep(ground)) light = false;
      }
      ok(`${job.name} : aucun constat bloquant (${job.sections.length} page(s))`, blocking === 0, blocking ? `${blocking} constat(s)` : '');
      if (job.documentType === 'pitch-deck' || job.documentType === 'brand-charter') ok(`${job.name} : silhouettes MESURÉES toutes distinctes`, new Set(silhouettes.slice(1)).size === silhouettes.slice(1).length);
      if (job.documentType !== 'flyer') ok(`${job.name} : surfaces de page claires (aucun thème sombre)`, light);
    }
    const card = await createDocument({ documentType: 'business-card', format: 'card-landscape', brand: BRANDS.kora, seed: 'card', bindings: 'markers' });
    const face = await card.composeSection(CARD_FRONT);
    ok('carte : 85 × 55 mm exactement', Math.abs((face.result.measured?.width ?? 0) - (85 * 96) / 25.4) < 1.5 && Math.abs((face.result.measured?.height ?? 0) - (55 * 96) / 25.4) < 1.5);
    ok('carte : gabarit à marqueurs {{champ}} avec data-field', face.result.html.includes('{{fullName}}') && face.result.html.includes('data-field="fullName"'));

    // Un décor d'encre posé sur le titre : le moteur le retire, lui seul, et le dit.
    const deck = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, seed: 'decor' });
    const plain = await deck.composeSection(PROBLEM, { index: 2, total: 6 });
    const crowded = { ...plain.spec, decor: [{ at: { x: 0, y: 0, w: 70, h: 45 }, z: 0, node: { t: 'shape' as const, shape: 'rings' as const, tone: 'brand' as const, opacity: 0.85, size: 'fill' as const } }, { at: { x: 0, y: 0, w: 100, h: 0.9 }, z: 0, node: { t: 'box' as const, surface: 'brand' as const, children: [] } }] };
    const cleaned = await deck.composeSection(PROBLEM, { index: 2, total: 6, replay: crowded as never });
    ok('décor d’encre sur un texte : retiré seul (le filet reste)', (cleaned.spec.decor ?? []).length === 1 && cleaned.spec.decor?.[0].node.t === 'box' && cleaned.trace.repairs.some((r) => r.code === 'drop_decor'));
    // L'auteur révise sur la critique (Max) : une note faible renvoie l'arbre à SON auteur, jamais à un gabarit.
    const shot = capture('#1A2A4F', '#E5EAF7');
    const capSlide = PRODUCT_CAPTURE(shot);
    const treeA = { root: { t: 'stack', grow: true, gap: 'lg', children: [{ t: 'text', role: 'title', ref: 'title' }, { t: 'block', ref: 'b1' }, { t: 'image', ref: 'shot', grow: true }] } };
    const treeB = { root: { t: 'layer', items: [{ at: { x: 38, y: 4, w: 62, h: 92 }, node: { t: 'image', ref: 'shot', fit: 'cover', radius: 'lg' } }, { at: { x: 0, y: 8, w: 34, h: 84 }, z: 2, node: { t: 'stack', gap: 'lg', justify: 'center', children: [{ t: 'text', role: 'kicker', ref: 'kicker' }, { t: 'text', role: 'title', ref: 'title', size: '2xl' }, { t: 'block', ref: 'b1', variant: { style: 'list' } }] } }] } };
    let critiques = 0;
    let revisions = 0;
    configureGraphicEngine({
      agentCall: () => async ({ role, user }) => {
        if (role === 'graphic.artDirector') return '{"choice": 1, "params": {}, "tension": "calm", "accent": "none"}';
        if (role === 'graphic.director') {
          if (user.includes('YOUR PREVIOUS DESIGN')) revisions += 1;
          return JSON.stringify(user.includes('YOUR PREVIOUS DESIGN') ? treeB : treeA);
        }
        return '';
      },
      analyzeImage: async () => {
        critiques += 1;
        return critiques === 1 ? '{"hierarchy":3,"alignment":3,"legibility":4,"brand":3,"balance":2,"fit":3}' : '{"hierarchy":4,"alignment":4,"legibility":4,"brand":4,"balance":4,"fit":4}';
      },
    });
    const maxDoc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, creativity: 'max', seed: 'author-revise', sections: [{ id: capSlide.id }] });
    const revised = await maxDoc.composeSection(capSlide, { index: 2, total: 6 });
    configureGraphicEngine({ agentCall: undefined, analyzeImage: undefined });
    ok('Max : l’arbre d’auteur jugé faible est révisé par son auteur (calque superposé), le meilleur gardé', revisions === 1 && revised.spec.pattern.id === 'authored' && revised.spec.root.t === 'layer' && revised.trace.repairs.some((r) => r.code === 'author_revised') && !revised.result.issues.some((i) => i.severity === 'blocking'), `${revisions} révision(s), ${revised.trace.repairs.map((r) => r.code).join(',')}`);
    await closeBrowser();
  }

  console.log(`\n${failures ? '✗' : '✓'} Moteur graphique : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await closeBrowser();
  process.exit(1);
});



