'use client';

import { useState, useEffect, useCallback } from 'react';
import { extensionAPI } from '@/lib/extension-api';

interface UseExtensionReturn {
    isInstalled: boolean | null;
    isLoading: boolean;
    error: Error | null;
    sendMessage: typeof extensionAPI.sendMessage;
    refresh: () => void;
}

export function useExtension(): UseExtensionReturn {
    const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const checkInstalled = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Timeout the check after 1s to avoid hanging if extension is present but unresponsive (should involve callback)
            // But chrome.runtime.sendMessage usually fails fast if ID not found.
            const installed = await extensionAPI.isInstalled();
            setIsInstalled(installed);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
            setIsInstalled(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkInstalled();
    }, [checkInstalled]);

    return {
        isInstalled,
        isLoading,
        error,
        sendMessage: extensionAPI.sendMessage.bind(extensionAPI),
        refresh: checkInstalled,
    };
}
