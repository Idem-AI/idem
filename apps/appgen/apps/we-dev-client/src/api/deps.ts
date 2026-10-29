/**
 * Les `node_modules` du socle, demandés au serveur plutôt qu'à npm.
 *
 * Mesuré sur la cible « site » : 191 paquets, 8 466 fichiers, 100 Mo, presque
 * trois minutes de `npm install`. Compressé, le même arbre pèse 17 Mo et se
 * télécharge en une seule requête, cacheable pour toujours (l'empreinte est
 * dans l'adresse). C'est la différence entre un atelier qui s'ouvre et un
 * atelier qu'on attend.
 *
 * Le plan ne dépend que de la cible — site, application web, application
 * mobile — donc il se demande dès la première image, avant même d'avoir chargé
 * le projet.
 */

const apiBase = () => process.env.REACT_APP_BASE_URL || '';

export type DepsTargetName = 'site' | 'web-app' | 'mobile-app';

export interface DepsTreeInfo {
  /** `root`, `frontend`, `backend` : un arbre `node_modules` à monter. */
  id: string;
  /** Dossier du manifeste, '' pour la racine. */
  dir: string;
  /** Où monter l'arbre dans l'espace de travail. */
  mountPoint: string;
  /** Empreinte des dépendances de cet arbre : elle est dans l'adresse servie. */
  fingerprint: string;
  /** Le serveur a-t-il un instantané sous cette empreinte ? */
  baked: boolean;
  /** Octets à télécharger (compressés), pour annoncer une progression juste. */
  bytes: number;
  url: string | null;
  marker: string;
  /**
   * Pas encore cuit sous cette empreinte : l'instantané le plus récent du même arbre (une version de paquet vient
   * de changer). Monté puis complété par npm, il évite l'installation complète.
   */
  nearest?: { fingerprint: string; url: string; bytes: number } | null;
}

export interface DepsPlanInfo {
  target: DepsTargetName;
  fingerprint: string;
  trees: DepsTreeInfo[];
}

/** Le plan de dépendances d'une cible. Erreur réseau → `null`, et npm reprend. */
export async function fetchDepsPlan(
  target: DepsTargetName,
  signal?: AbortSignal
): Promise<DepsPlanInfo | null> {
  try {
    const response = await fetch(`${apiBase()}/api/scaffold/deps/${target}`, {
      credentials: 'include',
      signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as DepsPlanInfo;
  } catch {
    return null;
  }
}

export interface SnapshotProgress {
  /** Octets reçus, et total annoncé par le plan. */
  received: number;
  total: number;
}

/**
 * Les octets d'un instantané.
 *
 * Lu par morceaux et non en un `arrayBuffer()` : sur une connexion lente, 17 Mo
 * sans progression ressemblent à un blocage. La progression remonte jusqu'à
 * l'écran d'ouverture.
 *
 * La réponse est servie en `Content-Encoding: gzip` : `fetch` décompresse, donc
 * ce qui sort d'ici est l'instantané binaire attendu par `container.mount`.
 */
export async function fetchSnapshot(
  tree: DepsTreeInfo,
  onProgress?: (progress: SnapshotProgress) => void,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  if (!tree.url) return null;

  try {
    const response = await fetch(`${apiBase()}${tree.url}`, { credentials: 'include', signal });
    if (!response.ok || !response.body) return null;

    // `Content-Length` porte la taille compressée ; le plan aussi. La barre
    // avance donc sur les octets du réseau, ce qui est ce que l'utilisateur
    // attend sur une connexion lente.
    const total = tree.bytes || Number(response.headers.get('Content-Length')) || 0;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      received += value.length;
      onProgress?.({ received, total });
    }

    const snapshot = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      snapshot.set(chunk, offset);
      offset += chunk.length;
    }

    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Le manifeste à installer pour fabriquer un arbre — utilisé par le four, pas
 * par un atelier ordinaire.
 */
export async function fetchTreeManifest(
  target: DepsTargetName,
  tree: DepsTreeInfo
): Promise<string | null> {
  try {
    const response = await fetch(
      `${apiBase()}/api/scaffold/deps/${target}/${tree.fingerprint}/${tree.id}/manifest`,
      { credentials: 'include' }
    );
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** Dépose un instantané fabriqué par le four. */
export async function putSnapshot(
  target: DepsTargetName,
  tree: DepsTreeInfo,
  gzipped: Uint8Array,
  options: { token: string; unpackedBytes?: number; verified?: string }
): Promise<{ stored: boolean; error?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'X-Idem-Bake-Token': options.token,
  };
  if (options.unpackedBytes) headers['X-Idem-Unpacked-Bytes'] = String(options.unpackedBytes);
  if (options.verified) headers['X-Idem-Verified'] = options.verified;

  const response = await fetch(
    `${apiBase()}/api/scaffold/deps/${target}/${tree.fingerprint}/${tree.id}`,
    {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: gzipped as unknown as BodyInit,
    }
  );

  if (!response.ok) {
    let error = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) error = body.error;
    } catch {
      // Réponse sans corps lisible : le code suffit.
    }
    return { stored: false, error };
  }

  return { stored: true };
}
