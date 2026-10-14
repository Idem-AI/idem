/**
 * L'ENREGISTREMENT D'UNE GÉNÉRATION VIDÉO — au format commun aux documents (`GenerationRecord` de
 * @idem/graphic-engine) : chaque appel de modèle (rôle, jetons, durée), la provenance des médias, et
 * les constats. Les seuls constats « bloquants » sont TECHNIQUES (une scène qui ne s'exécute pas) ;
 * il n'y a ni note esthétique, ni réparation, ni repli de composition.
 */
import type { GenerationRecord } from '@idem/graphic-engine';
import type { MotionVideo } from './contracts/model';
import { normalizeCreativity } from '../creativity/levels';

export function recordFromVideo(video: Pick<MotionVideo, 'film' | 'creativity' | 'brief'>, ms = 0, assets: string[] = []): GenerationRecord {
  const film = video.film;
  const decisions = (film?.agents || []).map((a) => ({
    task: a.agent,
    source: a.source === 'llm' ? ('llm' as const) : ('code' as const),
    role: a.agent.replace(/:.*$/, ''),
    tokens: { input: a.tokens.input, output: a.tokens.output },
    ms: a.ms,
    outcome: a.source === 'llm' ? 'accepted' : `failed${a.failure ? ` (${a.failure})` : ''}`,
  }));
  const intent = video.brief?.intent;
  return {
    v: 1,
    deliverable: 'video',
    level: normalizeCreativity(video.creativity),
    createdAt: new Date().toISOString(),
    decisions: [
      ...(intent ? [{ task: 'video.intent', source: intent.source === 'agent' ? ('llm' as const) : ('code' as const), role: 'video.intent-classifier', tokens: { input: 0, output: 0 }, ms: 0, outcome: `${intent.objective} · ${intent.productionModes.join('+')} · ${intent.motionDirection.join('+')} (${intent.source})` }] : []),
      ...decisions,
    ],
    assets,
    repairs: [],
    fallbacks: [],
    issues: {
      blocking: (film?.scenes || []).filter((s) => s.error).map((s) => `${s.key}: ${s.error!.stage} — ${s.error!.message}`.slice(0, 240)),
      advisory: (film?.fidelity?.notes || []).map((n) => `demande : ${n}`.slice(0, 240)),
    },
    tokens: decisions.reduce((s, d) => ({ input: s.input + d.tokens.input, output: s.output + d.tokens.output }), { input: 0, output: 0 }),
    ms,
  };
}
