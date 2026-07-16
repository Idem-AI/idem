import { FunctionDeclaration, Type } from '@google/genai';
import logger from '../../config/logger';
import { ProjectSectionKey } from '../../models/revision.model';
import { versionHistoryService } from '../history/version-history.service';
import { financeService } from '../Finance/finance.service';
import { coherenceService } from '../coherence/coherence.service';
import { contextEngineService } from './context-engine.service';
import { ALL_SECTION_KEYS, isSectionKey } from './context-registry';

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
      "Carte du projet: liste chaque section (branding, businessPlan, finance…), si elle existe, sa taille, sa version courante, qui l'a modifiée en dernier (utilisateur ou IA) et quand. À appeler en premier pour savoir quelles données existent avant d'en demander le contenu.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'project_get_section',
    description:
      "Contenu d'une section du projet. Par défaut renvoie un résumé compact (structure + valeurs clés, longues chaînes tronquées). Utiliser detail=\"full\" et/ou un chemin pointé (ex: \"colors.primary\", \"sections.0\") pour obtenir le contenu intégral d'une partie précise.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: {
          type: Type.STRING,
          enum: sectionEnum,
          description: 'Section à lire.',
        },
        detail: {
          type: Type.STRING,
          enum: ['summary', 'full'],
          description: 'Niveau de détail (défaut: summary).',
        },
        path: {
          type: Type.STRING,
          description:
            'Chemin pointé optionnel à l\'intérieur de la section, ex: "colors.primary" ou "sections.2.name".',
        },
      },
      required: ['section'],
    },
  },
  {
    name: 'project_search',
    description:
      "Recherche plein-texte dans TOUTES les sections du projet. Renvoie section + chemin + extrait pour chaque correspondance. Utiliser quand on ne sait pas dans quelle section se trouve une information, puis lire le chemin trouvé avec project_get_section.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Terme ou expression à chercher (min. 2 caractères).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'project_history_log',
    description:
      "Historique des modifications du projet, comme `git log`: qui (utilisateur ou IA) a changé quoi, quand, avec un résumé par révision. Filtrable par section. Utiliser pour répondre à \"qu'est-ce qui a changé ?\" ou vérifier la fraîcheur d'une donnée.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: {
          type: Type.STRING,
          enum: sectionEnum,
          description: 'Limiter le log à une section (optionnel).',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Nombre maximum de révisions (défaut 10, max 50).',
        },
      },
    },
  },
  {
    name: 'project_history_show',
    description:
      "État complet d'une section à une version précise, comme `git show`. Utiliser après project_history_log pour examiner une ancienne version.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: { type: Type.STRING, enum: sectionEnum, description: 'Section à examiner.' },
        version: { type: Type.INTEGER, description: 'Numéro de version (≥ 1).' },
      },
      required: ['section', 'version'],
    },
  },
  {
    name: 'project_history_diff',
    description:
      "Différences entre deux versions d'une section, comme `git diff v1..v2`: liste des changements (ajouts/suppressions/remplacements) avec leurs chemins. Utiliser pour expliquer précisément ce qui a évolué entre deux versions.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: { type: Type.STRING, enum: sectionEnum, description: 'Section à comparer.' },
        fromVersion: { type: Type.INTEGER, description: 'Version de départ.' },
        toVersion: { type: Type.INTEGER, description: "Version d'arrivée." },
      },
      required: ['section', 'fromVersion', 'toVersion'],
    },
  },
  {
    name: 'project_finance_summary',
    description:
      "Résumé calculé des prévisions financières: chiffre d'affaires par année, résultat net, marge brute, trésorerie, point mort, TRI, VAN et alertes. Utiliser pour toute question sur les chiffres/indicateurs financiers. Si aucune donnée n'existe, croiser avec la section businessPlan (le modèle économique y est souvent décrit) via project_get_section.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'project_coherence_alerts',
    description:
      "Alertes de cohérence ouvertes entre artefacts du projet (ex: le business plan décrit un modèle de revenu absent des prévisions financières). Chaque alerte contient une analyse, les incohérences et des propositions d'action. Utiliser quand une question touche deux artefacts liés, ou pour signaler proactivement une désynchronisation.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'project_state_at_date',
    description:
      "État d'une section telle qu'elle était à une date/heure donnée (ISO 8601), comme un checkout temporel. Utiliser pour \"comment était X la semaine dernière ?\" ou retrouver une donnée modifiée depuis par l'utilisateur.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: { type: Type.STRING, enum: sectionEnum, description: 'Section à examiner.' },
        date: {
          type: Type.STRING,
          description: 'Date/heure ISO 8601, ex: "2026-07-01" ou "2026-07-01T14:00:00Z".',
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
    message: `Résultat trop volumineux (${serialized.length} caractères) — demander un niveau de détail plus fin (chemin plus profond, limite plus basse).`,
    preview: serialized.slice(0, MAX_TOOL_RESPONSE_CHARS),
  };
}

function requireSection(value: unknown): ProjectSectionKey {
  const section = String(value ?? '');
  if (!isSectionKey(section)) {
    throw new Error(`Section inconnue "${section}". Sections valides: ${sectionEnum.join(', ')}`);
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
    try {
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
                "Aucune donnée financière saisie dans le module Finance. Le modèle économique est peut-être décrit dans la section businessPlan (utiliser project_get_section) — proposer à l'utilisateur de remplir ses prévisions financières (autofill IA disponible).",
            };
          }
          return boundResult({ exists: true, summary: result.summary });
        }

        case 'project_coherence_alerts': {
          const alerts = await coherenceService.listAlerts(projectId);
          if (alerts.length === 0) {
            return { alerts: [], message: 'Aucune alerte de cohérence ouverte.' };
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
    } catch (error: any) {
      logger.warn(`Context tool "${name}" failed: ${error.message}`);
      return { error: error.message };
    }
  };
}
