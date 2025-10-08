# Dexie IndexedDB Layer

Complete IndexedDB implementation using Dexie for the History Search extension.

## Features

- **Typed Database Interface**: Full TypeScript support with interfaces for all record types
- **Schema Versioning**: Four schema versions (v1-v4) with automatic migrations
- **Efficient Storage**: Float32Array embeddings stored as ArrayBuffer
- **Bulk Operations**: Optimized batch writes with configurable batch sizes
- **Quota Management**: Automatic eviction policies and quota error handling
- **Queue System**: Priority-based job queue with FIFO ordering
- **Persistence**: Requests persistent storage via Storage API

## Database Schema

### Stores

#### pages
- **Key**: `pageId` (string, format: `${urlHash}-${firstSeenEpoch}`)
- **Indexes**: url, domain, firstSeen, lastUpdated, lastAccessed
- **Purpose**: Store page metadata and timestamps

#### chunks
- **Key**: `chunkId` (string, format: `${pageId}-${chunkIndex}`)
- **Indexes**: url, pageId, chunkIndex, tokenLength, createdAt, lastAccessed
- **Purpose**: Store text chunks with embeddings for semantic search
- **Special**: embeddings stored as ArrayBuffer (converted from Float32Array)

#### images
- **Key**: `imageId` (string, format: `${pageId}-${seq}`)
- **Indexes**: pageUrl, pageId
- **Purpose**: Store image metadata with optional captions

#### miniSearchIndex
- **Key**: `version` (number)
- **Purpose**: Persist hybrid search index (string or Uint8Array)

#### settings
- **Key**: `key` (string)
- **Purpose**: Store configuration and metadata

#### queue
- **Key**: `id` (string, UUID)
- **Indexes**: type, status, priority, createdAt, updatedAt
- **Purpose**: Job queue for background processing

### Schema Versions

#### v1 (Initial)
- Created pages, chunks, images, settings stores
- Basic indexes for lookups

#### v2
- Added miniSearchIndex store for hybrid search persistence

#### v3
- Added queue store for background job management
- Migration backfills defaults (status='pending', priority=0)

#### v4
- Added lastAccessed field to pages and chunks for LRU eviction
- Migration sets lastAccessed from existing timestamps

## API Reference

### Initialization

```typescript
import { openDb, resetDatabase } from './db';

// Get singleton database instance
const db = await openDb();

// Reset database (delete all data)
await resetDatabase();
```

### Page APIs

```typescript
// Insert or update a page
await upsertPage({
  pageId: 'abc123-1704067200000',
  url: 'https://example.com',
  domain: 'example.com',
  title: 'Example Page',
  firstSeen: Date.now(),
  lastUpdated: Date.now(),
  lastAccessed: Date.now()
});

// Get page by ID
const page = await getPageById('abc123-1704067200000');

// Get latest page for URL
const latest = await getLatestPageByUrl('https://example.com');

// List pages by domain
const pages = await listPagesByDomain('example.com', 10);

// Update lastAccessed timestamp
await touchPage('abc123-1704067200000');

// Delete pages and associated data
const deleted = await deletePages(['pageId1', 'pageId2']);
```

### Chunk APIs

```typescript
// Bulk insert chunks with embeddings
const chunks: ChunkRecord[] = [
  {
    chunkId: 'abc123-1704067200000-0',
    url: 'https://example.com',
    pageId: 'abc123-1704067200000',
    chunkIndex: 0,
    tokenLength: 150,
    text: 'Chunk text content...',
    embedding: new Float32Array([0.1, 0.2, ...]).buffer,
    createdAt: Date.now(),
    lastAccessed: Date.now()
  }
];
await bulkPutChunks(chunks);

// Get all chunks for a page (sorted by index)
const chunks = await listChunksByPage('abc123-1704067200000');

// Stream all embeddings for vector search
for await (const {chunkId, embedding} of streamAllChunkEmbeddings()) {
  // embedding is Float32Array
  console.log(chunkId, embedding.length);
}

// Evict old chunks, keep newest N
const evicted = await evictChunksForPage('abc123-1704067200000', 50);

// Update lastAccessed for chunks
await touchChunks(['chunkId1', 'chunkId2']);
```

### Image APIs

```typescript
// Bulk insert images
await bulkPutImages([
  {
    imageId: 'abc123-1704067200000-img-0',
    url: 'https://example.com/image.jpg',
    pageUrl: 'https://example.com',
    pageId: 'abc123-1704067200000',
    captionText: 'Image caption'
  }
]);

// Get all images for a page
const images = await listImagesByPage('abc123-1704067200000');
```

### MiniSearch Index APIs

