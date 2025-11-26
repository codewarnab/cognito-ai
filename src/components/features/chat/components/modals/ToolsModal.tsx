import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Search, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { createLogger } from '~logger';
import { DEFAULT_ENABLED_TOOLS, TOOLS_DISABLED_BY_DEFAULT } from '@/ai/tools/enabledTools';
import { getEnabledToolsOverride, setEnabledToolsOverride } from '~utils/settingsStorage';
import { Toggle } from '@/components/shared/inputs/Toggle';
import { TOOL_CATEGORIES } from '@/constants/toolDescriptions';
import { motion, AnimatePresence } from 'framer-motion';

const log = createLogger('ToolsPopover');

interface ToolsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ToolsModal: React.FC<ToolsPopoverProps> = ({ isOpen, onClose }) => {
    const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
    const [toolSearchQuery, setToolSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [showInfoTooltip, setShowInfoTooltip] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const allTools = useMemo(() => DEFAULT_ENABLED_TOOLS, []);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        // Delay to prevent immediate close
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Hide voice FAB when popover is open
    useEffect(() => {
        const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            if (isOpen) {
                voiceFab.style.visibility = 'hidden';
            } else {
                voiceFab.style.visibility = '';
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            loadTools();
        }
    }, [isOpen]);

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
                allTools.forEach(t => {
                    initialMap[t] = !disabledByDefaultSet.has(t);
                });
            }
            setEnabledMap(initialMap);
        } catch (err) {
            log.error('Failed to load enabled tools', err);
        }
    };

    const handleToggleTool = async (tool: string, checked: boolean) => {
        setEnabledMap(prev => {
            const next = { ...prev, [tool]: checked };
            void setEnabledToolsOverride(Object.values(next).every(v => v) ? undefined : Object.entries(next).filter(([, v]) => v).map(([k]) => k));
            return next;
        });
    };

    const handleToggleCategory = (e: React.MouseEvent, _category: string, tools: string[]) => {
        e.stopPropagation();
        const allEnabled = tools.every(t => enabledMap[t] ?? true);
        const newState = !allEnabled;

        setEnabledMap(prev => {
            const next = { ...prev };
            tools.forEach(t => {
                next[t] = newState;
            });
            void setEnabledToolsOverride(Object.values(next).every(v => v) ? undefined : Object.entries(next).filter(([, v]) => v).map(([k]) => k));
            return next;
        });
    };

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

    // Auto-expand categories when searching
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

    const enabledCount = Object.values(enabledMap).filter(v => v).length;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="tools-popover"
                >
                    {/* Arrow pointer */}
                    <div className="tools-popover-arrow" />

                    {/* Search */}
                    <div className="tools-popover-search">
                        <Search size={12} className="tools-popover-search-icon" />
                        <input
                            className="tools-popover-search-input"
                            value={toolSearchQuery}
                            onChange={(e) => setToolSearchQuery(e.target.value)}
                            placeholder="Search tools..."
                            autoFocus
                        />
                    </div>

                    {/* Content */}
                    <div className="tools-popover-content">
                        {Object.entries(groupedTools).map(([category, tools]) => {
                            const isExpanded = expandedCategories[category] ?? false;
                            const catEnabledCount = tools.filter(tool => enabledMap[tool] ?? true).length;
                            const totalCount = tools.length;
                            const allOn = catEnabledCount === totalCount;

                            return (
                                <div key={category} className="tools-popover-category">
                                    <div
                                        onClick={() => toggleCategory(category)}
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
                                            onClick={(e) => handleToggleCategory(e, category, tools)}
                                            className={`tools-popover-toggle-btn ${allOn ? 'all-on' : 'all-off'}`}
                                        >
                                            {allOn ? 'All on' : 'All off'}
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
                                                        const enabled = enabledMap[tool] ?? true;

                                                        return (
                                                            <div key={tool} className="tools-popover-tool">
                                                                <span className="tools-popover-tool-name" title={tool}>
                                                                    {tool}
                                                                </span>
                                                                <Toggle
                                                                    checked={enabled}
                                                                    onChange={(checked) => handleToggleTool(tool, checked)}
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
                        })}

                        {Object.keys(groupedTools).length === 0 && (
                            <div className="tools-popover-empty">
                                No tools found
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="tools-popover-footer">
                        <span>{enabledCount} of {allTools.length} enabled</span>
                        <div className="tools-popover-info-wrapper">
                            <button
                                className="tools-popover-info-btn"
                                onMouseEnter={() => setShowInfoTooltip(true)}
                                onMouseLeave={() => setShowInfoTooltip(false)}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Info size={12} />
                            </button>
                            <AnimatePresence>
                                {showInfoTooltip && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        transition={{ duration: 0.15 }}
                                        className="tools-popover-tooltip"
                                    >
                                        <strong>Active Tools</strong>
                                        <p>Tools are capabilities the AI can use to help you. Fewer enabled tools = faster, more focused responses.</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
