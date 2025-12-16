# Adaptive Mode Tool UI Mapping - Option B

**Custom Renderer Approach**

> Track tool calls during sandbox execution, return them in the `executeTools` result, and render each as a separate `CompactToolCard` using existing icon/formatter infrastructure.

---

## Overview

This approach creates a custom UI renderer for `executeTools` that:
1. Tracks each tool call made inside the sandbox
2. Returns tool call metadata alongside the execution result
3. Renders each sub-tool as a separate `CompactToolCard` (identical to normal tool calls)
4. Hides/minimizes the `executeTools` wrapper itself

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPTION B ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   executeTools Called                                                        │
│          │                                                                   │
│          ▼                                                                   │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                    SandboxBridge.executeCode()                      │    │
│   │                                                                     │    │
│   │   On each TOOL_REQUEST:                                             │    │
│   │   ┌─────────────────────────────────────────┐                       │    │
│   │   │ toolCalls.push({                        │                       │    │
│   │   │   toolName: "webSearch",                │                       │    │
│   │   │   input: { query: "..." },              │                       │    │
│   │   │   startTime: Date.now()                 │                       │    │
│   │   │ })                                      │                       │    │
│   │   └─────────────────────────────────────────┘                       │    │
│   │                                                                     │    │
│   │   On each TOOL_RESULT:                                              │    │
│   │   ┌─────────────────────────────────────────┐                       │    │
│   │   │ toolCalls[i].output = result            │                       │    │
│   │   │ toolCalls[i].state = "success"          │                       │    │
│   │   │ toolCalls[i].durationMs = ...           │                       │    │
│   │   └─────────────────────────────────────────┘                       │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│          │                                                                   │
│          ▼                                                                   │
│   Return: { output: "...", success: true, toolCalls: [...] }                │
│          │                                                                   │
│          ▼                                                                   │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │               Custom executeTools Renderer                          │    │
│   │                                                                     │    │
│   │   output.toolCalls.map(call => (                                    │    │
│   │     <CompactToolCard                                                │    │
│   │       toolName={call.toolName}    ← Uses getToolIcon()              │    │
│   │       state={call.state}          ← loading/success/error           │    │
│   │       input={call.input}          ← Uses formatToolAction()         │    │
│   │       output={call.output}                                          │    │
│   │     />                                                              │    │
│   │   ))                                                                │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  🔍 Searching web "codewarnab" ✓     ← IDENTICAL to normal webSearch│   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Define Tool Call Tracking Types

**Goal**: Create TypeScript types for tracking tool calls during sandbox execution.

### Files to Modify

#### [NEW] `src/ai/tools/meta/types.ts`

```typescript
/**
 * Represents a tool call made during executeTools execution
 */
export interface TrackedToolCall {
    /** Unique ID for this tool call */
    callId: string;
    /** Name of the tool (e.g., "webSearch") */
    toolName: string;
    /** Input arguments passed to the tool */
    input: unknown;
    /** Output from the tool (undefined while executing) */
    output?: unknown;
    /** Execution state */
    state: 'loading' | 'success' | 'error';
    /** Error message if state is 'error' */
    errorText?: string;
    /** Timestamp when tool call started */
    startTime: number;
    /** Duration in milliseconds (set when complete) */
    durationMs?: number;
}

/**
 * Enhanced result from executeTools that includes tracked tool calls
 */
export interface ExecuteToolsResult {
    /** Stringified output from code execution */
    output: string;
    /** Whether execution was successful */
    success: boolean;
    /** Error message if unsuccessful */
    error?: string;
    /** List of all tool calls made during execution */
    toolCalls?: TrackedToolCall[];
}
```

### Tasks
- [x] Create `src/ai/tools/meta/types.ts` with types above
- [x] Export types from `src/ai/tools/meta/index.ts`

---

## Phase 2: Track Tool Calls in SandboxBridge

**Goal**: Modify `SandboxBridge.ts` to track each tool request/result and return them in the execution result.

### Files to Modify

#### [MODIFY] `src/ai/tools/meta/SandboxBridge.ts`

**Changes:**

1. **Add tool call tracking array in `executeCode()`:**
```typescript
async executeCode(
    code: string,
    availableTools: string[],
    toolExecutor: (toolName: string, args: unknown[]) => Promise<unknown>,
    options: { timeoutMs?: number; abortSignal?: AbortSignal } = {}
): Promise<ExecutionResult> {
    // NEW: Track tool calls for this execution
    const trackedToolCalls: TrackedToolCall[] = [];
    
    // ... existing code ...
}
```

