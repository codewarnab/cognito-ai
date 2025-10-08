<!-- 65c3ad37-6b08-449d-8d54-c603f5393073 451a867e-7bbb-45d1-9605-15dbc59326f9 -->
# Offscreen Document + Worker Bridge Plan

### Goals

- Create an MV3 offscreen document (`chrome.offscreen.createDocument`) that spins up a dedicated Web Worker to keep the model in memory.
- Provide a robust, typed message bridge for request/response, streaming, and batching.
- Strict lifecycle: create on-demand, keep alive only while work is pending or recently active, teardown when idle.

### Files

- `src/background/offscreen.ts`
  - `ensureOffscreenDocument()` create/ensure with reasons `BLOBS`, `WORKERS` and explicit justification string.
  - `postToOffscreen<TReq, TRes>(message)` that ensures the offscreen document, forwards request to offscreen via `chrome.runtime.sendMessage` with `requestId`, and awaits response.
  - `shutdownOffscreen({force?: boolean})` and idle timer logic (e.g., 60–120s) to close when queue empty + idle.
  - Internal queue-length/active-job tracking to decide teardown.
- `src/offscreen/index.html`
  - Minimal HTML hosting `bridge.ts` (as module script) to run in the offscreen document. No UI.
- `src/offscreen/bridge.ts`
  - Starts a dedicated `Worker` (e.g., `new Worker(chrome.runtime.getURL("workers/embed-worker.js"), { type: "module" })`).
  - Implements message routing: listen for `chrome.runtime.onMessage`, forward to worker, correlate `requestId`, return responses, handle streaming/batching.
  - Handles worker boot lifecycle and propagates readiness/errors back to background.
  - Teardown worker on `beforeunload` and on explicit `CLOSE` command.

### Lifecycle & Policies

- Creation criteria: First request that needs model work, or when background schedules batch jobs.
- Keep-alive policy: Offscreen stays alive while there are in-flight requests or recent activity (reset idle timer on each request or worker message). Idle timeout 90s.
- Teardown criteria: No in-flight requests AND idle timer expired → `chrome.offscreen.closeDocument()`.
- Resilience: If service worker restarts, `ensureOffscreenDocument()` recreates the offscreen doc transparently; pending callers retry.

### Justification (for MV3 review / reasons)

- Reasons: `BLOBS` (model files and ArrayBuffer embeddings), `WORKERS` (dedicated compute off main).
- Justification string (example): "Run embedding model in a dedicated Web Worker from an offscreen document. Requires BLOB processing for model artifacts and Worker for compute without UI."

### Message Protocol

- Envelope (from background → offscreen → worker and back):
```ts
interface BridgeMessage<T = unknown> {
  requestId: string; // uuid or nanoid
  action: string;    // e.g., 'INIT_MODEL', 'EMBED_TEXT_BATCH', 'SEARCH', 'CLOSE'
  payload?: T;
  meta?: { streaming?: boolean; priority?: 'low'|'normal'|'high' };
}

interface BridgeResponse<T = unknown> {
  requestId: string;
  ok: boolean;
  result?: T;
  error?: { code: string; message: string; details?: unknown };
  progress?: { done: number; total?: number }; // optional for streaming
  final?: boolean; // true on last chunk or single response
}
```

- Request/response correlation via `requestId` map in background and offscreen bridge.
- Streaming: multiple `BridgeResponse` with same `requestId`, `final: true` on completion.
- Batching: background may group multiple tasks into one `EMBED_TEXT_BATCH` payload with `texts: string[]` (or chunks), worker returns an array of embeddings in order.

### Background API (caller-facing)

- `ensureOffscreenDocument(): Promise<void>`
- `callOffscreen<TReq, TRes>(action: string, payload: TReq, opts?): Promise<TRes>` (single response)
- `callOffscreenStream<TReq, TChunk>(action: string, payload: TReq, onChunk): Promise<void>`
- `notifyOffscreen(action: string, payload?)` (fire-and-forget)
- `shutdownOffscreen(opts?): Promise<void>`
- Internal: active count, idle timer, mutex to avoid duplicate creates.

### Offscreen Bridge API (background-facing)

- Handles actions:
  - `PING` → pong result `{ now, ready: workerReady }`
  - `INIT_MODEL` → initialize worker model (idempotent)
  - `EMBED_TEXT_BATCH` → forward to worker; stream progress optionally
  - `SEARCH_HYBRID` → forward to worker; return grouped results
  - `CLOSE` → dispose worker and `self.close()`; background then calls `closeDocument()`

