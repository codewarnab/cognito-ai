/**
 * Sandbox Executor
 * 
 * This script runs in a sandboxed iframe with a relaxed CSP that allows
 * `new Function()` and `eval()`. It has NO access to chrome.* APIs.
 * 
 * Communication:
 * - Receives code execution requests via postMessage
 * - Sends results back via postMessage
 * - Tool calls are proxied back to the main extension
 */

// ============================================================================
// Types
// ============================================================================

interface ExecuteCodeMessage {
    type: 'EXECUTE_CODE';
    requestId: string;
    code: string;
    availableTools: string[]; // List of tool names that can be called
}

interface ToolResultMessage {
    type: 'TOOL_RESULT';
    callId: string;
    result?: unknown;
    error?: string;
}

interface ExecuteResultMessage {
    type: 'EXECUTE_RESULT';
    requestId: string;
    success: boolean;
    result?: unknown;
    error?: string;
    /** Phase 5: Added for detailed error information */
    errorDetails?: {
        type: string;
        stack?: string;
    };
}

interface ToolRequestMessage {
    type: 'TOOL_REQUEST';
    requestId: string;
    callId: string;
    toolName: string;
    args: unknown[];
}

type IncomingMessage = ExecuteCodeMessage | ToolResultMessage;

// ============================================================================
// Pending Tool Calls Tracking
// ============================================================================

// Map of callId -> { resolve, reject } for pending tool calls
const pendingToolCalls = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}>();

let callIdCounter = 0;

// Current request ID for associating tool calls with the execution
let currentRequestId: string | null = null;

// ============================================================================
// Tool Proxy
// ============================================================================

/**
 * Creates a tools proxy object that sends tool requests via postMessage
 * and waits for results.
 */
function createToolsProxy(toolNames: string[], requestId: string): Record<string, (...args: unknown[]) => Promise<unknown>> {
    const proxy: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

    for (const toolName of toolNames) {
        proxy[toolName] = async (...args: unknown[]): Promise<unknown> => {
            const callId = `${requestId}-${++callIdCounter}`;

            return new Promise((resolve, reject) => {
                // Store the promise resolvers
                pendingToolCalls.set(callId, { resolve, reject });

                // Send the tool request to the parent (extension)
                const message: ToolRequestMessage = {
                    type: 'TOOL_REQUEST',
                    requestId,
                    callId,
                    toolName,
                    args,
                };

                parent.postMessage(message, '*');
            });
        };
    }

    return proxy;
}

// ============================================================================
// Safe Serialization (simplified version for sandbox - no external imports)
// ============================================================================

/**
 * Safely serialize a value to avoid circular references and non-serializable types.
 * This is a simplified version for the sandbox environment.
 */
