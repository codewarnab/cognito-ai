import React from 'react';
import { ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toggle } from '@/components/shared/inputs/Toggle';
import { HighlightedText } from '../utils/highlightText';
import type { WebMcpSectionProps } from '../types';

export const WebMcpSection: React.FC<WebMcpSectionProps> = ({
    tools,
    disabledTools,
    isLoading,
    enabledCount,
    isExpanded,
    searchQuery,
    onToggleCategory,
    onToggleTool,
    onToggleCategoryAll,
}) => {
    if (tools.length === 0 && !isLoading) {
        return null;
    }

    const domain = tools.length > 0 ? tools[0]?.domain : undefined;
    const totalCount = tools.length;
    const allOn = enabledCount === totalCount;
    const allOff = enabledCount === 0;
    const statusLabel = allOn ? 'All on' : allOff ? 'All off' : 'Some on';
    const statusClass = allOn ? 'all-on' : allOff ? 'all-off' : 'some-on';

    return (
        <div className="tools-popover-webmcp-section">
            <div className="tools-popover-webmcp-header">
                <Globe size={12} />
                <span>Website Tools</span>
                {isLoading && <span className="tools-popover-webmcp-loading">Discovering...</span>}
                {!isLoading && tools.length > 0 && domain && (
                    <span className="tools-popover-webmcp-domain">{domain}</span>
                )}
            </div>

            {tools.length > 0 && (
                <div className="tools-popover-category">
                    <div
                        onClick={() => onToggleCategory('webmcp-active')}
                        className="tools-popover-category-header"
                    >
                        <div className="tools-popover-category-left">
                            {isExpanded ? (
                                <ChevronDown size={12} className="tools-popover-chevron" />
                            ) : (
                                <ChevronRight size={12} className="tools-popover-chevron" />
                            )}
                            <span className="tools-popover-category-name tools-popover-webmcp-name">
                                Active Tab
                            </span>
                            <span className={`tools-popover-category-count ${enabledCount < totalCount ? 'partial' : ''}`}>
                                ({enabledCount}/{totalCount})
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onToggleCategoryAll}
                            className={`tools-popover-toggle-btn ${statusClass}`}
                        >
                            {statusLabel}
                        </button>
                    </div>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                            >
                                <div className="tools-popover-tools">
                                    {tools.map((tool) => {
                                        const enabled = !disabledTools.includes(tool.name);
                                        const displayName = tool.originalName || tool.name;

                                        return (
                                            <div
                                                key={tool.name}
                                                className="tools-popover-tool"
                                            >
                                                <div className="tools-popover-tool-info">
                                                    {tool.favicon ? (
                                                        <img
                                                            src={tool.favicon}
                                                            alt=""
                                                            className="tools-popover-webmcp-favicon"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                            }}
                                                        />
                                                    ) : null}
                                                    <Globe
                                                        size={12}
                                                        className={`tools-popover-webmcp-icon ${tool.favicon ? 'hidden' : ''}`}
                                                    />
                                                    <HighlightedText
                                                        text={displayName}
                                                        searchQuery={searchQuery}
                                                        className="tools-popover-tool-name"
                                                        title={tool.description || displayName}
                                                    />
                                                </div>
                                                <Toggle
                                                    checked={enabled}
                                                    onChange={(checked) => onToggleTool(tool.name, checked)}
                                                    className="tools-popover-toggle"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {!isLoading && tools.length === 0 && (
                <div className="tools-popover-webmcp-empty">
                    No WebMCP tools on this page
                </div>
            )}
        </div>
    );
};
