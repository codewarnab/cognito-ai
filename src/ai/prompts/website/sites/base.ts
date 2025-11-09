import type { WebsiteConfig } from '../types';

/**
 * Base Website Configuration
 * 
 * This is the default fallback configuration used for all websites
 * when no specific website configuration matches.
 * 
 * CHARACTERISTICS:
 * - Uses wildcard '*' pattern to match all URLs
 * - Has lowest priority (0) so it's checked last
 * - Includes general-purpose web browsing tools
 * - Minimal prompt additions (general web browsing guidance)
 * 
 * WHEN TO CREATE A WEBSITE-SPECIFIC CONFIG:
 * Create a new config file when you need to:
 * 1. Restrict tools to only those relevant for a specific website
 * 2. Add website-specific instructions/prompts to guide the AI
 * 3. Enable specialized tools that only work on that website
 * 
 * EXAMPLE - Creating a Google Docs config:
 * ```typescript
 * // File: google-docs.ts
 * export const googleDocsConfig: WebsiteConfig = {
 *   id: 'google-docs',
 *   name: 'Google Docs',
 *   urlPatterns: ['docs.google.com/document/'],
 *   allowedTools: [
 *     'readPageContent',
 *     'typeInField',
 *     'clickElement',
 *     'clickByText',
 *     'pressKey',
 *     'screenshot',
 *     // ... document-specific tools
 *   ],
 *   promptAddition: `
 *     🟢 GOOGLE DOCS DETECTED - DOCUMENT EDITING MODE
 *     
 *     Available tools and how to use them:
 *     - typeInField: Type text into the document
 *     - clickByText: Click menu items (File, Edit, Format)
 *     - ... detailed instructions ...
 *   `,
 *   priority: 10, // Higher priority = checked first
 * };
 * ```
 * 
 * Then add to sites/index.ts:
 * ```typescript
 * export { googleDocsConfig } from './google-docs';
 * ```
 * 
 * And import in websiteDetector.ts:
 * ```typescript
 * import { googleDocsConfig } from './sites';
 * const websiteConfigs: WebsiteConfig[] = [
 *   googleDocsConfig,
 *   baseWebsiteConfig,
 * ];
 * ```
 */
export const baseWebsiteConfig: WebsiteConfig = {
    id: 'base',
    name: 'General Website',
    urlPatterns: ['*'], // Matches all URLs (wildcard)

    // General-purpose tools available on all websites
    // These tools work across different web applications
    allowedTools: [
        'readPageContent',   // Text extraction and data scraping
        'takeScreenshot',    // Visual analysis when needed
        'getActiveTab',      // Get current tab information
        'clickElement',      // Interact with page elements
        'scrollPage',        // Navigate through content
        'navigateTo',        // Navigate to URLs
        'switchTabs',        // Switch between open tabs
        'clickByText',       // Click elements by visible text
        'typeInField',       // Type into input fields
        'pressKey',          // Press keyboard keys
        // Add more general tools here as needed
    ],

    // Minimal prompt addition for general web browsing
    // When website-specific configs are added, they should have more detailed prompts
    promptAddition: `
GENERAL WEB BROWSING MODE

You have access to general-purpose web automation tools.
Use them to help users browse, read, and interact with web pages.

Available tool categories:
- Content Reading: readPageContent (primary for text/data extraction)
- Visual Analysis: takeScreenshot (use when visual understanding needed)
- Navigation: navigateTo, switchTabs, scrollPage, getActiveTab
- Interaction: clickElement, clickByText, typeInField, pressKey

TOOL SELECTION:
- Use readPageContent for: text extraction, data scraping, articles, product details
- Use takeScreenshot for: visual comparisons, layout analysis, UI verification, design questions

Always verify the current page context before taking actions.
  `,

    priority: 0, // Lowest priority - only used as fallback
};