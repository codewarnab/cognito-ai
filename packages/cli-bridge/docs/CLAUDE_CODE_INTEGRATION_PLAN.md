# Claude Code AI SDK Integration Plan

## Overview

This document details the implementation plan for adding **Claude Code** support to the Cognito Code Bridge using the `ai-sdk-provider-claude-code` package.

> **Key Finding:** Unlike OpenCode, Claude Code **supports custom MCP tools** via `createSdkMcpServer` / `createCustomMcpServer`. This allows us to bridge extension tools to Claude Code, making it fully compatible with the existing Tool Bridge architecture!

---

## What is Claude Code SDK Provider?

| Aspect | Value |
|--------|-------|
| Package | `ai-sdk-provider-claude-code` |
| AI SDK Version | v6 (LanguageModelV3) |
| Underlying SDK | `@anthropic-ai/claude-agent-sdk` |
| Models | `opus`, `sonnet`, `haiku` (or full model IDs) |
| Custom Tools | ✅ **Supported** via in-process MCP servers |
| Streaming | ✅ Full streaming with tool events |
| Sessions | ✅ Persistent with `resume` option |

### Key Differentiator: Custom Tool Support

Claude Code allows defining **in-process MCP tools** that run within the same process:

```typescript
import { createSdkMcpServer, tool } from 'ai-sdk-provider-claude-code';
import { z } from 'zod';

// Define custom tool
const navigateTo = tool(
  'navigateTo',
  'Navigate browser to a URL',
  { url: z.string() },
  async ({ url }) => {
    // Execute via Tool Bridge
    const result = await executeExtensionTool('navigateTo', { url });
    return { content: [{ type: 'text', text: result }] };
  }
);

// Create SDK MCP server
const bridgeServer = createSdkMcpServer({
  name: 'extension',
  tools: [navigateTo],
});

// Wire to provider
const provider = createClaudeCode({
  defaultSettings: {
    mcpServers: { extension: bridgeServer },
    allowedTools: ['mcp__extension__navigateTo'],
  },
});
```

This means **extension tools CAN be used with Claude Code**!

---

## Provider Analysis

### Provider Creation

```typescript
import { claudeCode, createClaudeCode } from 'ai-sdk-provider-claude-code';

// Default singleton
const model = claudeCode('sonnet');

// Custom configuration
const provider = createClaudeCode({
  defaultSettings: {
    permissionMode: 'bypassPermissions',
    mcpServers: { /* ... */ },
    allowedTools: ['Read', 'Write', 'mcp__extension__*'],
  },
});
```

### Supported Settings

| Setting | Type | Description |
|---------|------|-------------|
| `pathToClaudeCodeExecutable` | `string` | Path to `claude` CLI |
| `permissionMode` | `string` | `'default'`, `'bypassPermissions'`, `'acceptEdits'`, `'plan'` |
| `allowedTools` | `string[]` | Tools to allow (allowlist) |
| `disallowedTools` | `string[]` | Tools to block (denylist) |
| `mcpServers` | `object` | MCP server configurations |
| `systemPrompt` | `string \| preset` | System prompt configuration |
| `maxTurns` | `number` | Max conversation turns |
| `resume` | `string` | Session ID to resume |
| `canUseTool` | `function` | Runtime permission callback |
| `hooks` | `object` | Lifecycle hooks (PreToolUse, PostToolUse) |
| `cwd` | `string` | Working directory |
| `env` | `object` | Environment variables |
| `verbose` | `boolean` | Enable debug logging |
| `persistSession` | `boolean` | Persist session to disk |

### Tool Stream Events

The provider emits full tool streaming events:

| Event | Description |
|-------|-------------|
| `tool-input-start` | Tool use started |
| `tool-input-delta` | Incremental tool input |
| `tool-input-end` | Tool input complete |
| `tool-call` | Full tool call with `providerExecuted: true` |
| `tool-result` | Tool result (JSON parsed when possible) |
| `tool-error` | Tool execution failure |

### Authentication

