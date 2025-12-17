# Type-Safe Extension Messaging System

> **API Reference & Usage Guide** for the type-safe messaging system between Chrome extension contexts (background, content scripts, sidepanel, offscreen).

For the implementation plan and architecture decisions, see [TYPE_SAFE_MESSAGING_PLAN.md](./TYPE_SAFE_MESSAGING_PLAN.md).

## Table of Contents

1. [Overview](#overview)
2. [Message Types](#message-types)
3. [API Reference](#api-reference)
4. [Port-Based Communication](#port-based-communication)
5. [MCP Messages](#mcp-messages)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)

---

## Overview

The type-safe messaging system provides:

- **Compile-time type checking** for all message payloads and responses
- **Autocomplete support** in your IDE
- **Refactoring safety** when changing message structures
- **Runtime validation** via Zod schemas (optional)

### Architecture

```
src/types/messaging/
├── index.ts      # Central message type registry
├── mcp.ts        # MCP-specific message types
└── ports.ts      # Port-based streaming types

src/lib/messaging/
├── index.ts      # Re-exports all messaging utilities
├── sender.ts     # Type-safe sendMessage functions
├── handler.ts    # Type-safe message handlers
├── mcp.ts        # MCP message helpers
├── port.ts       # Port connection utilities
└── validators.ts # Zod runtime validators
```

---

## Message Types

### Message Registry (`@/types/messaging`)

All extension messages are defined in the central `MessageRegistry` interface:

```typescript
import type { 
  MessageType,
  MessagePayload,
  MessageResponse,
  TypedMessage 
} from '@/types/messaging';
```

### Available Message Categories

| Category | Example Types | Description |
|----------|---------------|-------------|
| Tab Context | `GET_CURRENT_TAB_ID` | Tab identification |
| Memory | `CHECK_SUPERMEMORY_READY`, `QUEUE_MEMORY_EXTRACTION` | Supermemory integration |
| UI | `OPEN_SIDEBAR`, `MODEL_DOWNLOAD_PROGRESS` | UI interactions |
| AI | `ai/notification/create`, `summarize:request` | AI features |
| File | `READ_LOCAL_PDF` | File operations |
| Geolocation | `geolocation/request` | Location services |
| Offscreen | `offscreen/summarize/*` | Offscreen document APIs |

---

## API Reference

### `sendMessage<T>(type, payload?)`

Send a typed message to the background script.

```typescript
import { sendMessage } from '@/lib/messaging';

// Without payload
const response = await sendMessage('CHECK_SUPERMEMORY_READY');
// response: { ready: boolean }

// With payload
const response = await sendMessage('QUEUE_MEMORY_EXTRACTION', {
  threadId: '123',
  messageCount: 5
});
// response: { success: boolean; error?: string }
```

### `sendMessageToTab<T>(tabId, type, payload?)`

Send a typed message to a specific tab.

```typescript
import { sendMessageToTab } from '@/lib/messaging';

await sendMessageToTab(tabId, 'MODEL_DOWNLOAD_PROGRESS_UPDATE', {
  modelId: 'model-123',
  loaded: 50,
  total: 100,
  progress: 0.5
});
```

### `broadcastMessage<T>(type, payload?)`

Broadcast a message to all tabs.

```typescript
import { broadcastMessage } from '@/lib/messaging';

await broadcastMessage('MODEL_DOWNLOAD_PROGRESS_UPDATE', {
  modelId: 'model-123',
  loaded: 100,
  total: 100,
  progress: 1.0
});
```

### `createMessageRouter(handlers)`

Create a type-safe message router for the background script.

```typescript
import { createMessageRouter } from '@/lib/messaging';

const router = createMessageRouter({
  'CHECK_SUPERMEMORY_READY': async () => {
    const ready = await checkSupermemory();
    return { ready };
  },
  'QUEUE_MEMORY_EXTRACTION': async (payload) => {
    // payload is typed as { threadId: string; messageCount: number }
    await queueExtraction(payload.threadId, payload.messageCount);
    return { success: true };
  },
});

// Install the router
router.install();
```

### `onMessage<T>(type, handler)`

Add a listener for a specific message type.

```typescript
import { onMessage } from '@/lib/messaging';

const cleanup = onMessage('MODEL_DOWNLOAD_PROGRESS', (payload) => {
  console.log('Progress:', payload.progress);
});

// Later: cleanup();
```

---

## Port-Based Communication

For streaming operations (summarizer, writer, rewriter), use port-based communication.

### Port Names

```typescript
type PortName = 'text-summarizer' | 'write-command' | 'text-rewriter';
```

### Port Message Types

Each port has typed outgoing and incoming messages:

```typescript
import type {
  PortName,
  PortOutgoingMessages,
  PortIncomingMessages,
  SummarizerPortMessages,
  WriterPortMessages,
  RewriterPortMessages,
} from '@/types/messaging/ports';
```

### Summarizer Port

**Outgoing (content → background):**
- `SUMMARIZE_REQUEST`: `{ text, pageContext, settings? }`

**Incoming (background → content):**
- `SUMMARIZE_STREAM_CHUNK`: `{ text, done }`
- `SUMMARIZE_ERROR`: `{ error, code? }`

### Writer Port

**Outgoing:**
- `WRITE_GENERATE`: `{ prompt, pageContext?, settings?, attachment? }`

**Incoming:**
- `WRITE_STREAM_CHUNK`: `{ text, done }`
- `WRITE_ERROR`: `{ error, code? }`

### Rewriter Port

**Outgoing:**
- `REWRITE_REQUEST`: `{ selectedText, instruction, preset?, pageContext?, ... }`

**Incoming:**
- `REWRITE_COMPLETE`: `{ text }`
- `REWRITE_ERROR`: `{ error, code? }`

### Type Guards

```typescript
import { 
  isPortName, 
  isPortMessage, 
  isOutgoingAction, 
  isIncomingAction 
} from '@/types/messaging/ports';

// Check if value is a valid port name
if (isPortName(name)) { ... }

// Check if message has valid action property
if (isPortMessage(message)) { ... }

// Type-safe action checking
if (isOutgoingAction('text-summarizer', message, 'SUMMARIZE_REQUEST')) {
  // message is typed as SUMMARIZE_REQUEST payload
}
```

---

## MCP Messages

### Static MCP Messages

Messages without a server ID:

```typescript
import { sendMcpStaticMessage } from '@/lib/messaging';

// List all tools
const response = await sendMcpStaticMessage('mcp/tools/list');

// Reload custom servers
await sendMcpStaticMessage('mcp/custom-servers/reload');
```

### Dynamic MCP Messages

Messages with a server ID pattern: `mcp/${serverId}/${action}`

```typescript
import { sendMcpMessage } from '@/lib/messaging';

// Enable a server
await sendMcpMessage('notion', 'enable');

// Call a tool
const response = await sendMcpMessage('notion', 'tool/call', {
  name: 'search',
  arguments: { query: 'test' }
});
```

### MCP Server Actions

Available actions for `sendMcpMessage`:

| Action | Payload | Description |
|--------|---------|-------------|
| `enable` | - | Enable server |
| `disable` | - | Disable server |
| `disconnect` | - | Disconnect server |
| `auth/start` | - | Start OAuth flow |
| `auth/complete` | `{ code }` | Complete OAuth |
| `auth/refresh` | - | Refresh token |
| `status/get` | - | Get server status |
| `tool/call` | `{ name, arguments? }` | Call a tool |
| `tools/list` | - | List server tools |
| `tools/config/get` | - | Get tool config |
| `tools/config/set` | `{ disabledTools }` | Set tool config |
| `resource/read` | `{ uri }` | Read a resource |

---

## Usage Examples

### Background Script Handler

```typescript
// background/messaging/router.ts
import { createMessageRouter } from '@/lib/messaging';

export const mainRouter = createMessageRouter({
  'GET_CURRENT_TAB_ID': async (_, sender) => {
    return { tabId: sender.tab?.id };
  },

  'CHECK_SUPERMEMORY_READY': async () => {
    const ready = await supermemoryStore.getState().checkReady();
    return { ready };
  },

  'OPEN_SIDEBAR': async () => {
    try {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// Install in background.ts
mainRouter.install();
```

### Content Script Sender

```typescript
// In a content script or UI component
import { sendMessage } from '@/lib/messaging';

async function checkSupermemoryStatus() {
  const { ready } = await sendMessage('CHECK_SUPERMEMORY_READY');
  
  if (ready) {
    const { success, error } = await sendMessage('QUEUE_MEMORY_EXTRACTION', {
      threadId: currentThreadId,
      messageCount: messages.length
    });
    
    if (!success) {
      console.error('Extraction failed:', error);
    }
  }
}
```

### Port-Based Streaming

```typescript
// Connecting to the summarizer port
const port = chrome.runtime.connect({ name: 'text-summarizer' });

port.postMessage({
  action: 'SUMMARIZE_REQUEST',
  text: longText,
  pageContext: { url: window.location.href, title: document.title },
  settings: { summaryType: 'keyPoints', summaryLength: 'medium' }
});

port.onMessage.addListener((message) => {
  if (isIncomingAction('text-summarizer', message, 'SUMMARIZE_STREAM_CHUNK')) {
    appendToOutput(message.text);
    if (message.done) {
      port.disconnect();
    }
  } else if (isIncomingAction('text-summarizer', message, 'SUMMARIZE_ERROR')) {
    showError(message.error);
    port.disconnect();
  }
});
```

---

## Best Practices

### 1. Always Use the Type-Safe API

**Do:**
```typescript
import { sendMessage } from '@/lib/messaging';
const response = await sendMessage('CHECK_SUPERMEMORY_READY');
```

**Don't:**
```typescript
// Avoid direct chrome API calls
const response = await chrome.runtime.sendMessage({ type: 'CHECK_SUPERMEMORY_READY' });
```

### 2. Handle Errors Properly

```typescript
try {
  const response = await sendMessage('QUEUE_MEMORY_EXTRACTION', payload);
  if (!response.success) {
    console.error('Operation failed:', response.error);
  }
} catch (error) {
  // Handle connection errors (e.g., no listener)
  console.error('Message failed:', error);
}
```

### 3. Use Type Guards for Runtime Safety

```typescript
import { isMessageType } from '@/types/messaging';

chrome.runtime.onMessage.addListener((message) => {
  if (isMessageType(message, 'MODEL_DOWNLOAD_PROGRESS')) {
    // message.payload is typed correctly
    updateProgress(message.payload);
  }
});
```

### 4. Keep Message Types in Sync

When adding new message types:

1. Add the type definition to `@/types/messaging/index.ts`
2. Add handler in the appropriate router
3. Use `sendMessage` at call sites

### 5. Use Zod Validators for External Data

```typescript
import { validateMessage } from '@/lib/messaging/validators';

// For messages from untrusted sources
const validated = validateMessage('QUEUE_MEMORY_EXTRACTION', rawMessage);
if (validated.success) {
  // validated.data is type-safe
}
```

---

## Related Documentation

- [TYPE_SAFE_MESSAGING_PLAN.md](./TYPE_SAFE_MESSAGING_PLAN.md) - Implementation plan and architecture decisions
- [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) - Overall extension architecture
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - Code style guidelines
