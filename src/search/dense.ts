/**
 * Dense vector search with brute-force cosine similarity
 * Ready for HNSW swap via DenseIndex interface
 */

import type { BridgeMessage, BridgeResponse } from '../types/offscreen'

/** Dense search index interface - ready for HNSW implementation */
export interface DenseIndex {
    /**
     * Search for nearest neighbors
     * @param embedding - L2-normalized query embedding
     * @param opts - Search options
     * @returns Array of results sorted by descending similarity
     */
    search(
        embedding: Float32Array,
        opts?: {
            topK?: number
            overfetch?: number
        }
    ): Array<{ chunkId: string; scoreDense: number }>

    /** Get index size */
    size(): number
}

/** Brute-force dense index implementation */
export class BruteForceDenseIndex implements DenseIndex {
    private chunks: Array<{
        chunkId: string
        url: string
        embedding: Float32Array
    }>

    constructor(
        source: Iterable<{
            chunkId: string
            url: string
            embedding: Float32Array
        }>
    ) {
        this.chunks = Array.from(source)
        console.log(`[DenseIndex] Initialized with ${this.chunks.length} chunks`)
    }

    search(
        queryEmbedding: Float32Array,
        opts?: { topK?: number; overfetch?: number }
    ): Array<{ chunkId: string; scoreDense: number }> {
        const topK = opts?.topK ?? 20
        const overfetch = opts?.overfetch ?? topK * 3

        // Compute cosine similarity for all chunks
        const results: Array<{ chunkId: string; scoreDense: number }> = []

        for (const chunk of this.chunks) {
            const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
            results.push({ chunkId: chunk.chunkId, scoreDense: similarity })
        }

        // Sort by descending similarity and take top overfetch
        results.sort((a, b) => b.scoreDense - a.scoreDense)

        return results.slice(0, overfetch)
    }

    size(): number {
        return this.chunks.length
    }
}

/**
 * Compute cosine similarity between two L2-normalized vectors
 * Since inputs are normalized, this is just the dot product
 * @returns Value in [-1, 1]
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
        throw new Error('Vector dimensions must match')
    }

    let dotProduct = 0
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
    }

    return dotProduct
}

/**
 * L2-normalize a vector in-place
 */
export function normalizeL2(vec: Float32Array): Float32Array {
    let sumSquares = 0
    for (let i = 0; i < vec.length; i++) {
        sumSquares += vec[i] * vec[i]
    }

    const norm = Math.sqrt(sumSquares)
    if (norm > 0) {
        for (let i = 0; i < vec.length; i++) {
            vec[i] /= norm
        }
    }

    return vec
}

/**
 * Compute query embedding via offscreen worker bridge
 * @param query - Search query text
 * @param opts - Options for worker communication
 * @returns L2-normalized embedding
 */
export async function computeQueryEmbedding(
    query: string,
    opts?: {
        worker?: Worker
        timeoutMs?: number
    }
): Promise<Float32Array> {
    const timeoutMs = opts?.timeoutMs ?? 1000

    // If worker provided, use it directly
    if (opts?.worker) {
        return computeViaWorker(opts.worker, query, timeoutMs)
    }

    // Otherwise, message offscreen document via chrome.runtime
    return computeViaOffscreen(query, timeoutMs)
}

/**
 * Compute embedding via direct worker reference
 */
async function computeViaWorker(
    worker: Worker,
    query: string,
    timeoutMs: number
): Promise<Float32Array> {
    const requestId = crypto.randomUUID()

    const message: BridgeMessage = {
        requestId,
        action: 'EMBED_TEXT',
        payload: { text: query }
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Query embedding timeout'))
        }, timeoutMs)

        const handler = (event: MessageEvent<BridgeResponse>) => {
            if (event.data.requestId !== requestId) return

            clearTimeout(timeout)
            worker.removeEventListener('message', handler)

            if (event.data.ok && event.data.result) {
                const embedding = new Float32Array(event.data.result as ArrayBuffer)
                normalizeL2(embedding)
                resolve(embedding)
            } else {
                reject(
                    new Error(
                        event.data.error?.message ?? 'Failed to compute query embedding'
                    )
                )
            }
        }

        worker.addEventListener('message', handler)
        worker.postMessage(message)
    })
}

/**
 * Compute embedding via offscreen document (chrome.runtime messaging)
 */
async function computeViaOffscreen(
    query: string,
    timeoutMs: number
): Promise<Float32Array> {
    const requestId = crypto.randomUUID()

    const message: BridgeMessage = {
        requestId,
        action: 'EMBED_TEXT',
        payload: { text: query }
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Query embedding timeout'))
        }, timeoutMs)

        chrome.runtime
            .sendMessage(message)
            .then((response: BridgeResponse) => {
                clearTimeout(timeout)

                if (response.ok && response.result) {
                    const embedding = new Float32Array(
                        response.result as ArrayBuffer
                    )
                    normalizeL2(embedding)
                    resolve(embedding)
                } else {
                    reject(
                        new Error(
                            response.error?.message ?? 'Failed to compute query embedding'
                        )
                    )
                }
            })
            .catch((error) => {
                clearTimeout(timeout)
                reject(error)
            })
    })
}

/**
 * Factory for creating dense indexes
 * @param kind - Index type ("brute" for now, "hnsw" later)
 * @param source - Chunks with embeddings
 */
export function createDenseIndex(
    kind: 'brute' | 'hnsw',
    source: Iterable<{
        chunkId: string
        url: string
        embedding: Float32Array
    }>
): DenseIndex {
    if (kind === 'hnsw') {
        throw new Error('HNSW not yet implemented - use "brute"')
    }

    return new BruteForceDenseIndex(source)
}
