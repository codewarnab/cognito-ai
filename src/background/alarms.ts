/**
 * Chrome Alarms Event Handlers
 * 
 * Handles:
 * - Token refresh alarms for MCP servers
 * - PDF cache cleanup
 * - Reminder notifications
 */

import { createLogger } from '~logger';
import { handleTokenRefreshAlarm, refreshServerToken } from '../mcp/authHelpers';
import { cleanupCache } from '../ai/fileApi/cache';
import { APP_ICON } from '../constants';

const log = createLogger('Background-Alarms', 'BACKGROUND');

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
 * Initialize alarm listeners and create recurring alarms
 */
export function initializeAlarmListeners(): void {
    // Create cleanup alarm (runs every hour)
    chrome.alarms.create('cleanup-expired-sessions', {
        periodInMinutes: 60
    });

    // PDF cache cleanup alarm (runs every 6 hours)
    chrome.alarms.create('pdf-cache-cleanup', {
        periodInMinutes: 6 * 60
    });

    /**
     * Handle all alarm events
     */
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        // Handle token refresh alarms (format: mcp-token-refresh-{serverId})
        if (alarm.name.startsWith('mcp-token-refresh-')) {
            const serverId = alarm.name.replace('mcp-token-refresh-', '');
            await handleTokenRefreshAlarm(serverId, refreshServerToken);
            return;
        }

        // Handle PDF cache cleanup
        if (alarm.name === 'pdf-cache-cleanup') {
            try {
                await cleanupCache();
            } catch (error) {
                log.error('PDF cache cleanup failed:', error);
            }
            return;
        }

        // Only handle reminder alarms after this point
        if (!alarm.name.startsWith('reminder:')) {
            return;
        }

        const id = alarm.name.split(':')[1];
        if (!id) {
            log.warn('Invalid reminder alarm name:', alarm.name);
            return;
        }

        log.info('Reminder alarm fired:', id);

        try {
            // Get the reminder from storage
            const { reminders = {} } = await chrome.storage.local.get('reminders');
            const remindersMap = reminders as Record<string, Reminder>;
            const reminder: Reminder | undefined = remindersMap[id];

            if (!reminder) {
                log.warn('Reminder not found:', id);
                return;
            }

            // Create notification with AI-generated content or fallback to original title
            const appicon = APP_ICON;

            const notificationTitle = reminder.generatedTitle || '⏰ Reminder';
            const notificationMessage = reminder.generatedDescription || reminder.title;

            // Use a namespaced notification ID to distinguish reminders
            chrome.notifications.create(`reminder:${id}`, {
                type: 'basic',
                iconUrl: appicon,
                title: notificationTitle,
                message: notificationMessage,
                priority: 2,
                requireInteraction: false
            });

            log.info('Reminder notification created:', {
                title: notificationTitle,
                message: notificationMessage
            });

            // Do not remove the reminder here; it will be removed by the global
            // notification click handler to avoid race conditions and ensure the
            // click handler has access to the stored reminder data.
        } catch (error) {
            log.error('Error handling reminder alarm:', error);
        }
    });

    log.info('Alarm listeners initialized');
}
