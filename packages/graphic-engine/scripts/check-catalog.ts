/**
 * CONTRÔLE DU CATALOGUE — `npm run check:catalog` (`--fast` : sans Chromium ; `--shots <dossier>` : une image par
 * gabarit, pour la planche-contact).
 *
 *   §1 le dépôt se charge : aucun nœud écarté, au moins 5 gabarits par élément ;
 *   §2 sécurité : un nœud dangereux ou qui écrit des mots est écarté ; signature ed25519 vérifiée, altération refusée ;
 *   §3 le graphe : listes courtes non vides, taille par cran, variété des combinaisons d'une graine à l'autre ;
 *   §4 rendu RÉEL de chaque gabarit (Chromium) au cran Low : la page s'affiche, tout le contenu est posé, aucun appel
 *      de modèle ; §5 les crans Medium → Ultra : appels comptés (un choix par page, un habillage par document) ;
 *   §6 une retouche écrite modifie la configuration, sans réécrire la page.
 *
 * Aucun réseau, aucun modèle réel : le modèle qui choisit est simulé.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { buildCatalog, canonicalJson, catalog, engineSupports, resetCatalog, verifyManifest } from '../src/catalog/registry';
import { brandTraits, newCatalogState, rankSkins, shortlist } from '../src/catalog/graph';
import { pageUnits, surfaceColors } from '../src/catalog/assemble';
import { buildTokens } from '../src/design-system/tokens';
import { contrastRatio } from '../src/foundation/color';
import { planAssets, resolveAssets } from '../src/asset-planner';
import type { CatalogElement, GabaritNode, Manifest } from '../src/catalog/types';
import { configureGraphicEngine } from '../src/host';
import { closeBrowser } from '../src/runtime/browser';
import { createDocument } from '../src/engine';
import { FORMATS } from '../src/design-system/formats';
import type { FormatId } from '../src/contracts/common';
import type { SectionContent } from '../src/contracts/content-model';
import { BRANDS, CARD_VALUES, CHARTER, coverSection, FINANCE_BP, flyer, MARKET, PROBLEM, PROBLEM_VISUAL, SUMMARY_BP, SWOT_BP, TEAM, TRACTION, ASK, VISION_BLEED, photo } from './fixtures';

process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_QUALITY_MEMORY = '0';
delete process.env.GRAPHIC_ENGINE_MODE;
const DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../idem-templates');
process.env.IDEM_TEMPLATES_DIR = DIR;
const fast = process.argv.includes('--fast');
const shotsAt = process.argv.indexOf('--shots');
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : undefined;
// `--only visual.` : ne rend (§4) que les gabarits dont l'identifiant commence ainsi (planche-contact d'un élément).
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > 0 ? process.argv[onlyAt + 1] : undefined;
if (shots) fs.mkdirSync(shots, { recursive: true });

let failures = 0;
let passed = 0;
const ok = (label: string, cond: boolean, detail = ''): void => {
  if (cond) passed += 1;
  else failures += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const title = (t: string) => console.log(`\n${t}`);

// Le modèle simulé : il choisit B (ou A) et met le miroir ; il compte ses appels par rôle.
const calls: Array<{ role: string; level?: string; user: string }> = [];
let disabled: string[] = [];
configureGraphicEngine({
  agentCall: () => async ({ role, user, level }) => {
    calls.push({ role, level, user });
    if (role !== 'graphic.template') return '';
    const current = user.match(/CURRENT CONFIG: (\{.*\})/)?.[1];
    if (current) return JSON.stringify({ pick: 'A', mirror: !(JSON.parse(current) as { mirror: boolean }).mirror });
    if (/"picks"/.test(user)) return '{"picks":[{"pick":"B","mirror":true},{"pick":"A"}]}';
    return /\nB\. /.test(user) ? '{"pick":"B","mirror":true}' : '{"pick":"A"}';
  },
  catalogOverrides: async () => ({ disabled }),
});

/** Le verso d'une carte, valeurs posées (le recto des fixtures porte les mêmes champs). */
const CARD_VALUES_BACK: SectionContent = { ...CARD_VALUES, id: 'back', title: 'Verso', blocks: CARD_VALUES.blocks.map((b) => (b.kind === 'contact' ? { ...b, side: 'back' as const } : b)) };

