/**
 * CompactToolCard - Compact UI component for rendering tool execution states
 * Features: Icon + tool name horizontal layout, animated loading, accordion details
 */

import React, { useState, useEffect, useRef } from 'react';
import { LoadingCheckIcon, type LoadingCheckIconHandle } from '../../../assets/chat/loading-check';
import { ChevronRightIcon, type ChevronRightIconHandle } from '../../../assets/chat/chevron-right';
import { ChevronDownIcon, type ChevronDownIconHandle } from '../../../assets/chat/chevrown-down';
import { getToolIcon } from './ToolIconMapper';
import { formatToolAction } from './ToolActionFormatter';


interface CompactToolCardProps {
    toolName: string;
    state: 'loading' | 'success' | 'error';
    input?: any;
    output?: any;
    errorText?: string;
}

export function CompactToolCard({
    toolName,
    state,
    input,
    output,
    errorText
}: CompactToolCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [mounted, setMounted] = useState(false);
    const loadingCheckRef = useRef<LoadingCheckIconHandle>(null);
    const chevronRef = useRef<ChevronRightIconHandle | ChevronDownIconHandle>(null);
    const ToolIcon = getToolIcon(toolName);

    // Trigger mount animation on component mount (like Sonner toast)
    useEffect(() => {
        // Trigger enter animation without using CSS animation
        setMounted(true);
    }, []);

    // Trigger loading animation when state is loading
    useEffect(() => {
        if (state === 'loading') {
            loadingCheckRef.current?.startAnimation();
        } else if (state === 'success') {
            loadingCheckRef.current?.stopAnimation();
        }
    }, [state]);

    const formatContent = (data: any, maxLength = 200): string => {
        if (!data) return '';
        const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    };

    // Format the tool action name based on state and context
    const displayName = formatToolAction({
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
            className="compact-tool-card"
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
                        <ToolIcon size={20} />
                    </div>
                    <span className="compact-tool-name">{displayName}</span>
                </div>

                {/* Right: Status Icon + Chevron */}
                <div className="compact-tool-status">
                    {state === 'loading' && (
                        <LoadingCheckIcon ref={loadingCheckRef} size={20} />
                    )}
                    {state === 'success' && (
                        <LoadingCheckIcon ref={loadingCheckRef} size={20} />
                    )}
                    {state === 'error' && (
                        <div className="compact-tool-error-icon">✕</div>
                    )}

                    {isHovered && (
                        isExpanded ? (
                            <ChevronDownIcon ref={chevronRef as React.RefObject<ChevronDownIconHandle>} size={16} />
                        ) : (
                            <ChevronRightIcon ref={chevronRef as React.RefObject<ChevronRightIconHandle>} size={16} />
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
                            <pre className="compact-tool-code">
                                {formatContent(input)}
                            </pre>
                        </div>
                    )}

                    {output && state === 'success' && (
                        <div className="compact-tool-section">
                            <div className="compact-tool-label">Output:</div>
                            <pre className="compact-tool-code">
                                {formatContent(output)}
                            </pre>
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
