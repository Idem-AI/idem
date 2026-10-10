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
import { SonarClient, sonarConfig, summariseTrivy, trivyFails } from '../services/pipeline-scanners.service';
import { PipelineGates } from '../services/pipeline-gates';
import { JAVA_BINARIES, JavaBuildPlan, parseProbe, planJavaBuild, probeCommand } from '../services/java-build';
import * as appService from '../services/application.service';
import * as serverService from '../services/server.service';
import * as pipelineService from '../services/pipeline.service';
import * as deploymentService from '../services/deployment.service';
import { explainGitFailure, resolveGitCredential } from '../services/git-credentials.service';
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

  // What the scans may stop is the application's choice.
  const { gates } = await pipelineService.getOrCreateConfig(teamId, applicationUuid);
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
        if (r.exitCode !== 0) throw new Error(`git clone failed: ${explainGitFailure(r.stderr, Boolean(credential))}`);
        commit = /COMMIT=([0-9a-f]{40})/.exec(r.stdout)?.[1] ?? null;
      } else if (stage === 'trivy') {
        await runTrivy(server, key, workdir, executionId, log, gates);
      } else if (stage === 'sonarqube') {
        await runSonar(server, key, workdir, app, executionUuid, executionId, log, gates);
      } else if (stage === 'deploy') {
        // The commit the pipeline checked, not the branch name — the worker
        // only accepts a commit id, and a branch would move under it.
        const { deploymentUuid } = await deploymentService.createDeployment(app, teamId, {
          commit: commit ?? 'HEAD',
          pipelineExecutionId: executionId,
          trivyFailOn: gates.trivy_fail_on,
        });
        await log(`Deployment ${deploymentUuid} queued — waiting for it to finish…`);
        // The stage is the deployment's outcome, not only its being queued.
        const outcome = await deploymentService.waitForDeployment(deploymentUuid, { timeoutMs: deployWaitMs(), pollMs: Number(process.env.PIPELINE_DEPLOY_POLL_MS) || 3000 });
        const detail = `Deployment ${deploymentUuid}: ${outcome === 'finished' ? 'finished' : outcome === 'failed' ? 'failed' : 'still running after the wait limit'}`;
        await pipelineService.setJobStatus(executionId, stage, outcome === 'finished' ? 'success' : 'failed', detail);
        await log(detail);
        if (outcome !== 'finished') throw new Error(`The deployment did not finish: ${outcome}. See deployment ${deploymentUuid}.`);
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

/** How long the deploy stage waits for its deployment. */
const deployWaitMs = () => Number(process.env.PIPELINE_DEPLOY_WAIT_MS) || 30 * 60_000;

/**
 * Trivy on the checked-out code: dependency vulnerabilities and committed
 * secrets, as JSON, summarised into counts by severity and the worst findings.
 */
async function runTrivy(server: Server, key: Key, workdir: string, executionId: number, log: (l: string) => Promise<void>, gates: PipelineGates): Promise<void> {
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
  const vulnerabilitiesFail = trivyFails(counts, gates.trivy_fail_on);
  const secretsFail = summary.secrets.length > 0 && gates.secrets === 'block';
  const fails = vulnerabilitiesFail || secretsFail;
  const reported = !fails && (counts.CRITICAL + counts.HIGH > 0 || summary.secrets.length > 0);
  if (reported) await log('These findings are reported only — this application\'s policy does not stop the pipeline on them.');
  await pipelineService.recordScanResult(executionId, 'trivy', {
    status: fails ? 'failed' : 'success',
    vulnerabilities: counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW + counts.UNKNOWN,
    critical_count: counts.CRITICAL,
    high_count: counts.HIGH,
    medium_count: counts.MEDIUM,
    low_count: counts.LOW,
    vulnerabilities_detail: summary.findings,
    secrets_found: summary.secrets,
    summary: reported ? `${line} (report only)` : line,
  });
  await pipelineService.setJobStatus(executionId, 'trivy', fails ? 'failed' : 'success', reported ? `${line} (report only)` : line);
  if (fails) {
    throw new Error(
      secretsFail ? 'Trivy found secrets committed in the code.' : `Trivy found vulnerabilities at or above ${gates.trivy_fail_on}.`
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
  log: (l: string) => Promise<void>,
  gates: PipelineGates
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
    const java = await buildJava(server, key, workdir, log);
    await log(`Analysing ${projectKey} on ${config.url}…`);
    const exclusions = ['**/node_modules/**', '**/vendor/**', '**/dist/**', '**/build/**', '**/target/**'];
    // Java the analyser cannot see compiled is left out rather than failing the whole analysis.
    if (java.hasJava && !java.compiled) exclusions.push('**/*.java');
    const r = await executeRemoteCommand(
      server,
      key,
      `docker run --rm -e SONAR_HOST_URL=${shellQuote(config.url)} -e SONAR_TOKEN=${shellQuote(token)} ` +
        `-v ${shellQuote(workdir)}:/usr/src sonarsource/sonar-scanner-cli ` +
        `-Dsonar.projectKey=${shellQuote(projectKey)} -Dsonar.sources=. ` +
        (java.compiled ? `-Dsonar.java.binaries=${shellQuote(JAVA_BINARIES)} ` : '') +
        `-Dsonar.exclusions=${shellQuote(exclusions.join(','))} ` +
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
    const gatePassed = analysed && result.qualityGate !== 'ERROR';
    // A failed gate only stops the pipeline when the application asked for it.
    const passed = gatePassed || (analysed && gates.quality_gate === 'report');
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
      summary: analysed && !gatePassed && passed ? `${line} (report only)` : line,
    });
    const shown = analysed && !gatePassed && passed ? `${line} (report only)` : line;
    await pipelineService.setJobStatus(executionId, 'sonarqube', passed ? 'success' : 'failed', shown);
    if (!analysed) throw new Error(`The SonarQube analysis failed: ${(r.stderr || r.stdout).slice(-300)}`);
    if (!passed) throw new Error('The SonarQube quality gate failed.');
  } finally {
    await sonar.revokeToken(tokenName);
  }
}

/**
 * Compiles the Java project, if there is one, so SonarQube can analyse it.
 * A project that cannot be compiled here is analysed without its Java files
 * (and says so) instead of failing the pipeline.
 */
async function buildJava(
  server: Server,
  key: Key,
  workdir: string,
  log: (l: string) => Promise<void>
): Promise<{ hasJava: boolean; compiled: boolean }> {
  const found = await executeRemoteCommand(server, key, probeCommand(workdir, shellQuote), { noRetry: true });
  const probe = parseProbe(found.stdout);
  if (!probe.hasJava) return { hasJava: false, compiled: false };

  const first = probe.buildFiles.filter((f) => /(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/.test(f)).sort((a, b) => a.split('/').length - b.split('/').length)[0];
  let buildText = '';
  if (first) {
    const read = await executeRemoteCommand(server, key, `head -c 20000 ${shellQuote(`${workdir}/${first}`)}`, { noRetry: true });
    buildText = read.stdout;
  }
  const plan: JavaBuildPlan | null = planJavaBuild({ ...probe, buildText });
  if (!plan) {
    await log('Java sources found but no Maven or Gradle build file: Java files are left out of the analysis.');
    return { hasJava: true, compiled: false };
  }
  await log(`Compiling the Java project with ${plan.tool} (JDK ${plan.jdk}) for the analysis…`);
  const dir = plan.dir === '.' ? workdir : `${workdir}/${plan.dir}`;
  const r = await executeRemoteCommand(
    server,
    key,
    `timeout 900 docker run --rm -v ${shellQuote(workdir)}:${shellQuote(workdir)} -v ideploy-m2-cache:/root/.m2 -v ideploy-gradle-cache:/root/.gradle ` +
      `-w ${shellQuote(dir)} ${plan.image} ${plan.command}`,
    { noRetry: true, onData: (c) => log(c) }
  );
  if (r.exitCode !== 0) {
    await log(`The Java project could not be compiled (${(r.stderr || r.stdout).slice(-300).trim()}): Java files are left out of the analysis.`);
    return { hasJava: true, compiled: false };
  }
  return { hasJava: true, compiled: true };
}
