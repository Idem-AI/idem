/**
 * Reverse-proxy label generation.
 *
 * This is what turns a running container into a reachable HTTPS URL. Without it
 * a deployment succeeds and the application is unreachable — which is why this
 * was the most valuable gap in the rewrite.
 *
 * Ports `fqdnLabelsForTraefik` / `fqdnLabelsForCaddy` / `defaultLabels` from the
 * Laravel side. Behaviour is faithful; the structure is not. The original repeats
 * the same middleware-assembly block four times (https/http × path/root), which
 * is how the four copies drifted apart. Here the router shape is expressed once
 * and the middleware chain is built once.
 *
 * Labels are emitted sorted, matching the original, so a configuration change
 * produces a readable diff instead of a reordering.
 */
import bcrypt from 'bcryptjs';

export type ProxyType = 'traefik' | 'caddy' | 'none';

/** Which host form is canonical: keep both, force `www.`, or force the apex. */
export type RedirectDirection = 'both' | 'www' | 'non-www';

/** Cost 10, matching Laravel's `password_hash(..., PASSWORD_BCRYPT, ['cost' => 10])`. */
const BCRYPT_COST = 10;

/** Traefik's certificate resolver, as configured in the default proxy config. */
const CERT_RESOLVER = 'letsencrypt';

export interface BasicAuth {
  username: string;
  /** Plaintext; hashed here because the proxy expects a bcrypt digest. */
  password: string;
}

/**
 * What the Traefik bouncer plugin needs to consult CrowdSec.
 *
 * Present only when the application's firewall is enabled *and* a bouncer key
 * exists: emitting these labels without a usable key would leave the middleware
 * declared and failing, which is worse than not declaring it.
 */
import {
  ConcurrencyOptions,
  GeoBlockOptions,
  RateLimitOptions,
  concurrencyLabels,
  concurrencyMiddlewareName,
  geoBlockLabels,
  geoBlockMiddlewareName,
  rateLimitLabels,
  rateLimitMiddlewareName,
} from './protection';

export interface CrowdSecBouncer {
  /** Bouncer API key. Goes into a label, so it is never logged. */
  apiKey: string;
  /** Local API host, without scheme — the plugin adds it separately. */
  lapiHost: string;
  /** How long a decision applies when CrowdSec does not say. */
  banDurationSeconds: number;
  /** `http` unless the LAPI is behind TLS. */
  scheme?: 'http' | 'https';
}

/**
 * Networks whose forwarded headers we trust for the client address.
 *
 * The proxy sits in front, so the immediate peer is always private; without this
 * every request would appear to come from the Docker network and no ban could
 * ever match a real visitor.
 */
const TRUSTED_FORWARDED_RANGES = '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16';

/**
 * Plugin log level.
 *
 * The Laravel side pins this to DEBUG, which prints a line per request —
 * including client addresses — and fills the disk of a busy server. INFO is the
 * sane default; the variable is there for when someone is actually debugging.
 */
const BOUNCER_LOG_LEVEL = process.env.CROWDSEC_BOUNCER_LOG_LEVEL || 'INFO';

/** Module Traefik loads the bouncer plugin from. Matches the Laravel side. */
const BOUNCER_MODULE = 'github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin';

/** Pinned, like the geoblock plugin: an option-name change between versions must not surprise us. */
const BOUNCER_VERSION = process.env.TRAEFIK_BOUNCER_VERSION || 'v1.3.5';

/**
 * The plugin declaration Traefik needs in its **static** configuration.
 *
 * A dynamic label referencing `plugin.bouncer` means nothing to a Traefik
 * instance that was never told the plugin exists — the proxy's own bootstrap
 * must carry this, not just the per-application labels `crowdsecLabels`
 * produces. Declared unconditionally rather than only when a tenant enables the
 * firewall: the proxy is shared, plugins load once at start-up, and gating this
 * on a single tenant's setting would mean restarting a shared proxy the first
 * time anyone turns the firewall on.
 */
