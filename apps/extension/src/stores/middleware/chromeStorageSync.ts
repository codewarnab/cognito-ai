/**
 * Chrome Storage Sync Middleware for Zustand
 * 
 * Syncs Zustand state with chrome.storage:
 * - Loads initial state from storage on store creation
 * - Writes state changes to storage (debounced)
 * - Listens for storage changes from other contexts (background, popup, etc.)
 */
import type { StateCreator } from 'zustand';

export type ChromeStorageSyncOptions<T> = {
  /** Key used in chrome.storage */
  storageKey: string;
  /** Storage area: 'local' or 'sync' */
  storageArea?: 'local' | 'sync';
  /** Fields to persist. If undefined, persists entire state minus functions */
  persistFields?: (keyof T)[];
  /** Debounce writes to storage (ms) */
  debounceMs?: number;
  /** Called after hydration from storage */
  onHydrate?: (state: Partial<T>) => void;
};

/**
 * Middleware that syncs Zustand state with chrome.storage
 */
export const chromeStorageSync = <T extends object>(
  options: ChromeStorageSyncOptions<T>
) => {
  const {
    storageKey,
    storageArea = 'local',
    persistFields,
    debounceMs = 100,
    onHydrate,
  } = options;

  return (f: StateCreator<T, [], []>): StateCreator<T, [], []> =>
    (set, get, store) => {
      const storage = storageArea === 'sync' ? chrome.storage.sync : chrome.storage.local;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let isHydrating = false;

      // Extract persistable state (exclude functions)
      const getPersistableState = (state: T): Partial<T> => {
        const result: Partial<T> = {};
        const keys = persistFields || (Object.keys(state) as (keyof T)[]);
        
        for (const key of keys) {
          const value = state[key];
          if (typeof value !== 'function') {
            result[key] = value;
          }
        }
        return result;
      };

      // Save state to storage (debounced)
      const saveToStorage = (state: T) => {
        if (isHydrating) return;
        
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
          const persistable = getPersistableState(state);
          storage.set({ [storageKey]: persistable }).catch((err) => {
            console.error(`[chromeStorageSync] Failed to save ${storageKey}:`, err);
          });
        }, debounceMs);
      };

      // Wrapped set that also saves to storage
      const syncedSet: typeof set = (partial, replace) => {
        if (replace) {
          set(partial as T, true);
        } else {
          set(partial);
        }
        saveToStorage(get());
      };

      // Create the store with synced set
      const initialState = f(syncedSet, get, store);

      // Hydrate from storage on creation
      storage.get(storageKey).then((result) => {
        const stored = result[storageKey];
        if (stored && typeof stored === 'object') {
          isHydrating = true;
          set((state) => ({ ...state, ...stored }));
          isHydrating = false;
          onHydrate?.(stored);
        }
      }).catch((err) => {
        console.error(`[chromeStorageSync] Failed to load ${storageKey}:`, err);
      });

      // Listen for storage changes from other contexts
      const handleStorageChange = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        if (areaName !== storageArea) return;
        if (!changes[storageKey]) return;

        const newValue = changes[storageKey].newValue;
        if (newValue && typeof newValue === 'object') {
          isHydrating = true;
          set((state) => ({ ...state, ...newValue }));
          isHydrating = false;
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);

      return initialState;
    };
};
