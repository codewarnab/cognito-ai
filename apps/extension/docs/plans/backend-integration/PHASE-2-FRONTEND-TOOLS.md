# Phase 2: Frontend Tools Support

## Overview

This phase adds full tool support to backend mode using the **Frontend Tools Pattern**. The AI model runs on our backend, but tool execution happens in the browser where the extension has access to tabs, DOM, MCP servers, etc.

**Goal:** Enable all tools in backend mode while keeping tool execution in the browser.

**Scope:**
- ✅ Frontend tools pattern (AI on backend, tools in browser)
- ✅ All existing browser tools (tabs, DOM, clipboard, etc.)
- ✅ MCP server tools
- ✅ Tool call/result streaming
- ❌ WebMCP integration (Phase 3)

## Prerequisites

- Phase 1 completed and working
- Understanding of the frontend tools pattern from `@assistant-ui/react-ai-sdk`

## Architecture: Frontend Tools Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXTENSION (Browser)                               │
│  ┌───────────────────┐                    ┌────────────────────────────┐│
│  │  User Message     │───── HTTP ────────▶│     Vercel Backend         ││
│  │  + Tool Schemas   │                    │  • AI generates response   ││
│  └───────────────────┘                    │  • Decides to call tool    ││
│                                           └─────────────┬──────────────┘│
│                                                         │                │
│                                           ┌─────────────▼──────────────┐│
│                                           │  Stream: tool_call event   ││
│                                           │  { name, args }            ││
│                                           └─────────────┬──────────────┘│
│                                                         │                │
│  ┌───────────────────┐                    ┌─────────────▼──────────────┐│
│  │  Execute Tool     │◀───────────────────│  Frontend receives call   ││
│  │  (in browser)     │                    │  and executes locally      ││
│  │  • readPageContent│                    └────────────────────────────┘│
│  │  • getActiveTab   │                                                  │
│  │  • MCP tools      │                    ┌────────────────────────────┐│
│  └─────────┬─────────┘                    │  Stream: tool_result event ││
│            │                              │  { result }                ││
│            └───── Send result back ──────▶│                            ││
│                                           └─────────────┬──────────────┘│
│                                                         │                │
│                                           ┌─────────────▼──────────────┐│
│                                           │  AI continues with result  ││
│                                           │  (may call more tools)     ││
│                                           └────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## How Frontend Tools Work

1. **Extension sends tool schemas** (not implementations) to backend
2. **Backend AI decides** to call a tool and streams `tool_call` event
3. **Extension intercepts** the tool call and executes it locally
4. **Extension sends result** back to backend
5. **Backend AI continues** with the tool result, possibly calling more tools
6. **Repeat** until AI finishes with a text response

## Tool Categories

### Already Backend Tools (Work in Phase 1)
These tools already call our Vercel backend:
- `webSearch` - Tavily search via `/web-search`
- `deepResearch` - Extended search with multiple queries
- `retrieve` - Jina Reader via `/retrieve`

### Frontend Tools (Phase 2 Focus)
These tools need browser context and must execute in the extension:
- `getActiveTab` - Get current tab info
- `readPageContent` - Read DOM content
- `navigateTo` - Navigate browser
- `clickElement` - DOM interaction
- `executeJavaScript` - Run scripts in page
- `manageTabs` - Tab management
- `manageBookmarks` - Bookmarks API
- All MCP server tools

---

## Implementation Steps

### Step 1: Backend Endpoint with Tool Support

**File:** `packages/backend-vercel/src/routes/ai.ts`

> [!NOTE]
> The backend is now fully TypeScript with a modular structure:
> - `src/config/config.ts` - Centralized configuration with typed `Config` interface
> - `src/services/ai.ts` - AI SDK lazy-loading via `getAIModules()`
> - `src/middleware/rateLimit.ts` - Rate limiting with `checkAIChatRateLimit()`
> - `src/middleware/logging.ts` - Request logging with `getClientIp()`
> - `src/routes/ai.ts` - AI endpoints (add new endpoint here)
>
> The existing `/api/ai/chat` endpoint provides a good template for the new tools endpoint.

