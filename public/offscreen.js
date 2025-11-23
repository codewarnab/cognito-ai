// Offscreen Summarizer Host
// Runs inside offscreen.html to own the Chrome Summarizer API lifecycle

let creating = false;
let ready = false;
let cachedSummarizer = null;
let lastSummarizerOptions = null;

async function getAvailability() {
    if (!window.Summarizer) return { ok: false, code: 'unavailable', message: 'Summarizer API not present' };
    const availability = await window.Summarizer.availability();
    return { ok: true, availability };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        if (message?.type === 'offscreen/summarize/availability') {
            const res = await getAvailability();
            sendResponse(res);
            return;
        }

        if (message?.type === 'offscreen/summarize/request') {
            try {
                if (!window.Summarizer) {
                    sendResponse({ ok: false, code: 'unavailable', message: 'Summarizer API not present' });
                    return;
                }

                const { requestId, text, options, context } = message.payload || {};
                const availability = await window.Summarizer.availability();
                if (availability === 'unavailable') {
                    sendResponse({ ok: false, code: 'unavailable', message: 'Summarizer unavailable' });
                    return;
                }

                const summarizerOptions = {
                    type: options?.type || 'headline',
                    format: options?.format || 'plain-text',
                    length: options?.length || 'short',
                    sharedContext: options?.sharedContext
                };

                // Check if we can reuse the cached summarizer first
                const optionsKey = JSON.stringify(summarizerOptions);

                if (cachedSummarizer && lastSummarizerOptions === optionsKey) {
                    console.log('[Offscreen] Reusing cached summarizer');
                    const summary = await cachedSummarizer.summarize(String(text || ''), { context });
                    sendResponse({ ok: true, summary });
                    return;
                }

                // Prevent concurrent creation
                if (creating) {
                    sendResponse({ ok: false, code: 'busy', message: 'Summarizer creation in progress' });
                    return;
                }

                if (availability === 'downloadable') {
                    summarizerOptions.monitor = (m) => {
                        m.addEventListener('downloadprogress', (e) => {
                            // Throttle progress updates - only send every 10% of total
                            const loaded = e.loaded ?? 0;
                            const total = e.total ?? loaded; // fallback if total unavailable
                            const progressPercent = total > 0 ? Math.floor((loaded / total) * 10) : 0; // 0-10 range

                            // Only send if this is a new 10% increment
                            if (!window._lastProgressPercent || window._lastProgressPercent !== progressPercent) {
                                window._lastProgressPercent = progressPercent;
                                chrome.runtime.sendMessage({
                                    type: 'summarize:progress',
                                    payload: { requestId, loaded, total }
                                }).catch(() => { });
                            }
                        });
                    };
                }

                // Create new summarizer
                creating = true;
                let summarizer;arizer if exists
                if (cachedSummarizer) {
                        try {
                            cachedSummarizer.destroy();
                        } catch (e) {
                            console.warn('[Offscreen] Error destroying old summarizer:', e);
                        }
                    }

                try {
                    summarizer = await window.Summarizer.create(summarizerOptions);

                    // Cache the summarizer for reuse
                    cachedSummarizer = summarizer;
                    lastSummarizerOptions = optionsKey;

                    creating = false;
                    ready = true;
                } catch (createError) {
                    creating = false;
                    throw createError;
                }

                const summary = await summarizer.summarize(String(text || ''), { context });
                // Don't destroy - keep cached for next use

                sendResponse({ ok: true, summary });
            } catch (err) {
                creating = false;
                const name = err?.name || '';
                const message = err?.message || String(err);
                if (name === 'NotAllowedError') {
                    sendResponse({ ok: false, code: 'not-allowed', message });
                } else {
                    sendResponse({ ok: false, code: 'error', message });
                }
            }
            return;
        }
    })();

    return true;
});

// Keep the offscreen document alive while needed. No-op interval to avoid premature GC.
setInterval(() => {
    // heartbeat
}, 30000);

