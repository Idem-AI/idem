/**
 * `npm run check` — l'API iDomain de bout en bout, sans fournisseur ni service réels.
 *
 * Il faut : un PostgreSQL jetable (IDOMAIN_CHECK_DB_URL, migrations appliquées) et Redis (base 9,
 * vidée au départ). IDEM (identité + portefeuille) et iDeploy (applications + DNS public) sont
 * simulés par deux petits serveurs HTTP qui tiennent les mêmes contrats que les vraies passerelles
 * (`apps/api/api/routes/idomain.routes.ts`, `apps/ideploy-api/api/routes/idomain.routes.ts`) ; le
 * registrar est le fournisseur simulé.
 *
 * Ce qu'il prouve : recherche et prix publics, prix garanti, titulaire exigé, 402 puis paiement
 * après recharge, idempotence (même clic = une commande, un débit), enregistrement chez le moins
 * cher, résultat incertain réconcilié sans double achat, nom pris entre-temps → restitution, marge
 * insuffisante → suspension puis reprise, connexion DNS → iDeploy → HTTPS sans toucher MX/SPF,
 * restauration de la zone au débranchement, événement `domain.active` signé, cloisonnement entre
 * comptes, commande d'un pack (prépayée) qui attend le titulaire, console protégée par sa clé.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { createHmac } from 'node:crypto';

const DB_URL = process.env.IDOMAIN_CHECK_DB_URL || 'postgres://idomain:checkpass@localhost:55432/idomain_check';
const db = new URL(DB_URL);

// ─── Faux IDEM : identité et portefeuille ─────────────────────────────────

const wallets: Record<string, number> = { 'user-a': 3000, 'user-b': 0 };
const charges = new Map<string, { userId: string; amount: number; refunded: number; refunds: Set<string> }>();
let chargeCalls = 0;
let atCostUsers = new Set<string>();

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });
}

const fakeIdem = http.createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://x');
  if (url.pathname === '/auth/profile') {
    const session = /session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (session === 'good-a') return json(res, 200, { uid: 'user-a', email: 'awa@example.com', displayName: 'Awa Ndiaye' });
    if (session === 'good-b') return json(res, 200, { uid: 'user-b', email: 'bruno@example.com', displayName: 'Bruno Eto' });
    return json(res, 401, { error: 'unauthenticated' });
  }
  if (req.headers['x-idomain-key'] !== 'service-key') return json(res, 403, { error: 'forbidden' });
  const body = await readBody(req);
  if (url.pathname === '/internal/idomain/billing/charge') {
    chargeCalls++;
    const existing = charges.get(body.reference);
    if (existing) return json(res, 200, { charged: true, chargedXaf: existing.amount, balanceXaf: wallets[body.userId], replayed: true });
    if ((wallets[body.userId] ?? 0) < body.amountXaf) {
      const missing = body.amountXaf - (wallets[body.userId] ?? 0);
      return json(res, 402, { error: 'payment_required', message: `Il vous manque ${missing} F`, missingXaf: missing, balanceXaf: wallets[body.userId] ?? 0, topupXaf: missing });
    }
    wallets[body.userId] -= body.amountXaf;
    charges.set(body.reference, { userId: body.userId, amount: body.amountXaf, refunded: 0, refunds: new Set() });
    return json(res, 200, { charged: true, chargedXaf: body.amountXaf, balanceXaf: wallets[body.userId], ledgerEntryId: `le-${charges.size}` });
  }
  if (url.pathname === '/internal/idomain/billing/refund') {
    const charge = charges.get(body.chargeReference);
    if (!charge || charge.userId !== body.userId) return json(res, 404, { error: 'charge_not_found' });
    if (charge.refunds.has(body.refundReference)) return json(res, 200, { ok: true, refunded: false, replayed: true });
    if (charge.refunded + body.amountXaf > charge.amount) return json(res, 409, { error: 'refund_exceeds_charge' });
    charge.refunds.add(body.refundReference);
    charge.refunded += body.amountXaf;
    wallets[body.userId] += body.amountXaf;
    return json(res, 200, { ok: true, refunded: true, balanceXaf: wallets[body.userId] });
  }
  if (url.pathname === '/internal/idomain/billing/account') {
    const userId = url.searchParams.get('userId')!;
    return json(res, 200, { walletXaf: wallets[userId] ?? 0, atCost: atCostUsers.has(userId) });
  }
  json(res, 404, { error: 'not_found' });
});

// ─── Faux iDeploy : applications, rattachement, DNS public lu dans la zone simulée ──

const SERVER_IP = '203.0.113.10';
const apps: Record<string, { owner: string; name: string; domains: string[] }> = { 'app-1': { owner: 'user-a', name: 'Boutique Awa', domains: ['boutique-awa.idem.africa'] } };
let zoneReader: (domain: string) => Promise<{ name: string; type: string; values: string[] }[]> = async () => [];
const hookDeliveries: { event: string; signature: string; body: string }[] = [];

const fakeIdeploy = http.createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://x');
  if (url.pathname === '/hooks') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      hookDeliveries.push({ event: String(req.headers['x-idomain-event']), signature: String(req.headers['x-idomain-signature']), body: raw });
      json(res, 200, { ok: true });
    });
    return;
  }
  if (req.headers['x-idomain-key'] !== 'ideploy-key') return json(res, 403, { error: 'forbidden' });
  const body = req.method === 'GET' ? {} : await readBody(req);
  const uid = url.searchParams.get('idemUid') || body.idemUid;
  if (url.pathname === '/internal/idomain/applications') {
    return json(res, 200, { applications: Object.entries(apps).filter(([, a]) => a.owner === uid).map(([uuid, a]) => ({ uuid, name: a.name, domains: a.domains })) });
  }
  const m = /^\/internal\/idomain\/applications\/([^/]+)(\/domains(\/status)?)?$/.exec(url.pathname);
  const app = m ? apps[m[1]] : undefined;
  if (!m || !app || app.owner !== uid) return json(res, 404, { error: 'application_not_found', message: 'Application introuvable.' });
  if (!m[2]) return json(res, 200, { uuid: m[1], name: app.name, domains: app.domains, serverIp: SERVER_IP });
  if (m[3]) {
    const hosts = String(url.searchParams.get('hosts') || '').split(',').filter(Boolean);
    const out = [];
    for (const host of hosts) {
      const zone = host.replace(/^www\./, '');
      const name = host === zone ? '@' : 'www';
      const sets = await zoneReader(zone);
      const a = sets.find((s) => s.name === name && s.type === 'A');
      const dns = a?.values.includes(SERVER_IP) ? 'ok' : a ? 'wrong_ip' : 'missing';
      out.push({ host, dns, https: dns === 'ok' ? 'valid' : 'not_checked', routed: dns === 'ok' });
    }
    return json(res, 200, { domains: out });
  }
  if (req.method === 'POST') {
    app.domains = [...body.hosts, ...app.domains.filter((d: string) => !body.hosts.includes(d))];
    return json(res, 200, { domains: app.domains, applied: true });
  }
  if (req.method === 'DELETE') {
    app.domains = app.domains.filter((d) => !body.hosts.includes(d));
    return json(res, 200, { domains: app.domains });
  }
  json(res, 404, {});
});

const listen = (s: http.Server) => new Promise<number>((r) => s.listen(0, '127.0.0.1', () => r((s.address() as AddressInfo).port)));

let passed = 0;
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function main(): Promise<void> {
  const idemPort = await listen(fakeIdem);
  const ideployPort = await listen(fakeIdeploy);
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    LOG_DIR: '/tmp/idomain-check-logs',
    IDEM_API_URL: `http://127.0.0.1:${idemPort}`,
    IDEPLOY_API_URL: `http://127.0.0.1:${ideployPort}`,
    IDOMAIN_SERVICE_KEY: 'service-key',
    IDOMAIN_IDEPLOY_KEY: 'ideploy-key',
    IDOMAIN_ADMIN_KEY: 'admin-key',
    IDOMAIN_WEBHOOK_SECRET: 'hook-secret',
    IDOMAIN_WEBHOOK_TARGETS: `ideploy=http://127.0.0.1:${ideployPort}/hooks`,
    IDOMAIN_SIMULATED_REGISTRAR: 'true',
    IDOMAIN_DB_HOST: db.hostname,
    IDOMAIN_DB_PORT: db.port,
    IDOMAIN_DB_DATABASE: db.pathname.slice(1),
    IDOMAIN_DB_USERNAME: db.username,
    IDOMAIN_DB_PASSWORD: db.password,
    IDOMAIN_LIVE_QUOTE_TIMEOUT_MS: '3000',
    REDIS_DB: '9',
    DNA_RESELLER_ID: '',
    DNA_API_KEY: '',
  });

  const { default: redis } = await import('../src/config/redis');
  await redis.flushdb();
  const { connectDatabase, query, one, closeDatabase } = await import('../src/config/db');
  await connectDatabase();
  // Une base propre à chaque passage (les valeurs de départ de la migration sont gardées).
  await query(`TRUNCATE audit_logs, webhook_deliveries, dns_changes, domain_verifications, domain_connections, domain_operations, payments, order_items, orders, domain_sessions, price_sessions, domains, domain_contacts, provider_price_quotes, promotions CASCADE`);
  await query(`UPDATE registrar_providers SET enabled = (code = 'simulated'), health_status = CASE WHEN code = 'simulated' THEN 'up' ELSE health_status END`);
  await query(`UPDATE fx_rates SET xaf_per_unit = 577 WHERE currency = 'USD'`);
  await query(`DELETE FROM public_price_catalog`);
  await query(`INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, pack_xaf) VALUES ('africa', 6500, 8000, 4900), ('com', 8900, 8900, 7100)`);

  const { SimulatedRegistrar } = await import('../src/integrations/registrars/simulated');
  const sim = new SimulatedRegistrar();
  await sim.reset();
  zoneReader = (d) => sim.getRecordSets(d);

  const { createApp } = await import('../src/app');
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { executeItem, RetryLater, releaseItem } = await import('../src/modules/orders/execution.service');
  const { advance } = await import('../src/modules/connections/connections.service');
  const { deliver } = await import('../src/modules/webhooks/webhooks.service');

  const call = async (method: string, path: string, opts: { as?: 'a' | 'b'; body?: unknown; key?: string } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(opts.as ? { Cookie: `session=good-${opts.as}` } : {}), ...(opts.key ? { 'x-idomain-key': opts.key } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  /** Le worker, à la main : exécute une ligne, et rejoue comme BullMQ si elle demande une reprise. */
  const runItem = async (itemId: string) => {
    for (let i = 0; i < 4; i++) {
      try {
        await executeItem(itemId);
        return;
      } catch (error) {
        await releaseItem(itemId);
        if (!(error instanceof RetryLater)) throw error;
      }
    }
  };
  const contact = { firstName: 'Awa', lastName: 'Ndiaye', email: 'awa@example.com', phoneCountryCode: '237', phone: '699 00 00 00', address: 'Rue 1.234, Bonapriso', city: 'Douala', country: 'cm' };

  console.log('API iDomain — de bout en bout');

  await check('recherche publique : prix public unique, renouvellement annoncé, autres extensions', async () => {
    const r = await call('GET', '/v1/domains/search?q=Ma Boutique');
    assert.equal(r.status, 200);
    assert.equal(r.body.exact.domain, 'ma-boutique.africa');
    assert.equal(r.body.exact.state, 'available');
    assert.equal(r.body.exact.priceXaf, 6500);
    assert.equal(r.body.exact.renewalXaf, 8000);
    assert.equal(r.body.extensions[0].domain, 'ma-boutique.com');
    assert.equal(r.body.extensions[0].priceXaf, 8900);
    // Jamais de fournisseur, de coût ni de marge dans une réponse publique.
    assert.ok(!/simulated|provider|margin|"cost"|costXaf/i.test(JSON.stringify(r.body)));
  });

  await check('nom pris → variantes libres ; nom premium non proposé', async () => {
    const taken = await call('GET', '/v1/domains/search?q=pris-boutique.com');
    assert.equal(taken.body.exact.state, 'taken');
    assert.ok(taken.body.suggestions.length > 0 && taken.body.suggestions.every((s: { state: string }) => s.state === 'available'));
    const premium = await call('GET', '/v1/domains/search?q=premium-shop.com');
    assert.equal(premium.body.exact.state, 'premium');
  });

  await check('prix garanti et commande exigent la session IDEM', async () => {
    assert.equal((await call('POST', '/v1/price-sessions', { body: { domain: 'awa.com' } })).status, 401);
    assert.equal((await call('GET', '/v1/domains')).status, 401);
  });

  let session: { id: string; priceXaf: number };
  await check('titulaire exigé avant la commande', async () => {
    session = (await call('POST', '/v1/price-sessions', { as: 'a', body: { domain: 'boutique-awa.com' } })).body;
    assert.equal(session.priceXaf, 8900);
    const r = await call('POST', '/v1/orders', { as: 'a', body: { priceSessionIds: [session.id], idempotencyKey: 'clic-0001' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'contact_required');
    assert.equal((await call('PUT', '/v1/contact', { as: 'a', body: contact })).status, 200);
  });

  let orderId = '';
  let itemId = '';
  await check('solde insuffisant : 402 avec la recharge, commande en attente ; payée après recharge', async () => {
    const r = await call('POST', '/v1/orders', { as: 'a', body: { priceSessionIds: [session.id], idempotencyKey: 'clic-0002', connectAppUuid: 'app-1' } });
    assert.equal(r.status, 402);
    assert.equal(r.body.missingXaf, 8900 - 3000);
    orderId = r.body.orderId;
    assert.equal((await one<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [orderId]))!.status, 'awaiting_payment');
    wallets['user-a'] = 30_000;
    const paid = await call('POST', `/v1/orders/${orderId}/pay`, { as: 'a' });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, 'paid');
    itemId = paid.body.items[0].id;
    assert.equal(wallets['user-a'], 30_000 - 8900);
  });

  await check('idempotence : le même clic rejoué rend la même commande, sans second débit', async () => {
    const before = wallets['user-a'];
    const again = await call('POST', '/v1/orders', { as: 'a', body: { priceSessionIds: [session.id], idempotencyKey: 'clic-0002', connectAppUuid: 'app-1' } });
    assert.equal(again.body.id, orderId);
    await call('POST', `/v1/orders/${orderId}/pay`, { as: 'a' });
    assert.equal(wallets['user-a'], before);
    assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM orders WHERE owner_uid = 'user-a'`))!.n, '1');
  });

  await check('cloisonnement : un autre compte ne voit ni la commande ni le domaine', async () => {
    assert.equal((await call('GET', `/v1/orders/${orderId}`, { as: 'b' })).status, 404);
  });

  await check('enregistrement chez le fournisseur retenu, coût et marge historisés', async () => {
    await runItem(itemId);
    const item = (await one<any>(`SELECT * FROM order_items WHERE id = $1`, [itemId]))!;
    assert.equal(item.status, 'registered');
    assert.equal(item.provider_code, 'simulated');
    assert.equal(item.provider_cost_xaf, 5770);
    assert.equal(item.margin_xaf, Math.round(8900 * 0.92 - 250 - 5770));
    assert.equal((await one<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [orderId]))!.status, 'completed');
    assert.ok(await sim.getDomain('boutique-awa.com'));
  });

  let connectionId = '';
  await check('connexion : zone écrite (A), AAAA retiré, MX et SPF intacts, rattachée à iDeploy, active avec HTTPS', async () => {
    await sim.seedZone('boutique-awa.com', [
      { name: '@', type: 'MX', ttl: 3600, values: ['10 mail.fournisseur.com.'] },
      { name: '@', type: 'TXT', ttl: 3600, values: ['v=spf1 include:fournisseur.com ~all'] },
      { name: '@', type: 'AAAA', ttl: 3600, values: ['2001:db8::1'] },
    ]);
    const c = (await one<{ id: string; status: string }>(`SELECT id, status FROM domain_connections WHERE host = 'boutique-awa.com'`))!;
    connectionId = c.id;
    assert.equal(c.status, 'pending');
    for (let i = 0; i < 5; i++) await advance(c.id);
    const sets = await sim.getRecordSets('boutique-awa.com');
    const get = (name: string, type: string) => sets.find((s) => s.name === name && s.type === type)?.values;
    assert.deepEqual(get('@', 'A'), [SERVER_IP]);
    assert.deepEqual(get('www', 'A'), [SERVER_IP]);
    assert.equal(get('@', 'AAAA'), undefined);
    assert.deepEqual(get('@', 'MX'), ['10 mail.fournisseur.com.']);
    assert.deepEqual(get('@', 'TXT'), ['v=spf1 include:fournisseur.com ~all']);
    assert.deepEqual(apps['app-1'].domains.slice(0, 2), ['boutique-awa.com', 'www.boutique-awa.com']);
    const after = await call('GET', `/v1/domain-connections/${c.id}`, { as: 'a' });
    assert.equal(after.body.status, 'active');
  });

  await check('événements signés : domain.active livré à iDeploy, signature vérifiable', async () => {
    const rows = await query<{ id: string; event: string }>(`SELECT id, event FROM webhook_deliveries ORDER BY created_at`);
    assert.ok(rows.some((r) => r.event === 'domain.registered'));
    const active = rows.find((r) => r.event === 'domain.active')!;
    await deliver(active.id, false);
    const hook = hookDeliveries.find((h) => h.event === 'domain.active')!;
    const [, t, v1] = /t=(\d+),v1=([a-f0-9]+)/.exec(hook.signature)!;
    assert.equal(createHmac('sha256', 'hook-secret').update(`${t}.${hook.body}`).digest('hex'), v1);
    assert.equal(JSON.parse(hook.body).data.host, 'boutique-awa.com');
  });

  await check('vue avancée DNS : un jeu écrit seul, journalisé ; les autres jeux intacts', async () => {
    const domainId = (await one<{ id: string }>(`SELECT id FROM domains WHERE name = 'boutique-awa.com'`))!.id;
    const r = await call('POST', `/v1/domains/${domainId}/dns-records`, { as: 'a', body: { name: '_dmarc', type: 'TXT', values: ['v=DMARC1; p=none'] } });
    assert.equal(r.status, 200);
    assert.ok(r.body.records.some((s: { name: string }) => s.name === '_dmarc'));
    assert.ok(r.body.records.some((s: { type: string }) => s.type === 'MX'));
    const bad = await call('POST', `/v1/domains/${domainId}/dns-records`, { as: 'a', body: { name: '@', type: 'CNAME', values: ['ailleurs.com'] } });
    assert.equal(bad.status, 422);
    assert.equal((await call('GET', `/v1/domains/${domainId}/dns-records`, { as: 'b' })).status, 404);
  });

  await check('débranchement : la zone retrouve ses valeurs d’avant (AAAA revenu, plus de A), iDeploy détaché', async () => {
    assert.equal((await call('DELETE', `/v1/domain-connections/${connectionId}`, { as: 'a' })).body.status, 'detached');
    const sets = await sim.getRecordSets('boutique-awa.com');
    assert.equal(sets.find((s) => s.name === '@' && s.type === 'A'), undefined);
    assert.deepEqual(sets.find((s) => s.name === '@' && s.type === 'AAAA')?.values, ['2001:db8::1']);
    assert.ok(sets.some((s) => s.type === 'MX'));
    assert.ok(!apps['app-1'].domains.includes('boutique-awa.com'));
  });

  const order = async (domain: string, key: string) => {
    const s = (await call('POST', '/v1/price-sessions', { as: 'a', body: { domain } })).body;
    const o = await call('POST', '/v1/orders', { as: 'a', body: { priceSessionIds: [s.id], idempotencyKey: key } });
    return o;
  };

  await check('résultat incertain (coupure après envoi) : vérifié chez le fournisseur, jamais racheté', async () => {
    const o = await order('incertain-awa.com', 'clic-0003');
    assert.equal(o.status, 201);
    const id = o.body.items[0].id;
    await runItem(id);
    const ops = await query<{ status: string }>(`SELECT status FROM domain_operations WHERE order_item_id = $1`, [id]);
    assert.equal(ops.length, 1);
    assert.equal(ops[0].status, 'succeeded');
    assert.equal((await one<{ status: string }>(`SELECT status FROM order_items WHERE id = $1`, [id]))!.status, 'registered');
  });

  await check('nom pris entre la recherche et le paiement : refus clair, rien débité', async () => {
    const s = (await call('POST', '/v1/price-sessions', { as: 'a', body: { domain: 'course-awa.com' } })).body;
    await sim.register({ domain: 'course-awa.com', years: 1, idempotencyKey: 'tiers' } as never);
    const before = wallets['user-a'];
    const r = await call('POST', '/v1/orders', { as: 'a', body: { priceSessionIds: [s.id], idempotencyKey: 'clic-0004' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'domain_taken');
    assert.equal(wallets['user-a'], before);
  });

  await check('nom pris après le paiement : la ligne échoue et le montant est rendu, une seule fois', async () => {
    const before = wallets['user-a'];
    const o = await order('course-deux.com', 'clic-0005');
    assert.equal(wallets['user-a'], before - 8900);
    await sim.register({ domain: 'course-deux.com', years: 1, idempotencyKey: 'tiers' } as never);
    await runItem(o.body.items[0].id);
    assert.equal(wallets['user-a'], before);
    assert.equal((await one<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [o.body.id]))!.status, 'refunded');
    const { refundItem } = await import('../src/modules/payments/wallet.service');
    await refundItem({ id: o.body.id, owner_uid: 'user-a' }, { id: o.body.items[0].id, price_xaf: 8900, domain_name: 'course-deux.com' }, 'rejeu');
    assert.equal(wallets['user-a'], before);
  });

  await check('coût devenu trop haut après le paiement : suspendue (jamais à perte), puis reprise', async () => {
    const o = await order('cher-awa.com', 'clic-0006');
    const id = o.body.items[0].id;
    await query(`UPDATE fx_rates SET xaf_per_unit = 2000 WHERE currency = 'USD'`);
    await runItem(id);
    assert.equal((await one<{ status: string }>(`SELECT status FROM order_items WHERE id = $1`, [id]))!.status, 'on_hold');
    assert.equal((await one<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [o.body.id]))!.status, 'on_hold');
    assert.equal(await sim.getDomain('cher-awa.com'), null);
    await query(`UPDATE fx_rates SET xaf_per_unit = 577 WHERE currency = 'USD'`);
    await runItem(id);
    assert.equal((await one<{ status: string }>(`SELECT status FROM order_items WHERE id = $1`, [id]))!.status, 'registered');
  });

  await check('prix convenu tenu : un changement de catalogue ne touche pas une session ouverte', async () => {
    wallets['user-a'] += 20_000;
    const s = (await call('POST', '/v1/price-sessions', { as: 'a', body: { domain: 'tenu-awa.com' } })).body;
    assert.equal((await call('PUT', '/admin/v1/catalog/com', { key: 'admin-key', body: { registerXaf: 9500, renewXaf: 9500, transferXaf: null, packXaf: 7100, onSale: true } })).status, 200);
    const o = await call('POST', '/v1/orders', { as: 'a', body: { priceSessionIds: [s.id], idempotencyKey: 'clic-0007' } });
    assert.equal(o.body.totalXaf, 8900);
    assert.equal((await call('GET', '/v1/domains/search?q=nouveau-awa.com')).body.exact.priceXaf, 9500);
    const history = await call('GET', '/admin/v1/catalog/com/history', { key: 'admin-key' });
    assert.equal(history.body.history.length, 2);
  });

  await check('pack (prépayé par IDEM) : attend le titulaire, puis enregistré au prix du pack', async () => {
    assert.equal((await call('POST', '/internal/v1/orders/prepaid', { body: { userId: 'user-b', domain: 'bruno.africa', reference: 'pack:le-9' } })).status, 403);
    const r = await call('POST', '/internal/v1/orders/prepaid', { key: 'service-key', body: { userId: 'user-b', domain: 'bruno.africa', reference: 'pack:le-9' } });
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'awaiting_contact');
    assert.equal(r.body.totalXaf, 4900);
    const again = await call('POST', '/internal/v1/orders/prepaid', { key: 'service-key', body: { userId: 'user-b', domain: 'bruno.africa', reference: 'pack:le-9' } });
    assert.equal(again.body.id, r.body.id);
    const saved = await call('PUT', '/v1/contact', { as: 'b', body: { ...contact, firstName: 'Bruno', lastName: 'Eto', email: 'bruno@example.com' } });
    assert.equal(saved.body.resumedOrders, 1);
    await runItem(r.body.items[0].id);
    const item = (await one<any>(`SELECT status, price_xaf, margin_xaf FROM order_items WHERE id = $1`, [r.body.items[0].id]))!;
    assert.equal(item.status, 'registered');
    assert.equal(item.price_xaf, 4900);
    assert.ok(item.margin_xaf < 2000);
  });

  await check('console : fermée sans sa clé ; indicateurs et grille de prix lisibles avec', async () => {
    assert.equal((await call('GET', '/admin/v1/dashboard')).status, 403);
    assert.equal((await call('GET', '/admin/v1/dashboard', { key: 'service-key' })).status, 403);
    const d = await call('GET', '/admin/v1/dashboard', { key: 'admin-key' });
    assert.equal(d.status, 200);
    assert.ok(d.body.money.grossMarginXaf > 0);
    const p = await call('GET', '/admin/v1/pricing', { key: 'admin-key' });
    assert.ok(p.body.grid.find((g: { tld: string }) => g.tld === 'com').minimumRegisterPriceXaf > 0);
  });

  await check('contrat publié : /v1/openapi.json', async () => {
    const r = await call('GET', '/v1/openapi.json');
    assert.equal(r.body.openapi, '3.1.0');
    assert.ok(r.body.paths['/domain-connections']);
  });

  console.log(`\n${passed} vérifications passées. Débits demandés à IDEM : ${chargeCalls}.`);
  server.close();
  fakeIdem.close();
  fakeIdeploy.close();
  const { closeQueues } = await import('../src/queue/queues');
  await closeQueues();
  await closeDatabase();
  redis.disconnect();
  atCostUsers = new Set();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
