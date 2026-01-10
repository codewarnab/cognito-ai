import React, { useState, useEffect } from 'react';
import { Clock, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { BaseErrorCardProps } from './types';

/**
 * Rate Limit Error Card
 * Displayed for rate limit and quota exceeded errors
 * Uses blue/purple theme with countdown timer
 */
export const RateLimitErrorCard: React.FC<BaseErrorCardProps> = ({ data, onRetry, isLoading }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);

    const title = data.title || 'Rate Limit Reached';
    const message = data.userMessage || data.message || 'Too many requests. Please wait before trying again.';

    const hasDetails = Boolean(
        (data.technicalDetails && data.technicalDetails.trim().length > 0) ||
        data.errorCode ||
        data.statusCode ||
        data.context
    );

    // Countdown timer effect
    useEffect(() => {
        if (data.retryAfter && data.retryAfter > 0) {
            const initialSeconds = Math.ceil(data.retryAfter / 1000);
            setCountdown(initialSeconds);

            const interval = setInterval(() => {
                setCountdown(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        }
        return undefined;
    }, [data.retryAfter]);

    const isQuotaError = data.errorCode?.includes('QUOTA');

    return (
        <div className="w-full max-w-[560px] rounded-xl border border-blue-500/20 bg-gradient-to-b from-blue-500/10 to-purple-500/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-200">
                    <Clock size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-[13px] font-semibold text-white/95">{title}</div>
                        {data.statusCode && (
                            <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-200">
                                {data.statusCode === 429 ? 'Too Many Requests' : data.statusCode}
                            </div>
                        )}
                    </div>

                    <div className="mt-1 text-[12px] leading-relaxed text-white/80">
                        {message}
                    </div>

                    {/* Countdown timer */}
                    {countdown !== null && countdown > 0 && (
                        <div className="mt-3 flex items-center gap-3">
                            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2">
                                <div className="relative">
                                    <svg className="h-8 w-8 -rotate-90 transform" viewBox="0 0 36 36">
                                        <circle
                                            cx="18"
                                            cy="18"
                                            r="15"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            className="text-white/10"
                                        />
                                        <circle
                                            cx="18"
                                            cy="18"
                                            r="15"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeDasharray={`${(countdown / Math.ceil((data.retryAfter || 1000) / 1000)) * 94.2} 94.2`}
                                            className="text-blue-400 transition-all duration-1000"
                                        />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-blue-200">
                                        {countdown}s
                                    </span>
                                </div>
                                <span className="text-[12px] text-white/70">until retry</span>
                            </div>
                        </div>
                    )}

                    {/* Quota-specific message */}
                    {isQuotaError && (
                        <div className="mt-2 rounded-lg bg-purple-500/5 p-2 text-[11px] text-purple-200/80">
                            <div className="font-medium mb-1">Quota exceeded</div>
                            <p className="text-purple-200/70">
                                Your API quota has been exhausted. Consider upgrading your plan or wait for your quota to reset.
                            </p>
                        </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {onRetry && (
                            <button
                                type="button"
                                disabled={isLoading || (countdown !== null && countdown > 0)}
                                onClick={onRetry}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-2 text-[12px] font-medium text-blue-100 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                                {countdown !== null && countdown > 0 ? `Wait ${countdown}s` : 'Retry Now'}
                            </button>
                        )}

                        {hasDetails && (
                            <button
                                type="button"
                                onClick={() => setShowDetails(v => !v)}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-[12px] font-medium text-white/65 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-white/85"
                            >
                                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                Details
                            </button>
                        )}
                    </div>

                    {showDetails && hasDetails && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-white/65">
                            {data.context && (
                                <div className="mb-2">
                                    <span className="text-white/55">Context:</span> {data.context}
                                </div>
                            )}
                            {data.errorCode && (
                                <div className="mb-2">
                                    <span className="text-white/55">Error Code:</span> {data.errorCode}
                                </div>
                            )}
                            {typeof data.statusCode === 'number' && (
                                <div className="mb-2">
                                    <span className="text-white/55">Status:</span> {data.statusCode}
                                </div>
                            )}
                            {data.technicalDetails && (
                                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-white/65">
                                    {data.technicalDetails}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
