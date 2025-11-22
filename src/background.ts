/**
 * MV3 Background Service Worker - Orchestrator
 * 
 * This is the main entry point for the background service worker.
 * It initializes all modules and sets up event listeners.
 * 
 * Architecture:
 * - All MCP logic is in src/background/mcp/
 * - All message handling is in src/background/messaging/
 * - All event listeners are in dedicated modules
 * - This file only orchestrates initialization
 */

import './polyfills/process';

import { openSidePanelForTab, openSidePanel } from './background/sidepanelUtils';
import { createLogger } from '~logger';
import { initializeOAuthRedirectURI } from './background/mcp/auth';
import { initializeLifecycleEventListeners } from './background/lifecycle';
import { initializeAlarmListeners } from './background/alarms';
import { initializeNotificationListeners } from './background/notifications';
import { initializeOmnibox } from './background/omnibox';
import { initializeMessageRouter } from './background/messaging/router';

const log = createLogger('Background-Orchestrator', 'BACKGROUND');

log.info('Service Worker loading...');

// ============================================================================
// Core Initialization
// ============================================================================

// Initialize OAuth redirect URI immediately when service worker loads
initializeOAuthRedirectURI();

// ============================================================================
// Event Listener Initialization
// ============================================================================

// Initialize all modular event listeners
initializeLifecycleEventListeners();
initializeMessageRouter();
initializeAlarmListeners();
initializeNotificationListeners();
initializeOmnibox();

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Action click handler - open side panel
 */
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        if (chrome.sidePanel && tab.id) {
            await openSidePanelForTab(tab.id);
        }
    });
}

/**
 * Commands handler - handle keyboard shortcuts
 * Responds to the _execute_side_panel command (Ctrl+Shift+H / Cmd+Shift+H)
 */
if (chrome.commands) {
    chrome.commands.onCommand.addListener(async (command) => {
        log.info('Command received:', command);

        if (command === '_execute_side_panel') {
            try {
                const currentWindow = await chrome.windows.getCurrent();

                if (currentWindow?.id) {
                    const success = await openSidePanel(currentWindow.id);

                    if (success) {
                        log.info('Sidepanel opened via keyboard shortcut');
                    } else {
                        log.error('Failed to open sidepanel via keyboard shortcut');
                    }
                } else {
                    log.error('Cannot open sidepanel: no current window');
                }
            } catch (error) {
                log.error('Error opening sidepanel via keyboard shortcut:', error);
            }
        }
    });
}

// ============================================================================
// Initialization Complete
// ============================================================================

log.info('Service Worker initialized and all listeners are active');






