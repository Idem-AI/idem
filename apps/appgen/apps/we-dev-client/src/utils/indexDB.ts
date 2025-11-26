import { Message } from "ai/react";

interface ChatRecord {
  data: {
    messages: Message[];
    title?: string;
  };
  time: number;
  uuid: string;
}

type DBEventListener = () => void;

export class DBManager {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'WeDevDB';
  private readonly STORE_NAME = 'chatRecords';
  private listeners: Set<DBEventListener> = new Set();

  constructor() {
    // Initialize IndexedDB for web environment
    this.init().then(() => {
      console.log('DBManager initialization completed');
    }).catch((error) => {
      console.error('DBManager initialization failed', error);
      // Fallback to localStorage if IndexedDB fails
      this.initLocalStorage();
    });
  }

  // Application is now 100% web

  private initLocalStorage() {
    // Initialize localStorage
    if (!localStorage.getItem('chatRecords')) {
      localStorage.setItem('chatRecords', JSON.stringify([]));
    }
  }

  private init(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.DB_NAME, 1);

        request.onerror = (event) => {
          console.error('Failed to open database:', event);
          reject(request.error);
        };

        request.onupgradeneeded = (event) => {
          console.log('Upgrading database...');
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            const store = db.createObjectStore(this.STORE_NAME, { keyPath: ['uuid', 'time'] });
            store.createIndex('uuid', 'uuid', { unique: false });
            store.createIndex('time', 'time', { unique: false });
          }
        };

        request.onsuccess = () => {
          console.log('Database opened successfully');
          this.db = request.result;
          resolve();
        };

      } catch (error) {
        console.error('Database initialization error:', error);
        reject(error);
      }
    });
  }

  // Get all unique UUIDs
  async getAllUuids(): Promise<string[]> {
    // Utilise le localStorage si IndexedDB n'est pas disponible
    if (!this.db) {
      const records = JSON.parse(localStorage.getItem('chatRecords') || '[]') as ChatRecord[];
      const uuids = Array.from(new Set(
        records.sort((a, b) => b.time - a.time)
          .map(record => record.uuid)
      )).slice(0, 300);

      if (uuids.length === 300) {
        this.cleanOldRecords(uuids);
      }

      return uuids;
    }

    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.index('time').getAll();

      request.onsuccess = () => {
        const records = request.result as ChatRecord[];
        const uuids = Array.from(new Set(
          records.sort((a, b) => b.time - a.time)
            .map(record => record.uuid)
        )).slice(0, 300);

        if (uuids.length === 300) {
          this.cleanOldRecords(uuids);
        }

        resolve(uuids);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Insert message
  async insert(uuid: string, data: ChatRecord['data']): Promise<void> {
    const record: ChatRecord = {
      data,
      time: Date.now(),
      uuid
    };

    // Utilise le localStorage si IndexedDB n'est pas disponible
    if (!this.db) {
      const records = JSON.parse(localStorage.getItem('chatRecords') || '[]') as ChatRecord[];
      records.push(record);
      localStorage.setItem('chatRecords', JSON.stringify(records));
      this.notify();
      return;
    }

    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.add(record);

      request.onsuccess = () => {
        this.notify();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Delete all content for specified UUID
  async deleteByUuid(uuid: string): Promise<void> {
    // Utilise le localStorage si IndexedDB n'est pas disponible
    if (!this.db) {
      const records = JSON.parse(localStorage.getItem('chatRecords') || '[]') as ChatRecord[];
      const filteredRecords = records.filter(record => record.uuid !== uuid);
      localStorage.setItem('chatRecords', JSON.stringify(filteredRecords));
      this.notify();
      return;
    }

    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('uuid');
      const request = index.getAll(uuid);

      request.onsuccess = () => {
        const records = request.result as ChatRecord[];
        const deletePromises = records.map(record =>
          new Promise<void>((res, rej) => {
            const deleteReq = store.delete([record.uuid, record.time]);
            deleteReq.onsuccess = () => res();
            deleteReq.onerror = () => rej(deleteReq.error);
          })
        );

        Promise.all(deletePromises)
          .then(() => {
            this.notify();
            resolve();
          })
          .catch(reject);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Read all content for specified UUID
  async getByUuid(uuid: string): Promise<ChatRecord[]> {
    // Utilise le localStorage si IndexedDB n'est pas disponible
    if (!this.db) {
      const records = JSON.parse(localStorage.getItem('chatRecords') || '[]') as ChatRecord[];
      return records
        .filter(record => record.uuid === uuid)
        .sort((a, b) => b.time - a.time);
    }

    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('uuid');
      const request = index.getAll(uuid);

      request.onsuccess = () => {
        resolve(request.result.sort((a, b) => b.time - a.time));
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async ensureDB(): Promise<void> {
    // Utilise le localStorage si IndexedDB n'est pas disponible
    if (!this.db) {
      return Promise.resolve();
    }

    if (!this.db) {
      console.log('Database not initialized, initializing...');
      try {
        await this.init();
        console.log('Database initialization completed');
      } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
      }
    }
  }

  private cleanOldRecords(activeUuids: string[]): void {
    // Utilise le localStorage si IndexedDB n'est pas disponible
    if (!this.db) {
      const records = JSON.parse(localStorage.getItem('chatRecords') || '[]') as ChatRecord[];
      const filteredRecords = records.filter(record => activeUuids.includes(record.uuid));
      localStorage.setItem('chatRecords', JSON.stringify(filteredRecords));
      return;
    }

    if (!this.db) return;

    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);
    const request = store.index('time').getAll();

    request.onsuccess = () => {
      const records = request.result as ChatRecord[];
      records
        .filter(record => !activeUuids.includes(record.uuid))
        .forEach(record => {
          store.delete([record.uuid, record.time]);
        });
    };
  }

  subscribe(listener: DBEventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }
}

export const db = new DBManager();
