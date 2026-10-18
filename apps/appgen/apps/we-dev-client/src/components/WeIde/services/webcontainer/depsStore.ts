/**
 * Les arbres `node_modules` gardés dans le navigateur.
 *
 * Le cache HTTP suffirait en théorie — l'adresse d'un instantané porte son
 * empreinte, donc elle est immuable. En pratique il s'évapore : 17 à 40 Mo par
 * cible, c'est exactement la taille que les navigateurs évincent en premier, et
 * un utilisateur qui rouvre son projet le lendemain retéléchargerait tout.
 *
 * IndexedDB est le bon endroit : la place est demandée explicitement, le contenu
 * survit aux rechargements, et une lecture locale rend la deuxième ouverture
 * d'un projet instantanée même hors ligne.
 *
 * Deux règles tiennent ce cache honnête :
 *
 * - la clé est `cible/arbre/empreinte`. Une version du socle qui change une
 *   version de paquet change l'empreinte, donc la clé : un arbre périmé n'est
 *   jamais relu, il est simplement oublié puis évincé ;
 * - on garde les octets **compressés**, ceux du réseau. Trois fois moins de
 *   place, et la décompression d'un flux coûte moins que la lecture disque
 *   qu'elle économise.
 */

const DB_NAME = 'idem-appgen-deps';
const DB_VERSION = 1;
const STORE = 'snapshots';

/** Au-delà, on fait de la place : deux cibles complètes et leurs arbres. */
const MAX_ENTRIES = 8;
const MAX_TOTAL_BYTES = 400 * 1024 * 1024;

export interface StoredSnapshot {
  key: string;
  target: string;
  tree: string;
  fingerprint: string;
  /** Octets compressés (gzip) tels que reçus, ou bruts si le navigateur ne sait pas. */
  bytes: Uint8Array;
  compressed: boolean;
  size: number;
  storedAt: number;
  usedAt: number;
}

const keyOf = (target: string, tree: string, fingerprint: string) =>
  `${target}/${tree}/${fingerprint}`;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Navigation privée, stockage bloqué : le cache n'est qu'une optimisation.
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('usedAt', 'usedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

const asPromise = <T>(request: IDBRequest<T>): Promise<T | null> =>
  new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

/** Un arbre déjà gardé, ou `null`. La date d'usage est rafraîchie au passage. */
export async function readSnapshot(
  target: string,
  tree: string,
  fingerprint: string
): Promise<StoredSnapshot | null> {
  const db = await openDb();
  if (!db) return null;

  try {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const entry = await asPromise(store.get(keyOf(target, tree, fingerprint)));
    if (!entry) return null;

    const stored = entry as StoredSnapshot;
    store.put({ ...stored, usedAt: Date.now() });
    return stored;
  } catch {
    return null;
  }
}

/** Garde un arbre. Un échec (quota, mode privé) est silencieux : rien n'est dû. */
export async function writeSnapshot(entry: {
  target: string;
  tree: string;
  fingerprint: string;
  bytes: Uint8Array;
  compressed: boolean;
}): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;

  const record: StoredSnapshot = {
    key: keyOf(entry.target, entry.tree, entry.fingerprint),
    target: entry.target,
    tree: entry.tree,
    fingerprint: entry.fingerprint,
    bytes: entry.bytes,
    compressed: entry.compressed,
    size: entry.bytes.byteLength,
    storedAt: Date.now(),
    usedAt: Date.now(),
  };

  try {
    await evictIfNeeded(db, record.size);
    const transaction = db.transaction(STORE, 'readwrite');
    const result = await asPromise(transaction.objectStore(STORE).put(record));
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Fait de la place avant d'écrire : les arbres les moins récemment utilisés
 * partent d'abord. Sans cela, un socle qui évolue laisserait derrière lui tous
 * ses anciens arbres, et le navigateur finirait par refuser d'écrire — en
 * silence, donc avec un retour aux trois minutes de npm sans raison visible.
 */
async function evictIfNeeded(db: IDBDatabase, incoming: number): Promise<void> {
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  const all = (await asPromise(store.getAll())) as StoredSnapshot[] | null;
  if (!all?.length) return;

  const byAge = [...all].sort((a, b) => a.usedAt - b.usedAt);
  let total = all.reduce((sum, entry) => sum + entry.size, 0) + incoming;
  let count = all.length + 1;

  while (byAge.length && (total > MAX_TOTAL_BYTES || count > MAX_ENTRIES)) {
    const oldest = byAge.shift();
    if (!oldest) break;
    store.delete(oldest.key);
    total -= oldest.size;
    count -= 1;
  }
}

/** Oublie tout : utile quand un arbre monté s'est révélé inutilisable. */
export async function forgetSnapshot(
  target: string,
  tree: string,
  fingerprint: string
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(keyOf(target, tree, fingerprint));
  } catch {
    // Rien à faire : l'entrée sera évincée par l'âge.
  }
}

/** Ce que le cache contient, pour les journaux et la page du four. */
export async function listSnapshots(): Promise<StoredSnapshot[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const all = await asPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    return (all as StoredSnapshot[]) ?? [];
  } catch {
    return [];
  }
}

const canStream = () =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

const collect = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    size += value.length;
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

/** Compresse pour le stockage. Sans `CompressionStream`, on garde le brut. */
export async function compress(bytes: Uint8Array): Promise<{ bytes: Uint8Array; compressed: boolean }> {
  if (!canStream()) return { bytes, compressed: false };
  try {
    const source = new Blob([bytes as unknown as BlobPart]).stream();
    const out = await collect(source.pipeThrough(new CompressionStream('gzip')));
    return { bytes: out, compressed: true };
  } catch {
    return { bytes, compressed: false };
  }
}

/** Décompresse ce qui sort du cache. */
export async function decompress(entry: StoredSnapshot): Promise<Uint8Array | null> {
  if (!entry.compressed) return entry.bytes;
  if (!canStream()) return null;
  try {
    const source = new Blob([entry.bytes as unknown as BlobPart]).stream();
    return await collect(source.pipeThrough(new DecompressionStream('gzip')));
  } catch {
    return null;
  }
}
