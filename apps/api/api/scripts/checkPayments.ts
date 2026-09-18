/**
 * Sûreté de la chaîne d'encaissement — `npm run check:payments`.
 *
 * Trois propriétés sont vérifiées ici, et aucune ne se teste en production :
 *
 *  1. **La vérification de signature fonctionne, et rejette ce qu'elle doit
 *     rejeter.** Une signature qu'on ne sait pas invalider ne protège rien.
 *     Le script génère sa propre paire ECDSA P-256, signe un callback comme le
 *     ferait pawaPay, puis altère successivement le corps, le condensat et la
 *     signature.
 *  2. **La liste blanche d'IP se comporte comme prévu** dans les deux
 *     environnements et avec surcharge.
 *  3. **La machine d'états ne laisse pas passer de conclusion hâtive** : un
 *     statut inconnu reste « en cours », un doublon vaut acceptation.
 *
 * Sans réseau ni base de données.
 *
 *   npx ts-node --transpile-only api/scripts/checkPayments.ts
 */

import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';

// Même ordre de chargement que l'application, pour tester la configuration
// réelle et non une configuration reconstituée.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.secret') });

import {
  FINAL_PAYMENT_STATUSES,
  PENDING_PAYMENT_STATUSES,
  isFinalPaymentStatus,
  mapPawapayStatus,
  nextPollDelayMs,
} from '../models/payment.model';
import { decryptValue, encryptValue, hashValue } from '../utils/crypto.util';

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

console.log('Sûreté de la chaîne d’encaissement\n');

// ============================================
// SIGNATURE DES CALLBACKS
// ============================================

const KEY_ID = 'IDEM_TEST_KEY';
const CALLBACK_PATH = '/billing/webhooks/pawapay/deposits';
const AUTHORITY = 'api.idem.africa';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// La clé publique de test remplace celle du prestataire : le vérificateur la
// lit depuis l'environnement avant d'interroger le réseau.
process.env.PAWAPAY_PUBLIC_KEY = publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

// Importé APRÈS avoir posé la clé : le module lit l'environnement à l'appel,
// mais mieux vaut ne dépendre d'aucun ordre implicite.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const signatureModule = require('../services/payments/pawapay-signature') as typeof import('../services/payments/pawapay-signature');

const { verifyCallbackSignature, isCallbackIpAllowed, allowedCallbackIps, resetPublicKeyCache } =
  signatureModule;

