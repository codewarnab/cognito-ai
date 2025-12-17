/**
 * Type-Safe MCP Message Helpers
 *
 * Provides typed wrappers for MCP messages, including both static and dynamic (server-scoped) messages.
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import type {
    McpServerAction,
    McpServerMessagePayloads,
    McpServerMessageResponses,
    McpStaticMessageRegistry,
    McpStaticMessageType,
} from '@/types/messaging/mcp';

import { MessagingError } from './sender';

/**
 * Send a message to a specific MCP server.
 *
 * @example
 * // Enable a server (no payload)
 * const response = await sendMcpMessage('notion', 'enable');
 *
 * @example
 * // Call a tool (with payload)
 * const response = await sendMcpMessage('notion', 'tool/call', {
 *   name: 'search',
 *   arguments: { query: 'test' }
 * });
 *
 * @example
 * // Get server status
 * const response = await sendMcpMessage('github', 'status/get');
 * if (response.success && response.data) {
 *   console.log('Server state:', response.data.state);
 * }
 */
export async function sendMcpMessage<A extends McpServerAction>(
    serverId: string,
    action: A,
    ...args: McpServerMessagePayloads[A] extends undefined ? [] : [payload: McpServerMessagePayloads[A]]
): Promise<McpServerMessageResponses[A]> {
    const [payload] = args;

    const message =
        payload !== undefined
            ? { type: `mcp/${serverId}/${action}`, payload }
            : { type: `mcp/${serverId}/${action}` };

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(
                    new MessagingError(
                        chrome.runtime.lastError.message ?? 'Unknown MCP messaging error',
                        `mcp/${serverId}/${action}`
                    )
                );
                return;
            }
            resolve(response as McpServerMessageResponses[A]);
        });
    });
}

/**
 * Send a static MCP message (no server ID required).
 *
 * @example
 * // List all tools from all connected servers
 * const response = await sendMcpStaticMessage('mcp/tools/list');
 * if (response.success && response.data) {
 *   console.log('All tools:', response.data.tools);
 * }
 *
 * @example
 * // Reload custom servers
 * const response = await sendMcpStaticMessage('mcp/custom-servers/reload');
 *
 * @example
 * // Get all servers
 * const response = await sendMcpStaticMessage('mcp/servers/get');
 */
export async function sendMcpStaticMessage<T extends McpStaticMessageType>(
    type: T,
    payload?: McpStaticMessageRegistry[T]['payload']
): Promise<McpStaticMessageRegistry[T]['response']> {
    const message = payload !== undefined ? { type, payload } : { type };

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new MessagingError(chrome.runtime.lastError.message ?? 'Unknown MCP messaging error', type));
                return;
            }
            resolve(response);
        });
    });
}

/**
 * Try to send an MCP message, returning null on error instead of throwing.
 *
 * @example
 * const response = await trySendMcpMessage('notion', 'status/get');
 * if (response?.success) {
 *   console.log('Connected:', response.data?.state);
 * }
 */
export async function trySendMcpMessage<A extends McpServerAction>(
    serverId: string,
    action: A,
    ...args: McpServerMessagePayloads[A] extends undefined ? [] : [payload: McpServerMessagePayloads[A]]
): Promise<McpServerMessageResponses[A] | null> {
    try {
        return await sendMcpMessage(serverId, action, ...args);
    } catch {
        return null;
    }
}

/**
 * Try to send a static MCP message, returning null on error instead of throwing.
 *
 * @example
 * const response = await trySendMcpStaticMessage('mcp/tools/list');
 * const tools = response?.success ? response.data?.tools ?? [] : [];
 */
export async function trySendMcpStaticMessage<T extends McpStaticMessageType>(
    type: T,
    payload?: McpStaticMessageRegistry[T]['payload']
): Promise<McpStaticMessageRegistry[T]['response'] | null> {
    try {
        return await sendMcpStaticMessage(type, payload);
    } catch {
        return null;
    }
}

