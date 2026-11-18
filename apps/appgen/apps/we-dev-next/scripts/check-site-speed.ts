/**
 * Vérifie l'accélération de la génération des sites, sans appel payant (modèles simulés du SDK `ai`) :
 *
 *   - la relance d'un appel lent : la plus rapide gagne, l'autre est coupée ; rien n'est relancé quand tout va bien ;
 *     un échec attend l'autre essai s'il court encore ; un appel au fil de l'eau qui écrit déjà n'est pas relancé ;
 *   - la lecture des sections complètes dans une réponse JSON en cours (chaînes, échappements, accolades dans le texte) ;
 *   - la livraison au fil de l'eau : la première section d'une page part vers l'assemblage AVANT la fin de la réponse.
 *
 *   npm run check:site-speed
 */
import { MockLanguageModelV1 } from 'ai/test';
import { simulateReadableStream } from 'ai';
import type { LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { ModelCaller } from '../src/siteEngine/modelCaller.js';
import { completedSections, startPageCopy, type CopyTask } from '../src/siteEngine/sectionCatalog/copy.js';
import type { KindNode } from '../src/siteEngine/sectionCatalog/types.js';
import type { ManifestPage, SiteManifest } from '../src/siteEngine/manifest.js';

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  ÉCHEC ${label}${detail === undefined ? '' : `\n       ${JSON.stringify(detail)}`}`);
  }
};

/** Une attente qui s'arrête à la coupure de l'appel, comme une vraie requête. */
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, { once: true });
  });

const RAW = { rawCall: { rawPrompt: null, rawSettings: {} } };

/** Un modèle dont le n-ième appel répond après `delays[n]` ms (ou échoue si la valeur est une erreur). */
function scripted(delays: Array<number | Error>, text = '{"ok":true}') {
  let calls = 0;
  const aborted: number[] = [];
  const model = new MockLanguageModelV1({
    doGenerate: async (options) => {
      const index = calls++;
      const delay = delays[Math.min(index, delays.length - 1)];
      if (delay instanceof Error) {
        await sleep(20, options.abortSignal);
        throw delay;
      }
      try {
        await sleep(delay, options.abortSignal);
      } catch (error) {
        aborted.push(index);
        throw error;
      }
      return { ...RAW, finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 }, text: text.replace('true', String(index)) };
    },
  });
  return { model, calls: () => calls, aborted };
}

const caller = (model: MockLanguageModelV1, hedgeAfterMs: number, hedge = true) =>
  new ModelCaller('mock', null, new AbortController().signal, { model: () => model, hedge, hedgeAfterMs });

const acceptAll = (raw: unknown) => ({ value: raw as { ok: number } });

/* -------------------------------------------------------------------------- */
console.log('Relance des appels lents');
{
  const m = scripted([400, 20]);
  const c = caller(m.model, 60);
  const started = Date.now();
  const out = await c.json('lent', 'sys', 'prompt', acceptAll);
  const ms = Date.now() - started;
  check('la relance répond la première', out.value?.ok === 1, out.value);
  check('le total suit la relance (~80 ms), pas l’appel lent (400 ms)', ms < 250, ms);
  check('l’appel lent est coupé', m.aborted.includes(0), m.aborted);
  check('compté comme gagné par la relance', c.hedgeWins === 1);
}
{
  const m = scripted([20]);
  const c = caller(m.model, 60);
  await c.json('rapide', 'sys', 'prompt', acceptAll);
  await sleep(100);
  check('un appel rapide n’est jamais relancé', m.calls() === 1, m.calls());
}
{
  const m = scripted([400, 20]);
  const c = caller(m.model, 60, false);
  const out = await c.json('sans relance', 'sys', 'prompt', acceptAll);
  check('relance coupée (SITE_HEDGE=off) : un seul appel', m.calls() === 1 && out.value?.ok === 0);
}
{
  // Le premier échoue après le départ de la relance : on attend la relance au lieu d'abandonner.
  let calls = 0;
  const model = new MockLanguageModelV1({
    doGenerate: async (options) => {
      const index = calls++;
      if (index === 0) {
        await sleep(150, options.abortSignal);
        throw Object.assign(new Error('503 Service Unavailable'), { statusCode: 503 });
      }
      await sleep(200, options.abortSignal);
      return { ...RAW, finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 }, text: '{"ok":7}' };
    },
  });
  const out = await caller(model, 50).json('échec puis relance', 'sys', 'prompt', acceptAll);
  check('un échec attend la relance en cours, qui aboutit', out.value?.ok === 7 && calls === 2, { value: out.value, calls });
}
{
  // Un échec immédiat, avant le délai : pas de relance, le chemin ordinaire (modèle suivant, nouvel essai) reprend.
  const m = scripted([new Error('400 bad request'), 10]);
  const c = caller(m.model, 500);
  const out = await c.json('échec immédiat', 'sys', 'prompt', acceptAll);
  check('échec avant le délai : remonte sans attendre de relance', out.attempts >= 1 && m.calls() <= 2, { attempts: out.attempts, calls: m.calls() });
}
{
  // Le délai suit le rythme mesuré : 3 × la médiane, bornée.
  const m = scripted([10]);
  const c = new ModelCaller('mock', null, new AbortController().signal, { model: () => m.model });
  check('délai sans mesure : 25 s (40 s pour un gros appel)', c.hedgeDelay(1400) === 25_000 && c.hedgeDelay(7000) === 40_000);
  await c.json('rythme', 'sys', 'p', acceptAll, 1000);
  check('délai après mesure : borné à 12 s au moins', c.hedgeDelay(1000) === 12_000, c.hedgeDelay(1000));
}

/* -------------------------------------------------------------------------- */
console.log('Sections complètes dans une réponse en cours');
{
  const full = '```json\n{ "sections": { "hero": { "title": "Un titre avec } et \\" dedans", "items": [ { "a": "{" } ] }, "faq": { "title": "Questions';
  const got = completedSections(full, ['hero', 'faq']);
  check('section fermée lue, accolades et guillemets dans les textes compris', (got.hero as { title?: string })?.title === 'Un titre avec } et " dedans', got);
  check('section encore ouverte ignorée', !('faq' in got));
  check('identifiant non demandé ignoré', Object.keys(completedSections(full, ['faq'])).length === 0);
  const root = completedSections('{ "hero": { "title": "x" }, "faq": {', ['hero']);
  check('sections à la racine (sans « sections ») lues aussi', (root.hero as { title?: string })?.title === 'x');
  check('rien avant la première accolade', Object.keys(completedSections('Voici le JSON', ['hero'])).length === 0);
}

/* -------------------------------------------------------------------------- */
console.log('Textes livrés au fil de l’eau');
{
  const kind = {
    id: 'k',
    kind: 'kind',
    medium: 'icode',
    layout: 'split-media',
    doc: { summary: 'une section', use: '' },
    fields: { title: { type: 'text', max: 80, required: true }, lede: { type: 'text', max: 200, required: false } },
  } as unknown as KindNode;
  const section = (id: string) => ({ id, component: id[0].toUpperCase() + id.slice(1), brief: 'b', layout: 'split-media' });
  const page = { key: 'home', path: '/', label: 'Accueil', purpose: '', sections: [section('hero'), section('services'), section('contact')] } as unknown as ManifestPage;
  const tasks: CopyTask[] = page.sections.map((s) => ({ section: s, kind, visuals: 0 }));
  const json = JSON.stringify({
    sections: {
      hero: { title: 'Changer de vie pas à pas', lede: 'Des séances individuelles à Douala.' },
      services: { title: 'Trois façons d’avancer', lede: 'Séances, ateliers et suivi.' },
      contact: { title: 'Parlons de votre projet', lede: 'Un premier appel offert.' },
    },
  });
  // Le flux : un morceau de 12 caractères toutes les 15 ms (~1,3 s pour la page).
  const chunks: LanguageModelV1StreamPart[] = [];
  for (let i = 0; i < json.length; i += 12) chunks.push({ type: 'text-delta', textDelta: json.slice(i, i + 12) });
  chunks.push({ type: 'finish', finishReason: 'stop', usage: { promptTokens: 100, completionTokens: 200 } });
  const model = new MockLanguageModelV1({
    doStream: async () => ({ ...RAW, stream: simulateReadableStream({ chunks, initialDelayInMs: 10, chunkDelayInMs: 15 }) }),
  });
  const c = new ModelCaller('mock', null, new AbortController().signal, { model: () => model, hedge: false });
  const started = Date.now();
  const copy = startPageCopy({
    caller: c,
    label: 'home/textes',
    language: 'fr',
    manifest: { pages: [page] } as unknown as SiteManifest,
    page,
    tasks,
    factsText: 'Coaching à Douala',
    request: '',
    check: () => [],
    targets: ['/', 'contact'],
  });
  const at: Record<string, number> = {};
  await Promise.all(['hero', 'services', 'contact'].map((id) => copy.section(id).then((content) => (at[id] = content ? Date.now() - started : -1))));
  const result = await copy.done;
  const end = Date.now() - started;
  check('les trois sections livrées', Object.keys(result.sections).length === 3, result.sections);
  check('la première section part bien avant la fin de la réponse', at.hero > 0 && at.hero < end * 0.6, { at, end });
  check('dans l’ordre d’écriture', at.hero <= at.services && at.services <= at.contact, at);
}

console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
