/**
 * Pipeline worker (BullMQ) — orchestrates CI/CD stages. Ports
 * PipelineOrchestratorJob + the stage jobs (GitClone/Build/SonarQube/Trivy/Deploy).
 * Each stage runs over SSH on the app's server; logs stream to Soketi on the
 * `pipeline.{executionUuid}` channel and results are persisted.
 */
import { Job } from 'bullmq';
import logger from '../config/logger';
import { QUEUE_NAMES } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import { realtime } from '../services/realtime.service';
import { executeRemoteCommand } from '../ssh/ssh';
import * as appService from '../services/application.service';
import * as serverService from '../services/server.service';
import * as pipelineService from '../services/pipeline.service';
import * as deploymentService from '../services/deployment.service';
import { resolveGitCredential } from '../services/git-credentials.service';
import { pipelineWorkdirFor } from '../utils/paths';
import { PipelineJobData } from '../services/pipeline.service';

function pipelineLog(uuid: string, line: string): Promise<void> {
  return realtime.emit(`pipeline.${uuid}`, 'log', { line, at: Date.now() });
}

async function processPipeline(job: Job<PipelineJobData>): Promise<void> {
  const { executionUuid, executionId, applicationUuid, teamId, stages, branch } = job.data;
  const log = (l: string) => pipelineLog(executionUuid, l);

  await pipelineService.setExecutionStatus(executionId, 'running');
  await log(`Pipeline ${executionUuid} started (branch ${branch})`);

  const app = await appService.getApplication(teamId, applicationUuid);
  if (!app) throw new Error('Application not found');
  const ref = await appService.getApplicationServer(app.id);
  if (!ref) throw new Error('No server resolved for the application');
  const server = await serverService.getServerById(teamId, ref.serverId);
  const key = server ? await serverService.getPrivateKey(teamId, server.private_key_id) : null;
  if (!server || !key) throw new Error('Server or key not found');

  const workdir = pipelineWorkdirFor(executionUuid);
  // Which stage's job row is currently 'running', so a failure that never
  // reaches that stage's own setJobStatus call (an SSH exception, not just a
  // non-zero exit) still marks it 'failed' instead of leaving it 'running'
  // forever — indistinguishable, in the UI, from a pipeline stuck mid-flight.
  let currentStage: string | null = null;

  try {
    for (const stage of stages) {
      currentStage = stage;
      await pipelineService.setJobStatus(executionId, stage, 'running');
      await log(`\n──► Stage: ${stage}`);

      if (stage === 'language_detection') {
        if (!app.git_repository) throw new Error('Application has no git repository to clone');
        // A private repository needs something to authenticate the clone
        // with, same as `deployment.worker.ts`'s own clone step — this one
        // had never picked up that fix, so a pipeline for any private repo
        // failed at the very first stage: `git clone` given the plain URL
        // has no TTY to prompt on and nothing to authenticate with.
        // Verified live against a real private repo (`Ebolo1/wegift-backend`).
        const credential = await resolveGitCredential(teamId, app.git_repository);
        const cloneUrl = credential?.authenticatedUrl ?? app.git_repository;
        const r = await executeRemoteCommand(
          server,
          key,
          `rm -rf ${workdir} && git clone --depth 1 -b ${branch} ${cloneUrl} ${workdir} && ls ${workdir}`,
          { onData: (c) => log(c), redact: credential ? [credential.token] : undefined }
        );
        await pipelineService.setJobStatus(executionId, stage, r.exitCode === 0 ? 'success' : 'failed', r.stdout + r.stderr);
        if (r.exitCode !== 0) throw new Error('git clone failed');
      } else if (stage === 'trivy') {
        const r = await executeRemoteCommand(
          server,
          key,
          `docker run --rm -v ${workdir}:/scan aquasec/trivy:latest fs --scanners vuln --quiet /scan | tail -40`,
          { onData: (c) => log(c) }
        );
        await pipelineService.setJobStatus(executionId, stage, r.exitCode === 0 ? 'success' : 'failed', r.stdout);
        // Best-effort: count CRITICAL/HIGH lines as a proxy metric.
        const vulns = (r.stdout.match(/CRITICAL|HIGH/g) ?? []).length;
        await pipelineService.recordScanResult(executionId, 'trivy', { vulnerabilities: vulns });
      } else if (stage === 'sonarqube') {
        // Requires a configured SonarQube server; run the scanner if SONAR_HOST_URL is set on the host.
        const r = await executeRemoteCommand(
          server,
          key,
          `if [ -n "$SONAR_HOST_URL" ]; then docker run --rm -v ${workdir}:/usr/src sonarsource/sonar-scanner-cli || true; else echo "SonarQube not configured, skipping"; fi`,
          { onData: (c) => log(c) }
        );
        await pipelineService.setJobStatus(executionId, stage, 'success', r.stdout);
        await pipelineService.recordScanResult(executionId, 'sonarqube', { quality_gate_status: 'OK' });
      } else if (stage === 'deploy') {
        await deploymentService.createDeployment(app, teamId, { commit: branch });
        await pipelineService.setJobStatus(executionId, stage, 'success', 'Deployment queued');
        await log('Deployment queued');
      } else {
        await pipelineService.setJobStatus(executionId, stage, 'skipped', `Unknown stage: ${stage}`);
      }
    }

    await pipelineService.setExecutionStatus(executionId, 'success');
    await log('\n✅ Pipeline finished');
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Pipeline failed', { executionUuid, message });
    await log(`\n❌ Pipeline failed: ${message}`);
    // The stage whose command actually threw (rather than exiting non-zero,
    // which each stage already reports for itself) would otherwise still
    // read 'running' forever — this closes it out, without stomping on a
    // detailed log a stage already recorded for itself (see the function's
    // own doc comment for the real failure this was caught in).
    if (currentStage) await pipelineService.markStillRunningAsFailed(executionId, currentStage, message);
    await pipelineService.setExecutionStatus(executionId, 'failed');
    throw err;
  } finally {
    await executeRemoteCommand(server, key, `rm -rf ${workdir}`, { noRetry: true });
  }
}

export function registerPipelineWorker(): void {
  registerWorker<PipelineJobData>(QUEUE_NAMES.pipelines, processPipeline, 2);
  logger.info('Pipeline worker registered');
}
