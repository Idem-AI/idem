/**
 * Registry logins, and a pipeline deploying one application with its token.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handleWebhook, ensureWebhookSecret } from '../../api/services/webhook.service';
import * as registry from '../../api/services/registry-credentials.service';
import { isDomainError } from '../../api/utils/errors';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) throw new Error('Integration tests need the test database.');
});
beforeEach(async () => truncateAll());
afterAll(async () => closeInfrastructure());

describe('registry credentials', () => {
  it('stores the token encrypted, never returns it, and finds the login by registry', async () => {
    const team = await makeTeam();
    await registry.saveRegistryCredential(team.id, { registry: 'https://Registry.Example.com/', username: 'ci', password: 'tok_secret' });

    const list = await registry.listRegistryCredentials(team.id);
    expect(list).toEqual([{ id: expect.any(Number), registry: 'registry.example.com', username: 'ci' }]);
    expect(JSON.stringify(list)).not.toContain('tok_secret');
    const stored = await testPool().query('SELECT password FROM registry_credentials');
    expect(stored.rows[0].password).not.toContain('tok_secret');

    expect(await registry.resolveRegistryLogin(team.id, 'registry.example.com/acme/app')).toEqual({ registry: 'registry.example.com', username: 'ci', password: 'tok_secret' });
    expect(await registry.resolveRegistryLogin(team.id, 'nginx')).toBeNull();
  });

  it('replaces the login of a registry, and keeps teams apart', async () => {
    const [a, b] = [await makeTeam(), await makeTeam()];
    await registry.saveRegistryCredential(a.id, { registry: 'registry.example.com', username: 'old', password: 'p1' });
    await registry.saveRegistryCredential(a.id, { registry: 'registry.example.com', username: 'new', password: 'p2' });

    expect((await registry.listRegistryCredentials(a.id)).map((c) => c.username)).toEqual(['new']);
    expect(await registry.resolveRegistryLogin(b.id, 'registry.example.com/x/y')).toBeNull();
  });

  it('refuses a registry that is not a host', async () => {
    const team = await makeTeam();
    await expect(registry.saveRegistryCredential(team.id, { registry: 'not a host', username: 'u', password: 'p' })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.code === 'INVALID_REGISTRY'
    );
  });
});

describe('a pipeline deploying through its token', () => {
  async function anApplication() {
    const team = await makeTeam();
    const server = await makeManagedServer();
    const project = await makeProject(team.id);
    const app = await makeApplication(project.environmentId, server.destinationId);
    return { teamId: team.id, app };
  }

  const request = (uuid: string, token: string | undefined, imageTag?: string) => ({
    provider: 'ci' as const,
    applicationUuid: uuid,
    rawBody: Buffer.from(''),
    payload: {},
    token,
    imageTag,
  });

  it('deploys with the application token and passes the image tag', async () => {
    const { teamId, app } = await anApplication();
    const secret = await ensureWebhookSecret(teamId, app.uuid, 'ci');
    const seen: (string | undefined)[] = [];

    const outcome = await handleWebhook(request(app.uuid, secret, 'sha-9f3c2d1'), async (_target, version) => {
      seen.push(version);
      return 'deployment-uuid';
    });

    expect(outcome).toMatchObject({ action: 'deployed', deploymentUuid: 'deployment-uuid' });
    expect(seen).toEqual(['sha-9f3c2d1']);
  });

  it('refuses a wrong token, another application\'s token, and a bad tag', async () => {
    const [one, two] = [await anApplication(), await anApplication()];
    const secretOne = await ensureWebhookSecret(one.teamId, one.app.uuid, 'ci');
    await ensureWebhookSecret(two.teamId, two.app.uuid, 'ci');
    const deploy = async () => 'x';

    await expect(handleWebhook(request(one.app.uuid, 'wrong', 'v1'), deploy)).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    await expect(handleWebhook(request(two.app.uuid, secretOne, 'v1'), deploy)).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    await expect(handleWebhook(request(one.app.uuid, secretOne, 'v1;rm -rf /'), deploy)).rejects.toMatchObject({ code: 'INVALID_IMAGE_TAG' });
  });
});
