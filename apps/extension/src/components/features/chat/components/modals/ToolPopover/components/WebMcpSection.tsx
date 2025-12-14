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
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px 6px',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--text-tertiary, #6b7280)',
            }}>
                <Globe size={12} style={{ color: 'var(--color-success, #10b981)' }} />
                <span>Website Tools</span>
                {isLoading && (
                    <span style={{ fontSize: '9px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.7 }}>
                        Discovering...
                    </span>
                )}
                {!isLoading && tools.length > 0 && domain && (
                    <span style={{
                        marginLeft: 'auto',
                        fontWeight: 400,
                        fontSize: '9px',
                        color: 'var(--text-tertiary, #6b7280)',
                        textTransform: 'none',
                        letterSpacing: 'normal',
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {domain}
                    </span>
                )}
            </div>

            {tools.length > 0 && (
                <div style={{ marginBottom: '2px' }}>
                    <div
                        onClick={() => onToggleCategory('webmcp-active')}
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
                            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-success, #10b981)' }}>
                                Active Tab
                            </span>
                            <span style={{
                                fontSize: '10px',
                                color: enabledCount < totalCount
                                    ? 'var(--color-warning, #f59e0b)'
                                    : 'var(--text-tertiary, #6b7280)',
                            }}>
                                ({enabledCount}/{totalCount})
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onToggleCategoryAll}
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
                                        const displayName = tool.originalName || tool.name;

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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                                                    {tool.favicon ? (
                                                        <img
                                                            src={tool.favicon}
                                                            alt=""
                                                            style={{ width: '12px', height: '12px', flexShrink: 0, borderRadius: '2px', objectFit: 'contain' }}
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                            }}
                                                        />
                                                    ) : null}
                                                    <Globe
                                                        size={12}
                                                        className={tool.favicon ? 'hidden' : ''}
                                                        style={{ color: 'var(--color-success, #10b981)', flexShrink: 0 }}
                                                    />
                                                    <HighlightedText
                                                        text={displayName}
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
                                                        title={tool.description || displayName}
                                                    />
                                                </div>
                                                <Toggle
                                                    checked={enabled}
                                                    onChange={(checked) => onToggleTool(tool.name, checked)}
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
            )}

            {!isLoading && tools.length === 0 && (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary, #6b7280)' }}>
                    No WebMCP tools on this page
                </div>
            )}
        </div>
    );
};
