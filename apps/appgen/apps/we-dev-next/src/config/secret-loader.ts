/**
 * Chargement des secrets depuis Infisical (self-hosted).
 *
 * ⚠️ Fichier partagé à l'identique par les backends IDEM (api, appgen,
 * ideploy-api) — chacun l'embarque, parce que leurs images Docker ne voient
 * que leur propre dossier. Modifier les trois copies ensemble.
 *
 * ## Un projet Infisical par application
 *
 * Chaque application (`api`, `appgen`, `ideploy-api`) a son propre projet
 * Infisical, avec son environnement `prod` (`INFISICAL_ENVIRONMENT`) et sa propre
 * identité machine (Universal Auth) — accès scopé à ce seul projet. L'isolement
 * se fait donc au niveau du projet : pas besoin de préfixer les noms de
 * secrets (contrairement à un magasin partagé entre applications), le nom
 * du secret dans Infisical est directement `<VARIABLE>`.
 *
 * ## Ce qui est chargé
 *
 * Toutes les variables du projet de l'application : en ajouter une dans
 * Infisical suffit, sans toucher au code. Le manifeste ne filtre rien ; il dit
 * ce qui est indispensable (`required` : l'application refuse de démarrer
 * sans) et ce qu'il est utile de signaler s'il manque (`optional`).
 * La configuration non sensible peut rester dans le `.env`.
 *
 * ## Activation
 *
 *  - `USE_SECRET_MANAGER=true`, ou `NODE_ENV=production` sans
 *    `USE_SECRET_MANAGER=false` ;
 *  - instance : `INFISICAL_SITE_URL` (URL de l'instance self-hosted) ;
 *  - projet : `INFISICAL_PROJECT_ID` (celui de cette application) ;
 *  - identité : `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`
 *    (Universal Auth de l'identité machine scopée à ce projet).
 */

export interface SecretManifest {
  /** Nom de l'application (uniquement pour les logs — l'isolement se fait par projet Infisical, pas par préfixe). */
  app: string;
  /** Secrets sans lesquels l'application ne démarre pas. */
  required: readonly string[];
  /** Secrets propres à une fonctionnalité : absents, un avertissement suffit. */
  optional: readonly string[];
}

/** Ce qu'un nom de variable d'environnement peut être ; une autre clé du projet est ignorée. */
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface LoadSecretsResult {
  source: 'secret-manager' | 'env';
  loaded: string[];
  missingOptional: string[];
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
  if (!isSecretManagerEnabled()) {
    const missingRequired = manifest.required.filter((k) => !process.env[k]);
    if (missingRequired.length > 0 && process.env.NODE_ENV !== 'test') {
      log.warn(`[secrets] ${manifest.app}: not set in the local environment: ${missingRequired.join(', ')}`);
    }
    return { source: 'env', loaded: [], missingOptional: manifest.optional.filter((k) => !process.env[k]) };
  }

  const siteUrl = process.env.INFISICAL_SITE_URL;
  const projectId = process.env.INFISICAL_PROJECT_ID;
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  // Lu ici et non au chargement du module : l'appelant peut avoir chargé un `.env` entre-temps.
  // `prod` est l'environnement qu'Infisical crée avec chaque projet.
  const INFISICAL_ENVIRONMENT = process.env.INFISICAL_ENVIRONMENT || 'prod';
  if (!siteUrl || !projectId || !clientId || !clientSecret) {
    throw new Error(
      '[secrets] INFISICAL_SITE_URL, INFISICAL_PROJECT_ID, INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET are all required to use Infisical.'
    );
  }

  // Une seule requête pour tout le projet : il ne contient que les variables
  // de cette application, et toutes sont chargées. Un échec (auth, droits, réseau) est journalisé tel quel
  // plutôt que confondu avec des secrets absents ; le contrôle des requis
  // ci-dessous décide ensuite si l'application peut démarrer.
  const online = new Map<string, string>();
  try {
    const { InfisicalSDK } = await import('@infisical/sdk');
    const client = new InfisicalSDK({ siteUrl });
    await client.auth().universalAuth.login({ clientId, clientSecret });
    const { secrets } = await client.secrets().listSecrets({
      projectId,
      environment: INFISICAL_ENVIRONMENT,
      secretPath: '/',
      viewSecretValue: true,
    });
    for (const secret of secrets) online.set(secret.secretKey, secret.secretValue);
  } catch (error: unknown) {
    log.error(
      `[secrets] ${manifest.app}: could not read Infisical (project=${projectId}, env=${INFISICAL_ENVIRONMENT}): ${(error as Error)?.message ?? error}`
    );
  }

  const loaded: string[] = [];
  const invalid: string[] = [];
  for (const [variable, value] of online) {
    if (!ENV_NAME.test(variable)) {
      invalid.push(variable);
      continue;
    }
    if (process.env[variable] === undefined || process.env[variable] === '') {
      process.env[variable] = value;
    }
    loaded.push(variable);
  }
  loaded.sort();

  // Les noms seulement, jamais les valeurs : de quoi vérifier d'un coup d'œil
  // qu'une variable attendue vient bien d'Infisical.
  log.log(
    `[secrets] ${manifest.app}: ${loaded.length} variable(s) loaded from Infisical (project=${projectId}, env=${INFISICAL_ENVIRONMENT}): ${loaded.join(', ') || '—'}.`
  );
  if (invalid.length > 0) {
    log.warn(`[secrets] ${manifest.app}: ignored, not valid environment variable names: ${invalid.join(', ')}`);
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
