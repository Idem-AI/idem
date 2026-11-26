/**
 * Publishing from iCode: no Git repository, the files are sent directly.
 *
 * What must hold for a user who never sees any of it:
 *   - the code they built is what lands on the server, byte for byte;
 *   - a site deploys through the real worker, from upload to "finished";
 *   - a complete application gets a started PostgreSQL, a server that knows
 *     where it is, and an interface that knows where the server is.
 */
import { execFileSync } from 'child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Job } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTarGz, readTarGz } from '../../api/utils/tar';
import {
  fileDigest,
  getSourceArchive,
  getSourceManifest,
  packSource,
  saveApplicationSource,
  saveApplicationSourceDelta,
} from '../../api/services/application-source.service';
import { sweepReservations, RESERVATION_TTL_MS } from '../../api/services/address-reservation.service';
import { createDeployment, deploysOnFastLane } from '../../api/services/deployment.service';
import { fastDeploymentQueue, deploymentQueue } from '../../api/queue/queues';
import { quickDeploy, quickDeployFullstack } from '../../api/services/quick-deploy.service';
import { processDeployment } from '../../api/jobs/deployment.worker';
import * as appService from '../../api/services/application.service';
import * as envVarService from '../../api/services/env-var.service';
import { DeploymentJobData } from '../../api/services/deployment.service';
import { setRemoteExecutor } from '../../api/ssh/ssh';
import { PrivateKeyRow, ServerRow } from '../../api/models/ideploy.types';
import { isDomainError } from '../../api/utils/errors';
import { FakeRemoteExecutor } from '../helpers/fake-executor';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeManagedServer, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

/** The fake executor, keeping a copy of every uploaded file before the worker deletes it. */
class CapturingExecutor extends FakeRemoteExecutor {
  readonly uploaded: string[] = [];
  private readonly dir = mkdtempSync(join(tmpdir(), 'icode-deploy-test-'));

  async upload(server: ServerRow, key: PrivateKeyRow, localPath: string, remotePath: string): Promise<void> {
    const copy = join(this.dir, `${this.uploaded.length}.tgz`);
    copyFileSync(localPath, copy);
    this.uploaded.push(copy);
    return super.upload(server, key, localPath, remotePath);
  }

  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** Extract an archive with the system `tar` — what the server runs — and read it back. */
function extract(archive: Buffer): (path: string) => Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'icode-extract-'));
  const file = join(dir, 'source.tgz');
  require('fs').writeFileSync(file, archive);
  execFileSync('tar', ['xzf', file, '-C', dir]);
  return (path: string) => readFileSync(join(dir, path));
}

let ssh: CapturingExecutor;

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error('Integration tests need the test database. Run scripts/prepare-test-db.sh from the repo root.');
  }
});

beforeEach(async () => {
  await truncateAll();
  ssh?.cleanup();
  ssh = new CapturingExecutor();
  // The container comes up and says so: the worker's verification ends at once.
  // First match wins: the port probe also runs `compose ps -q`.
  ssh.on(/\/net\/tcp/, { stdout: '  sl  local_address rem_address   st\n   0: 00000000:0050 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 1\n' });
  ssh.on(/compose .*ps/, { stdout: 'app  running  Up 2 seconds' });
  ssh.on(/logs/, { stdout: 'API listening on http://localhost:3001' });
  setRemoteExecutor(ssh);
});

afterAll(async () => {
  ssh?.cleanup();
  await closeInfrastructure();
});

describe('the archive iCode files travel in', () => {
  it('is read back identical by the system tar, binaries and long paths included', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
    const longPath = `frontend/src/${'components/'.repeat(12)}Card.jsx`;
    const read = extract(
      createTarGz({
        'package.json': '{"name":"site"}',
        'dist/logo.png': png,
        [longPath]: 'export default function Card() { return null; }',
        'texte-accentué.md': 'Été à Dakar',
      })
    );

    expect(read('package.json').toString()).toBe('{"name":"site"}');
    expect(read('dist/logo.png').equals(png)).toBe(true);
    expect(read(longPath).toString()).toContain('function Card');
    expect(read('texte-accentué.md').toString()).toBe('Été à Dakar');
  });

  it('is read back by readTarGz exactly as written', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    const longPath = `dist/${'assets/'.repeat(16)}index-abc.js`;
    const files = readTarGz(createTarGz({ 'dist/index.html': '<h1>Été</h1>', 'dist/logo.png': png, [longPath]: 'x'.repeat(1300) }));
    expect(Object.keys(files).sort()).toEqual(['dist/index.html', 'dist/logo.png', longPath].sort());
    expect(files['dist/index.html'].toString()).toBe('<h1>Été</h1>');
    expect(files['dist/logo.png'].equals(png)).toBe(true);
    expect(files[longPath].length).toBe(1300);
  });

  it('refuses a path that would escape the project, and leaves dependencies behind', () => {
    expect(() => packSource({ '../etc/passwd': 'x' })).toThrow(/not allowed/);
    const { fileCount } = packSource({
      'index.html': '<h1>ok</h1>',
      'node_modules/react/index.js': 'x',
      'backend/.pglite/base/1': 'x',
    });
    expect(fileCount).toBe(1);
  });
});

