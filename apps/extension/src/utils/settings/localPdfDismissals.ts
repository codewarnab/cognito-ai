/**
 * LocalPDF Dismissals Management
 * 
 * Tracks which PDF files the user has dismissed from the suggestion badge
 * to avoid showing the same suggestion repeatedly in a session.
 * 
 * Uses in-memory caching to avoid repeated localStorage reads in hot paths.
 * Cache is invalidated on storage events (cross-tab) and visibility changes.
 */

import { createLogger } from '~logger';

const storageLog = createLogger('PDFDismissals', 'STORAGE_LOCAL');

const STORAGE_KEY = 'dismissed-pdf-suggestions';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DismissedPdf {
    filePath: string;
    dismissedAt: number;
}

/**
 * In-memory cache for dismissed PDFs
 * - null means cache is uninitialized or invalidated
 * - DismissedPdf[] is the cached value
 */
let dismissedPdfsCache: DismissedPdf[] | null = null;

/**
 * Track if event listeners have been registered
 */
let listenersRegistered = false;

/**
 * Invalidate the in-memory cache
 * Called on storage events and visibility changes
 */
function invalidateCache(): void {
    dismissedPdfsCache = null;
    storageLog.debug('PDF dismissals cache invalidated');
}

/**
 * Register event listeners for cache invalidation
 * Only registers once, handles SSR safety
 */
function ensureListenersRegistered(): void {
    if (listenersRegistered) return;
    if (typeof window === 'undefined') return;

    // Invalidate cache when other tabs modify localStorage
    window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === STORAGE_KEY || event.key === null) {
            invalidateCache();
        }
    });

    // Invalidate cache when tab becomes visible (may have been modified while hidden)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            invalidateCache();
        }
    });

    listenersRegistered = true;
    storageLog.debug('PDF dismissals cache listeners registered');
}

/**
 * Get all dismissed PDF suggestions from localStorage with caching
 */
function getDismissedPdfs(): DismissedPdf[] {
    // Ensure listeners are set up
    ensureListenersRegistered();

    // Return cached value if available
    if (dismissedPdfsCache !== null) {
        return dismissedPdfsCache;
    }

    try {
        // SSR safety check
        if (typeof localStorage === 'undefined') {
            return [];
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            dismissedPdfsCache = [];
            return [];
        }

        const parsed: DismissedPdf[] = JSON.parse(stored);

        // Filter out old dismissals (older than SESSION_DURATION)
        const now = Date.now();
        const valid = parsed.filter(
            (item) => now - item.dismissedAt < SESSION_DURATION_MS
        );

        // Update storage if we filtered anything out
        if (valid.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
        }

        // Update cache
        dismissedPdfsCache = valid;
        return valid;
    } catch (error) {
        storageLog.error('Error reading dismissed PDF suggestions', error);
        dismissedPdfsCache = [];
        return [];
    }
}

/**
 * Check if a PDF file path has been dismissed
 */
export function isPdfDismissed(filePath: string): boolean {
    const dismissed = getDismissedPdfs();
    return dismissed.some((item) => item.filePath === filePath);
}

/**
 * Mark a PDF file path as dismissed
 */
export function dismissPdf(filePath: string): void {
    try {
        const dismissed = getDismissedPdfs();

        // Don't add duplicate
        if (dismissed.some((item) => item.filePath === filePath)) {
            return;
        }

        const newDismissal: DismissedPdf = {
            filePath,
            dismissedAt: Date.now(),
        };

        dismissed.push(newDismissal);

        // SSR safety check
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
        }

        // Update cache immediately (write-through)
        dismissedPdfsCache = dismissed;
    } catch (error) {
        storageLog.error('Error dismissing PDF suggestion', error);
    }
}

/**
 * Clear all dismissed PDF suggestions (useful for testing or user preference)
 */
export function clearAllDismissals(): void {
    try {
        // SSR safety check
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
        // Clear cache
        dismissedPdfsCache = [];
    } catch (error) {
        storageLog.error('Error clearing PDF dismissals', error);
    }
}

/**
 * Remove a specific PDF from dismissals (un-dismiss)
 */
export function undismissPdf(filePath: string): void {
    try {
        const dismissed = getDismissedPdfs();
        const filtered = dismissed.filter((item) => item.filePath !== filePath);

        // SSR safety check
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        }

        // Update cache immediately (write-through)
        dismissedPdfsCache = filtered;
    } catch (error) {
        storageLog.error('Error un-dismissing PDF', error);
    }
}

