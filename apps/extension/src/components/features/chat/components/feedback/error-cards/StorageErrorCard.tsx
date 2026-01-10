import React, { useState } from 'react';
import { HardDrive, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { BaseErrorCardProps } from './types';

/**
 * Storage Error Card
 * Displayed for storage quota exceeded and AI model storage errors
 * Uses emerald/green theme with storage info
 */
export const StorageErrorCard: React.FC<BaseErrorCardProps> = ({ data }) => {
    const [showDetails, setShowDetails] = useState(false);

    const title = data.title || 'Storage Error';
    const message = data.userMessage || data.message || 'Not enough storage space available.';

    const hasDetails = Boolean(
        (data.technicalDetails && data.technicalDetails.trim().length > 0) ||
        data.errorCode ||
        data.statusCode ||
        data.context
    );

    const isModelStorageError = data.errorCode === 'BROWSER_AI_MODEL_STORAGE_ERROR';
    const modelName = data.metadata?.modelName || 'AI Model';

    return (
        <div className="w-full max-w-[560px] rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-green-500/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
                    <HardDrive size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-[13px] font-semibold text-white/95">{title}</div>
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300">
                            Storage Full
                        </div>
                    </div>

                    <div className="mt-1 text-[12px] leading-relaxed text-white/80">
                        {message}
                    </div>

                    {/* Storage-specific suggestions */}
                    <div className="mt-2 rounded-lg bg-emerald-500/5 p-2 text-[11px] text-emerald-200/80">
                        <div className="font-medium mb-1">
                            {isModelStorageError ? 'AI Model Storage' : 'Free up space'}
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-emerald-200/70">
                            {isModelStorageError ? (
                                <>
                                    <li>Free up at least 20GB of disk space</li>
                                    <li>Switch to Remote Mode (no download required)</li>
                                    <li>Close other applications using storage</li>
                                </>
                            ) : (
                                <>
                                    <li>Clear old chat history</li>
                                    <li>Delete cached data in browser settings</li>
                                    <li>Remove unused saved items</li>
                                </>
                            )}
                        </ul>
                    </div>

                    {/* Storage bar visual (placeholder - could show actual usage if available) */}
                    <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-white/50 mb-1">
                            <span>Storage Usage</span>
                            <span>Full</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500" />
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {isModelStorageError && (
                            <button
                                type="button"
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-[12px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/30"
                            >
                                Switch to Remote Mode
                            </button>
                        )}

                        <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[12px] font-medium text-white/90 ring-1 ring-inset ring-white/10 transition hover:bg-white/15"
                        >
                            <Trash2 size={14} />
                            Clear Cache
                        </button>

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
                            {isModelStorageError && (
                                <div className="mb-2">
                                    <span className="text-white/55">Model:</span> {modelName}
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
