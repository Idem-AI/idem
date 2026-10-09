/**
 * `npm run check:creativity` — la jauge de créativité et son orchestrateur.
 *
 *  1. Prix : Low = Medium = barème, High ×1,25, Max ×1,5, Ultra ×2 ; un cran inconnu vaut Medium.
 *  2. Orchestrateur : réponses parfaites, lettres, JSON, inventées, vides, en panne, budget
 *     épuisé, tâches au-dessus du cran, meilleur de N départagé par le code.
 *  3. Cran Ultra — lint : le code d'une scène propre passe ; réseau, globaux, hasard, horloge,
 *     boucles, propriétés dangereuses, état React, CSS animée, 3D, textes en dur, imports
 *     inconnus et textes oubliés sont refusés.
 *  4. Cran Ultra — rendu réel : une scène écrite comme par l'agent se compile, s'affiche,
 *     montre ses textes, bouge, reste déterministe ; une scène qui lève une erreur retombe sur
 *     sa composition ; un texte hors cadre et un rendu non déterministe sont signalés ; la CSP
 *     coupe le réseau sortant.
 *  5–6. Visuels : agents des crans Low → High ; les douze compositions du code rendues et contrôlées.
 *  7. Carte de visite : agents et mises en page du code (contrôle d'impression).
 *  8. Documents : direction artistique des pages par cran ; fidélité du compositeur (textes,
 *     chiffres, couleurs et images des spécimens).
 *  9. Documents, cran Ultra : rendu mesuré (hauteur, corps, contraste), une réparation, repli.
 *  10. Identité visuelle : logos composés par le code (Low), directeur de création, jury.
 */
import { CREATIVITY_LEVELS, CREATIVITY_MULTIPLIER, creativityCost, normalizeCreativity, atLeast } from '../models/creativity.model';
import { CreativeOrchestrator, AgentCall } from '../services/creativity/orchestrator';
import { createRunBudget } from '../services/agents/run-budget';
import { pickOption, agentLines } from '../services/creativity/agent-io';
import { compileSceneCode, extractCode, inspectRenderedScene, lintSceneCode, visibleTexts } from '../../../ivision/core/src/video/video.coder';
import { buildStoryboard } from '../../../ivision/core/src/video/video.storyboard';
import { composeVideoHtml, contentSecurityPolicy, inlineAssets } from '../../../ivision/core/src/video/video.composer';
import { buildVideoTheme } from '../../../ivision/core/src/video/video.theme';
import { closeRenderBrowser, withRenderPage } from '../../../ivision/core/src/video/video.renderer';
import { BUSINESS_CREDIT_COSTS } from '../models/billing.model';
import { brandById } from './fixtures/motion-video/brands';
import { makePhotos } from './fixtures/motion-video/media';
import { buildCompositionGrid, NEUTRAL_SEED } from '../services/design/compositionGrid';
import { flyerRenderService, FORMAT_DIMENSIONS } from '../services/Communication/flyerRender.service';
import { FLYER_LAYOUT_IDS, flyerLayoutMenu, pickFlyerLayout, renderFlyerLayout, textOn } from '../services/Communication/flyerLayouts';
import { artDirectorTask, copywriterTask, structureTask } from '../services/Communication/flyerCreative';
import { contrastRatio } from '../services/design/color';
import fs from 'fs';
import path from 'path';
import { CARD_STRUCTURES, renderCardBack, renderCardFront, CardBackId, CardFrontId } from '../services/BandIdentity/businessCardLayouts';
import { cardLayoutTask, cardStructureTask, cardTuningTask } from '../services/BandIdentity/businessCardCreative';
import { businessCardRenderService } from '../services/BandIdentity/businessCardRender.service';
import { planDocumentDesign, resumedDesignPlan, savedDesignOf } from '../services/creativity/documentDesign';
import { acceptComposedPage, composePageHtml } from '../services/creativity/pageComposer';
import { closePageInspector, inspectComposedPage } from '../services/creativity/pageInspect';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { buildDocumentSeed, buildSectionSeed } from '../services/design/designSeed';
import { LANDSCAPE_SLIDE } from '../services/design/sectionRenderer';
import { brandInitials, composeTemplateLogos, logoMenu, markInks } from '../services/BandIdentity/logoTemplates';
import { logoDirectionsTask, logoDraftCount, logoJuryTask } from '../services/BandIdentity/logoCreative';
import { inspectSvg } from '../services/design/svgGate';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
/** `--only=8,9,10` : seulement ces sections (les sections 1 à 3, immédiates, tournent toujours). */
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);
const run = (n: number) => !only.length || only.includes(n);

