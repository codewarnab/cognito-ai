/**
 * Trie Data Structure for Prefix-Based Search
 * 
 * Provides O(m + k) prefix search where:
 * - m = length of search prefix
 * - k = number of matching results
 * 
 * Compared to O(n) linear filter on every keystroke.
 */

/**
 * Node in the Trie structure
 */
interface TrieNode<T> {
    children: Map<string, TrieNode<T>>;
    /** Items that match at this node (end of a searchable key) */
    items: Set<T>;
    /** Flag indicating this node is an end of a valid key */
    isEndOfWord: boolean;
}

/**
 * Trie data structure for efficient prefix-based search
 * 
 * @typeParam T - The type of data stored at each key
 * 
 * @example
 * ```typescript
 * const trie = new Trie<WorkflowDefinition>();
 * 
 * // Insert workflows with multiple searchable keys
 * trie.insert('research', workflow1);
 * trie.insert('deep-research', workflow1);
 * 
 * // Prefix search - O(m + k)
 * const results = trie.search('res'); // Returns [workflow1]
 * ```
 */
export class Trie<T> {
    private root: TrieNode<T>;

    constructor() {
        this.root = this.createNode();
    }

    /**
     * Create a new trie node
     */
    private createNode(): TrieNode<T> {
        return {
            children: new Map(),
            items: new Set(),
            isEndOfWord: false,
        };
    }

    /**
     * Insert an item with a searchable key
     * 
     * Time complexity: O(m) where m = key length
     * 
     * @param key - The searchable key (will be lowercased)
     * @param item - The item to associate with this key
     */
    insert(key: string, item: T): void {
        const normalizedKey = key.toLowerCase().trim();
        if (!normalizedKey) return;

        let current = this.root;

        for (const char of normalizedKey) {
            if (!current.children.has(char)) {
                current.children.set(char, this.createNode());
            }
            current = current.children.get(char)!;
        }

        current.isEndOfWord = true;
        current.items.add(item);
    }

    /**
     * Insert an item with multiple searchable keys
     * Useful for indexing by name, id, description words, etc.
     * 
     * @param keys - Array of searchable keys
     * @param item - The item to associate with these keys
     */
    insertMultiple(keys: string[], item: T): void {
        for (const key of keys) {
            this.insert(key, item);
        }
    }

    /**
     * Search for all items matching a prefix
     * 
     * Time complexity: O(m + k) where:
     * - m = prefix length
     * - k = number of matching items
     * 
     * @param prefix - The search prefix (will be lowercased)
     * @returns Array of unique items matching the prefix
     */
    search(prefix: string): T[] {
        const normalizedPrefix = prefix.toLowerCase().trim();
        if (!normalizedPrefix) return [];

        // Navigate to the node representing the prefix
        let current = this.root;
        for (const char of normalizedPrefix) {
            if (!current.children.has(char)) {
                return []; // Prefix not found
            }
            current = current.children.get(char)!;
        }

        // Collect all items from this node and its descendants
        const results = new Set<T>();
        this.collectItems(current, results);

        return Array.from(results);
    }

    /**
     * Recursively collect all items from a node and its descendants
     */
    private collectItems(node: TrieNode<T>, results: Set<T>): void {
        // Add items at this node
        for (const item of node.items) {
            results.add(item);
        }

        // Recursively collect from children
        for (const child of node.children.values()) {
            this.collectItems(child, results);
        }
    }

    /**
     * Check if a prefix exists in the trie
     * 
     * Time complexity: O(m) where m = prefix length
     */
    hasPrefix(prefix: string): boolean {
        const normalizedPrefix = prefix.toLowerCase().trim();
        if (!normalizedPrefix) return false;

        let current = this.root;
        for (const char of normalizedPrefix) {
            if (!current.children.has(char)) {
                return false;
            }
            current = current.children.get(char)!;
        }

        return true;
    }

    /**
     * Check if an exact key exists in the trie
     * 
     * Time complexity: O(m) where m = key length
     */
    hasExact(key: string): boolean {
        const normalizedKey = key.toLowerCase().trim();
        if (!normalizedKey) return false;

        let current = this.root;
        for (const char of normalizedKey) {
            if (!current.children.has(char)) {
                return false;
            }
            current = current.children.get(char)!;
        }

        return current.isEndOfWord;
    }

    /**
     * Clear all entries from the trie
     */
    clear(): void {
        this.root = this.createNode();
    }

    /**
     * Get statistics about the trie
     */
    getStats(): { nodeCount: number; itemCount: number } {
        let nodeCount = 0;
        const uniqueItems = new Set<T>();

        const countNodes = (node: TrieNode<T>) => {
            nodeCount++;
            for (const item of node.items) {
                uniqueItems.add(item);
            }
            for (const child of node.children.values()) {
                countNodes(child);
            }
        };

        countNodes(this.root);

        return {
            nodeCount,
            itemCount: uniqueItems.size,
        };
    }
}

/**
 * Factory function to create a Trie and populate it with items
 * 
 * @param items - Array of items to insert
 * @param getKeys - Function to extract searchable keys from each item
 * @returns Populated Trie instance
 */
export function createTrie<T>(
    items: T[],
    getKeys: (item: T) => string[]
): Trie<T> {
    const trie = new Trie<T>();

    for (const item of items) {
        const keys = getKeys(item);
        trie.insertMultiple(keys, item);
    }

    return trie;
}
