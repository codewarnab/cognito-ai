/**
 * Shared Types for Actions
 * Common patterns used across tool implementations
 */

/**
 * Standard result type for tool execution.
 * All tools should return this structure for consistency.
 */
export interface ToolResult<T = unknown> {
    /** Whether the operation succeeded */
    success: boolean;
    /** Result data (only present on success) */
    data?: T;
    /** Error message (only present on failure) */
    error?: string;
    /** Additional details for debugging */
    details?: string;
    /** Suggestion for error recovery */
    suggestion?: string;
    /** Human-readable success/status message */
    message?: string;
}

/**
 * Standard abort signal handler type.
 * Used for tools that support cancellation.
 */
export type AbortableExecutor<TInput, TOutput> = (
    input: TInput,
    signal?: AbortSignal
) => Promise<TOutput>;

/**
 * Error result helper type - standardized error response structure.
 */
export interface ErrorResult {
    success: false;
    error: string;
    details?: string;
    suggestion?: string;
}

/**
 * Success result helper type - standardized success response structure.
 */
export interface SuccessResult<T = unknown> {
    success: true;
    data?: T;
    message?: string;
}

/**
 * Common element info returned by DOM interaction tools
 */
export interface ElementInfo {
    tagName: string;
    id?: string;
    className?: string;
    text?: string;
    href?: string;
    type?: string;
    placeholder?: string;
}

/**
 * Result type for click/interaction operations
 */
export interface InteractionResult extends ToolResult {
    /** Element that was interacted with */
    clicked?: ElementInfo;
    /** Whether the frame was removed (page navigating) */
    frameRemoved?: boolean;
}

/**
 * Result type for navigation operations
 */
export interface NavigationResult extends ToolResult {
    action?: 'opened_new_tab' | 'opened_current_tab' | 'switched_to_tab';
    tabId?: number;
    url?: string;
}

/**
 * Result type for scroll operations
 */
export interface ScrollResult extends ToolResult {
    direction?: string;
    scrolledFrom?: number;
    scrolledTo?: number;
    scrollDistance?: number;
}

/**
 * Result type for typing operations
 */
export interface TypeResult extends ToolResult {
    typed?: number;
    target?: ElementInfo;
    bypassedRestriction?: boolean;
    restrictionType?: string;
}

/**
 * Screenshot error types for granular error handling
 */
export type ScreenshotErrorType =
    | 'PERMISSION_DENIED'
    | 'PERMISSION_CHECK_FAILED'
    | 'NO_ACTIVE_TAB'
    | 'INVALID_TAB_ID'
    | 'INVALID_WINDOW_ID'
    | 'TAB_QUERY_FAILED'
    | 'RESTRICTED_PAGE'
    | 'NO_URL'
    | 'EMPTY_SCREENSHOT'
    | 'INVALID_FORMAT'
    | 'CAPTURE_FAILED'
    | 'CAPTURE_PERMISSION_DENIED'
    | 'TAB_NOT_ACTIVE'
    | 'WINDOW_STATE_ERROR';

/**
 * Result type for screenshot operations
 */
export interface ScreenshotResult extends ToolResult {
    /** Screenshot data URL */
    screenshot?: string;
    /** Compressed screenshot for AI */
    screenshotForAI?: string;
    /** Error type for granular handling */
    errorType?: ScreenshotErrorType;
    /** Additional error details */
    errorDetails?: string;
    /** Tab URL */
    url?: string;
    /** Tab title */
    title?: string;
    /** Tab ID */
    tabId?: number;
    /** Window ID */
    windowId?: number;
    /** Whether sensitive fields were blurred */
    sensitiveFieldsBlurred?: number;
}

/**
 * Result type for research session operations
 */
export interface ResearchSessionResult extends ToolResult {
    sessionId?: string;
}

/**
 * Result type for reminder operations
 */
export interface ReminderResult extends ToolResult {
    reminderId?: string;
    title?: string;
    when?: number;
}

/**
 * Helper function to create a success result
 */
export function createSuccessResult<T>(data?: T, message?: string): SuccessResult<T> {
    return { success: true, data, message };
}

/**
 * Helper function to create an error result
 */
export function createErrorResult(error: string, details?: string, suggestion?: string): ErrorResult {
    return { success: false, error, details, suggestion };
}

/**
 * Helper function to create error with hints (used by bookmarksTool)
 */
export function errorWithHints(message: string, hints: string[]): ErrorResult {
    return {
        success: false,
        error: `${message}\nHints:\n${hints.map(h => `- ${h}`).join('\n')}`
    };
}
