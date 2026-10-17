/**
 * `npm run dev:offline` — iDomain complet en local, sans IDEM ni iDeploy ni registrar réels.
 *
 *   IDEM simulé    :3901  identité (cookie `session=good` sur localhost) + portefeuille en mémoire (50 000 F)
 *   iDeploy simulé :3902  une application « Boutique Awa », DNS public lu dans la zone simulée
 *   API iDomain    :3007  avec le registrar simulé ; worker dans le même processus
 *
 * Il faut la base PostgreSQL d'iDomain (migrée) et Redis. Puis :
 *   SERVICES_API_URL=http://localhost:3901 npm run dev:idomain-web
 * et, dans le navigateur sur localhost:4205 : document.cookie = 'session=good; path=/'.
 */
import http from 'node:http';

const SERVER_IP = '203.0.113.10';
const wallet = { xaf: 50_000 };
const charges = new Map<string, { amount: number; refunded: number; refunds: Set<string> }>();
const app = { uuid: 'app-demo', name: 'Boutique Awa', domains: ['boutique-kenfack.idem.africa'] };

const send = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:4205',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(JSON.stringify(body));
};
const body = (req: http.IncomingMessage): Promise<any> =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });

async function main(): Promise<void> {
  Object.assign(process.env, {
    IDEM_API_URL: 'http://localhost:3901',
    IDEPLOY_API_URL: 'http://localhost:3902',
    IDOMAIN_SERVICE_KEY: process.env.IDOMAIN_SERVICE_KEY || 'offline-service',
    IDOMAIN_IDEPLOY_KEY: process.env.IDOMAIN_IDEPLOY_KEY || 'offline-ideploy',
    IDOMAIN_ADMIN_KEY: process.env.IDOMAIN_ADMIN_KEY || 'offline-admin',
    IDOMAIN_SIMULATED_REGISTRAR: 'true',
    IDOMAIN_DB_PASSWORD: process.env.IDOMAIN_DB_PASSWORD || 'password',
  });
  const { SimulatedRegistrar } = await import('../src/integrations/registrars/simulated');
  const sim = new SimulatedRegistrar();

  http
    .createServer(async (req, res) => {
      const url = new URL(req.url!, 'http://x');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': 'http://localhost:4205',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Content-Type, Accept-Language',
          'Access-Control-Allow-Methods': 'GET, POST',
        });
        return res.end();
      }
      if (url.pathname === '/auth/profile') {
        return /session=good/.test(req.headers.cookie || '')
          ? send(res, 200, {
              uid: 'offline-user',
              email: 'awa@example.com',
              displayName: 'Awa Ndiaye',
            })
          : send(res, 401, {});
      }
      if (url.pathname === '/auth/logout') return send(res, 200, {});
      const b = req.method === 'POST' ? await body(req) : {};
      if (url.pathname === '/internal/idomain/billing/account')
        return send(res, 200, { walletXaf: wallet.xaf, atCost: false });
      if (url.pathname === '/internal/idomain/billing/charge') {
        if (charges.has(b.reference))
          return send(res, 200, {
            charged: true,
            chargedXaf: b.amountXaf,
            balanceXaf: wallet.xaf,
            replayed: true,
          });
        if (wallet.xaf < b.amountXaf)
          return send(res, 402, {
            error: 'payment_required',
            message: 'Solde insuffisant',
            missingXaf: b.amountXaf - wallet.xaf,
            topupXaf: b.amountXaf - wallet.xaf,
            balanceXaf: wallet.xaf,
          });
        wallet.xaf -= b.amountXaf;
        charges.set(b.reference, { amount: b.amountXaf, refunded: 0, refunds: new Set() });
        return send(res, 200, { charged: true, chargedXaf: b.amountXaf, balanceXaf: wallet.xaf });
      }
      if (url.pathname === '/internal/idomain/billing/refund') {
        const c = charges.get(b.chargeReference);
        if (!c) return send(res, 404, {});
        if (!c.refunds.has(b.refundReference) && c.refunded + b.amountXaf <= c.amount) {
          c.refunds.add(b.refundReference);
          c.refunded += b.amountXaf;
          wallet.xaf += b.amountXaf;
        }
        return send(res, 200, { ok: true, refunded: true, balanceXaf: wallet.xaf });
      }
      send(res, 404, {});
    })
    .listen(3901);

  http
    .createServer(async (req, res) => {
      const url = new URL(req.url!, 'http://x');
      const b = req.method === 'GET' ? {} : await body(req);
      if (url.pathname === '/internal/idomain/applications')
        return send(res, 200, { applications: [app] });
      if (url.pathname === `/internal/idomain/applications/${app.uuid}`)
        return send(res, 200, { ...app, serverIp: SERVER_IP });
      if (url.pathname === `/internal/idomain/applications/${app.uuid}/domains/status`) {
        const hosts = String(url.searchParams.get('hosts') || '')
          .split(',')
          .filter(Boolean);
        const out = [];
        for (const host of hosts) {
          const zone = host.replace(/^www\./, '');
          const a = (await sim.getRecordSets(zone)).find(
            (s) => s.name === (host === zone ? '@' : 'www') && s.type === 'A'
          );
          const dns = a?.values.includes(SERVER_IP) ? 'ok' : 'missing';
          out.push({
            host,
            dns,
            https: dns === 'ok' ? 'valid' : 'not_checked',
            routed: dns === 'ok',
          });
        }
        return send(res, 200, { domains: out });
      }
      if (url.pathname === `/internal/idomain/applications/${app.uuid}/domains`) {
        app.domains =
          req.method === 'DELETE'
            ? app.domains.filter((d) => !b.hosts.includes(d))
            : [...b.hosts, ...app.domains.filter((d) => !b.hosts.includes(d))];
        return send(res, 200, { domains: app.domains, applied: true });
      }
      send(res, 404, { error: 'application_not_found' });
    })
    .listen(3902);

  console.log(
    'IDEM simulé :3901 · iDeploy simulé :3902 — démarrage de l’API et du worker iDomain…'
  );
  await import('../src/index');
  await import('../src/worker');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
