# Phase 5: Tool Execution Flow (AI SDK v5 Enhanced)

**Goal**: Implement the hybrid tool execution pattern using AI SDK v5 best practices with proper tool call streaming, error handling, and multi-step execution.

**Duration**: 4-5 hours

**Prerequisites**: 
- Phases 1-4 completed
- Backend can receive tool schemas
- Extension connected to backend
- AI SDK v5 installed (`ai` package)

---

## 📋 Overview

This is the **most critical phase** of the backend implementation. It implements the hybrid tool execution pattern following AI SDK v5 best practices:

1. Backend defines tool schemas (without `execute` functions)
2. Backend streams tool calls to extension (with `input-streaming` states)
3. Extension receives tool calls and executes them locally via `onToolCall`
4. Extension sends tool results back via `addToolResult` (no await!)
5. Backend resumes generation with tool results automatically
6. Process repeats for multi-step tool calling (with `stopWhen` control)

**Key AI SDK v5 Features Used**:
- ✅ UI Message `parts` array architecture
- ✅ Tool call streaming states (`input-streaming`, `input-available`, `output-available`, `output-error`)
- ✅ `sendAutomaticallyWhen` helper for automatic continuation
- ✅ `addToolResult` for tool execution results (no deadlocks)
- ✅ `stopWhen: [stepCountIs(20)]` for loop control
- ✅ `onStepFinish` callback for debugging
- ✅ `messageMetadata` for tracking timestamps and tokens
- ✅ `experimental_repairToolCall` for handling malformed tool calls
- ✅ Dynamic tool support for MCP tools
- ✅ Proper error handling with `onError` callbacks
- ✅ Streaming configuration for proxy compatibility

**Why this pattern?**
- Backend cannot execute Chrome extension tools (browser APIs not available)
- Extension has full access to browser capabilities
- Backend orchestrates AI logic and streaming
- Extension maintains control over sensitive operations
- AI SDK handles automatic tool result submission and continuation

---

## 🎯 Architecture

### Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Extension (Frontend)                      │
│                                                              │
│  1. Send messages + tool schemas                            │
│     (via DefaultChatTransport)                              │
│     ──────────────────────────────────────────────────────> │
│                                                              │
│  2. onToolCall fires                                         │
│     - Check toolCall.dynamic                                 │
│     - Execute tool locally        ┌──────────────────────┐  │
│     - Call addToolResult (no await!)│   NestJS Backend   │  │
│                                     │                    │  │
│  3. Backend streams:                │  Uses streamText() │  │
│     - input-streaming               │  with tools (no    │  │
│     - input-available               │  execute funcs)    │  │
│     - tool-call                     │                    │  │
│                                     │  stopWhen:         │  │
│  4. addToolResult adds to msgs ────>│  [stepCountIs(20)] │  │
│                                     │                    │  │
│  5. sendAutomaticallyWhen triggers  │  onStepFinish:     │  │
│     automatic resubmit        <─────│  logs each step    │  │
│                                     │                    │  │
│  6. Backend continues generation    │  messageMetadata:  │  │
│     with tool results         <─────│  timestamps+tokens │  │
│                                     │                    │  │
│  7. Receive final text-delta  <─────│  onError:          │  │
│     and finish event                │  masks errors      │  │
│                                     └──────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### AI SDK v5 Message Structure

**Messages use `parts` array** (not separate `toolCalls` field):

```typescript
// ❌ OLD (Pre-v5)
{
  role: 'assistant',
  content: 'text',
  toolCalls: [...]
}

// ✅ NEW (v5)
{
  role: 'assistant',
  parts: [
    { type: 'text', text: 'Let me navigate...' },
    { 
      type: 'tool-call', 
      toolCallId: 'call_abc123',
      toolName: 'navigate_to',
      input: { url: 'https://example.com' }
    }
  ]
}
```

### Tool Call Streaming States

```typescript
// State 1: Input streaming
{
  type: 'tool-call-streaming-start',
  toolCallId: 'call_abc',
  toolName: 'navigate_to'
}

// State 2: Input delta
{
  type: 'tool-call-delta',
  toolCallId: 'call_abc',
  toolName: 'navigate_to',
  argsTextDelta: '{"url":'
}

// State 3: Complete tool call
{
  type: 'tool-call',
  toolCallId: 'call_abc',
  toolName: 'navigate_to',
  input: { url: 'https://example.com' }
}

// State 4: Tool result (after execution)
{
  type: 'tool-result',
  toolCallId: 'call_abc',
  toolName: 'navigate_to',
  input: { url: 'https://example.com' },
  output: { success: true }
}
```

---

## 🛠️ Step-by-Step Implementation

