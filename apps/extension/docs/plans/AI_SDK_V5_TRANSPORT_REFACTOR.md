# AI SDK v5 Transport Architecture Refactor

## Implementation Plan - REVISED

> ⚠️ **REVISION NOTE (December 2025)**: After cross-checking with the actual codebase and AI SDK v5 documentation, the original plan was found to be **too aggressive** and would break critical Chrome extension-specific functionality. This revised plan takes an **incremental approach** that preserves battle-tested code while making targeted improvements.

**Goal**: Improve the chat architecture incrementally while preserving Chrome extension-specific functionality (workflows, tab mentions, page context).

**Estimated Time**: 4-6 hours across 4 phases

---

## Table of Contents

1. [Architecture Analysis](#architecture-analysis)
2. [What We're Keeping (And Why)](#what-were-keeping-and-why)
3. [Phase 1: Backend Stream Response](#phase-1-backend-stream-response-done)
4. [Phase 2: Simplify parseStreamChunk (Remove Legacy Format Support)](#phase-2-simplify-parsestreamchunk-remove-legacy-format-support)
5. [Phase 3: Clean Up Backend Mode Error Handling](#phase-3-clean-up-backend-mode-error-handling)
6. [Phase 4: Documentation & Testing](#phase-4-documentation--testing)
7. [Future Considerations](#future-considerations)
8. [Resources](#resources)

---

## Architecture Analysis

### Current Architecture (KEEP - It's Correct!)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (Extension)                                                │
├─────────────────────────────────────────────────────────────────────┤
│  useAIChat hook                                                      │
│       │                                                              │
│       ▼                                                              │
│  SimpleFrontendTransport (385 lines - KEEP!)                         │
│       │                                                              │
│       ├── Workflow detection (/research, /deep-research)            │
│       ├── Tab mention processing (@[Tab])                           │
│       ├── Page context loading from IndexedDB                       │
│       ├── Research context initialization                           │
│       │                                                              │
│       ▼                                                              │
│  streamAIResponse() in aiLogic.ts (800+ lines - KEEP!)              │
│       │                                                              │
│       ├──── BYOK Mode ────► Local/Remote Gemini setup               │
│       │                     - API key validation                     │
│       │                     - Adaptive mode with prepareStep         │
│       │                     - Search mode integration                │
│       │                     - Retry manager                          │
│       │                     - Website-specific tools                 │
│       │                                                              │
│       └──── Backend Mode ──► backendChatWithTools.ts                │
│                              - Tool schemas sent to backend          │
│                              - Local tool execution loop             │
│                              - 🔴 parseStreamChunk() - IMPROVE       │
└─────────────────────────────────────────────────────────────────────┘
```

### Why DefaultChatTransport Doesn't Fit

| Requirement | DefaultChatTransport | Our SimpleFrontendTransport |
|-------------|---------------------|----------------------------|
| Async page context loading | ❌ `body` is sync | ✅ Loads from IndexedDB |
| Message preprocessing | ❌ Sends as-is | ✅ Parses workflows, mentions |
| Workflow session management | ❌ Not supported | ✅ Manages research context |
| Mode switching (BYOK/Backend) | ❌ One endpoint | ✅ Routes dynamically |
| Local AI execution (BYOK) | ❌ HTTP only | ✅ Runs streamText locally |

---

## What We're Keeping (And Why)

### ✅ SimpleFrontendTransport.ts (385 lines)

**Reason**: Contains Chrome extension-specific logic that cannot be replaced by DefaultChatTransport:

- **Workflow detection**: Parses `/research`, `/deep-research` commands
- **Tab mentions**: Processes `@[Tab](id)` syntax and fetches tab content
- **Page context**: Loads thread's initial page context from IndexedDB
- **Session management**: Starts/continues workflow sessions
- **Abort handling**: Proper cleanup of abort controllers

### ✅ aiLogic.ts (800+ lines)

**Reason**: Battle-tested BYOK mode logic:

- **Local mode**: Gemini Nano setup with proper prompts
- **Remote mode**: API key validation, model selection
- **Adaptive mode**: Dynamic tool switching via `prepareStep`
- **Search integration**: Adds search tools when enabled
- **Retry logic**: Exponential backoff with Retry-After headers
- **Website augmentation**: Site-specific tool configurations
- **Error handling**: Provider-specific error parsing

### ✅ Tool execution loop in backendChatWithTools.ts

**Reason**: Our architecture executes tools on the frontend, not the backend:

- Backend returns tool call requests
- Frontend executes tools locally (browser APIs, tab content, etc.)
- Frontend sends results back for continuation

This is different from AI SDK's `onToolCall` which expects server-defined tools without `execute` functions.

---

## Phase 1: Backend Stream Response [DONE]

**Status**: ✅ Completed

**Changes Made:**

### 1.1 Update Backend to Use UI Message Stream

**File**: [`packages/backend-vercel/src/routes/ai/chat.ts`](../../packages/backend-vercel/src/routes/ai/chat.ts)

```typescript
// Before
return result.pipeTextStreamToResponse(res);

// After
return result.pipeUIMessageStreamToResponse(res);
```

### 1.2 Remove Manual Headers

The `pipeUIMessageStreamToResponse` method automatically sets:
- `Content-Type: text/event-stream`
- `x-vercel-ai-ui-message-stream: v1`

**Resources:**
- [pipeUIMessageStreamToResponse API](https://ai-sdk.dev/docs/reference/ai-sdk-ui/pipe-ui-message-stream-to-response)
- [Stream Protocols](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)

---

## Phase 2: Simplify parseStreamChunk (Remove Legacy Format Support)

**Status**: 🔲 TODO  
**Estimated Time**: 1-2 hours  
**Risk**: Low - isolated change in one file

### Problem

The `parseStreamChunk()` function in `backendChatWithTools.ts` contains ~70 lines of legacy format handling (numeric prefixes `0:`, `9:`, `a:`, etc.) that are no longer needed since the backend now uses `pipeUIMessageStreamToResponse()` which outputs only the SSE `data: {...}` format.

### Why NOT Use `readUIMessageStream()`

After reviewing the AI SDK v5 documentation, `readUIMessageStream()` is **not suitable** for our use case:

| Aspect | `readUIMessageStream()` | Our Requirement |
|--------|------------------------|-----------------|
| **Output** | Complete `UIMessage` objects with cumulative text | Individual stream parts (text deltas) |
| **Use Case** | Terminal UIs, final message assembly | Real-time streaming with tool interception |
| **Text Handling** | Returns full text, not deltas | Need deltas for progressive rendering |
| **Tool Handling** | Returns assembled tool-call parts | Need immediate tool interception mid-stream |

The `readUIMessageStream()` API:
```typescript
// What it actually does - NOT what we need
for await (const uiMessage of readUIMessageStream({ stream })) {
    // uiMessage.parts contains assembled parts, not stream events
    // uiMessage.parts[0].text is CUMULATIVE, not a delta
}
```

### Solution

**Simplify** `parseStreamChunk()` by removing legacy format handlers while keeping the SSE parsing logic that works correctly.

**File**: [`apps/extension/src/ai/backend/backendChatWithTools.ts`](../../apps/extension/src/ai/backend/backendChatWithTools.ts)

#### Current Code (lines 70-235):

```typescript
function parseStreamChunk(chunk: string): Array<{...}> {
    // ... SSE parsing (KEEP - this is correct)
    if (line.startsWith('data: ')) {
        // Handle AI SDK v5 SSE format
    }
    
    // ... Legacy format support (REMOVE - no longer needed)
    else if (line.startsWith('0:')) { /* legacy text */ }
    else if (line.startsWith('9:')) { /* legacy tool call */ }
    else if (line.startsWith('a:')) { /* legacy tool result */ }
    else if (line.startsWith('3:')) { /* legacy error */ }
    else if (line.startsWith('d:') || line.startsWith('e:')) { /* legacy finish */ }
    // etc.
}
```

#### New Code (simplified):

```typescript
/**
 * Parse AI SDK v5 UI Message Stream format (SSE only)
 * 
 * Format: data: {"type":"...", ...}
 * 
 * Supported types:
 * - start: Message start with messageId
 * - text-start/text-delta/text-end: Text streaming
 * - tool-input-available: Complete tool call ready for execution
 * - tool-output-available: Tool result
 * - finish/finish-step: Stream completion
 * - error: Stream error
 */
function parseStreamChunk(chunk: string): Array<{
    type: 'text' | 'text_start' | 'text_end' | 'tool_call' | 'tool_result' | 'finish' | 'error';
    data: any;
}> {
    const events: Array<{ type: any; data: any }> = [];
    const lines = chunk.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;

        // AI SDK v5 SSE format: "data: {...}"
        if (line.startsWith('data: ')) {
            const dataContent = line.slice(6);

            // Stream termination marker
            if (dataContent === '[DONE]') {
                events.push({ type: 'finish', data: { done: true } });
                continue;
            }

            try {
                const parsed = JSON.parse(dataContent);
                const eventType = parsed.type;

                switch (eventType) {
                    case 'text-start':
                        events.push({ type: 'text_start', data: { id: parsed.id } });
                        break;

                    case 'text-delta':
                        events.push({ type: 'text', data: parsed.delta });
                        break;

                    case 'text-end':
                        events.push({ type: 'text_end', data: { id: parsed.id } });
                        break;

                    case 'tool-input-available':
                        events.push({
                            type: 'tool_call',
                            data: {
                                id: parsed.toolCallId,
                                name: parsed.toolName,
                                arguments: parsed.input,
                            },
                        });
                        break;

                    case 'tool-output-available':
                        events.push({ type: 'tool_result', data: parsed });
                        break;

                    case 'error':
                        events.push({ type: 'error', data: { message: parsed.errorText || 'Unknown error' } });
                        break;

                    case 'finish':
                    case 'finish-step':
                        events.push({ type: 'finish', data: parsed });
                        break;

                    // Ignore other event types (start, start-step, reasoning-*, source-*, file, etc.)
                    default:
                        break;
                }
            } catch (e) {
                // Ignore unparseable lines
            }
        }
        // Ignore SSE comments/pings (lines starting with :)
    }

    return events;
}
```

### Benefits

- **~70 lines deleted**: Remove all legacy format handlers
- **Cleaner code**: Only handles the format actually used
- **Easier maintenance**: Single format to support
- **Same behavior**: No functional changes to streaming

### Implementation Steps

1. ✅ Backup current `parseStreamChunk()` function
2. Remove legacy format handlers (lines with `0:`, `9:`, `a:`, `3:`, `d:`, `e:`, `f:`, `2:`, `b:`, `c:`)
3. Remove debug logging (can be added back if needed)
4. Clean up comments and function documentation
5. Test backend mode streaming still works

### Testing Checklist

- [ ] Text streaming works (verify deltas appear progressively)
- [ ] Tool calls are detected and executed
- [ ] Tool results are sent back to backend
- [ ] Multi-step tool loops complete correctly
- [ ] Error handling works (trigger a backend error)
- [ ] Abort/stop functionality works

**Resources:**
- [Stream Protocol Reference](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [UI Message Stream Parts](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-stream-protocol)

---

## Phase 3: Clean Up Backend Mode Error Handling

**Status**: 🔲 TODO  
**Estimated Time**: 1-2 hours  
**Risk**: Low

### Problem

Backend mode error handling is inconsistent with BYOK mode. Errors are formatted differently.

### Solution

Use the same error types and formatting from BYOK mode in backend mode.

**File**: [`apps/extension/src/ai/backend/backendChatWithTools.ts`](../../apps/extension/src/ai/backend/backendChatWithTools.ts)

```typescript
import { APIError, NetworkError } from '../../errors/errorTypes';
import { writeErrorToStream } from '../stream/streamHelpers';
import { parseProviderError } from '../errors/handlers';

// In the catch block, replace:
writer.write({
    type: 'text-delta',
    id: 'error-' + generateId(),
    delta: `\n\n❌ **Error:** ${errorMessage}\n\n...`,
});

// With:
const appError = error instanceof APIError || error instanceof NetworkError
    ? error
    : parseProviderError(error, 'backend');
    
writeErrorToStream(writer, appError, 'Backend chat');
```

### Benefits

- Consistent error UX between modes
- Reuses existing error formatting
- Proper error type classification

---

## Phase 4: Documentation & Testing

**Status**: 🔲 TODO  
**Estimated Time**: 1-2 hours

### 4.1 Add Architecture Documentation

Create/update docs explaining the transport architecture:

**File**: `apps/extension/docs/TRANSPORT_ARCHITECTURE.md`
ALso update     
.kiro of the extension  folder 
.coding standards in extension folder 
AGENTS.md in the extension folder
GEMINI.md in the extension folder
CLAUDE.md in the extension folder 

```markdown
# Transport Architecture

## Overview

The extension uses a custom transport pattern for AI SDK v5 that supports:
- BYOK mode (user's API key, local execution)
- Backend mode (Vercel backend, shared API key)

## Why Not DefaultChatTransport?

DefaultChatTransport doesn't support:
1. Async context loading (page context from IndexedDB)
2. Message preprocessing (workflow commands, tab mentions)
3. Local AI execution (BYOK mode runs streamText locally)
4. Complex workflow session management

## File Structure

├── SimpleFrontendTransport.ts  # Main transport (385 lines)
│   ├── Workflow detection
│   ├── Tab mention processing
│   ├── Page context loading
│   └── Mode routing (BYOK vs Backend)
│
├── aiLogic.ts                   # BYOK mode AI execution (800+ lines)
│   ├── Local mode (Gemini Nano)
│   ├── Remote mode (Gemini API)
│   ├── Adaptive mode (prepareStep)
│   └── Error handling & retry
│
└── backendChatWithTools.ts      # Backend mode (576 lines)
    ├── Tool schema sending
    ├── Local tool execution loop
    └── Stream parsing (using readUIMessageStream)
```

### 4.2 Test Checklist

#### Backend Mode Tests
- [ ] Text streaming works
- [ ] Tool calls are received and displayed
- [ ] Tool results are sent back
- [ ] Multi-step tool loops work
- [ ] Error handling works
- [ ] Abort/stop functionality

#### BYOK Mode Tests (should still work, no changes)
- [ ] Text streaming with user's API key
- [ ] Tool execution
- [ ] Adaptive mode with prepareStep
- [ ] Search mode integration
- [ ] Workflow commands

---

## Future Considerations

These are **NOT** planned for immediate implementation but could be considered later:

### Potential: Rename SimpleFrontendTransport

The name is misleading - it's not "simple" at all. Consider:
- `ExtensionChatTransport`
- `CognitoChatTransport`
- `UnifiedChatTransport`

### Potential: Extract Workflow Logic

If workflow logic grows, consider extracting to a separate preprocessor:

```typescript
// Hypothetical future structure
class ExtensionChatTransport {
  private preprocessor = new MessagePreprocessor();
  
  async sendMessages(params) {
    // Preprocess (workflows, mentions, context)
    const processed = await this.preprocessor.process(params);
    
    // Route to handler
    return this.executeRequest(processed);
  }
}
```

### Potential: Use onToolCall for Simple Tools

For simple tools that don't need the full loop logic, consider using AI SDK's native `onToolCall`:

```typescript
const chat = useChat({
  transport,
  onToolCall: async ({ toolCall, addToolOutput }) => {
    // Only for simple, stateless tools
    if (isSimpleTool(toolCall.toolName)) {
      const result = await executeSimpleTool(toolCall);
      addToolOutput({ tool: toolCall.toolName, output: result });
    }
  },
});
```

### NOT Recommended: Full Transport Rewrite

After analysis, a full rewrite to use `DefaultChatTransport` is **not recommended** because:

1. **Page context loading is async** - `body` function in DefaultChatTransport is sync
2. **Message preprocessing** - Workflows and mentions need to modify messages before sending
3. **BYOK mode runs locally** - DefaultChatTransport is HTTP-only
4. **Tool execution is complex** - Our loop handles research workflow context

---

## Resources

### AI SDK v5 Documentation

| Topic | Link |
|-------|------|
| readUIMessageStream | https://ai-sdk.dev/docs/reference/ai-sdk-ui/read-ui-message-stream |
| Stream Protocols | https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol |
| Chatbot Tool Usage | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage |
| Transport System | https://ai-sdk.dev/docs/ai-sdk-ui/transport |

### Source Code References

| Component | Link |
|-----------|------|
| DefaultChatTransport | https://github.com/vercel/ai/blob/main/packages/ai/src/ui/default-chat-transport.ts |
| ChatTransport Interface | https://github.com/vercel/ai/blob/main/packages/ai/src/ui/chat-transport.ts |
| readUIMessageStream | https://github.com/vercel/ai/blob/main/packages/ai/src/ui/read-ui-message-stream.ts |

---

## Summary

### Revised Approach (December 2025 Update)

| Original Plan | Revised Plan |
|---------------|--------------|
| Replace SimpleFrontendTransport | **Keep** - contains essential Chrome extension logic |
| Replace aiLogic.ts | **Keep** - battle-tested BYOK logic |
| Use DefaultChatTransport | **Not suitable** - async context, preprocessing |
| Use `readUIMessageStream()` for parsing | **Not suitable** - yields cumulative UIMessages, not deltas |
| Delete ~655 lines | **Delete ~70 lines** (legacy format handlers in parseStreamChunk) |

### Why NOT `readUIMessageStream()`?

The `readUIMessageStream()` helper was originally considered for Phase 2, but after reviewing the AI SDK v5 documentation:

1. **Wrong output format**: It yields complete `UIMessage` objects with cumulative text, not individual stream parts
2. **Not designed for our use case**: It's meant for terminal UIs and final message assembly
3. **Breaks tool interception**: We need to intercept tool calls mid-stream to execute them locally

**Correct approach**: Keep `parseStreamChunk()` but simplify it by removing legacy format handlers.

### Backend Verification ✅

The backend (`packages/backend-vercel`) was verified against AI SDK v5 documentation:

| Component | Status | Notes |
|-----------|--------|-------|
| `pipeUIMessageStreamToResponse()` | ✅ Correct | Proper v5 method for streaming |
| `stopWhen: stepCountIs(n)` | ✅ Correct | Replaces old `maxSteps` |
| `smoothStream` transform | ✅ Correct | Working as expected |
| Tool schema conversion | ✅ Correct | `createFrontendTools` working |
| System prompt handling | ✅ Correct | Mode + page context integration |

**No backend changes needed.**

### Lines of Code Impact (Revised)

| Area | Before | After | Savings |
|------|--------|-------|---------|
| `parseStreamChunk()` legacy handlers | ~70 lines | 0 lines | ~70 lines |
| Debug logging cleanup | ~20 lines | 0 lines | ~20 lines |
| Error handling cleanup (Phase 3) | ~30 lines | ~10 lines | ~20 lines |
| **Total** | ~120 lines | ~10 lines | **~110 lines** |

### Key Takeaways

1. **Don't fix what isn't broken** - BYOK mode works well
2. **Understand the API before using it** - `readUIMessageStream()` wasn't suitable
3. **Targeted improvements** - Only remove legacy format handlers
4. **Preserve Chrome extension logic** - Workflows, mentions, context
5. **Backend is correct** - No changes needed there

### Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 1: Backend Stream | ✅ **Done** | Completed successfully |
| Phase 2: Simplify parseStreamChunk | Low | Isolated change, removes dead code only |
| Phase 3: Error handling | Low | Reuses existing code |
| Phase 4: Documentation | None | No code changes |

### Execution Checklist

- [x] Phase 1: Backend uses `pipeUIMessageStreamToResponse()` ✅
- [ ] Phase 2: Remove legacy format handlers from `parseStreamChunk()`
- [ ] Phase 3: Unify error handling with BYOK mode
- [ ] Phase 4: Add architecture documentation

---

*Last updated: December 19, 2025*
*Plan revision: After AI SDK v5 API verification*
