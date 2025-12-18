# Phase 1: Simple Chat via Backend

## Overview

This phase implements basic text chat functionality through our Vercel backend. Users can toggle between BYOK mode (current behavior) and Backend mode (new) directly from the composer toolbar.

**Goal:** Allow users to chat with AI without providing their own API key.

**Scope:**
- ✅ Text chat via backend
- ✅ Mode toggle in composer toolbar
- ✅ Backend endpoint with our API key
- ✅ Basic rate limiting
- ✅ **Existing backend tools work:** `webSearch`, `deepResearch`, `retrieve` (already call Vercel backend)
- ❌ Browser/frontend tools like `readPageContent`, `getActiveTab`, MCP tools (Phase 2)
- ❌ Streaming optimizations (Phase 3)

## Prerequisites

- Vercel backend running (`packages/backend-vercel`)
- Google AI API key configured in Vercel environment
- Extension development environment set up

## Implementation Steps

### Step 1: Backend Endpoint

**File:** `packages/backend-vercel/src/routes/ai.ts`

> [!NOTE]
> The backend has been converted to TypeScript. The AI chat endpoint is now part of the modular route structure at `src/routes/ai.ts`.

The endpoint:
- Uses our server-side Google API key
- Streams responses back to the client  
- Implements basic rate limiting

```typescript
import { Router, Request, Response } from 'express';
import { config } from '../config/config';
import { getAIModules } from '../services/ai';
import { checkAIChatRateLimit, AI_RATE_LIMIT_WINDOW } from '../middleware/rateLimit';
import { getClientIp } from '../middleware/logging';
import type { AIChatRequestBody, AIChatErrorResponse } from '../types';

const router = Router();

/**
 * POST /api/ai/chat
 * 
 * Simple chat endpoint using server-side API key.
 * Streams responses back compatible with AI SDK.
 */
router.post('/chat', async (req: Request<object, unknown, AIChatRequestBody>, res: Response) => {
  const ip = getClientIp(req);
  if (!checkAIChatRateLimit(ip)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a moment and try again.',
      retryAfter: AI_RATE_LIMIT_WINDOW / 1000,
    });
  }

  try {
    const { messages, system, model: modelName = 'gemini-2.0-flash' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'messages array is required',
      });
    }

    if (!config.googleAiApiKey) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'AI service not properly configured',
      });
    }

    const { createGoogleGenerativeAI, streamText } = await getAIModules();
    const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
    const model = google(modelName);

    const result = streamText({
      model,
      messages,
      system: system || 'You are Cognito, a helpful AI assistant.',
      maxTokens: 4096,
    });

    return result.pipeDataStreamToResponse(res);
  } catch (error) {
    // Error handling...
  }
});

export default router;
```

**Environment Variables (Vercel):**
```bash
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

---

### Step 2: Extension Settings Store

**File:** `apps/extension/src/stores/settingsStore.ts`

Add backend mode setting to the existing settings store.

```typescript
// Add to existing SettingsState interface
interface SettingsState {
  // ... existing fields ...
  
  // Backend mode settings
  useBackendMode: boolean;
  setUseBackendMode: (value: boolean) => void;
}

// Add to initial state
const initialState: SettingsState = {
  // ... existing fields ...
  useBackendMode: false, // Default to BYOK mode
};

// Add setter in store creation
setUseBackendMode: (value: boolean) => {
  set({ useBackendMode: value });
  // Persist to chrome.storage.sync
  chrome.storage.sync.set({ useBackendMode: value });
},
```

---

### Step 3: Backend Chat Implementation

**File:** `apps/extension/src/ai/backend/backendChat.ts` (NEW)

```typescript
/**
 * Backend Chat Implementation
 * 
 * Handles AI chat through our Vercel backend instead of direct API calls.
 * Used when backend mode is enabled and user doesn't have their own API key.
 */

import { createUIMessageStream, generateId, type UIMessage } from 'ai';
import { createLogger } from '~logger';

const log = createLogger('BackendChat', 'AI_CHAT');

// Backend API URL - use environment variable or default to production
const BACKEND_URL = import.meta.env.WXT_BACKEND_API_URL || 'https://cognito-ai-api.vercel.app';

export interface BackendChatParams {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  onError?: (error: Error) => void;
  onFinishCallback?: () => void;
}

/**
 * Stream AI response through our backend
 * Returns a UIMessageStream compatible with the existing chat UI
 */
export async function streamBackendChat(params: BackendChatParams) {
  const { messages, abortSignal, onError, onFinishCallback } = params;

  log.info('Starting backend chat stream', { messageCount: messages.length });

  try {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          // Send initial processing status
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'processing', timestamp: Date.now() },
            transient: true,
          });

          // Convert UIMessages to simple format for backend
          const simpleMessages = messages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' 
              ? msg.content 
              : msg.content.map(part => 
                  part.type === 'text' ? part.text : ''
                ).join('')
          }));

          // Make request to backend
          const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: simpleMessages,
            }),
            signal: abortSignal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Backend error: ${response.status}`);
          }

          if (!response.body) {
            throw new Error('No response body from backend');
          }

          // Stream the response
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            // Parse SSE format from AI SDK
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('0:')) {
                // Text delta from AI SDK stream
                const text = JSON.parse(line.slice(2));
                writer.write({
                  type: 'text-delta',
                  id: 'text-' + generateId(),
                  delta: text,
                });
              }
              // Handle other AI SDK stream parts as needed
            }
          }

          // Send completion status
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'completed', timestamp: Date.now() },
            transient: true,
          });

          // Call finish callback
          onFinishCallback?.();

        } catch (error) {
          log.error('Backend chat error:', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Write error to stream
          writer.write({
            type: 'text-delta',
            id: 'error-' + generateId(),
            delta: `\n\n❌ **Error:** ${errorMessage}\n\nPlease try again or switch to BYOK mode with your own API key.`,
          });

          // Send error status
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'error', timestamp: Date.now() },
            transient: false,
          });

          onError?.(error instanceof Error ? error : new Error(errorMessage));
        }
      },
    });

    return stream;

  } catch (error) {
    log.error('Failed to create backend stream:', error);
    onError?.(error instanceof Error ? error : new Error('Failed to start backend chat'));
    throw error;
  }
}
```

