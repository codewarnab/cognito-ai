import http from 'node:http';
import { handleCors } from './http/cors';
import { readJson, sendJson, sendError } from './http/json';
import { validateExtensionOrigin } from './auth/extensionAuth';
import { validateToken, generateToken, addToken } from './pairing/tokenStore';
import { getAgentsWithAvailability } from './agents';
import { handleCliChat } from './handlers/chat';
import type { ServerConfig } from './types';
import {
  createMcpServer,
  handleMcpRequest,
  handleMcpSessionDelete,
  cleanupAllTransports,
} from './mcp/index';
import {
  registerTools,
  getRegisteredTools,
  addToolExecutionClient,
  removeToolExecutionClient,
  executeToolOnExtension,
  handleToolResult,
  type ExtensionToolSchema,
  type ToolExecutionResult,
} from './mcp/toolStore';
import { logger } from './utils/logger';

const VERSION = '0.0.1';

// Track SSE clients for graceful shutdown notification
const sseClients = new Set<http.ServerResponse>();

// Track last validation time per token to debounce reconnection messages
// Key: token hash (first 8 chars), Value: timestamp of last validation
const lastValidationTime = new Map<string, number>();
const VALIDATION_DEBOUNCE_MS = 10_000; // Only show message once per 10 seconds

/**
 * Broadcast a shutdown event to all connected SSE clients
 */
function broadcastShutdown(reason: string): void {
  for (const client of sseClients) {
    try {
      client.write(`event: bridge:closing\ndata: ${JSON.stringify({ reason })}\n\n`);
      client.end();
    } catch {
      // Client may already be disconnected
    }
  }
  sseClients.clear();
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('');
  logger.warn('Shutting down (SIGINT)...');
  broadcastShutdown('shutdown');
  await cleanupAllTransports();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('');
  logger.warn('Shutting down (SIGTERM)...');
  broadcastShutdown('shutdown');
  await cleanupAllTransports();
  process.exit(0);
});

/**
 * Start the bridge HTTP server
 */
