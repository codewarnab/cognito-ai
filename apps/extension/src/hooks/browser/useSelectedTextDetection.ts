import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '~logger';

const log = createLogger('useSelectedTextDetection', 'BROWSER');

/**
 * Information about selected text on a page
 */
export interface SelectedTextInfo {
    /** The selected text content */
    text: string;
    /** The page title where text was selected */
    pageTitle: string;
    /** The page URL where text was selected */
    pageUrl: string;
}

/**
 * Return type for the useSelectedTextDetection hook
 */
export interface SelectedTextDetection {
    /** Whether there is selected text on the active tab */
    hasSelectedText: boolean;
    /** The selected text info if available */
    selectedTextInfo: SelectedTextInfo | null;
    /** Clear the current selection state */
    clearSelection: () => void;
}

/**
 * Get selected text from the active tab using chrome.scripting.executeScript
 * 
 * @param tabId - The tab ID to get selection from
 * @returns The selected text or empty string
 */
async function getSelectedTextFromTab(tabId: number): Promise<string> {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const selection = window.getSelection();
                return selection?.toString()?.trim() || '';
            }
        });

        return results[0]?.result || '';
    } catch (error) {
        // This can fail on chrome:// pages, extensions, etc.
        log.debug('Failed to get selected text from tab', error);
        return '';
    }
}

/**
 * Hook to detect when the user has selected text on any web page
 * 
 * This hook:
 * - Polls the active tab for selected text using chrome.scripting.executeScript
 * - Returns the selected text info when text is selected
 * - Clears selection state when tab changes or selection is cleared
 * - Uses debounced polling (every 500ms) to detect text selection changes
 * 
 * @returns Object containing hasSelectedText, selectedTextInfo, and clearSelection
 */
export function useSelectedTextDetection(): SelectedTextDetection {
    const [selectedTextInfo, setSelectedTextInfo] = useState<SelectedTextInfo | null>(null);

    const clearSelection = useCallback(() => {
        setSelectedTextInfo(null);

        // Also clear selection in the browser to prevent polling from picking it up again
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
            if (tab?.id) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        window.getSelection()?.removeAllRanges();
                    }
                }).catch(err => {
                    log.debug('Failed to clear browser selection', err);
                });
            }
        });
    }, []);

    useEffect(() => {
        let pollingInterval: NodeJS.Timeout | null = null;
        let lastTabId: number | null = null;

        /**
         * Check for selected text on the active tab
         */
        const checkSelectedText = async () => {
            try {
                const [tab] = await chrome.tabs.query({
                    active: true,
                    currentWindow: true
                });

                if (!tab || !tab.url || !tab.id) {
                    log.debug('No active tab or URL found');
                    return;
                }

                // Skip chrome:// and extension pages
                if (tab.url.startsWith('chrome://') ||
                    tab.url.startsWith('chrome-extension://') ||
                    tab.url.startsWith('about:')) {
                    return;
                }

                // If tab changed, clear selection
                if (lastTabId !== null && lastTabId !== tab.id) {
                    log.debug('Tab changed, clearing selection');
                    setSelectedTextInfo(null);
                }
                lastTabId = tab.id;

                // Get selected text from the page
                const selectedText = await getSelectedTextFromTab(tab.id);

                if (selectedText && selectedText.length > 0) {
                    log.info('Selected text detected', {
                        textLength: selectedText.length,
                        pageTitle: tab.title
                    });

                    setSelectedTextInfo({
                        text: selectedText,
                        pageTitle: tab.title || 'Unknown Page',
                        pageUrl: tab.url
                    });
                } else {
                    // Only clear if we had a selection before
                    setSelectedTextInfo(prev => {
                        if (prev !== null) {
                            log.debug('Selection cleared');
                        }
                        return null;
                    });
                }
            } catch (error) {
                log.error('Failed to check selected text', error);
            }
        };

        // Initial check
        checkSelectedText();

        // Poll every 500ms to detect selection changes
        pollingInterval = setInterval(checkSelectedText, 500);

        /**
         * Handler for when a tab is activated (user switches tabs)
         */
        const handleTabActivated = (_activeInfo: chrome.tabs.TabActiveInfo) => {
            log.debug('Tab activated, checking for selected text');
            checkSelectedText();
        };

        /**
         * Handler for when a tab is updated (URL changes)
         */
        const handleTabUpdated = (
            tabId: number,
            changeInfo: chrome.tabs.TabChangeInfo
        ) => {
            if (changeInfo.url) {
                chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
                    if (activeTab && activeTab.id === tabId) {
                        log.debug('Active tab URL changed, clearing selection');
                        setSelectedTextInfo(null);
                    }
                });
            }
        };

        // Register event listeners
        chrome.tabs.onActivated.addListener(handleTabActivated);
        chrome.tabs.onUpdated.addListener(handleTabUpdated);

        // Cleanup on unmount
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
            chrome.tabs.onActivated.removeListener(handleTabActivated);
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
        };
    }, []);

    return {
        hasSelectedText: selectedTextInfo !== null && selectedTextInfo.text.length > 0,
        selectedTextInfo,
        clearSelection
    };
}
