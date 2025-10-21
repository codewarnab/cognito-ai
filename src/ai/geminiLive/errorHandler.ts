/**
 * Error Handler for Gemini Live API
 * Phase 9: Comprehensive error handling and edge cases
 * 
 * Handles:
 * 1. Microphone permission denied
 * 2. WebSocket connection failures
 * 3. Session timeout/GoAway
 * 4. Audio context suspended
 * 5. Tool execution failures
 * 6. Side panel close cleanup
 * 7. Tab visibility changes
 * 8. Rapid mode switching
 */

import { createLogger } from '../../logger';
import type { LiveAPIError, LiveAPIErrorType } from './types';

const log = createLogger('ErrorHandler');

// Error recovery strategies
export enum RecoveryStrategy {
    RETRY = 'retry',
    FALLBACK = 'fallback',
    MANUAL_INTERVENTION = 'manual',
    IGNORE = 'ignore'
}

export interface ErrorRecoveryConfig {
    maxRetries?: number;
    retryDelay?: number; // milliseconds
    exponentialBackoff?: boolean;
    onRetry?: (attempt: number, error: LiveAPIError) => void;
    onFailure?: (error: LiveAPIError) => void;
}

/**
 * Error recovery manager
 */
export class ErrorRecoveryManager {
    private retryCount = new Map<string, number>();
    private config: Required<ErrorRecoveryConfig>;

    constructor(config: ErrorRecoveryConfig = {}) {
        this.config = {
            maxRetries: config.maxRetries ?? 3,
            retryDelay: config.retryDelay ?? 1000,
            exponentialBackoff: config.exponentialBackoff ?? true,
            onRetry: config.onRetry ?? (() => { }),
            onFailure: config.onFailure ?? (() => { })
        };
    }

    /**
     * Execute function with retry logic
     */
    async executeWithRetry<T>(
        key: string,
        fn: () => Promise<T>,
        error?: LiveAPIError
    ): Promise<T> {
        const attempt = this.retryCount.get(key) || 0;

        if (attempt >= this.config.maxRetries) {
            log.error(`Max retries (${this.config.maxRetries}) reached for: ${key}`);
            this.retryCount.delete(key);
            if (error) {
                this.config.onFailure(error);
            }
            throw new Error(`Max retries reached for: ${key}`);
        }

        this.retryCount.set(key, attempt + 1);

        if (attempt > 0 && error) {
            this.config.onRetry(attempt, error);
            const delay = this.config.exponentialBackoff
                ? this.config.retryDelay * Math.pow(2, attempt - 1)
                : this.config.retryDelay;

            log.info(`Retrying ${key} (attempt ${attempt + 1}/${this.config.maxRetries}) after ${delay}ms`);
            await this.sleep(delay);
        }

        try {
            const result = await fn();
            this.retryCount.delete(key);
            return result;
        } catch (err) {
            log.error(`Attempt ${attempt + 1} failed for ${key}`, err);
            throw err;
        }
    }

    /**
     * Reset retry count for a key
     */
    reset(key: string): void {
        this.retryCount.delete(key);
    }

    /**
     * Reset all retry counts
     */
    resetAll(): void {
        this.retryCount.clear();
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Microphone permission error handler
 */
export class MicrophonePermissionHandler {
    /**
     * Handle permission denied scenario
     */
    static handlePermissionDenied(): {
        message: string;
        actions: Array<{ label: string; action: () => void }>;
    } {
        log.warn('Microphone permission denied by user');

        return {
            message: 'Microphone access is required for voice mode. Please grant permission to continue.',
            actions: [
                {
                    label: 'Request Again',
                    action: () => {
                        log.info('User requested mic permission again');
                        // Permission will be re-requested on next attempt
                    }
                },
                {
                    label: 'Open Settings',
                    action: () => {
                        log.info('Opening Chrome settings for mic permissions');
                        // Open Chrome settings page for site permissions
                        const settingsUrl = 'chrome://settings/content/microphone';
                        chrome.tabs.create({ url: settingsUrl });
                    }
                }
            ]
        };
    }

    /**
     * Check if microphone is available
     */
    static async checkAvailability(): Promise<{
        available: boolean;
        error?: string;
    }> {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return {
                    available: false,
                    error: 'getUserMedia is not supported in this browser'
                };
            }

            // Try to enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasAudioInput = devices.some(device => device.kind === 'audioinput');

            if (!hasAudioInput) {
                return {
                    available: false,
                    error: 'No microphone detected on this device'
                };
            }

            return { available: true };
        } catch (error) {
            log.error('Failed to check microphone availability', error);
            return {
                available: false,
                error: 'Failed to check microphone availability: ' + (error as Error).message
            };
        }
    }
}

