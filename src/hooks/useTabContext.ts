import { useState, useEffect } from 'react';
import { createLogger } from '../logger';
import type { TabContext } from '../types/sidepanel';

const log = createLogger('useTabContext');

/**
 * Hook to track current Chrome tab context using events
 */
export function useTabContext() {
    const [currentTab, setCurrentTab] = useState<TabContext>({});

    useEffect(() => {
        const updateTabContext = async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    setCurrentTab({ url: tab.url, title: tab.title });
                }
            } catch (error) {
                log.error("Failed to get current tab", error);
            }
        };

        // Initial load
        updateTabContext();

        // Listen for tab activation (user switches tabs)
        const handleTabActivated = () => {
            updateTabContext();
        };

        // Listen for tab updates (URL or title changes)
        const handleTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            if (changeInfo.url || changeInfo.title) {
                chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
                    if (activeTab && activeTab.id === tabId) {
                        updateTabContext();
                    }
                });
            }
        };

        chrome.tabs.onActivated.addListener(handleTabActivated);
        chrome.tabs.onUpdated.addListener(handleTabUpdated);

        return () => {
            chrome.tabs.onActivated.removeListener(handleTabActivated);
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
        };
    }, []);

    return currentTab;
}