const GOOD_SCENE = `
import { useScene, useEngine, useLocalTime, useSceneProgress, useBeatPulse, useExitAt, useEnter, Kinetic, progress, mix, cue } from '@idem/kit';

export default function Scene() {
  const s = useScene();
  const { u, horizontal, ease, data } = useEngine();
  const lt = useLocalTime();
  const p = useSceneProgress();
  const beat = useBeatPulse();
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const sweep = ease(progress(lt, 0, 0.7));
  const sub = useEnter('rise', g * 2, 1, exitAt);
  cue(\`\${s.key}:sweep\`, s.start, 'whoosh', 0.6);
  const dots = [0, 1, 2, 3, 4, 5];
  return (
    <>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: \`\${sweep * (horizontal ? 46 : 100)}%\`, height: horizontal ? '100%' : '42%', background: 'var(--hl)' }} />
      {dots.map((d) => (
        <span key={d} style={{ position: 'absolute', left: \`\${12 + d * 13}%\`, bottom: \`\${8 + Math.sin(lt * 2 + d) * 2}%\`, width: 2 * u, height: 2 * u, borderRadius: 999, background: 'var(--ink)', opacity: 0.25 + beat * 0.2, transform: \`translateY(\${mix(4, 0, sweep)}px)\` }} />
      ))}
      <div className="safe" style={{ justifyContent: 'flex-end' }}>
        <div style={{ width: horizontal ? '50%' : '92%', transform: \`translateX(\${mix(-0.8, 0.8, p)}%)\` }}>
          <Kinetic text={s.slots.title || ''} technique="maskUp" at={0.3} role="headline" fit={[horizontal ? 12 : 15, 6, 3]} exitAt={exitAt} sound="click" />
        </div>
        {s.slots.sub ? (
          <div style={{ ...sub, marginTop: 3 * u, width: horizontal ? '46%' : '86%' }}>
            <Kinetic text={s.slots.sub} technique="blurWords" at={g * 2} role="support" fit={[5.5, 3.4, 2]} exitAt={exitAt} style={{ color: 'var(--muted)' }} />
          </div>
        ) : null}
      </div>
    </>
  );
}
`.trim();

