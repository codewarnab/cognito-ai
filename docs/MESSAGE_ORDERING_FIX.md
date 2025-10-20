# Message Ordering Fix

## Problem
When going back to a previous chat thread, messages were being retrieved and rendered in the wrong order. This was causing:
- Messages appearing out of sequence
- User messages and assistant responses not matching up correctly
- Confusing conversation flow

## Root Causes

1. **Timestamp Inconsistency**: Messages were being saved with inconsistent timestamps:
   - Some messages used `createdAt` timestamp from the AI SDK
   - Others defaulted to `Date.now()` at save time
   - Bulk saves could result in multiple messages with the same or very close timestamps

2. **No Sequence Preservation**: The database schema only relied on timestamps for ordering, which could be unreliable when:
   - Multiple messages are saved at once
   - Messages are created rapidly in succession
   - Clock adjustments or system time changes occur

3. **Missing Metadata**: The `streamText` function's `onFinish` callback wasn't being fully utilized to capture proper message metadata

## Solution

### 1. Database Schema Update (`src/db/index.ts`)

**Added `sequenceNumber` field to ChatMessage:**
```typescript
export interface ChatMessage {
    id: string;
    threadId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    sequenceNumber?: number; // NEW: Preserves exact message order
    metadata?: {
        streaming?: boolean;
        error?: boolean;
        regenerated?: boolean;
    };
}
```

**Updated database version to include new index:**
```typescript
// Version 3: Add sequenceNumber for proper message ordering
this.version(3).stores({
    settings: 'key',
    chatMessages: 'id, threadId, timestamp, sequenceNumber',
    chatThreads: 'id, createdAt, updatedAt'
});
```

**Improved message loading with dual-key sorting:**
```typescript
export async function loadThreadMessages(threadId: string): Promise<ChatMessage[]> {
    const messages = await db.chatMessages
        .where('threadId')
        .equals(threadId)
        .toArray();
    
    // Sort by sequenceNumber first (if available), then by timestamp as fallback
    return messages.sort((a, b) => {
        if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
            return a.sequenceNumber - b.sequenceNumber;
        }
        return a.timestamp - b.timestamp;
    });
}
```

### 2. Message Saving Logic (`src/sidepanel.tsx`)

**Updated to preserve exact order with sequence numbers:**
```typescript
.map((msg, index) => {
    // Extract timestamp from createdAt or use index-based timestamp
    let timestamp: number;
    if ((msg as any).createdAt) {
        timestamp = new Date((msg as any).createdAt).getTime();
    } else {
        // Use base timestamp + index to ensure proper ordering
        timestamp = Date.now() + index;
    }

    return {
        id: msg.id,
        threadId: currentThreadId,
        role: msg.role as 'user' | 'assistant',
        content: text,
        timestamp,
        sequenceNumber: index, // Preserve exact order
    };
})
```

### 3. Enhanced Stream Callbacks (`src/ai/aiLogic.ts`)

**Added `onFinish` callback to `streamText`:**
```typescript
const result = streamText({
    // ... other config
    onFinish: async ({ text, finishReason, usage, steps }) => {
        log.info('Stream finished:', {
            finishReason,
            textLength: text?.length || 0,
            tokensUsed: usage?.totalTokens || 0,
            stepCount: steps?.length || 0,
        });
    },
});
```

## Benefits

1. **Guaranteed Message Order**: The `sequenceNumber` field provides a reliable, monotonically increasing order indicator
2. **Backward Compatible**: Existing messages without `sequenceNumber` still work, falling back to timestamp sorting
3. **Improved Timestamps**: Even when `createdAt` is missing, we now use index-based offsets to prevent timestamp collisions
4. **Better Logging**: Enhanced callbacks provide visibility into the streaming process

## Testing Recommendations

1. **Test New Conversations**:
   - Create a new thread
   - Send multiple messages rapidly
   - Navigate away and back to verify order is preserved

2. **Test Existing Threads**:
   - Open an existing thread (created before this fix)
   - Verify messages still load correctly (using timestamp fallback)
   - Send new messages and verify they integrate properly

3. **Test Edge Cases**:
   - Very rapid message sending
   - Long conversations (20+ messages)
   - Switching between threads quickly
   - Browser restart/reload

## Migration Notes

- The database schema version is automatically upgraded from v2 to v3
- Existing messages will continue to work using timestamp-based sorting
- New messages will benefit from sequence number ordering
- No manual data migration required

## Future Improvements

Consider:
1. Adding a migration script to backfill `sequenceNumber` for existing messages
2. Implementing optimistic updates with temporary sequence numbers
3. Adding message revision tracking for edit history
