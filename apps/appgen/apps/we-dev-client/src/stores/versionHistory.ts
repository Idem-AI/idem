import { create } from 'zustand';

/**
 * Historique de versions du projet généré.
 *
 * Une génération est un aller-retour : on demande, le modèle réécrit, et
 * parfois la version d'avant était la bonne. Sans point de retour, le seul
 * recours est de redemander l'inverse en espérant retomber dessus.
 *
 * Les instantanés vivent dans IndexedDB : une carte de fichiers complète pèse
 * facilement plusieurs mégaoctets, ce qui dépasse `localStorage` dès le
 * troisième point de restauration.
 */

export interface Snapshot {
  id: string;
  /** Étiquette lisible : la demande qui a produit cette version. */
  label: string;
  createdAt: number;
  files: Record<string, string>;
}

/** Ce qui a changé entre deux instantanés, sans stocker de diff. */
export interface SnapshotDelta {
  added: string[];
  changed: string[];
  removed: string[];
}

const DB_NAME = 'iCodeVersions';
const STORE = 'snapshots';
const MAX_SNAPSHOTS = 30;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export function diffSnapshots(
  previous: Record<string, string> | undefined,
  next: Record<string, string>
): SnapshotDelta {
  const before = previous ?? {};
  const added: string[] = [];
  const changed: string[] = [];

  for (const [path, content] of Object.entries(next)) {
    if (!(path in before)) added.push(path);
    else if (before[path] !== content) changed.push(path);
  }

  const removed = Object.keys(before).filter((path) => !(path in next));

  return { added, changed, removed };
}

interface VersionHistoryState {
  snapshots: Snapshot[];
  loading: boolean;
  load: () => Promise<void>;
  capture: (label: string, files: Record<string, string>) => Promise<Snapshot | null>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

const useVersionHistory = create<VersionHistoryState>((set, get) => ({
  snapshots: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const all = await withStore<Snapshot[]>('readonly', (store) => store.getAll());
      set({
        snapshots: all.sort((a, b) => b.createdAt - a.createdAt),
        loading: false,
      });
    } catch (error) {
      console.warn('[versions] lecture impossible', error);
      set({ loading: false });
    }
  },

  capture: async (label, files) => {
    const paths = Object.keys(files);
    if (!paths.length) return null;

    // Deux générations de suite peuvent laisser les fichiers identiques (une
    // question qui ne touche pas au code, par exemple) : inutile d'empiler un
    // point de restauration qui ne restaure rien.
    const latest = get().snapshots[0];
    if (latest) {
      const delta = diffSnapshots(latest.files, files);
      if (!delta.added.length && !delta.changed.length && !delta.removed.length) {
        return null;
      }
    }

    const snapshot: Snapshot = {
      id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: label.slice(0, 120),
      createdAt: Date.now(),
      files,
    };

    try {
      await withStore('readwrite', (store) => store.put(snapshot));
      const next = [snapshot, ...get().snapshots];

      // Purge des plus anciens : l'historique est un filet de sécurité récent,
      // pas une archive.
      const surplus = next.slice(MAX_SNAPSHOTS);
      for (const old of surplus) {
        await withStore('readwrite', (store) => store.delete(old.id));
      }

      set({ snapshots: next.slice(0, MAX_SNAPSHOTS) });
      return snapshot;
    } catch (error) {
      console.warn('[versions] écriture impossible', error);
      return null;
    }
  },

  remove: async (id) => {
    try {
      await withStore('readwrite', (store) => store.delete(id));
      set({ snapshots: get().snapshots.filter((snapshot) => snapshot.id !== id) });
    } catch (error) {
      console.warn('[versions] suppression impossible', error);
    }
  },

  clear: async () => {
    try {
      await withStore('readwrite', (store) => store.clear());
      set({ snapshots: [] });
    } catch (error) {
      console.warn('[versions] purge impossible', error);
    }
  },
}));

export default useVersionHistory;
