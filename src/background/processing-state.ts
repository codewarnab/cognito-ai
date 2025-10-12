/**
 * Processing state - shared between queue and scheduler
 * Extracted to avoid circular dependencies
 */

let currentBatch: Array<{ url: string; title?: string }> = [];
let currentBatchStartTime = 0;
let isProcessing = false;

/**
 * Get current processing status
 */
export function getProcessingStatus() {
    return {
        isProcessing,
        currentBatch: currentBatch.map(job => ({ url: job.url, title: job.title })),
        processingCount: currentBatch.length,
        processingDuration: isProcessing ? Date.now() - currentBatchStartTime : 0,
    };
}

/**
 * Check if a URL is currently being processed
 */
export function isUrlBeingProcessed(url: string): boolean {
    return currentBatch.some(job => job.url === url);
}

/**
 * Check if scheduler is currently processing
 */
export function isSchedulerProcessing(): boolean {
    return isProcessing;
}

/**
 * Set current batch (called by scheduler)
 */
export function setCurrentBatch(batch: Array<{ url: string; title?: string }>): void {
    currentBatch = batch;
}

/**
 * Set processing state (called by scheduler)
 */
export function setProcessing(processing: boolean): void {
    isProcessing = processing;
    if (processing) {
        currentBatchStartTime = Date.now();
    }
}
