/**
 * AI Notification Utility
 * Creates Chrome notifications for AI completion events
 * Based on existing reminder notification system in background.ts
 */

import type { NotificationOptions, ParsedNotificationId } from '../types/notifications';

/**
 * Base64 encoded logo for notifications
 * Using base64 to avoid image download failures
 */
const NOTIFICATION_LOGO_BASE64 = 'data:image/png;base64,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';

/**
 * Creates a unique notification ID for AI completions
 * Format: ai-complete:{threadId}:{timestamp}
 */
export function createNotificationId(threadId: string, timestamp: number): string {
    return `ai-complete:${threadId}:${timestamp}`;
}

/**
 * Parses a notification ID to extract thread info
 * Returns null if the ID doesn't match expected format
 */
export function parseNotificationId(notificationId: string): ParsedNotificationId | null {
    const parts = notificationId.split(':');

    if (parts.length !== 3 || parts[0] !== 'ai-complete') {
        return null;
    }

    const threadId = parts[1];
    const timestampStr = parts[2];

    if (!threadId || !timestampStr) {
        return null;
    }

    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
        return null;
    }

    return {
        type: 'ai-complete',
        threadId,
        timestamp,
    };
}

/**
 * Checks if a notification ID is an AI completion notification
 */
export function isAINotification(notificationId: string): boolean {
    return notificationId.startsWith('ai-complete:');
}

/**
 * Creates a Chrome notification for AI completion
 * Returns the notification ID on success, or null on failure
 */
export async function createAINotification(
    options: NotificationOptions
): Promise<string | null> {
    const {
        threadId,
        title,
        message,
        iconUrl = NOTIFICATION_LOGO_BASE64, // Use base64 encoded logo to avoid download issues
        priority = 2,
        requireInteraction = false,
    } = options;

    const timestamp = Date.now();
    const notificationId = createNotificationId(threadId, timestamp);

    try {
        // Check if notifications API is available
        if (!chrome.notifications) {
            console.error('[AINotification] Chrome notifications API not available');
            return null;
        }

        // Create the notification
        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl,
            title,
            message,
            priority,
            requireInteraction,
        });

        console.log('[AINotification] Created notification:', notificationId);
        return notificationId;
    } catch (error) {
        console.error('[AINotification] Failed to create notification:', error);
        return null;
    }
}

/**
 * Clears a Chrome notification by ID
 */
export async function clearNotification(notificationId: string): Promise<boolean> {
    try {
        if (!chrome.notifications) {
            return false;
        }

        await chrome.notifications.clear(notificationId);
        console.log('[AINotification] Cleared notification:', notificationId);
        return true;
    } catch (error) {
        console.error('[AINotification] Failed to clear notification:', error);
        return false;
    }
}

/**
 * Clears all AI completion notifications for a specific thread
 */
export async function clearThreadNotifications(threadId: string): Promise<void> {
    try {
        if (!chrome.notifications) {
            return;
        }

        // Get all active notifications
        const allNotifications = await new Promise<{ [key: string]: any }>((resolve) => {
            chrome.notifications.getAll((notifications) => {
                resolve(notifications || {});
            });
        });

        const threadNotificationIds = Object.keys(allNotifications).filter(id => {
            const parsed = parseNotificationId(id);
            return parsed && parsed.threadId === threadId;
        });

        await Promise.all(
            threadNotificationIds.map(id => clearNotification(id))
        );

        console.log('[AINotification] Cleared thread notifications:', threadId, threadNotificationIds.length);
    } catch (error) {
        console.error('[AINotification] Failed to clear thread notifications:', error);
    }
}

/**
 * Truncates message to fit in notification (max 100 chars for readability)
 */
export function truncateMessage(message: string, maxLength: number = 30): string {
    if (message.length <= maxLength) {
        return message;
    }
    return message.substring(0, maxLength - 3) + '...';
}

/**
 * Generates notification content from AI response
 */
export function generateNotificationContent(
    lastMessage: string | undefined,
    finishReason?: string
): { title: string; message: string } {
    let title = 'AI Assistant Finished';
    let message = 'Response complete. Click to view or continue.';

    // Customize based on finish reason
    if (finishReason === 'tool_call_limit') {
        title = 'AI Assistant Paused';
        message = 'Stopped at tool limit. Click "Continue Iterating" to proceed.';
    } else if (finishReason === 'length') {
        title = 'AI Response Truncated';
        message = 'Response reached token limit. Click to view or continue.';
    } else if (finishReason === 'error') {
        title = 'AI Response Error';
        message = 'Response ended with an error. Click to view details.';
    } else if (lastMessage) {
        // Use first part of actual response as preview
        message = truncateMessage(lastMessage);
    }

    return { title, message };
}