describe('quick deploy from files (site, mobile app, simple web app)', () => {
  it('deploys the built site through the real worker, from upload to finished', async () => {
    const team = await makeTeam();
    await makeManagedServer();

    const result = await quickDeploy(team.id, {
      name: 'boutique-amara',
      files: { 'dist/index.html': '<!doctype html><h1>Boutique Amara</h1>', 'dist/logo.png': { base64: 'iVBORw0KGgo=' } },
      build_pack: 'static',
      ports_exposes: '80',
    });

    expect(result.kind).toBe('application');
    expect(result.url).toMatch(/^https:\/\//);

    const app = await appService.getApplication(team.id, result.applicationUuid!);
    expect(app?.git_repository).toBe('');
    expect(await getSourceArchive(app!.id)).not.toBeNull();

    await processDeployment({
      data: {
        deploymentUuid: result.deploymentUuid!,
        applicationId: app!.id,
        applicationUuid: app!.uuid,
        teamId: team.id,
        commit: 'HEAD',
        forceRebuild: false,
      },
    } as Job<DeploymentJobData>);

    // A site already built (no package.json): the archive went up, was unpacked into a new
    // release and the link swapped under nginx — no clone, no image (static-fast-path.ts).
    expect(ssh.transfers.some((t) => t.direction === 'upload' && /\/static\/incoming-[0-9a-f]{8}\.tgz$/.test(t.remotePath))).toBe(true);
    expect(ssh.ranMatching(/tar xzf .*incoming-[0-9a-f]{8}\.tgz/)).toBe(true);
    expect(ssh.ranMatching(/git clone/)).toBe(false);
    expect(ssh.ranMatching(/docker build/)).toBe(false);
    expect(ssh.ranMatching(/mv -Tf .*current\.next/)).toBe(true);

    const read = extract(readFileSync(ssh.uploaded[0]));
    expect(read('dist/index.html').toString()).toContain('Boutique Amara');

    const { rows } = await testPool().query(
      `SELECT status FROM application_deployment_queues WHERE deployment_uuid = $1`,
      [result.deploymentUuid]
    );
    expect(rows[0].status).toBe('finished');
    // Le worker attend volontairement CONFIRM_GRACE_MS (15 s) avant sa seconde
    // vérification du conteneur : c'est la durée réelle d'un déploiement.
  }, 45_000);

  it('asks for a source when there is neither a repository nor files', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const attempt = quickDeploy(team.id, { name: 'vide' });
    await expect(attempt).rejects.toSatisfy((err: unknown) => isDomainError(err) && err.code === 'SOURCE_REQUIRED');
  });
});

describe('a republish sends only what changed', () => {
  const site = {
    'dist/index.html': '<!doctype html><h1>Version 1</h1>',
    'dist/logo.png': { base64: Buffer.from('a heavy image').toString('base64') },
  };

  it('keeps the unchanged files from the previous version and takes the changed ones', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const created = await quickDeploy(team.id, { name: 'delta', files: site, build_pack: 'static', ports_exposes: '80' });
    const manifest = await getSourceManifest(team.id, created.applicationUuid!);
    expect(manifest['dist/logo.png']).toBe(fileDigest(Buffer.from('a heavy image')));

    const html = '<!doctype html><h1>Version 2</h1>';
    const saved = await saveApplicationSourceDelta(
      team.id,
      created.applicationUuid!,
      { ...manifest, 'dist/index.html': fileDigest(Buffer.from(html)), 'dist/moved.png': manifest['dist/logo.png'] },
      { 'dist/index.html': html }
    );
    expect(saved.reused).toBe(2);

    const app = await appService.getApplication(team.id, created.applicationUuid!);
    const files = readTarGz((await getSourceArchive(app!.id))!);
    expect(files['dist/index.html'].toString()).toContain('Version 2');
    expect(files['dist/logo.png'].toString()).toBe('a heavy image');
    expect(files['dist/moved.png'].toString()).toBe('a heavy image');
  });

  it('says SOURCE_INCOMPLETE when a listed file is neither sent nor known (the client then sends all)', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const created = await quickDeploy(team.id, { name: 'delta-miss', files: site, build_pack: 'static', ports_exposes: '80' });
    const attempt = saveApplicationSourceDelta(team.id, created.applicationUuid!, { 'dist/new.png': 'f'.repeat(64) }, {});
    await expect(attempt).rejects.toSatisfy((err: unknown) => isDomainError(err) && err.code === 'SOURCE_INCOMPLETE');
  });
});

