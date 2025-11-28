/**
 * Asker Context Menu
 * Registers and handles the "Ask AI" context menu item
 * that appears when user right-clicks on selected text
 */

import { createLogger } from '~logger';

const log = createLogger('AskerContextMenu', 'BACKGROUND');

const ASKER_MENU_ID = 'cognito-ask-selection';

/**
 * Create the asker context menu item
 * Should be called once when extension is installed/updated
 */
export function createAskerContextMenu(): void {
    // Remove existing menu item if any (to avoid duplicates on reload)
    chrome.contextMenus.remove(ASKER_MENU_ID, () => {
        // Ignore error if menu doesn't exist
        if (chrome.runtime.lastError) {
            // Expected when menu doesn't exist yet
        }

        // Create the context menu item
        chrome.contextMenus.create(
            {
                id: ASKER_MENU_ID,
                title: 'Ask Cognito AI about "%s"',
                contexts: ['selection'], // Only show when text is selected
            },
            () => {
                if (chrome.runtime.lastError) {
                    log.error('Failed to create asker context menu', {
                        error: chrome.runtime.lastError.message,
                    });
                } else {
                    log.info('Asker context menu created');
                }
            }
        );
    });
}

/**
 * Initialize context menu click handler
 * Sends message to content script when menu item is clicked
 */
export function initializeAskerContextMenuListener(): void {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId !== ASKER_MENU_ID) {
            return;
        }

        log.info('Ask context menu clicked', {
            selectionText: info.selectionText?.substring(0, 50),
            tabId: tab?.id,
        });

        if (!info.selectionText || !tab?.id) {
            log.warn('No selection text or tab ID available');
            return;
        }

        try {
            // Send message to the content script to show the asker UI
            await chrome.tabs.sendMessage(tab.id, {
                action: 'SHOW_ASKER',
                payload: {
                    selectedText: info.selectionText,
                },
            });

            log.debug('Sent SHOW_ASKER message to content script');
        } catch (error) {
            log.error('Failed to send message to content script', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });

    log.info('Asker context menu listener initialized');
}

/**
 * Initialize context menu on extension install/update
 */
export function initializeAskerContextMenu(): void {
    // Create menu on install
    chrome.runtime.onInstalled.addListener(() => {
        createAskerContextMenu();
    });

    // Also create on startup (in case it wasn't persisted)
    chrome.runtime.onStartup?.addListener(() => {
        createAskerContextMenu();
    });

    // Initialize click handler
    initializeAskerContextMenuListener();

    // Create menu immediately if already installed
    // This handles the case where service worker restarts
    createAskerContextMenu();

    log.info('Asker context menu initialization complete');
}
