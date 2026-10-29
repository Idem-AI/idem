/**
 * LES DÉMOS PRODUIT SCRIPTÉES — le parcours d'une interface filmé écran par écran, avec un zoom automatique sur ce
 * que l'on clique.
 *
 *   1. la CARTE de la page : les éléments visibles avec lesquels on agit (boutons, liens, champs), leur libellé et leur
 *      place — relevée dans le navigateur, numérotée ;
 *   2. un AGENT lit l'objectif de la démo et la carte, et écrit les étapes (« cliquer #4 », « écrire dans #7 ») en
 *      sortie structurée — jamais de mots-clés côté code pour deviner quoi cliquer ;
 *   3. le code joue les étapes : avant chaque action, une capture de l'écran et le POINT de l'action (centre de
 *      l'élément, 0..1). Chaque capture devient un média « écran » (jamais étalonné) dont le point sert de cadrage et
 *      de cible au verbe `focus` (effet « point » du compilateur : le média zoome vers le clic).
 *
 * La carte est relevée de nouveau après chaque action : une étape vise un élément de la carte COURANTE (l'agent écrit
 * aussi le libellé, comparé tel quel pour retrouver l'élément quand la page a changé).
 *
 * Réseau : la garde des rendus (jamais d'adresse privée), ni média ni WebSocket ; jamais de mot de passe saisi (un
 * champ de type password n'apparaît pas sur la carte).
 */
import crypto from 'crypto';
import type { Page } from 'puppeteer';
import logger from '../../runtime/logger';
import { installRenderNetworkGuard, isRenderUrlAllowed } from '../../render/network-guard';
import { normalizeSiteUrl } from '../../site/site-scanner';
import { callFilmModel, FilmCallContext } from '../agents';
import { filmBrowser, releaseFilmBrowser } from '../rendering/runner';
import type { VideoMediaAsset } from '../contracts/model';
import type { MediaStorage } from './media';

export type DemoDevice = 'desktop' | 'mobile';

export interface DemoElement {
  ref: number;
  kind: 'button' | 'link' | 'field' | 'select';
  label: string;
  /** Boîte en pixels de la fenêtre. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DemoStep {
  action: 'click' | 'type' | 'scroll' | 'show';
  /** Numéro sur la carte courante (`null` pour « show » : montrer l'écran tel quel). */
  ref: number | null;
  /** Le libellé lu sur la carte (pour retrouver l'élément si la page a bougé). */
  label: string;
  /** Texte à écrire (action « type »). */
  text: string;
  /** Ce que l'étape montre, pour le storyboard (une phrase). */
  note: string;
}

const VIEWPORTS: Record<DemoDevice, { width: number; height: number; deviceScaleFactor: number; isMobile: boolean }> = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
};
const MAX_STEPS = 6;

/** La carte des éléments actionnables visibles (code passé en texte : jamais d'aide TypeScript dans la page). */
const MAP_SCRIPT = `(() => {
  const vw = innerWidth, vh = innerHeight, out = [];
  document.querySelectorAll('[data-idem-ref]').forEach((el) => el.removeAttribute('data-idem-ref'));
  const nodes = document.querySelectorAll('a[href], button, [role=button], [role=link], [role=tab], input, textarea, select, summary');
  for (const el of nodes) {
    if (out.length >= 60) break;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.right < 0 || r.top > vh * 3 || r.left > vw) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.1) continue;
    const tag = el.tagName.toLowerCase(), type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'password' || type === 'hidden' || type === 'file') continue;
    const kind = tag === 'select' ? 'select' : tag === 'textarea' || (tag === 'input' && !['button', 'submit', 'checkbox', 'radio'].includes(type)) ? 'field' : tag === 'a' || el.getAttribute('role') === 'link' ? 'link' : 'button';
    const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
    if (!label) continue;
    el.setAttribute('data-idem-ref', String(out.length + 1));
    out.push({ ref: out.length + 1, kind, label, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
})()`;

