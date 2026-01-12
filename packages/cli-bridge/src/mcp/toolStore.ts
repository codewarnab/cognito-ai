/**
 * Tool Store
 *
 * In-memory storage for extension tools.
 * The extension registers its tools here when connecting.
 * MCP server queries this to discover available tools.
 */

import type http from 'node:http';
import { EventEmitter } from 'node:events';

/**
 * Tool schema as received from extension
 */
export interface ExtensionToolSchema {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * Tool execution request sent to extension
 */
export interface ToolExecutionRequest {
    requestId: string;
    toolName: string;
    args: unknown;
    /**
     * When true, this tool call is part of an interactive chat session where the
     * extension UI is expected to render an approval card and can approve/deny.
     * Non-interactive callers (e.g. generic MCP clients) should leave this false.
     */
    interactive?: boolean;
}

/**
 * Tool execution result from extension
 */
export interface ToolExecutionResult {
    requestId: string;
    success: boolean;
    result?: unknown;
    error?: string;
}

export interface ExecuteToolOnExtensionOptions {
    /**
     * Optional request id to use for the tool execution. When provided, this
     * allows external systems (like the extension UI) to correlate tool calls
     * with execution requests (e.g. for human approval).
     */
    requestId?: string;
    /** Optional timeout override (ms) */
    timeoutMs?: number;
    /** Mark the call as interactive (UI can approve/deny) */
    interactive?: boolean;
}

/**
 * Human approval can pause tool execution; keep timeouts generous.
 */
const DEFAULT_TOOL_EXECUTION_TIMEOUT_MS = 15 * 60_000;

// In-memory tool registry
let registeredTools: ExtensionToolSchema[] = [];

// Pending tool call responses
const pendingToolCalls = new Map<string, {
    resolve: (result: ToolExecutionResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}>();

// SSE clients that can receive tool call requests
const toolExecutionClients = new Set<http.ServerResponse>();

// Event emitter for tool-related events
export const toolStoreEvents = new EventEmitter();

/**
 * Register tools from extension
 */
export function registerTools(tools: ExtensionToolSchema[]): void {
    registeredTools = tools;
    // Debug log removed - server.ts handles the user-facing notification
    toolStoreEvents.emit('tools:registered', tools);
}

/**
 * Get all registered tools
 */
export function getRegisteredTools(): ExtensionToolSchema[] {
    return registeredTools;
}

/**
 * Clear all registered tools
 */
export function clearTools(): void {
    registeredTools = [];
}

/**
 * Add an SSE client for tool execution
 */
export function addToolExecutionClient(res: http.ServerResponse): void {
    toolExecutionClients.add(res);
}

/**
 * Remove an SSE client
 */
export function removeToolExecutionClient(res: http.ServerResponse): void {
    toolExecutionClients.delete(res);
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Execute a tool by sending request to extension and waiting for response
 */
export async function executeToolOnExtension(
    toolName: string,
    args: unknown,
    options?: ExecuteToolOnExtensionOptions
): Promise<ToolExecutionResult> {
    if (toolExecutionClients.size === 0) {
        return {
            requestId: 'no-client',
            success: false,
            error: 'No extension connected for tool execution',
        };
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TOOL_EXECUTION_TIMEOUT_MS;
    const requestId = options?.requestId ?? generateRequestId();

    // Defensive: avoid clobbering an existing pending call
    if (pendingToolCalls.has(requestId)) {
        return {
            requestId,
            success: false,
            error: `Duplicate tool execution requestId: ${requestId}`,
        };
    }
    const request: ToolExecutionRequest = { requestId, toolName, args, interactive: options?.interactive };

    return new Promise((resolve, reject) => {
        // Set timeout
        const timeout = setTimeout(() => {
            pendingToolCalls.delete(requestId);
            resolve({
                requestId,
                success: false,
                error: `Tool execution timed out after ${timeoutMs}ms`,
            });
        }, timeoutMs);

        // Store pending call
        pendingToolCalls.set(requestId, { resolve, reject, timeout });

        // Send request to all connected clients via SSE
        const data = JSON.stringify(request);
        for (const client of toolExecutionClients) {
            try {
                client.write(`event: tool:execute\ndata: ${data}\n\n`);
            } catch {
                // Client may be disconnected
                toolExecutionClients.delete(client);
            }
        }

        console.log(`[toolStore] Sent tool execution request: ${toolName} (${requestId})`);
    });
}

/**
 * Handle tool execution result from extension
 */
export function handleToolResult(result: ToolExecutionResult): boolean {
    const pending = pendingToolCalls.get(result.requestId);
    if (!pending) {
        console.warn(`[toolStore] Received result for unknown request: ${result.requestId}`);
        return false;
    }

    // Clear timeout and resolve
    clearTimeout(pending.timeout);
    pendingToolCalls.delete(result.requestId);
    pending.resolve(result);

    console.log(`[toolStore] Received tool result: ${result.requestId} success=${result.success}`);
    return true;
}

/**
 * Check if any clients are connected for tool execution
 */
export function hasToolExecutionClients(): boolean {
    return toolExecutionClients.size > 0;
}

/**
 * Get number of connected clients
 */
export function getToolExecutionClientCount(): number {
    return toolExecutionClients.size;
}