Claude Code uses the Claude CLI for authentication:

```bash
npm install -g @anthropic-ai/claude-code
claude login
```

No API keys are passed via the provider - authentication is handled by the CLI.

---

## Implementation Plan

> **✅ Implementation Status: COMPLETE**
>
> All phases have been implemented as of January 12, 2026. See the actual implementation in:
> - `package.json` - Added `ai-sdk-provider-claude-code` dependency
> - `src/types.ts` - Extended `AgentDefinition` with `claude-code` provider
> - `src/agents.ts` - Updated Claude Code agent to use AI SDK provider
> - `src/mcp/extensionToolsMcpServer.ts` - New MCP server bridging extension tools
> - `src/handlers/chat.ts` - Added `handleClaudeCodeAgent` handler

### Phase 1: Add Dependencies ✅

**Files to modify:**
- `packages/cli-bridge/package.json`

**Changes:**
```json
{
  "dependencies": {
    "ai-sdk-provider-claude-code": "^3.2.1"
  }
}
```

**Peer dependency:** Requires `zod@^4.0.0` (already available in monorepo).

---

### Phase 2: Update Agent Definitions ✅

**Files to modify:**
- `src/agents.ts`
- `src/types.ts`

**Changes to `src/types.ts`:**
```typescript
export interface AgentDefinition {
  name: string;
  command: string;
  args: string[];
  envHints?: string[];
  aiSdkProvider?: 'gemini-cli' | 'codex-cli' | 'claude-code';  // Add 'claude-code'
  supportsCustomTools?: boolean;  // Indicates if custom tools are supported
}
```

**Changes to `src/agents.ts`:**
```typescript
export const CODE_MODE_AGENTS: AgentDefinition[] = [
  {
    name: 'Gemini CLI',
    command: 'gemini',
    args: ['--experimental-acp'],
    envHints: ['GEMINI_API_KEY'],
    aiSdkProvider: 'gemini-cli',
    supportsCustomTools: true,
  },
  {
    name: 'Claude Code',
    command: 'claude',
    args: [],  // Claude Code uses SDK, not CLI args
    envHints: ['ANTHROPIC_API_KEY'],
    aiSdkProvider: 'claude-code',
    supportsCustomTools: true,  // ✅ Supports custom MCP tools!
  },
  {
    name: 'Codex CLI',
    command: 'codex',
    args: ['--acp'],
    envHints: ['OPENAI_API_KEY'],
    aiSdkProvider: 'codex-cli',
    supportsCustomTools: true,
  },
];
```

---

### Phase 3: Create Extension Tools MCP Server ✅

The key innovation is creating an **in-process MCP server** that bridges extension tools to Claude Code.

**New file:** `src/mcp/extensionToolsMcpServer.ts`