async function pageMap(page: Page): Promise<DemoElement[]> {
  return ((await page.evaluate(MAP_SCRIPT).catch(() => [])) as DemoElement[]) || [];
}

export function mapText(map: DemoElement[], viewport: { width: number; height: number }): string {
  return map
    .map((e) => `#${e.ref} ${e.kind} "${e.label}" at ${Math.round(((e.x + e.w / 2) / viewport.width) * 100)}%,${Math.round(((e.y + e.h / 2) / viewport.height) * 100)}%${e.y > viewport.height ? ' (below the fold)' : ''}`)
    .join('\n');
}

const STEPS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['steps'],
  properties: {
    steps: {
      type: 'array',
      maxItems: MAX_STEPS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'ref', 'label', 'text', 'note'],
        properties: {
          action: { type: 'string', enum: ['click', 'type', 'scroll', 'show'] },
          ref: { type: ['integer', 'null'] },
          label: { type: 'string' },
          text: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  },
};

const PLANNER_SYSTEM = `You script a short PRODUCT DEMO of a web interface for a promotional video. You receive the goal of the demo and a numbered MAP of the visible elements one can act on. Write at most ${MAX_STEPS} steps that SHOW the product doing what the goal says, in order, each a single action:
- "show": film the current screen as it is (ref null) — the first step is usually a "show" of the landing screen;
- "click": click element #ref (copy its label exactly);
- "type": type "text" into field #ref — short, realistic, never a password, an email of a real person or payment data;
- "scroll": bring element #ref into view.
Only use refs that exist on the map. Never log in, sign up, pay, delete or send a form. "note" says in one short English sentence what the screen shows after the step (for the storyboard). Answer JSON only.`;

/** L'agent lit l'objectif et la carte et écrit les étapes. */
export async function planDemo(ctx: FilmCallContext, goal: string, map: DemoElement[], viewport: { width: number; height: number }): Promise<DemoStep[]> {
  if (!map.length) return [{ action: 'show', ref: null, label: '', text: '', note: 'the landing screen' }];
  const run = await callFilmModel(ctx, 'video.planner', PLANNER_SYSTEM, `GOAL: ${goal.slice(0, 600)}\n\nMAP:\n${mapText(map, viewport)}`, undefined, { schema: { name: 'demo_steps', schema: STEPS_SCHEMA }, reasoning: false, temperature: 0.2 });
  try {
    const parsed = JSON.parse(run.raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '')) as { steps?: DemoStep[] };
    const known = new Set(map.map((e) => e.ref));
    const steps = (parsed.steps || [])
      .filter((s) => ['click', 'type', 'scroll', 'show'].includes(s.action))
      .filter((s) => s.action === 'show' || (typeof s.ref === 'number' && known.has(s.ref)))
      .slice(0, MAX_STEPS)
      .map((s) => ({ action: s.action, ref: s.action === 'show' ? null : s.ref, label: String(s.label || '').slice(0, 60), text: String(s.text || '').slice(0, 80), note: String(s.note || '').slice(0, 160) }));
    return steps.length ? steps : [{ action: 'show', ref: null, label: '', text: '', note: 'the landing screen' }];
  } catch {
    return [{ action: 'show', ref: null, label: '', text: '', note: 'the landing screen' }];
  }
}

/** L'élément de l'étape sur la carte COURANTE : même numéro et même libellé, sinon le même libellé ailleurs. */
export function locate(step: DemoStep, map: DemoElement[]): DemoElement | undefined {
  const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();
  const byRef = map.find((e) => e.ref === step.ref);
  if (byRef && (!step.label || same(byRef.label, step.label))) return byRef;
  return (step.label ? map.find((e) => same(e.label, step.label)) : undefined) || byRef;
}

export interface DemoOptions {
  url: string;
  goal: string;
  device?: DemoDevice;
  storage: MediaStorage;
  folder: string;
  call: FilmCallContext;
  /** Étapes déjà écrites (contrôles) : pas d'agent. */
  steps?: DemoStep[];
  timeoutMs?: number;
}

