/**
 * Offscreen document lifecycle management
 */

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const MAX_OFFSCREEN_LIFETIME_MS = 15_000;

let offscreenCreatedAt: number | null = null;

/**
 * Ensure offscreen document exists
 */
export async function ensureOffscreen(): Promise<void> {
    // Check if offscreen is already created and still valid
    const now = Date.now();
    if (offscreenCreatedAt && (now - offscreenCreatedAt) < MAX_OFFSCREEN_LIFETIME_MS) {
        return;
    }

    try {
        // Check if offscreen document exists
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        });

        if (existingContexts.length > 0) {
            offscreenCreatedAt = now;
            return;
        }

        // Create offscreen document
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['WORKERS' as chrome.offscreen.Reason],
            justification: 'Run embedding model and search workers',
        });

        offscreenCreatedAt = now;
        console.log('[Offscreen] Document created');
    } catch (error) {
        console.error('[Offscreen] Failed to create document:', error);
        offscreenCreatedAt = null;
        throw error;
    }
}

/**
 * Close offscreen document if idle
 */
export async function closeOffscreenIfIdle(): Promise<void> {
    const now = Date.now();
    if (!offscreenCreatedAt || (now - offscreenCreatedAt) < MAX_OFFSCREEN_LIFETIME_MS) {
        return;
    }

    try {
        await chrome.offscreen.closeDocument();
        offscreenCreatedAt = null;
        console.log('[Offscreen] Document closed (idle)');
    } catch (error) {
        // Ignore errors (document might already be closed)
    }
}

/**
 * Get offscreen creation timestamp
 */
export function getOffscreenCreatedAt(): number | null {
    return offscreenCreatedAt;
}
