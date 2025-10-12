/**
 * Offscreen document lifecycle management
 */

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const MAX_OFFSCREEN_LIFETIME_MS = 15_000;
const OFFSCREEN_READY_TIMEOUT_MS = 5000;

let offscreenCreatedAt: number | null = null;
let offscreenReady = false;

/**
 * Wait for offscreen document to be ready
 */
async function waitForOffscreenReady(): Promise<boolean> {
    console.log('[Offscreen] Waiting for document to be ready...');

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Offscreen] Timeout waiting for ready signal');
            resolve(false);
        }, OFFSCREEN_READY_TIMEOUT_MS);

        const listener = (message: any) => {
            if (message.type === 'WorkerReady') {
                console.log('[Offscreen] ✓ Received ready signal');
                clearTimeout(timeout);
                chrome.runtime.onMessage.removeListener(listener);
                offscreenReady = true;
                resolve(true);
            }
        };

        chrome.runtime.onMessage.addListener(listener);
    });
}

/**
 * Ensure offscreen document exists
 */
export async function ensureOffscreen(): Promise<void> {
    console.log('[Offscreen] ensureOffscreen called');
    const now = Date.now();

    // Check if offscreen is already created, valid, and ready
    if (offscreenCreatedAt &&
        (now - offscreenCreatedAt) < MAX_OFFSCREEN_LIFETIME_MS &&
        offscreenReady) {
        console.log('[Offscreen] Document already exists and ready');
        return;
    }

    try {
        // Check if offscreen document exists
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        });

        if (existingContexts.length > 0) {
            console.log('[Offscreen] Document exists, checking readiness...');
            offscreenCreatedAt = now;

            // Try to ping it to see if it's responsive
            try {
                const response = await chrome.runtime.sendMessage({ type: 'Ping' });
                if (response?.ok) {
                    console.log('[Offscreen] Document is responsive');
                    offscreenReady = true;
                    return;
                }
            } catch (e) {
                console.warn('[Offscreen] Existing document not responsive:', e);
            }

            // If we get here, document exists but isn't responsive
            // Close it and recreate it
            console.warn('[Offscreen] Document exists but not responsive, closing and recreating...');
            offscreenReady = false;

            try {
                await chrome.offscreen.closeDocument();
                console.log('[Offscreen] Unresponsive document closed');
                offscreenCreatedAt = null;
                // Wait a bit before recreating
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (closeError) {
                console.warn('[Offscreen] Error closing unresponsive document:', closeError);
                // Continue anyway - try to create a new one
            }
            // Fall through to create a new document
        }

        // No document exists, create one
        console.log('[Offscreen] No document exists, creating new one...');
        offscreenReady = false;

        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['WORKERS' as chrome.offscreen.Reason],
            justification: 'Run embedding model and search workers',
        });

        offscreenCreatedAt = now;
        console.log('[Offscreen] Document created, waiting for ready signal...');

        // Wait for ready signal
        const ready = await waitForOffscreenReady();

        if (!ready) {
            console.warn('[Offscreen] Document created but no ready signal received, trying to ping...');
            // Try to ping it directly as a fallback
            try {
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit more
                const response = await chrome.runtime.sendMessage({ type: 'Ping' });
                if (response?.ok) {
                    console.log('[Offscreen] ✓ Document responded to ping');
                    offscreenReady = true;
                } else {
                    console.warn('[Offscreen] ✗ Document ping failed, marking as not ready');
                    offscreenReady = false;
                }
            } catch (pingError) {
                console.error('[Offscreen] ✗ Failed to ping document:', pingError);
                offscreenReady = false;
            }
        } else {
            console.log('[Offscreen] ✓ Document fully ready');
        }
    } catch (error: any) {
        const errorMsg = error?.message || String(error);

        // If document already exists, that's okay - just update our tracking
        if (errorMsg.includes('Only a single offscreen document')) {
            console.log('[Offscreen] Document already exists (caught error), updating tracking');
            offscreenCreatedAt = now;
            offscreenReady = false; // We don't know if it's ready
            return;
        }

        console.error('[Offscreen] Failed to create document:', error);
        offscreenCreatedAt = null;
        offscreenReady = false;
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
        offscreenReady = false;
        console.log('[Offscreen] Document closed (idle)');
    } catch (error) {
        // Ignore errors (document might already be closed)
        console.warn('[Offscreen] Error closing document:', error);
    }
}

/**
 * Get offscreen creation timestamp
 */
export function getOffscreenCreatedAt(): number | null {
    return offscreenCreatedAt;
}

/**
 * Check if offscreen is ready
 */
export function isOffscreenReady(): boolean {
    return offscreenReady;
}
