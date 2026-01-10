import React, { useState } from 'react';
import { Key, ChevronDown, ChevronUp, RotateCcw, ExternalLink } from 'lucide-react';
import type { BaseErrorCardProps } from './types';

/**
 * Auth Error Card
 * Displayed for authentication failures (invalid API key, permission denied, etc.)
 * Uses amber/yellow theme to indicate configuration issue
 */
export const AuthErrorCard: React.FC<BaseErrorCardProps> = ({ data, onRetry, isLoading }) => {
    const [showDetails, setShowDetails] = useState(false);

    const title = data.title || 'Authentication Failed';
    const message = data.userMessage || data.message || 'Please check your API key or credentials.';

    const hasDetails = Boolean(
        (data.technicalDetails && data.technicalDetails.trim().length > 0) ||
        data.errorCode ||
        data.statusCode ||
        data.context
    );

    // Determine settings link based on error type
    const getSettingsAction = () => {
        if (data.errorCode?.includes('MCP')) {
            return { label: 'Configure MCP', path: '#mcp-settings' };
        }
        return { label: 'Check API Key', path: '#api-settings' };
    };

    const settingsAction = getSettingsAction();

    return (
        <div className="w-full max-w-[560px] rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-200">
                    <Key size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-[13px] font-semibold text-white/95">{title}</div>
                        {data.statusCode && (
                            <div className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/60">
                                {data.statusCode}
                            </div>
                        )}
                    </div>

                    <div className="mt-1 text-[12px] leading-relaxed text-white/80">
                        {message}
                    </div>

                    {/* Suggestions for auth errors */}
                    <div className="mt-2 rounded-lg bg-amber-500/5 p-2 text-[11px] text-amber-200/80">
                        <div className="font-medium mb-1">Quick fixes:</div>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-200/70">
                            <li>Verify your API key in Settings</li>
                            <li>Check if your key has expired</li>
                            <li>Ensure the key has required permissions</li>
                        </ul>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                            href={settingsAction.path}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-[12px] font-medium text-amber-100 ring-1 ring-inset ring-amber-500/30 transition hover:bg-amber-500/30"
                        >
                            <ExternalLink size={14} />
                            {settingsAction.label}
                        </a>

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
