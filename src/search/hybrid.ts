/**
 * Hybrid Search Orchestration
 * 
 * Combines dense (embedding) and sparse (MiniSearch) search with:
 * - Query-local normalization to [0,1]
 * - Configurable alpha weighting (default 0.6 dense, 0.4 sparse)
 * - Merge by chunkId with zeros for missing sides
 * - URL grouping with best snippet selection
 * - Deterministic ranking with stable tiebreakers
 */

import type { DenseIndex } from './dense'
import { computeQueryEmbedding } from './dense'
import type MiniSearch from 'minisearch'
import type {
    ChunkResult,
    UrlGroup,
    GroupedResults,
    SparseHit
} from './types'

/**
 * Normalize dense cosine similarity from [-1, 1] to [0, 1]
 * Deterministic and corpus-independent for reproducibility
 */
export function normalizeDense(cos: number): number {
    return (cos + 1) / 2
}

/**
 * Normalize sparse scores to [0, 1] by scaling to max score
 * If no hits, returns empty map
 */
export function normalizeSparse(hits: SparseHit[]): Map<string, number> {
    const map = new Map<string, number>()

    if (hits.length === 0) {
        return map
    }

    let maxScore = 0
    for (const hit of hits) {
        maxScore = Math.max(maxScore, hit.scoreSparse)
    }

    if (maxScore === 0) {
        return map
    }

    for (const hit of hits) {
        map.set(hit.chunkId, hit.scoreSparse / maxScore)
    }

    return map
}

/**
 * Hybrid search combining dense and sparse results
 * 
 * @param params - Search parameters
 * @returns Grouped results sorted by relevance
 */
export async function hybridSearch(params: {
    query: string
    denseIndex: DenseIndex
    miniSearch: MiniSearch
    alpha?: number
    topK?: number
    overfetch?: number
    worker?: Worker
    metadata?: Map<string, { url: string; title?: string; snippet?: string }>
}): Promise<GroupedResults> {
    const alpha = params.alpha ?? 0.6
    const topK = params.topK ?? 20
    const overfetch = params.overfetch ?? topK * 3

    const stats = {
        totalChunksScanned: 0,
        denseMs: 0,
        sparseMs: 0,
        mergeMs: 0
    }

    // Step 1: Compute query embedding
    const t0 = performance.now()
    const queryEmbedding = await computeQueryEmbedding(params.query, {
        worker: params.worker
    })
    const embedMs = performance.now() - t0

    // Step 2: Dense search
    const t1 = performance.now()
    const denseResults = params.denseIndex.search(queryEmbedding, {
        topK,
        overfetch
    })
    stats.denseMs = performance.now() - t1

    // Step 3: Sparse search via MiniSearch
    const t2 = performance.now()
    // MiniSearch.search returns SearchResult[], we need to call it directly
    const miniSearchResults = params.miniSearch.search(params.query, {
        prefix: true,
        fuzzy: 0.2
    }).slice(0, overfetch)

    // Convert MiniSearch results to SparseHit format
    const sparseHits: SparseHit[] = miniSearchResults.map((result: any) => ({
        chunkId: result.id,
        url: result.url || '',
        scoreSparse: result.score
    }))
    stats.sparseMs = performance.now() - t2

    // Step 4: Normalize scores
    const t3 = performance.now()

    // Normalize dense scores
    const denseMap = new Map<string, number>()
    for (const result of denseResults) {
        denseMap.set(result.chunkId, normalizeDense(result.scoreDense))
    }

    // Normalize sparse scores
    const sparseMap = normalizeSparse(sparseHits)

    // Step 5: Merge by chunkId
    const chunkIds = new Set<string>([
        ...denseMap.keys(),
        ...sparseMap.keys()
    ])

    const merged: ChunkResult[] = []

    for (const chunkId of chunkIds) {
        const denseNorm = denseMap.get(chunkId) ?? 0
        const sparseNorm = sparseMap.get(chunkId) ?? 0
        const score = alpha * denseNorm + (1 - alpha) * sparseNorm

        // Get metadata for this chunk
        const meta = params.metadata?.get(chunkId)
        const url = meta?.url || sparseHits.find(h => h.chunkId === chunkId)?.url || ''

        merged.push({
            chunkId,
            url,
            title: meta?.title,
            snippet: meta?.snippet,
            scoreDense: denseNorm,
            scoreSparse: sparseNorm,
            score
        })
    }

    // Step 6: Sort by score (descending), with stable tiebreakers
    merged.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.scoreDense !== a.scoreDense) return b.scoreDense - a.scoreDense
        return a.chunkId.localeCompare(b.chunkId)
    })

    // Take top K
    const topResults = merged.slice(0, topK)

    stats.totalChunksScanned = chunkIds.size
    stats.mergeMs = performance.now() - t3

    // Step 7: Group by URL
    const groups = groupByUrl(topResults)

    return {
        query: params.query,
        alpha,
        groups,
        stats
    }
}

/**
 * Group chunks by URL and select best snippet
 */
function groupByUrl(results: ChunkResult[]): UrlGroup[] {
    const urlMap = new Map<string, ChunkResult[]>()

    // Group chunks by URL
    for (const result of results) {
        if (!result.url) continue

        const chunks = urlMap.get(result.url) || []
        chunks.push(result)
        urlMap.set(result.url, chunks)
    }

    // Create groups
    const groups: UrlGroup[] = []

    for (const [url, chunks] of urlMap) {
        // Sort chunks within URL by score
        chunks.sort((a, b) => b.score - a.score)

        const bestChunk = chunks[0]
        const bestSnippet = extractSnippet(bestChunk)

        groups.push({
            url,
            title: bestChunk.title,
            faviconUrl: undefined, // TODO: Add favicon support
            bestScore: bestChunk.score,
            bestSnippet,
            topChunks: chunks
        })
    }

    // Sort groups by best score
    groups.sort((a, b) => b.bestScore - a.bestScore)

    return groups
}

/**
 * Extract snippet from chunk
 * Takes first line or trims to reasonable length
 */
function extractSnippet(chunk: ChunkResult): string {
    if (chunk.snippet) {
        return chunk.snippet
    }

    // If no snippet metadata, extract from title
    if (chunk.title) {
        // Take first line or first 150 chars
        const firstLine = chunk.title.split('\n')[0]
        if (firstLine.length <= 150) {
            return firstLine
        }
        return firstLine.substring(0, 147) + '...'
    }

    return ''
}