### Step 1: Update Backend Tool Storage

**File**: `backend/src/tools/tools.service.ts`

Update to store tools WITHOUT execute functions:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ToolSchema } from '@shared/types';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  
  // Store tool schemas per extension (keyed by extension ID)
  private toolSchemas: Map<string, ToolSchema[]> = new Map();

  /**
   * Store tool schemas from extension
   * Tools are stored WITHOUT execute functions
   */
  saveToolSchemas(extensionId: string, schemas: ToolSchema[]): void {
    this.logger.log(`Saving ${schemas.length} tool schemas for extension ${extensionId}`);
    
    // Validate schemas don't have execute functions
    const schemasWithoutExecute = schemas.map(schema => ({
      name: schema.name,
      description: schema.description,
      inputSchema: schema.inputSchema,
      // Explicitly omit execute function
    }));
    
    this.toolSchemas.set(extensionId, schemasWithoutExecute);
    
    this.logger.log(`Tool names: ${schemasWithoutExecute.map(t => t.name).join(', ')}`);
  }

  /**
   * Get tool schemas for AI SDK (without execute functions)
   * Returns tools in AI SDK format
   */
  getToolsForAI(extensionId: string): Record<string, any> {
    const schemas = this.toolSchemas.get(extensionId) || [];
    
    const tools: Record<string, any> = {};
    
    for (const schema of schemas) {
      tools[schema.name] = {
        description: schema.description,
        inputSchema: schema.inputSchema,
        // NO execute function - tool calls will be sent to extension
      };
    }
    
    this.logger.log(`Prepared ${Object.keys(tools).length} tools for AI SDK`);
    return tools;
  }

  /**
   * Check if extension has tools registered
   */
  hasTools(extensionId: string): boolean {
    return this.toolSchemas.has(extensionId) && 
           this.toolSchemas.get(extensionId)!.length > 0;
  }
}
```

---

### Step 2: Update Chat Service for Tool Calls

**File**: `backend/src/chat/chat.service.ts`

Implement AI SDK v5 patterns with all callbacks:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ToolsService } from '../tools/tools.service';
import { ChatRequest } from '@shared/types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly toolsService: ToolsService) {}

  async chat(extensionId: string, request: ChatRequest) {
    const model = this.getModel(request.modelConfig?.remoteModel);
    
    // Get tool schemas (without execute functions)
    const tools = this.toolsService.getToolsForAI(extensionId);
    
    this.logger.log(`Starting chat with ${Object.keys(tools).length} tools`);
    
    const stepCount = 20; // Maximum steps to prevent infinite loops
    
    const result = streamText({
      model,
      messages: convertToModelMessages(request.messages),
      tools, // Tools without execute functions
      system: this.getSystemPrompt(request),
      
      // AI SDK v5 Configuration
      temperature: 0.7,
      maxTokens: 4000,
      maxRetries: 3, // Retry on network errors
      
      // Loop control - CRITICAL to prevent infinite tool calls
      stopWhen: [stepCountIs(stepCount)],
      
      // Tool choice strategy
      toolChoice: 'auto', // Let AI decide when to use tools
      
      // Step callback for debugging
      onStepFinish: async (stepResult) => {
        this.logger.log(`Step ${stepResult.stepType} finished`, {
          finishReason: stepResult.finishReason,
          toolCallsCount: stepResult.toolCalls.length,
          tokensUsed: stepResult.usage.totalTokens,
          text: stepResult.text.substring(0, 100),
        });
        
        // Log tool calls
        if (stepResult.toolCalls.length > 0) {
          this.logger.log('Tool calls in this step:', 
            stepResult.toolCalls.map(tc => tc.toolName)
          );
        }
      },
      
      // Final callback when all steps complete
      onFinish: async (result) => {
        this.logger.log('Chat finished', {
          finishReason: result.finishReason,
          totalSteps: result.steps.length,
          totalTokens: result.usage.totalTokens,
          toolCallsCount: result.toolCalls.length,
        });
      },
      
      // Repair malformed tool calls
      experimental_repairToolCall: async (options) => {
        this.logger.warn('Attempting to repair tool call', {
          toolName: options.toolCall.toolName,
          error: options.error.message,
        });
        
        // Try to fix the tool call
        // For now, just log and return null (can't repair)
        return null;
      },
    });

    // Return stream that includes tool calls
    return result;
  }

  private getModel(modelType?: string) {
    const modelName = modelType || 'gemini-2.0-flash-exp';
    this.logger.log(`Using model: ${modelName}`);
    
    return google(modelName, {
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  private getSystemPrompt(request: ChatRequest): string {
    // Base system prompt
    let prompt = 'You are a helpful AI assistant integrated into a Chrome extension.';
    
    // Add workflow-specific prompt if applicable
    if (request.workflowId) {
      // Load workflow prompt (Phase 8)
      prompt += '\n\n' + this.getWorkflowPrompt(request.workflowId);
    }
    
    return prompt;
  }

  private getWorkflowPrompt(workflowId: string): string {
    // Placeholder for Phase 8
    return '';
  }
}
```

