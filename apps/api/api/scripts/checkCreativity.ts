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
import { textOn } from '../services/Communication/flyerLayouts';
import { contrastRatio } from '../services/design/color';
import fs from 'fs';
import path from 'path';
import { CARD_PATTERNS, CARD_STRUCTURES, renderCardBack, renderCardFront, CardBackId, CardFrontId, CardPatternId } from '../services/BandIdentity/businessCardLayouts';
import { cardLayoutTask, cardStructureTask, cardTuningTask } from '../services/BandIdentity/businessCardCreative';
import { businessCardRenderService } from '../services/BandIdentity/businessCardRender.service';
import { delegationOf, planDocumentDesign, resumedDesignPlan, savedDesignOf } from '../services/creativity/documentDesign';
import { acceptComposedPage, buildComposerPrompt, cleanComposedLeftovers, composePageHtml, extractComposedHtml, fidelityCheck } from '../services/creativity/pageComposer';
import { closePageInspector, inspectComposedPage, type PageMeasure } from '../services/creativity/pageInspect';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { buildDocumentSeed, buildSectionSeed } from '../services/design/designSeed';
import { LANDSCAPE_SLIDE, PORTRAIT_A4, renderStandaloneChart } from '../services/design/sectionRenderer';
import { pageGfx, pageKitManifest } from '../../../ivision/core/src/visual/poster/kit/page';
import { BRAND_PATTERN_KINDS, brandPatternCss, brandPatternSvg, planBrandPatterns } from '../../../ivision/core/src/design/brandPatterns';
import { PAGE_DECOR_BY_ID, pageBreathes, rankPageDecors } from '../../../ivision/core/src/design/pageDecor';
import { UI_COMPONENTS, expandUiMacros, renderUi, uiManifest, uiMenu, uiTokensOf } from '../../../ivision/core/src/design/uiKit';
import { LAYOUT_PRESETS, PRESET_BY_ID, applyPreset, presetCoverage, rankPresets } from '../../../ivision/core/src/design/layoutPresets';
import { ARCHETYPE_CATALOG } from '../services/design/designSeed';
import { LAYOUT_FAMILIES } from '../services/design/layoutFamilies';
import { PATTERN_OPACITY } from '../../../ivision/core/src/design/brandPatterns';
import { DIAGRAM_GUIDE, DIAGRAM_KINDS, brandMermaidTheme, diagramKindOf, mermaidBundle, renderDiagrams } from '../../../ivision/core/src/design/diagramRender';
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
    // Le lint nomme la propriété fautive : « CSS transitions are forbidden (style property
    // `transition`) » pour une transition, « animations » pour une animation. Le motif acceptait
    // seulement « animations » et refusait donc le cas qu'il teste.
    ['animation CSS', GOOD_SCENE.replace("background: 'var(--hl)' }}", "background: 'var(--hl)', transition: 'width 1s' }}"), /animations|transitions/],
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
    section('5. Visuels — encre lisible sur la charte');
    // Les agents et les douze compositions de l'ancien moteur de visuels ont été retirés (cf.
    // `visual/flyer.layouts.ts`) : la composition d'un visuel vit dans `poster/poster.compose.ts`,
    // dont les agents et les gabarits sont contrôlés par `check:flyer` et `check:poster:kit`.
    check('couleur de texte : toujours lisible sur la couleur de la marque', ['#C2410C', '#0F172A', '#FDE68A', '#16A34A'].every((bg) => contrastRatio(textOn(bg, { primary: bg, secondary: '#111', text: '#1f2937', background: '#fff7ed' }), bg) >= 4.5));
  }

  if (run(6)) {
    section('6. Visuels — rendu mesuré des gabarits du compositeur');
    // Les douze compositions de l'ancien moteur n'existent plus. Les gabarits réellement employés
    // (`poster/poster.templates.ts`) sont rendus et mesurés par `npm run check:flyer`.
    check('gabarits du compositeur : contrôlés par check:flyer (ancien moteur retiré)', true);
  }

  if (run(7)) {
    section('7. Carte de visite — agents et mises en page du code (contrôle d’impression)');
    const st = cardStructureTask('BRAND', 'mixed');
    check('structure : choix par lettre, invention refusée', st.parse('structure: a') === 'brandFront' && st.parse('structure: holographic') === undefined);
    const lt = cardLayoutTask('BRAND', 'brandFront', { front: 'logoCenter', back: 'contactsList' });
    check('recto / verso : dans les menus de la structure', JSON.stringify(lt.parse('front: b\nback: d')) === JSON.stringify({ front: 'patternField', back: 'accentBar' }) && lt.parse('front: z\nback: z') === undefined);
    const tt = cardTuningTask('BRAND', ['primary', 'secondary']);
    check('réglages bornés : nom ramené à 1,2, surface du menu, filet compris', JSON.stringify(tt.parse('surface: b\nalign: center\nrule: bold\nname: 1.8')) === JSON.stringify({ surface: 'secondary', align: 'center', rule: 'bold', nameScale: 1.2 }));
    // La TEXTURE de la face de marque : l'agent la nomme (une lettre), le kit la dessine.
    check('réglages : la texture se choisit dans le menu du kit, une invention est refusée',
      tt.parse('surface: a\ntexture: a')?.pattern === 'weave' && tt.parse('surface: a\ntexture: c')?.pattern === 'contours' && tt.parse('surface: a\ntexture: hologram')?.pattern === undefined);
    const palette = { primary: '#0F766E', secondary: '#1E293B', accent: '#F59E0B', background: '#F8FAFC', text: '#0F172A' };
    const fronts = [...new Set(Object.values(CARD_STRUCTURES).flatMap((d) => d.fronts))] as CardFrontId[];
    const backs = [...new Set(Object.values(CARD_STRUCTURES).flatMap((d) => d.backs))] as CardBackId[];
    const problems: string[] = [];
    for (const orientation of ['landscape', 'portrait'] as const) {
      const input = { width: orientation === 'landscape' ? 85 : 55, height: orientation === 'landscape' ? 55 : 85, brandName: 'Kofi Studio', palette, logos: {}, tuning: { rule: 'thin' as const } };
      for (const id of fronts) for (const issue of (await businessCardRenderService.inspect(renderCardFront(id, input), orientation, { primaryFont: 'Archivo', secondaryFont: 'Inter' })).issues) problems.push(`recto ${id}/${orientation}: ${issue}`);
      for (const id of backs) for (const issue of (await businessCardRenderService.inspect(renderCardBack(id, input), orientation, { primaryFont: 'Archivo', secondaryFont: 'Inter' })).issues) problems.push(`verso ${id}/${orientation}: ${issue}`);
    }
    check(`${fronts.length} rectos et ${backs.length} versos × 2 orientations : imprimables (marges, corps ≥ 7 pt, contraste)`, problems.length === 0, problems.slice(0, 6).join(' | '));
    // Les six textures du kit, dessinées sur la face de marque : imprimables et réellement différentes.
    const textures = Object.keys(CARD_PATTERNS) as CardPatternId[];
    const drawn = textures.map((pattern) => renderCardFront('patternField', { width: 85, height: 55, brandName: 'Kofi Studio', palette, logos: {}, tuning: { pattern } }));
    const textureIssues: string[] = [];
    for (const [i, html] of drawn.entries()) for (const issue of (await businessCardRenderService.inspect(html, 'landscape', { primaryFont: 'Archivo', secondaryFont: 'Inter' })).issues) textureIssues.push(`${textures[i]}: ${issue}`);
    check(`${textures.length} textures du kit sur la face de marque : imprimables, dessinées (SVG) et toutes distinctes`,
      !textureIssues.length && drawn.every((h) => /<svg/.test(h)) && new Set(drawn).size === textures.length,
      textureIssues.slice(0, 4).join(' | '));
    const bad = await businessCardRenderService.inspect('<div class="w-[85mm] h-[55mm] relative" style="background:#fff"><p style="position:absolute;left:1mm;top:1mm;font-size:6px;color:#ddd">{{fullName}}</p></div>', 'landscape');
    check('contrôle d’impression : marge, corps illisible et contraste illisible → bloquants',
      bad.issues.some((i) => /safety margin/.test(i)) && bad.issues.some((i) => /far too small/.test(i)) && bad.issues.some((i) => /unreadable/.test(i)), bad.issues.join(' | '));
    // Ce qui ne rend pas la carte inimprimable est un CONSEIL : l'IA le reçoit, il ne lui coûte
    // pas sa carte. C'est ce qui faisait retomber le cran Ultra sur la composition du code.
    const nearly = await businessCardRenderService.inspect('<div class="w-[85mm] h-[55mm] relative" style="background:#ffffff"><p style="position:absolute;left:6mm;top:6mm;font-size:9px;color:#6f6f6f">{{fullName}}</p></div>', 'landscape');
    check('contrôle d’impression : un contraste ou un corps limite est un conseil, pas un refus',
      nearly.issues.length === 0 && nearly.advisories.length > 0, `${nearly.issues.join(' | ')} || ${nearly.advisories.join(' | ')}`);
  }

  if (run(8)) {
    section('8. Documents (business plan, pitch deck) — direction artistique des pages');
    const pages = ['Company Summary', 'Market Analysis', 'Products & Services', 'Marketing & Sales', 'Financial Plan'].map((name) => ({ name }));
    const seedArchetypes = { 'Company Summary': 'A', 'Market Analysis': 'G', 'Products & Services': 'N', 'Marketing & Sales': 'D', 'Financial Plan': 'L' };
    // Un modèle simulé qui choisit toujours la 2e option, des réglages au cran Max, et un critique muet.
    const call: AgentCall = async ({ role, system }) =>
      role === 'documentFamily' ? 'family: b' : role === 'pageDirector' ? `layout: b${/density:/.test(system) ? '\ndensity: x\ntension: y\nimage: TOP_BAND' : ''}` : 'ok';
    const low = await planDocumentDesign({ level: 'low', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    // Le contrat a changé avec l'espace de configuration : à Low ce n'est plus « la graine seule »,
    // c'est LE CODE qui choisit une mise en page par page — toujours sans un appel de modèle.
    check('Low : le code choisit la mise en page de chaque page, sans un appel, sans famille d’agent ni composition libre',
      Object.keys(low.pages).length === pages.length && pages.every((p) => !!low.pages[p.name]?.preset) && !low.family && !low.freeCompose && low.traces.every((t) => t.source === 'graph'),
      pages.map((p) => low.pages[p.name]?.preset).join(' '));
    const medium = await planDocumentDesign({ level: 'medium', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    check('Medium : la famille vient de l’agent, les mises en page du code (variété tirée)',
      !!medium.family && pages.every((p) => !!medium.pages[p.name]?.preset) && new Set(pages.map((p) => medium.pages[p.name]!.preset)).size === pages.length,
      String(medium.family));
    const high = await planDocumentDesign({ level: 'high', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    const arch = pages.map((p) => high.pages[p.name]?.archetype || (seedArchetypes as any)[p.name]);
    check('High : chaque page dirigée, jamais deux voisines au même archétype', Object.keys(high.pages).length === pages.length && arch.every((a, i) => i === 0 || a !== arch[i - 1]), arch.join(','));
    const max = await planDocumentDesign({ level: 'max', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    check('Max : place de l’image réglée, valeurs hors menu refusées (densité, tension)', Object.values(max.pages).every((p) => p.imagePosition === 'TOP_BAND' && !p.contentDensity && !p.layoutTension));
    const ultra = await planDocumentDesign({ level: 'ultra', call, sheet: 'BRAND', styleId: 'editorial', document: 'pitch deck', pages, seedArchetypes });
    check('Ultra : pages confiées au compositeur (gabarit dirigé en repli)', ultra.freeCompose && ultra.composeAttempts === 3);
    // ── LES CONTRÔLES DIMINUENT QUAND LE CRAN MONTE ──────────────────────────
    check('contrôles : complets à Low/Medium, PLANCHER au-dessus, mesure sans refus à Ultra',
      delegationOf('low').checks === 'full' && delegationOf('medium').checks === 'full' &&
        delegationOf('high').checks === 'floor' && delegationOf('max').checks === 'floor' && delegationOf('ultra').checks === 'floor' &&
        !delegationOf('max').repairOnly && delegationOf('ultra').repairOnly);
    // ── LA DÉLÉGATION MONTE AVEC LE CRAN ─────────────────────────────────────
    check('délégation : le menu s’élargit et le compositeur entre à Max (0 → 0 → 10 → 14+2 essais → 16+3)',
      delegationOf('low').menuWidth === 0 && delegationOf('medium').attempts === 0 && delegationOf('high').menuWidth === 10 && !delegationOf('high').attempts &&
        delegationOf('max').attempts === 2 && delegationOf('ultra').attempts === 3 &&
        delegationOf('low').spread < delegationOf('medium').spread && delegationOf('medium').spread < delegationOf('high').spread &&
        delegationOf('high').spread < delegationOf('max').spread && delegationOf('max').spread < delegationOf('ultra').spread,
      `max ${max.composeAttempts} essai(s)`);
    check('Max : les pages passent aussi au compositeur (deux essais)', max.freeCompose && max.composeAttempts === 2);
    // ── TROIS PROJETS, TROIS DOCUMENTS ───────────────────────────────────────
    //
    // Le classement ne dépendait que du NUMÉRO de page : trois chartes de même style recevaient
    // les mêmes pages. C'est le défaut qui rendait les livrables jumeaux, et il se mesure.
    const plansByProject = await Promise.all(
      ['branding:p-alpha', 'branding:p-beta', 'branding:p-gamma'].map((docKey) =>
        planDocumentDesign({ level: 'medium', call, sheet: 'BRAND', styleId: 'editorial', document: 'brand guidelines book', deliverable: 'brand guidelines', docKey, pages, seedArchetypes })
      )
    );
    const signatures = plansByProject.map((plan) => pages.map((p) => plan.pages[p.name]?.preset).join('|'));
    check('trois projets du même style → trois suites de mises en page différentes', new Set(signatures).size === 3, signatures.map((sig) => sig.slice(0, 60)).join('\n      '));
    const highByProject = await Promise.all(
      ['bp:p-alpha', 'bp:p-beta'].map((docKey) => planDocumentDesign({ level: 'high', call, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', deliverable: 'business plan', docKey, pages, seedArchetypes }))
    );
    check('deux projets au cran High → menus distincts, donc pages distinctes',
      pages.map((p) => highByProject[0].pages[p.name]?.preset).join('|') !== pages.map((p) => highByProject[1].pages[p.name]?.preset).join('|'));
    const broken = await planDocumentDesign({ level: 'max', call: async () => 'layout: hologram\nfamily: z', sheet: 'BRAND', styleId: 'editorial', document: 'business plan', pages, seedArchetypes });
    check('réponses inventées : le choix du CODE garde la main (aucune famille, aucune mise en page inventée)',
      !broken.family && pages.every((p) => !!PRESET_BY_ID.get(broken.pages[p.name]?.preset || '')),
      pages.map((p) => broken.pages[p.name]?.preset).join(' '));
    // Reprise / régénération ciblée : la direction enregistrée est reprise, sans agent.
    const saved = savedDesignOf(high);
    const resumed = resumedDesignPlan(saved, 'medium');
    check('enregistrée : décisions seules (cran, famille, pages), pas de traces', !('traces' in saved) && saved.level === 'high' && JSON.stringify(saved.pages) === JSON.stringify(high.pages));
    check('reprise : même famille et mêmes pages, aucun appel, compositeur selon le cran demandé', resumed.family === high.family && JSON.stringify(resumed.pages) === JSON.stringify(high.pages) && resumed.traces.length === 0 && !resumed.freeCompose && resumedDesignPlan(saved, 'ultra').freeCompose && resumedDesignPlan(saved, 'ultra').composeAttempts === 3);
    check('reprise d’un document sans direction : la graine (aucune page dirigée)', Object.keys(resumedDesignPlan(undefined, 'max').pages).length === 0 && !resumedDesignPlan(undefined, 'max').family);

    const content = { title: 'Analyse du marché', lede: 'Le marché ivoirien du jus naturel croît de 12 % par an.', blocks: [{ type: 'prose', text: 'Les ménages urbains achètent de plus en plus de boissons locales sans sucre ajouté.' } as any, { type: 'metrics', items: [{ label: 'Croissance annuelle', value: '12 %' }] } as any] };
    const good = '```html\n<section style="width:210mm"><h2>Analyse du marché</h2><p>Le marché ivoirien du jus naturel croît de 12 % par an.</p><p>Les ménages urbains achètent de plus en plus de boissons locales sans sucre ajouté.</p><div>Croissance annuelle <b>12 %</b></div>' + '<div style="height:10px"></div>'.repeat(10) + '</section>\n```';
    check('compositeur : une page fidèle au contenu est acceptée', !!acceptComposedPage(good, content as any));
    // ── AU-DESSUS DE MEDIUM, SEULS LA SÉCURITÉ ET LE VIDE CONDAMNENT UNE PAGE ─
    //
    // C'est le cœur du cran : un contrôle de chaîne qui refuse la page la renvoie au gabarit, donc
    // le cran le plus cher rendrait le cran Medium. Les écarts de fidélité et de charte restent
    // DÉTECTÉS (ils repartent en conseil au compositeur), ils ne coûtent plus sa page à l'IA.
    const strayNumber = good.replace('</section>', '<p>Part de marché visée : 35 %</p></section>');
    const strayHtml = extractComposedHtml(strayNumber)!;
    const full = fidelityCheck(strayHtml, content as any, 'full');
    const floor = fidelityCheck(strayHtml, content as any, 'floor');
    // Un CHIFFRE inventé est la seule faute de fidélité qui bloque à tous les crans : un plan qui
    // pose un chiffre absent du contenu est une faute que le client voit.
    check('contrôle de chaîne : un chiffre inventé bloque à TOUS les crans',
      full.blocking.some((i) => /remove these numbers/.test(i)) && floor.blocking.some((i) => /remove these numbers/.test(i)),
      `complet ${full.blocking.length} · plancher ${floor.blocking.length}`);
    // Un texte coupé par une incise, en revanche, ne coûte plus sa page au compositeur.
    const incised = extractComposedHtml(good.replace('Les ménages urbains achètent de plus en plus de boissons locales sans sucre ajouté.', 'Les ménages urbains — dit-on — achètent de plus en plus de boissons locales.'))!;
    check('contrôle de chaîne : une phrase remaniée bloque au complet, conseille au plancher',
      fidelityCheck(incised, content as any, 'full').blocking.length > 0 && !fidelityCheck(incised, content as any, 'floor').blocking.length,
      fidelityCheck(incised, content as any, 'floor').advisory.join(' | '));
    const scripted = extractComposedHtml(good.replace('</section>', '<script>alert(1)</script></section>'))!;
    check('contrôle de chaîne : la sécurité bloque à TOUS les crans', fidelityCheck(scripted, content as any, 'floor').blocking.some((i) => /script/.test(i)));
    const emptyPage = '<section style="width:210mm"><h2>Analyse du marché</h2></section>';
    check('contrôle de chaîne : une page vide bloque à tous les crans (standard « aucune page vide »)',
      fidelityCheck(emptyPage, content as any, 'floor').blocking.some((i) => /almost empty|content was ignored/.test(i)),
      fidelityCheck(emptyPage, content as any, 'floor').blocking.join(' | '));
    const leftover = extractComposedHtml(good.replace('</section>', '<p>{{IMG_7}} {{CHART_3}}</p></section>'))!;
    check('repères oubliés : nettoyés par le code, jamais imprimés en clair', !/\{\{(IMG|CHART)_\d+\}\}/.test(cleanComposedLeftovers(leftover)));
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

    // La charte d'un document, pour les graphiques et le kit (mêmes couleurs qu'une page réelle).
    const dsUltra = buildDocumentDesignSystem(
      { colors: { colors: { primary: '#1F6F43', secondary: '#20303A', accent: '#E4A93C', background: '#FFFFFF', text: '#131A17' } }, typography: { primaryFont: 'Archivo', secondaryFont: 'Inter' } } as any,
      { styleId: 'editorial' } as any,
      buildDocumentSeed('editorial', 'check:kit')
    );
    const seedUltra = buildSectionSeed('editorial', 'check:kit', 'Projections', new Set());

    // Les GRAPHIQUES : le compositeur les place, le CODE les dessine (canvas Chart.js + repli
    // dessiné par le serveur). Un graphique redessiné à la main perd ses proportions, et ses
    // chiffres n'ont pas à être réécrits dans la page.
    const charted = {
      title: 'Projections',
      blocks: [
        { kind: 'prose', text: "Le chiffre d'affaires suit la montée en charge de la collecte sur les trois premiers exercices." } as any,
        { kind: 'chart', chartType: 'bar', labels: ['2026', '2027', '2028'], series: [{ name: "Chiffre d'affaires", data: [48, 126, 240] }], readingKey: "Le chiffre d'affaires triple en deux ans", unit: 'MFCFA' } as any,
      ],
    };
    const chartPage = (slot: string) =>
      '```html\n<section style="width:210mm"><h2>Projections</h2><p>Le chiffre d\'affaires suit la montée en charge de la collecte sur les trois premiers exercices.</p>' + slot + '<div style="height:10px"></div>'.repeat(10) + '</section>\n```';
    check('compositeur : le repère du graphique posé une fois → acceptée', !!acceptComposedPage(chartPage('<div style="width:100%">{{CHART_1}}</div>'), charted as any));
    check('compositeur : graphique oublié → refusée', !acceptComposedPage(chartPage(''), charted as any));
    check('compositeur : graphique posé deux fois → refusée', !acceptComposedPage(chartPage('{{CHART_1}}{{CHART_1}}'), charted as any));
    check('compositeur : un <canvas> dessiné à la main → refusée', !acceptComposedPage(chartPage('{{CHART_1}}<canvas id="c"></canvas>'), charted as any));
    const chartPrompt = buildComposerPrompt({ content: charted as any, ds: dsUltra, seed: seedUltra, page: PORTRAIT_A4, sheet: 'BRAND', document: 'business plan' });
    check('compositeur : le prompt décrit le graphique et interdit de le redessiner', /\{\{CHART_1\}\}/.test(chartPrompt.system) && /NEVER redraw a chart/.test(chartPrompt.system) && /bar, 3 entries/.test(chartPrompt.system));
    const drawnChart = renderStandaloneChart(charted.blocks[1] as any, dsUltra, seedUltra, { page: PORTRAIT_A4, multiPage: true });
    check('graphique dessiné par le code : canvas Chart.js + repli serveur, aux couleurs du document', /data-idem-chart=/.test(drawnChart) && /data-chart-fallback/.test(drawnChart) && drawnChart.includes('2028'));

    // Le KIT GRAPHIQUE dans une page : l'agent NOMME la forme, le code la dessine, en millimètres.
    const gfx = pageGfx({
      width: PORTRAIT_A4.width,
      height: PORTRAIT_A4.minHeight,
      tokens: { primary: dsUltra.colors.primary, secondary: dsUltra.colors.secondary, accent: dsUltra.colors.accent, ink: dsUltra.colors.ink, surface: dsUltra.colors.surface },
      surface: dsUltra.colors.surface,
      ink: dsUltra.colors.ink,
      primary: dsUltra.colors.primary,
      secondary: dsUltra.colors.secondary,
    });
    const named = '<x-gfx kind="contours" x="0" y="200mm" w="210mm" h="97mm" color="primary" opacity="0.1"></x-gfx>';
    const expanded = gfx.expand(`<section>${named}<p>Texte</p></section>`);
    check(`kit de page : une forme nommée (${named.length} signes) dessinée en mm (${expanded.html.length} signes), sans CSS extérieur`, !expanded.issues.length && expanded.count === 1 && /position:absolute/.test(expanded.html) && /y="200mm"|top:200mm/.test(expanded.html) && /<svg/.test(expanded.html));
    check('kit de page : forme inconnue, boîte manquante, trop de formes → renvoyées au compositeur',
      gfx.expand('<x-gfx kind="sparkles" x="0" y="0" w="10mm" h="10mm"></x-gfx>').issues.some((i) => /unknown kind/.test(i)) &&
      gfx.expand('<x-gfx kind="waves" x="0" y="0"></x-gfx>').issues.some((i) => /needs x, y, w and h/.test(i)) &&
      gfx.expand(Array.from({ length: 6 }, (_, i) => `<x-gfx kind="waves" x="0" y="${i}mm" w="50mm" h="20mm"></x-gfx>`).join('')).issues.some((i) => /too many graphics/.test(i)));
    check('kit de page : le manifeste reste court et interdit le SVG écrit à la main', pageKitManifest({ page: { width: PORTRAIT_A4.width, height: PORTRAIT_A4.minHeight } }).join('\n').length < 1400);

    // LES MOTIFS DE LA MARQUE : des tuiles SVG déposées, employées partout où un motif est demandé.
    const tiles = BRAND_PATTERN_KINDS.map((kind) => ({ kind, svg: brandPatternSvg({ kind, ink: '#1F6F43', ground: '#FFFFFF', tile: 48 }) }));
    check(`${tiles.length} motifs de marque : tuiles SVG autonomes, légères et déterministes`,
      tiles.every((t) => /^<svg [^>]*width="48"/.test(t.svg) && t.svg.endsWith('</svg>') && t.svg.length < 1200) &&
      new Set(tiles.map((t) => t.svg)).size === tiles.length &&
      tiles.every((t) => t.svg === brandPatternSvg({ kind: t.kind, ink: '#1F6F43', ground: '#FFFFFF', tile: 48 })),
      tiles.map((t) => `${t.kind}:${t.svg.length}`).join(' '));
    // La tuile s'emploie en fond RÉPÉTÉ, et jamais avec un guillemet double (elle finit dans style="…").
    const css = brandPatternCss('https://cdn.example.com/p.svg', 48);
    check('motif employé en fond répété, sans guillemet double (il refermerait l’attribut style)',
      css['background-repeat'] === 'repeat' && css['background-size'] === '48px 48px' && !css['background-image'].includes('"'));
    const plans = planBrandPatterns({ repertoire: ['grid', 'stripes', 'checker', 'dots'], primary: '#1F6F43', accent: '#E4A93C', surface: '#FFFFFF', subtle: '#F4F6F5' });
    check('quatre motifs par marque : principal, secondaire, trame fine, inversé (le dernier sur fond de marque)',
      plans.length === 4 && plans[3].ground === '#1F6F43' && plans[2].tile === 32 && plans.every((p) => p.label && p.role));

    // LE DÉCOR D'UNE PAGE : seulement là où la page respire, et c'est le motif de la marque d'abord.
    check('décor : une page dense (tableau, graphique, spécimen) n’en reçoit jamais',
      !pageBreathes({ kinds: ['prose', 'table'], textLength: 200 }) && !pageBreathes({ kinds: ['chart'], textLength: 50 }) && !pageBreathes({ kinds: ['typeSpecimen'], textLength: 0 }));
    check('décor : une citation ou une page courte respire, une page de texte long non',
      pageBreathes({ kinds: ['quote'], textLength: 2000 }) && pageBreathes({ kinds: ['prose'], textLength: 400 }) && !pageBreathes({ kinds: ['prose'], textLength: 1800 }));
    const withBrand = rankPageDecors({ styleId: 'editorial', docKey: 'bp', pageName: 'Promesse', hasBrandPattern: true });
    const without = rankPageDecors({ styleId: 'editorial', docKey: 'bp', pageName: 'Promesse' });
    check('décor : le motif de la marque passe devant une forme inventée, et disparaît du menu sans lui',
      !!PAGE_DECOR_BY_ID.get(withBrand[0].id)?.pattern && without.every((d) => !PAGE_DECOR_BY_ID.get(d.id)?.pattern),
      `${withBrand[0].id} / ${without[0].id}`);
    // L'ESPACE DE CONFIGURATION DES MISES EN PAGE : 60 familles × 18 architectures, nommées,
    // filtrées par livrable, et extensibles par une ligne de table.
    const coverage = presetCoverage();
    check(`espace des mises en page : ${Object.entries(coverage).map(([k, v]) => `${k} ${v}`).join(', ')} (≥ 100 par livrable)`,
      Object.values(coverage).every((n) => n >= 100), JSON.stringify(coverage));
    const famIds = new Set(LAYOUT_FAMILIES.map((f) => f.id));
    const brokenPresets = LAYOUT_PRESETS.filter((p) => !famIds.has(p.family) || !ARCHETYPE_CATALOG[p.archetype]);
    check(`${LAYOUT_PRESETS.length} mises en page déclarées, toutes rendables (famille et architecture réelles)`, !brokenPresets.length, brokenPresets.slice(0, 3).map((p) => p.id).join(' · '));
    const seedBase = { family: 'revue', archetype: 'A', layoutTension: 'calm', contentDensity: 'airy' };
    const applied = applyPreset(seedBase, PRESET_BY_ID.get('bp.grand-livre.L'));
    check('une mise en page appliquée change la grammaire ET l’architecture de la page', applied.family === 'grand-livre' && applied.archetype === 'L' && applyPreset(seedBase, undefined).family === 'revue');
    // La variété est tenue par le code : neuf pages d'affilée ne se répètent pas.
    const used: string[] = [];
    for (let i = 0; i < 9; i++) used.push(rankPresets({ deliverable: 'business plan', styleId: 'editorial', seed: 7, used })[0].id);
    check(`neuf pages : ${new Set(used.map((u) => PRESET_BY_ID.get(u)!.family)).size} grammaires et ${new Set(used.map((u) => PRESET_BY_ID.get(u)!.archetype)).size} architectures distinctes`,
      new Set(used).size === 9 && new Set(used.map((u) => PRESET_BY_ID.get(u)!.family)).size >= 6);

    // LA DÉLÉGATION PROGRESSIVE : le code décide seul en bas, l'agent choisit dans un menu en haut.
    const delegPages = ['Résumé', 'Marché', 'Offre', 'Modèle', 'Équipe', 'Finances'].map((name) => ({ name }));
    const delegSeeds = Object.fromEntries(delegPages.map((p, i) => [p.name, 'ABCDEF'[i % 6]]));
    const levels: { level: string; calls: number; families: number; distinct: number }[] = [];
    for (const level of ['low', 'medium', 'high', 'max'] as const) {
      let calls = 0;
      const plan = await planDocumentDesign({
        level, sheet: 'BRAND', styleId: 'editorial', document: 'business plan', deliverable: 'business plan', pages: delegPages, seedArchetypes: delegSeeds,
        call: async () => { calls++; return 'layout: b\ndecor: a\ndensity: dense\ntension: calm\nimage: none'; },
      });
      const ids = delegPages.map((p) => plan.pages[p.name]?.preset || '');
      levels.push({ level, calls, families: new Set(ids.map((i) => PRESET_BY_ID.get(i)?.family)).size, distinct: new Set(ids).size });
    }
    check(`délégation progressive : ${levels.map((l) => `${l.level} ${l.calls} appel(s)`).join(', ')}`,
      levels[0].calls === 0 && levels[1].calls >= 1 && levels[2].calls > levels[1].calls && levels[3].calls >= levels[2].calls);
    check(`six pages, à chaque cran : ${levels.map((l) => `${l.families} grammaires`).join(', ')} — jamais deux pages identiques`,
      levels.every((l) => l.families >= 4 && l.distinct === 6), JSON.stringify(levels));

    // LES MOTIFS : seulement ceux de la charte, et l'opacité d'un fond est tenue par le code.
    check('motif en fond : l’opacité est bornée par le barème, jamais choisie par l’appelant',
      PATTERN_OPACITY.whisper <= 0.08 && PATTERN_OPACITY.quiet <= 0.15 && PATTERN_OPACITY.present <= 0.25 && PATTERN_OPACITY.whisper < PATTERN_OPACITY.present);
    const withBrandMotif = rankPageDecors({ styleId: 'editorial', docKey: 'bp', pageName: 'P', hasBrandPattern: true });
    check('document : une marque qui a ses motifs n’en voit aucun autre',
      withBrandMotif.every((d) => !!PAGE_DECOR_BY_ID.get(d.id)?.pattern || d.id === 'none'),
      withBrandMotif.map((d) => d.id).join(' '));

    // LE KIT DE COMPOSANTS : l'agent nomme un bloc et donne ses données, le code le dessine.
    const uiT = uiTokensOf(dsUltra as never);
    const UI_DATA: Record<string, any> = {
      'ui.comparison-matrix': { columns: ['Nous', 'Import'], criteria: ['Prix', 'Délai'], rows: [['yes', 'no'], ['48 h', '3 semaines']] },
      'ui.process-steps': { steps: ['Collecte', 'Tri', 'Granulation'], notes: ['420 partenaires', 'Sept flux', 'Certifié'] },
      'ui.risk-matrix': { risks: [['Approvisionnement', 'high', 'high'], ['Change', 'medium', 'high']] },
      'ui.swot': { strengths: ['Réseau'], weaknesses: ['Capacité'], opportunities: ['Réglementation'], threats: ['Import'] },
      'ui.funnel': { stages: [['Contactés', '240'], ['Audités', '86'], ['Signés', '12']] },
      'ui.persona': { name: 'Awa Ndiaye, directrice achats', profile: 'Brasseur régional', needs: ['Matière certifiée'], blockers: ['Qualité irrégulière'] },
      'ui.business-model': { streams: [['Granulés', 'Industriels', '68 %'], ['Collecte', 'Collectivités', '22 %']] },
    };
    const uiDrawn = UI_COMPONENTS.map((c) => ({ c, res: renderUi(c.id, UI_DATA[c.id], uiT), json: JSON.stringify(UI_DATA[c.id]) }));
    const uiBad = uiDrawn.filter((d) => !d.res.html).map((d) => `${d.c.id}: ${d.res.error}`);
    // Les jetons du document, et EUX SEULS : une matrice de risques n'emploie que des voiles de la
    // couleur de marque (c'est voulu), mais aucune couleur ne doit venir d'ailleurs.
    const tokenColors = Object.values(dsUltra.colors).filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase());
    const ramp = Object.values(dsUltra.colors.brand || {}).concat(Object.values(dsUltra.colors.neutral || {})).map((v) => String(v).toLowerCase());
    const foreign = uiDrawn.flatMap((d) => [...(d.res.html || '').matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase()).filter((hex) => !tokenColors.includes(hex) && !ramp.includes(hex)).map((hex) => `${d.c.id}:${hex}`));
    check(`${UI_COMPONENTS.length} composants documentaires dessinés par le code, styles en ligne, sans le défaut d'unité`,
      !uiBad.length && uiDrawn.every((d) => /style="/.test(d.res.html!) && !/line-height:[\d.]+px/.test(d.res.html!) && !/font-weight:\d+px/.test(d.res.html!)) && uiDrawn.some((d) => d.res.html!.includes(dsUltra.colors.primary)),
      [...uiBad, ...foreign.slice(0, 3)].join(' · '));
    const ratios = uiDrawn.map((d) => Math.round(d.res.html!.length / d.json.length));
    check(`économie : des données (${Math.min(...uiDrawn.map((d) => d.json.length))}–${Math.max(...uiDrawn.map((d) => d.json.length))} signes) contre du HTML dessiné (÷${Math.min(...ratios)} à ÷${Math.max(...ratios)})`, Math.min(...ratios) >= 5);
    const refusals = [
      renderUi('ui.comparison-matrix', { columns: ['Nous'], criteria: ['A'], rows: [['yes']] }, uiT),
      renderUi('ui.funnel', { stages: [['Seul', '1']] }, uiT),
      renderUi('ui.swot', { strengths: ['x'], weaknesses: [], opportunities: ['y'], threats: ['z'] }, uiT),
      renderUi('ui.nope', {}, uiT),
    ];
    check('composant : une donnée qui manque revient en une phrase corrigeable, jamais en bloc à moitié rempli',
      refusals.every((r) => r.html === null && !!r.error && /needs at least|is required|unknown component/.test(r.error)),
      refusals.map((r) => r.error).join(' · '));
    const uiMacro = expandUiMacros(`<section><x-ui kind="swot" data='${JSON.stringify(UI_DATA['ui.swot'])}'></x-ui></section>`, uiT);
    const uiTooMany = expandUiMacros(Array.from({ length: 5 }, () => `<x-ui kind="funnel" data='${JSON.stringify(UI_DATA['ui.funnel'])}'></x-ui>`).join(''), uiT, { max: 3 });
    const uiBadJson = expandUiMacros(`<x-ui kind="swot" data='{oops'></x-ui>`, uiT);
    check('balise <x-ui> : dessinée dans la page ; trop de blocs ou JSON cassé renvoyés à l’agent',
      !uiMacro.issues.length && uiMacro.count === 1 && !/x-ui/.test(uiMacro.html) && uiTooMany.issues.some((i) => /too many rich blocks/.test(i)) && uiBadJson.issues.some((i) => /not valid JSON/.test(i)));
    check(`menu filtré par livrable (business plan ${uiMenu('business plan').length}, pitch deck ${uiMenu('pitch deck').length}, charte ${uiMenu('brand guidelines').length}) et manifeste court`,
      uiMenu('business plan').length >= 6 && uiMenu('pitch deck').length >= 5 && uiManifest('business plan', 'macro').join('\n').length < 2600);

    // LES SCHÉMAS : l'agent écrit une ligne de texte, Mermaid les dessine aux couleurs du document.
    // C'est le meilleur marché du moteur : un schéma coûte ~80 signes au lieu de 10 Ko de SVG.
    const diagPalette = {
      primary: dsUltra.colors.primary, secondary: dsUltra.colors.secondary, accent: dsUltra.colors.accent,
      surface: dsUltra.colors.surface, surfaceRaised: dsUltra.colors.surfaceRaised, ink: dsUltra.colors.ink,
      inkMuted: dsUltra.colors.inkMuted, rule: dsUltra.colors.rule, brand: dsUltra.colors.brand,
      fontFamily: `'${dsUltra.fonts.body}', system-ui, sans-serif`, fontSizePx: dsUltra.typeScale.sm,
    };
    const theme = brandMermaidTheme(diagPalette);
    check('thème des schémas : aucune couleur hors charte (ni le noir ni l’ocre du thème par défaut)',
      Object.entries(theme).filter(([k]) => /Color|Fill|Bkg|^cScale|^pie\d|lineColor/.test(k)).every(([, v]) => /^#[0-9a-f]{6}$/i.test(String(v))) &&
      !Object.values(theme).includes('#000000') && theme.cScale0 === dsUltra.colors.primary,
      `${Object.keys(theme).length} variables`);
    check('schémas : seules les familles thémées passent', diagramKindOf('flowchart LR\n A-->B') === 'flowchart' && diagramKindOf('gantt\n title X') === null && DIAGRAM_KINDS.every((k) => !!DIAGRAM_GUIDE[k]));
    if (mermaidBundle()) {
      const drawn = await renderDiagrams(
        [
          { id: 'flow', source: 'flowchart LR\n  A[Collecte] --> B[Tri] --> C[Granulés]' },
          { id: 'quadrant', source: 'quadrantChart\n  title Positionnement\n  x-axis Bas --> Haut\n  y-axis Faible --> Elevee\n  Nous: [0.3, 0.8]' },
          { id: 'nope', source: 'gantt\n  title Interdit' },
          { id: 'cassé', source: 'flowchart LR\n  A[[[' },
        ],
        diagPalette,
        flyerRenderService.withPage.bind(flyerRenderService)
      );
      const byId = Object.fromEntries(drawn.map((d) => [d.id, d]));
      check(`schémas dessinés par Mermaid aux couleurs du document (flux ${byId.flow.svg?.length ?? 0} o, quadrant ${byId.quadrant.svg?.length ?? 0} o)`,
        !!byId.flow.svg && !!byId.quadrant.svg && byId.flow.svg!.includes(dsUltra.colors.primary) && /width:100%/.test(byId.flow.svg!) && !/<script|\son[a-z]+=/i.test(byId.flow.svg!),
        [byId.flow.error, byId.quadrant.error].filter(Boolean).join(' · '));
      check('schémas : famille refusée et source cassée ne cassent pas la page (repli à l’appelant)', byId.nope.svg === null && !!byId.nope.error && byId.cassé.svg === null && !!byId.cassé.error, `${byId.nope.error} · ${byId.cassé.error}`);
      const src = 'flowchart LR\n  A[Collecte] --> B[Tri] --> C[Granulés]';
      check(`économie : ${src.length} signes écrits par l’agent contre ${byId.flow.svg!.length} o dessinés (÷${Math.round(byId.flow.svg!.length / src.length)})`, byId.flow.svg!.length > src.length * 40);
    } else {
      check('schémas : paquet Mermaid absent (npm run build:mermaid) — contrôle ignoré', true);
    }

    check('décor : « éviter les motifs » et « éviter les formes » écartent les décors concernés',
      !rankPageDecors({ styleId: 'bohemian', donts: ['no patterns or textures'], docKey: 'bp', pageName: 'P', hasBrandPattern: true }).some((d) => d.id === 'edge-band') &&
      !rankPageDecors({ styleId: 'editorial', donts: ['no decorative shapes'], docKey: 'bp', pageName: 'P', hasBrandPattern: true }).some((d) => d.id === 'corner-rings'));
  }

  if (run(9)) {
    section('9. Documents — cran Ultra : rendu mesuré, réparation, repli (Chromium)');
    const charter = { colors: { colors: { primary: '#1F6F43', secondary: '#F2C14E', accent: '#E07A2E', background: '#FFFFFF', text: '#1A1A1A' } }, typography: { primaryFont: 'Archivo', secondaryFont: 'Inter' } } as any;
    const ds = buildDocumentDesignSystem(charter, { styleId: 'editorial' } as any, buildDocumentSeed('editorial', 'check:ultra'));
    const seed = buildSectionSeed('editorial', 'check:ultra', 'Market', new Set());
    const content = { title: 'Le marché du jus local', lede: 'Les ménages urbains achètent de plus en plus de boissons locales.', blocks: [{ kind: 'prose', text: 'La demande de jus naturels progresse dans les grandes villes du pays.' } as any] };
    const fits = `<section style="width:${LANDSCAPE_SLIDE.width};height:${LANDSCAPE_SLIDE.minHeight};padding:${LANDSCAPE_SLIDE.padding};position:relative;overflow:hidden;box-sizing:border-box;background:#FFFFFF"><h2 style="font-size:40px;color:#1A1A1A">Le marché du jus local</h2><p style="font-size:18px;color:#1A1A1A">Les ménages urbains achètent de plus en plus de boissons locales.</p><p style="font-size:16px;color:#1A1A1A">La demande de jus naturels progresse dans les grandes villes du pays.</p></section>`;
    // Une page légèrement trop haute (rattrapable à l'échelle) et une irrattrapable. La hauteur
    // mesurée est celle du dernier élément qui porte de la MATIÈRE (texte, image) : un cale vide
    // ne déborde pas, il déplace le texte — d'où un cale calibré pour faire sortir le texte.
    const tooTall = fits.replace('<h2', '<div style="height:520px"></div><h2');
    const tiny = fits.replace('font-size:16px', 'font-size:7px');
    const pale = fits.replace('font-size:18px;color:#1A1A1A', 'font-size:18px;color:#D8D8D8');
    const opts = { page: LANDSCAPE_SLIDE, singlePage: true, fonts: { display: 'Archivo', body: 'Inter' } };
    const ok = await inspectComposedPage(fits, opts);
    check('mesure : une page qui tient est livrable', ok.issues.length === 0, ok.issues.join(' ; '));
    // ── RÉPARER, PAS REFUSER ─────────────────────────────────────────────────
    // Les trois défauts qui refusaient la moitié des pages Ultra ont une réponse déterministe :
    // le code la pose et ne rend la main au gabarit que sur l'irréparable.
    const tall = await inspectComposedPage(tooTall, opts);
    check('mesure : une page un peu trop haute → ramenée à l’échelle, pas refusée',
      tall.issues.length === 0 && tall.repaired.some((r) => /échelle/.test(r)) && /zoom/.test(tall.html),
      `${tall.repaired.join(' ; ')} | ${tall.issues.join(' ; ')}`);
    const wayTooTall = fits.replace('<h2', '<div style="height:4000px"></div><h2');
    const hopeless = await inspectComposedPage(wayTooTall, opts);
    check('mesure : une page irrattrapablement trop haute → refusée', hopeless.issues.some((i) => /past its|below the bottom/.test(i)), hopeless.issues.join(' ; '));
    const small = await inspectComposedPage(tiny, opts);
    check('mesure : un corps sous 7 pt → remonté par le code', small.issues.length === 0 && small.repaired.some((r) => /7 pt/.test(r)), `${small.repaired.join(' ; ')} | ${small.issues.join(' ; ')}`);
    const faint = await inspectComposedPage(pale, { ...opts, inks: [ds.colors.ink, ds.colors.inkMuted] });
    check('mesure : un contraste insuffisant → l’encre de la charte est posée', faint.issues.length === 0 && faint.repaired.some((r) => /contraste/.test(r)) && !faint.html.includes('#D8D8D8'), `${faint.repaired.join(' ; ')} | ${faint.issues.join(' ; ')}`);
    // L'encre posée est celle de la CHARTE, pas la plus contrastée : du noir pur partout sortirait
    // le document de sa charte, et c'est ce qui aplatissait les pages les unes sur les autres.
    const charterInk = await inspectComposedPage(pale, { ...opts, inks: ['#1F6F43'] });
    check('mesure : l’encre posée est celle de la charte (jamais du noir pur par défaut)',
      charterInk.issues.length === 0 && charterInk.repaired.some((r) => r.includes('#1F6F43')) && !charterInk.repaired.some((r) => /#111111|#ffffff/i.test(r)),
      charterInk.repaired.join(' ; '));
    const onGreen = fits.replace('background:#FFFFFF', 'background:#1F6F43');
    const lastResort = await inspectComposedPage(onGreen, { ...opts, inks: ['#1B6A41'] });
    check('mesure : aucune encre de la charte ne tient → le noir ou le blanc, jamais un texte illisible',
      lastResort.issues.length === 0 && lastResort.repaired.some((r) => /#ffffff/i.test(r)),
      lastResort.repaired.join(' ; '));

    // Le compositeur : une réparation avec les constats, puis le gabarit.
    const md = (html: string) => '```html\n' + html.replace('</section>', '<div style="height:4px"></div>'.repeat(30) + '</section>') + '\n```';
    let calls = 0;
    let repairPrompt = '';
    const mdPlain = (html: string) => '```html\n' + html + '\n```';
    const measured = async (): Promise<PageMeasure> => ({ issues: [], advisories: [], html: fits, repaired: [] });
    const repaired = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', attempts: 4,
      call: async ({ user }) => { calls++; if (calls === 2) repairPrompt = user; return calls === 1 ? md(wayTooTall) : mdPlain(fits); } });
    check('compositeur : page refusée par la mesure → réparée au 2e essai', !!repaired.html && calls === 2 && /MUST be fixed/.test(repairPrompt) && /past its|below the bottom/.test(repairPrompt), `${calls} appel(s) · ${repaired.issues?.join(' ; ')}`);
    calls = 0;
    const fallback = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', attempts: 3, call: async () => { calls++; return md(wayTooTall); } });
    check('compositeur : jamais rattrapable → null (le gabarit dirigé rend la page) après ses essais', fallback.html === null && calls === 3, `${calls} appel(s)`);
    // ── LE CRAN DÉCIDE DU NOMBRE D'ESSAIS ────────────────────────────────────
    calls = 0;
    await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', attempts: 2, call: async () => { calls++; return md(wayTooTall); } });
    check('compositeur : Max accorde deux essais, Ultra quatre', calls === 2, `${calls} appel(s)`);
    // Une page JUSTE est gardée : les tours suivants ne peuvent plus la perdre.
    calls = 0;
    const keptBest = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', attempts: 4,
      inspect: async (html) => (calls === 1 ? { issues: [], advisories: ['tighten the left column'], html, repaired: [] } : { issues: ['text outside the page width: "x"'], advisories: [], html, repaired: [] }),
      call: async () => { calls++; return mdPlain(fits); } });
    check('compositeur : la page retenue est la MEILLEURE tentative, pas la dernière', !!keptBest.html && calls === 2, `${calls} appel(s)`);
    // La fidélité n'est plus un couperet : le défaut repart au compositeur, qui corrige.
    calls = 0;
    let fidelityPrompt = '';
    const fixedNumber = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', attempts: 4, inspect: measured,
      call: async ({ user }) => { calls++; if (calls === 2) fidelityPrompt = user; return mdPlain(calls === 1 ? fits.replace('</section>', '<p style="font-size:14px">Part de marché visée : 35 %</p></section>') : fits); } });
    check('compositeur : chiffre inventé → signalé au compositeur et corrigé au 2e tour', !!fixedNumber.html && calls === 2 && /remove these numbers/.test(fidelityPrompt) && /35/.test(fidelityPrompt) && /PREVIOUS PAGE/.test(fidelityPrompt), `${calls} appel(s)`);
    // UNE PAGINATION ET UNE FEUILLE DE STYLE NE SONT PAS DES CHIFFRES INVENTÉS.
    calls = 0;
    const paginated = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', attempts: 2, inspect: measured,
      call: async () => { calls++; return mdPlain(fits.replace('<h2', '<style>.t{font-weight:700;line-height:0.95;opacity:0.03}</style><span class="t">01</span><h2')); } });
    check('compositeur : un numéro de page et les valeurs d’un <style> ne refusent plus la page', !!paginated.html && calls === 1, `${calls} appel(s) · ${paginated.issues?.join(' ; ')}`);
    const down = await composePageHtml({ content: content as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'pitch deck', name: 'Market', call: async () => { throw new Error('quota'); } });
    check('compositeur : modèle en panne → null (le gabarit rend la page)', down.html === null);
    // Les images du contenu partent au modèle sous forme de repères, et reviennent en URL.
    const dataLogo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1F6F43"/></svg>' + ' '.repeat(3000)).toString('base64');
    const withLogo = { ...content, blocks: [...content.blocks, { kind: 'logoDisplay', variants: [{ url: dataLogo, label: 'Sur fond clair', background: 'light' }] } as any] };
    let seenPrompt = '';
    const tokened = await composePageHtml({ content: withLogo as any, ds, seed, page: LANDSCAPE_SLIDE, singlePage: true, sheet: 'BRAND', document: 'brand guidelines book', name: 'Logo', inspect: async (html) => ({ issues: [], advisories: [], html, repaired: [] }),
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
