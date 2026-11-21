/**
 * Un certificat `*.idem.africa`, pour toutes les adresses des sites publiés depuis iCode.
 *
 * Avant, chaque `monapp.idem.africa` demandait son propre certificat à Let's Encrypt
 * (défi HTTP-01, par Traefik) au moment même où son enregistrement DNS venait d'être
 * créé chez Namecheap. Deux défauts, tous deux vus en production :
 *   - le DNS n'était souvent pas encore publié : Let's Encrypt suivait le joker
 *     `*.idem.africa` (le serveur principal d'IDEM), le défi échouait, et Traefik ne
 *     réessaie pas de lui-même — l'adresse restait « non sécurisée » ;
 *   - Let's Encrypt n'émet que 50 certificats par semaine pour un même domaine
 *     enregistré : au-delà de 50 sites publiés dans la semaine, plus aucun n'avait le sien.
 *
 * Un seul certificat joker, obtenu par défi DNS-01 (un TXT `_acme-challenge` posé dans
 * la zone par l'API Namecheap, sous le même verrou que les adresses), couvre toutes les
 * adresses, tout de suite. Il est renouvelé 30 jours avant son échéance et copié dans la
 * configuration de Traefik (fournisseur de fichiers) des serveurs gérés par IDEM —
 * jamais sur le serveur d'un client : sa clé privée permettrait de se faire passer pour
 * n'importe quelle adresse en `.idem.africa`. Sur un serveur client, Traefik garde le
 * défi HTTP-01 d'avant.
 */
import { createHash, randomBytes } from 'crypto';
import { Resolver } from 'dns/promises';
import YAML from 'yaml';
import pool from '../config/db.config';
import redis from '../config/redis.config';
import logger from '../config/logger';
import { encryptString, decryptString } from '../utils/laravel-crypto';
import { proxyPath } from '../utils/paths';
import { executeRemoteCommand, shellQuote } from '../ssh/ssh';
import { PrivateKeyRow, ServerRow } from '../models/ideploy.types';
import { getDnsProvider } from './dns/namecheap.client';
import { withZoneLock } from './platform-domain.service';

const RENEW_BEFORE_MS = 30 * 24 * 3600 * 1000;
const ISSUE_LOCK = 'ideploy:platform-certificate:issue';
const ISSUE_LOCK_TTL_MS = 15 * 60 * 1000;
/** Ce que Namecheap met à publier un TXT sur ses serveurs de noms. */
const PROPAGATION_TIMEOUT_MS = 10 * 60 * 1000;
const CHALLENGE_LABEL = '_acme-challenge';

export interface PlatformCertificate {
  domain: string;
  certificate: string;
  privateKey: string;
  expiresAt: Date;
  fingerprint: string;
}

/** Le domaine de la plateforme (`idem.africa`), ou null quand les adresses de plateforme sont coupées. */
export function platformDomain(): string | null {
  const domain = process.env.IDEPLOY_PLATFORM_DOMAIN?.trim().toLowerCase();
  return domain || null;
}

/** `monapp.idem.africa` — un seul niveau sous le domaine, ce que couvre un joker. */
export function coveredByWildcard(host: string, domain = platformDomain()): boolean {
  if (!domain) return false;
  const h = host.toLowerCase();
  if (!h.endsWith(`.${domain}`)) return false;
  const label = h.slice(0, -(domain.length + 1));
  return label.length > 0 && !label.includes('.');
}

/** Seuls les serveurs d'IDEM reçoivent la clé privée de la plateforme. */
export function mayHoldPlatformKey(server: ServerRow): boolean {
  return Boolean((server as ServerRow & { idem_managed?: boolean }).idem_managed);
}

// ── Stockage ───────────────────────────────────────────────────────

