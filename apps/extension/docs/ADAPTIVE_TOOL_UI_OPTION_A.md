# Adaptive Mode Tool UI Mapping - Option A

**Synthetic Tool Parts Approach**

> Emit synthetic `tool-call` and `tool-result` message parts during sandbox execution, allowing the message stream to render sub-tools exactly as if they were called directly by the LLM.

---

## Overview

This approach is more architecturally "correct" but more complex. Instead of creating a custom renderer that displays tool calls retroactively, we:

1. Emit real `tool-call`/`tool-result` parts to the message stream as tools execute
2. The standard `ToolPartRenderer` handles them automatically
3. Each sub-tool appears in the chat as a completely independent tool call

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPTION A ARCHITECTURE                                 │
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
│   │   │ emitToolCallPart({                      │ ──► Message Stream   │    │
│   │   │   type: 'tool-call',                    │                       │    │
│   │   │   toolCallId: uniqueId,                 │                       │    │
│   │   │   toolName: "webSearch",                │                       │    │
│   │   │   args: { query: "..." }                │                       │    │
│   │   │ })                                      │                       │    │
│   │   └─────────────────────────────────────────┘                       │    │
│   │                                                                     │    │
│   │   Execute actual tool...                                            │    │
│   │                                                                     │    │
│   │   On each TOOL_RESULT:                                              │    │
│   │   ┌─────────────────────────────────────────┐                       │    │
│   │   │ emitToolResultPart({                    │ ──► Message Stream   │    │
│   │   │   type: 'tool-result',                  │                       │    │
│   │   │   toolCallId: sameId,                   │                       │    │
│   │   │   toolName: "webSearch",                │                       │    │
│   │   │   result: { results: [...] }            │                       │    │
│   │   │ })                                      │                       │    │
│   │   └─────────────────────────────────────────┘                       │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│          │                                                                   │
│          ▼                                                                   │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │           ChatMessages.tsx (Existing Message Stream)                │    │
│   │                                                                     │    │
│   │   message.parts = [                                                │    │
│   │     { type: 'tool-call', toolCallId: 'abc', toolName: 'webSearch'} │    │
│   │     { type: 'tool-result', toolCallId: 'abc', result: {...} }      │    │
│   │   ]                                                                 │    │
│   │                                                                     │    │
│   │   → ToolPartRenderer renders each as CompactToolCard               │    │
│   │   → mergeToolParts() combines call+result                          │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  🔍 Searching web "codewarnab"     (loading)                        │   │
│   │  🔍 Found 5 results       ✓        (after result comes in)         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Result: True streaming UI - tools appear as they're called!              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Difference from Option B

| Aspect | Option B | Option A |
|--------|----------|----------|
| When tools appear | All at once after execution | As each tool is called |
| Loading state | Shows "Executing code..." | Shows each tool loading individually |
| Integration depth | Custom renderer only | Modifies message stream |
| Real-time feedback | No | Yes |
| Complexity | Lower | Higher |

---

## Phase 1: Understand Message Stream Architecture

**Goal**: Analyze how messages and parts flow through the system.

### Key Components

```
┌───────────────────────────────────────────────────────────────┐
│                    MESSAGE STREAM FLOW                         │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│   AI SDK (useChat)                                             │
│        │                                                       │
│        ▼                                                       │
│   ChatProvider (stores messages in state)                      │
│        │                                                       │
│        ▼                                                       │
│   ChatMessages.tsx                                             │
│        │                                                       │
│        ├──► message.parts.filter(tool-call, tool-result)       │
│        │                                                       │
│        ▼                                                       │
│   mergeToolParts() - combines call+result by toolCallId        │
│        │                                                       │
│        ▼                                                       │
│   ToolPartRenderer - creates ToolUIState                       │
│        │                                                       │
│        ▼                                                       │
│   CompactToolCard - renders with icon/formatter                │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### Research Tasks
- [ ] Find where message parts are added to the stream
- [ ] Understand how AI SDK emits tool-call/tool-result parts
- [ ] Find how to programmatically add parts to current message
- [ ] Check if useChat provides a way to append parts

---

## Phase 2: Create Part Emitter Mechanism

**Goal**: Create a mechanism to emit synthetic tool parts into the message stream.

### Challenge

The AI SDK controls the message stream. We need a way to inject parts from `executeTools`. Possible approaches:

**Approach 2A: Event-based emission**
- Dispatch custom events that ChatMessages listens for
- ChatMessages appends synthetic parts to current message

**Approach 2B: Callback-based emission**
- Pass a callback to executeTools that receives parts
- The caller (AI SDK integration) appends to message

**Approach 2C: Message store modification**
- Directly modify the message store/state
- More invasive but more direct

### Files to Create/Modify

#### [NEW] `src/ai/tools/meta/ToolPartEmitter.ts`

```typescript
/**
 * ToolPartEmitter - Emits synthetic tool parts for Adaptive Mode
 * 
 * Uses custom events to communicate with the message stream.
 */

