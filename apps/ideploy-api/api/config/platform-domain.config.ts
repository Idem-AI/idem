/**
 * The domain iDeploy gives applications their free address under.
 *
 * Written here, not read from the environment. The production `.env` kept
 * `IDEPLOY_PLATFORM_DOMAIN=idem.africa` after the move to `ideploy.site`, and
 * nothing said so: new applications kept getting `monapp-xxxxx.idem.africa`,
 * and the startup migration, which waited for that variable to change, never
 * ran (customer report, 27/11/2026). A value that must be the same everywhere
 * belongs in the code.
 *
 * Users' applications do not belong under `idem.africa`, the domain of IDEM's
 * own services and of its session cookies.
 */
export const PLATFORM_DOMAIN = 'ideploy.site';

/** Where applications used to get their address. Only the startup migration still writes to it, to remove records. */
export const LEGACY_PLATFORM_DOMAIN = 'idem.africa';

const endsWithDomain = (host: string, domain: string) => host.toLowerCase().endsWith(`.${domain}`);

/** `monapp.ideploy.site`: an address iDeploy writes in DNS itself. */
export const isOnPlatformDomain = (host: string) => endsWithDomain(host, PLATFORM_DOMAIN);

/** `monapp.idem.africa`: an address from before the move, waiting for the migration. */
export const isOnLegacyPlatformDomain = (host: string) => endsWithDomain(host, LEGACY_PLATFORM_DOMAIN);
