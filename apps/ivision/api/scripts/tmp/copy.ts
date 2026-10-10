import { loadSecrets } from '../../src/config/secrets';
(async () => {
  await loadSecrets();
  const { configureCoreForIvision } = await import('../../src/core-host');
  configureCoreForIvision();
  const { coreHost } = await import('../../../core/src/runtime/host');
  const { copyTask } = await import('../../../core/src/visual/poster/poster.copy');
  const brief = { message: process.argv[2], details: process.argv[2], brandName: 'DevGirls', businessType: 'community for women in tech', tone: 'dynamic,supportive,passionate', language: 'fr' };
  const task = copyTask(brief as any, process.argv[3] as any);
  const p = task.prompt()!;
  const call = coreHost().agentCall!({ userId: 'debug', projectId: 'debug', element: 'flyer' })!;
  const raw = await call({ role: 'posterCopywriter', profile: 'agents', system: p.system, user: p.user });
  console.log('RAW:\n' + raw);
  console.log('PARSED:', JSON.stringify(task.parse(raw)));
  process.exit(0);
})();
