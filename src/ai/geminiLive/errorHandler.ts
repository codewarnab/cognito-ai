/**
 * Error Handler for Gemini Live API
 * Phase 9: Comprehensive error handling and edge cases
 * Phase 3 Enhancement: Integration with centralized error system
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

import { createLogger } from '@logger';
import {
    APIError,
    NetworkError,
    BrowserAPIError,
    RetryManager,
    RetryPresets,
    buildUserMessage,
    formatErrorInline,
    parseError,
    isRetryableError,
    type RetryConfig,
} from '../../errors';

const log = createLogger('ErrorHandler');

// Error recovery strategies
export enum RecoveryStrategy {
    RETRY = 'retry',
    FALLBACK = 'fallback',
    MANUAL_INTERVENTION = 'manual',
    IGNORE = 'ignore'
}

// Use centralized RetryConfig, but provide a compatible interface for backward compatibility
export type ErrorRecoveryConfig = RetryConfig;

/**
 * Error recovery manager
 * Now uses centralized RetryManager with exponential backoff
 */
export class ErrorRecoveryManager {
    private retryManagers = new Map<string, RetryManager>();
    private config: RetryConfig;

    constructor(config: RetryConfig = {}) {
        this.config = {
            ...RetryPresets.Standard,
            ...config,
        };
    }

    /**
     * Get or create a retry manager for a specific key
     */
    private getRetryManager(key: string): RetryManager {
        if (!this.retryManagers.has(key)) {
            this.retryManagers.set(key, new RetryManager(this.config));
        }
        return this.retryManagers.get(key)!;
    }

    /**
     * Execute function with retry logic using centralized retry manager
     */
    async executeWithRetry<T>(
        key: string,
        fn: () => Promise<T>,
        customConfig?: RetryConfig
    ): Promise<T> {
        const retryManager = customConfig
            ? new RetryManager({ ...this.config, ...customConfig })
            : this.getRetryManager(key);

        try {
            return await retryManager.execute(fn, key);
        } catch (error) {
            log.error(`Max retries reached for: ${key}`, error);
            throw error;
        }
    }

    /**
     * Reset retry count for a key
     */
    reset(key: string): void {
        this.retryManagers.delete(key);
    }

