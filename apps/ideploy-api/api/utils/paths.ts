/**
 * Base directory for all on-server iDeploy data (compose files, proxy config,
 * backups, …). Defaults to `/data/ideploy` (Linux servers run as root), but is
 * overridable via IDEPLOY_DATA_DIR — set it to a writable path for local
 * testing on macOS/dev (e.g. ${HOME}/.ideploy), where `/data` isn't writable.
 */
export function dataDir(): string {
  return (process.env.IDEPLOY_DATA_DIR || '/data/ideploy').replace(/\/+$/, '');
}

export const appWorkdirFor = (uuid: string): string => `${dataDir()}/applications/${uuid}`;
export const serviceWorkdirFor = (uuid: string): string => `${dataDir()}/services/${uuid}`;
export const pipelineWorkdirFor = (uuid: string): string => `${dataDir()}/pipelines/${uuid}`;
export const proxyPath = (): string => `${dataDir()}/proxy`;
export const backupRoot = (): string => `${dataDir()}/backups`;
export const crowdsecDir = (): string => `${dataDir()}/crowdsec`;
