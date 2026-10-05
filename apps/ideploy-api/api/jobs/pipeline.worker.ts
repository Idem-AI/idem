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
import { executeRemoteCommand, shellQuote } from '../ssh/ssh';
import { assertSafeGitBranch, assertSafeGitUrl } from '../validation/git-input';
import { Severity, SonarClient, sonarConfig, summariseTrivy, trivyFails } from '../services/pipeline-scanners.service';
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

export async function processPipeline(job: Job<PipelineJobData>): Promise<void> {
  const { executionUuid, executionId, applicationUuid, teamId, stages, branch } = job.data;
  const log = (l: string) => pipelineLog(executionUuid, l);

  await pipelineService.setExecutionStatus(executionId, 'running');
  await log(`Pipeline ${executionUuid} started (branch ${branch})`);

  const app = await appService.getApplication(teamId, applicationUuid);
  if (!app) throw new Error('Application not found');
  const ref = await appService.getApplicationServer(app.id);
  if (!ref) throw new Error('No server resolved for the application');
  const server = await serverService.getExecutionServer(teamId, ref.serverId);
  const key = server ? await serverService.getExecutionKey(server) : null;
  if (!server || !key) throw new Error('Server or key not found');

  const workdir = pipelineWorkdirFor(executionUuid);
  // Which stage's job row is currently 'running', so a failure that never
  // reaches that stage's own setJobStatus call (an SSH exception, not just a
  // non-zero exit) still marks it 'failed' instead of leaving it 'running'
  // forever — indistinguishable, in the UI, from a pipeline stuck mid-flight.
  let currentStage: string | null = null;
  // The commit the clone stage fetched: what the deploy stage deploys.
  let commit: string | null = null;

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
        // Branch and URL come from the user and reach a shell on the host:
        // checked, then quoted. The commit fetched is kept for the deploy stage.
        assertSafeGitUrl(app.git_repository);
        const safeBranch = assertSafeGitBranch(branch || app.git_branch || 'main');
        const r = await executeRemoteCommand(
          server,
          key,
          `rm -rf ${shellQuote(workdir)} && git clone --depth 1 -b ${shellQuote(safeBranch)} -- ${shellQuote(cloneUrl)} ${shellQuote(workdir)} && ` +
            `git -C ${shellQuote(workdir)} remote remove origin && echo "COMMIT=$(git -C ${shellQuote(workdir)} rev-parse HEAD)" && ls ${shellQuote(workdir)}`,
          { onData: (c) => log(c), redact: credential ? [credential.token] : undefined }
        );
        await pipelineService.setJobStatus(executionId, stage, r.exitCode === 0 ? 'success' : 'failed', r.stdout + r.stderr);
        if (r.exitCode !== 0) throw new Error('git clone failed');
        commit = /COMMIT=([0-9a-f]{40})/.exec(r.stdout)?.[1] ?? null;
      } else if (stage === 'trivy') {
        await runTrivy(server, key, workdir, executionId, log);
      } else if (stage === 'sonarqube') {
        await runSonar(server, key, workdir, app, executionUuid, executionId, log);
      } else if (stage === 'deploy') {
        // The commit the pipeline checked, not the branch name — the worker
        // only accepts a commit id, and a branch would move under it.
        await deploymentService.createDeployment(app, teamId, { commit: commit ?? 'HEAD' });
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
    await executeRemoteCommand(server, key, `rm -rf ${shellQuote(workdir)}`, { noRetry: true });
  }
}

export function registerPipelineWorker(): void {
  registerWorker<PipelineJobData>(QUEUE_NAMES.pipelines, processPipeline, 2);
  logger.info('Pipeline worker registered');
}

type Server = Parameters<typeof executeRemoteCommand>[0];
type Key = Parameters<typeof executeRemoteCommand>[1];

/** Severity at or above which Trivy fails the pipeline (`NONE` reports only). */
const TRIVY_FAIL_ON = (process.env.PIPELINE_TRIVY_FAIL_ON || 'CRITICAL').toUpperCase() as Severity | 'NONE';

/**
 * Trivy on the checked-out code: dependency vulnerabilities and committed
 * secrets, as JSON, summarised into counts by severity and the worst findings.
 */
