import { useState, useEffect } from 'react';
import { createLogger } from '~logger';
import { getGoogleApiKey } from '../utils/providerCredentials';

const log = createLogger('useApiKey');

/**
 * Hook to manage Gemini API key from Chrome storage
 * Uses new provider credentials system
 */
export function useApiKey() {
    const [apiKey, setApiKey] = useState<string>('');

    // Load API key from storage on mount
    useEffect(() => {
        const loadApiKey = async () => {
            try {
                const key = await getGoogleApiKey();
                if (key) {
                    setApiKey(key);
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
            // Listen for changes to ai_provider_config (new storage location)
            if (areaName === 'local' && (changes.ai_provider_config || changes.gemini_api_key)) {
                // Reload the API key using the new function
                getGoogleApiKey().then(key => {
                    const newApiKey = key || '';
                    setApiKey(newApiKey);
                    log.debug('API key updated from storage change:', newApiKey ? 'set' : 'removed');
                }).catch(error => {
                    log.error('Failed to reload API key after storage change', error);
                });
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    return apiKey;
}

