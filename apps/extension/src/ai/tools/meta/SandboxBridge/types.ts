import type { TrackedToolCall } from '../types';

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
    /** Detailed error information from sandbox */
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

export type SandboxMessage = ExecuteResultMessage | ToolRequestMessage | SandboxReadyMessage;

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
    /** Tracked tool calls made during execution */
    toolCalls?: TrackedToolCall[];
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
    /** Tracked tool calls for this execution */
    trackedToolCalls?: TrackedToolCall[];
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
