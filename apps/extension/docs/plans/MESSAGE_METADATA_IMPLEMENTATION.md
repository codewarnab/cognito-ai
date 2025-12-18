# Message Metadata Implementation Plan

**Goal:** Add message-level metadata to track the model name for each AI response, working in both BYOK (direct API) and Backend (cloud) modes.

**Metadata Schema:**
```typescript
interface MessageMetadata {
  model: string; // e.g., "gemini-2.0-flash", "gemini-2.5-flash-preview"
}
```

---

## Overview

The AI SDK v5 supports message metadata via the `UIMessage<T>` generic type. This allows attaching arbitrary data at the message level (not as content). We need to:

1. Define the metadata type
2. Send metadata from both BYOK and Backend modes
3. Update the frontend to consume typed messages
4. (Future) Display the model name in the UI

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Message Metadata Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  BYOK Mode (Frontend Direct)                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ aiLogic.ts                                                   │    │
│  │   └─> createUIMessageStream()                                │    │
│  │         └─> writer.writeMessageMetadata({ model: ... })      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ useAIChat.ts                                                 │    │
│  │   └─> useChat<MyUIMessage>()                                 │    │
│  │         └─> messages[].metadata.model                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Backend Mode (Cloud)                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ backend-vercel/routes/ai.ts                                  │    │
│  │   └─> streamText()                                           │    │
│  │         └─> toUIMessageStreamResponse({                      │    │
│  │               messageMetadata: () => ({ model: ... })        │    │
│  │             })                                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ backendChatWithTools.ts                                      │    │
│  │   └─> consumeUIMessageStream() -> forward to useAIChat       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ useAIChat.ts                                                 │    │
│  │   └─> useChat<MyUIMessage>()                                 │    │
│  │         └─> messages[].metadata.model                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Define Metadata Types

**Files to create/modify:**
- `apps/extension/src/ai/types/messageMetadata.ts` (NEW)
- `apps/extension/src/ai/types/index.ts` (MODIFY - add export)

#### Step 1.1: Create Message Metadata Type

Create a new file for the message metadata type definition:

```typescript
// apps/extension/src/ai/types/messageMetadata.ts
import type { UIMessage } from 'ai';

/**
 * Metadata attached to each AI message
 * 
 * This metadata is attached at the message level (not content level)
 * and is available on both user and assistant messages.
 * 
 * For assistant messages, the model field indicates which AI model
 * generated the response.
 */
export interface MessageMetadata {
  /**
   * The AI model that generated this message
   * Examples: "gemini-2.0-flash", "gemini-2.5-flash-preview", "gemini-nano"
   */
  model?: string;
}

/**
 * Typed UIMessage with our metadata schema
 * Use this type instead of raw UIMessage throughout the app
 */
export type CognitoUIMessage = UIMessage<MessageMetadata>;
```

#### Step 1.2: Export from Types Index

```typescript
// apps/extension/src/ai/types/index.ts
// Add to existing exports:
export type { MessageMetadata, CognitoUIMessage } from './messageMetadata';
```

---

### Phase 2: BYOK Mode Implementation

**Files to modify:**
- `apps/extension/src/ai/core/aiLogic.ts`

#### Step 2.1: Write Metadata in createUIMessageStream

Locate the `createUIMessageStream` call in `aiLogic.ts` and add metadata writing:

```typescript
// In streamAIResponse function, inside createUIMessageStream.execute:

const stream = createUIMessageStream({
  execute: async ({ writer, writeTextPart }) => {
    // ... existing setup code ...

    // Write message metadata at the start of the stream
    // This attaches the model name to the assistant's response
    const modelName = effectiveMode === 'remote' 
      ? modelConfig.remoteModel 
      : 'gemini-nano';
    
    writer.writeMessageMetadata({ model: modelName });

    // ... rest of existing streaming logic ...
  }
});
```

**Key Points:**
- Call `writer.writeMessageMetadata()` early in the execute function
- For local mode, use `'gemini-nano'`
- For remote mode, use `modelConfig.remoteModel` (the actual selected model)

---

### Phase 3: Backend Mode Implementation

**Files to modify:**
- `packages/backend-vercel/src/routes/ai.ts`

#### Step 3.1: Switch from pipeDataStreamToResponse to toUIMessageStreamResponse

Currently the backend uses `pipeDataStreamToResponse()`. We need to switch to `toUIMessageStreamResponse()` which supports the `messageMetadata` callback.

```typescript
// In /chat-with-tools endpoint:

// OLD CODE (remove):
// return result.pipeDataStreamToResponse(res);

// NEW CODE:
return result.toUIMessageStreamResponse(res, {
  messageMetadata: ({ part }) => {
    // Send model metadata when streaming starts
    if (part.type === 'start') {
      return { model: modelName };
    }
    // No metadata needed for other parts
    return undefined;
  },
});
```

**Important:** The `toUIMessageStreamResponse` method:
- Takes `res` (Express Response) as first argument
- Takes options object with `messageMetadata` callback as second argument
- The callback receives `{ part }` which has a `type` field ('start', 'text', 'tool_call', 'finish', etc.)
- Return the metadata object or undefined

---

### Phase 4: Frontend Type Updates

**Files to modify:**
- `apps/extension/src/ai/hooks/useAIChat.ts`
- `apps/extension/src/hooks/chat/useAIChatMessages.ts`
- `apps/extension/src/stores/chat/types.ts`
- `apps/extension/src/stores/chat/chatStore.ts`

#### Step 4.1: Update useAIChat Hook