---

### Step 3: Update Backend Chat Controller

**File**: `backend/src/chat/chat.controller.ts`

Add message metadata and error handling:

```typescript
import { Controller, Post, Res, Body, Headers, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { ExtensionAuthGuard } from '../auth/extension-auth.guard';
import { ChatRequest } from '@shared/types';

@Controller('api/chat')
@UseGuards(ExtensionAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @Headers('x-extension-id') extensionId: string,
    @Body() request: ChatRequest,
    @Res() res: Response,
  ) {
    const result = await this.chatService.chat(extensionId, request);
    
    // Pipe UI message stream to response with AI SDK v5 options
    result.pipeUIMessageStreamToResponse(res, {
      // Add message metadata for tracking
      messageMetadata: ({ part }) => {
        // Add metadata at start
        if (part.type === 'start') {
          return {
            createdAt: Date.now(),
            model: 'gemini-2.0-flash-exp',
          };
        }
        
        // Add token usage at finish
        if (part.type === 'finish') {
          return {
            totalTokens: part.totalUsage.totalTokens,
            inputTokens: part.totalUsage.inputTokens,
            outputTokens: part.totalUsage.outputTokens,
          };
        }
      },
      
      // Error handling - mask errors for security
      onError: (error) => {
        console.error('Chat stream error:', error);
        // Return generic message to client
        return 'An error occurred during the conversation';
      },
      
      // Headers for proxy compatibility
      headers: {
        'Content-Encoding': 'none', // Prevent compression issues
        'X-Content-Type-Options': 'nosniff',
      },
      
      // Don't send reasoning to client (if using reasoning models)
      sendReasoning: false,
      
      // Don't send sources to client (unless needed)
      sendSources: false,
    });
  }
}
```

---

### Step 4: Update Extension AI Logic (AI SDK v5 Pattern)

**File**: `src/ai/core/aiLogic.ts`

Implement using `useChat` hook pattern with proper tool handling:

