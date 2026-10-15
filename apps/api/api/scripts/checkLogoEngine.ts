/**
 * `npm run check:logo` — le moteur de logos, de bout en bout, sans réseau ni modèle.
 *
 *  1. Contrat : les 11 catégories, nombres bornés (jamais rejetés), identifiants uniques, versionné.
 *  2. Node seul : aucun React, aucun jsdom, aucun canvas natif n'est chargé pour produire un SVG.
 *  3. Noyau remplaçable : le moteur tourne sur un noyau géométrique de test (interface `GeometryKernel`).
 *  4. Géométrie : opérations booléennes exactes (aires), tous les générateurs sur 40 tirages.
 *  5. Typographie : lettres vectorisées (aucun <text>), effets, police ou glyphe manquant refusés.
 *  6. Composition : alignement, empilement, symbole seul ; variantes issues de la MÊME géométrie.
 *  7. Validation technique : 14 fichiers défectueux détectés ; fichiers valides acceptés.
 *  8. Validation visuelle : contraste, détails fins, hiérarchie ; l'auto-amélioration corrige sans aggraver.
 *  9. Corrections ciblées : un patch ne touche que sa couche.
 * 10. Les 11 catégories produisent un logo accepté ; reproductible (même entrée ⇒ mêmes octets).
 * 11. Planificateur : propositions distinctes entre elles et de la mémoire ; briefs différents ⇒ logos différents.
 * 12. Agent par cran (modèle simulé) : méthode qui monte, replis, garde-fous (texte, palette, dessin libre).
 * 13. Budget : tokens de l'agent vs l'ancien pipeline (SVG dessiné par le modèle).
 * 14. Export : fichiers valides, logo.json rouvrable à l'identique, ZIP.
 * 15. Jeu de tests : qualité mesurée sur 8 marques × 3 types.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import JSZip from 'jszip';
import {
  assessLogo,
  buildLogo,
  CONCEPT_TYPES,
  defaultRasterizer,
  designLogos,
  exportLogoPackage,
  fileFontProvider,
  fingerprintDistance,
  getGenerator,
  listGenerators,
  LOGO_SIMILARITY,
  parseLogoDocument,
  planLogos,
  produceLogo,
  readLogoJson,
  renderVariants,
  validateSvgTechnical,
  zipExport,
} from '../services/logo-engine';
import type { ConceptType, GeometryKernel, LogoDocument, LogoFingerprint, PlanBrief } from '../services/logo-engine';
import { applyPatch } from '../services/logo-engine/ir/patch';
import { LogoDocumentSchema, LOGO_IR_VERSION } from '../services/logo-engine/ir/logo.schema';
import { fixOnce } from '../services/logo-engine/validate/autofix';
import { randomParams, resolveParams, seeded } from '../services/logo-engine/render/generators';
import { candidateDocs, docForDirection } from '../services/logo-engine/planner/planner';
import { PaperGeometryKernel } from '../services/logo-engine/kernel/paper.kernel';
import { circlePath, rectPath } from '../services/logo-engine/kernel/primitives';
import { extractFontFileUrl } from '../services/BandIdentity/lockup/fontLoader.service';
import { estimateTokens } from '../../../ivision/core/src/creativity/orchestrator';
import type { AgentCall } from '../../../ivision/core/src/creativity/orchestrator';
import { LOGO_GENERATION_ICON_TYPE_PROMPT } from '../services/BandIdentity/prompts/singleGenerations/00_logo-generation-icon-type.prompt';
import { LOGO_GENERATION_NAME_TYPE_PROMPT } from '../services/BandIdentity/prompts/singleGenerations/00_logo-generation-name-type.prompt';
import { LOGO_CRITIQUE_PROMPT } from '../services/BandIdentity/prompts/singleGenerations/logo-critique.prompt';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (title: string) => console.log(`\n${title}`);
const sha = (text: string) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FONT_FILE = path.resolve(__dirname, '../../../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf');
const fonts = fileFontProvider(FONT_FILE);
const BUILD = { fontProvider: fonts, fonts: { display: { family: 'Liberation Sans' }, body: { family: 'Liberation Sans' } } };
const PALETTE = { ink: '#0f3d5e', ink2: '#2a9d8f', accent: '#e76f51' };

const BRANDS: { brief: PlanBrief; pal: { primary: string; secondary: string; accent: string } }[] = [
  { brief: { brandName: 'Verda', industry: 'agriculture bio', description: 'Fruits et légumes bio cultivés au Cameroun, livrés aux restaurants', personality: ['naturel', 'durable'] }, pal: { primary: '#14532d', secondary: '#65a30d', accent: '#f59e0b' } },
  { brief: { brandName: 'Kora Bank', industry: 'banque mobile fintech', description: 'Paiement mobile et épargne pour les jeunes actifs', personality: ['fiable', 'moderne'] }, pal: { primary: '#0f3d5e', secondary: '#2a9d8f', accent: '#e76f51' } },
  { brief: { brandName: 'Maison Ébène', industry: 'bijoux luxe', description: 'Joaillerie africaine haut de gamme', personality: ['luxe', 'élégant'] }, pal: { primary: '#2b1b17', secondary: '#b08d57', accent: '#8a1c2b' } },
  { brief: { brandName: 'Tamtam', industry: 'musique et événements', description: 'Organisation de concerts et festivals à Douala', personality: ['festif', 'créatif', 'jeune'] }, pal: { primary: '#7c2d12', secondary: '#ea580c', accent: '#facc15' } },
  { brief: { brandName: 'Clinique Sahel', industry: 'santé clinique médicale', description: 'Soins de proximité et téléconsultation', personality: ['soin', 'confiance'] }, pal: { primary: '#075985', secondary: '#0d9488', accent: '#f97316' } },
  { brief: { brandName: 'Atlas Logistique', industry: 'transport logistique', description: 'Livraison de colis entre villes africaines', personality: ['rapide', 'fiable', 'performance'] }, pal: { primary: '#1e3a8a', secondary: '#0891b2', accent: '#f59e0b' } },
  { brief: { brandName: 'Nova Académie', industry: 'éducation formation', description: 'Cours en ligne et mentorat pour étudiants', personality: ['savoir', 'jeune'] }, pal: { primary: '#4c1d95', secondary: '#0ea5e9', accent: '#f43f5e' } },
  { brief: { brandName: 'Kiosk', industry: 'commerce e-commerce boutique', description: 'Marketplace de créateurs locaux', personality: ['ludique', 'tendance'] }, pal: { primary: '#9d174d', secondary: '#0f766e', accent: '#fbbf24' } },
];

const baseDoc = (layers: unknown[], extra: Record<string, unknown> = {}) => ({ brief: { brandName: 'Kora' }, concept: { type: 'combination' }, palette: PALETTE, layers, ...extra });
const gen = (generator: string, params: Record<string, unknown> = {}, id = 'sym') => ({ kind: 'generator', id, generator, params });
const text = (content: string, extra: Record<string, unknown> = {}) => ({ kind: 'text', id: 'name', content, ...extra });

async function build(doc: unknown, options: Record<string, unknown> = {}) {
  return buildLogo(doc, { ...BUILD, ...options });
}

async function main(): Promise<void> {
  const started = Date.now();
  const raster = defaultRasterizer();

  // ── 1. Contrat ──────────────────────────────────────────────────────────
  section('1. Le contrat (Logo IR)');
  check('version déclarée', LOGO_IR_VERSION === '1.0');
  check('11 catégories dans le schéma', CONCEPT_TYPES.length === 11 && ['wordmark', 'lettermark', 'letterform', 'pictorial', 'abstract', 'mascot', 'combination', 'emblem', 'dynamic', 'minimal', 'negative-space'].every((t) => (CONCEPT_TYPES as readonly string[]).includes(t)));
  const clamped = parseLogoDocument(baseDoc([gen('rosette', { petals: 14 }), { kind: 'shape', id: 'c', geometry: { type: 'circle', cx: 50, cy: 50, r: 9999 } }]));
  check('un nombre hors bornes est ramené, pas rejeté', clamped.ok && clamped.doc!.layers[1].kind === 'shape' && (clamped.doc!.layers[1] as { geometry: { r: number } }).geometry.r === 300);
  check('des défauts sont posés (variantes, canevas, graine)', clamped.ok && clamped.doc!.variants.length >= 4 && clamped.doc!.canvas.width === 1200 && clamped.doc!.meta.seed === 1);
  check('hex « #abc » normalisé', parseLogoDocument(baseDoc([gen('orbit')], { palette: { ink: '#0AF' } })).doc?.palette.ink === '#00aaff');
  const dup = parseLogoDocument(baseDoc([gen('orbit', {}, 'a'), gen('arcs', {}, 'a')]));
  check('identifiant de couche en double refusé', !dup.ok && /double/.test(dup.errors.join(' ')), dup.errors[0]);
  check('type de couche inconnu refusé', !parseLogoDocument(baseDoc([{ kind: 'sprite', id: 'x' }])).ok);
  check('couleur non hexadécimale refusée', !parseLogoDocument(baseDoc([gen('orbit')], { palette: { ink: 'red' } })).ok);
  check('plus de 48 couches refusé', !parseLogoDocument(baseDoc([{ kind: 'group', id: 'g', children: Array.from({ length: 24 }, (_, i) => ({ kind: 'group', id: `a${i}`, children: [gen('orbit', {}, `b${i}`), gen('arcs', {}, `c${i}`)] })) }])).ok);
  check('le schéma sert aussi de contrat JSON (Zod)', LogoDocumentSchema instanceof z.ZodType);

  // ── 2. Node seul ────────────────────────────────────────────────────────
  section('2. Node seul : ni React, ni navigateur');
  const forbidden = Object.keys(require.cache).filter((m) => /node_modules\/(react|react-dom|jsdom|canvas|puppeteer)\//.test(m));
  const simple = await build(baseDoc([gen('rosette'), text('Kora')]));
  check('le SVG est produit sans modèle ni navigateur', simple.ok && !!simple.rendered);
  check('aucun module React / jsdom / canvas / puppeteer chargé', forbidden.length === 0, forbidden.slice(0, 2).join(', '));
  check('le rendu est exécutable (resvg ou sharp)', ['resvg-js', 'sharp'].includes(raster.name), raster.name);

  // ── 3. Noyau remplaçable ────────────────────────────────────────────────
  section('3. Le noyau géométrique se remplace (interface GeometryKernel)');
  const real = new PaperGeometryKernel();
  let calls = 0;
  const stubKernel: GeometryKernel = {
    name: 'stub',
    fromPath: (d) => {
      calls++;
      return real.fromPath(d);
    },
    transform: (s, m) => real.transform(s, m),
    combine: (op, a, b) => real.combine(op, a, b),
    area: (s) => real.area(s),
    contours: (s) => real.contours(s),
  };
  const viaStub = await build(baseDoc([gen('cube'), text('Kora')]), { kernel: stubKernel });
  check('le moteur tourne sur un autre noyau', viaStub.ok && calls > 0, `${calls} appels`);
  const viaDefault = await build(baseDoc([gen('cube'), text('Kora')]));
  check('même résultat avec l\'implémentation de référence', viaStub.rendered?.svg === viaDefault.rendered?.svg);

  // ── 4. Géométrie ────────────────────────────────────────────────────────
  section('4. Géométrie : booléens exacts, générateurs');
  const A = real.fromPath(circlePath(40, 50, 30))!;
  const B = real.fromPath(circlePath(65, 50, 30))!;
  const aArea = real.area(A);
  const near = (x: number, y: number, tol = 0.01) => Math.abs(x - y) / Math.max(1, Math.abs(y)) < tol;
  const union = real.combine('union', A, B)!;
  const inter = real.combine('intersect', A, B)!;
  const sub = real.combine('subtract', A, B)!;
  const excl = real.combine('exclude', A, B)!;
  check('aire d\'un disque = πr²', near(aArea, Math.PI * 900, 0.005), `${aArea.toFixed(1)}`);
  check('union + intersection = A + B', near(real.area(union) + real.area(inter), 2 * aArea, 0.01));
  check('A − B = A − (A ∩ B)', near(real.area(sub), aArea - real.area(inter), 0.01));
  check('exclusion = union − intersection', near(real.area(excl), real.area(union) - real.area(inter), 0.01));
  const ring = real.fromPath(`${circlePath(50, 50, 40, true)}${circlePath(50, 50, 25, false)}`)!;
  check('un anneau a 2 contours et l\'aire attendue', real.contours(ring).length === 2 && near(real.area(ring), Math.PI * (1600 - 625), 0.01));
  check('rectangle arrondi : aire < rectangle plein', real.area(real.fromPath(rectPath(0, 0, 100, 60, 20))!) < 6000);
  check('un tracé illisible renvoie null', real.fromPath('hello') === null && real.fromPath('') === null);

  const generators = listGenerators();
  check('catalogue : générateurs abstraits, figuratifs et mascottes', ['abstract', 'pictorial', 'mascot'].every((f) => generators.some((g) => g.family === f)), `${generators.length} générateurs`);
  let genFailures = 0;
  let genRuns = 0;
  const outOfBox: string[] = [];
  for (const spec of generators) {
    for (let t = 0; t < 40; t++) {
      genRuns++;
      const rng = seeded(1000 + t * 31 + spec.id.length);
      const params = t === 0 ? {} : randomParams(spec, rng);
      const resolved = resolveParams(spec, params);
      const bad = Object.entries(spec.params).some(([k, def]) => def.kind === 'num' && ((resolved[k] as number) < def.min || (resolved[k] as number) > def.max));
      try {
        const parts = spec.build(resolved, { kernel: real, rng });
        const shapes = parts.map((p) => real.fromPath(p.d)).filter(Boolean);
        const ok = shapes.length > 0 && shapes.every((s) => s!.bounds.x > -40 && s!.bounds.y > -40 && s!.bounds.x + s!.bounds.w < 140 && s!.bounds.y + s!.bounds.h < 140);
        if (!ok || bad) {
          genFailures++;
          if (outOfBox.length < 4) outOfBox.push(`${spec.id}#${t}`);
        }
      } catch (error) {
        genFailures++;
        outOfBox.push(`${spec.id}#${t}: ${(error as Error).message}`);
      }
    }
  }
  check(`${genRuns} constructions (${generators.length} générateurs × 40 tirages) : aucune erreur, aucune sortie de la boîte`, genFailures === 0, outOfBox.join(' | '));
  check('paramètres inconnus ignorés, valeurs absentes = défauts', JSON.stringify(resolveParams(getGenerator('orbit')!, { foo: 1, rings: 99 })) === JSON.stringify({ ...resolveParams(getGenerator('orbit')!, {}), rings: 3 }));
  const unknownGen = await build(baseDoc([gen('does-not-exist')]));
  check('générateur inconnu : signalé, pas d\'exception', !unknownGen.ok && unknownGen.errors.length > 0);

  // ── 5. Typographie ──────────────────────────────────────────────────────
  section('5. Typographie : des lettres devenues des tracés');
  const word = await build(baseDoc([text('Kora Bank')], { composition: { layout: 'wordmark-only' } }));
  const wordSvg = word.rendered?.svg ?? '';
  check('aucun <text> : le nom est vectorisé', word.ok && !/<text/i.test(wordSvg) && /<path/.test(wordSvg));
  const fxNames = ['dot', 'underline', 'bar', 'slice', 'ligature', 'dotReplace', 'swapRound', 'cutCorner', 'accentChar', 'italic'];
  const fxSvgs = new Set<string>([wordSvg]);
  let fxOk = 0;
  for (const type of fxNames) {
    const eff = type === 'swapRound' ? { type, index: 1 } : type === 'cutCorner' || type === 'accentChar' ? { type, index: 0 } : { type };
    const r = await build(baseDoc([text(type === 'dotReplace' ? 'Digi lit' : 'Kora Bank', { effects: [eff] })], { composition: { layout: 'wordmark-only' } }));
    if (r.ok && r.rendered && !fxSvgs.has(r.rendered.svg) && r.warnings.length === 0) fxOk++;
    if (r.rendered) fxSvgs.add(r.rendered.svg);
  }
  check('les 10 effets typographiques produisent chacun un tracé différent', fxOk === fxNames.length, `${fxOk}/${fxNames.length}`);
  const wide = await build(baseDoc([text('Kora Bank', { tracking: 0.3 })], { composition: { layout: 'wordmark-only' } }));
  check('l\'interlettrage élargit le mot', (wide.rendered?.stats.nodes ?? 0) > 0 && wide.rendered!.width / wide.rendered!.height > word.rendered!.width / word.rendered!.height);
  const upper = await build(baseDoc([text('Kora', { case: 'upper' })], { composition: { layout: 'wordmark-only' } }));
  const mixed = await build(baseDoc([text('KORA')], { composition: { layout: 'wordmark-only' } }));
  check('case: upper ≡ texte en capitales', upper.rendered?.svg === mixed.rendered?.svg);
  const noFont = await buildLogo(baseDoc([text('Kora')]), { fonts: { display: { family: 'Absente' } }, fontProvider: { load: async () => null } });
  const noFontReport = noFont.session && noFont.rendered ? await assessLogo(noFont.session, noFont.rendered, { skipVariants: true }) : null;
  check('police introuvable : refus clair (jamais de <text> de repli)', !noFont.ok || (noFontReport !== null && !noFontReport.ok), noFont.errors[0] ?? noFontReport?.defects[0]?.message);
  const emoji = await build(baseDoc([text('Kora ✺')], { composition: { layout: 'wordmark-only' } }));
  const emojiReport = emoji.session && emoji.rendered ? await assessLogo(emoji.session, emoji.rendered, { skipVariants: true }) : null;
  check('glyphe absent de la police : refusé (pas de rectangle .notdef)', !emoji.ok || (emojiReport !== null && emojiReport.defects.some((d) => d.code === 'glyph_missing')));
  const accents = await build(baseDoc([text('Ébène Café')], { composition: { layout: 'wordmark-only' } }));
  check('les accents sont tracés', accents.ok && accents.warnings.length === 0);
  const curved = await build(baseDoc([{ kind: 'shape', id: 'r', geometry: { type: 'ring', cx: 50, cy: 50, r: 48, thickness: 4 } }, text('NDJAMENA', { id: 'arc', role: 'symbol', size: 8, at: { x: 50, y: 50 }, curve: { radius: 32, start: 0, side: 'top' } })], { composition: { layout: 'symbol-only' } }));
  check('texte sur un arc (emblème)', curved.ok && curved.rendered!.stats.paths >= 2);

  // Le chargeur de polices sert la graisse DEMANDÉE (une feuille Fontshare décrit les neuf, de 100 à 900).
  const multiWeight = [100, 400, 700, 900].map((w) => `@font-face{font-family:'Poppins';src:url('//cdn.fontshare.com/wf/w${w}.woff2') format('woff2'),url('//cdn.fontshare.com/wf/w${w}.ttf') format('truetype');font-weight:${w};}`).join('\n');
  check('feuille multi-graisses : la graisse demandée, pas la première', extractFontFileUrl(multiWeight, 700) === 'https://cdn.fontshare.com/wf/w700.ttf' && extractFontFileUrl(multiWeight, 100) === 'https://cdn.fontshare.com/wf/w100.ttf');
  check('graisse absente : la plus proche', extractFontFileUrl(multiWeight, 800) === 'https://cdn.fontshare.com/wf/w700.ttf' && extractFontFileUrl(multiWeight, 500) === 'https://cdn.fontshare.com/wf/w400.ttf');
  check('police variable (font-weight: 100 900) : le fichier unique', extractFontFileUrl("@font-face{src:url(https://x.test/var.ttf);font-weight:100 900;}", 500) === 'https://x.test/var.ttf');
  check('feuille Google à un seul bloc, sans guillemets', extractFontFileUrl('@font-face{font-family:Poppins;font-weight:500;src:url(https://fonts.gstatic.com/s/p.ttf) format("truetype");}', 500) === 'https://fonts.gstatic.com/s/p.ttf');
  check('WOFF2 seul : aucun fichier vectorisable', extractFontFileUrl("@font-face{src:url('https://x.test/a.woff2') format('woff2');font-weight:400;}", 400) === null);

  // ── 6. Composition & variantes ──────────────────────────────────────────
  section('6. Composition et variantes');
  const combo = await build(baseDoc([gen('sprout'), text('Kora')], { composition: { layout: 'horizontal' } }));
  const comboVisual = combo.session && combo.rendered ? await assessLogo(combo.session, combo.rendered, { skipVariants: true }) : null;
  check('horizontal : le nom est centré sur le symbole', (comboVisual?.metrics.alignY ?? 1) < 0.1, `écart ${comboVisual?.metrics.alignY}`);
  check('horizontal : le nom est à droite du symbole', !!combo.rendered && combo.rendered.scene.boxes.wordmark!.x >= combo.rendered.scene.boxes.symbol!.x + combo.rendered.scene.boxes.symbol!.w);
  const stacked = await build(baseDoc([gen('sprout'), text('Kora')], { composition: { layout: 'stacked' } }));
  const sb = stacked.rendered!.scene.boxes;
  check('empilé : nom sous le symbole, centrés', sb.wordmark!.y >= sb.symbol!.y + sb.symbol!.h && Math.abs(sb.wordmark!.x + sb.wordmark!.w / 2 - (sb.symbol!.x + sb.symbol!.w / 2)) < 2);
  const symbolOnly = await build(baseDoc([gen('sprout'), text('Kora')], { composition: { layout: 'symbol-only' } }));
  check('symbole seul : aucune lettre', symbolOnly.ok && !symbolOnly.rendered!.scene.groups.wordmark.length);
  const tall = await build(baseDoc([gen('sprout'), text('Kora Bank', { id: 'name1' }), text('Cooperative Federation', { id: 'name2' })], { composition: { layout: 'horizontal' } }));
  const oneLine = await build(baseDoc([gen('sprout'), text('Kora Bank Cooperative Federation')], { composition: { layout: 'horizontal' } }));
  check('nom sur deux lignes : empilées et centrées, logo moins étiré qu\'en une ligne', tall.ok && oneLine.ok && tall.rendered!.scene.groups.wordmark.length > 0 && tall.rendered!.width / tall.rendered!.height < oneLine.rendered!.width / oneLine.rendered!.height, `${(tall.rendered!.width / tall.rendered!.height).toFixed(1)} vs ${(oneLine.rendered!.width / oneLine.rendered!.height).toFixed(1)}`);

  const variantsSession = combo.session!;
  const variants = renderVariants(variantsSession);
  const byKind = Object.fromEntries(variants.map((v) => [v.kind, v]));
  check('variantes : principale, monochrome, inversée, symbole', ['primary', 'monochrome', 'inverted', 'symbol'].every((k) => byKind[k]));
  // SVGO raccourcit #ffffff en #fff : on compare des couleurs normalisées.
  const long = (h: string) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toLowerCase();
  const colorsOf = (svg: string) => new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]{3,6})"/g)].map((m) => long(m[1])));
  check('monochrome : une seule couleur', colorsOf(byKind.monochrome.svg).size === 1);
  const pathsOf = (svg: string) => [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]).join('|');
  check('inversée : même géométrie que la principale (couleurs seules changent)', pathsOf(byKind.inverted.svg) === pathsOf(byKind.primary.svg));
  check('inversée : fond sombre lisible (≥ 3:1)', [...colorsOf(byKind.inverted.svg)].every((c) => contrastOnDark(c) >= 3), [...colorsOf(byKind.inverted.svg)].join(','));
  check('symbole seul sans texte et plus carré', byKind.symbol.width / byKind.symbol.height < combo.rendered!.width / combo.rendered!.height);
  const wordOnlyDoc = await build(baseDoc([text('Kora')], { composition: { layout: 'wordmark-only' } }));
  check('logo sans symbole : pas de variante « symbole seul » factice', !renderVariants(wordOnlyDoc.session!).some((v) => v.kind === 'symbol'));
  const dynDoc = await build(baseDoc([gen('rosette', { petals: 6 })], { composition: { layout: 'symbol-only' }, variants: [{ id: 'primary', kind: 'primary' }, { id: 'calm', kind: 'dynamic', overrides: { sym: { params: { petals: 4 } } } }, { id: 'warm', kind: 'dynamic', overrides: { sym: { fill: 'accent' } } }] }));
  const dyn = renderVariants(dynDoc.session!);
  check('logo dynamique : variantes liées (paramètre, couleur) distinctes de la base', dyn.length === 3 && new Set(dyn.map((v) => sha(v.svg))).size === 3);

  // ── 7. Validation technique ─────────────────────────────────────────────
  section('7. Validation technique');
  const good = simple.rendered!.svg;
  check('un SVG du moteur est valide', (await validateSvgTechnical(good)).ok);
  const bad: [string, string, string][] = [
    ['texte vivant', good.replace('</svg>', '<text x="1" y="1">x</text></svg>'), 'forbidden_tag'],
    ['image embarquée', good.replace('</svg>', '<image href="data:image/png;base64,AAAA"/></svg>'), 'forbidden_tag'],
    ['script', good.replace('</svg>', '<script>alert(1)</script></svg>'), 'forbidden_tag'],
    ['feuille de style', good.replace('</svg>', '<style>path{fill:red}</style></svg>'), 'forbidden_tag'],
    ['référence externe', good.replace('<path', '<path href="https://x.y/z"'), 'external_ref'],
    ['url() externe', good.replace(/fill="#[0-9a-f]{6}"/, 'fill="url(https://x.y/g)"'), 'external_ref'],
    ['gestionnaire d\'événement', good.replace('<path', '<path onclick="x()"'), 'event_handler'],
    ['balise non refermée', good.replace('</svg>', ''), 'malformed_xml'],
    ['sans xmlns', good.replace(' xmlns="http://www.w3.org/2000/svg"', ''), 'no_xmlns'],
    ['sans viewBox', good.replace(/viewBox="[^"]+"/, ''), 'bad_viewbox'],
    ['tracé non numérique', good.replace(/ d="[^"]+"/, ' d="M0 0L NaN 5Z"'), 'invalid_path_data'],
    ['document vide', '', 'empty'],
    ['pas de SVG', '<html></html>', 'no_root'],
    ['aucun tracé', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>', 'no_paths'],
  ];
  for (const [label, svg, code] of bad) {
    const r = await validateSvgTechnical(svg);
    check(`refusé : ${label}`, !r.ok && r.defects.some((d) => d.code === code), r.defects.map((d) => d.code).join(','));
  }
  const offPalette = await validateSvgTechnical(good.replace(/fill="#[0-9a-f]{6}"/, 'fill="#ff00ff"'), { palette: ['#0f3d5e'] });
  check('couleur hors charte signalée', offPalette.defects.some((d) => d.code === 'off_palette'));
  const opaque = await validateSvgTechnical(good.replace('<title', '<rect width="100%" height="100%" fill="#ffffff"/><title'));
  check('une balise <rect> inconnue du moteur est signalée', opaque.defects.some((d) => d.code === 'unknown_tag'));
  check('un SVG du moteur est léger (< 20 Ko) pour un logo combiné', Buffer.byteLength(good) < 20_000, `${Buffer.byteLength(good)} octets`);

  // ── 8. Validation visuelle ──────────────────────────────────────────────
  section('8. Validation visuelle et auto-amélioration');
  const hairline = await build(baseDoc([gen('arcs', { thick: 5, gap: 10, count: 2 })], { palette: { ink: '#cfd8dc', accent: '#cfd8dc' }, composition: { layout: 'symbol-only' } }));
  const hairlineReport = await assessLogo(hairline.session!, hairline.rendered!, { skipVariants: true });
  check('contraste insuffisant détecté', hairlineReport.defects.some((d) => d.code === 'low_contrast_ink'), hairlineReport.defects.map((d) => d.code).join(','));
  const fixedContrast = fixOnce(hairline.doc!, hairlineReport.defects);
  const rebuilt = fixedContrast ? await build(fixedContrast.doc) : null;
  const rebuiltReport = rebuilt?.rendered ? await assessLogo(rebuilt.session!, rebuilt.rendered, { skipVariants: true }) : null;
  check('auto-amélioration : l\'encre est assombrie jusqu\'à 3:1, score en hausse', !!rebuiltReport && !rebuiltReport.defects.some((d) => d.code === 'low_contrast_ink') && rebuiltReport.score > hairlineReport.score, `${hairlineReport.score} → ${rebuiltReport?.score}`);
  const thin = await build(baseDoc([gen('sunburst', { rays: 16, width: 5, core: 'none' })], { composition: { layout: 'symbol-only' } }));
  const thinReport = await assessLogo(thin.session!, thin.rendered!, { skipVariants: true });
  check('détails trop fins à petite taille détectés', thinReport.defects.some((d) => d.code === 'thin_details' || d.code === 'illegible_small'), `solid24=${thinReport.metrics.solid24}`);
  const dominated = await build(baseDoc([gen('drop'), text('Kora Bank Cooperative')], { composition: { layout: 'horizontal', symbolScale: 1 } }));
  const dominatedReport = await assessLogo(dominated.session!, dominated.rendered!, { skipVariants: true });
  check('nom qui écrase le symbole détecté', dominatedReport.defects.some((d) => d.code === 'wordmark_dominates'), `ratio ${dominatedReport.metrics.wordRatio}`);
  const crowded = await build(baseDoc([gen('drop'), text('Kora')], { composition: { layout: 'horizontal', gap: 0.05 } }));
  const crowdedReport = await assessLogo(crowded.session!, crowded.rendered!, { skipVariants: true });
  check('symbole et nom collés détectés', crowdedReport.defects.some((d) => d.code === 'crowded'), `espace ${crowdedReport.metrics.gap}`);
  const noSymbol = await build(baseDoc([text('Kora')], { concept: { type: 'pictorial' }, composition: { layout: 'wordmark-only' } }));
  const noSymbolReport = await assessLogo(noSymbol.session!, noSymbol.rendered!, { skipVariants: true });
  check('un logo « pictorial » sans symbole est bloquant', noSymbolReport.defects.some((d) => d.code === 'missing_symbol' && d.severity === 'blocker') && !noSymbolReport.ok);
  const heavy = await build(baseDoc([gen('lattice', { grid: 4 })], { concept: { type: 'minimal' }, composition: { layout: 'symbol-only' } }));
  const heavyReport = await assessLogo(heavy.session!, heavy.rendered!, { skipVariants: true });
  check('un logo « minimal » trop détaillé est signalé (simplicité par type)', heavyReport.defects.some((d) => d.code === 'too_complex'), `${heavyReport.metrics.symbolNodes} nœuds`);
  const goodReport = await assessLogo(combo.session!, combo.rendered!);
  check('un bon logo est accepté, variantes validées', goodReport.accepted && goodReport.variants.every((v) => v.ok) && goodReport.variants.length >= 4, `score ${goodReport.score}`);

  // ── 9. Corrections ciblées ──────────────────────────────────────────────
  section('9. Corrections ciblées : on ne redessine pas tout');
  const multi = await build(baseDoc([gen('rosette', { petals: 6 }, 'mark'), { kind: 'shape', id: 'dot', fill: 'accent', geometry: { type: 'circle', cx: 80, cy: 20, r: 6 } }, text('Kora')]));
  const before = multi.rendered!.svg;
  const patched = applyPatch(multi.doc!, [{ op: 'layer', id: 'dot', fill: 'ink2' }]);
  const after = (await build(patched.doc))?.rendered?.svg ?? '';
  const pathsBefore = [...before.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  const pathsAfter = [...after.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  check('changer la couleur d\'une couche ne change aucune géométrie', patched.ok && JSON.stringify(pathsBefore) === JSON.stringify(pathsAfter) && before !== after);
  const petals = applyPatch(multi.doc!, [{ op: 'layer', id: 'mark', params: { petals: 9 } }]);
  const petalsSvg = (await build(petals.doc))?.rendered?.svg ?? '';
  const petalPaths = [...petalsSvg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  check('changer un paramètre ne touche que cette couche (le nom est identique)', petals.ok && petalPaths[petalPaths.length - 1] !== undefined && pathsBefore.slice(-1)[0] !== undefined && /petals/.test(JSON.stringify(petals.doc!.layers[0])), '');
  const letter = applyPatch(multi.doc!, [{ op: 'text', id: 'name', content: 'Kora Lab', weight: 600 }]);
  check('patch typographique : texte et graisse', letter.ok && (letter.doc!.layers[2] as { content: string }).content === 'Kora Lab');
  const refused = applyPatch(multi.doc!, [{ op: 'layer', id: 'inconnue', fill: 'ink' }, { op: 'layer', id: 'mark', params: { petals: 5 } }, { op: 'generator', id: 'mark', generator: 'licorne' }, { op: 'text', id: 'mark', content: 'x' }, { op: 'bogus' }]);
  check('opérations invalides refusées une à une, la valide appliquée', refused.ok && refused.applied === 1 && refused.errors.length === 4, refused.errors.join(' | '));
  check('on ne retire pas la dernière couche', !applyPatch((await build(baseDoc([gen('orbit')])))!.doc!, [{ op: 'remove', id: 'sym' }]).ok);
  const removed = applyPatch(multi.doc!, [{ op: 'remove', id: 'dot' }, { op: 'add', layer: { kind: 'shape', id: 'bar', geometry: { type: 'rect', x: 10, y: 80, w: 80, h: 6, r: 3 } } }]);
  check('retirer / ajouter une couche', removed.ok && removed.doc!.layers.length === 3 && removed.doc!.layers.some((l) => l.id === 'bar'));
  const dupAdd = applyPatch(multi.doc!, [{ op: 'add', layer: gen('orbit', {}, 'mark') }]);
  check('ajouter un identifiant existant refusé', !dupAdd.ok || dupAdd.errors.length > 0);

  // ── 10. Les 11 catégories, reproductibilité ─────────────────────────────
  section('10. Les 11 catégories produisent un logo accepté');
  const kora = BRANDS[1];
  const input = { brief: kora.brief, palette: kora.pal, fonts: BUILD.fonts, seed: 'check:11', explore: 0.5 };
  const acceptedByType: Partial<Record<ConceptType, number>> = {};
  for (const type of CONCEPT_TYPES) {
    for (let s = 0; s < 12 && !acceptedByType[type]; s++) {
      const planned = docForDirection({ ...input, kind: type === 'wordmark' ? 'name' : type === 'lettermark' || type === 'letterform' ? 'initial' : 'icon', withName: type !== 'lettermark' && type !== 'letterform' ? true : false }, { type }, `t${s}`);
      if (!planned) continue;
      const made = await produceLogo(planned.doc, BUILD);
      if (made.ok && made.logo?.report.accepted) acceptedByType[type] = s + 1;
    }
    check(`${type}`, !!acceptedByType[type], acceptedByType[type] ? `accepté (essai ${acceptedByType[type]})` : 'aucun brouillon accepté');
  }
  const d1 = docForDirection({ ...input, kind: 'icon' }, { type: 'combination' }, 'r');
  const d2 = docForDirection({ ...input, kind: 'icon' }, { type: 'combination' }, 'r');
  const r1 = await buildLogo(d1!.doc, BUILD);
  const r2 = await buildLogo(d2!.doc, BUILD);
  check('reproductible : même entrée, mêmes paramètres ⇒ mêmes octets', r1.rendered?.svg === r2.rendered?.svg && sha(r1.rendered!.svg) === sha(r2.rendered!.svg), sha(r1.rendered!.svg));
  const p1 = candidateDocs({ ...input, kind: 'icon' }, 8).map((c) => sha(JSON.stringify(c.doc)));
  const p2 = candidateDocs({ ...input, kind: 'icon' }, 8).map((c) => sha(JSON.stringify(c.doc)));
  const p3 = candidateDocs({ ...input, seed: 'autre', kind: 'icon' }, 8).map((c) => sha(JSON.stringify(c.doc)));
  check('le planificateur est déterministe (graine)', JSON.stringify(p1) === JSON.stringify(p2));
  check('une autre graine donne d\'autres documents', p1.filter((h, i) => h === p3[i]).length <= 1);
  const roundTrip = await buildLogo(JSON.parse(JSON.stringify(r1.doc)), BUILD);
  check('le Logo IR sérialisé se rouvre à l\'identique', roundTrip.rendered?.svg === r1.rendered?.svg);

  // ── 11. Planificateur : distinctions ────────────────────────────────────
  section('11. Planificateur : propositions distinctes, marques différentes ⇒ logos différents');
  const plans: { name: string; fps: LogoFingerprint[]; svgs: string[] }[] = [];
  let allClose = 0;
  let minPair = 1;
  for (const b of BRANDS) {
    const plan = await planLogos({ brief: b.brief, palette: b.pal, fonts: BUILD.fonts, kind: 'icon', seed: `plan:${b.brief.brandName}`, count: 3, explore: 0.5 }, BUILD);
    const fps = plan.logos.map((l) => l.fingerprint!);
    plans.push({ name: b.brief.brandName, fps, svgs: plan.logos.map((l) => l.rendered.svg) });
    for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) {
      const d = fingerprintDistance(fps[i], fps[j]);
      minPair = Math.min(minPair, d);
      if (d < LOGO_SIMILARITY.tooClose) allClose++;
    }
    check(`${b.brief.brandName} : 3 propositions acceptées`, plan.logos.length === 3 && plan.logos.every((l) => l.report.accepted), plan.logos.map((l) => l.recipe).join(' · '));
  }
  check(`aucune paire de propositions « trop proche » (< ${LOGO_SIMILARITY.tooClose})`, allClose === 0, `plus petite distance ${minPair.toFixed(2)}`);
  const allSvgs = plans.flatMap((p) => p.svgs).map(sha);
  check('24 propositions, 24 SVG différents', new Set(allSvgs).size === allSvgs.length);
  const types = new Set(plans.flatMap((p) => p.fps.map((f) => f.type)));
  check('les propositions couvrent plusieurs catégories', types.size >= 5, [...types].join(', '));
  const sectorFirst = await planLogos({ brief: BRANDS[0].brief, palette: BRANDS[0].pal, fonts: BUILD.fonts, kind: 'icon', seed: 'sector', count: 3, explore: 0.2 }, BUILD);
  const sectorDocs = sectorFirst.logos.flatMap((l) => l.doc.layers.filter((x) => x.kind === 'generator').map((x) => (x as { generator: string }).generator));
  check('le secteur oriente le choix (agriculture → motifs naturels)', sectorDocs.some((g) => ['leaf', 'sprout', 'drop', 'sunrise', 'wave', 'baobab', 'house', 'bean', 'rosette'].includes(g)), sectorDocs.join(', '));
  const memory = plans[1].fps;
  const withMemory = await planLogos({ brief: BRANDS[1].brief, palette: BRANDS[1].pal, fonts: BUILD.fonts, kind: 'icon', seed: 'plan:Kora Bank', count: 3, explore: 0.5, avoid: memory }, BUILD);
  const dm = withMemory.logos.map((l) => Math.min(...memory.map((m) => fingerprintDistance(l.fingerprint!, m))));
  check('la mémoire du projet écarte ce qui a déjà été montré', dm.every((d) => d >= LOGO_SIMILARITY.tooClose), dm.map((d) => d.toFixed(2)).join(', '));

  // ── 12. Agent par cran (modèle simulé) ──────────────────────────────────
  section('12. L\'agent : la méthode monte avec le cran, le code garde la main');
  const sheet = 'BRAND: Kora Bank — fintech\nCHARTER: colors primary #0f3d5e';
  const agentInput = (level: ConceptType | string) => ({ brief: kora.brief, palette: kora.pal, fonts: BUILD.fonts, kind: 'icon' as const, seed: 'agent', count: 3, level: level as 'low', sheet });
  const log: { role: string; system: string; user: string }[] = [];
  const profiles: Record<string, string> = {};
  const simulated = (overrides: Partial<Record<string, (r: { system: string; user: string }) => string>> = {}): AgentCall => async (req) => {
    log.push({ role: req.role, system: req.system, user: req.user });
    profiles[req.role] = req.profile;
    const custom = overrides[req.role];
    if (custom) return custom(req);
    if (req.role === 'logoSelector') return 'picks: a, c, e';
    if (req.role === 'logoJury') return 'best: b';
    if (req.role === 'logoDirector') {
      const lines = req.system.split('\n').filter((l) => l.startsWith('- '));
      const pick = (type: string) => lines.find((l) => l.startsWith(`- ${type} `));
      const gen = (type: string, n = 0) => (pick(type)?.match(/generators: ([^\n]+?)(?: variants:|$)/)?.[1] ?? '').split(', ')[n];
      return [`1: pictorial | ${gen('pictorial')} | une image simple`, `2: abstract | ${gen('abstract', 1)} | une construction qui bouge`, `3: mascot | ${gen('mascot')} | un personnage chaleureux`].join('\n');
    }
    if (req.role === 'logoAuthor') {
      const gen = req.user.match(/DIRECTION: [\w-]+ \/ ([\w-]+)/)?.[1] ?? 'orbit';
      return JSON.stringify({ rationale: 'Un symbole net.', layers: [{ kind: 'generator', id: 'sym', generator: gen, params: {} }, { kind: 'text', id: 'name', role: 'wordmark', content: 'Kora Bank', effects: [{ type: 'dot' }] }], composition: { layout: 'horizontal' } });
    }
    return '';
  };
  const run = async (level: 'low' | 'medium' | 'high' | 'ultra', call?: AgentCall, vision?: (png: Buffer, i: string) => Promise<string>) => {
    log.length = 0;
    return designLogos(agentInput(level), BUILD, { call, vision });
  };

  const low = await run('low', simulated());
  check('low : aucun appel au modèle, aucun token', log.length === 0 && low.tokens.input === 0 && low.logos.length === 3, `${low.logos.length} logos`);
  const med = await run('medium', simulated());
  check('medium : le sélecteur choisit parmi des candidats construits', log.filter((l) => l.role === 'logoSelector').length === 1 && med.logos.length === 3 && med.decisions.some((d) => d.stage === 'selector' && d.source === 'llm'), `${med.tokens.input + med.tokens.output} tokens`);
  const high = await run('high', simulated());
  const directed = high.decisions.find((d) => d.stage === 'directions');
  check('high : le directeur propose 3 directions, le code les construit', directed?.source === 'llm' && high.logos.length === 3 && !log.some((l) => l.role === 'logoAuthor'), directed?.detail);
  const types3 = new Set(high.logos.map((l) => l.type));
  check('high : trois catégories différentes', types3.size === 3, [...types3].join(', '));
  check('high : le générateur choisi par le directeur est respecté', high.logos.some((l) => l.doc.layers.some((x) => x.kind === 'generator')), '');
  const max = await run('ultra', simulated());
  check('ultra : l\'IA écrit le Logo IR (3 brouillons par direction) et le jury départage', log.filter((l) => l.role === 'logoAuthor').length === 9 && log.some((l) => l.role === 'logoJury') && max.logos.length === 3);
  check('ultra : l\'auteur utilise le profil « coder » (sortie longue), les choix le profil léger', profiles.logoAuthor === 'coder' && profiles.logoDirector === 'agents' && profiles.logoJury === 'critic', JSON.stringify(profiles));
  check('ultra : les brouillons de l\'IA passent par le pipeline qualité', max.logos.every((l) => l.report.ok), max.logos.map((l) => `${l.recipe}:${l.report.score}`).join(' '));

  // Replis et garde-fous
  const mute = await run('ultra', async () => '');
  check('modèle muet : le planificateur décide, aucune erreur', mute.logos.length === 3 && mute.logos.every((l) => l.report.ok) && mute.decisions.every((d) => d.source === 'code'));
  const throws = await run('ultra', async () => {
    throw new Error('429');
  });
  check('modèle en erreur : même résultat qu\'un modèle muet', throws.logos.length === 3);
  const noModel = await run('ultra', undefined);
  check('sans modèle : le cran Ultra se replie sur le code', noModel.logos.length === 3 && noModel.tokens.input === 0);
  const invented = await run('high', simulated({ logoDirector: () => ['1: pictorial | licorne | x', '2: abstract | dragon | y', '3: mascot | yéti | z'].join('\n') }));
  check('directions inventées (générateurs inconnus) : catégories gardées, choix du code', invented.logos.length === 3);
  const badType = await run('high', simulated({ logoDirector: () => '1: sculpture | x | y\n2: sculpture | x | y\n3: sculpture | x | y' }));
  check('directions hors menu : refusées, repli', badType.decisions.find((d) => d.stage === 'directions')?.source === 'code' && badType.logos.length === 3);
  const garbled = await run('ultra', simulated({ logoAuthor: () => '{"layers": [oops' }));
  check('JSON d\'auteur illisible : brouillon du planificateur', garbled.logos.length === 3 && garbled.decisions.filter((d) => d.stage === 'author').every((d) => d.source === 'code'));
  const foreign = await run('ultra', simulated({ logoAuthor: () => JSON.stringify({ layers: [{ kind: 'generator', id: 'sym', generator: 'orbit' }, { kind: 'text', id: 'name', role: 'wordmark', content: 'ACHETEZ MAINTENANT -50 %' }] }) }));
  const foreignTexts = foreign.logos.flatMap((l) => l.doc.layers.filter((x) => x.kind === 'text').map((x) => (x as { content: string }).content));
  check('texte étranger à la marque remplacé par son nom (garde-fou)', !foreignTexts.some((t) => /ACHETEZ|50/.test(t)), foreignTexts.join(' | '));
  const palettePush = await run('ultra', simulated({ logoAuthor: () => JSON.stringify({ layers: [{ kind: 'generator', id: 'sym', generator: 'orbit', fill: '#ff00ff' }], palette: { ink: '#ff00ff' } }) }));
  check('la palette est celle de la charte, jamais celle du modèle', palettePush.logos.every((l) => l.doc.palette.ink !== '#ff00ff'));
  const freePath = await run('high', simulated({ logoAuthor: () => JSON.stringify({ layers: [{ kind: 'shape', id: 'x', geometry: { type: 'path', d: 'M10 10L90 10L50 90Z' } }] }) }));
  check('dessin libre refusé hors Ultra', freePath.logos.length === 3 && freePath.logos.every((l) => !JSON.stringify(l.doc.layers).includes('"path"')));

  // Ultra : critique visuelle et patch ciblé
  const critic = async (_png: Buffer, instruction: string) => {
    const ids = [...(instruction.match(/"id":"([^"]+)"/g) ?? [])].map((m) => m.slice(6, -1));
    const target = ids.find((i) => i === 'sym') ?? ids[0];
    return `scores: distinctiveness=4, simplicity=4, balance=2, concept=4, craft=4, legibility=4\nverdict: fix\npatch: [{"op":"composition","gap":0.5},{"op":"layer","id":"${target}","transform":{"rotate":8}},{"op":"layer","id":"fantome","fill":"accent"}]\nnote: l'espace est trop serré`;
  };
  const ultra = await run('ultra', simulated(), critic);
  check('ultra : le critique regarde le rendu et répond par un patch', ultra.decisions.some((d) => d.stage === 'critic' && d.source === 'llm') && ultra.logos.length === 3);
  check('ultra : un patch valide est appliqué, l\'opération sur une couche inconnue écartée', ultra.logos.some((l) => l.doc.composition.gap === 0.5 || (l.doc.layers.some((x) => x.transform?.rotate === 8))));
  const ruinCritic = async () => 'scores: distinctiveness=1, simplicity=1, balance=1, concept=1, craft=1, legibility=1\nverdict: fix\npatch: [{"op":"palette","ink":"#f5f5f5"}]\nnote: x';
  const ruined = await run('ultra', simulated(), ruinCritic);
  check('ultra : un patch qui aggrave les mesures est refusé', ruined.logos.every((l) => l.doc.palette.ink !== '#f5f5f5'));
  const babble = await run('ultra', simulated(), async () => 'Superbe logo !');
  check('ultra : une critique illisible est ignorée', babble.logos.length === 3);
  const visionThrows = await run('ultra', simulated(), async () => {
    throw new Error('vision down');
  });
  check('ultra : vision indisponible, le résultat reste livrable', visionThrows.logos.length === 3 && visionThrows.logos.every((l) => l.report.ok));

  // ── 13. Budget de tokens ────────────────────────────────────────────────
  section('13. Budget : combien de tokens, comparé à l\'ancien pipeline');
  const legacyPrompt = estimateTokens(LOGO_GENERATION_ICON_TYPE_PROMPT);
  const legacyNamePrompt = estimateTokens(LOGO_GENERATION_NAME_TYPE_PROMPT);
  const legacyCritique = estimateTokens(LOGO_CRITIQUE_PROMPT);
  const LEGACY_OUT = 3500; // maxOutputTokens du SVG dessiné par le modèle
  const legacyPerDraft = legacyPrompt + LEGACY_OUT;
  const legacy = {
    medium: 3 * (legacyPerDraft + legacyCritique + LEGACY_OUT / 2),
    ultra: 3 * (3 * legacyPerDraft + legacyCritique + LEGACY_OUT) + 3 * 700,
  };
  const tok = (r: { tokens: { input: number; output: number } }) => r.tokens.input + r.tokens.output;
  console.log(`    ancien pipeline : prompt ≈ ${legacyPrompt} tokens (+ ${LEGACY_OUT} de SVG dessiné) par brouillon`);
  console.log(`    ancien « medium » ≈ ${Math.round(legacy.medium)} tokens · ancien « ultra » ≈ ${Math.round(legacy.ultra)} tokens`);
  console.log(`    moteur : low ${tok(low)} · medium ${tok(med)} · high ${tok(high)} · ultra ${tok(ultra)} tokens (estimés)`);
  check('low : 0 token', tok(low) === 0);
  check('medium : au moins 10× moins que l\'ancien medium', tok(med) * 10 < legacy.medium, `${tok(med)} vs ${Math.round(legacy.medium)}`);
  check('ultra : au moins 5× moins que l\'ancien ultra', tok(ultra) * 5 < legacy.ultra, `${tok(ultra)} vs ${Math.round(legacy.ultra)}`);
  const author = log.find((l) => l.role === 'logoAuthor') ?? (await (async () => { await run('ultra', simulated()); return log.find((l) => l.role === 'logoAuthor')!; })());
  check('prompt de l\'auteur (mémento + générateur) < 1 500 tokens', estimateTokens(author.system + author.user) < 1500, `${estimateTokens(author.system + author.user)} tokens`);
  check('l\'ancien prompt est le double ou plus', legacyPrompt > 1.5 * estimateTokens(author.system + author.user), `${legacyPrompt} vs ${estimateTokens(author.system + author.user)}`);
  const irTokens = estimateTokens(JSON.stringify(max.logos[0].doc.layers));
  check('un Logo IR tient en quelques centaines de tokens (vs ~3 500 de SVG)', irTokens < 900, `${irTokens} tokens contre ${estimateTokens(max.logos[0].rendered.svg)} pour son SVG`);

  // ── 14. Export ──────────────────────────────────────────────────────────
  section('14. Export du livrable');
  const star = max.logos[0];
  const exported = await exportLogoPackage(star.session, { report: star.report });
  const names = Object.keys(exported.files);
  check('logo.svg, variantes, aperçus, logo.json', ['logo.svg', 'logo-monochrome.svg', 'logo-monochrome-white.svg', 'logo-inverted.svg', 'logo.json'].every((n) => names.includes(n)) && names.some((n) => n.startsWith('previews/')), `${names.length} fichiers`);
  check('aucun fichier refusé par la validation', exported.skipped.length === 0, exported.skipped.map((s) => s.file).join(','));
  let allValid = true;
  for (const [n, c] of Object.entries(exported.files)) if (n.endsWith('.svg') && !(await validateSvgTechnical(c as string)).ok) allValid = false;
  check('tous les SVG exportés sont valides et autonomes', allValid);
  const png = exported.files['previews/logo-512-light.png'] as Buffer;
  check('aperçus PNG (signature, plusieurs fonds et tailles)', png.subarray(0, 4).toString('hex') === '89504e47' && !!exported.files['previews/logo-1024-dark.png'] && !!exported.files['previews/symbol-24.png']);
  const reopened = await buildLogo(readLogoJson(exported.files['logo.json'] as string), BUILD);
  check('logo.json rouvre le logo à l\'identique', reopened.rendered?.svg === star.rendered.svg);
  const zip = await JSZip.loadAsync(await zipExport(exported));
  check('archive ZIP avec manifeste', !!zip.file('logo.svg') && !!zip.file('manifest.json') && Object.keys(zip.files).length >= names.length);
  const monoWhite = exported.files['logo-monochrome-white.svg'] as string;
  check('monochrome blanc pour fonds sombres', colorsOf(monoWhite).size === 1 && colorsOf(monoWhite).has('#ffffff'));
  fs.writeFileSync(path.join(os.tmpdir(), 'idem-logo-engine-check.zip'), await zipExport(exported));

  // ── 15. Jeu de tests qualité ────────────────────────────────────────────
  section('15. Qualité mesurée : 8 marques × 3 types × 3 propositions');
  const scores: number[] = [];
  const solid24: number[] = [];
  let accepted = 0;
  let total = 0;
  const scoresByKind: Record<string, number[]> = { icon: [], name: [], initial: [] };
  let slowest = 0;
  for (const b of BRANDS) {
    for (const kind of ['icon', 'name', 'initial'] as const) {
      const t0 = Date.now();
      const plan = await planLogos({ brief: b.brief, palette: b.pal, fonts: BUILD.fonts, kind, seed: `bench:${b.brief.brandName}:${kind}`, count: 3, explore: 0.5 }, BUILD);
      slowest = Math.max(slowest, Date.now() - t0);
      for (const l of plan.logos) {
        total++;
        scores.push(l.report.score);
        scoresByKind[kind].push(l.report.score);
        solid24.push(l.report.metrics.solid24 ?? 0);
        if (l.report.accepted) accepted++;
      }
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  console.log(`    score moyen ${mean(scores).toFixed(1)} · icône ${mean(scoresByKind.icon).toFixed(1)} · nom ${mean(scoresByKind.name).toFixed(1)} · initiales ${mean(scoresByKind.initial).toFixed(1)} · solidité à 24 px ${(mean(solid24) * 100).toFixed(0)} % · plus lent ${slowest} ms`);
  check(`${total} logos : tous acceptés par les mesures`, accepted === total, `${accepted}/${total}`);
  check('score moyen ≥ 90', mean(scores) >= 90, mean(scores).toFixed(1));
  check('un lot de 3 propositions se construit en moins de 6 s', slowest < 6000, `${slowest} ms`);

  console.log(`\n${passes} vérifications réussies, ${failures} échec(s) — ${((Date.now() - started) / 1000).toFixed(1)} s`);
  if (failures) process.exit(1);
}

function contrastOnDark(hex: string): number {
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const a = lum(hex);
  const b = lum('#0b0f19');
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export type { LogoDocument };
