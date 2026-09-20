/**
 * Création des index MongoDB — `npm run check:indexes`.
 *
 * Écrit après un incident réel : un index mêlant `partialFilterExpression` et
 * `sparse` est refusé par MongoDB, et le refus survient **au démarrage de
 * l'API**, dans le `Promise.all` des `.init()`. Résultat : l'API ne démarre
 * pas du tout, pour une option de trop dans une déclaration d'index — et le
 * message n'apparaît qu'en lançant le serveur.
 *
 * Ce script fait exactement ce que fait le démarrage, mais en dix secondes et
 * sans lancer le serveur : il crée tous les index et signale ceux qui sont
 * refusés. À lancer après toute modification de schéma.
 *
 * Il signale aussi les **index périmés** : présents en base, absents du schéma.
 * Ceux-là ne sont pas cosmétiques — un index unique hérité d'une version
 * précédente continue d'interdire des écritures que le code actuel tient pour
 * légitimes, et l'erreur survient en production, sur un cas d'usage normal.
 *
 * Création idempotente ; suppression seulement sur demande explicite :
 *
 *   npx ts-node --transpile-only api/scripts/checkIndexes.ts          # signale
 *   npx ts-node --transpile-only api/scripts/checkIndexes.ts --fix    # supprime
 */

import { Model } from 'mongoose';
import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { User } from '../schemas/user.schema';
import { Project } from '../schemas/project.schema';
import { ProjectRevision } from '../schemas/revision.schema';
import { CoherenceAlert } from '../schemas/coherence.schema';
import { AiUsageEvent } from '../schemas/aiUsage.schema';
import {
  BillingInvoice,
  BillingProduct,
  BillingPurchase,
  BillingSubscription,
  CreditLedgerEntry,
} from '../schemas/billing.schema';
import {
  CreditBalance,
  PaymentCallbackRaw,
  PaymentEvent,
  PaymentTransaction,
} from '../schemas/payment.schema';
import { BillingSettings } from '../schemas/billingSettings.schema';
import { BetaTester } from '../schemas/betaTester.schema';
import { EmailLog } from '../schemas/emailLog.schema';
import { BillingSyncJob } from '../schemas/billingSync.schema';
import { PricingChange, PricingOverride } from '../schemas/pricingOverride.schema';

/** Exactement la liste initialisée par `index.ts` au démarrage. */
const MODELS: [string, Model<any>][] = [
  ['users', User],
  ['projects', Project],
  ['project_revisions', ProjectRevision],
  ['coherence_alerts', CoherenceAlert],
  ['ai_usage_events', AiUsageEvent],
  ['billing_products', BillingProduct],
  ['billing_subscriptions', BillingSubscription],
  ['billing_purchases', BillingPurchase],
  ['billing_invoices', BillingInvoice],
  ['credit_ledger', CreditLedgerEntry],
  ['payment_transactions', PaymentTransaction],
  ['payment_events', PaymentEvent],
  ['payment_callbacks_raw', PaymentCallbackRaw],
  ['credit_balances', CreditBalance],
  ['billing_settings', BillingSettings],
  ['beta_testers', BetaTester],
  ['email_logs', EmailLog],
  ['billing_sync_jobs', BillingSyncJob],
  ['pricing_overrides', PricingOverride],
  ['pricing_changes', PricingChange],
];

/**
 * Sans `--fix`, les index périmés sont seulement signalés.
 *
 * La suppression reste une décision explicite : un index absent du schéma peut
 * aussi avoir été créé sciemment à la main pour une requête d'exploitation.
 */
const FIX = process.argv.includes('--fix');

let failures = 0;
let staleCount = 0;

async function main(): Promise<void> {
  console.log('Création des index MongoDB\n');

  // Le MÊME chargement que l'application : `.env` puis `.env.secret`, avec
  // développement des `${…}`. Un simple `dotenv.config()` laisse ces
  // références littérales et l'authentification MongoDB échoue — pour une
  // raison totalement invisible dans le message d'erreur.
  await loadSecrets();
  await mongoDBConnection.connect();

  for (const [name, model] of MODELS) {
    try {
      await model.init();

      const indexes = await model.collection.indexes();
      const count = indexes.filter((index) => index.name !== '_id_').length;

      console.log(`  ✓ ${name} — ${count} index`);

      /**
       * Index présents en base mais absents du schéma.
       *
       * Ils ne sont pas cosmétiques : un index unique hérité d'une version
       * précédente continue d'interdire des écritures que le code actuel
       * considère comme légitimes. C'est exactement ce qui est arrivé ici —
       * `one_active_subscription_per_user`, unique sur le seul `userId`,
       * empêchait un client d'être abonné à deux moteurs, donc cassait les
       * bundles et l'octroi bêta.
       *
       * On les signale toujours, on ne les supprime que sur demande (`--fix`).
       */
      const { toDrop } = await model.diffIndexes();

      for (const stale of toDrop) {
        staleCount += 1;

        if (FIX) {
          await model.collection.dropIndex(stale);
          console.log(`      supprimé : ${stale}`);
        } else {
          console.warn(`      périmé : ${stale} (absent du schéma)`);
        }
      }
    } catch (error: any) {
      failures += 1;
      console.error(`  ✗ ${name} — ${error.message}`);
    }
  }

  await mongoDBConnection.disconnect();

  if (staleCount > 0) {
    console.log(
      FIX
        ? `\n${staleCount} index périmé(s) supprimé(s).`
        : `\n${staleCount} index périmé(s) détecté(s). Relancer avec --fix pour les supprimer.`
    );
  }

  console.log(
    failures === 0
      ? '\n✓ Tous les index sont créés : l’API démarrera.'
      : `\n✗ ${failures} collection(s) en échec — l’API ne démarrera pas en l’état.`
  );

  process.exit(failures === 0 ? 0 : 1);
}

void main().catch(async (error) => {
  console.error('\nÉchec :', error.message);
  await mongoDBConnection.disconnect().catch(() => undefined);
  process.exit(1);
});