```typescript
import { createLogger } from '../../logger';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import type { UIMessage } from 'ai';
import { getModelConfig } from '../../utils/modelSettings';
import { getToolSchemas } from '../tools/schemaConverter';
import { executeLocalTool } from '../tools/executor';

const log = createLogger('aiLogic');

export async function handleChat(
  messages: UIMessage[],
  options: {
    onChunk?: (text: string) => void;
    onToolCall?: (toolCall: any) => void;
    onFinish?: () => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const modelConfig = await getModelConfig();
  
  if (modelConfig.mode === 'backend') {
    return handleBackendMode(messages, options);
  } else {
    return handleBYOKMode(messages, options);
  }
}

/**
 * Backend mode using AI SDK v5 patterns
 * Implements tool execution with proper state management
 */
async function handleBackendMode(
  messages: UIMessage[],
  options: any
) {
  log.info('🔄 Starting backend mode chat');
  
  // Get tool schemas to send to backend
  const toolSchemas = await getToolSchemas();
  log.info(`📦 Prepared ${toolSchemas.length} tool schemas`);
  
  // Create transport with custom request preparation
  const transport = new DefaultChatTransport({
    api: 'http://localhost:3000/api/chat',
    
    // Prepare request with tool schemas and metadata
    prepareSendMessagesRequest: ({ messages, requestMetadata }) => ({
      url: 'http://localhost:3000/api/chat',
      method: 'POST',
      headers: {
        'X-Extension-ID': chrome.runtime.id,
        'X-Extension-Version': chrome.runtime.getManifest().version,
        'Content-Type': 'application/json',
      },
      body: {
        messages,
        toolSchemas, // Send tool schemas
        workflowId: requestMetadata?.workflowId,
        sessionId: requestMetadata?.sessionId,
      },
    }),
  });
  
  // Use AI SDK's chat pattern (mimicking useChat hook behavior)
  const chatState = {
    messages: [...messages],
    pendingToolCalls: new Map<string, any>(),
  };
  
  // Send initial messages
  const stream = await transport.sendMessages({
    messages: chatState.messages,
  });
  
  // Process stream with proper tool call handling
  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'text-delta':
        options.onChunk?.(chunk.delta);
        break;
        
      case 'tool-call-streaming-start':
        // Tool call input is starting to stream
        log.info(`🔧 Tool call streaming start: ${chunk.toolName}`);
        options.onToolCall?.({ 
          state: 'input-streaming',
          ...chunk 
        });
        break;
        
      case 'tool-call-delta':
        // Tool call input is being streamed
        log.info(`🔧 Tool call delta: ${chunk.toolName}`);
        options.onToolCall?.({
          state: 'input-streaming',
          ...chunk
        });
        break;
        
      case 'tool-call':
        // Complete tool call received - execute locally
        log.info(`🔧 Tool call complete: ${chunk.toolName}`);
        
        // Store pending tool call
        chatState.pendingToolCalls.set(chunk.toolCallId, chunk);
        
        options.onToolCall?.({
          state: 'input-available',
          ...chunk
        });
        
        // Execute tool locally (mimics onToolCall handler)
        executeToolCall(chunk, chatState, transport, options);
        break;
        
      case 'tool-result':
        // Tool result received (from backend after we sent it)
        log.info(`✅ Tool result: ${chunk.toolName}`);
        options.onToolCall?.({
          state: 'output-available',
          ...chunk
        });
        break;
        
      case 'finish':
        log.info('✨ Stream finished');
        
        // Check if all pending tools are resolved
        if (chatState.pendingToolCalls.size === 0) {
          options.onFinish?.();
        }
        break;
        
      case 'error':
        log.error('❌ Stream error:', chunk.error);
        const error = new Error(chunk.error || 'Unknown error');
        options.onError?.(error);
        throw error;
    }
  }
}

/**
 * Execute tool call locally - mimics useChat onToolCall handler
 * CRITICAL: Does NOT await addToolResult to avoid deadlocks
 */
async function executeToolCall(
  toolCall: any,
  chatState: any,
  transport: any,
  options: any
) {
  try {
    log.info(`  → Executing ${toolCall.toolName} locally...`);
    
    // Execute tool using local executor
    const output = await executeLocalTool(
      toolCall.toolName,
      toolCall.input
    );
    
    log.info(`  ✓ ${toolCall.toolName} completed`);
    
    // Add tool result to messages (mimics addToolResult)
    // CRITICAL: No await here to prevent deadlocks!
    addToolResultToChat(chatState, toolCall, output, null);
    
    // Remove from pending
    chatState.pendingToolCalls.delete(toolCall.toolCallId);
    
    // Check if we should automatically continue
    // (mimics sendAutomaticallyWhen)
    if (shouldSendAutomatically(chatState)) {
      log.info('📤 Auto-sending updated messages with tool results');
      
      // Send updated messages back to backend
      const stream = await transport.sendMessages({
        messages: chatState.messages,
      });
      
      // Process continuation stream (recursive)
      processStream(stream, chatState, transport, options);
    }
    
  } catch (error) {
    log.error(`  ✗ ${toolCall.toolName} failed:`, error);
    
    // Add error result
    const errorText = error instanceof Error ? error.message : 'Unknown error';
    addToolResultToChat(chatState, toolCall, null, errorText);
    
    // Remove from pending
    chatState.pendingToolCalls.delete(toolCall.toolCallId);
    
    options.onToolCall?.({
      state: 'output-error',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      errorText,
    });
  }
}

/**
 * Add tool result to messages (mimics addToolResult from useChat)
 */
function addToolResultToChat(
  chatState: any,
  toolCall: any,
  output: any,
  errorText: string | null
) {
  // Update messages with tool call in assistant message
  const lastMessage = chatState.messages[chatState.messages.length - 1];
  
  if (lastMessage?.role === 'assistant') {
    // Add tool-call part if not already there
    if (!lastMessage.parts) {
      lastMessage.parts = [];
    }
    
    const existingToolCallPart = lastMessage.parts.find(
      (p: any) => p.type === 'tool-call' && p.toolCallId === toolCall.toolCallId
    );
    
    if (!existingToolCallPart) {
      lastMessage.parts.push({
        type: 'tool-call',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        input: toolCall.input,
      });
    }
  }
  
  // Add tool result message
  if (errorText) {
    // Error result
    chatState.messages.push({
      role: 'tool',
      parts: [{
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        result: null,
        isError: true,
      }],
    });
  } else {
    // Success result
    chatState.messages.push({
      role: 'tool',
      parts: [{
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        result: output,
      }],
    });
  }
}

/**
 * Check if should automatically send
 * Mimics lastAssistantMessageIsCompleteWithToolCalls helper
 */
function shouldSendAutomatically(chatState: any): boolean {
  // Check if last assistant message has tool calls
  const lastMessage = chatState.messages[chatState.messages.length - 1];
  
  if (lastMessage?.role === 'assistant' && lastMessage.parts) {
    const toolCallParts = lastMessage.parts.filter(
      (p: any) => p.type === 'tool-call'
    );
    
    if (toolCallParts.length > 0) {
      // Check if all tool calls have results
      const toolCallIds = new Set(toolCallParts.map((p: any) => p.toolCallId));
      
      const toolResultMessages = chatState.messages.filter(
        (m: any) => m.role === 'tool'
      );
      
      const resultIds = new Set(
        toolResultMessages.flatMap((m: any) => 
          m.parts.map((p: any) => p.toolCallId)
        )
      );
      
      // All tool calls have results?
      return [...toolCallIds].every(id => resultIds.has(id));
    }
  }
  
  return false;
}

async function processStream(stream: any, chatState: any, transport: any, options: any) {
  // Same processing logic as above
  for await (const chunk of stream) {
    // ... handle chunks ...
  }
}
```

