/**
 * Tab snapshot utilities for capturing tab content
 * Used by tab mention feature to provide context to AI
 */

import type { TabMention } from '@/utils/chat/mentionUtils';
import { createLogger } from '~logger';

const log = createLogger('TabSnapshot', 'UTILS');

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
        log.error('Error fetching tabs:', error);
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
            log.warn('Tab not found', { tabId });
            return {
                url: null,
                title: null,
                snapshot: null,
                screenshot: null,
                error: 'Tab no longer available'
            };
        }

        // Check if tab is accessible (not chrome:// or other restricted URLs)
        const tabUrl = tab.url ?? null;
        const restrictedSchemes = [
            'chrome://',
            'chrome-extension://',
            'about://',
            'edge://',
            'devtools:',
            'file://',
            'data://',
            'blob://',
            'filesystem://',
            'chrome-search://',
            'chrome-untrusted://'
        ];

        const isRestricted = tabUrl && restrictedSchemes.some(scheme => tabUrl.startsWith(scheme));

        if (isRestricted) {
            const scheme = tabUrl!.split(':')[0];
            log.warn('Cannot access restricted tab', { tabId, url: tabUrl, scheme });
            return {
                url: tabUrl,
                title: tab.title ?? null,
                snapshot: null,
                screenshot: null,
                error: `Cannot access ${scheme}:// pages due to browser security restrictions`
            };
        }

        // Step 1: Try to capture screenshot first
        let screenshot: string | null = null;
        try {
            if (tab.windowId && tab.active) {
                // Only capture if tab is active in its window
                screenshot = await chrome.tabs.captureVisibleTab(
                    tab.windowId,
                    { format: 'png' }
                );
                log.info('Screenshot captured for tab', { tabId, url: tabUrl });
            } else {
                log.warn('Tab not active, skipping screenshot', { tabId, active: tab.active });
            }
        } catch (screenshotError) {
            const errorMsg = screenshotError instanceof Error
                ? screenshotError.message
                : String(screenshotError);
            log.warn('Failed to capture screenshot for tab', {
                tabId,
                error: errorMsg,
                url: tabUrl
            });
            // Don't fail the whole operation, just log it
        }

        // Step 2: Execute script to get page content
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    try {
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
                    } catch (extractError) {
                        return {
                            html: null,
                            url: window.location.href,
                            title: document.title,
                            error: extractError instanceof Error ? extractError.message : 'Content extraction failed'
                        };
                    }
                }
            });

            if (results && results.length > 0 && results[0] && results[0].result) {
                const data = results[0].result;

                // Check if script execution had an error
                if (data.error) {
                    log.warn('Content extraction had errors', { tabId, error: data.error });
                }

                return {
                    url: data.url ?? tabUrl,
                    title: data.title ?? tab.title ?? null,
                    snapshot: data.html ?? null,
                    screenshot,
                    error: data.error || null
                };
            }

            // Script executed but returned no results
            log.warn('Script execution returned no results', { tabId });
            return {
                url: tabUrl,
                title: tab.title ?? null,
                snapshot: null,
                screenshot,
                error: 'Failed to extract page content'
            };

        } catch (scriptError: unknown) {
            const errorMessage = scriptError instanceof Error
                ? scriptError.message
                : 'Permission denied';

            log.warn('Script execution failed', {
                tabId,
                error: errorMessage,
                url: tabUrl
            });

            // Provide context-specific error messages
            let userMessage = `Cannot access page: ${errorMessage}`;

            if (errorMessage.includes('Cannot access')) {
                userMessage = 'Cannot access page content - permission denied by browser';
            } else if (errorMessage.includes('frame')) {
                userMessage = 'Cannot access iframe content - cross-origin restriction';
            } else if (errorMessage.includes('document')) {
                userMessage = 'Page not ready or document unavailable';
            }

            return {
                url: tabUrl,
                title: tab.title ?? null,
                snapshot: null,
                screenshot, // Include screenshot even if text extraction failed
                error: userMessage
            };
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Tab snapshot failed completely', { tabId, error: errorMessage });

        return {
            url: null,
            title: null,
            snapshot: null,
            screenshot: null,
            error: `Failed to capture tab snapshot: ${errorMessage}`
        };
    }
}

/**
 * Process all mentioned tabs and create context string
 */
export async function processMentionedTabs(tabMentions: TabMention[]): Promise<string> {
    if (tabMentions.length === 0) {
        return '';
    }

    log.info('Processing mentioned tabs', { count: tabMentions.length });

    const snapshots = await Promise.all(
        tabMentions.map(async (mention) => {
            const tabId = parseInt(mention.id, 10);

            if (isNaN(tabId)) {
                log.error('Invalid tab ID in mention', { mention });
                return `- @${mention.display}: ❌ Invalid tab ID - expected numeric value`;
            }

            const result = await captureTabSnapshot(tabId);

            // Handle errors
            if (result.error) {
                log.warn('Tab snapshot had errors', {
                    tabId,
                    display: mention.display,
                    error: result.error
                });

                // If we have a screenshot but no text content, that's still useful
                if (result.screenshot) {
                    return `- @${mention.display} (${result.url || 'Unknown URL'}):
  ⚠️ ${result.error}
  📸 Screenshot available for visual analysis
  Title: ${result.title || 'Unknown'}`;
                }

                // No content at all
                return `- @${mention.display}: ❌ ${result.error}`;
            }

            // Build content string
            const parts: string[] = [];

            // Header
            parts.push(`- @${mention.display} (${result.url || 'Unknown URL'}):`);

            // Add title if available
            if (result.title) {
                parts.push(`  Title: ${result.title}`);
            }

            // Add text snapshot if available
            if (result.snapshot) {
                const truncatedSnapshot = result.snapshot.length > 5000
                    ? result.snapshot.substring(0, 5000) + '\n... (truncated)'
                    : result.snapshot;
                parts.push(`  Content:\n\`\`\`\n${truncatedSnapshot}\n\`\`\``);
            } else {
                parts.push('  Content: (unable to extract text)');
            }

            // Add screenshot indicator
            if (result.screenshot) {
                parts.push('  📸 Screenshot: Available for visual analysis');
            }

            return parts.join('\n');
        })
    );

    const result = snapshots.join('\n\n');
    log.info('Tab mentions processed', {
        totalMentions: tabMentions.length,
        resultLength: result.length
    });

    return result;
}

