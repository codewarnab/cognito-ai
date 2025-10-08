/**
 * Search result types for hybrid search pipeline
 */

/** Result for a single chunk with both dense and sparse scores */
export type ChunkResult = {
    chunkId: string
    url: string
    title?: string
    snippet?: string
    scoreDense: number
    scoreSparse: number
    score: number // Combined score (alpha * dense + (1-alpha) * sparse)
}

/** Group of chunks from the same URL */
export type UrlGroup = {
    url: string
    title?: string
    faviconUrl?: string
    bestScore: number
    bestSnippet?: string
    topChunks: ChunkResult[]
}

/** Complete hybrid search results with stats */
export type GroupedResults = {
    query: string
    alpha: number
    groups: UrlGroup[]
    stats: {
        totalChunksScanned: number
        denseMs: number
        sparseMs: number
        mergeMs: number
    }
}

/** Sparse search hit from MiniSearch */
export type SparseHit = {
    chunkId: string
    url: string
    scoreSparse: number
}
