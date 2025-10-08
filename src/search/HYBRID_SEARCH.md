# Search Module

Query-time hybrid search combining dense (embedding-based) and sparse (MiniSearch full-text) retrieval.

## Architecture

```
┌──────────────┐
│ User Query   │
└──────┬───────┘
       │
       ├──────────────────┬─────────────────┐
       │                  │                 │
       v                  v                 v
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Embedding    │  │ Dense Index  │  │ MiniSearch   │
│ Worker       │  │ (Brute-Force)│  │ (Sparse)     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                  │                 │
       v                  v                 v
   Float32Array      Dense Scores      Sparse Scores
                          │                 │
                          └────────┬────────┘
                                   │
                                   v
                          ┌──────────────────┐
                          │ Hybrid Merge     │
                          │ α·dense +        │
                          │ (1-α)·sparse     │
                          └────────┬─────────┘
                                   │
                                   v
                          ┌──────────────────┐
                          │ Group by URL     │
                          │ Select Best      │
                          │ Snippet          │
                          └────────┬─────────┘
                                   │
                                   v
                          ┌──────────────────┐
                          │ Ranked Results   │
                          └──────────────────┘
```

## Core Components

### 1. Dense Search (`src/search/dense.ts`)

Vector similarity search using L2-normalized embeddings.

**Interface:**
```typescript
interface DenseIndex {
  search(embedding: Float32Array, opts?: {
    topK?: number      // Default: 20
    overfetch?: number // Default: topK * 3
  }): Array<{ chunkId: string; scoreDense: number }>
  
  size(): number
}
```

**Implementations:**
- `BruteForceDenseIndex`: O(n) linear scan with dot product
- `HnswDenseIndex`: (Future) O(log n) approximate nearest neighbor

**Query Embedding:**
```typescript
// Via offscreen document
const embedding = await computeQueryEmbedding(query, {
  timeoutMs: 1000  // Default timeout
})

// Via direct worker reference
const embedding = await computeQueryEmbedding(query, {
  worker: workerInstance,
  timeoutMs: 1000
})
```

### 2. Sparse Search (`src/search/minisearch.ts`)

Full-text search with:
- Prefix matching
- Fuzzy search (Levenshtein distance)
- Field boosting (title > text)
- Incremental updates
- Persistence to IndexedDB

**API:**
```typescript
import { search } from './minisearch'

const results = await search(query, {
  limit: 50,
  fuzzy: 0.2,  // Optional fuzzy tolerance
  boost: { title: 2 }  // Optional field weights
})
```

### 3. Hybrid Orchestration (`src/search/hybrid.ts`)

Combines dense and sparse results with deterministic normalization.

**API:**
```typescript
import { hybridSearch } from './hybrid'

const results = await hybridSearch({
  query: 'machine learning',
  denseIndex,
  miniSearch,
  alpha: 0.6,        // Dense weight (0.4 for sparse)
  topK: 20,          // Final result count
  overfetch: 60,     // Candidates to merge (3× topK)
  worker,            // Optional worker instance
  metadata           // Optional chunk metadata
})
```

**Result Structure:**
```typescript
{
  query: string
  alpha: number
  groups: Array<{
    url: string
    title?: string
    faviconUrl?: string
    bestScore: number
    bestSnippet?: string
    topChunks: Array<ChunkResult>
  }>
  stats: {
    totalChunksScanned: number
    denseMs: number
    sparseMs: number
    mergeMs: number
  }
}
```

## Scoring & Normalization

### Dense Scores (Cosine Similarity)

Cosine similarity ∈ [-1, 1] normalized to [0, 1]:

```
scoreDenseNorm = (cos + 1) / 2
```

**Properties:**
- Deterministic (corpus-independent)
- Reproducible across runs
- Query-local (no global statistics)

### Sparse Scores (MiniSearch BM25)

Raw BM25 scores scaled by query max:

```
scoreSparseNorm = score / max(scores)
```

**Properties:**
- Query-local normalization
- Max score → 1.0
- Missing hits → 0.0

