/**
 * Skill router — deterministic selection, zero LLM calls.
 *
 * Asking a model which skills to load would cost a round trip and return a
 * different answer each time. Keyword scoring over the request costs nothing,
 * is reproducible, and is good enough: skills are written to overlap gracefully,
 * so a near-miss selection still produces a coherent brief.
 *
 * Ordering matters as much as selection. Core skills come first and are byte
 * identical on every request, which is what makes the system message a stable
 * prefix and therefore eligible for Gemini's implicit cache (90% off cached
 * input tokens). Contextual skills follow, stable within a session.
 */

import { ProjectModel } from '../types/project.js';
import { Register } from '../design/artDirections.js';
import { Skill, loadSkills } from './registry.js';

export interface RouteInput {
  /** The user's request, before any prompt assembly. */
  request: string;
  register: Register;
  projectData?: ProjectModel;
}

export interface RouteResult {
  core: Skill[];
  contextual: Skill[];
  /** Diagnostics, logged rather than sent to the model. */
  scores: Array<{ name: string; score: number; selected: boolean }>;
  totalTokens: number;
}

/** Contextual skills selected per request. Beyond three the brief goes vague. */
const MAX_CONTEXTUAL = Number(process.env.SKILLS_MAX_CONTEXTUAL ?? 3);

/** Token ceiling for the contextual half of the system message. */
const CONTEXTUAL_BUDGET = Number(process.env.SKILLS_CONTEXTUAL_BUDGET ?? 2600);

/** A skill needs a real signal, not one incidental word, to earn its tokens. */
const MIN_SCORE = 2;

function buildHaystack({ request, projectData }: RouteInput): string {
  const configs = projectData?.analysisResultModel?.development?.configs;
  const projectConfig = configs?.projectConfig ?? {};

  const enabledFlags = Object.entries(projectConfig)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => key);

  const featureNames = [configs?.frontend?.features, configs?.backend?.features]
    .flatMap((features) => {
      if (!features) return [];
      return Array.isArray(features)
        ? features
        : Object.entries(features)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key);
    })
    .map(String);

  // `analysisResultModel.design.sections` (the use-case diagrams) is no longer
  // sent by the client, so it is not part of the routing signal.
  return [
    request,
    projectData?.name,
    projectData?.description,
    projectData?.type,
    configs?.landingPageConfig,
    ...enabledFlags,
    ...featureNames,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function scoreSkill(skill: Skill, haystack: string, register: Register): number {
  if (skill.registers.length && !skill.registers.includes(register)) {
    return 0;
  }

  let score = 0;

  for (const trigger of skill.triggers) {
    if (!trigger) continue;

    // Word-boundary match so "form" does not fire on "performance".
    const pattern = new RegExp(`(^|[^a-z0-9])${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

    if (pattern.test(haystack)) {
      // Multi-word triggers are far more specific, so they count for more.
      score += trigger.includes(' ') ? 3 : 1;
    }
  }

  return score;
}

export function routeSkills(input: RouteInput): RouteResult {
  const skills = loadSkills();
  const haystack = buildHaystack(input);

  const core = skills
    .filter((skill) => skill.tier === 'core')
    .filter((skill) => !skill.registers.length || skill.registers.includes(input.register))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

  const ranked = skills
    .filter((skill) => skill.tier === 'contextual')
    .map((skill) => ({ skill, score: scoreSkill(skill, haystack, input.register) }))
    .sort((a, b) => b.score - a.score || b.skill.priority - a.skill.priority);

  const contextual: Skill[] = [];
  let budget = CONTEXTUAL_BUDGET;

  for (const { skill, score } of ranked) {
    if (contextual.length >= MAX_CONTEXTUAL || score < MIN_SCORE || skill.tokens > budget) {
      continue;
    }

    contextual.push(skill);
    budget -= skill.tokens;
  }

  // Keep the emitted order stable regardless of scoring, so a follow-up turn on
  // the same project reproduces the same prefix byte for byte.
  contextual.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

  const selectedNames = new Set(contextual.map((skill) => skill.name));

  return {
    core,
    contextual,
    scores: ranked.map(({ skill, score }) => ({
      name: skill.name,
      score,
      selected: selectedNames.has(skill.name),
    })),
    totalTokens: [...core, ...contextual].reduce((sum, skill) => sum + skill.tokens, 0),
  };
}

/** Concatenates the routed skills into the system message body. */
export function renderSkills(result: RouteResult): string {
  return [...result.core, ...result.contextual]
    .map((skill) => `<skill name="${skill.name}">\n${skill.body}\n</skill>`)
    .join('\n\n');
}
