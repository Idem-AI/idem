/**
 * "Magic" variable resolution for one-click service templates.
 *
 * Every template in `service-templates.json` (Coolify's own catalogue) uses
 * placeholders like `$SERVICE_PASSWORD_64_APIKEY`, `SERVICE_FQDN_ACTIVEPIECES`
 * (declared bare, with no `=value`, in an env list) or
 * `${SERVICE_PASSWORD_POSTGRES}` — Coolify's own instruction to itself to
 * generate a real secret/domain, once, and substitute it everywhere the same
 * placeholder appears.
 *
 * Nothing in this port ever did that: `docker_compose_raw` — the template,
 * placeholders and all — was written to the server and deployed verbatim.
 * Docker Compose resolves an unset `$VAR` to an empty string (with a warning,
 * not a failure), so every generated secret was silently blank: an empty
 * Postgres password (which Postgres itself refuses to start with) and empty
 * encryption/JWT/API keys for services that require them. That is the actual
 * reason a freshly deployed one-click service's containers exit immediately
 * — confirmed against a live "activepieces" deploy, all three containers
 * exiting on boot with nothing in the logs pointing at *why*, because nothing
 * captured those logs either (see `service.service.ts`'s realtime wiring).
 *
 * Generated values are persisted as ordinary `environment_variables` rows
 * (`resourceable_type = 'App\Models\Service'`) — the same polymorphic table
 * applications use, and the same one Coolify itself stores resolved service
 * variables in — so a restart reuses the same password instead of rotating
 * it out from under a database that already has the old one.
 */
import { randomBytes, randomUUID } from 'crypto';
import YAML from 'yaml';
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import { generateFqdn } from './domain.service';
import { traefikLabels } from '../docker/labels';

export const SERVICE_MODEL = 'App\\Models\\Service';

type MagicKind = 'FQDN' | 'URL' | 'USER' | 'PASSWORD' | 'BASE64' | 'REALBASE64';

/** Matches the bare identifier, however it appears: `$TOKEN`, `${TOKEN}`, or alone on an env-list line. */
const TOKEN_PATTERN = /SERVICE_(?:FQDN|URL|USER|PASSWORD|BASE64|REALBASE64)(?:_\d+)?_[A-Z0-9]+/g;
const TOKEN_SHAPE = /^SERVICE_(FQDN|URL|USER|PASSWORD|BASE64|REALBASE64)(?:_(\d+))?_([A-Z0-9]+)$/;

