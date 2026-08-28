/**
 * Blocking traffic by country.
 *
 * ## Enforced by the proxy, not by CrowdSec
 *
 * A country selection is saved as an ordinary firewall rule and travels the same
 * classify path as every other rule, but `analyseRule` marks it `enforcedBy:
 * 'proxy'`, not `'crowdsec'`. CrowdSec accepts a country-scoped decision, so
 * pushing one would look like it worked; the bouncer the proxy runs has no GeoIP
 * at all and asks the Local API only about the client's IP address, which no
 * country decision can ever match. Blocking by country is instead a native
 * Traefik middleware (the `geoblock` plugin — see `docker/protection.ts`),
 * declared as a Docker label and populated straight from this rule by
 * `application-labels.service`'s `parseGeoBlockedCountries` on every deploy.
 *
 * The consequence worth stating plainly: a label is read when the container
 * starts, not on the fly, so a saved selection only takes effect once the
 * application is **redeployed**. `enforce()` reports that as `pendingRedeploy`,
 * and `setGeoRule` below surfaces the same fact as a warning at the point where
 * an operator is looking.
 *
 * ## Why it is still a rule, not a new subsystem
 *
 * Keeping the selection in `firewall_rules` means one classification path, one
 * status report, and one place where "saved" turns into "applied". A parallel
 * mechanism would need its own answer to every one of those.
 *
 * ## Country names
 *
 * Only the code → continent mapping lives here. Names come from ICU via
 * `Intl.DisplayNames`, which gives the French and English the interface needs
 * without a translated list to maintain — and without me hand-typing 250 country
 * names, each one an opportunity to be quietly wrong.
 */
import pool from '../config/db.config';
import { unprocessable } from '../utils/errors';
import * as appService from './application.service';
import { FirewallRule, createRule, deleteRule, listRules } from './firewall.service';

/** The continents a country can be grouped under. */
export type ContinentCode = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

export const CONTINENT_NAMES: Record<ContinentCode, { en: string; fr: string }> = {
  AF: { en: 'Africa', fr: 'Afrique' },
  AN: { en: 'Antarctica', fr: 'Antarctique' },
  AS: { en: 'Asia', fr: 'Asie' },
  EU: { en: 'Europe', fr: 'Europe' },
  NA: { en: 'North America', fr: 'Amérique du Nord' },
  OC: { en: 'Oceania', fr: 'Océanie' },
  SA: { en: 'South America', fr: 'Amérique du Sud' },
};

/**
 * ISO-3166-1 alpha-2 codes grouped by continent.
 *
 * The one piece of reference data that cannot be derived: ICU knows what `CM`
 * is called, not which continent it sits on.
 */
const COUNTRIES_BY_CONTINENT: Record<ContinentCode, string[]> = {
  AF: `AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG
       ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW`.split(/\s+/),
  AN: ['AQ', 'BV', 'GS', 'HM', 'TF'],
  AS: `AE AF AM AZ BD BH BN BT CC CN CX CY GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB
       LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE`.split(/\s+/),
  EU: `AD AL AT AX BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT
       LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK`.split(/\s+/),
  NA: `AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI
       PA PM PR SV SX TC TT US VC VG VI`.split(/\s+/),
  OC: `AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS`.split(/\s+/),
  SA: `AR BO BR CL CO EC FK GF GY PE PY SR UY VE`.split(/\s+/),
};

/**
 * Continent of each country, inverted once at load.
 *
 * Continent and country codes share an alphabet — `AS` is both Asia and
 * American Samoa, `NA` both North America and Namibia — but they never collide
 * here, because continents are the outer keys and countries only ever appear
 * inside the arrays. American Samoa is listed once, under Oceania, and that is
 * the entry this inversion produces.
 */
const CONTINENT_OF: Record<string, ContinentCode> = {};
for (const [continent, codes] of Object.entries(COUNTRIES_BY_CONTINENT)) {
  for (const code of codes) CONTINENT_OF[code] = continent as ContinentCode;
}

export interface Country {
  code: string;
  name: string;
  continent: ContinentCode;
}

