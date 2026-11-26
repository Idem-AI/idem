/**
 * Is this deployment a site sent already built (what iCode publishes)?
 *
 * Kept apart from `static-fast-path.ts` (SSH, compose, routes) so that the
 * deployment service can choose the fast lane without loading all of that.
 */
import { toBuildPack } from '../docker/build-packs';
import type { ApplicationRow } from '../models/ideploy.types';

export type PrebuiltFields = Pick<ApplicationRow, 'git_repository' | 'build_pack' | 'install_command' | 'build_command' | 'start_command'>;

/**
 * The site arrives built (iCode): files, no command to run. A Git repository,
 * an install or build command, an image: the general path.
 */
export function isPrebuiltStatic(app: PrebuiltFields, hasSourceArchive: boolean): boolean {
  return (
    hasSourceArchive &&
    !app.git_repository &&
    toBuildPack(app.build_pack) === 'static' &&
    !app.install_command &&
    !app.build_command &&
    !app.start_command
  );
}
