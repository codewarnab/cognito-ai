/**
 * useSettings Hook
 * Manages history page settings state and actions
 */

import { useState, useEffect, useCallback } from 'react';
import type { HistorySettings, HistoryMessage, HistoryResponse } from './types';

interface UseSettingsReturn extends HistorySettings {
    loading: boolean;
    error: string | null;
    setPaused: (paused: boolean) => Promise<void>;
    clearIndex: () => Promise<void>;
    updateFilters: (allowlist?: string[], denylist?: string[]) => Promise<void>;
    refresh: () => Promise<void>;
}

const DEFAULT_SETTINGS: HistorySettings = {
    modelReady: false,
    paused: false,
    domainAllowlist: [],
    domainDenylist: [],
};

export function useSettings(): UseSettingsReturn {
    const [settings, setSettings] = useState<HistorySettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const message: HistoryMessage = { type: 'GET_SETTINGS' };
            const response = await chrome.runtime.sendMessage(message) as HistoryResponse;

            if (response.type === 'SETTINGS') {
                setSettings(response.data);
            } else if (response.type === 'ERROR') {
                setError(response.message);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load settings');
            console.error('useSettings: Failed to load settings', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const setPaused = useCallback(async (paused: boolean) => {
        try {
            setError(null);
            const message: HistoryMessage = { type: 'SET_PAUSED', paused };
            const response = await chrome.runtime.sendMessage(message) as HistoryResponse;

            if (response.type === 'ERROR') {
                setError(response.message);
                throw new Error(response.message);
            }

            // Update local state
            setSettings(prev => ({ ...prev, paused }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update pause state');
            throw err;
        }
    }, []);

    const clearIndex = useCallback(async () => {
        try {
            setError(null);
            const message: HistoryMessage = { type: 'CLEAR_INDEX' };
            const response = await chrome.runtime.sendMessage(message) as HistoryResponse;

            if (response.type === 'ERROR') {
                setError(response.message);
                throw new Error(response.message);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clear index');
            throw err;
        }
    }, []);

    const updateFilters = useCallback(async (allowlist?: string[], denylist?: string[]) => {
        try {
            setError(null);
            const message: HistoryMessage = {
                type: 'UPDATE_FILTERS',
                allowlist,
                denylist,
            };
            const response = await chrome.runtime.sendMessage(message) as HistoryResponse;

            if (response.type === 'ERROR') {
                setError(response.message);
                throw new Error(response.message);
            }

            // Update local state
            setSettings(prev => ({
                ...prev,
                ...(allowlist !== undefined && { domainAllowlist: allowlist }),
                ...(denylist !== undefined && { domainDenylist: denylist }),
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update filters');
            throw err;
        }
    }, []);

    return {
        ...settings,
        loading,
        error,
        setPaused,
        clearIndex,
        updateFilters,
        refresh: loadSettings,
    };
}