```typescript
// Save index (as string or Uint8Array)
await saveMiniSearchIndex(1, JSON.stringify(indexData));
await saveMiniSearchIndex(2, new Uint8Array([...]));

// Load index
const index = await loadMiniSearchIndex(1);
```

### Settings APIs

```typescript
// Set a setting
await setSetting('myKey', { foo: 'bar' });

// Get a setting with type inference
const value = await getSetting<{foo: string}>('myKey');
```

### Queue APIs

```typescript
// Enqueue a job
const jobId = await enqueue({
  type: 'embedding',
  status: 'pending',
  priority: 10,
  payload: { pageId: 'abc123-1704067200000' },
  attempts: 0
});

// Dequeue next job (by priority, then FIFO)
const job = await dequeue(['embedding', 'indexing']);

// Mark job as done
await markDone(jobId);

// Mark job as failed
await markFailed(jobId, 'Error message');
```

### Quota & Eviction APIs

```typescript
// Manually check and evict if over quota
await checkAndEvictIfNeeded();

// Globally evict old chunks, keep N per page
const evicted = await evictChunksGlobally(50);

// Get database statistics
const stats = await getDbStats();
// { pageCount, chunkCount, imageCount, queueCount }
```

### Utility APIs

```typescript
// Convert Float32Array to ArrayBuffer for storage
const buffer = embeddingToBuffer(new Float32Array([...]));

// Convert ArrayBuffer back to Float32Array
const embedding = bufferToEmbedding(buffer);
```

## Configuration

Edit `src/constants.ts` to adjust:

- `MAX_CHUNKS_PER_PAGE`: Max chunks to keep per page (default: 50)
- `MAX_PAGES`: Global page limit before eviction (default: 10,000)
- `MAX_CHUNKS`: Global chunk limit before eviction (default: 100,000)
- `BULK_BATCH_SIZE`: Records per bulk operation (default: 1,000)
- `EVICTION_PERCENTAGE`: % to remove when over quota (default: 0.2)

## Quota Management

The database automatically handles quota exceeded errors:

1. **Detection**: Catches `QuotaExceededError` during bulk operations
2. **Eviction**: Removes oldest items by `lastAccessed` timestamp
3. **Strategy**: 
   - Removes items over caps + eviction percentage
   - Deletes pages with all associated chunks/images
   - Deletes standalone old chunks
4. **Retry**: Automatically retries operation after eviction

Manual eviction can be triggered via `checkAndEvictIfNeeded()`.

## Performance Considerations

- **Bulk Operations**: All bulk APIs split large arrays into batches (1k records) to avoid blocking
- **Transactions**: Multi-table operations use transactions for consistency
- **Indexes**: Carefully chosen indexes for common queries (url, domain, pageId)
- **Streaming**: `streamAllChunkEmbeddings()` uses async generator to avoid loading all embeddings into memory

## Migration Safety

- **Additive**: Schema changes are additive; new fields get defaults
- **Backfill**: Upgrade functions backfill missing fields from existing data
- **Version Guard**: Always check `db.verno` if needed for feature flags
- **Recovery**: `resetDatabase()` available for unrecoverable corruption

## Manual Acceptance Checklist

Use this checklist to verify the implementation:

### ✅ Basic Functionality

- [ ] **First Open**: Database opens successfully on first run, creates all stores
- [ ] **Subsequent Opens**: Database opens quickly on subsequent runs (no recreation)
- [ ] **Schema Version**: Database reports correct version (v4)

### ✅ Page Operations

- [ ] **Insert**: Can insert new page records with `upsertPage()`
- [ ] **Update**: Can update existing page with same `pageId`
- [ ] **Retrieve by ID**: `getPageById()` returns correct page
- [ ] **Retrieve by URL**: `getLatestPageByUrl()` returns most recent page
- [ ] **List by Domain**: `listPagesByDomain()` filters correctly
- [ ] **Touch**: `touchPage()` updates `lastAccessed` timestamp
- [ ] **Delete**: `deletePages()` removes pages and cascades to chunks/images

### ✅ Chunk Operations

- [ ] **Bulk Insert**: `bulkPutChunks()` writes 1k+ chunks without errors
- [ ] **Embedding Storage**: Embeddings stored as ArrayBuffer, retrieved as Float32Array
- [ ] **Embedding Accuracy**: Retrieved embeddings match original values
- [ ] **List by Page**: `listChunksByPage()` returns chunks in order
- [ ] **Stream Embeddings**: `streamAllChunkEmbeddings()` yields all chunks without memory issues
- [ ] **Eviction**: `evictChunksForPage()` keeps newest N, deletes rest
- [ ] **Touch**: `touchChunks()` updates `lastAccessed` for multiple chunks

### ✅ Image Operations

