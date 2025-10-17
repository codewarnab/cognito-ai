// Offscreen Summarizer Host
// Runs inside offscreen.html to own the Chrome Summarizer API lifecycle

let creating = false;
let ready = false;

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

                if (availability === 'downloadable') {
                    summarizerOptions.monitor = (m) => {
                        m.addEventListener('downloadprogress', (e) => {
                            chrome.runtime.sendMessage({
                                type: 'summarize:progress',
                                payload: { requestId, loaded: e.loaded ?? 0 }
                            }).catch(() => {});
                        });
                    };
                }

                creating = true;
                const summarizer = await window.Summarizer.create(summarizerOptions);
                creating = false;
                ready = true;

                const summary = await summarizer.summarize(String(text || ''), { context });
                summarizer.destroy();

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

