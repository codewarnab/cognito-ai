// ============================================================================
// Constants
// ============================================================================

/** Default timeout for code execution in milliseconds */
export const DEFAULT_TIMEOUT_MS = 150_000;

/** Timeout for waiting for sandbox to be ready */
export const SANDBOX_READY_TIMEOUT_MS = 5_000;

/** Health check interval in milliseconds */
export const HEALTH_CHECK_INTERVAL_MS = 10_000;

/** Maximum consecutive failures before sandbox restart */
export const MAX_CONSECUTIVE_FAILURES = 3;

/** Timeout for individual tool execution */
export const TOOL_EXECUTION_TIMEOUT_MS = 120_000;
