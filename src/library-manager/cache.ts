import { ModuleRegistry } from '../core/types';

const IDB_DATABASE = 'browser_tsx_sandbox_cache';
const IDB_STORE = 'modules_store';

// Singleton-хранилище в памяти для кэширования библиотек
export class ModuleCache {
  private registry: ModuleRegistry = {};

  constructor(initialModules: ModuleRegistry = {}) {
    this.registry = { ...initialModules };
  }

  public register(name: string, module: any) {
    this.registry[name] = module;
  }

  public get(name: string): any | undefined {
    return this.registry[name];
  }

  public getAll(): ModuleRegistry {
    return { ...this.registry };
  }

  public has(name: string): boolean {
    return this.registry[name] !== undefined;
  }

  public clear(): void {
    this.registry = {};
  }

  private getIndexedDb(): IDBFactory | null {
    const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    return idb ?? null;
  }

  /** Читает сохранённый бандл из IndexedDB (если доступен). */
  public async loadFromIndexedDb(key: string): Promise<string | null> {
    const idb = this.getIndexedDb();
    if (!idb) return null;

    return new Promise((resolve) => {
      try {
        const request = idb.open(IDB_DATABASE, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(IDB_STORE)) {
            request.result.createObjectStore(IDB_STORE);
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getRequest = tx.objectStore(IDB_STORE).get(key);
          getRequest.onsuccess = () => resolve((getRequest.result as string) ?? null);
          getRequest.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /** Сохраняет бандл в IndexedDB (если доступен). */
  public async saveToIndexedDb(key: string, value: string): Promise<void> {
    const idb = this.getIndexedDb();
    if (!idb) return;

    return new Promise((resolve) => {
      try {
        const request = idb.open(IDB_DATABASE, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(IDB_STORE)) {
            request.result.createObjectStore(IDB_STORE);
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
