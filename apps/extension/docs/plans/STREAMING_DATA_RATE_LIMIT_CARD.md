# Streaming Data: Rate Limit Card Implementation Plan

**Goal:** Display a prominent, interactive rate limit card directly in the chat interface when backend rate limits are exceeded. The card should:
- Appear as part of the message stream (not a toast or overlay)
- Show retry countdown timer
- Offer a "Switch to BYOK Mode" button if the user has an API key configured
- Persist in chat history for context

**Status:** Planning
**Created:** 2025-12-18
**Related:** [MESSAGE_METADATA_IMPLEMENTATION.md](./MESSAGE_METADATA_IMPLEMENTATION.md)

---

## Overview

The AI SDK provides two mechanisms for streaming custom data:
1. **Data Parts (Persistent)** - Added to `message.parts` array, persist in history
2. **Transient Data Parts (Ephemeral)** - Only accessible via `onData` callback, not persisted

For rate limit cards, we'll use **Persistent Data Parts** so users can see the rate limit event in their conversation history.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Rate Limit Card Streaming Flow                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Backend Rate Limit Check                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ backend-vercel/routes/ai.ts                                          │     │
│  │   └─> checkRateLimitWithRedis(ip)                                    │     │
│  │         └─> if (!allowed): createUIMessageStream()                   │     │
│  │               └─> writer.write({                                     │     │
│  │                     type: 'data-rate-limit',                         │     │
│  │                     id: 'rate-limit-{timestamp}',                    │     │
│  │                     data: { retryAfter, dailyUsage, quotaType, ... } │     │
│  │                   })                                                 │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                               │                                               │
│                               ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ Extension Frontend                                                   │     │
│  │   └─> useChat({ onData: handleDataPart })                           │     │
│  │         └─> message.parts includes { type: 'data-rate-limit', ... } │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                               │                                               │
│                               ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ ChatMessages.tsx                                                     │     │
│  │   └─> Render message.parts                                          │     │
│  │         └─> if part.type === 'data-rate-limit':                     │     │
│  │               └─> <RateLimitCard data={part.data} />                │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Part Schema

### Rate Limit Data Part Type

```typescript
// apps/extension/src/ai/types/dataParts.ts (NEW FILE)

/**
 * Rate limit data part payload
 * Sent by backend when rate/quota limits are exceeded
 */
export interface RateLimitDataPart {
  type: 'data-rate-limit';
  id: string; // Unique ID for reconciliation (e.g., 'rate-limit-1703001234567')
  data: {
    /** Type of limit exceeded */
    quotaType: 'per-minute' | 'daily' | 'monthly';
    
    /** Seconds until rate limit resets (for per-minute) */
    retryAfter?: number;
    
    /** Current usage counts */
    usage?: {
      current: number;
      limit: number;
    };
    
    /** Human-readable message */
    message: string;
    
    /** Whether user has API key configured (for BYOK fallback) */
    hasApiKey?: boolean;
    
    /** Timestamp when limit was hit */
    timestamp: number;
  };
}

/**
 * Union type for all custom data parts
 * Extend this as more data part types are added
 */
export type CustomDataPart = RateLimitDataPart; // | OtherDataPart in future
```

---

## Implementation Steps

### Phase 1: Define Data Part Types

**Files to create/modify:**
- `apps/extension/src/ai/types/dataParts.ts` (NEW)
- `apps/extension/src/ai/types/index.ts` (MODIFY - add export)

#### Step 1.1: Create Data Parts Type File

```typescript
// apps/extension/src/ai/types/dataParts.ts

/**
 * Custom Data Parts for AI SDK Streaming
 * 
 * These types define the structure of custom data that can be
 * streamed alongside AI responses. Data parts are added to
 * message.parts and can be rendered as UI components.
 */

/**
 * Rate limit data part payload
 */
export interface RateLimitData {
  /** Type of limit exceeded */
  quotaType: 'per-minute' | 'daily' | 'monthly';
  
  /** Seconds until rate limit resets */
  retryAfter?: number;
  
  /** Current usage counts */
  usage?: {
    current: number;
    limit: number;
  };
  
  /** Human-readable message */
  message: string;
  
  /** Whether user has API key for BYOK fallback */
  hasApiKey?: boolean;
  
  /** Timestamp when limit was hit */
  timestamp: number;
}

/**
 * Type guard for rate limit data part
 */
export function isRateLimitDataPart(part: unknown): part is { type: 'data-rate-limit'; data: RateLimitData } {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    (part as { type: string }).type === 'data-rate-limit'
  );
}
```