- [ ] **Bulk Insert**: `bulkPutImages()` writes multiple images
- [ ] **List by Page**: `listImagesByPage()` returns correct images

### ✅ MiniSearch Index

- [ ] **Save String**: Can save index as JSON string
- [ ] **Save Binary**: Can save index as Uint8Array
- [ ] **Load**: Retrieved data matches saved data
- [ ] **Large Index**: Can persist several MB index without errors

### ✅ Settings

- [ ] **Set/Get**: Can store and retrieve settings
- [ ] **Type Safety**: Generic type parameter works correctly
- [ ] **Missing Key**: Returns undefined for non-existent keys

### ✅ Queue

- [ ] **Enqueue**: Creates jobs with UUID and timestamps
- [ ] **Priority**: `dequeue()` returns highest priority job first
- [ ] **FIFO**: Within same priority, returns oldest job first
- [ ] **Type Filter**: `dequeue(['type1'])` only returns matching types
- [ ] **Mark Done**: `markDone()` updates status correctly
- [ ] **Mark Failed**: `markFailed()` increments attempts, stores error

### ✅ Quota & Eviction

- [ ] **Auto Eviction**: On QuotaExceededError, automatically evicts old data
- [ ] **Retry**: Successfully completes operation after eviction
- [ ] **Manual Check**: `checkAndEvictIfNeeded()` triggers when over caps
- [ ] **Global Eviction**: `evictChunksGlobally()` prunes chunks across all pages
- [ ] **LRU**: Eviction removes least-recently-accessed items first

### ✅ Migrations

- [ ] **v1→v2**: Adds miniSearchIndex store, preserves existing data
- [ ] **v2→v3**: Adds queue store, backfills defaults
- [ ] **v3→v4**: Adds lastAccessed fields with sensible defaults
- [ ] **Data Integrity**: All migrations preserve and correctly backfill data

### ✅ Error Handling

- [ ] **Quota Error**: Handles QuotaExceededError gracefully
- [ ] **Missing Records**: Returns undefined for non-existent records
- [ ] **Invalid Keys**: Doesn't crash on invalid lookup keys
- [ ] **Reset**: `resetDatabase()` deletes and recreates successfully

### ✅ Performance

- [ ] **Bulk Writes**: 1k chunks insert in <1s (non-blocking)
- [ ] **Large Dataset**: Works with 10k+ pages and 100k+ chunks
- [ ] **No UI Blocking**: Operations don't freeze UI thread
- [ ] **Index Queries**: Domain/URL lookups complete quickly

### ✅ Browser Compatibility

- [ ] **Chrome**: Works in Chrome with MV3 extension
- [ ] **Persistence**: Requests persistent storage (check console log)
- [ ] **Storage API**: Handles missing `navigator.storage.persist()` gracefully

## Testing Tips

```typescript
// Test with sample data
async function testDatabase() {
  // 1. Open database
  const db = await openDb();
  
  // 2. Insert test page
  await upsertPage({
    pageId: 'test-page',
    url: 'https://test.com',
    domain: 'test.com',
    title: 'Test Page',
    firstSeen: Date.now(),
    lastUpdated: Date.now(),
    lastAccessed: Date.now()
  });
  
  // 3. Insert test chunks with embeddings
  const embedding = new Float32Array(384).fill(0.5);
  await bulkPutChunks([{
    chunkId: 'test-page-0',
    url: 'https://test.com',
    pageId: 'test-page',
    chunkIndex: 0,
    tokenLength: 100,
    text: 'Test chunk',
    embedding: embedding.buffer,
    createdAt: Date.now(),
    lastAccessed: Date.now()
  }]);
  
  // 4. Verify retrieval
  const page = await getPageById('test-page');
  const chunks = await listChunksByPage('test-page');
  
  console.log('Page:', page);
  console.log('Chunks:', chunks);
  console.log('Embedding length:', new Float32Array(chunks[0].embedding).length);
  
  // 5. Test stats
  const stats = await getDbStats();
  console.log('Stats:', stats);
}
```

## Troubleshooting

### Database Won't Open
- Check browser console for errors
- Try `resetDatabase()` to recreate
- Verify Dexie is installed: `pnpm list dexie`

### Quota Exceeded Despite Eviction
- Check `DB_CAPS` in constants
- Manually trigger: `await checkAndEvictIfNeeded()`
- Verify `unlimitedStorage` permission in manifest.json

### Migration Errors
- Check console for migration logs
- Verify all upgrade functions have try/catch
- Use `resetDatabase()` as last resort (deletes data)

### Slow Performance
- Reduce `BULK_BATCH_SIZE` if blocking UI
- Add indexes for frequently queried fields
- Use transactions for multi-table operations

## License

Part of the Chrome AI History Search Extension
