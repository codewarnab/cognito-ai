# Background Service Worker - Test Plan

This document outlines acceptance tests for the MV3 Background Service Worker implementation.

## Test Coverage

### 1. Database Initialization
- [x] Opens `chromeAi` database on first run
- [x] Creates `bgQueue` store with indexes (`by_nextAttemptAt`, `by_url`)
- [x] Creates `settings` store
- [x] Handles upgrades gracefully

### 2. Queue Coalescing
**Test Case**: Multiple `PageSeen` events within 60s should coalesce
```typescript
// Simulate rapid updates
await chrome.runtime.sendMessage({ 
  type: 'PageSeen', 
  url: 'https://example.com',
  title: 'Title 1' 
});

// Within 60s
await chrome.runtime.sendMessage({ 
  type: 'PageSeen', 
  url: 'https://example.com',
  title: 'Title 2 (updated)' 
});

// Expected: Single queue record with:
// - firstEnqueuedAt preserved from first enqueue
// - lastUpdatedAt updated to second enqueue
// - title: 'Title 2 (updated)'
```

**Validation**:
- Same `id` (coalesce key: `${url}#${timeBucket}`)
- `firstEnqueuedAt` unchanged
- `lastUpdatedAt` reflects latest update
- Latest metadata (title, description, payload) preserved

### 3. FIFO Dequeue with Due-Time Filtering
**Test Case**: Dequeue respects `nextAttemptAt` and FIFO order
```typescript
// Enqueue 3 URLs with staggered times
const now = Date.now();
await enqueue('https://a.com', ..., now - 100);  // Due now
await enqueue('https://b.com', ..., now - 50);   // Due now
await enqueue('https://c.com', ..., now + 10000); // Due in future

// Dequeue batch
const jobs = await dequeueBatch(now, 10);

// Expected: Returns a.com and b.com (ordered by firstEnqueuedAt)
// c.com is NOT returned (nextAttemptAt > now)
```

**Validation**:
- Only items with `nextAttemptAt <= now` returned
- Results sorted by `firstEnqueuedAt` (FIFO)
- Respects `batchSize` limit

### 4. Alarm Scheduling
**Test Case**: Alarm is created and fires periodically
```typescript
// On install
chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarms();
});

// Check alarm exists
const alarm = await chrome.alarms.get('bg:schedule');
// Expected: alarm.periodInMinutes === 1

// On alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  // Expected: runSchedulerTick() is called
});
```

**Validation**:
- Alarm named `bg:schedule` exists
- Period is 1 minute
- `onAlarm` triggers `runSchedulerTick()`
- Respects `PROCESS_TIME_BUDGET_MS` (250ms) per tick

### 5. Exponential Backoff with Jitter
**Test Case**: Failures trigger exponential backoff
```typescript
// Force transient failure from offscreen
const job = await enqueue('https://fail.com');

// Simulate failure
await markFailure(job.id, 'Transient error', true);

// Check record
const record = await getQueueItem(job.id);
// Expected:
// - attempt: 1
// - nextAttemptAt: now + backoff(1) with jitter
//   - backoff(1) = min(10000 * 2^1, 6h) * random(0.5..1.5)
//   - Should be ~10s to ~30s

// Simulate 2nd failure
await markFailure(job.id, 'Transient error', true);
// Expected:
// - attempt: 2
// - nextAttemptAt: now + backoff(2) with jitter
//   - backoff(2) = min(10000 * 2^2, 6h) * random(0.5..1.5)
//   - Should be ~20s to ~60s
```

**Validation**:
- `attempt` increments on each failure
- `nextAttemptAt` grows exponentially
- Jitter applied (0.5x to 1.5x)
- Max backoff capped at 6 hours
- After `MAX_ATTEMPTS` (8), moved to dead letter (nextAttemptAt = MAX_SAFE_INTEGER)

### 6. Pause Gate
**Test Case**: When paused, processing stops
```typescript
// Pause processing
await chrome.runtime.sendMessage({ type: 'TogglePause', paused: true });

// Try to enqueue
await chrome.runtime.sendMessage({ 
  type: 'PageSeen', 
  url: 'https://example.com' 
});
// Expected: Error response "Processing is paused"

// Try to process
await runSchedulerTick();
// Expected: Logs "Processing paused", no dequeue happens

// Resume
await chrome.runtime.sendMessage({ type: 'TogglePause', paused: false });
// Now processing resumes
```

**Validation**:
- `PageSeen` enqueues are rejected when paused
- `runSchedulerTick()` exits early when paused
- Setting `paused=true` persists in IndexedDB

