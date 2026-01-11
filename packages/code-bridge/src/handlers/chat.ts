import type http from 'node:http';
import { readJson, sendError } from '../http/json.js';
import { requireAuth } from '../http/auth.js';
import { CliChatRequestSchema } from '../types.js';
import { createACPProvider, type ACPMessage } from '../acp/acpProvider.js';
import { findAgent } from '../agents.js';
import { streamText, stepCountIs } from 'ai';
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import { z } from 'zod';
import {
  executeToolOnExtension,
  getRegisteredTools,
  getToolExecutionClientCount,
} from '../mcp/toolStore.js';

type ToolNameMapping = Map<string, { originalName: string }>;

function generateToolCallId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Gemini function names must:
 * - start with a letter or underscore (not a digit)
 * - contain only alphanumeric, underscores, dots, colons, dashes
 */
function sanitizeToolName(name: string): string {
  let sanitized = name;
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `fn_${sanitized}`;
  }
  sanitized = sanitized.replace(/[^a-zA-Z0-9_.:-]/g, '_');
  return sanitized;
}

/**
 * Convert JSON Schema to Zod schema (best-effort).
 * We intentionally lean permissive to avoid rejecting model-produced arguments.
 */
function jsonSchemaToZod(schema: unknown): z.ZodTypeAny {
  try {
    if (!schema || typeof schema !== 'object') {
      return z.any();
    }

    const s = schema as Record<string, unknown>;
    const enumValues = s.enum as unknown;

    // Enum (string-only) -> z.enum
    if (Array.isArray(enumValues) && enumValues.every((v) => typeof v === 'string')) {
      const values = enumValues as string[];
      if (values.length >= 1) {
        return z.enum(values as [string, ...string[]]);
      }
    }

    const type = s.type as unknown;

    // Union types (anyOf/oneOf) - fallback permissive
    if (Array.isArray(s.anyOf) || Array.isArray(s.oneOf)) {
      return z.any();
    }

    switch (type) {
      case 'string':
        return z.string();
      case 'number':
      case 'integer':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'null':
        return z.null();
      case 'array': {
        const items = s.items as unknown;
        return z.array(items ? jsonSchemaToZod(items) : z.any());
      }
      case 'object': {
        const properties = s.properties as unknown;
        const required = s.required as unknown;

        if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
          return z.record(z.string(), z.any());
        }

        const requiredKeys = Array.isArray(required) ? required.filter((v) => typeof v === 'string') as string[] : [];
        const shape: Record<string, z.ZodTypeAny> = {};

        for (const [key, propSchema] of Object.entries(properties as Record<string, unknown>)) {
          let propZod = jsonSchemaToZod(propSchema);
          if (!requiredKeys.includes(key)) {
            propZod = propZod.optional();
          }
          shape[key] = propZod;
        }

        // Passthrough to tolerate extra args that the model may include.
        return z.object(shape).passthrough();
      }
      default:
        return z.any();
    }
  } catch {
    return z.any();
  }
}

