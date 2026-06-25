/**
 * One-click service templates — reads the same `service-templates.json` Coolify
 * ships (keyed by template name; each entry has a base64 `compose`). Used to
 * create a Service from a template.
 */
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

const TEMPLATES_PATH =
  process.env.IDEPLOY_TEMPLATES_PATH ||
  path.join(process.cwd(), '..', 'ideploy', 'templates', 'service-templates.json');

interface RawTemplate {
  documentation?: string;
  slogan?: string;
  compose?: string; // base64
  tags?: string[];
  logo?: string;
}

let cache: Record<string, RawTemplate> | null = null;

function load(): Record<string, RawTemplate> {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
  } catch (err) {
    logger.warn('Could not load service templates', {
      path: TEMPLATES_PATH,
      message: (err as Error).message,
    });
    cache = {};
  }
  return cache!;
}

export interface TemplateSummary {
  name: string;
  slogan: string;
  documentation: string;
  tags: string[];
}

export function listTemplates(): TemplateSummary[] {
  const all = load();
  return Object.entries(all).map(([name, t]) => ({
    name,
    slogan: t.slogan ?? '',
    documentation: t.documentation ?? '',
    tags: t.tags ?? [],
  }));
}

/** Return the decoded docker-compose for a template, or null if unknown. */
export function getTemplateCompose(name: string): string | null {
  const t = load()[name];
  if (!t?.compose) return null;
  return Buffer.from(t.compose, 'base64').toString('utf8');
}
