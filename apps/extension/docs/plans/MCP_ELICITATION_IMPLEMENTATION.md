# MCP Elicitation Implementation Plan

> **Feature**: Server-Initiated User Input (Elicitation)  
> **AI SDK Version**: 6.0+  
> **Created**: December 23, 2024  
> **Status**: Planning

## Overview

MCP Elicitation allows MCP servers to request user input mid-operation. Instead of the traditional request-response pattern where the client initiates all communication, elicitation enables the server to pause execution and ask the user for additional information (confirmation, choices, context) before continuing.

### Use Cases

1. **Confirmation dialogs**: "Found 47 files to delete. Proceed?"
2. **Choice selection**: "Multiple calendars found. Which one: Work, Personal, or Shared?"
3. **Additional context**: "Please provide the email subject for this draft."
4. **Authentication prompts**: "Enter 2FA code to continue."

---

## Current Architecture Analysis

### What We Have

| Component | File | Purpose |
|-----------|------|---------|
| `McpSSEClient` | `src/mcp/client/McpSSEClient.ts` | SSE/HTTP+SSE connection to MCP servers |
| `mcpStore` | `src/stores/mcp/mcpStore.ts` | Zustand store for MCP server state |
| `mcpHandler` | `src/background/messaging/mcpHandler.ts` | Background message handler |
| MCP Types | `src/mcp/types.ts` | TypeScript definitions |
| Capabilities | `initialize()` in McpSSEClient | Declares client capabilities |

### Current Capabilities Declaration

```typescript
// In McpSSEClient.initialize()
capabilities: {
    experimental: {},
    roots: { listChanged: true },
    sampling: {},
}
```

**Missing**: `elicitation: {}` capability.

---

## Implementation Phases

### Phase 1: Type Definitions & Protocol Support

**Goal**: Add TypeScript types and extend the MCP protocol to support elicitation messages.

#### Tasks

1. **Add Elicitation Types** (`src/mcp/types.ts`)

```typescript
/**
 * MCP Elicitation Request Schema
 * Server-initiated request for user input
 */
export interface McpElicitationRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'elicitation/request';
    params: {
        /** Human-readable message to display */
        message: string;
        /** JSON Schema describing expected input */
        requestedSchema?: {
            type: 'object' | 'string' | 'boolean' | 'number' | 'array';
            properties?: Record<string, any>;
            required?: string[];
            enum?: any[];
            description?: string;
        };
        /** Optional timeout in milliseconds */
        timeout?: number;
        /** UI hint for how to render */
        uiHint?: 'confirmation' | 'choice' | 'input' | 'form';
    };
}

/**
 * MCP Elicitation Response
 * Client response to server elicitation request
 */
export interface McpElicitationResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        /** User's action */
        action: 'accept' | 'reject' | 'cancel';
        /** User-provided content (when action is 'accept') */
        content?: any;
    };
}

/**
 * Pending elicitation in the store
 */
export interface PendingElicitation {
    id: string | number;
    serverId: string;
    message: string;
    requestedSchema?: McpElicitationRequest['params']['requestedSchema'];
    uiHint?: McpElicitationRequest['params']['uiHint'];
    timeout?: number;
    createdAt: number;
}
```

2. **Add Connection State** (`src/mcp/types.ts`)

```typescript
export type McpConnectionState =
    | 'disconnected'
    | 'needs-auth'
    // ... existing states ...
    | 'awaiting-elicitation';  // NEW: Waiting for user input
```

#### Deliverables
- [ ] `McpElicitationRequest` interface
- [ ] `McpElicitationResponse` interface  
- [ ] `PendingElicitation` interface
- [ ] Extended message type: `mcp/${string}/elicitation/respond`

---

### Phase 2: Client Protocol Handler

**Goal**: Extend `McpSSEClient` to handle elicitation requests from the server.

#### Tasks

1. **Declare Elicitation Capability**

```typescript
// In McpSSEClient.initialize()
capabilities: {
    experimental: {},
    roots: { listChanged: true },
    sampling: {},
    elicitation: {},  // NEW
}
```

2. **Add Elicitation Handler in MessageHandler**

