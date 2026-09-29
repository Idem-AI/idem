/**
 * Chargement des secrets depuis Google Secret Manager.
 *
 * ⚠️ Fichier partagé à l'identique par les backends IDEM (api, appgen,
 * ideploy-api) — chacun l'embarque, parce que leurs images Docker ne voient
 * que leur propre dossier. Modifier les trois copies ensemble.
 *
 * ## Nommage indexé
 *
 * Chaque secret porte l'index de l'application qui le lit :
 *
 *     <SECRET_ENV_PREFIX><app>--<VARIABLE>
 *     api--GCP_SA_PRIVATE_KEY    appgen--GLM_API_KEY   ideploy-api--REDIS_PASSWORD
 *
 * Deux applications qui utilisent la même valeur ont donc chacune leur secret :
 * on sait toujours qui lit quoi, on révoque l'accès d'une app sans toucher aux
 * autres, et une rotation se fait application par application.
 * `SECRET_ENV_PREFIX` (vide par défaut) sépare les environnements :
 * `staging-api--…`.
 *
 * ## Ce qui est un secret
 *
 * Uniquement ce que liste le manifeste de l'application. La configuration non
 * sensible (ports, URL, limites, identifiants publics) reste dans le `.env`.
 *
 * ## Activation
 *
 *  - `USE_SECRET_MANAGER=true`, ou `NODE_ENV=production` sans
 *    `USE_SECRET_MANAGER=false` ;
 *  - projet : `GCP_PROJECT_ID` (ou `GOOGLE_CLOUD_PROJECT`) ;
 *  - identité : Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`
 *    sur un serveur hors GCP), avec le rôle `roles/secretmanager.secretAccessor`
 *    limité aux secrets de l'application (condition IAM sur le préfixe).
 */

export interface SecretManifest {
  /** Index de l'application dans les noms de secrets. */
  app: string;
  /** Secrets sans lesquels l'application ne démarre pas. */
  required: readonly string[];
  /** Secrets propres à une fonctionnalité : absents, un avertissement suffit. */
  optional: readonly string[];
  /**
   * Relire l'ancien nom sans index si le nom indexé n'existe pas encore.
   * Transitoire : le temps de migrer les secrets existants, puis à retirer.
   */
  legacyUnprefixedFallback?: boolean;
}

export interface LoadSecretsResult {
  source: 'secret-manager' | 'env';
  loaded: string[];
  missingOptional: string[];
}

/** Nom du secret dans Secret Manager pour une variable d'une application. */
export function secretIdFor(app: string, variable: string, envPrefix = process.env.SECRET_ENV_PREFIX || ''): string {
  return `${envPrefix}${app}--${variable}`;
}

export function isSecretManagerEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.USE_SECRET_MANAGER === 'true') return true;
  if (process.env.USE_SECRET_MANAGER === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

/**
 * Injecte les secrets dans `process.env`.
 *
 * À appeler AVANT d'importer le moindre module qui lit `process.env` à son
 * chargement (pool de base de données, client Redis, clients LLM).
 * Une valeur déjà présente dans l'environnement du processus n'est pas écrasée :
 * c'est la porte de secours pour une surcharge ponctuelle.
 */
export async function loadSecretsFromManager(
  manifest: SecretManifest,
  log: Pick<Console, 'log' | 'warn' | 'error'> = console
): Promise<LoadSecretsResult> {
  const all = [...manifest.required, ...manifest.optional];

  if (!isSecretManagerEnabled()) {
    const missingRequired = manifest.required.filter((k) => !process.env[k]);
    if (missingRequired.length > 0 && process.env.NODE_ENV !== 'test') {
      log.warn(`[secrets] ${manifest.app}: not set in the local environment: ${missingRequired.join(', ')}`);
    }
    return { source: 'env', loaded: [], missingOptional: manifest.optional.filter((k) => !process.env[k]) };
  }

  const projectId =
    process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error('[secrets] GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) is required to use Secret Manager.');
  }

  const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
  const client = new SecretManagerServiceClient();

  const read = async (secretId: string): Promise<string | undefined> => {
    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${secretId}/versions/latest`,
      });
      return version.payload?.data?.toString();
    } catch (error: unknown) {
      // 5 = NOT_FOUND : le secret n'existe pas (encore) sous ce nom.
      if ((error as { code?: number })?.code === 5) return undefined;
      throw error;
    }
  };

  const results = await Promise.allSettled(
    all.map(async (variable) => {
      const indexed = secretIdFor(manifest.app, variable);
      let value = await read(indexed);
      let usedLegacy = false;
      if (value === undefined && manifest.legacyUnprefixedFallback) {
        value = await read(variable);
        usedLegacy = value !== undefined;
      }
      return { variable, indexed, value, usedLegacy };
    })
  );

  const loaded: string[] = [];
  const legacy: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      const reason = result.reason as { message?: string };
      log.warn(`[secrets] ${manifest.app}: could not read ${all[index]}: ${reason?.message ?? reason}`);
      continue;
    }
    const { variable, value, usedLegacy } = result.value;
    if (value === undefined) continue;
    if (process.env[variable] === undefined || process.env[variable] === '') {
      process.env[variable] = value;
    }
    loaded.push(variable);
    if (usedLegacy) legacy.push(variable);
  }

  log.log(`[secrets] ${manifest.app}: ${loaded.length}/${all.length} secrets loaded from Secret Manager (project=${projectId}).`);
  if (legacy.length > 0) {
    log.warn(
      `[secrets] ${manifest.app}: read from legacy un-indexed names, migrate them: ${legacy.join(', ')}`
    );
  }

  const missingRequired = manifest.required.filter((k) => !process.env[k]);
  if (missingRequired.length > 0) {
    throw new Error(`[secrets] ${manifest.app}: missing required secrets: ${missingRequired.join(', ')}`);
  }

  const missingOptional = manifest.optional.filter((k) => !process.env[k]);
  if (missingOptional.length > 0) {
    log.warn(`[secrets] ${manifest.app}: optional secrets not set: ${missingOptional.join(', ')}`);
  }

  return { source: 'secret-manager', loaded, missingOptional };
}