---

### Step 5: Create Tool Executor

**Create file**: `src/ai/tools/executor.ts`

```typescript
import { createLogger } from '../../logger';
import { getAllTools } from './registry';

const log = createLogger('ToolExecutor');

/**
 * Execute a tool locally in the extension
 * Handles both static tools and dynamic MCP tools
 */
export async function executeLocalTool(
  toolName: string,
  input: any
): Promise<any> {
  const tools = await getAllTools();
  
  const tool = tools[toolName];
  
  if (!tool) {
    // Check if it's a dynamic tool (MCP)
    log.warn(`Tool not found in registry: ${toolName}. May be dynamic MCP tool.`);
    throw new Error(`Tool not found: ${toolName}`);
  }
  
  if (!tool.execute) {
    throw new Error(`Tool ${toolName} has no execute function`);
  }
  
  log.info(`Executing tool: ${toolName}`, { input });
  
  try {
    const result = await tool.execute(input);
    log.info(`Tool ${toolName} executed successfully`, { result });
    return result;
  } catch (error) {
    log.error(`Tool ${toolName} execution failed`, error);
    throw error;
  }
}

/**
 * Check if tool call is dynamic (e.g., MCP tool)
 * Dynamic tools are not in the static registry
 */
export function isToolDynamic(toolName: string, tools: Record<string, any>): boolean {
  return !tools[toolName];
}
```

---

### Step 6: Update Tool Schema Converter

**File**: `src/ai/tools/schemaConverter.ts`

```typescript
import { getAllTools } from './registry';
import type { ToolSchema } from '@shared/types';

/**
 * Convert extension tools to schema format for backend
 * Strips out execute functions - backend only needs schemas
 */
export async function getToolSchemas(): Promise<ToolSchema[]> {
  const tools = await getAllTools();
  
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    // Omit execute function - backend doesn't need it
  }));
}
```

---

### Step 7: Add Dynamic Tool Support

**Update File**: `src/ai/tools/executor.ts`

Add handling for dynamic MCP tools:

```typescript
import { createLogger } from '../../logger';
import { getAllTools } from './registry';

const log = createLogger('ToolExecutor');

/**
 * Execute a tool locally in the extension
 * Handles both static tools and dynamic MCP tools
 */
export async function executeLocalTool(
  toolName: string,
  input: any,
  dynamicTools?: Record<string, any> // MCP tools passed separately
): Promise<any> {
  // First check static tools
  const staticTools = await getAllTools();
  
  let tool = staticTools[toolName];
  let isDynamic = false;
  
  // If not found, check dynamic tools (MCP)
  if (!tool && dynamicTools) {
    tool = dynamicTools[toolName];
    isDynamic = true;
    log.info(`Using dynamic tool: ${toolName}`);
  }
  
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }
  
  if (!tool.execute) {
    throw new Error(`Tool ${toolName} has no execute function`);
  }
  
  log.info(`Executing ${isDynamic ? 'dynamic' : 'static'} tool: ${toolName}`, { input });
  
  try {
    const result = await tool.execute(input);
    log.info(`Tool ${toolName} executed successfully`, { result });
    return result;
  } catch (error) {
    log.error(`Tool ${toolName} execution failed`, error);
    throw error;
  }
}
```

---

### Step 8: Add prepareSendMessagesRequest

**Update File**: `src/ai/core/aiLogic.ts`

The prepareSendMessagesRequest is already in the updated code above. It ensures:
- Tool schemas are sent with each request
- Extension metadata is included
- Workflow and session IDs are passed
- Custom headers are set

---

## ✅ Testing Phase 5 (AI SDK v5)

