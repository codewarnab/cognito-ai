import type { WebsiteConfig, WebsiteToolContext } from './types';
import { createLogger } from '~logger';
import {
    baseWebsiteConfig,
    // FUTURE: Import website-specific configs here
    // Example:
    // googleDocsConfig,
    // googleSheetsConfig,
} from './sites';

const log = createLogger('WebsiteDetector', 'AI_WEBSITE_DETECTION');

/**
 * Registry of all website configurations, sorted by priority (highest first)
 * 
 * FUTURE IMPLEMENTATION:
 * To add a new website-specific configuration:
 * 1. Create a new file in ./sites/ (e.g., google-docs.ts)
 * 2. Import it above
 * 3. Add it to this array with appropriate priority
 * 4. Higher priority configs are checked first
 * 
 * Example:
 * const websiteConfigs: WebsiteConfig[] = [
 *     googleDocsConfig,      // priority: 10
 *     googleSheetsConfig,    // priority: 10
 *     baseWebsiteConfig,     // priority: 0 (default fallback)
 * ].sort((a, b) => (b.priority || 0) - (a.priority || 0));
 */
const websiteConfigs: WebsiteConfig[] = [
    // Add website-specific configs here before baseWebsiteConfig
    baseWebsiteConfig, // Base config with lowest priority (0) - always last
].sort((a, b) => (b.priority || 0) - (a.priority || 0));

/**
 * Matches a URL to a website configuration
 * @param url - The URL to match
 * @returns Matching WebsiteConfig or null if no match found (will fallback to base config)
 * 
 * IMPLEMENTATION NOTE:
 * - Iterates through configs by priority (highest first)
 * - Matches URL against urlPatterns in each config
 * - Returns first matching config found
 * - Always falls back to baseWebsiteConfig if no specific match
 * 
 * FUTURE: When adding website-specific configs, ensure patterns are specific enough
 * Example patterns:
 * - 'docs.google.com/document/' for Google Docs
 * - 'docs.google.com/spreadsheets/' for Google Sheets
 * - 'github.com' for GitHub (will match all GitHub URLs)
 */
export function matchUrlToWebsite(url: string): WebsiteConfig | null {
    if (!url) {
        return null;
    }

    // Check each config by priority
    for (const config of websiteConfigs) {
        for (const pattern of config.urlPatterns) {
            // Handle wildcard pattern (base config)
            if (pattern === '*') {
                return config;
            }

            // Check if URL includes the pattern
            if (url.includes(pattern)) {
                return config;
            }
        }
    }

    // Fallback to base config (should never reach here as base has '*' pattern)
    return baseWebsiteConfig;
}

/**
 * Gets the current website configuration based on the active Chrome tab
 * @returns Promise resolving to WebsiteToolContext or null if detection fails
 * 
 * BEHAVIOR:
 * - Currently returns null for all sites (only base config exists)
 * - When website-specific configs are added, this will return their context
 * - null return means: use all tools with base prompt (no website-specific behavior)
 * 
 * FUTURE: When this returns a website context, the AI will:
 * - Use only the allowed tools for that website
 * - Get website-specific prompt additions injected
 * - Provide better, more focused assistance for that site
 */
export async function getCurrentWebsite(): Promise<WebsiteToolContext | null> {
    try {
        // Query for the active tab in the current window
        const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        if (!activeTab || !activeTab.url) {
            log.warn('No active tab or URL found');
            return null;
        }

        const currentUrl = activeTab.url;

        // Match URL to website config
        const config = matchUrlToWebsite(currentUrl);

        if (!config) {
            log.warn('No matching website config found for URL:', currentUrl);
            return null;
        }

        // If only base config exists (id === 'base'), return null
        // This signals to use all tools with no website-specific behavior
        if (config.id === 'base') {
            log.debug('Using base configuration (no website-specific tools)');
            return null;
        }

        // Build and return the context for website-specific configuration
        const context: WebsiteToolContext = {
            websiteId: config.id,
            websiteName: config.name,
            allowedTools: config.allowedTools,
            promptAddition: config.promptAddition,
            currentUrl,
        };

        return context;
    } catch (error) {
        log.error('Error detecting current website:', error);
        return null;
    }
}

/**
 * Gets all registered website configurations
 * @returns Array of all WebsiteConfig objects
 */
export function getAllWebsiteConfigs(): WebsiteConfig[] {
    return [...websiteConfigs];
}

/**
 * Registers a new website configuration dynamically
 * @param config - The WebsiteConfig to register
 * 
 * FUTURE USE CASE:
 * This allows adding website configs at runtime without modifying this file.
 * Useful for:
 * - User-defined website configurations
 * - Plugin/extension systems
 * - Dynamic website support based on user settings
 * 
 * Example usage:
 * ```typescript
 * registerWebsiteConfig({
 *   id: 'my-custom-site',
 *   name: 'My Custom Site',
 *   urlPatterns: ['mysite.com'],
 *   allowedTools: ['readPageContent', 'clickElement'],
 *   promptAddition: 'You are on My Custom Site...',
 *   priority: 5
 * });
 * ```
 */
export function registerWebsiteConfig(config: WebsiteConfig): void {
    // Check if config with same ID already exists
    const existingIndex = websiteConfigs.findIndex((c) => c.id === config.id);

    if (existingIndex !== -1) {
        // Replace existing config
        websiteConfigs[existingIndex] = config;
    } else {
        // Add new config
        websiteConfigs.push(config);
    }

    // Re-sort by priority
    websiteConfigs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