describe('a site built on the server from its sources', () => {
  it('builds in an isolated container, keeps dependencies, and swaps the release', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const result = await quickDeploy(team.id, {
      name: 'construit',
      files: { 'package.json': JSON.stringify({ scripts: { build: 'vite build' } }), 'src/main.tsx': 'export {}', 'index.html': '<div id="root"></div>' },
      build_pack: 'static',
      publish_directory: 'dist',
      ports_exposes: '80',
    });
    ssh.on(/\.idem\/build-report\.json/, { stdout: `@@IDEM_BUILD_REPORT ${Buffer.from('{"seo":{"errors":[]}}').toString('base64')}\n` });
    const app = await appService.getApplication(team.id, result.applicationUuid!);
    await processDeployment({
      queueName: 'ideploy-deployments-fast',
      data: { deploymentUuid: result.deploymentUuid!, applicationId: app!.id, applicationUuid: app!.uuid, teamId: team.id, commit: 'HEAD', forceRebuild: false },
    } as Job<DeploymentJobData>);

    // Sources unpacked beside the kept dependencies, then built in the bounded container…
    expect(ssh.ranMatching(/mv "src\/\$d" "next\/\$d"/)).toBe(true);
    expect(ssh.ranMatching(/docker run --rm --name 'ideploy-build-[0-9a-f]{8}' --user 1000:1000 --cap-drop ALL/)).toBe(true);
    // …the output copied into the release, and the link swapped: no image built.
    expect(ssh.ranMatching(/cp -a 'dist' '.*\/static\/releases\/[0-9a-f]{8}\/html'/)).toBe(true);
    expect(ssh.ranMatching(/mv -Tf .*current\.next/)).toBe(true);
    expect(ssh.ranMatching(/docker build/)).toBe(false);

    const { rows } = await testPool().query('SELECT status, logs FROM application_deployment_queues WHERE deployment_uuid = $1', [result.deploymentUuid]);
    expect(rows[0].status).toBe('finished');
    expect(String(rows[0].logs)).toContain('@@IDEM_BUILD_REPORT');
  }, 45_000);
});

describe('the fast lane', () => {
  it('takes what iCode sends (built or to build), and leaves a site with a server in the general lane', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const built = await quickDeploy(team.id, { name: 'lane-a', files: { 'dist/index.html': '<h1>a</h1>' }, build_pack: 'static', ports_exposes: '80' });
    const toBuild = await quickDeploy(team.id, {
      name: 'lane-b',
      files: { 'package.json': '{}' },
      build_pack: 'static',
      start_command: 'node server.js',
      ports_exposes: '80',
    });
    const a = await appService.getApplication(team.id, built.applicationUuid!);
    const b = await appService.getApplication(team.id, toBuild.applicationUuid!);
    expect(await deploysOnFastLane(a!.id)).toBe(true);
    expect(await deploysOnFastLane(b!.id)).toBe(false);
    expect(await fastDeploymentQueue.getJob(built.deploymentUuid!)).toBeTruthy();
    expect(await deploymentQueue.getJob(toBuild.deploymentUuid!)).toBeTruthy();
    // A pipeline always goes through the general lane (its image is scanned).
    const piped = await createDeployment(a!, team.id, { pipelineExecutionId: 1 });
    expect(await deploymentQueue.getJob(piped.deploymentUuid)).toBeTruthy();
  });
});

