/**
 * Main chat handler - routes requests to appropriate agent handlers
 */

import type http from 'node:http';
import { readJson, sendError } from '../http/json';
import { requireAuth } from '../http/auth';
import { CliChatRequestSchema } from '../types';
import { findAgent } from '../agents';
import type { SSEEventSender } from './aiSdkTools';
import { handleGeminiAgent } from './geminiHandler';
import { handleCodexAgent } from './codexHandler';
import { handleClaudeCodeAgent } from './claudeCodeHandler';

/**
 * Handle POST /cli/chat
 * Streams AI response using Server-Sent Events
 */
export async function handleCliChat(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cwd: string
): Promise<void> {
  // Require authentication
  const auth = await requireAuth(req, res);
  if (!auth.ok) return;

  console.log('[chat] Received chat request');

  try {
    const body = await readJson(req);
    const parsed = CliChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.log('[chat] Invalid request:', parsed.error.message);
      sendError(res, `Invalid request: ${parsed.error.message}`, 400);
      return;
    }

    const { messages, agent, sessionId, enabledTools, toolsMode } = parsed.data;

    console.log('[chat] Agent:', agent.name);
    console.log('[chat] Messages:', messages.length);
    console.log('[chat] Session:', sessionId || 'new');
    console.log('[chat] Enabled tools:', enabledTools?.length ?? 'all');
    console.log('[chat] Tools mode:', toolsMode);

    // Find the agent definition
    const agentDef = findAgent(agent.name);
    if (!agentDef) {
      console.log('[chat] Unknown agent:', agent.name);
      sendError(res, `Unknown agent: ${agent.name}`, 400);
      return;
    }

    // Set up SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    console.log('[chat] SSE headers sent');

    // Helper to send SSE events
    const sendEvent: SSEEventSender = (event: string, data: unknown) => {
      console.log(`[chat] SSE event: ${event}`, JSON.stringify(data).slice(0, 200));
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const abortController = new AbortController();
    req.on('close', () => {
      console.log('[chat] Client disconnected, aborting stream');
      abortController.abort();
    });

    // Determine which provider to use based on agent
    const isGeminiAgent = agent.name.toLowerCase().includes('gemini');
    const isCodexAgent = agent.name.toLowerCase().includes('codex');
    const isClaudeCodeAgent =
      agent.name.toLowerCase().includes('claude') ||
      agentDef.aiSdkProvider === 'claude-code';

    // Common handler params
    const handlerParams = {
      agent,
      messages,
      sendEvent,
      abortController,
      res,
      enabledTools,
      toolsMode,
    };

    // ============================================================
    // AI SDK Path: Gemini CLI
    // ============================================================
    if (isGeminiAgent) {
      await handleGeminiAgent(handlerParams);
      return;
    }

    // ============================================================
    // AI SDK Path: CodeX CLI
    // ============================================================
    if (isCodexAgent) {
      await handleCodexAgent({ ...handlerParams, cwd });
      return;
    }

    // ============================================================
    // AI SDK Path: Claude Code with MCP Tool Bridge
    // ============================================================
    if (isClaudeCodeAgent) {
      await handleClaudeCodeAgent({ ...handlerParams, cwd });
      return;
    }

    // ============================================================
    // Unsupported Agent Error
    // ============================================================
    // All supported agents use AI SDK providers above.
    // If we reach here, the agent is not supported.
    sendEvent('error', {
      error: `Unsupported agent: "${agent.name}". Supported agents: Gemini CLI, CodeX CLI, Claude Code.`,
      code: 'UNSUPPORTED_AGENT',
    });
    sendEvent('done', {});
    res.end();
  } catch (err) {
    console.error('[chat] Error:', err);

    // If headers not sent yet, send error response
    if (!res.headersSent) {
      sendError(res, err instanceof Error ? err.message : 'Internal error', 500);
    } else {
      // Headers already sent (SSE), send error event
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' })}\n\n`);
      res.end();
    }
  }
}
