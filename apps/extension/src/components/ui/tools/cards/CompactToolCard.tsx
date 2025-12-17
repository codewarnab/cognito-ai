/**
 * CompactToolCard - Compact UI component for rendering tool execution states
 * Features: Icon + tool name horizontal layout, animated loading, accordion details
 */

import React, { useState, useEffect, useRef } from 'react';
import { LoadingCheckIcon, type LoadingCheckIconHandle } from '@assets/icons/chat/loading-check';
import { CircleCheckIcon, type CircleCheckIconHandle } from '@assets/icons/chat/circle-check';
import { ChevronRightIcon, type ChevronRightIconHandle } from '@assets/icons/chat/chevron-right';
import { ChevronDownIcon, type ChevronDownIconHandle } from '@assets/icons/chat/chevrown-down';
import { UploadIcon, type UploadIconHandle } from '@/components/shared/icons/UploadIcon';
import { getToolIcon } from '../icons/ToolIconMapper';
import { formatToolAction } from '../formatters';
import { createLogger } from '~logger';
import type { CustomInputOutputRenderers } from '@/ai/tools/components';
import { ToolFileAttachment, type ToolFileAttachmentData } from '@/components/features/chat/components/attachments';

const log = createLogger('CompactToolCard', 'UI_CHAT');

interface CompactToolCardProps {
    toolName: string;
    state: 'loading' | 'success' | 'error';
    input?: any;
    output?: any;
    errorText?: string;
    customRenderers?: CustomInputOutputRenderers;
    messageId?: string; // For Blob URL lifecycle management
}

