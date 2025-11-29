/**
 * Search Mode with AI Configuration Hook
 * Extended search mode hook that provides AI configuration
 */

import { useMemo } from 'react';
import { useSearchMode } from '@/hooks/useSearchMode';
import { createSearchAgentConfig, type SearchAgentConfig } from '@/ai/agents/searchAgentConfig';
import type { SearchDepth } from '@/search/types';

export interface UseSearchModeWithAIResult {
    /** Whether search mode is enabled */
    isSearchMode: boolean;
    /** Toggle search mode on/off */
    toggleSearchMode: () => void;
    /** Set search mode directly */
    setSearchMode: (enabled: boolean) => void;
    /** Current search depth */
    searchDepth: SearchDepth;
    /** Set search depth */
    setSearchDepth: (depth: SearchDepth) => void;
    /** Whether a valid API key is configured */
    hasApiKey: boolean;
    /** Whether the hook is still loading initial state */
    isLoading: boolean;
    /** AI configuration based on current search state */
    aiConfig: SearchAgentConfig;
    /** Whether search is effectively active (enabled + has API key) */
    isSearchActive: boolean;
}

/**
 * Extended search mode hook that provides AI configuration.
 * Use this in components that need both search UI state and AI config.
 * 
 * @param registeredToolNames - Array of all registered tool names
 * @returns Search mode state with AI configuration
 */
export function useSearchModeWithAI(registeredToolNames: string[]): UseSearchModeWithAIResult {
    const searchMode = useSearchMode();
    
    // Determine if search is effectively active
    const isSearchActive = searchMode.isSearchMode && searchMode.hasApiKey;
    
    // Memoize AI config to avoid recreating on every render
    const aiConfig = useMemo(() => {
        return createSearchAgentConfig(
            registeredToolNames,
            isSearchActive,
            searchMode.searchDepth
        );
    }, [
        registeredToolNames,
        isSearchActive,
        searchMode.searchDepth,
    ]);

    return {
        ...searchMode,
        aiConfig,
        isSearchActive,
    };
}

export default useSearchModeWithAI;
