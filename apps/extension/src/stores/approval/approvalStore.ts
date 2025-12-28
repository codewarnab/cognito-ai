/**
 * Approval Store
 *
 * Manages tool auto-approval preferences for:
 * - Built-in extension tools (existing)
 * - MCP server tools (new)
 * - WebMCP website tools (new)
 *
 * Storage types:
 * - Session approvals: In-memory only, reset on browser restart
 * - Persisted approvals: Saved to Chrome storage
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createLogger } from '~logger';
import { STORAGE_KEYS } from '../constants';
import type { ApprovalState } from './types';

const log = createLogger('ApprovalStore', 'TOOLS_EXECUTION');

interface StoredPreferences {
    // Built-in tool approvals
    websiteApprovedTools: Record<string, string[]>;
    alwaysApprovedTools: string[];
    // MCP approvals
    mcpApprovedServers: string[];
    mcpApprovedTools: string[];
    // WebMCP approvals
    webmcpApprovedDomains: string[];
    webmcpApprovedTools: string[];
}

const DEFAULT_STORED: StoredPreferences = {
    websiteApprovedTools: {},
    alwaysApprovedTools: [],
    mcpApprovedServers: [],
    mcpApprovedTools: [],
    webmcpApprovedDomains: [],
    webmcpApprovedTools: [],
};

export const useApprovalStore = create<ApprovalState>()(
    subscribeWithSelector((set, get) => ({
        // ═══════════════════════════════════════════════════════════════════════════
        // Initial State
        // ═══════════════════════════════════════════════════════════════════════════

        // Built-in tools
        sessionApprovedTools: [],
        websiteApprovedTools: {},
        alwaysApprovedTools: [],

        // MCP tools
        mcpApprovedServers: [],
        mcpApprovedTools: [],
        mcpSessionApprovedTools: [],

        // WebMCP tools
        webmcpApprovedDomains: [],
        webmcpApprovedTools: [],
        webmcpSessionApprovedTools: [],

        isInitialized: false,

        // ═══════════════════════════════════════════════════════════════════════════
        // Initialization
        // ═══════════════════════════════════════════════════════════════════════════

        initialize: async () => {
            if (get().isInitialized) return;

            try {
                const result = await chrome.storage.local.get(STORAGE_KEYS.TOOL_APPROVAL);
                const stored: StoredPreferences = { ...DEFAULT_STORED, ...result[STORAGE_KEYS.TOOL_APPROVAL] };

                set({
                    // Built-in
                    websiteApprovedTools: stored.websiteApprovedTools,
                    alwaysApprovedTools: stored.alwaysApprovedTools,
                    // MCP
                    mcpApprovedServers: stored.mcpApprovedServers,
                    mcpApprovedTools: stored.mcpApprovedTools,
                    // WebMCP
                    webmcpApprovedDomains: stored.webmcpApprovedDomains,
                    webmcpApprovedTools: stored.webmcpApprovedTools,
                    isInitialized: true,
                });

                log.info('✅ Approval preferences loaded:', {
                    builtinWebsite: Object.keys(stored.websiteApprovedTools).length,
                    builtinAlways: stored.alwaysApprovedTools.length,
                    mcpServers: stored.mcpApprovedServers.length,
                    mcpTools: stored.mcpApprovedTools.length,
                    webmcpDomains: stored.webmcpApprovedDomains.length,
                    webmcpTools: stored.webmcpApprovedTools.length,
                });
            } catch (error) {
                log.error('Failed to load approval preferences:', error);
                set({ isInitialized: true });
            }
        },

        // ═══════════════════════════════════════════════════════════════════════════
        // Built-in Tool Approvals (existing)
        // ═══════════════════════════════════════════════════════════════════════════

        /**
         * Adds a session-only approval for a built-in tool.
         * @param toolName - The tool identifier to approve for this session
         */
        addSessionApproval: (toolName: string) => {
            const { sessionApprovedTools } = get();
            if (!sessionApprovedTools.includes(toolName)) {
                set({ sessionApprovedTools: [...sessionApprovedTools, toolName] });
                log.info('🔓 Added session approval:', { toolName });
            }
        },

        /**
         * Removes a session approval for a built-in tool.
         * @param toolName - The tool identifier to remove approval for
         */
        removeSessionApproval: (toolName: string) => {
            set({
                sessionApprovedTools: get().sessionApprovedTools.filter(t => t !== toolName),
            });
        },

        /**
         * Clears all session approvals (built-in, MCP, and WebMCP).
         */
        clearSessionApprovals: () => {
            set({
                sessionApprovedTools: [],
                mcpSessionApprovedTools: [],
                webmcpSessionApprovedTools: [],
            });
            log.info('🔓 Cleared all session approvals');
        },

        /**
         * Adds a website-specific approval for a built-in tool.
         * @param toolName - The tool identifier to approve
         * @param domain - The domain to approve the tool for
         */
        addWebsiteApproval: async (toolName: string, domain: string) => {
            const { websiteApprovedTools } = get();
            const toolDomains = websiteApprovedTools[toolName] || [];

            if (!toolDomains.includes(domain)) {
                const updated = {
                    ...websiteApprovedTools,
                    [toolName]: [...toolDomains, domain],
                };
                set({ websiteApprovedTools: updated });
                await saveToStorage(get());
                log.info('🌐 Added website approval:', { toolName, domain });
            }
        },

        /**
         * Removes a website-specific approval for a built-in tool.
         * @param toolName - The tool identifier
         * @param domain - The domain to remove approval for
         */
        removeWebsiteApproval: async (toolName: string, domain: string) => {
            const { websiteApprovedTools } = get();
            const toolDomains = websiteApprovedTools[toolName] || [];
            const updated = {
                ...websiteApprovedTools,
                [toolName]: toolDomains.filter(d => d !== domain),
            };
            set({ websiteApprovedTools: updated });
            await saveToStorage(get());
        },

        /**
         * Adds an always-approved status for a built-in tool (all sites).
         * @param toolName - The tool identifier to always approve
         */
        addAlwaysApproval: async (toolName: string) => {
            const { alwaysApprovedTools } = get();
            if (!alwaysApprovedTools.includes(toolName)) {
                set({ alwaysApprovedTools: [...alwaysApprovedTools, toolName] });
                await saveToStorage(get());
                log.info('✅ Added always approval:', { toolName });
            }
        },

        /**
         * Removes the always-approved status for a built-in tool.
         * @param toolName - The tool identifier to remove always-approval for
         */
        removeAlwaysApproval: async (toolName: string) => {
            set({
                alwaysApprovedTools: get().alwaysApprovedTools.filter(t => t !== toolName),
            });
            await saveToStorage(get());
        },

        /**
         * Checks if a built-in tool is auto-approved.
         * @param toolName - The tool identifier to check
         * @param domain - Optional domain for website-specific approval check
         * @returns True if the tool is auto-approved
         */
        isAutoApproved: (toolName: string, domain?: string): boolean => {
            const { sessionApprovedTools, websiteApprovedTools, alwaysApprovedTools } = get();

            if (alwaysApprovedTools.includes(toolName)) {
                log.debug('🔓 Auto-approved (always):', { toolName });
                return true;
            }

            if (sessionApprovedTools.includes(toolName)) {
                log.debug('🔓 Auto-approved (session):', { toolName });
                return true;
            }

            if (domain) {
                const toolDomains = websiteApprovedTools[toolName] || [];
                if (toolDomains.includes(domain)) {
                    log.debug('🔓 Auto-approved (website):', { toolName, domain });
                    return true;
                }
            }

            return false;
        },

        /**
         * Gets the reason why a built-in tool is auto-approved.
         * @param toolName - The tool identifier
         * @param domain - Optional domain for website-specific check
         * @returns The approval reason or null if not approved
         */
        getApprovalReason: (toolName: string, domain?: string): string | null => {
            const { sessionApprovedTools, websiteApprovedTools, alwaysApprovedTools } = get();

            if (alwaysApprovedTools.includes(toolName)) return 'all sites';
            if (sessionApprovedTools.includes(toolName)) return 'this session';
            if (domain) {
                const toolDomains = websiteApprovedTools[toolName] || [];
                if (toolDomains.includes(domain)) return domain;
            }
            return null;
        },

        /**
         * Clears all approval preferences (session, website, always, MCP, WebMCP).
         */
        clearAllApprovals: async () => {
            set({
                sessionApprovedTools: [],
                websiteApprovedTools: {},
                alwaysApprovedTools: [],
                mcpApprovedServers: [],
                mcpApprovedTools: [],
                mcpSessionApprovedTools: [],
                webmcpApprovedDomains: [],
                webmcpApprovedTools: [],
                webmcpSessionApprovedTools: [],
            });
            await chrome.storage.local.remove(STORAGE_KEYS.TOOL_APPROVAL);
            log.info('🗑️ Cleared all approvals');
        },

        // ═══════════════════════════════════════════════════════════════════════════
        // MCP Server Tool Approvals
        // ═══════════════════════════════════════════════════════════════════════════

        /**
         * Adds approval for all tools from an MCP server.
         * @param serverId - The MCP server identifier to approve
         */
        addMcpServerApproval: async (serverId: string) => {
            const { mcpApprovedServers } = get();
            if (!mcpApprovedServers.includes(serverId)) {
                set({ mcpApprovedServers: [...mcpApprovedServers, serverId] });
                await saveToStorage(get());
                log.info('🔌 Added MCP server approval:', { serverId });
            }
        },

        /**
         * Removes approval for an MCP server.
         * @param serverId - The MCP server identifier to remove approval for
         */
        removeMcpServerApproval: async (serverId: string) => {
            set({
                mcpApprovedServers: get().mcpApprovedServers.filter(s => s !== serverId),
            });
            await saveToStorage(get());
        },

        /**
         * Checks if an MCP server is approved.
         * @param serverId - The MCP server identifier to check
         * @returns True if the server is approved
         */
        isMcpServerApproved: (serverId: string): boolean => {
            return get().mcpApprovedServers.includes(serverId);
        },

        /**
         * Adds always-approval for a specific MCP tool.
         * @param toolName - The MCP tool name to approve
         */
        addMcpToolApproval: async (toolName: string) => {
            const { mcpApprovedTools } = get();
            if (!mcpApprovedTools.includes(toolName)) {
                set({ mcpApprovedTools: [...mcpApprovedTools, toolName] });
                await saveToStorage(get());
                log.info('🔧 Added MCP tool approval:', { toolName });
            }
        },

        /**
         * Removes always-approval for a specific MCP tool.
         * @param toolName - The MCP tool name to remove approval for
         */
        removeMcpToolApproval: async (toolName: string) => {
            set({
                mcpApprovedTools: get().mcpApprovedTools.filter(t => t !== toolName),
            });
            await saveToStorage(get());
        },

        /**
         * Checks if an MCP tool is always-approved.
         * @param toolName - The MCP tool name to check
         * @returns True if the tool is always-approved
         */
        isMcpToolApproved: (toolName: string): boolean => {
            return get().mcpApprovedTools.includes(toolName);
        },

        /**
         * Adds a session-only approval for an MCP tool.
         * @param toolName - The MCP tool name to approve for this session
         */
        addMcpSessionApproval: (toolName: string) => {
            const { mcpSessionApprovedTools } = get();
            if (!mcpSessionApprovedTools.includes(toolName)) {
                set({ mcpSessionApprovedTools: [...mcpSessionApprovedTools, toolName] });
                log.info('🔓 Added MCP session approval:', { toolName });
            }
        },

        /**
         * Removes a session approval for an MCP tool.
         * @param toolName - The MCP tool name to remove session approval for
         */
        removeMcpSessionApproval: (toolName: string) => {
            set({
                mcpSessionApprovedTools: get().mcpSessionApprovedTools.filter(t => t !== toolName),
            });
        },

        /**
         * Checks if an MCP tool is auto-approved (server, tool, or session level).
         * @param toolName - The MCP tool name to check
         * @param serverId - The MCP server identifier
         * @returns True if the tool is auto-approved
         */
        isMcpAutoApproved: (toolName: string, serverId: string): boolean => {
            const { mcpApprovedServers, mcpApprovedTools, mcpSessionApprovedTools } = get();

            // Check server-level approval (trust entire server)
            if (mcpApprovedServers.includes(serverId)) {
                log.debug('🔓 MCP auto-approved (server):', { toolName, serverId });
                return true;
            }

            // Check tool-level approval (always approve this tool)
            if (mcpApprovedTools.includes(toolName)) {
                log.debug('🔓 MCP auto-approved (tool):', { toolName });
                return true;
            }

            // Check session approval
            if (mcpSessionApprovedTools.includes(toolName)) {
                log.debug('🔓 MCP auto-approved (session):', { toolName });
                return true;
            }

            return false;
        },

        /**
         * Gets the reason why an MCP tool is auto-approved.
         * @param toolName - The MCP tool name
         * @param serverId - The MCP server identifier
         * @returns The approval reason or null if not approved
         */
        getMcpApprovalReason: (toolName: string, serverId: string): string | null => {
            const { mcpApprovedServers, mcpApprovedTools, mcpSessionApprovedTools } = get();

            if (mcpApprovedServers.includes(serverId)) return `server: ${serverId}`;
            if (mcpApprovedTools.includes(toolName)) return 'always';
            if (mcpSessionApprovedTools.includes(toolName)) return 'this session';
            return null;
        },

        // ═══════════════════════════════════════════════════════════════════════════
        // WebMCP Website Tool Approvals
        // ═══════════════════════════════════════════════════════════════════════════

        /**
         * Adds approval for all tools from a WebMCP domain.
         * @param domain - The domain to approve
         */
        addWebmcpDomainApproval: async (domain: string) => {
            const { webmcpApprovedDomains } = get();
            if (!webmcpApprovedDomains.includes(domain)) {
                set({ webmcpApprovedDomains: [...webmcpApprovedDomains, domain] });
                await saveToStorage(get());
                log.info('🌐 Added WebMCP domain approval:', { domain });
            }
        },

        /**
         * Removes approval for a WebMCP domain.
         * @param domain - The domain to remove approval for
         */
        removeWebmcpDomainApproval: async (domain: string) => {
            set({
                webmcpApprovedDomains: get().webmcpApprovedDomains.filter(d => d !== domain),
            });
            await saveToStorage(get());
        },

        /**
         * Checks if a WebMCP domain is approved.
         * @param domain - The domain to check
         * @returns True if the domain is approved
         */
        isWebmcpDomainApproved: (domain: string): boolean => {
            return get().webmcpApprovedDomains.includes(domain);
        },

        /**
         * Adds always-approval for a specific WebMCP tool.
         * @param toolName - The WebMCP tool name to approve
         */
        addWebmcpToolApproval: async (toolName: string) => {
            const { webmcpApprovedTools } = get();
            if (!webmcpApprovedTools.includes(toolName)) {
                set({ webmcpApprovedTools: [...webmcpApprovedTools, toolName] });
                await saveToStorage(get());
                log.info('🔧 Added WebMCP tool approval:', { toolName });
            }
        },

        /**
         * Removes always-approval for a specific WebMCP tool.
         * @param toolName - The WebMCP tool name to remove approval for
         */
        removeWebmcpToolApproval: async (toolName: string) => {
            set({
                webmcpApprovedTools: get().webmcpApprovedTools.filter(t => t !== toolName),
            });
            await saveToStorage(get());
        },

        /**
         * Checks if a WebMCP tool is always-approved.
         * @param toolName - The WebMCP tool name to check
         * @returns True if the tool is always-approved
         */
        isWebmcpToolApproved: (toolName: string): boolean => {
            return get().webmcpApprovedTools.includes(toolName);
        },

        /**
         * Adds a session-only approval for a WebMCP tool.
         * @param toolName - The WebMCP tool name to approve for this session
         */
        addWebmcpSessionApproval: (toolName: string) => {
            const { webmcpSessionApprovedTools } = get();
            if (!webmcpSessionApprovedTools.includes(toolName)) {
                set({ webmcpSessionApprovedTools: [...webmcpSessionApprovedTools, toolName] });
                log.info('🔓 Added WebMCP session approval:', { toolName });
            }
        },

        /**
         * Removes a session approval for a WebMCP tool.
         * @param toolName - The WebMCP tool name to remove session approval for
         */
        removeWebmcpSessionApproval: (toolName: string) => {
            set({
                webmcpSessionApprovedTools: get().webmcpSessionApprovedTools.filter(t => t !== toolName),
            });
        },

        /**
         * Checks if a WebMCP tool is auto-approved (domain, tool, or session level).
         * @param toolName - The WebMCP tool name to check
         * @param domain - The domain the tool belongs to
         * @returns True if the tool is auto-approved
         */
        isWebmcpAutoApproved: (toolName: string, domain: string): boolean => {
            const { webmcpApprovedDomains, webmcpApprovedTools, webmcpSessionApprovedTools } = get();

            // Check domain-level approval (trust entire website)
            if (webmcpApprovedDomains.includes(domain)) {
                log.debug('🔓 WebMCP auto-approved (domain):', { toolName, domain });
                return true;
            }

            // Check tool-level approval (always approve this tool)
            if (webmcpApprovedTools.includes(toolName)) {
                log.debug('🔓 WebMCP auto-approved (tool):', { toolName });
                return true;
            }

            // Check session approval
            if (webmcpSessionApprovedTools.includes(toolName)) {
                log.debug('🔓 WebMCP auto-approved (session):', { toolName });
                return true;
            }

            return false;
        },

        /**
         * Gets the reason why a WebMCP tool is auto-approved.
         * @param toolName - The WebMCP tool name
         * @param domain - The domain the tool belongs to
         * @returns The approval reason or null if not approved
         */
        getWebmcpApprovalReason: (toolName: string, domain: string): string | null => {
            const { webmcpApprovedDomains, webmcpApprovedTools, webmcpSessionApprovedTools } = get();

            if (webmcpApprovedDomains.includes(domain)) return domain;
            if (webmcpApprovedTools.includes(toolName)) return 'always';
            if (webmcpSessionApprovedTools.includes(toolName)) return 'this session';
            return null;
        },
    }))
);