export function bouncerStaticFlags(): string[] {
  return [
    `--experimental.plugins.bouncer.modulename=${BOUNCER_MODULE}`,
    `--experimental.plugins.bouncer.version=${BOUNCER_VERSION}`,
  ];
}

export interface FqdnLabelOptions {
  /** Application uuid — namespaces every router and middleware name. */
  uuid: string;
  /** One or more absolute URLs (`https://app.example.com/api`). */
  domains: string[];
  forceHttps?: boolean;
  /** Container port used when a domain does not name one. */
  onlyPort?: number | null;
  gzip?: boolean;
  stripPrefix?: boolean;
  redirect?: RedirectDirection;
  /** Set for one service of a multi-service compose stack. */
  serviceName?: string | null;
  basicAuth?: BasicAuth | null;
  /** Middleware names pulled from the user's own labels, appended to each router. */
  extraMiddlewares?: string[];
  /** Firewall bouncer, when the application has one configured and enabled. */
  crowdsec?: CrowdSecBouncer | null;
  /** Countries to refuse. CrowdSec cannot do this; the proxy can. */
  geoBlock?: GeoBlockOptions | null;
  /** Per-client request rate cap. Native Traefik. */
  rateLimit?: RateLimitOptions | null;
  /** Per-client simultaneous request cap. Native Traefik. */
  concurrency?: ConcurrencyOptions | null;
}

export interface ParsedDomain {
  scheme: 'http' | 'https';
  host: string;
  /** Always starts with `/`. */
  path: string;
  port: number | null;
}

/**
 * Parse a configured domain.
 *
 * Returns null instead of throwing: one malformed entry among several must not
 * cost the application its other domains, which is what the original's
 * `try { … } catch { continue; }` achieves.
 */
export function parseDomain(raw: string, forceHttps = false): ParsedDomain | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    // A bare host is a common way to write this; assume http and let
    // `forceHttps` decide, exactly as the Laravel URL parser ends up doing.
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
    if (!url.hostname) return null;

    // An http domain with force-HTTPS on is treated as https, so both the HTTPS
    // router and the HTTP→HTTPS redirect get generated.
    const scheme = url.protocol === 'https:' || forceHttps ? 'https' : 'http';

    return {
      scheme,
      host: url.hostname,
      path: url.pathname || '/',
      port: url.port ? Number(url.port) : null,
    };
  } catch {
    return null;
  }
}

/** Hash a basic-auth password the way the proxy expects to read it. */
export function hashBasicAuthPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

interface RouterContext {
  labels: string[];
  middlewares: string[];
}

/**
 * Assemble the middleware chain shared by every router.
 *
 * Order matters and mirrors the original: path stripping, compression, host
 * canonicalisation, authentication, then the user's own.
 */
