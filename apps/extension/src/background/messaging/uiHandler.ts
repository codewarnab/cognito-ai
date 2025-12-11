/**
 * UI Handler
 * 
 * Handles UI-related messages (e.g., opening sidebar, notifications)
 */

import { createLogger } from '~logger';
import { openSidePanel, sendMessageToSidepanelWithAttachments } from '../sidepanelUtils';
import { getLastFocusedWindowId } from '../omnibox';
import { ensureOffscreenDocument } from '../../offscreen/ensure';
import { createAINotification } from '@/utils/notifications';
import type { AINotificationPayload } from '../../types/notifications';

const backgroundLog = createLogger('Background-UI-Handler', 'BACKGROUND');

/**
 * Handle UI-related messages
 */
export async function handleUiMessage(
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
): Promise<void> {
    // Handle Ask AI button - open sidepanel
    if (message.action === 'OPEN_SIDEBAR') {
        const windowId = getLastFocusedWindowId();

        if (windowId) {
            const success = await openSidePanel(windowId);

            if (success) {
                backgroundLog.info(' Sidepanel opened via Ask AI button');

                // Broadcast to content scripts that sidebar is now open
                chrome.tabs.query({ windowId }, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, { action: 'SIDEBAR_OPENED' })
                                .catch(() => {
                                    // Ignore errors if content script not loaded
                                });
                        }
                    });
                });

                sendResponse({ success: true });
            } else {
                backgroundLog.error(' Failed to open sidepanel via Ask AI button');
                sendResponse({ success: false, error: 'Failed to open sidepanel' });
            }
        } else {
            backgroundLog.error(' Cannot open sidepanel: no window ID tracked');
            sendResponse({ success: false, error: 'No active window' });
        }
        return;
    }

    // Handle Ask AI button with message and attachments - open sidepanel and send message
    if (message.action === 'OPEN_SIDEBAR_WITH_MESSAGE') {
        const windowId = getLastFocusedWindowId();

        if (windowId) {
            const success = await openSidePanel(windowId);

            if (success) {
                backgroundLog.info(' Sidepanel opened via Ask AI button with message');

                // Broadcast to content scripts that sidebar is now open
                chrome.tabs.query({ windowId }, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, { action: 'SIDEBAR_OPENED' })
                                .catch(() => {
                                    // Ignore errors if content script not loaded
                                });
                        }
                    });
                });

                // Send message to sidepanel with retry logic (same as omnibox)
                // This ensures the message gets through even if sidepanel is still initializing
                if (message.payload?.message) {
                    await sendMessageToSidepanelWithAttachments(
                        message.payload.message,
                        message.payload.tabAttachments
                    );
                }

                sendResponse({ success: true });
            } else {
                backgroundLog.error(' Failed to open sidepanel via Ask AI button');
                sendResponse({ success: false, error: 'Failed to open sidepanel' });
            }
        } else {
            backgroundLog.error(' Cannot open sidepanel: no window ID tracked');
            sendResponse({ success: false, error: 'No active window' });
        }
        return;
    }

    // Handle model download progress broadcasts
    if (message.type === 'MODEL_DOWNLOAD_PROGRESS') {
        backgroundLog.info(' Relaying model download progress to sidepanel:', message.data);

        // Broadcast to all extension contexts (especially sidepanel)
        chrome.runtime.sendMessage({
            type: 'MODEL_DOWNLOAD_PROGRESS_UPDATE',
            data: message.data,
        }).catch((error) => {
            backgroundLog.debug(' No listeners for download progress update:', error);
        });

        sendResponse({ success: true });
        return;
    }

    // Handle AI notification creation
    if (message?.type === 'ai/notification/create') {
        try {
            const payload = message.payload as AINotificationPayload;
            backgroundLog.info(' Creating AI notification:', payload);

            const notificationId = await createAINotification({
                threadId: payload.threadId,
                title: payload.title,
                message: payload.message,
            });

            if (notificationId) {
                sendResponse({ success: true, notificationId });
            } else {
                sendResponse({ success: false, error: 'Failed to create notification' });
            }
        } catch (error) {
            backgroundLog.error(' Error creating AI notification:', error);
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        return;
    }

    // Handle summarize messages
    if (message?.type === 'summarize:availability') {
        await ensureOffscreenDocument();
        try {
            const res = await chrome.runtime.sendMessage({ type: 'offscreen/summarize/availability' });
            sendResponse(res);
        } catch (error) {
            sendResponse({ ok: false, code: 'error', message: error instanceof Error ? error.message : 'unknown' });
        }
        return;
    }

    if (message?.type === 'summarize:request') {
        await ensureOffscreenDocument();
        try {
            const res = await chrome.runtime.sendMessage({
                type: 'offscreen/summarize/request',
                payload: message.payload
            });
            sendResponse(res);
        } catch (error) {
            sendResponse({ ok: false, code: 'error', message: error instanceof Error ? error.message : 'unknown' });
        }
        return;
    }
}