2. **Capture tool calls in `executeToolRequest()`:**
```typescript
private async executeToolRequest(
    request: ToolRequestMessage,
    toolExecutor: (toolName: string, args: unknown[]) => Promise<unknown>,
    pending: PendingRequest,
    trackedToolCalls: TrackedToolCall[]  // NEW parameter
): Promise<void> {
    const startTime = Date.now();
    
    // Track this tool call
    const trackedCall: TrackedToolCall = {
        callId: request.callId,
        toolName: request.toolName,
        input: request.args[0],  // First arg is usually the input object
        state: 'loading',
        startTime,
    };
    trackedToolCalls.push(trackedCall);
    
    try {
        const result = await toolExecutor(request.toolName, request.args);
        
        // Update tracked call with result
        trackedCall.output = result;
        trackedCall.state = 'success';
        trackedCall.durationMs = Date.now() - startTime;
        
        this.sendToolResult(request.callId, result);
    } catch (error) {
        // Update tracked call with error
        trackedCall.state = 'error';
        trackedCall.errorText = error.message;
        trackedCall.durationMs = Date.now() - startTime;
        
        this.sendToolResult(request.callId, undefined, error.message);
    }
}
```

3. **Include tracked calls in result:**
```typescript
// In the resolve callback
pending.resolve({
    ...result,
    result: deserializedResult,
    toolCalls: trackedToolCalls,  // NEW: Include tracked calls
});
```

### Tasks
- [x] Import `TrackedToolCall` type
- [x] Add `trackedToolCalls` array to `executeCode()`
- [x] Pass array to `executeToolRequest()` via message handler
- [x] Update `ExecutionResult` interface to include `toolCalls`
- [x] Populate `trackedCall` on each `TOOL_REQUEST`
- [x] Update `trackedCall` on each `TOOL_RESULT`
- [x] Include `trackedToolCalls` in final result

---

## Phase 3: Update executeTools to Return Tool Calls

**Goal**: Modify `executeTools.ts` to pass through the tracked tool calls from the sandbox result.

### Files to Modify

#### [MODIFY] `src/ai/tools/meta/executeTools.ts`

**Changes:**

1. **Update return type:**
```typescript
async function executeToolsCode(
    code: string,
    abortSignal?: AbortSignal
): Promise<{ output: string; success: boolean; error?: string; toolCalls?: TrackedToolCall[] }> {
```

2. **Include toolCalls in return:**
```typescript
// After sandboxResult
return {
    output,
    success: true,
    toolCalls: sandboxResult.toolCalls,  // NEW: Pass through tool calls
};
```

### Tasks
- [ ] Import `TrackedToolCall` type
- [ ] Update `executeToolsCode` return type
- [ ] Include `toolCalls` in successful result
- [ ] Include `toolCalls` (partial) in error result if available

---

## Phase 4: Create Custom Renderer for executeTools

**Goal**: Create a React component that renders the tracked tool calls as individual `CompactToolCard` components.

### Files to Modify

#### [NEW] `src/actions/meta/ExecuteToolsRenderer.tsx`

```tsx
/**
 * Custom renderer for executeTools that displays each sub-tool call
 * using CompactToolCard, making them look identical to normal tool calls.
 */

import React from 'react';
import { CompactToolCard } from '@/components/ui/tools/cards';
import type { ToolUIState } from '@/ai/tools/components';
import type { TrackedToolCall } from '@/ai/tools/meta/types';

interface ExecuteToolsRendererProps {
    state: ToolUIState;
}

export function ExecuteToolsRenderer({ state }: ExecuteToolsRendererProps) {
    const { state: toolState, output } = state;
    
    // Extract tool calls from output
    const toolCalls: TrackedToolCall[] = output?.toolCalls || [];
    
    // If no tool calls tracked, show minimal executeTools card
    if (toolCalls.length === 0) {
        // Still loading or no tools called
        if (toolState === 'input-available' || toolState === 'input-streaming') {
            return (
                <CompactToolCard
                    toolName="executeTools"
                    state="loading"
                    input={state.input}
                />
            );
        }
        // Completed but no tools - show compact result
        return (
            <CompactToolCard
                toolName="executeTools"
                state={toolState === 'output-available' ? 'success' : 'error'}
                input={state.input}
                output={output}
            />
        );
    }
    
    // Render each tracked tool call as a separate card
    return (
        <div className="flex flex-col gap-1">
            {toolCalls.map((call) => (
                <CompactToolCard
                    key={call.callId}
                    toolName={call.toolName}
                    state={call.state}
                    input={call.input}
                    output={call.output}
                    errorText={call.errorText}
                />
            ))}
        </div>
    );
}
```