function buildMiddlewares(
  routerLabel: string,
  domain: ParsedDomain,
  options: FqdnLabelOptions,
  basicAuthLabel: string | null
): RouterContext {
  const labels: string[] = [];
  const middlewares: string[] = [];

  // Only meaningful on a sub-path: there is nothing to strip at the root.
  if (domain.path !== '/' && options.stripPrefix !== false) {
    labels.push(
      `traefik.http.middlewares.${routerLabel}-stripprefix.stripprefix.prefixes=${domain.path}`
    );
    middlewares.push(`${routerLabel}-stripprefix`);
  }

  if (options.gzip !== false) middlewares.push('gzip');

  const redirect = options.redirect ?? 'both';
  const isWww = domain.host.startsWith('www.');
  const prefix = `${routerLabel}`;

  if (redirect === 'non-www' && isWww) {
    const name = `${prefix}-to-non-www`;
    labels.push(
      `traefik.http.middlewares.${name}.redirectregex.regex=^(http|https)://www\\.(.+)`,
      `traefik.http.middlewares.${name}.redirectregex.replacement=\${1}://\${2}`,
      `traefik.http.middlewares.${name}.redirectregex.permanent=false`
    );
    middlewares.push(name);
  }

  if (redirect === 'www' && !isWww) {
    const name = `${prefix}-to-www`;
    labels.push(
      `traefik.http.middlewares.${name}.redirectregex.regex=^(http|https)://(?:www\\.)?(.+)`,
      `traefik.http.middlewares.${name}.redirectregex.replacement=\${1}://www.\${2}`,
      `traefik.http.middlewares.${name}.redirectregex.permanent=false`
    );
    middlewares.push(name);
  }

  if (basicAuthLabel) middlewares.push(basicAuthLabel);
  middlewares.push(...(options.extraMiddlewares ?? []));

  // The protections go last, so they see the request after any rewriting, and —
  // more importantly — they are *referenced here*, not merely declared
  // elsewhere. A middleware no router lists is configuration that inspects
  // nothing while appearing configured.
  //
  // Cheapest check first: geo and the two limiters decide from the connection
  // alone, while the bouncer may have to ask CrowdSec. Refusing a banned country
  // costs nothing and saves that round trip.
  if (options.geoBlock && options.geoBlock.blockedCountries.length > 0) {
    middlewares.push(geoBlockMiddlewareName(options.uuid));
  }
  if (options.concurrency) middlewares.push(concurrencyMiddlewareName(options.uuid));
  if (options.rateLimit) middlewares.push(rateLimitMiddlewareName(options.uuid));
  if (options.crowdsec) middlewares.push(crowdsecMiddlewareName(options.uuid));

  return { labels, middlewares };
}

/** Middleware name for an application's bouncer. */
export function crowdsecMiddlewareName(uuid: string): string {
  return `crowdsec-${uuid}`;
}

/**
 * Declare the bouncer middleware.
 *
 * Keys are PascalCase because the plugin maps them onto Go struct fields; the
 * lower-case spelling silently yields a middleware with default settings — which
 * means no LAPI, and therefore no blocking.
 */
function crowdsecLabels(uuid: string, bouncer: CrowdSecBouncer): string[] {
  const prefix = `traefik.http.middlewares.${crowdsecMiddlewareName(uuid)}.plugin.bouncer`;

  return [
    `${prefix}.enabled=true`,
    `${prefix}.CrowdsecLapiKey=${bouncer.apiKey}`,
    `${prefix}.CrowdsecLapiHost=${bouncer.lapiHost}`,
    `${prefix}.CrowdsecLapiScheme=${bouncer.scheme ?? 'http'}`,
    // `live` queries the LAPI per request rather than caching a stream, so a ban
    // takes effect immediately instead of at the next refresh.
    `${prefix}.CrowdsecMode=live`,
    `${prefix}.DefaultDecisionSeconds=${bouncer.banDurationSeconds}`,
    `${prefix}.HttpTimeoutSeconds=10`,
    `${prefix}.UpdateIntervalSeconds=5`,
    `${prefix}.LogLevel=${BOUNCER_LOG_LEVEL}`,
    `${prefix}.ForwardedHeadersTrustedIPs=${TRUSTED_FORWARDED_RANGES}`,
    `${prefix}.RedisCacheEnabled=false`,
  ];
}

/** Rule + entrypoint + backend port for one router. */
function routerLabels(
  routerLabel: string,
  entryPoint: 'http' | 'https',
  domain: ParsedDomain,
  port: number | null
): string[] {
  const labels = [
    `traefik.http.routers.${routerLabel}.rule=Host(\`${domain.host}\`) && PathPrefix(\`${domain.path}\`)`,
    `traefik.http.routers.${routerLabel}.entryPoints=${entryPoint}`,
  ];
  if (port) {
    labels.push(
      `traefik.http.routers.${routerLabel}.service=${routerLabel}`,
      `traefik.http.services.${routerLabel}.loadbalancer.server.port=${port}`
    );
  }
  return labels;
}

