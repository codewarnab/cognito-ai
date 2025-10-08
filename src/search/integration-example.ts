/**
 * Hybrid Search Integration Example
 * 
 * Demonstrates how to integrate hybrid search with the existing
 * offscreen document, MiniSearch index, and embedding worker.
 */

import type { BridgeMessage, BridgeResponse } from '../types/offscreen'
import { createDenseIndex, type DenseIndex } from '../search/dense'
import { hybridSearch } from '../search/hybrid'
import * as miniSearch from '../search/minisearch'
import { openDb, type ChunkRecord } from '../db'

// ============================================================================
// 1. Index Initialization (Background Service Worker)
// ============================================================================

/**
 * Initialize both dense and sparse indexes
 * Call this after model is ready and pages have been indexed
 */
export async function initializeSearchIndexes(): Promise<{
    denseIndex: DenseIndex
    miniSearchReady: boolean
}> {
    console.log('[Search] Initializing hybrid search indexes...')

    // Get database instance
    const db = await openDb()

    // 1a. Load chunks from IndexedDB
    const chunks = await db.chunks.toArray()
    console.log(`[Search] Loaded ${chunks.length} chunks from DB`)

    // 1b. Build dense index (in-memory)
    const denseIndex = createDenseIndex(
        'brute', // Use 'hnsw' when available
        chunks
            .filter(c => c.embedding && c.embedding.byteLength > 0)
            .map(c => ({
                chunkId: c.chunkId,
                url: c.url,
                embedding: new Float32Array(c.embedding)
            }))
    )

    console.log(`[Search] Dense index ready with ${denseIndex.size()} vectors`)

    // 1c. Initialize MiniSearch (already done via offscreen)
    // This should already be running in the offscreen document
    const miniSearchReady = true

    return { denseIndex, miniSearchReady }
}

// ============================================================================
// 2. Search Request Handler (Offscreen Document)
// ============================================================================

/**
 * Handle hybrid search requests in the offscreen document
 * This runs in the offscreen context where both worker and MiniSearch are available
 */
export async function handleHybridSearchRequest(
    message: BridgeMessage,
    denseIndex: DenseIndex,
    miniSearchInstance: any, // MiniSearch instance
    worker: Worker
): Promise<BridgeResponse> {
    try {
        const { query, topK, alpha } = message.payload as {
            query: string
            topK?: number
            alpha?: number
        }

        if (!query || query.trim().length === 0) {
            return {
                requestId: message.requestId,
                ok: false,
                error: {
                    code: 'INVALID_QUERY',
                    message: 'Query cannot be empty'
                },
                final: true
            }
        }

        // Load metadata for snippets
        const db = await openDb()
        const chunks = await db.chunks.toArray()
        const metadata = new Map<string, { url: string; title?: string; snippet?: string }>(
            chunks.map(c => [
                c.chunkId,
                {
                    url: c.url,
                    title: undefined, // ChunkRecord doesn't have title; would need to join with PageRecord
                    snippet: c.text.substring(0, 200) // First 200 chars as snippet
                }
            ])
        )

        // Perform hybrid search
        const results = await hybridSearch({
            query,
            denseIndex,
            miniSearch: miniSearchInstance,
            alpha: alpha ?? 0.6,
            topK: topK ?? 20,
            overfetch: (topK ?? 20) * 3,
            worker,
            metadata
        })

        return {
            requestId: message.requestId,
            ok: true,
            result: results,
            final: true
        }
    } catch (error) {
        console.error('[Search] Hybrid search failed:', error)

        return {
            requestId: message.requestId,
            ok: false,
            error: {
                code: 'SEARCH_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            final: true
        }
    }
}

// ============================================================================
// 3. UI Integration (History Search Page)
// ============================================================================

/**
 * Perform hybrid search from the UI
 * Sends a message to the offscreen document
 */
export async function searchFromUI(
    query: string,
    options?: {
        topK?: number
        alpha?: number
    }
): Promise<{
    groups: Array<{
        url: string
        title?: string
        bestScore: number
        bestSnippet?: string
    }>
    stats: {
        totalChunksScanned: number
        denseMs: number
        sparseMs: number
        mergeMs: number
    }
}> {
    const requestId = crypto.randomUUID()

    const message: BridgeMessage = {
        requestId,
        action: 'SEARCH_HYBRID',
        payload: {
            query,
            topK: options?.topK ?? 20,
            alpha: options?.alpha ?? 0.6
        }
    }

    const response = await chrome.runtime.sendMessage(message)

    if (!response.ok) {
        throw new Error(response.error?.message ?? 'Search failed')
    }

    return response.result
}

// ============================================================================
// 4. Incremental Updates
// ============================================================================

/**
 * Update indexes when new pages are processed
 */
export async function updateIndexesForNewChunks(
    chunkIds: string[],
    denseIndex: DenseIndex
): Promise<void> {
    console.log(`[Search] Updating indexes for ${chunkIds.length} new chunks`)

    // Get database instance
    const db = await openDb()

    // 1. Load new chunks from DB
    const newChunks = await db.chunks.where('chunkId').anyOf(chunkIds).toArray()

    // 2. Update MiniSearch (handled automatically via minisearch.ts)
    await miniSearch.addOrUpdateDocs(
        newChunks.map(c => ({
            id: c.chunkId,
            url: c.url,
            title: '', // ChunkRecord doesn't have title; would need to join with PageRecord
            text: c.text
        }))
    )

    // 3. Rebuild dense index (for brute-force; HNSW would support incremental)
    // For now, we'd need to rebuild the entire index
    // This is acceptable for <10k chunks; for larger scale, use HNSW with incremental inserts

    console.log('[Search] Indexes updated')
}

// ============================================================================
// 5. Example: Background Service Worker Setup
// ============================================================================

/**
 * Example setup in background.ts
 */
export async function exampleBackgroundSetup() {
    // Wait for model ready
    // await waitForModelReady()

    // Initialize offscreen document
    // await ensureOffscreenDocument()

    // Message handler for search requests
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'SEARCH_HYBRID') {
            // Forward to offscreen document
            // Offscreen will handle the actual search
            return true // Keep channel open for async response
        }

        // Other handlers...
    })
}

// ============================================================================
// 6. Example: React Component Usage
// ============================================================================

/**
 * Example React component for search UI
 */
export function ExampleSearchComponent() {
    /*
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState(null)
  
    const handleSearch = async () => {
      if (!query.trim()) return
  
      setLoading(true)
      try {
        const { groups, stats } = await searchFromUI(query)
        setResults(groups)
        setStats(stats)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }
  
    return (
      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search your history..."
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
  
        {stats && (
          <div className="stats">
            Scanned {stats.totalChunksScanned} chunks in{' '}
            {stats.denseMs + stats.sparseMs + stats.mergeMs}ms
          </div>
        )}
  
        {results.map((group) => (
          <div key={group.url} className="result">
            <h3>{group.title}</h3>
            <a href={group.url}>{group.url}</a>
            <p>{group.bestSnippet}</p>
            <span className="score">Score: {group.bestScore.toFixed(3)}</span>
          </div>
        ))}
      </div>
    )
    */
}
