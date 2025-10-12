/**
 * Model Readiness Gating - Local Model Loader Wrapper
 * 
 * Wraps the modelBootstrap service to provide compatibility with existing background.ts code
 */

import { modelBootstrap } from '../services/modelBootstrap';
import { localModelLoader } from '../services/localModelLoader';

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Handle model retry alarm (no-op for local models)
 */
export async function handleModelRetryAlarm(): Promise<void> {
    console.log('[Model Ready] Retry alarm triggered (no-op for bundled models)');
}

/**
 * Ensure model is ready, throw if not
 */
export async function ensureModelReady(): Promise<void> {
    const ready = await modelBootstrap.isReady();
    if (!ready) {
        throw new Error('Model not ready. Initialize model system first.');
    }
}

/**
 * Get URL for a model asset
 */
export async function getModelCacheUrl(assetPath: string): Promise<string> {
    return localModelLoader.getAssetUrl(assetPath);
}

/**
 * Check if model is ready
 */
export async function isModelReady(): Promise<boolean> {
    return await modelBootstrap.isReady();
}

/**
 * Get model debug info
 */
export async function getModelDebugInfo(): Promise<any> {
    const info = await modelBootstrap.getModelInfo();
    const urls = modelBootstrap.getModelUrls();

    return {
        ...info,
        urls,
        type: 'bundled-local',
        message: 'Using bundled local model files'
    };
}

/**
 * Initialize model system on extension install/startup
 */
export async function initializeModelSystem(reason: string): Promise<void> {
    console.log(`[Model Ready] Initializing model system (${reason})`);

    try {
        await modelBootstrap.initialize();
        console.log('[Model Ready] ✅ Model system initialized successfully');
    } catch (error) {
        console.error('[Model Ready] ❌ Model initialization failed:', error);
        throw error;
    }
}

/**
 * Get model URLs for workers
 */
export function getModelUrls() {
    return modelBootstrap.getModelUrls();
}

/**
 * Reset model state (for debugging)
 */
export async function resetModelState(): Promise<void> {
    await modelBootstrap.reset();
}
