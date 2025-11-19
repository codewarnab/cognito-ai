/**
 * Ask AI Button Visibility Management
 * 
 * Provides utilities for managing the visibility of the Ask AI floating button
 * based on user preferences and drag-to-delete actions.
 */

export interface VisibilitySettings {
    hiddenDomains: string[];           // Domains where button is hidden
    hiddenForSession: boolean;         // Session-based hide (cleared on browser restart)
    permanentlyHidden: boolean;        // Global disable
}

const STORAGE_KEYS = {
    HIDDEN_DOMAINS: 'askAiButton.hiddenDomains',
    HIDDEN_FOR_SESSION: 'askAiButton.hiddenForSession',
    PERMANENTLY_HIDDEN: 'askAiButton.permanentlyHidden',
} as const;

/**
 * Get the current domain from a URL
 */
export function getCurrentDomain(url?: string): string {
    try {
        const targetUrl = url || window.location.href;
        const urlObj = new URL(targetUrl);
        return urlObj.hostname;
    } catch (error) {
        console.error('[AskAI Visibility] Error extracting domain:', error);
        return '';
    }
}

/**
 * Get current visibility settings from storage
 */
export async function getVisibilitySettings(): Promise<VisibilitySettings> {
    try {
        const result = await chrome.storage.local.get([
            STORAGE_KEYS.HIDDEN_DOMAINS,
            STORAGE_KEYS.PERMANENTLY_HIDDEN,
        ]);

        const sessionResult = await chrome.storage.session.get([
            STORAGE_KEYS.HIDDEN_FOR_SESSION,
        ]);

        return {
            hiddenDomains: result[STORAGE_KEYS.HIDDEN_DOMAINS] || [],
            permanentlyHidden: result[STORAGE_KEYS.PERMANENTLY_HIDDEN] || false,
            hiddenForSession: sessionResult[STORAGE_KEYS.HIDDEN_FOR_SESSION] || false,
        };
    } catch (error) {
        console.error('[AskAI Visibility] Error getting visibility settings:', error);
        return {
            hiddenDomains: [],
            permanentlyHidden: false,
            hiddenForSession: false,
        };
    }
}

/**
 * Hide button for the current page/domain
 */
export async function hideForCurrentPage(url?: string): Promise<void> {
    try {
        const domain = getCurrentDomain(url);

        if (!domain) {
            console.error('[AskAI Visibility] Cannot hide: invalid domain');
            return;
        }

        const settings = await getVisibilitySettings();

        // Add domain if not already in the list
        if (!settings.hiddenDomains.includes(domain)) {
            settings.hiddenDomains.push(domain);

            await chrome.storage.local.set({
                [STORAGE_KEYS.HIDDEN_DOMAINS]: settings.hiddenDomains,
            });

            console.log(`[AskAI Visibility] Hidden for domain: ${domain}`);
        }
    } catch (error) {
        console.error('[AskAI Visibility] Error hiding for current page:', error);
    }
}

/**
 * Hide button for the current session (cleared on browser restart)
 */
export async function hideForSession(): Promise<void> {
    try {
        await chrome.storage.session.set({
            [STORAGE_KEYS.HIDDEN_FOR_SESSION]: true,
        });

        console.log('[AskAI Visibility] Hidden for session');
    } catch (error) {
        console.error('[AskAI Visibility] Error hiding for session:', error);
    }
}

/**
 * Permanently hide the button (never show again)
 */
export async function hideForever(): Promise<void> {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEYS.PERMANENTLY_HIDDEN]: true,
        });

        console.log('[AskAI Visibility] Hidden permanently');
    } catch (error) {
        console.error('[AskAI Visibility] Error hiding permanently:', error);
    }
}

/**
 * Check if the button should be visible on the current page
 * Returns true if button should be shown, false otherwise
 */
export async function shouldShowButton(url?: string): Promise<boolean> {
    try {
        const settings = await getVisibilitySettings();

        // Check if permanently hidden
        if (settings.permanentlyHidden) {
            console.log('[AskAI Visibility] Button hidden permanently');
            return false;
        }

        // Check if hidden for session
        if (settings.hiddenForSession) {
            console.log('[AskAI Visibility] Button hidden for session');
            return false;
        }

        // Check if current domain is hidden
        const domain = getCurrentDomain(url);
        if (domain && settings.hiddenDomains.includes(domain)) {
            console.log(`[AskAI Visibility] Button hidden for domain: ${domain}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[AskAI Visibility] Error checking button visibility:', error);
        // Default to showing button if error occurs
        return true;
    }
}

/**
 * Clear session hide flag (called on browser startup)
 * This is typically called from the background script
 */
export async function clearSessionHide(): Promise<void> {
    try {
        await chrome.storage.session.set({
            [STORAGE_KEYS.HIDDEN_FOR_SESSION]: false,
        });

        console.log('[AskAI Visibility] Session hide cleared');
    } catch (error) {
        console.error('[AskAI Visibility] Error clearing session hide:', error);
    }
}

/**
 * Remove a specific domain from the hidden list
 * This is useful for settings UI to re-enable button on specific domains
 */
export async function removeDomainFromHidden(domain: string): Promise<void> {
    try {
        const settings = await getVisibilitySettings();

        settings.hiddenDomains = settings.hiddenDomains.filter(d => d !== domain);

        await chrome.storage.local.set({
            [STORAGE_KEYS.HIDDEN_DOMAINS]: settings.hiddenDomains,
        });

        console.log(`[AskAI Visibility] Removed domain from hidden list: ${domain}`);
    } catch (error) {
        console.error('[AskAI Visibility] Error removing domain from hidden:', error);
    }
}

/**
 * Re-enable the button globally (clear permanent hide)
 * This is useful for settings UI
 */
export async function reEnableButton(): Promise<void> {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEYS.PERMANENTLY_HIDDEN]: false,
        });

        console.log('[AskAI Visibility] Button re-enabled globally');
    } catch (error) {
        console.error('[AskAI Visibility] Error re-enabling button:', error);
    }
}

/**
 * Clear all hidden domains
 * This is useful for settings UI
 */
export async function clearAllHiddenDomains(): Promise<void> {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEYS.HIDDEN_DOMAINS]: [],
        });

        console.log('[AskAI Visibility] All hidden domains cleared');
    } catch (error) {
        console.error('[AskAI Visibility] Error clearing hidden domains:', error);
    }
}
