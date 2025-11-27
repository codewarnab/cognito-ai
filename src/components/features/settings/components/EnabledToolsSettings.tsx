import React, { useEffect, useMemo, useState } from 'react';
import { Wrench, Search, ChevronDown, ChevronRight, Info, AlertCircle } from 'lucide-react';
import { createLogger } from '~logger';
import { DEFAULT_ENABLED_TOOLS, TOOLS_DISABLED_BY_DEFAULT } from '@/ai/tools/enabledTools';
import { getEnabledToolsOverride, setEnabledToolsOverride } from '@/utils/settings';
import { Toggle } from '../../../shared/inputs/Toggle';
import { TOOL_CATEGORIES, TOOL_DESCRIPTIONS, SUPERMEMORY_TOOLS } from '@/constants/toolDescriptions';
import { isSupermemoryReady } from '@/utils/supermemory';
import { Supermemory } from '@assets/brands/integrations/Supermemory';

const log = createLogger('EnabledToolsSettings');

export const EnabledToolsSettings: React.FC = () => {
    const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
    const [toolSearchQuery, setToolSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [supermemoryConfigured, setSupermemoryConfigured] = useState(false);
    const [showSupermemoryTooltip, setShowSupermemoryTooltip] = useState<string | null>(null);
    const allTools = useMemo(() => DEFAULT_ENABLED_TOOLS, []);

    useEffect(() => {
        const loadTools = async () => {
            try {
                const override = await getEnabledToolsOverride();
                const initialMap: Record<string, boolean> = {};
                const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);

                if (override && Array.isArray(override)) {
                    const set = new Set(override);
                    allTools.forEach(t => {
                        initialMap[t] = set.has(t);
                    });
                } else {
                    // No override: use defaults, but respect TOOLS_DISABLED_BY_DEFAULT
                    allTools.forEach(t => {
                        initialMap[t] = !disabledByDefaultSet.has(t);
                    });
                }
                setEnabledMap(initialMap);
            } catch (err) {
                log.error('Failed to load enabled tools', err);
                const initialMap: Record<string, boolean> = {};
                const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);
                allTools.forEach(t => {
                    initialMap[t] = !disabledByDefaultSet.has(t);
                });
                setEnabledMap(initialMap);
            }
        };
        loadTools();
    }, [allTools]);

    // Check Supermemory configuration status
    useEffect(() => {
        const checkSupermemory = async () => {
            try {
                const ready = await isSupermemoryReady();
                setSupermemoryConfigured(ready);
            } catch (err) {
                log.error('Failed to check Supermemory status', err);
                setSupermemoryConfigured(false);
            }
        };
        checkSupermemory();
    }, []);

    const handleToggleTool = async (tool: string, checked: boolean) => {
        // Prevent enabling Supermemory tools if not configured
        if (checked && SUPERMEMORY_TOOLS.includes(tool) && !supermemoryConfigured) {
            setShowSupermemoryTooltip(tool);
            return;
        }

        setEnabledMap(prev => {
            const next = { ...prev, [tool]: checked };
            // Always save the explicit list to ensure persistence
            const enabledList = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
            void setEnabledToolsOverride(enabledList);
            return next;
        });
    };

    const handleToggleCategoryTools = (e: React.MouseEvent, tools: string[]) => {
        e.stopPropagation();
        const allEnabled = tools.every(t => enabledMap[t] ?? true);
        const newState = !allEnabled;

        // Filter out Supermemory tools if trying to enable and not configured
        const toolsToUpdate = newState && !supermemoryConfigured
            ? tools.filter(t => !SUPERMEMORY_TOOLS.includes(t))
            : tools;

        if (toolsToUpdate.length === 0) {
            // All tools in this category are Supermemory tools and not configured
            setShowSupermemoryTooltip(tools[0] || null);
            return;
        }

        setEnabledMap(prev => {
            const next = { ...prev };
            toolsToUpdate.forEach(t => {
                next[t] = newState;
            });
            // Always save the explicit list to ensure persistence
            const enabledList = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
            void setEnabledToolsOverride(enabledList);
            return next;
        });
    };

    const scrollToSupermemorySettings = () => {
        setShowSupermemoryTooltip(null);
        // Find and scroll to Supermemory settings section
        const supermemorySection = document.querySelector('[data-section="supermemory"]');
        if (supermemorySection) {
            supermemorySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const selectedList = useMemo(() => {
        return Object.entries(enabledMap)
            .filter(([, v]) => v)
            .map(([k]) => k);
    }, [enabledMap]);

    // Filter tools based on search query
    const filteredTools = useMemo(() => {
        if (!toolSearchQuery) return allTools;
        return allTools.filter(t => t.toLowerCase().includes(toolSearchQuery.toLowerCase()));
    }, [allTools, toolSearchQuery]);

    // Group filtered tools by category
    const groupedTools = useMemo(() => {
        const groups: Record<string, string[]> = {};

        filteredTools.forEach(tool => {
            let category = 'Other';
            for (const [cat, tools] of Object.entries(TOOL_CATEGORIES)) {
                if (tools.includes(tool)) {
                    category = cat;
                    break;
                }
            }

            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category]!.push(tool);
        });

        return groups;
    }, [filteredTools]);

    // Auto-expand categories when searching and they contain matching tools
    useEffect(() => {
        if (toolSearchQuery) {
            const newExpanded: Record<string, boolean> = {};
            Object.keys(groupedTools).forEach(category => {
                newExpanded[category] = true;
            });
            setExpandedCategories(newExpanded);
        }
    }, [toolSearchQuery, groupedTools]);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <Wrench size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Enabled Tools
                </h2>
            </div>

            <div className="settings-card" style={{ padding: '12px' }}>
                <div className="settings-input-group" style={{ marginTop: 0, marginBottom: '12px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            className="settings-input"
                            style={{ paddingLeft: 32, width: '100%' }}
                            value={toolSearchQuery}
                            onChange={(e) => setToolSearchQuery(e.target.value)}
                            placeholder="Search tools..."
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(groupedTools).map(([category, tools]) => {
                        const isExpanded = expandedCategories[category] ?? false;
                        const enabledCount = tools.filter(tool => enabledMap[tool] ?? true).length;
                        const totalCount = tools.length;
                        return (
                            <div key={category} style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                backgroundColor: 'var(--bg-tertiary)'
                            }}>
                                <button
                                    onClick={() => toggleCategory(category)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 12px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        transition: 'background-color 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <span>{category}</span>
                                        <span style={{
                                            fontSize: '11px',
                                            color: enabledCount < totalCount ? 'var(--text-warning)' : 'var(--text-tertiary)',
                                            fontWeight: 400
                                        }}>
                                            ({enabledCount}/{totalCount})
                                        </span>
                                    </div>
                                    {isExpanded && (
                                        <div
                                            onClick={(e) => handleToggleCategoryTools(e, tools)}
                                            style={{
                                                fontSize: '10px',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                backgroundColor: enabledCount === totalCount ? 'var(--bg-tertiary)' : 'var(--button-primary-bg)',
                                                color: enabledCount === totalCount ? 'var(--text-secondary)' : 'white',
                                                border: '1px solid var(--border-color)',
                                                fontWeight: 500
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = enabledCount === totalCount ? 'var(--bg-quaternary)' : 'var(--button-primary-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = enabledCount === totalCount ? 'var(--bg-tertiary)' : 'var(--button-primary-bg)'}
                                        >
                                            {enabledCount === totalCount ? 'Disable All' : 'Enable All'}
                                        </div>
                                    )}
                                </button>

                                {isExpanded && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderTop: '1px solid var(--border-color)'
                                    }}>
                                        {tools.map((tool, index) => {
                                            const enabled = enabledMap[tool] ?? true;
                                            const description = TOOL_DESCRIPTIONS[tool];
                                            const isSupermemoryTool = SUPERMEMORY_TOOLS.includes(tool);
                                            const isGated = isSupermemoryTool && !supermemoryConfigured;
                                            const showTooltip = showSupermemoryTooltip === tool;

                                            return (
                                                <div
                                                    key={tool}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '8px 12px',
                                                        backgroundColor: 'var(--bg-tertiary)',
                                                        borderTop: index > 0 ? '1px solid var(--border-color)' : 'none',
                                                        opacity: isGated ? 0.7 : 1
                                                    }}
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        flex: 1
                                                    }}>
                                                        <div style={{
                                                            fontSize: '13px',
                                                            color: 'var(--text-primary)',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            {tool}
                                                        </div>
                                                        {description && !isGated && (
                                                            <div
                                                                style={{
                                                                    position: 'relative',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center'
                                                                }}
                                                                title={description}
                                                            >
                                                                <Info
                                                                    size={14}
                                                                    style={{
                                                                        color: 'var(--text-tertiary)',
                                                                        cursor: 'help'
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        {isGated && (
                                                            <div style={{ position: 'relative' }}>
                                                                <div
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    onClick={() => setShowSupermemoryTooltip(showTooltip ? null : tool)}
                                                                    onMouseEnter={() => setShowSupermemoryTooltip(tool)}
                                                                    onMouseLeave={() => setShowSupermemoryTooltip(null)}
                                                                >
                                                                    <AlertCircle
                                                                        size={14}
                                                                        style={{
                                                                            color: 'var(--text-warning)',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    />
                                                                </div>
                                                                {showTooltip && (
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            bottom: '100%',
                                                                            left: '50%',
                                                                            transform: 'translateX(-50%)',
                                                                            marginBottom: '8px',
                                                                            padding: '12px',
                                                                            backgroundColor: 'var(--bg-primary)',
                                                                            border: '1px solid var(--border-color)',
                                                                            borderRadius: 'var(--radius-md)',
                                                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                                            zIndex: 100,
                                                                            width: '220px',
                                                                            textAlign: 'center'
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <div style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            marginBottom: '8px',
                                                                            gap: '6px'
                                                                        }}>
                                                                            <Supermemory />
                                                                            <span style={{ fontWeight: 600, fontSize: '13px' }}>Supermemory</span>
                                                                        </div>
                                                                        <p style={{
                                                                            fontSize: '12px',
                                                                            color: 'var(--text-secondary)',
                                                                            margin: '0 0 10px 0',
                                                                            lineHeight: '1.4'
                                                                        }}>
                                                                            Configure Supermemory API key in Settings to enable memory tools
                                                                        </p>
                                                                        <button
                                                                            onClick={scrollToSupermemorySettings}
                                                                            style={{
                                                                                padding: '6px 12px',
                                                                                fontSize: '12px',
                                                                                fontWeight: 500,
                                                                                backgroundColor: 'var(--button-primary-bg)',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: 'var(--radius-sm)',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            Go to Settings
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ transform: 'scale(0.85)' }}>
                                                        <Toggle
                                                            checked={enabled}
                                                            onChange={(checked) => handleToggleTool(tool, checked)}
                                                            disabled={isGated && !enabled}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {Object.keys(groupedTools).length === 0 && (
                        <div style={{
                            padding: '24px 12px',
                            textAlign: 'center',
                            color: 'var(--text-tertiary)',
                            fontSize: '13px'
                        }}>
                            No tools found matching "{toolSearchQuery}"
                        </div>
                    )}
                </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                {selectedList.length} of {allTools.length} tools enabled
            </div>
        </div>
    );
};
