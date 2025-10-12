# Indexing Deduplication Implementation

## Overview
Added conditions to prevent duplicate indexing of pages that were recently indexed or are currently being processed.

## Changes Made

### 1. Scheduler (`src/background/scheduler.ts`)
Added a new function to check if a URL is currently being processed:

```typescript
export function isUrlBeingProcessed(url: string): boolean {
    return currentBatch.some(job => job.url === url);
}
```

This allows other parts of the system to check if a page is in the current processing batch before attempting to enqueue it.

### 2. Queue (`src/background/queue.ts`)

#### a. Recently Indexed Cache
Added an in-memory cache to track recently indexed pages:

```typescript
const recentlyIndexedCache = new Map<string, number>();
const RECENTLY_INDEXED_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

This cache stores URLs with their indexing timestamps and automatically expires entries after 5 minutes.

#### b. Cache Management Functions
- `cleanupRecentlyIndexedCache()`: Removes expired entries from the cache
- `wasRecentlyIndexed(url: string)`: Checks if a URL was indexed within the TTL window
- `markAsRecentlyIndexed(url: string)`: Marks a URL as recently indexed

#### c. Updated `markSuccess()`
Modified to mark URLs as recently indexed when they are successfully processed:

```typescript
if (record) {
    markAsRecentlyIndexed(record.url);
}
```

#### d. Enhanced `enqueuePageSeen()`
Added two checks before enqueuing a page:

1. **Recently Indexed Check**: Prevents reindexing a page that was just indexed (within 5 minutes)
2. **Currently Processing Check**: Prevents triggering indexing for a page that is currently being processed

```typescript
// Check if URL was recently indexed
if (wasRecentlyIndexed(url)) {
    console.log(`[Queue] Skipping enqueue - URL was recently indexed: ${url}`);
    return getCoalesceKey(url, now);
}

// Check if URL is currently being processed
const { isUrlBeingProcessed } = await import('./scheduler');
if (isUrlBeingProcessed(url)) {
    console.log(`[Queue] Skipping enqueue - URL is currently being processed: ${url}`);
    return getCoalesceKey(url, now);
}
```

## Benefits

1. **Prevents Duplicate Processing**: Pages won't be reindexed within a 5-minute window after successful indexing
2. **Avoids Concurrent Processing**: Pages currently being processed won't be added to the queue again
3. **Reduces Resource Usage**: Eliminates unnecessary reprocessing of the same content
4. **Improves Performance**: Reduces queue size and processing overhead
5. **Better User Experience**: Prevents redundant work and improves system responsiveness

## Configuration

The TTL for recently indexed pages can be adjusted by modifying:
```typescript
const RECENTLY_INDEXED_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

Increase this value to prevent reindexing for longer periods, or decrease it if you need more frequent updates.

## Notes

- The recently indexed cache is stored in memory and will be cleared when the service worker is terminated
- This is by design to prevent stale cache issues after browser restarts
- The cache automatically cleans up expired entries to prevent memory leaks
- The dynamic import in `enqueuePageSeen()` prevents circular dependency issues between queue.ts and scheduler.ts
