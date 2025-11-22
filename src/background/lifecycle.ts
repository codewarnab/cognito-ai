/**
 * Extension Lifecycle Event Handlers
 * 
 * Handles:
 * - chrome.runtime.onInstalled
 * - chrome.runtime.onStartup
 */

import { createLogger } from '~logger';
import { initializeAllServers } from './initializer';

const log = createLogger('Background-Lifecycle', 'BACKGROUND');

/**
 * Initialize lifecycle event listeners
 */
export function initializeLifecycleEventListeners(): void {
    /**
     * Extension install/update handler
     */
    chrome.runtime.onInstalled.addListener(async (details) => {
        log.info('onInstalled:', details.reason);

        try {
            // Initialize all MCP servers from storage
            await initializeAllServers();

            // Keep-alive is initialized by initializeAllServers
            log.info('Keep-alive initialized');

            // Enable side panel on all existing tabs
            if (chrome.sidePanel) {
                chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
                    log.error('Failed to set panel behavior:', error);
                });
            }

            log.info('Side panel configured');
        } catch (error) {
            log.error('onInstalled error:', error);
        }
    });

    /**
     * Extension startup handler
     */
    chrome.runtime.onStartup.addListener(async () => {
        log.info('onStartup - Extension ready');

        // Clear session-based Ask AI button hide flag on browser startup
        try {
            await chrome.storage.session.set({
                'askAiButton.hiddenForSession': false
            });
            log.info('Ask AI button session hide cleared on startup');
        } catch (error) {
            log.error('Error clearing Ask AI button session hide:', error);
        }

        // Initialize all MCP servers from storage
        await initializeAllServers();

        // Keep-alive is initialized by initializeAllServers
        log.info('Keep-alive initialized on startup');
    });

    log.info('Lifecycle event listeners initialized');
}