/** Every country, named in the requested language. */
export function listCountries(locale = 'en'): Country[] {
  const display = new Intl.DisplayNames([locale], { type: 'region' });
  return Object.entries(CONTINENT_OF)
    .map(([code, continent]) => ({
      code,
      // ICU returns the code itself for anything it does not know, which is a
      // usable fallback — better than an empty label in a picker.
      name: display.of(code) ?? code,
      continent,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Countries of one continent, named in the requested language. */
export function countriesOfContinent(continent: ContinentCode, locale = 'en'): Country[] {
  return listCountries(locale).filter((c) => c.continent === continent);
}

/** Whether a string is a country code we know. */
export function isKnownCountry(code: string): boolean {
  return code.toUpperCase() in CONTINENT_OF;
}

/** Total number of countries — the denominator for the lockout guard. */
export const COUNTRY_COUNT = Object.keys(CONTINENT_OF).length;

/**
 * Expand a selection of countries and continents into a flat country list.
 *
 * Continents are expanded here rather than stored as such: enforcement will act
 * on countries whichever path is chosen, and keeping a continent as a continent
 * would mean re-expanding it at every reconciliation, against a list that could
 * have drifted in between.
 */
export function expandSelection(selection: {
  countries?: string[];
  continents?: ContinentCode[];
}): string[] {
  const codes = new Set<string>();

  for (const code of selection.countries ?? []) {
    const upper = code.toUpperCase();
    if (!isKnownCountry(upper)) {
      throw unprocessable('UNKNOWN_COUNTRY', `"${code}" is not a country code we recognise.`);
    }
    codes.add(upper);
  }

  for (const continent of selection.continents ?? []) {
    const countries = COUNTRIES_BY_CONTINENT[continent];
    if (!countries) {
      throw unprocessable(
        'UNKNOWN_CONTINENT',
        `"${continent}" is not a continent code. Expected one of ${Object.keys(CONTINENT_NAMES).join(', ')}.`
      );
    }
    for (const code of countries) codes.add(code);
  }

  return [...codes].sort();
}

/** How a geo rule reads a selection. */
export type GeoMode = 'block' | 'allow_only';

export interface GeoWarning {
  code: string;
  message: string;
}

/** The name a geo rule is stored under, so it can be found again. */
export const GEO_RULE_NAME = 'geo-blocking';

/**
 * Check a selection before it is saved.
 *
 * Two failure modes are worth separating. Locking out *every* country is
 * refused: it is never what someone means, and the person who would have to undo
 * it is the one who just locked themselves out. Blocking the country the
 * application's own server sits in is only *warned* about — it is unusual but
 * legitimate, and refusing it would be deciding on the operator's behalf with
 * less information than they have.
 */
export async function validateSelection(
  applicationId: number,
  mode: GeoMode,
  countries: string[]
): Promise<GeoWarning[]> {
  const blocked = mode === 'block' ? countries : complementOf(countries);

  if (mode === 'allow_only' && countries.length === 0) {
    throw unprocessable(
      'GEO_SELECTION_EMPTY',
      'Allowing no country blocks the whole world, including you. Choose at least one country to allow.'
    );
  }
  if (blocked.length >= COUNTRY_COUNT) {
    throw unprocessable(
      'GEO_BLOCKS_EVERYTHING',
      'This selection blocks every country, which takes the application offline for everyone. ' +
        'Turn the firewall off instead if that is the intent.'
    );
  }

  const warnings: GeoWarning[] = [
    // First, because it changes what "saved" means here: the proxy only reads
    // this at container start, so nothing changes for visitors until then.
    {
      code: 'REDEPLOY_REQUIRED',
      message:
        'This selection takes effect at the next deploy — the proxy reads it from ' +
        'the container’s labels when it starts, not while it is running.',
    },
  ];

  const { rows } = await pool.query<{ country_code: string | null }>(
    `SELECT s.country_code
     FROM applications a
     JOIN standalone_dockers d ON d.id = a.destination_id
     JOIN servers s ON s.id = d.server_id
     WHERE a.id = $1
     LIMIT 1`,
    [applicationId]
  );

  const serverCountry = rows[0]?.country_code?.toUpperCase();
  if (serverCountry && blocked.includes(serverCountry)) {
    warnings.push({
      code: 'BLOCKS_SERVER_COUNTRY',
      message:
        `This blocks ${serverCountry}, where the application's own server is hosted. ` +
        'If you administer it from that country you will lose access to the application yourself.',
    });
  }

  if (mode === 'allow_only') {
    warnings.push({
      code: 'ALLOW_ONLY_IS_BROAD',
      message:
        `Allowing only ${countries.length} country(ies) blocks the other ${blocked.length}. ` +
        'Every visitor outside the list is refused, including search engines and uptime checks.',
    });
  }

  return warnings;
}

/** Every country except the ones given. */
export function complementOf(allowed: string[]): string[] {
  const keep = new Set(allowed.map((c) => c.toUpperCase()));
  return Object.keys(CONTINENT_OF)
    .filter((code) => !keep.has(code))
    .sort();
}

export interface GeoRuleResult {
  rule: FirewallRule;
  /** Countries the rule blocks, after expansion. */
  blockedCountries: string[];
  warnings: GeoWarning[];
}

/**
 * Save the geo-blocking selection as a firewall rule.
 *
 * Replaces the previous geo rule rather than adding to it: the selection is a
 * single setting in the interface, and two rules disagreeing about which
 * countries are blocked would leave the reconciliation applying both.
 *
 * The caller still has to apply the rules — saving a rule does not enforce it,
 * and this module deliberately does not blur that line.
 */
export async function setGeoRule(
  teamId: number,
  appUuid: string,
  selection: { mode: GeoMode; countries?: string[]; continents?: ContinentCode[] }
): Promise<GeoRuleResult> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw unprocessable('NOT_FOUND', 'Application not found.');

  const selected = expandSelection(selection);
  const warnings = await validateSelection(app.id, selection.mode, selected);
  const blockedCountries = selection.mode === 'block' ? selected : complementOf(selected);

  await removeGeoRule(teamId, appUuid);

  const rule = await createRule(teamId, appUuid, {
    name: GEO_RULE_NAME,
    // This exact shape — `country` field, `in` operator, an array value — is
    // what `analyseRule` recognises and what `parseGeoBlockedCountries` reads
    // back at deploy time. Changing it here means changing both.
    conditions: [{ field: 'country', operator: 'in', value: blockedCountries }],
    action: 'block',
    // Ahead of the default 100: a country ban is a coarse decision and there is
    // no point evaluating finer rules for traffic that is refused outright.
    priority: 10,
    rule_type: 'inband',
  });

  return { rule, blockedCountries, warnings };
}

/** The saved geo rule, if there is one. */
export async function getGeoRule(teamId: number, appUuid: string): Promise<FirewallRule | null> {
  const rules = await listRules(teamId, appUuid);
  return rules.find((r) => r.name === GEO_RULE_NAME) ?? null;
}

/**
 * Remove the geo rule.
 *
 * Removing it stops the *intent*; the proxy keeps refusing the countries named
 * in its current labels until the application is redeployed without them — the
 * same redeploy-to-take-effect contract `setGeoRule` warns about on the way in.
 */
export async function removeGeoRule(teamId: number, appUuid: string): Promise<boolean> {
  const existing = await getGeoRule(teamId, appUuid);
  if (!existing) return false;
  return deleteRule(teamId, appUuid, existing.id);
}

/** The saved selection, read back for the interface. */
export async function getSelection(
  teamId: number,
  appUuid: string,
  locale = 'en'
): Promise<{ mode: GeoMode; countries: Country[] } | null> {
  const rule = await getGeoRule(teamId, appUuid);
  if (!rule) return null;

  const raw = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
  const values = Array.isArray(raw) ? ((raw[0]?.value as string[]) ?? []) : [];
  const catalogue = new Map(listCountries(locale).map((c) => [c.code, c]));

  return {
    // Stored as a block list either way; the interface shows what is blocked.
    mode: 'block',
    countries: values
      .map((code) => catalogue.get(code.toUpperCase()))
      .filter((c): c is Country => c !== undefined),
  };
}
