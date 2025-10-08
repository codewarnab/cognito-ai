# MiniSearch Quick Start Guide

Quick reference for using the MiniSearch sparse index in your extension code.

## From Background Service Worker

```typescript
// 1. Initialize (called once on extension startup)
const requestId = crypto.randomUUID();
await chrome.runtime.sendMessage({
    requestId,
    action: 'MINISEARCH_INIT',
});

// 2. Add documents when pages are visited
await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_ADD_OR_UPDATE',
    payload: {
        docs: [
            {
                id: 'page-123',
                url: 'https://example.com/article',
                title: 'How to Use TypeScript',
                text: 'TypeScript is a typed superset of JavaScript...',
            },
        ],
    },
});

// 3. Search (from history UI or popup)
const response = await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_SEARCH',
    payload: {
        query: 'typescript tutorial',
        options: {
            limit: 50,
            fuzzy: 0.2,
            boost: { title: 2.0 },
        },
    },
});

console.log('Search results:', response.result.results);
// [
//   {
//     id: 'page-123',
//     url: 'https://example.com/article',
//     title: 'How to Use TypeScript',
//     text: 'TypeScript is a typed...',
//     score: 12.5,
//     match: { title: ['typescript'], text: ['typescript', 'tutorial'] }
//   }
// ]

// 4. Get statistics
const statsResponse = await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_STATS',
});

console.log('Index stats:', statsResponse.result);
// {
//   docCount: 1234,
//   approxBytes: 5242880,
//   lastPersistedAt: 1234567890,
//   needsRebuild: false
// }

// 5. Manual rebuild (if index is corrupt or version changed)
await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_REBUILD',
});

// 6. Clear index (for privacy wipe or reset)
await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_CLEAR',
});
```

## From Offscreen Context

If you're already in the offscreen document, use the API directly:

```typescript
import {
    initMiniSearch,
    addOrUpdateDocs,
    search,
    getStats,
    rebuildFromPages,
    clearIndex,
} from '../search/minisearch';

// Initialize
await initMiniSearch();

// Add documents
await addOrUpdateDocs([
    {
        id: 'page-123',
        url: 'https://example.com',
        title: 'Page Title',
        text: 'Page content...',
    },
]);

// Search
const results = await search('query terms', {
    limit: 50,
    fuzzy: 0.2,
});

// Get stats
const stats = await getStats();

// Rebuild from database
await rebuildFromPages();

// Clear
await clearIndex();
```

## Common Patterns

### 1. Index a New Page on Visit

```typescript
// In background service worker
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Extract content (simplified - you'd use content script)
        const doc = {
            id: `page-${Date.now()}`,
            url: tab.url,
            title: tab.title || '',
            text: '...extracted content...',
        };

        await chrome.runtime.sendMessage({
            requestId: crypto.randomUUID(),
            action: 'MINISEARCH_ADD_OR_UPDATE',
            payload: { docs: [doc] },
        });
    }
});
```

### 2. Search from History UI

```typescript
// In history page (React component)
async function handleSearch(query: string) {
    const response = await chrome.runtime.sendMessage({
        requestId: crypto.randomUUID(),
        action: 'MINISEARCH_SEARCH',
        payload: { query, options: { limit: 50 } },
    });

    if (response.ok) {
        setResults(response.result.results);
    }
}
```

### 3. Show Rebuild Status

```typescript
// Check if rebuild is needed
const statsResponse = await chrome.runtime.sendMessage({
    requestId: crypto.randomUUID(),
    action: 'MINISEARCH_STATS',
});

if (statsResponse.result.needsRebuild) {
    // Show UI: "Index needs rebuilding for optimal search"
    // Offer button to trigger rebuild
}
```

### 4. Batch Add Documents

