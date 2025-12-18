# Implementation Plan: Page-Aware Conversations for Backend Mode

## Overview

This plan addresses the TODO at Line 106 in `aiLogic.ts`:
> Pass initialPageContext for page-aware conversations

Currently, `initialPageContext` is captured and used in **local mode** but is **not passed to the backend** when using backend mode. This creates an inconsistent experience where:
- **Local mode**: AI knows about the page the user started the conversation on
- **Backend mode**: AI has no awareness of the page context

## Problem Statement

When `useBackendMode` is enabled:
1. The `initialPageContext` is retrieved from the database
2. It is passed to `streamAIResponse()` 
3. BUT `streamBackendChatWithTools()` does not accept or forward it to the Vercel backend
4. The backend `/api/ai/chat-with-tools` endpoint has no parameter for page context

## Current Architecture Analysis

### Extension Flow (apps/extension)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. useMessageHandlers.ts (Line 125-131)                                   │
│     └─ On first message: extractPageContext() → formatPageContextForAI()   │
│     └─ Saves to db.chatThreads.update(threadId, { initialPageContext })    │
│                                                                             │
│  2. SimpleFrontendTransport.ts (Lines 261-268)                             │
│     └─ Retrieves: thread = await getThread(chatId)                         │
│     └─ Gets: initialPageContext = thread?.initialPageContext               │
│     └─ Passes to streamAIResponse({ initialPageContext, ... })             │
│                                                                             │
│  3. aiLogic.ts (Line 106 - TODO)                                           │
│     └─ If useBackendMode → calls streamBackendChatWithTools()              │
│     └─ ❌ initialPageContext is NOT passed                                  │
│                                                                             │
│  4. backendChatWithTools.ts (Lines 48-49 - TODOs)                          │
│     └─ ❌ No pageContext parameter in interface                             │
│     └─ ❌ Not included in fetch body to backend                             │
│                                                                             │
│  5. Vercel Backend: ai.ts (Line 250 - TODO)                                │
│     └─ ❌ No pageContext in request schema                                  │
│     └─ ❌ Not included in system prompt                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Files Involved

