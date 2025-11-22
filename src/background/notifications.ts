/**
 * Chrome Notifications Event Handlers
 * 
 * Handles:
 * - chrome.notifications.onClicked
 * - chrome.notifications.onButtonClicked
 */

import { createLogger } from '~logger';
import { isAINotification, parseNotificationId, clearNotification } from '../utils/aiNotification';

const log = createLogger('Background-Notifications', 'BACKGROUND');

interface Reminder {
    id: string;
    title: string;
    when: number;
    url?: string;
    createdAt: number;
    generatedTitle?: string;
    generatedDescription?: string;
}

/**
 * Initialize notification event listeners
 */
export function initializeNotificationListeners(): void {
    /**
     * Global notification click handler for reminders and AI notifications
     */
    chrome.notifications.onClicked.addListener(async (notificationId) => {
        try {
            // Handle AI completion notifications
            if (isAINotification(notificationId)) {
                log.info('AI notification clicked:', notificationId);

                const parsed = parseNotificationId(notificationId);
                if (!parsed) {
                    log.warn('Invalid AI notification ID:', notificationId);
                    return;
                }

                // Open/focus sidepanel
                try {
                    await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
                } catch (error) {
                    log.error('Error opening sidepanel:', error);
                }

                // Send message to sidepanel to navigate to the thread
                try {
                    await chrome.runtime.sendMessage({
                        type: 'ai/notification/action',
                        payload: {
                            action: 'navigate',
                            threadId: parsed.threadId,
                        }
                    });
                } catch (error) {
                    log.debug('No listeners for navigation message:', error);
                }

                // Clear the notification
                await clearNotification(notificationId);
                return;
            }

            // Handle reminder notifications
            if (!notificationId.startsWith('reminder:')) {
                return;
            }

            const id = notificationId.split(':')[1];
            if (!id) {
                log.warn('Invalid reminder notification ID:', notificationId);
                return;
            }

            const { reminders = {} } = await chrome.storage.local.get('reminders');
            const remindersMap = reminders as Record<string, Reminder>;
            const reminder: Reminder | undefined = remindersMap[id];

            if (reminder?.url) {
                await chrome.tabs.create({ url: reminder.url });
            }

            // Cleanup: remove reminder and clear notification
            if (remindersMap[id]) {
                delete remindersMap[id];
                await chrome.storage.local.set({ reminders: remindersMap });
            }

            chrome.notifications.clear(notificationId);
        } catch (error) {
            log.error('Error handling notification click:', error);
        }
    });

    /**
     * Global notification button click handler for AI notifications
     */
    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
        try {
            // Only handle AI completion notifications
            if (!isAINotification(notificationId)) {
                return;
            }

            log.info('AI notification button clicked:', notificationId, buttonIndex);

            const parsed = parseNotificationId(notificationId);
            if (!parsed) {
                log.warn('Invalid AI notification ID:', notificationId);
                return;
            }

            // Button 0: Continue Iterating
            // Button 1: Dismiss
            if (buttonIndex === 0) {
                // Continue Iterating clicked
                log.info('Continue Iterating clicked for thread:', parsed.threadId);

                // Open/focus sidepanel
                try {
                    await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
                } catch (error) {
                    log.error('Error opening sidepanel:', error);
                }

                // Send message to sidepanel to continue iterating
                try {
                    await chrome.runtime.sendMessage({
                        type: 'ai/notification/action',
                        payload: {
                            action: 'continue',
                            threadId: parsed.threadId,
                        }
                    });
                } catch (error) {
                    log.debug('No listeners for continue action:', error);
                }
            } else if (buttonIndex === 1) {
                // Dismiss clicked - just clear the notification
                log.info('Dismiss clicked for thread:', parsed.threadId);
            }

            // Clear the notification regardless of which button was clicked
            await clearNotification(notificationId);
        } catch (error) {
            log.error('Error handling notification button click:', error);
        }
    });

    log.info('Notification listeners initialized');
}
