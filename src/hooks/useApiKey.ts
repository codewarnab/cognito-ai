import { useState, useEffect } from 'react';
import { createLogger } from '../logger';

const log = createLogger('useApiKey');

/**
 * Hook to manage Gemini API key from Chrome storage
 */
export function useApiKey() {
    const [apiKey, setApiKey] = useState<string>('');

    // Load API key from storage on mount
    useEffect(() => {
        const loadApiKey = async () => {
            try {
                const result = await chrome.storage.local.get(['gemini_api_key']);
                if (result.gemini_api_key) {
                    setApiKey(result.gemini_api_key);
                    log.debug('API key loaded from storage');
                } else {
                    log.debug('No API key found in storage');
                }
            } catch (error) {
                log.error('Failed to load API key', error);
            }
        };
        loadApiKey();
    }, []);

    // Listen for API key changes in storage
    useEffect(() => {
        const handleStorageChange = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && changes.gemini_api_key) {
                const newApiKey = changes.gemini_api_key.newValue || '';
                setApiKey(newApiKey);
                log.debug('API key updated from storage change:', newApiKey ? 'set' : 'removed');
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    return apiKey;
}
