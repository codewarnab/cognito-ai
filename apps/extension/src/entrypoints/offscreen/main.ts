/**
 * Offscreen Document Entry Point
 * 
 * Runs inside offscreen.html to provide DOM APIs to the background script.
 * Handles:
 * - Chrome Summarizer API
 * - Geolocation API
 * - Device Fingerprinting
 * 
 * NOTE: When HIDE_LOCAL_MODE is enabled, the caller (background script)
 * should NOT invoke the summarizer endpoints. The check happens in
 * src/utils/ai/summarizer.ts before calling the offscreen document.
 */

// Summarizer state
let creating = false;
let cachedSummarizer: SummarizerSession | null = null;
let lastSummarizerOptions: string | null = null;
let lastProgressPercent: number | undefined;

async function getAvailability(): Promise<{ ok: boolean; code?: string; message?: string; availability?: SummarizerAvailability }> {
    if (typeof window.Summarizer === 'undefined') {
        return { ok: false, code: 'unavailable', message: 'Summarizer API not present' };
    }
    const availability = await window.Summarizer.availability();
    return { ok: true, availability };
}

// Main message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        // Summarizer availability check
        if (message?.type === 'offscreen/summarize/availability') {
            const res = await getAvailability();
            sendResponse(res);
            return;
        }

        // Summarizer request
        if (message?.type === 'offscreen/summarize/request') {
            try {
                if (typeof window.Summarizer === 'undefined') {
                    sendResponse({ ok: false, code: 'unavailable', message: 'Summarizer API not present' });
                    return;
                }

                const { requestId, text, options, context } = message.payload || {};
                const availability = await window.Summarizer.availability();
                if (availability === 'unavailable') {
                    sendResponse({ ok: false, code: 'unavailable', message: 'Summarizer unavailable' });
                    return;
                }

                const summarizerOptions: SummarizerCreateOptions = {
                    type: options?.type || 'headline',
                    format: options?.format || 'plain-text',
                    length: options?.length || 'short',
                };

                // Check if we can reuse the cached summarizer first
                const optionsKey = JSON.stringify(summarizerOptions);

                if (cachedSummarizer && lastSummarizerOptions === optionsKey) {
                    console.log('[Offscreen] Reusing cached summarizer');
                    const summary = await cachedSummarizer.summarize(String(text || ''));
                    sendResponse({ ok: true, summary });
                    return;
                }

                // Prevent concurrent creation
                if (creating) {
                    sendResponse({ ok: false, code: 'busy', message: 'Summarizer creation in progress' });
                    return;
                }

                // Handle downloadable case with progress monitoring
                const createOptions: SummarizerCreateOptions = { ...summarizerOptions };

                if (availability === 'downloadable') {
                    createOptions.monitor = (m: DownloadMonitor) => {
                        m.addEventListener('downloadprogress', (e: DownloadProgressEvent) => {
                            // Throttle progress updates - only send every 10% of total
                            const loaded = e.loaded ?? 0;
                            const total = e.total ?? 1;
                            const progressPercent = total > 0 ? Math.floor((loaded / total) * 10) : 0;

                            // Only send if this is a new 10% increment
                            if (lastProgressPercent === undefined || lastProgressPercent !== progressPercent) {
                                lastProgressPercent = progressPercent;
                                chrome.runtime.sendMessage({
                                    type: 'summarize:progress',
                                    payload: { requestId, loaded, total }
                                }).catch(() => { /* ignore */ });
                            }
                        });
                    };
                }

                // Create new summarizer
                creating = true;

                if (cachedSummarizer) {
                    try {
                        cachedSummarizer.destroy();
                    } catch (e) {
                        console.warn('[Offscreen] Error destroying old summarizer:', e);
                    }
                }

                try {
                    const summarizer = await window.Summarizer.create(createOptions);

                    // Cache the summarizer for reuse
                    cachedSummarizer = summarizer;
                    lastSummarizerOptions = optionsKey;

                    creating = false;

                    const summary = await summarizer.summarize(String(text || ''));
                    // Don't destroy - keep cached for next use

                    sendResponse({ ok: true, summary });
                } catch (createError) {
                    creating = false;
                    throw createError;
                }
            } catch (err) {
                creating = false;
                const error = err as Error;
                const name = error?.name || '';
                const errorMessage = error?.message || String(err);
                if (name === 'NotAllowedError') {
                    sendResponse({ ok: false, code: 'not-allowed', message: errorMessage });
                } else {
                    sendResponse({ ok: false, code: 'error', message: errorMessage });
                }
            }
            return;
        }

        // Geolocation request
        if (message?.type === 'offscreen/geolocation/request') {
            try {
                const { options } = message.payload || {};

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        sendResponse({
                            ok: true,
                            location: {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                            }
                        });
                    },
                    (error) => {
                        sendResponse({
                            ok: false,
                            error: error.message,
                            code: error.code
                        });
                    },
                    options
                );
            } catch (err) {
                const error = err as Error;
                sendResponse({ ok: false, error: error.message });
            }
            return; // Keep channel open for async callback
        }

        // Fingerprint request
        if (message?.type === 'offscreen/fingerprint/request') {
            try {
                const fingerprint = await getFingerprint();
                sendResponse({ ok: true, fingerprint });
            } catch (e) {
                const error = e as Error;
                sendResponse({ ok: false, error: error.message });
            }
            return;
        }
    })();

    return true; // Keep message channel open for async response
});

// Keep the offscreen document alive
setInterval(() => {
    // heartbeat - prevents Chrome from garbage collecting the document
}, 30000);

/* ========== Device Fingerprinting Logic ========== */

interface DeviceSignals {
    screenWidth: number;
    screenHeight: number;
    colorDepth: number;
    pixelRatio: number;
    timezone: string;
    timezoneOffset: number;
    language: string;
    languages: string;
    platform: string;
    hardwareConcurrency: number;
    deviceMemory: number;
    touchSupport: boolean;
    maxTouchPoints: number;
    webglVendor: string;
}

/**
 * Collects device signals and generates a SHA-256 fingerprint hash.
 */
async function getFingerprint(): Promise<string> {
    const signals: DeviceSignals = {
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        language: navigator.language,
        languages: navigator.languages ? navigator.languages.join(',') : '',
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0,
        touchSupport: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        webglVendor: getWebGLVendor(),
    };

    // Sort keys for stability
    const data = JSON.stringify(signals, Object.keys(signals).sort());
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Get WebGL vendor string (helps identify GPU)
 */
function getWebGLVendor(): string {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'none';

        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'unknown';

        const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        return vendor || 'unknown';
    } catch {
        return 'error';
    }
}

console.log('[Offscreen] Document loaded and ready');
