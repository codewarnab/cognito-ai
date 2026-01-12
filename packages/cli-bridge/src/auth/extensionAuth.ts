/**
 * Extension Origin Authentication
 *
 * NOTE: This is a *best-effort* gate for the local bridge. Because the bridge
 * is a plain HTTP server on localhost, any local process can spoof headers.
 * We still validate Origin to prevent accidental cross-origin access and to
 * keep the protocol aligned with extension-only callers.
 */

export interface AuthResult {
    valid: boolean;
    extensionId?: string;
    error?: string;
}

/**
 * Validates the Origin header to ensure it comes from the allowed extension.
 */
export function validateExtensionOrigin(origin: string | undefined): AuthResult {
    if (!origin) {
        return { valid: false, error: 'Missing Origin header' };
    }

    let url: URL;
    try {
        url = new URL(origin);
    } catch {
        return { valid: false, error: 'Invalid Origin header' };
    }

    // Only accept chrome-extension origins
    if (url.protocol !== 'chrome-extension:') {
        return { valid: false, error: 'Invalid origin protocol' };
    }

    const extensionId = url.hostname;
    if (!extensionId) {
        return { valid: false, error: 'Missing extension id in Origin' };
    }

    // Development mode: Allow any chrome-extension origin if EXTENSION_ID is not set or NODE_ENV is not production
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
        return { valid: true, extensionId };
    }

    const allowedExtensionId = process.env.EXTENSION_ID?.trim();

    if (!allowedExtensionId) {
        return { valid: false, error: 'EXTENSION_ID environment variable not set' };
    }

    // Production mode: Strict check
    if (extensionId !== allowedExtensionId) {
        return { valid: false, error: 'Unauthorized extension id' };
    }

    return { valid: true, extensionId };
}
