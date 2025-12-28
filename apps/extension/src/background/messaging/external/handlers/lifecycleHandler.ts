/**
 * Lifecycle Handler
 *
 * Handles lifecycle-related external messages:
 * - PING: Health check
 * - OPEN_SIDEPANEL: Open the extension side panel
 */

import type { ExternalMessage, ExternalResponse } from '@cognito/shared';
import { openSidePanel, openSidePanelForTab } from '@/background/sidepanelUtils';
import { successResponse, errorResponse } from '../utils';

/**
 * Message types handled by this handler
 */
export const LIFECYCLE_MESSAGE_TYPES = ['PING', 'OPEN_SIDEPANEL'] as const;

/**
 * Handle lifecycle-related messages
 */
export async function handleLifecycleMessage(
    message: ExternalMessage,
    sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'PING':
            return handlePing();

        case 'OPEN_SIDEPANEL':
            return handleOpenSidepanel(sender);

        default:
            return null;
    }
}

/**
 * Handle PING message - health check
 */
function handlePing(): ExternalResponse {
    return {
        success: true,
        version: chrome.runtime.getManifest().version,
    };
}

/**
 * Handle OPEN_SIDEPANEL message
 */
async function handleOpenSidepanel(
    sender: chrome.runtime.MessageSender
): Promise<ExternalResponse> {
    // Try to open sidepanel in the current window of the sender if possible
    if (sender.tab?.id) {
        const success = await openSidePanelForTab(sender.tab.id);
        return successResponse({ success });
    }

    if (sender.tab?.windowId) {
        const success = await openSidePanel(sender.tab.windowId);
        return successResponse({ success });
    }

    // Fallback to last focused window
    const window = await chrome.windows.getLastFocused();
    if (window.id) {
        const success = await openSidePanel(window.id);
        return successResponse({ success });
    }

    return errorResponse('Could not determine window to open sidepanel');
}