// Helper to save persisted preferences
async function saveToStorage(state: ApprovalState) {
    const toStore: StoredPreferences = {
        // Built-in
        websiteApprovedTools: state.websiteApprovedTools,
        alwaysApprovedTools: state.alwaysApprovedTools,
        // MCP
        mcpApprovedServers: state.mcpApprovedServers,
        mcpApprovedTools: state.mcpApprovedTools,
        // WebMCP
        webmcpApprovedDomains: state.webmcpApprovedDomains,
        webmcpApprovedTools: state.webmcpApprovedTools,
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.TOOL_APPROVAL]: toStore });
}

// Listen for storage changes to sync across contexts
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        const toolApprovalChange = changes[STORAGE_KEYS.TOOL_APPROVAL];
        if (areaName === 'local' && toolApprovalChange) {
            const stored: StoredPreferences = { ...DEFAULT_STORED, ...toolApprovalChange.newValue };
            useApprovalStore.setState({
                // Built-in
                websiteApprovedTools: stored.websiteApprovedTools,
                alwaysApprovedTools: stored.alwaysApprovedTools,
                // MCP
                mcpApprovedServers: stored.mcpApprovedServers,
                mcpApprovedTools: stored.mcpApprovedTools,
                // WebMCP
                webmcpApprovedDomains: stored.webmcpApprovedDomains,
                webmcpApprovedTools: stored.webmcpApprovedTools,
            });
        }
    });
}
