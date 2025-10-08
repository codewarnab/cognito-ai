/**
 * Model Readiness Gating & Cache Management
 * 
 * Ensures model assets are downloaded, cached, and verified before allowing embeddings.
 * Handles:
 * - One-time bootstrap download
 * - Cache integrity verification (SHA256)
 * - Partial cache repair
 * - Exponential backoff retry with alarms
 * - Offline-first operation after initial download
 */

import {
    MODEL_BASE_URL,
    MODEL_VERSION,
    MODEL_CACHE_PREFIX,
    MODEL_BOOTSTRAP_STATES,
    MODEL_RETRY,
    MODEL_STORAGE_KEYS,
    type ModelManifest,
    type ModelAsset,
    type ModelError,
    type ModelBootstrapState,
} from '../constants';

// ============================================================================
// State Management
// ============================================================================

/**
 * Get model readiness state from storage
 */
async function getModelState(): Promise<{
    version?: string;
    ready: boolean;
    bootstrapState: ModelBootstrapState;
    error?: ModelError;
    lastCheckAt?: number;
    pendingVersion?: string;
    assetETags?: Record<string, string>;
    retryCount?: number;
}> {
    const result = await chrome.storage.local.get([
        MODEL_STORAGE_KEYS.VERSION,
        MODEL_STORAGE_KEYS.READY,
        MODEL_STORAGE_KEYS.BOOTSTRAP_STATE,
        MODEL_STORAGE_KEYS.ERROR,
        MODEL_STORAGE_KEYS.LAST_CHECK_AT,
        MODEL_STORAGE_KEYS.PENDING_VERSION,
        MODEL_STORAGE_KEYS.ASSET_ETAGS,
        MODEL_STORAGE_KEYS.RETRY_COUNT,
    ]);

    return {
        version: result[MODEL_STORAGE_KEYS.VERSION],
        ready: result[MODEL_STORAGE_KEYS.READY] ?? false,
        bootstrapState: result[MODEL_STORAGE_KEYS.BOOTSTRAP_STATE] ?? MODEL_BOOTSTRAP_STATES.IDLE,
        error: result[MODEL_STORAGE_KEYS.ERROR],
        lastCheckAt: result[MODEL_STORAGE_KEYS.LAST_CHECK_AT],
        pendingVersion: result[MODEL_STORAGE_KEYS.PENDING_VERSION],
        assetETags: result[MODEL_STORAGE_KEYS.ASSET_ETAGS] ?? {},
        retryCount: result[MODEL_STORAGE_KEYS.RETRY_COUNT] ?? 0,
    };
}

/**
 * Update model state in storage
 */
async function updateModelState(updates: Partial<{
    version: string;
    ready: boolean;
    bootstrapState: ModelBootstrapState;
    error: ModelError | null;
    lastCheckAt: number;
    pendingVersion: string | null;
    assetETags: Record<string, string>;
    retryCount: number;
}>): Promise<void> {
    const storageUpdates: Record<string, any> = {};

    if (updates.version !== undefined) {
        storageUpdates[MODEL_STORAGE_KEYS.VERSION] = updates.version;
    }
    if (updates.ready !== undefined) {
        storageUpdates[MODEL_STORAGE_KEYS.READY] = updates.ready;
    }
    if (updates.bootstrapState !== undefined) {
        storageUpdates[MODEL_STORAGE_KEYS.BOOTSTRAP_STATE] = updates.bootstrapState;
    }
    if (updates.error !== undefined) {
        if (updates.error === null) {
            await chrome.storage.local.remove([MODEL_STORAGE_KEYS.ERROR]);
        } else {
            storageUpdates[MODEL_STORAGE_KEYS.ERROR] = updates.error;
        }
    }
    if (updates.lastCheckAt !== undefined) {
        storageUpdates[MODEL_STORAGE_KEYS.LAST_CHECK_AT] = updates.lastCheckAt;
    }
    if (updates.pendingVersion !== undefined) {
        if (updates.pendingVersion === null) {
            await chrome.storage.local.remove([MODEL_STORAGE_KEYS.PENDING_VERSION]);
        } else {
            storageUpdates[MODEL_STORAGE_KEYS.PENDING_VERSION] = updates.pendingVersion;
        }
    }
    if (updates.assetETags !== undefined) {
        storageUpdates[MODEL_STORAGE_KEYS.ASSET_ETAGS] = updates.assetETags;
    }
    if (updates.retryCount !== undefined) {
        storageUpdates[MODEL_STORAGE_KEYS.RETRY_COUNT] = updates.retryCount;
    }

    await chrome.storage.local.set(storageUpdates);
}

