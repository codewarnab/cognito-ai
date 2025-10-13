/**
 * MV3 Background Service Worker - Main Entry Point
 * 
 * Handles:
 * - Side panel initialization
 * - Extension lifecycle events
 */

// ============================================================================
// Runtime Listeners
// ============================================================================

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] onInstalled:', details.reason);

    try {
        // Enable side panel on all existing tabs
        if (chrome.sidePanel) {
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
        }

        console.log('[Background] Side panel configured');
    } catch (error) {
        console.error('[Background] onInstalled error:', error);
    }
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Background] onStartup - Extension ready');
});

/**
 * Action click handler - open side panel
 */
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        if (chrome.sidePanel && tab.id) {
            try {
                await chrome.sidePanel.open({ tabId: tab.id });
            } catch (error) {
                console.error('[Background] Error opening side panel:', error);
            }
        }
    });
}

// ============================================================================
// Initialization
// ============================================================================

console.log('[Background] Service worker loaded - CopilotKit powered extension ready');