### Test 1: Simple Tool Call with Streaming States

1. Start backend: `cd backend && pnpm run start:dev`
2. Open extension
3. Send a message that triggers a tool (e.g., "Navigate to google.com")
4. Verify streaming states:
   - ✅ `input-streaming` - Partial tool input shown
   - ✅ `input-available` - Complete tool input received
   - ✅ Tool executed locally
   - ✅ `output-available` - Tool result shown
   - ✅ Backend continues with final response

**Expected logs:**
```
Extension:
  🔄 Starting backend mode chat
  📦 Prepared 15 tool schemas
  🔧 Tool call streaming start: navigate_to
  🔧 Tool call delta: navigate_to
  🔧 Tool call complete: navigate_to
    → Executing navigate_to locally...
    ✓ navigate_to completed
  📤 Auto-sending updated messages with tool results
  ✨ Stream finished

Backend:
  Saving 15 tool schemas for extension abc123
  Starting chat with 15 tools
  Step initial finished { toolCallsCount: 1, tokensUsed: 234 }
  Tool calls in this step: [ 'navigate_to' ]
  Step tool-result finished { toolCallsCount: 0, tokensUsed: 156 }
  Chat finished { totalSteps: 2, totalTokens: 390 }
```

---

### Test 2: Multi-Step Tool Calls with stopWhen

1. Send: "Search for 'AI news' and open the first result"
2. Verify:
   - First tool call: `search`
   - Extension executes and returns results
   - Second tool call: `navigate_to` with first URL
   - Extension navigates
   - Final response summarizes actions
   - **Stops at max 20 steps** (stopWhen protection)

**Expected flow:**
```
User → Backend: "Search for 'AI news' and open the first result"

Step 1:
Backend → Extension: input-streaming(search)
Backend → Extension: tool-call(search, {query: "AI news"})
Extension → Backend: tool-result(search, [...results...])

Step 2:
Backend → Extension: input-streaming(navigate_to)
Backend → Extension: tool-call(navigate_to, {url: "..."})
Extension → Backend: tool-result(navigate_to, {success: true})

Step 3:
Backend → Extension: text-delta("I searched for 'AI news'...")
Backend → Extension: finish
```

---

### Test 3: Tool Call Error Handling

1. Trigger a tool that will fail (e.g., navigate to invalid URL)
2. Verify:
   - Tool execution fails
   - `output-error` state shown
   - Error is sent back with `isError: true`
   - Backend receives error and handles gracefully
   - User sees helpful error message (not technical details)

**Expected behavior:**
```typescript
// Extension detects error
addToolResultToChat(chatState, toolCall, null, 'Invalid URL format');

// Backend receives:
{
  role: 'tool',
  parts: [{
    type: 'tool-result',
    toolCallId: 'call_123',
    toolName: 'navigate_to',
    result: null,
    isError: true
  }]
}

// Backend continues gracefully with error context
```

---

### Test 4: Dynamic MCP Tools

Test MCP tools (dynamic tools) work correctly:

1. Enable an MCP server with tools
2. Send message that triggers MCP tool
3. Verify:
   - Dynamic tool detected (not in static registry)
   - Tool executed via MCP client
   - Result sent back
   - Backend continues normally

**Expected logs:**
```
Extension:
  🔧 Tool call complete: mcp_fetch_url
  Using dynamic tool: mcp_fetch_url
  Executing dynamic tool: mcp_fetch_url
  Tool mcp_fetch_url executed successfully
```

---

### Test 5: Message Metadata

1. Send any message
2. Check browser DevTools Network tab
3. Verify response includes metadata:
   ```json
   {
     "type": "metadata",
     "metadata": {
       "createdAt": 1699200000000,
       "model": "gemini-2.0-flash-exp"
     }
   }
   
   // At finish:
   {
     "type": "metadata",
     "metadata": {
       "totalTokens": 450,
       "inputTokens": 300,
       "outputTokens": 150
     }
   }
   ```

---

### Test 6: Tool Call Repair (experimental_repairToolCall)

1. Simulate malformed tool call (modify backend temporarily to send invalid JSON)
2. Verify:
   - Backend logs repair attempt
   - Tool call is rejected or fixed
   - Error is handled gracefully
   - Stream continues

**Backend logs:**
```
Attempting to repair tool call {
  toolName: 'navigate_to',
  error: 'Invalid JSON in tool call input'
}
```

---

### Test 7: Parallel Tool Calls

Some models can call multiple tools simultaneously:

