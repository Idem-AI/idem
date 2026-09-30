/**
 * Politique de sécurité des fichiers compose fournis par un utilisateur.
 *
 * Un compose s'exécute avec les droits du démon Docker de l'hôte : un seul
 * `privileged: true`, un montage de `/` ou du socket Docker, et le conteneur
 * devient root sur le serveur — et sur un serveur géré par IDEM, cela veut dire
 * accès aux applications de tous les autres clients hébergés dessus.
 *
 * Cette politique refuse tout ce qui franchit la frontière du conteneur. Elle
 * ne s'applique pas aux modèles du catalogue, écrits et relus par IDEM.
 */
import YAML from 'yaml';

export class ComposePolicyError extends Error {
  constructor(public readonly violations: string[]) {
    super(`The compose file is not allowed: ${violations.join('; ')}`);
    this.name = 'ComposePolicyError';
  }
}

/** Capacités sans effet hors du conteneur, courantes dans les images officielles. */
const ALLOWED_CAPABILITIES = new Set([
  'CHOWN',
  'DAC_OVERRIDE',
  'FOWNER',
  'FSETID',
  'KILL',
  'NET_BIND_SERVICE',
  'SETGID',
  'SETUID',
  'SETPCAP',
]);

const HOST_NAMESPACE_KEYS = ['network_mode', 'pid', 'ipc', 'uts', 'userns_mode', 'cgroup'] as const;

const FORBIDDEN_SERVICE_KEYS = ['devices', 'device_cgroup_rules', 'cgroup_parent', 'volumes_from'] as const;

function isHostPath(source: string): boolean {
  const s = source.trim();
  return (
    s.startsWith('/') ||
    s.startsWith('~') ||
    s.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(s) ||
    s.split(/[\\/]/).includes('..') ||
    s.includes('docker.sock')
  );
}

/** Source d'un volume en syntaxe courte (`src:dst[:mode]`), ou null pour un volume anonyme. */
function shortVolumeSource(entry: string): string | null {
  const parts = entry.split(':');
  return parts.length >= 2 ? parts[0] : null;
}

function checkService(name: string, svc: Record<string, unknown>, violations: string[]): void {
  if (svc.privileged === true || svc.privileged === 'true') {
    violations.push(`${name}: privileged mode`);
  }

  for (const key of HOST_NAMESPACE_KEYS) {
    const value = svc[key];
    if (typeof value === 'string' && (value === 'host' || value.startsWith('container:'))) {
      violations.push(`${name}: ${key}: ${value}`);
    }
  }

  for (const key of FORBIDDEN_SERVICE_KEYS) {
    if (svc[key] !== undefined) violations.push(`${name}: ${key}`);
  }

  const capAdd = svc.cap_add;
  if (Array.isArray(capAdd)) {
    for (const cap of capAdd) {
      const normalized = String(cap).toUpperCase().replace(/^CAP_/, '');
      if (!ALLOWED_CAPABILITIES.has(normalized)) violations.push(`${name}: cap_add ${normalized}`);
    }
  }

  const securityOpt = svc.security_opt;
  if (Array.isArray(securityOpt)) {
    for (const opt of securityOpt) {
      const value = String(opt).toLowerCase().replace(/\s/g, '');
      if (
        value.includes('unconfined') ||
        value.startsWith('label=disable') ||
        value.startsWith('label:disable') ||
        value.includes('no-new-privileges=false') ||
        value.includes('no-new-privileges:false')
      ) {
        violations.push(`${name}: security_opt ${opt}`);
      }
    }
  }

  const volumes = svc.volumes;
  if (Array.isArray(volumes)) {
    for (const volume of volumes) {
      if (typeof volume === 'string') {
        const source = shortVolumeSource(volume);
        if (source && isHostPath(source)) violations.push(`${name}: host bind mount ${source}`);
      } else if (volume && typeof volume === 'object') {
        const v = volume as Record<string, unknown>;
        const source = typeof v.source === 'string' ? v.source : '';
        if (v.type === 'bind' || (source && isHostPath(source))) {
          violations.push(`${name}: host bind mount ${source || '(bind)'}`);
        }
      }
    }
  }

  // Build à partir d'un contexte hors du dépôt : lecture de fichiers de l'hôte.
  const build = svc.build;
  const context = typeof build === 'string' ? build : (build as Record<string, unknown> | undefined)?.context;
  if (typeof context === 'string' && isHostPath(context) && !/^https?:\/\//.test(context)) {
    violations.push(`${name}: build context ${context}`);
  }
}

/** Lève `ComposePolicyError` si le compose sort des limites d'un conteneur. */
export function assertComposeIsSafe(composeText: string): void {
  let doc: unknown;
  try {
    doc = YAML.parse(composeText);
  } catch (error) {
    throw new ComposePolicyError([`invalid YAML (${(error as Error).message})`]);
  }
  if (!doc || typeof doc !== 'object') {
    throw new ComposePolicyError(['empty or invalid compose document']);
  }

  const violations: string[] = [];
  const root = doc as Record<string, unknown>;
  const services = root.services;

  if (services && typeof services === 'object') {
    for (const [name, svc] of Object.entries(services as Record<string, unknown>)) {
      if (svc && typeof svc === 'object') checkService(name, svc as Record<string, unknown>, violations);
    }
  }

  // Volume nommé qui est en réalité un montage de l'hôte (driver local + bind).
  const topVolumes = root.volumes;
  if (topVolumes && typeof topVolumes === 'object') {
    for (const [name, def] of Object.entries(topVolumes as Record<string, unknown>)) {
      const opts = (def as Record<string, unknown> | null)?.driver_opts as Record<string, unknown> | undefined;
      if (opts && (opts.device !== undefined || String(opts.o ?? '').includes('bind'))) {
        violations.push(`volume ${name}: driver_opts host device`);
      }
    }
  }

  if (violations.length > 0) throw new ComposePolicyError(violations);
}