/** Joue la démo et rend ses écrans : un média « écran » par étape, avec le point de l'action. */
export async function recordDemo(opts: DemoOptions): Promise<VideoMediaAsset[]> {
  const url = normalizeSiteUrl(opts.url);
  if (!(await isRenderUrlAllowed(url))) throw new Error('demo_blocked_url');
  const viewport = VIEWPORTS[opts.device || 'desktop'];
  const timeout = opts.timeoutMs ?? 20_000;
  const browser = await filmBrowser();
  const page = await browser.newPage();
  const shots: VideoMediaAsset[] = [];
  try {
    await page.setViewport(viewport);
    await installRenderNetworkGuard(page, (req) => !['media', 'websocket', 'eventsource'].includes(req.resourceType()));
    await page.goto(url, { waitUntil: 'networkidle2', timeout }).catch((error: Error) => {
      if (!/timeout/i.test(error.message)) throw error;
    });
    let map = await pageMap(page);
    const steps = opts.steps || (await planDemo(opts.call, opts.goal, map, viewport));
    const key = crypto.createHash('sha1').update(`${url}|${Date.now()}`).digest('hex').slice(0, 10);
    for (let k = 0; k < steps.length; k++) {
      const step = steps[k];
      map = await pageMap(page);
      const el = step.action === 'show' ? undefined : locate(step, map);
      if (step.action !== 'show' && !el) {
        logger.warn('video.demo_step_missing', { step: k, label: step.label });
        continue;
      }
      if (el && (el.y < 0 || el.y + el.h > viewport.height)) {
        await page.evaluate(`document.querySelector('[data-idem-ref="${el.ref}"]')?.scrollIntoView({ block: 'center' })`).catch(() => undefined);
        await new Promise((r) => setTimeout(r, 350));
        map = await pageMap(page);
      }
      const target = el ? map.find((e) => e.label === el.label) || el : undefined;
      // L'écran AVANT l'action, avec le point où elle aura lieu.
      const png = Buffer.from(await page.screenshot({ type: 'png' }));
      const point = target ? { x: Math.round(((target.x + target.w / 2) / viewport.width) * 1000) / 1000, y: Math.round(((target.y + target.h / 2) / viewport.height) * 1000) / 1000 } : undefined;
      const up = await opts.storage.uploadFile(png, `demo-${key}-${k + 1}.png`, opts.folder, 'image/png');
      shots.push({
        id: `demo-${key}-${k + 1}`,
        kind: 'image',
        url: up.downloadURL,
        origin: 'library',
        name: `product demo, step ${k + 1}/${steps.length}: ${step.note || step.action}${target ? ` (the ${target.kind} "${target.label}" is where the action happens)` : ''}`,
        width: viewport.width * viewport.deviceScaleFactor,
        height: viewport.height * viewport.deviceScaleFactor,
        prep: { screen: true, ...(point ? { point } : {}) },
      });
      if (!target) continue;
      const selector = `[data-idem-ref="${target.ref}"]`;
      if (step.action === 'click') {
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => undefined), page.click(selector).catch(() => undefined)]);
        await new Promise((r) => setTimeout(r, 500));
      } else if (step.action === 'type' && step.text) {
        await page.type(selector, step.text, { delay: 30 }).catch(() => undefined);
      }
    }
    // L'écran d'ARRIVÉE, quand la dernière étape a agi : le résultat de la démo.
    const last = steps[steps.length - 1];
    if (shots.length && last && last.action !== 'show') {
      const png = Buffer.from(await page.screenshot({ type: 'png' }));
      const up = await opts.storage.uploadFile(png, `demo-${key}-end.png`, opts.folder, 'image/png');
      shots.push({ id: `demo-${key}-end`, kind: 'image', url: up.downloadURL, origin: 'library', name: `product demo, result: the screen after "${last.note || last.action}"`, width: viewport.width * viewport.deviceScaleFactor, height: viewport.height * viewport.deviceScaleFactor, prep: { screen: true } });
    }
    return shots;
  } finally {
    await page.close().catch(() => undefined);
    releaseFilmBrowser();
  }
}