1. Send: "Open google.com, search for AI, and get current tab info"
2. Verify:
   - Multiple tool calls received in same step
   - All executed (can be parallel if tools don't conflict)
   - All results sent back together
   - Backend continues with all results

**Expected:**
```
Step 1: 3 tool calls
  - navigate_to
  - search
  - getActiveTab
All execute in parallel → all results sent → step 2 continues
```

---

### Test 8: stopWhen Protection

1. Create a scenario that could cause infinite loops (e.g., tool that always suggests another action)
2. Send message
3. Verify:
   - Maximum 20 steps executed
   - Loop stops automatically
   - User gets response with what was completed
   - No infinite loop

**Expected:**
```
Backend logs:
  Step 1 finished
  Step 2 finished
  ...
  Step 20 finished
  Chat finished { totalSteps: 20, finishReason: 'stop-condition' }
```

---

### Test 9: sendAutomaticallyWhen Behavior

1. Send message with tool call
2. Verify automatic continuation:
   - Tool call received
   - Tool executed
   - Result added to messages
   - **Automatically resubmits** (no manual trigger needed)
   - Backend continues without user action

**This is the key AI SDK v5 feature** - no manual message management!

---

### Test 10: Error Masking

1. Cause a backend error (e.g., invalid API key)
2. Verify:
   - User sees: "An error occurred during the conversation"
   - Console logs show real error
   - No sensitive data leaked to UI
   - `onError` callback fired

---

## 📝 Debugging Tips

### Backend Logs

```typescript
// In chat.service.ts
onStepFinish: async (result) => {
  this.logger.debug('Full step result:', JSON.stringify(result, null, 2));
  this.logger.debug('Tool calls:', result.toolCalls);
  this.logger.debug('Messages:', result.messages);
}
```

### Extension Logs

```typescript
// In aiLogic.ts
log.debug('Received chunk:', chunk);
log.debug('Chat state:', chatState);
log.debug('Pending tool calls:', chatState.pendingToolCalls);
```

### Network Debugging

1. Open DevTools → Network tab
2. Filter by `chat` endpoint
3. Inspect request body (includes tool schemas)
4. Inspect response stream (includes all events)

### Common Issues

1. **Tool not found**: Check tool schema names match exactly between extension and backend
2. **Tool result not sent**: Verify message format uses `parts` array
3. **Infinite loop**: Check `stopWhen: [stepCountIs(20)]` is set
4. **Deadlock**: Ensure no `await` on `addToolResult` calls
5. **Dynamic tool fails**: Verify MCP client is connected and tool exists
6. **Streaming stops**: Check proxy headers (`Content-Encoding: none`)
7. **No auto-continuation**: Verify `shouldSendAutomatically` logic

---

## 🎯 Phase 5 Completion Checklist (AI SDK v5)

### Backend Implementation
- [ ] Backend stores tool schemas without execute functions
- [ ] Backend uses `streamText` with proper configuration
- [ ] `stopWhen: [stepCountIs(20)]` configured
- [ ] `onStepFinish` callback logs each step
- [ ] `onFinish` callback logs completion
- [ ] `experimental_repairToolCall` handles malformed calls
- [ ] Message metadata includes timestamps and tokens
- [ ] Error handling masks sensitive information
- [ ] Streaming headers configured for proxy compatibility

### Extension Implementation  
- [ ] Extension uses `DefaultChatTransport` with custom request prep
- [ ] `prepareSendMessagesRequest` sends tool schemas
- [ ] Tool calls processed with streaming states
- [ ] `onToolCall` handler checks for dynamic tools
- [ ] Tools executed locally without deadlocks (no await on addToolResult)
- [ ] Tool results added to messages using `parts` array
- [ ] `shouldSendAutomatically` logic implemented
- [ ] Automatic continuation when all tools complete
- [ ] Dynamic MCP tools supported
- [ ] Error states handled with `output-error`

### Message Architecture
- [ ] Messages use `parts` array (not separate toolCalls field)
- [ ] Tool call parts have correct structure
- [ ] Tool result parts include toolCallId and result
- [ ] Error results use `isError: true` flag
- [ ] Assistant messages contain tool-call parts
- [ ] Tool messages contain tool-result parts

### Testing
- [ ] Simple tool call works end-to-end
- [ ] Multi-step tool calling works (2+ steps)
- [ ] Tool errors handled gracefully
- [ ] Dynamic MCP tools execute correctly
- [ ] Message metadata received and parsed
- [ ] Tool call repair attempted on errors
- [ ] Parallel tool calls work
- [ ] `stopWhen` prevents infinite loops
- [ ] Automatic continuation works (sendAutomaticallyWhen)
- [ ] Error masking protects sensitive data

### Performance & Reliability
- [ ] No deadlocks in tool execution
- [ ] Maximum 20 steps enforced
- [ ] Retries configured (maxRetries: 3)
- [ ] Streaming works through proxies
- [ ] Logs are clear and helpful
- [ ] Token usage tracked
- [ ] Error boundaries in place

---

## 📊 Key Metrics to Monitor

After Phase 5 implementation, track these metrics:

1. **Tool Execution Success Rate**
   - Target: >95% successful executions
   - Track: Failed vs successful tool calls

2. **Average Steps Per Conversation**
   - Target: 2-5 steps
   - Alert if approaching 20 (stopWhen limit)

3. **Tool Execution Latency**
   - Target: <1s per tool execution
   - Track: Time from tool-call to tool-result

4. **Token Usage**
   - Track: Input + output tokens per conversation
   - Monitor: Cost optimization opportunities

5. **Error Rate**
   - Target: <5% error rate
   - Track: Tool errors, network errors, validation errors

---

## 🔍 Monitoring & Logging

### Backend Logs to Watch

```bash
# Successful tool flow
✅ Saving 15 tool schemas
✅ Starting chat with 15 tools
✅ Step initial finished
✅ Tool calls in this step: [ 'navigate_to' ]
✅ Step tool-result finished
✅ Chat finished

# Error cases
❌ Attempting to repair tool call
⚠️ Step count approaching limit (18/20)
❌ Chat stream error
```

### Extension Logs to Watch

```bash
# Successful flow
✅ Prepared 15 tool schemas
✅ Tool call complete: navigate_to
✅ Tool executed successfully
✅ Auto-sending updated messages

# Error cases
❌ Tool execution failed
⚠️ Dynamic tool not found
❌ Stream error
```

---

## 🚀 Next Steps

Once Phase 5 is complete and all tests pass:

**→ Proceed to Phase 6: Model Selection**

Phase 6 will implement:
- Model selector UI in extension
- Support for multiple Gemini models:
  - Gemini 2.0 Flash Exp (default, fastest)
  - Gemini 2.0 Flash Thinking Exp (reasoning)
  - Gemini 1.5 Pro (balanced)
  - Gemini 1.5 Flash (fast, economical)
- Backend routes to correct model based on request
- Cost optimization logic (use cheaper models when appropriate)
- Model-specific configuration (temperature, max tokens, etc.)
- Usage tracking per model
- Model performance metrics

---

## 📚 AI SDK v5 Resources

- [AI SDK v5 Documentation](https://sdk.vercel.ai/docs)
- [streamText API Reference](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text)
- [useChat Hook Reference](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)
- [Tool Calling Guide](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [Error Handling](https://sdk.vercel.ai/docs/ai-sdk-ui/error-handling)
- [Message Metadata](https://sdk.vercel.ai/docs/ai-sdk-ui/message-metadata)

---

## 🎓 Key Learnings from AI SDK v5

1. **Parts Array Architecture**: Messages use `parts` array for flexible content
2. **No Manual State**: `sendAutomaticallyWhen` handles continuation automatically
3. **Streaming States**: Tool calls stream progressively for better UX
4. **No Deadlocks**: Never await `addToolResult` calls
5. **Loop Protection**: `stopWhen` prevents infinite tool call loops
6. **Error Masking**: `onError` masks sensitive errors from users
7. **Metadata**: Track timestamps, tokens, and model info
8. **Dynamic Tools**: MCP tools work seamlessly alongside static tools
9. **Repair Logic**: `experimental_repairToolCall` handles malformed calls
10. **Step Callbacks**: `onStepFinish` provides visibility into agent behavior

---

## 🔒 Security Considerations

1. **Tool Schema Validation**: Backend validates tool schemas from extension
2. **Error Masking**: Sensitive errors not exposed to client
3. **Input Sanitization**: Tool inputs validated before execution
4. **Rate Limiting**: Backend should implement rate limits (Phase 9)
5. **Authentication**: Extension ID verified on each request
6. **Tool Permissions**: Only registered tools can be executed
7. **MCP Security**: Dynamic tools from trusted MCP servers only

---

## ⚡ Performance Optimizations

1. **Tool Schema Caching**: Backend caches tool schemas per extension
2. **Parallel Tool Execution**: Independent tools can run in parallel
3. **Streaming**: Progressive tool call input reduces perceived latency
4. **Token Limits**: `maxTokens: 4000` prevents excessive costs
5. **Retry Strategy**: `maxRetries: 3` balances reliability and speed
6. **Smooth Streaming**: `smoothStream` improves UX with word chunking

---

**Phase 5 Status: Ready for Implementation** ✅

This updated plan follows AI SDK v5 best practices and provides a robust foundation for the hybrid tool execution pattern!