```typescript
import { createSdkMcpServer, tool } from 'ai-sdk-provider-claude-code';
import type { McpSdkServerConfigWithInstance } from 'ai-sdk-provider-claude-code';
import { z, type ZodRawShape } from 'zod';
import type { ToolStore } from '../tools/toolStore.js';
import type { Logger } from '../utils/logger.js';

/**
 * Creates an in-process MCP server that bridges extension tools to Claude Code.
 * This allows Claude Code to use extension tools like navigateTo, clickByText, etc.
 */
export function createExtensionToolsMcpServer(
  toolStore: ToolStore,
  executeToolFn: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  logger?: Logger
): McpSdkServerConfigWithInstance {
  // Get registered tools from the tool store
  const registeredTools = toolStore.getAllTools();
  
  if (registeredTools.length === 0) {
    logger?.info('[mcp] No extension tools registered, creating empty MCP server');
  }

  // Convert extension tool schemas to MCP tool definitions
  const mcpTools = registeredTools.map((registeredTool) => {
    const { name, schema, description } = registeredTool;
    
    // Convert JSON Schema to Zod schema
    const zodSchema = convertJsonSchemaToZod(schema.properties || {});
    
    return tool(
      name,
      description || `Extension tool: ${name}`,
      zodSchema,
      async (args: Record<string, unknown>) => {
        try {
          logger?.debug?.(`[mcp] Executing extension tool: ${name}`, args);
          
          const result = await executeToolFn(name, args);
          
          // Format result for MCP
          const textResult = typeof result === 'string' 
            ? result 
            : JSON.stringify(result, null, 2);
          
          logger?.debug?.(`[mcp] Tool ${name} completed successfully`);
          
          return {
            content: [{ type: 'text', text: textResult }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : String(error);
          
          logger?.error?.(`[mcp] Tool ${name} failed: ${errorMessage}`);
          
          return {
            content: [{ type: 'text', text: `Error: ${errorMessage}` }],
            isError: true,
          };
        }
      }
    );
  });

  return createSdkMcpServer({
    name: 'extension',
    version: '1.0.0',
    tools: mcpTools,
  });
}

/**
 * Get tool names for allowedTools configuration.
 * Format: mcp__extension__toolName
 */
export function getExtensionToolNames(toolStore: ToolStore): string[] {
  return toolStore.getAllTools().map((t) => `mcp__extension__${t.name}`);
}

/**
 * Convert JSON Schema properties to Zod shape.
 * Simplified conversion for common types.
 */
function convertJsonSchemaToZod(
  properties: Record<string, { type?: string; description?: string }>
): ZodRawShape {
  const shape: ZodRawShape = {};
  
  for (const [key, prop] of Object.entries(properties)) {
    switch (prop.type) {
      case 'string':
        shape[key] = z.string().describe(prop.description || '');
        break;
      case 'number':
        shape[key] = z.number().describe(prop.description || '');
        break;
      case 'boolean':
        shape[key] = z.boolean().describe(prop.description || '');
        break;
      case 'object':
        shape[key] = z.record(z.unknown()).describe(prop.description || '');
        break;
      case 'array':
        shape[key] = z.array(z.unknown()).describe(prop.description || '');
        break;
      default:
        shape[key] = z.unknown();
    }
  }
  
  return shape;
}
```

---

### Phase 4: Implement Claude Code Handler in Chat ✅

**Files to modify:**
- `src/handlers/chat.ts`

**Add imports:**
```typescript
import { createClaudeCode, streamText as aiStreamText } from 'ai-sdk-provider-claude-code';
import { 
  createExtensionToolsMcpServer, 
  getExtensionToolNames 
} from '../mcp/extensionToolsMcpServer.js';
```

**Add detection for Claude Code agent:**
```typescript
const isClaudeCodeAgent = 
  agent.name.toLowerCase().includes('claude code') ||
  agent.aiSdkProvider === 'claude-code';
```