/**
 * WebSocket connection error handler
 */
export class WebSocketConnectionHandler {
    private reconnectTimer: NodeJS.Timeout | null = null;
    private recoveryManager: ErrorRecoveryManager;

    constructor(recoveryManager: ErrorRecoveryManager) {
        this.recoveryManager = recoveryManager;
    }

    /**
     * Handle connection failure with auto-retry
     */
    async handleConnectionFailure(
        reconnectFn: () => Promise<void>,
        onStatusChange: (status: string) => void
    ): Promise<void> {
        log.warn('WebSocket connection failed, attempting to reconnect...');
        onStatusChange('Reconnecting...');

        try {
            await this.recoveryManager.executeWithRetry(
                'websocket-connection',
                reconnectFn
            );
            onStatusChange('Connected');
            log.info('WebSocket reconnected successfully');
        } catch (error) {
            log.error('Failed to reconnect after max retries', error);
            onStatusChange('Connection Failed');
            throw error;
        }
    }

    /**
     * Handle GoAway message from server
     */
    handleGoAway(reason: string, onWarning: (message: string) => void): void {
        log.warn('Received GoAway from server', { reason });

        const warningMessage = reason === 'SESSION_LIMIT_EXCEEDED'
            ? 'Session limit reached. The conversation will end soon.'
            : `Server is closing the connection: ${reason}`;

        onWarning(warningMessage);
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}

/**
 * Audio context error handler
 */
export class AudioContextHandler {
    /**
     * Handle suspended audio context
     */
    static async handleSuspended(
        context: AudioContext,
        onWarning: (message: string) => void
    ): Promise<void> {
        if (context.state === 'suspended') {
            log.warn('AudioContext is suspended, attempting to resume...');
            onWarning('Audio is paused. Click anywhere to resume.');

            try {
                await context.resume();
                log.info('AudioContext resumed successfully');
            } catch (error) {
                log.error('Failed to resume AudioContext', error);
                throw new Error('Failed to resume audio: ' + (error as Error).message);
            }
        }
    }

    /**
     * Monitor audio context state changes
     */
    static monitorState(
        context: AudioContext,
        onStateChange: (state: AudioContextState) => void
    ): () => void {
        const handler = () => {
            log.debug('AudioContext state changed:', context.state);
            onStateChange(context.state);
        };

        context.addEventListener('statechange', handler);

        return () => {
            context.removeEventListener('statechange', handler);
        };
    }
}

/**
 * Tool execution error handler
 */
export class ToolExecutionHandler {
    /**
     * Handle tool execution error
     */
    static handleToolError(
        toolName: string,
        error: Error,
        args: any
    ): {
        errorResponse: any;
        shouldRetry: boolean;
    } {
        log.error(`Tool execution failed: ${toolName}`, { error, args });

        // Categorize error
        const isRetryable = this.isRetryableError(error);
        const errorMessage = this.formatErrorMessage(toolName, error);

        return {
            errorResponse: {
                error: errorMessage,
                details: error.message,
                toolName,
                args
            },
            shouldRetry: isRetryable
        };
    }

    /**
     * Check if error is retryable
     */
    private static isRetryableError(error: Error): boolean {
        const retryablePatterns = [
            /timeout/i,
            /network/i,
            /connection/i,
            /ECONNRESET/i,
            /ETIMEDOUT/i
        ];

        return retryablePatterns.some(pattern =>
            pattern.test(error.message) || pattern.test(error.name)
        );
    }

    /**
     * Format error message for AI
     */
    private static formatErrorMessage(toolName: string, error: Error): string {
        const message = error.message || 'Unknown error';
        return `Failed to execute ${toolName}: ${message}. Please try again or use a different approach.`;
    }
}

/**
 * Side panel lifecycle handler
 */
export class SidePanelLifecycleHandler {
    private cleanupFunctions: Array<() => void> = [];

    /**
     * Register cleanup function
     */
    registerCleanup(fn: () => void): void {
        this.cleanupFunctions.push(fn);
    }

    /**
     * Handle side panel close
     */
    async handleClose(): Promise<void> {
        log.info('Side panel closing, running cleanup functions...');

        for (const cleanup of this.cleanupFunctions) {
            try {
                cleanup();
            } catch (error) {
                log.error('Cleanup function failed', error);
            }
        }

        this.cleanupFunctions = [];
        log.info('Cleanup complete');
    }

