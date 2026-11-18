import crypto from 'crypto';

/**
 * Chiffrement symétrique des valeurs sensibles stockées en base.
 *
 * Extrait de `services/Deployment/deployment.service.ts`, qui chiffrait déjà
 * les variables d'environnement des déploiements avec le même algorithme et la
 * même clé. Les paiements ont le même besoin — conserver un numéro de
 * téléphone exploitable pour une relance sans le laisser en clair — et deux
 * implémentations du même schéma finiraient par diverger.
 *
 * AES-256-GCM : le mode authentifié garantit qu'une valeur altérée en base est
 * détectée au déchiffrement plutôt que renvoyée silencieusement corrompue.
 * L'AAD distingue les usages : un blob chiffré pour un déploiement ne se
 * déchiffre pas comme un téléphone de paiement.
 */

const ALGORITHM = 'aes-256-gcm';

/**
 * Clé de 32 octets dérivée de `SENSITIVE_VARS_ENCRYPTION_KEY`.
 *
 * La valeur peut être fournie en hexadécimal (64 caractères, le format que
 * produit `openssl rand -hex 32`) ou en texte libre — dans ce second cas elle
 * passe par scrypt. Sans cette tolérance, une clé écrite en clair serait
 * tronquée par `Buffer.from(key, 'hex')` sans la moindre erreur, et tout ce
 * qui aurait été chiffré avec deviendrait illisible après correction.
 */
function resolveKey(raw: string | undefined = process.env.SENSITIVE_VARS_ENCRYPTION_KEY): Buffer {
  if (!raw) {
    // Cohérent avec le repli historique de DeploymentService : le
    // développement local fonctionne sans secret, la production l'exige
    // (SENSITIVE_VARS_ENCRYPTION_KEY est un secret requis de secrets.manifest.ts).
    // Garde supplémentaire : en production, jamais la clé par défaut (elle est publique, le dépôt l'est).
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SENSITIVE_VARS_ENCRYPTION_KEY manquante en production : chiffrement refusé');
    }
    return crypto.scryptSync('idem-api-default-key', 'salt', 32);
  }

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  return crypto.scryptSync(raw, 'idem-crypto-salt', 32);
}

/**
 * Clés acceptées au DÉCHIFFREMENT, la courante d'abord. Rotation : la nouvelle clé
 * dans `SENSITIVE_VARS_ENCRYPTION_KEY`, l'ancienne dans
 * `SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS` le temps de rechiffrer
 * (`npm run privacy:reencrypt`) ; tout nouveau chiffrement prend la courante.
 */
function decryptionKeys(): Buffer[] {
  const previous = process.env.SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS;
  return [resolveKey(), ...(previous ? [resolveKey(previous)] : [])];
}

/** Chiffre une valeur. Format de sortie : `iv:authTag:données`, en hexadécimal. */
export function encryptValue(value: string, aad: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, resolveKey(), iv);
  cipher.setAAD(Buffer.from(aad));

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Déchiffre une valeur produite par `encryptValue`.
 *
 * Renvoie `null` plutôt que de lever : les appelants (support, relance de
 * paiement) doivent pouvoir afficher le reste d'une transaction même si la clé
 * a tourné entre-temps.
 */
export function decryptValue(payload: string, aad: string): string | null {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) return null;
  for (const key of decryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
      decipher.setAAD(Buffer.from(aad));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
    } catch {
      // Mauvaise clé (ou valeur altérée) : la suivante, puis `null`.
    }
  }
  return null;
}

/** Lisible, mais seulement avec l'ANCIENNE clé : à rechiffrer (cf. `npm run privacy:reencrypt`). */
export function needsReencryption(payload: string, aad: string): boolean {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) return false;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, resolveKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    decipher.update(Buffer.from(dataHex, 'hex'));
    decipher.final();
    return false;
  } catch {
    return decryptValue(payload, aad) !== null;
  }
}

/**
 * Secrets d'utilisateurs rangés DANS un champ existant (jeton GitHub…) : la valeur
 * chiffrée porte le préfixe `enc:v1:`, ce qui distingue une ancienne valeur restée
 * en clair (relue telle quelle, puis rechiffrée par `npm run privacy:reencrypt`).
 */
const SEALED_PREFIX = 'enc:v1:';

export function sealSecret(value: string, aad: string): string {
  return `${SEALED_PREFIX}${encryptValue(value, aad)}`;
}

export function isSealed(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(SEALED_PREFIX);
}

/** La valeur en clair ; `null` si elle est chiffrée mais illisible (clé perdue, valeur altérée). */
export function openSecret(stored: string | undefined | null, aad: string): string | null {
  if (!stored) return null;
  return isSealed(stored) ? decryptValue(stored.slice(SEALED_PREFIX.length), aad) : stored;
}

/**
 * Empreinte stable d'une valeur, pour la rechercher sans la stocker en clair.
 *
 * Le support tape un numéro de téléphone complet dans l'admin ; on compare des
 * empreintes. Le sel est fixe par nécessité — une empreinte aléatoire ne serait
 * pas recherchable — ce qui est acceptable ici : l'espace des numéros est petit
 * et l'empreinte n'est jamais exposée hors de la base.
 */
export function hashValue(value: string): string {
  // Après une rotation de clé, `SENSITIVE_VARS_HASH_SALT` = l'ANCIENNE clé garde les empreintes existantes valides.
  const salt = process.env.SENSITIVE_VARS_HASH_SALT || process.env.SENSITIVE_VARS_ENCRYPTION_KEY || 'idem-hash-salt';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}