async function runTrivy(server: Server, key: Key, workdir: string, executionId: number, log: (l: string) => Promise<void>): Promise<void> {
  const r = await executeRemoteCommand(
    server,
    key,
    // A named volume keeps Trivy's vulnerability database between runs.
    `docker run --rm -v ideploy-trivy-cache:/root/.cache -v ${shellQuote(workdir)}:/scan:ro aquasec/trivy:latest ` +
      `fs --quiet --format json --scanners vuln,secret /scan`,
    { noRetry: true }
  );
  if (r.exitCode !== 0) {
    const detail = (r.stderr || r.stdout).slice(-400);
    await pipelineService.setJobStatus(executionId, 'trivy', 'failed', detail);
    await pipelineService.recordScanResult(executionId, 'trivy', { status: 'failed', summary: detail });
    throw new Error('Trivy could not scan the code');
  }
  const summary = summariseTrivy(r.stdout);
  const { counts } = summary;
  const line = `Vulnerabilities — critical ${counts.CRITICAL}, high ${counts.HIGH}, medium ${counts.MEDIUM}, low ${counts.LOW}; secrets ${summary.secrets.length}`;
  await log(line);
  for (const f of summary.findings.slice(0, 10)) {
    await log(`  ${f.severity.padEnd(8)} ${f.id} ${f.package} ${f.installed}${f.fixed ? ` → ${f.fixed}` : ''}`);
  }
  const fails = trivyFails(counts, TRIVY_FAIL_ON) || summary.secrets.length > 0;
  await pipelineService.recordScanResult(executionId, 'trivy', {
    status: fails ? 'failed' : 'success',
    vulnerabilities: counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW + counts.UNKNOWN,
    critical_count: counts.CRITICAL,
    high_count: counts.HIGH,
    medium_count: counts.MEDIUM,
    low_count: counts.LOW,
    vulnerabilities_detail: summary.findings,
    secrets_found: summary.secrets,
    summary: line,
  });
  await pipelineService.setJobStatus(executionId, 'trivy', fails ? 'failed' : 'success', line);
  if (fails) {
    throw new Error(
      summary.secrets.length > 0
        ? 'Trivy found secrets committed in the code.'
        : `Trivy found vulnerabilities at or above ${TRIVY_FAIL_ON}.`
    );
  }
}

/**
 * SonarQube on the checked-out code: the project and a one-off analysis token
 * are created through its API, the scanner runs on the deployment server and
 * waits for the quality gate, then the gate and the measures are read back.
 */
async function runSonar(
  server: Server,
  key: Key,
  workdir: string,
  app: { uuid: string; name: string },
  executionUuid: string,
  executionId: number,
  log: (l: string) => Promise<void>
): Promise<void> {
  const config = sonarConfig();
  if (!config) {
    const message =
      'SonarQube is not configured on the platform (SONARQUBE_URL and SONARQUBE_ADMIN_TOKEN): no analysis was run.';
    await log(message);
    await pipelineService.setJobStatus(executionId, 'sonarqube', 'skipped', message);
    await pipelineService.recordScanResult(executionId, 'sonarqube', { status: 'skipped', summary: message });
    return;
  }
  const sonar = new SonarClient(config);
  if (!(await sonar.isUp())) throw new Error(`SonarQube does not answer at ${config.url}.`);

  const projectKey = `ideploy-${app.uuid}`;
  const tokenName = `ideploy-${executionUuid}`;
  await sonar.ensureProject(projectKey, app.name);
  const token = await sonar.analysisToken(projectKey, tokenName);
  try {
    await log(`Analysing ${projectKey} on ${config.url}…`);
    const r = await executeRemoteCommand(
      server,
      key,
      `docker run --rm -e SONAR_HOST_URL=${shellQuote(config.url)} -e SONAR_TOKEN=${shellQuote(token)} ` +
        `-v ${shellQuote(workdir)}:/usr/src sonarsource/sonar-scanner-cli ` +
        `-Dsonar.projectKey=${shellQuote(projectKey)} -Dsonar.sources=. ` +
        // Java needs compiled classes; without a build, analyse the sources only.
        `-Dsonar.java.binaries=. ` +
        `-Dsonar.exclusions=${shellQuote('**/node_modules/**,**/vendor/**,**/dist/**,**/build/**,**/target/**')} ` +
        `-Dsonar.qualitygate.wait=true -Dsonar.qualitygate.timeout=300`,
      { onData: (c) => log(c), redact: [token], noRetry: true }
    );
    const result = await sonar.result(projectKey);
    const m = result.measures;
    const line =
      `Quality gate ${result.qualityGate} — bugs ${m.bugs ?? '–'}, vulnerabilities ${m.vulnerabilities ?? '–'}, ` +
      `code smells ${m.code_smells ?? '–'}, hotspots ${m.security_hotspots ?? '–'}, coverage ${m.coverage ?? '–'}%`;
    await log(line);
    // The scanner exits non-zero when the gate fails; when it failed before
    // reaching the server, there is no gate to read.
    const analysed = result.qualityGate !== 'NONE';
    const passed = analysed && result.qualityGate !== 'ERROR';
    await pipelineService.recordScanResult(executionId, 'sonarqube', {
      status: passed ? 'success' : 'failed',
      quality_gate_status: analysed ? result.qualityGate : null,
      bugs: m.bugs ?? null,
      vulnerabilities: m.vulnerabilities ?? null,
      code_smells: m.code_smells ?? null,
      security_hotspots: m.security_hotspots ?? null,
      coverage: m.coverage ?? null,
      duplications: m.duplicated_lines_density ?? null,
      sonar_project_key: projectKey,
      sonar_dashboard_url: result.dashboardUrl,
      summary: line,
    });
    await pipelineService.setJobStatus(executionId, 'sonarqube', passed ? 'success' : 'failed', line);
    if (!analysed) throw new Error(`The SonarQube analysis failed: ${(r.stderr || r.stdout).slice(-300)}`);
    if (!passed) throw new Error('The SonarQube quality gate failed.');
  } finally {
    await sonar.revokeToken(tokenName);
  }
}
