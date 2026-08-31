import { FunctionDeclaration, Type } from '@google/genai';
import logger from '../../config/logger';
import { ProjectSectionKey } from '../../models/revision.model';
import { versionHistoryService } from '../history/version-history.service';
import { financeService } from '../Finance/finance.service';
import { coherenceService } from '../coherence/coherence.service';
import { contextEngineService } from './context-engine.service';
import { ALL_SECTION_KEYS, isSectionKey } from './context-registry';
import { setTraceProjectId } from '../../utils/trace.util';
import { logAIEvent, previewValue } from '../../utils/ai-trace.util';

/**
 * Boîte à outils "connaissance projet" exposée aux agents IA via le function
 * calling Gemini. Design aligné sur les recommandations d'Anthropic ("writing
 * effective tools for agents"): peu d'outils, bien nommés (namespace project_*),
 * descriptions prescriptives, réponses token-efficientes (résumé par défaut,
 * détail à la demande), erreurs en langage naturel exploitables par le modèle.
 *
 * Les outils sont liés à (userId, projectId) côté serveur — l'agent ne peut ni
 * choisir ni deviner un autre projet: la sécurité est structurelle.
 */

const sectionEnum = ALL_SECTION_KEYS as string[];

export const CONTEXT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'project_get_map',
    description:
      'Map of the project: lists every section (branding, businessPlan, finance…), whether it exists, its size, its current version, who last modified it (user or AI) and when. Call this first to learn which data exists before asking for its content.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'project_get_section',
    description:
      'Content of one project section. By default it returns a compact summary (structure plus key values, long strings truncated). Use detail="full" and/or a dotted path (e.g. "colors.primary", "sections.0") to get the full content of a specific part.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: {
          type: Type.STRING,
          enum: sectionEnum,
          description: 'The section to read.',
        },
        detail: {
          type: Type.STRING,
          enum: ['summary', 'full'],
          description: 'Level of detail (default: summary).',
        },
        path: {
          type: Type.STRING,
          description:
            'Optional dotted path inside the section, e.g. "colors.primary" or "sections.2.name".',
        },
      },
      required: ['section'],
    },
  },
  {
    name: 'project_search',
    description:
      'Full-text search across ALL project sections. Returns section, path and excerpt for every match. Use it when you do not know which section holds a piece of information, then read the path found with project_get_section.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Term or phrase to search for (2 characters minimum).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'project_history_log',
    description:
      'Change history of the project, like `git log`: who (user or AI) changed what and when, with a summary per revision. Filterable by section. Use it to answer "what changed?" or to check how fresh a piece of data is.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: {
          type: Type.STRING,
          enum: sectionEnum,
          description: 'Restrict the log to one section (optional).',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Maximum number of revisions (default 10, max 50).',
        },
      },
    },
  },
  {
    name: 'project_history_show',
    description:
      'Full state of a section at a given version, like `git show`. Use it after project_history_log to inspect an earlier version.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: { type: Type.STRING, enum: sectionEnum, description: 'The section to inspect.' },
        version: { type: Type.INTEGER, description: 'Version number (≥ 1).' },
      },
      required: ['section', 'version'],
    },
  },
  {
    name: 'project_history_diff',
    description:
      'Differences between two versions of a section, like `git diff v1..v2`: a list of changes (additions, deletions, replacements) with their paths. Use it to explain precisely what evolved between two versions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: { type: Type.STRING, enum: sectionEnum, description: 'The section to compare.' },
        fromVersion: { type: Type.INTEGER, description: 'Starting version.' },
        toVersion: { type: Type.INTEGER, description: 'Target version.' },
      },
      required: ['section', 'fromVersion', 'toVersion'],
    },
  },
  {
    name: 'project_finance_summary',
    description:
      'Computed summary of the financial projections: revenue per year, net income, gross margin, cash position, break-even, IRR, NPV and alerts. Use it for any question about financial figures or indicators. If no data exists, cross-check with the businessPlan section (the economic model is often described there) via project_get_section.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'project_coherence_alerts',
    description:
      'Open coherence alerts between project artefacts (e.g. the business plan describes a revenue model absent from the financial projections). Each alert carries an analysis, the inconsistencies and suggested actions. Use it when a question touches two linked artefacts, or to flag a desynchronisation proactively.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'project_state_at_date',
    description:
      'State of a section as it was at a given date and time (ISO 8601), like a checkout in time. Use it for "what did X look like last week?" or to recover a value the user has changed since.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: { type: Type.STRING, enum: sectionEnum, description: 'The section to inspect.' },
        date: {
          type: Type.STRING,
          description: 'ISO 8601 date/time, e.g. "2026-07-01" or "2026-07-01T14:00:00Z".',
        },
      },
      required: ['section', 'date'],
    },
  },
];

