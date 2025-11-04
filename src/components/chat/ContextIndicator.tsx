import { useState, useMemo, useEffect, useRef } from "react";
import { AnimatedCircularProgressBar } from "./AnimatedCircularProgressBar";
import type { AppUsage } from "../../ai/types/usage";
import { cn } from "../../utils/cn";

interface ContextIndicatorProps {
    usage: AppUsage | null;
    className?: string;
    onWarning?: (percent: number) => void; // Callback when context limit warning is triggered
}

export function ContextIndicator({ usage, className, onWarning }: ContextIndicatorProps) {
    const [showDetails, setShowDetails] = useState(false);
    const lastWarningPercent = useRef<number | null>(null);

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
        <div className={cn("context-indicator", className)}>
            {/* Circular Progress - Always Visible */}
            <button
                className="context-button"
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
                    className="context-progress-compact"
                    showPercentage={false}
                />
            </button>

            {/* Details Dropdown - Show on hover/click */}
            {showDetails && (
                <div
                    className="context-details"
                    onMouseEnter={() => setShowDetails(true)}
                    onMouseLeave={() => setShowDetails(false)}
                >
                    <div className="context-header">
                        <span className="context-percent">{percent}%</span>
                        <span className="token-count">
                            {usage.totalTokens?.toLocaleString()} / {usage.context?.totalMax?.toLocaleString()} tokens
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{
                                width: `${percent}%`,
                                backgroundColor: colors.primary
                            }}
                        />
                    </div>

                    {/* Token Breakdown */}
                    <div className="token-breakdown">
                        {usage.cachedInputTokens && usage.cachedInputTokens > 0 && (
                            <div className="token-row">
                                <span className="token-label">Cache Hits</span>
                                <span className="token-value">{usage.cachedInputTokens.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="token-row">
                            <span className="token-label">Input</span>
                            <span className="token-value">{usage.inputTokens?.toLocaleString() || 0}</span>
                        </div>
                        <div className="token-row">
                            <span className="token-label">Output</span>
                            <span className="token-value">{usage.outputTokens?.toLocaleString() || 0}</span>
                        </div>
                        {usage.reasoningTokens && usage.reasoningTokens > 0 && (
                            <div className="token-row">
                                <span className="token-label">Reasoning</span>
                                <span className="token-value">{usage.reasoningTokens.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    {/* Model Info (if available) */}
                    {usage.modelId && (
                        <div className="model-info">
                            <span className="model-label">Model:</span>
                            <span className="model-name">{usage.modelId}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
