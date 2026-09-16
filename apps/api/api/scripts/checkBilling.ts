/**
 * Conformité du catalogue au modèle économique — `npm run check:billing`.
 *
 * Le catalogue en base est amorcé depuis `DEFAULT_PRODUCTS`, et ce fichier est
 * censé transcrire la section 7 du business plan. « Censé » est le mot : un
 * prix corrigé dans le document et oublié dans le code ne provoque aucune
 * erreur — la plateforme encaisse simplement le mauvais montant, et personne
 * ne s'en aperçoit avant le rapprochement comptable.
 *
 * Ce contrôle fige donc les valeurs du business plan et échoue si le code
 * s'en écarte. Il ne touche ni au réseau ni à la base : c'est une propriété
 * du code, vérifiable en une seconde avant chaque déploiement.
 *
 *   npx ts-node --transpile-only api/scripts/checkBilling.ts
 */

import {
  ANNUAL_DISCOUNT_RATE,
  APPGEN_PROJECT_PASS_CREDITS,
  BUNDLE_COMPOSITION,
  BUNDLE_CREDIT_SPLIT,
  BUSINESS_CREDIT_COSTS,
  CREDIT_ROLLOVER_MONTHS,
  DEFAULT_PRODUCTS,
  MAX_LOYALTY_BONUS_RATE,
  OVERAGE_RATES,
  annualPriceXaf,
} from '../models/billing.model';
import {
  SUPPORTED_COUNTRIES,
  buildCustomerMessage,
  convertFromXaf,
  explainFailure,
  formatAmountForPawapay,
  maskPhone,
  normalizePhone,
  POLL_SCHEDULE_MS,
} from '../models/payment.model';

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

const byCode = new Map(DEFAULT_PRODUCTS.map((product) => [product.code, product]));

/** Prix attendus, repris de la section 7 du business plan (montants en F CFA). */
const EXPECTED_PRICES: Record<string, number> = {
  // iBusiness — abonnements
  'business-discovery': 0,
  'business-essential': 2999,
  'business-growth': 7999,
  'business-cabinet': 19999,
  // iBusiness — packs
  'pack-identity': 1999,
  'pack-strategy': 2999,
  'pack-compliance': 2499,
  'pack-complete': 4999,
  // iMedia
  'social-starter': 1999,
  'social-pro': 4999,
  // iCode
  'appgen-discovery': 0,
  'appgen-starter': 2999,
  'appgen-pro': 9999,
  'appgen-studio': 24999,
  'appgen-project-pass': 999,
  'appgen-pass-24h': 500,
  'appgen-pass-7d': 1499,
  // iDeploy
  'ideploy-hobby': 0,
  'ideploy-starter': 2999,
  'ideploy-pro': 9999,
  'ideploy-scale': 24999,
  'ideploy-deploy-pack-10': 900,
  // Options managées
  'svc-waf': 1499,
  'svc-autoscaling': 1999,
  'svc-backups': 999,
  'svc-monitoring': 999,
  'svc-database': 999,
  'svc-logs': 499,
  'svc-static-ip': 1999,
  'svc-sovereign': 1999,
  // Recharges
  'recharge-boost': 500,
  'recharge-standard': 999,
  'recharge-growth': 2499,
  'recharge-power': 4999,
  // Bundles
  'bundle-launch': 7499,
  'bundle-complete': 29999,
};

/** Crédits attendus, même source. */
const EXPECTED_CREDITS: Record<string, number> = {
  'business-discovery': 5,
  'business-essential': 150,
  'business-growth': 500,
  'business-cabinet': 1500,
  'pack-identity': 80,
  'pack-strategy': 155,
  'pack-compliance': 120,
  'pack-complete': 265,
  'appgen-starter': 150,
  'appgen-pro': 550,
  'appgen-studio': 1500,
  'appgen-project-pass': 30,
  'appgen-pass-24h': 25,
  'appgen-pass-7d': 90,
  'recharge-boost': 25,
  'recharge-standard': 55,
  'recharge-growth': 145,
  'recharge-power': 320,
};

