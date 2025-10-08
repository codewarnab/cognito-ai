/**
 * Embedding Worker
 * 
 * Runs in a Web Worker context spawned from the offscreen document.
 * Loads model assets from CacheStorage and performs embeddings.
 * 
 * This worker must:
 * - Load model assets from cache using blob URLs
 * - Initialize the embedding model
 * - Process embedding requests
 * - Return results to offscreen bridge
 */

import type { BridgeMessage, BridgeResponse } from '../types/offscreen';

let modelLoaded = false;
let modelAssets: {
    modelUrl?: string;
    tokenizerUrl?: string;
    configUrl?: string;
    vocabUrl?: string;
} = {};

/**
 * Load model assets from cache
 * In production, this would be called with actual URLs from getModelCacheUrl
 */
async function loadModelAssets(): Promise<void> {
    try {
        console.log('[Embed Worker] Loading model assets from cache...');

        // In production, the offscreen bridge would provide these URLs
        // via getModelCacheUrl() from the model-ready module
        // For now, this is a placeholder

        // Example of how it would work:
        // const modelUrl = await getModelCacheUrl('model.onnx');
        // const tokenizerUrl = await getModelCacheUrl('tokenizer.json');
        // const configUrl = await getModelCacheUrl('config.json');
        // const vocabUrl = await getModelCacheUrl('vocab.txt');

        // modelAssets = { modelUrl, tokenizerUrl, configUrl, vocabUrl };

        // Load the actual model files
        // const modelBlob = await fetch(modelUrl).then(r => r.blob());
        // ... initialize the model with the blob

        modelLoaded = true;
        console.log('[Embed Worker] Model assets loaded successfully');

        // Send ready message to offscreen bridge
        postMessage({
            requestId: 'init',
            ok: true,
            result: { ready: true },
            final: true,
        } as BridgeResponse);
    } catch (error) {
        console.error('[Embed Worker] Failed to load model assets:', error);

        postMessage({
            requestId: 'init',
            ok: false,
            error: {
                code: 'MODEL_LOAD_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error,
            },
            final: true,
        } as BridgeResponse);

        throw error;
    }
}

/**
 * Process embedding request
 */
async function processEmbedding(requestId: string, text: string): Promise<void> {
    if (!modelLoaded) {
        throw new Error('Model not loaded');
    }

    try {
        // TODO: Implement actual embedding logic
        // This would use the loaded model to generate embeddings

        // Placeholder: simulate embedding generation
        const embedding = new Array(384).fill(0).map(() => Math.random());

        postMessage({
            requestId,
            ok: true,
            result: { embedding },
            final: true,
        } as BridgeResponse);
    } catch (error) {
        postMessage({
            requestId,
            ok: false,
            error: {
                code: 'EMBEDDING_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error,
            },
            final: true,
        } as BridgeResponse);
    }
}

/**
 * Handle messages from offscreen bridge
 */
self.onmessage = async (event: MessageEvent<BridgeMessage>) => {
    const message = event.data;

    try {
        switch (message.action) {
            case 'INIT_MODEL':
                await loadModelAssets();
                break;

            case 'EMBED_TEXT':
                if (!message.payload || typeof (message.payload as any).text !== 'string') {
                    throw new Error('No text provided for embedding');
                }
                await processEmbedding(message.requestId, (message.payload as any).text);
                break;

            case 'EMBED_BATCH':
                if (!message.payload || !Array.isArray((message.payload as any).texts)) {
                    throw new Error('No texts provided for batch embedding');
                }

                // Process batch sequentially (could be parallelized)
                for (const text of (message.payload as any).texts) {
                    await processEmbedding(message.requestId, text);
                }
                break;

            default:
                console.warn('[Embed Worker] Unknown action:', message.action);
                postMessage({
                    requestId: message.requestId,
                    ok: false,
                    error: {
                        code: 'UNKNOWN_ACTION',
                        message: `Unknown action: ${message.action}`,
                    },
                    final: true,
                } as BridgeResponse);
        }
    } catch (error) {
        console.error('[Embed Worker] Error handling message:', error);
        postMessage({
            requestId: message.requestId,
            ok: false,
            error: {
                code: 'WORKER_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error,
            },
            final: true,
        } as BridgeResponse);
    }
};

/**
 * Handle worker errors
 */
self.onerror = (error) => {
    console.error('[Embed Worker] Uncaught error:', error);
    postMessage({
        requestId: 'error',
        ok: false,
        error: {
            code: 'UNCAUGHT_ERROR',
            message: error instanceof ErrorEvent ? error.message : 'Unknown error',
        },
        final: true,
    } as BridgeResponse);
};

console.log('[Embed Worker] Initialized and ready for messages');
