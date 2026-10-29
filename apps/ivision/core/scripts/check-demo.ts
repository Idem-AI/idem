/**
 * `npm run check:demo` — GRATUIT (agent SIMULÉ, site local) : la démo produit scriptée de bout en bout.
 *
 *   carte      les éléments actionnables visibles, jamais un champ mot de passe ;
 *   agent      sortie structurée demandée, raisonnement coupé ; une étape vers un numéro absent est écartée ;
 *   parcours   un écran par étape AVANT l'action, avec le point de l'action ; l'écran d'arrivée ; la page suivante
 *              atteinte par le clic ;
 *   zoom       le verbe `focus` sur un appareil zoome VERS le point (effet « point ») : rendu réel, le bouton cliqué
 *              occupe bien plus de l'image qu'avant.
 */
process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.RENDER_ALLOWED_HOSTS = 'localhost';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { DemoStep, locate, planDemo, recordDemo } from '../src/video/assets/demo';
import type { AgentCallOptions } from '../src/creativity/orchestrator';
import { buildFilmBundle } from '../src/video/rendering/compiler';
import { closeFilmBrowser, localizeFilm, probeFilm } from '../src/video/rendering/runner';
import { COMPOSITION, frameSpec } from '../src/video/rendering/formats';
import type { FilmData } from '../motion/runtime/film-data';
import { buildFilmDesign, compileProgram, lowerIntent, resolveSceneDesign, validateIntent, validateProgram } from '../../../../packages/motion-compiler/src';
import { variantChoices } from '../../../../packages/motion-compiler/src/solver/geometry';