/** Construit un callback signé comme pawaPay le ferait. */
function buildSignedCallback(body: Record<string, unknown>) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const digest = crypto.createHash('sha512').update(rawBody).digest('base64');
  const contentDigest = `sha-512=:${digest}:`;
  const signatureDate = new Date().toISOString();
  const contentType = 'application/json; charset=UTF-8';

  const created = Math.floor(Date.now() / 1000);
  const params = `;alg="ecdsa-p256-sha256";keyid="${KEY_ID}";created=${created};expires=${created + 60}`;
  const components = ['@method', '@authority', '@path', 'signature-date', 'content-digest', 'content-type'];

  const base = [
    `"@method": POST`,
    `"@authority": ${AUTHORITY}`,
    `"@path": ${CALLBACK_PATH}`,
    `"signature-date": ${signatureDate}`,
    `"content-digest": ${contentDigest}`,
    `"content-type": ${contentType}`,
    `"@signature-params": (${components.map((c) => `"${c}"`).join(' ')})${params}`,
  ].join('\n');

  // RFC 9421 impose la forme brute r‖s pour ECDSA, pas le DER de Node.
  const signature = crypto.sign('sha256', Buffer.from(base, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return {
    rawBody,
    headers: {
      'content-digest': contentDigest,
      'content-type': contentType,
      'signature-date': signatureDate,
      'signature-input': `sig-pp=(${components.map((c) => `"${c}"`).join(' ')})${params}`,
      signature: `sig-pp=:${signature.toString('base64')}:`,
    } as Record<string, string>,
  };
}

async function runSignatureChecks(): Promise<void> {
  section('Signature des callbacks (RFC 9421)');

  process.env.PAWAPAY_CALLBACK_SIGNATURE = 'enforce';
  resetPublicKeyCache();

  const body = {
    depositId: 'afb57b93-7849-49aa-babb-4c3ccbfe3d79',
    status: 'COMPLETED',
    amount: '2999',
    currency: 'XAF',
  };

  const signed = buildSignedCallback(body);

  const valid = await verifyCallbackSignature({
    method: 'POST',
    authority: AUTHORITY,
    path: CALLBACK_PATH,
    headers: signed.headers,
    rawBody: signed.rawBody,
  });
  check('Un callback authentique est accepté', valid.verdict === 'valid', valid.error ?? '');

  // Corps modifié : le condensat ne correspond plus. C'est le scénario d'un
  // montant changé en vol.
  const tamperedBody = await verifyCallbackSignature({
    method: 'POST',
    authority: AUTHORITY,
    path: CALLBACK_PATH,
    headers: signed.headers,
    rawBody: Buffer.from(JSON.stringify({ ...body, amount: '1' })),
  });
  check('Un corps modifié est rejeté', tamperedBody.verdict === 'invalid', tamperedBody.error ?? '');

  // Condensat recalculé sur le corps modifié : cette fois le condensat colle,
  // mais la signature couvre le condensat — elle doit tomber.
  const forged = { ...body, amount: '1' };
  const forgedRaw = Buffer.from(JSON.stringify(forged));
  const forgedDigest = `sha-512=:${crypto.createHash('sha512').update(forgedRaw).digest('base64')}:`;
  const forgedResult = await verifyCallbackSignature({
    method: 'POST',
    authority: AUTHORITY,
    path: CALLBACK_PATH,
    headers: { ...signed.headers, 'content-digest': forgedDigest },
    rawBody: forgedRaw,
  });
  check(
    'Un condensat recalculé sans la clé est rejeté',
    forgedResult.verdict === 'invalid',
    forgedResult.error ?? ''
  );

  // Signature d'un autre message.
  const other = buildSignedCallback({ ...body, depositId: 'autre' });
  const swapped = await verifyCallbackSignature({
    method: 'POST',
    authority: AUTHORITY,
    path: CALLBACK_PATH,
    headers: { ...signed.headers, signature: other.headers.signature },
    rawBody: signed.rawBody,
  });
  check('Une signature d’un autre message est rejetée', swapped.verdict === 'invalid');

  // Chemin différent de celui qui a été signé : rejeu vers un autre endpoint.
  const replayed = await verifyCallbackSignature({
    method: 'POST',
    authority: AUTHORITY,
    path: '/billing/webhooks/pawapay/refunds',
    headers: signed.headers,
    rawBody: signed.rawBody,
  });
  check('Un rejeu vers un autre chemin est rejeté', replayed.verdict === 'invalid');

  const missing = await verifyCallbackSignature({
    method: 'POST',
    authority: AUTHORITY,
    path: CALLBACK_PATH,
    headers: { 'content-type': 'application/json' },
    rawBody: signed.rawBody,
  });
  check('Une signature absente est signalée comme telle', missing.verdict === 'absent');

  process.env.PAWAPAY_CALLBACK_SIGNATURE = 'off';
  const skipped = await verifyCallbackSignature({
    method: 'POST',
    authority: AUTHORITY,
    path: CALLBACK_PATH,
    headers: signed.headers,
    rawBody: signed.rawBody,
  });
  check('Le mode « off » court-circuite la vérification', skipped.verdict === 'skipped');

  process.env.PAWAPAY_CALLBACK_SIGNATURE = 'log';
}

// ============================================
// LISTE BLANCHE D'IP
// ============================================

function runIpChecks(): void {
  section('Liste blanche d’IP');

  delete process.env.PAWAPAY_CALLBACK_IPS;
  process.env.PAWAPAY_ENV = 'sandbox';

  check('Bac à sable : l’IP officielle est acceptée', isCallbackIpAllowed('3.64.89.224'));
  check('Bac à sable : une autre IP est refusée', !isCallbackIpAllowed('203.0.113.7'));
  check(
    'Notation IPv6 mappée reconnue',
    isCallbackIpAllowed('::ffff:3.64.89.224'),
    'un proxy peut présenter l’IPv4 sous cette forme'
  );

  process.env.PAWAPAY_ENV = 'production';
  check('Production : la liste officielle est utilisée', allowedCallbackIps().length === 6);
  check('Production : IP de production acceptée', isCallbackIpAllowed('18.192.208.15'));
  check('Production : IP du bac à sable refusée', !isCallbackIpAllowed('3.64.89.224'));

  process.env.PAWAPAY_CALLBACK_IPS = '10.0.0.1, 10.0.0.2';
  check('La surcharge remplace la liste', isCallbackIpAllowed('10.0.0.2'));
  check('La surcharge exclut le reste', !isCallbackIpAllowed('18.192.208.15'));

  process.env.PAWAPAY_CALLBACK_IPS = '';
  delete process.env.PAWAPAY_CALLBACK_IPS;
  process.env.PAWAPAY_ENV = 'sandbox';
}

// ============================================
// MACHINE D'ÉTATS
// ============================================

function runStatusChecks(): void {
  section('Machine d’états');

  check('COMPLETED est final', isFinalPaymentStatus('COMPLETED'));
  check('FAILED est final', isFinalPaymentStatus('FAILED'));
  check('PROCESSING n’est pas final', !isFinalPaymentStatus('PROCESSING'));
  check(
    'IN_RECONCILIATION reste en attente',
    PENDING_PAYMENT_STATUSES.includes('IN_RECONCILIATION'),
    'pawaPay vérifie automatiquement : conclure serait prématuré'
  );
  check(
    'Aucun statut n’est à la fois final et en attente',
    FINAL_PAYMENT_STATUSES.every((status) => !PENDING_PAYMENT_STATUSES.includes(status))
  );

  check(
    'DUPLICATE_IGNORED vaut acceptation',
    mapPawapayStatus('DUPLICATE_IGNORED') === 'ACCEPTED',
    'c’est la réponse attendue d’une reprise après coupure réseau'
  );
  check('COMPLETED est repris tel quel', mapPawapayStatus('COMPLETED') === 'COMPLETED');
  check(
    'Un statut inconnu reste « en cours »',
    mapPawapayStatus('QUELQUE_CHOSE_DE_NOUVEAU') === 'PROCESSING',
    'ne jamais conclure à l’échec sur un statut qu’on ne connaît pas'
  );

  check('Le premier délai de relecture est court', nextPollDelayMs(0) <= 60_000);
  check(
    'Les relectures s’espacent au-delà du calendrier',
    nextPollDelayMs(99) >= 600_000,
    'inutile de harceler l’opérateur au bout d’une heure'
  );
}

// ============================================
// CHIFFREMENT DES DONNÉES SENSIBLES
// ============================================

function runCryptoChecks(): void {
  section('Chiffrement du numéro de téléphone');

  const phone = '237653456789';
  const encrypted = encryptValue(phone, 'idem-payment-phone');

  check('Le chiffré ne contient pas le numéro', !encrypted.includes(phone));
  check('Le déchiffrement restitue le numéro', decryptValue(encrypted, 'idem-payment-phone') === phone);
  check(
    'Un autre contexte ne déchiffre pas',
    decryptValue(encrypted, 'idem-deployment-vars') === null,
    'l’AAD sépare les usages'
  );
  check(
    'Deux chiffrements du même numéro diffèrent',
    encryptValue(phone, 'idem-payment-phone') !== encrypted,
    'le vecteur d’initialisation est aléatoire'
  );
  check('Une valeur corrompue renvoie null', decryptValue('nawak', 'idem-payment-phone') === null);

  check('L’empreinte est stable', hashValue(phone) === hashValue(phone));
  check('L’empreinte diffère d’un numéro à l’autre', hashValue(phone) !== hashValue('237653456788'));
  check('L’empreinte ne contient pas le numéro', !hashValue(phone).includes(phone));
}

// ============================================

async function main(): Promise<void> {
  await runSignatureChecks();
  runIpChecks();
  runStatusChecks();
  runCryptoChecks();

  console.log(
    failures === 0
      ? '\n✓ La chaîne d’encaissement se comporte comme prévu.'
      : `\n✗ ${failures} contrôle(s) en échec.`
  );

  process.exit(failures === 0 ? 0 : 1);
}

void main();
