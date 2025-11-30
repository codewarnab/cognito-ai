import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toggle } from '@/components/shared/inputs/Toggle';
import { SUPERMEMORY_TOOLS } from '@/constants/toolDescriptions';
import { Supermemory } from '@assets/brands/integrations/Supermemory';
import { SupermemoryGatedIcon } from './SupermemoryGatedIcon';
import type { ToolCategoryProps } from '../types';

export const ToolCategory: React.FC<ToolCategoryProps> = ({
    category,
    tools,
    enabledMap,
    isExpanded,
    supermemoryConfigured,
    showSupermemoryTooltip,
    onToggleCategory,
    onToggleTool,
    onToggleCategoryAll,
    onSetSupermemoryTooltip,
}) => {
    const catEnabledCount = tools.filter(tool => enabledMap[tool] === true).length;
    const totalCount = tools.length;
    const allOn = catEnabledCount === totalCount;
    const allOff = catEnabledCount === 0;
    const statusLabel = allOn ? 'All on' : allOff ? 'All off' : 'Some on';
    const statusClass = allOn ? 'all-on' : allOff ? 'all-off' : 'some-on';

    return (
        <div className="tools-popover-category">
            <div
                onClick={() => onToggleCategory(category)}
                className="tools-popover-category-header"
            >
                <div className="tools-popover-category-left">
                    {isExpanded ?
                        <ChevronDown size={12} className="tools-popover-chevron" /> :
                        <ChevronRight size={12} className="tools-popover-chevron" />
                    }
                    <span className="tools-popover-category-name">{category}</span>
                    <span className={`tools-popover-category-count ${catEnabledCount < totalCount ? 'partial' : ''}`}>
                        ({catEnabledCount}/{totalCount})
                    </span>
                </div>
                <button
                    type="button"
                    onClick={(e) => onToggleCategoryAll(e, category, tools)}
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
                                const enabled = enabledMap[tool] === true;
                                const isSupermemoryTool = SUPERMEMORY_TOOLS.includes(tool);
                                const isGated = isSupermemoryTool && !supermemoryConfigured;
                                const showTooltip = showSupermemoryTooltip === tool;

                                return (
                                    <div
                                        key={tool}
                                        className="tools-popover-tool"
                                        style={{ opacity: isGated ? 0.7 : 1 }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {isSupermemoryTool && (
                                                <Supermemory style={{ width: 14, height: 14, flexShrink: 0 }} />
                                            )}
                                            <span className="tools-popover-tool-name" title={tool}>
                                                {tool}
                                            </span>
                                            {isGated && (
                                                <SupermemoryGatedIcon
                                                    showTooltip={showTooltip}
                                                    onToggleTooltip={(show) => onSetSupermemoryTooltip(show ? tool : null)}
                                                />
                                            )}
                                        </div>
                                        <Toggle
                                            checked={enabled}
                                            onChange={(checked) => onToggleTool(tool, checked)}
                                            className="tools-popover-toggle"
                                            disabled={isGated && !enabled}
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
