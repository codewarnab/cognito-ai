/**
 * Chrome Permissions API Helpers
 */

import { createLogger } from '~logger';

const log = createLogger('ChromeAPI:Permissions');

/**
 * Check if we have permission for a specific Chrome API
 */
export async function checkPermission(permission: string): Promise<boolean> {
    try {
        const hasPermission = await chrome.permissions.contains({
            permissions: [permission],
        });
        return hasPermission;
    } catch (error) {
        log.warn(`Failed to check permission ${permission}:`, error);
        return false;
    }
}

/**
 * Request a specific Chrome API permission
 */
export async function requestPermission(permission: string): Promise<boolean> {
    try {
        const granted = await chrome.permissions.request({
            permissions: [permission],
        });

        if (granted) {
            log.info(`✅ Permission granted: ${permission}`);
        } else {
            log.warn(`❌ Permission denied: ${permission}`);
        }

        return granted;
    } catch (error) {
        log.error(`Failed to request permission ${permission}:`, error);
        return false;
    }
}
