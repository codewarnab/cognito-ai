/**
 * AI Notification Utility
 * Creates Chrome notifications for AI completion events
 * Based on existing reminder notification system in background.ts
 */

import type { NotificationOptions, ParsedNotificationId } from '../types/notifications';
import { createLogger } from '~logger';
import { APP_ICON } from '@/constants';

const notificationLog = createLogger('Notifications', 'NOTIFICATIONS');

/**
 * Base64 encoded logo for notifications
 * Using base64 to avoid image download failures
 */
const NOTIFICATION_LOGO_BASE64 = APP_ICON;

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
 * 
 * TEMPORARILY DISABLED - No notifications will be sent
 */
export async function createAINotification(
    options: NotificationOptions
): Promise<string | null> {
    const { threadId } = options;

    // Destructured options - used when notifications are enabled
    // const {
    //     threadId,
    //     title,
    //     message,
    //     iconUrl = NOTIFICATION_LOGO_BASE64,
    //     priority = 2,
    //     requireInteraction = false,
    // } = options;

    const timestamp = Date.now();
    const notificationId = createNotificationId(threadId, timestamp);

    // TEMPORARILY DISABLED - Notifications are turned off
    notificationLog.info('Notifications disabled - would have created:', notificationId);
    return null;

    /* COMMENTED OUT - Uncomment to re-enable notifications
    try {
        // Check if notifications API is available
        if (!chrome.notifications) {
            notificationLog.error('Chrome notifications API not available');
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

        notificationLog.info('Created notification:', notificationId);
        return notificationId;
    } catch (error) {
        notificationLog.error('Failed to create notification:', error);
        return null;
    }
    */
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
        notificationLog.debug('Cleared notification:', notificationId);
        return true;
    } catch (error) {
        notificationLog.error('Failed to clear notification:', error);
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

        notificationLog.debug('Cleared thread notifications:', threadId, threadNotificationIds.length);
    } catch (error) {
        notificationLog.error('Failed to clear thread notifications:', error);
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

