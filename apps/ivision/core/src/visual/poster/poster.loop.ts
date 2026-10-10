/**
 * LA BOUCLE DE CONCEPTION des crans Max et Ultra — celle d'un studio : écrire, rendre, regarder,
 * corriger.
 *
 *   1. l'agent écrit une composition (une mise en page en Max, le HTML complet en Ultra) ;
 *   2. le code la CONSTRUIT et la vérifie (charte, textes approuvés, images fournies) ;
 *   3. le rendu réel est MESURÉ (ajustage, débordement, chevauchement, marges, contraste lu sur
 *      les pixels) — un défaut mesuré repart à l'agent, mot pour mot ;
 *   4. la CRITIQUE VISUELLE regarde l'image : sous la qualité agence, ses corrections concrètes
 *      repartent à l'agent ;
 *   5. on s'arrête à la qualité visée, au dernier tour ou à l'échéance ; on garde le MEILLEUR rendu
 *      sans défaut mesuré (pas forcément le dernier).
 */
import logger from '../../runtime/logger';
import { measuredIssues, type Critique } from './poster.critic';
import type { PosterRender } from './poster.render';

export interface LoopFeedback<D> {
  design: D;
  /** Défauts bloquants (construction ou mesure) : à corriger d'abord. */
  issues: string[];
  /** Corrections de la critique visuelle et défauts non bloquants. */
  fixes: string[];
  score?: number;
}

export interface LoopOutcome<D> {
  design: D;
  render: PosterRender;
  critique: Critique | null;
  round: number;
}

export interface DesignLoopOptions<D> {
  /** Nom dans le journal (« layout:A », « author:2 »). */
  key: string;
  rounds: number;
  /** Date limite (ms epoch) : pas de nouveau tour après. */
  deadline: number;
  /** Note de critique à partir de laquelle on s'arrête. */
  goal?: number;
  write: (round: number, previous?: LoopFeedback<D>) => Promise<D | null>;
  build: (design: D) => { body: string; issues: string[] };
  render: (body: string) => Promise<PosterRender>;
  review: (png: Buffer, design: D) => Promise<Critique | null>;
}

const rank = (o: LoopOutcome<unknown>) => (o.critique ? o.critique.score * 10 : 60) + o.render.measure.score / 10;

export async function designLoop<D>(o: DesignLoopOptions<D>): Promise<{ best: LoopOutcome<D> | null; rounds: number; log: string[] }> {
  const goal = o.goal ?? 8;
  const log: string[] = [];
  let best: LoopOutcome<D> | null = null;
  let previous: LoopFeedback<D> | undefined;
  let round = 0;
  for (; round < o.rounds; round++) {
    if (round > 0 && Date.now() > o.deadline) {
      log.push(`r${round}: deadline`);
      break;
    }
    const design = await o.write(round, previous).catch(() => null);
    if (!design) {
      log.push(`r${round}: no design`);
      previous = previous ? { ...previous, issues: ['your answer could not be read: answer exactly in the requested format', ...previous.issues] } : undefined;
      continue;
    }
    const built = o.build(design);
    if (built.issues.length) {
      log.push(`r${round}: rejected — ${built.issues[0].slice(0, 90)}`);
      previous = { design, issues: built.issues, fixes: [] };
      continue;
    }
    let render: PosterRender;
    try {
      render = await o.render(built.body);
    } catch (error) {
      log.push(`r${round}: render failed`);
      previous = { design, issues: [`the page failed to render (${(error as Error)?.message || error}) — keep to the contract`], fixes: [] };
      continue;
    }
    const measured = measuredIssues(render.measure);
    if (render.measure.blocking) {
      log.push(`r${round}: measured ${render.measure.score} — ${(measured[0] || '').slice(0, 90)}`);
      previous = { design, issues: measured, fixes: [] };
      continue;
    }
    const critique = await o.review(render.png, design).catch(() => null);
    const outcome: LoopOutcome<D> = { design, render, critique, round };
    if (!best || rank(outcome) > rank(best)) best = outcome;
    log.push(`r${round}: ${critique ? `${critique.verdict} ${critique.score}/10` : 'no critic'} · measure ${render.measure.score}`);
    if (!critique || (critique.verdict === 'ok' && critique.score >= goal - 1) || critique.score >= goal) break;
    previous = { design, issues: [], fixes: [...critique.fixes, ...measured], score: critique.score };
  }
  logger.info('poster.loop', { event: 'poster.loop', key: o.key, rounds: Math.min(round + 1, o.rounds), best: best ? { round: best.round, critic: best.critique?.score, measure: best.render.measure.score } : null, log });
  return { best, rounds: Math.min(round + 1, o.rounds), log };
}

/** Le bloc « corrige » commun aux agents de conception. */
export function revisionLines(previous: LoopFeedback<unknown>): string[] {
  return [
    previous.score !== undefined ? `Your previous version was rendered and reviewed: ${previous.score}/10.` : 'Your previous version was rendered and REJECTED by the checks.',
    ...(previous.issues.length ? ['MUST FIX (measured on the real render):', ...previous.issues.slice(0, 8).map((i) => `- ${i}`)] : []),
    ...(previous.fixes.length ? ['CREATIVE DIRECTOR’S FIXES:', ...previous.fixes.slice(0, 6).map((f) => `- ${f}`)] : []),
    'Answer with the COMPLETE corrected version, same format. Keep what worked.',
  ];
}