```typescript
// Add to src/routes/ai.ts (after existing imports)

import { z } from 'zod';

// ... existing imports already present:
// import { Router, Request, Response } from 'express';
// import { config } from '../config/config';
// import { getAIModules } from '../services/ai';
// import { checkAIChatRateLimit, AI_RATE_LIMIT_WINDOW } from '../middleware/rateLimit';
// import { getClientIp } from '../middleware/logging';

/**
 * POST /api/ai/chat-with-tools
 * 
 * Chat endpoint with frontend tools support.
 * Tools are defined by schemas from the client but executed on the client.
 */
router.post('/chat-with-tools', async (req: Request, res: Response) => {
    // Rate limiting (same pattern as /chat endpoint)
    const ip = getClientIp(req);
    if (!checkAIChatRateLimit(ip)) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please wait a moment and try again.',
            retryAfter: AI_RATE_LIMIT_WINDOW / 1000,
        });
    }

    try {
        const { messages, system, tools: toolSchemas = {}, model: modelName = 'gemini-2.0-flash' } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'messages array is required',
            });
        }

        if (!config.googleAiApiKey) {
            console.error('[AI Chat+Tools] GOOGLE_AI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'AI service not properly configured',
            });
        }

        console.log('[AI Chat+Tools] Processing request:', {
            messageCount: messages.length,
            toolCount: Object.keys(toolSchemas).length,
            model: modelName,
            ip: typeof ip === 'string' ? ip.substring(0, 20) : 'unknown',
        });

        // Load AI SDK modules (lazy-loaded from services/ai.ts)
        const { createGoogleGenerativeAI, streamText, tool } = await getAIModules();
        const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
        const model = google(modelName);

        // Convert tool schemas to AI SDK format
        const frontendTools = createFrontendTools(toolSchemas);

        const result = streamText({
            model,
            messages: messages as Parameters<typeof streamText>[0]['messages'],
            system: system || 'You are Cognito, a helpful AI assistant in a Chrome extension.',
            tools: frontendTools,
            maxSteps: 10,
            maxTokens: 4096,
        });

        // Set headers for streaming (same pattern as /chat)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        return result.pipeDataStreamToResponse(res);
    } catch (error) {
        console.error('[AI Chat+Tools] Error:', error instanceof Error ? error.message : 'Unknown error');
        // ... error handling (same pattern as /chat endpoint)
    }
});

/**
 * Convert client tool schema to Zod schema
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodObject<z.ZodRawShape> {
    // Implementation to convert JSON Schema to Zod...
}

/**
 * Create AI SDK tools from client schemas
 */
function createFrontendTools(toolSchemas: Record<string, unknown>): Record<string, unknown> {
    // Implementation to create frontend tools...
}
```

> [!TIP]
> You may also want to add `tool` to the exports in `src/services/ai.ts` if not already present:
> ```typescript
> export async function getAIModules(): Promise<AIModules> {
>     // ... existing code
>     return {
>         createGoogleGenerativeAI: googleAI,
>         tool: aiSdk.tool,  // Add this for frontend tools
>         ...aiSdk,
>     };
> }
> ```

---

### Step 2: Frontend Tool Executor

**File:** `apps/extension/src/ai/backend/frontendToolExecutor.ts` (NEW)

```typescript
/**
 * Frontend Tool Executor
 * 
 * Intercepts tool calls from the backend stream and executes them locally.
 * Returns results that can be sent back to continue the AI response.
 */

import { createLogger } from '~logger';
import { getToolRegistry } from '../tools/registry';

const log = createLogger('FrontendToolExecutor', 'TOOLS_EXECUTION');

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  result: unknown;
  isError?: boolean;
}

/**
 * Execute a tool call locally in the browser
 */
export async function executeToolLocally(toolCall: ToolCall): Promise<ToolResult> {
  log.info('Executing tool locally:', { 
    id: toolCall.id, 
    name: toolCall.name 
  });

  try {
    // Get tool from registry
    const registry = getToolRegistry();
    const tool = registry.get(toolCall.name);

    if (!tool) {
      throw new Error(`Tool "${toolCall.name}" not found in registry`);
    }

    // Execute the tool
    const result = await tool.execute(toolCall.arguments);

    log.info('Tool executed successfully:', { 
      id: toolCall.id, 
      name: toolCall.name,
      resultType: typeof result 
    });

    return {
      id: toolCall.id,
      result,
      isError: false,
    };

  } catch (error) {
    log.error('Tool execution failed:', { 
      id: toolCall.id, 
      name: toolCall.name, 
      error 
    });

    return {
      id: toolCall.id,
      result: error instanceof Error ? error.message : String(error),
      isError: true,
    };
  }
}

/**
 * Get tool schemas for sending to backend
 * Extracts just the schema (no execute function) for each tool
 */
export function getToolSchemas(): Record<string, { description: string; parameters: unknown }> {
  const registry = getToolRegistry();
  const schemas: Record<string, { description: string; parameters: unknown }> = {};

  for (const [name, tool] of registry.entries()) {
    schemas[name] = {
      description: tool.description,
      parameters: tool.parameters, // JSON Schema format
    };
  }

  return schemas;
}
```