// ============================================================================
// Manifest Operations
// ============================================================================

/**
 * Fetch manifest from CDN or cache
 */
async function fetchManifest(version: string, useCache: boolean = false): Promise<ModelManifest> {
    const manifestUrl = `${MODEL_BASE_URL}/${version}/manifest.json`;

    try {
        const response = await fetch(manifestUrl, {
            cache: useCache ? 'default' : 'no-store',
            mode: 'cors',
        });

        if (!response.ok) {
            throw new Error(`Manifest fetch failed: ${response.status} ${response.statusText}`);
        }

        const manifest = await response.json() as ModelManifest;

        // Validate manifest schema
        if (!manifest.version || !Array.isArray(manifest.assets)) {
            throw new Error('Invalid manifest schema');
        }

        return manifest;
    } catch (error) {
        console.error('[Model Ready] Failed to fetch manifest:', error);

        // Try to load manifest from cache as fallback
        if (!useCache) {
            const cache = await getCacheForVersion(version);
            if (cache) {
                const cachedManifest = await cache.match(`/${version}/manifest.json`);
                if (cachedManifest) {
                    console.log('[Model Ready] Using cached manifest as fallback');
                    return await cachedManifest.json();
                }
            }
        }

        throw error;
    }
}

// ============================================================================
// Cache Storage Operations
// ============================================================================

/**
 * Get cache name for a specific version
 */
function getCacheName(version: string): string {
    return `${MODEL_CACHE_PREFIX}${version}`;
}

/**
 * Open cache for a specific version
 */
async function getCacheForVersion(version: string): Promise<Cache | null> {
    try {
        return await caches.open(getCacheName(version));
    } catch (error) {
        console.error('[Model Ready] Failed to open cache:', error);
        return null;
    }
}

/**
 * List all model caches
 */
async function listModelCaches(): Promise<string[]> {
    const allCaches = await caches.keys();
    return allCaches.filter(name => name.startsWith(MODEL_CACHE_PREFIX));
}

/**
 * Delete old model caches (keep only current version)
 */
async function cleanupOldCaches(currentVersion: string): Promise<void> {
    const currentCacheName = getCacheName(currentVersion);
    const allCaches = await listModelCaches();

    for (const cacheName of allCaches) {
        if (cacheName !== currentCacheName) {
            console.log('[Model Ready] Deleting old cache:', cacheName);
            await caches.delete(cacheName);
        }
    }
}

// ============================================================================
// Asset Integrity Verification
// ============================================================================

/**
 * Compute SHA256 hash of data
 */
async function computeSHA256(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify asset integrity
 */
async function verifyAssetIntegrity(response: Response, expectedHash: string): Promise<boolean> {
    const data = await response.clone().arrayBuffer();
    const actualHash = await computeSHA256(data);
    return actualHash === expectedHash;
}

/**
 * Check if asset exists in cache and verify integrity if requested
 */
async function checkAssetInCache(
    cache: Cache,
    version: string,
    asset: ModelAsset,
    verifyIntegrity: boolean = false
): Promise<boolean> {
    const assetUrl = `/${version}/${asset.path}`;
    const cached = await cache.match(assetUrl);

    if (!cached) {
        return false;
    }

    if (verifyIntegrity) {
        try {
            const isValid = await verifyAssetIntegrity(cached, asset.sha256);
            if (!isValid) {
                console.warn('[Model Ready] Integrity check failed for:', asset.path);
                await cache.delete(assetUrl);
                return false;
            }
        } catch (error) {
            console.error('[Model Ready] Error verifying asset:', asset.path, error);
            return false;
        }
    }

    return true;
}

// ============================================================================
// Asset Download
// ============================================================================

/**
 * Download a single asset
 */
async function downloadAsset(
    cache: Cache,
    version: string,
    asset: ModelAsset,
    etag?: string
): Promise<{ success: boolean; etag?: string; error?: string }> {
    const assetUrl = `${MODEL_BASE_URL}/${version}/${asset.path}`;
    const cacheKey = `/${version}/${asset.path}`;

    try {
        const headers: HeadersInit = {};
        if (etag) {
            headers['If-None-Match'] = etag;
        }

        const response = await fetch(assetUrl, {
            cache: 'no-store',
            mode: 'cors',
            headers,
        });

        // Handle 304 Not Modified
        if (response.status === 304) {
            console.log('[Model Ready] Asset not modified (304):', asset.path);
            return { success: true, etag };
        }

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        // Verify integrity before caching
        const isValid = await verifyAssetIntegrity(response, asset.sha256);
        if (!isValid) {
            throw new Error('INTEGRITY_MISMATCH: Downloaded asset hash does not match manifest');
        }

        // Clone response for caching
        const responseToCache = response.clone();

        // Store in cache
        await cache.put(cacheKey, responseToCache);

        // Extract ETag if available
        const newEtag = response.headers.get('ETag') || undefined;

        console.log('[Model Ready] Downloaded and cached:', asset.path);
        return { success: true, etag: newEtag };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Model Ready] Failed to download asset:', asset.path, errorMessage);

        // Delete any partial/corrupt cached data
        await cache.delete(cacheKey);

        return { success: false, error: errorMessage };
    }
}

