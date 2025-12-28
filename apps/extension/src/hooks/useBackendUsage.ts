/**
 * Hook for fetching backend usage statistics
 *
 * Provides rate limit and quota visibility for backend mode users.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/stores/settings/settingsStore';
import { createLogger } from '~logger';
import { ENV } from '@/utils/env';
import { getErrorMessage } from '@/utils/errors';

const log = createLogger('BackendUsage', 'AI_CHAT');

// Backend API URL from centralized ENV
const BACKEND_URL = ENV.BACKEND_API_URL;

export interface UsageInfo {
    requests: {
        used: number;
        limit: number;
        resetIn: number;
    };
    quota: {
        daily: { used: number; limit: number };
        monthly: { used: number; limit: number };
    };
    timestamp: string;
}

export interface UseBackendUsageResult {
    usage: UsageInfo | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    isRateLimited: boolean;
    isDailyLimitReached: boolean;
    isMonthlyLimitReached: boolean;
}

/**
 * Hook to fetch and track backend usage statistics
 */
export function useBackendUsage(): UseBackendUsageResult {
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const useBackendMode = useSettingsStore((s) => s.useBackendMode);

    const fetchUsage = useCallback(async () => {
        if (!useBackendMode) {
            setUsage(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/usage`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch usage: ${response.status}`);
            }

            const data: UsageInfo = await response.json();
            setUsage(data);
            log.debug('Usage fetched:', data);
        } catch (err) {
            const message = getErrorMessage(err);
            log.warn('Failed to fetch usage:', message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [useBackendMode]);

    // Fetch on mount and when backend mode changes
    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    // Auto-refresh every 30 seconds when in backend mode
    useEffect(() => {
        if (!useBackendMode) return;

        const interval = setInterval(fetchUsage, 30000);
        return () => clearInterval(interval);
    }, [useBackendMode, fetchUsage]);

    // Computed values
    const isRateLimited = usage ? usage.requests.used >= usage.requests.limit : false;
    const isDailyLimitReached = usage ? usage.quota.daily.used >= usage.quota.daily.limit : false;
    const isMonthlyLimitReached = usage ? usage.quota.monthly.used >= usage.quota.monthly.limit : false;

    return {
        usage,
        isLoading,
        error,
        refresh: fetchUsage,
        isRateLimited,
        isDailyLimitReached,
        isMonthlyLimitReached,
    };
}
