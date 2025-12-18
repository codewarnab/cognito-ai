/**
 * Backend Usage Indicator
 *
 * Displays rate limit and quota information for backend mode users.
 */

import { useBackendUsage } from '@/hooks/useBackendUsage';
import { useSettingsStore } from '@/stores/settings/settingsStore';
import { cn } from '@/lib/utils';

interface BackendUsageIndicatorProps {
    className?: string;
    compact?: boolean;
}

export function BackendUsageIndicator({ className, compact = false }: BackendUsageIndicatorProps) {
    const useBackendMode = useSettingsStore((s) => s.useBackendMode);
    const hasApiKey = useSettingsStore((s) => s.hasGoogleApiKey());
    const setUseBackendMode = useSettingsStore((s) => s.setUseBackendMode);

    const {
        usage,
        isLoading,
        isRateLimited,
        isDailyLimitReached,
        isMonthlyLimitReached,
    } = useBackendUsage();

    // Don't show if not in backend mode
    if (!useBackendMode) return null;

    // Loading state
    if (isLoading && !usage) {
        return (
            <div className={cn('text-xs text-muted-foreground animate-pulse', className)}>
                Loading usage...
            </div>
        );
    }

    // No usage data
    if (!usage) return null;

    const isLimited = isRateLimited || isDailyLimitReached || isMonthlyLimitReached;

    // Compact view - just shows request count
    if (compact) {
        return (
            <div
                className={cn(
                    'text-xs',
                    isLimited ? 'text-destructive' : 'text-muted-foreground',
                    className
                )}
            >
                {usage.requests.used}/{usage.requests.limit}
                {isLimited && ' (limit)'}
            </div>
        );
    }

    // Full view
    return (
        <div className={cn('space-y-1', className)}>
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Requests/min:</span>
                <span className={isRateLimited ? 'text-destructive font-medium' : ''}>
                    {usage.requests.used}/{usage.requests.limit}
                </span>
            </div>

            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Daily:</span>
                <span className={isDailyLimitReached ? 'text-destructive font-medium' : ''}>
                    {usage.quota.daily.used}/{usage.quota.daily.limit}
                </span>
            </div>

            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Monthly:</span>
                <span className={isMonthlyLimitReached ? 'text-destructive font-medium' : ''}>
                    {usage.quota.monthly.used}/{usage.quota.monthly.limit}
                </span>
            </div>

            {isLimited && hasApiKey && (
                <button
                    onClick={() => setUseBackendMode(false)}
                    className="w-full mt-2 text-xs text-primary hover:underline"
                >
                    Switch to your API key
                </button>
            )}

            {isRateLimited && (
                <div className="text-xs text-muted-foreground">
                    Resets in {usage.requests.resetIn}s
                </div>
            )}
        </div>
    );
}