/**
 * Download all missing or failed assets
 */
async function downloadMissingAssets(
    manifest: ModelManifest,
    etags: Record<string, string>
): Promise<{ success: boolean; updatedETags: Record<string, string>; errors: string[] }> {
    const cache = await getCacheForVersion(manifest.version);
    if (!cache) {
        return { success: false, updatedETags: etags, errors: ['Failed to open cache'] };
    }

    const errors: string[] = [];
    const updatedETags = { ...etags };

    // Check which assets are missing or need verification
    const missingAssets: ModelAsset[] = [];
    for (const asset of manifest.assets) {
        const exists = await checkAssetInCache(cache, manifest.version, asset, false);
        if (!exists) {
            missingAssets.push(asset);
        }
    }

    if (missingAssets.length === 0) {
        console.log('[Model Ready] All assets present in cache');
        return { success: true, updatedETags, errors: [] };
    }

    console.log(`[Model Ready] Downloading ${missingAssets.length} missing assets`);

    // Download assets with small concurrency
    const CONCURRENCY = 2;
    for (let i = 0; i < missingAssets.length; i += CONCURRENCY) {
        const batch = missingAssets.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map(asset => downloadAsset(cache, manifest.version, asset, updatedETags[asset.path]))
        );

        for (let j = 0; j < batch.length; j++) {
            const asset = batch[j];
            const result = results[j];

            if (result.success) {
                if (result.etag) {
                    updatedETags[asset.path] = result.etag;
                }
            } else {
                if (!asset.optional) {
                    errors.push(`${asset.path}: ${result.error}`);
                }
            }
        }
    }

    return {
        success: errors.length === 0,
        updatedETags,
        errors,
    };
}

/**
 * Verify all required assets are present and valid
 */
async function verifyAllAssets(manifest: ModelManifest, fullIntegrityCheck: boolean = false): Promise<{
    complete: boolean;
    missingAssets: string[];
}> {
    const cache = await getCacheForVersion(manifest.version);
    if (!cache) {
        return { complete: false, missingAssets: manifest.assets.map(a => a.path) };
    }

    const missingAssets: string[] = [];

    for (const asset of manifest.assets) {
        if (asset.optional) continue;

        const exists = await checkAssetInCache(cache, manifest.version, asset, fullIntegrityCheck);
        if (!exists) {
            missingAssets.push(asset.path);
        }
    }

    return {
        complete: missingAssets.length === 0,
        missingAssets,
    };
}

/**
 * Store manifest in cache
 */
async function cacheManifest(manifest: ModelManifest): Promise<void> {
    const cache = await getCacheForVersion(manifest.version);
    if (!cache) {
        throw new Error('Failed to open cache');
    }

    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestResponse = new Response(manifestBlob);

    await cache.put(`/${manifest.version}/manifest.json`, manifestResponse);
    console.log('[Model Ready] Manifest cached');
}

// ============================================================================
// Retry & Backoff
// ============================================================================