describe('an address reserved when the publish window opens', () => {
  it('creates the application without deploying, then takes the code like any update', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const reserved = await quickDeploy(team.id, { name: 'reserve', build_pack: 'static', publish_directory: 'dist', ports_exposes: '80', reserve: true });
    expect(reserved.deploymentUuid).toBeUndefined();
    expect(reserved.applicationUuid).toBeTruthy();
    const app = await appService.getApplication(team.id, reserved.applicationUuid!);
    expect(await getSourceArchive(app!.id)).toBeNull();
    const { rows } = await testPool().query('SELECT 1 FROM application_deployment_queues WHERE application_id = $1', [String(app!.id)]);
    expect(rows).toHaveLength(0);

    await saveApplicationSource(team.id, reserved.applicationUuid!, { 'dist/index.html': '<h1>ok</h1>' });
    expect(await deploysOnFastLane(app!.id)).toBe(true);
  });

  it('is given back after a day when nothing was published, kept when it was', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const left = await quickDeploy(team.id, { name: 'abandon', build_pack: 'static', ports_exposes: '80', reserve: true });
    const used = await quickDeploy(team.id, { name: 'publie', build_pack: 'static', ports_exposes: '80', reserve: true });
    await saveApplicationSource(team.id, used.applicationUuid!, { 'dist/index.html': '<h1>ok</h1>' });

    expect(await sweepReservations(Date.now() + RESERVATION_TTL_MS + 1000)).toBe(1);
    expect(await appService.getApplication(team.id, left.applicationUuid!)).toBeNull();
    expect(await appService.getApplication(team.id, used.applicationUuid!)).toBeTruthy();
  });
});

describe('complete application in one call (3 tiers)', () => {
  const project = {
    'package.json': '{"name":"project","scripts":{"dev":"concurrently ..."}}',
    'backend/package.json': '{"name":"backend","scripts":{"start":"node src/index.js"}}',
    'backend/src/index.js': 'console.log("api")',
    'frontend/package.json': '{"name":"frontend","scripts":{"build":"vite build"}}',
    'frontend/src/main.jsx': 'console.log("web")',
  };

  it('starts PostgreSQL and links the server to it and the interface to the server', async () => {
    const team = await makeTeam();
    await makeManagedServer();

    const result = await quickDeployFullstack(team.id, { name: 'clinique', files: project });

    // The database was started on the server before anything else.
    expect(ssh.ranMatching(/postgres/i)).toBe(true);

    const backend = await appService.getApplication(team.id, result.backend.uuid);
    const frontend = await appService.getApplication(team.id, result.frontend.uuid);
    expect(backend?.base_directory).toBe('/backend');
    expect(backend?.build_pack).toBe('nixpacks');
    expect(backend?.ports_exposes).toBe('3001');
    expect(frontend?.base_directory).toBe('/frontend');
    expect(frontend?.build_pack).toBe('static');
    expect(frontend?.publish_directory).toBe('dist');

    const backendEnv = Object.fromEntries(
      (await envVarService.listForApplication(team.id, backend!.uuid)).map((v) => [v.key, v])
    );
    expect(String(backendEnv.DATABASE_URL.value)).toMatch(/^postgres:\/\/postgres:[^@]+@[^:]+:5432\/postgres$/);
    expect(backendEnv.PORT.value).toBe('3001');
    expect(backendEnv.CORS_ORIGIN.value).toBe(result.frontend.url);
    expect(String(backendEnv.JWT_SECRET.value)).toHaveLength(64);

    const frontendEnv = await envVarService.listForApplication(team.id, frontend!.uuid);
    const apiUrl = frontendEnv.find((v) => v.key === 'VITE_API_URL');
    expect(apiUrl?.value).toBe(result.backend.url);
    expect(apiUrl?.is_buildtime).toBe(true);

    // Both have the code, both are queued.
    expect(await getSourceArchive(backend!.id)).not.toBeNull();
    expect(await getSourceArchive(frontend!.id)).not.toBeNull();
    const { rows } = await testPool().query(
      `SELECT count(*)::int AS n FROM application_deployment_queues WHERE deployment_uuid = ANY($1)`,
      [[result.backend.deploymentUuid, result.frontend.deploymentUuid]]
    );
    expect(rows[0].n).toBe(2);
  });

  it('refuses a project without backend/ and frontend/', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const attempt = quickDeployFullstack(team.id, { name: 'site', files: { 'index.html': '<h1>x</h1>' } });
    await expect(attempt).rejects.toSatisfy((err: unknown) => isDomainError(err) && err.code === 'NOT_A_FULLSTACK_PROJECT');
  });

  it('takes an update: new code replaces the old one', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const result = await quickDeployFullstack(team.id, { name: 'agenda', files: project });

    await saveApplicationSource(team.id, result.frontend.uuid, {
      ...project,
      'frontend/src/main.jsx': 'console.log("version 2")',
    });

    const frontend = await appService.getApplication(team.id, result.frontend.uuid);
    const read = extract((await getSourceArchive(frontend!.id))!);
    expect(read('frontend/src/main.jsx').toString()).toContain('version 2');
  });
});