export async function startBridgeServer(config: ServerConfig): Promise<void> {
  const { host, port, cwd } = config;

  // Initialize MCP server
  const mcpServer = createMcpServer();
  logger.debug('server', 'MCP server created');

  const server = http.createServer(async (req, res) => {
    // Handle CORS
    if (handleCors(req, res)) return;

    const url = new URL(req.url || '/', `http://${host}:${port}`);
    const path = url.pathname;

    try {
      // Health check (no auth required)
      if (path === '/health' && req.method === 'GET') {
        sendJson(res, { ok: true, version: VERSION, cwd });
        return;
      }

      // SSE events stream for real-time connection status (no auth required)
      if (path === '/events' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
        });

        // Send initial connected event
        res.write(`event: connected\ndata: ${JSON.stringify({ version: VERSION, cwd })}\n\n`);

        // Track this client
        sseClients.add(res);

        // Clean up on client disconnect
        req.on('close', () => {
          sseClients.delete(res);
        });

        // Keep connection alive with periodic heartbeats (every 30 seconds)
        const heartbeatInterval = setInterval(() => {
          try {
            res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        req.on('close', () => {
          clearInterval(heartbeatInterval);
        });

        return;
      }

      // Token validation (validates if provided token is still valid)
      if (path === '/validate' && req.method === 'POST') {
        const header = req.headers.authorization || '';
        const match = header.match(/^Bearer\s+(.+)$/i);

        if (!match) {
          sendJson(res, { valid: false, reason: 'missing_token' });
          return;
        }

        const token = match[1];
        const isValid = await validateToken(token);

        // Show reconnection message in CLI when stored token is used (with debounce)
        if (isValid) {
          const tokenKey = token.slice(0, 8); // Use first 8 chars as key
          const now = Date.now();
          const lastTime = lastValidationTime.get(tokenKey) || 0;

          // Only show message if enough time has passed since last validation
          if (now - lastTime > VALIDATION_DEBOUNCE_MS) {
            logger.box({
              lines: [
                { text: '✓ Extension reconnected (stored token valid)', type: 'success' },
              ],
            });
          }
          lastValidationTime.set(tokenKey, now);
        }

        sendJson(res, { valid: isValid, reason: isValid ? undefined : 'invalid_token' });
        return;
      }

      // Auto-connect handshake (no auth token required; Origin validated)
      if (path === '/connect' && req.method === 'POST') {
        const origin = req.headers.origin;
        const auth = validateExtensionOrigin(typeof origin === 'string' ? origin : undefined);

        if (!auth.valid) {
          sendError(res, auth.error || 'Unauthorized', 401);
          return;
        }

        // If caller already has a valid token, let them keep using it.
        const header = req.headers.authorization || '';
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (match && (await validateToken(match[1]))) {
          sendJson(res, { token: match[1], extensionId: auth.extensionId, reused: true });
          return;
        }

        // Issue a new token
        const token = generateToken();
        await addToken(token);

        logger.box({
          lines: [
            { text: '✓ Extension authenticated', type: 'success' },
            { text: `Extension ID: ${(auth.extensionId || '').slice(0, 32)}`, type: 'dim' },
          ],
        });

        sendJson(res, { token, extensionId: auth.extensionId });
        return;
      }

      // List available agents (no auth required for discovery)
      if (path === '/agents' && req.method === 'GET') {
        const agents = await getAgentsWithAvailability();
        sendJson(res, { agents });
        return;
      }

      // Code chat (auth required)
      if (path === '/cli/chat' && req.method === 'POST') {
        await handleCliChat(req, res, cwd);
        return;
      }

      // ================================================================
      // MCP Protocol Endpoints
      // ================================================================

      // MCP HTTP Streamable Transport (POST for requests, GET for SSE, DELETE for session cleanup)
      if (path === '/mcp') {
        if (req.method === 'POST') {
          await handleMcpRequest(req, res, mcpServer);
          return;
        }
        if (req.method === 'DELETE') {
          await handleMcpSessionDelete(req, res);
          return;
        }
        // GET not supported for now (SSE would require different handling)
        sendError(res, 'Method not allowed', 405);
        return;
      }

      // ================================================================
      // Tool Bridge Endpoints (for MCP tool registry to call extension)
      // ================================================================

      // Register tools from extension (called when extension connects)
      if (path === '/bridge/tools/register' && req.method === 'POST') {
        // Require authentication
        const header = req.headers.authorization || '';
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (!match || !(await validateToken(match[1]))) {
          sendError(res, 'Unauthorized', 401);
          return;
        }

        const body = await readJson(req) as { tools?: ExtensionToolSchema[] };
        if (!body.tools || !Array.isArray(body.tools)) {
          sendError(res, 'Invalid tools array', 400);
          return;
        }

        registerTools(body.tools);
        logger.box({
          lines: [
            { text: '✓ Extension tools registered', type: 'success' },
            { text: `Tools available: ${logger.count(body.tools.length)}` },
          ],
        });
        sendJson(res, { success: true, count: body.tools.length });
        return;
      }

      // List all available tools from extension
      if (path === '/bridge/tools' && req.method === 'GET') {
        const tools = getRegisteredTools();
        sendJson(res, { tools });
        return;
      }

      // Call a specific tool on the extension
      if (path === '/bridge/tools/call' && req.method === 'POST') {
        // Require authentication (local-only endpoint, but still sensitive)
        const header = req.headers.authorization || '';
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (!match || !(await validateToken(match[1]))) {
          sendError(res, 'Unauthorized', 401);
          return;
        }

        const body = await readJson(req) as { name?: string; args?: unknown };

        if (!body.name || typeof body.name !== 'string') {
          sendError(res, 'Missing tool name', 400);
          return;
        }

        // Execute tool on extension and wait for result
        const result = await executeToolOnExtension(body.name, body.args);
        sendJson(res, result);
        return;
      }

      // Receive tool result from extension
      if (path === '/bridge/tools/result' && req.method === 'POST') {
        // Require authentication
        const header = req.headers.authorization || '';
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (!match || !(await validateToken(match[1]))) {
          sendError(res, 'Unauthorized', 401);
          return;
        }

        const body = await readJson(req) as ToolExecutionResult;
        if (!body.requestId) {
          sendError(res, 'Missing requestId', 400);
          return;
        }

        const handled = handleToolResult(body);
        sendJson(res, { success: handled });
        return;
      }

      // SSE endpoint for tool execution requests (extension subscribes to this)
      if (path === '/bridge/tools/events' && req.method === 'GET') {
        // Require authentication
        const authHeader = req.headers.authorization || '';
        const authMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!authMatch || !(await validateToken(authMatch[1]))) {
          sendError(res, 'Unauthorized', 401);
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
        });

        // Send initial connected event
        res.write(`event: connected\ndata: ${JSON.stringify({ version: VERSION })}\n\n`);

        // Register this client for tool execution
        addToolExecutionClient(res);

        // Clean up on disconnect
        req.on('close', () => {
          removeToolExecutionClient(res);
        });

        // Keep connection alive with heartbeats
        const heartbeat = setInterval(() => {
          try {
            res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
          } catch {
            clearInterval(heartbeat);
          }
        }, 30000);

        req.on('close', () => clearInterval(heartbeat));
        return;
      }

      // 404 for unknown routes
      sendError(res, 'Not found', 404);
    } catch (err) {
      logger.error('Unhandled error', err);
      sendError(res, 'Internal server error', 500);
    }
  });

  server.listen(port, host, () => {
    logger.box({
      title: 'Cognito CLI Bridge',
      lines: [
        { text: `Server running at: ${logger.url(`http://${host}:${port}`)}` },
        { text: `Working directory: ${logger.path(cwd.slice(0, 38))}` },
      ],
      footer: { text: '⏳ Waiting for extension to connect...', type: 'warning' },
    });
  });
}