const MODEL_RETRY_ALARM = 'model-retry';

/**
 * Calculate exponential backoff delay
 */
function calculateRetryDelay(attempt: number): number {
    const baseDelay = MODEL_RETRY.INITIAL_BACKOFF_MINUTES;
    const maxDelay = MODEL_RETRY.MAX_BACKOFF_MINUTES;
    const delay = Math.min(baseDelay * Math.pow(MODEL_RETRY.BACKOFF_MULTIPLIER, attempt), maxDelay);
    return delay;
}

/**
 * Schedule retry via alarm
 */
async function scheduleRetry(attempt: number): Promise<void> {
    if (attempt >= MODEL_RETRY.MAX_ATTEMPTS) {
        console.error('[Model Ready] Max retry attempts reached, giving up');
        await updateModelState({
            bootstrapState: MODEL_BOOTSTRAP_STATES.ERROR,
            error: {
                code: 'MAX_RETRIES_EXCEEDED',
                message: `Failed after ${MODEL_RETRY.MAX_ATTEMPTS} attempts`,
                at: Date.now(),
            },
        });
        return;
    }

    const delayMinutes = calculateRetryDelay(attempt);
    console.log(`[Model Ready] Scheduling retry ${attempt + 1} in ${delayMinutes} minutes`);

    await chrome.alarms.create(MODEL_RETRY_ALARM, {
        delayInMinutes: delayMinutes,
    });

    await updateModelState({
        retryCount: attempt + 1,
        bootstrapState: MODEL_BOOTSTRAP_STATES.IDLE,
    });
}

/**
 * Handle retry alarm
 */
export async function handleModelRetryAlarm(): Promise<void> {
    console.log('[Model Ready] Retry alarm triggered');
    const state = await getModelState();

    if (state.ready) {
        console.log('[Model Ready] Already ready, canceling retry');
        return;
    }

    // Trigger bootstrap
    await bootstrapModel();
}

// ============================================================================
// Bootstrap & Readiness
// ============================================================================

let bootstrapInProgress = false;

/**
 * Bootstrap model download and caching
 */
async function bootstrapModel(): Promise<void> {
    // Prevent concurrent bootstrap
    if (bootstrapInProgress) {
        console.log('[Model Ready] Bootstrap already in progress');
        return;
    }

    try {
        bootstrapInProgress = true;
        const state = await getModelState();

        // Check if already ready
        if (state.ready && state.version === MODEL_VERSION) {
            console.log('[Model Ready] Model already ready');
            return;
        }

        console.log('[Model Ready] Starting bootstrap for version:', MODEL_VERSION);

        // Set state to checking
        await updateModelState({
            bootstrapState: MODEL_BOOTSTRAP_STATES.CHECKING,
            lastCheckAt: Date.now(),
            pendingVersion: MODEL_VERSION,
            error: null,
        });

        // Fetch manifest
        const manifest = await fetchManifest(MODEL_VERSION, false);

        // Check if we need to download (version mismatch or incomplete cache)
        const needsDownload = state.version !== manifest.version;

        if (needsDownload) {
            console.log('[Model Ready] Version mismatch or first install, downloading assets');

            await updateModelState({
                bootstrapState: MODEL_BOOTSTRAP_STATES.DOWNLOADING,
            });

            // Download missing assets
            const downloadResult = await downloadMissingAssets(manifest, state.assetETags ?? {});

            if (!downloadResult.success) {
                throw new Error(`Asset download failed: ${downloadResult.errors.join(', ')}`);
            }

            // Update ETags
            await updateModelState({
                assetETags: downloadResult.updatedETags,
            });
        }

        // Verify all assets
        console.log('[Model Ready] Verifying assets');
        await updateModelState({
            bootstrapState: MODEL_BOOTSTRAP_STATES.VERIFYING,
        });

        const verifyResult = await verifyAllAssets(manifest, true);

        if (!verifyResult.complete) {
            throw new Error(`Missing required assets: ${verifyResult.missingAssets.join(', ')}`);
        }

        // Cache manifest
        await cacheManifest(manifest);

        // Mark as ready
        await updateModelState({
            version: manifest.version,
            ready: true,
            bootstrapState: MODEL_BOOTSTRAP_STATES.READY,
            pendingVersion: null,
            retryCount: 0,
            error: null,
        });

        // Cleanup old caches
        await cleanupOldCaches(manifest.version);

        console.log('[Model Ready] Bootstrap complete, model ready');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Model Ready] Bootstrap failed:', errorMessage);

        const state = await getModelState();
        const isIntegrityError = errorMessage.includes('INTEGRITY_MISMATCH');

        await updateModelState({
            bootstrapState: MODEL_BOOTSTRAP_STATES.ERROR,
            error: {
                code: isIntegrityError ? 'INTEGRITY_MISMATCH' : 'BOOTSTRAP_FAILED',
                message: errorMessage,
                at: Date.now(),
            },
        });

        // Schedule retry if not integrity error
        if (!isIntegrityError) {
            await scheduleRetry(state.retryCount ?? 0);
        } else {
            console.error('[Model Ready] Integrity error, not retrying. Server must provide correct file.');
        }
    } finally {
        bootstrapInProgress = false;
    }
}

