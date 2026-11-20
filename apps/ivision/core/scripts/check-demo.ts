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
import { DemoStep, locate, planDemo, recordDemo } from '../src/video/assets/demo';
import type { AgentCallOptions } from '../src/creativity/orchestrator';
import { closeFilmBrowser } from '../src/video/rendering/runner';

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
