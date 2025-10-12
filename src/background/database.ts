/**
 * IndexedDB configuration and initialization
 */

export const DB_NAME = 'chromeAi';
export const DB_VERSION = 1;
export const QUEUE_STORE = 'bgQueue';
export const SETTINGS_STORE = 'settings';

let db: IDBDatabase | null = null;

/**
 * Open and initialize IndexedDB
 */
export async function openDb(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Create bgQueue store
            if (!database.objectStoreNames.contains(QUEUE_STORE)) {
                const queueStore = database.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
                queueStore.createIndex('by_nextAttemptAt', 'nextAttemptAt', { unique: false });
                queueStore.createIndex('by_url', 'url', { unique: false });
            }

            // Create settings store
            if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
        };
    });
}

/**
 * Get current database instance
 */
export function getDb(): IDBDatabase | null {
    return db;
}
