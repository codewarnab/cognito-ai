import React, { useEffect, useMemo, useState } from 'react';
import { Wrench, Search } from 'lucide-react';
import { createLogger } from '~logger';
import { DEFAULT_ENABLED_TOOLS } from '../../../../ai/tools/enabledTools';
import { getEnabledToolsOverride, setEnabledToolsOverride } from '../../../../utils/settingsStorage';
import { Toggle } from '../../../shared/inputs/Toggle';

const log = createLogger('EnabledToolsSettings');

// Tool categories for better organization
const TOOL_CATEGORIES: Record<string, string[]> = {
    'Navigation': ['navigateTo', 'switchTabs', 'getActiveTab', 'getAllTabs', 'applyTabGroups', 'ungroupTabs', 'organizeTabsByContext'],
    'Content': ['takeScreenshot', 'readPageContent', 'extractText', 'findSearchBar'],
    'Interaction': ['typeInField', 'clickByText', 'pressKey', 'focusElement', 'scrollTo'],
    'Search & History': ['chromeSearch', 'getSearchResults', 'openSearchResult', 'searchHistory', 'getUrlVisits'],
    'Memory & Reminders': ['saveMemory', 'getMemory', 'listMemories', 'deleteMemory', 'suggestSaveMemory', 'createReminder', 'listReminders', 'cancelReminder'],
    'Other': ['analyzeYouTubeVideo', 'generateMarkdown', 'generatePDF', 'getReportTemplate']
};

export const EnabledToolsSettings: React.FC = () => {
    const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
    const [toolSearchQuery, setToolSearchQuery] = useState('');
    const allTools = useMemo(() => DEFAULT_ENABLED_TOOLS, []);

    useEffect(() => {
        const loadTools = async () => {
            try {
                const override = await getEnabledToolsOverride();
                const initialMap: Record<string, boolean> = {};
                if (override && Array.isArray(override)) {
                    const set = new Set(override);
                    allTools.forEach(t => {
                        initialMap[t] = set.has(t);
                    });
                } else {
                    allTools.forEach(t => {
                        initialMap[t] = true;
                    });
                }
                setEnabledMap(initialMap);
            } catch (err) {
                log.error('Failed to load enabled tools', err);
                const initialMap: Record<string, boolean> = {};
                allTools.forEach(t => {
                    initialMap[t] = true;
                });
                setEnabledMap(initialMap);
            }
        };
        loadTools();
    }, [allTools]);

    const handleToggleTool = async (tool: string, checked: boolean) => {
        setEnabledMap(prev => {
            const next = { ...prev, [tool]: checked };
            void setEnabledToolsOverride(Object.values(next).every(v => v) ? undefined : Object.entries(next).filter(([, v]) => v).map(([k]) => k));
            return next;
        });
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
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            className="settings-input"
                            style={{ paddingLeft: 32 }}
                            value={toolSearchQuery}
                            onChange={(e) => setToolSearchQuery(e.target.value)}
                            placeholder="Search tools..."
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {Object.entries(groupedTools).map(([category, tools]) => (
                        <div key={category}>
                            <h3 style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                marginBottom: '8px',
                                paddingLeft: '4px'
                            }}>
                                {category}
                            </h3>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1px',
                                backgroundColor: 'var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden'
                            }}>
                                {tools.map(tool => {
                                    const enabled = enabledMap[tool] ?? true;
                                    return (
                                        <div key={tool} className="settings-item" style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: 'none' }}>
                                            <div className="settings-item-content">
                                                <div className="settings-item-title">{tool}</div>
                                            </div>
                                            <Toggle
                                                checked={enabled}
                                                onChange={(checked) => handleToggleTool(tool, checked)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {Object.keys(groupedTools).length === 0 && (
                        <div className="empty-state">No tools found matching "{toolSearchQuery}"</div>
                    )}
                </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                {selectedList.length} of {allTools.length} tools enabled
            </div>
        </div>
    );
};