/**
 * Ensure model is ready, triggering bootstrap if needed
 * Throws if model is not ready and offline
 */
export async function ensureModelReady(): Promise<void> {
    const state = await getModelState();

    // Check if ready
    if (state.ready && state.version === MODEL_VERSION) {
        return;
    }

    // Check if bootstrap is in progress
    if (state.bootstrapState === MODEL_BOOTSTRAP_STATES.DOWNLOADING ||
        state.bootstrapState === MODEL_BOOTSTRAP_STATES.VERIFYING) {
        throw new Error('MODEL_BOOTSTRAP_IN_PROGRESS');
    }

    // Check for error state
    if (state.bootstrapState === MODEL_BOOTSTRAP_STATES.ERROR && state.error) {
        throw new Error(`MODEL_NOT_READY: ${state.error.message}`);
    }

    // Try to bootstrap
    console.log('[Model Ready] Model not ready, triggering bootstrap');
    await bootstrapModel();

    // Recheck state
    const newState = await getModelState();
    if (!newState.ready) {
        if (!navigator.onLine) {
            throw new Error('MODEL_NOT_READY_OFFLINE');
        }
        throw new Error('MODEL_NOT_READY: Bootstrap incomplete');
    }
}

/**
 * Get URL for a cached model asset
 */
export async function getModelCacheUrl(assetPath: string): Promise<string> {
    const state = await getModelState();

    if (!state.ready || !state.version) {
        throw new Error('Model not ready');
    }

    const cache = await getCacheForVersion(state.version);
    if (!cache) {
        throw new Error('Cache not available');
    }

    const cacheKey = `/${state.version}/${assetPath}`;
    const cached = await cache.match(cacheKey);

    if (!cached) {
        throw new Error(`Asset not found in cache: ${assetPath}`);
    }

    // Create blob URL for the cached response
    const blob = await cached.blob();
    return URL.createObjectURL(blob);
}

/**
 * Check model readiness without triggering bootstrap
 */
export async function isModelReady(): Promise<boolean> {
    const state = await getModelState();
    return state.ready && state.version === MODEL_VERSION;
}

/**
 * Get current model state for debugging
 */
export async function getModelDebugInfo(): Promise<any> {
    const state = await getModelState();
    const caches = await listModelCaches();

    return {
        ...state,
        targetVersion: MODEL_VERSION,
        availableCaches: caches,
    };
}

/**
 * Initialize model system on install/update
 */
export async function initializeModelSystem(reason: string): Promise<void> {
    console.log('[Model Ready] Initializing model system, reason:', reason);

    if (reason === 'install' || reason === 'update') {
        // Trigger bootstrap
        await bootstrapModel();
    } else {
        // Verify existing cache on startup
        const state = await getModelState();
        if (state.ready && state.version) {
            console.log('[Model Ready] Verifying existing cache');
            const verifyResult = await verifyAllAssets(
                await fetchManifest(state.version, true),
                false
            );

            if (!verifyResult.complete) {
                console.warn('[Model Ready] Cache incomplete, triggering repair');
                await updateModelState({ ready: false });
                await bootstrapModel();
            }
        } else if (!state.ready) {
            console.log('[Model Ready] Not ready on startup, checking bootstrap');
            await bootstrapModel();
        }
    }
}
