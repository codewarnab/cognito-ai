import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

export interface ChatErrorCardData {
    title?: string;
    message?: string;
    userMessage?: string;
    technicalDetails?: string;
    errorCode?: string;
    statusCode?: number;
    retryable?: boolean;
    retryAfter?: number; // ms
    timestamp?: number;
    context?: string;
}

interface ErrorCardProps {
    data: ChatErrorCardData;
    onRetry?: () => void;
    isLoading?: boolean;
}

function formatRetryAfter(ms?: number): string | null {
    if (!ms || ms <= 0) return null;
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ data, onRetry, isLoading }) => {
    const [showDetails, setShowDetails] = useState(false);

    const title = data.title || 'Request failed';
    const message = data.userMessage || data.message || 'Something went wrong while generating a response.';
    const retryAfterLabel = useMemo(() => formatRetryAfter(data.retryAfter), [data.retryAfter]);

    const hasDetails = Boolean(
        (data.technicalDetails && data.technicalDetails.trim().length > 0) ||
        data.errorCode ||
        data.statusCode ||
        data.context
    );

    return (
        <div className="w-full max-w-[560px] rounded-xl border border-red-500/20 bg-gradient-to-b from-red-500/10 to-red-500/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-200">
                    <AlertTriangle size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-[13px] font-semibold text-white/95">{title}</div>
                        {data.errorCode && (
                            <div className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/60">
                                {data.errorCode}
                            </div>
                        )}
                    </div>

                    <div className="mt-1 text-[12px] leading-relaxed text-white/80">
                        {message}
                        {retryAfterLabel && (
                            <span className="ml-2 text-white/55">
                                (Retry after {retryAfterLabel})
                            </span>
                        )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {onRetry && (
                            <button
                                type="button"
                                disabled={isLoading}
                                onClick={onRetry}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[12px] font-medium text-white/90 ring-1 ring-inset ring-white/10 transition hover:bg-white/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RotateCcw size={14} />
                                Retry
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

