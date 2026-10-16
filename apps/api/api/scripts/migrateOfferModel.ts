/**
 * Bascule du catalogue vers le modèle au portefeuille — `npm run billing:migrate-offer`.
 *
 * Le modèle « Créer, Garder, Faire tourner, Grandir » (`models/offer.model.ts`) ne vend plus
 * qu'un produit par mobile money : la recharge du portefeuille (`wallet-topup`). Ce script :
 *
 *  1. amorce `wallet-topup` s'il manque (le démarrage le fait aussi) ;
 *  2. retire de la vente les anciens produits (abonnements, packs de crédits, passes, options) —
 *     ils restent en base pour l'historique, les factures et les abonnements en cours ;
 *  3. programme la fin des abonnements payants en cours à leur échéance : ils ne se
 *     renouvellent plus, et le droit acquis jusque-là est respecté (un abonnement payant actif
 *     vaut forfait Croissance dans `entitlements.offer`) ;
 *  4. compte les soldes de crédits business qui seront convertis en francs (13 F le crédit) à
 *     la première lecture du portefeuille — la conversion elle-même est paresseuse.
 *
 * Idempotent. Sans `--apply`, il compte seulement ce qu'il ferait. Les bêta-testeurs ne sont
 * pas touchés (accès offert, `provider: 'beta'`).
 *
 *   npm run billing:migrate-offer            # compte
 *   npm run billing:migrate-offer -- --apply # applique
 */
import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { DEFAULT_PRODUCTS } from '../models/billing.model';
import { LEGACY_CREDIT_XAF } from '../models/offer.model';
import { BillingProduct, BillingSubscription } from '../schemas/billing.schema';
import { CreditBalance } from '../schemas/payment.schema';

const APPLY = process.argv.includes('--apply');
const KEEP_ON_SALE = new Set(['wallet-topup']);

async function main(): Promise<void> {
  await loadSecrets();
  await mongoDBConnection.connect();

  const topup = DEFAULT_PRODUCTS.find((product) => product.code === 'wallet-topup')!;
  const hasTopup = await BillingProduct.exists({ code: 'wallet-topup' });
  const onSale = await BillingProduct.find({ isActive: true, code: { $nin: [...KEEP_ON_SALE] } }).select('code name').lean();
  const renewing = await BillingSubscription.countDocuments({ status: { $in: ['active', 'past_due'] }, provider: { $ne: 'beta' }, priceXaf: { $gt: 0 }, cancelAtPeriodEnd: { $ne: true } });
  const legacy = await CreditBalance.aggregate([{ $match: { engine: 'business', balance: { $gt: 0 } } }, { $group: { _id: null, accounts: { $sum: 1 }, credits: { $sum: '$balance' } } }]);
  const legacyAccounts = legacy[0]?.accounts ?? 0;
  const legacyCredits = legacy[0]?.credits ?? 0;

  console.log(`wallet-topup        : ${hasTopup ? 'présent' : 'à créer'}`);
  console.log(`produits à retirer  : ${onSale.length}`);
  for (const product of onSale) console.log(`  · ${product.code} — ${product.name}`);
  console.log(`abonnements payants : ${renewing} se renouvellent encore → fin à l'échéance`);
  console.log(`crédits business    : ${legacyCredits} sur ${legacyAccounts} compte(s) → ${legacyCredits * LEGACY_CREDIT_XAF} F au portefeuille (conversion à la première lecture)`);

  if (!APPLY) {
    console.log('\nRien n’a été modifié. Relancer avec --apply pour appliquer.');
  } else {
    if (!hasTopup) await BillingProduct.create(topup);
    const retired = await BillingProduct.updateMany({ isActive: true, code: { $nin: [...KEEP_ON_SALE] } }, { $set: { isActive: false } });
    const ended = await BillingSubscription.updateMany(
      { status: { $in: ['active', 'past_due'] }, provider: { $ne: 'beta' }, priceXaf: { $gt: 0 }, cancelAtPeriodEnd: { $ne: true } },
      { $set: { cancelAtPeriodEnd: true } }
    );
    console.log(`\n✓ ${retired.modifiedCount} produit(s) retiré(s) de la vente, ${ended.modifiedCount} abonnement(s) arrêté(s) à l'échéance.`);
  }

  await mongoDBConnection.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoDBConnection.disconnect().catch(() => undefined);
  process.exit(1);
});
