/**
 * Approval Store
 *
 * Manages tool auto-approval preferences.
 * - Session approvals: In-memory only, reset on browser restart
 * - Website approvals: Persisted to Chrome storage
 * - Always approvals: Persisted to Chrome storage
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createLogger } from '~logger';
import type { ApprovalState } from './types';

const log = createLogger('ApprovalStore', 'TOOLS_EXECUTION');

const STORAGE_KEY = 'toolApprovalPreferences';

interface StoredPreferences {
    websiteApprovedTools: Record<string, string[]>;
    alwaysApprovedTools: string[];
}

export const useApprovalStore = create<ApprovalState>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        sessionApprovedTools: [],
        websiteApprovedTools: {},
        alwaysApprovedTools: [],
        isInitialized: false,

        initialize: async () => {
            if (get().isInitialized) return;

            try {
                const result = await chrome.storage.local.get(STORAGE_KEY);
                const stored: StoredPreferences = result[STORAGE_KEY] || {
                    websiteApprovedTools: {},
                    alwaysApprovedTools: [],
                };

                set({
                    websiteApprovedTools: stored.websiteApprovedTools,
                    alwaysApprovedTools: stored.alwaysApprovedTools,
                    isInitialized: true,
                });

                log.info('✅ Approval preferences loaded:', {
                    websiteApprovals: Object.keys(stored.websiteApprovedTools).length,
                    alwaysApprovals: stored.alwaysApprovedTools.length,
                });
            } catch (error) {
                log.error('Failed to load approval preferences:', error);
                set({ isInitialized: true });
            }
        },

        // Session approval (in-memory only)
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
            set({ sessionApprovedTools: [] });
            log.info('🔓 Cleared all session approvals');
        },

        // Website approval (persisted)
        addWebsiteApproval: async (toolName: string, domain: string) => {
            const { websiteApprovedTools } = get();
            const toolDomains = websiteApprovedTools[toolName] || [];

            if (!toolDomains.includes(domain)) {
                const updated = {
                    ...websiteApprovedTools,
                    [toolName]: [...toolDomains, domain],
                };
                set({ websiteApprovedTools: updated });

                // Persist
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

        // Always approval (persisted)
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

        // Check if tool is auto-approved
        isAutoApproved: (toolName: string, domain?: string): boolean => {
            const { sessionApprovedTools, websiteApprovedTools, alwaysApprovedTools } = get();

            // Check always approval first
            if (alwaysApprovedTools.includes(toolName)) {
                log.debug('🔓 Auto-approved (always):', { toolName });
                return true;
            }

            // Check session approval
            if (sessionApprovedTools.includes(toolName)) {
                log.debug('🔓 Auto-approved (session):', { toolName });
                return true;
            }

            // Check website approval (if domain provided)
            if (domain) {
                const toolDomains = websiteApprovedTools[toolName] || [];
                if (toolDomains.includes(domain)) {
                    log.debug('🔓 Auto-approved (website):', { toolName, domain });
                    return true;
                }
            }

            return false;
        },

        // Get the reason why a tool is auto-approved (for display in UI)
        getApprovalReason: (toolName: string, domain?: string): string | null => {
            const { sessionApprovedTools, websiteApprovedTools, alwaysApprovedTools } = get();

            // Check always approval first
            if (alwaysApprovedTools.includes(toolName)) {
                return 'all sites';
            }

            // Check session approval
            if (sessionApprovedTools.includes(toolName)) {
                return 'this session';
            }

            // Check website approval (if domain provided)
            if (domain) {
                const toolDomains = websiteApprovedTools[toolName] || [];
                if (toolDomains.includes(domain)) {
                    return domain;
                }
            }

            return null;
        },

        // Clear all approvals
        clearAllApprovals: async () => {
            set({
                sessionApprovedTools: [],
                websiteApprovedTools: {},
                alwaysApprovedTools: [],
            });
            await chrome.storage.local.remove(STORAGE_KEY);
            log.info('🗑️ Cleared all approvals');
        },
    }))
);

// Helper to save persisted preferences
async function saveToStorage(state: ApprovalState) {
    const toStore: StoredPreferences = {
        websiteApprovedTools: state.websiteApprovedTools,
        alwaysApprovedTools: state.alwaysApprovedTools,
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: toStore });
}

// Listen for storage changes to sync across contexts
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
            const stored: StoredPreferences = changes[STORAGE_KEY].newValue || {
                websiteApprovedTools: {},
                alwaysApprovedTools: [],
            };
            useApprovalStore.setState({
                websiteApprovedTools: stored.websiteApprovedTools,
                alwaysApprovedTools: stored.alwaysApprovedTools,
            });
        }
    });
}
