/**
 * L'ENREGISTREMENT D'UNE GÉNÉRATION VIDÉO — au format commun aux documents (`GenerationRecord` de
 * @idem/graphic-engine) : les décisions de chaque agent (code ou modèle, jetons, durée), la provenance de
 * chaque média, les réparations, les replis (film d'auteur abandonné, plans revenus à leur composition
 * éprouvée, médias introuvables) et les constats — bloquants (le contrôle qualité du film) séparés des conseils
 * (avertissements, écarts à la demande).
 */
import type { GenerationRecord } from '@idem/graphic-engine';
import type { MotionVideo } from './video.model';

export function recordFromVideo(video: Pick<MotionVideo, 'storyboard' | 'creativity' | 'copyTokens' | 'brief'>, ms = 0): GenerationRecord {
  const sb = video.storyboard;
  const decisions = (sb.agents || []).map((a) => ({
    task: a.agent,
    source: a.source === 'llm' ? ('llm' as const) : ('code' as const),
    role: a.agent.replace(/:.*$/, ''),
    tokens: { input: a.tokens.input, output: a.tokens.output },
    ms: a.ms ?? 0,
    outcome: a.source === 'llm' ? (a.kept ? 'accepted' : 'refused') : 'skipped',
  }));
  const fallbacks = [
    ...(sb.authorFallback ? [sb.authorFallback] : []),
    ...(sb.authored?.fallback || []).map((key) => `${key} : plan revenu à la composition éprouvée de son support`),
    ...(sb.assetPlan || []).filter((a) => a.endsWith('✗')).map((a) => `${a.replace(/ ✗$/, '')} : aucun média obtenu`),
  ];
  const intent = video.brief?.intent;
  return {
    v: 1,
    deliverable: 'video',
    level: video.creativity || 'medium',
    createdAt: new Date().toISOString(),
    decisions: [
      ...(intent ? [{ task: 'video.intent', source: intent.source === 'agent' ? ('llm' as const) : ('code' as const), role: 'video.intent-classifier', tokens: { input: 0, output: 0 }, ms: 0, outcome: `${intent.objective} · ${intent.productionModes.join('+')} · ${intent.motionDirection.join('+')} (${intent.source})` }] : []),
      ...decisions,
    ],
    assets: sb.assetPlan || [],
    repairs: [
      ...(sb.qa?.repaired ? [{ code: 'qa_repair', detail: `${sb.qa.repaired} correction(s) du contrôle qualité`, by: 'code' as const }] : []),
      ...Object.entries(sb.authored?.rounds || {}).filter(([, r]) => r > 1).map(([key, r]) => ({ code: 'shot_revised', detail: `${key} : ${r} tours (rendu → contrôles → critique → correction)`, by: 'agent' as const, scope: key })),
    ],
    fallbacks,
    issues: {
      blocking: (sb.qa?.issues || []).map((i) => `${i.scene ?? 'film'}: ${i.rule} — ${i.detail}`.slice(0, 240)),
      advisory: [...(sb.qa?.warnings || []).map((w) => `${w.scene ?? 'film'}: ${w.rule} — ${w.detail}`.slice(0, 240)), ...(sb.fidelity?.notes || []).map((n) => `demande : ${n}`.slice(0, 240))],
    },
    tokens: video.copyTokens ? { input: video.copyTokens.input, output: video.copyTokens.output } : decisions.reduce((s, d) => ({ input: s.input + d.tokens.input, output: s.output + d.tokens.output }), { input: 0, output: 0 }),
    ms,
  };
}
