/**
 * Sandbox Bridge
 * 
 * Manages communication between the main extension thread and the sandboxed
 * iframe for dynamic code execution. This allows executeTools to run code
 * safely in a sandbox that permits `new Function()` and `eval()`.
 * 
 * Architecture:
 * - Main thread sends code to sandbox via postMessage
 * - Sandbox executes code and sends results back
 * - Tool calls from sandbox are proxied back to main thread
 * 
 * Phase 5 Enhancements:
 * - Sandbox crash/unresponsive detection
 * - Proper cleanup on abort
 * - Detailed error messages for debugging
 * - JSON serialization edge case handling
 */

import { createLogger } from '~logger';
import { safeSerialize, safeDeserialize, formatError } from './serializationUtils';

const log = createLogger('SandboxBridge');

// ============================================================================
// Types
// ============================================================================

export interface ExecuteCodeMessage {
    type: 'EXECUTE_CODE';
    requestId: string;
    code: string;
    availableTools: string[];
}

export interface ToolResultMessage {
    type: 'TOOL_RESULT';
    callId: string;
    result?: unknown;
    error?: string;
}

export interface ExecuteResultMessage {
    type: 'EXECUTE_RESULT';
    requestId: string;
    success: boolean;
    result?: unknown;
    error?: string;
    /** Phase 5: Detailed error information from sandbox */
    errorDetails?: {
        type: string;
        stack?: string;
    };
}

export interface ToolRequestMessage {
    type: 'TOOL_REQUEST';
    requestId: string;
    callId: string;
    toolName: string;
    args: unknown[];
}

export interface SandboxReadyMessage {
    type: 'SANDBOX_READY';
}

type SandboxMessage = ExecuteResultMessage | ToolRequestMessage | SandboxReadyMessage;

export interface ExecutionResult {
    success: boolean;
    result?: unknown;
    error?: string;
    /** Error code for programmatic handling */
    errorCode?: SandboxErrorCode;
    /** Detailed error information for debugging */
    errorDetails?: {
        type: string;
        stack?: string;
        context?: Record<string, unknown>;
    };
}

export interface PendingRequest {
    resolve: (result: ExecutionResult) => void;
    reject: (error: Error) => void;
    toolExecutor?: (toolName: string, args: unknown[]) => Promise<unknown>;
    /** Abort controller for this request */
    abortController?: AbortController;
    /** Timestamp when request was created */
    createdAt: number;
    /** Request ID for logging */
    requestId: string;
}

// ============================================================================
// Error Codes
// ============================================================================

/** Error codes for sandbox execution failures */
export enum SandboxErrorCode {
    /** Sandbox failed to initialize */
    INIT_FAILED = 'SANDBOX_INIT_FAILED',
    /** Sandbox became unresponsive */
    UNRESPONSIVE = 'SANDBOX_UNRESPONSIVE',
    /** Execution timed out */
    TIMEOUT = 'SANDBOX_TIMEOUT',
    /** Iframe not available */
    IFRAME_UNAVAILABLE = 'SANDBOX_IFRAME_UNAVAILABLE',
    /** Execution was aborted */
    ABORTED = 'SANDBOX_ABORTED',
    /** Serialization error */
    SERIALIZATION_ERROR = 'SANDBOX_SERIALIZATION_ERROR',
    /** Code execution error */
    EXECUTION_ERROR = 'SANDBOX_EXECUTION_ERROR',
    /** Tool execution error */
    TOOL_ERROR = 'SANDBOX_TOOL_ERROR',
    /** Unknown error */
    UNKNOWN = 'SANDBOX_UNKNOWN_ERROR',
}

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for code execution in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Timeout for waiting for sandbox to be ready */
const SANDBOX_READY_TIMEOUT_MS = 5_000;

/** Health check interval in milliseconds */
const HEALTH_CHECK_INTERVAL_MS = 10_000;

/** Maximum consecutive failures before sandbox restart */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Timeout for individual tool execution */
const TOOL_EXECUTION_TIMEOUT_MS = 60_000;

// ============================================================================
// SandboxBridge Singleton
// ============================================================================