    /**
     * Reset all retry counts
     */
    resetAll(): void {
        this.retryManagers.clear();
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
 * Enhanced with centralized error types and improved error detection
 */
export class WebSocketConnectionHandler {
    private reconnectTimer: NodeJS.Timeout | null = null;
    private recoveryManager: ErrorRecoveryManager;

    constructor(recoveryManager: ErrorRecoveryManager) {
        this.recoveryManager = recoveryManager;
    }

    /**
     * Handle connection failure with auto-retry and typed errors
     */
    async handleConnectionFailure(
        reconnectFn: () => Promise<void>,
        onStatusChange: (status: string) => void,
        errorDetails?: { code?: number; reason?: string }
    ): Promise<void> {
        // Create appropriate error based on failure reason
        const error = this.categorizeConnectionError(errorDetails);

        log.warn('WebSocket connection failed', { error: error.message, errorDetails });

        // Show user-friendly message
        const userMessage = buildUserMessage(error);
        onStatusChange(userMessage);

        try {
            await this.recoveryManager.executeWithRetry(
                'websocket-connection',
                reconnectFn,
                {
                    onRetry: (attempt, _delay, _err) => {
                        const retriesLeft = 3 - attempt; // Default max retries is 3
                        onStatusChange(`Reconnecting... (${retriesLeft} attempts remaining)`);
                    },
                    onCountdown: (remainingMs, _attempt) => {
                        const seconds = Math.ceil(remainingMs / 1000);
                        if (seconds > 0) {
                            onStatusChange(`Retrying in ${seconds}s...`);
                        }
                    }
                }
            );
            onStatusChange('Connected');
            log.info('WebSocket reconnected successfully');
        } catch (error) {
            log.error('Failed to reconnect after max retries', error);
            const finalError = parseError(error, { context: 'websocket' });
            onStatusChange(buildUserMessage(finalError));
            throw error;
        }
    }

    /**
     * Categorize WebSocket errors into typed errors
     */
    private categorizeConnectionError(details?: { code?: number; reason?: string }): Error {
        if (!details) {
            return NetworkError.connectionReset('WebSocket connection failed');
        }

        const { code, reason } = details;

        // Connection refused (ECONNREFUSED)
        if (reason?.includes('ECONNREFUSED') || code === 1006) {
            return NetworkError.connectionReset('WebSocket connection refused by server');
        }

        // Timeout (ETIMEDOUT)
        if (reason?.includes('ETIMEDOUT') || reason?.includes('timeout')) {
            return NetworkError.timeout('WebSocket connection timed out');
        }

        // Rate limiting
        if (code === 1008 || reason?.toLowerCase().includes('rate') || reason?.toLowerCase().includes('429')) {
            return APIError.rateLimitExceeded(undefined, 'WebSocket rate limit exceeded');
        }

        // Session limit exceeded (already handled, but now with typed error)
        if (reason === 'SESSION_LIMIT_EXCEEDED') {
            return APIError.quotaExceeded('WebSocket session limit exceeded');
        }

        // Auth errors
        if (code === 1008 || reason?.toLowerCase().includes('auth') || reason?.toLowerCase().includes('401')) {
            return APIError.authFailed('WebSocket authentication failed');
        }

        // Server errors
        if (code && code >= 1011 && code <= 1015) {
            return APIError.serverError(code, `WebSocket server error: ${reason || 'Unknown'}`);
        }

        // Generic network error
        return NetworkError.connectionReset(`WebSocket closed: ${reason || `Code ${code}`}`);
    }

    /**
     * Handle GoAway message from server with user-friendly explanations
     */
    handleGoAway(reason: string, onWarning: (message: string) => void): void {
        log.warn('Received GoAway from server', { reason });

        let error: Error;
        if (reason === 'SESSION_LIMIT_EXCEEDED') {
            error = APIError.quotaExceeded('The session limit has been reached. The conversation will end soon.');
        } else {
            error = NetworkError.connectionReset(`Server is closing the connection: ${reason}`);
        }

        const userMessage = buildUserMessage(error);
        onWarning(userMessage);
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
 * Enhanced with comprehensive error categorization and retry logic
 */
export class ToolExecutionHandler {
    /**
     * Handle tool execution error with categorization and formatting
     */
    static handleToolError(
        toolName: string,
        error: Error,
        args: any
    ): {
        errorResponse: any;
        shouldRetry: boolean;
        formattedError: string;
    } {
        log.error(`Tool execution failed: ${toolName}`, { error, args });

        // Parse and categorize the error
        const typedError = this.categorizeToolError(error, toolName);
        const shouldRetry = isRetryableError(typedError);

        // Build user-friendly message
        const userMessage = buildUserMessage(typedError, {
            toolName,
            reason: error.message,
        });

        // Build formatted error for inline display
        const formattedError = formatErrorInline(typedError, {
            toolName,
            args: JSON.stringify(args).substring(0, 100),
        });

        return {
            errorResponse: {
                error: userMessage,
                details: error.message,
                toolName,
                args,
                retryable: shouldRetry,
                errorCode: typedError instanceof BrowserAPIError ||
                    typedError instanceof NetworkError ||
                    typedError instanceof APIError
                    ? (typedError as any).errorCode
                    : 'UNKNOWN_ERROR',
            },
            shouldRetry,
            formattedError,
        };
    }

    /**
     * Categorize tool errors into typed errors
     */
    private static categorizeToolError(error: Error, toolName: string): Error {
        const message = error.message.toLowerCase();

        // Network errors
        if (message.includes('timeout') || message.includes('etimedout')) {
            return NetworkError.timeout(`Tool ${toolName} timed out: ${error.message}`);
        }
        if (message.includes('network') || message.includes('econnreset')) {
            return NetworkError.connectionReset(`Network error in ${toolName}: ${error.message}`);
        }
        if (message.includes('enotfound') || message.includes('dns')) {
            return NetworkError.dnsFailed(`DNS error in ${toolName}: ${error.message}`);
        }

        // Permission errors
        if (message.includes('permission denied') || message.includes('notallowederror')) {
            return BrowserAPIError.permissionDenied(toolName, error.message);
        }
        if (message.includes('tab') && message.includes('access')) {
            return BrowserAPIError.tabAccessDenied(`Cannot access tab in ${toolName}: ${error.message}`);
        }

        // API errors
        if (message.includes('rate limit') || message.includes('429')) {
            return APIError.rateLimitExceeded(undefined, `Rate limit in ${toolName}: ${error.message}`);
        }
        if (message.includes('quota') || message.includes('403')) {
            return APIError.quotaExceeded(`Quota exceeded in ${toolName}: ${error.message}`);
        }
        if (message.includes('unauthorized') || message.includes('401')) {
            return APIError.authFailed(`Auth failed in ${toolName}: ${error.message}`);
        }

        // Validation errors (malformed arguments)
        if (message.includes('invalid') || message.includes('malformed') || message.includes('validation')) {
            return APIError.malformedFunctionCall(
                `Invalid arguments for ${toolName}: ${error.message}`,
                toolName
            );
        }

        // Return original error if no specific categorization
        return error;
    }

    /**
     * Check if error is retryable (enhanced patterns)
     */
    static isRetryableError(error: Error): boolean {
        // Use centralized retry logic first
        if (isRetryableError(error)) {
            return true;
        }

        // Additional patterns specific to tool execution
        const retryablePatterns = [
            /timeout/i,
            /network/i,
            /connection/i,
            /ECONNRESET/i,
            /ETIMEDOUT/i,
            /rate.*limit/i,
            /429/i,
            /quota.*exceeded/i,
            /403/i,
            /server.*error/i,
            /503/i,
            /502/i,
            /500/i,
        ];

        return retryablePatterns.some(pattern =>
            pattern.test(error.message) || pattern.test(error.name)
        );
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
 * Enhanced with centralized error system integration
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
     * Parse any error into a typed error for better handling
     */
    parseError(error: unknown, context?: {
        toolName?: string;
        serverName?: string;
        statusCode?: number;
    }): Error {
        return parseError(error, {
            context: 'gemini-live',
            ...context,
        });
    }

    /**
     * Format error for display in UI
     */
    formatErrorForUI(error: Error, variables?: Record<string, any>): string {
        return formatErrorInline(error, variables);
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(error: Error, variables?: Record<string, any>): string {
        return buildUserMessage(error, variables);
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