#### Step 1.2: Export from Types Index

```typescript
// apps/extension/src/ai/types/index.ts
// Add to existing exports:

export type { RateLimitData } from './dataParts';
export { isRateLimitDataPart } from './dataParts';
```

---

### Phase 2: Backend Implementation

**Files to modify:**
- `packages/backend-vercel/src/routes/ai.ts`

#### Step 2.1: Import Required Functions

Add imports at the top of `ai.ts`:

```typescript
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  convertToModelMessages,
} from 'ai';
```

#### Step 2.2: Create Rate Limit Stream Helper

Add a helper function to create a rate limit response stream:

```typescript
// Add after existing imports, before route definitions

/**
 * Create a stream that sends a rate limit data part
 * This allows rate limit errors to appear as chat UI cards
 */
function createRateLimitStream(options: {
  quotaType: 'per-minute' | 'daily' | 'monthly';
  retryAfter?: number;
  usage?: { current: number; limit: number };
  message: string;
  hasApiKey?: boolean;
}) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // Write the rate limit data part
      writer.write({
        type: 'data-rate-limit',
        id: `rate-limit-${Date.now()}`,
        data: {
          ...options,
          timestamp: Date.now(),
        },
      });

      // Write a brief text explanation (optional, creates visible message)
      writer.write({
        type: 'text',
        text: '', // Empty text - the card will be the visual content
      });
    },
  });

  return stream;
}
```

#### Step 2.3: Modify `/chat-with-tools` Endpoint

Update the rate limit handling to stream a data part instead of returning JSON error:

```typescript
router.post('/chat-with-tools', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const startTime = Date.now();

    // Rate limiting with Redis
    const rateLimit = await checkRateLimitWithRedis(ip);
    if (!rateLimit.allowed) {
        // NEW: Stream a rate limit card instead of JSON error
        const stream = createRateLimitStream({
            quotaType: 'per-minute',
            retryAfter: rateLimit.retryAfter || Math.ceil(AI_RATE_LIMIT_WINDOW / 1000),
            usage: {
                current: AI_RATE_LIMIT_MAX,
                limit: AI_RATE_LIMIT_MAX,
            },
            message: 'Too many requests. Please wait a moment and try again.',
            hasApiKey: undefined, // Backend doesn't know this; frontend will check
        });

        return createUIMessageStreamResponse({ stream });
    }

    // Check quota limits
    const quota = await checkQuotaLimits(ip);
    if (!quota.allowed) {
        const usage = await getUsageForIP(ip);
        const quotaType = quota.reason?.includes('Daily') ? 'daily' : 'monthly';
        const limit = quotaType === 'daily' ? DAILY_LIMIT : MONTHLY_LIMIT;
        const current = quotaType === 'daily' ? usage.dailyCount : usage.monthlyCount;

        // NEW: Stream a quota exceeded card
        const stream = createRateLimitStream({
            quotaType,
            usage: { current, limit },
            message: quota.reason || 'Usage quota exceeded. Please try again later.',
            hasApiKey: undefined,
        });

        return createUIMessageStreamResponse({ stream });
    }

    // ... rest of existing implementation ...
});
```

#### Step 2.4: Add Type Definitions for Backend

Create or update types file:

```typescript
// packages/backend-vercel/src/types/dataParts.ts (NEW FILE)

export interface RateLimitDataPayload {
  quotaType: 'per-minute' | 'daily' | 'monthly';
  retryAfter?: number;
  usage?: {
    current: number;
    limit: number;
  };
  message: string;
  hasApiKey?: boolean;
  timestamp: number;
}
```

---