/**
 * Bridge class that manages the sandboxed iframe and message passing.
 * Uses singleton pattern to reuse the iframe across executions.
 * 
 * Phase 5 Features:
 * - Health monitoring and automatic recovery
 * - Abort signal support
 * - Safe serialization of results
 * - Detailed error reporting
 */
class SandboxBridge {
    private static instance: SandboxBridge | null = null;

    private iframe: HTMLIFrameElement | null = null;
    private isReady = false;
    private readyPromise: Promise<void> | null = null;
    private pendingRequests = new Map<string, PendingRequest>();
    private requestIdCounter = 0;
    private messageHandler: ((event: MessageEvent) => void) | null = null;

    // Phase 5: Health monitoring
    private consecutiveFailures = 0;
    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private lastSuccessfulExecution: number = Date.now();

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get the singleton instance of SandboxBridge
     */
    static getInstance(): SandboxBridge {
        if (!SandboxBridge.instance) {
            SandboxBridge.instance = new SandboxBridge();
        }
        return SandboxBridge.instance;
    }

    /**
     * Initialize the sandbox bridge by creating the hidden iframe
     * and setting up message listeners.
     */
    async initialize(): Promise<void> {
        if (this.isReady) {
            return;
        }

        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = this.setupSandbox();
        await this.readyPromise;
    }