### Sequence Diagrams

- Ensure + Call
```
Background           Offscreen Doc               Worker
   | ensure()             |                        |
   |--------------------->|                        |
   |  created? no         |                        |
   |  createDocument()    |                        |
   |<---------------------| onload                 |
   | callOffscreen(msg)   |                        |
   |--------------------->| onMessage              |
   |                      |----postMessage-------> |
   |                      | <---message----------- |
   | <----sendResponse----|                        |
```

- Idle Teardown
```
Background           Offscreen Doc               Worker
   | (no jobs)           |                        |
   | idleTimer fires     |                        |
   | send CLOSE          |----------------------->|
   |                      |  terminate worker     |
   |                      |  self.close()         |
   | closeDocument() <---|                        |
```


### Essential Snippets

- Ensure Offscreen (background):
```ts
async function ensureOffscreenDocument() {
  const exists = await chrome.offscreen.hasDocument?.();
  if (exists) return;
  await chrome.offscreen.createDocument({
    url: "offscreen/index.html",
    reasons: ["BLOBS", "WORKERS"],
    justification: "Embedding model runs in Web Worker with BLOB artifacts; no UI"
  });
}
```

- Post + Await Response:
```ts
function callOffscreen(action, payload) {
  const requestId = crypto.randomUUID();
  return new Promise(async (resolve, reject) => {
    await ensureOffscreenDocument();
    const onMessage = (msg) => {
      if (msg?.requestId !== requestId) return;
      if (msg.final || (!msg.progress && msg.ok)) chrome.runtime.onMessage.removeListener(onMessage);
      if (msg.ok && msg.result !== undefined && (msg.final ?? true)) resolve(msg.result);
      else if (!msg.ok) reject(new Error(msg.error?.message || "Offscreen error"));
    };
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.runtime.sendMessage({ requestId, action, payload });
  });
}
```

- Offscreen Bridge skeleton:
```ts
let worker; let ready = false;
self.addEventListener('unload', () => worker?.terminate());

async function ensureWorker() {
  if (worker) return; 
  worker = new Worker(chrome.runtime.getURL('workers/embed-worker.js'), { type: 'module' });
  worker.onmessage = (e) => chrome.runtime.sendMessage(e.data);
}

chrome.runtime.onMessage.addListener(async (msg) => {
  await ensureWorker();
  if (msg.action === 'PING') return chrome.runtime.sendMessage({ requestId: msg.requestId, ok: true, result: { ready } });
  if (msg.action === 'CLOSE') { worker?.terminate(); ready = false; self.close(); return; }
  worker.postMessage(msg);
});
```


### Error Handling

- Timeouts at background call site (e.g., 60s) with abort controller; background cleans up listener on timeout.
- Offscreen isolates worker errors, catches and forwards `{ ok: false, error }` up.
- If offscreen unexpectedly closes, background retries `ensureOffscreenDocument()` and re-sends idempotent requests.

### Acceptance Criteria

- Offscreen doc is created only on first need; not present after idle period with no pending work.
- Reasons include `BLOBS` and `WORKERS`, justification set.
- Requests receive correlated responses; no cross-talk between simultaneous requests.
- Batching: `EMBED_TEXT_BATCH` returns embeddings matching input order; large inputs processed in chunks.
- Streaming supported for long ops (optional progress events) without blocking other requests.
- Teardown path: `shutdownOffscreen()` sends `CLOSE`, offscreen terminates worker, background calls `closeDocument()`.
- Robust to service worker restarts: first call after restart re-creates offscreen and succeeds.
- No UI is shown; offscreen HTML is minimal, loads `bridge.ts` only.

### Out-of-Scope (now)

- Actual model loading and embedding logic (handled in `workers/embed-worker.ts`).
- Persistent job queue and retry policies (handled by background scheduler).

### To-dos

- [ ] Add background offscreen module with ensure, call, stream, shutdown APIs
- [ ] Create offscreen HTML hosting bridge.ts module script
- [ ] Implement offscreen bridge routing to dedicated Worker
- [ ] Implement idle timer + teardown policy and closeDocument
- [ ] Support batching and optional streaming in protocol
- [ ] Add timeouts, error propagation, and restart resilience