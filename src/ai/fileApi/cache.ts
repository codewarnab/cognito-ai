/**
 * PDF Upload Cache
 * Caches uploaded PDFs to avoid re-uploading the same URL
 * Cache is valid until the file expires (48 hours)
 */

import type { UploadedPDFContext } from './types';
import { createLogger } from '../../logger';

const log = createLogger('PDFCache');
const PDF_CACHE_KEY = 'pdf_upload_cache';

interface PdfCacheEntry {
    url: string;
    fileUri: string;
    fileName: string;
    uploadedAt: number;
    expiresAt: number;
}

/**
 * Get cached PDF context by URL
 * Returns null if not cached or expired
 */
export async function getCachedPdf(url: string): Promise<UploadedPDFContext | null> {
    try {
        const cache = await chrome.storage.local.get(PDF_CACHE_KEY);
        const entries: PdfCacheEntry[] = cache[PDF_CACHE_KEY] || [];

        const entry = entries.find((e) => e.url === url);

        // Check if entry exists and hasn't expired
        if (entry && entry.expiresAt > Date.now()) {
            log.info('Cache hit', { url, fileUri: entry.fileUri });
            return {
                url: entry.url,
                fileUri: entry.fileUri,
                fileName: entry.fileName,
                uploadedAt: entry.uploadedAt,
                expiresAt: entry.expiresAt,
            };
        }

        if (entry && entry.expiresAt <= Date.now()) {
            log.debug('Cache entry expired', { url });
        }

        log.debug('Cache miss', { url });
        return null;
    } catch (error) {
        log.error('Failed to read cache', error);
        return null;
    }
}

/**
 * Cache an uploaded PDF context
 */
export async function cachePdf(context: UploadedPDFContext): Promise<void> {
    try {
        const cache = await chrome.storage.local.get(PDF_CACHE_KEY);
        const entries: PdfCacheEntry[] = cache[PDF_CACHE_KEY] || [];

        // Remove existing entry for this URL (if any)
        const filteredEntries = entries.filter((e) => e.url !== context.url);

        // Add new entry
        filteredEntries.push({
            url: context.url,
            fileUri: context.fileUri,
            fileName: context.fileName,
            uploadedAt: context.uploadedAt,
            expiresAt: context.expiresAt,
        });

        // Keep only non-expired entries (cleanup)
        const validEntries = filteredEntries.filter((e) => e.expiresAt > Date.now());

        // Limit cache size (keep max 50 entries)
        const limitedEntries = validEntries.slice(-50);

        await chrome.storage.local.set({
            [PDF_CACHE_KEY]: limitedEntries,
        });

        log.info('PDF cached', {
            url: context.url,
            totalCached: limitedEntries.length,
        });
    } catch (error) {
        log.error('Failed to cache PDF', error);
    }
}

/**
 * Clear expired entries from cache
 */
export async function cleanupCache(): Promise<void> {
    try {
        const cache = await chrome.storage.local.get(PDF_CACHE_KEY);
        const entries: PdfCacheEntry[] = cache[PDF_CACHE_KEY] || [];

        const validEntries = entries.filter((e) => e.expiresAt > Date.now());

        if (validEntries.length < entries.length) {
            await chrome.storage.local.set({
                [PDF_CACHE_KEY]: validEntries,
            });
            log.info('Cache cleaned up', {
                removed: entries.length - validEntries.length,
                remaining: validEntries.length,
            });
        }
    } catch (error) {
        log.error('Failed to cleanup cache', error);
    }
}

/**
 * Clear all cache entries
 */
export async function clearCache(): Promise<void> {
    try {
        await chrome.storage.local.remove(PDF_CACHE_KEY);
        log.info('Cache cleared');
    } catch (error) {
        log.error('Failed to clear cache', error);
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
}> {
    try {
        const cache = await chrome.storage.local.get(PDF_CACHE_KEY);
        const entries: PdfCacheEntry[] = cache[PDF_CACHE_KEY] || [];

        const now = Date.now();
        const validEntries = entries.filter((e) => e.expiresAt > now);
        const expiredEntries = entries.filter((e) => e.expiresAt <= now);

        return {
            totalEntries: entries.length,
            validEntries: validEntries.length,
            expiredEntries: expiredEntries.length,
        };
    } catch (error) {
        log.error('Failed to get cache stats', error);
        return {
            totalEntries: 0,
            validEntries: 0,
            expiredEntries: 0,
        };
    }
}
