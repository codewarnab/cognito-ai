/**
 * CompactToolCard - Compact UI component for rendering tool execution states
 * Features: Icon + tool name horizontal layout, animated loading, accordion details
 */

import React, { useState, useEffect, useRef } from 'react';
import { LoadingCheckIcon, type LoadingCheckIconHandle } from '../../../../../assets/chat/loading-check';
import { CircleCheckIcon, type CircleCheckIconHandle } from '../../../../../assets/chat/circle-check';
import { ChevronRightIcon, type ChevronRightIconHandle } from '../../../../../assets/chat/chevron-right';
import { ChevronDownIcon, type ChevronDownIconHandle } from '../../../../../assets/chat/chevrown-down';
import { getToolIcon } from '../icons/ToolIconMapper';
import { formatToolAction } from '../formatters';
import { createLogger } from '../../../../logger';
import type { CustomInputOutputRenderers } from '../../../../ai/tools/components';

const log = createLogger('CompactToolCard');

interface CompactToolCardProps {
    toolName: string;
    state: 'loading' | 'success' | 'error';
    input?: any;
    output?: any;
    errorText?: string;
    customRenderers?: CustomInputOutputRenderers;
}

export function CompactToolCard({
    toolName,
    state,
    input,
    output,
    errorText,
    customRenderers
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
    const ToolIcon = getToolIcon(toolName);

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
        } else {
            // Always stop loading animation when not in loading state
            loadingCheckRef.current?.stopAnimation();

            if (state === 'success') {
                // Trigger check animation after a brief delay
                setTimeout(() => {
                    circleCheckRef.current?.startAnimation();
                }, 50);
            }
        }
    }, [state]);

    const formatContent = (data: any, maxLength = 200): string => {
        if (!data) return '';
        const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    };

    // Format the tool action name based on state and context
    const formattedAction = formatToolAction({
        toolName,
        state,
        input,
        output
    });

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div
            className={`compact-tool-card ${isExpanded ? 'expanded' : ''}`}
            data-mounted={mounted}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className="compact-tool-header"
                onClick={handleToggle}
            >
                {/* Left: Icon + Tool Name */}
                <div className="compact-tool-main">
                    <div className={`compact-tool-icon ${isHovered ? 'hovered' : ''}`}>
                        <ToolIcon ref={toolIconRef} size={16} />
                    </div>
                    <div className="compact-tool-name">
                        <span className="compact-tool-action">{formattedAction.action}</span>
                        {formattedAction.description && (
                            <span className="compact-tool-description">{formattedAction.description}</span>
                        )}
                    </div>
                </div>

                {/* Right: Status Icon + Chevron */}
                <div className="compact-tool-status">
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
                        <div className="compact-tool-error-icon">✕</div>
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

            {/* Accordion Content */}
            {isExpanded && (
                <div className="compact-tool-content">
                    {input && (
                        <div className="compact-tool-section">
                            <div className="compact-tool-label">Input:</div>
                            {customRenderers?.renderInput ? (
                                <div className="compact-tool-custom">
                                    {customRenderers.renderInput(input)}
                                </div>
                            ) : (
                                <pre className="compact-tool-code">
                                    {formatContent(input)}
                                </pre>
                            )}
                        </div>
                    )}

                    {output && state === 'success' && (
                        <div className="compact-tool-section">
                            <div className="compact-tool-label">Output:</div>
                            {customRenderers?.renderOutput ? (
                                <div className="compact-tool-custom">
                                    {customRenderers.renderOutput(output)}
                                </div>
                            ) : (
                                <pre className="compact-tool-code">
                                    {formatContent(output)}
                                </pre>
                            )}
                        </div>
                    )}

                    {errorText && state === 'error' && (
                        <div className="compact-tool-section error">
                            <div className="compact-tool-label">Error:</div>
                            <div className="compact-tool-error-text">
                                {formatContent(errorText)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