/**
 * Traefik labels for an application's domains.
 *
 * For an HTTPS domain two routers are produced: the HTTPS one that serves the
 * app, and an HTTP one that either serves it too or redirects, depending on
 * `forceHttps`. Emitting only the HTTPS router would make the site unreachable
 * over plain HTTP with no redirect — a silent half-configuration.
 */
export function traefikLabels(options: FqdnLabelOptions): string[] {
  const labels: string[] = ['traefik.enable=true'];

  if (options.gzip !== false) {
    labels.push('traefik.http.middlewares.gzip.compress=true');
  }
  labels.push('traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https');

  let basicAuthLabel: string | null = null;
  if (options.basicAuth?.username && options.basicAuth.password) {
    basicAuthLabel = `http-basic-auth-${options.uuid}`;
    const hash = hashBasicAuthPassword(options.basicAuth.password);
    labels.push(
      `traefik.http.middlewares.${basicAuthLabel}.basicauth.users=${options.basicAuth.username}:${hash}`
    );
  }

  if (options.crowdsec) {
    labels.push(...crowdsecLabels(options.uuid, options.crowdsec));
  }
  if (options.geoBlock && options.geoBlock.blockedCountries.length > 0) {
    labels.push(...geoBlockLabels(options.uuid, options.geoBlock));
  }
  if (options.rateLimit) {
    labels.push(...rateLimitLabels(options.uuid, options.rateLimit));
  }
  if (options.concurrency) {
    labels.push(...concurrencyLabels(options.uuid, options.concurrency));
  }

  options.domains.forEach((raw, index) => {
    const domain = parseDomain(raw, options.forceHttps);
    if (!domain) return;

    const suffix = options.serviceName
      ? `${index}-${options.uuid}-${options.serviceName}`
      : `${index}-${options.uuid}`;
    const httpLabel = `http-${suffix}`;
    const httpsLabel = `https-${suffix}`;
    const port = domain.port ?? options.onlyPort ?? null;

    if (domain.scheme === 'https') {
      labels.push(...routerLabels(httpsLabel, 'https', domain, port));

      const { labels: middlewareLabels, middlewares } = buildMiddlewares(
        httpsLabel,
        domain,
        options,
        basicAuthLabel
      );
      labels.push(...middlewareLabels);
      if (middlewares.length > 0) {
        labels.push(`traefik.http.routers.${httpsLabel}.middlewares=${middlewares.join(',')}`);
      }

      labels.push(
        `traefik.http.routers.${httpsLabel}.tls=true`,
        `traefik.http.routers.${httpsLabel}.tls.certresolver=${CERT_RESOLVER}`
      );

      // The companion HTTP router: redirects when force-HTTPS is on, serves
      // otherwise, so the site is never simply absent on port 80.
      labels.push(...routerLabels(httpLabel, 'http', domain, port));
      if (options.forceHttps) {
        labels.push(`traefik.http.routers.${httpLabel}.middlewares=redirect-to-https`);
      }
      return;
    }

    labels.push(...routerLabels(httpLabel, 'http', domain, port));
    const { labels: middlewareLabels, middlewares } = buildMiddlewares(
      httpLabel,
      domain,
      options,
      basicAuthLabel
    );
    labels.push(...middlewareLabels);
    if (middlewares.length > 0) {
      labels.push(`traefik.http.routers.${httpLabel}.middlewares=${middlewares.join(',')}`);
    }
  });

  return [...new Set(labels)].sort();
}