```typescript
// apps/extension/src/ai/hooks/useAIChat.ts

import type { CognitoUIMessage } from '../types';

// Update the options interface
export interface UseAIChatOptions {
  threadId: string;
  initialMessages?: CognitoUIMessage[];  // Changed from UIMessage[]
  onError?: (error: Error) => void;
  onFinish?: (message: any) => void;
  onContextWarning?: (percent: number) => void;
}

// Update the useChat call with generic type
const chat = useChat<CognitoUIMessage>({
  id: threadId,
  transport,
  onError: handleError,
  onFinish: (finishResult) => {
    // finishResult.message is now typed as CognitoUIMessage
    log.info('AI response finished', {
      messageId: finishResult?.message?.id || 'unknown',
      model: finishResult?.message?.metadata?.model, // NEW: Log model
    });
    setStoreStatus('idle');
    onFinish?.(finishResult);
  },
});
```

#### Step 4.2: Update Chat Store Types

```typescript
// apps/extension/src/stores/chat/types.ts

import type { CognitoUIMessage } from '@/ai/types';

export interface ChatState {
  currentThreadId: string | null;
  messages: CognitoUIMessage[];  // Changed from UIMessage[]
  status: ChatStatus;
  // ... rest remains the same
}
```

#### Step 4.3: Update useAIChatMessages Hook

```typescript
// apps/extension/src/hooks/chat/useAIChatMessages.ts

import type { CognitoUIMessage } from '@/ai/types';

// Update any UIMessage references to CognitoUIMessage
export function useAIChatMessages({ currentThreadId }: UseAIChatMessagesProps) {
  const handleFinish = useCallback(async (result: any) => {
    if (result.messages && result.messages.length > 0 && currentThreadId) {
      const dbMessages: ChatMessage[] = result.messages
        .map((msg: CognitoUIMessage, index: number) => {
          // Can now access msg.metadata?.model if needed
          // ...
        });
    }
  }, [currentThreadId]);
}
```

---

### Phase 5: UI Integration (Future TODO)

> **Note:** We are currently only implementing the data layer. The UI display will be added in a future update .
add this below todo in the component 
- [ ] **TODO:** Update `MessageBubble.tsx` (or equivalent) to display the model name from `message.metadata.model`.

---

### Phase 6: Database Persistence (Optional)

If you want to persist metadata to IndexedDB:

**Files to modify:**
- `apps/extension/src/db/chatMessages.ts`
- `apps/extension/src/db/types.ts`

#### Step 6.1: Add Metadata to ChatMessage Type

```typescript
// apps/extension/src/db/types.ts

export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  // NEW: Add metadata field
  metadata?: {
    model?: string;
  };
}
```

#### Step 6.2: Persist Metadata When Saving

```typescript
// In useAIChatMessages.ts handleFinish:

const dbMessages: ChatMessage[] = result.messages
  .map((msg: CognitoUIMessage, index: number) => ({
    id: msg.id,
    threadId: currentThreadId,
    role: msg.role,
    content: extractTextContent(msg),
    createdAt: new Date(),
    // NEW: Persist metadata
    metadata: msg.metadata ? { model: msg.metadata.model } : undefined,
  }));
```

---

## Testing Checklist

### BYOK Mode Testing
- [ ] Select different models in ModelSelectorPopover
- [ ] Send a message and verify metadata is attached
- [ ] Check console logs for model name in response
- [ ] Verify UI displays correct model name (if implemented)

### Backend Mode Testing
- [ ] Enable backend mode in settings
- [ ] Send a message via backend
- [ ] Verify metadata comes through the stream
- [ ] Check model name matches the selected model
- [ ] Verify graceful degradation still works (fallback to BYOK should also have metadata)

### Persistence Testing (if Phase 6 implemented)
- [ ] Send messages, reload extension
- [ ] Verify metadata is preserved after reload
- [ ] Switch threads and verify each thread shows correct model

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/ai/types/messageMetadata.ts` | NEW | Define MessageMetadata and CognitoUIMessage |
| `src/ai/types/index.ts` | MODIFY | Export new types |
| `src/ai/core/aiLogic.ts` | MODIFY | Write metadata in BYOK stream |
| `packages/backend-vercel/src/routes/ai.ts` | MODIFY | Switch to toUIMessageStreamResponse |
| `src/ai/hooks/useAIChat.ts` | MODIFY | Use CognitoUIMessage generic |
| `src/stores/chat/types.ts` | MODIFY | Update message type |
| `src/hooks/chat/useAIChatMessages.ts` | MODIFY | Use CognitoUIMessage |
| (Optional) Message UI component | MODIFY | (Future) Display model name |
| (Optional) `src/db/types.ts` | MODIFY | Add metadata to ChatMessage |

---

## Rollout Strategy

1. **Phase 1-2**: Start with BYOK mode (lower risk, frontend only)
2. **Phase 3**: Add backend support (requires backend deployment)
3. **Phase 4**: Update all frontend types (can be done incrementally)
4. **Phase 5-6**: Optional UI and persistence (nice-to-have)

---

## Potential Issues & Mitigations

| Issue | Mitigation |
|-------|------------|
| Backend uses `pipeDataStreamToResponse` | toUIMessageStreamResponse is a drop-in replacement with additional features |
| Type mismatches after migration | Make metadata optional (`model?: string`) so existing messages work |
| Local mode model name | Hardcode 'gemini-nano' for local mode since it's not configurable |
| Backend doesn't know selected model | Model name is passed in request body already |

---

## Dependencies

- AI SDK v5 (already installed)
- No new dependencies required

---

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Types | 15 min | Required |
| Phase 2: BYOK | 30 min | Required |
| Phase 3: Backend | 30 min | Required |
| Phase 4: Frontend Types | 45 min | Required |
| Phase 5: UI | TBD | Future |
| Phase 6: Persistence | 30 min | Optional |

**Total (Required):** ~2 hours
**Total (All):** ~3 hours
