/**
 * Chrome Omnibox Event Handlers
 * 
 * Handles:
 * - chrome.omnibox.onInputEntered
 * - chrome.omnibox.onInputChanged
 * - chrome.windows.onFocusChanged (for tracking window ID)
 */

import { createLogger } from '~logger';
import { openSidePanel, sendMessageToSidepanel } from './sidepanelUtils';

const log = createLogger('Background-Omnibox', 'BACKGROUND');

// Track the last focused window ID for omnibox sidepanel opening
// This avoids async operations that break the user gesture chain
let lastFocusedWindowId: number | undefined;

/**
 * Initialize omnibox and window tracking
 */
export function initializeOmnibox(): void {
    if (!chrome.omnibox) {
        log.warn('Omnibox API not available');
        return;
    }

    /**
     * Omnibox handler - open side panel when user types "ai" in address bar
     * Users can type "ai" in the address bar, press Tab, then enter text to send to chat
     * 
     * Note: Must call sidePanel.open() immediately without any async operations before it
     * to maintain the user gesture chain. See: https://stackoverflow.com/questions/77213045
     */
    chrome.omnibox.onInputEntered.addListener((text, disposition) => {
        // CRITICAL: Call openSidePanel immediately as the FIRST operation
        // Any code before this creates an async gap that breaks the user gesture chain
        // Use tracked window ID instead of WINDOW_ID_CURRENT (which doesn't work in service workers)
        const windowId = lastFocusedWindowId;

        if (windowId) {
            openSidePanel(windowId)
                .then((success) => {
                    if (success) {
                        log.info('Sidepanel opened via omnibox');

                        // Send the text to the sidepanel with retry logic
                        // This handles the case where sidepanel is still initializing
                        if (text && text.trim()) {
                            sendMessageToSidepanel(text.trim());
                        }
                    }
                })
                .catch((error) => {
                    log.error('Error opening sidepanel via omnibox:', error);
                });
        } else {
            // No window ID tracked yet - log error but don't break user gesture chain
            log.error('Cannot open sidepanel: no window ID tracked yet');
        }

        // Logging after the call (synchronous, doesn't affect gesture chain)
        log.info('Omnibox input entered:', { text, disposition });
    });

    /**
     * Optional: Provide suggestions as user types (can be enhanced later)
     */
    chrome.omnibox.onInputChanged.addListener((_text, suggest) => {
        // For now, just suggest opening the sidepanel
        // You can enhance this later to provide more suggestions based on text input
        suggest([
            {
                content: 'open',
                description: 'Open AI Chat sidepanel'
            }
        ]);
    });

    // Track window focus changes
    if (chrome.windows) {
        chrome.windows.onFocusChanged.addListener((windowId) => {
            if (windowId !== chrome.windows.WINDOW_ID_NONE) {
                lastFocusedWindowId = windowId;
            }
        });

        // Initialize on startup
        chrome.windows.getLastFocused().then((window) => {
            if (window?.id) {
                lastFocusedWindowId = window.id;
            }
        }).catch(() => {
            // Ignore errors during initialization
        });
    }

    log.info('Omnibox and window tracking initialized');
}

/**
 * Get the last focused window ID
 * Used by other modules that need the window ID for user gesture operations
 */
export function getLastFocusedWindowId(): number | undefined {
    return lastFocusedWindowId;
}
