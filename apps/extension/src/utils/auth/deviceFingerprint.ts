/**
 * Device Fingerprint Generator
 * Creates a stable hash from browser/environment characteristics.
 * 
 * Privacy-conscious: Only uses non-sensitive, commonly available data.
 * Not meant to be unique per user, but to group requests from same device.
 */

const FINGERPRINT_CACHE_KEY = 'cognito:deviceFingerprint';
const FINGERPRINT_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedFingerprint {
    hash: string;
    generatedAt: number;
}

/**
 * Collects device characteristics for fingerprinting
 */
function collectDeviceSignals(): Record<string, string | number | boolean> {
    return {
        // Screen characteristics
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,

        // Timezone
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),

        // Language
        language: navigator.language,
        languages: navigator.languages.join(','),

        // Platform info (coarse)
        platform: navigator.platform,

        // Hardware concurrency (CPU cores)
        hardwareConcurrency: navigator.hardwareConcurrency || 0,

        // Memory (if available, rounded to nearest GB)
        deviceMemory: (navigator as any).deviceMemory || 0,

        // Touch support
        touchSupport: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints || 0,

        // WebGL renderer (coarsened)
        webglVendor: getWebGLVendor(),
    };
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
        // Return only vendor, not full renderer string (privacy)
        return vendor || 'unknown';
    } catch {
        return 'error';
    }
}

/**
 * Generate SHA-256 hash of device signals
 */
async function hashSignals(signals: Record<string, any>): Promise<string> {
    const data = JSON.stringify(signals, Object.keys(signals).sort());
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Get or generate device fingerprint
 * Caches for 24 hours to reduce computation
 */
export async function getDeviceFingerprint(): Promise<string> {
    try {
        // Check cache first
        const storage = await chrome.storage.local.get(FINGERPRINT_CACHE_KEY);
        const cached = storage[FINGERPRINT_CACHE_KEY] as CachedFingerprint | undefined;

        if (cached && Date.now() - cached.generatedAt < FINGERPRINT_TTL) {
            return cached.hash;
        }

        // Generate new fingerprint
        const signals = collectDeviceSignals();
        const hash = await hashSignals(signals);

        // Cache it
        await chrome.storage.local.set({
            [FINGERPRINT_CACHE_KEY]: {
                hash,
                generatedAt: Date.now(),
            } as CachedFingerprint,
        });

        return hash;
    } catch (error) {
        console.error('[DeviceFingerprint] Error generating fingerprint:', error);
        // Return a fallback that indicates failure
        return 'fp_error_' + Date.now();
    }
}

/**
 * Force regenerate fingerprint (useful after major browser updates)
 */
export async function regenerateFingerprint(): Promise<string> {
    await chrome.storage.local.remove(FINGERPRINT_CACHE_KEY);
    return getDeviceFingerprint();
}
