/**
 * MCP/WebMCP Tool Approval Configuration
 *
 * Provides helpers to identify tool types and generate approval options
 * for MCP server tools and WebMCP website tools.
 */

import { createLogger } from '~logger';
import { getToolServerId, isMcpTool as isMcpToolFromRegistry } from '@/utils/mcp/toolMetadataStore';
import type { ApprovalOption } from '@/components/ui/tools/cards/ApprovalDropdown';
import { useApprovalStore } from '@/stores/approval/approvalStore';

const log = createLogger('McpApprovalConfig', 'TOOLS_EXECUTION');

// ═══════════════════════════════════════════════════════════════════════════
// Tool Type Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a tool is an MCP server tool
 * MCP tools are registered via the proxy when servers connect
 */
export function isMcpTool(toolName: string): boolean {
    return isMcpToolFromRegistry(toolName);
}

/**
 * Check if a tool is a WebMCP tool (from a website)
 * WebMCP tools follow the naming pattern: webmcp_{domain}_{originalName}
 */
export function isWebmcpTool(toolName: string): boolean {
    return toolName.startsWith('webmcp_');
}

/**
 * Get the MCP server ID for a tool
 * Returns null if not an MCP tool or server not found
 */
export function getMcpServerId(toolName: string): string | null {
    return getToolServerId(toolName) || null;
}

/**
 * Extract domain from WebMCP tool name
 * WebMCP tools follow pattern: webmcp_{domain}_{originalName}
 * e.g., "webmcp_github.com_createIssue" → "github.com"
 */
export function getWebmcpDomain(toolName: string): string | null {
    if (!isWebmcpTool(toolName)) return null;

    // Remove "webmcp_" prefix
    const withoutPrefix = toolName.substring(7);

    // Domain is everything up to the second underscore
    // e.g., "github.com_createIssue" → "github.com"
    const underscoreIndex = withoutPrefix.indexOf('_');
    if (underscoreIndex === -1) return null;

    return withoutPrefix.substring(0, underscoreIndex);
}

/**
 * Get the original tool name from a WebMCP tool
 * e.g., "webmcp_github.com_createIssue" → "createIssue"
 */
export function getWebmcpOriginalName(toolName: string): string | null {
    if (!isWebmcpTool(toolName)) return null;

    const withoutPrefix = toolName.substring(7);
    const underscoreIndex = withoutPrefix.indexOf('_');
    if (underscoreIndex === -1) return null;

    return withoutPrefix.substring(underscoreIndex + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Approval Options Generators
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate approval dropdown options for an MCP tool
 */
export function getMcpApprovalOptions(
    toolName: string,
    serverId: string,
    onExecute: () => void
): ApprovalOption[] {
    const store = useApprovalStore.getState();

    return [
        {
            id: 'mcp-session',
            label: 'This session only',
            onClick: () => {
                store.addMcpSessionApproval(toolName);
                log.info('🔓 MCP session approval:', { toolName });
                onExecute();
            },
        },
        {
            id: 'mcp-tool',
            label: 'Always allow',
            onClick: () => {
                store.addMcpToolApproval(toolName);
                log.info('🔓 MCP tool approval:', { toolName });
                onExecute();
            },
        },
        {
            id: 'mcp-server',
            label: 'Trust this server',
            description: `All tools from ${serverId}`,
            onClick: () => {
                store.addMcpServerApproval(serverId);
                log.info('🔓 MCP server approval:', { serverId });
                onExecute();
            },
        },
    ];
}

/**
 * Generate approval dropdown options for a WebMCP tool
 */
export function getWebmcpApprovalOptions(
    toolName: string,
    domain: string,
    onExecute: () => void
): ApprovalOption[] {
    const store = useApprovalStore.getState();

    return [
        {
            id: 'webmcp-session',
            label: 'This session only',
            onClick: () => {
                store.addWebmcpSessionApproval(toolName);
                log.info('🔓 WebMCP session approval:', { toolName });
                onExecute();
            },
        },
        {
            id: 'webmcp-tool',
            label: 'Always allow',
            onClick: () => {
                store.addWebmcpToolApproval(toolName);
                log.info('🔓 WebMCP tool approval:', { toolName });
                onExecute();
            },
        },
        {
            id: 'webmcp-domain',
            label: 'Trust this site',
            description: `All tools from ${domain}`,
            onClick: () => {
                store.addWebmcpDomainApproval(domain);
                log.info('🔓 WebMCP domain approval:', { domain });
                onExecute();
            },
        },
    ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Approval Check Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if an MCP tool is auto-approved
 */
export function isMcpAutoApproved(toolName: string): boolean {
    const serverId = getMcpServerId(toolName);
    if (!serverId) return false;
    return useApprovalStore.getState().isMcpAutoApproved(toolName, serverId);
}

/**
 * Check if a WebMCP tool is auto-approved
 */
export function isWebmcpAutoApproved(toolName: string): boolean {
    const domain = getWebmcpDomain(toolName);
    if (!domain) return false;
    return useApprovalStore.getState().isWebmcpAutoApproved(toolName, domain);
}

/**
 * Get MCP approval reason for display
 */
export function getMcpApprovalReason(toolName: string): string | null {
    const serverId = getMcpServerId(toolName);
    if (!serverId) return null;
    return useApprovalStore.getState().getMcpApprovalReason(toolName, serverId);
}

/**
 * Get WebMCP approval reason for display
 */
export function getWebmcpApprovalReason(toolName: string): string | null {
    const domain = getWebmcpDomain(toolName);
    if (!domain) return null;
    return useApprovalStore.getState().getWebmcpApprovalReason(toolName, domain);
}
