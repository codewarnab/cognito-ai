/**
 * Offscreen Document Management
 * 
 * Ensures that an offscreen document exists for running DOM APIs and scripts
 * that require a document context (like the Chrome Summarizer API).
 */

import { createLogger } from '~logger';

const log = createLogger('Background-Offscreen', 'BACKGROUND');

/**
 * Ensure a single offscreen document exists
 * 
 * Creates an offscreen document if one doesn't already exist. The offscreen document
 * provides an isolated context for running DOM APIs and scripts that require a
 * document context, such as the Chrome Summarizer API.
 * 
 * The function checks for existing documents using chrome.offscreen.hasDocument
 * (Chrome 116+) or falls back to attempting creation and ignoring errors if a
 * document already exists.
 * 
 * Reason: IFRAME_SCRIPTING is used to run DOM APIs & scripts in an isolated context.
 * Justification: Run Chrome Summarizer API in an isolated offscreen document.
 * 
 * @returns A promise that resolves when the document exists (either already present or newly created)
 */
export async function ensureOffscreenDocument(): Promise<void> {
    try {
        // Chrome 116+ has chrome.offscreen.hasDocument
        // Fallback: try creating and ignore if already exists
        const hasDoc: boolean = typeof chrome.offscreen?.hasDocument === 'function'
            ? await chrome.offscreen.hasDocument()
            : false;

        if (!hasDoc) {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                // Using IFRAME_SCRIPTING is appropriate for running DOM APIs & scripts
                reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
                justification: 'Run Chrome Summarizer API in an isolated offscreen document'
            });
            log.info('Offscreen document created');
        }
    } catch (error) {
        // Some Chrome versions throw if a document already exists
        log.warn('ensureOffscreenDocument warning:', error);
    }
}

