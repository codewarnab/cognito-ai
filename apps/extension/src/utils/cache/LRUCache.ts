/**
 * LRU Cache - Least Recently Used Cache with O(1) Operations
 * 
 * Implements a cache with:
 * - O(1) get, set, and delete operations
 * - O(1) eviction of least recently used items
 * - Optional TTL (time-to-live) support
 * 
 * Uses a doubly-linked list + HashMap pattern:
 * - HashMap provides O(1) key lookup
 * - Doubly-linked list provides O(1) reordering and eviction
 */

import { createLogger } from '~logger';

const log = createLogger('LRUCache', 'UTILS_HELPER');

/**
 * Node in the doubly-linked list
 */
interface LRUNode<K, V> {
    key: K;
    value: V;
    timestamp: number;
    prev: LRUNode<K, V> | null;
    next: LRUNode<K, V> | null;
}

/**
 * Configuration options for LRU Cache
 */
export interface LRUCacheOptions {
    /** Maximum number of entries in the cache */
    maxSize: number;
    /** Optional TTL in milliseconds (entries expire after this time) */
    ttlMs?: number;
    /** Optional callback when an entry is evicted */
    onEvict?: (key: unknown, value: unknown) => void;
}

/**
 * LRU Cache with O(1) get, set, and eviction
 */
export class LRUCache<K, V> {
    private cache: Map<K, LRUNode<K, V>>;
    private head: LRUNode<K, V> | null = null;  // Most recently used
    private tail: LRUNode<K, V> | null = null;  // Least recently used
    private readonly maxSize: number;
    private readonly ttlMs?: number;
    private readonly onEvict?: (key: K, value: V) => void;

    constructor(options: LRUCacheOptions) {
        this.cache = new Map();
        this.maxSize = options.maxSize;
        this.ttlMs = options.ttlMs;
        this.onEvict = options.onEvict as ((key: K, value: V) => void) | undefined;
    }

    /**
     * Get a value from the cache
     * Moves the accessed item to the front (most recently used)
     * Returns undefined if key not found or expired
     * 
     * Time complexity: O(1)
     */
    get(key: K): V | undefined {
        const node = this.cache.get(key);

        if (!node) {
            return undefined;
        }

        // Check TTL expiration
        if (this.ttlMs && Date.now() - node.timestamp > this.ttlMs) {
            this.delete(key);
            return undefined;
        }

        // Move to front (most recently used)
        this.moveToFront(node);

        return node.value;
    }

    /**
     * Set a value in the cache
     * If key exists, updates value and moves to front
     * If cache is full, evicts least recently used item
     * 
     * Time complexity: O(1)
     */
    set(key: K, value: V): void {
        const existingNode = this.cache.get(key);

        if (existingNode) {
            // Update existing node
            existingNode.value = value;
            existingNode.timestamp = Date.now();
            this.moveToFront(existingNode);
            return;
        }

        // Evict if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        // Create new node
        const newNode: LRUNode<K, V> = {
            key,
            value,
            timestamp: Date.now(),
            prev: null,
            next: this.head,
        };

        // Add to front of list
        if (this.head) {
            this.head.prev = newNode;
        }
        this.head = newNode;

        if (!this.tail) {
            this.tail = newNode;
        }

        this.cache.set(key, newNode);
    }

    /**
     * Check if a key exists in the cache (without moving to front)
     * 
     * Time complexity: O(1)
     */
    has(key: K): boolean {
        const node = this.cache.get(key);
        if (!node) return false;

        // Check TTL expiration
        if (this.ttlMs && Date.now() - node.timestamp > this.ttlMs) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete a key from the cache
     * 
     * Time complexity: O(1)
     */
    delete(key: K): boolean {
        const node = this.cache.get(key);

        if (!node) {
            return false;
        }

        this.removeNode(node);
        this.cache.delete(key);

        return true;
    }

    /**
     * Clear all entries from the cache
     * 
     * Time complexity: O(n)
     */
    clear(): void {
        this.cache.clear();
        this.head = null;
        this.tail = null;
    }

    /**
     * Get the current size of the cache
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Get all keys in the cache (ordered from MRU to LRU)
     */
    keys(): K[] {
        const keys: K[] = [];
        let current = this.head;
        while (current) {
            keys.push(current.key);
            current = current.next;
        }
        return keys;
    }

    /**
     * Get all values in the cache (ordered from MRU to LRU)
     */
    values(): V[] {
        const values: V[] = [];
        let current = this.head;
        while (current) {
            values.push(current.value);
            current = current.next;
        }
        return values;
    }

    /**
     * Clean up expired entries (for caches with TTL)
     * Call periodically if using TTL
     * 
     * Time complexity: O(n)
     */
    cleanupExpired(): number {
        if (!this.ttlMs) return 0;

        const now = Date.now();
        let removed = 0;

        // Start from tail (LRU) since older items are more likely expired
        let current = this.tail;
        while (current) {
            const prev = current.prev;
            if (now - current.timestamp > this.ttlMs) {
                this.cache.delete(current.key);
                this.removeNode(current);
                removed++;
            }
            current = prev;
        }

        if (removed > 0) {
            log.debug(`Cleaned up ${removed} expired entries`);
        }

        return removed;
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; maxSize: number; ttlMs?: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttlMs: this.ttlMs,
        };
    }

    // ============================================
    // Private helper methods
    // ============================================

    /**
     * Move a node to the front of the list (most recently used)
     */
    private moveToFront(node: LRUNode<K, V>): void {
        if (node === this.head) {
            return; // Already at front
        }

        // Remove from current position
        this.removeNode(node);

        // Add to front
        node.prev = null;
        node.next = this.head;

        if (this.head) {
            this.head.prev = node;
        }

        this.head = node;

        if (!this.tail) {
            this.tail = node;
        }
    }

    /**
     * Remove a node from the doubly-linked list
     */
    private removeNode(node: LRUNode<K, V>): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }

        node.prev = null;
        node.next = null;
    }

    /**
     * Evict the least recently used item (tail)
     */
    private evictLRU(): void {
        if (!this.tail) {
            return;
        }

        const evictedNode = this.tail;

        log.debug(`Evicting LRU entry: ${String(evictedNode.key)}`);

        // Call eviction callback if provided
        if (this.onEvict) {
            this.onEvict(evictedNode.key, evictedNode.value);
        }

        this.cache.delete(evictedNode.key);
        this.removeNode(evictedNode);
    }
}

/**
 * Factory function to create a cache with common presets
 */
export function createLRUCache<K, V>(
    maxSize: number,
    ttlMs?: number
): LRUCache<K, V> {
    return new LRUCache<K, V>({ maxSize, ttlMs });
}
