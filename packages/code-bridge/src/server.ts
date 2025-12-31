import http from 'node:http';
import { handleCors } from './http/cors.js';
import { readJson, sendJson, sendError } from './http/json.js';
import { startPairing, confirmPairing, getCurrentPairingCode } from './pairing/pairing.js';
import { getAgentsWithAvailability } from './agents.js';
import { handleCodeChat } from './handlers/chat.js';
import { handlePatchApply } from './handlers/patch.js';
import { cleanupOldPatches } from './patch/patchStore.js';
import type { ServerConfig } from './types.js';

const VERSION = '0.0.1';

/**
 * Start the bridge HTTP server
 */
export async function startBridgeServer(config: ServerConfig): Promise<void> {
  const { host, port, cwd } = config;

  // Generate initial pairing code
  const initialPairing = startPairing();

  // Cleanup old patches periodically
  setInterval(() => cleanupOldPatches(), 60 * 60 * 1000); // Every hour

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
      if (path === '/code/chat' && req.method === 'POST') {
        await handleCodeChat(req, res, cwd);
        return;
      }

      // Apply patch (auth required)
      if (path === '/code/patch/apply' && req.method === 'POST') {
        await handlePatchApply(req, res, cwd);
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
