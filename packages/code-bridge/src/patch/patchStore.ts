import type { StoredPatch } from '../types.js';

/**
 * In-memory patch store
 * Patches are stored per-token to prevent cross-session access
 */
const store = new Map<string, StoredPatch>();

/**
 * Save a patch proposal
 */
export function savePatch(patch: StoredPatch): void {
  store.set(patch.patchId, patch);
}

/**
 * Get a patch by ID, only if it belongs to the given token
 */
export function getPatch(patchId: string, tokenHash: string): StoredPatch | null {
  const patch = store.get(patchId);
  
  if (!patch) {
    return null;
  }
  
  // Security: only return patch if it belongs to this token
  if (patch.tokenHash !== tokenHash) {
    return null;
  }
  
  return patch;
}

/**
 * Delete a patch after it's been applied
 */
export function deletePatch(patchId: string): void {
  store.delete(patchId);
}

/**
 * Clean up old patches (older than 1 hour)
 */
export function cleanupOldPatches(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  for (const [id, patch] of store) {
    if (patch.createdAt < oneHourAgo) {
      store.delete(id);
    }
  }
}