```typescript
// Batch process multiple pages efficiently
const docs = pages.map(page => ({
    id: page.pageId,
    url: page.url,
    title: page.title || '',
    text: page.description || '',
}));

// Add in batches of 100
for (let i = 0; i < docs.length; i += 100) {
    const batch = docs.slice(i, i + 100);
    await chrome.runtime.sendMessage({
        requestId: crypto.randomUUID(),
        action: 'MINISEARCH_ADD_OR_UPDATE',
        payload: { docs: batch },
    });
}
```

### 5. Privacy Wipe

```typescript
// Clear all search data when user opts out
async function wipeSearchData() {
    await chrome.runtime.sendMessage({
        requestId: crypto.randomUUID(),
        action: 'MINISEARCH_CLEAR',
    });

    console.log('Search index cleared');
}
```

## Search Options Reference

```typescript
interface SearchOptions {
    // Maximum number of results to return
    limit?: number;              // Default: 50

    // Fuzzy matching threshold (0-1)
    // 0 = exact match only, 1 = very fuzzy
    fuzzy?: number | boolean;    // Default: 0.2

    // Field boost multipliers
    boost?: {
        title?: number;          // Default: 2.0
        text?: number;           // Default: 1.0
    };
}
```

## Document Interface

```typescript
interface MiniSearchDoc {
    id: string;           // Unique identifier (e.g., pageId)
    url: string;          // Page URL
    title: string;        // Page title (boosted in search)
    text: string;         // Main content (truncated to 2000 tokens)
}
```

## Search Result Interface

```typescript
interface MiniSearchSearchResult {
    id: string;           // Document ID
    url: string;          // Document URL
    title: string;        // Document title
    text: string;         // Document text (truncated)
    score: number;        // Relevance score (higher = better match)
    match?: {             // Which fields matched
        title?: string[];
        text?: string[];
    };
}
```

## Configuration

All defaults are in `src/constants.ts`:

```typescript
export const MINISEARCH_CONFIG = {
    INDEX_VERSION: 1,                      // Bump to trigger rebuild
    PERSIST_EVERY_N: 10,                   // Auto-save threshold
    TRUNCATION_TOKENS: 2000,               // Max tokens per text
    SIZE_CAP_BYTES: 20 * 1024 * 1024,     // 20MB size limit
    INDEX_FIELDS: ['title', 'text'],       // Fields to index
    STORE_FIELDS: ['id', 'url', 'title', 'text'], // Fields to store
    SEARCH_OPTIONS: {
        prefix: true,                      // Enable prefix search
        fuzzy: 0.2,                        // Fuzzy threshold
        boost: { title: 2.0 },            // Title boost
    },
};
```

## Troubleshooting

### Search Returns No Results
1. Check index has documents: `MINISEARCH_STATS` → `docCount > 0`
2. Verify query is not empty or too short
3. Try relaxing fuzzy parameter: `fuzzy: 0.3` or `fuzzy: true`

### Index Size Growing Too Large
1. Check `approxBytes` in stats
2. Reduce `TRUNCATION_TOKENS` in constants
3. Clear old data or trigger manual eviction

### Rebuild Stuck or Slow
1. Check page count in database (might be very large)
2. Rebuild runs in background with yielding
3. Monitor console for progress logs (every 500 docs)

### TypeScript Errors
1. Ensure types are imported: `import type { MiniSearchDoc } from '../types/offscreen'`
2. Check payload structure matches interfaces
3. Verify all required fields (id, url, title, text) are present

## Performance Tips

1. **Batch Operations**: Add multiple docs in one message (up to 100)
2. **Debounce Search**: Wait 300ms after typing before searching
3. **Limit Results**: Use `limit: 50` unless you need more
4. **Rebuild Off-Peak**: Trigger rebuilds during idle times
5. **Monitor Stats**: Check `approxBytes` periodically to avoid size issues

## See Also

- Full documentation: `src/search/README.md`
- Test examples: `src/search/__tests__/minisearch.spec.ts`
- Type definitions: `src/types/offscreen.ts`
- Configuration: `src/constants.ts`
