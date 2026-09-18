import crypto from 'crypto';
import logger from '../../config/logger';
import { pawapayClient } from './pawapay.client';

/**
 * Vérification des callbacks pawaPay (RFC 9421, « HTTP Message Signatures »).
 *
 * Trois couches protègent l'endpoint de callback, et elles ne se remplacent
 * pas :
 *
 *  1. **La signature** (ce fichier) prouve que le message vient de pawaPay et
 *     qu'il n'a pas été modifié.
 *  2. **La liste blanche d'IP** écarte le bruit avant même l'analyse.
 *  3. **La relecture du statut** (`GET /deposits/{id}`) est la garantie de
 *     dernier ressort : même un callback parfaitement signé ne déclenche
 *     aucune livraison sans elle.
 *
 * La troisième couche est la raison pour laquelle le mode `log` est tenable au
 * démarrage : tant que la signature n'est pas activée dans le tableau de bord
 * pawaPay, un faux callback ne peut au pire que provoquer une relecture de
 * statut inutile.
 *
 * Référence : https://docs.pawapay.io/v2/docs/signatures
 */

export type SignatureVerdict = 'valid' | 'invalid' | 'absent' | 'skipped';

export interface SignatureResult {
  verdict: SignatureVerdict;
  keyId?: string;
  algorithm?: string;
  error?: string;
}

export type SignatureMode = 'enforce' | 'log' | 'off';

export function getSignatureMode(): SignatureMode {
  const mode = (process.env.PAWAPAY_CALLBACK_SIGNATURE || 'log').toLowerCase();
  return mode === 'enforce' || mode === 'off' ? mode : 'log';
}

/**
 * IP de la plateforme pawaPay (documentation « What to know »).
 *
 * Surchargeables par `PAWAPAY_CALLBACK_IPS` : derrière un proxy ou un tunnel de
 * développement, l'IP vue par Express n'est pas celle de pawaPay, et un
 * filtrage rigide bloquerait des callbacks légitimes.
 */
const SANDBOX_IPS = ['3.64.89.224'];
const PRODUCTION_IPS = [
  '18.192.208.15',
  '18.195.113.136',
  '3.72.212.107',
  '54.73.125.42',
  '54.155.38.214',
  '54.73.130.113',
];

export function allowedCallbackIps(): string[] {
  const override = process.env.PAWAPAY_CALLBACK_IPS;
  if (override) {
    return override
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
  }

  return pawapayClient.isProduction() ? PRODUCTION_IPS : SANDBOX_IPS;
}

/**
 * Vrai si l'adresse est autorisée.
 *
 * Une liste vide vaut « pas de filtrage » : c'est la configuration de
 * développement, où le callback arrive par un tunnel.
 */
export function isCallbackIpAllowed(ip?: string): boolean {
  const allowed = allowedCallbackIps();
  if (allowed.length === 0) return true;
  if (!ip) return false;

  // Express préfixe parfois les adresses IPv4 en notation IPv6 mappée.
  const normalized = ip.replace(/^::ffff:/, '');
  return allowed.includes(normalized);
}

// ============================================
// CLÉS PUBLIQUES
// ============================================

interface CachedKey {
  pem: string;
  algorithm?: string;
}

let keyCache: Map<string, CachedKey> = new Map();
let keyCacheAt = 0;
const KEY_CACHE_TTL_MS = 3600_000;

/**
 * Normalise la réponse de `/public-keys`.
 *
 * La documentation décrit l'usage du point d'accès mais pas la forme exacte de
 * sa réponse ; on accepte donc les deux mises en forme plausibles (tableau
 * `keys` ou objet indexé par identifiant) et différents noms de champ. Une clé
 * brute en base64 est enveloppée au format PEM, que `crypto` sait lire.
 */
