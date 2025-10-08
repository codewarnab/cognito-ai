# MiniSearch Sparse Index

This module provides a sparse text search index using [MiniSearch](https://github.com/lucaong/minisearch) with full persistence, size management, and rebuild capabilities.

## Features

- **Incremental Updates**: Add/update/remove documents with automatic coalescing
- **Automatic Persistence**: Saves to IndexedDB every N mutations (configurable, default 10)
- **Size Management**: Enforces size cap (~20MB) with automatic truncation and eviction
- **Non-blocking Operations**: Uses micro-batching and yielding to avoid blocking the UI
- **Restore on Startup**: Automatically restores index from IndexedDB
- **Version-based Rebuilds**: Detects version mismatches and triggers rebuilds
- **Full-text Search**: Supports prefix search, fuzzy matching, and field boosting

## Architecture

The MiniSearch index runs in the **offscreen document context** (not in a worker) to have direct access to IndexedDB. The offscreen bridge handles routing MiniSearch commands from the background service worker.

### Message Flow

```
Background Service Worker
  ↓ (Chrome runtime message)
Offscreen Bridge
  ↓ (direct function call)
MiniSearch Module (src/search/minisearch.ts)
  ↓ (IndexedDB operations)
Database (src/db/index.ts)
```

## Configuration

All configuration is in `src/constants.ts`:

```typescript
export const MINISEARCH_CONFIG = {
    INDEX_VERSION: 1,              // Bump to trigger rebuild
    PERSIST_EVERY_N: 10,           // Save after N mutations
    TRUNCATION_TOKENS: 2000,       // Max tokens per text field
    SIZE_CAP_BYTES: 20 * 1024 * 1024, // ~20MB size limit
    INDEX_FIELDS: ['title', 'text'],
    STORE_FIELDS: ['id', 'url', 'title', 'text'],
    SEARCH_OPTIONS: {
        prefix: true,               // Enable prefix search
        fuzzy: 0.2,                // Fuzzy matching threshold
        boost: { title: 2.0 },     // Boost title matches
    },
};
```

## API Usage

### From Background Service Worker

Send messages through the offscreen bridge:

```typescript
// Initialize
await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_INIT',
});

// Add/update documents
await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_ADD_OR_UPDATE',
    payload: {
        docs: [
            { id: '1', url: 'https://...', title: 'Title', text: 'Content' },
        ],
    },
});

// Search
const response = await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_SEARCH',
    payload: {
        query: 'search terms',
        options: { limit: 50 },
    },
});

// Get stats
const stats = await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_STATS',
});

// Rebuild from database
await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_REBUILD',
});
```

### Direct API (in offscreen context)

```typescript
import {
    initMiniSearch,
    addOrUpdateDocs,
    removeDocs,
    search,
    persist,
    getStats,
    clearIndex,
    rebuildFromPages,
} from './search/minisearch';

// Initialize
await initMiniSearch();

// Add documents
await addOrUpdateDocs([
    { id: '1', url: 'https://...', title: 'Title', text: 'Content' },
]);

// Search
const results = await search('query', { limit: 50 });

// Force persist
await persist(true);

// Get statistics
const stats = await getStats();

// Rebuild from pages in database
await rebuildFromPages();

// Clear index
await clearIndex();
```

## Persistence Strategy

1. **Incremental Persistence**: Index is saved to IndexedDB every N=10 mutations (adds/updates/removes)
2. **Manual Persistence**: Can force immediate persistence with `persist(true)`
3. **Storage Format**: Serialized as JSON string with metadata (docCount, persistedAt, approxBytes)
4. **Size Cap Enforcement**: If serialized size exceeds ~20MB:
   - First, text fields are truncated during indexing
   - If still over cap, oldest 20% of documents are evicted

## Restore & Rebuild

### On Startup
1. Attempt to load saved index from IndexedDB
2. Check version match (`INDEX_VERSION` in constants)
3. If version matches: restore and use
4. If version mismatch or corrupt: create empty index and mark `needsRebuild`

### Rebuild Trigger
- Version mismatch (e.g., after changing tokenization/scoring)
- Manual rebuild via `MINISEARCH_REBUILD` action
- Rebuild iterates over all pages in `pages` store and re-indexes

### Rebuild Process
1. Clear existing index
2. Iterate pages in batches (100 per batch)
3. Convert pages to documents: `{ id: pageId, url, title, text: description }`
4. Add batches incrementally with yielding
5. Force persist after completion
6. Mark `needsRebuild = false`

## Size Management

### Truncation
Text fields are truncated during indexing:
- `text`: max ~2000 tokens (~1538 words)
- `title`: max ~200 tokens (~154 words)

Approximation: 1.3 tokens per word

### Eviction
When serialized index exceeds `SIZE_CAP_BYTES`:
1. Remove 20% of documents (oldest by insertion order as proxy)
2. Re-serialize and persist
3. Log eviction count

## Non-blocking Operations

All heavy operations use chunking and yielding:
- **Micro-batching**: Process 50 docs per batch
- **Yielding**: `setTimeout(0)` every 100 docs to avoid blocking
- **Rebuild**: Processes pages in batches of 100 with progress logging every 500 docs

## Testing

Comprehensive test suite in `src/search/__tests__/minisearch.spec.ts`:

```typescript
import { runAllTests } from './search/__tests__/minisearch.spec';

await runAllTests();
```

Test coverage:
- ✅ Basic operations (add, search, boost)
- ✅ Incremental updates (overwrite by ID)
- ✅ Document removal
- ✅ Manual persistence and restore
- ✅ Auto-persistence trigger (after N=10)
- ✅ Text truncation for long content
- ✅ Rebuild from pages store
- ✅ Stats reporting

## Integration Points

### Background Service Worker (`src/background.ts`)
- Initialize offscreen document on startup
- Route MiniSearch commands via bridge
- Handle model readiness gates

### Offscreen Bridge (`src/offscreen/bridge.ts`)
- Initialize MiniSearch on document load
- Route `MINISEARCH_*` actions to module
- Handle errors and send responses

### Database (`src/db/index.ts`)
- `saveMiniSearchIndex()`: Save serialized index with metadata
- `loadMiniSearchIndex()`: Load saved index by version
- `deleteMiniSearchIndex()`: Clear stored index
- `iterateAllPages()`: Yield pages in batches for rebuilds

### History UI (`src/pages/history.tsx` - planned)
- Display search results
- Show index stats (doc count, size, last persisted)
- Show "rebuilding" state when `needsRebuild = true`
- Provide "Rebuild Index" and "Clear Index" actions

## Performance

- **Indexing**: ~1000 docs/sec (depends on text length)
- **Search**: <10ms for typical queries on 10k docs
- **Persistence**: ~100-200ms for 10k docs (~5MB serialized)
- **Rebuild**: ~5-10 seconds for 10k pages with yielding

## Future Enhancements

- [ ] Track lastUpdated per document for better eviction strategy
- [ ] Implement incremental backup/restore for large indexes
- [ ] Add support for stop words and custom tokenizers
- [ ] Provide search result highlighting/snippets
- [ ] Add search analytics (query performance, popular queries)
