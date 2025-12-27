'use client';

import { useState, useEffect, useRef } from 'react';
import type { LogEntry } from '@cognito/shared';

// Use environment variable for extension ID
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

export function useLogStream() {
    const [isConnected, setIsConnected] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const portRef = useRef<chrome.runtime.Port | null>(null);

    useEffect(() => {
        // Only run on client side and if chrome runtime is available
        if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
            console.warn('[useLogStream] Chrome runtime API not available');
            return;
        }

        if (!EXTENSION_ID) {
            console.warn('[useLogStream] Extension ID not configured (NEXT_PUBLIC_EXTENSION_ID)');
            return;
        }

        const connect = () => {
            try {
                // Connect to the extension's logger port
                const port = chrome.runtime.connect(EXTENSION_ID, { name: 'logger' });
                portRef.current = port;
                setIsConnected(true);

                // Listen for incoming log entries
                port.onMessage.addListener((message: LogEntry) => {
                    setLogs(prev => [...prev, message]);
                });

                // Handle disconnection
                port.onDisconnect.addListener(() => {
                    setIsConnected(false);
                    portRef.current = null;
                    console.log('[useLogStream] Disconnected from extension');
                });
            } catch (e) {
                console.error('[useLogStream] Failed to connect:', e);
                setIsConnected(false);
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
    }, []);

    const clearLogs = () => setLogs([]);

    return {
        logs,
        isConnected,
        clearLogs
    };
}
