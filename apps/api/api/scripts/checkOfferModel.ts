/**
 * Le modèle au portefeuille, de bout en bout — `npm run check:offer`.
 *
 * Joue les règles de `models/offer.model.ts` contre une base JETABLE (`idem_offer_check`, sur le
 * MongoDB et le Redis de développement), jamais contre la base de l'application :
 *
 *  1. recharge et bonus (5 % dès 5 000 F, 10 % dès 10 000 F) ;
 *  2. conversion paresseuse des anciens crédits business (13 F le crédit) ;
 *  3. le Kit Entreprise : un livrable au prix, le suivant plafonné, tout le Kit débloqué à 2 500 F ;
 *  4. la version Signature (+1 000 F) sur un livrable possédé ;
 *  5. le plafond Croissance : les achats du mois s'arrêtent à 3 000 F et accordent le forfait ;
 *  6. le forfait acheté : débit, fin de période, modifications iCode incluses ;
 *  7. le Pass Projet iCode : débit, accès au projet, 30 modifications ;
 *  8. les codes IDEM : un code portefeuille crédite une fois, pas deux ;
 *  9. un solde insuffisant refuse sans rien débiter, et dit ce qui manque.
 *
 *   npm run check:offer
 */
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { COMMUNICATION_PRICES, DELIVERABLES, ICODE, KIT_CAP_XAF, LEGACY_CREDIT_XAF, PASSES, SIGNATURE_PRICE_XAF, monthlyCapKey } from '../models/offer.model';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}
function section(title: string): void {
  console.log(`\n${title}`);
}

