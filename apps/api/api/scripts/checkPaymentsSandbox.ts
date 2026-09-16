/**
 * Encaissement de bout en bout sur le bac à sable pawaPay —
 * `npm run check:payments:sandbox`.
 *
 * Ce que les contrôles hors ligne ne peuvent pas prouver : que la plateforme
 * parle réellement à pawaPay, qu'un paiement encaissé accorde ses crédits
 * **une seule fois**, et qu'un échec produit un message compréhensible.
 *
 * Il utilise les numéros de test documentés, qui donnent un résultat
 * déterministe :
 *
 *   237653456789  MTN    → COMPLETED
 *   237693456049  Orange → FAILED (INSUFFICIENT_BALANCE)
 *   237653456039  MTN    → FAILED (PAYMENT_NOT_APPROVED)
 *
 * Prérequis : `PAWAPAY_API_TOKEN` d'un compte bac à sable, `PAWAPAY_ENV` non
 * positionné à `production`, et une base MongoDB accessible. Le script écrit
 * de vraies transactions : à ne lancer que sur un environnement de
 * développement.
 *
 *   npx ts-node --transpile-only api/scripts/checkPaymentsSandbox.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.secret') });

import mongoDBConnection from '../config/mongodb.config';
import { PaymentTransaction, PaymentEvent, CreditBalance } from '../schemas/payment.schema';
import { BillingPurchase } from '../schemas/billing.schema';
import { billingService } from '../services/billing.service';
import { billingSettingsService } from '../services/billing/billing-settings.service';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
import { paymentService } from '../services/payments/payment.service';
import { pawapayClient } from '../services/payments/pawapay.client';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Compte de test, isolé des vrais utilisateurs. */
const TEST_USER = `sandbox-check-${Date.now()}`;
const TEST_EMAIL = 'sandbox@idem.africa';

/** Recharge à 500 F : le plus petit montant du catalogue qui accorde des crédits. */
const PRODUCT = 'recharge-boost';
const EXPECTED_CREDITS = 25;

interface Scenario {
  label: string;
  phone: string;
  provider: string;
  expected: 'COMPLETED' | 'FAILED';
  expectedFailureCode?: string;
}

const SCENARIOS: Scenario[] = [
  {
    label: 'MTN — paiement accepté',
    phone: '237653456789',
    provider: 'MTN_MOMO_CMR',
    expected: 'COMPLETED',
  },
  {
    label: 'Orange — solde insuffisant',
    phone: '237693456049',
    provider: 'ORANGE_CMR',
    expected: 'FAILED',
    expectedFailureCode: 'INSUFFICIENT_BALANCE',
  },
  {
    label: 'MTN — code non validé',
    phone: '237653456039',
    provider: 'MTN_MOMO_CMR',
    expected: 'FAILED',
    expectedFailureCode: 'PAYMENT_NOT_APPROVED',
  },
];

/**
 * Attend un statut final en relisant, comme le fait le réconciliateur.
 *
 * Le bac à sable répond vite, mais pas instantanément : l'attente reproduit
 * exactement la boucle de production plutôt que de lire la base en espérant.
 */
async function waitForFinalStatus(reference: string, timeoutMs = 90_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const transaction = await paymentService.getByReference(reference);
    if (!transaction) throw new Error(`Transaction ${reference} introuvable`);

    if (['COMPLETED', 'FAILED', 'REJECTED', 'NOT_FOUND', 'EXPIRED'].includes(transaction.status)) {
      return transaction;
    }

    await paymentService.pollTransaction(transaction.id!, 'reconciler');
    await sleep(3_000);
  }

  throw new Error(`Aucun statut final pour ${reference} après ${timeoutMs / 1000} s`);
}

