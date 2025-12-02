import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toggle } from '@/components/shared/inputs/Toggle';
import { HighlightedText } from '../utils/highlightText';
import type { McpCategoryProps } from '../types';

export const McpCategory: React.FC<McpCategoryProps> = ({
    serverId,
    serverName,
    tools,
    disabledTools,
    isExpanded,
    searchQuery,
    onToggleCategory,
    onToggleTool,
    onToggleCategoryAll,
}) => {
    const catEnabledCount = tools.filter(t => !disabledTools.includes(t.name)).length;
    const totalCount = tools.length;
    const allOn = catEnabledCount === totalCount;
    const allOff = catEnabledCount === 0;
    const statusLabel = allOn ? 'All on' : allOff ? 'All off' : 'Some on';
    const statusClass = allOn ? 'all-on' : allOff ? 'all-off' : 'some-on';
    const categoryKey = `mcp-${serverId}`;

    return (
        <div className="tools-popover-category">
            <div
                onClick={() => onToggleCategory(categoryKey)}
                className="tools-popover-category-header"
            >
                <div className="tools-popover-category-left">
                    {isExpanded ?
                        <ChevronDown size={12} className="tools-popover-chevron" /> :
                        <ChevronRight size={12} className="tools-popover-chevron" />
                    }
                    <span className="tools-popover-category-name tools-popover-mcp-name">{serverName}</span>
                    <span className={`tools-popover-category-count ${catEnabledCount < totalCount ? 'partial' : ''}`}>
                        ({catEnabledCount}/{totalCount})
                    </span>
                </div>
                <button
                    type="button"
                    onClick={(e) => onToggleCategoryAll(e, serverId, tools)}
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

                                return (
                                    <div
                                        key={tool.name}
                                        className="tools-popover-tool"
                                    >
                                        <HighlightedText
                                            text={tool.name}
                                            searchQuery={searchQuery}
                                            className="tools-popover-tool-name"
                                            title={tool.description}
                                        />
                                        <Toggle
                                            checked={enabled}
                                            onChange={(checked) => onToggleTool(serverId, tool.name, checked)}
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
    );
};