let failed = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const PAGE = (body: string) => `<!doctype html><html lang="fr"><meta charset="utf-8"><style>body{font:18px system-ui;margin:0;background:#fbfaf7;color:#16181d}header{display:flex;gap:24px;padding:24px 48px;border-bottom:1px solid #ddd}main{padding:48px}.cta{position:absolute;left:1080px;top:150px;width:220px;height:64px;background:#e11d2e;color:#fff;border:0;border-radius:12px;font-size:20px}input{font-size:18px;padding:12px;width:420px}</style><body>${body}</body></html>`;
const HOME = PAGE(`<header><a href="/">Accueil</a><a href="/tarifs">Tarifs</a></header><main><h1>Vos factures en un clic</h1><p>Mot de passe :</p><input type="password" aria-label="Mot de passe"><a class="cta" href="/new" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Créer une facture</a></main>`);
const NEW = PAGE(`<header><a href="/">Accueil</a></header><main><h1>Nouvelle facture</h1><input aria-label="Nom du client" placeholder="Nom du client"><button style="margin-left:12px;padding:12px 20px">Enregistrer</button></main>`);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-demo-'));
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.url?.startsWith('/new') ? NEW : HOME);
  });
  await new Promise<void>((r) => server.listen(0, 'localhost', () => r()));
  const port = (server.address() as { port: number }).port;
  const url = `http://localhost:${port}/`;
  const uploads: string[] = [];
  const storage = { uploadFile: async (content: Buffer, name: string) => (uploads.push(name), fs.writeFileSync(path.join(dir, name), content), { downloadURL: `file://${path.join(dir, name)}` }) };
  try {
    // ── L'agent simulé : il lit la carte qu'on lui donne et vise le bouton par son numéro.
    let seen: { user: string; options?: AgentCallOptions } | null = null;
    const call = async (req: { user: string; options?: AgentCallOptions }) => {
      seen = req;
      const ref = Number(/#(\d+) link "Créer une facture"/.exec(req.user)?.[1]);
      return JSON.stringify({ steps: [{ action: 'show', ref: null, label: '', text: '', note: 'the home screen' }, { action: 'click', ref, label: 'Créer une facture', text: '', note: 'the new invoice form' }, { action: 'click', ref: 99, label: 'Nope', text: '', note: 'x' }] });
    };
    const map = [
      { ref: 1, kind: 'link' as const, label: 'Accueil', x: 48, y: 24, w: 80, h: 22 },
      { ref: 2, kind: 'link' as const, label: 'Créer une facture', x: 1080, y: 150, w: 220, h: 64 },
    ];
    const planned = await planDemo({ level: 'medium', call: call as never }, 'Montrer comment on crée une facture', map, { width: 1440, height: 900 });
    const s = seen as { user: string; options?: AgentCallOptions } | null;
    ok('agent : sortie structurée, raisonnement coupé', !!s?.options?.schema && s.options.reasoning === false);
    ok('agent : l’étape vers un numéro absent est écartée', planned.length === 2 && planned[1].ref === 2, JSON.stringify(planned.map((p) => p.ref)));
    ok('élément retrouvé par son libellé quand la carte a changé', locate({ action: 'click', ref: 5, label: 'Créer une facture', text: '', note: '' }, map)?.ref === 2);

    // ── Le parcours réel, étapes écrites (agent simulé par la carte réelle).
    const steps: DemoStep[] = [
      { action: 'show', ref: null, label: '', text: '', note: 'the home screen' },
      { action: 'click', ref: 0, label: 'Créer une facture', text: '', note: 'the new invoice form' },
      { action: 'type', ref: 0, label: 'Nom du client', text: 'Boutique Awa', note: 'the client name typed' },
    ];
    const shots = await recordDemo({ url, goal: 'créer une facture', storage, folder: 'demo', call: { level: 'medium' }, steps });
    ok('un écran par étape, plus l’écran d’arrivée', shots.length === 4, `${shots.length} écrans`);
    ok('écrans marqués « capture d’interface » (jamais étalonnés)', shots.every((m) => m.prep?.screen));
    const click = shots[1]?.prep?.point;
    ok('point du clic = centre du bouton', !!click && Math.abs(click.x - 1190 / 1440) < 0.01 && Math.abs(click.y - 182 / 900) < 0.01, JSON.stringify(click));
    ok('le clic mène à la page suivante (le champ y est visé)', !!shots[2]?.prep?.point && /Nom du client/.test(shots[2].name || ''), shots[2]?.name);
    const homeMap = shots[0]?.name || '';
    ok('jamais de champ mot de passe sur la carte', !/Mot de passe/.test(JSON.stringify(shots)) && !!homeMap);

    // ── Le zoom vers le point : un appareil, le verbe `focus`, rendu réel.
    const design = buildFilmDesign({ brand: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' }, direction: 'minimal', energy: [3] });
    const shot = shots[1]!;
    const red = async (withFocus: boolean) => {
      const intent = { role: 'feature', layout: 'device', elements: [{ id: 'app', kind: 'device', device: 'laptop', media: 0, rank: 1 }], beats: [{ verb: 'rise', target: 'app' }, ...(withFocus ? [{ verb: 'focus', target: 'app', after: 'app' }] : [])] };
      const v = validateIntent(intent, { texts: {}, media: ['image'], hasLogo: false });
      if (!v.ok) throw new Error(v.errors.join(' ; '));
      const fmt = 'landscape' as const;
      const lowered = lowerIntent({ intent: v.intent!, texts: {}, media: [{ kind: 'image', width: 1440, height: 900 }], formats: [fmt], designs: { [fmt]: resolveSceneDesign(design, fmt, 0) }, fonts: { display: 'Inter', body: 'Inter' }, logoAspect: 3, duration: 4, choice: variantChoices(v.intent!)[0], seamOut: 0 });
      const p = validateProgram(lowered.program, { texts: [], values: {}, media: ['image'], duration: 4, hasLogo: false });
      if (!p.ok) throw new Error(p.errors.join(' ; '));
      const code = compileProgram(p.program!).code;
      const spec = frameSpec(fmt, 'standard');
      const data: FilmData = { format: fmt, ...COMPOSITION[fmt], resolutionScale: 0.5, fps: spec.fps, background: '#fbfaf7', lang: 'fr', fontFamilies: ['Inter'], brand: { name: 'Test', colors: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' }, fonts: { display: 'Inter', body: 'Inter' } }, cues: [], scenes: [{ key: 's1', start: 0, duration: 4, texts: {}, design: resolveSceneDesign(design, fmt, 0) as never, media: [{ id: 'm0', kind: 'image', url: shot.url, width: 1440, height: 900, point: shot.prep!.point }] }] } as FilmData;
      const local = await localizeFilm(data);
      const probe = await probeFilm({ data: local.data, bundle: await buildFilmBundle([{ key: 's1', code }], 'render'), fontCss: '', files: local.files }, { thumbnails: true });
      const thumb = probe.thumbnails.s1;
      if (!thumb) throw new Error(`pas de vignette (${probe.errors.join(' ; ')})`);
      const { data: px, info } = await sharp(thumb).raw().toBuffer({ resolveWithObject: true });
      let n = 0;
      for (let i = 0; i < px.length; i += info.channels) if (px[i] > 190 && px[i + 1] < 70 && px[i + 2] < 80) n++;
      return { share: n / (px.length / info.channels), code, errors: probe.errors.length };
    };
    const still = await red(false);
    const zoomed = await red(true);
    ok('le programme zoome par l’effet « point »', /PZ_app_screen\(/.test(zoomed.code));
    ok('rendu sans erreur', !still.errors && !zoomed.errors);
    ok('le bouton cliqué grandit à l’image (zoom vers le clic)', zoomed.share > still.share * 1.8, `${(still.share * 100).toFixed(2)} % → ${(zoomed.share * 100).toFixed(2)} % de pixels du bouton`);
  } finally {
    server.close();
    await closeFilmBrowser();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} échec(s)` : '\nTout passe.');
  process.exit(failed ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await closeFilmBrowser();
  process.exit(1);
});
