/**
 * PatchProposalCard - Displays a patch proposal from the AI agent
 * Shows diff, file list, and Apply/Deny controls
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Check, X, Loader2, FileCode, RefreshCw, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { extractFilesFromUnifiedDiff } from './diffUtils';
import { useCodeModeStore } from '@/stores/codeMode/codeModeStore';
import type { PatchStatus } from '@/stores/codeMode/types';
import { createLogger } from '~logger';

const log = createLogger('PatchProposalCard', 'UI_CHAT');

interface PatchProposalCardProps {
    patchId: string;
    unifiedDiff: string;
    summary?: string;
}

const StatusBadge: React.FC<{ status: PatchStatus; error?: string }> = ({ status, error }) => {
    const badges: Record<PatchStatus, { icon: React.ReactNode; text: string; className: string }> = {
        pending: {
            icon: null,
            text: 'Pending',
            className: 'bg-yellow-500/20 text-yellow-400',
        },
        applying: {
            icon: <Loader2 size={12} className="animate-spin" />,
            text: 'Applying...',
            className: 'bg-blue-500/20 text-blue-400',
        },
        applied: {
            icon: <Check size={12} />,
            text: 'Applied',
            className: 'bg-green-500/20 text-green-400',
        },
        rejected: {
            icon: <X size={12} />,
            text: 'Rejected',
            className: 'bg-gray-500/20 text-gray-400',
        },
        error: {
            icon: <AlertCircle size={12} />,
            text: 'Error',
            className: 'bg-red-500/20 text-red-400',
        },
    };

    const badge = badges[status];

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${badge.className}`}>
            {badge.icon}
            <span>{badge.text}</span>
            {error && status === 'error' && (
                <span className="text-[10px] opacity-75 ml-1" title={error}>
                    ({error.slice(0, 30)}{error.length > 30 ? '...' : ''})
                </span>
            )}
        </div>
    );
};

export const PatchProposalCard: React.FC<PatchProposalCardProps> = ({
    patchId,
    unifiedDiff,
    summary,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showReloadHint, setShowReloadHint] = useState(false);

    // Get patch state from store
    const patches = useCodeModeStore((s) => s.patches);
    const addPatch = useCodeModeStore((s) => s.addPatch);
    const applyPatch = useCodeModeStore((s) => s.applyPatch);
    const rejectPatch = useCodeModeStore((s) => s.rejectPatch);
    const repoCwd = useCodeModeStore((s) => s.repoCwd);

    const patchState = patches[patchId];
    const status = patchState?.status || 'pending';
    const error = patchState?.error;
    const filesChanged = patchState?.filesChanged;

    // Register patch in store if not already there
    useEffect(() => {
        if (!patchState) {
            addPatch({ patchId, unifiedDiff, summary });
        }
    }, [patchId, unifiedDiff, summary, patchState, addPatch]);

    // Extract affected files
    const affectedFiles = React.useMemo(() => {
        return extractFilesFromUnifiedDiff(unifiedDiff);
    }, [unifiedDiff]);

    const handleApply = useCallback(async () => {
        log.info('Applying patch', { patchId });
        const success = await applyPatch(patchId);
        if (success) {
            setShowReloadHint(true);
        }
    }, [patchId, applyPatch]);

    const handleReject = useCallback(() => {
        log.info('Rejecting patch', { patchId });
        rejectPatch(patchId);
    }, [patchId, rejectPatch]);

    const handleReload = useCallback(() => {
        // Reload the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.reload(tabs[0].id);
                setShowReloadHint(false);
            }
        });
    }, []);

    // Open file in VSCode or Cursor
    const openInEditor = useCallback((editor: 'vscode' | 'cursor', relativePath: string) => {
        if (!repoCwd) {
            log.warn('Cannot open in editor: repoCwd not set');
            return;
        }

        // Normalize path separators and build absolute path
        const normalizedCwd = repoCwd.replace(/\\/g, '/');
        const normalizedPath = relativePath.replace(/\\/g, '/');
        const absolutePath = `${normalizedCwd}/${normalizedPath}`;

        // Generate editor deep link URL
        const editorUrl = `${editor}://file/${absolutePath}`;

        log.info('Opening file in editor', { editor, absolutePath });
        window.open(editorUrl, '_blank');
    }, [repoCwd]);

    const isPending = status === 'pending';
    const isApplying = status === 'applying';
    const isApplied = status === 'applied';
    const isRejected = status === 'rejected';
    const hasError = status === 'error';

    return (
        <div className="rounded-xl border border-[rgba(100,120,150,0.3)] bg-[rgba(15,20,35,0.9)] overflow-hidden shadow-lg">
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 bg-[rgba(30,40,60,0.6)] border-b border-[rgba(100,120,150,0.2)] cursor-pointer hover:bg-[rgba(40,50,70,0.6)] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <button className="flex-shrink-0 text-[#8b949e] hover:text-white transition-colors">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <FileCode size={16} className="text-blue-400 flex-shrink-0" />
                        <span className="text-[14px] font-medium text-white">
                            Code Changes
                        </span>
                        <StatusBadge status={status} error={error} />
                    </div>
                    {summary && (
                        <p className="text-[12px] text-[#8b949e] mt-1 line-clamp-2">
                            {summary}
                        </p>
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4">
                    {/* Affected files with editor buttons */}
                    <div className="mb-3">
                        <div className="text-[11px] text-[#8b949e] uppercase tracking-wide mb-2">
                            {affectedFiles.length} file{affectedFiles.length !== 1 ? 's' : ''} affected
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {affectedFiles.map((file) => (
                                <div
                                    key={file}
                                    className="flex items-center gap-2 group"
                                >
                                    <span
                                        className="text-[11px] px-2 py-1 rounded bg-[rgba(56,139,253,0.1)] text-blue-300 font-mono truncate flex-1 max-w-[200px]"
                                        title={file}
                                    >
                                        {file.split('/').pop()}
                                    </span>
                                    {/* VSCode button */}
                                    <button
                                        type="button"
                                        onClick={() => openInEditor('vscode', file)}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[rgba(255,255,255,0.1)] transition-all cursor-pointer"
                                        title="Open in VSCode"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 100 100" fill="currentColor" className="text-[#007ACC]">
                                            <path d="M74.7 14.3L52.1 33.9 30.8 16 14.3 23.4V76.6L30.8 84l21.3-17.9 22.6 19.6L100 78V22l-25.3-7.7zM30.8 62.3V37.7L52.1 50 30.8 62.3zM74.7 76.4l-14.8-12.8V36.4l14.8-12.8v52.8z" />
                                        </svg>
                                    </button>
                                    {/* Cursor button */}
                                    <button
                                        type="button"
                                        onClick={() => openInEditor('cursor', file)}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[rgba(255,255,255,0.1)] transition-all cursor-pointer"
                                        title="Open in Cursor"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00D4FF]">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Diff viewer */}
                    <div className="mb-4">
                        <DiffViewer unifiedDiff={unifiedDiff} defaultExpanded={true} />
                    </div>

                    {/* Applied files list */}
                    {isApplied && filesChanged && filesChanged.length > 0 && (
                        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="text-[12px] text-green-400 font-medium mb-1">
                                ✓ Changes applied to:
                            </div>
                            <ul className="text-[11px] text-green-300/80 font-mono">
                                {filesChanged.map((file) => (
                                    <li key={file}>• {file}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Reload hint */}
                    {showReloadHint && isApplied && (
                        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
                            <RefreshCw size={16} className="text-blue-400" />
                            <div className="flex-1">
                                <div className="text-[12px] text-blue-300 font-medium">
                                    Reload page to see changes
                                </div>
                                <p className="text-[11px] text-blue-300/70">
                                    Your code has been updated on disk
                                </p>
                            </div>
                            <button
                                onClick={handleReload}
                                className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[12px] font-medium hover:bg-blue-400 transition-colors cursor-pointer"
                            >
                                Reload Page
                            </button>
                        </div>
                    )}

                    {/* Error message */}
                    {hasError && error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="text-[12px] text-red-400 font-medium mb-1">
                                Failed to apply patch
                            </div>
                            <p className="text-[11px] text-red-300/80 font-mono">
                                {error}
                            </p>
                        </div>
                    )}

                    {/* Action buttons */}
                    {(isPending || hasError) && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleApply}
                                disabled={isApplying}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-[13px] font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                {isApplying ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Check size={14} />
                                )}
                                {hasError ? 'Retry' : 'Apply'}
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isApplying}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.1)] text-[#c9d1d9] text-[13px] font-medium hover:bg-[rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                <X size={14} />
                                Deny
                            </button>
                        </div>
                    )}

                    {/* Rejected state */}
                    {isRejected && (
                        <div className="text-[12px] text-[#8b949e]">
                            Changes were not applied.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatchProposalCard;
