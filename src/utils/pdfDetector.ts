import { createLogger } from '~logger';

const log = createLogger('PDFDetector');

export interface PDFUrlInfo {
    url: string;
    tabId: number;
    title?: string;
    contentType?: string;
}

/**
 * Check if a URL points to a PDF file
 * Checks file extension only (fast and reliable)
 */
export function isPdfUrl(url: string): boolean {
    // Check file extension
    if (url.toLowerCase().endsWith('.pdf')) {
        log.debug('URL ends with .pdf', { url });
        return true;
    }

    // Check if URL contains .pdf in the path (before query params)
    try {
        const urlObj = new URL(url);
        if (urlObj.pathname.toLowerCase().includes('.pdf')) {
            log.debug('URL path contains .pdf', { url });
            return true;
        }
    } catch (error) {
        // Invalid URL, check string directly
        if (url.toLowerCase().includes('.pdf')) {
            log.debug('URL contains .pdf', { url });
            return true;
        }
    }

    return false;
}

/**
 * Detect if a tab contains a PDF document
 * Returns PDF info if detected, null otherwise
 */
export async function detectPdfInTab(tabId: number): Promise<PDFUrlInfo | null> {
    try {
        const tab = await chrome.tabs.get(tabId);

        if (!tab.url) {
            log.debug('Tab has no URL', { tabId });
            return null;
        }

        // Skip chrome:// and other internal URLs
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
            return null;
        }

        const isPdf = isPdfUrl(tab.url);

        if (!isPdf) {
            log.debug('Tab does not contain PDF', { tabId, url: tab.url });
            return null;
        }

        log.info('PDF detected in tab', { tabId, url: tab.url, title: tab.title });

        return {
            url: tab.url,
            tabId: tab.id!,
            title: tab.title,
        };
    } catch (error) {
        log.error('Error detecting PDF in tab', { tabId, error });
        return null;
    }
}

/**
 * Debounced PDF processing manager
 * Prevents duplicate uploads when tab events fire multiple times
 */
class PdfProcessingDebouncer {
    private timeouts = new Map<string, NodeJS.Timeout>();
    private processing = new Set<string>();
    private readonly debounceMs: number;

    constructor(debounceMs = 1000) {
        this.debounceMs = debounceMs;
    }

    /**
     * Schedule PDF processing with debouncing
     * If called multiple times for the same URL, only the last call will execute
     */
    async scheduleProcessing(
        url: string,
        callback: () => Promise<void>
    ): Promise<void> {
        // Clear existing timeout for this URL
        const existingTimeout = this.timeouts.get(url);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            log.debug('Debouncing PDF processing', { url });
        }

        // Don't schedule if already processing
        if (this.processing.has(url)) {
            log.debug('PDF already processing, skipping', { url });
            return;
        }

        // Schedule new processing
        const timeout = setTimeout(async () => {
            this.timeouts.delete(url);
            this.processing.add(url);

            try {
                log.info('Processing PDF after debounce', { url });
                await callback();
            } catch (error) {
                log.error('PDF processing failed', error);
            } finally {
                this.processing.delete(url);
            }
        }, this.debounceMs);

        this.timeouts.set(url, timeout);
    }

    /**
     * Check if a URL is currently being processed
     */
    isProcessing(url: string): boolean {
        return this.processing.has(url);
    }

    /**
     * Check if a URL has a pending debounced call
     */
    isPending(url: string): boolean {
        return this.timeouts.has(url);
    }

    /**
     * Clear all pending timeouts
     */
    clearAll(): void {
        this.timeouts.forEach((timeout) => clearTimeout(timeout));
        this.timeouts.clear();
        this.processing.clear();
    }
}

// Singleton instance
export const pdfDebouncer = new PdfProcessingDebouncer(1000);