**Implement Claude Code handling block:**
```typescript
if (isClaudeCodeAgent) {
  // ============================================================
  // AI SDK + Claude Code Provider with Extension Tool Bridge
  // ============================================================

  const claudeCodeModel = 
    agent.acpModel || 
    process.env.CLAUDE_CODE_MODEL || 
    'sonnet';

  sendEvent('status', { message: `Initializing Claude Code...` });
  sendEvent('status', { message: `Model: ${claudeCodeModel}` });

  // Create extension tools MCP server
  const extensionMcpServer = createExtensionToolsMcpServer(
    toolStore,
    async (toolName, args) => {
      // Execute tool via the Tool Bridge
      return toolStore.executeTool(toolName, args);
    },
    logger
  );

  // Get extension tool names for allowedTools
  const extensionToolNames = getExtensionToolNames(toolStore);
  
  // Combine Claude's built-in tools with extension tools
  const allowedTools = [
    // Claude's built-in coding tools
    'Read', 'Write', 'Edit', 'Bash', 'LS', 'Grep', 'Glob',
    // Extension tools (mcp__extension__toolName format)
    ...extensionToolNames,
  ];

  sendEvent('status', { 
    message: `Loaded ${extensionToolNames.length} extension tools` 
  });

  // Create provider with MCP server and settings
  const claudeCodeProvider = createClaudeCode({
    defaultSettings: {
      mcpServers: { extension: extensionMcpServer },
      allowedTools,
      permissionMode: 'bypassPermissions',  // Auto-approve for extension tools
      cwd,
      verbose: process.env.CLAUDE_CODE_VERBOSE === 'true',
      persistSession: false,  // Don't persist extension sessions
    },
  });

  // Convert messages to AI SDK format
  const aiMessages = convertBridgeMessagesToAISDK(messages as any);

  const systemPrompt = 
    'You are a coding agent helping the user via a Chrome extension. ' +
    'You have access to both file system tools (Read, Write, Bash) and browser tools (navigateTo, clickByText, etc.). ' +
    'Use the appropriate tools for the task at hand.';

  try {
    const result = await streamText({
      model: claudeCodeProvider(claudeCodeModel),
      messages: aiMessages as any,
      system: systemPrompt,
      abortSignal: abortController.signal,
    });

    // Process the full stream
    for await (const part of result.fullStream) {
      if (abortController.signal.aborted) break;

      switch (part.type) {
        case 'text-delta':
          sendEvent('text', { content: part.textDelta });
          break;

        case 'tool-call':
          // Determine if this is an extension tool or Claude's built-in tool
          const isExtensionTool = part.toolName.startsWith('mcp__extension__');
          const toolName = isExtensionTool 
            ? part.toolName.replace('mcp__extension__', '') 
            : part.toolName;

          sendEvent('tool_call', {
            toolName,
            toolCallId: part.toolCallId,
            args: JSON.parse(part.input || '{}'),
            serverExecuted: true,  // Claude Code executes tools
          });
          break;

        case 'tool-result':
          sendEvent('tool_result', {
            toolCallId: part.toolCallId,
            result: part.result,
            isError: part.isError,
            serverExecuted: true,
          });
          break;

        case 'error':
          console.error('[chat] Claude Code stream error:', part.error);
          sendEvent('error', {
            error: part.error instanceof Error 
              ? part.error.message 
              : String(part.error),
          });
          break;
      }
    }

    sendEvent('done', {});
    res.end();
    return;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[chat] Claude Code error:', errorMessage);

    // Provide helpful hints
    let hint: string | undefined;
    if (errorMessage.includes('not logged in') || 
        errorMessage.includes('claude login')) {
      hint = 'Claude Code not authenticated. Run `claude login` to authenticate.';
    } else if (errorMessage.includes('command not found')) {
      hint = 'Claude Code CLI not installed. Run `npm install -g @anthropic-ai/claude-code`.';
    }

    sendEvent('error', {
      error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
    });
    sendEvent('done', {});
    res.end();
    return;
  }
}
```

---

### Phase 5: Tool Execution Flow ✅

The tool execution flow for Claude Code with extension tools:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Chrome Extension                                │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────────┐ │
│  │  Chat UI    │    │ Tool Bridge │    │  Content Script          │ │
│  │             │◄──►│  SSE Client │◄──►│  (navigateTo, click)     │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────────────────────┘ │
└─────────┼──────────────────┼───────────────────────────────────────┘
          │ HTTP POST        │ Tool Registration
          │ /cli/chat        │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      @cognito/cli-bridge                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  Extension Tools MCP Server                     │ │
│  │                                                                 │ │
│  │  mcp__extension__navigateTo  → toolStore.executeTool()          │ │
│  │  mcp__extension__clickByText → toolStore.executeTool()          │ │
│  │  mcp__extension__typeInField → toolStore.executeTool()          │ │
│  │  mcp__extension__...         → toolStore.executeTool()          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  ai-sdk-provider-claude-code                                    │ │
│  │                                                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────────┐  │ │
│  │  │ createClaudeCode│  │ Claude Agent SDK                     │  │ │
│  │  │                 │──│                                      │  │ │
│  │  │ mcpServers:     │  │  - Spawns claude CLI                 │  │ │
│  │  │  extension: ... │  │  - Manages sessions                  │  │ │
│  │  │                 │  │  - Executes tools (built-in + MCP)   │  │ │
│  │  └─────────────────┘  │  - Streams responses                 │  │ │
│  │                       └─────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│                   Claude API (via claude CLI)                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Tool Execution Flow:**