function randomString(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function generateValue(
  token: string,
  serverId: number,
  serverIp: string
): Promise<{ value: string; fqdnKey: string | null }> {
  const m = TOKEN_SHAPE.exec(token);
  const kind = (m?.[1] as MagicKind | undefined) ?? 'PASSWORD';
  const length = m?.[2] ? Number(m[2]) : null;
  const key = m?.[3] ?? '';

  switch (kind) {
    case 'FQDN': {
      const fqdn = await generateFqdn(serverId, serverIp, randomString(8).toLowerCase());
      return { value: fqdn, fqdnKey: key };
    }
    case 'URL': {
      const fqdn = await generateFqdn(serverId, serverIp, randomString(8).toLowerCase());
      return { value: `https://${fqdn}`, fqdnKey: key };
    }
    case 'USER':
      return { value: randomString(length ?? 16).toLowerCase(), fqdnKey: null };
    case 'BASE64':
    case 'REALBASE64':
      return { value: randomBytes(length ?? 32).toString('base64'), fqdnKey: null };
    case 'PASSWORD':
    default:
      return { value: randomString(length ?? 32), fqdnKey: null };
  }
}

/** Every distinct magic token referenced anywhere in the compose text. */
function findTokens(compose: string): string[] {
  return [...new Set(compose.match(TOKEN_PATTERN) ?? [])];
}

async function loadResolved(serviceId: number): Promise<Map<string, string>> {
  const { rows } = await pool.query(
    `SELECT key, value FROM environment_variables WHERE resourceable_type = $1 AND resourceable_id = $2`,
    [SERVICE_MODEL, serviceId]
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const value = tryDecryptString(r.value as string | null);
    if (value !== null) map.set(String(r.key), value);
  }
  return map;
}

async function persist(serviceId: number, token: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO environment_variables
       (uuid, key, value, resourceable_type, resourceable_id, is_runtime, is_buildtime, is_literal, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, false, true, now(), now())`,
    [randomUUID(), token, encryptString(value), SERVICE_MODEL, serviceId]
  );
}

/**
 * Resolve every `SERVICE_*` placeholder in a template's compose, generating
 * and persisting any value not already resolved from a previous deploy, and
 * return the substituted compose ready to hand to `docker compose up`.
 *
 * Also returns the FQDNs resolved, keyed by the placeholder's own suffix
 * (`ACTIVEPIECES` for `SERVICE_FQDN_ACTIVEPIECES`) — `service.service.ts`
 * matches these back onto `service_applications` rows by name so the "open"
 * link in the UI has something real to point at.
 */
export async function resolveCompose(
  serviceId: number,
  composeRaw: string,
  serverId: number,
  serverIp: string
): Promise<{ compose: string; fqdns: Map<string, string> }> {
  const resolved = await loadResolved(serviceId);
  const fqdns = new Map<string, string>();

  for (const token of findTokens(composeRaw)) {
    if (!resolved.has(token)) {
      const { value, fqdnKey } = await generateValue(token, serverId, serverIp);
      resolved.set(token, value);
      await persist(serviceId, token, value);
    }
    const shape = TOKEN_SHAPE.exec(token);
    if (shape?.[1] === 'FQDN' || shape?.[1] === 'URL') {
      fqdns.set(shape[3], resolved.get(token)!.replace(/^https?:\/\//, ''));
    }
  }

  let compose = composeRaw;
  // Bare form first: an env-list entry that is *only* the placeholder name
  // (`- SERVICE_FQDN_ACTIVEPIECES`, no `=value`) — Coolify's shorthand for
  // "export this magic value under its own name". Must run before the `$`
  // substitutions below, since this form carries no `$` at all.
  compose = compose.replace(
    /^(\s*-\s*)(SERVICE_(?:FQDN|URL|USER|PASSWORD|BASE64|REALBASE64)(?:_\d+)?_[A-Z0-9]+)\s*$/gm,
    (line, prefix: string, token: string) => (resolved.has(token) ? `${prefix}${token}=${resolved.get(token)}` : line)
  );
  // `${TOKEN}` braced form.
  compose = compose.replace(
    /\$\{(SERVICE_(?:FQDN|URL|USER|PASSWORD|BASE64|REALBASE64)(?:_\d+)?_[A-Z0-9]+)\}/g,
    (m, token: string) => resolved.get(token) ?? m
  );
  // Bare `$TOKEN` form — never matches `$$TOKEN` (Compose's own escape for a
  // literal `$`, used by templates to defer `${POSTGRES_USER}`-style
  // variables to the *container's* shell instead of Compose itself).
  compose = compose.replace(
    /(?<!\$)\$(SERVICE_(?:FQDN|URL|USER|PASSWORD|BASE64|REALBASE64)(?:_\d+)?_[A-Z0-9]+)\b/g,
    (m, token: string) => resolved.get(token) ?? m
  );

  return { compose, fqdns };
}

/**
 * Declare, at the top level, every named volume a service actually mounts.
 *
 * Coolify's own templates never bother declaring one — Coolify's own deploy
 * pipeline adds it as a processing step, the same way it substitutes magic
 * variables, so the template author never has to. Nothing here did that
 * either: a template like `activepieces` mounting `pg-data:/var/lib/postgresql/data`
 * with no top-level `volumes: { pg-data: {} }` is not valid Compose at all —
 * `docker compose up` refuses the whole file with "refers to undefined
 * volume", confirmed live. A bind mount (starting `.`, `/` or `~`) is left
 * alone; only bare names, which Compose can only mean as a named volume, get
 * auto-declared.
 */
export function ensureNamedVolumes(composeText: string): string {
  let doc: Record<string, unknown>;
  try {
    doc = YAML.parse(composeText) as Record<string, unknown>;
  } catch {
    return composeText; // Unparseable — leave it exactly as it was rather than risk mangling it further.
  }
  if (!doc || typeof doc !== 'object') return composeText;

  const services = (doc.services as Record<string, { volumes?: unknown }> | undefined) ?? {};
  const declared = new Set(Object.keys((doc.volumes as Record<string, unknown> | undefined) ?? {}));
  const referenced = new Set<string>();

  for (const svc of Object.values(services)) {
    const volumes = Array.isArray(svc?.volumes) ? (svc.volumes as unknown[]) : [];
    for (const entry of volumes) {
      if (typeof entry !== 'string') continue; // The long (object) form is already explicit — nothing to infer.
      const source = entry.split(':')[0];
      if (source && !/^[./~]/.test(source)) referenced.add(source);
    }
  }

  const missing = [...referenced].filter((name) => !declared.has(name));
  if (missing.length === 0) return composeText;

  doc.volumes = {
    ...((doc.volumes as Record<string, unknown> | undefined) ?? {}),
    ...Object.fromEntries(missing.map((name) => [name, {}])),
  };
  return YAML.stringify(doc);
}

/**
 * Give a resolved `SERVICE_FQDN_*` domain an actual route.
 *
 * `resolveCompose` already turns the placeholder into a real hostname and
 * writes it onto `service_applications.fqdn` — but a hostname in the database
 * is not a route: nothing ever told the proxy this container exists, so
 * `docker/labels.ts`'s own warning applies verbatim here too ("a deployment
 * succeeds and the application is unreachable"), confirmed live: `activepieces`
 * reached three healthy containers with zero `traefik.*` labels anywhere in
 * its compose and no membership in the shared proxy network — the exact state
 * that produces `DNS_PROBE_FINISHED_NXDOMAIN`/connection-refused for a
 * container that is, by every internal measure, working.
 *
 * Only the container(s) that actually own a resolved FQDN are touched — a
 * background `postgres`/`redis` sidecar in the same stack has no domain and
 * must stay off the public network exactly as before.
 */
export function applyProxyLabels(
  composeText: string,
  uuid: string,
  fqdns: Map<string, string>,
  network: string | null,
  port: number | null
): string {
  if (fqdns.size === 0 || !network) return composeText;

  let doc: Record<string, unknown>;
  try {
    doc = YAML.parse(composeText) as Record<string, unknown>;
  } catch {
    return composeText;
  }
  if (!doc || typeof doc !== 'object') return composeText;

  const services = (doc.services as Record<string, Record<string, unknown>> | undefined) ?? {};
  const byLowerName = new Map(Object.keys(services).map((name) => [name.toLowerCase(), name] as const));

  let touched = false;
  for (const [key, hostname] of fqdns) {
    const containerName = byLowerName.get(key.toLowerCase());
    if (!containerName) continue; // fqdn key that doesn't match any container in this compose
    const svc = services[containerName];

    const labels = traefikLabels({
      uuid: `${uuid}-${containerName}`,
      domains: [`https://${hostname}`],
      onlyPort: port,
      serviceName: containerName,
    });

    const existingLabels = Array.isArray(svc.labels) ? (svc.labels as string[]) : [];
    // This container is about to be attached to two networks (its own stack's
    // `default`, and the shared `ideploy` proxy network below) — confirmed live
    // that Traefik's Docker provider does not pick one on its own when a
    // container has more than one and silently never routes to it (a bare TCP
    // connect to the proxy succeeds, curl for the domain just hangs). Telling
    // it explicitly which network to use is the documented fix, not a guess.
    svc.labels = [...existingLabels, ...labels, `traefik.docker.network=${network}`];

    // Once a service declares `networks:` at all, Compose stops attaching it to
    // the implicit project `default` network — which is where its postgres/redis
    // neighbours still live, since they are left untouched. `default` has to be
    // listed explicitly here, alongside the new external network, or the
    // container gains a public route and loses its database in the same edit.
    const existingNetworks = Array.isArray(svc.networks) ? (svc.networks as string[]) : ['default'];
    const nextNetworks = new Set([...existingNetworks, 'default', network]);
    svc.networks = [...nextNetworks];

    touched = true;
  }

  if (!touched) return composeText;

  doc.networks = {
    ...((doc.networks as Record<string, unknown> | undefined) ?? {}),
    default: {},
    [network]: { external: true },
  };
  return YAML.stringify(doc);
}
