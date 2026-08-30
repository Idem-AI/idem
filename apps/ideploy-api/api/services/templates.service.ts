/**
 * One-click service templates — reads the same `service-templates.json` Coolify
 * ships (keyed by template name; each entry has a base64 `compose`, plus
 * slogan/documentation/tags/category/logo). Used to browse templates and to
 * create a Service from a template.
 *
 * The file lives in apps/ideploy/templates. We resolve it from several
 * candidate locations so it works whether run from source (cwd =
 * apps/ideploy-api), via __dirname, in Docker, or via an explicit env override.
 */
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

interface RawTemplate {
  documentation?: string;
  slogan?: string;
  compose?: string; // base64
  tags?: string[];
  category?: string;
  logo?: string;
  minversion?: string;
  /** Container port the template's primary service listens on — Coolify's own
   *  cue for what a `SERVICE_FQDN_*` domain should route to. Never read before:
   *  a service could resolve a real domain and still have no proxy route to it.
   *  Ships as a JSON string in the vendored file ("80", not 80) — confirmed
   *  live, not assumed. */
  port?: number | string;
}

function candidatePaths(filename: string): string[] {
  const paths: string[] = [];
  if (process.env.IDEPLOY_TEMPLATES_PATH) paths.push(path.join(path.dirname(process.env.IDEPLOY_TEMPLATES_PATH), filename));
  // Bundled copy inside ideploy-api (always present in local + Docker).
  // __dirname = api/services → up 2 = ideploy-api → /templates
  paths.push(path.join(__dirname, '../../templates', filename));
  paths.push(path.join(process.cwd(), 'templates', filename));
  // From compiled/run location: api/services → up to apps/ → ideploy/templates
  paths.push(path.join(__dirname, '../../../ideploy/templates', filename));
  paths.push(path.join(__dirname, '../../../../ideploy/templates', filename));
  // From the process working directory (npm run dev → apps/ideploy-api)
  paths.push(path.join(process.cwd(), '..', 'ideploy', 'templates', filename));
  paths.push(path.join(process.cwd(), 'apps', 'ideploy', 'templates', filename));
  // Docker / shared mount conventions
  paths.push(`/app/apps/ideploy/templates/${filename}`);
  return paths;
}

let cache: Record<string, RawTemplate> | null = null;

function load(): Record<string, RawTemplate> {
  if (cache) return cache;
  for (const p of candidatePaths('service-templates.json')) {
    try {
      if (fs.existsSync(p)) {
        cache = JSON.parse(fs.readFileSync(p, 'utf8'));
        logger.info('Loaded service templates', { path: p, count: Object.keys(cache!).length });
        return cache!;
      }
    } catch (err) {
      logger.warn('Failed to read service templates candidate', { path: p, message: (err as Error).message });
    }
  }
  logger.error('Service templates file not found in any candidate path', { tried: candidatePaths('service-templates.json') });
  cache = {};
  return cache;
}

/**
 * Hand-curated extra content for a handful of templates — a longer, sourced
 * overview and real screenshots (see `apps/ideploy-web/public/assets/service-screenshots/`),
 * gathered from each project's own site/docs/repo rather than invented. Most
 * templates have no entry here yet; `getTemplateSummary` falls back to the
 * one-line `slogan` when that's all that exists, same as before.
 */
interface RawEnrichment {
  overview?: string;
  /** Filenames under `assets/service-screenshots/<template-name>/`. */
  screenshots?: string[];
}

let enrichmentCache: Record<string, RawEnrichment> | null = null;

function loadEnrichment(): Record<string, RawEnrichment> {
  if (enrichmentCache) return enrichmentCache;
  for (const p of candidatePaths('template-enrichment.json')) {
    try {
      if (fs.existsSync(p)) {
        enrichmentCache = JSON.parse(fs.readFileSync(p, 'utf8'));
        return enrichmentCache!;
      }
    } catch (err) {
      logger.warn('Failed to read template enrichment candidate', { path: p, message: (err as Error).message });
    }
  }
  enrichmentCache = {};
  return enrichmentCache;
}

export interface TemplateSummary {
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  logo: string | null;
  tags: string[];
  /** Longer, sourced description — only present for the curated subset. */
  overview?: string;
  /** Relative paths under `assets/service-screenshots/` — only for the curated subset. */
  screenshots?: string[];
}

export function listTemplates(): TemplateSummary[] {
  const all = load();
  const enrichment = loadEnrichment();
  return Object.entries(all).map(([name, t]) => {
    const shots = enrichment[name]?.screenshots;
    return {
      name,
      slogan: t.slogan ?? '',
      documentation: t.documentation ?? '',
      category: t.category ?? 'other',
      logo: t.logo ?? null,
      tags: t.tags ?? [],
      // The full `overview` is left out here — it's only worth the extra
      // payload on the single-template fetch the detail page makes; the list
      // is fetched whole (278 templates) far more often. The screenshot
      // *paths* are a few short strings each, cheap enough to always include
      // so any card grid (including the New Project quick-picker) can show a
      // real preview instead of always falling back to the bare logo.
      ...(shots?.length ? { screenshots: shots.map((f) => `${name}/${f}`) } : {}),
    };
  });
}

/** A single template's summary, for the "browse → detail" page — null if unknown. */
export function getTemplateSummary(name: string): TemplateSummary | null {
  const t = load()[name];
  if (!t) return null;
  const enrichment = loadEnrichment()[name];
  return {
    name,
    slogan: t.slogan ?? '',
    documentation: t.documentation ?? '',
    category: t.category ?? 'other',
    logo: t.logo ?? null,
    tags: t.tags ?? [],
    ...(enrichment?.overview ? { overview: enrichment.overview } : {}),
    ...(enrichment?.screenshots?.length ? { screenshots: enrichment.screenshots.map((f) => `${name}/${f}`) } : {}),
  };
}

/** Return the decoded docker-compose for a template, or null if unknown. */
export function getTemplateCompose(name: string): string | null {
  const t = load()[name];
  if (!t?.compose) return null;
  return Buffer.from(t.compose, 'base64').toString('utf8');
}

/** The port the template's primary (FQDN'd) service listens on, or null if unset. */
export function getTemplatePort(name: string): number | null {
  const raw = load()[name]?.port;
  const port = Number(raw);
  return raw !== undefined && raw !== null && Number.isFinite(port) && port > 0 ? port : null;
}
