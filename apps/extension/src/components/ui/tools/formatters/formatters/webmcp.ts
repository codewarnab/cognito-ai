/**
 * WebMCP formatter - Formats WebMCP tool names into human-readable actions
 * Handles dynamic tool names like: webmcp_www_codewarnab_in_site_info
 */

import type { ActionFormatter, FormattedAction, ActionFormatterContext } from '../types';
import { camelToTitle } from '../helpers';

/**
 * Check if a tool name is a WebMCP tool
 * WebMCP tools follow the pattern: Webmcp_<domain>_<toolName>
 */
export function isWebMCPTool(toolName: string): boolean {
    return toolName.toLowerCase().startsWith('webmcp_');
}

/**
 * Parse a WebMCP tool name to extract domain and original tool name
 * Example: "Webmcp_www_codewarnab_in_site_info" -> { domain: "codewarnab.in", originalName: "site_info" }
 */
export function parseWebMCPToolName(toolName: string): { domain: string; originalName: string } | null {
    // Match pattern: webmcp_<domain_parts>_<tool_name>
    // Domain parts use underscores for dots (e.g., www_codewarnab_in = www.codewarnab.in)
    const lowerName = toolName.toLowerCase();
    if (!lowerName.startsWith('webmcp_')) {
        return null;
    }

    // Remove webmcp_ prefix
    const rest = toolName.substring(7); // "webmcp_" is 7 chars

    // Split by underscores
    const parts = rest.split('_');

    if (parts.length < 2) {
        return null;
    }

    // The last part(s) are the tool name - we need to find where domain ends
    // Domain parts typically end with TLD indicators like "com", "in", "org", etc.
    // For simplicity, we'll try to find common TLD patterns
    const tldPatterns = ['com', 'org', 'net', 'io', 'in', 'ai', 'dev', 'co', 'app', 'me', 'us', 'uk', 'de', 'fr', 'jp', 'cn'];

    let tldIndex = -1;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part && tldPatterns.includes(part.toLowerCase())) {
            tldIndex = i;
        }
    }

    if (tldIndex === -1 || tldIndex === parts.length - 1) {
        // No TLD found or TLD is at the end, use last part as tool name
        // This is a fallback for unusual domain patterns
        const domainParts = parts.slice(0, -1);
        const toolPart = parts[parts.length - 1] ?? 'unknown';
        return {
            domain: formatDomain(domainParts.join('_')),
            originalName: toolPart
        };
    }

    // Domain is parts[0..tldIndex], tool name is the rest
    const domainParts = parts.slice(0, tldIndex + 1);
    const toolParts = parts.slice(tldIndex + 1);

    return {
        domain: formatDomain(domainParts.join('_')),
        originalName: toolParts.join('_')
    };
}

/**
 * Format domain from underscore-separated to dot-separated
 * Also removes www. prefix for cleaner display
 * Example: "www_codewarnab_in" -> "codewarnab.in"
 */
export function formatDomain(underscoreDomain: string): string {
    // Replace underscores with dots
    let domain = underscoreDomain.replace(/_/g, '.');

    // Remove www. prefix for cleaner display
    if (domain.toLowerCase().startsWith('www.')) {
        domain = domain.substring(4);
    }

    return domain;
}

/**
 * Format the original tool name to be human-readable
 * Example: "site_info" -> "Site Info"
 */
export function formatToolName(originalName: string): string {
    // Replace underscores with spaces and capitalize
    return originalName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Get favicon URL for a domain using Google's favicon service
 * This is more reliable than trying to fetch /favicon.ico directly
 */
export function getFaviconUrl(domain: string): string {
    // Use Google's favicon service as it's reliable and handles most sites
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

/**
 * WebMCP tool formatter
 */
export const webmcpFormatter: ActionFormatter = (ctx: ActionFormatterContext): FormattedAction => {
    const { toolName, state } = ctx;

    const parsed = parseWebMCPToolName(toolName);

    if (!parsed) {
        // Fallback to simple formatting
        const friendlyName = camelToTitle(toolName.replace(/^[Ww]ebmcp_/, ''));
        return {
            action: friendlyName,
            description: state === 'error' ? 'Failed' : undefined
        };
    }

    const { domain, originalName } = parsed;
    const action = formatToolName(originalName);
    const faviconUrl = getFaviconUrl(domain);

    if (state === 'loading') {
        return {
            action: action,
            description: domain,
            faviconUrl
        };
    }

    if (state === 'success') {
        return {
            action: action,
            description: domain,
            faviconUrl
        };
    }

    if (state === 'pending-approval') {
        return {
            action: action,
            description: `${domain} • Waiting for approval`,
            faviconUrl
        };
    }

    return {
        action: `${action} failed`,
        description: domain,
        faviconUrl
    };
};