### Combined Score

Weighted combination:

```
score = α · scoreDenseNorm + (1 - α) · scoreSparseNorm
```

Default: **α = 0.6** (60% dense, 40% sparse)

## Ranking & Tiebreakers

Results sorted by:
1. **Combined score** (descending)
2. **Dense score** (descending, tiebreaker)
3. **Chunk ID** (lexicographic, stable tiebreaker)

Guarantees deterministic, reproducible rankings.

## URL Grouping

Chunks grouped by URL with:
- **Best score**: Highest combined score among chunks
- **Best snippet**: Snippet from highest-scoring chunk
- **Top chunks**: All chunks from URL, sorted by score

Groups sorted by best score (descending).

## Performance Targets

| Operation | Target (P95) | Notes |
|-----------|--------------|-------|
| Query embedding | ≤30 ms | Via worker bridge |
| Dense search (10k) | ≤150 ms | Brute-force, 384-dim |
| Sparse search | ≤30 ms | MiniSearch with prefix |
| Merge + group | ≤15 ms | In-memory operations |
| **End-to-end** | **≤220 ms** | Full hybrid pipeline |

## Usage Example

```typescript
import { createDenseIndex } from './dense'
import { initMiniSearch, search as sparseSearch } from './minisearch'
import { hybridSearch } from './hybrid'

// 1. Initialize indexes (one-time setup)
const chunks = await loadChunksFromDB()

const denseIndex = createDenseIndex('brute', chunks.map(c => ({
  chunkId: c.id,
  url: c.url,
  embedding: new Float32Array(c.embedding)
})))

await initMiniSearch()
await addOrUpdateDocs(chunks.map(c => ({
  id: c.id,
  url: c.url,
  title: c.title,
  text: c.text
})))

// 2. Perform hybrid search
const results = await hybridSearch({
  query: 'machine learning neural networks',
  denseIndex,
  miniSearch: getMiniSearchInstance(),
  alpha: 0.6,
  topK: 20,
  metadata: createMetadataMap(chunks)
})

// 3. Render grouped results
for (const group of results.groups) {
  console.log(`${group.title} (${group.url})`)
  console.log(`  Score: ${group.bestScore.toFixed(3)}`)
  console.log(`  Snippet: ${group.bestSnippet}`)
  console.log(`  Chunks: ${group.topChunks.length}`)
}
```

## Testing

Run acceptance tests:

```typescript
import { runAllTests } from './__tests__/hybrid.spec'

const { passed, failed } = await runAllTests()
```

Tests cover:
- ✓ Normalization correctness
- ✓ Deterministic scores
- ✓ Merge correctness (union by chunkId)
- ✓ Ranking stability (tiebreakers)
- ✓ URL grouping
- ✓ Latency budget (synthetic)

## Future Enhancements

### HNSW Index

Replace brute-force with Hierarchical Navigable Small World graph:

```typescript
const denseIndex = createDenseIndex('hnsw', chunks)
```

Expected speedup: **10-100×** for large corpora (>100k chunks)

### Query Expansion

Expand user query with synonyms/related terms:

```typescript
const expanded = await expandQuery(query)
const results = await hybridSearch({ query: expanded, ... })
```

### Re-ranking

Two-stage retrieval with cross-encoder re-ranking:

```typescript
const candidates = await hybridSearch({ query, topK: 100, ... })
const reranked = await rerank(candidates, { model: 'cross-encoder' })
```

### Faceted Search

Add filters for domain, date, content type:

```typescript
const results = await hybridSearch({
  query,
  filters: {
    domain: 'example.com',
    dateRange: [startDate, endDate],
    contentType: 'article'
  }
})
```

## References

- **MiniSearch**: https://github.com/lucaong/minisearch
- **BM25**: https://en.wikipedia.org/wiki/Okapi_BM25
- **HNSW**: https://arxiv.org/abs/1603.09320
- **Hybrid Search**: ColBERT, SPLADE, Hybrid Dense-Sparse Retrieval
