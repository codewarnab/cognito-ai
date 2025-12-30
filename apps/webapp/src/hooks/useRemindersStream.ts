'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Reminder } from '@cognito/shared';
import { extensionAPI } from '@/lib/extension-api';

// Use environment variable for extension ID
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

export type ReminderBroadcastMessage = {
    type: 'REMINDERS_UPDATED';
    reminders: Reminder[];
};

/**
 * Hook for streaming real-time reminder updates from the extension.
 * Uses persistent port connection for immediate updates.
 */
export function useRemindersStream() {
    const [isConnected, setIsConnected] = useState(false);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const portRef = useRef<chrome.runtime.Port | null>(null);

    // Initial load via request/response
    const loadReminders = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await extensionAPI.getReminders();
            if (response.success && response.data) {
                setReminders(response.data);
            }
        } catch (error) {
            console.error('[useRemindersStream] Failed to load reminders', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Only run on client side and if chrome runtime is available
        if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
            console.warn('[useRemindersStream] Chrome runtime API not available');
            // Fall back to just loading reminders once
            loadReminders();
            return;
        }

        if (!EXTENSION_ID) {
            console.warn('[useRemindersStream] Extension ID not configured (NEXT_PUBLIC_EXTENSION_ID)');
            loadReminders();
            return;
        }

        const connect = () => {
            try {
                // Connect to the extension's reminders port
                const port = chrome.runtime.connect(EXTENSION_ID, { name: 'reminders' });
                portRef.current = port;
                setIsConnected(true);

                // Listen for incoming reminder updates
                port.onMessage.addListener((message: ReminderBroadcastMessage) => {
                    if (message.type === 'REMINDERS_UPDATED') {
                        setReminders(message.reminders);
                        setIsLoading(false);
                    }
                });

                // Handle disconnection
                port.onDisconnect.addListener(() => {
                    setIsConnected(false);
                    portRef.current = null;
                    console.log('[useRemindersStream] Disconnected from extension');
                });
            } catch (e) {
                console.error('[useRemindersStream] Failed to connect:', e);
                setIsConnected(false);
                // Fall back to loading reminders once
                loadReminders();
            }
        };

        connect();

        // Cleanup on unmount
        return () => {
            if (portRef.current) {
                portRef.current.disconnect();
                portRef.current = null;
            }
        };
    }, [loadReminders]);

    // Manual refresh function
    const refresh = useCallback(async () => {
        await loadReminders();
    }, [loadReminders]);

    return {
        reminders,
        isConnected,
        isLoading,
        refresh
    };
}