function convertBridgeMessagesToAISDK(
  messages: Array<{ role: 'user' | 'assistant'; content: Array<any> }>
): Array<{ role: 'user' | 'assistant'; content: Array<any> }> {
  return messages
    .map((m) => {
      const parts = m.content
      .map((p) => {
        if (!p || typeof p !== 'object') return null;

        if (p.type === 'text') {
          return { type: 'text' as const, text: String((p as any).text ?? '') };
        }

        // Gemini provider expects "file" parts for all non-text inputs.
        const mimeType = String((p as any).mimeType ?? 'application/octet-stream');
        const data = String((p as any).data ?? '');

        if (m.role === 'user') {
          return { type: 'file' as const, data, mediaType: mimeType };
        }

        // Assistant history rarely contains files; fall back to a text placeholder.
        const name = typeof (p as any).name === 'string' ? (p as any).name : undefined;
        return {
          type: 'text' as const,
          text: name
            ? `[Attachment omitted: ${name} (${mimeType})]`
            : `[Attachment omitted: ${mimeType}]`,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

      return { role: m.role, content: parts };
    })
    // Gemini rejects empty message parts; drop empty messages defensively.
    .filter((m) => m.content.length > 0);
}

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

    const abortController = new AbortController();
    req.on('close', () => {
      console.log('[chat] Client disconnected, aborting stream');
      abortController.abort();
    });

    const isGeminiAgent = agent.name.toLowerCase().includes('gemini');

    if (isGeminiAgent) {
      // ============================================================
      // Option B: AI SDK + Gemini CLI Provider + extension tools
      // ============================================================

      const geminiModelId =
        agent.acpModel ||
        process.env.COGNITO_GEMINI_MODEL ||
        process.env.GEMINI_MODEL ||
        'gemini-2.5-flash';

      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
      const authType = apiKey ? 'api-key' : 'oauth-personal';

      sendEvent('status', { message: `Initializing Gemini (${authType})...` });
      // Gemini 3 models require thought signatures for function calls (tools) in some environments.
      // AI SDK tool calling does not currently expose/roundtrip these signatures, so tool use fails.
      // Fall back to Gemini 2.5 models for reliable tool calling.
      const requestedModelId = geminiModelId;
      const usingGemini3 = requestedModelId.toLowerCase().startsWith('gemini-3');
      const effectiveModelId = usingGemini3 ? 'gemini-2.5-flash' : requestedModelId;

      if (usingGemini3) {
        sendEvent('status', {
          message:
            `Model "${requestedModelId}" requires thought-signatures for tool calls; ` +
            `falling back to "${effectiveModelId}" for CLI Mode tools.`,
        });
      } else {
        sendEvent('status', { message: `Model: ${requestedModelId}` });
      }

      const gemini =
        authType === 'api-key'
          ? createGeminiProvider({ authType, apiKey })
          : createGeminiProvider({ authType });

      // Convert incoming messages to AI SDK format (text + file parts)
      const aiMessages = convertBridgeMessagesToAISDK(messages as any);

      // Build AI SDK tools from extension-registered tool schemas
      const registeredTools = getRegisteredTools();
      const toolNameMapping: ToolNameMapping = new Map();
      const aiTools: Record<string, any> = {};

      for (const t of registeredTools) {
        const originalName = t.name;
        const baseSanitized = sanitizeToolName(originalName);

        // Resolve collisions if any
        let sanitizedName = baseSanitized;
        let suffix = 2;
        while (toolNameMapping.has(sanitizedName) && toolNameMapping.get(sanitizedName)!.originalName !== originalName) {
          sanitizedName = `${baseSanitized}_${suffix++}`;
        }

        toolNameMapping.set(sanitizedName, { originalName });

        aiTools[sanitizedName] = {
          description: t.description || `Tool: ${originalName}`,
          inputSchema: jsonSchemaToZod(t.parameters as unknown),
          execute: async (args: unknown, options?: any) => {
            const toolCallId =
              typeof options?.toolCallId === 'string' ? options.toolCallId : generateToolCallId();

            const argsForEvent =
              args && typeof args === 'object' && !Array.isArray(args)
                ? (args as Record<string, unknown>)
                : { value: args };

            sendEvent('tool_call', {
              toolName: originalName,
              toolCallId,
              args: argsForEvent,
            });

            const connectedClients = getToolExecutionClientCount();
            if (connectedClients === 0) {
              const error = 'No extension connected for tool execution. Pair the extension and ensure tool events are connected.';
              sendEvent('tool_result', {
                toolCallId,
                result: { success: false, error },
              });
              return { error: true, message: error };
            }

            sendEvent('status', { message: `Running tool: ${originalName}` });
            const start = Date.now();

            const result = await executeToolOnExtension(originalName, args);
            const durationMs = Date.now() - start;

            console.log('[chat] Tool executed:', {
              toolName: originalName,
              toolCallId,
              success: result.success,
              durationMs,
            });

            sendEvent('tool_result', {
              toolCallId,
              result: result.success ? result.result : { success: false, error: result.error },
            });

            if (result.success) {
              return result.result;
            }

            return {
              error: true,
              message: result.error || 'Tool execution failed',
              toolName: originalName,
              toolCallId,
            };
          },
        };
      }

      sendEvent('status', {
        message: `Tools available: ${Object.keys(aiTools).length} (execution clients: ${getToolExecutionClientCount()})`,
      });

      const systemPrompt =
        'You are a coding agent connected to the user’s Chrome extension. ' +
        'When you need to take actions in the browser (navigate, click, read content), call the available tools. ' +
        'Tool results are returned as structured data; use them to proceed. ' +
        'Be direct and pragmatic.';

      try {
        const result = await streamText({
          model: gemini(effectiveModelId),
          messages: aiMessages as any,
          system: systemPrompt,
          tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
          toolChoice: 'auto',
          stopWhen: [stepCountIs(10)],
          abortSignal: abortController.signal,
        });

        for await (const chunk of result.textStream) {
          if (abortController.signal.aborted) break;
          if (chunk) {
            sendEvent('text', { content: chunk });
          }
        }

        sendEvent('done', {});
        res.end();
        return;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[chat] Gemini stream error:', errorMessage);

        // Extra hint for missing OAuth creds
        const hint =
          authType === 'oauth-personal'
            ? 'If you have not authenticated yet, run `gemini` once in your terminal and complete the login flow.'
            : undefined;

        sendEvent('error', {
          error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
        });
        sendEvent('done', {});
        res.end();
        return;
      }
    }

    // ============================================================
    // Fallback: ACP agent spawning (Claude Code, Codex CLI, etc.)
    // ============================================================

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
