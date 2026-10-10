import { loadSecrets } from '../../config/secrets';
(async () => {
  await loadSecrets();
  await import('../../services/ivision/host');
  const { runtimeCall } = await import('../../services/creativity/orchestrator');
  const { copyTask, inferPosterIntent } = await import('../../../../ivision/core/src/visual/poster/poster.copy');
  const text = process.argv[2];
  const brief = { message: process.argv[3] || text, details: text, brandName: 'DevGirls', businessType: 'community for women in tech', valueProposition: 'A dynamic community encouraging and supporting women in the technology sector through events, training, and opportunities.', tone: 'dynamic,supportive,passionate', language: 'fr' };
  const intent = inferPosterIntent(text);
  const task = copyTask(brief as any, intent);
  const p = task.prompt()!;
  const raw = await runtimeCall({ userId: 'debug' })({ role: 'posterCopywriter', profile: 'agents', system: p.system, user: p.user });
  console.log('INTENT', intent, '\nRAW:\n' + raw + '\nPARSED: ' + JSON.stringify(task.parse(raw)));
  process.exit(0);
})();