let cached: { cert: PlatformCertificate | null; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function loadPlatformCertificate(): Promise<PlatformCertificate | null> {
  const domain = platformDomain();
  if (!domain) return null;
  if (cached && Date.now() - cached.at < CACHE_MS && (!cached.cert || cached.cert.domain === domain)) return cached.cert;
  try {
    const { rows } = await pool.query(
      `SELECT domain, certificate, private_key, expires_at, fingerprint FROM platform_certificates WHERE domain = $1 LIMIT 1`,
      [domain]
    );
    const row = rows[0];
    const cert: PlatformCertificate | null = row
      ? {
          domain: String(row.domain),
          certificate: String(row.certificate),
          privateKey: decryptString(String(row.private_key)),
          expiresAt: new Date(row.expires_at),
          fingerprint: String(row.fingerprint),
        }
      : null;
    // Un certificat échu ne sert à rien : Traefik retomberait sur le défi HTTP-01.
    const usable = cert && cert.expiresAt.getTime() > Date.now() ? cert : null;
    cached = { cert: usable, at: Date.now() };
    return usable;
  } catch (error) {
    // Table absente (migration pas encore passée) : comme sans certificat.
    logger.warn('platform_certificate.load_failed', { event: 'platform_certificate.load_failed', reason: (error as Error).message });
    return null;
  }
}

async function accountKey(domain: string): Promise<string | null> {
  const { rows } = await pool.query(`SELECT account_key FROM platform_certificates WHERE domain = $1 LIMIT 1`, [domain]).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const value = rows[0]?.account_key as string | null | undefined;
  return value ? decryptString(value) : null;
}

// ── Émission ───────────────────────────────────────────────────────

/** Les serveurs de noms faisant autorité pour le domaine, par leurs adresses. */
async function authoritativeResolver(domain: string): Promise<Resolver> {
  const publicResolver = new Resolver({ timeout: 4000, tries: 2 });
  publicResolver.setServers(['1.1.1.1', '8.8.8.8']);
  const names = await publicResolver.resolveNs(domain);
  const addresses = (await Promise.all(names.map((n) => publicResolver.resolve4(n).catch(() => [] as string[])))).flat();
  const resolver = new Resolver({ timeout: 4000, tries: 1 });
  resolver.setServers(addresses.length ? addresses : ['1.1.1.1']);
  return resolver;
}

/** Attendre que le TXT soit servi par les serveurs de noms eux-mêmes (ce que lit Let's Encrypt). */
async function waitForTxt(domain: string, value: string): Promise<void> {
  const resolver = await authoritativeResolver(domain);
  const name = `${CHALLENGE_LABEL}.${domain}`;
  const started = Date.now();
  while (Date.now() - started < PROPAGATION_TIMEOUT_MS) {
    const records = await resolver.resolveTxt(name).catch(() => [] as string[][]);
    if (records.some((chunks) => chunks.join('') === value)) return;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`The TXT record ${name} was not published within ${PROPAGATION_TIMEOUT_MS / 60000} minutes.`);
}

async function addTxt(value: string): Promise<void> {
  const provider = getDnsProvider();
  if (!provider) throw new Error('Platform DNS is not configured.');
  await withZoneLock(async () => {
    const zone = await provider.getZone();
    if (zone.hosts.length === 0) throw new Error('The DNS zone came back empty; nothing was written.');
    if (zone.hosts.some((h) => h.name === CHALLENGE_LABEL && h.type === 'TXT' && h.address === value)) return;
    const before = zone.hosts.length;
    await provider.setZone({
      emailType: zone.emailType,
      hosts: [...zone.hosts, { name: CHALLENGE_LABEL, type: 'TXT', address: value, mxPref: '10', ttl: '60' }],
    });
    const after = await provider.getZone();
    if (after.hosts.length !== before + 1) {
      logger.error('Platform certificate: zone not as expected after write', { event: 'dns.zone_mismatch', before, after: after.hosts.length, alert: 'critical' });
    }
  });
}

async function removeTxt(value: string): Promise<void> {
  const provider = getDnsProvider();
  if (!provider) return;
  await withZoneLock(async () => {
    const zone = await provider.getZone();
    if (zone.hosts.length === 0) throw new Error('The DNS zone came back empty; nothing was written.');
    const remaining = zone.hosts.filter((h) => !(h.name === CHALLENGE_LABEL && h.type === 'TXT' && h.address === value));
    if (remaining.length === zone.hosts.length) return;
    await provider.setZone({ emailType: zone.emailType, hosts: remaining });
  }).catch((error) => logger.warn('platform_certificate.txt_not_removed', { event: 'platform_certificate.txt_not_removed', reason: (error as Error).message }));
}

/**
 * Obtenir (ou renouveler) le certificat joker. Une seule émission à la fois sur toute la
 * flotte (verrou Redis). Ne lève jamais : un échec est journalisé en alerte, et les
 * adresses gardent le défi HTTP-01 en attendant.
 *
 * @returns le certificat valable, neuf ou non, ou null.
 */
export async function ensurePlatformCertificate(options: { force?: boolean } = {}): Promise<{ cert: PlatformCertificate | null; renewed: boolean }> {
  const domain = platformDomain();
  if (!domain || !getDnsProvider()) return { cert: null, renewed: false };

  const current = await loadPlatformCertificate();
  if (!options.force && current && current.expiresAt.getTime() - Date.now() > RENEW_BEFORE_MS) return { cert: current, renewed: false };

  const token = randomBytes(12).toString('hex');
  if (!(await redis.set(ISSUE_LOCK, token, 'PX', ISSUE_LOCK_TTL_MS, 'NX'))) return { cert: current, renewed: false };
  try {
    const acme = await import('acme-client');
    const staging = process.env.IDEPLOY_ACME_STAGING === 'true';
    const storedKey = await accountKey(domain);
    const accountKeyPem = storedKey ?? (await acme.crypto.createPrivateEcdsaKey()).toString();
    const client = new acme.Client({
      directoryUrl: staging ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production,
      accountKey: accountKeyPem,
    });
    const [key, csr] = await acme.crypto.createCsr({ altNames: [`*.${domain}`] }, await acme.crypto.createPrivateEcdsaKey());
    const email = process.env.IDEPLOY_ACME_EMAIL?.trim();

    logger.info('platform_certificate.issuing', { event: 'platform_certificate.issuing', domain, staging, renewal: Boolean(current) });
    const certificate = await client.auto({
      csr,
      ...(email ? { email } : {}),
      termsOfServiceAgreed: true,
      challengePriority: ['dns-01'],
      // La propagation est attendue ici, sur les serveurs de noms : la vérification d'acme-client
      // passe par le résolveur local, qui peut avoir gardé « pas de TXT » en cache.
      skipChallengeVerification: true,
      challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
        if (challenge.type !== 'dns-01') throw new Error(`Unexpected challenge ${challenge.type}`);
        await addTxt(keyAuthorization);
        await waitForTxt(domain, keyAuthorization);
      },
      challengeRemoveFn: async (_authz, _challenge, keyAuthorization) => {
        await removeTxt(keyAuthorization);
      },
    });

    const info = acme.crypto.readCertificateInfo(certificate);
    const fingerprint = createHash('sha256').update(certificate).digest('hex');
    await pool.query(
      `INSERT INTO platform_certificates (domain, certificate, private_key, account_key, expires_at, fingerprint, issued_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (domain) DO UPDATE SET certificate = EXCLUDED.certificate, private_key = EXCLUDED.private_key,
         account_key = EXCLUDED.account_key, expires_at = EXCLUDED.expires_at, fingerprint = EXCLUDED.fingerprint, issued_at = now()`,
      [domain, certificate, encryptString(key.toString()), encryptString(accountKeyPem), info.notAfter, fingerprint]
    );
    cached = null;
    logger.info('platform_certificate.issued', { event: 'platform_certificate.issued', domain, expiresAt: info.notAfter.toISOString() });
    return { cert: await loadPlatformCertificate(), renewed: true };
  } catch (error) {
    logger.error('platform_certificate.issue_failed', {
      event: 'platform_certificate.issue_failed',
      domain,
      reason: (error as Error).message,
      // Sans certificat valable, les nouvelles adresses retombent sur le défi HTTP-01 (et sa limite).
      alert: current ? undefined : 'critical',
    });
    return { cert: current, renewed: false };
  } finally {
    if ((await redis.get(ISSUE_LOCK)) === token) await redis.del(ISSUE_LOCK);
  }
}