async function main(): Promise<void> {
  await loadSecrets();
  // Une base à part : le script crée et efface ses propres documents, rien d'autre.
  const uri = process.env.MONGODB_URI;
  if (uri) process.env.MONGODB_URI = uri.replace(/\/([^/?]+)(\?|$)/, '/idem_offer_check$2');
  else process.env.MONGODB_DATABASE = 'idem_offer_check';
  await mongoDBConnection.connect();
  if (mongoose.connection.name !== 'idem_offer_check') throw new Error(`base inattendue : ${mongoose.connection.name}`);

  // Importés après la connexion : les services lisent les modèles mongoose déjà enregistrés.
  const { walletService } = await import('../services/billing/wallet.service');
  const { creditLedgerService } = await import('../services/billing/credit-ledger.service');
  const { ownershipService } = await import('../services/billing/ownership.service');
  const { passService } = await import('../services/billing/pass.service');
  const { offerService } = await import('../services/billing/offer.service');
  const { idemCodesService } = await import('../services/billing/idem-codes.service');
  const { entitlementsService } = await import('../services/billing/entitlements.service');

  const user = () => `check-${randomUUID()}`;

  section('1. Recharge et bonus');
  {
    const u = user();
    const small = await walletService.topUp(u, 1000);
    check('1 000 F rechargés : solde 1 000 F, sans bonus', small.balanceXaf === 1000 && small.bonusXaf === 0, small);
    const mid = await walletService.topUp(u, 5000);
    check('5 000 F rechargés : +250 F de bonus', mid.bonusXaf === 250 && mid.balanceXaf === 6250, mid);
    const big = await walletService.topUp(u, 10000);
    check('10 000 F rechargés : +1 000 F de bonus', big.bonusXaf === 1000 && big.balanceXaf === 17250, big);
  }

  section('2. Conversion des anciens crédits');
  {
    const u = user();
    await creditLedgerService.grant(u, 'business', 10, 'manual_adjustment', { note: 'check' });
    const balance = await walletService.balance(u);
    check(`10 crédits business → ${10 * LEGACY_CREDIT_XAF} F au portefeuille`, balance === 10 * LEGACY_CREDIT_XAF, balance);
    const again = await walletService.balance(u);
    check('la conversion ne se refait pas', again === balance, again);
  }

  section('3. Le Kit Entreprise plafonné');
  {
    const u = user();
    const projectId = `p-${randomUUID()}`;
    await walletService.topUp(u, 4000);
    const bp = await ownershipService.unlock(u, projectId, 'business_plan');
    check(`business plan : ${DELIVERABLES.business_plan.priceXaf} F`, bp.ok && bp.chargedXaf === DELIVERABLES.business_plan.priceXaf && !bp.kitComplete, bp);
    const logo = await ownershipService.unlock(u, projectId, 'logo_brand');
    check(`logo : plafonné à ${KIT_CAP_XAF - DELIVERABLES.business_plan.priceXaf} F, Kit complet`, logo.ok && logo.chargedXaf === KIT_CAP_XAF - DELIVERABLES.business_plan.priceXaf && logo.kitComplete, logo);
    const status = await ownershipService.status(u, projectId);
    check('tous les livrables du projet sont possédés', status.deliverables.every((d) => d.owned), status.deliverables.map((d) => [d.key, d.owned]));
    check(`Kit payé ${KIT_CAP_XAF} F au total`, status.kit.spentXaf === KIT_CAP_XAF && status.kit.complete, status.kit);
    const deck = await ownershipService.unlock(u, projectId, 'pitch_deck');
    check('un livrable déjà possédé ne se repaie pas', deck.ok && deck.chargedXaf === 0 && deck.alreadyOwned, deck);
    check('solde final : 4 000 − 2 500 = 1 500 F', (await walletService.balance(u)) === 1500);

    section('4. La version Signature');
    const signature = await ownershipService.unlock(u, projectId, 'business_plan', 'signature');
    check(`Signature : +${SIGNATURE_PRICE_XAF} F`, signature.ok && signature.chargedXaf === SIGNATURE_PRICE_XAF && signature.tier === 'signature', signature);
    check('solde : 500 F', (await walletService.balance(u)) === 500);
  }

  section('5. Le plafond Croissance du mois');
  {
    const u = user();
    await walletService.topUp(u, 5000); // + 250 F de bonus
    const cap = { key: monthlyCapKey('croissance'), capXaf: PASSES.croissance.monthlyXaf };
    let charged = 0;
    let reached = false;
    for (let i = 0; i < 12; i += 1) {
      const spend = await walletService.spend(u, { priceXaf: COMMUNICATION_PRICES.motion_video, label: 'Vidéo', action: 'motion_video', cap });
      if (!spend.allowed) break;
      charged += spend.chargedXaf;
      if (spend.capReached && !reached) {
        reached = true;
        await passService.grantFromCap(u, 'croissance');
      }
    }
    check(`12 vidéos à 300 F : ${PASSES.croissance.monthlyXaf} F débités au plus`, charged === PASSES.croissance.monthlyXaf, charged);
    await entitlementsService.invalidate(u);
    const offer = (await entitlementsService.resolve(u)).offer;
    check('le plafond atteint accorde le forfait Croissance', offer.croissance && Boolean(offer.passes.croissance), offer.passes);
  }

  section('6. Un forfait acheté');
  {
    const u = user();
    await walletService.topUp(u, 3000);
    const bought = await passService.buy(u, 'croissance', 'month');
    check('Croissance : 3 000 F débités', bought.allowed && bought.chargedXaf === 3000, bought);
    await entitlementsService.invalidate(u);
    const offer = (await entitlementsService.resolve(u)).offer;
    check(`${ICODE.croissanceModificationsPerMonth} modifications iCode incluses`, offer.modifications === ICODE.croissanceModificationsPerMonth, offer.modifications);
    const until = offer.passes.croissance ? new Date(offer.passes.croissance) : null;
    check('actif environ un mois', Boolean(until && until.getTime() - Date.now() > 27 * 86_400_000), until);
  }

  section('7. Le Pass Projet iCode');
  {
    const u = user();
    const projectId = `p-${randomUUID()}`;
    await walletService.topUp(u, 1000);
    const pass = await offerService.buy(u, { kind: 'icode_project_pass', projectId });
    check('Pass Projet : 1 000 F', pass.ok && pass.chargedXaf === ICODE.projectPassXaf, pass);
    check('le projet est débloqué', await entitlementsService.hasProjectAccess(u, projectId));
    const offer = (await entitlementsService.resolve(u)).offer;
    check(`${ICODE.projectPassModifications} modifications incluses`, offer.modifications === ICODE.projectPassModifications, offer.modifications);
  }

  section('8. Les codes IDEM');
  {
    const u = user();
    const batch = await idemCodesService.generate({ kind: 'wallet', valueXaf: 1000, count: 1, createdBy: 'check' });
    const first = await offerService.redeemCode(u, batch.codes[0].toLowerCase());
    check('un code portefeuille crédite 1 000 F (casse indifférente)', first.ok && (await walletService.balance(u)) === 1000, first);
    const second = await offerService.redeemCode(user(), batch.codes[0]);
    check('le même code est refusé la seconde fois', !second.ok && 'error' in second && second.error === 'already_redeemed', second);
  }

  section('9. Solde insuffisant');
  {
    const u = user();
    await walletService.topUp(u, 100);
    const refused = await walletService.spend(u, { priceXaf: 300, label: 'Vidéo', action: 'motion_video' });
    check('refusé, manque 200 F', !refused.allowed && refused.missingXaf === 200, refused);
    check('rien n’a été débité', (await walletService.balance(u)) === 100);
  }

  await mongoose.connection.dropDatabase();
  await mongoDBConnection.disconnect();
  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Modèle au portefeuille : recharges, Kit, forfaits, iCode et codes conformes.');
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoDBConnection.disconnect().catch(() => undefined);
  process.exit(1);
});