| File | Location | Current State |
|------|----------|---------------|
| [useMessageHandlers.ts](apps/extension/src/hooks/chat/useMessageHandlers.ts#L125) | Extension | ✅ Captures page context on first message |
| [SimpleFrontendTransport.ts](apps/extension/src/ai/transport/SimpleFrontendTransport.ts#L261) | Extension | ✅ Retrieves and passes to aiLogic |
| [aiLogic.ts](apps/extension/src/ai/core/aiLogic.ts#L106) | Extension | ❌ TODO: Not passed to backend |
| [backendChatWithTools.ts](apps/extension/src/ai/backend/backendChatWithTools.ts#L49) | Extension | ❌ TODO: No param, not sent |
| [ai.ts](packages/backend-vercel/src/routes/ai.ts#L250) | Backend | ❌ TODO: Not received, not in prompt |
| [manager.ts](apps/extension/src/ai/tools/manager.ts#L182) | Extension | ✅ Has buildEnhancedPrompt (for local only) |

## Implementation Plan

### Phase 1: Extension Changes

#### 1.1 Update BackendChatWithToolsParams Interface

**File:** [backendChatWithTools.ts](apps/extension/src/ai/backend/backendChatWithTools.ts)

```typescript
// Add to BackendChatWithToolsParams interface (around line 30)
export interface BackendChatWithToolsParams {
    messages: UIMessage[];
    systemPrompt?: string;
    model?: BackendModel;
    mode?: ToolMode;
    maxSteps?: number;
    abortSignal?: AbortSignal;
    onError?: (error: Error) => void;
    onFinishCallback?: () => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onToolResult?: (result: ToolResult) => void;
    
    // NEW: Page context support
    /**
     * Initial page context captured when the conversation started.
     * This gives the AI awareness of the webpage context.
     * Format: Formatted string from formatPageContextForAI()
     */
    initialPageContext?: string;
}
```

#### 1.2 Include pageContext in Backend Request Body

**File:** [backendChatWithTools.ts](apps/extension/src/ai/backend/backendChatWithTools.ts)

```typescript
// In streamBackendChatWithTools function, destructure and include:
const {
    messages,
    systemPrompt,
    model = 'gemini-2.5-flash',
    mode = 'agent',
    maxSteps: userMaxSteps = 20,
    abortSignal,
    onError,
    onFinishCallback,
    onToolCall,
    onToolResult,
    initialPageContext, // NEW
} = params;

// In the fetch body (around line 234):
body: JSON.stringify({
    messages: conversationMessages,
    system: systemPrompt,
    tools: toolSchemas,
    model,
    mode,
    maxSteps: 1,
    pageContext: initialPageContext, // NEW: Send to backend
}),
```

#### 1.3 Pass initialPageContext to streamBackendChatWithTools

**File:** [aiLogic.ts](apps/extension/src/ai/core/aiLogic.ts)

```typescript
// Around line 106, update the call:
return streamBackendChatWithTools({
    messages,
    systemPrompt: undefined,
    model: selectedModel,
    mode: backendMode,
    maxSteps: userMaxSteps,
    abortSignal,
    onError,
    onFinishCallback,
    initialPageContext, // NEW: Pass from params
    onToolCall: (tc) => log.info('Tool call:', { name: tc.name, id: tc.id }),
    onToolResult: (tr) => log.info('Tool result:', { id: tr.id, isError: tr.isError }),
});
```

### Phase 2: Backend Changes (Vercel)

#### 2.1 Update Request Schema

**File:** [ai.ts](packages/backend-vercel/src/routes/ai.ts)

```typescript
// Add pageContext to the request validation (after line 207)
const ChatWithToolsRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
    })),
    system: z.string().optional(),
    tools: z.record(z.any()).optional(),
    model: z.string().optional(),
    mode: z.enum(['chat', 'agent', 'adaptive']).optional(),
    maxSteps: z.number().optional(),
    // NEW: Page context for conversation awareness
    pageContext: z.string().optional().nullable(),
});
```

#### 2.2 Extract and Use Page Context

**File:** [ai.ts](packages/backend-vercel/src/routes/ai.ts)

```typescript
// In the route handler, extract pageContext:
const {
    messages,
    system,
    tools: toolSchemas = {},
    model: modelName = 'gemini-2.0-flash',
    mode,
    maxSteps = 10,
    pageContext, // NEW: Extract from request
} = req.body;

// Build enhanced system prompt with page context:
let effectiveSystemPrompt = system || getSystemPromptForMode(mode);

// NEW: Append page context if available
if (pageContext && pageContext.length > 0) {
    effectiveSystemPrompt += `\n\n[INITIAL PAGE CONTEXT - The user started this conversation on the following page]\n${pageContext}\n\nNote: This is the page context from when this conversation started. The user may have navigated to different pages since then.`;
}
```

### Phase 3: Enhanced System Prompt Design

#### 3.1 Create Reusable Page Context Prompt Builder

**File:** [ai.ts](packages/backend-vercel/src/routes/ai.ts) (new helper function)

```typescript
/**
 * Build system prompt with optional page context
 * Reusable for any endpoint that supports page awareness
 */
function buildSystemPromptWithPageContext(
    basePrompt: string,
    pageContext: string | null | undefined
): string {
    if (!pageContext || pageContext.length === 0) {
        return basePrompt;
    }

    return `${basePrompt}

[INITIAL PAGE CONTEXT - Captured when conversation started]
${pageContext}

Note: This page context was captured when the user started this conversation. 
- If they mention "this page" or "this form", they likely mean the page above
- They may have navigated away since then
- Use tools like readPageContent if you need current page information`;
}
```

### Implementation Checklist

#### Extension Side (apps/extension)
- [ ] 1.1: Add `initialPageContext` to `BackendChatWithToolsParams` interface
- [ ] 1.2: Destructure and include in fetch body as `pageContext`
- [ ] 1.3: Pass `initialPageContext` from `aiLogic.ts` to `streamBackendChatWithTools`
- [ ] 1.4: Remove TODO comments after implementation
- [ ] 1.5: Add logging for debugging

#### Backend Side (packages/backend-vercel)
- [ ] 2.1: Add `pageContext` to request schema/validation
- [ ] 2.2: Extract `pageContext` from request body
- [ ] 2.3: Build enhanced system prompt with page context
- [ ] 2.4: Remove TODO comment after implementation
- [ ] 2.5: Add logging for pageContext usage

#### Testing
- [ ] 3.1: Test conversation with page context in backend mode
- [ ] 3.2: Test conversation without page context (should still work)
- [ ] 3.3: Test that AI references page elements correctly
- [ ] 3.4: Test long conversations maintain context
- [ ] 3.5: Verify local mode still works (regression)

## Detailed Code Changes

### File 1: apps/extension/src/ai/backend/backendChatWithTools.ts

```diff
export interface BackendChatWithToolsParams {
    messages: UIMessage[];
    systemPrompt?: string;
    model?: BackendModel;
    mode?: ToolMode;
    maxSteps?: number;
    abortSignal?: AbortSignal;
    onError?: (error: Error) => void;
    onFinishCallback?: () => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onToolResult?: (result: ToolResult) => void;
-   // TODO: Add search mode support - pass searchEnabled and searchDepth to backend
-   // TODO: Add page context support - pass initialPageContext to backend  
-   // TODO: Add workflow support - pass workflowId for workflow-specific prompts
+   /**
+    * Initial page context captured when conversation started.
+    * Formatted string from formatPageContextForAI()
+    */
+   initialPageContext?: string;
+   // TODO: Add search mode support - pass searchEnabled and searchDepth to backend
+   // TODO: Add workflow support - pass workflowId for workflow-specific prompts
}
```

```diff
export async function streamBackendChatWithTools(
    params: BackendChatWithToolsParams
) {
    const {
        messages,
        systemPrompt,
        model = 'gemini-2.5-flash',
        mode = 'agent',
        maxSteps: userMaxSteps = 20,
        abortSignal,
        onError,
        onFinishCallback,
        onToolCall,
        onToolResult,
+       initialPageContext,
    } = params;

-   log.info('Starting backend chat with tools', { messageCount: messages.length, model, mode });
+   log.info('Starting backend chat with tools', { 
+       messageCount: messages.length, 
+       model, 
+       mode,
+       hasPageContext: !!initialPageContext,
+       pageContextLength: initialPageContext?.length || 0,
+   });
```

```diff
                        body: JSON.stringify({
                            messages: conversationMessages,
                            system: systemPrompt,
                            tools: toolSchemas,
                            model,
                            mode,
                            maxSteps: 1,
-                           // TODO: Add searchEnabled, searchDepth for search mode
-                           // TODO: Add pageContext for initial page context
+                           pageContext: initialPageContext,
                        }),
```

### File 2: apps/extension/src/ai/core/aiLogic.ts

```diff
    log.info('📡 Backend mode using model:', { selectedModel, toolsMode: backendMode, maxSteps: userMaxSteps });

-   // TODO: Pass search mode settings (searchEnabled, searchDepth) when implementing search with backend
-   // TODO: Pass initialPageContext for page-aware conversations  
-   // TODO: Pass workflowId for workflow-specific behavior on backend
-   // TODO: Handle adaptive mode dynamic tool discovery on backend
+   // TODO: Pass search mode settings (searchEnabled, searchDepth) when implementing search with backend
+   // TODO: Pass workflowId for workflow-specific behavior on backend
+   // TODO: Handle adaptive mode dynamic tool discovery on backend

    return streamBackendChatWithTools({
      messages,
      systemPrompt: undefined,
      model: selectedModel,
      mode: backendMode,
      maxSteps: userMaxSteps,
      abortSignal,
      onError,
      onFinishCallback,
+     initialPageContext, // Pass page context for page-aware conversations
      onToolCall: (tc) => log.info('Tool call:', { name: tc.name, id: tc.id }),
      onToolResult: (tr) => log.info('Tool result:', { id: tr.id, isError: tr.isError }),
    });
```

### File 3: packages/backend-vercel/src/routes/ai.ts

```diff
+/**
+ * Build system prompt with page context if available
+ */
+function buildSystemPromptWithPageContext(
+    basePrompt: string,
+    pageContext: string | null | undefined
+): string {
+    if (!pageContext || pageContext.length === 0) {
+        return basePrompt;
+    }
+
+    return `${basePrompt}
+
+[INITIAL PAGE CONTEXT - The page where this conversation started]
+${pageContext}
+
+Note: This context was captured when the conversation began. The user may reference "this page", "this form", or elements listed above. They may have navigated away since then - use readPageContent tool for current page if needed.`;
+}
```

```diff
        const {
            messages,
            system,
            tools: toolSchemas = {},
            model: modelName = 'gemini-2.0-flash',
            mode,
            maxSteps = 10,
+           pageContext,
        } = req.body;
```

```diff
        // Use mode-based system prompt if no custom system prompt provided
-       const effectiveSystemPrompt = system || getSystemPromptForMode(mode);
+       const baseSystemPrompt = system || getSystemPromptForMode(mode);
+       const effectiveSystemPrompt = buildSystemPromptWithPageContext(baseSystemPrompt, pageContext);

-       // TODO: Add search mode support - append search instructions when searchEnabled is true
-       // TODO: Add page context support - include initialPageContext in system prompt
-       // TODO: Add workflow support - use workflow-specific prompts when workflowId is provided
+       // TODO: Add search mode support - append search instructions when searchEnabled is true
+       // TODO: Add workflow support - use workflow-specific prompts when workflowId is provided
```

## Testing Strategy

### Manual Testing
1. Open extension on a complex webpage (e.g., GitHub issue, Gmail compose)
2. Start a new conversation in **backend mode**
3. Ask: "What page am I on?" or "What buttons are available?"
4. Verify AI correctly identifies page elements from initial context

### Automated Tests (Future)
```typescript
// test/backend/pageContext.test.ts
describe('Page Context in Backend Mode', () => {
    it('should include pageContext in request body', async () => {
        const mockPageContext = '📄 Current Page: Test Page\n🔗 URL: https://example.com';
        // ... test implementation
    });

    it('should enhance system prompt with page context', () => {
        const result = buildSystemPromptWithPageContext(
            'Base prompt',
            '📄 Page: Test'
        );
        expect(result).toContain('[INITIAL PAGE CONTEXT');
        expect(result).toContain('📄 Page: Test');
    });

    it('should handle null/undefined pageContext gracefully', () => {
        const result = buildSystemPromptWithPageContext('Base prompt', null);
        expect(result).toBe('Base prompt');
    });
});
```

## Rollout Plan

1. **Development**: Implement changes in feature branch
2. **Local Testing**: Test with extension dev build + local Vercel dev
3. **Staging**: Deploy backend to Vercel preview, test with extension dev
4. **Production**: Merge and deploy
5. **Monitor**: Check logs for pageContext usage patterns

## Future Enhancements

1. **Dynamic Page Context Updates**: Allow refreshing page context mid-conversation
2. **Page Context Compression**: Summarize long page contexts to save tokens
3. **Selective Context**: Only include relevant page elements based on conversation topic
4. **Page Context Caching**: Cache formatted context to avoid re-extraction

## Related TODOs (Not Covered)

The following TODOs are related but separate features:
- Line 105: Search mode settings (searchEnabled, searchDepth)
- Line 107: Workflow support (workflowId)
- Line 108: Adaptive mode dynamic tool discovery