#### [MODIFY] `src/actions/meta/useMetaTools.tsx`

**Changes:**

```tsx
import { ExecuteToolsRenderer } from './ExecuteToolsRenderer';

// In useEffect:
registerToolUI('executeTools', (state: ToolUIState) => {
    return <ExecuteToolsRenderer state={state} />;
});
```

### Tasks
- [ ] Create `ExecuteToolsRenderer.tsx` component
- [ ] Import and use in `useMetaTools.tsx`
- [ ] Handle loading state (no tool calls yet)
- [ ] Handle case where code runs but calls no tools
- [ ] Render each tool call as `CompactToolCard`

---

## Phase 5: Handle Streaming/Loading States

**Goal**: Properly show loading indicators as tools execute, then transition to success.

### Challenge

When `executeTools` is running, the output won't have `toolCalls` until completion. We need to either:

**Option 5A**: Show a generic loading state, then all tool cards appear at once
**Option 5B**: Stream tool call updates via a callback mechanism (more complex)

For simplicity, Phase 5 implements **Option 5A**.

### Files to Modify

#### [MODIFY] `src/actions/meta/ExecuteToolsRenderer.tsx`

```tsx
export function ExecuteToolsRenderer({ state }: ExecuteToolsRendererProps) {
    const { state: toolState, output, input } = state;
    
    // While executeTools is running, show a loading indicator
    if (toolState === 'input-available' || toolState === 'input-streaming') {
        return (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <LoadingCheckIcon size={16} />
                <span>Executing code...</span>
            </div>
        );
    }
    
    // Extract tool calls from completed output
    const toolCalls: TrackedToolCall[] = output?.toolCalls || [];
    
    // ... rest of rendering
}
```

### Tasks
- [x] Show loading state while executing
- [x] Transition to showing tool cards once complete
- [x] Animate tool cards appearing (optional polish)

---

## Phase 6: Testing & Verification

**Goal**: Verify that Adaptive Mode tool calls render identically to normal tool calls.

### Test Cases

| Test | Expected Result |
|------|-----------------|
| Call `tools.webSearch({ query: "test" })` | Shows TavilyIcon, "Searching web 'test'", then "Found X results" |
| Call `tools.navigateTo({ url: "..." })` | Shows CompassIcon, correct action text |
| Call multiple tools in sequence | Shows multiple cards in order |
| Tool fails | Shows error state with red X |
| Code has no tool calls | Shows minimal or no card |

### Verification Commands

```bash
# Build and test
pnpm dev

# Test in extension:
1. Open side panel
2. Select Adaptive mode
3. Send: "Search the web for React hooks"
4. Verify webSearch card appears with TavilyIcon
5. Compare to Agent mode webSearch - should be identical
```

### Tasks
- [ ] Test webSearch via Adaptive mode
- [ ] Test navigateTo via Adaptive mode
- [ ] Test readPageContent via Adaptive mode
- [ ] Test error handling
- [ ] Compare UI with normal mode calls
- [ ] Test multi-tool execution

---

## Phase 7: Polish & Edge Cases

**Goal**: Handle edge cases and improve UX.

### Edge Cases to Handle

1. **Tool call inside loop**: Multiple calls to same tool
2. **Parallel tool calls**: `Promise.all([tools.a(), tools.b()])`
3. **Very long tool names**: MCP tools with long names
4. **Large outputs**: Tools returning large data
5. **Abort mid-execution**: User cancels while tools running

### Tasks
- [ ] Handle duplicate tool names (show count badge?)
- [ ] Handle parallel execution (show in parallel?)
- [ ] Test with MCP tools
- [ ] Test abort behavior
- [ ] Add animation for appearing cards

---

## Summary

| Phase | Description | Estimated Effort |
|-------|-------------|------------------|
| 1 | Define types | 15 min |
| 2 | Track in SandboxBridge | 45 min |
| 3 | Update executeTools | 15 min |
| 4 | Create renderer | 30 min |
| 5 | Loading states | 20 min |
| 6 | Testing | 30 min |
| 7 | Polish | 30 min |
| **Total** | | **~3 hours** |

### Key Files Changed

| File | Type | Purpose |
|------|------|---------|
| `src/ai/tools/meta/types.ts` | NEW | Type definitions |
| `src/ai/tools/meta/SandboxBridge.ts` | MODIFY | Track tool calls |
| `src/ai/tools/meta/executeTools.ts` | MODIFY | Pass through tool calls |
| `src/actions/meta/ExecuteToolsRenderer.tsx` | NEW | Custom UI renderer |
| `src/actions/meta/useMetaTools.tsx` | MODIFY | Use custom renderer |
