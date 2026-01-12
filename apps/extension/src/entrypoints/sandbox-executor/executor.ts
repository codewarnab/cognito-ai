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
// Origin Validation
// ============================================================================

/**
 * Validate that a message origin is from our extension.
 * 
 * IMPORTANT: Sandbox pages run in a unique/null origin context, but they
 * receive messages from the parent extension page which has a chrome-extension:// origin.
 * We cannot use the sandbox's own origin for validation since it's null.
 * 
 * Instead, we validate that messages come from a chrome-extension:// URL.
 * For additional security, we could store and validate the specific extension ID.
 */
function isValidExtensionOrigin(origin: string): boolean {
    // Messages from the extension will have chrome-extension://<id> origin
    // The sandbox's own origin is 'null' (string) due to sandboxing
    return origin.startsWith('chrome-extension://');
}

// Use '*' for targetOrigin because sandboxed iframes have complex origin handling.
// Attempts to use chrome.runtime.getURL() or origin extraction caused message drops
// due to mismatch between parent's origin and sandbox's perceived origin.
const PARENT_ORIGIN = '*';

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

    console.log('[Sandbox] Creating tools proxy with tools:', toolNames);

    for (const toolName of toolNames) {
        proxy[toolName] = async (...args: unknown[]): Promise<unknown> => {
            const callId = `${requestId}-${++callIdCounter}`;
            const startTime = Date.now();

            console.log(`[Sandbox] 🔧 TOOL CALL START: ${toolName}`, {
                callId,
                requestId,
                args: JSON.stringify(args).substring(0, 200),
                timestamp: new Date().toISOString(),
            });

            return new Promise((resolve, reject) => {
                // Set up timeout for this specific tool call
                const timeoutId = setTimeout(() => {
                    console.error(`[Sandbox] ⏰ TOOL TIMEOUT: ${toolName} after ${TOOL_CALL_TIMEOUT_MS}ms`, {
                        callId,
                        pendingCalls: Array.from(pendingToolCalls.keys()),
                    });
                    pendingToolCalls.delete(callId);
                    reject(new Error(`Tool ${toolName} timed out after ${TOOL_CALL_TIMEOUT_MS}ms`));
                }, TOOL_CALL_TIMEOUT_MS);

                // Store the promise resolvers with timeout cleanup
                pendingToolCalls.set(callId, {
                    resolve: (value) => {
                        clearTimeout(timeoutId);
                        const duration = Date.now() - startTime;
                        console.log(`[Sandbox] ✅ TOOL SUCCESS: ${toolName} in ${duration}ms`, {
                            callId,
                            resultType: typeof value,
                            resultPreview: JSON.stringify(value).substring(0, 200),
                        });
                        resolve(value);
                    },
                    reject: (error) => {
                        clearTimeout(timeoutId);
                        const duration = Date.now() - startTime;
                        console.error(`[Sandbox] ❌ TOOL ERROR: ${toolName} in ${duration}ms`, {
                            callId,
                            error: error.message,
                        });
                        reject(error);
                    },
                });

                // Send the tool request to the parent (extension)
                const message: ToolRequestMessage = {
                    type: 'TOOL_REQUEST',
                    requestId,
                    callId,
                    toolName,
                    args,
                };

                console.log(`[Sandbox] 📤 Sending TOOL_REQUEST to parent:`, {
                    toolName,
                    callId,
                    origin: PARENT_ORIGIN,
                });

                parent.postMessage(message, PARENT_ORIGIN);

                console.log(`[Sandbox] 📤 TOOL_REQUEST sent, waiting for TOOL_RESULT...`, { callId });
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
// In Adaptive Mode, some tools require human approval and may pause execution.
// Keep this generous to avoid false timeouts while waiting for user interaction.
const TOOL_CALL_TIMEOUT_MS = 15 * 60_000;

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
    // Security: Validate message origin - must be from our extension
    if (!isValidExtensionOrigin(event.origin)) {
        console.warn('[Sandbox] Ignoring message from unexpected origin:', event.origin);
        return;
    }

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

            parent.postMessage(response, PARENT_ORIGIN);
            break;
        }

        case 'TOOL_RESULT': {
            const { callId, result, error } = data;

            console.log('[Sandbox] 📥 Received TOOL_RESULT:', {
                callId,
                hasResult: result !== undefined,
                hasError: !!error,
                resultPreview: result ? JSON.stringify(result).substring(0, 200) : 'undefined',
                error: error || 'none',
                pendingCallIds: Array.from(pendingToolCalls.keys()),
            });

            const pending = pendingToolCalls.get(callId);
            if (pending) {
                pendingToolCalls.delete(callId);

                if (error) {
                    console.log(`[Sandbox] 📥 Calling reject for callId: ${callId}`);
                    pending.reject(new Error(error));
                } else {
                    console.log(`[Sandbox] 📥 Calling resolve for callId: ${callId}`);
                    pending.resolve(result);
                }
            } else {
                console.warn('[Sandbox] ⚠️ Received TOOL_RESULT for unknown callId:', callId, 'Pending calls:', Array.from(pendingToolCalls.keys()));
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
parent.postMessage({ type: 'SANDBOX_READY' }, PARENT_ORIGIN);