/** Borne la taille d'une réponse d'outil renvoyée au modèle. */
const MAX_TOOL_RESPONSE_CHARS = 30_000;

function boundResult(value: unknown): unknown {
  const serialized = JSON.stringify(value ?? null);
  if (serialized.length <= MAX_TOOL_RESPONSE_CHARS) return value;
  return {
    truncated: true,
    message: `Result too large (${serialized.length} characters) — ask for a finer level of detail (a deeper path, a lower limit).`,
    preview: serialized.slice(0, MAX_TOOL_RESPONSE_CHARS),
  };
}

function requireSection(value: unknown): ProjectSectionKey {
  const section = String(value ?? '');
  if (!isSectionKey(section)) {
    throw new Error(`Unknown section "${section}". Valid sections: ${sectionEnum.join(', ')}`);
  }
  return section;
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Exécuteur des outils contexte/historique, lié à un utilisateur et un projet.
 * Toute erreur est renvoyée comme message exploitable par le modèle (jamais de
 * throw vers la boucle agentique).
 */
export function createContextToolExecutor(userId: string, projectId: string): ToolExecutor {
  return async (name, args) => {
    setTraceProjectId(projectId);
    const startedAt = Date.now();
    logAIEvent('ai.tool_call_start', { tool: name, args: previewValue(args) });
    try {
      const result = await executeToolCall(name, args, userId, projectId);
      logAIEvent('ai.tool_call_end', {
        tool: name,
        durationMs: Date.now() - startedAt,
        ok: !(result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)),
        result: previewValue(result),
      });
      return result;
    } catch (error: any) {
      logAIEvent('ai.tool_call_end', {
        tool: name,
        durationMs: Date.now() - startedAt,
        ok: false,
        error: error.message,
      });
      logger.warn(`Context tool "${name}" failed: ${error.message}`);
      return { error: error.message };
    }
  };
}

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  projectId: string
): Promise<unknown> {
  switch (name) {
    case 'project_get_map':
      return boundResult(await contextEngineService.getProjectMap(userId, projectId));

    case 'project_get_section':
      return boundResult(
        await contextEngineService.getSection(
          userId,
          projectId,
          String(args.section ?? ''),
          args.detail === 'full' ? 'full' : 'summary',
          args.path ? String(args.path) : undefined
        )
      );

    case 'project_search':
      return boundResult(
        await contextEngineService.searchProject(userId, projectId, String(args.query ?? ''))
      );

    case 'project_history_log': {
      const section = args.section ? requireSection(args.section) : undefined;
      const limit = Math.min(Number(args.limit) || 10, 50);
      return boundResult(await versionHistoryService.log(projectId, { section, limit }));
    }

    case 'project_history_show': {
      const section = requireSection(args.section);
      const version = Number(args.version);
      if (!Number.isInteger(version) || version < 1) {
        throw new Error(`Version invalide "${args.version}" (entier ≥ 1 attendu).`);
      }
      return boundResult(await versionHistoryService.show(projectId, section, version));
    }

    case 'project_history_diff': {
      const section = requireSection(args.section);
      return boundResult(
        await versionHistoryService.diff(
          projectId,
          section,
          Number(args.fromVersion),
          Number(args.toVersion)
        )
      );
    }

    case 'project_finance_summary': {
      const result = await financeService.getSummary(userId, projectId);
      if (!result) {
        return {
          exists: false,
          message:
            'No financial data has been entered in the Finance module. The economic model may be described in the businessPlan section (use project_get_section) — offer the user to fill in their financial projections (AI autofill is available).',
        };
      }
      return boundResult({ exists: true, summary: result.summary });
    }

    case 'project_coherence_alerts': {
      const alerts = await coherenceService.listAlerts(projectId, userId);
      if (alerts.length === 0) {
        return { alerts: [], message: 'No open coherence alert.' };
      }
      return boundResult({
        alerts: alerts.map((a) => ({
          id: a.id,
          rule: a.ruleId,
          analysis: a.analysis,
          issues: a.issues,
          proposals: a.proposals,
          createdAt: a.createdAt,
        })),
      });
    }

    case 'project_state_at_date': {
      const section = requireSection(args.section);
      const date = new Date(String(args.date ?? ''));
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Date invalide "${args.date}" (format ISO 8601 attendu).`);
      }
      const result = await versionHistoryService.stateAt(projectId, section, date);
      return boundResult(
        result ?? {
          exists: false,
          message: `La section "${section}" n'existait pas encore au ${date.toISOString()}.`,
        }
      );
    }

    default:
      return { error: `Outil inconnu: "${name}".` };
  }
}