async function main(): Promise<void> {
  console.log('Encaissement de bout en bout — bac à sable pawaPay\n');

  if (!pawapayClient.isConfigured()) {
    console.error('PAWAPAY_API_TOKEN absent : impossible de lancer ce contrôle.');
    process.exit(1);
  }

  if (pawapayClient.isProduction()) {
    console.error('PAWAPAY_ENV=production : ce script ne doit jamais tourner en production.');
    process.exit(1);
  }

  await mongoDBConnection.connect();
  await billingService.seedProducts();
  await billingSettingsService.ensureExists();

  section('Connectivité');
  try {
    const conf = await pawapayClient.getActiveConfiguration('CMR');
    const providers = conf.countries?.[0]?.providers?.map((p) => p.provider) ?? [];
    check(`Configuration active lue (${providers.join(', ') || 'aucun opérateur'})`, providers.length > 0);
  } catch (error: any) {
    check('Configuration active lue', false, error.message);
  }

  for (const scenario of SCENARIOS) {
    section(scenario.label);

    let reference: string;

    try {
      const transaction = await paymentService.checkout(TEST_USER, TEST_EMAIL, {
        productCode: PRODUCT,
        engine: 'appgen',
        phoneNumber: scenario.phone,
        country: 'CMR',
        provider: scenario.provider,
        client: { app: 'dashboard' },
      });

      reference = transaction.reference;
      check(`Paiement lancé (${reference})`, Boolean(transaction.reference));
    } catch (error: any) {
      check('Paiement lancé', false, error.message);
      continue;
    }

    try {
      const final = await waitForFinalStatus(reference);

      check(
        `Statut final ${scenario.expected}`,
        final.status === scenario.expected,
        `obtenu : ${final.status}`
      );

      if (scenario.expectedFailureCode) {
        check(
          `Code d’échec ${scenario.expectedFailureCode}`,
          final.failureCode === scenario.expectedFailureCode,
          `obtenu : ${final.failureCode}`
        );
        check(
          'Message d’échec en français, sans code technique',
          Boolean(final.failureMessage) && !final.failureMessage!.includes('_'),
          final.failureMessage ?? ''
        );
      }

      if (scenario.expected === 'COMPLETED') {
        check('Contrepartie livrée', final.fulfillment.state === 'done', final.fulfillment.error ?? '');
        check('Identifiant opérateur conservé', Boolean(final.providerTransactionId));

        // Le cœur du contrôle : rejouer la livraison ne doit rien recréditer.
        const balanceBefore = await creditLedgerService.getBalance(TEST_USER, 'appgen');
        await paymentService.fulfill(final.id!);
        await paymentService.fulfill(final.id!);
        const balanceAfter = await creditLedgerService.getBalance(TEST_USER, 'appgen');

        check(
          'Rejouer la livraison ne crédite pas deux fois',
          balanceBefore === balanceAfter,
          `${balanceBefore} → ${balanceAfter}`
        );

        const purchases = await BillingPurchase.countDocuments({
          paymentTransactionId: final.id,
        });
        check('Un seul achat enregistré pour ce paiement', purchases === 1, `trouvés : ${purchases}`);
      }

      // La timeline doit raconter l'histoire complète : c'est elle que lira le
      // support quand un client appellera.
      const events = await PaymentEvent.find({ depositId: final.depositId }).sort({ at: 1 }).lean();
      const types = events.map((event) => event.type);

      check(`Timeline renseignée (${events.length} événements)`, events.length >= 3);
      check('La création est tracée', types.includes('created'));
      check('L’appel à pawaPay est tracé', types.includes('pawapay_request'));
      check('Le statut final est tracé', types.includes('status_changed'));

      console.log(`     ${types.join(' → ')}`);
    } catch (error: any) {
      check('Statut final atteint', false, error.message);
    }
  }

  section('Crédits accordés');
  const balance = await creditLedgerService.getBalance(TEST_USER, 'appgen');
  check(
    `Solde AppGen = ${EXPECTED_CREDITS} crédits (un seul paiement réussi)`,
    balance === EXPECTED_CREDITS,
    `solde : ${balance}`
  );

  section('Nettoyage');
  const transactions = await PaymentTransaction.find({ userId: TEST_USER }).select('_id').lean();
  const ids = transactions.map((transaction) => String(transaction._id));

  await Promise.all([
    PaymentTransaction.deleteMany({ userId: TEST_USER }),
    PaymentEvent.deleteMany({ transactionId: { $in: ids } }),
    BillingPurchase.deleteMany({ userId: TEST_USER }),
    CreditBalance.deleteMany({ userId: TEST_USER }),
  ]);
  console.log(`  ✓ ${ids.length} transaction(s) de test supprimée(s)`);

  await mongoDBConnection.disconnect();

  console.log(
    failures === 0
      ? '\n✓ Encaissement, livraison et traçabilité vérifiés sur le bac à sable.'
      : `\n✗ ${failures} contrôle(s) en échec.`
  );

  process.exit(failures === 0 ? 0 : 1);
}

void main().catch(async (error) => {
  console.error('\nÉchec du contrôle :', error);
  await mongoDBConnection.disconnect().catch(() => undefined);
  process.exit(1);
});
