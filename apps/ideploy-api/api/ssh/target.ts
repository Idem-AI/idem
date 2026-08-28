/**
 * Server target classification — pure predicates on a server row, no I/O, so
 * they stay trivially unit-testable and usable by both the real executor and
 * the domain services.
 */
import { ServerRow } from '../models/ideploy.types';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal']);

/**
 * A "local" server is this machine itself (Coolify's localhost server concept):
 * commands run via the local Docker CLI instead of SSH. Lets you deploy on the
 * host running iDeploy with no SSH setup — ideal for local testing.
 */
export function isLocalServer(server: ServerRow): boolean {
  return server.uuid === '0' || LOCAL_HOSTS.has((server.ip || '').toLowerCase());
}