/**
 * Prix de référence des bundles, tels qu'annoncés dans le business plan.
 *
 * `unitTotalXaf` est le cumul mis en avant sur la page publique ; il ne se
 * réduit pas à la somme des produits du catalogue, parce qu'IDEM Complete
 * comprend **iMentor Premium à 10 000 F/mois** — un accompagnement humain, qui
 * n'a pas de code produit puisqu'il ne se livre pas depuis la plateforme.
 * D'où la distinction entre composants logiciels et services humains.
 */
const BUNDLE_REFERENCE: Record<
  string,
  { unitTotalXaf: number; discountPercent: number; humanServicesXaf: number }
> = {
  // iBusiness Essentiel + iCode Starter + iDeploy Starter = 8 997 F.
  'bundle-launch': { unitTotalXaf: 8997, discountPercent: 17, humanServicesXaf: 0 },
  // iBusiness Croissance + iCode Pro + iDeploy Pro (27 997 F) + iMentor Premium.
  'bundle-complete': { unitTotalXaf: 37997, discountPercent: 21, humanServicesXaf: 10000 },
};

/** Barème des livrables iBusiness (section « Le Système de Crédits iBusiness »). */
const EXPECTED_CREDIT_COSTS: Record<string, number> = {
  revision: 1,
  flyer: 2,
  ai_visual: 5,
  carousel: 5,
  business_card: 10,
  logo_relaunch: 10,
  editorial_calendar: 15,
  pitch_deck: 35,
  communication_strategy: 40,
  financial_forecast: 40,
  procedures_manual: 45,
  short_video: 60,
  logo_brand: 60,
  legal_kit: 65,
  business_plan: 70,
};

console.log('Conformité du catalogue au modèle économique\n');

// ============================================
section('Prix du catalogue');
// ============================================

for (const [code, expected] of Object.entries(EXPECTED_PRICES)) {
  const product = byCode.get(code);
  check(
    `${code} = ${expected} F`,
    product?.priceXaf === expected,
    product ? `catalogue : ${product.priceXaf} F` : 'produit absent du catalogue'
  );
}

// ============================================
section('Crédits inclus');
// ============================================

for (const [code, expected] of Object.entries(EXPECTED_CREDITS)) {
  const product = byCode.get(code);
  check(
    `${code} : ${expected} crédits`,
    product?.credits === expected,
    product ? `catalogue : ${product.credits}` : 'produit absent'
  );
}

check(
  'Project Pass : 30 crédits inclus',
  APPGEN_PROJECT_PASS_CREDITS === 30,
  String(APPGEN_PROJECT_PASS_CREDITS)
);

// ============================================
section('Barème des livrables');
// ============================================

for (const [action, expected] of Object.entries(EXPECTED_CREDIT_COSTS)) {
  const actual = (BUSINESS_CREDIT_COSTS as Record<string, number>)[action];
  check(`${action} = ${expected} crédits`, actual === expected, `barème : ${actual}`);
}

// ============================================
section('Règles transverses');
// ============================================

check('Remise annuelle = 2 mois offerts', Math.abs(ANNUAL_DISCOUNT_RATE - 2 / 12) < 1e-9);
check(
  'Un plan à 2 999 F/mois coûte 29 990 F/an',
  annualPriceXaf(2999) === 29990,
  String(annualPriceXaf(2999))
);
check('Report des crédits sur 2 mois', CREDIT_ROLLOVER_MONTHS === 2);
check('Bonus de fidélité plafonné à +30 %', MAX_LOYALTY_BONUS_RATE === 0.3);
check('Déploiement hors forfait à 100 F', OVERAGE_RATES.deployment === 100);
check('Bande passante hors forfait à 25 F/Go', OVERAGE_RATES.bandwidth_gb === 25);

// ============================================
section('Bundles');
// ============================================

