/**
 * Chiffre les secrets d'utilisateurs encore en clair et rechiffre ceux de l'ancienne clé — `npm run privacy:reencrypt`.
 *
 *   npm run privacy:reencrypt            relevé seulement (rien n'est écrit)
 *   npm run privacy:reencrypt -- --apply écrit
 *
 * Cas traités :
 *  - jetons GitHub (`users.githubIntegration.accessToken|refreshToken`) stockés en clair avant le 18/11/2026 ;
 *  - après une rotation (`SENSITIVE_VARS_ENCRYPTION_KEY` nouvelle, `…_PREVIOUS` ancienne) : jetons des réseaux
 *    sociaux, téléphones WhatsApp, téléphones de paiement, jetons GitHub.
 * Les variables de déploiement ont leur propre code (DeploymentService) et ne sont pas concernées.
 * Une valeur illisible avec les deux clés est comptée et laissée telle quelle (jamais effacée).
 */
import mongoose from 'mongoose';
import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { decryptValue, encryptValue, isSealed, needsReencryption, openSecret, sealSecret } from '../utils/crypto.util';

const apply = process.argv.includes('--apply');

interface Field {
  collection: string;
  path: string;
  aad: (doc: any) => string;
  /** `sealed` : préfixe `enc:v1:` (jetons GitHub) ; `raw` : charge utile seule. */
  format: 'sealed' | 'raw';
}

const FIELDS: Field[] = [
  { collection: 'users', path: 'githubIntegration.accessToken', aad: (d) => `github-token:${d.uid ?? d._id}`, format: 'sealed' },
  { collection: 'users', path: 'githubIntegration.refreshToken', aad: (d) => `github-token:${d.uid ?? d._id}`, format: 'sealed' },
  { collection: 'social_accounts', path: 'accessTokenEnc', aad: (d) => `social:${d.userId}:${d.network}`, format: 'raw' },
  { collection: 'social_accounts', path: 'refreshTokenEnc', aad: (d) => `social:${d.userId}:${d.network}`, format: 'raw' },
  { collection: 'whatsapp_links', path: 'phoneEnc', aad: (d) => `wa:${d.userId}`, format: 'raw' },
  { collection: 'whatsapp_links', path: 'pendingPhoneEnc', aad: (d) => `wa:${d.userId}`, format: 'raw' },
  { collection: 'payment_transactions', path: 'phoneEncrypted', aad: () => 'idem-payment-phone', format: 'raw' },
];

const get = (doc: any, path: string) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), doc);

async function main(): Promise<void> {
  await loadSecrets();
  await mongoDBConnection.connect();
  const db = mongoose.connection;
  let toWrite = 0;
  try {
    for (const field of FIELDS) {
      const counts = { clear: 0, oldKey: 0, unreadable: 0, ok: 0 };
      const cursor = db.collection(field.collection).find({ [field.path]: { $type: 'string', $ne: '' } }, { projection: { [field.path]: 1, uid: 1, userId: 1, network: 1 } });
      for await (const doc of cursor) {
        const stored = get(doc, field.path) as string;
        const aad = field.aad(doc);
        let next: string | null = null;
        if (field.format === 'sealed') {
          if (!isSealed(stored)) {
            counts.clear++;
            next = sealSecret(stored, aad);
          } else if (needsReencryption(stored.slice('enc:v1:'.length), aad)) {
            counts.oldKey++;
            next = sealSecret(openSecret(stored, aad)!, aad);
          } else if (openSecret(stored, aad) === null) counts.unreadable++;
          else counts.ok++;
        } else if (needsReencryption(stored, aad)) {
          counts.oldKey++;
          next = encryptValue(decryptValue(stored, aad)!, aad);
        } else if (decryptValue(stored, aad) === null) counts.unreadable++;
        else counts.ok++;

        if (next) {
          toWrite++;
          if (apply) await db.collection(field.collection).updateOne({ _id: doc._id }, { $set: { [field.path]: next } });
        }
      }
      console.log(`${field.collection}.${field.path} : ${counts.ok} à jour, ${counts.clear} en clair, ${counts.oldKey} sous l'ancienne clé, ${counts.unreadable} illisibles`);
    }
    console.log(apply ? `✓ ${toWrite} valeur(s) écrite(s).` : `Relevé seulement : ${toWrite} valeur(s) à écrire. Relancer avec -- --apply.`);
  } finally {
    await mongoDBConnection.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
