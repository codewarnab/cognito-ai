# Search Mode Backend Integration - Implementation Plan

## Overview

This document outlines the implementation plan for passing search mode settings (`searchEnabled`, `searchDepth`) from the extension to the backend when using Backend Mode. Currently, the local mode fully supports search mode, but when using Backend Mode (via Vercel), the search settings are not being passed.

## Current State Analysis

### Local Mode (Working) ✅

When running in local mode ([aiLogic.ts](../../../src/ai/core/aiLogic.ts#L205)), the extension:

1. **Reads search settings** from Chrome storage via `getSearchSettings()`
2. **Checks for API key** via `hasApiKeyForProvider()`
3. **Determines search mode state**: `isSearchModeActive = searchSettings.enabled && hasSearchKey && !workflowConfig`
4. **Modifies system prompt** by appending `getSearchPromptAddition(true)` when search is active
5. **Filters tools**: Either includes only search tools (exclusive mode) or adds them alongside other tools
6. **Supports dynamic switching** via `prepareStep` hook that re-checks settings mid-conversation

### Backend Mode (Not Implemented) ❌

Currently in [backendChatWithTools.ts](../../../src/ai/backend/backendChatWithTools.ts#L237):

```typescript
body: JSON.stringify({
    messages: conversationMessages,
    system: systemPrompt,
    tools: toolSchemas,
    model,
    mode,
    maxSteps: 1,
    // TODO: Add searchEnabled, searchDepth for search mode
    // TODO: Add pageContext for initial page context
}),
```

The backend route at [ai.ts](../../../../packages/backend-vercel/src/routes/ai.ts#L249) has corresponding TODOs:

```typescript
// TODO: Add search mode support - append search instructions when searchEnabled is true
// TODO: Add page context support - include initialPageContext in system prompt
// TODO: Add workflow support - use workflow-specific prompts when workflowId is provided
```

---

## Architecture Options

### Option A: Backend Orchestrated Search (Recommended)

**Approach**: Pass search settings to backend; backend handles prompt modification and has its own search tools.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             EXTENSION (CLIENT)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Read search settings from Chrome storage                                 │
│  2. Include searchEnabled, searchDepth in request body                       │
│  3. Filter tools to include/exclude search tools based on searchEnabled      │
│  4. Frontend still executes tools (search tools included)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND (VERCEL)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Receive searchEnabled, searchDepth from request                          │
│  2. If searchEnabled: append SEARCH_PROMPT_ADDITION to system prompt         │
│  3. Tools still come from frontend (frontend executes them)                  │
│  4. Backend uses Tavily API key for server-side search when tools execute    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Pros**:
- Minimal backend changes
- Frontend already has search tool execution logic
- Consistent with current "frontend tool execution" architecture
- Backend only needs to modify prompts

**Cons**:
- Still requires frontend to have search tools available

### Option B: Full Backend Search (Alternative)

**Approach**: Backend has its own search tools that execute server-side.

**Pros**:
- Complete backend control
- No frontend search dependencies

**Cons**:
- Duplicates tool logic on backend
- More complex implementation
- Breaks existing frontend tool execution pattern

### Recommendation: Option A

Option A aligns with the existing architecture where:
- Backend handles AI generation and prompt engineering
- Frontend executes tools and sends results back
- Search tools are already implemented on frontend with backend proxy support

---

## Implementation Plan

### Phase 1: Type Definitions (30 min)

#### 1.1 Update Extension Request Types

**File**: [backendChatWithTools.ts](../../../src/ai/backend/backendChatWithTools.ts)

Add new fields to the interface:

```typescript
export interface BackendChatWithToolsParams {
    // ... existing fields ...
    
    /** Whether search mode is enabled (user has toggled it on) */
    searchEnabled?: boolean;
    
    /** Search depth preference: 'basic' or 'advanced' */
    searchDepth?: 'basic' | 'advanced';
}
```

#### 1.2 Update Backend Request Types

**File**: `packages/backend-vercel/src/types/index.ts`

Add search fields to the AI chat request interface (if exists) or document expected fields.

### Phase 2: Extension Changes (1.5 hours)

#### 2.1 Fetch Search Settings in aiLogic.ts

**File**: [aiLogic.ts](../../../src/ai/core/aiLogic.ts#L105)

Before calling `streamBackendChatWithTools`, read search settings:

```typescript
// In the useBackendMode block (around line 88)
if (useBackendMode) {
    log.info('🌐 Using BACKEND MODE with tools - routing to Vercel backend');
    
    // Get model config
    const modelConfig = await getModelConfig();
    const selectedModel = (modelConfig.remoteModel || 'gemini-2.5-flash') as BackendModel;
    
    // Get tools mode
    const toolsMode = await getToolsMode();
    const backendMode = toolsMode === 'custom' ? 'agent' : toolsMode;
    
    // Get max steps
    const userMaxSteps = await getMaxToolCallLimit();
    
    // ===== NEW: Get search mode settings =====
    const searchSettings = await getSearchSettings();
    const hasSearchKey = WEB_SEARCH_SELF_API_KEY_HIDDEN || 
        await hasApiKeyForProvider(searchSettings.defaultProvider);
    const searchEnabled = searchSettings.enabled && hasSearchKey;
    const searchDepth = searchSettings.defaultSearchDepth;
    
    log.info('📡 Backend mode settings:', { 
        selectedModel, 
        toolsMode: backendMode, 
        maxSteps: userMaxSteps,
        searchEnabled,
        searchDepth,
    });
    
    return streamBackendChatWithTools({
        messages,
        systemPrompt: undefined,
        model: selectedModel,
        mode: backendMode,
        maxSteps: userMaxSteps,
        searchEnabled,       // NEW
        searchDepth,         // NEW
        abortSignal,
        onError,
        onFinishCallback,
        // ... rest
    });
}
```

#### 2.2 Pass Settings in backendChatWithTools.ts

**File**: [backendChatWithTools.ts](../../../src/ai/backend/backendChatWithTools.ts)

Update the function to accept and pass search settings:

```typescript
// Update interface (around line 29)
export interface BackendChatWithToolsParams {
    messages: UIMessage[];
    systemPrompt?: string;
    model?: BackendModel;
    mode?: ToolMode;
    maxSteps?: number;
    searchEnabled?: boolean;        // NEW
    searchDepth?: 'basic' | 'advanced';  // NEW
    abortSignal?: AbortSignal;
    // ... rest
}

// Destructure in function (around line 153)
export async function streamBackendChatWithTools(params: BackendChatWithToolsParams) {
    const {
        messages,
        systemPrompt,
        model = 'gemini-2.0-flash',
        mode = 'agent',
        maxSteps: userMaxSteps = 10,
        searchEnabled = false,      // NEW
        searchDepth = 'basic',      // NEW
        abortSignal,
        // ... rest
    } = params;
    
    // ... later in the fetch body (around line 237)
    body: JSON.stringify({
        messages: conversationMessages,
        system: systemPrompt,
        tools: toolSchemas,
        model,
        mode,
        maxSteps: 1,
        searchEnabled,   // NEW
        searchDepth,     // NEW
    }),
```

#### 2.3 Include Search Tools in Schemas

The `getToolSchemas()` function needs to include search tools when `searchEnabled` is true. 

**File**: [frontendToolExecutor.ts](../../../src/ai/backend/frontendToolExecutor.ts#L55)

The existing code already handles this:

```typescript
// Check if search mode is active (around line 55)
const searchSettings = await getSearchSettings();
const hasSearchKey = WEB_SEARCH_SELF_API_KEY_HIDDEN || 
    await hasApiKeyForProvider(searchSettings.defaultProvider);
const isSearchModeActive = searchSettings.enabled && hasSearchKey;

// Add search tools if search mode is active (around line 77)
let searchTools: Record<string, any> = {};
if (isSearchModeActive) {
    for (const toolName of SEARCH_TOOL_NAMES) {
        if (allExtensionTools[toolName]) {
            searchTools[toolName] = allExtensionTools[toolName];
        }
    }
}
```

**No changes needed** - search tools are already included when search mode is active.

### Phase 3: Backend Changes (1 hour)

#### 3.1 Accept Search Parameters

**File**: [ai.ts](../../../../packages/backend-vercel/src/routes/ai.ts#L204)

Parse search settings from request body:

```typescript
const {
    messages,
    system,
    tools: toolSchemas = {},
    model: modelName = 'gemini-2.0-flash',
    mode,
    maxSteps = 10,
    searchEnabled = false,    // NEW
    searchDepth = 'basic',    // NEW
} = req.body;
```

#### 3.2 Create Search Prompt Addition

**File**: `packages/backend-vercel/src/routes/ai.ts`

Add the search prompt constant (copy from extension or reference):

```typescript
const SEARCH_PROMPT_ADDITION = `
## Web Search Tools Available

You have access to web search tools for real-time information:

- **webSearch**: Quick single-query search for facts, news, prices
- **deepWebSearch**: Multi-query parallel search for comprehensive research (2-5 queries)
- **retrieve**: Fetch full content from a specific URL

**When to Use:**
- Current events, news, recent information
- Facts you're uncertain about or that may have changed
- Specific products, prices, or availability
- Topics requiring up-to-date data

**Citation Rules:**
- ALWAYS include source URLs as markdown links: [Source Name](URL)
- Use numbered references [1](URL) or inline links in your response

**Search Depth:**
- Current depth: "${searchDepth}" (${searchDepth === 'advanced' ? 'thorough search, more comprehensive' : 'quick search, faster results'})

**Tip:** Use deepWebSearch for complex topics that benefit from multiple perspectives.`;
```

#### 3.3 Modify System Prompt

**File**: [ai.ts](../../../../packages/backend-vercel/src/routes/ai.ts#L247)

```typescript
// Use mode-based system prompt if no custom system prompt provided
let effectiveSystemPrompt = system || getSystemPromptForMode(mode);

// Append search instructions if search mode is enabled
if (searchEnabled) {
    const searchAddition = getSearchPromptAddition(searchDepth);
    effectiveSystemPrompt = effectiveSystemPrompt + '\n\n' + searchAddition;
    console.log('[AI Chat+Tools] Search mode enabled, appended search instructions');
}
```

#### 3.4 Helper Function for Search Prompt

**File**: `packages/backend-vercel/src/routes/ai.ts` (add near other prompt functions)

```typescript
/**
 * Get search prompt addition based on search depth
 */
function getSearchPromptAddition(searchDepth: string = 'basic'): string {
    return `
## Web Search Tools Available

You have access to web search tools for real-time information:

- **webSearch**: Quick single-query search for facts, news, prices
- **deepWebSearch**: Multi-query parallel search for comprehensive research (2-5 queries)
- **retrieve**: Fetch full content from a specific URL

**When to Use:**
- Current events, news, recent information
- Facts you're uncertain about or that may have changed
- Specific products, prices, or availability
- Topics requiring up-to-date data

**Citation Rules:**
- ALWAYS include source URLs as markdown links: [Source Name](URL)
- Use numbered references [1](URL) or inline links in your response

**Search Depth Setting:** ${searchDepth} (${searchDepth === 'advanced' ? 'thorough, comprehensive search' : 'quick, faster results'})

**Tip:** Use deepWebSearch for complex topics that benefit from multiple perspectives.`;
}
```

### Phase 4: Testing (1 hour)

#### 4.1 Unit Tests

1. Test that `searchEnabled` and `searchDepth` are correctly read from settings
2. Test that backend request includes search parameters
3. Test that backend modifies system prompt when `searchEnabled=true`

#### 4.2 Integration Tests

1. **Search Disabled**: Verify normal agent mode works without search modifications
2. **Search Enabled (Basic)**: Verify search prompt is appended, depth is "basic"
3. **Search Enabled (Advanced)**: Verify search prompt is appended, depth is "advanced"
4. **Tool Execution**: Verify `webSearch` tool is available and executes correctly
5. **Mode Switching**: Test changing search mode mid-conversation

#### 4.3 Manual Testing Checklist

- [ ] Toggle search mode ON in extension settings
- [ ] Enable Backend Mode
- [ ] Send a query that requires web search
- [ ] Verify AI uses `webSearch` tool
- [ ] Verify search results are cited in response
- [ ] Verify search depth affects results (basic vs advanced)
- [ ] Test with search mode OFF - verify no search behavior

### Phase 5: Documentation (30 min)

1. Update [WEB_SEARCH_INTEGRATION.md](WEB_SEARCH_INTEGRATION.md) with backend mode support
2. Update [TODO_REPORT.md](../../../../TODO_REPORT.md) to mark items as complete
3. Add inline documentation for new parameters

---

## File Changes Summary

| File | Changes |
|------|---------|
| `apps/extension/src/ai/core/aiLogic.ts` | Read search settings, pass to backend stream |
| `apps/extension/src/ai/backend/backendChatWithTools.ts` | Accept & include `searchEnabled`, `searchDepth` in request |
| `packages/backend-vercel/src/routes/ai.ts` | Parse search params, append search prompt when enabled |

---

## Estimated Time

| Phase | Duration |
|-------|----------|
| Phase 1: Type Definitions | 30 min |
| Phase 2: Extension Changes | 1.5 hours |
| Phase 3: Backend Changes | 1 hour |
| Phase 4: Testing | 1 hour |
| Phase 5: Documentation | 30 min |
| **Total** | **4.5 hours** |

---

## Future Considerations

### Mid-Conversation Mode Switching

Currently, the local mode supports dynamic mode switching via `prepareStep`. For full parity with backend mode, we could:

1. Send current search state with each request (already possible with loop approach)
2. Backend checks and modifies prompt per step

The current loop-based architecture in `backendChatWithTools.ts` already re-sends requests for each step, so we could:

```typescript
// Before each loop iteration, re-check search settings
while (continueLoop && stepCount < maxSteps) {
    // Re-fetch current search settings
    const currentSearchSettings = await getSearchSettings();
    const currentSearchEnabled = currentSearchSettings.enabled && 
        (WEB_SEARCH_SELF_API_KEY_HIDDEN || await hasApiKeyForProvider(currentSearchSettings.defaultProvider));
    
    const response = await fetch(`${BACKEND_URL}/api/ai/chat-with-tools`, {
        body: JSON.stringify({
            // ... other fields
            searchEnabled: currentSearchEnabled,
            searchDepth: currentSearchSettings.defaultSearchDepth,
        }),
    });
}
```

### Shared Types Package

Consider creating `@cognito/shared` package for:
- Search types (`SearchDepth`, `SearchSettings`)
- AI mode types
- Common request/response interfaces

This would ensure type safety across extension and backend.

---

## Appendix: Related TODOs

After implementation, these TODOs should be removed:

1. `apps/extension/src/ai/core/aiLogic.ts:105` - Pass search mode settings
2. `apps/extension/src/ai/backend/backendChatWithTools.ts:48` - Add search mode support
3. `apps/extension/src/ai/backend/backendChatWithTools.ts:237` - Add searchEnabled, searchDepth
4. `packages/backend-vercel/src/routes/ai.ts:249` - Add search mode support

---

## Conclusion

This implementation follows the existing architecture pattern of "backend orchestrates AI, frontend executes tools". By passing `searchEnabled` and `searchDepth` to the backend:

1. Backend can modify the system prompt to guide the AI toward using search tools
2. Frontend's existing search tool execution continues to work
3. The server-side Tavily API key is used (via the existing `/web-search` proxy)
4. Minimal code duplication between local and backend modes