### Phase 3: Frontend Data Part Handling

**Files to modify:**
- `apps/extension/src/ai/hooks/useAIChat.ts` (or transport layer)
- `apps/extension/src/ai/backend/backendChatWithTools.ts`

#### Step 3.1: Handle Data Parts in useAIChat

If using `useChat` from AI SDK, add `onData` callback:

```typescript
// In useAIChat.ts or where useChat is configured

import { isRateLimitDataPart } from '@/ai/types';
import { hasApiKeyForFallback } from '@/ai/backend/gracefulDegradation';

const chat = useChat({
  id: threadId,
  transport,
  
  // NEW: Handle streaming data parts
  onData: (dataPart) => {
    log.debug('Received data part', { type: dataPart.type });

    if (isRateLimitDataPart(dataPart)) {
      // Enrich with client-side info (API key status)
      // The part will be rendered by ChatMessages component
      log.warn('Rate limit data part received', {
        quotaType: dataPart.data.quotaType,
        retryAfter: dataPart.data.retryAfter,
      });
    }
  },

  onError: handleError,
  onFinish: handleFinish,
});
```

#### Step 3.2: Update Message Type to Include Data Parts

Ensure your message type can handle custom data parts:

```typescript
// apps/extension/src/ai/types/messageMetadata.ts

import type { UIMessage } from 'ai';

export interface MessageMetadata {
  model?: string;
}

// Extend UIMessage to include our custom data part types
export type CognitoUIMessage = UIMessage<MessageMetadata>;

// The message.parts array can contain:
// - { type: 'text', text: string }
// - { type: 'tool-call', ... }
// - { type: 'data-rate-limit', data: RateLimitData } <- NEW
```

---

### Phase 4: Rate Limit Card Component

**Files to create:**
- `apps/extension/src/components/features/chat/components/cards/RateLimitCard.tsx` (NEW)
- `apps/extension/src/components/features/chat/components/cards/RateLimitCard.css` (NEW)

#### Step 4.1: Create RateLimitCard Component

```tsx
// apps/extension/src/components/features/chat/components/cards/RateLimitCard.tsx

import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, Key, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { hasApiKeyForFallback, switchToBYOKMode } from '@/ai/backend/gracefulDegradation';
import type { RateLimitData } from '@/ai/types';
import './RateLimitCard.css';

interface RateLimitCardProps {
  data: RateLimitData;
  onSwitchToBYOK?: () => void;
}

export function RateLimitCard({ data, onSwitchToBYOK }: RateLimitCardProps) {
  const [countdown, setCountdown] = useState(data.retryAfter || 0);
  const hasApiKey = hasApiKeyForFallback();

  // Countdown timer for per-minute rate limits
  useEffect(() => {
    if (data.quotaType !== 'per-minute' || !data.retryAfter) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data.quotaType, data.retryAfter]);

  const handleSwitchToBYOK = () => {
    switchToBYOKMode();
    onSwitchToBYOK?.();
  };

  // Determine card variant based on quota type
  const isTemporary = data.quotaType === 'per-minute';
  const title = isTemporary
    ? 'Rate Limit Reached'
    : data.quotaType === 'daily'
    ? 'Daily Quota Exceeded'
    : 'Monthly Quota Exceeded';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rate-limit-card"
      data-type={data.quotaType}
    >
      {/* Header */}
      <div className="rate-limit-card__header">
        <AlertCircle className="rate-limit-card__icon" size={18} />
        <span className="rate-limit-card__title">{title}</span>
      </div>

      {/* Message */}
      <p className="rate-limit-card__message">{data.message}</p>

      {/* Usage Progress (for quota limits) */}
      {data.usage && (
        <div className="rate-limit-card__usage">
          <div className="rate-limit-card__usage-bar">
            <div
              className="rate-limit-card__usage-fill"
              style={{ width: `${Math.min((data.usage.current / data.usage.limit) * 100, 100)}%` }}
            />
          </div>
          <span className="rate-limit-card__usage-text">
            {data.usage.current} / {data.usage.limit} requests used
          </span>
        </div>
      )}

      {/* Countdown Timer (for per-minute rate limits) */}
      {isTemporary && countdown > 0 && (
        <div className="rate-limit-card__countdown">
          <Clock size={14} />
          <span>Try again in {countdown}s</span>
        </div>
      )}

      {/* Actions */}
      <div className="rate-limit-card__actions">
        {hasApiKey ? (
          <button
            type="button"
            className="rate-limit-card__button rate-limit-card__button--primary"
            onClick={handleSwitchToBYOK}
          >
            <Key size={14} />
            <span>Switch to Your API Key</span>
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="rate-limit-card__hint">
            <Key size={14} />
            <span>Add your own API key in settings for unlimited usage</span>
          </div>
        )}
      </div>

      {/* Timestamp (subtle) */}
      <div className="rate-limit-card__timestamp">
        {new Date(data.timestamp).toLocaleTimeString()}
      </div>
    </motion.div>
  );
}
```