function parsePublicKeys(payload: unknown): Map<string, CachedKey> {
  const keys = new Map<string, CachedKey>();
  if (!payload || typeof payload !== 'object') return keys;

  const source = payload as Record<string, any>;
  const entries: any[] = Array.isArray(source.keys)
    ? source.keys
    : Array.isArray(source.publicKeys)
      ? source.publicKeys
      : Array.isArray(source)
        ? (source as any[])
        : Object.entries(source).map(([id, value]) =>
            typeof value === 'string' ? { keyId: id, publicKey: value } : { keyId: id, ...value }
          );

  for (const entry of entries) {
    if (!entry) continue;
    const keyId = entry.keyId ?? entry.id ?? entry.kid;
    const raw = entry.publicKey ?? entry.key ?? entry.pem ?? entry.value;
    if (!keyId || typeof raw !== 'string') continue;

    const pem = raw.includes('BEGIN')
      ? raw
      : `-----BEGIN PUBLIC KEY-----\n${raw.replace(/(.{64})/g, '$1\n')}\n-----END PUBLIC KEY-----\n`;

    keys.set(String(keyId), { pem, algorithm: entry.algorithm ?? entry.alg });
  }

  return keys;
}

async function getPublicKey(keyId: string): Promise<CachedKey | undefined> {
  // Clé fournie par configuration : utile en développement et comme filet si
  // le point d'accès est indisponible au moment d'un callback.
  const envKey = process.env.PAWAPAY_PUBLIC_KEY;
  if (envKey) {
    return { pem: envKey.replace(/\\n/g, '\n') };
  }

  const fresh = Date.now() - keyCacheAt < KEY_CACHE_TTL_MS;
  if (fresh && keyCache.has(keyId)) return keyCache.get(keyId);

  try {
    const payload = await pawapayClient.getPublicKeys();
    keyCache = parsePublicKeys(payload);
    keyCacheAt = Date.now();
  } catch (error: any) {
    logger.warn(`payment.public_keys_fetch_failed: ${error.message}`, {
      event: 'payment.public_keys_fetch_failed',
    });
  }

  return keyCache.get(keyId);
}

// ============================================
// ANALYSE DES EN-TÊTES
// ============================================

interface SignatureInput {
  label: string;
  components: string[];
  params: string;
  algorithm?: string;
  keyId?: string;
}

/**
 * Analyse `Signature-Input`, de la forme :
 * `sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="…";created=…;expires=…`
 */
function parseSignatureInput(header: string): SignatureInput | null {
  const match = header.match(/^([^=]+)=\(([^)]*)\)(.*)$/);
  if (!match) return null;

  const [, label, componentList, params] = match;
  const components = (componentList.match(/"([^"]+)"/g) ?? []).map((part) => part.slice(1, -1));

  return {
    label: label.trim(),
    components,
    params,
    algorithm: params.match(/alg="([^"]+)"/)?.[1],
    keyId: params.match(/keyid="([^"]+)"/)?.[1],
  };
}

/** Extrait la signature du label correspondant dans l'en-tête `Signature`. */
function parseSignature(header: string, label: string): Buffer | null {
  const match = header.match(new RegExp(`${label}=:([^:]+):`));
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

/**
 * Reconstitue la base de signature.
 *
 * L'ordre des composants est celui de `Signature-Input` — il fait partie de ce
 * qui est signé. La dernière ligne, `@signature-params`, reprend la liste et
 * ses paramètres : c'est ce qui empêche de rejouer une signature avec un autre
 * jeu de composants.
 */
function buildSignatureBase(
  input: SignatureInput,
  parts: { method: string; authority: string; path: string; headers: Record<string, string> }
): string | null {
  const lines: string[] = [];

  for (const component of input.components) {
    let value: string | undefined;

    switch (component) {
      case '@method':
        value = parts.method.toUpperCase();
        break;
      case '@authority':
        value = parts.authority;
        break;
      case '@path':
        value = parts.path;
        break;
      case '@status':
        // Présent dans les réponses signées de pawaPay, pas dans un callback.
        return null;
      default:
        value = parts.headers[component.toLowerCase()];
    }

    if (value === undefined) return null;
    lines.push(`"${component}": ${value}`);
  }

  lines.push(`"@signature-params": (${input.components.map((c) => `"${c}"`).join(' ')})${input.params}`);
  return lines.join('\n');
}

/** Vérifie `Content-Digest` — l'intégrité du corps, avant toute cryptographie. */
function verifyContentDigest(header: string, rawBody: Buffer): boolean {
  // Forme : `sha-512=:base64:` (plusieurs algorithmes possibles, séparés par des virgules).
  const entries = header.split(',');

  for (const entry of entries) {
    const match = entry.trim().match(/^(sha-256|sha-512)=:(.+):$/);
    if (!match) continue;

    const [, algorithm, expected] = match;
    const digest = crypto
      .createHash(algorithm === 'sha-256' ? 'sha256' : 'sha512')
      .update(rawBody)
      .digest('base64');

    if (digest === expected) return true;
  }

  return false;
}

/** Traduit le nom d'algorithme RFC 9421 en paramètres pour `crypto.verify`. */
function verifyWithAlgorithm(
  algorithm: string,
  base: string,
  signature: Buffer,
  publicKeyPem: string
): boolean {
  const key = crypto.createPublicKey(publicKeyPem);
  const data = Buffer.from(base, 'utf8');

  switch (algorithm) {
    case 'ecdsa-p256-sha256':
      // RFC 9421 impose la forme brute r‖s, alors que Node attend du DER par
      // défaut : sans `dsaEncoding`, une signature valide serait rejetée.
      return crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature);
    case 'ecdsa-p384-sha384':
      return crypto.verify('sha384', data, { key, dsaEncoding: 'ieee-p1363' }, signature);
    case 'rsa-pss-sha512':
      return crypto.verify(
        'sha512',
        data,
        { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 },
        signature
      );
    case 'rsa-v1_5-sha256':
      return crypto.verify('sha256', data, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, signature);
    default:
      return false;
  }
}

