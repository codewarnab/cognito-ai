/**
 * Suggestions Hook
 * React hook managing suggestion state, page tracking, and debounced updates
 * Supports both local (Gemini Nano) and remote (Gemini API) modes
 */

import { useState, useEffect, useRef } from 'react';
import { createLogger } from '../logger';
import { extractPageContext } from '../utils/pageContextExtractor';
import { suggestionCache } from '../utils/suggestionCache';
import { generateContextualSuggestions, type Suggestion } from '../ai/suggestions';
import { getGeminiApiKey } from '../utils/geminiApiKey';
import type { ModelState } from '../components/chat/types';

const log = createLogger('UseSuggestions');

// Debounce delay: 1 seconds after page change
const DEBOUNCE_DELAY_MS = 1000;

interface UseSuggestionsResult {
    suggestions: Suggestion[] | null;
    isGenerating: boolean;
    error: Error | null;
}

/**
 * Hook for managing AI-generated contextual suggestions
 * Active in both local and remote modes when no messages exist
 * Uses local AI (Gemini Nano) in local mode, Gemini API in remote mode
 */
export function useSuggestions(
    modelState: ModelState,
    messagesLength: number
): UseSuggestionsResult {
    const [currentUrl, setCurrentUrl] = useState<string>('');
    const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Refs for debouncing and preventing duplicate calls
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isGeneratingRef = useRef(false);
    const lastGeneratedUrlRef = useRef<string>('');
    const previousModeRef = useRef<string>(modelState.mode);
    const previousMessagesLengthRef = useRef<number>(messagesLength);
    const shouldGenerateRef = useRef<boolean>(false);

    // Generate suggestions in both local and remote modes when no messages
    const shouldGenerate = messagesLength === 0;

    // Update refs for next render
    shouldGenerateRef.current = shouldGenerate;

    /**
     * Generate suggestions for a URL
     */
    const generateSuggestions = async (url: string) => {
        // Prevent duplicate generation
        if (isGeneratingRef.current) {
            log.debug('Generation already in progress, skipping');
            return;
        }

        // Skip if same URL as last generation
        if (lastGeneratedUrlRef.current === url) {
            log.debug('Same URL as last generation, skipping');
            return;
        }

        try {
            isGeneratingRef.current = true;
            setIsGenerating(true);
            setError(null);

            log.info('Generating suggestions for:', url, 'mode:', modelState.mode);

            // Check cache first
            const cached = suggestionCache.getSuggestions(url);
            if (cached) {
                log.info('Using cached suggestions for:', url);
                setSuggestions(cached);
                lastGeneratedUrlRef.current = url;
                return;
            }

            // Get API key (optional - if not available, will use local AI)
            const apiKey = await getGeminiApiKey();

            if (modelState.mode === 'remote' && !apiKey) {
                log.warn('Remote mode but no API key available');
                // Don't set error, just skip (or could fallback to local)
                return;
            }

            // Extract page context
            const pageContext = await extractPageContext();

            // Generate suggestions (will use local AI if no apiKey)
            const newSuggestions = await generateContextualSuggestions(
                pageContext,
                modelState.mode === 'remote' ? apiKey : undefined
            );

            if (newSuggestions) {
                // Update cache
                suggestionCache.setSuggestions(url, newSuggestions);

                // Update state
                setSuggestions(newSuggestions);
                lastGeneratedUrlRef.current = url;
                log.info('Successfully generated and cached suggestions');
            } else {
                log.warn('Failed to generate suggestions');
                setError(new Error('Generation failed'));
            }

        } catch (err) {
            log.error('Error generating suggestions:', err);
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            isGeneratingRef.current = false;
            setIsGenerating(false);
        }
    };

    /**
     * Handle page URL change with debouncing
     */
    const handleUrlChange = (newUrl: string) => {
        // Skip if same URL
        if (newUrl === currentUrl) {
            return;
        }

        log.debug('URL changed:', newUrl);
        setCurrentUrl(newUrl);

        // Clear previous debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce: wait before generating
        debounceTimerRef.current = setTimeout(() => {
            // Check current shouldGenerate state via ref
            if (shouldGenerateRef.current) {
                generateSuggestions(newUrl);
            }
        }, DEBOUNCE_DELAY_MS);
    };

    /**
     * Get current active tab URL
     */
    const getCurrentTabUrl = async (): Promise<string> => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab.url || '';
        } catch (error) {
            log.error('Failed to get current tab URL:', error);
            return '';
        }
    };

    /**
     * Handle mode switches and message count changes
     */
    useEffect(() => {
        const previousMode = previousModeRef.current;
        const previousMessagesLength = previousMessagesLengthRef.current;
        const currentMode = modelState.mode;
        const currentMessagesLength = messagesLength;

        // Update refs for next comparison
        previousModeRef.current = currentMode;
        previousMessagesLengthRef.current = currentMessagesLength;

        // Handle mode switch to either local or remote with no messages
        const modeSwitched = previousMode !== currentMode && currentMessagesLength === 0;

        // Handle messages being cleared (going back to 0)
        const messagesCleared = previousMessagesLength > 0 && currentMessagesLength === 0;

        // Clear suggestions when messages exist
        if (!shouldGenerate) {
            setSuggestions(null);
            setError(null);
            lastGeneratedUrlRef.current = '';
            return;
        }

        // If mode just switched or messages were cleared, generate immediately
        if (modeSwitched || messagesCleared) {
            log.info('Detected trigger for immediate suggestion generation', {
                modeSwitched,
                messagesCleared,
                mode: currentMode
            });

            getCurrentTabUrl().then(url => {
                if (url) {
                    setCurrentUrl(url);
                    generateSuggestions(url);
                }
            });
        }
    }, [shouldGenerate, modelState.mode, messagesLength]);

    /**
     * Initialize current URL on mount
     */
    useEffect(() => {
        if (!currentUrl && shouldGenerate) {
            getCurrentTabUrl().then(url => {
                if (url && shouldGenerateRef.current) {
                    handleUrlChange(url);
                }
            });
        }
    }, [currentUrl, shouldGenerate]);

    /**
     * Listen to tab changes - only created once on mount
     * Uses refs to access latest state without recreating listeners
     */
    useEffect(() => {
        // Listen to tab updates
        const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            // Check latest shouldGenerate state via ref
            if (!shouldGenerateRef.current) return;

            if (changeInfo.url && tab.active) {
                handleUrlChange(changeInfo.url);
            }
        };

        // Listen to tab activation
        const handleTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
            // Check latest shouldGenerate state via ref
            if (!shouldGenerateRef.current) return;

            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                if (tab.url) {
                    handleUrlChange(tab.url);
                }
            } catch (error) {
                log.error('Failed to get activated tab:', error);
            }
        };

        // Add listeners once
        chrome.tabs.onUpdated.addListener(handleTabUpdate);
        chrome.tabs.onActivated.addListener(handleTabActivated);

        // Cleanup only on unmount
        return () => {
            chrome.tabs.onUpdated.removeListener(handleTabUpdate);
            chrome.tabs.onActivated.removeListener(handleTabActivated);

            // Clear debounce timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []); // Empty deps - listeners created once, use refs for latest state

    return {
        suggestions,
        isGenerating,
        error,
    };
}