    /**
     * Setup beforeunload handler
     */
    setupBeforeUnload(window: Window): void {
        window.addEventListener('beforeunload', async () => {
            await this.handleClose();
        });
    }
}

/**
 * Tab visibility handler
 */
export class TabVisibilityHandler {
    private visibilityListener: (() => void) | null = null;

    /**
     * Monitor tab visibility changes
     */
    monitorVisibility(
        onVisible: () => void,
        onHidden: () => void
    ): () => void {
        this.visibilityListener = () => {
            if (document.hidden) {
                log.debug('Tab is now hidden');
                onHidden();
            } else {
                log.debug('Tab is now visible');
                onVisible();
            }
        };

        document.addEventListener('visibilitychange', this.visibilityListener);

        return () => {
            if (this.visibilityListener) {
                document.removeEventListener('visibilitychange', this.visibilityListener);
                this.visibilityListener = null;
            }
        };
    }

    /**
     * Handle tab suspended (extension-specific)
     */
    handleTabSuspended(
        onSuspend: () => void,
        onResume: () => void
    ): void {
        // Chrome extensions can detect when their pages are suspended
        // This is particularly important for side panels

        if (document.hidden) {
            onSuspend();
        }

        this.monitorVisibility(onResume, onSuspend);
    }
}

/**
 * Mode switching guard
 */
export class ModeSwitchGuard {
    private lastSwitchTime = 0;
    private switchDebounceMs = 500;
    private isSwitching = false;

    /**
     * Check if mode switch is allowed
     */
    canSwitch(): boolean {
        const now = Date.now();
        const timeSinceLastSwitch = now - this.lastSwitchTime;

        if (timeSinceLastSwitch < this.switchDebounceMs) {
            log.warn('Mode switch debounced - too frequent');
            return false;
        }

        if (this.isSwitching) {
            log.warn('Mode switch already in progress');
            return false;
        }

        return true;
    }

    /**
     * Execute mode switch with guard
     */
    async executeSwitch(
        cleanupFn: () => Promise<void>,
        switchFn: () => Promise<void>
    ): Promise<void> {
        if (!this.canSwitch()) {
            throw new Error('Mode switch not allowed - please wait');
        }

        this.isSwitching = true;
        this.lastSwitchTime = Date.now();

        try {
            log.info('Executing mode switch...');

            // Cleanup current mode
            await cleanupFn();

            // Small delay to ensure cleanup is complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Switch to new mode
            await switchFn();

            log.info('Mode switch complete');
        } finally {
            this.isSwitching = false;
        }
    }

    /**
     * Reset guard state
     */
    reset(): void {
        this.isSwitching = false;
        this.lastSwitchTime = 0;
    }
}

/**
 * Comprehensive error handler coordinator
 */
export class GeminiLiveErrorHandler {
    private recoveryManager: ErrorRecoveryManager;
    private wsHandler: WebSocketConnectionHandler;
    private lifecycleHandler: SidePanelLifecycleHandler;
    private visibilityHandler: TabVisibilityHandler;
    private modeSwitchGuard: ModeSwitchGuard;

    constructor(config?: ErrorRecoveryConfig) {
        this.recoveryManager = new ErrorRecoveryManager(config);
        this.wsHandler = new WebSocketConnectionHandler(this.recoveryManager);
        this.lifecycleHandler = new SidePanelLifecycleHandler();
        this.visibilityHandler = new TabVisibilityHandler();
        this.modeSwitchGuard = new ModeSwitchGuard();
    }

    getRecoveryManager(): ErrorRecoveryManager {
        return this.recoveryManager;
    }

    getWebSocketHandler(): WebSocketConnectionHandler {
        return this.wsHandler;
    }

    getLifecycleHandler(): SidePanelLifecycleHandler {
        return this.lifecycleHandler;
    }

    getVisibilityHandler(): TabVisibilityHandler {
        return this.visibilityHandler;
    }

    getModeSwitchGuard(): ModeSwitchGuard {
        return this.modeSwitchGuard;
    }

    /**
     * Cleanup all handlers
     */
    cleanup(): void {
        this.wsHandler.cleanup();
        this.lifecycleHandler.handleClose();
        this.modeSwitchGuard.reset();
    }
}

export default GeminiLiveErrorHandler;
