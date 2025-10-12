console.log('[Offscreen] Document loaded');

// Notify background that worker is ready
chrome.runtime.sendMessage({ type: 'WorkerReady' }).catch(err => {
    console.warn('[Offscreen] Failed to send WorkerReady:', err);
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Offscreen] Message received:', message.type);

    // Ping handler for health checks
    if (message.type === 'Ping') {
        console.log('[Offscreen] Ping received, responding...');
        sendResponse({ type: 'Pong', ok: true });
        return true;
    }

    if (message.type === 'InitWorker') {
        console.log('[Offscreen] Init worker requested');
        // TODO: Initialize embedding model
        sendResponse({ type: 'WorkerReady' });
        return true;
    }

    if (message.type === 'ProcessBatch') {
        console.log('[Offscreen] Process batch:', message.jobs.length, 'jobs');
        console.log('[Offscreen] Job URLs:', message.jobs.map(j => j.url));
        // TODO: Process jobs and generate embeddings

        // Mock success response for now
        const results = message.jobs.map(job => ({
            id: job.url,
            url: job.url
        }));

        console.log('[Offscreen] Sending results:', results.length);
        sendResponse({
            type: 'BatchResult',
            ok: true,
            results: results
        });
        return true;
    }

    console.warn('[Offscreen] Unknown message type:', message.type);
    return false;
});
