/**
 * Reusable utility functions for opening the sidepanel
 * Used by omnibox, Ask AI button, and other features
 */

import { createLogger } from '~logger';

const log = createLogger('SidepanelUtils');

/**
 * Opens the sidepanel for the currently focused window
 * 
 * This function properly handles the user gesture chain by:
 * 1. Using the last focused window ID (tracked globally)
 * 2. Opening sidepanel immediately without async operations
 * 
 * @param windowId - The window ID to open the sidepanel in
 * @returns Promise that resolves when sidepanel is opened
 */
export async function openSidePanel(windowId?: number): Promise<boolean> {
    try {
        if (!windowId) {
            log.warn('No window ID provided, cannot open sidepanel');
            return false;
        }

        log.info(`Opening sidepanel for window ${windowId}`);
        await chrome.sidePanel.open({ windowId });
        log.info('Sidepanel opened successfully');
        return true;
    } catch (error) {
        log.error('Error opening sidepanel:', error);
        return false;
    }
}

/**
 * Opens the sidepanel for a specific tab
 * 
 * @param tabId - The tab ID to open the sidepanel in
 * @returns Promise that resolves when sidepanel is opened
 */
export async function openSidePanelForTab(tabId: number): Promise<boolean> {
    try {
        log.info(`Opening sidepanel for tab ${tabId}`);
        await chrome.sidePanel.open({ tabId });
        log.info('Sidepanel opened successfully');
        return true;
    } catch (error) {
        log.error('Error opening sidepanel:', error);
        return false;
    }
}

/**
 * Helper function to send message to sidepanel with retry logic
 * Retries up to 5 times with exponential backoff to handle sidepanel initialization
 */
export async function sendMessageToSidepanel(
    text: string,
    attempt: number = 1,
    maxAttempts: number = 5
): Promise<void> {
    try {
        await chrome.runtime.sendMessage({
            type: 'omnibox/send-message',
            payload: { text: text.trim() }
        });
        log.info(`Message sent to sidepanel successfully (attempt ${attempt})`);
    } catch (error) {
        if (attempt < maxAttempts) {
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
            log.debug(`Sidepanel not ready yet (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return sendMessageToSidepanel(text, attempt + 1, maxAttempts);
        } else {
            log.error(`Failed to send message to sidepanel after ${maxAttempts} attempts:`, error);
        }
    }
}

/**
 * Helper function to send message with attachments to sidepanel with retry logic
 * Retries up to 5 times with exponential backoff to handle sidepanel initialization
 */
export async function sendMessageToSidepanelWithAttachments(
    text: string,
    tabAttachments?: any[],
    attempt: number = 1,
    maxAttempts: number = 5
): Promise<void> {
    try {
        await chrome.runtime.sendMessage({
            type: 'ask-ai/send-message',
            payload: { 
                message: text.trim(),
                tabAttachments 
            }
        });
        log.info(`Message with attachments sent to sidepanel successfully (attempt ${attempt})`);
    } catch (error) {
        if (attempt < maxAttempts) {
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
            log.debug(`Sidepanel not ready yet (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return sendMessageToSidepanelWithAttachments(text, tabAttachments, attempt + 1, maxAttempts);
        } else {
            log.error(`Failed to send message with attachments to sidepanel after ${maxAttempts} attempts:`, error);
        }
    }
}