#### Step 4.2: Create RateLimitCard Styles

```css
/* apps/extension/src/components/features/chat/components/cards/RateLimitCard.css */

.rate-limit-card {
  background: linear-gradient(
    135deg,
    rgba(239, 68, 68, 0.08) 0%,
    rgba(239, 68, 68, 0.04) 100%
  );
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin: 8px 0;
  font-size: 13px;
}

.rate-limit-card[data-type="daily"],
.rate-limit-card[data-type="monthly"] {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.08) 0%,
    rgba(245, 158, 11, 0.04) 100%
  );
  border-color: rgba(245, 158, 11, 0.2);
}

.rate-limit-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rate-limit-card__icon {
  color: #ef4444;
}

.rate-limit-card[data-type="daily"] .rate-limit-card__icon,
.rate-limit-card[data-type="monthly"] .rate-limit-card__icon {
  color: #f59e0b;
}

.rate-limit-card__title {
  font-weight: 600;
  color: var(--text-primary);
}

.rate-limit-card__message {
  color: var(--text-secondary);
  margin: 0 0 12px;
  line-height: 1.5;
}

.rate-limit-card__usage {
  margin-bottom: 12px;
}

.rate-limit-card__usage-bar {
  height: 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.rate-limit-card__usage-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.rate-limit-card__usage-text {
  font-size: 11px;
  color: var(--text-tertiary);
}

.rate-limit-card__countdown {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  margin-bottom: 12px;
  font-weight: 500;
  color: #ef4444;
}

.rate-limit-card__actions {
  margin-top: 12px;
}

.rate-limit-card__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.rate-limit-card__button--primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.rate-limit-card__button--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.rate-limit-card__hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.rate-limit-card__timestamp {
  font-size: 10px;
  color: var(--text-tertiary);
  text-align: right;
  margin-top: 8px;
  opacity: 0.6;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .rate-limit-card {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.12) 0%,
      rgba(239, 68, 68, 0.06) 100%
    );
  }

  .rate-limit-card[data-type="daily"],
  .rate-limit-card[data-type="monthly"] {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.12) 0%,
      rgba(245, 158, 11, 0.06) 100%
    );
  }

  .rate-limit-card__usage-bar {
    background: rgba(255, 255, 255, 0.1);
  }

  .rate-limit-card__hint {
    background: rgba(255, 255, 255, 0.06);
  }
}
```

---

### Phase 5: Render Card in ChatMessages

**Files to modify:**
- `apps/extension/src/components/features/chat/components/display/ChatMessages.tsx`

#### Step 5.1: Import RateLimitCard Component

```tsx
// At top of ChatMessages.tsx
import { RateLimitCard } from '../cards/RateLimitCard';
import { isRateLimitDataPart } from '@/ai/types';
```

#### Step 5.2: Render Data Parts in Message Loop

Find the section where message parts are rendered and add handling for rate limit data parts:

```tsx
// Inside the message rendering loop, where parts are displayed:

{message.parts.map((part, index) => {
  // Handle text parts
  if (part.type === 'text') {
    return (
      <SafeMarkdown key={index} isStreaming={isStreaming}>
        {part.text}
      </SafeMarkdown>
    );
  }

  // Handle tool-call parts
  if (part.type === 'tool-call') {
    return <ToolCallRenderer key={index} part={part} />;
  }

  // NEW: Handle rate limit data parts
  if (isRateLimitDataPart(part)) {
    return (
      <RateLimitCard
        key={index}
        data={part.data}
        onSwitchToBYOK={() => {
          // Optionally trigger a re-send of the last message
          log.info('Switched to BYOK mode from rate limit card');
        }}
      />
    );
  }

  // Handle other part types...
  return null;
})}
```

---

### Phase 6: Export Index Updates

**Files to modify:**
- `apps/extension/src/components/features/chat/components/cards/index.ts` (NEW or MODIFY)

```typescript
// apps/extension/src/components/features/chat/components/cards/index.ts

export { RateLimitCard } from './RateLimitCard';
```

---

## Testing Checklist

### Backend Testing
- [ ] Hit rate limit endpoint repeatedly to trigger per-minute limit
- [ ] Verify stream returns `data-rate-limit` part instead of JSON error
- [ ] Check quota exceeded scenarios (mock daily/monthly limits)
- [ ] Verify `retryAfter` value is correctly calculated

### Frontend Testing
- [ ] Card renders correctly when rate limit part is received
- [ ] Countdown timer decrements properly
- [ ] "Switch to BYOK" button appears only when API key is configured
- [ ] Clicking button switches mode and updates settings store
- [ ] Card persists in message history after thread reload
- [ ] Card styling works in both light and dark modes

### Integration Testing
- [ ] Full flow: Send message → Rate limit → Card appears → Switch to BYOK → Retry
- [ ] Graceful degradation still works for non-card scenarios
- [ ] Backend mode toggle correctly prevents card from appearing in BYOK mode

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/ai/types/dataParts.ts` | NEW | Define RateLimitData type and type guard |
| `src/ai/types/index.ts` | MODIFY | Export new types |
| `packages/backend-vercel/src/routes/ai.ts` | MODIFY | Stream rate limit cards instead of JSON errors |
| `packages/backend-vercel/src/types/dataParts.ts` | NEW | Backend type definitions |
| `src/ai/hooks/useAIChat.ts` | MODIFY | Add onData handler (optional) |
| `src/components/.../cards/RateLimitCard.tsx` | NEW | Rate limit card component |
| `src/components/.../cards/RateLimitCard.css` | NEW | Card styles |
| `src/components/.../display/ChatMessages.tsx` | MODIFY | Render rate limit data parts |

---

## Potential Issues & Mitigations

| Issue | Mitigation |
|-------|------------|
| Backend returns stream for errors (not typical REST pattern) | Document that 429 responses are now streams; frontend already handles streams |
| `hasApiKey` not known on backend | Leave undefined; frontend enriches with `hasApiKeyForFallback()` |
| Countdown continues after user switches mode | Add cleanup in useEffect; use `key` prop to reset component |
| Card styling conflicts with existing CSS | Use BEM naming with `rate-limit-card__` prefix |
| Data part type not recognized by AI SDK | Use `data-*` prefix which AI SDK treats as custom data |

---

## Dependencies

- **AI SDK v6**: `createUIMessageStream`, `createUIMessageStreamResponse` (already available)
- **Framer Motion**: For card animations (already installed)
- **Lucide React**: For icons (already installed)

---

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Types | 15 min | Required |
| Phase 2: Backend | 45 min | Required |
| Phase 3: Frontend Handling | 30 min | Required |
| Phase 4: Card Component | 1 hour | Required |
| Phase 5: ChatMessages Integration | 30 min | Required |
| Phase 6: Exports | 5 min | Required |

**Total:** ~3 hours

---

## Future Enhancements

1. **Transient Notifications**: Add ephemeral toast for quota warnings (e.g., "80% of daily quota used")
2. **Retry Button**: Add "Retry Now" button that appears when countdown reaches 0
3. **Usage Dashboard**: Link to a usage dashboard/settings page from the card
4. **Progressive Loading**: Show initial card state, then update via reconciliation when retry-after expires
