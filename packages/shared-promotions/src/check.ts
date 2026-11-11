/**
 * Contrôle du calcul des promotions : `npm run check:promotions` (racine du dépôt).
 * Sans réseau ni base : uniquement les règles partagées par l'API et les écrans.
 */
import { discountOf, itemOfSpend, localAmountAfter, phaseOf, priceWithPromotions, rewriteAmount, scopeMatches, type PricedPromotion } from './index';

let failures = 0;
function check(label: string, condition: boolean): void {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.error(`  KO  ${label}`);
  }
}

const scopeAll = { all: true, services: [], items: [], excludeItems: ['pack.a_plusieurs', 'idomain.domain'] };
const beta: PricedPromotion = { id: 'beta', priority: 100, stackable: false, discount: { type: 'free', value: 0 }, scope: scopeAll };
const icode30: PricedPromotion = { id: 'icode30', priority: 10, stackable: false, discount: { type: 'percent', value: 30 }, scope: { all: false, services: ['icode'], items: [], excludeItems: [] } };
const coupon500: PricedPromotion = { id: 'c500', priority: 5, stackable: true, discount: { type: 'fixed', value: 500 }, scope: { all: false, services: [], items: ['pack.lancement'], excludeItems: [] } };

console.log('Articles');
check('unlock_business_plan → deliverable.business_plan', itemOfSpend('unlock_business_plan') === 'deliverable.business_plan');
check('pass_croissance → pass.croissance', itemOfSpend('pass_croissance') === 'pass.croissance');
check('pack_a_plusieurs → pack.a_plusieurs', itemOfSpend('pack_a_plusieurs') === 'pack.a_plusieurs');
check('meter_day → ideploy.meter', itemOfSpend('meter_day', 'ideploy') === 'ideploy.meter');
check('simulation_deep → isimulate.deep', itemOfSpend('simulation_deep', 'simulation') === 'isimulate.deep');
check('domaine (feature idomain) → idomain.domain', itemOfSpend('order', 'idomain') === 'idomain.domain');
check('flyer → communication.flyer', itemOfSpend('flyer', 'business') === 'communication.flyer');
check('icode_message → icode.modification', itemOfSpend('icode_message', 'appgen') === 'icode.modification');
check('action inconnue → null', itemOfSpend('mystere') === null);

console.log('Portée');
check('tout sauf exclusions : pack.lancement visé', scopeMatches(scopeAll, 'pack.lancement'));
check('tout sauf exclusions : pack.a_plusieurs exclu', !scopeMatches(scopeAll, 'pack.a_plusieurs'));
check('famille icode : icode.project_pass visé', scopeMatches(icode30.scope, 'icode.project_pass'));
check('famille icode : pass.croissance non visé', !scopeMatches(icode30.scope, 'pass.croissance'));

console.log('Remises');
check('gratuit : 2 500 → 0', discountOf({ type: 'free', value: 0 }, 2500) === 2500);
check('30 % de 1 000 = 300', discountOf({ type: 'percent', value: 30 }, 1000) === 300);
check('remise fixe bornée au prix', discountOf({ type: 'fixed', value: 5000 }, 1000) === 1000);

const free = priceWithPromotions([beta, icode30], 'icode.project_pass', 1000);
check('la plus avantageuse des exclusives gagne (gratuit > 30 %)', free.finalXaf === 0 && free.free && free.applied[0].id === 'beta');
const stacked = priceWithPromotions([icode30, coupon500], 'pack.lancement', 5000);
check('cumulable seule sur un article hors famille : 5 000 - 500', stacked.finalXaf === 4500 && !stacked.proportional);
const both = priceWithPromotions([{ ...icode30, scope: scopeAll }, coupon500], 'pack.lancement', 5000);
check('exclusive puis cumulable : 5 000 → 3 500 → 3 000', both.finalXaf === 3000 && both.applied.length === 2);
check('exclu reste plein tarif', priceWithPromotions([beta], 'pack.a_plusieurs', 20000).finalXaf === 20000);
check('article inconnu : jamais remisé', priceWithPromotions([beta], null, 1000).finalXaf === 1000);

console.log('Devise locale');
check('gratuit : 0 en devise locale', localAmountAfter(free, 45, 2) === 0);
const pct = priceWithPromotions([{ ...icode30, scope: scopeAll }], 'pass.croissance', 3000);
check('-30 % appliqué au prix local (60 GHS → 42)', localAmountAfter(pct, 60, 2) === 42);

console.log('Chaînes de prix');
check('« 10 F par jour » gratuit → « 0 F CFA par jour »', rewriteAmount('10 F par jour', () => 0) === '0 F\u202fCFA par jour');
check('« 3 000 F CFA » gratuit → « 0 F CFA »', rewriteAmount('3\u202f000 F CFA', () => 0) === '0 F CFA');
check('« 45 GHS » gratuit → « 0 GHS »', rewriteAmount('45 GHS', () => 0) === '0 GHS');
check('« 1 500 F » -30 % → « 1 050 F »', rewriteAmount('1 500 F', (n) => Math.round(n * 0.7)) === '1\u202f050 F');
check('« Gratuit » inchangé', rewriteAmount('Gratuit', () => 0) === 'Gratuit');

console.log('Phases');
const base = { state: 'active' as const, limits: {}, stats: { redemptions: 0, discountXaf: 0, claims: 0, topupBonusXaf: 0, walletCreditXaf: 0 } };
const now = new Date('2026-11-11T12:00:00Z');
check('en cours', phaseOf({ ...base, startsAt: '2026-11-01T00:00:00Z', endsAt: null }, now) === 'running');
check('programmée', phaseOf({ ...base, startsAt: '2026-12-01T00:00:00Z', endsAt: null }, now) === 'scheduled');
check('expirée', phaseOf({ ...base, startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' }, now) === 'expired');
check('épuisée (budget)', phaseOf({ ...base, limits: { budgetXaf: 1000 }, stats: { ...base.stats, discountXaf: 1000 }, startsAt: '2026-11-01T00:00:00Z', endsAt: null }, now) === 'exhausted');
check('terminée par l’équipe', phaseOf({ ...base, state: 'ended', startsAt: '2026-11-01T00:00:00Z', endsAt: null }, now) === 'ended');

if (failures > 0) {
  console.error(`\n${failures} contrôle(s) en échec.`);
  process.exit(1);
}
console.log('\nPromotions : tout est conforme.');
