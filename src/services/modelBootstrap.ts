/**
 * Model bootstrap service
 * Initializes and verifies bundled local models
 */

import { localModelLoader } from './localModelLoader';
import {
    MODEL_BOOTSTRAP_STATES,
    MODEL_STORAGE_KEYS,
    type ModelBootstrapState,
    type ModelManifest,
    type ModelError
} from '~constants';

export class ModelBootstrap {
    private state: ModelBootstrapState = MODEL_BOOTSTRAP_STATES.IDLE;

    /**
     * Initialize model - check if local bundled model is available
     */
    async initialize(): Promise<void> {
        try {
            console.log('🚀 Starting model bootstrap...');
            this.setState(MODEL_BOOTSTRAP_STATES.CHECKING);

            // Verify local model files exist
            const filesExist = await localModelLoader.verifyModelFiles();

            if (!filesExist) {
                throw new Error('Required model files not found in extension bundle');
            }

            console.log('✓ Model files verified');

            // Load and validate manifest
            this.setState(MODEL_BOOTSTRAP_STATES.DOWNLOADING);
            const manifest: ModelManifest = await localModelLoader.loadManifest();
            console.log('✓ Model manifest loaded:', manifest);

            // Verify manifest structure
            if (!manifest.version || !manifest.assets) {
                throw new Error('Invalid manifest structure');
            }

            // Mark as ready
            this.setState(MODEL_BOOTSTRAP_STATES.READY);
            await chrome.storage.local.set({
                [MODEL_STORAGE_KEYS.READY]: true,
                [MODEL_STORAGE_KEYS.VERSION]: manifest.version,
                [MODEL_STORAGE_KEYS.BOOTSTRAP_STATE]: MODEL_BOOTSTRAP_STATES.READY,
                [MODEL_STORAGE_KEYS.LAST_CHECK_AT]: Date.now()
            });

            console.log('✅ Local model initialized successfully');
            console.log('📦 Model URLs:', localModelLoader.getModelUrls());
        } catch (error) {
            console.error('❌ Model initialization failed:', error);
            this.setState(MODEL_BOOTSTRAP_STATES.ERROR);

            const modelError: ModelError = {
                code: 'INIT_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                at: Date.now()
            };

            await chrome.storage.local.set({
                [MODEL_STORAGE_KEYS.READY]: false,
                [MODEL_STORAGE_KEYS.BOOTSTRAP_STATE]: MODEL_BOOTSTRAP_STATES.ERROR,
                [MODEL_STORAGE_KEYS.ERROR]: modelError
            });

            throw error;
        }
    }

    /**
     * Check if model is ready
     */
    async isReady(): Promise<boolean> {
        try {
            const result = await chrome.storage.local.get([
                MODEL_STORAGE_KEYS.READY,
                MODEL_STORAGE_KEYS.BOOTSTRAP_STATE
            ]);

            return result[MODEL_STORAGE_KEYS.READY] === true &&
                result[MODEL_STORAGE_KEYS.BOOTSTRAP_STATE] === MODEL_BOOTSTRAP_STATES.READY;
        } catch (error) {
            console.error('Error checking model readiness:', error);
            return false;
        }
    }

    /**
     * Get current bootstrap state
     */
    getState(): ModelBootstrapState {
        return this.state;
    }

    /**
     * Set bootstrap state
     */
    private setState(state: ModelBootstrapState): void {
        this.state = state;
        console.log(`📊 Model bootstrap state: ${state}`);
    }

    /**
     * Get model URLs for workers
     */
    getModelUrls() {
        return localModelLoader.getModelUrls();
    }

    /**
     * Get model info from storage
     */
    async getModelInfo(): Promise<{
        ready: boolean;
        version: string | null;
        state: ModelBootstrapState;
        error: ModelError | null;
        lastCheckAt: number | null;
    }> {
        try {
            const result = await chrome.storage.local.get([
                MODEL_STORAGE_KEYS.READY,
                MODEL_STORAGE_KEYS.VERSION,
                MODEL_STORAGE_KEYS.BOOTSTRAP_STATE,
                MODEL_STORAGE_KEYS.ERROR,
                MODEL_STORAGE_KEYS.LAST_CHECK_AT
            ]);

            return {
                ready: result[MODEL_STORAGE_KEYS.READY] || false,
                version: result[MODEL_STORAGE_KEYS.VERSION] || null,
                state: result[MODEL_STORAGE_KEYS.BOOTSTRAP_STATE] || MODEL_BOOTSTRAP_STATES.IDLE,
                error: result[MODEL_STORAGE_KEYS.ERROR] || null,
                lastCheckAt: result[MODEL_STORAGE_KEYS.LAST_CHECK_AT] || null
            };
        } catch (error) {
            console.error('Error getting model info:', error);
            return {
                ready: false,
                version: null,
                state: MODEL_BOOTSTRAP_STATES.ERROR,
                error: {
                    code: 'STORAGE_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    at: Date.now()
                },
                lastCheckAt: null
            };
        }
    }

    /**
     * Reset model state (useful for debugging)
     */
    async reset(): Promise<void> {
        console.log('🔄 Resetting model state...');
        await chrome.storage.local.remove([
            MODEL_STORAGE_KEYS.READY,
            MODEL_STORAGE_KEYS.VERSION,
            MODEL_STORAGE_KEYS.BOOTSTRAP_STATE,
            MODEL_STORAGE_KEYS.ERROR,
            MODEL_STORAGE_KEYS.LAST_CHECK_AT,
            MODEL_STORAGE_KEYS.PENDING_VERSION,
            MODEL_STORAGE_KEYS.ASSET_ETAGS,
            MODEL_STORAGE_KEYS.RETRY_COUNT
        ]);
        this.state = MODEL_BOOTSTRAP_STATES.IDLE;
        console.log('✓ Model state reset');
    }
}

// Export singleton instance
export const modelBootstrap = new ModelBootstrap();
