/**
 * Protections the proxy applies itself.
 *
 * Everything CrowdSec cannot reach. Its bouncer answers one question — "is this
 * *address* banned?" — so blocking by country, capping request rate and limiting
 * concurrency all have to happen in Traefik, which sees the request before any
 * of them matters.
 *
 * ## Native first
 *
 * Rate limiting and concurrency are Traefik's own middlewares: no plugin, no
 * external call, nothing to install. Geo-blocking is the one exception — Traefik
 * has no notion of a country — and it costs a plugin, which is why it is the
 * only thing here with an operational caveat attached.
 *
 * ## Casing is load-bearing
 *
 * The CrowdSec bouncer takes **PascalCase** keys because its plugin maps them
 * onto Go struct fields, and the lower-case spelling silently yields a
 * middleware with default settings. The geoblock plugin takes **camelCase**.
 * They are different plugins by different authors and the spellings do not
 * transfer; getting one wrong produces a middleware that loads, reports nothing
 * and filters nothing. Each generator below is written against its own plugin's
 * manifest, and the tests assert the exact strings.
 */

/** Module path Traefik loads the geo plugin from, declared in its static config. */
export const GEOBLOCK_MODULE = 'github.com/PascalMinder/geoblock';

/** Pinned: a plugin that changes its option names between versions breaks silently. */
export const GEOBLOCK_VERSION = process.env.TRAEFIK_GEOBLOCK_VERSION || 'v0.3.3';

/** Plugin name in the static config, and therefore the label prefix. */
const GEOBLOCK_PLUGIN = 'geoblock';

/**
 * Country lookups the plugin caches in memory, per middleware.
 *
 * The default of 15 is a demonstration value: with real traffic it evicts
 * constantly, and every eviction is another outbound lookup in the request path.
 */
const GEO_CACHE_SIZE = Number(process.env.TRAEFIK_GEOBLOCK_CACHE_SIZE || 4096);

/** How long a cached country lookup stays good. A day: countries do not move. */
const GEO_CACHE_TTL_SECONDS = Number(process.env.TRAEFIK_GEOBLOCK_CACHE_TTL || 86_400);

/** Per-IP lookup budget. Past this the request proceeds under the fail-open rule. */
const GEO_API_TIMEOUT_MS = Number(process.env.TRAEFIK_GEOBLOCK_TIMEOUT_MS || 500);

/** Endpoint resolving an address to a country. `{ip}` is the plugin's placeholder. */
const GEO_API = process.env.TRAEFIK_GEOBLOCK_API || 'https://get.geojs.io/v1/ip/country/{ip}';

export interface GeoBlockOptions {
  /** ISO-3166-1 alpha-2 codes to refuse. */
  blockedCountries: string[];
  /** Paths that bypass the check entirely, e.g. a health endpoint. */
  excludedPaths?: string[];
}

/** Middleware name for an application's geo filter. */
export function geoBlockMiddlewareName(uuid: string): string {
  return `geoblock-${uuid}`;
}

/**
 * Declare the geo-blocking middleware.
 *
 * ## Why this fails open
 *
 * The plugin resolves a visitor's country by calling an external service, once
 * per uncached address. That service is not ours, and on a platform hosting
 * other people's applications its bad day must not become theirs: with
 * `ignoreAPITimeout` and `ignoreAPIFailures` off, an outage at the lookup
 * provider would turn every geo-protected site dark at once.
 *
 * So a lookup that times out or errors lets the request through. That is a
 * deliberate trade: geo-blocking is a coarse filter — trivially defeated by a
 * VPN, and never the thing standing between an attacker and the application —
 * whereas a platform-wide outage caused by a third party's downtime is a real
 * incident. Blocking by address stays with CrowdSec, which is local and has no
 * such dependency.
 */
