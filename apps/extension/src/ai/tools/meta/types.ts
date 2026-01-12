/**
 * Types for Adaptive Mode tool call tracking
 * 
 * These types enable tracking and rendering of tool calls made during
 * sandbox execution in a way that's visually identical to normal tool calls.
 */

/**
 * Represents a tool call made during executeTools execution
 */
export interface TrackedToolCall {
    /** Unique ID for this tool call */
    callId: string;
    /** Name of the tool (e.g., "webSearch") */
    toolName: string;
    /** Input arguments passed to the tool */
    input: Record<string, unknown>;
    /** Output from the tool (undefined while executing) */
    output?: Record<string, unknown>;
    /** Execution state */
    state: 'loading' | 'pending-approval' | 'success' | 'error';
    /** Error message if state is 'error' */
    errorText?: string;
    /** Timestamp when tool call started */
    startTime: number;
    /** Duration in milliseconds (set when complete) */
    durationMs?: number;
}

/**
 * Enhanced result from executeTools that includes tracked tool calls
 */
export interface ExecuteToolsResult {
    /** Stringified output from code execution */
    output: string;
    /** Whether execution was successful */
    success: boolean;
    /** Error message if unsuccessful */
    error?: string;
    /** List of all tool calls made during execution */
    toolCalls?: TrackedToolCall[];
}
