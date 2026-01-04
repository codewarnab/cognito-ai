import { useEffect, useRef, useCallback } from 'react';
import { useCliModeStore } from '@/stores';
import type { CliModeState } from '@/stores/cliMode/types';
import { connectToEventStream } from '@/services/codeBridge';
import { createLogger } from '~logger';

const log = createLogger('useBridgeHeartbeat', 'CLI_MODE_BRIDGE');

/**
 * Retry configuration for aggressive reconnection when offline
 */
const RETRY_CONFIG = {
    /** Initial retry delay when offline (faster for quick reconnection) */
    initialDelayMs: 3_000,
    /** Maximum delay between retries */
    maxDelayMs: 30_000,
    /** Backoff multiplier */
    backoffMultiplier: 2,
};

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
    const fallbackIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isUsingSSERef = useRef(false);
    const retryDelayRef = useRef(RETRY_CONFIG.initialDelayMs);

    // Handle status transitions for callbacks
    const handleStatusChange = useCallback((newStatus: 'connected' | 'needs-pairing' | 'offline') => {
        const previousStatus = prevStatusRef.current;

        log.info('Status transition', { from: previousStatus, to: newStatus });

        if (previousStatus === 'connected' && newStatus !== 'connected') {
            log.warn('Bridge disconnected', { newStatus });
            onDisconnect?.();
        } else if (previousStatus !== 'connected' && newStatus === 'connected') {
            log.info('Bridge reconnected');
            onReconnect?.();
        }

        prevStatusRef.current = newStatus;
        setBridgeStatus(newStatus);
    }, [onDisconnect, onReconnect, setBridgeStatus]);

    // Start fallback HTTP polling with exponential backoff
    const startFallbackPolling = useCallback(() => {
        if (fallbackIntervalRef.current) return; // Already polling

        log.info('Starting fallback HTTP polling with exponential backoff', {
            initialDelay: RETRY_CONFIG.initialDelayMs,
        });
        isUsingSSERef.current = false;

        // Initial check immediately
        checkBridgeHealth();

        // Schedule first retry
        const scheduleNextRetry = () => {
            const currentDelay = retryDelayRef.current;
            log.debug('Scheduling next retry', { delayMs: currentDelay });

            fallbackIntervalRef.current = setTimeout(() => {
                checkBridgeHealth().then(() => {
                    // If still not connected, schedule next retry with backoff
                    const currentStatus = prevStatusRef.current;
                    if (currentStatus !== 'connected') {
                        // Increase delay with backoff
                        retryDelayRef.current = Math.min(
                            retryDelayRef.current * RETRY_CONFIG.backoffMultiplier,
                            RETRY_CONFIG.maxDelayMs
                        );
                        scheduleNextRetry();
                    }
                });
            }, currentDelay);
        };

        // Initialize retry delay and start
        retryDelayRef.current = RETRY_CONFIG.initialDelayMs;
        scheduleNextRetry();
    }, [checkBridgeHealth]);

    // Stop fallback polling and reset retry delay
    const stopFallbackPolling = useCallback(() => {
        if (fallbackIntervalRef.current) {
            clearTimeout(fallbackIntervalRef.current);
            fallbackIntervalRef.current = null;
            retryDelayRef.current = RETRY_CONFIG.initialDelayMs; // Reset for next time
            log.info('Stopped fallback HTTP polling');
        }
    }, []);


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
                stopFallbackPolling();
                handleStatusChange('connected');
            },
            onHeartbeat: () => {
                // SSE heartbeat confirms connection is alive
                // No action needed, just confirms we're still connected
            },
            onClosing: (event) => {
                log.warn('Bridge closing via SSE', { reason: event.reason });
                handleStatusChange('offline');
                // SSE will error after this, which triggers reconnect logic
            },
            onError: () => {
                log.warn('SSE connection failed, falling back to HTTP polling');
                isUsingSSERef.current = false;
                handleStatusChange('offline');

                // Clean up SSE
                if (sseCleanupRef.current) {
                    sseCleanupRef.current();
                    sseCleanupRef.current = null;
                }

                // Fall back to HTTP polling
                startFallbackPolling();
            },
        });
    }, [bridgeBaseUrl, handleStatusChange, startFallbackPolling, stopFallbackPolling]);

    // Main effect: manage SSE connection
    useEffect(() => {
        if (!enabled) {
            // Clean up when disabled
            if (sseCleanupRef.current) {
                sseCleanupRef.current();
                sseCleanupRef.current = null;
            }
            stopFallbackPolling();
            log.info('Bridge connection monitoring disabled');
            return;
        }

        // Start with SSE connection attempt
        log.info('Hook enabled, starting SSE connection', { bridgeBaseUrl, currentBridgeStatus: bridgeStatus });
        connectSSE();

        return () => {
            if (sseCleanupRef.current) {
                sseCleanupRef.current();
                sseCleanupRef.current = null;
            }
            stopFallbackPolling();
            log.info('Bridge connection monitoring stopped');
        };
    }, [enabled, connectSSE, stopFallbackPolling]);

    // Update previous status ref when bridgeStatus changes externally
    useEffect(() => {
        prevStatusRef.current = bridgeStatus;
    }, [bridgeStatus]);

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
