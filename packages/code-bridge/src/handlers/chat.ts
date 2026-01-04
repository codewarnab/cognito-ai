import type http from 'node:http';
import crypto from 'node:crypto';
import { readJson, sendJson, sendError } from '../http/json.js';
import { requireAuth } from '../http/auth.js';
import { CodeModeChatRequestSchema, type CodeModeElementContext } from '../types.js';
import { createACPProvider, type ACPMessage } from '../acp/acpProvider.js';
import { savePatch } from '../patch/patchStore.js';
import { findAgent } from '../agents.js';

/**
 * Build system prompt for code mode
 */
function buildSystemPrompt(elementContext?: CodeModeElementContext): string {
  const parts = [
    'You are a coding agent operating on a local repository on disk.',
    'You can read and modify files in the current working directory.',
    '',
    'When you want to propose code changes, output them as a unified diff.',
    'The user will review and approve changes before they are applied.',
    '',
  ];

  if (elementContext) {
    parts.push('## Selected Element Context');
    parts.push('The user has selected the following element on the page:');
    parts.push('');
    parts.push(`- URL: ${elementContext.url}`);
    if (elementContext.title) parts.push(`- Page Title: ${elementContext.title}`);
    parts.push(`- Tag: ${elementContext.tagName}`);
    if (elementContext.id) parts.push(`- ID: ${elementContext.id}`);
    if (elementContext.classList.length > 0) {
      parts.push(`- Classes: ${elementContext.classList.join(', ')}`);
    }
    if (elementContext.selector) parts.push(`- Selector: ${elementContext.selector}`);
    if (elementContext.textPreview) {
      parts.push(`- Text Preview: ${elementContext.textPreview.slice(0, 200)}`);
    }
    if (elementContext.sourceHint?.filePath) {
      parts.push('');
      parts.push('## Source Hint');
      parts.push(`- File: ${elementContext.sourceHint.filePath}`);
      if (elementContext.sourceHint.line) {
        parts.push(`- Line: ${elementContext.sourceHint.line}`);
      }
      if (elementContext.sourceHint.componentName) {
        parts.push(`- Component: ${elementContext.sourceHint.componentName}`);
      }
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Handle POST /code/chat
 * Streams AI response using Server-Sent Events
 */
export async function handleCodeChat(
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
    const parsed = CodeModeChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.log('[chat] Invalid request:', parsed.error.message);
      sendError(res, `Invalid request: ${parsed.error.message}`, 400);
      return;
    }

    const { messages, elementContext, agent, sessionId } = parsed.data;

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
          // Check if this is a patch proposal
          if (msg.toolName === 'propose_patch' && msg.args) {
            const patchId = crypto.randomUUID();
            const unifiedDiff = String(msg.args.unifiedDiff || msg.args.diff || '');
            const summary = String(msg.args.summary || '');

            // Store the patch
            savePatch({
              patchId,
              unifiedDiff,
              summary,
              createdAt: Date.now(),
              tokenHash: auth.tokenHash,
            });

            sendEvent('patch_proposal', {
              patchId,
              unifiedDiff,
              summary,
            });
          } else {
            sendEvent('tool_call', {
              toolName: msg.toolName,
              toolCallId: msg.toolCallId,
              args: msg.args,
            });
          }
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

    // Build system prompt
    const systemPrompt = buildSystemPrompt(elementContext);

    // Convert messages to simple format
    const chatMessages = messages.map((m) => ({
      role: m.role,
      content: m.content.map((c) => c.text).join('\n'),
    }));

    console.log('[chat] Sending chat to agent...');
    // Send chat request to agent
    await provider.chat({
      messages: chatMessages,
      systemPrompt,
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
