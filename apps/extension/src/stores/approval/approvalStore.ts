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
import type { ApprovalState } from './types';

const log = createLogger('ApprovalStore', 'TOOLS_EXECUTION');

const STORAGE_KEY = 'toolApprovalPreferences';

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
                const result = await chrome.storage.local.get(STORAGE_KEY);
                const stored: StoredPreferences = { ...DEFAULT_STORED, ...result[STORAGE_KEY] };

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

        addSessionApproval: (toolName: string) => {
            const { sessionApprovedTools } = get();
            if (!sessionApprovedTools.includes(toolName)) {
                set({ sessionApprovedTools: [...sessionApprovedTools, toolName] });
                log.info('🔓 Added session approval:', { toolName });
            }
        },

        removeSessionApproval: (toolName: string) => {
            set({
                sessionApprovedTools: get().sessionApprovedTools.filter(t => t !== toolName),
            });
        },

        clearSessionApprovals: () => {
            set({
                sessionApprovedTools: [],
                mcpSessionApprovedTools: [],
                webmcpSessionApprovedTools: [],
            });
            log.info('🔓 Cleared all session approvals');
        },

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

        addAlwaysApproval: async (toolName: string) => {
            const { alwaysApprovedTools } = get();
            if (!alwaysApprovedTools.includes(toolName)) {
                set({ alwaysApprovedTools: [...alwaysApprovedTools, toolName] });
                await saveToStorage(get());
                log.info('✅ Added always approval:', { toolName });
            }
        },

        removeAlwaysApproval: async (toolName: string) => {
            set({
                alwaysApprovedTools: get().alwaysApprovedTools.filter(t => t !== toolName),
            });
            await saveToStorage(get());
        },

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
            await chrome.storage.local.remove(STORAGE_KEY);
            log.info('🗑️ Cleared all approvals');
        },

        // ═══════════════════════════════════════════════════════════════════════════
        // MCP Server Tool Approvals
        // ═══════════════════════════════════════════════════════════════════════════

        addMcpServerApproval: async (serverId: string) => {
            const { mcpApprovedServers } = get();
            if (!mcpApprovedServers.includes(serverId)) {
                set({ mcpApprovedServers: [...mcpApprovedServers, serverId] });
                await saveToStorage(get());
                log.info('🔌 Added MCP server approval:', { serverId });
            }
        },

        removeMcpServerApproval: async (serverId: string) => {
            set({
                mcpApprovedServers: get().mcpApprovedServers.filter(s => s !== serverId),
            });
            await saveToStorage(get());
        },

        isMcpServerApproved: (serverId: string): boolean => {
            return get().mcpApprovedServers.includes(serverId);
        },

        addMcpToolApproval: async (toolName: string) => {
            const { mcpApprovedTools } = get();
            if (!mcpApprovedTools.includes(toolName)) {
                set({ mcpApprovedTools: [...mcpApprovedTools, toolName] });
                await saveToStorage(get());
                log.info('🔧 Added MCP tool approval:', { toolName });
            }
        },

        removeMcpToolApproval: async (toolName: string) => {
            set({
                mcpApprovedTools: get().mcpApprovedTools.filter(t => t !== toolName),
            });
            await saveToStorage(get());
        },

        isMcpToolApproved: (toolName: string): boolean => {
            return get().mcpApprovedTools.includes(toolName);
        },

        addMcpSessionApproval: (toolName: string) => {
            const { mcpSessionApprovedTools } = get();
            if (!mcpSessionApprovedTools.includes(toolName)) {
                set({ mcpSessionApprovedTools: [...mcpSessionApprovedTools, toolName] });
                log.info('🔓 Added MCP session approval:', { toolName });
            }
        },

        removeMcpSessionApproval: (toolName: string) => {
            set({
                mcpSessionApprovedTools: get().mcpSessionApprovedTools.filter(t => t !== toolName),
            });
        },

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

        addWebmcpDomainApproval: async (domain: string) => {
            const { webmcpApprovedDomains } = get();
            if (!webmcpApprovedDomains.includes(domain)) {
                set({ webmcpApprovedDomains: [...webmcpApprovedDomains, domain] });
                await saveToStorage(get());
                log.info('🌐 Added WebMCP domain approval:', { domain });
            }
        },

        removeWebmcpDomainApproval: async (domain: string) => {
            set({
                webmcpApprovedDomains: get().webmcpApprovedDomains.filter(d => d !== domain),
            });
            await saveToStorage(get());
        },

        isWebmcpDomainApproved: (domain: string): boolean => {
            return get().webmcpApprovedDomains.includes(domain);
        },

        addWebmcpToolApproval: async (toolName: string) => {
            const { webmcpApprovedTools } = get();
            if (!webmcpApprovedTools.includes(toolName)) {
                set({ webmcpApprovedTools: [...webmcpApprovedTools, toolName] });
                await saveToStorage(get());
                log.info('🔧 Added WebMCP tool approval:', { toolName });
            }
        },

        removeWebmcpToolApproval: async (toolName: string) => {
            set({
                webmcpApprovedTools: get().webmcpApprovedTools.filter(t => t !== toolName),
            });
            await saveToStorage(get());
        },

        isWebmcpToolApproved: (toolName: string): boolean => {
            return get().webmcpApprovedTools.includes(toolName);
        },

        addWebmcpSessionApproval: (toolName: string) => {
            const { webmcpSessionApprovedTools } = get();
            if (!webmcpSessionApprovedTools.includes(toolName)) {
                set({ webmcpSessionApprovedTools: [...webmcpSessionApprovedTools, toolName] });
                log.info('🔓 Added WebMCP session approval:', { toolName });
            }
        },

        removeWebmcpSessionApproval: (toolName: string) => {
            set({
                webmcpSessionApprovedTools: get().webmcpSessionApprovedTools.filter(t => t !== toolName),
            });
        },

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
    await chrome.storage.local.set({ [STORAGE_KEY]: toStore });
}

// Listen for storage changes to sync across contexts
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
            const stored: StoredPreferences = { ...DEFAULT_STORED, ...changes[STORAGE_KEY].newValue };
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