### 7. Model Version Gating
**Test Case**: Processing gated until model ready
```typescript
// On first install
chrome.runtime.onInstalled.addListener(async () => {
  await bootstrapModelIfNeeded();
  // Expected: Initiates offscreen document
  // Expected: Sends InitWorker message
});

// Before model ready
await runSchedulerTick();
// Expected: Logs "Model not ready", exits early

// After offscreen sends WorkerReady
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'WorkerReady') {
    // Expected: Sets modelVersion in settings
  }
});

// Now processing can proceed
```

**Validation**:
- `modelVersion` is null on first install
- `bootstrapModelIfNeeded()` initiates model download
- Processing gated until `modelVersion` is set
- No network calls after first-run bootstrap

### 8. Resilience Across Restarts
**Test Case**: Service worker restart preserves state
```typescript
// Enqueue some jobs
await enqueue('https://a.com');
await enqueue('https://b.com');

// Simulate service worker termination/restart
// (kill/reload extension in chrome://extensions)

// On startup
chrome.runtime.onStartup.addListener(async () => {
  await openDb();
  await ensureAlarms();
  await runSchedulerTick();
});

// Expected:
// - Database persists (jobs still in queue)
// - Alarms re-created
// - Processing resumes with existing queue items
// - No duplicate processing
```

**Validation**:
- Queue survives worker restarts (IndexedDB persistence)
- Alarms recreated on startup
- Processing resumes without duplication
- No data loss

### 9. Non-Retriable Errors
**Test Case**: Non-retriable errors move to dead letter immediately
```typescript
// Simulate non-retriable error
await markFailure(jobId, 'Invalid payload (non-retriable)', false);

// Check record
const record = await getQueueItem(jobId);
// Expected:
// - nextAttemptAt: Number.MAX_SAFE_INTEGER (never retry)
// - attempt: 1
// - queueStats.failures incremented
```

**Validation**:
- Non-retriable errors bypass backoff
- Moved to dead letter immediately
- Stats updated

### 10. Message Contracts
**Test Case**: Invalid messages handled gracefully
```typescript
// Missing required field
await chrome.runtime.sendMessage({ type: 'PageSeen' });
// Expected: Error response

// Unknown message type
await chrome.runtime.sendMessage({ type: 'UnknownType' });
// Expected: Warning logged, no crash
```

**Validation**:
- Invalid messages return error responses
- Unknown types logged, not processed
- No service worker crashes

## Manual Testing Checklist

- [ ] Install extension (fresh install)
  - [ ] Database created
  - [ ] Alarms set up
  - [ ] Model bootstrap initiated
  
- [ ] Browse multiple pages
  - [ ] Content script sends `PageSeen` messages
  - [ ] Jobs enqueued and coalesced
  - [ ] Processing happens on alarm ticks
  
- [ ] Pause and resume
  - [ ] Toggle pause from popup/options
  - [ ] Verify processing stops/resumes
  
- [ ] Reload service worker
  - [ ] Queue persists
  - [ ] Processing resumes
  
- [ ] Check chrome://indexeddb-internals
  - [ ] Verify `chromeAi` database exists
  - [ ] Inspect `bgQueue` and `settings` stores
  
- [ ] Monitor console logs
  - [ ] Alarm ticks logged
  - [ ] Processing logs show batch sizes
  - [ ] Errors logged with context

## Performance Expectations

- **Batch Processing**: 8 jobs/tick (default), 24 jobs/tick (idle)
- **Time Budget**: 250ms per tick
- **Offscreen Lifetime**: Max 15 seconds idle before close
- **Alarm Period**: 1 minute
- **Backoff Range**: 10s (attempt 0) to 6h (max)

## Edge Cases Covered

1. ✅ Rapid coalescing within 1-minute window
2. ✅ Service worker restart mid-processing
3. ✅ Offscreen document creation failure (retries)
4. ✅ Queue exceeds batch size (processes in chunks)
5. ✅ Model not ready (gates processing)
6. ✅ Pause during active processing (graceful stop)
7. ✅ Non-retriable errors (dead letter)
8. ✅ Exceeded max attempts (dead letter)
9. ✅ Concurrent processing prevention (isProcessing flag)
10. ✅ IndexedDB transaction errors (logged, retried next tick)

## Next Steps

1. Build extension with `pnpm build`
2. Load unpacked in Chrome
3. Run manual tests
4. Monitor console for errors
5. Check IndexedDB state
6. Verify alarm behavior in chrome://alarms (dev builds only)
