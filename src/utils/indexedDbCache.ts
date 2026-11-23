/**
 * Lightweight, fail-safe IndexedDB key-value cache for large application caches
 * (e.g., KPI VC forms, custom background images) so they NEVER consume
 * window.localStorage's strict 5MB quota that Firebase/Firestore shares.
 *
 * Falls back transparently to in-memory Map if IndexedDB is unavailable or quota-limited.
 */

const DB_NAME = 'ThptSonLuongSafeCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'kv_cache';

const memoryFallbackMap = new Map<string, any>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        console.warn('IndexedDB cache unavailable, using in-memory fallback.');
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

export async function idbCacheGet<T = any>(key: string): Promise<T | null> {
  if (memoryFallbackMap.has(key)) {
    return memoryFallbackMap.get(key) as T;
  }

  const db = await openCacheDb();
  if (!db) return null;

  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = req.result !== undefined ? (req.result as T) : null;
        if (val !== null) {
          memoryFallbackMap.set(key, val);
        }
        resolve(val);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbCacheSet(key: string, value: any): Promise<boolean> {
  memoryFallbackMap.set(key, value);

  const db = await openCacheDb();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbCacheRemove(key: string): Promise<void> {
  memoryFallbackMap.delete(key);

  const db = await openCacheDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
