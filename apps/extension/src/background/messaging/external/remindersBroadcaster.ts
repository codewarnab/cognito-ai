/**
 * Reminders Broadcaster
 * 
 * Broadcasts reminder updates to connected webapp pages via chrome.runtime.onConnectExternal.
 * This enables real-time updates on the /reminders page without requiring a refresh.
 */

import type { Reminder } from '@cognito/shared';
import { getActiveReminders } from '@/actions/reminder/storage';

export type ReminderBroadcastMessage = {
    type: 'REMINDERS_UPDATED';
    reminders: Reminder[];
};

class RemindersBroadcasterClass {
    private ports: chrome.runtime.Port[] = [];

    constructor() {
        // Only setup if in extension context
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.onConnectExternal) {
                this.setupListener();
            }
        } catch (e) {
            // Ignore during build/test where API might be mocked but not implemented
        }
    }

    private setupListener() {
        chrome.runtime.onConnectExternal.addListener((port) => {
            if (port.name === 'reminders') {
                this.ports.push(port);

                // Send current reminders immediately upon connection
                this.sendCurrentReminders(port);

                port.onDisconnect.addListener(() => {
                    this.ports = this.ports.filter(p => p !== port);
                });
            }
        });
    }

    private async sendCurrentReminders(port: chrome.runtime.Port) {
        try {
            const reminders = await getActiveReminders();
            port.postMessage({
                type: 'REMINDERS_UPDATED',
                reminders,
            } as ReminderBroadcastMessage);
        } catch (e) {
            // Ignore connection errors
        }
    }

    /**
     * Broadcast that reminders have been updated to all connected pages
     */
    async broadcastUpdate() {
        if (this.ports.length === 0) return;

        try {
            const reminders = await getActiveReminders();
            const message: ReminderBroadcastMessage = {
                type: 'REMINDERS_UPDATED',
                reminders,
            };

            this.ports.forEach(port => {
                try {
                    port.postMessage(message);
                } catch (e) {
                    this.ports = this.ports.filter(p => p !== port);
                }
            });
        } catch (e) {
            // Fail silently on broadcast errors
        }
    }
}

export const RemindersBroadcaster = new RemindersBroadcasterClass();
