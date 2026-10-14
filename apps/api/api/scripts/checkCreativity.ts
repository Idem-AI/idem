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
 *  5. Visuels — le moteur graphique (@idem/graphic-engine) suit la jauge : aucun appel à Low et
 *     Medium, le directeur artistique à High, le réglage à Max, l'arbre d'auteur à Ultra ; chaque
 *     visuel rendu et mesuré dans Chromium, sans constat bloquant.
 *  6. Visuels — modèle en panne ou réponse illisible : la composition du code, jamais une erreur.
 *  7. Carte de visite — gabarit partagé : marqueurs, plancher d'impression, et de VRAIES valeurs
 *     (nom composé, longue adresse) qui tiennent dans la carte une fois interpolées.
 *  8. Documents — business plan et deck : la jauge décide qui compose ; Low est déterministe.
 *  9. Documents, cran Ultra — arbre d'auteur retenu et mesuré ; arbre illisible ou modèle en panne :
 *     la composition du code.
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
import puppeteer from 'puppeteer';
import { AgentCall as EngineAgentCall, brandFromIdem, cardFaces, closeBrowser, configureGraphicEngine, createDocument, CreativityLevel, renderSingle, SectionContent, SectionOutput, visualContent } from '@idem/graphic-engine';
import { EMPTY_FIELD_CLEANUP, FIELD_FIT, interpolateBusinessCard } from '../utils/business-card-template';
import { contrastRatio } from '../services/brand/color';
import { brandInitials, composeTemplateLogos, logoMenu, markInks } from '../services/BandIdentity/logoTemplates';
import { logoDirectionsTask, logoDraftCount, logoJuryTask } from '../services/BandIdentity/logoCreative';
import { inspectSvg } from '../services/brand/svgGate';

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

  // ── LE MOTEUR GRAPHIQUE, BRANCHÉ SUR UN MODÈLE SIMULÉ ──────────────────────────────────────
  // Le directeur artistique choisit la 2e composition (et la règle à Max) ; le compositeur d'Ultra rend
  // un arbre minimal ; chaque appel est noté. Aucune vision : la critique n'entre pas dans ces contrôles.
  const engineCalls: string[] = [];
  let agentMode: 'ok' | 'garbage' | 'down' = 'ok';
  const engineAgent = (): EngineAgentCall => async ({ role, system }) => {
    engineCalls.push(role);
    if (agentMode === 'down') throw new Error('quota');
    if (agentMode === 'garbage') return 'je ne sais pas';
    if (role === 'graphic.artDirector') return system.includes('"params"') ? '{"choice": 2, "params": {}, "tension": "calm", "accent": "none"}' : '{"choice": 2, "why": "variété"}';
    if (role === 'graphic.director') return JSON.stringify({ root: { t: 'stack', grow: true, gap: 'lg', justify: 'center', children: [{ t: 'block', ref: 'copy' }] } });
    return '';
  };
  const VERDA = brandFromIdem({
    name: 'Verda Jus',
    branding: { colors: { colors: { primary: '#1F6F43', secondary: '#F2C14E', accent: '#E07A2E', background: '#FFFFFF', text: '#1A1A1A' } }, typography: { primaryFont: 'Archivo', secondaryFont: 'Inter' }, artDirection: { styleId: 'editorial' } },
  });
  const blockingOf = (out: SectionOutput) => out.result.issues.filter((i) => i.severity === 'blocking').map((i) => i.code);
  const llmTasks = (out: SectionOutput): string[] => out.trace.tasks.filter((t) => t.source === 'llm').map((t) => t.task);
  const engineSections = [5, 6, 7, 8, 9].some(run);
  if (engineSections) configureGraphicEngine({ agentCall: engineAgent, analyzeImage: undefined, onTrace: undefined, recentFingerprints: undefined, rememberFingerprints: undefined });

  const FLYER = visualContent({ id: 'flyer', copy: { kicker: 'Nouveau', headline: 'Le jus de bissap pressé chaque matin à Dakar', subhead: 'Livré en 24 h dans tout Dakar.' } }) as SectionContent;
  const flyerAt = (level: CreativityLevel, seed = 'check') =>
    renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: VERDA.brand, direction: VERDA.direction, creativity: level, seed: `${seed}:${level}`, content: FLYER });

  if (run(5)) {
    section('5. Visuels — la jauge pilote le moteur graphique (Chromium)');
    const expected: Record<CreativityLevel, string[]> = { low: [], medium: [], high: ['creative.pick'], max: ['creative.tune'], ultra: ['creative.tune', 'creative.author'] };
    for (const level of CREATIVITY_LEVELS) {
      agentMode = 'ok';
      const out = await flyerAt(level);
      const tasks = llmTasks(out);
      const asked = expected[level];
      check(
        `${level} : ${asked.length ? `appels ${asked.join(' + ')}` : 'aucun appel de modèle'} ; visuel mesuré, sans constat bloquant (${out.spec.pattern.id})`,
        asked.every((t) => tasks.includes(t)) && (asked.length > 0 || tasks.length === 0) && blockingOf(out).length === 0 && Boolean(out.result.measured),
        `appels ${tasks.join(',') || '—'} · bloquants ${blockingOf(out).join(',') || '—'}`
      );
      if (level === 'ultra') check('ultra : l’arbre du compositeur est retenu (motif « authored »)', out.spec.pattern.id === 'authored', out.spec.pattern.id);
    }
    const again = await flyerAt('low');
    check('low : même visuel pour la même graine (déterministe)', again.result.provenance.specHash === (await flyerAt('low')).result.provenance.specHash);
  }

  if (run(6)) {
    section('6. Visuels — modèle en panne ou réponse illisible : la composition du code');
    for (const mode of ['garbage', 'down'] as const) {
      agentMode = mode;
      for (const level of ['high', 'ultra'] as const) {
        const out = await flyerAt(level, `panne-${mode}`);
        const refused = out.trace.tasks.filter((t) => t.task.startsWith('creative.') && t.outcome !== 'accepted');
        check(`${level}, modèle ${mode === 'down' ? 'en panne' : 'illisible'} : visuel livré par le code, sans erreur`, Boolean(out.result.html) && blockingOf(out).length === 0 && refused.length > 0 && out.spec.pattern.id !== 'authored', `${out.spec.pattern.id} · ${refused.map((t) => `${t.task}:${t.outcome}`).join(',')}`);
      }
    }
    agentMode = 'ok';
  }

  if (run(7)) {
    section('7. Carte de visite — gabarit partagé, plancher d’impression, vraies valeurs (Chromium)');
    const LONG = {
      fullName: 'Marie-Christine Ngo Bassa Ndjock',
      jobTitle: 'Directrice administrative et financière',
      email: 'marie-christine.ngobassa@verdajus-dakar.sn',
      phone: '+221 77 123 45 67',
      mobile: '+221 70 987 65 43',
      website: 'www.verdajus-dakar.sn',
      address: 'Rue 12 x Avenue Cheikh Anta Diop, Fann Résidence, Dakar',
      linkedin: 'linkedin.com/in/marie-christine-ngo-bassa',
    };
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      for (const orientation of ['landscape', 'portrait'] as const) {
        for (const project of [1, 2, 3]) {
          const doc = await createDocument({ documentType: 'business-card', format: `card-${orientation}`, brand: VERDA.brand, direction: VERDA.direction, seed: `check:card:${orientation}:${project}`, sections: [{ id: 'front', role: 'card-face' }, { id: 'back', role: 'card-face' }], bindings: 'markers', creativity: 'medium' });
          const faces = cardFaces({ binding: 'markers' });
          for (const face of [faces.front, faces.back]) {
            const out = await doc.composeSection(face, { index: face.id === 'front' ? 1 : 2, total: 2 });
            const label = `${orientation}, projet ${project}, ${face.id === 'front' ? 'recto' : 'verso'} (${out.spec.pattern.id})`;
            const html = `${out.result.head ?? ''}${out.result.html}`;
            const markers = [...html.matchAll(/data-field="(\w+)"[^>]*>\{\{(\w+)\}\}/g)];
            check(`${label} : gabarit à marqueurs, mesuré, sans constat bloquant`, (face.id === 'back' || markers.some((m) => m[1] === 'fullName')) && markers.every((m) => m[1] === m[2]) && blockingOf(out).length === 0, blockingOf(out).join(',') || `${markers.length} marqueur(s)`);
            // Les VRAIES valeurs, plus longues que leurs marqueurs : la carte imprimée doit les tenir.
            const page = await browser.newPage();
            await page.setViewport({ width: orientation === 'landscape' ? 322 : 208, height: orientation === 'landscape' ? 208 : 322 });
            for (const [variant, values] of [['valeurs longues', LONG], ['sans fonction', { ...LONG, jobTitle: '' }]] as const) {
              await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${interpolateBusinessCard(html, values)}<script>${EMPTY_FIELD_CLEANUP}</script></body></html>`, { waitUntil: 'load' });
              await page.evaluate(() => document.fonts.ready);
              await page.evaluate(FIELD_FIT);
              const m = await page.evaluate(() => {
                const card = document.querySelector('.ge-page') as HTMLElement;
                const box = card.getBoundingClientRect();
                const fields = Array.from(card.querySelectorAll('[data-field]')) as HTMLElement[];
                return {
                  outside: fields.filter((f) => { const r = f.getBoundingClientRect(); return r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5 || r.left < box.left - 0.5 || f.scrollWidth > f.clientWidth + 1; }).map((f) => f.dataset.field),
                  overflow: card.scrollHeight > card.clientHeight + 1,
                  // Une face sans champ rempli (un verso au seul logo) n'a pas de corps à contrôler.
                  smallest: fields.length ? Math.min(...fields.map((f) => parseFloat(getComputedStyle(f).fontSize))) : 99,
                  jobTitle: Boolean(card.querySelector('[data-field="jobTitle"]')),
                };
              });
              check(
                `${label}, ${variant} : tout tient dans la carte, corps ≥ 8,5 px (≈ 6,4 pt)${variant === 'sans fonction' ? ', ligne vide retirée' : ''}`,
                m.outside.length === 0 && !m.overflow && m.smallest >= 8.49 && (variant !== 'sans fonction' || !m.jobTitle),
                `hors carte : ${m.outside.join(',') || '—'} · débordement ${m.overflow} · plus petit ${m.smallest}px`
              );
            }
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }

  if (run(8)) {
    section('8. Documents (business plan, pitch deck) — la jauge décide qui compose');
    const PAGES: SectionContent[] = [
      { id: 'company-summary', title: 'Une jus de fruits locaux, pressés chaque matin', lede: 'Verda Jus livre les bureaux de Dakar.', blocks: [{ id: 'p', kind: 'prose', paragraphs: ['Verda Jus presse des fruits achetés aux maraîchers de Sangalkam.', 'Les bureaux du Plateau reçoivent leur commande avant 9 h.'] }, { id: 'm', kind: 'metrics', items: [{ value: '1 200', label: 'Bouteilles par jour' }, { value: '38', label: 'Bureaux clients' }] }] },
      { id: 'market', title: 'Un marché urbain qui consomme hors du foyer', blocks: [{ id: 'c', kind: 'chart', chartType: 'bar', labels: ['2024', '2025', '2026'], series: [{ name: 'Bouteilles (milliers)', data: [120, 210, 340] }], readingKey: 'Les volumes ont presque triplé en deux ans.' }, { id: 'p', kind: 'prose', paragraphs: ['La demande vient des bureaux et des salles de sport du Plateau.'] }] },
      { id: 'team', title: 'Une équipe de quatre personnes', blocks: [{ id: 'k', kind: 'cards', items: [{ title: 'Awa', body: 'Production et qualité.' }, { title: 'Moussa', body: 'Livraisons.' }, { title: 'Fatou', body: 'Ventes aux bureaux.' }] }] },
    ];
    const suite = async (documentType: 'business-plan' | 'pitch-deck', level: CreativityLevel, seed = 'check') => {
      const doc = await createDocument({ documentType, format: documentType === 'business-plan' ? 'a4-portrait' : 'slide-16x9', brand: VERDA.brand, direction: VERDA.direction, creativity: level, seed: `${seed}:${documentType}`, sections: PAGES.map((p) => ({ id: p.id })), validate: false });
      const outs: SectionOutput[] = [];
      for (const [i, page] of PAGES.entries()) outs.push(await doc.composeSection(page, { index: i + 1, total: PAGES.length }));
      return outs;
    };
    for (const documentType of ['business-plan', 'pitch-deck'] as const) {
      engineCalls.length = 0;
      const low = await suite(documentType, 'low');
      const lowAgain = await suite(documentType, 'low');
      check(`${documentType}, low : le code compose chaque page, sans un appel ; même graine ⇒ mêmes pages`, engineCalls.length === 0 && low.map((o) => o.result.provenance.specHash).join() === lowAgain.map((o) => o.result.provenance.specHash).join(), low.map((o) => o.spec.pattern.id).join(' '));
      const medium = await suite(documentType, 'medium');
      check(`${documentType}, medium : aucun appel ; trois pages, au moins deux compositions`, engineCalls.length === 0 && new Set(medium.map((o) => o.spec.pattern.id)).size >= 2, medium.map((o) => o.spec.pattern.id).join(' '));
      const high = await suite(documentType, 'high');
      check(`${documentType}, high : le directeur artistique choisit chaque page`, high.every((o) => llmTasks(o).includes('creative.pick')), high.map((o) => llmTasks(o).join('+') || '—').join(' | '));
    }
  }

  if (run(9)) {
    section('9. Documents, cran Ultra — arbre d’auteur mesuré, repli du code (Chromium)');
    const SLIDE: SectionContent = { id: 'market', kicker: 'Marché', title: 'Les bureaux du Plateau boivent local', blocks: [{ id: 'copy', kind: 'prose', paragraphs: ['Trente-huit bureaux reçoivent déjà leur commande avant 9 h.'] }, { id: 'm', kind: 'metrics', items: [{ value: '38', label: 'Bureaux clients' }, { value: '+70 %', label: 'Croissance annuelle' }] }] };
    const slideAt = async (seed: string) => {
      const doc = await createDocument({ documentType: 'pitch-deck', format: 'slide-16x9', brand: VERDA.brand, direction: VERDA.direction, creativity: 'ultra', seed, sections: [{ id: SLIDE.id }] });
      return doc.composeSection(SLIDE, { index: 2, total: 8 });
    };
    agentMode = 'ok';
    const authored = await slideAt('ultra-ok');
    check('ultra : l’arbre d’auteur est retenu, mesuré dans Chromium, sans constat bloquant', authored.spec.pattern.id === 'authored' && Boolean(authored.result.measured) && blockingOf(authored).length === 0, `${authored.spec.pattern.id} · ${blockingOf(authored).join(',') || 'aucun bloquant'}`);
    const kept = JSON.stringify(authored.spec.root);
    check('ultra : l’arbre porte tous les blocs du contenu (un bloc oublié est rajouté par le code)', kept.includes('"ref":"copy"') && kept.includes('"ref":"m"'));
    agentMode = 'garbage';
    const garbage = await slideAt('ultra-garbage');
    check('ultra, arbre illisible : la composition du code, mesurée', garbage.spec.pattern.id !== 'authored' && blockingOf(garbage).length === 0 && garbage.trace.tasks.some((t) => t.task === 'creative.author' && t.outcome !== 'accepted'), garbage.spec.pattern.id);
    agentMode = 'down';
    const down = await slideAt('ultra-down');
    check('ultra, modèle en panne : la composition du code, sans erreur', down.spec.pattern.id !== 'authored' && Boolean(down.result.html) && blockingOf(down).length === 0, down.spec.pattern.id);
    agentMode = 'ok';
  }

  if (engineSections) {
    configureGraphicEngine({ agentCall: undefined });
    await closeBrowser();
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
  await closeBrowser().catch(() => undefined);
  process.exit(1);
});
