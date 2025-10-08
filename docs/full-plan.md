<!-- 723746ed-1ca0-41ec-b9b5-6d51a5068d5b 9aa00f5e-1d66-4328-b218-b3da5723e8f4 -->
# Private, On‑Device History Search — Implementation Plan

## Architecture

- **MV3 roles**: `background` (queue/scheduler), `content scripts` (extract light metadata + capture), **offscreen document + web worker** (model load, chunking, embeddings, indexing), `pages/history` (UI for search).
- **Storage**: IndexedDB (pages, chunks, images, settings, miniSearch index JSON); Cache Storage for model files; `chrome.storage.local` for small flags (modelVersion).
- **Privacy**: No network during operation; only first‑run model download from `MODEL_BASE_URL`. No image bytes leave device. Extraction honors per‑site pause and per‑tab opt‑out.

## Permissions & Manifest (Plasmo manifest field in package.json)

- Add: `storage`, `offscreen`, `unlimitedStorage`, `scripting`, `alarms`.
- Keep: `tabs`, `host_permissions: <all_urls>`.

## Files to Add/Change

- Add `src/constants.ts`: model/version, chunk sizes, score weights.
- Update `src/background.ts`: handle `chrome.runtime.onInstalled`; model bootstrap; job queue; offscreen lifecycle; alarms.
- Add `src/background/offscreen.ts`: create/ensure offscreen document; message bridge.
- Add `src/offscreen/index.html` + `src/offscreen/bridge.ts`: spins a `Worker` for embeddings and proxies messages.
- Add `src/workers/embed-worker.ts`: load tokenizer+model, chunking, batching, embeddings, ANN (BF for <10k); write to IndexedDB.
- Replace `src/contents/plasmo.ts` with `src/contents/extract.ts`: match `<all_urls>`, collect url/title/meta/limited body; extract image captions from alt/figcaption/near text; send lightweight metadata to background; schedule full capture later.
- Add `src/db/index.ts`: IndexedDB schema and helpers (pages, chunks, images, settings, miniSearch JSON). Consider `idb` lib.
- Add `src/search/minisearch.ts`: MiniSearch setup, serialization, periodic persist/restore.
- Add `src/search/dense.ts`: cosine similarity, optional HNSW for future; hybrid scorer.
- Add `src/pages/history.tsx`: full‑page UI with query input, filtering, grouped results, open links.
- Update `src/popup.tsx`: button to "Open History Search" (opens `chrome.runtime.getURL("tabs/history.html")`).

## One‑time Model Download (Choice 1.b)

- On `onInstalled`: fetch model assets list (e.g., `model.onnx`, `tokenizer.json`, `vocab.txt`, `config.json`), store in Cache Storage under `model/<version>/...` and set `modelVersion` in `chrome.storage.local`.
- Guard all embedding calls on model readiness; if missing/outdated, background re‑hydrates via the same fetch.

## Content Extraction (document_idle)

- Capture: url, title, meta description; body text limited (e.g., 50–150 KB), simplified via DOM selection + readability heuristic.
- Images: collect `{src, alt, figcaption, nearbyText}` only (no fetch). Build best caption preferring alt > figcaption > nearby text.
- Post a minimal `PageSeen` message to background; defer heavy work.

## Queue & Scheduling

- Background maintains FIFO queue keyed by url+timestamp; coalesce rapid updates.
- Use `chrome.alarms` (e.g., every 1–2 minutes) and `idle` windows; when ready, ensure offscreen is created → send batch jobs.
- Offscreen document holds the `Worker`; worker keeps model in memory; process with `requestIdleCallback`/chunked batches; write to IndexedDB incrementally.

## Tokenizer‑aware Chunking

- Preferred: tokenizer length; window 240 tokens, stride 200 (40 overlap). Fallback: ~200 words, 40–50 overlap.
- Persist: `{chunkId, url, chunkIndex, tokenLength, textSnippetStart, text}`.

## Embedding Pipeline

- Use Transformers.js or ONNX Runtime Web to load quantized `all-MiniLM-L6-v2`.
- Batch 8–16 chunks per call; mean‑pool + L2 normalize; store `Float32Array` buffer in IndexedDB `chunks` store.

## Indexing

- Maintain:
  - MiniSearch inverted index fields: `{id, url, title, text}`; persist `toJSON()` after every N=10 updates in `settings` or dedicated store.
  - Dense chunk store: embeddings + metadata in `chunks`.
- Cap per page at 50 chunks to limit growth; evict old chunkIds on overflow.

## Dense Search & ANN

- <10k chunks: brute‑force cosine in worker over typed arrays.
- Future: optional HNSW WASM; keep index synchronized with additions/deletes.

## Query Time (Hybrid)

- Compute query embedding in worker; run `miniSearch.search(query, opts)`; normalize scores (sparse/ dense to [0,1]); combine with α=0.6 (dense) / 0.4 (sparse); merge by chunkId; sort; group by URL.
- Return grouped results with top snippet and per‑group max score.

## UI/UX (`src/pages/history.tsx`)

- Inputs: query, source filters (domain/date), privacy toggle (pause capture globally), clear index button.
- Results: grouped by URL; show title, favicon, top snippets; open in new tab; per‑site pause (domain allow/deny list).
- Empty‑state guidance when model not ready or index empty.

## Data Model (IndexedDB)

- `pages` (key: url+date): `{url, title, description, firstSeen, lastUpdated}`
- `chunks` (key: chunkId): `{chunkId, url, chunkIndex, tokenLength, text, embedding(ArrayBuffer)}` + index on `url`.
- `images` (key: imageId): `{imageId, url, pageUrl, captionText}`
- `miniSearchIndex` (key: version): `{json}`
- `settings`: `{modelVersion, paused, domainAllowlist, domainDenylist, lastMiniSearchPersistAt}`

## Telemetry & Privacy

- No external calls except first‑run model fetch. Clear, opt‑in prompts for any future remote features (none implemented here).
- Provide one‑click "Pause collection" and "Delete all data" in History page.

## Error Handling & Upgrades

- Model versioning gate; on version change: re‑embed only as needed (lazy re‑embed when pages are queried or in background idle cycles).
- Robust against service worker restarts (queue persisted in IndexedDB).

## Essential Snippets (illustrative)

- Ensure history page from popup:
```startLine:endLine:src/popup.tsx
// window.open(chrome.runtime.getURL("tabs/history.html"), "_blank")
```

- Ensure offscreen document:
```startLine:endLine:src/background/offscreen.ts
// await chrome.offscreen.createDocument({ url: "offscreen/index.html", reasons: ["BLOBS", "WORKERS"], justification: "Embedding work" })
```


## Testing Checklist

- First‑run model download and caching; offline behavior afterwards.
- Extraction on multiple sites; queue coalescing.
- Chunking bounds; batch sizes; memory caps.
- Hybrid scoring sanity; result grouping; UI interactions.
- Pause/clear flows; per‑domain opt‑out.

### To-dos

- [ ] Add required permissions and host permissions to manifest
- [ ] Implement onInstalled one-time model download and versioning
- [ ] Create offscreen document and embed worker bridge
- [ ] Build content script for text+image caption extraction
- [ ] Implement IndexedDB schema and helpers
- [ ] Tokenizer-aware chunking, batching, embeddings in worker
- [ ] MiniSearch sparse index + dense store + persistence
- [ ] Build history search page UI with hybrid search
- [ ] Add popup CTA to open history page
- [ ] Add pause, allow/deny lists, clear data
- [ ] Test flows offline/online, scaling, and error handling