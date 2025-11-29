/**
 * Rewriter Tooltip Component
 * Floating tooltip for text rewriting with presets and custom instructions
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RewriterPresets } from './RewriterPresets';
import { ToolsToggle } from '../shared/ToolsToggle';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { getRewriteSettings, updateRewriteSetting } from '@/utils/settings/rewriteSettings';
import type { RewritePreset } from '@/types';

interface RewriterTooltipProps {
    position: { x: number; y: number };
    selectedText: string;
    rewrittenText: string;
    isProcessing: boolean;
    error: string | null;
    onPresetClick: (preset: RewritePreset, toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean; enableSupermemorySearch: boolean }) => void;
    onCustomRewrite: (instruction: string, toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean; enableSupermemorySearch: boolean }) => void;
    onApply: () => void;
    onClose: () => void;
}

// SVG Icons
const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SendIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const Edit3Icon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
);

const AlertCircleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
);

const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export function RewriterTooltip({
    position,
    // selectedText - available via props if needed for preview
    rewrittenText,
    isProcessing,
    error,
    onPresetClick,
    onCustomRewrite,
    onApply,
    onClose,
}: RewriterTooltipProps) {
    const [instruction, setInstruction] = useState('');
    const [copied, setCopied] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState(position);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Tool settings state
    const [enableUrlContext, setEnableUrlContext] = useState(false);
    const [enableGoogleSearch, setEnableGoogleSearch] = useState(false);
    const [enableSupermemorySearch, setEnableSupermemorySearch] = useState(false);
    const [supermemoryConfigured, setSupermemoryConfigured] = useState(false);

    // Load tool settings on mount
    useEffect(() => {
        // Load rewrite settings
        getRewriteSettings().then((settings) => {
            setEnableUrlContext(settings.enableUrlContext);
            setEnableGoogleSearch(settings.enableGoogleSearch);
            setEnableSupermemorySearch(settings.enableSupermemorySearch);
        }).catch(() => {
            // Use defaults on error
        });

        // Check if Supermemory is configured
        // This is done via message to background since content scripts can't access storage directly
        chrome.runtime.sendMessage({ type: 'CHECK_SUPERMEMORY_READY' }, (response) => {
            if (chrome.runtime.lastError) {
                // Fallback to not configured
                setSupermemoryConfigured(false);
                return;
            }
            setSupermemoryConfigured(response?.ready ?? false);
        });
    }, []);

    // Handle tool setting changes
    const handleUrlContextChange = useCallback((enabled: boolean) => {
        setEnableUrlContext(enabled);
        void updateRewriteSetting('enableUrlContext', enabled);
    }, []);

    const handleGoogleSearchChange = useCallback((enabled: boolean) => {
        setEnableGoogleSearch(enabled);
        void updateRewriteSetting('enableGoogleSearch', enabled);
    }, []);

    const handleSupermemorySearchChange = useCallback((enabled: boolean) => {
        // Only allow enabling if Supermemory is configured
        if (enabled && !supermemoryConfigured) return;
        setEnableSupermemorySearch(enabled);
        void updateRewriteSetting('enableSupermemorySearch', enabled);
    }, [supermemoryConfigured]);

    // Get current tool settings
    const getToolSettings = useCallback(() => ({
        enableUrlContext,
        enableGoogleSearch,
        enableSupermemorySearch,
    }), [enableUrlContext, enableGoogleSearch, enableSupermemorySearch]);

    // Update position when prop changes
    useEffect(() => {
        // Adjust position to keep tooltip in viewport
        const tooltipWidth = 360;
        const tooltipHeight = 280;
        const padding = 20;

        let x = position.x - tooltipWidth / 2; // Center horizontally
        let y = position.y - tooltipHeight - 10; // Above selection

        // Clamp to viewport
        x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
        y = Math.max(padding, y);

        // If tooltip would be above viewport, show below selection instead
        if (y < padding) {
            y = position.y + 30;
        }

        setTooltipPosition({ x, y });
    }, [position]);

    // Auto-focus input when tooltip opens
    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!tooltipRef.current?.contains(document.activeElement)) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (rewrittenText && !isProcessing) {
                    onApply();
                } else if (instruction.trim() && !isProcessing) {
                    onCustomRewrite(instruction, getToolSettings());
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [instruction, rewrittenText, isProcessing, onCustomRewrite, onApply, onClose, getToolSettings]);

    // Handle click outside - uses composedPath for Shadow DOM traversal
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // Don't close if processing
            if (isProcessing) return;

            // Use composedPath() to traverse Shadow DOM boundaries (Plasmo renders in shadow DOM)
            const path = e.composedPath();

            const isInsideTooltip = path.some((el) => {
                if (el instanceof HTMLElement) {
                    if (el === tooltipRef.current) return true;
                    if (el.classList?.contains('rewriter-tooltip')) return true;
                    if (el.tagName === 'PLASMO-CSUI') return true;
                }
                return false;
            });

            if (!isInsideTooltip) {
                onClose();
            }
        };

        // Delay adding listener to prevent immediate close
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside, true);
        }, 150);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isProcessing, onClose]);

    // Handle custom instruction submit
    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (instruction.trim() && !isProcessing) {
            onCustomRewrite(instruction, getToolSettings());
        }
    };

    // Handle preset click with tool settings
    const handlePresetClickWithTools = (preset: RewritePreset) => {
        onPresetClick(preset, getToolSettings());
    };

    // Handle copy
    const handleCopy = async () => {
        if (!rewrittenText) return;
        try {
            await navigator.clipboard.writeText(rewrittenText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Silently fail
        }
    };

    return (
        <div
            ref={tooltipRef}
            className="rewriter-tooltip"
            style={{
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y}px`,
            }}
            role="dialog"
            aria-label="Rewrite text"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="rewriter-header">
                <span className="rewriter-title">
                    <span className="rewriter-title-icon"><Edit3Icon /></span>
                    Rewrite
                </span>
                <button
                    className="rewriter-close"
                    onClick={onClose}
                    aria-label="Close"
                    title="Close (Esc)"
                >
                    <CloseIcon />
                </button>
            </div>

            {/* Preset Buttons */}
            <div className="rewriter-presets-section">
                <RewriterPresets
                    onSelect={handlePresetClickWithTools}
                    disabled={isProcessing}
                />
            </div>

            {/* Custom Instruction */}
            <form className="rewriter-custom-row" onSubmit={handleCustomSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    className="rewriter-input"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Custom instruction..."
                    disabled={isProcessing}
                    autoComplete="off"
                />
                <button
                    type="submit"
                    className="rewriter-send-button"
                    disabled={!instruction.trim() || isProcessing}
                    title="Rewrite (Enter)"
                >
                    <SendIcon />
                </button>
            </form>

            {/* Tools Toggle - Inline Settings */}
            <div className="rewriter-tools-row">
                <ToolsToggle
                    enableUrlContext={enableUrlContext}
                    enableGoogleSearch={enableGoogleSearch}
                    enableSupermemorySearch={enableSupermemorySearch}
                    onUrlContextChange={handleUrlContextChange}
                    onGoogleSearchChange={handleGoogleSearchChange}
                    onSupermemorySearchChange={handleSupermemorySearchChange}
                    supermemoryConfigured={supermemoryConfigured}
                    disabled={isProcessing}
                />
            </div>

            {/* Loading State */}
            {isProcessing && !rewrittenText && (
                <div className="rewriter-loading">
                    <div className="rewriter-shimmer">
                        <div className="rewriter-shimmer-line rewriter-shimmer-line--full"></div>
                        <div className="rewriter-shimmer-line rewriter-shimmer-line--medium"></div>
                        <div className="rewriter-shimmer-line rewriter-shimmer-line--short"></div>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="rewriter-error">
                    <AlertCircleIcon />
                    <span>{error}</span>
                </div>
            )}

            {/* Rewritten Output */}
            {rewrittenText && (
                <div className="rewriter-output">
                    <div className="rewriter-output-text rewriter-markdown-content">
                        <MarkdownRenderer content={rewrittenText} />
                    </div>
                </div>
            )}

            {/* Actions */}
            {rewrittenText && !isProcessing && (
                <div className="rewriter-actions">
                    <button
                        className="rewriter-action-button"
                        onClick={handleCopy}
                        disabled={copied}
                    >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        className="rewriter-action-button rewriter-action-button--primary"
                        onClick={onApply}
                    >
                        <CheckIcon />
                        Apply
                    </button>
                </div>
            )}
        </div>
    );
}