(async () => {
  console.log('Jauge de créativité');

  section('1. Prix et crans');
  const bp = BUSINESS_CREDIT_COSTS.business_plan;
  const costs = CREATIVITY_LEVELS.map((l) => creativityCost(bp, l));
  check(`business plan (${bp}) : ${costs.join(' / ')} crédits`, costs.join(',') === [70, 70, 88, 105, 140].join(','));
  check('vidéo 120 : 120 / 120 / 150 / 180 / 240', CREATIVITY_LEVELS.map((l) => creativityCost(120, l)).join(',') === '120,120,150,180,240');
  check('multiplicateurs ×1 · ×1 · ×1,25 · ×1,5 · ×2', Object.values(CREATIVITY_MULTIPLIER).join(',') === '1,1,1.25,1.5,2');
  check('cran inconnu, vide ou mal écrit → Medium ; « ULTRA » compris', normalizeCreativity('extreme') === 'medium' && normalizeCreativity(undefined) === 'medium' && normalizeCreativity(' ULTRA ') === 'ultra');
  check('atLeast : high ≥ medium, low < high', atLeast('high', 'medium') && !atLeast('low', 'high'));
  check('un livrable gratuit le reste à tous les crans', CREATIVITY_LEVELS.every((l) => creativityCost(0, l) === 0));

  section('2. Orchestrateur');
  const menu = ['wordStack', 'bigNumber', 'classic'] as const;
  const task = (call: AgentCall | undefined, level: (typeof CREATIVITY_LEVELS)[number], extra: Partial<Parameters<CreativeOrchestrator['run']>[0]> = {}) => {
    const o = new CreativeOrchestrator({ level, call });
    return {
      o,
      run: () =>
        o.run<string>({
          role: 'artDirector',
          minLevel: 'high',
          prompt: () => ({ system: 'choose', user: menu.map((m, i) => `${'abc'[i]}) ${m}`).join('\n') }),
          parse: (raw: string) => pickOption(agentLines(raw).layout || raw.trim(), menu),
          fallback: () => 'classic',
          ...(extra as object),
        } as any),
    };
  };
  const perfect = task(async () => 'layout: b', 'high');
  const r1 = await perfect.run();
  check('réponse parfaite (lettre) retenue', r1.value === 'bigNumber' && r1.source === 'llm');
  const r2 = await task(async () => '{"layout":"wordStack"}', 'high').run();
  check('réponse JSON comprise', r2.value === 'wordStack' && r2.source === 'llm');
  const r3 = await task(async () => 'layout: hologram', 'high').run();
  check('réponse inventée → repli du code', r3.value === 'classic' && r3.source === 'graph');
  const r4 = await task(async () => '', 'high').run();
  const r5 = await task(async () => {
    throw new Error('quota');
  }, 'high').run();
  check('réponse vide ou modèle en panne → repli, sans erreur', r4.source === 'graph' && r5.source === 'graph');
  let called = false;
  const below = task(async () => {
    called = true;
    return 'layout: a';
  }, 'medium');
  const r6 = await below.run();
  check('tâche au-dessus du cran : aucun appel, décision du code', !called && r6.source === 'graph' && below.o.traces[0].reason === 'level');
  const budget = createRunBudget('test', 1);
  budget.consume(5);
  const broke = new CreativeOrchestrator({ level: 'ultra', call: async () => 'layout: a', budget });
  const r7 = await broke.run({ role: 'x', minLevel: 'low', prompt: () => ({ system: 's', user: 'u' }), parse: (r) => r, fallback: () => 'fallback' });
  check('budget épuisé → repli', r7.value === 'fallback' && broke.traces[0].reason === 'budget');
  let n = 0;
  const best = new CreativeOrchestrator({ level: 'max', call: async () => ['layout: c', 'layout: a', 'layout: b'][n++ % 3] });
  const r8 = await best.run<string>({ role: 'artDirector', minLevel: 'high', prompt: () => ({ system: 's', user: 'u' }), parse: (raw: string) => pickOption(agentLines(raw).layout, menu), fallback: () => 'classic', samples: 3, score: (v) => menu.indexOf(v as any) });
  check('meilleur de 3 départagé par le code (Max)', r8.value === 'wordStack' && best.traces[0].samples === 3, `${r8.value}`);
  const many = new CreativeOrchestrator({ level: 'high', call: async ({ user }) => `layout: ${user}` });
  const all = await many.all(['a', 'b', 'c', 'a'].map((l, i) => ({ role: 'ad', key: `ad:${i}`, minLevel: 'high' as const, prompt: () => ({ system: 's', user: l }), parse: (raw: string) => pickOption(agentLines(raw).layout, menu) as string | undefined, fallback: () => 'classic' as string })), 2);
  check('tâches parallèles : l’ordre des résultats suit celui des tâches', all.map((r) => r.value).join(',') === 'wordStack,bigNumber,classic,wordStack');

  section('3. Cran Ultra — lint du code des scènes');
  check('code extrait d’un bloc ```tsx', extractCode('Voici :\n```tsx\n' + GOOD_SCENE + '\n```') === GOOD_SCENE);
  const goodIssues = await lintSceneCode(GOOD_SCENE, ['title', 'sub']);
  check('une scène propre passe le lint', goodIssues.length === 0, goodIssues.join(' | '));
  const bad: [string, string, RegExp][] = [
    ['réseau (fetch)', GOOD_SCENE.replace('const dots', 'fetch("/x"); const dots'), /fetch/],
    ['global window', GOOD_SCENE.replace('const dots', 'const w = window.innerWidth; const dots'), /window/],
    ['hasard', GOOD_SCENE.replace('const dots', 'const r = Math.random(); const dots'), /random/],
    ['horloge', GOOD_SCENE.replace('const dots', 'const d = Date.now(); const dots'), /Date|now/],
    ['boucle while', GOOD_SCENE.replace('const dots', 'let k = 0; while (k < 3) { k++; } const dots'), /while/],
    ['for sans borne', GOOD_SCENE.replace('const dots', 'for (let k = 0; k < 1e9; k++) {} const dots'), /bounded/],
    ['constructeur', GOOD_SCENE.replace('const dots', 'const F = (() => 0).constructor; const dots'), /constructor/],
    ['accès calculé par chaîne', GOOD_SCENE.replace('const dots', 'const F = s["con" + "structor"]; const dots'), /computed/],
    ['état React', GOOD_SCENE.replace("import { useScene,", "import { useState } from 'react';\nimport { useScene,"), /useState/],
    ['animation CSS', GOOD_SCENE.replace("background: 'var(--hl)' }}", "background: 'var(--hl)', transition: 'width 1s' }}"), /animations/],
    ['transformation 3D', GOOD_SCENE.replace('translateX(${mix(-0.8, 0.8, p)}%)', 'rotateY(${p * 20}deg)'), /3D/],
    ['texte écrit en dur', GOOD_SCENE.replace("text={s.slots.title || ''}", 'text="Le meilleur jus de bissap de Dakar"'), /copy written|never shown/],
    ['import inconnu', "import fs from 'fs';\n" + GOOD_SCENE, /import from "fs"/],
    ['URL', GOOD_SCENE.replace("background: 'var(--hl)'", "background: 'url(https://evil.example/x.png)'"), /URL/],
    ['texte oublié', GOOD_SCENE.replace('{s.slots.sub ? (', '{false ? (').replace('text={s.slots.sub}', 'text=""'), /never shown/],
    ['erreur de syntaxe', GOOD_SCENE.replace('return (', 'return ((('), /syntax/],
  ];
  for (const [label, code, expected] of bad) {
    const issues = await lintSceneCode(code, ['title', 'sub']);
    check(`refusé : ${label}`, issues.some((i) => expected.test(i)), issues.slice(0, 2).join(' | ') || 'aucun défaut relevé');
  }

  if (run(4)) {
  section('4. Cran Ultra — rendu réel (Chromium)');
  const brand = brandById('kofi');
  const theme = buildVideoTheme(brand.branding, brand.name);
  const make = (code?: string, format: 'story' | 'landscape' = 'story') => {
    const sb = buildStoryboard({ sceneIds: ['statement', 'logo'], slots: [{ title: 'Le studio qui livre vite', sub: 'Remote, depuis Lomé' }, {}], durationSec: 6, style: 'premium', seed: 11, images: [], direction: 'precision' });
    sb.kit = { background: 'none', backdropScenes: [], annotate: 'none', logo: 'classic', iconSet: 'lucide', icons: {}, postfx: [], addons: [], trace: [] } as any;
    if (code) sb.scenes[0].code = { tsx: code };
    return { sb, format };
  };
  const inspect = async (code: string, format: 'story' | 'landscape' = 'story') => {
    const { sb } = make(code, format);
    const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format, quality: 'standard', mode: 'render' });
    const sc = sb.scenes[0];
    return {
      html,
      issues: await withRenderPage({ html, width: spec.width, height: spec.height, strict: true }, (page) => inspectRenderedScene(page, { key: sc.key, start: sc.start, duration: sc.duration, texts: visibleTexts(sc.sceneId, sc.slots) }, spec)),
    };
  };
  try {
    const compiled = await compileSceneCode(GOOD_SCENE);
    check('compilation TSX → module du moteur', compiled.includes('require("@idem/kit")') && compiled.includes('React.createElement'));
    for (const format of ['story', 'landscape'] as const) {
      const good = await inspect(GOOD_SCENE, format);
      check(`scène de l’IA (${format}) : rendue, textes visibles et dans le cadre, mouvement, déterministe`, good.issues.length === 0, good.issues.join(' | '));
      if (format === 'story') check('page avec code de l’IA : CSP posée, réseau sortant coupé', /Content-Security-Policy/.test(good.html) && /connect-src data: blob:/.test(good.html) && !/connect-src[^;]*https:\/\/evil/.test(good.html));
    }
    const crash = await inspect(GOOD_SCENE.replace('const dots = [0, 1, 2, 3, 4, 5];', 'const dots = [0, 1, 2, 3, 4, 5]; if (lt > 0.1) throw new Error("boom");'));
    check('scène qui lève une erreur : signalée (la scène retombe sur sa composition)', crash.issues.some((i) => /runtime error|did not render/.test(i)), crash.issues.join(' | '));
    const off = await inspect(GOOD_SCENE.replace("<div className=\"safe\" style={{ justifyContent: 'flex-end' }}>", "<div className=\"safe\" style={{ justifyContent: 'flex-end', transform: 'translateX(140%)' }}>"));
    check('texte hors du cadre : signalé', off.issues.some((i) => /outside the frame|not visible/.test(i)), off.issues.join(' | '));
    const still = await inspect(GOOD_SCENE.replace(/at=\{0\.3\}/, 'at={0}').replace('const sweep = ease(progress(lt, 0, 0.7));', 'const sweep = 1;').replace("technique=\"maskUp\"", 'technique="trackIn"').replace(/Math\.sin\(lt \* 2 \+ d\) \* 2/, '0').replace('mix(-0.8, 0.8, p)', '0').replace("useEnter('rise', g * 2, 1, exitAt)", "({ opacity: 1 })").replace('at={g * 2}', 'at={-1}').replace('at={0}', 'at={-2}'));
    check('scène figée : signalée', still.issues.some((i) => /nothing moves/.test(i)), still.issues.join(' | ') || 'aucun défaut');
    const csp = contentSecurityPolicy('{"img":"https://cdn.example.com/a.png"} <link href="https://fonts.googleapis.com/css2?family=Inter">');
    check('CSP : seules les origines déjà présentes dans la page', /img-src data: blob: https:\/\/cdn\.example\.com/.test(csp) && /https:\/\/fonts\.gstatic\.com/.test(csp) && /default-src 'none'/.test(csp));
  } finally {
    await closeRenderBrowser();
  }
  }

  if (run(5)) {
    section('5. Visuels — agents des crans Low → High');
    const brief = { title: 'Soldes de fin d’année : -30 % sur les pagnes', hook: 'Vos pagnes à prix doux', description: 'Jusqu’au 31 décembre, livraison 24 h à Abidjan.' };
    const cw = copywriterTask('BRAND: Wax & Co', brief);
    const ok = cw.parse('kicker: Soldes\nheadline: Vos pagnes à prix doux\nsub: Jusqu’au 31 décembre, livrés en 24 h\ndetail: -30 %');
    check('rédacteur : sur-titre, titre, sous-titre et fait chiffré du contenu gardés', ok?.headline === 'Vos pagnes à prix doux' && ok?.detail === '-30 %' && ok?.kicker === 'Soldes', JSON.stringify(ok));
    const invented = cw.parse('headline: Vos pagnes à prix doux\ndetail: -50 %');
    check('rédacteur : un chiffre absent du contenu est retiré', !!invented && !invented.detail, JSON.stringify(invented));
    check('rédacteur : titre au chiffre inventé ou trop long refusé', cw.parse('headline: 2 pagnes achetés 1 offert ce week-end seulement') === undefined && cw.parse('headline: Une phrase beaucoup trop longue pour tenir sur un visuel de réseau social lisible') === undefined);
    check('rédacteur : repli sur le contenu', !!cw.fallback().headline && cw.fallback().detail === '-30 %', JSON.stringify(cw.fallback()));
    const st = structureTask('BRAND', { headline: 'x', detail: '-30 %' }, ['photo', 'type', 'fact'], 'photo');
    check('structure : choix par lettre, invention refusée', st.parse('structure: c') === 'fact' && st.parse('structure: hologram') === undefined);
    const menu = flyerLayoutMenu('photo', { styleId: 'minimalism', recent: ['minimalCaption'] });
    check('menu de compositions : DA minimaliste sans bandeau oblique, la dernière composition recule', !menu.includes('stripeOverPhoto') && menu[0] !== 'minimalCaption' && menu.length >= 3, menu.join(','));
    const ad = artDirectorTask('BRAND', { headline: 'Vos pagnes à prix doux' }, menu, menu[0]);
    const pick = ad.parse('layout: b\nword: doux');
    check('directeur artistique : composition du menu et mot mis en valeur', pick?.layout === menu[1] && pick?.emphasis === 4, JSON.stringify(pick));
    check('choix du code : varié par la graine, toujours dans le menu', new Set([1, 2, 3, 4, 5, 6].map((n) => pickFlyerLayout('photo', n))).size >= 2);
    check('couleur de texte : toujours lisible sur la couleur de la marque', ['#C2410C', '#0F172A', '#FDE68A', '#16A34A'].every((bg) => contrastRatio(textOn(bg, { primary: bg, secondary: '#111', text: '#1f2937', background: '#fff7ed' }), bg) >= 4.5));
  }

  if (run(6)) {
    section('6. Visuels — les douze compositions du code, rendues et contrôlées (Chromium)');
    const photos = await makePhotos(path.resolve(__dirname, '../../tmp/motion-video-check/photos'));
    const img = `data:image/jpeg;base64,${fs.readFileSync(photos[Object.keys(photos)[0]]).toString('base64')}`;
    const palette = { primary: '#C2410C', secondary: '#1E293B', accent: '#FACC15', background: '#FFF7ED', text: '#1F2937' };
    const copy = { kicker: 'Soldes', headline: 'Vos pagnes wax à prix doux', sub: 'Jusqu’au 31 décembre, livrés en 24 h à Abidjan', detail: '-30 %' };
    const sheet: string[] = [];
    let blocking = 0;
    let worst = 100;
    const blockers: string[] = [];
    for (const format of ['square', 'story', 'banner'] as const) {
      const dims = FORMAT_DIMENSIONS[format];
      const grid = buildCompositionGrid({ width: dims.width, height: dims.height }, NEUTRAL_SEED, palette);
      for (const id of FLYER_LAYOUT_IDS) {
        const html = renderFlyerLayout(id, { copy, brandName: 'Wax & Co', palette, logo: {}, image: img, width: dims.width, height: dims.height, grid });
        const out = await flyerRenderService.renderFlyer(html, format, { primaryFont: 'Archivo', secondaryFont: 'Inter' }, [], { grid, palette, label: `test/${id}/${format}` });
        if (out.audit.blocking) {
          blocking++;
          blockers.push(`${id}/${format}`);
        }
        worst = Math.min(worst, out.audit.score);
        sheet.push(`<figure><img src="data:image/png;base64,${out.png.toString('base64')}"><figcaption>${id} · ${format} · ${out.audit.score}</figcaption></figure>`);
      }
    }
    check(`36 visuels (12 compositions × 3 formats) : aucun défaut bloquant au contrôle mesuré`, blocking === 0, blockers.join(', '));
    check(`score du contrôle mesuré ≥ 60 partout (pire : ${worst})`, worst >= 60);
    const out = path.resolve(__dirname, '../../tmp/creativity-flyers.html');
    fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><style>body{font:12px system-ui;display:flex;flex-wrap:wrap;gap:10px;padding:16px}figure{margin:0;width:220px}img{width:100%;border:1px solid #ddd}</style>${sheet.join('')}`);
    console.log(`      planche : ${out}`);
  }

  if (run(7)) {
    section('7. Carte de visite — agents et mises en page du code (contrôle d’impression)');
    const st = cardStructureTask('BRAND', 'mixed');
    check('structure : choix par lettre, invention refusée', st.parse('structure: a') === 'brandFront' && st.parse('structure: holographic') === undefined);
    const lt = cardLayoutTask('BRAND', 'brandFront', { front: 'logoCenter', back: 'contactsList' });
    check('recto / verso : dans les menus de la structure', JSON.stringify(lt.parse('front: b\nback: d')) === JSON.stringify({ front: 'patternField', back: 'accentBar' }) && lt.parse('front: z\nback: z') === undefined);
    const tt = cardTuningTask('BRAND', ['primary', 'secondary']);
    check('réglages bornés : nom ramené à 1,2, surface du menu, filet compris', JSON.stringify(tt.parse('surface: b\nalign: center\nrule: bold\nname: 1.8')) === JSON.stringify({ surface: 'secondary', align: 'center', rule: 'bold', nameScale: 1.2 }));
    const palette = { primary: '#0F766E', secondary: '#1E293B', accent: '#F59E0B', background: '#F8FAFC', text: '#0F172A' };
    const fronts = [...new Set(Object.values(CARD_STRUCTURES).flatMap((d) => d.fronts))] as CardFrontId[];
    const backs = [...new Set(Object.values(CARD_STRUCTURES).flatMap((d) => d.backs))] as CardBackId[];
    const problems: string[] = [];
    for (const orientation of ['landscape', 'portrait'] as const) {
      const input = { width: orientation === 'landscape' ? 85 : 55, height: orientation === 'landscape' ? 55 : 85, brandName: 'Kofi Studio', palette, logos: {}, tuning: { rule: 'thin' as const } };
      for (const id of fronts) for (const issue of await businessCardRenderService.inspect(renderCardFront(id, input), orientation, { primaryFont: 'Archivo', secondaryFont: 'Inter' })) problems.push(`recto ${id}/${orientation}: ${issue}`);
      for (const id of backs) for (const issue of await businessCardRenderService.inspect(renderCardBack(id, input), orientation, { primaryFont: 'Archivo', secondaryFont: 'Inter' })) problems.push(`verso ${id}/${orientation}: ${issue}`);
    }
    check(`${fronts.length} rectos et ${backs.length} versos × 2 orientations : imprimables (marges, corps ≥ 7 pt, contraste)`, problems.length === 0, problems.slice(0, 6).join(' | '));
    const bad = await businessCardRenderService.inspect('<div class="w-[85mm] h-[55mm] relative" style="background:#fff"><p style="position:absolute;left:1mm;top:1mm;font-size:6px;color:#ddd">{{fullName}}</p></div>', 'landscape');
    check('contrôle d’impression : marge, corps trop petit et contraste faible détectés', bad.some((i) => /safety margin/.test(i)) && bad.some((i) => /7 pt/.test(i)) && bad.some((i) => /contrast/.test(i)), bad.join(' | '));
  }

  if (run(8)) {
    section('8. Documents (business plan, pitch deck) — direction artistique des pages');
    const pages = ['Company Summary', 'Market Analysis', 'Products & Services', 'Marketing & Sales', 'Financial Plan'].map((name) => ({ name }));
    const seedArchetypes = { 'Company Summary': 'A', 'Market Analysis': 'G', 'Products & Services': 'N', 'Marketing & Sales': 'D', 'Financial Plan': 'L' };
    // Un modèle simulé qui choisit toujours la 2e option, des réglages au cran Max, et un critique muet.
    const call: AgentCall = async ({ role, system }) =>
      role === 'documentFamily' ? 'family: b' : role === 'pageDirector' ? `layout: b${/density:/.test(system) ? '\ndensity: x\ntension: y\nimage: TOP_BAND' : ''}` : 'ok';
    const low = await planDocumentDesign({ level: 'low', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    check('Low : la graine décide (aucune page dirigée, pas de famille, pas de composition libre)', Object.keys(low.pages).length === 0 && !low.family && !low.freeCompose && low.traces.every((t) => t.source === 'graph'));
    const medium = await planDocumentDesign({ level: 'medium', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    check('Medium : la famille du document choisie par l’agent, les pages par la graine', !!medium.family && Object.keys(medium.pages).length === 0, String(medium.family));
    const high = await planDocumentDesign({ level: 'high', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    const arch = pages.map((p) => high.pages[p.name]?.archetype || (seedArchetypes as any)[p.name]);
    check('High : chaque page dirigée, jamais deux voisines au même archétype', Object.keys(high.pages).length === pages.length && arch.every((a, i) => i === 0 || a !== arch[i - 1]), arch.join(','));
    const max = await planDocumentDesign({ level: 'max', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    check('Max : place de l’image réglée, valeurs hors menu refusées (densité, tension)', Object.values(max.pages).every((p) => p.imagePosition === 'TOP_BAND' && !p.contentDensity && !p.layoutTension));
    const ultra = await planDocumentDesign({ level: 'ultra', call, sheet: 'BRAND', styleId: 'editorial', document: 'pitch deck', pages, seedArchetypes });
    check('Ultra : pages confiées au compositeur (gabarit en repli)', ultra.freeCompose);
    const broken = await planDocumentDesign({ level: 'max', call: async () => 'layout: hologram\nfamily: z', sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    check('réponses inventées : la graine garde la main', Object.keys(broken.pages).length === 0 && !broken.family);
    // Reprise / régénération ciblée : la direction enregistrée est reprise, sans agent.
    const saved = savedDesignOf(high);
    const resumed = resumedDesignPlan(saved, 'medium');
    check('enregistrée : décisions seules (cran, famille, pages), pas de traces', !('traces' in saved) && saved.level === 'high' && JSON.stringify(saved.pages) === JSON.stringify(high.pages));
    check('reprise : même famille et mêmes pages, aucun appel, compositeur selon le cran demandé', resumed.family === high.family && JSON.stringify(resumed.pages) === JSON.stringify(high.pages) && resumed.traces.length === 0 && !resumed.freeCompose && resumedDesignPlan(saved, 'ultra').freeCompose);
    check('reprise d’un document sans direction : la graine (aucune page dirigée)', Object.keys(resumedDesignPlan(undefined, 'max').pages).length === 0 && !resumedDesignPlan(undefined, 'max').family);

    const content = { title: 'Analyse du marché', lede: 'Le marché ivoirien du jus naturel croît de 12 % par an.', blocks: [{ type: 'prose', text: 'Les ménages urbains achètent de plus en plus de boissons locales sans sucre ajouté.' } as any, { type: 'metrics', items: [{ label: 'Croissance annuelle', value: '12 %' }] } as any] };
    const good = '```html\n<section style="width:210mm"><h2>Analyse du marché</h2><p>Le marché ivoirien du jus naturel croît de 12 % par an.</p><p>Les ménages urbains achètent de plus en plus de boissons locales sans sucre ajouté.</p><div>Croissance annuelle <b>12 %</b></div>' + '<div style="height:10px"></div>'.repeat(10) + '</section>\n```';
    check('compositeur : une page fidèle au contenu est acceptée', !!acceptComposedPage(good, content as any));
    check('compositeur : un texte du contenu manquant → refusée', !acceptComposedPage(good.replace('Les ménages urbains achètent de plus en plus de boissons locales sans sucre ajouté.', ''), content as any));
    check('compositeur : un chiffre inventé → refusée', !acceptComposedPage(good.replace('</section>', '<p>Part de marché visée : 35 %</p></section>'), content as any));
    check('compositeur : un script → refusée', !acceptComposedPage(good.replace('</section>', '<script>alert(1)</script></section>'), content as any));

    // Les spécimens d'une page de charte : couleurs et logos du contenu posés, aucune autre image.
    const logo = 'https://cdn.example.com/brand/logo-light.png';
    const specimen = { title: 'Palette et logo', blocks: [{ kind: 'swatches', items: [{ hex: '#1F6F43', name: 'Primaire', role: 'Identité, titres, aplats' }] } as any, { kind: 'logoDisplay', variants: [{ url: logo, label: 'Sur fond clair', background: 'light' }] } as any, { kind: 'prose', text: 'Le vert de la marque porte les titres et les grands aplats de couleur.' } as any] };
    const specimenPage = '```html\n<section style="width:297mm"><h2>Palette et logo</h2><div style="background:#1F6F43;height:40px"></div><p>Primaire #1F6F43 — Identité, titres, aplats</p><img src="' + logo + '" alt="Logo"><p>Sur fond clair</p><p>Le vert de la marque porte les titres et les grands aplats de couleur.</p>' + '<div style="height:10px"></div>'.repeat(8) + '</section>\n```';
    check('compositeur : spécimens fidèles (couleur et logo du contenu) → acceptée', !!acceptComposedPage(specimenPage, specimen as any));
    check('compositeur : le logo du contenu manque → refusée', !acceptComposedPage(specimenPage.replace(`<img src="${logo}" alt="Logo">`, ''), specimen as any));
    check('compositeur : une image étrangère au contenu → refusée', !acceptComposedPage(specimenPage.replace('</section>', '<img src="https://images.example.com/stock.jpg" alt=""></section>'), specimen as any));
    check('compositeur : la couleur du nuancier manque → refusée', !acceptComposedPage(specimenPage.replace(/#1F6F43/g, '#2A7A50'), specimen as any));
  }

  if (run(9)) {
    section('9. Documents — cran Ultra : rendu mesuré, réparation, repli (Chromium)');
    const charter = { colors: { colors: { primary: '#1F6F43', secondary: '#F2C14E', accent: '#E07A2E', background: '#FFFFFF', text: '#1A1A1A' } }, typography: { primaryFont: 'Archivo', secondaryFont: 'Inter' } } as any;
    const ds = buildDocumentDesignSystem(charter, { styleId: 'editorial' } as any, buildDocumentSeed('editorial', 'check:ultra'));
    const seed = buildSectionSeed('editorial', 'check:ultra', 'Market', new Set());
    const content = { title: 'Le marché du jus local', lede: 'Les ménages urbains achètent de plus en plus de boissons locales.', blocks: [{ kind: 'prose', text: 'La demande de jus naturels progresse dans les grandes villes du pays.' } as any] };
    const fits = `<section style="width:${LANDSCAPE_SLIDE.width};height:${LANDSCAPE_SLIDE.minHeight};padding:${LANDSCAPE_SLIDE.padding};position:relative;overflow:hidden;box-sizing:border-box;background:#FFFFFF"><h2 style="font-size:40px;color:#1A1A1A">Le marché du jus local</h2><p style="font-size:18px;color:#1A1A1A">Les ménages urbains achètent de plus en plus de boissons locales.</p><p style="font-size:16px;color:#1A1A1A">La demande de jus naturels progresse dans les grandes villes du pays.</p></section>`;
    const tooTall = fits.replace('<h2', '<div style="height:900px"></div><h2');
    const tiny = fits.replace('font-size:16px', 'font-size:7px');
    const pale = fits.replace('font-size:18px;color:#1A1A1A', 'font-size:18px;color:#D8D8D8');
    const opts = { page: LANDSCAPE_SLIDE, singlePage: true, fonts: { display: 'Archivo', body: 'Inter' } };
    const ok = await inspectComposedPage(fits, opts);
    check('mesure : une page qui tient est livrable', ok.length === 0, ok.join(' ; '));
    const tall = await inspectComposedPage(tooTall, opts);
    check('mesure : une diapositive trop haute → signalée (fin rognée)', tall.some((i) => /must fit|below the bottom/.test(i)), tall[0]);
    const small = await inspectComposedPage(tiny, opts);
    check('mesure : un corps sous 7 pt → signalé', small.some((i) => /smaller than 7 pt/.test(i)), small.join(' ; '));
    const faint = await inspectComposedPage(pale, opts);
    check('mesure : un contraste insuffisant → signalé', faint.some((i) => /low contrast/.test(i)), faint.join(' ; '));

    // Le compositeur : une réparation avec les constats, puis le gabarit.
    const md = (html: string) => '```html\n' + html.replace('</section>', '<div style="height:4px"></div>'.repeat(30) + '</section>') + '\n```';
    let calls = 0;
    let repairPrompt = '';
    const repaired = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market',
      call: async ({ user }) => { calls++; if (calls === 2) repairPrompt = user; return md(calls === 1 ? tooTall : fits); } });
    check('compositeur : page refusée par la mesure → réparée au 2e essai', !!repaired.html && calls === 2 && /CHECKED AND REJECTED/.test(repairPrompt) && /must fit|below the bottom/.test(repairPrompt));
    calls = 0;
    const fallback = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', call: async () => { calls++; return md(tooTall); } });
    check('compositeur : toujours trop haute → null (le gabarit rend la page) après trois tours', fallback.html === null && calls === 3, `${calls} appel(s)`);
    // La fidélité n'est plus un couperet : le défaut repart au compositeur, qui corrige.
    calls = 0;
    let fidelityPrompt = '';
    const fixedNumber = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', inspect: async () => [],
      call: async ({ user }) => { calls++; if (calls === 2) fidelityPrompt = user; return md(calls === 1 ? fits.replace('</section>', '<p style="font-size:14px">Page 07 · 2026</p></section>') : fits); } });
    check('compositeur : chiffre inventé → signalé au compositeur et corrigé au 2e tour', !!fixedNumber.html && calls === 2 && /remove these numbers/.test(fidelityPrompt) && /07|2026/.test(fidelityPrompt) && /PREVIOUS PAGE/.test(fidelityPrompt));
    const down = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', call: async () => { throw new Error('quota'); } });
    check('compositeur : modèle en panne → null (le gabarit rend la page)', down.html === null);
    // Les images du contenu partent au modèle sous forme de repères, et reviennent en URL.
    const dataLogo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1F6F43"/></svg>' + ' '.repeat(3000)).toString('base64');
    const withLogo = { ...content, blocks: [...content.blocks, { kind: 'logoDisplay', variants: [{ url: dataLogo, label: 'Sur fond clair', background: 'light' }] } as any] };
    let seenPrompt = '';
    const tokened = await composePageHtml({ content: withLogo as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'brand guidelines book', name: 'Logo', inspect: async () => [],
      call: async ({ system, user }) => { seenPrompt = system + user; return md(fits.replace('</section>', '<img src="{{IMG_1}}" alt="Logo"><p>Sur fond clair</p></section>')); } });
    check('compositeur : l’image part en repère {{IMG_1}} (pas de data: dans le prompt), revient en URL', !seenPrompt.includes('data:image') && seenPrompt.includes('{{IMG_1}}') && !!tokened.html && tokened.html.includes(dataLogo), `${seenPrompt.length} car. de prompt`);
    await closePageInspector();
  }

  if (run(10)) {
    section('10. Identité visuelle — logos du code (Low) et agents du logo');
    const palette = { primary: '#1F6F43', secondary: '#F2C14E', accent: '#E07A2E', text: '#1A1A1A', background: '#FFFFFF' };
    check('initiales : « Verda Jus » → VJ, « kora » → K, accents retirés', brandInitials('Verda Jus') === 'VJ' && brandInitials('kora') === 'K' && brandInitials('Énergie Ouest') === 'EO');
    const inks = markInks({ primary: '#F2C14E', accent: '#1F6F43' });
    check('encres : la couleur trop claire n’est pas l’encre principale (≥ 3:1 sur blanc)', contrastRatio(inks.ink, '#FFFFFF') >= 3, inks.ink);
    check('menu : les formes de la DA d’abord (bohemian → feuilles, éclosion, lever…)', ['leaves', 'bloom', 'sunrise', 'monoRing'].includes(logoMenu('icon', 'bohemian', 'x')[0]));
    check('menu : type « initial » → monogrammes seulement', logoMenu('initial', 'swiss', 'x').every((id) => /^mono|initialBar/.test(id)));
    for (const [family, styleId] of [['Fraunces', 'bohemian'], ['Space Grotesk', 'swiss']] as const) {
      for (const type of ['icon', 'name', 'initial'] as const) {
        const logos = await composeTemplateLogos({ brandName: 'Verda Jus', type, palette, typography: { family }, styleId, seed: 'check' });
        const gated = logos.every((l) => { const r = inspectSvg(l.svg, { palette: Object.values(palette) }); return r.ok || r.defects.every((d) => d.code === 'live_text'); });
        const named = new Set(logos.map((l) => l.name)).size === logos.length;
        check(`${family} / ${type} : 3 propositions distinctes, svgGate, aucun NaN${type === 'icon' ? ', lockup composé' : ''}`, logos.length === 3 && gated && named && logos.every((l) => !/NaN/.test(l.svg)) && (type !== 'icon' || logos.every((l) => !!l.lockup && !!l.iconSvg)), `${logos.length} logo(s)`);
      }
    }
    // Le cas qui coupait le nom (« Verd ι ») : opentype.js rendait un NaN dans le « a » de Fraunces.
    const verda = (await composeTemplateLogos({ brandName: 'Verda Jus', type: 'name', palette, typography: { family: 'Fraunces' }, styleId: 'editorial', seed: 'nan', count: 1 }))[0];
    check('wordmark Fraunces : tracé complet, sans NaN (le nom n’est plus coupé)', !!verda && !/NaN/.test(verda.svg) && (verda.svg.match(/<path/g) || []).length >= 1);

    const directions = logoDirectionsTask('BRAND', 'icon', 3);
    check('directeur de création : trois directions lues', directions.parse('1: A leaf folded into a drop, two greens, rounded geometry\n2: A sun rising over a horizon of fruit, warm orange accent\n3. A woven grid of squares like a market basket, two tones')?.length === 3);
    check('directeur de création : directions trop courtes → refusées', directions.parse('1: leaf\n2: sun\n3: grid') === undefined);
    check('directeur de création : sous High, pas d’appel', directions.minLevel === 'high');
    const drafts = [{ id: 'a', name: 'a', concept: 'x', colors: [], fonts: [], svg: '<svg/>' }, { id: 'b', name: 'b', concept: 'y', colors: [], fonts: [], svg: '<svg/>' }] as any;
    const jury = logoJuryTask('BRAND', drafts, 0);
    check('jury : « best: b » → 2e brouillon', jury.parse('best: b') === 1);
    check('jury : réponse inventée → refusée (repli : 1er brouillon)', jury.parse('hologram') === undefined && jury.fallback() === 0);
    check('brouillons par proposition : Medium/High 1, Max 2, Ultra 3', logoDraftCount('medium') === 1 && logoDraftCount('high') === 1 && logoDraftCount('max') === 2 && logoDraftCount('ultra') === 3);
  }

  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Jauge de créativité : prix, orchestrateur et cran Ultra conformes.');
  process.exit(failures ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await closeRenderBrowser().catch(() => undefined);
  process.exit(1);
});
