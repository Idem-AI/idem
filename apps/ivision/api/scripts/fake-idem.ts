/**
 * Un IDEM simulé, pour faire tourner iVision sans l'API IDEM : identité (cookie `session`),
 * passerelle de modèles (réponses écrites, aucun appel payant), crédits (portefeuille en
 * mémoire), un projet IDEM avec sa charte. Utilisé par `check-api.ts` et `dev-offline.ts`.
 *
 *   session=good  →  check-user (500 crédits)
 *   session=poor  →  poor-user (solde nul : refus 402)
 */
import cors from 'cors';
import express from 'express';

export interface FakeIdem {
  url: string;
  close: () => void;
  charges: { userId: string; action: string; cost: number }[];
  refunds: { userId: string; cost: number }[];
}

export function startFakeIdem(options: { port?: number; key?: string; origins?: string[] } = {}): Promise<FakeIdem> {
  const key = options.key || 'check-key';
  const charges: FakeIdem['charges'] = [];
  const refunds: FakeIdem['refunds'] = [];
  let balance = 500;
  const app = express();
  app.use(cors({ origin: options.origins || true, credentials: true }));
  app.use(express.json({ limit: '20mb' }));
  app.get('/auth/profile', (req, res) => {
    const session = /session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (session === 'good') return res.json({ uid: 'check-user', email: 'check@idem.africa', displayName: 'Awa' });
    if (session === 'poor') return res.json({ uid: 'poor-user', email: 'poor@idem.africa' });
    res.status(401).json({ error: 'unauthenticated' });
  });
  app.post('/auth/logout', (_req, res) => res.json({ ok: true }));
  app.use('/internal/ivision', (req, res, next) => (req.headers['x-ivision-key'] === key ? next() : res.status(403).json({ error: 'forbidden' })));
  // Rédacteur simulé : chaque case demandée reçoit un texte court et fondé.
  app.post('/internal/ivision/ai/text', (req, res) => {
    const user = String(req.body.user || '');
    // Retoucheur simulé (vidéo motion design) : le titre de la première scène change.
    if (/made this short motion-design video/.test(String(req.body.system || ''))) {
      const key = /key=(\S+) role=/.exec(user)?.[1];
      if (/f[êe]te des m[èe]res/i.test(user)) return res.json({ text: '{"newRequest":true}' });
      return res.json({ text: JSON.stringify({ newRequest: false, texts: key ? { [key]: { title: 'Le café du matin' } } : {}, reply: 'J’ai changé le titre.' }) });
    }
    // Monteur simulé (montage d'une prise de parole) : des éléments ancrés sur les index de la
    // transcription, plus un mot-clé jamais prononcé que le code doit refuser.
    if (/video editor of a social-media team/.test(String(req.body.system || ''))) {
      const words = [...user.matchAll(/(\d+):(\S+)/g)].map((m) => ({ i: Number(m[1]), w: m[2] }));
      const at = (re: RegExp) => words.find((x) => re.test(x.w))?.i;
      const awa = at(/^awa/i);
      const price = at(/^1000$/);
      const bissa = at(/^bissa/i);
      const elements = [
        awa !== undefined ? { type: 'lowerThird', from: awa, to: awa + 1, value: 'Awa Diop', label: 'Fondatrice' } : null,
        bissa !== undefined ? { type: 'keyword', from: bissa, to: bissa, text: words.find((x) => x.i === bissa)!.w.replace(/[.,]/g, '') } : null,
        price !== undefined ? { type: 'stat', from: price, to: price + 1, value: '1000 F', label: 'la bouteille' } : null,
        { type: 'keyword', from: 2, to: 2, text: 'GRATUIT' },
        { type: 'zoom', from: 4 },
      ].filter(Boolean);
      return res.json({ text: JSON.stringify({ title: 'Le bissap de Saveurs', captions: 'pop', elements, outro: { text: 'Commandez sur WhatsApp', detail: '07 08 09 10' } }) });
    }
    const text = [...user.matchAll(/^(\d+)\.([a-zA-Z0-9]+) \(max (\d+)/gm)]
      .map((m) => `${m[1]}.${m[2]}: ${({ title: 'Le café qui réveille', sub: 'Torréfié chaque lundi', action: 'Commander', tagline: 'Kora Café', l1: 'Frais', l2: 'Local', label: 'clients chaque mois', value: '500', kicker: 'Nouveau' } as Record<string, string>)[m[2]] || 'Café frais'}`.slice(0, Number(m[3])))
      .join('\n');
    res.json({ text: text || '{}' });
  });
  app.post('/internal/ivision/ai/agent', (_req, res) => res.json({ text: '' }));
  app.post('/internal/ivision/ai/prompt', (_req, res) => res.json({ text: '' }));
  app.post('/internal/ivision/ai/vision', (_req, res) => res.json({ text: '{}' }));
  app.post('/internal/ivision/ai/image', (_req, res) => res.status(503).json({ error: 'no_image_model' }));
  // Hors ligne : ni clip ni voix (la vidéo passe à Pexels, puis se crée sans voix off).
  app.post('/internal/ivision/ai/video', (_req, res) => res.status(503).json({ error: 'no_video_model' }));
  app.post('/internal/ivision/ai/speech', (_req, res) => res.status(422).json({ error: 'voice_unavailable', message: 'voice_unavailable' }));
  app.post('/internal/ivision/billing/charge', (req, res) => {
    if (req.body.userId === 'poor-user') return res.status(402).json({ error: 'payment_required', cost: req.body.cost, balance: 0, missing: req.body.cost, suggestions: [] });
    charges.push({ userId: req.body.userId, action: req.body.action, cost: req.body.cost });
    balance -= req.body.cost;
    res.json({ charged: true, cost: req.body.cost, balance });
  });
  app.post('/internal/ivision/billing/refund', (req, res) => {
    refunds.push({ userId: req.body.userId, cost: req.body.cost });
    balance += req.body.cost;
    res.json({ ok: true });
  });
  app.get('/internal/ivision/billing/balance', (req, res) => res.json({ credits: req.query.userId === 'poor-user' ? 0 : balance, plan: 'business-free' }));
  app.get('/internal/ivision/billing/prices', (_req, res) => res.json({ motion_video: 120, revision: 1, flyer: 2, ai_visual: 5, creativity: { low: 1, medium: 1, high: 1.25, max: 1.5, ultra: 2 } }));
  app.get('/internal/ivision/projects', (_req, res) => res.json({ projects: [{ id: 'p1', name: 'Kora Café', hasBrand: true, primary: '#b4532a' }] }));
  app.get('/internal/ivision/projects/p1/brand', (_req, res) =>
    res.json({ name: 'Kora Café', branding: { colors: { colors: { primary: '#b4532a', secondary: '#f2c14e', accent: '#00b1ad', background: '#fbf7f2', text: '#3b2a22' } }, typography: { primaryFont: 'Playfair Display', secondaryFont: 'Inter' }, logo: null }, voice: { tone: 'chaleureux', language: 'fr' }, photos: [] })
  );
  return new Promise((resolve) => {
    const server = app.listen(options.port || 0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, close: () => server.close(), charges, refunds }));
  });
}
