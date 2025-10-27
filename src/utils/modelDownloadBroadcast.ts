/**
 * Model Download Progress Broadcasting
 * Broadcasts download progress via chrome.runtime messaging
 * so UI components can listen and display progress independently
 */

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
    chrome.runtime.sendMessage({
        type: 'MODEL_DOWNLOAD_PROGRESS',
        data: progress,
    }).catch((error) => {
        // Ignore errors if no listeners
        console.debug('No listeners for download progress:', error);
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
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => {
        if (message.type === 'MODEL_DOWNLOAD_PROGRESS') {
            callback(message.data);
        }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Return cleanup function
    return () => {
        chrome.runtime.onMessage.removeListener(listener);
    };
}
