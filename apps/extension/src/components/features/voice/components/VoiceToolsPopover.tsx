/**
 * VoiceToolsPopover - Minimal popover for voice mode tool settings
 * Matches chat mode's compact popover aesthetic
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings2, X, Search } from 'lucide-react';
import { createLogger } from '~logger';
import { ALL_TOOLS, getEnabledTools, setEnabledTools } from '@/services/elevenlabs/settings';
import { Toggle } from '@/components/ui/primitives/toggle';
import '../styles/VoiceToolsPopover.css';

/**
 * Escapes special characters for RegExp
 */
const escapeRegExp = (input: string): string => {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Escapes special characters for HTML
 */
const escapeHtml = (input: string): string => {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * Builds HTML string with highlighted search matches
 */
const buildHighlightHtml = (text: string, searchQuery: string): string => {
    const query = searchQuery.trim();
    if (!query) return escapeHtml(text);

    const safeText = escapeHtml(text);
    const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    return safeText.replace(
        pattern,
        '<mark class="voice-tools-popover-highlight">$1</mark>'
    );
};

/**
 * React component that renders text with highlighted search matches
 */
const HighlightedText: React.FC<{
    text: string;
    searchQuery?: string;
    className?: string;
}> = ({ text, searchQuery, className }) => {
    if (!searchQuery || !searchQuery.trim()) {
        return <span className={className}>{text}</span>;
    }

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{
                __html: buildHighlightHtml(text, searchQuery)
            }}
        />
    );
};

const log = createLogger('VoiceToolsPopover', 'UI_VOICE');

interface VoiceToolsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onToolsChange?: (enabledTools: string[]) => void;
}

export const VoiceToolsPopover: React.FC<VoiceToolsPopoverProps> = ({
    isOpen,
    onClose,
    onToolsChange,
}) => {
    const [enabledToolIds, setEnabledToolIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [previousState, setPreviousState] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Filter tools based on search query
    const filteredTools = useMemo(() => {
        if (!searchQuery.trim()) return ALL_TOOLS;
        const query = searchQuery.toLowerCase();
        return ALL_TOOLS.filter(
            (tool) =>
                tool.name.toLowerCase().includes(query) ||
                tool.description.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    useEffect(() => {
        const loadTools = async () => {
            if (!isOpen) {
                // Reset search when popover closes
                setSearchQuery('');
                return;
            }

            try {
                setIsLoading(true);
                const tools = await getEnabledTools();
                setEnabledToolIds(tools);
                setPreviousState(tools);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                log.error('Failed to load enabled tools', { error: errorMessage });
            } finally {
                setIsLoading(false);
            }
        };

        loadTools();
    }, [isOpen]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleToggleTool = async (toolId: string, checked: boolean) => {
        const newEnabled = checked
            ? [...enabledToolIds, toolId]
            : enabledToolIds.filter((id) => id !== toolId);

        setEnabledToolIds(newEnabled);

        try {
            await setEnabledTools(newEnabled);
            setPreviousState(newEnabled);
            onToolsChange?.(newEnabled);
            log.info('Tool toggled', { toolId, enabled: checked });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log.error('Failed to save tool settings', { error: errorMessage });
            setEnabledToolIds(previousState);
        }
    };

    const handleEnableAll = async () => {
        const allIds = ALL_TOOLS.map((t) => t.id);
        setEnabledToolIds(allIds);

        try {
            await setEnabledTools(allIds);
            setPreviousState(allIds);
            onToolsChange?.(allIds);
            log.info('All tools enabled');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log.error('Failed to enable all tools', { error: errorMessage });
            setEnabledToolIds(previousState);
        }
    };

    const handleDisableAll = async () => {
        setEnabledToolIds([]);

        try {
            await setEnabledTools([]);
            setPreviousState([]);
            onToolsChange?.([]);
            log.info('All tools disabled');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log.error('Failed to disable all tools', { error: errorMessage });
            setEnabledToolIds(previousState);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={popoverRef}
                    className="voice-tools-popover"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                    <div className="voice-tools-popover-arrow" />

                    <div className="voice-tools-popover-header">
                        <div className="voice-tools-popover-title">
                            <Settings2 size={14} />
                            <span>Voice Tools</span>
                        </div>
                        <button
                            className="voice-tools-popover-close"
                            onClick={onClose}
                            aria-label="Close"
                            type="button"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div className="voice-tools-popover-search">
                        <Search size={12} className="voice-tools-popover-search-icon" />
                        <input
                            ref={searchInputRef}
                            className="voice-tools-popover-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tools..."
                            autoFocus
                        />
                    </div>

                    <div className="voice-tools-popover-actions">
                        <button
                            className="voice-tools-popover-action-btn"
                            onClick={handleEnableAll}
                            type="button"
                        >
                            Enable All
                        </button>
                        <button
                            className="voice-tools-popover-action-btn"
                            onClick={handleDisableAll}
                            type="button"
                        >
                            Disable All
                        </button>
                    </div>

                    <div className="voice-tools-popover-content">
                        {isLoading ? (
                            <div className="voice-tools-popover-loading">Loading tools...</div>
                        ) : filteredTools.length === 0 ? (
                            <div className="voice-tools-popover-empty">No tools found</div>
                        ) : (
                            filteredTools.map((tool) => (
                                <div key={tool.id} className="voice-tools-popover-item">
                                    <div className="voice-tools-popover-item-info">
                                        <HighlightedText
                                            text={tool.name}
                                            searchQuery={searchQuery}
                                            className="voice-tools-popover-item-name"
                                        />
                                        <HighlightedText
                                            text={tool.description}
                                            searchQuery={searchQuery}
                                            className="voice-tools-popover-item-desc"
                                        />
                                    </div>
                                    <div className="voice-tools-popover-toggle">
                                        <Toggle
                                            checked={enabledToolIds.includes(tool.id)}
                                            onChange={(checked) => handleToggleTool(tool.id, checked)}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="voice-tools-popover-footer">
                        <span>
                            {enabledToolIds.length} of {ALL_TOOLS.length} enabled
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default VoiceToolsPopover;
