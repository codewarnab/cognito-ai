import React, { useState, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import { createLogger } from '~logger';
import {
    getResearchWorkflowSettings,
    saveResearchWorkflowSettings,
    DEFAULT_RESEARCH_WORKFLOW_SETTINGS,
    type ResearchWorkflowSettings as Settings,
} from '@/utils/settings';
import { registerWorkflow } from '@/workflows/registry';
import { createResearchWorkflow } from '@/workflows/definitions/researchWorkflow';

const log = createLogger('ResearchWorkflowSettings');

export const ResearchWorkflowSettings: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(DEFAULT_RESEARCH_WORKFLOW_SETTINGS);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const loaded = await getResearchWorkflowSettings();
                setSettings(loaded);
            } catch (err) {
                log.error('Failed to load settings', err);
            }
        };
        loadSettings();
    }, []);

    const handleSettingChange = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveResearchWorkflowSettings(newSettings);

        // Re-register the workflow with updated settings so changes take effect immediately
        const updatedWorkflow = createResearchWorkflow(newSettings);
        registerWorkflow(updatedWorkflow);
        log.info('Research workflow re-registered with new settings', {
            minimumSources: newSettings.minimumSources,
            stepCount: newSettings.stepCount
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <Search size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Research Workflow
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                {/* Options Accordion */}
                <div className="block p-0" style={{ display: 'block', padding: 0 }}>
                    <button
                        className="w-full flex justify-between items-center p-3 bg-transparent border-none cursor-pointer text-inherit transition-colors hover:bg-white/5"
                        onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'inherit'
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Research Configuration</div>
                            <div className="text-xs text-[var(--text-secondary)]">
                                Min {settings.minimumSources} sources • Max {settings.stepCount} steps
                            </div>
                        </div>
                        {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isOptionsOpen && (
                        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                            {/* Minimum Sources */}
                            <div style={{ marginBottom: '12px' }}>
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5" style={{ marginBottom: '6px' }}>Minimum Sources</div>
                                <div className="text-xs text-[var(--text-secondary)]" style={{ marginBottom: '8px' }}>
                                    Number of sources the AI must visit before completing research
                                </div>
                                <select
                                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm cursor-pointer focus:outline-none focus:border-[var(--color-secondary)]"
                                    value={settings.minimumSources}
                                    onChange={(e) => handleSettingChange('minimumSources', Number(e.target.value))}
                                >
                                    <option value={3}>3 sources</option>
                                    <option value={5}>5 sources (default)</option>
                                    <option value={7}>7 sources</option>
                                    <option value={10}>10 sources</option>
                                    <option value={15}>15 sources</option>
                                </select>
                            </div>

                            {/* Step Count */}
                            <div>
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5" style={{ marginBottom: '6px' }}>Maximum Steps</div>
                                <div className="text-xs text-[var(--text-secondary)]" style={{ marginBottom: '8px' }}>
                                    Maximum number of AI actions allowed during research
                                </div>
                                <select
                                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm cursor-pointer focus:outline-none focus:border-[var(--color-secondary)]"
                                    value={settings.stepCount}
                                    onChange={(e) => handleSettingChange('stepCount', Number(e.target.value))}
                                >
                                    <option value={15}>15 steps</option>
                                    <option value={20}>20 steps</option>
                                    <option value={30}>30 steps (default)</option>
                                    <option value={50}>50 steps</option>
                                    <option value={75}>75 steps</option>
                                    <option value={100}>100 steps</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