/** Caddy labels for the same domains, for servers running Caddy as their proxy. */
export function caddyLabels(network: string, options: FqdnLabelOptions): string[] {
  const labels: string[] = [`caddy_ingress_network=${network}`];

  let hash: string | null = null;
  if (options.basicAuth?.username && options.basicAuth.password) {
    hash = hashBasicAuthPassword(options.basicAuth.password);
  }

  options.domains.forEach((raw, index) => {
    const domain = parseDomain(raw, options.forceHttps);
    if (!domain) return;

    const port = domain.port ?? options.onlyPort ?? null;
    // `handle_path` strips the matched prefix; `handle` keeps it.
    const handle = options.stripPrefix !== false ? 'handle_path' : 'handle';
    const hostWithoutWww = domain.host.replace(/^www\./, '');

    labels.push(
      `caddy_${index}=${domain.scheme}://${domain.host}`,
      `caddy_${index}.header=-Server`,
      `caddy_${index}.try_files={path} /index.html /index.php`,
      `caddy_${index}.${handle}.${index}_reverse_proxy={{upstreams${port ? ` ${port}` : ''}}}`,
      `caddy_${index}.${handle}=${domain.path}*`
    );

    if (options.gzip !== false) {
      labels.push(`caddy_${index}.encode=zstd gzip`);
    }

    const redirect = options.redirect ?? 'both';
    const isWww = domain.host.startsWith('www.');
    if (redirect === 'www' && !isWww) {
      labels.push(`caddy_${index}.redir=${domain.scheme}://www.${domain.host}{uri}`);
    }
    if (redirect === 'non-www' && isWww) {
      labels.push(`caddy_${index}.redir=${domain.scheme}://${hostWithoutWww}{uri}`);
    }
    if (hash) {
      labels.push(`caddy_${index}.basicauth.${options.basicAuth!.username}="${hash}"`);
    }
  });

  return [...new Set(labels)].sort();
}

/** Slugify the way `Str::slug` does, so labels match between the two stacks. */
export function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface DefaultLabelInput {
  id: number;
  name: string;
  workspaceName: string;
  resourceName: string;
  environment: string;
  type?: 'application' | 'service' | 'database';
  pullRequestId?: number;
}

/**
 * Ownership labels.
 *
 * These are how we tell our containers apart from everything else on a server —
 * used by status queries, cleanup, and the "resources" view. Dropping one makes
 * a container invisible to the platform that created it.
 */
export function defaultLabels(input: DefaultLabelInput): string[] {
  const type = input.type ?? 'application';
  return [
    'ideploy.managed=true',
    `ideploy.${type}Id=${input.id}`,
    `ideploy.type=${type}`,
    `ideploy.name=${input.name}`,
    `ideploy.resourceName=${slug(input.resourceName)}`,
    `ideploy.projectName=${slug(input.workspaceName)}`,
    `ideploy.serviceName=${slug(input.resourceName)}`,
    `ideploy.environmentName=${slug(input.environment)}`,
    `ideploy.pullRequestId=${input.pullRequestId ?? 0}`,
  ];
}

/**
 * Middleware names referenced by a user's own labels.
 *
 * A user who defines `traefik.http.middlewares.rate-limit.…` expects it applied,
 * not merely declared; the original scans their labels for exactly this reason.
 * `ideploy.traefik.middlewares=a,b` names middlewares defined elsewhere.
 */
export function extractMiddlewareNames(customLabels: string[]): string[] {
  const names = new Set<string>();

  for (const label of customLabels) {
    const declared = /traefik\.http\.middlewares\.(.*?)(?:\.|$)/.exec(label);
    if (declared?.[1]) names.add(declared[1]);

    const referenced = /ideploy\.traefik\.middlewares=(.*)/.exec(label);
    if (referenced?.[1]) {
      for (const name of referenced[1].split(',')) {
        const trimmed = name.trim();
        if (trimmed) names.add(trimmed);
      }
    }
  }

  return [...names];
}

/** Decode the base64 blob the `custom_labels` column stores. */
export function decodeCustomLabels(encoded: string | null): string[] {
  if (!encoded) return [];
  try {
    return Buffer.from(encoded, 'base64')
      .toString('utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
