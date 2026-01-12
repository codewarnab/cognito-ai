import type http from 'node:http';
import { readJson, sendError } from '../http/json';
import { requireAuth } from '../http/auth';
import { CliChatRequestSchema } from '../types';
import { findAgent } from '../agents';
import { streamText, stepCountIs } from 'ai';
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import { createCodexCli, isAuthenticationError as isCodexAuthenticationError } from 'ai-sdk-provider-codex-cli';
import {
  createClaudeCode,
  createSdkMcpServer,
  tool as claudeCodeTool,
  isAuthenticationError as isClaudeAuthenticationError,
  isTimeoutError as isClaudeTimeoutError,
  getErrorMetadata as getClaudeErrorMetadata,
} from 'ai-sdk-provider-claude-code';
import { z } from 'zod';
import { getToolExecutionClientCount, getRegisteredTools } from '../mcp/toolStore';
import {
  buildAISDKTools,
  type SSEEventSender,
  generateToolCallId,
  jsonSchemaToZod,
} from './aiSdkTools';
import {
  getExtensionToolNames,
  isExtensionTool,
} from '../mcp/extensionToolsMcpServer';
import {
  getCapabilityMessage,
  createEngagingMessageSender,
  DEFAULT_MESSAGE_INTERVAL,
} from './engagingMessages';

/**
 * Convert Bridge messages to AI SDK format
 */
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

/** Default system prompt for coding agents */
const CODING_AGENT_SYSTEM_PROMPT =
  'You are a coding agent connected to the user\'s Chrome extension. ' +
  'When you need to take actions in the browser (navigate, click, read content), call the available tools. ' +
  'Tool results are returned as structured data; use them to proceed. ' +
  'Be direct and pragmatic.';

/**
 * Handle Gemini CLI agent requests using AI SDK
 */
async function handleGeminiAgent(
  agent: { acpModel?: string },
  messages: Array<{ role: 'user' | 'assistant'; content: Array<any> }>,
  sendEvent: SSEEventSender,
  abortController: AbortController,
  res: http.ServerResponse
): Promise<void> {
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
  const { aiTools } = buildAISDKTools(sendEvent);
  const toolCount = Object.keys(aiTools).length;

  // Send engaging capability message instead of boring "Tools available: X"
  sendEvent('status', { message: getCapabilityMessage(toolCount) });

  // Start sending engaging messages while waiting for AI response
  const engagingMessages = createEngagingMessageSender(sendEvent, DEFAULT_MESSAGE_INTERVAL);
  engagingMessages.start();

  try {
    const result = await streamText({
      model: gemini(effectiveModelId),
      messages: aiMessages as any,
      system: CODING_AGENT_SYSTEM_PROMPT,
      tools: toolCount > 0 ? aiTools : undefined,
      toolChoice: 'auto',
      stopWhen: [stepCountIs(10)],
      abortSignal: abortController.signal,
    });

    // Stop engaging messages once we start receiving the response
    let firstChunkReceived = false;

    for await (const chunk of result.textStream) {
      if (abortController.signal.aborted) break;

      // Stop engaging messages on first chunk
      if (!firstChunkReceived) {
        engagingMessages.stop();
        firstChunkReceived = true;
      }

      if (chunk) {
        sendEvent('text', { content: chunk });
      }
    }

    sendEvent('done', {});
    res.end();
  } catch (err) {
    // Stop engaging messages on error
    engagingMessages.stop();

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
  }
}

/**
 * Handle CodeX CLI agent requests using AI SDK
 */
