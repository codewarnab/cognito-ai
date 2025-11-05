/**
 * Enhanced Chrome Storage API types
 */

export type StorageArea = 'local' | 'sync' | 'session' | 'managed';

export interface StorageChange<T = any> {
    oldValue?: T;
    newValue?: T;
}

export type StorageChanges<T extends Record<string, any>> = {
    [K in keyof T]?: StorageChange<T[K]>;
};

export type StorageChangeCallback<T extends Record<string, any>> = (
    changes: StorageChanges<T>,
    areaName: StorageArea
) => void;

// Type-safe storage operations
export interface TypedStorage<T extends Record<string, any>> {
    get<K extends keyof T>(keys: K | K[]): Promise<Pick<T, K>>;
    set<K extends keyof T>(items: Pick<T, K>): Promise<void>;
    remove<K extends keyof T>(keys: K | K[]): Promise<void>;
    clear(): Promise<void>;
}
