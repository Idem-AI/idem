/**
 * Les promotions, de bout en bout — `npm run check:promotions`.
 *
 * Joue les promotions contre une base JETABLE (`idem_promotions_check`, sur le MongoDB et le Redis de
 * développement), jamais contre la base de l'application. Aucun appel à un modèle d'IA.
 *
 *  1. la bêta gratuite (« tout », sauf exclusions) : livrable, forfait et pack à 0 F, exclusion payante ;
 *  2. la fin de la campagne : le prix normal revient aussitôt ;
 *  3. une remise en % sur une famille, limitée à un achat par compte ;
 *  4. le plafond du Kit remisé dans la même proportion (on ne paie jamais plus que le Kit remisé) ;
 *  5. un code promo : saisie, francs offerts, double saisie refusée, nombre de saisies borné ;
 *  6. le bonus de recharge d'une campagne ;
 *  7. les crédits du jour : limites élargies, jamais réduites ;
 *  8. un budget épuisé : la promotion s'arrête d'elle-même.
 */
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { DELIVERABLES, ICODE, KIT_CAP_XAF, PASSES, PACKS } from '../models/offer.model';

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

const DB = 'idem_promotions_check';

async function main(): Promise<void> {
  await loadSecrets();
  const uri = process.env.MONGODB_URI;
  if (uri) process.env.MONGODB_URI = uri.replace(/\/([^/?]+)(\?|$)/, `/${DB}$2`);
  else process.env.MONGODB_DATABASE = DB;
  await mongoDBConnection.connect();
  if (mongoose.connection.name !== DB) throw new Error(`base inattendue : ${mongoose.connection.name}`);
  await mongoose.connection.dropDatabase();

  const { walletService } = await import('../services/billing/wallet.service');
  const { ownershipService } = await import('../services/billing/ownership.service');
  const { offerService } = await import('../services/billing/offer.service');
  const { promotionService, PromotionService, ALWAYS_PAID_DURING_FREE_BETA } = await import('../services/billing/promotion.service');
  const { Promotion } = await import('../schemas/promotion.schema');
  const { DEFAULT_QUOTA_LIMITS } = await import('../models/usage-quota.model');

  const user = () => `check-${randomUUID()}`;
  const project = () => `project-${randomUUID()}`;
  const base = {
    state: 'active',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: null,
    audience: { everyone: true },
    display: { banner: false, title: '', message: '', strikethrough: true, badge: '' },
  };

  section('1. Bêta gratuite');
  const beta = await promotionService.create({
    ...base,
    name: 'Bêta gratuite (contrôle)',
    kind: 'campaign',
    priority: 100,
    discount: { type: 'free', value: 0 },
    scope: { all: true, services: [], items: [], excludeItems: ALWAYS_PAID_DURING_FREE_BETA },
    quotas: { enabled: true, timesPerDay: 5, limits: { flagship: { day: 40, week: null, month: null } }, spendCapsUsd: { day: 75, week: null, month: null } },
  });
  {
    const u = user();
    const p = project();
    const unlock = await ownershipService.unlock(u, p, 'business_plan', 'final');
    check('version finale du business plan débloquée à 0 F, solde vide', unlock.ok && unlock.chargedXaf === 0, unlock);
    check('le livrable est bien possédé', Boolean(await ownershipService.get(u, p, 'business_plan')));
    const pass = await offerService.buy(u, { kind: 'pass', code: 'croissance', interval: 'month' });
    check(`IDEM Croissance (${PASSES.croissance.monthlyXaf} F) souscrit à 0 F`, pass.ok && pass.chargedXaf === 0, pass);
    const pack = await offerService.buy(u, { kind: 'pack', code: 'lancement', projectId: p });
    check(`Pack Lancement (${PACKS.lancement.priceXaf} F) souscrit à 0 F`, pack.ok && pack.chargedXaf === 0, pack);
    const excluded = await offerService.buy(u, { kind: 'pack', code: 'a_plusieurs' });
    check('« À plusieurs » (exclu : codes revendables) reste payant', !excluded.ok && 'error' in excluded && excluded.error === 'insufficient_balance', excluded);
    const quote = await promotionService.quote(u, 'pass.entreprise', PASSES.entreprise.monthlyXaf);
    check('le devis affiché dit 0 F (même calcul que le débit)', quote.finalXaf === 0 && quote.free);
    const stats = (await Promotion.findById(beta.id).lean())!.stats;
    check('le coût de la campagne est compté (3 remises)', stats.redemptions === 3 && stats.discountXaf === DELIVERABLES.business_plan.priceXaf + PASSES.croissance.monthlyXaf + PACKS.lancement.priceXaf, stats);
    const publicList = await promotionService.publicSnapshot(null);
    check('visible des visiteurs non connectés (prix barrés de la landing)', publicList.promotions.some((entry) => entry.id === beta.id));
  }

  section('2. Fin de la campagne');
  {
    await promotionService.end(beta.id, 'check', 'fin du contrôle');
    const u = user();
    await walletService.topUp(u, 3000);
    const unlock = await ownershipService.unlock(u, project(), 'pitch_deck', 'final');
    check(`le pitch deck coûte de nouveau ${DELIVERABLES.pitch_deck.priceXaf} F`, unlock.ok && unlock.chargedXaf === DELIVERABLES.pitch_deck.priceXaf, unlock);
    const ended = await Promotion.findById(beta.id).lean();
    check('la fin est datée et signée', Boolean(ended?.endedAt) && ended?.endedBy === 'check' && ended?.state === 'ended');
    let refused = false;
    try {
      await promotionService.setState(beta.id, 'active');
    } catch {
      refused = true;
    }
    check('une campagne terminée ne se relance pas (on la duplique)', refused);
  }

  section('3. -50 % sur iCode, un achat par compte');
  const icode = await promotionService.create({
    ...base,
    name: 'iCode -50 %',
    kind: 'campaign',
    discount: { type: 'percent', value: 50 },
    scope: { all: false, services: ['icode'], items: [], excludeItems: [] },
    limits: { perUser: 1 },
  });
  {
    const u = user();
    await walletService.topUp(u, 3000);
    const first = await offerService.buyProjectPass(u, project());
    check(`premier Pass Projet à ${ICODE.projectPassXaf / 2} F`, first.ok && first.chargedXaf === ICODE.projectPassXaf / 2, first);
    const second = await offerService.buyProjectPass(u, project());
    check(`second Pass Projet au prix normal (${ICODE.projectPassXaf} F)`, second.ok && second.chargedXaf === ICODE.projectPassXaf, second);
    const other = await promotionService.quote(u, 'pass.croissance', 3000);
    check('un forfait (hors famille iCode) n’est pas remisé', other.finalXaf === 3000);
  }
  await promotionService.end(icode.id, 'check');

  section('4. Plafond du Kit remisé');
  const idem = await promotionService.create({
    ...base,
    name: 'Livrables -50 %',
    kind: 'campaign',
    discount: { type: 'percent', value: 50 },
    scope: { all: false, services: ['idem'], items: [], excludeItems: [] },
  });
  {
    const u = user();
    const p = project();
    await walletService.topUp(u, 5000);
    const a = await ownershipService.unlock(u, p, 'logo_brand', 'final');
    const b = await ownershipService.unlock(u, p, 'business_plan', 'final');
    const paid = (a.ok ? a.chargedXaf : -1) + (b.ok ? b.chargedXaf : -1);
    check(`750 F + 500 F : on s'arrête à la moitié du Kit (${KIT_CAP_XAF / 2} F)`, paid === KIT_CAP_XAF / 2, { a, b });
    check('et tout le Kit est débloqué', b.ok && b.kitComplete === true, b);
  }
  await promotionService.end(idem.id, 'check');

  section('5. Code promo');
  const coupon = await promotionService.create({
    ...base,
    name: 'Code partenaire',
    kind: 'coupon',
    code: 'partenaire26',
    stackable: true,
    discount: { type: 'fixed', value: 500 },
    scope: { all: false, services: [], items: ['pack.lancement'], excludeItems: [] },
    walletCreditXaf: 300,
    limits: { claims: 1 },
  });
  {
    const u = user();
    check('le code est enregistré en majuscules', coupon.code === 'PARTENAIRE26');
    const before = await promotionService.quote(u, 'pack.lancement', PACKS.lancement.priceXaf);
    check('sans saisie, le coupon ne s’applique pas', before.finalXaf === PACKS.lancement.priceXaf);
    const claim = await offerService.redeemCode(u, 'partenaire26');
    check('saisi dans le champ « code » du portefeuille', claim.ok, claim);
    check('300 F offerts au portefeuille', (await walletService.balance(u)) === 300);
    const after = await promotionService.quote(u, 'pack.lancement', PACKS.lancement.priceXaf);
    check(`puis -500 F sur le Pack Lancement (${PACKS.lancement.priceXaf - 500} F)`, after.finalXaf === PACKS.lancement.priceXaf - 500, after);
    const again = await offerService.redeemCode(u, 'PARTENAIRE26');
    check('une seconde saisie est refusée', !again.ok, again);
    const other = await offerService.redeemCode(user(), 'PARTENAIRE26');
    check('au-delà du nombre de saisies prévu, refusé', !other.ok && 'error' in other && other.error === 'exhausted', other);
    const unknown = await offerService.redeemCode(user(), 'INCONNU-123');
    check('un code inconnu reste « introuvable »', !unknown.ok && 'error' in unknown && unknown.error === 'unknown_code', unknown);
  }
  await promotionService.end(coupon.id, 'check');

  section('6. Bonus de recharge');
  const bonus = await promotionService.create({ ...base, name: 'Recharge +20 %', kind: 'campaign', discount: { type: 'percent', value: 0 }, scope: { all: false, services: [], items: [], excludeItems: [] }, topupBonusPercent: 20 });
  {
    const u = user();
    const result = await walletService.topUp(u, 1000);
    check('1 000 F rechargés → 1 200 F (sans palier sous 5 000 F)', result.balanceXaf === 1200 && result.bonusXaf === 200, result);
  }
  await promotionService.end(bonus.id, 'check');

  section('7. Crédits du jour');
  {
    const boostPromo = await promotionService.create({
      ...base,
      name: 'Crédits ×5',
      kind: 'campaign',
      discount: { type: 'free', value: 0 },
      scope: { all: false, services: [], items: [], excludeItems: [] },
      quotas: promotionService.quotaPreset(5),
    });
    const u = user();
    const boost = await promotionService.quotaBoost(u);
    const free = DEFAULT_QUOTA_LIMITS.free.flagship;
    const widened = PromotionService.widen(free, boost?.limits.flagship);
    check(`livrables complets : ${free.day} → ${widened.day} par jour`, (widened.day ?? 0) > (free.day ?? 0), widened);
    check('semaine et mois libres : une allocation QUOTIDIENNE', widened.week === null && widened.month === null, widened);
    const top = DEFAULT_QUOTA_LIMITS.top.appgen_edit;
    const kept = PromotionService.widen(top, { day: 1, week: null, month: null });
    check('une promotion ne réduit jamais une limite plus large', kept.day === top.day, kept);
    await promotionService.end(boostPromo.id, 'check');
    check('fin de campagne : plus de crédits élargis', (await promotionService.quotaBoost(u)) === null);
  }

  section('8. Budget épuisé');
  {
    const budget = await promotionService.create({
      ...base,
      name: 'Budget 1 500 F',
      kind: 'campaign',
      discount: { type: 'free', value: 0 },
      scope: { all: false, services: [], items: ['deliverable.legal_kit'], excludeItems: [] },
      limits: { budgetXaf: DELIVERABLES.legal_kit.priceXaf },
    });
    const a = user();
    const first = await ownershipService.unlock(a, project(), 'legal_kit', 'final');
    check('premier kit juridique offert', first.ok && first.chargedXaf === 0, first);
    const b = user();
    await walletService.topUp(b, 2000);
    const second = await ownershipService.unlock(b, project(), 'legal_kit', 'final');
    check('budget atteint : le suivant paie le prix normal', second.ok && second.chargedXaf === DELIVERABLES.legal_kit.priceXaf, second);
    const listed = (await promotionService.list()).find((entry) => entry.id === budget.id);
    check('le panel la voit « épuisée »', listed?.phase === 'exhausted', listed?.phase);
  }

  await mongoose.connection.dropDatabase();
  await mongoDBConnection.disconnect();
  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Promotions : bêta gratuite, fin de campagne, remises, plafonds, codes, bonus et crédits du jour conformes.');
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoDBConnection.disconnect().catch(() => undefined);
  process.exit(1);
});