```typescript
// src/mcp/client/messageHandler.ts

export class MessageHandler {
    private elicitationCallback?: (request: McpElicitationRequest) => Promise<McpElicitationResponse>;
    
    setElicitationHandler(callback: typeof this.elicitationCallback) {
        this.elicitationCallback = callback;
    }
    
    async handleMessage(message: McpMessage): Promise<void> {
        // Existing message handling...
        
        // NEW: Handle elicitation requests
        if (message.method === 'elicitation/request' && message.id) {
            if (this.elicitationCallback) {
                const response = await this.elicitationCallback(message as McpElicitationRequest);
                await this.sendElicitationResponse(response);
            } else {
                // No handler registered - auto-reject
                await this.sendElicitationResponse({
                    jsonrpc: '2.0',
                    id: message.id,
                    result: { action: 'reject' }
                });
            }
        }
    }
}
```

3. **Add Response Method to McpSSEClient**

```typescript
// In McpSSEClient

async respondToElicitation(
    requestId: string | number,
    action: 'accept' | 'reject' | 'cancel',
    content?: any
): Promise<void> {
    await this.sendRequest('elicitation/response', {
        id: requestId,
        action,
        content
    });
}

onElicitationRequest(
    callback: (request: McpElicitationRequest) => Promise<McpElicitationResponse>
): void {
    this.messageHandler.setElicitationHandler(callback);
}
```

#### Deliverables
- [ ] `elicitation: {}` in capabilities
- [ ] `handleElicitationRequest()` in MessageHandler
- [ ] `respondToElicitation()` method in McpSSEClient
- [ ] `onElicitationRequest()` callback registration

---

### Phase 3: State Management

**Goal**: Add Zustand store support for managing pending elicitations across the extension.

#### Tasks

1. **Extend MCP Store Types** (`src/stores/mcp/types.ts`)

```typescript
import type { PendingElicitation } from '@/mcp/types';

export interface McpState {
    // ... existing state ...
    
    /** Pending elicitation requests from MCP servers */
    pendingElicitations: PendingElicitation[];
    
    /** Add a pending elicitation */
    addElicitation: (elicitation: PendingElicitation) => void;
    
    /** Remove an elicitation (after response) */
    removeElicitation: (id: string | number) => void;
    
    /** Respond to an elicitation */
    respondToElicitation: (
        id: string | number,
        action: 'accept' | 'reject' | 'cancel',
        content?: any
    ) => Promise<void>;
}
```

2. **Implement Store Actions** (`src/stores/mcp/mcpStore.ts`)

```typescript
pendingElicitations: [],

addElicitation: (elicitation) => set((state) => {
    state.pendingElicitations.push(elicitation);
}),

removeElicitation: (id) => set((state) => {
    state.pendingElicitations = state.pendingElicitations.filter(e => e.id !== id);
}),

respondToElicitation: async (id, action, content) => {
    const state = get();
    const elicitation = state.pendingElicitations.find(e => e.id === id);
    if (!elicitation) return;
    
    await sendMcpMessage({
        type: `mcp/${elicitation.serverId}/elicitation/respond`,
        payload: { id, action, content }
    });
    
    get().removeElicitation(id);
}
```

3. **Add Background Handler** (`src/background/messaging/mcpHandler.ts`)

```typescript
case 'elicitation/respond':
    const client = getServerClient(serverId);
    if (client) {
        await client.respondToElicitation(
            message.payload?.id,
            message.payload?.action,
            message.payload?.content
        );
        response = { success: true };
    } else {
        response = { success: false, error: 'Server not connected' };
    }
    break;
```

#### Deliverables
- [ ] `pendingElicitations` state array
- [ ] `addElicitation()` action
- [ ] `removeElicitation()` action
- [ ] `respondToElicitation()` async action
- [ ] Background handler for `elicitation/respond`

---

### Phase 4: UI Components

**Goal**: Build React components to display elicitation prompts to users.

#### File Structure

```
src/components/features/mcp/elicitation/
├── ElicitationModal.tsx       # Main modal component
├── ElicitationPrompt.tsx      # Prompt display with schema
├── ElicitationForm.tsx        # Dynamic form based on schema
├── ElicitationConfirmation.tsx # Simple yes/no confirmation
├── ElicitationChoice.tsx      # Multiple choice selector
├── hooks/
│   └── useElicitation.ts      # Hook for elicitation state
└── index.ts
```

#### 1. Elicitation Hook

