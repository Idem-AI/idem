/**
 * Contrôle de la CONFIDENTIALITÉ par le code — `npm run check:privacy`. Aucun appel réseau, aucune donnée réelle.
 *
 *  1. le garde impose `data_collection: 'deny'` même quand l'appelant pose son propre `provider` ;
 *  2. il refuse un sous-traitant hors registre, une finalité soumise à consentement, un niveau trop haut ;
 *  3. chaque envoi vers un modèle, dans le code, passe par le garde (lecture statique des sources) ;
 *  4. les journaux n'emportent ni description de projet, ni analyse, ni conversation.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { guardModelRequest, PrivacyGuardError } from '../services/privacy/privacy-guard';
import { openRouterRouting } from '../config/openrouter.config';
import { openRouterCallOptions } from '../services/creativity/orchestrator';
import { PROCESSORS, PURPOSES, DATA_CATEGORIES } from '../config/data-governance';
import { sanitizeInfo } from '../config/log-format';
import { decryptValue, encryptValue, isSealed, needsReencryption, openSecret, sealSecret } from '../utils/crypto.util';
import { githubTokenAad } from '../services/github.service';

// 1. Politique de transmission, fusion en profondeur.
const creative = openRouterCallOptions({ schema: { name: 'x', schema: {} } } as any);
const callerProvider = (creative.extraBody as any)?.provider;
assert.ok(callerProvider && !callerProvider.data_collection, 'l’orchestrateur pose bien son propre `provider` (le cas qui fuyait)');
const flatMerge = { model: 'm', ...openRouterRouting(), ...(creative.extraBody ?? {}) };
assert.equal((flatMerge as any).provider.data_collection, undefined, 'sans garde, la fusion à plat perd la politique');
const guarded = guardModelRequest('openrouter', flatMerge as Record<string, any>);
assert.equal(guarded.provider.data_collection, 'deny', 'le garde repose la politique');
assert.deepEqual(guarded.provider.quantizations, callerProvider.quantizations, 'les réglages de l’appelant sont gardés');
assert.equal(guardModelRequest('openrouter', { provider: { data_collection: 'allow' } }).provider.data_collection, 'deny', 'un appelant ne peut pas relâcher');
assert.equal((openRouterRouting() as any).provider.data_collection, 'deny');
process.env.OPENROUTER_ZDR = 'on';
assert.equal(guardModelRequest('openrouter', {} as Record<string, any>).provider.zdr, true, 'OPENROUTER_ZDR=on exige la conservation nulle');
delete process.env.OPENROUTER_ZDR;
assert.equal((guardModelRequest('idem_selfhosted', { a: 1 }) as any).provider, undefined, 'nos serveurs : corps inchangé');

// 2. Refus.
assert.throws(() => guardModelRequest('inconnu' as any, {}), PrivacyGuardError);
assert.throws(() => guardModelRequest('openrouter', {}, { purpose: 'AI_RESEARCH' }), PrivacyGuardError, 'recherche IA = consentement requis');
assert.throws(() => guardModelRequest('openrouter', {}, { classification: 'L3' }), PrivacyGuardError, 'aucun secret vers un modèle');
assert.throws(() => guardModelRequest('openrouter', {}, { purpose: 'PRODUCT_ANALYTICS', classification: 'L2' }), PrivacyGuardError, 'l’analytique ne lit pas les projets');
assert.ok(Object.values(PURPOSES).filter((p) => p.requiresConsent).every((p) => p.legalBasis === 'consent'));
for (const [id, c] of Object.entries(DATA_CATEGORIES)) {
  assert.ok(c.purposes.length && c.stores.length && c.retentionTarget, `catégorie ${id} incomplète`);
}

// 3. Aucun envoi vers un modèle sans le garde (lecture des sources de l'API).
const root = path.resolve(__dirname, '..');
const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['scripts', 'node_modules'].includes(entry.name)) walk(full);
    } else if (entry.name.endsWith('.ts')) files.push(full);
  }
};
walk(root);
const unguarded: string[] = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const sendsToModel = /chat\.completions\.create\(|axios\.post[^(]*\(\s*$|`\$\{(OPENROUTER_BASE_URL\(\)|base)\}\/(images|videos|chat\/completions|audio\/speech)`/.test(line);
    if (!sendsToModel) return;
    const window = lines.slice(i, i + 8).join('\n');
    if (!/\/(images|videos|chat\/completions|audio\/speech)|chat\.completions\.create/.test(window)) return;
    if (!/guardModelRequest\(/.test(window)) unguarded.push(`${path.relative(root, file)}:${i + 1}`);
  });
}
assert.deepEqual(unguarded, [], `envois vers un modèle sans le garde :\n  ${unguarded.join('\n  ')}`);

// 4. Journaux.
const fmt = sanitizeInfo();
const line = fmt.transform({
  level: 'info',
  message: 'Project data fetched',
  longDescription: 'Une plateforme qui permet aux agriculteurs sans smartphone de commander leurs intrants et de vendre leurs récoltes par SMS, avec un modèle de commission',
  analysisResultModel: { branding: { logo: { concept: 'secret' } }, businessPlan: {} },
  messages: [{ role: 'user', content: 'mon idée confidentielle' }],
  result: JSON.stringify({ caY1: 6650000, resultatNetY1: -83811333, detail: 'x'.repeat(200) }),
  email: 'quelqu.un@example.com',
  durationMs: 12,
} as any) as Record<string, unknown>;
const serialized = JSON.stringify(line);
assert.ok(!serialized.includes('commission'), 'description de projet tronquée');
assert.ok(!serialized.includes('secret') && String(line.analysisResultModel).startsWith('[contenu métier'), 'analyse réduite à sa forme');
assert.ok(!serialized.includes('confidentielle'), 'conversation réduite à sa forme');
assert.ok(String(line.result).length < 120, 'résultat d’outil tronqué');
assert.ok(!serialized.includes('quelqu.un'), 'e-mail masqué');
assert.equal(line.durationMs, 12, 'les mesures techniques restent');
void winston;

// 5. Chiffrement des secrets d'utilisateurs (clés de test, jamais de vraies).
const env = { key: process.env.SENSITIVE_VARS_ENCRYPTION_KEY, prev: process.env.SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS, node: process.env.NODE_ENV };
const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
process.env.SENSITIVE_VARS_ENCRYPTION_KEY = KEY_A;
delete process.env.SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS;
const sealed = sealSecret('gho_jeton_de_test', githubTokenAad('u1'));
assert.ok(isSealed(sealed) && !sealed.includes('gho_jeton'), 'jeton GitHub chiffré, préfixé');
assert.equal(openSecret(sealed, githubTokenAad('u1')), 'gho_jeton_de_test');
assert.equal(openSecret(sealed, githubTokenAad('u2')), null, 'le jeton d’un compte ne s’ouvre pas pour un autre (AAD)');
assert.equal(openSecret('gho_ancien_en_clair', githubTokenAad('u1')), 'gho_ancien_en_clair', 'une ancienne valeur en clair reste lisible jusqu’à la migration');
const payload = encryptValue('+237600000000', 'idem-payment-phone');
process.env.SENSITIVE_VARS_ENCRYPTION_KEY = KEY_B;
assert.equal(decryptValue(payload, 'idem-payment-phone'), null, 'nouvelle clé seule : illisible');
process.env.SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS = KEY_A;
assert.equal(decryptValue(payload, 'idem-payment-phone'), '+237600000000', 'rotation : l’ancienne clé déchiffre encore');
assert.ok(needsReencryption(payload, 'idem-payment-phone'), 'rotation : la valeur est signalée à rechiffrer');
assert.ok(!needsReencryption(encryptValue('x', 'y'), 'y'), 'une valeur de la clé courante n’est pas à rechiffrer');
delete process.env.SENSITIVE_VARS_ENCRYPTION_KEY;
process.env.NODE_ENV = 'production';
assert.throws(() => encryptValue('x', 'y'), /manquante en production/, 'jamais la clé par défaut (publique) en production');
Object.assign(process.env, { SENSITIVE_VARS_ENCRYPTION_KEY: env.key, SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS: env.prev, NODE_ENV: env.node });
for (const [k, v] of Object.entries({ SENSITIVE_VARS_ENCRYPTION_KEY: env.key, SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS: env.prev, NODE_ENV: env.node })) if (v === undefined) delete process.env[k];

console.log(`✓ Confidentialité : garde sur ${files.length} fichiers sources, politique OpenRouter non relâchable, ${Object.keys(PROCESSORS).length} sous-traitants au registre, journaux sans contenu métier, secrets chiffrés avec rotation de clé.`);