export function geoBlockLabels(uuid: string, options: GeoBlockOptions): string[] {
  const prefix = `traefik.http.middlewares.${geoBlockMiddlewareName(uuid)}.plugin.${GEOBLOCK_PLUGIN}`;

  const labels = [
    // The list names what is *refused*: without this the plugin reads `countries`
    // as an allow-list and blocks the entire rest of the world.
    `${prefix}.blackListMode=true`,
    `${prefix}.api=${GEO_API}`,
    `${prefix}.apiTimeoutMs=${GEO_API_TIMEOUT_MS}`,
    `${prefix}.cacheSize=${GEO_CACHE_SIZE}`,
    `${prefix}.cacheTtlSeconds=${GEO_CACHE_TTL_SECONDS}`,
    // Health checks and container-to-container traffic come from private
    // addresses that resolve to no country; geo-filtering them would break the
    // platform's own probes.
    `${prefix}.allowLocalRequests=true`,
    `${prefix}.allowUnknownCountries=true`,
    // See the note above: a third party's outage must not take the platform down.
    `${prefix}.ignoreAPITimeout=true`,
    `${prefix}.ignoreAPIFailures=true`,
    // One log line per allowed request, on every request, is a disk-filling
    // default. Refusals are what matter and are logged regardless.
    `${prefix}.logAllowedRequests=false`,
    `${prefix}.logLocalRequests=false`,
    `${prefix}.logApiRequests=false`,
    `${prefix}.silentStartUp=false`,
  ];

  for (const [index, country] of options.blockedCountries.entries()) {
    labels.push(`${prefix}.countries[${index}]=${country.toUpperCase()}`);
  }

  for (const [index, path] of (options.excludedPaths ?? []).entries()) {
    labels.push(`${prefix}.excludedPathPatterns[${index}]=${path}`);
  }

  return labels;
}

export interface RateLimitOptions {
  /** Sustained requests per second, per client. */
  averagePerSecond: number;
  /** How far above the average a short spike may go before it is refused. */
  burst?: number;
  /** Window the average is computed over. */
  periodSeconds?: number;
}

/** Middleware name for an application's rate limit. */
export function rateLimitMiddlewareName(uuid: string): string {
  return `ratelimit-${uuid}`;
}

/**
 * Declare the rate limit. Native Traefik — no plugin, no external call.
 *
 * Limits are per client address, and the source is taken from the forwarded
 * header depth the proxy already trusts elsewhere. Getting that wrong is the
 * classic rate-limiter failure: keyed on the proxy's own address, every visitor
 * shares one bucket and the first busy moment locks out the whole world.
 */
export function rateLimitLabels(
  uuid: string,
  options: RateLimitOptions,
  forwardedDepth = 1
): string[] {
  const prefix = `traefik.http.middlewares.${rateLimitMiddlewareName(uuid)}.ratelimit`;

  return [
    `${prefix}.average=${options.averagePerSecond}`,
    // Traefik's own default burst is 1, which refuses any two simultaneous
    // requests — including the parallel asset loads of one ordinary page view.
    `${prefix}.burst=${options.burst ?? Math.max(options.averagePerSecond * 2, 10)}`,
    `${prefix}.period=${options.periodSeconds ?? 1}s`,
    `${prefix}.sourceCriterion.ipStrategy.depth=${forwardedDepth}`,
  ];
}

export interface ConcurrencyOptions {
  /** Requests allowed to be in flight at once, per client. */
  maxInFlight: number;
}

export function concurrencyMiddlewareName(uuid: string): string {
  return `inflight-${uuid}`;
}

/**
 * Cap simultaneous requests from one client. Native Traefik.
 *
 * Complements the rate limit rather than repeating it: a rate limit bounds
 * requests over time, this bounds the ones held open at once — which is what a
 * slow-request flood exhausts.
 */
export function concurrencyLabels(
  uuid: string,
  options: ConcurrencyOptions,
  forwardedDepth = 1
): string[] {
  const prefix = `traefik.http.middlewares.${concurrencyMiddlewareName(uuid)}.inflightreq`;

  return [
    `${prefix}.amount=${options.maxInFlight}`,
    `${prefix}.sourceCriterion.ipStrategy.depth=${forwardedDepth}`,
  ];
}

/**
 * The plugin declaration Traefik needs in its **static** configuration.
 *
 * Static, not dynamic: Traefik loads plugins at start-up, so adding a geo rule
 * to a running proxy that was never told about the plugin produces a middleware
 * reference pointing at nothing. Returned as flags so the proxy bootstrap can
 * add them alongside the bouncer's.
 */
export function geoBlockStaticFlags(): string[] {
  return [
    `--experimental.plugins.${GEOBLOCK_PLUGIN}.modulename=${GEOBLOCK_MODULE}`,
    `--experimental.plugins.${GEOBLOCK_PLUGIN}.version=${GEOBLOCK_VERSION}`,
  ];
}