---

### Step 3: Enhanced Backend Chat with Tools

**File:** `apps/extension/src/ai/backend/backendChatWithTools.ts` (NEW)

```typescript
/**
 * Backend Chat with Frontend Tools
 * 
 * Handles the full tool execution loop:
 * 1. Send message + tool schemas to backend
 * 2. Stream response, intercepting tool calls
 * 3. Execute tools locally
 * 4. Send results back to continue generation
 */

import { createUIMessageStream, generateId, type UIMessage } from 'ai';
import { createLogger } from '~logger';
import { executeToolLocally, getToolSchemas, type ToolCall, type ToolResult } from './frontendToolExecutor';

const log = createLogger('BackendChatWithTools', 'AI_CHAT');

const BACKEND_URL = import.meta.env.WXT_BACKEND_API_URL || 'https://cognito-ai-api.vercel.app';

export interface BackendChatWithToolsParams {
  messages: UIMessage[];
  systemPrompt?: string;
  abortSignal?: AbortSignal;
  onError?: (error: Error) => void;
  onFinishCallback?: () => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
}

export async function streamBackendChatWithTools(params: BackendChatWithToolsParams) {
  const { 
    messages, 
    systemPrompt,
    abortSignal, 
    onError, 
    onFinishCallback,
    onToolCall,
    onToolResult,
  } = params;

  log.info('Starting backend chat with tools', { messageCount: messages.length });

  // Get tool schemas to send to backend
  const toolSchemas = getToolSchemas();
  log.info('Sending tool schemas to backend', { toolCount: Object.keys(toolSchemas).length });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: { status: 'processing', timestamp: Date.now() },
          transient: true,
        });

        // This will be our conversation including tool results
        let conversationMessages = [...messages];
        let continueLoop = true;
        let stepCount = 0;
        const maxSteps = 10;

        while (continueLoop && stepCount < maxSteps) {
          stepCount++;
          log.info(`Step ${stepCount}: Sending to backend`);

          const response = await fetch(`${BACKEND_URL}/api/ai/chat-with-tools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: conversationMessages.map(m => ({
                role: m.role,
                content: m.content,
              })),
              system: systemPrompt,
              tools: toolSchemas,
            }),
            signal: abortSignal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Backend error: ${response.status}`);
          }

          // Process streaming response
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let pendingToolCalls: ToolCall[] = [];
          let hasText = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.trim()) continue;

              // Parse AI SDK stream format
              if (line.startsWith('0:')) {
                // Text delta
                const text = JSON.parse(line.slice(2));
                hasText = true;
                writer.write({
                  type: 'text-delta',
                  id: 'text-' + generateId(),
                  delta: text,
                });
              } else if (line.startsWith('9:')) {
                // Tool call
                const toolCallData = JSON.parse(line.slice(2));
                const toolCall: ToolCall = {
                  id: toolCallData.toolCallId,
                  name: toolCallData.toolName,
                  arguments: toolCallData.args,
                };
                pendingToolCalls.push(toolCall);
                onToolCall?.(toolCall);

                // Write tool call to UI stream
                writer.write({
                  type: 'tool-call',
                  id: toolCall.id,
                  toolName: toolCall.name,
                  args: toolCall.arguments,
                });
              }
            }
          }

          // If there are tool calls, execute them and continue
          if (pendingToolCalls.length > 0) {
            log.info(`Executing ${pendingToolCalls.length} tool calls locally`);

            const toolResults: ToolResult[] = [];

            for (const toolCall of pendingToolCalls) {
              const result = await executeToolLocally(toolCall);
              toolResults.push(result);
              onToolResult?.(result);

              // Write tool result to UI stream
              writer.write({
                type: 'tool-result',
                id: result.id,
                result: result.result,
                isError: result.isError,
              });
            }

            // Add tool calls and results to conversation for next round
            conversationMessages = [
              ...conversationMessages,
              {
                role: 'assistant' as const,
                content: pendingToolCalls.map(tc => ({
                  type: 'tool-call' as const,
                  toolCallId: tc.id,
                  toolName: tc.name,
                  args: tc.arguments,
                })),
              },
              {
                role: 'tool' as const,
                content: toolResults.map(tr => ({
                  type: 'tool-result' as const,
                  toolCallId: tr.id,
                  result: tr.result,
                })),
              },
            ] as UIMessage[];

            pendingToolCalls = [];
            // Continue the loop for more generation
          } else {
            // No tool calls, we're done
            continueLoop = false;
          }
        }

        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: { status: 'completed', timestamp: Date.now() },
          transient: true,
        });

        onFinishCallback?.();

      } catch (error) {
        log.error('Backend chat with tools error:', error);
        
        writer.write({
          type: 'text-delta',
          id: 'error-' + generateId(),
          delta: `\n\n❌ **Error:** ${error instanceof Error ? error.message : 'Unknown error'}`,
        });

        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: { status: 'error', timestamp: Date.now() },
          transient: false,
        });

        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });

  return stream;
}
```

