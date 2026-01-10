/**
 * Tool Bridge Client
 *
 * Handles the bi-directional communication for tool sharing:
 * 1. Registers extension tools with the code-bridge
 * 2. Subscribes to tool execution requests via SSE
 * 3. Executes tools locally and sends results back
 */

import { createLogger } from '~logger';
import { getToolSchemas, executeToolLocally, type ToolCall } from '@/ai/backend/frontendToolExecutor';

const log = createLogger('toolBridgeClient', 'CLI_MODE_BRIDGE');

/**
 * Tool execution event from bridge
 */
interface ToolExecuteEvent {
    requestId: string;
    toolName: string;
    args: unknown;
}

/**
 * Register extension tools with the bridge
 */
export async function registerToolsWithBridge(
    baseUrl: string,
    token: string
): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        log.info('Fetching tool schemas for bridge registration...');

        // Get tool schemas (excludeServerTools=false to include all tools)
        const schemas = await getToolSchemas(false);

        // Convert to array format expected by bridge
        const tools = Object.entries(schemas).map(([name, schema]) => ({
            name,
            description: schema.description,
            parameters: schema.parameters,
        }));

        log.info(`Registering ${tools.length} tools with bridge`);

        const response = await fetch(`${baseUrl}/bridge/tools/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ tools }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();
        log.info('Tools registered successfully', { count: result.count });
        return { success: true, count: result.count };
    } catch (err) {
        log.error('Failed to register tools with bridge:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Send tool execution result back to bridge
 */
async function sendToolResult(
    baseUrl: string,
    token: string,
    requestId: string,
    success: boolean,
    result?: unknown,
    error?: string
): Promise<void> {
    try {
        await fetch(`${baseUrl}/bridge/tools/result`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ requestId, success, result, error }),
        });
        log.debug('Sent tool result', { requestId, success });
    } catch (err) {
        log.error('Failed to send tool result:', err);
    }
}

/**
 * Handle tool execution request from bridge
 */
async function handleToolExecuteEvent(
    baseUrl: string,
    token: string,
    event: ToolExecuteEvent
): Promise<void> {
    log.info('Received tool execution request', {
        requestId: event.requestId,
        toolName: event.toolName
    });

    try {
        // Convert to ToolCall format
        const toolCall: ToolCall = {
            id: event.requestId,
            name: event.toolName,
            arguments: event.args as Record<string, unknown>,
        };

        // Execute the tool locally
        const result = await executeToolLocally(toolCall);

        // Send result back to bridge
        if (result.isError) {
            await sendToolResult(baseUrl, token, event.requestId, false, undefined, String(result.result));
        } else {
            await sendToolResult(baseUrl, token, event.requestId, true, result.result);
        }
    } catch (err) {
        log.error('Tool execution failed:', err);
        await sendToolResult(
            baseUrl,
            token,
            event.requestId,
            false,
            undefined,
            err instanceof Error ? err.message : String(err)
        );
    }
}

/**
 * Connect to bridge tool events SSE stream
 * Handles incoming tool execution requests
 * 
 * @returns Cleanup function to close the connection
 */
export function connectToToolEvents(
    baseUrl: string,
    token: string,
    callbacks?: {
        onConnected?: () => void;
        onDisconnected?: () => void;
        onError?: (error: Error) => void;
    }
): () => void {
    log.info('Connecting to bridge tool events SSE...');

    // Note: EventSource doesn't support custom headers, so we pass token in query
    // The server should accept token from either header or query param
    const url = `${baseUrl}/bridge/tools/events`;

    // Use fetch with SSE pattern since we need auth header
    const abortController = new AbortController();
    let isActive = true;

    const connect = async () => {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
                signal: abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            callbacks?.onConnected?.();

            const decoder = new TextDecoder();
            let buffer = '';
            let currentEventType = '';

            while (isActive) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (currentEventType === 'tool:execute') {
                            try {
                                const event = JSON.parse(data) as ToolExecuteEvent;
                                // Handle in background, don't await to keep SSE processing
                                handleToolExecuteEvent(baseUrl, token, event).catch(err => {
                                    log.error('Failed to handle tool execute event:', err);
                                });
                            } catch (err) {
                                log.error('Failed to parse tool:execute event:', err);
                            }
                        } else if (currentEventType === 'connected') {
                            log.info('Connected to tool events SSE');
                        } else if (currentEventType === 'heartbeat') {
                            log.debug('Tool events heartbeat');
                        }
                    }
                }
            }
        } catch (err) {
            if (isActive && (err as Error).name !== 'AbortError') {
                log.error('Tool events SSE error:', err);
                callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)));
                callbacks?.onDisconnected?.();
            }
        }
    };

    // Start connection
    connect();

    // Return cleanup function
    return () => {
        log.info('Disconnecting from tool events SSE');
        isActive = false;
        abortController.abort();
    };
}
