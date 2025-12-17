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
    const categoryKey = `mcp-${serverId}`;

    const getToggleBtnStyle = (): React.CSSProperties => {
        if (allOn) {
            return { color: 'var(--color-primary, #3b82f6)' };
        }
        if (allOff) {
            return { color: 'var(--text-tertiary, #6b7280)' };
        }
        return { color: 'var(--color-warning, #f59e0b)' };
    };

    return (
        <div style={{ marginBottom: '2px' }}>
            <div
                onClick={() => onToggleCategory(categoryKey)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isExpanded ? (
                        <ChevronDown size={12} style={{ color: 'var(--text-tertiary, #6b7280)', flexShrink: 0 }} />
                    ) : (
                        <ChevronRight size={12} style={{ color: 'var(--text-tertiary, #6b7280)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-primary, #3b82f6)' }}>
                        {serverName}
                    </span>
                    <span
                        style={{
                            fontSize: '10px',
                            color: catEnabledCount < totalCount
                                ? 'var(--color-warning, #f59e0b)'
                                : 'var(--text-tertiary, #6b7280)',
                        }}
                    >
                        ({catEnabledCount}/{totalCount})
                    </span>
                </div>
                <button
                    type="button"
                    onClick={(e) => onToggleCategoryAll(e, serverId, tools)}
                    style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        border: 'none',
                        background: 'none',
                        flexShrink: 0,
                        ...getToggleBtnStyle(),
                    }}
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
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ padding: '2px 0 4px 20px' }}>
                            {tools.map((tool) => {
                                const enabled = !disabledTools.includes(tool.name);

                                return (
                                    <div
                                        key={tool.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            transition: 'background-color 0.15s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <HighlightedText
                                            text={tool.name}
                                            searchQuery={searchQuery}
                                            style={{
                                                fontSize: '11px',
                                                fontFamily: 'ui-monospace, monospace',
                                                color: 'var(--text-secondary, #9ca3af)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '180px',
                                            }}
                                            title={tool.description}
                                        />
                                        <Toggle
                                            checked={enabled}
                                            onChange={(checked) => onToggleTool(serverId, tool.name, checked)}
                                            size="sm"
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