1. Claude decides to use `mcp__extension__navigateTo`
2. Claude Code SDK calls the MCP server's tool handler
3. MCP server calls `toolStore.executeTool('navigateTo', args)`
4. Tool Bridge forwards to extension content script
5. Content script navigates browser
6. Result flows back through the chain
7. Claude receives result and continues

---

### Phase 6: Configuration ✅

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_CODE_MODEL` | Model to use | `sonnet` |
| `CLAUDE_CODE_VERBOSE` | Enable verbose logging | `false` |
| `CLAUDE_CODE_PERMISSION_MODE` | Permission mode | `bypassPermissions` |
| `CLAUDE_CODE_MAX_TURNS` | Max conversation turns | `undefined` |

**Note:** Authentication is handled by `claude login`, not environment variables.

---

### Phase 7: Error Handling ✅

**Files to modify:**
- `src/handlers/chat.ts`

**Import error helpers:**
```typescript
import {
  isAuthenticationError,
  isTimeoutError,
  getErrorMetadata,
} from 'ai-sdk-provider-claude-code';
```

**Handle Claude Code-specific errors:**
```typescript
catch (err) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const metadata = getErrorMetadata(err);
  
  console.error('[chat] Claude Code error:', errorMessage);
  if (metadata) {
    console.error('[chat] Error metadata:', metadata);
  }

  let hint: string | undefined;

  if (isAuthenticationError(err)) {
    hint = 'Not logged in to Claude. Run `claude login` to authenticate.';
  } else if (isTimeoutError(err)) {
    hint = 'Request timed out. Claude Opus may need more time for complex tasks.';
  } else if (errorMessage.includes('command not found')) {
    hint = 'Claude Code CLI not found. Run `npm install -g @anthropic-ai/claude-code`.';
  }

  sendEvent('error', {
    error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
    metadata,
  });
  sendEvent('done', {});
  res.end();
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                                  │
│                                                                          │
│  ┌──────────┐     ┌─────────────┐     ┌───────────────────────────────┐ │
│  │ Chat UI  │◄───►│ Tool Bridge │◄───►│ Content Scripts               │ │
│  │          │     │ SSE Client  │     │ - navigateTo                  │ │
│  │          │     │             │     │ - clickByText                 │ │
│  │          │     │             │     │ - typeInField                 │ │
│  │          │     │             │     │ - readPageContent             │ │
│  └────┬─────┘     └──────┬──────┘     └───────────────────────────────┘ │
└───────┼──────────────────┼──────────────────────────────────────────────┘
        │ HTTP POST        │ Tool Registration
        │ /cli/chat        │ /bridge/tools/register
        ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      @cognito/cli-bridge                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Chat Handler                                 │ │