function safeSerializeForPostMessage(value: unknown, maxDepth = 10): unknown {
    const seen = new WeakSet<object>();

    function serialize(val: unknown, depth: number): unknown {
        if (depth > maxDepth) return '[Max depth exceeded]';

        if (val === null) return null;
        if (val === undefined) return '[undefined]';
        if (typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') return val;
        if (typeof val === 'bigint') return `[BigInt: ${val.toString()}]`;
        if (typeof val === 'symbol') return `[Symbol: ${val.description || 'anonymous'}]`;
        if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`;

        if (typeof val === 'object') {
            if (seen.has(val)) return '[Circular Reference]';
            seen.add(val);

            if (val instanceof Error) {
                return {
                    __type: 'Error',
                    name: val.name,
                    message: val.message,
                    stack: val.stack,
                };
            }
            if (val instanceof Date) return { __type: 'Date', value: val.toISOString() };
            if (val instanceof RegExp) return { __type: 'RegExp', source: val.source, flags: val.flags };
            if (val instanceof Map) {
                const entries: [unknown, unknown][] = [];
                for (const [k, v] of val) {
                    entries.push([serialize(k, depth + 1), serialize(v, depth + 1)]);
                }
                return { __type: 'Map', entries };
            }
            if (val instanceof Set) {
                const values: unknown[] = [];
                for (const v of val) values.push(serialize(v, depth + 1));
                return { __type: 'Set', values };
            }
            if (val instanceof Promise) return '[Promise]';
            if (Array.isArray(val)) return val.map((item) => serialize(item, depth + 1));

            // Plain object
            const result: Record<string, unknown> = {};
            for (const key of Object.keys(val)) {
                try {
                    result[key] = serialize((val as Record<string, unknown>)[key], depth + 1);
                } catch {
                    result[key] = '[Error accessing property]';
                }
            }
            return result;
        }

        return '[Unknown type]';
    }

    try {
        return serialize(value, 0);
    } catch (error) {
        return { __type: 'SerializationError', message: String(error) };
    }
}

/**
 * Extract detailed error information.
 */
function extractErrorInfo(error: unknown): { message: string; type: string; stack?: string } {
    if (error instanceof Error) {
        return {
            message: error.message,
            type: error.name || 'Error',
            stack: error.stack,
        };
    }
    if (typeof error === 'string') {
        return { message: error, type: 'StringError' };
    }
    return { message: String(error), type: 'UnknownError' };
}

// ============================================================================
// Code Execution
// ============================================================================

/** Timeout for waiting for tool results */
const TOOL_CALL_TIMEOUT_MS = 60_000;

/**
 * Execute the provided code with the tools proxy available.
 * Phase 5: Enhanced with better error handling and safe serialization.
 */
async function executeCode(
    code: string,
    toolNames: string[],
    requestId: string
): Promise<{ success: boolean; result?: unknown; error?: string; errorDetails?: { type: string; stack?: string } }> {
    const startTime = Date.now();

    try {
        // Create the tools proxy
        const tools = createToolsProxy(toolNames, requestId);

        // Create and execute the async function
        // eslint-disable-next-line no-new-func
        const asyncFunc = new Function(
            'tools',
            `return (async () => {
${code}
            })();`
        );

        const result = await asyncFunc(tools);

        // Safe serialize the result to handle edge cases
        const serializedResult = safeSerializeForPostMessage(result);

        console.log('[Sandbox] Execution completed in', Date.now() - startTime, 'ms');

        return {
            success: true,
            result: serializedResult,
        };
    } catch (error: unknown) {
        const errorInfo = extractErrorInfo(error);
        console.error('[Sandbox] Execution error:', errorInfo.message, '\nType:', errorInfo.type);

        if (errorInfo.stack) {
            console.error('[Sandbox] Stack trace:', errorInfo.stack);
        }

        return {
            success: false,
            error: `${errorInfo.type}: ${errorInfo.message}`,
            errorDetails: {
                type: errorInfo.type,
                stack: errorInfo.stack,
            },
        };
    }
}

// ============================================================================
// Message Handler
// ============================================================================

window.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
    const data = event.data;

    if (!data || typeof data !== 'object' || !('type' in data)) {
        return;
    }

    switch (data.type) {
        case 'EXECUTE_CODE': {
            const { requestId, code, availableTools } = data;
            currentRequestId = requestId;

            console.log('[Sandbox] Received EXECUTE_CODE request:', {
                requestId,
                codeLength: code.length,
                toolCount: availableTools.length,
            });

            const result = await executeCode(code, availableTools, requestId);

            // Clean up any pending tool calls for this request
            for (const [callId] of pendingToolCalls) {
                if (callId.startsWith(requestId)) {
                    pendingToolCalls.delete(callId);
                }
            }

            currentRequestId = null;

            // Send the result back with all details
            const response: ExecuteResultMessage = {
                type: 'EXECUTE_RESULT',
                requestId,
                success: result.success,
                result: result.result,
                error: result.error,
                errorDetails: result.errorDetails,
            };

            parent.postMessage(response, '*');
            break;
        }

        case 'TOOL_RESULT': {
            const { callId, result, error } = data;

            const pending = pendingToolCalls.get(callId);
            if (pending) {
                pendingToolCalls.delete(callId);

                if (error) {
                    pending.reject(new Error(error));
                } else {
                    pending.resolve(result);
                }
            } else {
                console.warn('[Sandbox] Received TOOL_RESULT for unknown callId:', callId);
            }
            break;
        }
    }
});

// ============================================================================
// Initialization
// ============================================================================

// Log that the sandbox is ready
console.log('[Sandbox] Executor initialized');

// Verify we don't have access to chrome.* APIs (security check)
try {
    // In sandbox, chrome should be undefined since we don't have API access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromeGlobal = (globalThis as any).chrome;
    if (chromeGlobal && chromeGlobal.runtime) {
        console.error('[Sandbox] ERROR: chrome.runtime is accessible! This is a security issue.');
    } else {
        console.log('[Sandbox] Security check passed: chrome.runtime is not accessible');
    }
} catch {
    console.log('[Sandbox] Security check passed: chrome is not defined');
}

// Notify parent that sandbox is ready
parent.postMessage({ type: 'SANDBOX_READY' }, '*');
