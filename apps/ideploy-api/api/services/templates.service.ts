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
}

function candidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.IDEPLOY_TEMPLATES_PATH) paths.push(process.env.IDEPLOY_TEMPLATES_PATH);
  // Bundled copy inside ideploy-api (always present in local + Docker).
  // __dirname = api/services → up 2 = ideploy-api → /templates
  paths.push(path.join(__dirname, '../../templates/service-templates.json'));
  paths.push(path.join(process.cwd(), 'templates', 'service-templates.json'));
  // From compiled/run location: api/services → up to apps/ → ideploy/templates
  paths.push(path.join(__dirname, '../../../ideploy/templates/service-templates.json'));
  paths.push(path.join(__dirname, '../../../../ideploy/templates/service-templates.json'));
  // From the process working directory (npm run dev → apps/ideploy-api)
  paths.push(path.join(process.cwd(), '..', 'ideploy', 'templates', 'service-templates.json'));
  paths.push(path.join(process.cwd(), 'apps', 'ideploy', 'templates', 'service-templates.json'));
  // Docker / shared mount conventions
  paths.push('/app/apps/ideploy/templates/service-templates.json');
  // A copy bundled next to ideploy-api (optional)
  paths.push(path.join(process.cwd(), 'templates', 'service-templates.json'));
  return paths;
}

let cache: Record<string, RawTemplate> | null = null;

function load(): Record<string, RawTemplate> {
  if (cache) return cache;
  for (const p of candidatePaths()) {
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
  logger.error('Service templates file not found in any candidate path', { tried: candidatePaths() });
  cache = {};
  return cache;
}

export interface TemplateSummary {
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  logo: string | null;
  tags: string[];
}

export function listTemplates(): TemplateSummary[] {
  const all = load();
  return Object.entries(all).map(([name, t]) => ({
    name,
    slogan: t.slogan ?? '',
    documentation: t.documentation ?? '',
    category: t.category ?? 'other',
    logo: t.logo ?? null,
    tags: t.tags ?? [],
  }));
}

/** Return the decoded docker-compose for a template, or null if unknown. */
export function getTemplateCompose(name: string): string | null {
  const t = load()[name];
  if (!t?.compose) return null;
  return Buffer.from(t.compose, 'base64').toString('utf8');
}
