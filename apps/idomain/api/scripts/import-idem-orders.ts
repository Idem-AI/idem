/**
 * `npm run import:idem-orders` — reprise, une seule fois, des commandes de domaines que l'API IDEM
 * tenait dans MongoDB (`domain_orders`, file d'enregistrement manuel) avant iDomain.
 *
 *   - commande « registered » → un domaine actif ici (registrar d'origine, échéance gardée) ;
 *   - commande « pending »    → une commande payée ici, que le worker enregistrera (le débit déjà
 *                               fait côté IDEM reste valable : elle est importée « prépayée ») ;
 *   - « failed » / « refunded » → importées pour l'historique, sans effet.
 *
 * Sans `--apply`, le script compte et montre ce qu'il ferait, sans rien écrire. Rejouable : chaque
 * commande importée garde sa référence Mongo (`orders.legacy_ref`), une seconde passe la saute.
 *
 * Variables : celles de l'API iDomain (base PostgreSQL), plus MONGODB_URI et MONGODB_DATABASE (IDEM).
 */
import { loadSecrets } from '../src/config/secrets';

interface LegacyOrder {
  _id: { toHexString(): string };
  userId: string;
  domain: string;
  extension: string;
  years?: number;
  priceXaf: number;
  renewalXaf: number;
  source: 'purchase' | 'pack' | 'pass';
  status: 'pending' | 'registered' | 'failed' | 'refunded';
  registrar?: string;
  registeredAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await loadSecrets();
  const { MongoClient } = await import('mongodb');
  const { one, query, withTransaction, closeDatabase } = await import('../src/config/db');
  const { activeRules } = await import('../src/modules/pricing/rules.service');
  const { activeCatalog } = await import('../src/modules/pricing/catalog.service');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI manquant (base de l’API IDEM).');
  const mongo = await MongoClient.connect(uri);
  const legacy = await mongo
    .db(process.env.MONGODB_DATABASE || 'idem')
    .collection<LegacyOrder>('domain_orders')
    .find({})
    .sort({ createdAt: 1 })
    .toArray();

  const { id: rulesId } = await activeRules();
  const counts = { total: legacy.length, skipped: 0, registered: 0, pending: 0, history: 0 };

  for (const o of legacy) {
    const ref = o._id.toHexString();
    if (await one(`SELECT 1 FROM orders WHERE legacy_ref = $1`, [ref])) {
      counts.skipped++;
      continue;
    }
    const domain = o.domain.trim().toLowerCase();
    const label = o.status === 'registered' ? 'registered' : o.status === 'pending' ? 'pending' : 'history';
    counts[label]++;
    console.log(`${apply ? '→' : '(simulation)'} ${domain} [${o.status}] ${o.priceXaf} F — ${o.userId}`);
    if (!apply) continue;

    const catalog = await activeCatalog(o.extension);
    const registrarCode = o.registrar && (await one(`SELECT 1 FROM registrar_providers WHERE code = $1`, [o.registrar])) ? o.registrar : null;
    await withTransaction(async (client) => {
      const orderStatus = o.status === 'registered' ? 'completed' : o.status === 'pending' ? 'paid' : o.status === 'refunded' ? 'refunded' : 'failed';
      const order = await one<{ id: string }>(
        `INSERT INTO orders (owner_uid, status, total_xaf, payment_method, source, idempotency_key, legacy_ref, created_at)
         VALUES ($1, $2, $3, 'prepaid', $4, $5, $6, $7) RETURNING id`,
        [o.userId, orderStatus, o.priceXaf, o.source === 'purchase' ? 'idem' : o.source, `legacy:${ref}`, ref, o.createdAt],
        client
      );
      let domainId: string | null = null;
      if (o.status === 'registered') {
        const d = await one<{ id: string }>(
          `INSERT INTO domains (owner_uid, name, tld, status, registrar_code, dns_mode, registered_at, expires_at, renewal_xaf, source)
           VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, 'idem')
           ON CONFLICT (name) WHERE status <> 'failed' DO NOTHING RETURNING id`,
          // Sans référence chez le registrar, la zone n'est pas pilotable d'ici : DNS « externes » jusqu'à vérification.
          [o.userId, domain, o.extension, registrarCode, 'external', o.registeredAt ?? o.createdAt, o.expiresAt ?? null, o.renewalXaf],
          client
        );
        domainId = d?.id ?? null;
      }
      const itemStatus = o.status === 'registered' ? 'registered' : o.status === 'pending' ? 'pending' : 'failed';
      await client.query(
        `INSERT INTO order_items (order_id, domain_name, tld, operation, years, price_xaf, renewal_xaf, at_cost, catalog_id, rules_id, status, provider_code, domain_id)
         VALUES ($1, $2, $3, 'register', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [order!.id, domain, o.extension, o.years ?? 1, o.priceXaf, o.renewalXaf, o.source !== 'purchase', catalog?.id ?? null, rulesId, itemStatus, registrarCode, domainId]
      );
      await client.query(
        `INSERT INTO audit_logs (actor_kind, actor_id, action, target_type, target_id, data) VALUES ('system', 'import', 'order.imported_from_idem', 'order', $1, $2)`,
        [order!.id, JSON.stringify({ legacyRef: ref, status: o.status })]
      );
    });
  }

  if (apply && counts.pending) {
    // Les commandes en attente partent au worker (titulaire demandé si absent).
    const { enqueueOrderItem } = await import('../src/queue/queues');
    const pending = await query<{ id: string; owner_uid: string }>(
      `SELECT oi.id, o.owner_uid FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.legacy_ref IS NOT NULL AND oi.status = 'pending'`
    );
    for (const p of pending) await enqueueOrderItem(p.id);
    const { closeQueues } = await import('../src/queue/queues');
    await closeQueues();
  }

  console.log(`\n${apply ? 'Importé' : 'À importer'} : ${JSON.stringify(counts)}`);
  if (!apply) console.log('Relancer avec -- --apply pour écrire.');
  await mongo.close();
  await closeDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