**File:** `apps/extension/src/ai/backend/index.ts` (NEW)

```typescript
export { streamBackendChat, type BackendChatParams } from './backendChat';
```

---

### Step 4: Integrate with AI Logic

**File:** `apps/extension/src/ai/core/aiLogic.ts`

Add branching logic at the start of `streamAIResponse` to check for backend mode.

```typescript
import { streamBackendChat } from '../backend';
import { useSettingsStore } from '@/stores';

// At the start of streamAIResponse function:
export async function streamAIResponse(params: { ... }) {
  const { messages, abortSignal, initialPageContext, onError, onUsageUpdate, workflowId, threadId, onFinishCallback } = params;

  log.info('Starting AI stream', { messageCount: messages.length, workflowId: workflowId || 'none' });

  // Check if backend mode is enabled
  const useBackendMode = useSettingsStore.getState().useBackendMode;
  
  if (useBackendMode) {
    log.info('🌐 Using BACKEND MODE - routing to Vercel backend');
    return streamBackendChat({
      messages,
      abortSignal,
      onError,
      onFinishCallback,
    });
  }

  // ... rest of existing BYOK implementation continues unchanged ...
}
```

---

### Step 5: Mode Toggle UI

**File:** `apps/extension/src/components/features/chat/components/composer/sections/ComposerToolbar.tsx`

Add the mode toggle button next to the model selector.

```tsx
import { Cloud, Key } from 'lucide-react';
import { useSettingsStore, type SettingsState } from '@/stores';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Inside ComposerToolbar component:
const useBackendMode = useSettingsStore((s: SettingsState) => s.useBackendMode);
const setUseBackendMode = useSettingsStore((s: SettingsState) => s.setUseBackendMode);

// Add this button group after the model selector:
<div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-2">
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={() => setUseBackendMode(!useBackendMode)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
          useBackendMode
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "bg-muted/50 text-muted-foreground hover:bg-muted"
        )}
      >
        {useBackendMode ? (
          <>
            <Cloud className="h-3.5 w-3.5" />
            <span>Backend</span>
          </>
        ) : (
          <>
            <Key className="h-3.5 w-3.5" />
            <span>BYOK</span>
          </>
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="top">
      <p className="text-xs">
        {useBackendMode 
          ? "Using Cognito's API (rate limited, no API key needed)"
          : "Using your API key (unlimited, key stays on device)"
        }
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Click to switch modes
      </p>
    </TooltipContent>
  </Tooltip>
</div>
```

---

### Step 6: Environment Configuration

**File:** `apps/extension/.env.example`

Add backend URL configuration:

```bash
# Backend API URL for backend mode
# Default: production Vercel deployment
WXT_BACKEND_API_URL=https://cognito-ai-api.vercel.app
```

---

## Testing Checklist

### Backend Testing
- [ ] Backend endpoint responds to POST requests
- [ ] Streaming works correctly (text arrives progressively)
- [ ] Rate limiting kicks in after 20 requests/minute
- [ ] Error responses are properly formatted
- [ ] CORS headers allow extension requests

### Extension Testing
- [ ] Mode toggle appears in composer toolbar
- [ ] Toggle switches between BYOK and Backend mode
- [ ] Setting persists across browser sessions
- [ ] Backend mode sends requests to correct endpoint
- [ ] Responses stream properly in chat UI
- [ ] Errors display friendly messages
- [ ] Abort (stop generation) works in backend mode

### Integration Testing
- [ ] Can have full conversations in backend mode
- [ ] Messages maintain proper order
- [ ] Can switch modes mid-conversation
- [ ] BYOK mode still works exactly as before

---

## Success Criteria

Phase 1 is complete when:

1. **UI Toggle Works:** User can toggle between BYOK and Backend mode from the composer toolbar
2. **Chat Functions:** User can send messages and receive streaming responses in backend mode
3. **No Tools (Expected):** Tool calls are not available in backend mode (Phase 2 scope)
4. **Rate Limiting:** Backend enforces rate limits and returns clear error messages
5. **BYOK Unchanged:** Existing BYOK functionality works exactly as before
6. **Error Handling:** Network errors, rate limits, and API errors show user-friendly messages

---

## Known Limitations (Phase 1)

1. **No Browser/Frontend Tools:** Tools requiring browser context (readPageContent, getActiveTab, MCP tools, etc.) are not available in backend mode. Users needing these must use BYOK mode. Backend tools (`webSearch`, `deepResearch`, `retrieve`) work normally.
2. **No Page Context:** Initial page context is not sent in backend mode.
3. **No Workflows:** Workflow mode only works with BYOK.
4. **Basic Rate Limiting:** In-memory rate limiting resets on server restart.

These limitations will be addressed in subsequent phases.

---

## Next Steps

Once Phase 1 is complete and tested, proceed to:
→ [PHASE-2-FRONTEND-TOOLS.md](./PHASE-2-FRONTEND-TOOLS.md)