for (const [bundleCode, parts] of Object.entries(BUNDLE_COMPOSITION)) {
  const bundle = byCode.get(bundleCode);

  check(`${bundleCode} : présent au catalogue`, Boolean(bundle));

  // Chaque composant doit exister, sinon l'acheteur paie un plan qui n'ouvre rien.
  for (const part of parts) {
    check(
      `${bundleCode} → ${part.productCode} existe`,
      byCode.has(part.productCode),
      'composant introuvable'
    );
  }

  check(
    `${bundleCode} : un moteur au plus une fois`,
    new Set(parts.map((part) => part.engine)).size === parts.length
  );

  const reference = BUNDLE_REFERENCE[bundleCode];
  const softwareTotal = parts.reduce(
    (total, part) => total + (byCode.get(part.productCode)?.priceXaf ?? 0),
    0
  );

  check(
    `${bundleCode} : moins cher que le cumul annoncé (${bundle?.priceXaf} F < ${reference.unitTotalXaf} F)`,
    (bundle?.priceXaf ?? 0) < reference.unitTotalXaf
  );

  // La remise affichée doit correspondre au calcul, à un point près (le
  // business plan arrondit). Un écart plus large serait une promesse fausse.
  const actualDiscount = Math.round((1 - (bundle?.priceXaf ?? 0) / reference.unitTotalXaf) * 100);
  check(
    `${bundleCode} : remise annoncée ${reference.discountPercent} % (calculée : ${actualDiscount} %)`,
    Math.abs(actualDiscount - reference.discountPercent) <= 1
  );

  // Le cumul annoncé dépasse le prix des composants logiciels quand le bundle
  // inclut un service humain (iMentor), qui n'est pas au catalogue.
  check(
    `${bundleCode} : cumul annoncé cohérent avec les composants (${softwareTotal} F logiciels + ${reference.humanServicesXaf} F de services)`,
    softwareTotal + reference.humanServicesXaf === reference.unitTotalXaf,
    `attendu ${reference.unitTotalXaf} F`
  );

  // La répartition des crédits doit correspondre aux plans réellement ouverts.
  const split = BUNDLE_CREDIT_SPLIT[bundleCode] ?? {};
  for (const part of parts) {
    const partCredits = byCode.get(part.productCode)?.credits ?? 0;
    const declared = split[part.engine] ?? 0;
    if (partCredits === 0 && declared === 0) continue;

    check(
      `${bundleCode} : ${part.engine} = ${partCredits} crédits`,
      declared === partCredits,
      `répartition déclarée : ${declared}`
    );
  }
}

// ============================================
section('Pays et devises');
// ============================================

for (const country of SUPPORTED_COUNTRIES) {
  check(
    `${country.code} en zone franc (${country.currency})`,
    country.currency === 'XAF' || country.currency === 'XOF'
  );
  check(`${country.code} : indicatif numérique`, /^\d{3}$/.test(country.prefix));
}

check('Le F CFA n’a pas de décimales au Cameroun', SUPPORTED_COUNTRIES[0].decimals === 0);
check('Parité XAF/XOF respectée', convertFromXaf(2999, 'XOF') === 2999);

let conversionRefused = false;
try {
  convertFromXaf(2999, 'NGN');
} catch {
  conversionRefused = true;
}
check('Une devise hors zone franc est refusée explicitement', conversionRefused);

// ============================================
section('Format des montants');
// ============================================

check('2 999 F → « 2999 »', formatAmountForPawapay(2999, 0) === '2999');
check('Arrondi à l’entier en zone franc', formatAmountForPawapay(2999.4, 0) === '2999');
check('Deux décimales : « 12.5 » et non « 12.50 »', formatAmountForPawapay(12.5, 2) === '12.5');
check('Deux décimales : « 12 » et non « 12.00 »', formatAmountForPawapay(12, 2) === '12');

// Motif imposé par pawaPay pour le champ `amount`.
const amountPattern = /^([0]|([1-9][0-9]{0,17}))([.][0-9]{0,3}[1-9])?$/;
check('Le format respecte le motif de l’API', amountPattern.test(formatAmountForPawapay(2999, 0)));
check(
  'Le format décimal respecte le motif de l’API',
  amountPattern.test(formatAmountForPawapay(12.5, 2))
);

