import type http from 'node:http';
import { readJson, sendJson, sendError } from '../http/json.js';
import { requireAuth } from '../http/auth.js';
import { CliChatRequestSchema } from '../types.js';
import { createACPProvider, type ACPMessage } from '../acp/acpProvider.js';
import { findAgent } from '../agents.js';

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

    const { messages, agent, sessionId } = parsed.data;

    console.log('[chat] Agent:', agent.name);
    console.log('[chat] Messages:', messages.length);
    console.log('[chat] Session:', sessionId || 'new');

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
    const sendEvent = (event: string, data: unknown) => {
      console.log(`[chat] SSE event: ${event}`, JSON.stringify(data).slice(0, 200));
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Create ACP provider
    const provider = createACPProvider({
      command: agent.command || agentDef.command,
      args: agent.args || agentDef.args,
      cwd,
      env: process.env as Record<string, string>,
    });

    // Clean up on disconnect
    req.on('close', () => {
      console.log('[chat] Client disconnected, cleaning up');
      provider.cleanup();
    });

    // Handle messages from the agent
    provider.on('message', (msg: ACPMessage) => {
      console.log('[chat] Agent message:', msg.type);
      switch (msg.type) {
        case 'text':
          sendEvent('text', { content: msg.content });
          break;

        case 'status':
          sendEvent('status', { message: msg.status });
          break;

        case 'tool_call':
          sendEvent('tool_call', {
            toolName: msg.toolName,
            toolCallId: msg.toolCallId,
            args: msg.args,
          });
          break;

        case 'tool_result':
          sendEvent('tool_result', {
            toolCallId: msg.toolCallId,
            result: msg.result,
          });
          break;

        case 'error':
          sendEvent('error', { error: msg.error });
          break;

        case 'done':
          sendEvent('done', {});
          break;
      }
    });

    provider.on('error', (err: Error) => {
      console.error('[chat] Provider error:', err.message);
      sendEvent('error', { error: err.message });
      res.end();
    });

    provider.on('close', (code: number) => {
      console.log('[chat] Provider closed with code:', code);
      if (code !== 0) {
        sendEvent('error', { error: `Agent exited with code ${code}` });
      }
      sendEvent('done', {});
      res.end();
    });

    // Start the agent
    try {
      console.log('[chat] Starting agent...');
      await provider.start();
      console.log('[chat] Agent started');
    } catch (err) {
      const agentCommand = agent.command || agentDef.command;
      const agentArgs = agent.args || agentDef.args;
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.error('[chat] Failed to start agent:', errorMessage);

      sendEvent('error', {
        error: `Failed to start agent "${agent.name}" (${agentCommand} ${agentArgs.join(' ')}): ${errorMessage}`,
        code: 'AGENT_START_FAILED',
        details: {
          agentName: agent.name,
          command: agentCommand,
          args: agentArgs,
        },
      });
      res.end();
      return;
    }

    // Pass messages with content parts directly to provider
    // The provider will convert ContentPart[] to ACP ContentBlock[]
    const chatMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    console.log('[chat] Sending chat to agent...');
    // Send chat request to agent
    await provider.chat({
      messages: chatMessages,
      systemPrompt: 'You are a coding agent operating connected to the user\'s local machine.',
    });
    console.log('[chat] Chat sent to agent, waiting for response...');

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
