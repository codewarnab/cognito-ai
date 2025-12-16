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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/primitives';

const log = createLogger('ResearchWorkflowSettings', 'UI_SETTINGS');

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
                                <Select
                                    value={String(settings.minimumSources)}
                                    onValueChange={(value: string) => handleSettingChange('minimumSources', Number(value))}
                                >
                                    <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                        <SelectValue placeholder="Select minimum sources" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                        <SelectItem value="3" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">3 sources</SelectItem>
                                        <SelectItem value="5" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">5 sources (default)</SelectItem>
                                        <SelectItem value="7" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">7 sources</SelectItem>
                                        <SelectItem value="10" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">10 sources</SelectItem>
                                        <SelectItem value="15" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">15 sources</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Step Count */}
                            <div>
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5" style={{ marginBottom: '6px' }}>Maximum Steps</div>
                                <div className="text-xs text-[var(--text-secondary)]" style={{ marginBottom: '8px' }}>
                                    Maximum number of AI actions allowed during research
                                </div>
                                <Select
                                    value={String(settings.stepCount)}
                                    onValueChange={(value: string) => handleSettingChange('stepCount', Number(value))}
                                >
                                    <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                        <SelectValue placeholder="Select maximum steps" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                        <SelectItem value="15" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">15 steps</SelectItem>
                                        <SelectItem value="20" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">20 steps</SelectItem>
                                        <SelectItem value="30" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">30 steps (default)</SelectItem>
                                        <SelectItem value="50" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">50 steps</SelectItem>
                                        <SelectItem value="75" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">75 steps</SelectItem>
                                        <SelectItem value="100" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">100 steps</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
