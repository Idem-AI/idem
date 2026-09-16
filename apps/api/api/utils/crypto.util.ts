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
function resolveKey(): Buffer {
  const raw = process.env.SENSITIVE_VARS_ENCRYPTION_KEY;

  if (!raw) {
    // Cohérent avec le repli historique de DeploymentService : le
    // développement local fonctionne sans secret, la production l'exige
    // (SENSITIVE_VARS_ENCRYPTION_KEY est dans REQUIRED_SECRETS).
    return crypto.scryptSync('idem-api-default-key', 'salt', 32);
  }

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  return crypto.scryptSync(raw, 'idem-crypto-salt', 32);
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
  try {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    if (!ivHex || !tagHex || !dataHex) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, resolveKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
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
  const salt = process.env.SENSITIVE_VARS_ENCRYPTION_KEY || 'idem-hash-salt';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}
