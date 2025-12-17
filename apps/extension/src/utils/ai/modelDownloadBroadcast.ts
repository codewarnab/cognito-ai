/**
 * Model Download Progress Broadcasting
 * Broadcasts download progress via chrome.runtime messaging
 * so UI components can listen and display progress independently
 */

import { trySendMessage } from '@/lib/messaging';

export interface ModelDownloadProgress {
    model: 'language' | 'summarizer';
    progress: number; // 0-100
    status: 'downloading' | 'complete' | 'error';
    message?: string;
}

/**
 * Broadcast download progress to all listeners
 */
export function broadcastDownloadProgress(progress: ModelDownloadProgress): void {
    // Broadcast to all extension contexts (sidepanel, popup, etc.)
    void trySendMessage('MODEL_DOWNLOAD_PROGRESS', {
        modelId: progress.model,
        loaded: progress.progress,
        total: 100,
        progress: progress.progress,
    });
}

/**
 * Listen for download progress broadcasts
 * @param callback - Function to call when progress is received
 * @returns Cleanup function to remove the listener
 */
export function listenToDownloadProgress(
    callback: (progress: ModelDownloadProgress) => void
): () => void {
    const listener = (
        message: unknown,
        _sender: chrome.runtime.MessageSender,
        _sendResponse: (response?: unknown) => void
    ) => {
        if (
            typeof message === 'object' &&
            message !== null &&
            'type' in message &&
            message.type === 'MODEL_DOWNLOAD_PROGRESS' &&
            'data' in message
        ) {
            callback(message.data as ModelDownloadProgress);
        }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Return cleanup function
    return () => {
        chrome.runtime.onMessage.removeListener(listener);
    };
}
