/**
 * MCP HTTP Streamable Transport Handler
 *
 * Handles HTTP requests to the /mcp endpoint and bridges them to the MCP server.
 * Implements the MCP HTTP Streamable transport specification.
 */

import type http from 'node:http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Track transports per session
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Handle MCP HTTP request
 *
 * Routes incoming HTTP requests to the appropriate MCP transport.
 * Creates new transports for initialization requests.
 */
export async function handleMcpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    mcpServer: McpServer
): Promise<void> {
    // Collect the request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString('utf-8');

    // Parse JSON-RPC request
    let jsonRequest: { jsonrpc: string; method: string; id?: number | string; params?: unknown };
    try {
        jsonRequest = JSON.parse(body);
    } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error' },
            id: null,
        }));
        return;
    }

    // Get or create session ID
    const sessionId = req.headers['mcp-session-id'] as string || 'default';

    // Handle initialization request - create new transport
    if (jsonRequest.method === 'initialize') {
        // Clean up old transport if exists
        const existingTransport = transports.get(sessionId);
        if (existingTransport) {
            await existingTransport.close();
            transports.delete(sessionId);
        }

        // Create new transport
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
        });

        transports.set(sessionId, transport);

        // Connect server to transport
        await mcpServer.connect(transport);

        // Handle this request
        await transport.handleRequest(req, res, body);
        return;
    }

    // For non-initialization requests, use existing transport
    const transport = transports.get(sessionId);
    if (!transport) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Session not initialized' },
            id: jsonRequest.id ?? null,
        }));
        return;
    }

    // Handle the request
    await transport.handleRequest(req, res, body);
}

/**
 * Handle DELETE request for session cleanup
 */
export async function handleMcpSessionDelete(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string;

    if (sessionId) {
        const transport = transports.get(sessionId);
        if (transport) {
            await transport.close();
            transports.delete(sessionId);
        }
    }

    res.writeHead(200);
    res.end();
}

/**
 * Clean up all transports (for graceful shutdown)
 */
export async function cleanupAllTransports(): Promise<void> {
    for (const [sessionId, transport] of transports) {
        try {
            await transport.close();
        } catch {
            // Ignore cleanup errors
        }
        transports.delete(sessionId);
    }
}
