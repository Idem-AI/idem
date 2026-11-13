/**
 * `npm run check:creativity` — la jauge de créativité et son orchestrateur.
 *
 *  1. Prix : Low = Medium = barème, High ×1,25, Ultra ×2 ; un cran inconnu vaut Medium, un ancien « max » vaut High.
 *  2. Orchestrateur : réponses parfaites, lettres, JSON, inventées, vides, en panne, budget
 *     épuisé, tâches au-dessus du cran, meilleur de N départagé par le code.
 *  (La vidéo a son propre contrôle : `npm run check:video`, moteur Motion Canvas.)
 *  5. Visuels — le moteur graphique (@idem/graphic-engine, catalogue seul) : au cran Low le code choisit dans le
 *     catalogue (aucun modèle) ; au-dessus, le modèle du cran choisit et règle la configuration ; textes exacts.
 *  6. Visuels — une réponse du modèle inutilisable ou un modèle en panne : le choix du code est gardé, la page sort.
 *  7. Carte de visite — gabarit partagé : marqueurs, plancher d'impression, et de VRAIES valeurs
 *     (nom composé, longue adresse) qui tiennent dans la carte une fois interpolées.
 *  8. Documents — business plan et deck : le code seul au cran Low ; langage, plan et un choix par page à l'Ultra ;
 *     une retouche de texte rejoue la page sans modèle.
 *  9. Tailwind seul — une page gardée (même écrite avant le catalogue) est assainie : CSS natif et scripts retirés.
 *  10. Identité visuelle : logos composés par le code (Low), directeur de création, jury.
 */
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_QUALITY_MEMORY = '0';
import { CREATIVITY_LEVELS, CREATIVITY_MULTIPLIER, creativityCost, normalizeCreativity, atLeast } from '../models/creativity.model';
import { CreativeOrchestrator, AgentCall } from '../services/creativity/orchestrator';
import { createRunBudget } from '../services/agents/run-budget';
import { pickOption, agentLines } from '../services/creativity/agent-io';
import { BUSINESS_CREDIT_COSTS } from '../models/billing.model';
import puppeteer from 'puppeteer';
import { AgentCall as EngineAgentCall, brandFromIdem, cardFaces, closeBrowser, configureGraphicEngine, createDocument, CreativityLevel, renderSingle, SectionContent, SectionOutput, visualContent } from '@idem/graphic-engine';
import { EMPTY_FIELD_CLEANUP, FIELD_FIT, interpolateBusinessCard } from '../utils/business-card-template';
import { contrastRatio } from '../services/brand/color';
import { brandInitials, composeTemplateLogos, logoMenu, markInks } from '../services/BandIdentity/logoTemplates';
import { logoDirectionsTask, logoDraftCount, logoJuryTask } from '../services/BandIdentity/logoCreative';
import { inspectSvg } from '../services/brand/svgGate';

// L'exploration des idées (Ultra) a son propre contrôle : coupée ici, les appels comptés sont ceux du choix.
process.env.IDEM_QUALITY_EXPLORE = '0';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
/** `--only=8,9,10` : seulement ces sections (les sections 1 à 3, immédiates, tournent toujours). */
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);
const run = (n: number) => !only.length || only.includes(n);


