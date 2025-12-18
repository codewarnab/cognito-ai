# Backend Mode Tool Display Issue Report

## Issue Description
When using "Backend Mode" (Remote Model via Vercel Backend), tool calls are displayed as raw text messages (e.g., "🔧 Calling tool: **toolName**") instead of using the interactive UI components (icons, status indicators, collapsible details) that are seen in the local/BYOK mode.

## Root Cause Analysis
The issue resides in `apps/extension/src/ai/backend/backendChatWithTools.ts`.

The `streamBackendChatWithTools` function manually parses the stream from the backend and writes updates to the UI stream writer. Currently, when a tool call is detected from the backend stream, the code explicitly converts it into a text delta string rather than passing it as a structured tool event.

**Current Code (Problematic Section):**
```typescript
// apps/extension/src/ai/backend/backendChatWithTools.ts

// ... inside the stream loop ...
case 'tool_call':
    // ...
    // PROBLEM: This forces the tool call to be rendered as a text message
    writer.write({
        type: 'text-delta',
        id: messageId,
        delta: `\n🔧 Calling tool: **${toolCall.name}**\n`, 
    });
    break;
```

Because the `writer` receives `text-delta` events, the `ChatMessages` component renders them as standard Markdown text. The `ToolPartRenderer` component, which is responsible for the rich UI, only activates when it sees parts with `type: 'tool-call'` or `type: 'tool-result'`.

## Proposed Fix

To fix this, `apps/extension/src/ai/backend/backendChatWithTools.ts` must be updated to emit structured events that the AI SDK v5 frontend hooks recognize.

### 1. Update Tool Call Handling
Replace the text delta emission with a `tool-call` event.

**Change:**
```typescript
// Old
writer.write({
    type: 'text-delta',
    id: messageId,
    delta: `\n🔧 Calling tool: **${toolCall.name}**\n`,
});

// New
writer.write({
    type: 'tool-call',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    args: toolCall.arguments,
});
```

### 2. Update Tool Result Handling
Replace the text delta emission for results with a `tool-result` event.

**Change:**
```typescript
// Old
const resultPreview = result.isError ? `❌ Error: ${result.result}` : `✅ Done`;
writer.write({
    type: 'text-delta',
    id: 'tool-result-' + generateId(),
    delta: `${resultPreview}\n`,
});

// New
writer.write({
    type: 'tool-result',
    toolCallId: result.id,
    toolName: toolCall.name,
    result: result.result,
    isError: result.isError
});
```

## Impact
Applying this fix will ensure that:
1. Tool calls in Backend Mode appear with the same UI as Local Mode.
2. The `ToolPartRenderer` will correctly handle the state (loading, success, error).
3. The chat history will be cleaner, without raw text logs of tool executions.
