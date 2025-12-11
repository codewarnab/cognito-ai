/**
 * Rewriter Context Menu
 * Registers and handles the "Rewrite with AI" context menu item
 * that appears when user right-clicks on selected text
 */

import { createLogger } from '~logger';

const log = createLogger('RewriterContextMenu', 'BACKGROUND');

const REWRITER_MENU_ID = 'cognito-rewrite-selection';

/**
 * Initialize the rewriter context menu
 * Should be called once when extension is installed/updated
 */
export function createRewriterContextMenu(): void {
    // Remove existing menu item if any (to avoid duplicates on reload)
    chrome.contextMenus.remove(REWRITER_MENU_ID, () => {
        // Ignore error if menu doesn't exist
        if (chrome.runtime.lastError) {
            // Expected when menu doesn't exist yet
        }

        // Create the context menu item
        chrome.contextMenus.create(
            {
                id: REWRITER_MENU_ID,
                title: 'Rewrite with Cognito AI',
                contexts: ['selection'], // Only show when text is selected
            },
            () => {
                if (chrome.runtime.lastError) {
                    log.error('Failed to create context menu', {
                        error: chrome.runtime.lastError.message,
                    });
                } else {
                    log.info('Rewriter context menu created');
                }
            }
        );
    });
}

/**
 * Initialize context menu click handler
 * Sends message to content script when menu item is clicked
 */
export function initializeRewriterContextMenuListener(): void {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId !== REWRITER_MENU_ID) {
            return;
        }

        log.info('Rewrite context menu clicked', {
            selectionText: info.selectionText?.substring(0, 50),
            tabId: tab?.id,
        });

        if (!info.selectionText || !tab?.id) {
            log.warn('No selection text or tab ID available');
            return;
        }

        try {
            // Send message to the content script to show the rewriter UI
            await chrome.tabs.sendMessage(tab.id, {
                action: 'SHOW_REWRITER',
                payload: {
                    selectedText: info.selectionText,
                },
            });

            log.debug('Sent SHOW_REWRITER message to content script');
        } catch (error) {
            log.error('Failed to send message to content script', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });

    log.info('Rewriter context menu listener initialized');
}

/**
 * Initialize context menu on extension install/update
 */
export function initializeRewriterContextMenu(): void {
    // Create menu on install
    chrome.runtime.onInstalled.addListener(() => {
        createRewriterContextMenu();
    });

    // Also create on startup (in case it wasn't persisted)
    chrome.runtime.onStartup?.addListener(() => {
        createRewriterContextMenu();
    });

    // Initialize click handler
    initializeRewriterContextMenuListener();

    // Create menu immediately if already installed
    // This handles the case where service worker restarts
    createRewriterContextMenu();

    log.info('Rewriter context menu initialization complete');
}
