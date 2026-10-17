/**
 * `npm run check:pricing` — le moteur de prix seul, sans base ni réseau.
 *
 * Ce qu'il prouve : le prix public ne dépend pas du fournisseur ; le moins cher des fournisseurs
 * ADMISSIBLES est retenu (et le deuxième est noté) ; un fournisseur en panne, incapable, sans
 * coût, premium ou sans le nom disponible est écarté ; aucune vente sous la marge minimale ; une
 * vente financée (pack, forfait Entreprise) peut l'être ; P_min suit la formule du plan §9.2.
 */
import assert from 'node:assert/strict';
import { DEFAULT_RULES, ProviderOffer, minimumPriceXaf, operationCost, publicPriceXaf, selectProvider } from '../src/modules/pricing/engine';

const rules = DEFAULT_RULES;
const base = (over: Partial<ProviderOffer>): ProviderOffer => ({
  providerCode: 'a',
  priority: 10,
  enabled: true,
  configured: true,
  health: 'up',
  capable: true,
  minYears: 1,
  maxYears: 10,
  currency: 'USD',
  xafPerUnit: 577,
  costs: { register: 11.31, renew: 11.31, transfer: 11.31 },
  membershipFeeYear: 0,
  expectedOperationsYear: 100,
  feePerOperation: 0,
  ...over,
});

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('Moteur de prix iDomain');

check('.com chez Domain Name API (plan §9.2) : 6 526 F de coût, vendable à 8 900 F', () => {
  const s = selectProvider([base({ providerCode: 'domainnameapi' })], 'register', 1, 8900, rules);
  assert.equal(s.selected?.providerCode, 'domainnameapi');
  assert.equal(s.selected?.totalCostXaf, 6526);
  // 8 900 × (1 − 3 % − 5 %) − 250 − 6 526
  assert.equal(s.selected?.marginXaf, 1412);
});

check('le moins cher des admissibles est retenu, le deuxième est noté', () => {
  const s = selectProvider(
    [base({ providerCode: 'cher', costs: { register: 11.2 } }), base({ providerCode: 'moins-cher', costs: { register: 8.1 } }), base({ providerCode: 'moyen', costs: { register: 9.3 } })],
    'register',
    1,
    8900,
    rules
  );
  assert.equal(s.selected?.providerCode, 'moins-cher');
  assert.equal(s.second?.providerCode, 'moyen');
});

check("l'abonnement revendeur réparti compte dans le coût total (Openprovider, 49,92 $/an sur 100 opérations)", () => {
  const s = selectProvider([base({ providerCode: 'openprovider', costs: { register: 7.7 }, membershipFeeYear: 49.92 })], 'register', 1, 6500, rules);
  assert.equal(s.selected?.totalCostXaf, Math.round((7.7 + 0.4992) * 577));
});

check('un fournisseur en panne, incapable, désactivé, non configuré ou sans coût est écarté', () => {
  const s = selectProvider(
    [
      base({ providerCode: 'panne', health: 'down', costs: { register: 1 } }),
      base({ providerCode: 'incapable', capable: false, costs: { register: 1 } }),
      base({ providerCode: 'off', enabled: false, costs: { register: 1 } }),
      base({ providerCode: 'sans-cles', configured: false, costs: { register: 1 } }),
      base({ providerCode: 'sans-cout', costs: {} }),
      base({ providerCode: 'ok' }),
    ],
    'register',
    1,
    8900,
    rules
  );
  assert.equal(s.selected?.providerCode, 'ok');
  const reasons = Object.fromEntries(s.offers.map((o) => [o.providerCode, o.reason]));
  assert.deepEqual(reasons, { panne: 'down', incapable: 'not_capable', off: 'disabled', 'sans-cles': 'not_configured', 'sans-cout': 'no_cost', ok: undefined });
});

check('un fournisseur dégradé passe après un fournisseur sain un peu plus cher', () => {
  const s = selectProvider([base({ providerCode: 'degrade', health: 'degraded', costs: { register: 10 } }), base({ providerCode: 'sain', costs: { register: 10.3 } })], 'register', 1, 8900, rules);
  assert.equal(s.selected?.providerCode, 'sain');
});

check('nom indisponible ou premium chez un fournisseur : écarté chez lui seulement', () => {
  const s = selectProvider([base({ providerCode: 'pris', available: false, costs: { register: 5 } }), base({ providerCode: 'premium', premium: true, costs: { register: 5 } }), base({ providerCode: 'libre', available: true })], 'register', 1, 8900, rules);
  assert.equal(s.selected?.providerCode, 'libre');
});

check('le coût annoncé en direct prime sur le coût stocké', () => {
  const s = selectProvider([base({ providerCode: 'direct', liveCost: 11 })], 'register', 1, 8900, rules);
  assert.equal(s.offers[0].totalCostXaf, Math.round(11 * 577));
  assert.equal(s.selected?.providerCode, 'direct');
});

check('jamais sous la marge minimale : un coût devenu trop haut bloque la vente', () => {
  const s = selectProvider([base({ costs: { register: 12.5 } })], 'register', 1, 8900, rules);
  assert.equal(s.selected, null);
  assert.equal(s.offers[0].reason, 'margin_below_minimum');
});

check('une vente financée (pack au coût, 4 900 F le .africa) passe malgré une marge négative', () => {
  const offer = base({ providerCode: 'openprovider', costs: { register: 7.7 }, membershipFeeYear: 49.92 });
  assert.equal(selectProvider([offer], 'register', 1, 4900, rules).selected, null);
  const funded = selectProvider([offer], 'register', 1, 4900, rules, true);
  assert.equal(funded.selected?.providerCode, 'openprovider');
  assert.ok((funded.selected?.marginXaf ?? 0) < 0);
  assert.equal(selectProvider([offer], 'register', 1, 4900, { ...rules, allowLossOnFundedPromotions: false }, true).selected, null);
});

check('durée hors des bornes du fournisseur : écarté', () => {
  const s = selectProvider([base({ maxYears: 2 })], 'register', 3, 8900 * 3, rules);
  assert.equal(s.offers[0].reason, 'years_out_of_range');
});

check('coût sur plusieurs années : 1ʳᵉ année au prix de l’opération, puis au renouvellement', () => {
  assert.equal(operationCost({ costs: { register: 7.7, renew: 9.7 } }, 'register', 3), 27.1);
  assert.equal(operationCost({ costs: { renew: 9.7 } }, 'renew', 2), 19.4);
});

check('prix public : identique quel que soit le fournisseur, au coût pour un pack, promotion prioritaire', () => {
  const row = { register_xaf: 6500, renew_xaf: 8000, transfer_xaf: null, pack_xaf: 4900 };
  assert.equal(publicPriceXaf(row, 'register', 1), 6500);
  assert.equal(publicPriceXaf(row, 'register', 3), 6500 + 2 * 8000);
  assert.equal(publicPriceXaf(row, 'register', 1, { atCost: true }), 4900);
  assert.equal(publicPriceXaf(row, 'register', 1, { promotionXaf: 3900 }), 3900);
  assert.equal(publicPriceXaf(row, 'transfer', 1), null);
});

check('P_min = (coût + support) / (1 − f − b − m), à la centaine supérieure', () => {
  // (6 526 + 250) / 0,77 = 8 800
  assert.equal(minimumPriceXaf(6526, rules), 8800);
});

console.log(`\n${passed} vérifications passées.`);