async function handleCodexAgent(
  agent: { acpModel?: string },
  messages: Array<{ role: 'user' | 'assistant'; content: Array<any> }>,
  sendEvent: SSEEventSender,
  abortController: AbortController,
  res: http.ServerResponse,
  cwd: string
): Promise<void> {
  const codexModelId =
    agent.acpModel ||
    process.env.CODEX_MODEL ||
    'gpt-5.1-codex';

  const apiKey = process.env.OPENAI_API_KEY;
  const authType = apiKey ? 'api-key' : 'oauth';

  sendEvent('status', { message: `Initializing CodeX CLI (${authType})...` });
  sendEvent('status', { message: `Model: ${codexModelId}` });

  // Create CodeX CLI provider with appropriate settings
  const codexProvider = createCodexCli({
    defaultSettings: {
      allowNpx: true, // Allow npx fallback if codex CLI is not installed
      skipGitRepoCheck: true, // Skip git repo safety check for non-repo contexts
      cwd, // Use bridge working directory
      approvalMode: process.env.CODEX_APPROVAL_MODE as any || 'on-failure',
      sandboxMode: process.env.CODEX_SANDBOX_MODE as any || 'workspace-write',
      env: apiKey ? { OPENAI_API_KEY: apiKey } : undefined,
      verbose: process.env.CODEX_VERBOSE === 'true',
    },
  });

  // Convert incoming messages to AI SDK format
  const aiMessages = convertBridgeMessagesToAISDK(messages as any);

  // Build AI SDK tools from extension-registered tool schemas
  const { aiTools } = buildAISDKTools(sendEvent);
  const toolCount = Object.keys(aiTools).length;

  // Send engaging capability message instead of boring "Tools available: X"
  sendEvent('status', { message: getCapabilityMessage(toolCount) });

  // Start sending engaging messages while waiting for AI response
  const engagingMessages = createEngagingMessageSender(sendEvent, DEFAULT_MESSAGE_INTERVAL);
  engagingMessages.start();

  try {
    const result = await streamText({
      model: codexProvider(codexModelId),
      messages: aiMessages as any,
      system: CODING_AGENT_SYSTEM_PROMPT,
      tools: toolCount > 0 ? aiTools : undefined,
      toolChoice: 'auto',
      stopWhen: [stepCountIs(10)],
      abortSignal: abortController.signal,
    });

    // Stop engaging messages once we start receiving the response
    let firstChunkReceived = false;

    for await (const chunk of result.textStream) {
      if (abortController.signal.aborted) break;

      // Stop engaging messages on first chunk
      if (!firstChunkReceived) {
        engagingMessages.stop();
        firstChunkReceived = true;
      }

      if (chunk) {
        sendEvent('text', { content: chunk });
      }
    }

    sendEvent('done', {});
    res.end();
  } catch (err) {
    // Stop engaging messages on error
    engagingMessages.stop();

    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[chat] CodeX stream error:', errorMessage);

    // Check for authentication errors
    if (isCodexAuthenticationError(err)) {
      sendEvent('error', {
        error:
          'Authentication failed. Please run `codex login` in your terminal to authenticate with OpenAI.',
        code: 'AUTH_REQUIRED',
      });
    } else {
      // Generic error with auth hint if using OAuth
      const hint =
        authType === 'oauth'
          ? 'If authentication fails, run `codex login` in your terminal.'
          : undefined;

      sendEvent('error', {
        error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
      });
    }

    sendEvent('done', {});
    res.end();
  }
}

/**
 * Handle Claude Code agent requests using AI SDK with in-process MCP server
 *
 * Claude Code supports custom MCP tools via createSdkMcpServer, which allows
 * us to bridge extension tools to Claude Code. This means all extension tools
 * (navigateTo, clickByText, typeInField, etc.) work with Claude Code alongside
 * its powerful built-in tools (Read, Write, Bash, etc.).
 */