const PHOTO = photo('#1A2A4F', '#7F9CE5', '#C9A227');
/** Des pages de test qui sollicitent les squelettes à image, à affirmation et à deux étages. */
const BP_PHOTO: SectionContent = { ...SUMMARY_BP, id: 'summary-photo', blocks: [{ id: 'ph', kind: 'figure', url: PHOTO, alt: 'Le comptoir de Bonanjo' }, ...SUMMARY_BP.blocks] };
const STATEMENT: SectionContent = { id: 'vision-quote', role: 'opening', title: 'Le café d’ici, torréfié ici', lede: 'Nous gardons au Cameroun la valeur de son café.', blocks: [{ id: 'q', kind: 'quote', text: 'Enfin un café d’ici, torréfié la semaine où je le bois.', attribution: 'Awa N., cliente' }] };
const COVER_PHOTO = (label: string): SectionContent => {
  const c = coverSection('Kora', label, 'Le crédit simple pour les commerçants de Douala');
  return { ...c, blocks: [...c.blocks, { id: 'ph', kind: 'figure', url: PHOTO, alt: 'Un marché de Douala au matin' }] };
};
const CHARTER_TWO = (): SectionContent => {
  const pages = CHARTER(BRANDS.kora);
  const dir = pages.find((p) => p.id === 'direction')!;
  const typo = pages.find((p) => p.id === 'typography')!;
  return { ...dir, id: 'direction-type', blocks: [...dir.blocks, ...typo.blocks.map((b) => ({ ...b, id: 'b2' }))] };
};

/** Une couverture de réseau réelle porte peu de mots : une accroche et un sur-titre. */
const SHORT_COVER: SectionContent = { id: 'banner', role: 'visual', title: 'Bannière', blocks: [{ id: 'copy', kind: 'copy', headline: 'Le crédit simple pour les commerçants' }] };

const ELEMENTS: CatalogElement[] = ['business-plan', 'pitch-deck', 'brand-charter', 'business-card', 'social-visual', 'social-cover', 'print-flyer', 'web-banner'];

