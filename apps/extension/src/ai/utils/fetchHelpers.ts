/**
 * Fetch Helpers
 * Custom fetch utilities for AI provider API calls
 * Used by both Google Generative AI and Vertex AI
 */

import { createLogger } from '~logger';

const log = createLogger('AI-FetchHelpers', 'AI_CHAT');

/**
 * Custom fetch implementation that removes referrer header
 * This fixes 403 errors in Chrome extensions when calling AI APIs
 * 
 * @param url - The URL to fetch
 * @param init - Fetch initialization options
 * @returns Fetch response
 */
export async function customFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const newInit = { ...init };

    // Remove referrer header to avoid 403 errors in Chrome extensions
    if (newInit.headers) {
        const newHeaders = new Headers(newInit.headers);
        newHeaders.delete('Referer');

        // Inject Installation Token (Phase 1)
        try {
            const { getInstallationToken } = await import('../../utils/auth/installationToken');
            const token = await getInstallationToken();
            newHeaders.set('X-Extension-ID', token);
        } catch (e) {
            // Keep going even if token fails (fail open logic for now)
            log.warn('Failed to inject installation token:', e);
        }

        // Inject Device Fingerprint (Phase 2)
        try {
            const { getDeviceFingerprint } = await import('../../utils/auth/deviceFingerprint');
            const fingerprint = await getDeviceFingerprint();
            newHeaders.set('X-Device-FP', fingerprint);
        } catch (e) {
            log.warn('Failed to inject device fingerprint:', e);
        }

        newInit.headers = newHeaders;
    }

    const response = await fetch(url, newInit);

    // Handle error responses to provide better error messages
    if (!response.ok && (response.status === 403 || response.status === 401)) {
        // Clone the response to read the body without consuming it
        const clonedResponse = response.clone();
        try {
            const errorText = await clonedResponse.text();
            log.error('API authentication error:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 500) // Log first 500 chars
            });
        } catch (e) {
            log.error('Failed to read error response:', e);
        }
    }

    return response;
}