/**
 * Send an MCP message with a timeout.
 *
 * @example
 * try {
 *   const response = await sendMcpMessageWithTimeout('notion', 'enable', undefined, 10000);
 * } catch (error) {
 *   if (error.message.includes('timed out')) {
 *     console.error('Server connection timed out');
 *   }
 * }
 */
export async function sendMcpMessageWithTimeout<A extends McpServerAction>(
    serverId: string,
    action: A,
    payload: McpServerMessagePayloads[A] | undefined,
    timeoutMs: number
): Promise<McpServerMessageResponses[A]> {
    const messageType = `mcp/${serverId}/${action}`;

    const messagePromise = (async () => {
        if (payload !== undefined) {
            // For actions with payloads, we need to cast to satisfy the conditional type
            return sendMcpMessage(
                serverId,
                action,
                ...[payload] as McpServerMessagePayloads[A] extends undefined ? [] : [payload: McpServerMessagePayloads[A]]
            );
        }
        // For actions without payloads
        return sendMcpMessage(
            serverId,
            action,
            ...[] as McpServerMessagePayloads[A] extends undefined ? [] : [payload: McpServerMessagePayloads[A]]
        );
    })();

    return Promise.race([
        messagePromise,
        new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new MessagingError(`MCP message ${messageType} timed out after ${timeoutMs}ms`, messageType)),
                timeoutMs
            )
        ),
    ]);
}

/**
 * Batch multiple MCP tool calls together.
 * Executes them in parallel and returns all results.
 *
 * @example
 * const results = await batchMcpToolCalls('notion', [
 *   { name: 'search', arguments: { query: 'project' } },
 *   { name: 'get_page', arguments: { pageId: '123' } },
 * ]);
 */
export async function batchMcpToolCalls(
    serverId: string,
    toolCalls: Array<{ name: string; arguments?: Record<string, unknown> }>
): Promise<Array<McpServerMessageResponses['tool/call']>> {
    return Promise.all(toolCalls.map((call) => sendMcpMessage(serverId, 'tool/call', call)));
}

/**
 * Convenience function to enable an MCP server and wait for it to be ready.
 *
 * @example
 * const result = await enableMcpServer('notion');
 * if (result.success) {
 *   console.log('Notion server is now connected');
 * }
 */
export async function enableMcpServer(serverId: string): Promise<McpServerMessageResponses['enable']> {
    return sendMcpMessage(serverId, 'enable');
}

/**
 * Convenience function to disable an MCP server.
 */
export async function disableMcpServer(serverId: string): Promise<McpServerMessageResponses['disable']> {
    return sendMcpMessage(serverId, 'disable');
}

/**
 * Convenience function to get an MCP server's status.
 */
export async function getMcpServerStatus(serverId: string): Promise<McpServerMessageResponses['status/get']> {
    return sendMcpMessage(serverId, 'status/get');
}

/**
 * Convenience function to call an MCP tool.
 */
export async function callMcpTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
): Promise<McpServerMessageResponses['tool/call']> {
    return sendMcpMessage(serverId, 'tool/call', {
        name: toolName,
        arguments: args,
    });
}

/**
 * Convenience function to list tools from a specific server.
 */
export async function listMcpServerTools(serverId: string): Promise<McpServerMessageResponses['tools/list']> {
    return sendMcpMessage(serverId, 'tools/list');
}

/**
 * Convenience function to list all tools from all servers.
 */
export async function listAllMcpTools(): Promise<McpStaticMessageRegistry['mcp/tools/list']['response']> {
    return sendMcpStaticMessage('mcp/tools/list');
}

/**
 * Convenience function to get all servers.
 */
export async function getAllMcpServers(): Promise<McpStaticMessageRegistry['mcp/servers/get']['response']> {
    return sendMcpStaticMessage('mcp/servers/get');
}
