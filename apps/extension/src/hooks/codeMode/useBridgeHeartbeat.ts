import { useEffect, useRef, useCallback } from 'react';
import { useCodeModeStore } from '@/stores';
import type { CodeModeState } from '@/stores/codeMode/types';
import { createLogger } from '~logger';

const log = createLogger('useBridgeHeartbeat', 'CODE_MODE_BRIDGE');

/**
 * Default heartbeat interval in milliseconds (30 seconds)
 */
const DEFAULT_HEARTBEAT_INTERVAL = 30_000;

/**
 * Minimum interval to prevent excessive polling
 */
const MIN_HEARTBEAT_INTERVAL = 10_000;

interface UseBridgeHeartbeatOptions {
    /**
     * Whether the heartbeat is enabled
     * @default true
     */
    enabled?: boolean;
    /**
     * Polling interval in milliseconds
     * @default 30000
     */
    intervalMs?: number;
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
 * Hook to periodically check code bridge health and update store status.
 * 
 * This provides automatic detection of bridge disconnection while idle,
 * allowing the UI to show an appropriate status indicator without requiring
 * user interaction.
 * 
 * @example
 * ```tsx
 * // In a component that's rendered when code mode is active
 * useBridgeHeartbeat({
 *   enabled: isCodeMode,
 *   onDisconnect: () => toast.error('Bridge disconnected'),
 * });
 * ```
 */
export function useBridgeHeartbeat(options: UseBridgeHeartbeatOptions = {}) {
    const {
        enabled = true,
        intervalMs = DEFAULT_HEARTBEAT_INTERVAL,
        onDisconnect,
        onReconnect,
    } = options;

    // Store selectors - use the store's checkBridgeHealth which validates the token
    const bridgeStatus = useCodeModeStore((s: CodeModeState) => s.bridgeStatus);
    const checkBridgeHealth = useCodeModeStore((s: CodeModeState) => s.checkBridgeHealth);

    // Track previous status for disconnect/reconnect callbacks
    const prevStatusRef = useRef(bridgeStatus);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Memoize the health check function
    const performHealthCheck = useCallback(async () => {
        if (!enabled) return;

        const previousStatus = prevStatusRef.current;
        log.info('Performing heartbeat health check', { previousStatus });

        // Use the store's checkBridgeHealth which validates token with the bridge
        await checkBridgeHealth();

        // Get the updated status after the check
        const newStatus = useCodeModeStore.getState().bridgeStatus;

        // Fire callbacks based on status transitions
        if (previousStatus === 'connected' && newStatus !== 'connected') {
            log.warn('Heartbeat detected bridge disconnected', { newStatus });
            onDisconnect?.();
        } else if (previousStatus !== 'connected' && newStatus === 'connected') {
            log.info('Bridge reconnected');
            onReconnect?.();
        }

        prevStatusRef.current = newStatus;
    }, [
        enabled,
        checkBridgeHealth,
        onDisconnect,
        onReconnect,
    ]);

    // Set up the polling interval
    useEffect(() => {
        if (!enabled) {
            // Clear interval when disabled
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                log.info('Bridge heartbeat disabled');
            }
            return;
        }

        // Ensure minimum interval
        const actualInterval = Math.max(intervalMs, MIN_HEARTBEAT_INTERVAL);

        log.info('Starting bridge heartbeat', { intervalMs: actualInterval });

        // Perform initial check immediately
        performHealthCheck();

        // Set up interval for subsequent checks
        intervalRef.current = setInterval(performHealthCheck, actualInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                log.info('Bridge heartbeat stopped');
            }
        };
    }, [enabled, intervalMs, performHealthCheck]);

    // Update previous status ref when bridgeStatus changes
    useEffect(() => {
        prevStatusRef.current = bridgeStatus;
    }, [bridgeStatus]);

    return {
        /**
         * Manually trigger a health check
         */
        checkNow: performHealthCheck,
    };
}
