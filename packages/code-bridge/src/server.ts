import http from 'node:http';
import { handleCors } from './http/cors.js';
import { readJson, sendJson, sendError } from './http/json.js';
import { startPairing, confirmPairing, getCurrentPairingCode } from './pairing/pairing.js';
import { validateToken } from './pairing/tokenStore.js';
import { getAgentsWithAvailability } from './agents.js';
import { handleCliChat } from './handlers/chat.js';
import type { ServerConfig } from './types.js';

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
process.on('SIGINT', () => {
  console.log('\n[server] Shutting down (SIGINT)...');
  broadcastShutdown('shutdown');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[server] Shutting down (SIGTERM)...');
  broadcastShutdown('shutdown');
  process.exit(0);
});

/**
 * Start the bridge HTTP server
 */
export async function startBridgeServer(config: ServerConfig): Promise<void> {
  const { host, port, cwd } = config;

  // Generate initial pairing code
  const initialPairing = startPairing();

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
            console.log('');
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║  ✓ Extension reconnected (stored token valid)              ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
            console.log('');
          }
          lastValidationTime.set(tokenKey, now);
        }

        sendJson(res, { valid: isValid, reason: isValid ? undefined : 'invalid_token' });
        return;
      }

      // Start pairing (no auth required)
      if (path === '/pair/start' && req.method === 'POST') {
        const pairing = startPairing();
        sendJson(res, pairing);
        return;
      }

      // Confirm pairing (no auth required)
      if (path === '/pair/confirm' && req.method === 'POST') {
        const body = await readJson(req) as { code?: string };

        if (!body.code || typeof body.code !== 'string') {
          sendError(res, 'Missing code', 400);
          return;
        }

        const token = await confirmPairing(body.code);
        if (!token) {
          sendError(res, 'Invalid or expired code', 400);
          return;
        }

        // Show connection success in CLI
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║  ✓ Extension connected successfully!                       ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');

        sendJson(res, { token });
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

      // 404 for unknown routes
      sendError(res, 'Not found', 404);
    } catch (err) {
      console.error('[server] Unhandled error:', err);
      sendError(res, 'Internal server error', 500);
    }
  });

  server.listen(port, host, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Cognito Code Bridge                     ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Server running at: http://${host}:${port}`.padEnd(61) + '║');
    console.log(`║  Working directory: ${cwd.slice(0, 38)}`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  PAIRING CODE (enter this in the extension):               ║');
    console.log('║                                                            ║');
    console.log(`║                      ${initialPairing.code}                         ║`);
    console.log('║                                                            ║');
    console.log(`║  Expires: ${new Date(initialPairing.expiresAt).toLocaleTimeString()}`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Waiting for extension to connect...');
    console.log('');
  });
}
