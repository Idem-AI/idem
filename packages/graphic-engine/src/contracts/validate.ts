/**
 * Validation des contrats, SANS modèle et SANS HTML.
 *
 * La FORME (zod) : chaque clé, chaque borne ; et, pour le contenu, chaque section et chaque bloc une seule fois.
 *
 * Les constats sont formulés en phrases corrigeables (« "columns" doit contenir au moins 2
 * éléments ») : un agent qui lit le refus sait quoi réparer sans qu'on lui redonne tout le contrat.
 */
import type { z } from 'zod/v4';
import { Issue } from './common';
import { Block, ContentModel, SectionContent } from './content-model';
import { DesignSpec } from './design-spec';
import { RenderResult } from './render-result';

export interface Report<T> {
  ok: boolean;
  value?: T;
  issues: Issue[];
}

const issue = (code: string, message: string, path?: string, fix?: string, severity: Issue['severity'] = 'blocking'): Issue => ({
  code,
  severity,
  message,
  ...(path ? { path } : {}),
  ...(fix ? { fix } : {}),
});

const pathOf = (path: ReadonlyArray<PropertyKey>): string => path.map(String).join('.');

/** Traduit les constats de zod en constats corrigeables. */
export function zodIssues(error: z.ZodError): Issue[] {
  return error.issues.slice(0, 40).map((raw) => {
    const path = pathOf(raw.path);
    const where = path ? `« ${path} » ` : '';
    const info = raw as unknown as Record<string, unknown>;
    switch (raw.code) {
      case 'too_big':
        return issue('too_big', `${where}dépasse la limite (${String(info.maximum)}).`, path, `raccourcir ou retirer des éléments (max ${String(info.maximum)})`);
      case 'too_small':
        return issue('too_small', `${where}est trop court (minimum ${String(info.minimum)}).`, path, `fournir au moins ${String(info.minimum)}`);
      case 'unrecognized_keys':
        return issue('unknown_key', `${where}contient des clés inconnues : ${(info.keys as string[] | undefined)?.join(', ') ?? '?'}.`, path, 'retirer ces clés');
      case 'invalid_type':
        return issue('invalid_type', `${where}n'a pas le bon type (attendu : ${String(info.expected)}).`, path, `donner un ${String(info.expected)}`);
      case 'invalid_union':
        return issue('invalid_union', `${where}ne correspond à aucune forme admise${info.discriminator ? ` (champ « ${String(info.discriminator)} »)` : ''}.`, path, 'utiliser un type connu du contrat');
      default:
        return issue(String(raw.code), `${where}${raw.message}`, path);
    }
  });
}

// ── ContentModel ───────────────────────────────────────────────────────────────────────────

export function validateContent(raw: unknown): Report<ContentModel> {
  const parsed = ContentModel.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const content = parsed.data;
  const issues: Issue[] = [];
  const sectionIds = new Set<string>();
  for (const section of content.sections) {
    if (sectionIds.has(section.id)) issues.push(issue('duplicate_section', `La section « ${section.id} » apparaît deux fois.`, `sections.${section.id}`, 'donner un identifiant unique'));
    sectionIds.add(section.id);
    const blockIds = new Set<string>();
    for (const block of section.blocks) {
      if (blockIds.has(block.id)) issues.push(issue('duplicate_block', `Le bloc « ${block.id} » apparaît deux fois dans « ${section.id} ».`, `sections.${section.id}.blocks`, 'donner un identifiant unique'));
      blockIds.add(block.id);
    }
  }
  return { ok: issues.length === 0, value: content, issues };
}

export function validateSectionContent(raw: unknown): Report<SectionContent> {
  const parsed = SectionContent.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, issues: [] } : { ok: false, issues: zodIssues(parsed.error) };
}

export function validateBlock(raw: unknown): Report<Block> {
  const parsed = Block.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, issues: [] } : { ok: false, issues: zodIssues(parsed.error) };
}

// ── DesignSpec ─────────────────────────────────────────────────────────────────────────────

export function validateDesignSpec(raw: unknown): Report<DesignSpec> {
  const parsed = DesignSpec.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, issues: [] } : { ok: false, issues: zodIssues(parsed.error) };
}

export function validateRenderResult(raw: unknown): Report<RenderResult> {
  const parsed = RenderResult.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, issues: [] } : { ok: false, issues: zodIssues(parsed.error) };
}