```typescript
// src/components/features/mcp/elicitation/hooks/useElicitation.ts

import { useMcpStore } from '@/stores';
import type { PendingElicitation } from '@/mcp/types';

export function useElicitation() {
    const pendingElicitations = useMcpStore(s => s.pendingElicitations);
    const respondToElicitation = useMcpStore(s => s.respondToElicitation);
    
    const currentElicitation = pendingElicitations[0] ?? null;
    const hasElicitations = pendingElicitations.length > 0;
    
    const accept = async (content?: any) => {
        if (currentElicitation) {
            await respondToElicitation(currentElicitation.id, 'accept', content);
        }
    };
    
    const reject = async () => {
        if (currentElicitation) {
            await respondToElicitation(currentElicitation.id, 'reject');
        }
    };
    
    const cancel = async () => {
        if (currentElicitation) {
            await respondToElicitation(currentElicitation.id, 'cancel');
        }
    };
    
    return {
        currentElicitation,
        hasElicitations,
        pendingCount: pendingElicitations.length,
        accept,
        reject,
        cancel
    };
}
```

#### 2. Elicitation Modal

```tsx
// src/components/features/mcp/elicitation/ElicitationModal.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/primitives/dialog';
import { Button } from '@/components/ui/primitives/button';
import { useElicitation } from './hooks/useElicitation';
import { ElicitationForm } from './ElicitationForm';

export function ElicitationModal() {
    const { currentElicitation, hasElicitations, accept, reject, cancel } = useElicitation();
    
    if (!hasElicitations || !currentElicitation) return null;
    
    const { message, requestedSchema, uiHint } = currentElicitation;
    
    // Simple confirmation
    if (uiHint === 'confirmation' || !requestedSchema) {
        return (
            <Dialog open onOpenChange={() => cancel()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Action Required</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">{message}</p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => reject()}>
                            No
                        </Button>
                        <Button onClick={() => accept(true)}>
                            Yes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }
    
    // Form-based input
    return (
        <Dialog open onOpenChange={() => cancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Input Required</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mb-4">{message}</p>
                <ElicitationForm
                    schema={requestedSchema}
                    onSubmit={accept}
                    onCancel={cancel}
                />
            </DialogContent>
        </Dialog>
    );
}
```

#### 3. Integration Point

```tsx
// In src/entrypoints/sidepanel/App.tsx or main layout

import { ElicitationModal } from '@/components/features/mcp/elicitation';

function App() {
    return (
        <>
            {/* Existing app content */}
            <ElicitationModal />
        </>
    );
}
```

#### Deliverables
- [ ] `useElicitation` hook
- [ ] `ElicitationModal` component
- [ ] `ElicitationForm` component (dynamic form from JSON Schema)
- [ ] `ElicitationConfirmation` component
- [ ] `ElicitationChoice` component
- [ ] Integration in main app layout

---

### Phase 5: Background Event Flow

**Goal**: Wire up the complete event flow from MCP server → background → store → UI → response.

#### Event Flow Diagram

```
┌─────────────────┐
│   MCP Server    │
│  (e.g., Notion) │
└────────┬────────┘
         │ SSE: elicitation/request
         ▼
┌─────────────────┐
│   Background    │
│ Service Worker  │
│ (McpSSEClient)  │
└────────┬────────┘
         │ chrome.runtime.sendMessage
         ▼
┌─────────────────┐
│    mcpStore     │
│ (addElicitation)│
└────────┬────────┘
         │ Zustand reactive update
         ▼
┌─────────────────┐
│ ElicitationModal│
│  (React UI)     │
└────────┬────────┘
         │ User interaction
         ▼
┌─────────────────┐
│    mcpStore     │
│ (respondTo...)  │
└────────┬────────┘
         │ chrome.runtime.sendMessage
         ▼
┌─────────────────┐
│   Background    │
│ (respondTo...)  │
└────────┬────────┘
         │ HTTP POST response
         ▼
┌─────────────────┐
│   MCP Server    │
│ (continues...)  │
└─────────────────┘
```

#### Implementation

1. **Background → UI Messaging**

```typescript
// In McpSSEClient message handler
this.onElicitationRequest(async (request) => {
    // Notify the UI via Chrome messaging
    chrome.runtime.sendMessage({
        type: 'mcp/elicitation/incoming',
        payload: {
            id: request.id,
            serverId: this.serverId,
            message: request.params.message,
            requestedSchema: request.params.requestedSchema,
            uiHint: request.params.uiHint,
            timeout: request.params.timeout,
            createdAt: Date.now()
        }
    });
    
    // Return a promise that resolves when user responds
    return new Promise((resolve) => {
        this.pendingElicitationResolvers.set(request.id, resolve);
    });
});
```

