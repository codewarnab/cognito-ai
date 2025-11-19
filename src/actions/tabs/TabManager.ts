/**
 * TabManager - Event-driven tab caching with real-time synchronization
 * 
 * Maintains an in-memory cache of all tabs with O(1) lookups.
 * Automatically syncs with Chrome's tab state using event listeners.
 */

import { createLogger } from '@logger';

const log = createLogger('TabManager');

export interface TabGroup {
    domain: string;
    tabs: chrome.tabs.Tab[];
    size: number;
}

class TabManager {
    private tabCache: Map<number, chrome.tabs.Tab>;
    private urlIndex: Map<string, Set<number>>; // domain -> tabIds
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.tabCache = new Map();
        this.urlIndex = new Map();
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for real-time cache synchronization
     * This ensures the cache is always in sync with Chrome's tab state
     */
    private setupEventListeners(): void {
        // Tab created
        chrome.tabs.onCreated.addListener((tab) => {
            log.debug('Tab created', { tabId: tab.id, url: tab.url });
            this.addTabToCache(tab);
        });

        // Tab updated (URL, title, status, etc.)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            log.debug('Tab updated', { tabId, changeInfo });

            // If URL changed, update domain index
            if (changeInfo.url) {
                const oldTab = this.tabCache.get(tabId);
                if (oldTab?.url) {
                    this.removeFromUrlIndex(oldTab);
                }
            }
            this.addTabToCache(tab);
        });

        // Tab removed
        chrome.tabs.onRemoved.addListener((tabId) => {
            log.debug('Tab removed', { tabId });
            const tab = this.tabCache.get(tabId);
            if (tab) {
                this.removeFromUrlIndex(tab);
                this.tabCache.delete(tabId);
            }
        });

        // Tab moved within window
        chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
            log.debug('Tab moved', { tabId, moveInfo });
            chrome.tabs.get(tabId).then(tab => {
                if (tab) {
                    this.addTabToCache(tab);
                }
            }).catch(err => {
                log.error('Error refreshing moved tab', err);
            });
        });

        // Tab attached to new window
        chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
            log.debug('Tab attached', { tabId, attachInfo });
            chrome.tabs.get(tabId).then(tab => {
                if (tab) {
                    this.addTabToCache(tab);
                }
            }).catch(err => {
                log.error('Error refreshing attached tab', err);
            });
        });

        // Tab replaced (e.g., prerendering)
        chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
            log.debug('Tab replaced', { addedTabId, removedTabId });
            this.tabCache.delete(removedTabId);
            chrome.tabs.get(addedTabId).then(tab => {
                if (tab) {
                    this.addTabToCache(tab);
                }
            }).catch(err => {
                log.error('Error refreshing replaced tab', err);
            });
        });

        log.info('✅ Tab event listeners registered');
    }

    /**
     * Add or update a tab in the cache
     * O(1) operation with automatic domain indexing
     */
    private addTabToCache(tab: chrome.tabs.Tab): void {
        if (!tab.id) return;

        this.tabCache.set(tab.id, tab);

        // Update URL index for domain-based lookups
        if (tab.url) {
            try {
                const domain = new URL(tab.url).hostname;
                if (!this.urlIndex.has(domain)) {
                    this.urlIndex.set(domain, new Set());
                }
                this.urlIndex.get(domain)!.add(tab.id);
            } catch (e) {
                // Invalid URL, skip indexing
                log.debug('Invalid URL, skipping index', { url: tab.url });
            }
        }
    }

    /**
     * Remove a tab from the domain index
     */
    private removeFromUrlIndex(tab: chrome.tabs.Tab): void {
        if (!tab.url || !tab.id) return;

        try {
            const domain = new URL(tab.url).hostname;
            const tabIds = this.urlIndex.get(domain);
            if (tabIds) {
                tabIds.delete(tab.id);
                if (tabIds.size === 0) {
                    this.urlIndex.delete(domain);
                }
            }
        } catch (e) {
            // Invalid URL
            log.debug('Invalid URL, skipping removal', { url: tab.url });
        }
    }

    /**
     * Initialize cache with all current tabs
     * Only runs once, subsequent calls return immediately
     */
    private async initializeCache(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        // Prevent duplicate initialization
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            log.info('Initializing tab cache...');
            const tabs = await chrome.tabs.query({});

            if (!tabs || tabs.length === 0) {
                log.warn('No tabs found during initialization');
                this.isInitialized = true;
                return;
            }

            for (const tab of tabs) {
                this.addTabToCache(tab);
            }

            this.isInitialized = true;
            log.info(`✅ Tab cache initialized with ${tabs.length} tabs`);
        })();

        return this.initPromise;
    }

    /**
     * Get a tab by ID with O(1) lookup
     */
    async getTabById(tabId: number): Promise<chrome.tabs.Tab | null> {
        await this.initializeCache();
        return this.tabCache.get(tabId) || null;
    }

    /**
     * Get all tabs with O(n) where n = total tabs
     * Much faster than chrome.tabs.query({}) after initialization
     */
    async getAllTabs(): Promise<chrome.tabs.Tab[]> {
        await this.initializeCache();
        return Array.from(this.tabCache.values());
    }

    /**
     * Get tabs by domain with O(1) lookup + O(k) where k = tabs in domain
     */
    async getTabsByDomain(domain: string): Promise<chrome.tabs.Tab[]> {
        await this.initializeCache();

        const tabIds = this.urlIndex.get(domain);
        if (!tabIds) return [];

        return Array.from(tabIds)
            .map(id => this.tabCache.get(id))
            .filter((tab): tab is chrome.tabs.Tab => tab !== undefined);
    }

    /**
     * Organize tabs by domain/context
     * O(n) where n = total tabs (already in memory)
     */
    async organizeTabsByContext(maxGroups: number): Promise<TabGroup[]> {
        await this.initializeCache();

        const tabs = Array.from(this.tabCache.values());

        // Group by domain (O(n))
        const domainGroups = new Map<string, chrome.tabs.Tab[]>();
        for (const tab of tabs) {
            if (!tab.url) continue;
            try {
                const domain = new URL(tab.url).hostname;
                if (!domainGroups.has(domain)) {
                    domainGroups.set(domain, []);
                }
                domainGroups.get(domain)!.push(tab);
            } catch (e) {
                // Skip invalid URLs
            }
        }

        // Get top N groups by size using partial sort
        // O(n log k) where k = maxGroups
        const groups = Array.from(domainGroups.entries())
            .map(([domain, tabs]) => ({ domain, tabs, size: tabs.length }))
            .sort((a, b) => b.size - a.size)
            .slice(0, maxGroups);

        log.info(`Organized ${tabs.length} tabs into ${groups.length} groups`);
        return groups;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            totalTabs: this.tabCache.size,
            totalDomains: this.urlIndex.size,
            isInitialized: this.isInitialized,
        };
    }

    /**
     * Force refresh the entire cache (rarely needed)
     */
    async forceRefresh(): Promise<void> {
        log.info('Force refreshing tab cache...');
        this.tabCache.clear();
        this.urlIndex.clear();
        this.isInitialized = false;
        this.initPromise = null;
        await this.initializeCache();
    }
}

// Export singleton instance
export const tabManager = new TabManager();

