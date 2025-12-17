import { createLogger } from '~logger';
import { ensureOffscreenDocument } from '@/offscreen/ensure';

const log = createLogger('Background-Geolocation', 'BACKGROUND');

/**
 * Handle geolocation requests by routing them to the offscreen document
 */
export async function handleGeolocationRequest(message: any, sendResponse: (response?: any) => void) {
    try {
        log.info('Handling geolocation request');
        await ensureOffscreenDocument();

        // Forward to offscreen document
        const response = await chrome.runtime.sendMessage({
            type: 'offscreen/geolocation/request',
            payload: message.payload
        });

        log.info('Received geolocation response from offscreen');
        sendResponse(response);
    } catch (error) {
        log.error('Geolocation request failed:', error);
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
}
