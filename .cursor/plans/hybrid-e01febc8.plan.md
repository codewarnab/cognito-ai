<!-- e01febc8-d9ec-4391-b82a-51fbe8dc3613 a750ee49-0723-4fa0-83a8-4cb03c231e3f -->
# Hybrid Search Pipeline — Design Plan

## Scope

Implement query-time hybrid search: compute query embedding (worker), MiniSearch sparse query, normalize to [0,1], combine α=0.6 dense / 0.4 sparse, merge by `chunkId`, sort, group by URL, and select top snippet. Brute-force cosine for <10k chunks; interface ready for HNSW.

## Files

- `src/search/dense.ts`: Dense index interfaces + brute-force implementation, query embedding helper.
- `src/search/hybrid.ts`: Hybrid orchestration (normalize, merge, group).
- `src/search/types.ts`: Result and message types shared by worker/UI.
- `src/search/__tests__/hybrid.test.ts`: Acceptance tests (determinism, correctness, latency budget, grouping).

## Core APIs

- `src/search/dense.ts`
  - `export interface DenseIndex { search(embedding: Float32Array, opts?: { topK?: number; overfetch?: number }): Array<{ chunkId: string; scoreDense: number }>; size(): number }`
  - `export class BruteForceDenseIndex implements DenseIndex { constructor(source: Iterable<{ chunkId: string; url: string; embedding: Float32Array }>) }`
  - `export async function computeQueryEmbedding(query: string, opts?: { worker?: Worker; timeoutMs?: number }): Promise<Float32Array>`

- `src/search/hybrid.ts`
  - `export type SparseHit = { chunkId: string; url: string; scoreSparse: number }`
  - `export function normalizeDense(cos: number): number`  // maps [-1, 1] → [0,1]
  - `export function normalizeSparse(hits: SparseHit[]): Map<string, number>` // max-based scaling to [0,1]
  - `export function hybridSearch(params: { query: string; denseIndex: DenseIndex; miniSearch: MiniSearch; alpha?: number; topK?: number; overfetch?: number; worker?: Worker; }): Promise<GroupedResults>`

- `src/search/types.ts`
  - `export type ChunkResult = { chunkId: string; url: string; title?: string; snippet?: string; scoreDense: number; scoreSparse: number; score: number }`
  - `export type UrlGroup = { url: string; title?: string; faviconUrl?: string; bestScore: number; bestSnippet?: string; topChunks: ChunkResult[] }`
  - `export type GroupedResults = { query: string; alpha: number; groups: UrlGroup[]; stats: { totalChunksScanned: number; denseMs: number; sparseMs: number; mergeMs: number } }`

## Algorithms

- Dense cosine: `cos(a,b) = (a·b) / (||a||·||b||)`; inputs are L2-normalized at ingestion; query embedding L2-normalized before search.
- Normalization:
  - Dense: `normalizeDense = (cos + 1) / 2`. Deterministic and corpus-independent ⇒ reproducible across runs.
  - Sparse: scale per-query by maximum MiniSearch score: `scoreSparseNorm = raw / maxRaw`. If no hits, map to 0.
- Combination: `score = alpha * denseNorm + (1 - alpha) * sparseNorm` with default `alpha = 0.6`.
- Merge: join by `chunkId`. For missing side, use 0. Input sets: `denseTopN` from dense index with `overfetch = topK * 3`, `sparseHits` from MiniSearch with similar overfetch. Build a union keyset of `chunkId`.
- Sorting: descending by `score` (stable secondary sort by `scoreDense` then `chunkId`). Take `topK`.
- Grouping: map results by `url`. For each URL, compute `bestScore` and `bestSnippet` from the highest-scoring chunk (first line/trimmed snippet present). Return `groups` sorted by `bestScore`.

## Worker Integration

- `computeQueryEmbedding` posts `{type:"embed-query", query}` to the offscreen/worker bridge and awaits a `Float32Array` result. Timeout default 1,000 ms with abort.
- `DenseIndex` remains in-memory within the worker (preferred) or reconstructed from IndexedDB on demand in the offscreen context.
- Hybrid orchestrator callable from UI page by messaging the offscreen document or by direct import if running in the offscreen context.

## Latency Targets (P95 on <10k chunks, 384-d dims, desktop)

- Dense brute-force: ≤ 15 ms per 1k chunks (≤ 150 ms @ 10k)
- MiniSearch sparse: ≤ 30 ms
- Merge + group: ≤ 15 ms
- End-to-end hybrid: ≤ 220 ms

## Determinism & Reproducibility

- All normalizations are pure and query-local.
- Sorting uses explicit stable tiebreakers.
- Alpha fixed by caller; default 0.6.
- No time-based randomness; tests seed fixed inputs.

## Essential Snippets

- Normalization and combine (illustrative):
```1:16:src/search/hybrid.ts
export function normalizeDense(cos: number) { return (cos + 1) / 2 }
export function normalizeSparse(hits: SparseHit[]) {
  let max = 0
  for (const h of hits) max = Math.max(max, h.scoreSparse)
  const map = new Map<string, number>()
  if (max === 0) return map
  for (const h of hits) map.set(h.chunkId, h.scoreSparse / max)
  return map
}
```


## Acceptance Tests (`src/search/__tests__/hybrid.test.ts`)

- Deterministic scores: same inputs ⇒ identical outputs.
- Normalization correctness: dense [-1,1]→[0,1]; sparse max→1.0.
- Merge correctness: union by `chunkId`; zeros on missing side; proper weighting.
- Ranking stability: tie cases resolved by `scoreDense` then `chunkId`.
- Grouping: chunks grouped by URL; `bestSnippet` and `bestScore` match highest chunk.
- Latency: synthetic index (10k vectors, 384 dims) completes hybrid ≤ 220 ms (skip in CI if environment lacks SIMD; include threshold guard and mark as performance test).

## Ready for HNSW Swap

- Keep `DenseIndex` interface stable; add `HnswDenseIndex` later implementing `search`.
- Construction of index behind factory: `createDenseIndex(kind: "brute" | "hnsw", source)` with default `"brute"`.

## Notes / Constraints

- Use Float32Array throughout; ensure L2 normalization at ingestion and for query.
- Avoid allocations in hot loops (reuse temp arrays, typed views).
- Parameterize `topK` and `overfetch` (defaults: 20, 60).

### To-dos

- [ ] Add search result types in src/search/types.ts
- [ ] Implement BruteForceDenseIndex and DenseIndex API
- [ ] Wire computeQueryEmbedding via worker bridge
- [ ] Implement normalize, merge, group in hybrid.ts
- [ ] Write hybrid acceptance tests and perf guard