---

### Step 4: Update Backend Export

**File:** `apps/extension/src/ai/backend/index.ts`

```typescript
export { streamBackendChat, type BackendChatParams } from './backendChat';
export { streamBackendChatWithTools, type BackendChatWithToolsParams } from './backendChatWithTools';
export { executeToolLocally, getToolSchemas, type ToolCall, type ToolResult } from './frontendToolExecutor';
```

---

### Step 5: Update AI Logic for Tools

**File:** `apps/extension/src/ai/core/aiLogic.ts`

Update the backend mode branch to use the tools version:

```typescript
import { streamBackendChatWithTools } from '../backend';

// In streamAIResponse:
if (useBackendMode) {
  log.info('🌐 Using BACKEND MODE with tools - routing to Vercel backend');
  return streamBackendChatWithTools({
    messages,
    systemPrompt: enhancedPrompt, // Full system prompt with context
    abortSignal,
    onError,
    onFinishCallback,
    onToolCall: (tc) => log.info('Tool call:', tc.name),
    onToolResult: (tr) => log.info('Tool result:', tr.id),
  });
}
```

---

## Testing Checklist

### Backend Testing
- [ ] `/api/ai/chat-with-tools` handles tool schemas correctly
- [ ] Tool calls are included in stream response
- [ ] Messages with tool results are processed correctly
- [ ] Multi-step tool usage works (up to 10 steps)

### Extension Testing
- [ ] Tool schemas are correctly extracted from registry
- [ ] Tool calls from stream are intercepted
- [ ] Tools execute correctly in browser context
- [ ] Tool results are sent back to backend
- [ ] UI shows tool calls and results properly
- [ ] MCP tools work in backend mode

### Integration Testing
- [ ] `readPageContent` works in backend mode
- [ ] `getActiveTab` works in backend mode
- [ ] `webSearch` (backend tool) still works
- [ ] Multi-tool conversations complete successfully
- [ ] Error in one tool doesn't break the conversation

---

## Success Criteria

Phase 2 is complete when:

1. **All browser tools work** in backend mode
2. **MCP server tools work** in backend mode  
3. **Tool calls display** properly in chat UI
4. **Multi-step conversations** with tools complete successfully
5. **Error handling** is robust for tool failures

---

## Next Steps

Once Phase 2 is complete, proceed to:
→ [PHASE-3-ADVANCED-FEATURES.md](./PHASE-3-ADVANCED-FEATURES.md)
