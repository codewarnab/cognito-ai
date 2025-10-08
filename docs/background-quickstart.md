# Background Service Worker - Quick Start Guide

## Overview
The background service worker manages a persistent FIFO queue of page visits, processes them through an offscreen document, and handles retry logic with exponential backoff.

## Architecture

```
┌─────────────────┐
│ Content Script  │
│   (page visit)  │
└────────┬────────┘
         │ PageSeen
         ▼
┌─────────────────────────────────────────┐
│       Background Service Worker         │
│  ┌───────────────────────────────────┐  │
│  │  Queue (IndexedDB: chromeAi)      │  │
│  │  - Coalescing (1-min buckets)     │  │
│  │  - FIFO ordering                  │  │
│  │  - Backoff on failure             │  │
│  └───────────────────────────────────┘  │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │  Scheduler (chrome.alarms)        │  │
│  │  - 1-minute periodic ticks        │  │
│  │  - Batch processing (8 items)     │  │
│  │  - Time budgets (250ms)           │  │
│  └───────────────────────────────────┘  │
└────────┬────────────────────────────────┘
         │ ProcessBatch
         ▼
┌─────────────────────────────────────────┐
│      Offscreen Document                 │
│  - Embedding worker                     │
│  - Model execution                      │
│  - Returns BatchResult                  │
└─────────────────────────────────────────┘
```

## Key APIs

### Enqueuing Pages
```typescript
// From content script or anywhere
chrome.runtime.sendMessage({
  type: 'PageSeen',
  url: 'https://example.com',
  title: 'Example Page',
  description: 'Meta description',
  payload: {
    textPreview: 'First 500 chars...',
    images: [
      { src: 'img.jpg', alt: 'Alt text', caption: '...' }
    ]
  }
});
```

### Pause/Resume Processing
```typescript
// Pause
chrome.runtime.sendMessage({ type: 'TogglePause', paused: true });

// Resume
chrome.runtime.sendMessage({ type: 'TogglePause', paused: false });
```

### Clear Queue
```typescript
chrome.runtime.sendMessage({ type: 'ClearIndex' });
```

## Database Schema

### `bgQueue` Store
```typescript
interface BgQueueRecord {
  id: string;              // "${url}#${timeBucket}"
  url: string;
  title?: string;
  description?: string;
  source: 'content' | 'manual' | 'retry';
  firstEnqueuedAt: number; // ms timestamp
  lastUpdatedAt: number;   // ms timestamp
  attempt: number;         // retry count (0-based)
  nextAttemptAt: number;   // ms timestamp (for scheduling)
  payload?: {
    textPreview?: string;
    images?: Array<{...}>;
  };
}

// Indexes
- by_nextAttemptAt (for dequeue filtering)
- by_url (for lookups)
```

### `settings` Store
```typescript
interface Settings {
  modelVersion?: string;   // Set after model download
  paused?: boolean;        // Pause gate flag
  queueStats?: {
    total: number;         // successes + failures
    successes: number;
    failures: number;
  };
}
```

## Processing Flow

1. **Enqueue** (Content Script → Background)
   - Content script sends `PageSeen` message
   - Background coalesces into 1-minute buckets
   - Stored in `bgQueue` with `nextAttemptAt = now`

2. **Dequeue** (Alarm → Background)
   - Every 1 minute, alarm fires
   - Background dequeues up to 8 items where `nextAttemptAt <= now`
   - Sorted by `firstEnqueuedAt` (FIFO)

3. **Process** (Background → Offscreen)
   - Background sends `ProcessBatch` to offscreen
   - Offscreen runs embedding model
   - Returns `BatchResult` (ok/errors)

4. **Handle Result** (Background)
   - **Success**: Delete from queue, increment stats
   - **Failure**: Increment `attempt`, calculate backoff, reschedule
   - **Dead Letter**: After 8 attempts, set `nextAttemptAt = MAX_SAFE_INTEGER`

## Retry & Backoff

```typescript
// Exponential backoff formula
const backoff = min(10000 * 2^attempt, 6h) * random(0.5, 1.5)

// Example progression
attempt 0: 10s * jitter     (5-15s)
attempt 1: 20s * jitter     (10-30s)
attempt 2: 40s * jitter     (20-60s)
attempt 3: 80s * jitter     (40-120s)
...
attempt 7: 6h * jitter      (max, then dead letter)
```

## Gating & Controls

### Model Readiness Gate
```typescript
// Processing blocked until modelVersion is set
const isReady = await isModelReady();
if (!isReady) {
  console.log('Model not ready, skipping tick');
  return;
}
```

### Pause Gate
```typescript
// Enqueuing and processing blocked when paused
const paused = await isPaused();
if (paused) {
  // Reject PageSeen messages
  // Skip processing ticks
}
```

## Monitoring & Debugging

