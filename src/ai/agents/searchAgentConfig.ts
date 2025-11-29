/**
 * Search Agent Configuration
 * Utilities for configuring AI agent with search capabilities
 */

import { createLogger } from '~logger';
import { getSearchPromptAddition } from '@/ai/prompts/searchPrompt';
import { filterToolsBySearchMode } from '@/ai/tools/searchToolFilter';
import type { SearchDepth } from '@/search/types';

const log = createLogger('SearchAgentConfig', 'SEARCH');

/**
 * Configuration for AI agent with search capabilities.
 */
export interface SearchAgentConfig {
    /** Whether search mode is enabled */
    searchEnabled: boolean;
    /** Search depth preference */
    searchDepth: SearchDepth;
    /** Maximum tool execution steps (higher when search enabled) */
    maxSteps: number;
    /** Additional system prompt for search */
    systemPromptAddition: string;
    /** Tool names to include/exclude based on search mode */
    activeTools: string[];
}

/** Default max steps without search */
const DEFAULT_MAX_STEPS = 3;

/** Max steps when search is enabled (allows for search + retrieval chains) */
const SEARCH_MAX_STEPS = 5;

/**
 * Creates search-aware agent configuration.
 * 
 * @param baseTools - Array of all registered tool names
 * @param searchEnabled - Whether search mode is enabled
 * @param searchDepth - Preferred search depth
 * @returns Configuration object for agent
 */
export function createSearchAgentConfig(
    baseTools: string[],
    searchEnabled: boolean,
    searchDepth: SearchDepth = 'basic'
): SearchAgentConfig {
    const activeTools = filterToolsBySearchMode(baseTools, searchEnabled);
    
    // Increase max steps when search is enabled to allow for search + retrieval chains
    const maxSteps = searchEnabled ? SEARCH_MAX_STEPS : DEFAULT_MAX_STEPS;

    log.debug('Created search agent config', {
        searchEnabled,
        searchDepth,
        maxSteps,
        toolCount: activeTools.length,
    });

    return {
        searchEnabled,
        searchDepth,
        maxSteps,
        systemPromptAddition: getSearchPromptAddition(searchEnabled),
        activeTools,
    };
}

/**
 * Merges search configuration into existing agent options.
 * Use this when configuring the streamText or generateText call.
 * 
 * @param baseConfig - Base agent configuration
 * @param searchConfig - Search configuration from createSearchAgentConfig
 * @returns Merged configuration with search additions
 */
export function mergeSearchConfig<T extends { system?: string; maxSteps?: number }>(
    baseConfig: T,
    searchConfig: SearchAgentConfig
): T & { system: string; maxSteps: number } {
    const mergedSystem = baseConfig.system 
        ? `${baseConfig.system}\n\n${searchConfig.systemPromptAddition}`
        : searchConfig.systemPromptAddition;

    return {
        ...baseConfig,
        system: mergedSystem.trim(),
        maxSteps: Math.max(baseConfig.maxSteps ?? 0, searchConfig.maxSteps),
    };
}

/**
 * Creates a minimal search config for quick checks.
 * Use when you only need to know if search is active.
 * 
 * @param searchEnabled - Whether search mode is enabled
 * @param hasApiKey - Whether API key is configured
 * @returns Simplified search state
 */
export function getSearchState(
    searchEnabled: boolean,
    hasApiKey: boolean
): { isActive: boolean; reason?: string } {
    if (!hasApiKey) {
        return { isActive: false, reason: 'No API key configured' };
    }
    if (!searchEnabled) {
        return { isActive: false, reason: 'Search mode disabled' };
    }
    return { isActive: true };
}
