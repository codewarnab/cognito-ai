import { useState, useMemo, useEffect, useRef } from "react";
import { AnimatedCircularProgressBar } from "@/components/features/chat/components/feedback";
import type { AppUsage } from "@/ai/types/usage";
import { cn } from "@/utils/ui";
import { createLogger } from '~logger';
import { useUINavigationStore, type UINavigationState } from '@/stores';

const log = createLogger('ContextIndicator', 'UI_CHAT_COMPONENTS');

interface ContextIndicatorProps {
    usage: AppUsage | null;
    className?: string;
    onWarning?: (percent: number) => void; // Callback when context limit warning is triggered
}

export function ContextIndicator({ usage, className, onWarning }: ContextIndicatorProps) {
    const [showDetails, setShowDetails] = useState(false);
    const lastWarningPercent = useRef<number | null>(null);

    // Log usage prop changes
    useEffect(() => {
        log.info('📊 ContextIndicator received usage prop', {
            hasUsage: !!usage,
            totalTokens: usage?.totalTokens,
            hasContext: !!usage?.context,
            contextMax: usage?.context?.totalMax
        });
    }, [usage]);

    // Hide voice-mode-fab when showing details
    const setVoiceFabVisibility = useUINavigationStore((state: UINavigationState) => state.setVoiceFabVisibility);

    useEffect(() => {
        setVoiceFabVisibility(!showDetails);
    }, [showDetails, setVoiceFabVisibility]);

    // Calculate percentage
    const percent = useMemo(() => {
        if (!usage?.totalTokens || !usage?.context?.totalMax) return 0;
        return Math.min(100, Math.round((usage.totalTokens / usage.context.totalMax) * 100));
    }, [usage?.totalTokens, usage?.context?.totalMax]);

    // Color based on usage
    const colors = useMemo(() => {
        if (percent < 70) {
            return { primary: "#10b981", secondary: "#d1fae5" }; // green
        } else if (percent < 85) {
            return { primary: "#f59e0b", secondary: "#fef3c7" }; // yellow
        } else {
            return { primary: "#ef4444", secondary: "#fee2e2" }; // red
        }
    }, [percent]);

    // Warning effect - trigger callback when crossing threshold
    useEffect(() => {
        if (!usage?.totalTokens || !usage?.context?.totalMax) {
            lastWarningPercent.current = null;
            return;
        }

        // Trigger warning at 85% and 95%
        if (percent >= 95 && lastWarningPercent.current !== 95) {
            lastWarningPercent.current = 95;
            onWarning?.(percent);
        } else if (percent >= 85 && percent < 95 && lastWarningPercent.current !== 85) {
            lastWarningPercent.current = 85;
            onWarning?.(percent);
        } else if (percent < 85) {
            lastWarningPercent.current = null;
        }
    }, [percent, usage?.totalTokens, usage?.context?.totalMax, onWarning]);

    if (!usage?.totalTokens) return null;

    return (
        <div className={cn("relative flex items-center justify-center z-[100] shrink-0 w-7 h-7", className)}>
            {/* Circular Progress - Always Visible */}
            <button
                className="bg-transparent border-none cursor-pointer p-0 rounded-full transition-colors duration-200 flex items-center justify-center outline-none w-7 h-7 hover:bg-black/5 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={() => setShowDetails(!showDetails)}
                onMouseEnter={() => setShowDetails(true)}
                onMouseLeave={() => setShowDetails(false)}
                aria-label={`Context usage: ${percent}%`}
                type="button"
            >
                <AnimatedCircularProgressBar
                    value={percent}
                    gaugePrimaryColor={colors.primary}
                    gaugeSecondaryColor={colors.secondary}
                    className="w-6 h-6 text-[8px]"
                    showPercentage={false}
                />
            </button>

            {/* Details Dropdown - Show on hover/click */}
            {showDetails && (
                <div
                    className="absolute bottom-[calc(100%+8px)] right-0 min-w-[260px] bg-white dark:bg-gray-800 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)] p-3 z-[9999] animate-in slide-in-from-bottom-2 fade-in duration-200"
                    onMouseEnter={() => setShowDetails(true)}
                    onMouseLeave={() => setShowDetails(false)}
                >
                    <div className="flex justify-between items-center mb-2 text-sm gap-3">
                        <span className="font-semibold text-gray-900 dark:text-gray-50 text-base">{percent}%</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                            {usage.totalTokens?.toLocaleString()} / {usage.context?.totalMax?.toLocaleString()} tokens
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden mb-3 relative">
                        <div
                            className="h-full rounded transition-all duration-1000"
                            style={{
                                width: `${percent}%`,
                                backgroundColor: colors.primary
                            }}
                        />
                    </div>

                    {/* Token Breakdown */}
                    <div className="flex flex-col gap-1.5">
                        {usage.cachedInputTokens && usage.cachedInputTokens > 0 && (
                            <div className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300">
                                <span className="text-gray-500 dark:text-gray-400 font-normal">Cache Hits</span>
                                <span className="font-mono font-medium text-gray-900 dark:text-gray-50">{usage.cachedInputTokens.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300">
                            <span className="text-gray-500 dark:text-gray-400 font-normal">Input</span>
                            <span className="font-mono font-medium text-gray-900 dark:text-gray-50">{usage.inputTokens?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300">
                            <span className="text-gray-500 dark:text-gray-400 font-normal">Output</span>
                            <span className="font-mono font-medium text-gray-900 dark:text-gray-50">{usage.outputTokens?.toLocaleString() || 0}</span>
                        </div>
                        {usage.reasoningTokens && usage.reasoningTokens > 0 && (
                            <div className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300">
                                <span className="text-gray-500 dark:text-gray-400 font-normal">Reasoning</span>
                                <span className="font-mono font-medium text-gray-900 dark:text-gray-50">{usage.reasoningTokens.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    {/* Model Info (if available) */}
                    {usage.modelId && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-[11px]">
                            <span className="text-gray-500 dark:text-gray-400">Model:</span>
                            <span className="font-mono text-gray-700 dark:text-gray-300 font-medium">{usage.modelId}</span>
                        </div>
                    )}

                    {/* Arrow pointer */}
                    <div
                        className="absolute top-full right-3 w-0 h-0"
                        style={{
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: '8px solid white'
                        }}
                    />
                </div>
            )}
        </div>
    );
}