    /**
     * Create the hidden iframe and wait for it to be ready.
     */
    private async setupSandbox(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Create the iframe if it doesn't exist
            if (!this.iframe) {
                this.iframe = document.createElement('iframe');
                this.iframe.id = 'sandbox-executor-frame';
                this.iframe.style.display = 'none';
                this.iframe.style.width = '0';
                this.iframe.style.height = '0';
                this.iframe.style.border = 'none';
                this.iframe.style.position = 'absolute';
                this.iframe.style.top = '-9999px';
                this.iframe.style.left = '-9999px';

                // Set the sandbox page URL
                // WXT compiles entrypoints to root, so the path is just the filename
                this.iframe.src = chrome.runtime.getURL('sandbox-executor.html');

                document.body.appendChild(this.iframe);
                log.info('Created sandbox iframe');
            }

            // Set up message listener
            this.messageHandler = (event: MessageEvent<SandboxMessage>) => {
                this.handleMessage(event);
            };
            window.addEventListener('message', this.messageHandler);

            // Wait for sandbox ready message with timeout
            const timeoutId = setTimeout(() => {
                reject(new Error('Sandbox initialization timed out'));
            }, SANDBOX_READY_TIMEOUT_MS);

            // Store the timeout ID so we can clear it when ready
            const checkReady = (event: MessageEvent<SandboxMessage>) => {
                if (event.data?.type === 'SANDBOX_READY') {
                    clearTimeout(timeoutId);
                    this.isReady = true;
                    log.info('Sandbox is ready');
                    resolve();
                }
            };

            window.addEventListener('message', checkReady, { once: false });

            // Also check periodically in case the message was already sent
            const checkInterval = setInterval(() => {
                if (this.isReady) {
                    clearInterval(checkInterval);
                }
            }, 100);

            // Clear interval on timeout
            setTimeout(() => clearInterval(checkInterval), SANDBOX_READY_TIMEOUT_MS);
        });
    }

    /**
     * Handle messages from the sandbox iframe.
     */
    private handleMessage(event: MessageEvent<SandboxMessage>): void {
        const data = event.data;

        if (!data || typeof data !== 'object' || !('type' in data)) {
            return;
        }

        switch (data.type) {
            case 'SANDBOX_READY':
                // Handled in setupSandbox
                break;

            case 'EXECUTE_RESULT': {
                const pending = this.pendingRequests.get(data.requestId);
                if (pending) {
                    this.pendingRequests.delete(data.requestId);
                    pending.resolve({
                        success: data.success,
                        result: data.result,
                        error: data.error,
                        errorCode: data.error ? SandboxErrorCode.EXECUTION_ERROR : undefined,
                        errorDetails: data.errorDetails,
                    });
                    log.debug('Received execution result:', {
                        requestId: data.requestId,
                        success: data.success,
                        hasErrorDetails: !!data.errorDetails,
                    });
                } else {
                    log.warn('Received result for unknown request:', data.requestId);
                }
                break;
            }

            case 'TOOL_REQUEST': {
                const pending = this.pendingRequests.get(data.requestId);
                if (pending && pending.toolExecutor) {
                    // Execute the tool and send result back to sandbox
                    this.executeToolRequest(data, pending.toolExecutor, pending);
                } else {
                    log.warn('Received tool request with no executor:', {
                        requestId: data.requestId,
                        toolName: data.toolName,
                    });
                    // Send error back to sandbox
                    this.sendToolResult(data.callId, undefined, 'No tool executor available');
                }
                break;
            }
        }
    }

    /**
     * Execute a tool request from the sandbox and send the result back.
     * Phase 5: Added timeout handling and safe serialization.
     */
    private async executeToolRequest(
        request: ToolRequestMessage,
        toolExecutor: (toolName: string, args: unknown[]) => Promise<unknown>,
        pending: PendingRequest
    ): Promise<void> {
        const startTime = Date.now();
        log.debug('Executing tool request:', {
            toolName: request.toolName,
            callId: request.callId,
        });

        try {
            // Check if request was aborted
            if (pending.abortController?.signal.aborted) {
                this.sendToolResult(request.callId, undefined, 'Request was aborted');
                return;
            }

            // Execute with timeout
            const result = await Promise.race([
                toolExecutor(request.toolName, request.args),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Tool execution timed out after ${TOOL_EXECUTION_TIMEOUT_MS}ms`)),
                        TOOL_EXECUTION_TIMEOUT_MS
                    )
                ),
            ]);

            // Safe serialize the result to handle edge cases
            const serializedResult = safeSerialize(result);
            this.sendToolResult(request.callId, serializedResult);

            const duration = Date.now() - startTime;
            log.debug('Tool execution completed:', {
                toolName: request.toolName,
                durationMs: duration,
            });
        } catch (error: unknown) {
            const errorInfo = formatError(error);
            log.error('Tool execution failed:', {
                toolName: request.toolName,
                error: errorInfo.message,
                type: errorInfo.type,
                durationMs: Date.now() - startTime,
            });

            // Send detailed error message
            const errorMessage = `${errorInfo.type}: ${errorInfo.message}`;
            this.sendToolResult(request.callId, undefined, errorMessage);
        }
    }

    /**
     * Send a tool result back to the sandbox.
     */
    private sendToolResult(callId: string, result?: unknown, error?: string): void {
        if (!this.iframe?.contentWindow) {
            log.error('Cannot send tool result: iframe not available');
            return;
        }

        const message: ToolResultMessage = {
            type: 'TOOL_RESULT',
            callId,
            result,
            error,
        };

        this.iframe.contentWindow.postMessage(message, '*');
    }

    /**
     * Generate a unique request ID.
     */
    private generateRequestId(): string {
        return `req-${Date.now()}-${++this.requestIdCounter}`;
    }

    /**
     * Send code to the sandbox for execution.
     * 
     * Phase 5: Enhanced with abort signal support, health monitoring, and detailed errors.
     * 
     * @param code JavaScript code to execute
     * @param availableTools List of tool names available in the sandbox
     * @param toolExecutor Function to execute tool calls from the sandbox
     * @param options Execution options including timeout and abort signal
     * @returns Promise resolving to the execution result
     */
    async executeCode(
        code: string,
        availableTools: string[],
        toolExecutor: (toolName: string, args: unknown[]) => Promise<unknown>,
        options: {
            timeoutMs?: number;
            abortSignal?: AbortSignal;
        } = {}
    ): Promise<ExecutionResult> {
        const { timeoutMs = DEFAULT_TIMEOUT_MS, abortSignal } = options;

        // Check if already aborted
        if (abortSignal?.aborted) {
            return {
                success: false,
                error: 'Operation was aborted before execution started',
                errorCode: SandboxErrorCode.ABORTED,
            };
        }

        // Ensure sandbox is ready
        try {
            await this.initialize();
        } catch (initError) {
            this.consecutiveFailures++;
            const errorInfo = formatError(initError);
            return {
                success: false,
                error: `Sandbox initialization failed: ${errorInfo.message}`,
                errorCode: SandboxErrorCode.INIT_FAILED,
                errorDetails: {
                    type: errorInfo.type,
                    stack: errorInfo.stack,
                },
            };
        }

        if (!this.iframe?.contentWindow) {
            this.consecutiveFailures++;
            return {
                success: false,
                error: 'Sandbox iframe not available. The sandbox may have crashed or been removed.',
                errorCode: SandboxErrorCode.IFRAME_UNAVAILABLE,
                errorDetails: {
                    type: 'IframeError',
                    context: {
                        iframeExists: !!this.iframe,
                        contentWindowExists: !!this.iframe?.contentWindow,
                    },
                },
            };
        }

        const requestId = this.generateRequestId();
        const abortController = new AbortController();

        return new Promise<ExecutionResult>((resolve) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                this.consecutiveFailures++;
                resolve({
                    success: false,
                    error: `Execution timed out after ${timeoutMs}ms. The sandbox may be unresponsive or the code is taking too long.`,
                    errorCode: SandboxErrorCode.TIMEOUT,
                    errorDetails: {
                        type: 'TimeoutError',
                        context: {
                            timeoutMs,
                            requestId,
                            pendingToolCalls: this.pendingRequests.size,
                        },
                    },
                });
            }, timeoutMs);

            // Set up abort handler
            const handleAbort = () => {
                this.pendingRequests.delete(requestId);
                clearTimeout(timeoutId);
                abortController.abort();
                resolve({
                    success: false,
                    error: 'Operation was aborted',
                    errorCode: SandboxErrorCode.ABORTED,
                });
            };

            if (abortSignal) {
                abortSignal.addEventListener('abort', handleAbort, { once: true });
            }

            // Store the pending request with all required properties
            this.pendingRequests.set(requestId, {
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    if (abortSignal) {
                        abortSignal.removeEventListener('abort', handleAbort);
                    }

                    // Track success/failure for health monitoring
                    if (result.success) {
                        this.consecutiveFailures = 0;
                        this.lastSuccessfulExecution = Date.now();
                    } else {
                        this.consecutiveFailures++;
                    }

                    // Check if we need to restart the sandbox
                    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                        log.warn('Too many consecutive failures, consider restarting sandbox', {
                            failures: this.consecutiveFailures,
                        });
                    }

                    // Deserialize the result if needed
                    const deserializedResult = result.result !== undefined
                        ? safeDeserialize(result.result)
                        : undefined;

                    resolve({
                        ...result,
                        result: deserializedResult,
                    });
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    if (abortSignal) {
                        abortSignal.removeEventListener('abort', handleAbort);
                    }
                    this.consecutiveFailures++;

                    const errorInfo = formatError(error);
                    resolve({
                        success: false,
                        error: errorInfo.message,
                        errorCode: SandboxErrorCode.EXECUTION_ERROR,
                        errorDetails: {
                            type: errorInfo.type,
                            stack: errorInfo.stack,
                        },
                    });
                },
                toolExecutor,
                abortController,
                createdAt: Date.now(),
                requestId,
            });

            // Send the code to sandbox
            const message: ExecuteCodeMessage = {
                type: 'EXECUTE_CODE',
                requestId,
                code,
                availableTools,
            };

            log.info('Sending code to sandbox:', {
                requestId,
                codeLength: code.length,
                toolCount: availableTools.length,
            });

            this.iframe!.contentWindow!.postMessage(message, '*');
        });
    }

    /**
     * Check if the sandbox is ready.
     */
    isInitialized(): boolean {
        return this.isReady;
    }

    /**
     * Get the health status of the sandbox.
     * Phase 5: Added for monitoring sandbox health.
     */
    getHealthStatus(): {
        isReady: boolean;
        consecutiveFailures: number;
        lastSuccessfulExecution: number;
        pendingRequests: number;
        timeSinceLastSuccess: number;
    } {
        return {
            isReady: this.isReady,
            consecutiveFailures: this.consecutiveFailures,
            lastSuccessfulExecution: this.lastSuccessfulExecution,
            pendingRequests: this.pendingRequests.size,
            timeSinceLastSuccess: Date.now() - this.lastSuccessfulExecution,
        };
    }

    /**
     * Start periodic health checking.
     * Phase 5: Added for automatic health monitoring.
     */
    startHealthCheck(): void {
        if (this.healthCheckInterval) {
            return; // Already running
        }

        this.healthCheckInterval = setInterval(() => {
            const health = this.getHealthStatus();

            // Log health status periodically
            if (health.consecutiveFailures > 0) {
                log.warn('Sandbox health check:', health);
            } else {
                log.debug('Sandbox health check:', health);
            }

            // Check if sandbox seems unresponsive
            if (health.isReady && health.pendingRequests > 0 &&
                health.timeSinceLastSuccess > HEALTH_CHECK_INTERVAL_MS * 3) {
                log.error('Sandbox appears unresponsive:', health);
            }

            // Auto-restart if too many failures
            if (health.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                log.warn('Attempting sandbox restart due to consecutive failures');
                this.restartSandbox();
            }
        }, HEALTH_CHECK_INTERVAL_MS);

        log.info('Started sandbox health check');
    }

    /**
     * Stop periodic health checking.
     */
    stopHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            log.info('Stopped sandbox health check');
        }
    }

    /**
     * Restart the sandbox iframe.
     * Phase 5: Added for recovery from crashes/unresponsive states.
     */
    private async restartSandbox(): Promise<void> {
        log.info('Restarting sandbox...');

        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests) {
            pending.reject(new Error('Sandbox restarted'));
            this.pendingRequests.delete(requestId);
        }

        // Remove old iframe
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }

        // Reset state
        this.isReady = false;
        this.readyPromise = null;
        this.consecutiveFailures = 0;

        // Reinitialize
        try {
            await this.initialize();
            log.info('Sandbox restarted successfully');
        } catch (error) {
            log.error('Failed to restart sandbox:', error);
        }
    }

    /**
     * Clean up resources. Call when the side panel is closed.
     */
    destroy(): void {
        // Stop health check first
        this.stopHealthCheck();

        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }

        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }

        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests) {
            pending.reject(new Error('Sandbox bridge destroyed'));
            this.pendingRequests.delete(requestId);
        }

        this.isReady = false;
        this.readyPromise = null;
        SandboxBridge.instance = null;

        log.info('Sandbox bridge destroyed');
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the SandboxBridge singleton instance.
 */
export function getSandboxBridge(): SandboxBridge {
    return SandboxBridge.getInstance();
}

/**
 * Execute code in the sandbox with access to tools.
 * This is the main entry point for sandbox code execution.
 * 
 * Phase 5: Enhanced with abort signal support and detailed error handling.
 * 
 * @param code JavaScript code to execute
 * @param availableTools List of tool names available
 * @param toolExecutor Function to execute tools (receives name and args)
 * @param options Execution options (timeout, abort signal)
 * @returns Promise resolving to execution result
 */
export async function executeInSandbox(
    code: string,
    availableTools: string[],
    toolExecutor: (toolName: string, args: unknown[]) => Promise<unknown>,
    options?: {
        timeoutMs?: number;
        abortSignal?: AbortSignal;
    }
): Promise<ExecutionResult> {
    const bridge = getSandboxBridge();
    return bridge.executeCode(code, availableTools, toolExecutor, options);
}

/**
 * Initialize the sandbox bridge. Call this early in the app lifecycle.
 */
export async function initializeSandbox(): Promise<void> {
    const bridge = getSandboxBridge();
    return bridge.initialize();
}

/**
 * Check if the sandbox is ready for code execution.
 */
export function isSandboxReady(): boolean {
    const bridge = getSandboxBridge();
    return bridge.isInitialized();
}

/**
 * Clean up sandbox resources.
 */
export function destroySandbox(): void {
    const bridge = getSandboxBridge();
    bridge.destroy();
}