async function main(): Promise<void> {
  title('§1 Le dépôt se charge');
  resetCatalog();
  const cat = await catalog();
  ok(`source dossier (${DIR})`, cat.source === 'dir');
  ok('aucun nœud écarté', cat.rejected.length === 0, cat.rejected.map((r) => `${r.id}: ${r.reason}`).slice(0, 5).join(' | '));
  const gabarits = [...cat.nodes.values()].filter((n): n is GabaritNode => n.kind === 'gabarit');
  for (const e of ELEMENTS) {
    const n = gabarits.filter((g) => g.elements.includes(e)).length;
    ok(`au moins 5 gabarits pour ${e}`, n >= 5, `${n}`);
  }

  title('§2 Sécurité et signature');
  const bad = buildCatalog(
    [
      { node: { id: 'x.script', version: 1, kind: 'component', accepts: ['prose'], doc: { title: 'x', summary: 'x' }, html: '<div><script>alert(1)</script></div>' } },
      { node: { id: 'x.words', version: 1, kind: 'component', accepts: ['prose'], doc: { title: 'x', summary: 'x' }, html: '<p>Bienvenue chez nous</p>' } },
      { node: { id: 'x.url', version: 1, kind: 'component', accepts: ['prose'], doc: { title: 'x', summary: 'x' }, html: '<img src="https://evil.example/a.png">' } },
      { node: { id: 'x.gabarit', version: 1, kind: 'gabarit', elements: ['pitch-deck'], roles: ['*'], doc: { title: 'x', summary: 'x' }, config: { layout: 'nope', skin: 'nope', components: {}, vars: {}, params: {}, mirror: false } } },
    ],
    { version: 't', source: 'dir' }
  );
  ok('script, mots en dur, adresse étrangère, gabarit orphelin : écartés', bad.rejected.length === 4, bad.rejected.map((r) => r.reason.slice(0, 30)).join(' | '));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const manifest: Manifest = { schema: 1, version: 't1', builtAt: new Date().toISOString(), engine: '2.6.0', entries: [] };
  const signed = { ...manifest, signature: crypto.sign(null, Buffer.from(canonicalJson(manifest)), privateKey).toString('base64') };
  ok('manifeste signé accepté', verifyManifest(signed, publicKey).ok);
  ok('manifeste altéré refusé', !verifyManifest({ ...signed, version: 't2' }, publicKey).ok);
  ok('manifeste non signé refusé quand une clé est configurée', !verifyManifest(manifest, publicKey).ok);
  ok('version du moteur comparée', engineSupports('2.6.0', '2.6.0') && !engineSupports('2.7.0', '2.6.0') && engineSupports('2.5.9', '2.6.0'));

  title('§3 Le graphe');
  const deckFacts = { element: 'pitch-deck' as const, format: FORMATS['slide-16x9'], role: MARKET.role, units: pageUnits(MARKET), index: 2, total: 6 };
  const traits = brandTraits({ styleId: 'swiss' }, false);
  const skins = rankSkins(cat, 'pitch-deck', traits, newCatalogState(), 's', {});
  ok('habillage choisi par la direction artistique (swiss → sobre)', ['skin.swiss-rule', 'skin.tech-grid', 'skin.luxury-air', 'skin.organic-earth', 'skin.editorial-serif'].includes(skins[0].id), skins[0].id);
  const sizes = (['low', 'medium', 'high', 'ultra'] as const).map((level) => shortlist(cat, deckFacts, { level, skin: skins[0].id, traits, state: newCatalogState(), seed: 'x', overrides: {} }).length);
  ok('liste courte non vide à chaque cran, plus large en haut', sizes.every((n) => n >= 1) && sizes[3] >= sizes[1], sizes.join(' / '));
  const combos = new Set<string>();
  for (let i = 0; i < 24; i++) {
    const s = shortlist(cat, deckFacts, { level: 'low', skin: rankSkins(cat, 'pitch-deck', brandTraits({ styleId: ['swiss', 'pop-art', 'editorial', 'bohemian'][i % 4] }, false), newCatalogState(), `brand${i}`, {})[0].id, traits, state: newCatalogState(), seed: `brand${i}`, overrides: {} });
    combos.add(s[0].fingerprint);
  }
  ok('variété : 24 marques → au moins 12 combinaisons différentes pour la même page', combos.size >= 12, `${combos.size}`);
  const state = newCatalogState();
  const first = shortlist(cat, deckFacts, { level: 'low', skin: skins[0].id, traits, state, seed: 'y', overrides: {} })[0];
  state.seen.add(first.fingerprint);
  const again = shortlist(cat, deckFacts, { level: 'low', skin: skins[0].id, traits, state, seed: 'y', overrides: {} })[0];
  ok('mémoire : une combinaison déjà livrée à la marque n’est pas reprise', again.fingerprint !== first.fingerprint);

  title('§3 bis La charte : ses trois couleurs, ses images');
  // Avant le 11/11/2026, chaque rôle de couleur (accent, filet fort, teinte) renvoyait à la couleur principale.
  const kora = buildTokens({ brand: BRANDS.kora, direction: { styleId: 'swiss' }, format: 'flyer-square' });
  const roles = surfaceColors(kora);
  ok('accent : la couleur d’accent de la charte (ou sa nuance lisible), jamais la principale', /text-(brand-accent|accent-\d{3})/.test(roles.light.accent), roles.light.accent);
  ok('accent lisible : 4,5:1 sur le fond', (() => {
    const shade = roles.light.accent.replace('text-', '');
    const hex = shade === 'brand-accent' ? kora.color.accent : kora.color.accentRamp[shade.replace('accent-', '')];
    return !!hex && contrastRatio(hex, kora.color.ground) >= 4.5;
  })(), roles.light.accent);
  ok('teinte d’une carte mise en avant : celle de l’accent', roles.light.tint === 'bg-accent-soft');
  const navyGold = buildTokens({ brand: { name: 'N', palette: { primary: '#14365D', secondary: '#1F4D2B', accent: '#E3B341' } }, format: 'flyer-square' });
  ok('sur l’aplat de la couleur principale, l’accent s’y lit en accent', surfaceColors(navyGold).brand.accent === 'text-brand-accent', surfaceColors(navyGold).brand.accent);
  ok('aplat profond : la couleur secondaire de la charte quand elle est sombre', navyGold.color.deep.toLowerCase() === '#1f4d2b', navyGold.color.deep);
  // Le repli Pexels : la génération est TENTÉE et échoue (crédits) → la banque prend le relais, même pour un business plan.
  const failing = { resolve: async () => null };
  const bank = { resolve: async () => ({ url: 'https://images.pexels.com/x.jpg', alt: 'x', provenance: { provider: 'pexels' } }) };
  const req = planAssets({ id: 'p', role: 'problem', title: 'Les pertes après récolte', intent: { visualStrategy: 'illustration' }, blocks: [] } as unknown as SectionContent, FORMATS['a4-portrait']);
  const bp = await resolveAssets(req, { generated: failing, stock: bank } as never, { level: 'high', documentType: 'business-plan', imageryMedium: 'illustration' } as never, { generationLeft: 3 });
  ok('repli : génération échouée → image Pexels (business plan, charte illustrée)', bp.resolved.some((r) => r.source === 'stock'), bp.log.join(' · '));
  const untried = await resolveAssets(req, { stock: bank } as never, { level: 'low', documentType: 'business-plan' } as never, { generationLeft: 0 });
  ok('sans génération tentée, un business plan ne prend pas de cliché de banque', !untried.resolved.some((r) => r.source === 'stock'), untried.log.join(' · '));

  if (fast) return;

  title('§4 Rendu réel de chaque gabarit (Low, zéro appel)');
  const brand = BRANDS.kora;
  const cases: Record<CatalogElement, Array<{ format: FormatId; documentType: 'business-plan' | 'pitch-deck' | 'brand-charter' | 'business-card' | 'flyer' | 'poster' | 'banner'; content: SectionContent }>> = {
    'business-plan': [SUMMARY_BP, FINANCE_BP, SWOT_BP, BP_PHOTO].map((content) => ({ format: 'a4-portrait' as FormatId, documentType: 'business-plan' as const, content })),
    'pitch-deck': [MARKET, PROBLEM, TRACTION, TEAM, ASK, VISION_BLEED(PHOTO), PROBLEM_VISUAL, STATEMENT].map((content) => ({ format: 'slide-16x9' as FormatId, documentType: 'pitch-deck' as const, content })),
    'brand-charter': [...CHARTER(brand).slice(0, 6), CHARTER_TWO()].map((content) => ({ format: 'page-a4' as FormatId, documentType: 'brand-charter' as const, content })),
    'business-card': [CARD_VALUES, CARD_VALUES_BACK].map((content) => ({ format: 'card-landscape' as FormatId, documentType: 'business-card' as const, content })),
    'social-visual': [
      { format: 'flyer-square' as FormatId, documentType: 'flyer' as const, content: flyer(true, { a: '#1A2A4F', b: '#7F9CE5', c: '#C9A227' }) },
      { format: 'flyer-story' as FormatId, documentType: 'flyer' as const, content: flyer(true, { a: '#1A2A4F', b: '#7F9CE5', c: '#C9A227' }) },
      { format: 'flyer-square' as FormatId, documentType: 'flyer' as const, content: flyer(false, { a: '#1A2A4F', b: '#7F9CE5', c: '#C9A227' }) },
    ],
    'social-cover': [
      { format: 'cover-facebook' as FormatId, documentType: 'flyer' as const, content: { ...SHORT_COVER, id: 'banner-photo', blocks: [...SHORT_COVER.blocks, { id: 'ph', kind: 'figure', url: PHOTO, alt: 'Un marché de Douala' }] } },
      { format: 'cover-facebook' as FormatId, documentType: 'flyer' as const, content: SHORT_COVER },
      { format: 'cover-x' as FormatId, documentType: 'flyer' as const, content: SHORT_COVER },
      { format: 'cover-linkedin' as FormatId, documentType: 'flyer' as const, content: SHORT_COVER },
    ],
    // Impression : la même matière qu'un visuel, mais sur une toile en millimètres, avec fond perdu et 300 dpi.
    'print-flyer': [
      { format: 'print-flyer-a4' as FormatId, documentType: 'poster' as const, content: flyer(true, { a: '#1A2A4F', b: '#7F9CE5', c: '#C9A227' }) },
      { format: 'print-poster-a3' as FormatId, documentType: 'poster' as const, content: flyer(false, { a: '#1A2A4F', b: '#7F9CE5', c: '#C9A227' }) },
      { format: 'rollup-85x200' as FormatId, documentType: 'poster' as const, content: flyer(true, { a: '#1A2A4F', b: '#7F9CE5', c: '#C9A227' }) },
    ],
    // Publicité en ligne : des toiles très étroites — le pire cas pour un texte qui doit tenir.
    'web-banner': [
      { format: 'ad-leaderboard' as FormatId, documentType: 'banner' as const, content: SHORT_COVER },
      { format: 'ad-rectangle' as FormatId, documentType: 'banner' as const, content: SHORT_COVER },
      { format: 'ad-skyscraper' as FormatId, documentType: 'banner' as const, content: SHORT_COVER },
      { format: 'email-header' as FormatId, documentType: 'banner' as const, content: SHORT_COVER },
    ],
  };
  const coverCase = (g: GabaritNode) => {
    const layout = cat.nodes.get(g.config.layout);
    const portrait = layout?.kind === 'layout' && layout.shape.orientations?.includes('portrait');
    const format = (portrait ? 'page-a4' : 'slide-16x9') as FormatId;
    return [
      { format, documentType: 'pitch-deck' as const, content: coverSection('Kora', 'Pitch deck', 'Le crédit simple pour les commerçants de Douala') },
      { format, documentType: 'pitch-deck' as const, content: COVER_PHOTO('Pitch deck') },
    ];
  };
  for (const g of gabarits) {
    if (only && !g.id.startsWith(only)) continue;
    // Le gabarit testé est le seul servi pour son élément (les autres sont retirés par surcharge d'exploitation).
    disabled = gabarits.filter((x) => x.id !== g.id).map((x) => x.id);
    resetCatalog(); // les surcharges sont gardées 15 s : relues pour ce gabarit
    const element = g.elements[0];
    const pool = g.roles.includes('cover') && g.roles.length === 1 ? coverCase(g) : cases[element];
    const darkGround = (cat.nodes.get(g.config.layout) as { darkGround?: boolean } | undefined)?.darkGround === true;
    let shown = 0;
    const problems: string[] = [];
    for (const c of pool) {
      const layout = cat.nodes.get(g.config.layout);
      if (layout?.kind !== 'layout') continue;
      const fmt = FORMATS[c.format];
      if (layout.shape.kind && layout.shape.kind !== fmt.kind) continue;
      if (layout.shape.orientations?.length && !layout.shape.orientations.includes(fmt.orientation)) continue;
      if (layout.shape.minAspect && fmt.width / fmt.height < layout.shape.minAspect) continue;
      calls.length = 0;
      // Un gabarit d'une seule DA (flyer signature) se rend avec sa DA : c'est elle qui sert son habillage.
      // Rendu avec une DA que le gabarit sert : la marque de test si elle en est, sinon la première de sa liste.
      const styleId = !g.directions?.length || g.directions.includes(brand.styleId) ? brand.styleId : g.directions[0];
      const skinDark = (cat.nodes.get(g.config.skin) as { dark?: boolean } | undefined)?.dark === true;
      const doc = await createDocument({ documentType: c.documentType, format: c.format, brand, direction: { styleId }, creativity: 'low', ...(darkGround || skinDark ? { allowDark: true } : {}), seed: `${g.id}|${c.content.id}`, png: Boolean(shots), sections: [{ id: c.content.id, role: c.content.role }] });
      try {
        const out = await doc.composeSection(c.content);
        const picked = out.spec.catalog?.config.gabarit;
        if (picked !== g.id) continue; // le contenu ne convient pas à ce gabarit (capacité) : un autre cas le montrera
        shown += 1;
        const notShown = out.result.issues.filter((i) => i.code === 'content_not_shown' || i.code === 'unknown_keys' || i.severity === 'blocking');
        if (notShown.length) problems.push(`${c.content.id}: ${notShown.map((i) => i.message.slice(0, 90)).join(' ; ')}`);
        if (calls.length) problems.push(`${c.content.id}: ${calls.length} appel(s) de modèle au cran Low`);
        if (shots && out.png) fs.writeFileSync(path.join(shots, `${g.id}--${c.content.id}.png`), out.png);
      } catch (error) {
        problems.push(`${c.content.id}: ${String((error as Error)?.message ?? error).slice(0, 140)}`);
      }
    }
    ok(`${g.id}`, shown > 0 && !problems.length, shown ? problems.join(' | ') : 'aucun contenu de test ne le sert');
  }
  disabled = [];

  title('§5 Crans Medium → Ultra : appels comptés');
  for (const level of ['medium', 'high', 'ultra'] as const) {
    calls.length = 0;
    const pages = [MARKET, PROBLEM, TRACTION];
    const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand, direction: { styleId: 'swiss' }, creativity: level, seed: `lvl-${level}`, sections: pages.map((p) => ({ id: p.id, role: p.role })) });
    const outs = [];
    for (const [i, p] of pages.entries()) outs.push(await doc.composeSection(p, { index: i + 1, total: pages.length }));
    const choose = calls.filter((c) => c.role === 'graphic.template').length;
    const authors = calls.filter((c) => /author|zone|layout|cover/.test(c.role)).length;
    const expected = pages.length + (level === 'medium' ? 0 : 1);
    ok(`${level} : ${expected} choix (un par page${level === 'medium' ? '' : ' + l’habillage'}), aucun auteur HTML`, choose === expected && authors === 0, `choix ${choose}, auteurs ${authors}, rôles ${[...new Set(calls.map((c) => c.role))].join(',')}`);
    ok(`${level} : toutes les pages viennent du catalogue`, outs.every((o) => o.spec.pattern.id === 'catalog'));
    const layouts = outs.map((o) => o.spec.catalog?.config.layout);
    ok(`${level} : deux pages voisines n’ont jamais le même squelette`, layouts.every((l, i) => i === 0 || l !== layouts[i - 1]), layouts.join(' → '));
  }

  title('§6 Retouche écrite = configuration modifiée');
  calls.length = 0;
  const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand, direction: { styleId: 'swiss' }, creativity: 'low', seed: 'rev', sections: [{ id: MARKET.id, role: MARKET.role }] });
  const before = await doc.composeSection(MARKET);
  const revised = await doc.composeSection(MARKET, { revise: { spec: before.spec, instruction: 'en miroir' } });
  const layoutBefore = before.spec.catalog?.config.layout;
  const mirrorable = (await catalog()).nodes.get(layoutBefore ?? '') as { mirrorable?: boolean } | undefined;
  ok('un seul appel (la configuration) qui reçoit la demande et la configuration actuelle', calls.length === 1 && /CURRENT CONFIG/.test(calls[0].user) && /en miroir/.test(calls[0].user), `${calls.length} appel(s)`);
  ok('le miroir demandé est appliqué quand le squelette l’admet', !mirrorable?.mirrorable || revised.spec.catalog?.config.mirror !== before.spec.catalog?.config.mirror);
  ok('la page retouchée reste une page du catalogue', revised.spec.pattern.id === 'catalog');
}

main()
  .catch((error) => {
    failures += 1;
    console.error(error);
  })
  .finally(async () => {
    await closeBrowser().catch(() => undefined);
    console.log(`\n${passed} réussi(s), ${failures} échec(s)`);
    process.exit(failures ? 1 : 0);
  });