│  │                                                                     │ │
│  │   if (isGeminiAgent) → gemini-cli provider                         │ │
│  │   if (isCodexAgent)  → codex-cli provider                          │ │
│  │   if (isClaudeCodeAgent) {                                         │ │
│  │     → Claude Code Provider with Extension MCP Server               │ │
│  │   }                                                                 │ │
│  └───────────────────────────────────────────┬────────────────────────┘ │
│                                              │                          │
│  ┌───────────────────────────────────────────▼────────────────────────┐ │
│  │              Extension Tools MCP Server                             │ │
│  │                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ createSdkMcpServer({ name: 'extension', tools: [...] })      │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │                                                                     │ │
│  │  Tool: mcp__extension__navigateTo                                  │ │
│  │    └─► handler(args) → toolStore.executeTool() → Extension → Result│ │
│  │                                                                     │ │
│  │  Tool: mcp__extension__clickByText                                 │ │
│  │    └─► handler(args) → toolStore.executeTool() → Extension → Result│ │
│  │                                                                     │ │
│  │  Tool: mcp__extension__typeInField                                 │ │
│  │    └─► handler(args) → toolStore.executeTool() → Extension → Result│ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                              │                          │
│  ┌───────────────────────────────────────────▼────────────────────────┐ │
│  │              ai-sdk-provider-claude-code                            │ │
│  │                                                                     │ │
│  │  Provider Settings:                                                 │ │
│  │  - mcpServers: { extension: extensionMcpServer }                   │ │
│  │  - allowedTools: ['Read', 'Write', 'Bash', 'mcp__extension__*']    │ │
│  │  - permissionMode: 'bypassPermissions'                             │ │
│  │                                                                     │ │
│  │  Streaming:                                                         │ │
│  │  - text-delta → SSE 'text' event                                   │ │
│  │  - tool-call  → SSE 'tool_call' event                              │ │
│  │  - tool-result → SSE 'tool_result' event                           │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                              │                          │
└──────────────────────────────────────────────┼──────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Claude Agent SDK                                   │
│                                                                          │
│  - Spawns `claude` CLI process                                          │
│  - Manages authentication via `claude login`                            │
│  - Handles sessions and conversation state                              │
│  - Executes built-in tools (Read, Write, Bash, etc.)                    │
│  - Calls MCP server tools (extension tools)                             │
│  - Streams responses back                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
                             Claude API (Anthropic servers)
```

---

## Comparison: Claude Code vs Other Providers

| Feature | Gemini CLI | CodeX CLI | Claude Code |
|---------|-----------|-----------|-------------|
| AI SDK Version | v6 | v6 | v6 |
| Custom Tools | ✅ Direct | ✅ Direct | ✅ Via MCP Server |
| Built-in Tools | No | Yes | Yes (Read, Write, Bash) |
| Authentication | API Key | API Key | CLI login |
| Sessions | Per-request | Per-request | Persistent |
| Tool Events | Standard | Standard | Enhanced (input/delta/end) |
| Permission System | N/A | Sandbox modes | Full permission modes |

---

## Key Benefits

### 1. Full Tool Bridge Compatibility

Unlike OpenCode, Claude Code **supports custom tools** via MCP servers. This means:
- All extension tools work with Claude Code
- Same tool execution flow as Gemini CLI
- No functionality lost

### 2. Powerful Built-in Tools

Claude Code includes powerful built-in coding tools:
- `Read` - Read files
- `Write` - Write files
- `Edit` - Edit files
- `Bash` - Execute shell commands
- `LS`, `Grep`, `Glob` - File system navigation

### 3. Enhanced User Experience

- CLI authentication (`claude login`) - no API key management
- Persistent sessions - conversation context preserved
- Permission system - fine-grained tool access control

---

## Limitations

### 1. CLI Dependency

Claude Code requires the `@anthropic-ai/claude-code` CLI:
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

### 2. Process Spawning

Claude Code spawns a CLI process, which may:
- Have slightly higher latency than direct API calls
- Require proper PATH configuration

### 3. Zod 4 Requirement

The provider requires Zod 4 for schema definitions:
```bash
npm install zod@^4.0.0
```

---

## Timeline Estimate

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1 | 15 min | Add dependency |
| Phase 2 | 30 min | Update agent definitions |
| Phase 3 | 2 hours | Create Extension Tools MCP Server |
| Phase 4 | 1.5 hours | Implement Claude Code handler |
| Phase 5 | 30 min | Tool execution integration |
| Phase 6 | 30 min | Configuration |
| Phase 7 | 30 min | Error handling |
| Testing | 1.5 hours | Manual verification |

**Total: ~7 hours**

---

## Related Documentation

- [AI SDK Gemini CLI Provider Plan](./AI_SDK_GEMINI_CLI_PROVIDER_PLAN.md)
- [CodeX CLI Integration Plan](./CODEX_CLI_INTEGRATION_PLAN.md)
- [ai-sdk-provider-claude-code README](https://github.com/ben-vargas/ai-sdk-provider-claude-code)
- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