export interface SyntheticToolCallPart {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: unknown;
}

export interface SyntheticToolResultPart {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
}

export type SyntheticToolPart = SyntheticToolCallPart | SyntheticToolResultPart;

/**
 * Emit a synthetic tool part to the message stream
 */
export function emitToolPart(part: SyntheticToolPart, messageId: string): void {
    const event = new CustomEvent('synthetic-tool-part', {
        detail: { part, messageId }
    });
    window.dispatchEvent(event);
}

/**
 * Generate a unique tool call ID for synthetic parts
 */
export function generateSyntheticToolCallId(prefix: string): string {
    return `synthetic-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

### Tasks
- [ ] Create `ToolPartEmitter.ts`
- [ ] Define event structure for tool parts
- [ ] Create helper functions for emitting

---

## Phase 3: Listen for Synthetic Parts in ChatMessages

**Goal**: Make ChatMessages listen for synthetic tool part events and append them to the current message.

### Files to Modify

#### [MODIFY] `src/components/features/chat/components/display/ChatMessages.tsx`

**Changes:**

```tsx
// Add state to track synthetic parts
const [syntheticParts, setSyntheticParts] = useState<Map<string, any[]>>(new Map());

// Listen for synthetic tool part events
useEffect(() => {
    const handleSyntheticPart = (event: CustomEvent) => {
        const { part, messageId } = event.detail;
        
        setSyntheticParts(prev => {
            const newMap = new Map(prev);
            const parts = newMap.get(messageId) || [];
            newMap.set(messageId, [...parts, part]);
            return newMap;
        });
    };
    
    window.addEventListener('synthetic-tool-part', handleSyntheticPart);
    return () => window.removeEventListener('synthetic-tool-part', handleSyntheticPart);
}, []);

// In rendering, combine message.parts with syntheticParts[message.id]
const allParts = useMemo(() => {
    const msgParts = message.parts || [];
    const synthetic = syntheticParts.get(message.id) || [];
    return [...msgParts, ...synthetic];
}, [message.parts, syntheticParts]);
```

### Tasks
- [ ] Add synthetic parts state
- [ ] Add event listener for `synthetic-tool-part`
- [ ] Merge synthetic parts with message.parts before rendering
- [ ] Ensure mergeToolParts() works with synthetic parts

---

## Phase 4: Emit Parts from SandboxBridge

**Goal**: Emit tool-call and tool-result parts during sandbox execution.

### Challenge: Getting the Message ID

The sandbox doesn't know the current message ID. We need to pass it through.

### Files to Modify

#### [MODIFY] `src/ai/tools/meta/executeTools.ts`

```typescript
// Add context parameter for message ID
async function executeToolsCode(
    code: string,
    abortSignal?: AbortSignal,
    context?: { messageId?: string }  // NEW
): Promise<ExecuteToolsResult> {
    // ... existing code ...
}

// In execute function
execute: async (input: { code: string }, abortSignal?: AbortSignal, context?: any) => {
    return await executeToolsCode(input.code, abortSignal, context);
},
```

#### [MODIFY] `src/ai/tools/meta/SandboxBridge.ts`

```typescript
import { emitToolPart, generateSyntheticToolCallId } from './ToolPartEmitter';

async executeCode(
    code: string,
    availableTools: string[],
    toolExecutor: (...) => Promise<unknown>,
    options: {
        timeoutMs?: number;
        abortSignal?: AbortSignal;
        messageId?: string;  // NEW
        emitParts?: boolean; // NEW - opt-in to part emission
    } = {}
): Promise<ExecutionResult> {
    // ...
}

private async executeToolRequest(
    request: ToolRequestMessage,
    toolExecutor: (...) => Promise<unknown>,
    pending: PendingRequest,
    options: { messageId?: string; emitParts?: boolean }
): Promise<void> {
    const syntheticId = generateSyntheticToolCallId(request.toolName);
    
    // Emit tool-call part (loading state)
    if (options.emitParts && options.messageId) {
        emitToolPart({
            type: 'tool-call',
            toolCallId: syntheticId,
            toolName: request.toolName,
            args: request.args[0],
        }, options.messageId);
    }
    
    try {
        const result = await toolExecutor(request.toolName, request.args);
        
        // Emit tool-result part (success state)
        if (options.emitParts && options.messageId) {
            emitToolPart({
                type: 'tool-result',
                toolCallId: syntheticId,
                toolName: request.toolName,
                result,
            }, options.messageId);
        }
        
        this.sendToolResult(request.callId, result);
    } catch (error) {
        // Emit tool-result part (error state)
        if (options.emitParts && options.messageId) {
            emitToolPart({
                type: 'tool-result',
                toolCallId: syntheticId,
                toolName: request.toolName,
                result: { error: error.message },
                isError: true,
            }, options.messageId);
        }
        
        this.sendToolResult(request.callId, undefined, error.message);
    }
}
```

### Tasks
- [ ] Add messageId to executeTools context
- [ ] Pass messageId through to SandboxBridge
- [ ] Emit tool-call part when tool request received
- [ ] Emit tool-result part when tool completes
- [ ] Handle error cases

---

## Phase 5: Pass Message Context to Tool Execution

**Goal**: Get the current message ID from the AI SDK and pass it to executeTools.

### Challenge

The AI SDK tool execution doesn't automatically include message context. We need to find where tool execution happens and inject the message ID.

### Research Needed

```typescript
// Current tool execution (from AI SDK)
registerTool({
    name: 'executeTools',
    execute: async (input, abortSignal) => {
        // Where does messageId come from?
    }
});

// We need to modify this to receive context
execute: async (input, abortSignal, context) => {
    // context.messageId
}
```

### Files to Investigate
- How does AI SDK call tool execute functions?
- Where is the current message ID available during execution?
- Can we use React context to pass it down?

### Potential Approaches

**5A: Global context**
- Store current message ID in a global/context
- Tools read from this context

**5B: AI SDK customization**
- Check if AI SDK supports passing context to tools
- May require SDK modification or wrapper

**5C: Tool registry enhancement**
- Modify our registerTool to wrap execution with context

### Tasks
- [ ] Research AI SDK tool execution context
- [ ] Determine best approach for passing messageId
- [ ] Implement context passing mechanism
- [ ] Test with executeTools

---

## Phase 6: Hide executeTools Wrapper

**Goal**: Since sub-tools are now shown individually, we should hide or minimize the executeTools card itself.

### Options

**6A: Don't render executeTools at all**
```tsx
registerToolUI('executeTools', () => null);
```

**6B: Render minimal indicator**
```tsx
registerToolUI('executeTools', (state) => (
    state.state === 'input-available' 
        ? <LoadingIndicator />  // While code executing
        : null                  // Hide once done
));
```

**6C: Collapsible code block**
```tsx
registerToolUI('executeTools', (state) => (
    <CollapsibleCodeBlock code={state.input?.code} />
));
```

### Tasks
- [ ] Decide on rendering strategy for executeTools itself
- [ ] Implement in useMetaTools.tsx
- [ ] Test visual appearance

---

## Phase 7: Handle Part Deduplication

**Goal**: Prevent duplicate rendering if both real and synthetic parts exist.

### Challenge

The AI SDK might also emit parts for executeTools separately. We need to ensure:
1. No duplicate tool cards
2. Synthetic parts integrate smoothly with real parts
3. `mergeToolParts()` handles synthetic IDs

### Files to Modify

#### [MODIFY] `src/components/features/chat/components/display/ChatMessages.tsx`

```typescript
function mergeToolParts(parts: any[]): any[] {
    // Filter out executeTools parts if we're emitting synthetic sub-parts
    const filteredParts = parts.filter(part => {
        if (part.toolName === 'executeTools') {
            // Check if this execution has emitted synthetic parts
            // If so, hide the executeTools part itself
            return false;
        }
        return true;
    });
    
    // ... rest of existing merge logic
}
```

### Tasks
- [ ] Filter executeTools parts when synthetic parts exist
- [ ] Ensure synthetic tool call IDs don't conflict
- [ ] Test with mixed real and synthetic parts

---

## Phase 8: Testing & Verification

**Goal**: Comprehensive testing of the synthetic parts approach.

### Test Cases

| Test | Expected Result |
|------|-----------------|
| Single tool call | Shows loading → success transition in real-time |
| Multiple sequential calls | Cards appear one by one as tools execute |
| Parallel calls (Promise.all) | Cards appear simultaneously |
| Tool error | Shows error state correctly |
| Abort mid-execution | Currently running tools show error |
| Mixed with text output | Tool cards and text interleave correctly |

### Verification

```bash
# Test in extension:
1. Open side panel
2. Select Adaptive mode
3. Send: "Search for React and show active tab"
4. Watch as:
   - webSearch card appears (loading)
   - webSearch card shows result (success)
   - getActiveTab card appears (loading)
   - getActiveTab card shows result (success)
5. Cards should have proper icons and formatting
```

### Tasks
- [ ] Test single tool call streaming
- [ ] Test multiple tool call streaming
- [ ] Test error handling
- [ ] Test abort behavior
- [ ] Compare visual appearance with normal mode

---

## Phase 9: Cleanup Synthetic Parts

**Goal**: Clean up synthetic parts when messages are cleared or conversation resets.

### Files to Modify

#### [MODIFY] `src/components/features/chat/components/display/ChatMessages.tsx`

```typescript
// Clear synthetic parts when messages are cleared
useEffect(() => {
    if (messages.length === 0) {
        setSyntheticParts(new Map());
    }
}, [messages.length]);

// Or clear old synthetic parts for messages that no longer exist
useEffect(() => {
    const currentMessageIds = new Set(messages.map(m => m.id));
    setSyntheticParts(prev => {
        const newMap = new Map();
        for (const [msgId, parts] of prev) {
            if (currentMessageIds.has(msgId)) {
                newMap.set(msgId, parts);
            }
        }
        return newMap;
    });
}, [messages]);
```

### Tasks
- [ ] Clean up synthetic parts on conversation clear
- [ ] Clean up orphaned synthetic parts
- [ ] Handle message deletion

---

## Summary

| Phase | Description | Estimated Effort |
|-------|-------------|------------------|
| 1 | Understand message stream | 30 min |
| 2 | Create part emitter | 30 min |
| 3 | Listen in ChatMessages | 45 min |
| 4 | Emit from SandboxBridge | 45 min |
| 5 | Pass message context | 1 hour |
| 6 | Hide executeTools wrapper | 15 min |
| 7 | Handle deduplication | 30 min |
| 8 | Testing | 45 min |
| 9 | Cleanup | 20 min |
| **Total** | | **~5-6 hours** |

### Key Files Changed

| File | Type | Purpose |
|------|------|---------|
| `src/ai/tools/meta/ToolPartEmitter.ts` | NEW | Event emission for synthetic parts |
| `src/ai/tools/meta/SandboxBridge.ts` | MODIFY | Emit parts during tool execution |
| `src/ai/tools/meta/executeTools.ts` | MODIFY | Accept and pass message context |
| `ChatMessages.tsx` | MODIFY | Listen for and render synthetic parts |
| `useMetaTools.tsx` | MODIFY | Update executeTools renderer |

---

## Comparison: Option A vs Option B

| Aspect | Option B | Option A |
|--------|----------|----------|
| **Implementation Time** | ~3 hours | ~5-6 hours |
| **Complexity** | Lower | Higher |
| **Real-time Updates** | No (all at once) | Yes (streaming) |
| **Code Changes** | Localized | Distributed |
| **Risk** | Lower | Higher |
| **UX Quality** | Good | Excellent |
| **Maintenance** | Easier | More complex |

### Recommendation

**Start with Option B** - it's simpler, faster to implement, and still achieves the goal of having tool calls look identical to normal mode. If real-time streaming is later deemed essential, Option A can be implemented as an enhancement.
