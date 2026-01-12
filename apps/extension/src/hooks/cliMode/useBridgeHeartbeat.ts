import { useEffect, useRef, useCallback } from 'react';
import { useCliModeStore } from '@/stores';
import type { CliModeState } from '@/stores/cliMode/types';
import { connectToEventStream } from '@/services/codeBridge';
import { createLogger } from '~logger';

const log = createLogger('useBridgeHeartbeat', 'CLI_MODE_BRIDGE');

// NOTE: We rely on EventSource's built-in retry behavior.
// This keeps overhead low and avoids long backoff delays when the bridge starts.

interface UseBridgeHeartbeatOptions {
    /**
     * Whether the heartbeat is enabled
     * @default true
     */
    enabled?: boolean;
    /**
     * Callback when bridge becomes disconnected
     */
    onDisconnect?: () => void;
    /**
     * Callback when bridge reconnects
     */
    onReconnect?: () => void;
}

/**
 * Hook to maintain real-time bridge connection status using SSE.
 * Falls back to HTTP polling if SSE is unavailable.
 * 
 * @example
 * ```tsx
 * useBridgeHeartbeat({
 *   enabled: isCliMode,
 *   onDisconnect: () => toast.error('Bridge disconnected'),
 * });
 * ```
 */
export function useBridgeHeartbeat(options: UseBridgeHeartbeatOptions = {}) {
    const { enabled = true, onDisconnect, onReconnect } = options;

    // Store selectors
    const bridgeBaseUrl = useCliModeStore((s: CliModeState) => s.bridgeBaseUrl);
    const bridgeStatus = useCliModeStore((s: CliModeState) => s.bridgeStatus);
    const setBridgeStatus = useCliModeStore((s: CliModeState) => s.setBridgeStatus);
    const checkBridgeHealth = useCliModeStore((s: CliModeState) => s.checkBridgeHealth);

    // Track connection state
    const prevStatusRef = useRef(bridgeStatus);
    const sseCleanupRef = useRef<(() => void) | null>(null);
    const isUsingSSERef = useRef(false);

    // Fire callbacks on bridgeStatus transitions (store is the source of truth)
    useEffect(() => {
        const previousStatus = prevStatusRef.current;

        if (previousStatus === 'connected' && bridgeStatus !== 'connected') {
            log.warn('Bridge disconnected', { newStatus: bridgeStatus });
            onDisconnect?.();
        } else if (previousStatus !== 'connected' && bridgeStatus === 'connected') {
            log.info('Bridge connected');
            onReconnect?.();
        }

        prevStatusRef.current = bridgeStatus;
    }, [bridgeStatus, onDisconnect, onReconnect]);


    // Connect to SSE stream
    const connectSSE = useCallback(() => {
        // Clean up existing connection
        if (sseCleanupRef.current) {
            sseCleanupRef.current();
            sseCleanupRef.current = null;
        }

        log.info('Attempting SSE connection');

        sseCleanupRef.current = connectToEventStream(bridgeBaseUrl, {
            onConnected: (event) => {
                log.info('SSE connected', { version: event.version });
                isUsingSSERef.current = true;

                // Bridge is online; attempt (auto)connect + tool registration.
                // This call is idempotent and will reuse a stored token if valid.
                checkBridgeHealth();
            },
            onHeartbeat: () => {
                // SSE heartbeat confirms connection is alive
                // No action needed, just confirms we're still connected
            },
            onClosing: (event) => {
                log.warn('Bridge closing via SSE', { reason: event.reason });
                isUsingSSERef.current = false;
                setBridgeStatus('offline');
            },
            onError: () => {
                // EventSource will keep retrying automatically; we just reflect offline state.
                log.warn('SSE connection failed (will retry automatically)');
                isUsingSSERef.current = false;
                setBridgeStatus('offline');
            },
        });
    }, [bridgeBaseUrl, checkBridgeHealth, setBridgeStatus]);

    // Main effect: manage SSE connection
    useEffect(() => {
        if (!enabled) {
            // Clean up when disabled
            if (sseCleanupRef.current) {
                sseCleanupRef.current();
                sseCleanupRef.current = null;
            }
            log.info('Bridge connection monitoring disabled');
            return;
        }

        // Start with SSE connection attempt
        log.info('Hook enabled, starting SSE connection', {
            bridgeBaseUrl,
            currentBridgeStatus: useCliModeStore.getState().bridgeStatus,
        });
        connectSSE();
        // Also attempt an immediate connect (fast path if bridge is already running)
        checkBridgeHealth();

        return () => {
            if (sseCleanupRef.current) {
                sseCleanupRef.current();
                sseCleanupRef.current = null;
            }
            log.info('Bridge connection monitoring stopped');
        };
    }, [enabled, connectSSE, checkBridgeHealth, bridgeBaseUrl]);

    return {
        /**
         * Whether using SSE (true) or fallback HTTP polling (false)
         */
        isUsingSSE: isUsingSSERef.current,
        /**
         * Manually trigger a health check (forces HTTP check)
         */
        checkNow: checkBridgeHealth,
        /**
         * Reconnect SSE stream
         */
        reconnect: connectSSE,
    };
}
