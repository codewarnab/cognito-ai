/**
 * Enhanced Chrome Tabs API types
 */

export interface EnhancedTab extends chrome.tabs.Tab {
    // Add any custom properties if needed
}

export interface TabContext {
    url?: string;
    title?: string;
    favicon?: string;
    tabId?: number;
}

export interface TabQueryOptions extends chrome.tabs.QueryInfo {
    // Add any enhanced options
}

export type TabUpdateCallback = (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
) => void;

export type TabActivateCallback = (activeInfo: chrome.tabs.TabActiveInfo) => void;

export type TabRemoveCallback = (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void;
