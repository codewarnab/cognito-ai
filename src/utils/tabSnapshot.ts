/**
 * Tab snapshot utilities for capturing tab content
 * Used by tab mention feature to provide context to AI
 */

import type { TabMention } from './mentionUtils';

export interface TabSnapshotResult {
    url: string | null;
    title: string | null;
    snapshot: string | null;
    screenshot?: string | null;
    error: string | null;
}

/**
 * Get all available tabs from Chrome API
 */
export async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
    try {
        const tabs = await chrome.tabs.query({});
        return tabs;
    } catch (error) {
        console.error('Error fetching tabs:', error);
        return [];
    }
}

/**
 * Capture snapshot of a single tab
 */
export async function captureTabSnapshot(tabId: number): Promise<TabSnapshotResult> {
    try {
        // Validate tab exists
        const tab = await chrome.tabs.get(tabId).catch(() => null);

        if (!tab) {
            return {
                url: null,
                title: null,
                snapshot: null,
                error: 'Tab no longer available'
            };
        }

        // Check if tab is accessible (not chrome:// or other restricted URLs)
        const restrictedSchemes = ['chrome://', 'chrome-extension://', 'about://', 'file://', 'data://', 'blob://', 'filesystem://'];
        if (restrictedSchemes.some(scheme => tab.url?.startsWith(scheme))) {
            return {
                url: tab.url || null,
                title: tab.title || null,
                snapshot: null,
                error: 'Cannot access system pages'
            };
        }
        // Execute script to get page content
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    // Get clean HTML without scripts
                    const clone = document.documentElement.cloneNode(true) as HTMLElement;

                    // Remove scripts, styles, and other non-content elements
                    const scripts = clone.querySelectorAll('script, style, noscript');
                    scripts.forEach(el => el.remove());

                    // Get main content
                    const body = clone.querySelector('body');
                    const text = body ? body.innerText : clone.innerText;

                    return {
                        html: text.substring(0, 50000), // Limit to prevent huge contexts
                        url: window.location.href,
                        title: document.title
                    };
                }
            });

            if (results && results[0]?.result) {
                const data = results[0].result;
                return {
                    url: data.url,
                    title: data.title,
                    snapshot: data.html,
                    error: null
                };
            }

            return {
                url: tab.url || null,
                title: tab.title || null,
                snapshot: null,
                error: 'Failed to capture content'
            };
        } catch (scriptError: unknown) {
            const errorMessage = scriptError instanceof Error
                ? scriptError.message
                : 'Permission denied';
            return {
                url: tab.url || null,
                title: tab.title || null,
                snapshot: null,
                error: `Cannot access page: ${errorMessage}`
            };
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            url: null,
            title: null,
            snapshot: null,
            error: errorMessage
        };
    }
}

/**
 * Process all mentioned tabs and create context string
 */
export async function processMentionedTabs(tabMentions: TabMention[]): Promise<string> {
    const snapshots = await Promise.all(
        tabMentions.map(async (mention) => {
            const tabId = parseInt(mention.id, 10);

            if (isNaN(tabId)) {
                return `- @${mention.display}: Invalid tab ID`;
            }

            const result = await captureTabSnapshot(tabId);

            if (result.error) {
                return `- @${mention.display}: ${result.error}`;
            }

            let content = `- @${mention.display} (${result.url}):\n\`\`\`\n${result.snapshot}\n\`\`\``;

            if (result.screenshot) {
                content += '\n\n[Screenshot available for this tab]';
            }

            return content;
        })
    );

    return snapshots.join('\n\n');
}
