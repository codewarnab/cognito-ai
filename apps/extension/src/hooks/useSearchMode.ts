/**
 * Search Mode Hook
 * Manages search mode state with persistence to Chrome storage
 * 
 * IMPORTANT: This hook syncs with searchSettings.enabled which is read by aiLogic.ts
 * to determine whether to use search mode (web search prompt + limited tools) or agent mode.
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '~logger';
import {
    getSearchSettings,
    saveSearchSettings,
    hasApiKeyForProvider,
} from '@/utils/settings/searchSettings';
import type { SearchDepth } from '@/search/types';

const log = createLogger('useSearchMode', 'SETTINGS');

export interface UseSearchModeResult {
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
}

/**
 * Hook to manage search mode state.
 * Persists state to Chrome storage and provides toggle functionality.
 * Listens to storage changes to sync state across all hook instances.
 */
export function useSearchMode(): UseSearchModeResult {
    const [isSearchMode, setIsSearchModeState] = useState(false);
    const [searchDepth, setSearchDepthState] = useState<SearchDepth>('basic');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial state from storage - read from searchSettings for consistency with aiLogic.ts
    useEffect(() => {
        const loadState = async () => {
            try {
                const settings = await getSearchSettings();
                log.info('🔍 Loading search settings from storage', { settings });

                // Check if API key is configured
                const keyConfigured = await hasApiKeyForProvider(settings.defaultProvider);
                setHasApiKey(keyConfigured);

                // Read search mode from searchSettings.enabled (same source as aiLogic.ts)
                // Only enable if API key is also configured
                const effectiveMode = settings.enabled && keyConfigured;
                setIsSearchModeState(effectiveMode);
                setSearchDepthState(settings.defaultSearchDepth);
                
                log.info('🔍 Search mode loaded from searchSettings', {
                    settingsEnabled: settings.enabled,
                    hasApiKey: keyConfigured,
                    effectiveMode,
                    searchDepth: settings.defaultSearchDepth
                });
            } catch (error) {
                log.error('Failed to load search mode state', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                setIsLoading(false);
            }
        };
        loadState();
    }, []);

    // Listen for storage changes to sync state across all hook instances
    useEffect(() => {
        const handleStorageChange = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName !== 'local') return;
            
            // Check if searchSettings changed
            if (changes.searchSettings) {
                const newSettings = changes.searchSettings.newValue;
                const oldSettings = changes.searchSettings.oldValue;
                
                log.info('🔄 Storage change detected for searchSettings', {
                    oldEnabled: oldSettings?.enabled,
                    newEnabled: newSettings?.enabled,
                    oldDepth: oldSettings?.defaultSearchDepth,
                    newDepth: newSettings?.defaultSearchDepth
                });

                if (newSettings) {
                    // Update local state to match storage
                    // Note: hasApiKey check happens async, so we trust the stored enabled state
                    setIsSearchModeState(newSettings.enabled && hasApiKey);
                    setSearchDepthState(newSettings.defaultSearchDepth || 'basic');
                    
                    log.info('🔄 Updated local state from storage change', {
                        isSearchMode: newSettings.enabled && hasApiKey,
                        searchDepth: newSettings.defaultSearchDepth
                    });
                }
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, [hasApiKey]);

    // Persist search mode to storage - MUST update searchSettings.enabled for aiLogic.ts
    const setSearchMode = useCallback(async (enabled: boolean) => {
        log.info('🔧 setSearchMode called', { enabled, currentState: isSearchMode });
        
        // Update local state immediately for responsive UI
        setIsSearchModeState(enabled);
        
        try {
            // Update searchSettings.enabled - this is what aiLogic.ts reads
            const currentSettings = await getSearchSettings();
            log.info('🔧 Current settings before save', { currentSettings });
            
            const newSettings = {
                ...currentSettings,
                enabled,
            };
            await saveSearchSettings(newSettings);
            
            log.info('✅ Search mode saved to searchSettings', { 
                enabled, 
                savedSettings: newSettings 
            });
        } catch (error) {
            log.error('❌ Failed to save search mode', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Revert local state on error
            setIsSearchModeState(!enabled);
        }
    }, [isSearchMode]);

    // Toggle search mode
    const toggleSearchMode = useCallback(() => {
        const newValue = !isSearchMode;
        log.info('🔄 toggleSearchMode called', { 
            currentState: isSearchMode, 
            newState: newValue,
            hasApiKey 
        });
        setSearchMode(newValue);
    }, [isSearchMode, setSearchMode, hasApiKey]);

    // Persist search depth to storage - update searchSettings for consistency
    const setSearchDepth = useCallback(async (depth: SearchDepth) => {
        log.info('🔧 setSearchDepth called', { depth, currentDepth: searchDepth });
        setSearchDepthState(depth);
        try {
            const currentSettings = await getSearchSettings();
            log.info('🔧 Current settings before depth save', { 
                currentDefaultSearchDepth: currentSettings.defaultSearchDepth,
                newDepth: depth 
            });
            const newSettings = {
                ...currentSettings,
                defaultSearchDepth: depth,
            };
            await saveSearchSettings(newSettings);
            log.info('✅ Search depth saved to searchSettings', { 
                depth, 
                savedSettings: newSettings 
            });
            
            // Verify the save worked
            const verifySettings = await getSearchSettings();
            log.info('🔍 Verified settings after save', { 
                verifiedDepth: verifySettings.defaultSearchDepth 
            });
        } catch (error) {
            log.error('❌ Failed to save search depth', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }, [searchDepth]);

    return {
        isSearchMode,
        toggleSearchMode,
        setSearchMode,
        searchDepth,
        setSearchDepth,
        hasApiKey,
        isLoading,
    };
}

export default useSearchMode;