### Console Logs
```javascript
// Key events logged
[Background] Service worker loaded
[Background] onInstalled: install
[Background] Alarm created: bg:schedule
[Background] Model bootstrap initiated
[Background] Alarm triggered: bg:schedule
[Background] Processing 8 jobs
[Background] Tick completed in 45ms
[Background] Offscreen document created
[Background] Offscreen document closed (idle)
```

### IndexedDB Inspector
```
chrome://indexeddb-internals
→ chrome-extension://<id>/chromeAi
  → bgQueue (view queue items)
  → settings (view model version, pause state, stats)
```

### Alarm Inspector (Dev Builds)
```
chrome://alarms
→ Find "bg:schedule" alarm
→ Verify periodInMinutes = 1
```

## Common Patterns

### Check Queue Status
```javascript
// Open IndexedDB console
const db = await indexedDB.open('chromeAi', 1);
const tx = db.transaction(['bgQueue'], 'readonly');
const store = tx.objectStore('bgQueue');
const count = await store.count();
console.log(`Queue has ${count} items`);
```

### Manual Trigger Processing
```javascript
// Force immediate tick (useful for testing)
chrome.runtime.sendMessage({ type: 'PageSeen', url: 'https://test.com' });
// This enqueues AND triggers runSchedulerTick() after 0ms
```

### View Stats
```javascript
// Open IndexedDB console
const db = await indexedDB.open('chromeAi', 1);
const tx = db.transaction(['settings'], 'readonly');
const store = tx.objectStore('settings');
const stats = await store.get('queueStats');
console.log(stats.value);
// { total: 42, successes: 38, failures: 4 }
```

## Error Handling

### Retriable Errors
- Offscreen not ready
- Temporary IndexedDB failure
- Model execution timeout
- Worker not initialized

**Behavior**: Exponential backoff, retry up to 8 times

### Non-Retriable Errors
- Invalid payload (missing required fields)
- URL blocked by user policy
- Persistent model errors

**Behavior**: Move to dead letter immediately (no retry)

## Performance Tips

1. **Batch Sizes**
   - Default: 8 items/tick
   - Idle: 24 items/tick (when `chrome.idle` detects idle)

2. **Time Budgets**
   - Tick: 250ms max
   - If more work available, schedules another tick after 100ms
   - Prevents blocking service worker

3. **Offscreen Lifetime**
   - Max 15 seconds idle
   - Closed automatically after timeout
   - Recreated lazily on next tick

4. **Coalescing**
   - 1-minute buckets reduce duplicate processing
   - Rapid updates merged into single queue item

## Troubleshooting

### Problem: Queue items not processing
**Check**:
1. Is `paused` set to `true`? (View settings store)
2. Is `modelVersion` set? (View settings store)
3. Are alarms running? (Check chrome://alarms in dev build)
4. Check console for errors

### Problem: Service worker crashes
**Check**:
1. View service worker console in chrome://extensions
2. Look for unhandled promise rejections
3. Check IndexedDB transaction errors
4. Verify offscreen.html exists in build

### Problem: Offscreen document errors
**Check**:
1. Is offscreen.html in web_accessible_resources?
2. Check manifest.json includes "offscreen" permission
3. View offscreen document console (DevTools → Service Workers → Offscreen)

### Problem: Queue growing too fast
**Solutions**:
1. Increase batch size (for idle processing)
2. Reduce alarm period (more frequent ticks)
3. Optimize offscreen processing time
4. Add queue size limits with eviction

## Testing

### Unit Tests (Manual)
```javascript
// Test coalescing
await enqueue('https://test.com', 'Title 1');
await enqueue('https://test.com', 'Title 2'); // Within 60s
// Expected: Single record with Title 2

// Test dequeue ordering
await enqueue('https://a.com', null, null, null, now - 100);
await enqueue('https://b.com', null, null, null, now - 50);
const jobs = await dequeueBatch(now, 10);
// Expected: [a.com, b.com] (FIFO order)

// Test backoff
await markFailure(jobId, 'Error', true);
const record = await getQueueItem(jobId);
console.log(record.nextAttemptAt - Date.now()); // ~10-30s
```

### Integration Tests
1. Load extension
2. Visit multiple pages
3. Check queue in IndexedDB
4. Verify alarm fires every minute
5. Monitor console for processing logs
6. Toggle pause, verify processing stops
7. Restart service worker, verify recovery

## Next Steps

1. **Offscreen Implementation** (`off-65c3ad37.plan.md`)
   - Replace mock handlers with real embedding logic
   - Initialize Transformers.js models

2. **Content Script** (`content-a2392710.plan.md`)
   - Extract page content
   - Send PageSeen messages

3. **Embedding Worker** (`embed-65e80471.plan.md`)
   - Chunking and embedding generation
   - Store in Dexie DB

## References

- Plan: `.cursor/plans/mv-e488f233.plan.md`
- Implementation: `docs/background-implementation.md`
- Tests: `src/background.test.md`
- Source: `src/background.ts`
