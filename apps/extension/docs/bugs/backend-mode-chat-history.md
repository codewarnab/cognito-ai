# Bug Report: Messages Not Showing on Side Panel Reopen (Backend Mode)

## Problem Description
The user reported that when closing and reopening the side panel in Backend Mode, the chat history for the selected thread is not displayed in the messages area, despite the correct thread being selected in the sidebar. This issue resolves itself when switching to another thread and back.

## Investigation

I investigated the following files to understand how chat state is restored on initialization:
- `apps/extension/src/entrypoints/sidepanel/App.tsx`: Main side panel component.
- `apps/extension/src/stores/chat/chatStore.ts`: Zustand store managing chat state and IndexedDB loading.
- `apps/extension/src/ai/hooks/useAIChat.ts`: Custom hook wrapping Vercel AI SDK's `useChat`.

### Findings

The issue stems from a synchronization bug in `useAIChat.ts`.

The `useAIChat` hook is responsible for syncing the messages loaded in the global `chatStore` (from IndexedDB) into the local `useChat` hook (which drives the UI).

The synchronization logic is inside a `useEffect`:

```typescript
// apps/extension/src/ai/hooks/useAIChat.ts

// Sync messages FROM store TO useChat when thread changes
useEffect(() => {
    // Only sync if store is hydrated and thread has actually changed
    if (!storeIsHydrated) {
      log.info('⏳ Store not hydrated yet, skipping sync');
      return;
    }

    // THE BUG IS HERE:
    const threadChanged = lastThreadIdRef.current !== null && lastThreadIdRef.current !== threadId;

    if (threadChanged) {
      log.info('🔄 Thread switch detected, syncing store messages to useChat', { ... });
      chat.setMessages(storeMessages);
    }

    // Update last thread ID
    lastThreadIdRef.current = threadId;
}, [threadId, storeMessages, storeIsHydrated, chat.setMessages]);
```

### The Logic Flaw

The condition `lastThreadIdRef.current !== null` explicitly prevents synchronization on the **first time** this effect runs for a given thread ID if the ref was null (which it is on component mount).

**Scenario (Re-opening Side Panel):**
1.  **Mount**: Side panel opens. `useAIChat` mounts. `lastThreadIdRef.current` is `null`. `threadId` is set (e.g., "thread-123").
2.  **Initial Render**: `storeIsHydrated` is false. Effect returns early.
3.  **Hydration**: `chatStore` loads messages from DB. `storeIsHydrated` becomes `true`. `storeMessages` is populated.
4.  **Effect Re-runs**: 
    - `lastThreadIdRef.current` is still `null` (or "thread-123" if updated in previous pass, but let's trace carefully).
    - If `lastThreadIdRef` was updated in step 2 (it is updated at the end of the effect usage), then `lastThreadIdRef.current` = "thread-123".
    - `threadId` = "thread-123".
    - `threadChanged` = `lastThreadIdRef.current` ("thread-123") !== `threadId` ("thread-123") => **FALSE**.

So, when the store finally loads the messages, the effect decides **not to sync** because the thread ID hasn't "changed" from what it saw a split second ago (or because it was validly null).

The synchronization logic relies on *switching* threads, but fails to account for the *initial load* of the *current* thread.

## Solution

We need to modify the synchronization logic to allow syncing if:
1.  The thread ID has changed.
2.  **OR** it is the initial successful load (hydration) for the current thread.

### implementation Plan

Update `apps/extension/src/ai/hooks/useAIChat.ts` to:

1.  Remove the `lastThreadIdRef.current !== null` restriction.
2.  Allow syncing if the `storeMessages` differ significantly from `chat.messages` on hydration (though simple overwriting on hydration is safer and standard behavior for this pattern).

Revised code block:

```typescript
    // Sync messages FROM store TO useChat when thread changes
    useEffect(() => {
        if (!storeIsHydrated) return;

        // Check if we need to sync:
        // 1. If we just switched threads (ref != current)
        // 2. OR if this is the first time we are seeing a valid threadId (ref is null)
        const shouldSync = lastThreadIdRef.current !== threadId;

        // Note: We might also want to sync if we are just hydrating for the first time
        // even if threadId hasn't "changed" (it was set on mount).
        // The safest way is to trust the store if useChat is empty and store has messages.
        
        if (shouldSync) {
            log.info('🔄 Thread switch or initial load, syncing store messages to useChat', {
                from: lastThreadIdRef.current,
                to: threadId,
                storeMessageCount: storeMessages.length
            });
            chat.setMessages(storeMessages);
        }

        lastThreadIdRef.current = threadId;
    }, [threadId, storeMessages, storeIsHydrated, chat.setMessages]);
```