// ── Installation sur les serveurs ──────────────────────────────────

export function platformCertificateFile(): string {
  return `${proxyPath()}/dynamic/platform-certificate.yml`;
}

/** Le fichier lu par Traefik : le certificat en clair, sa clé en ligne (pas de chemin à monter). */
export function platformCertificateYaml(cert: PlatformCertificate): string {
  return YAML.stringify({ tls: { certificates: [{ certFile: cert.certificate, keyFile: cert.privateKey }] } });
}

/** Serveur → empreinte installée, vérifiée il y a peu : évite un aller-retour SSH par déploiement. */
const installed = new Map<number, { fingerprint: string; at: number }>();

/**
 * Le certificat est-il en place sur ce serveur ? L'installe au besoin. Ne lève jamais.
 * @returns vrai quand Traefik a (ou aura dans la seconde) le joker sur ce serveur.
 */
export async function ensurePlatformCertificateOn(server: ServerRow, key: PrivateKeyRow): Promise<boolean> {
  if (!mayHoldPlatformKey(server)) return false;
  const cert = await loadPlatformCertificate();
  if (!cert) return false;
  const known = installed.get(server.id);
  if (known && known.fingerprint === cert.fingerprint && Date.now() - known.at < CACHE_MS) return true;

  const content = platformCertificateYaml(cert);
  const digest = createHash('sha256').update(content).digest('hex');
  const file = platformCertificateFile();
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  try {
    const r = await executeRemoteCommand(
      server,
      key,
      `set -e; F=${shellQuote(file)}; ` +
        `if [ -f "$F" ] && [ "$(sha256sum "$F" | cut -d' ' -f1)" = ${shellQuote(digest)} ]; then echo SAME; exit 0; fi; ` +
        `mkdir -p "$(dirname "$F")"; umask 077; echo ${b64} | base64 -d > "$F.tmp"; mv -f "$F.tmp" "$F"; echo WRITTEN`,
      { noRetry: true }
    );
    if (r.exitCode !== 0) throw new Error((r.stderr || r.stdout).slice(0, 200));
    installed.set(server.id, { fingerprint: cert.fingerprint, at: Date.now() });
    if (/WRITTEN/.test(r.stdout)) {
      logger.info('platform_certificate.installed', { event: 'platform_certificate.installed', serverId: server.id, expiresAt: cert.expiresAt.toISOString() });
    }
    return true;
  } catch (error) {
    logger.warn('platform_certificate.install_failed', { event: 'platform_certificate.install_failed', serverId: server.id, reason: (error as Error).message });
    return false;
  }
}