// ============================================
// POINT D'ENTRÉE
// ============================================

export interface VerifyInput {
  method: string;
  /** Hôte tel que vu par pawaPay au moment de signer (en-tête `Host`). */
  authority: string;
  /** Chemin seul, sans requête. */
  path: string;
  headers: Record<string, string>;
  /** Corps EXACT reçu : re-sérialiser le JSON changerait le condensat. */
  rawBody: Buffer;
}

/**
 * Vérifie la signature d'un callback.
 *
 * Ne lève jamais : renvoie un verdict que l'appelant journalise et, en mode
 * `enforce`, oppose à l'expéditeur. Une exception ici ferait échouer la
 * réception d'un callback légitime sur un détail de format.
 */
export async function verifyCallbackSignature(input: VerifyInput): Promise<SignatureResult> {
  const mode = getSignatureMode();
  if (mode === 'off') return { verdict: 'skipped' };

  const signatureHeader = input.headers['signature'];
  const signatureInputHeader = input.headers['signature-input'];
  const digestHeader = input.headers['content-digest'];

  if (!signatureHeader || !signatureInputHeader) {
    return { verdict: 'absent' };
  }

  try {
    if (digestHeader && !verifyContentDigest(digestHeader, input.rawBody)) {
      return { verdict: 'invalid', error: 'Content-Digest ne correspond pas au corps reçu' };
    }

    const parsed = parseSignatureInput(signatureInputHeader);
    if (!parsed) return { verdict: 'invalid', error: 'Signature-Input illisible' };

    if (parsed.components.includes('content-digest') && !digestHeader) {
      return { verdict: 'invalid', error: 'Content-Digest signé mais absent' };
    }

    const signature = parseSignature(signatureHeader, parsed.label);
    if (!signature) return { verdict: 'invalid', error: 'Signature absente pour ce label' };

    const base = buildSignatureBase(parsed, {
      method: input.method,
      authority: input.authority,
      path: input.path,
      headers: input.headers,
    });
    if (!base) return { verdict: 'invalid', error: 'Composant signé manquant dans la requête' };

    if (!parsed.keyId) return { verdict: 'invalid', error: 'keyid absent' };

    const key = await getPublicKey(parsed.keyId);
    if (!key) return { verdict: 'invalid', error: `Clé publique ${parsed.keyId} introuvable` };

    const algorithm = parsed.algorithm ?? key.algorithm;
    if (!algorithm) return { verdict: 'invalid', error: 'Algorithme non précisé' };

    const ok = verifyWithAlgorithm(algorithm, base, signature, key.pem);

    return ok
      ? { verdict: 'valid', keyId: parsed.keyId, algorithm }
      : { verdict: 'invalid', keyId: parsed.keyId, algorithm, error: 'Signature non vérifiée' };
  } catch (error: any) {
    return { verdict: 'invalid', error: `Vérification impossible : ${error.message}` };
  }
}

/** Réinitialise le cache de clés (rotation, tests). */
export function resetPublicKeyCache(): void {
  keyCache = new Map();
  keyCacheAt = 0;
}
