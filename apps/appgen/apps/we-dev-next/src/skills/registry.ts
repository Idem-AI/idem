/**
 * Skill registry — tier 1 and tier 2 of progressive disclosure.
 *
 * Skills follow the Agent Skills convention: a markdown file whose YAML
 * frontmatter carries the metadata an agent needs to decide *whether* to read
 * the body, and whose body carries the instructions themselves.
 *
 *   tier 1  metadata only (name + description)  — always cheap, always in hand
 *   tier 2  the SKILL.md body                   — loaded when the router selects it
 *   tier 3  files under `references/`           — loaded on explicit demand (MCP)
 *
 * Files are read from disk once and cached in memory, so editing a skill is a
 * markdown edit plus a restart, not a code change.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type SkillTier = 'core' | 'contextual';

export interface SkillMeta {
  name: string;
  description: string;
  tier: SkillTier;
  /** Lowercase keywords the router matches against the request. */
  triggers: string[];
  /** Registers this skill applies to; empty means both. */
  registers: string[];
  /** Tie-breaker when several skills score the same. Higher wins. */
  priority: number;
  /** Rough token cost of the body, used for budgeting. */
  tokens: number;
}

export interface Skill extends SkillMeta {
  body: string;
}

const CATALOG_DIR = join(dirname(fileURLToPath(import.meta.url)), 'catalog');

/** Chars-per-token is close enough for budgeting and costs nothing to compute. */
export const estimateSkillTokens = (text: string): number => Math.ceil(text.length / 4);

/**
 * Frontmatter reader for the small, flat subset the catalog uses (scalars and
 * inline `[a, b]` lists). A YAML dependency would buy nothing here.
 */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    return { data: {}, body: raw.trim() };
  }

  const data: Record<string, string> = {};

  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1 || line.trimStart().startsWith('#')) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    if (key) {
      data[key] = value;
    }
  }

  return { data, body: match[2].trim() };
}

const parseList = (value?: string): string[] =>
  (value ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean);

let cache: Skill[] | null = null;

export function loadSkills(): Skill[] {
  if (cache) {
    return cache;
  }

  if (!existsSync(CATALOG_DIR)) {
    console.warn(`[skills] catalog directory missing: ${CATALOG_DIR}`);
    cache = [];
    return cache;
  }

  const skills: Skill[] = [];

  for (const file of readdirSync(CATALOG_DIR).filter((name) => name.endsWith('.md')).sort()) {
    const { data, body } = parseFrontmatter(readFileSync(join(CATALOG_DIR, file), 'utf-8'));
    const name = data.name || file.replace(/\.md$/, '');

    if (!body) {
      console.warn(`[skills] "${name}" has no body, skipped`);
      continue;
    }

    skills.push({
      name,
      description: data.description || '',
      tier: data.tier === 'core' ? 'core' : 'contextual',
      triggers: parseList(data.triggers),
      registers: parseList(data.registers),
      priority: Number.parseInt(data.priority ?? '0', 10) || 0,
      tokens: estimateSkillTokens(body),
      body,
    });
  }

  cache = skills;
  console.log(
    `[skills] loaded ${skills.length} skills (${skills.filter((s) => s.tier === 'core').length} core, ${skills.reduce((sum, s) => sum + s.tokens, 0)} tokens total)`
  );

  return cache;
}

/** Tier 1: everything an agent needs to decide what to read next. */
export const listSkillMeta = (): SkillMeta[] =>
  loadSkills().map(({ body: _body, ...meta }) => meta);

/** Tier 2: the full body of one skill. */
export const getSkill = (name: string): Skill | undefined =>
  loadSkills().find((skill) => skill.name === name);

/** Tier 3: a reference file bundled next to the catalog. */
export function getSkillReference(name: string, reference: string): string | undefined {
  // Kept deliberately strict: references are addressed by name, never by path.
  if (!/^[a-z0-9-]+$/i.test(name) || !/^[a-z0-9-]+$/i.test(reference)) {
    return undefined;
  }

  const path = join(CATALOG_DIR, 'references', `${name}.${reference}.md`);
  return existsSync(path) ? readFileSync(path, 'utf-8') : undefined;
}

/** Test seam: forces the next `loadSkills()` to hit disk again. */
export const resetSkillCache = (): void => {
  cache = null;
};