async function handleClaudeCodeAgent(
  agent: { acpModel?: string },
  messages: Array<{ role: 'user' | 'assistant'; content: Array<any> }>,
  sendEvent: SSEEventSender,
  abortController: AbortController,
  res: http.ServerResponse,
  cwd: string
): Promise<void> {
  const claudeCodeModel =
    agent.acpModel ||
    process.env.CLAUDE_CODE_MODEL ||
    'sonnet';

  sendEvent('status', { message: `Initializing Claude Code...` });
  sendEvent('status', { message: `Model: ${claudeCodeModel}` });

  // Get registered extension tools
  const registeredTools = getRegisteredTools();

  // Create MCP tools from extension registry using the Claude Code SDK's tool() helper
  const mcpTools = registeredTools.map((t) => {
    const zodSchema = jsonSchemaToZod(t.parameters);

    return claudeCodeTool(
      t.name,
      t.description || `Extension tool: ${t.name}`,
      zodSchema instanceof z.ZodObject ? zodSchema.shape : {},
      async (args: Record<string, unknown>) => {
        // Claude Code tool-call IDs are internal to the provider and not exposed here.
        // Generate a stable id for the extension UI + HITL approvals, and reuse it
        // as the tool execution requestId.
        const toolCallId = generateToolCallId();

        try {
          sendEvent('tool_call', {
            toolName: t.name,
            toolCallId,
            args,
            serverExecuted: true, // Executed via the bridge/extension
          });

          console.log(`[chat] Claude Code executing extension tool: ${t.name}`, { toolCallId });

          // Check if extension is connected
          const clientCount = getToolExecutionClientCount();
          if (clientCount === 0) {
            sendEvent('tool_result', {
              toolCallId,
              result: { success: false, error: 'No extension connected for tool execution' },
              serverExecuted: true,
            });
            return {
              content: [{ type: 'text' as const, text: 'Error: No extension connected for tool execution' }],
              isError: true,
            };
          }

          // Import dynamically to avoid circular dependency
          const { executeToolOnExtension } = await import('../mcp/toolStore');
          const result = await executeToolOnExtension(t.name, args, {
            requestId: toolCallId,
            interactive: true,
          });

          if (!result.success) {
            sendEvent('tool_result', {
              toolCallId,
              result: { success: false, error: result.error || 'Tool execution failed' },
              serverExecuted: true,
            });
            return {
              content: [{ type: 'text' as const, text: `Error: ${result.error || 'Tool execution failed'}` }],
              isError: true,
            };
          }

          const textResult =
            typeof result.result === 'string'
              ? result.result
              : JSON.stringify(result.result, null, 2);

          sendEvent('tool_result', {
            toolCallId,
            result: result.result,
            serverExecuted: true,
          });

          return {
            content: [{ type: 'text' as const, text: textResult }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[chat] Tool ${t.name} error:`, errorMessage);

          sendEvent('tool_result', {
            toolCallId,
            result: { success: false, error: errorMessage },
            serverExecuted: true,
          });

          return {
            content: [{ type: 'text' as const, text: `Error: ${errorMessage}` }],
            isError: true,
          };
        }
      }
    );
  });

  // Create in-process MCP server with extension tools
  const extensionMcpServer = createSdkMcpServer({
    name: 'extension',
    version: '1.0.0',
    tools: mcpTools,
  });

  // Get extension tool names for allowedTools configuration
  const extensionToolNames = getExtensionToolNames();

  // Combine Claude's built-in coding tools with extension tools
  const allowedTools = [
    // Claude's built-in tools for file operations and shell commands
    'Read', 'Write', 'Edit', 'Bash', 'LS', 'Grep', 'Glob',
    // Extension tools (prefixed with mcp__extension__)
    ...extensionToolNames,
  ];

  sendEvent('status', {
    message: getCapabilityMessage(extensionToolNames.length),
  });

  // Start sending engaging messages while waiting for AI response
  const engagingMessages = createEngagingMessageSender(sendEvent, DEFAULT_MESSAGE_INTERVAL);
  engagingMessages.start();

  // Create Claude Code provider with MCP server configuration
  const claudeCodeProvider = createClaudeCode({
    defaultSettings: {
      mcpServers: { extension: extensionMcpServer },
      allowedTools,
      permissionMode: process.env.CLAUDE_CODE_PERMISSION_MODE as any || 'bypassPermissions',
      cwd,
      verbose: process.env.CLAUDE_CODE_VERBOSE === 'true',
      persistSession: false, // Don't persist extension sessions
      maxTurns: process.env.CLAUDE_CODE_MAX_TURNS
        ? parseInt(process.env.CLAUDE_CODE_MAX_TURNS, 10)
        : undefined,
    },
  });

  // Convert messages to AI SDK format
  const aiMessages = convertBridgeMessagesToAISDK(messages as any);

  // System prompt for the coding agent with extension capabilities
  const systemPrompt =
    'You are a coding agent helping the user via a Chrome extension. ' +
    'You have access to both file system tools (Read, Write, Bash) and browser tools (navigateTo, clickByText, typeInField, readPageContent, takeScreenshot). ' +
    'Use the appropriate tools for the task at hand. Browser tools are prefixed with mcp__extension__.';

  try {
    const result = await streamText({
      model: claudeCodeProvider(claudeCodeModel),
      messages: aiMessages as any,
      system: systemPrompt,
      stopWhen: [stepCountIs(10)],
      abortSignal: abortController.signal,
    });

    // Track Claude Code provider toolCallIds that correspond to extension tools,
    // so we can skip their tool-result events even if toolName is missing.
    const extensionProviderToolCallIds = new Set<string>();

    // Stop engaging messages once we start receiving the response
    let firstPartReceived = false;

    // Process the full stream for complete tool event handling
    for await (const part of result.fullStream) {
      if (abortController.signal.aborted) break;

      // Stop engaging messages on first part
      if (!firstPartReceived) {
        engagingMessages.stop();
        firstPartReceived = true;
      }

      // Use type assertion for extended stream parts from Claude Code SDK
      const streamPart = part as any;

      switch (streamPart.type) {
        case 'text-delta':
          sendEvent('text', { content: streamPart.textDelta });
          break;

        case 'tool-call':
          // Determine if this is an extension tool or Claude's built-in tool
          const toolNameRaw = streamPart.toolName as string;
          const isExtTool = isExtensionTool(toolNameRaw);
          // Extension tool events are emitted from the MCP tool executor above
          // (with UI-aligned ids for approvals). Skip them here to avoid duplicates.
          if (isExtTool) {
            if (typeof streamPart.toolCallId === 'string') {
              extensionProviderToolCallIds.add(streamPart.toolCallId);
            }
            break;
          }

          const displayToolName = toolNameRaw;

          // Parse tool arguments
          let toolArgs: Record<string, unknown> = {};
          try {
            const inputStr = streamPart.input;
            toolArgs = inputStr ? JSON.parse(inputStr) : {};
          } catch {
            toolArgs = streamPart.args || {};
          }

          sendEvent('tool_call', {
            toolName: displayToolName,
            toolCallId: streamPart.toolCallId,
            args: toolArgs,
            serverExecuted: true, // Claude Code executes tools server-side
          });
          break;

        case 'tool-result':
          // Skip extension tool results - emitted from MCP tool executor above.
          if (
            (typeof streamPart.toolName === 'string' && isExtensionTool(streamPart.toolName)) ||
            (typeof streamPart.toolCallId === 'string' && extensionProviderToolCallIds.has(streamPart.toolCallId))
          ) {
            if (typeof streamPart.toolCallId === 'string') {
              extensionProviderToolCallIds.delete(streamPart.toolCallId);
            }
            break;
          }

          sendEvent('tool_result', {
            toolCallId: streamPart.toolCallId,
            result: streamPart.result,
            isError: streamPart.isError,
            serverExecuted: true,
          });
          break;

        case 'error':
          console.error('[chat] Claude Code stream error:', streamPart.error);
          sendEvent('error', {
            error: streamPart.error instanceof Error
              ? streamPart.error.message
              : String(streamPart.error),
          });
          break;
      }
    }

    sendEvent('done', {});
    res.end();
  } catch (err) {
    // Stop engaging messages on error
    engagingMessages.stop();

    const errorMessage = err instanceof Error ? err.message : String(err);
    const metadata = getClaudeErrorMetadata(err);

    console.error('[chat] Claude Code error:', errorMessage);
    if (metadata) {
      console.error('[chat] Error metadata:', metadata);
    }

    // Provide helpful hints based on error type
    let hint: string | undefined;

    if (isClaudeAuthenticationError(err)) {
      hint = 'Not logged in to Claude. Run `claude login` in your terminal to authenticate.';
    } else if (isClaudeTimeoutError(err)) {
      hint = 'Request timed out. Claude Opus may need more time for complex tasks.';
    } else if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
      hint = 'Claude Code CLI not found. Run `npm install -g @anthropic-ai/claude-code` to install.';
    } else if (errorMessage.includes('not logged in') || errorMessage.includes('claude login')) {
      hint = 'Claude Code not authenticated. Run `claude login` in your terminal.';
    }

    sendEvent('error', {
      error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
      metadata,
    });
    sendEvent('done', {});
    res.end();
  }
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

    // ============================================================
    // AI SDK Path: Gemini CLI
    // ============================================================
    if (isGeminiAgent) {
      await handleGeminiAgent(agent, messages, sendEvent, abortController, res);
      return;
    }

    // ============================================================
    // AI SDK Path: CodeX CLI
    // ============================================================
    if (isCodexAgent) {
      await handleCodexAgent(agent, messages, sendEvent, abortController, res, cwd);
      return;
    }

    // ============================================================
    // AI SDK Path: Claude Code with MCP Tool Bridge
    // ============================================================
    if (isClaudeCodeAgent) {
      await handleClaudeCodeAgent(agent, messages, sendEvent, abortController, res, cwd);
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