(async () => {
  console.log('Jauge de créativité');

  section('1. Prix et crans');
  const bp = BUSINESS_CREDIT_COSTS.business_plan;
  const costs = CREATIVITY_LEVELS.map((l) => creativityCost(bp, l));
  check('quatre crans : low, medium, high, ultra', CREATIVITY_LEVELS.join(',') === 'low,medium,high,ultra');
  // Le modèle au portefeuille : la jauge choisit le modèle, jamais le prix (Signature +1 000 F
  // remplace l'ancien Ultra ×2, voir `offer.model.ts`).
  check(`business plan (${bp}) : ${costs.join(' / ')} — même prix à tous les crans`, costs.every((c) => c === bp));
  check('vidéo 300 F : 300 / 300 / 300 / 300', CREATIVITY_LEVELS.map((l) => creativityCost(300, l)).join(',') === '300,300,300,300');
  check('multiplicateurs ×1 · ×1 · ×1 · ×1', Object.values(CREATIVITY_MULTIPLIER).join(',') === '1,1,1,1');
  check('cran inconnu, vide ou mal écrit → Medium ; « ULTRA » compris ; ancien « max » → High', normalizeCreativity('extreme') === 'medium' && normalizeCreativity(undefined) === 'medium' && normalizeCreativity(' ULTRA ') === 'ultra' && normalizeCreativity('max') === 'high');
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
  const best = new CreativeOrchestrator({ level: 'high', call: async () => ['layout: c', 'layout: a', 'layout: b'][n++ % 3] });
  const r8 = await best.run<string>({ role: 'artDirector', minLevel: 'high', prompt: () => ({ system: 's', user: 'u' }), parse: (raw: string) => pickOption(agentLines(raw).layout, menu), fallback: () => 'classic', samples: 3, score: (v) => menu.indexOf(v as any) });
  check('meilleur de 3 départagé par le code (High)', r8.value === 'wordStack' && best.traces[0].samples === 3, `${r8.value}`);
  const many = new CreativeOrchestrator({ level: 'high', call: async ({ user }) => `layout: ${user}` });
  const all = await many.all(['a', 'b', 'c', 'a'].map((l, i) => ({ role: 'ad', key: `ad:${i}`, minLevel: 'high' as const, prompt: () => ({ system: 's', user: l }), parse: (raw: string) => pickOption(agentLines(raw).layout, menu) as string | undefined, fallback: () => 'classic' as string })), 2);
  check('tâches parallèles : l’ordre des résultats suit celui des tâches', all.map((r) => r.value).join(',') === 'wordStack,bigNumber,classic,wordStack');

  // ── LE MOTEUR GRAPHIQUE, BRANCHÉ SUR UN MODÈLE SIMULÉ ──────────────────────────────────────
  // Le directeur rend un langage et un plan, le choix dans le catalogue le premier candidat ; chaque appel est noté
  // avec son cran. Modes : `ok`, `garbage` (réponse illisible), `down` (panne).
  const engineCalls: Array<{ role: string; level?: CreativityLevel }> = [];
  let agentMode: 'ok' | 'garbage' | 'down' = 'ok';
  const engineAgent = (): EngineAgentCall => async ({ role, user, level }) => {
    engineCalls.push({ role, level });
    if (agentMode === 'down') throw new Error('quota');
    if (role === 'graphic.director') return /PAGES:/.test(user) ? `IDEA: Big display figures on a calm grid.\n${[...user.matchAll(/^(\d+)\. /gm)].map((m) => `PAGE ${m[1]}: one dominant element, text in a narrow column`).join('\n')}` : 'LANGUAGE:\n- brand-primary for structure, ink for text, generous margins, a 4px brand-primary rule under every title.';
    if (agentMode === 'garbage') return 'je ne sais pas';
    const many = user.match(/(\d+) different picks/);
    return many ? JSON.stringify({ picks: Array.from({ length: Number(many[1]) }, (_, i) => ({ pick: String.fromCharCode(65 + i) })) }) : '{"pick":"A"}';
  };
  const VERDA = brandFromIdem({
    name: 'Verda Jus',
    branding: { colors: { colors: { primary: '#1F6F43', secondary: '#F2C14E', accent: '#E07A2E', background: '#FFFFFF', text: '#1A1A1A' } }, typography: { primaryFont: 'Archivo', secondaryFont: 'Inter' }, artDirection: { styleId: 'editorial' } },
  });
  const blockingOf = (out: SectionOutput) => out.result.issues.filter((i) => i.severity === 'blocking').map((i) => i.code);
  const engineSections = [5, 6, 7, 8, 9].some(run);
  if (engineSections) configureGraphicEngine({ agentCall: engineAgent, onTrace: undefined, recentFingerprints: undefined, rememberFingerprints: undefined });

  const FLYER = visualContent({ id: 'flyer', copy: { headline: 'Le jus de bissap pressé chaque matin à Dakar', subhead: 'Livré en 24 h dans tout Dakar.' } }) as SectionContent;
  const flyerAt = (level: CreativityLevel, seed = 'check') =>
    renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: VERDA.brand, direction: VERDA.direction, creativity: level, seed: `${seed}:${level}`, content: FLYER });

  if (run(5)) {
    section('5. Visuels — le cran règle qui choisit dans le catalogue (Chromium)');
    for (const level of CREATIVITY_LEVELS) {
      agentMode = 'ok';
      engineCalls.length = 0;
      const out = await flyerAt(level);
      const low = level === 'low';
      check(
        `${level} : ${low ? 'aucun appel de modèle, le code choisit' : 'le modèle du cran choisit dans le catalogue (aucun appel quand un seul gabarit convient)'} ; page assemblée, affichée, texte exact`,
        (low ? engineCalls.length === 0 : engineCalls.every((c) => c.role === 'graphic.template' && c.level === level) && (level === 'medium' || engineCalls.length >= 1)) && out.spec.pattern.id === 'catalog' && Boolean(out.spec.catalog?.config.layout) && blockingOf(out).length === 0 && Boolean(out.result.measured) && out.result.html.includes('Le jus de bissap pressé chaque matin à Dakar'),
        `appels ${engineCalls.map((c) => `${c.role}@${c.level}`).join(',') || '—'} · ${out.spec.catalog?.config.gabarit ?? out.spec.catalog?.config.layout}`
      );
    }
  }

  if (run(6)) {
    section('6. Visuels — un modèle inutilisable ne coûte jamais la page : le choix du code est gardé');
    for (const mode of ['garbage', 'down'] as const) {
      agentMode = mode;
      engineCalls.length = 0;
      const out = await flyerAt('medium', `panne-${mode}`);
      check(
        `${mode === 'down' ? 'modèle en panne' : 'réponse illisible'} : page composée depuis le catalogue par le code, sans constat bloquant`,
        out.spec.pattern.id === 'catalog' && out.result.repairs.some((r) => r.code === 'catalog_pick' && r.by === 'code') && blockingOf(out).length === 0,
        `${engineCalls.length} appel(s)`
      );
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
            check(`${label} : gabarit à marqueurs, affiché, sans constat bloquant`, (face.id === 'front' ? markers.every((m) => m[1] === 'tagline') : markers.some((m) => m[1] === 'fullName')) && markers.every((m) => m[1] === m[2]) && blockingOf(out).length === 0, blockingOf(out).join(',') || `${markers.length} marqueur(s)`);
            // Les VRAIES valeurs, plus longues que leurs marqueurs : la carte imprimée doit les tenir.
            const page = await browser.newPage();
            await page.setViewport({ width: orientation === 'landscape' ? 322 : 208, height: orientation === 'landscape' ? 208 : 322 });
            for (const [variant, values] of [['valeurs longues', LONG], ['sans fonction', { ...LONG, jobTitle: '' }]] as const) {
              await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${interpolateBusinessCard(html, values)}<script>${EMPTY_FIELD_CLEANUP}</script></body></html>`, { waitUntil: 'load', timeout: 15000 }).catch(() => undefined);
              await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 5000))]);
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
    section('8. Documents (business plan, pitch deck) — le code au cran Low, langage + plan + un choix par page à l’Ultra, rejeu sans modèle');
    const PAGES: SectionContent[] = [
      { id: 'company-summary', title: 'Une jus de fruits locaux, pressés chaque matin', lede: 'Verda Jus livre les bureaux de Dakar.', blocks: [{ id: 'p', kind: 'prose', paragraphs: ['Verda Jus presse des fruits achetés aux maraîchers de Sangalkam.', 'Les bureaux du Plateau reçoivent leur commande avant 9 h.'] }, { id: 'm', kind: 'metrics', items: [{ value: '1 200', label: 'Bouteilles par jour' }, { value: '38', label: 'Bureaux clients' }] }] },
      { id: 'market', title: 'Un marché urbain qui consomme hors du foyer', blocks: [{ id: 'c', kind: 'chart', chartType: 'bar', labels: ['2024', '2025', '2026'], series: [{ name: 'Bouteilles (milliers)', data: [120, 210, 340] }], readingKey: 'Les volumes ont presque triplé en deux ans.' }, { id: 'p', kind: 'prose', paragraphs: ['La demande vient des bureaux et des salles de sport du Plateau.'] }] },
      { id: 'finance', title: 'Trois ans de chiffres', blocks: [{ id: 't', kind: 'table', headers: ['Poste', '2025', '2026'], rows: [['Ventes', '42 000 000', '68 500 000'], ['Marge', '35 %', '38 %']] }] },
    ];
    for (const documentType of ['business-plan', 'pitch-deck'] as const) {
      for (const level of ['low', 'ultra'] as const) {
        engineCalls.length = 0;
        const doc = await createDocument({ documentType, format: documentType === 'business-plan' ? 'a4-portrait' : 'slide-16x9', brand: VERDA.brand, direction: VERDA.direction, creativity: level, seed: `check:${documentType}`, sections: PAGES.map((p) => ({ id: p.id })) });
        const outs = await Promise.all(PAGES.map((page, i) => doc.composeSection(page, { index: i + 1, total: PAGES.length })));
        const roles = engineCalls.map((c) => c.role);
        const choices = roles.filter((r) => r === 'graphic.template').length;
        check(
          `${documentType}, ${level} : ${level === 'low' ? 'aucun appel de modèle' : 'le langage et le plan (directeur), l’habillage et un choix par page'}, au cran ${level} ; pages du catalogue sans constat bloquant`,
          (level === 'low' ? engineCalls.length === 0 : roles.filter((r) => r === 'graphic.director').length === 2 && choices >= PAGES.length && engineCalls.every((c) => c.level === level)) && outs.every((o) => o.spec.catalog && blockingOf(o).length === 0),
          `${roles.join(',') || '—'} · ${outs.flatMap((o) => blockingOf(o)).join(',')}`
        );
        const html = outs.map((o) => o.result.html).join('');
        check(`${documentType}, ${level} : chiffres exacts (tableau, graphique dessinés par le code)`, html.includes('68 500 000') && html.includes('data-ge-chart="bar"') && html.includes('<table'));
      }
      engineCalls.length = 0;
      const doc = await createDocument({ documentType, format: documentType === 'business-plan' ? 'a4-portrait' : 'slide-16x9', brand: VERDA.brand, direction: VERDA.direction, creativity: 'medium', seed: 'check:replay', sections: [{ id: 'market' }] });
      const first = await doc.composeSection(PAGES[1]);
      const calls = engineCalls.length;
      const again = await doc.composeSection({ ...PAGES[1], title: 'Un marché qui a triplé en deux ans' }, { replay: first.spec });
      check(`${documentType} : une retouche de texte rejoue la page sans modèle`, engineCalls.length === calls && again.result.html.includes('Un marché qui a triplé en deux ans') && again.spec.html === first.spec.html);
    }
  }

  if (run(9)) {
    section('9. Tailwind seul — une page gardée est assainie, la feuille compilée avec le thème de la marque');
    // Une page écrite avant le catalogue, rejouée : son code passe par le même assainissement.
    const dirty = '<div class="relative h-full w-full bg-brand-primary p-[40px]" style="color:red" onclick="alert(1)"><style>h2{color:red}</style><script>alert(1)</script><h2 class="font-display text-[48px] text-on-brand">{{title}}</h2><img src="https://evil.example/x.png" class="w-[40px]"></div>';
    const out = await renderSingle({ documentType: 'flyer', format: 'flyer-square', brand: VERDA.brand, direction: VERDA.direction, creativity: 'medium', seed: 'dirty', content: FLYER, replay: { version: 2, ref: 'flyer', pattern: { id: 'authored' }, html: dirty } as never });
    const html = out.result.html;
    const head = out.result.head ?? '';
    check('aucun style natif, script, gestionnaire ou adresse étrangère ne survit', !/style="color|<script|onclick|evil\.example|<style/.test(html), out.result.issues.map((i) => i.code).join(','));
    check('le CSS natif retiré est signalé (conseil, jamais bloquant)', out.result.issues.some((i) => i.code === 'native_css_removed' && i.severity === 'advisory'));
    check('la feuille Tailwind compilée porte le thème de la marque, portée par .ge-page', /<style data-ge-tailwind>/.test(head) && head.toLowerCase().includes('--color-brand-primary: #1f6f43') && head.includes('.ge-page {'));
    check('les classes de la page sont compilées (valeurs arbitraires comprises)', head.includes('.bg-brand-primary') && head.includes('text-\\[48px\\]') && !/\b\d*\.?\d+rem\b/.test(head.replace(/@media[^{]*/g, '')));
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
    check('brouillons par proposition : Medium/High 1, Ultra 3', logoDraftCount('medium') === 1 && logoDraftCount('high') === 1 && logoDraftCount('ultra') === 3);
  }

  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Jauge de créativité : prix, orchestrateur et cran Ultra conformes.');
  process.exit(failures ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await closeBrowser().catch(() => undefined);
  process.exit(1);
});