export function CompactToolCard({
    toolName,
    state,
    input,
    output,
    errorText,
    customRenderers,
    messageId
}: CompactToolCardProps) {
    // Log tool rendering for debugging
    useEffect(() => {
        log.debug(`🎨 Rendering CompactToolCard for tool: "${toolName}"`, {
            toolName,
            state,
            hasInput: !!input,
            hasOutput: !!output,
            hasError: !!errorText
        });
    }, [toolName, state, input, output, errorText]);

    const [isExpanded, setIsExpanded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [mounted, setMounted] = useState(false);
    const loadingCheckRef = useRef<LoadingCheckIconHandle>(null);
    const circleCheckRef = useRef<CircleCheckIconHandle>(null);
    const chevronRef = useRef<ChevronRightIconHandle | ChevronDownIconHandle>(null);
    const toolIconRef = useRef<any>(null); // Ref for the tool icon
    const uploadIconRef = useRef<UploadIconHandle>(null); // Ref for upload icon
    const ToolIcon = getToolIcon(toolName);

    // Format the tool action name based on state and context (needs to be before useEffect)
    const formattedAction = formatToolAction({
        toolName,
        state,
        input,
        output
    });

    // Trigger mount animation on component mount (like Sonner toast)
    useEffect(() => {
        // Trigger enter animation without using CSS animation
        setMounted(true);

        // Trigger tool icon animation on mount
        if (toolIconRef.current?.startAnimation) {
            toolIconRef.current.startAnimation();
        }
    }, []);

    // Trigger loading animation when state is loading
    useEffect(() => {
        if (state === 'loading') {
            loadingCheckRef.current?.startAnimation();
            // Also trigger upload icon animation if it's shown
            if (formattedAction.customIcon === 'upload') {
                uploadIconRef.current?.startAnimation();
            }
        } else {
            // Always stop loading animation when not in loading state
            loadingCheckRef.current?.stopAnimation();
            uploadIconRef.current?.stopAnimation();

            if (state === 'success') {
                // Trigger check animation after a brief delay
                setTimeout(() => {
                    circleCheckRef.current?.startAnimation();
                }, 50);
            }
        }
    }, [state, formattedAction.customIcon]);

    const formatContent = (data: any, maxLength = 200): string => {
        if (!data) return '';
        const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    };

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div
            className={`rounded-none py-[6px] my-[2px] border-none bg-transparent cursor-pointer inline-block max-w-fit 
                transition-[transform,opacity,max-width] duration-[400ms] ease-out
                ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                ${isExpanded ? 'max-w-full block' : ''}`}
            data-mounted={mounted}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className="flex items-center justify-between select-none"
                onClick={handleToggle}
            >
                {/* Left: Icon + Tool Name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`flex items-center justify-center shrink-0 transition-opacity duration-200 text-[var(--text-secondary)] ${isHovered ? 'opacity-80' : ''}`}>
                        {/* Use UploadIcon when customIcon is 'upload', otherwise use default tool icon */}
                        {formattedAction.customIcon === 'upload' ? (
                            <UploadIcon ref={uploadIconRef} size={16} />
                        ) : (
                            <ToolIcon ref={toolIconRef} size={16} />
                        )}
                    </div>
                    <div className="text-[14px] font-normal text-[var(--text-primary)] leading-[1.4] flex flex-col gap-[2px]">
                        <span className="text-[14px] text-[var(--text-primary)] leading-none">{formattedAction.action}</span>
                        {formattedAction.description && (
                            <span className="text-[12px] text-[var(--text-tertiary)] opacity-60">{formattedAction.description}</span>
                        )}
                    </div>
                </div>

                {/* Right: Status Icon + Chevron */}
                <div className="flex items-center gap-1 shrink-0 ml-2">
                    {/* Loading icon - only visible when loading */}
                    <div style={{ display: state === 'loading' ? 'flex' : 'none', alignItems: 'center' }}>
                        <LoadingCheckIcon ref={loadingCheckRef} size={16} />
                    </div>

                    {/* Success icon - only visible when success */}
                    <div style={{ display: state === 'success' ? 'flex' : 'none', alignItems: 'center', color: '#22c55e' }}>
                        <CircleCheckIcon ref={circleCheckRef} size={16} />
                    </div>

                    {/* Error icon - only visible when error */}
                    {state === 'error' && (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center bg-[var(--color-error)] text-white text-[10px] font-bold shrink-0">✕</div>
                    )}

                    {isHovered && (
                        isExpanded ? (
                            <ChevronDownIcon ref={chevronRef as React.RefObject<ChevronDownIconHandle>} size={14} />
                        ) : (
                            <ChevronRightIcon ref={chevronRef as React.RefObject<ChevronRightIconHandle>} size={14} />
                        )
                    )}
                </div>
            </div>

            {/* File Attachment - Always visible when available */}
            {output?.fileData && state === 'success' && (
                <div className="mt-3 pl-0 animate-in slide-in-from-top-1 fade-in duration-300">
                    <ToolFileAttachment
                        fileData={output.fileData as ToolFileAttachmentData}
                        messageId={messageId}
                    />
                </div>
            )}

            {/* Accordion Content */}
            {isExpanded && (
                <div className="mt-2 pt-2 pl-6 border-t border-white/5 w-full animate-in slide-in-from-top-1 fade-in duration-200">
                    {/* Hide INPUT/OUTPUT for successful PDF generation */}
                    {!(toolName === 'generatePDF' && state === 'success') && (
                        <>
                            {input && (
                                <div className="mb-[var(--spacing-sm)] last:mb-0">
                                    <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-[var(--spacing-xs)] uppercase tracking-[0.5px]">Input:</div>
                                    {customRenderers?.renderInput ? (
                                        <div className="bg-transparent rounded-[var(--radius-sm)] text-[13px] leading-[1.5]">
                                            {customRenderers.renderInput(input)}
                                        </div>
                                    ) : (
                                        <pre className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] p-[6px] px-[var(--spacing-sm)] text-[12px] font-mono overflow-x-auto max-h-[150px] overflow-y-auto whitespace-pre-wrap break-words text-[var(--text-primary)] leading-[1.5]">
                                            {formatContent(input)}
                                        </pre>
                                    )}
                                </div>
                            )}

                            {output && state === 'success' && (
                                <div className="mb-[var(--spacing-sm)] last:mb-0">
                                    <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-[var(--spacing-xs)] uppercase tracking-[0.5px]">Output:</div>
                                    {customRenderers?.renderOutput ? (
                                        <div className="bg-transparent rounded-[var(--radius-sm)] text-[13px] leading-[1.5]">
                                            {customRenderers.renderOutput(output)}
                                        </div>
                                    ) : (
                                        <pre className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] p-[6px] px-[var(--spacing-sm)] text-[12px] font-mono overflow-x-auto max-h-[150px] overflow-y-auto whitespace-pre-wrap break-words text-[var(--text-primary)] leading-[1.5]">
                                            {formatContent(output)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {errorText && state === 'error' && (
                        <div className="mb-[var(--spacing-sm)] last:mb-0">
                            <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-[var(--spacing-xs)] uppercase tracking-[0.5px]">Error:</div>
                            <div className="text-[var(--color-error)] bg-[rgba(244,67,54,0.1)] border border-[var(--color-error)] rounded-[var(--radius-sm)] p-[6px] px-[var(--spacing-sm)] text-[12px] leading-[1.4]">
                                {formatContent(errorText)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

