/**
 * Tool Approval Configuration
 *
 * Defines which approval options are available per tool and how to extract
 * domain/website information for website-specific approvals.
 *
 * ## Domain Extraction Varies by Tool
 *
 * The meaning of "Allow for this website" differs by tool:
 * - navigateTo: Target URL's domain (where we're navigating TO)
 * - typeInText, clickByText: Current page's domain (where action happens)
 * - fillForm: Current page's domain
 *
 * ## Extensibility Guide
 *
 * To add a new tool with approval support:
 * 1. Add the tool to TOOLS_REQUIRING_APPROVAL in remoteMode.ts
 * 2. Add config below with:
 *    - supportsWebsiteApproval: true if the tool interacts with a specific website
 *    - extractDomain: function to get the relevant domain from tool input
 *
 * Tools that DON'T support website-specific approval (affect multiple sites):
 * - groupTabs, ungroupTabs, organizeTabsByContext
 * - getAllTabs, closeAllTabs
 * - Any tool that operates across multiple websites
 */

import { createLogger } from '~logger';

const log = createLogger('ApprovalConfig', 'TOOLS_EXECUTION');

export interface ToolApprovalConfig {
    /**
     * Whether this tool supports "Allow for this website" option.
     * Set to false for tools that operate across multiple websites.
     */
    supportsWebsiteApproval: boolean;

    /**
     * Extract the relevant domain from tool input.
     * - For navigateTo: extract from target URL
     * - For page interaction tools: would need current tab URL from context
     * 
     * @param input - The tool's input parameters
     * @param currentTabUrl - Optional: URL of the current active tab (for page interaction tools)
     * @returns Domain string or null if extraction fails
     */
    extractDomain?: (input: any, currentTabUrl?: string) => string | null;
}

/**
 * Tool approval configurations
 *
 * Add new tools here as they're added to TOOLS_REQUIRING_APPROVAL
 */
export const TOOL_APPROVAL_CONFIG: Record<string, ToolApprovalConfig> = {
    /**
     * navigateTo - Navigate to a URL
     * Domain is extracted from the TARGET URL (where we're going)
     */
    navigateTo: {
        supportsWebsiteApproval: true,
        extractDomain: (input: any) => {
            try {
                let url = input?.url;
                if (!url) return null;

                // Handle URLs without protocol (e.g., "codewarnab.in")
                if (!url.includes('://')) {
                    url = 'https://' + url;
                }

                return new URL(url).hostname;
            } catch {
                return null;
            }
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE INTERACTION TOOLS
    // These tools operate on the CURRENT PAGE, so domain is extracted from the
    // current tab URL (not from tool input like navigateTo)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * executeScript - Execute arbitrary JavaScript on the page
     * HIGHEST RISK - Can do anything on the current page
     * Domain is the CURRENT PAGE (where script runs)
     */
    executeScript: {
        supportsWebsiteApproval: true,
        extractDomain: (_input: any, currentTabUrl?: string) => {
            try {
                if (!currentTabUrl) return null;
                return new URL(currentTabUrl).hostname;
            } catch {
                return null;
            }
        },
    },

    /**
     * typeInField - Type text into an input field
     * HIGH RISK - Can fill sensitive forms (passwords, payments)
     * Domain is the CURRENT PAGE (where typing happens)
     */
    typeInField: {
        supportsWebsiteApproval: true,
        extractDomain: (_input: any, currentTabUrl?: string) => {
            try {
                if (!currentTabUrl) return null;
                return new URL(currentTabUrl).hostname;
            } catch {
                return null;
            }
        },
    },

    /**
     * clickByText - Click an element by its text content
     * HIGH RISK - Can submit forms, trigger purchases, navigate
     * Domain is the CURRENT PAGE (where click happens)
     */
    clickByText: {
        supportsWebsiteApproval: true,
        extractDomain: (_input: any, currentTabUrl?: string) => {
            try {
                if (!currentTabUrl) return null;
                return new URL(currentTabUrl).hostname;
            } catch {
                return null;
            }
        },
    },

    /**
     * pressKey - Press a keyboard key on focused element
     * MEDIUM RISK - Can submit forms, trigger shortcuts
     * Domain is the CURRENT PAGE (where key press happens)
     */
    pressKey: {
        supportsWebsiteApproval: true,
        extractDomain: (_input: any, currentTabUrl?: string) => {
            try {
                if (!currentTabUrl) return null;
                return new URL(currentTabUrl).hostname;
            } catch {
                return null;
            }
        },
    },

    /**
     * takeScreenshot - Capture screenshot of the page
     * LOWER RISK - Privacy concern on sensitive pages
     * Domain is the CURRENT PAGE (what's being captured)
     */
    takeScreenshot: {
        supportsWebsiteApproval: true,
        extractDomain: (_input: any, currentTabUrl?: string) => {
            try {
                if (!currentTabUrl) return null;
                return new URL(currentTabUrl).hostname;
            } catch {
                return null;
            }
        },
    },
};

/**
 * Get approval config for a tool
 */
export function getToolApprovalConfig(toolName: string): ToolApprovalConfig | null {
    return TOOL_APPROVAL_CONFIG[toolName] || null;
}

/**
 * Extract domain from tool input using the tool's config
 *
 * @param toolName - Name of the tool
 * @param input - Tool input parameters
 * @param currentTabUrl - Optional: URL of current tab (for page interaction tools)
 * @returns Domain string or null
 */
export function extractDomainFromInput(
    toolName: string,
    input: any,
    currentTabUrl?: string
): string | null {
    const config = TOOL_APPROVAL_CONFIG[toolName];

    if (!config?.extractDomain) {
        return null;
    }

    try {
        const domain = config.extractDomain(input, currentTabUrl);
        log.debug('Extracted domain for approval:', { toolName, domain, input });
        return domain;
    } catch (error) {
        log.warn('Failed to extract domain:', { toolName, error });
        return null;
    }
}

/**
 * Check if a tool supports website-specific approval
 */
export function supportsWebsiteApproval(toolName: string): boolean {
    const config = TOOL_APPROVAL_CONFIG[toolName];
    return config?.supportsWebsiteApproval ?? false;
}