2. **UI Listener in Store**

```typescript
// In mcpStore.initialize()
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'mcp/elicitation/incoming') {
        get().addElicitation(message.payload);
    }
});
```

3. **Response Flow Completion**

```typescript
// In background handler for elicitation/respond
case 'elicitation/respond':
    const resolver = client.pendingElicitationResolvers.get(message.payload.id);
    if (resolver) {
        resolver({
            jsonrpc: '2.0',
            id: message.payload.id,
            result: {
                action: message.payload.action,
                content: message.payload.content
            }
        });
        client.pendingElicitationResolvers.delete(message.payload.id);
    }
    response = { success: true };
    break;
```

#### Deliverables
- [ ] `elicitation/incoming` message type
- [ ] Promise-based elicitation resolver pattern
- [ ] Store listener for incoming elicitations
- [ ] Complete request-response cycle

---

### Phase 6: Timeout & Error Handling

**Goal**: Handle edge cases like timeouts, disconnections, and malformed requests.

#### Tasks

1. **Timeout Handling**

```typescript
// In addElicitation store action
addElicitation: (elicitation) => set((state) => {
    state.pendingElicitations.push(elicitation);
    
    // Set up auto-timeout
    if (elicitation.timeout) {
        setTimeout(() => {
            const current = get().pendingElicitations.find(e => e.id === elicitation.id);
            if (current) {
                get().respondToElicitation(elicitation.id, 'cancel');
            }
        }, elicitation.timeout);
    }
}),
```

2. **Disconnection Cleanup**

```typescript
// When server disconnects
disableServer: (serverId) => set((state) => {
    // ... existing logic ...
    
    // Clean up pending elicitations for this server
    state.pendingElicitations = state.pendingElicitations.filter(
        e => e.serverId !== serverId
    );
}),
```

3. **Schema Validation**

```typescript
// Before rendering form
function validateElicitationSchema(schema: any): boolean {
    if (!schema || typeof schema !== 'object') return false;
    if (!['object', 'string', 'boolean', 'number', 'array'].includes(schema.type)) return false;
    return true;
}
```

#### Deliverables
- [ ] Auto-timeout with configurable duration
- [ ] Cleanup on server disconnect
- [ ] Schema validation before rendering
- [ ] Error toast notifications

---

## Testing Plan

### Unit Tests

1. **Type Guards**
   - `isElicitationRequest(message)`
   - `isValidElicitationSchema(schema)`

2. **Store Actions**
   - `addElicitation` adds to array
   - `removeElicitation` removes by ID
   - `respondToElicitation` sends message and removes

3. **Message Handler**
   - Parses elicitation/request correctly
   - Calls callback with proper params
   - Auto-rejects when no handler

### Integration Tests

1. **End-to-End Flow**
   - Mock MCP server sends elicitation
   - Modal appears in UI
   - User responds
   - Response reaches server

2. **Timeout Behavior**
   - Elicitation with timeout auto-cancels
   - UI updates accordingly

### Manual Testing

1. Connect to a test MCP server that supports elicitation
2. Trigger an action that causes an elicitation request
3. Verify modal appears with correct message
4. Test accept, reject, and cancel flows
5. Verify server receives correct response

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| No MCP servers currently support elicitation | Build with mock server for testing; feature is future-proof |
| Complex schema rendering | Start with simple types (confirmation, choice); add form builder later |
| Multiple simultaneous elicitations | Queue pattern - show one at a time, FIFO |
| User leaves sidepanel during elicitation | Auto-reject with timeout; show badge indicator |

---

## Success Metrics

1. **Functionality**: Elicitation requests displayed within 100ms of receipt
2. **Reliability**: 100% of responses reach the MCP server
3. **UX**: Clear, non-blocking UI that doesn't interrupt chat flow
4. **Compatibility**: Works with any MCP server implementing elicitation

---

## Future Enhancements

1. **Inline Chat Elicitation**: Show elicitation in chat thread instead of modal
2. **Multi-Server Queue**: Visual indicator of pending elicitations per server
3. **Elicitation History**: Log of past elicitations for debugging
4. **Custom UI Components**: Server-specific elicitation renderers

---

## References

- [AI SDK 6.0 MCP Elicitation](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Current MCP Implementation](./apps/extension/src/mcp/)