// ============================================
section('Message affiché à l’abonné');
// ============================================

const messages = [
  buildCustomerMessage('Pack Identité'),
  buildCustomerMessage('Business Plan complet & charte'),
  buildCustomerMessage('A'),
  buildCustomerMessage('Simulation Approfondie + rapport détaillé'),
];

for (const message of messages) {
  check(
    `« ${message} » : 4 à 22 caractères alphanumériques`,
    message.length >= 4 && message.length <= 22 && /^[a-zA-Z0-9 ]+$/.test(message),
    `longueur ${message.length}`
  );
}

check(
  'Les accents sont retirés, pas remplacés par des points d’interrogation',
  buildCustomerMessage('Identité').includes('Identite')
);

// ============================================
section('Numéros de téléphone');
// ============================================

const cameroon = SUPPORTED_COUNTRIES[0];
check(
  'Saisie locale « 06 51 23 45 67 » → indicatif ajouté',
  normalizePhone('06 51 23 45 67', cameroon) === '237651234567',
  normalizePhone('06 51 23 45 67', cameroon)
);
check(
  'Saisie internationale « +237 651 23 45 67 » inchangée',
  normalizePhone('+237 651 23 45 67', cameroon) === '237651234567',
  normalizePhone('+237 651 23 45 67', cameroon)
);
check(
  'Préfixe « 00 » retiré',
  normalizePhone('00237651234567', cameroon) === '237651234567',
  normalizePhone('00237651234567', cameroon)
);

const masked = maskPhone('237653456789');
check(`Masque « ${masked} » : ne révèle pas le numéro`, !masked.includes('653456'), masked);
check('Masque : garde les deux derniers chiffres', masked.endsWith('89'));

// ============================================
section('Codes d’échec');
// ============================================

/** Codes documentés par pawaPay, qu'un abonné peut réellement rencontrer. */
const DOCUMENTED_CODES = [
  'PAYMENT_NOT_APPROVED',
  'INSUFFICIENT_BALANCE',
  'PAYMENT_IN_PROGRESS',
  'PAYER_NOT_FOUND',
  'PAYER_LIMIT_REACHED',
  'WALLET_LIMIT_REACHED',
  'UNSPECIFIED_FAILURE',
  'UNKNOWN_ERROR',
  'INVALID_AMOUNT',
  'AMOUNT_OUT_OF_BOUNDS',
  'INVALID_CURRENCY',
  'INVALID_PROVIDER',
  'INVALID_PHONE_NUMBER',
  'PROVIDER_TEMPORARILY_UNAVAILABLE',
  'DEPOSITS_NOT_ALLOWED',
  'DEPOSIT_ALREADY_REFUNDED',
  'AMOUNT_TOO_LARGE',
  'REFUND_IN_PROGRESS',
];

for (const code of DOCUMENTED_CODES) {
  const explanation = explainFailure(code);
  check(
    `${code} : message en français`,
    explanation.message.length > 10 && !explanation.message.includes(code),
    explanation.message
  );
}

const unknown = explainFailure('UN_CODE_QUI_NEXISTE_PAS');
check('Un code inconnu produit quand même un message', unknown.message.length > 10);
check('Un code absent produit un message', explainFailure(undefined).message.length > 10);

// ============================================
section('Relecture des statuts');
// ============================================

check(
  'Les délais de relecture sont croissants',
  POLL_SCHEDULE_MS.every((delay, index) => index === 0 || delay > POLL_SCHEDULE_MS[index - 1])
);
check('La première relecture a lieu dans la minute', POLL_SCHEDULE_MS[0] <= 60_000);

// ============================================
console.log(
  failures === 0
    ? '\n✓ Le catalogue est conforme au modèle économique.'
    : `\n✗ ${failures} écart(s) avec le modèle économique.`
);

process.exit(failures === 0 ? 0 : 1);
