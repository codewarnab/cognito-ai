import React, { useState, useEffect } from 'react';
import { FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { createLogger } from '~logger';
import {
    getTextSummarizerSettings,
    saveTextSummarizerSettings,
    DEFAULT_SUMMARIZER_SETTINGS,
    type TextSummarizerSettings as Settings,
} from '@/utils/settings';
import { Toggle } from '@/components/shared/inputs/Toggle';

const log = createLogger('TextSummarizerSettings');

export const TextSummarizerSettings: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SUMMARIZER_SETTINGS);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const loaded = await getTextSummarizerSettings();
                setSettings(loaded);
            } catch (err) {
                log.error('Failed to load settings', err);
            }
        };
        loadSettings();
    }, []);

    const handleToggleEnabled = async (checked: boolean) => {
        const newSettings = { ...settings, enabled: checked };
        setSettings(newSettings);
        await saveTextSummarizerSettings(newSettings);
    };

    const handleSettingChange = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveTextSummarizerSettings(newSettings);
    };

    const getSummaryTypeLabel = (type: Settings['summaryType']): string => {
        switch (type) {
            case 'tl-dr': return 'TL;DR';
            case 'key-points': return 'Key Points';
            case 'headline': return 'Headline';
            case 'teaser': return 'Teaser';
            default: return type;
        }
    };

    const capitalizeFirst = (str: string): string => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <FileText size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Text Summarizer
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Show on Text Selection</div>
                        <div className="text-xs text-[var(--text-secondary)]">Display summarize button when selecting text on pages</div>
                    </div>
                    <Toggle
                        checked={settings.enabled}
                        onChange={handleToggleEnabled}
                    />
                </div>

                {/* Options Accordion - only show when enabled */}
                {settings.enabled && (
                    <div className="block p-0">
                        <button
                            className="w-full flex justify-between items-center p-3 bg-transparent border-none cursor-pointer text-inherit transition-colors hover:bg-white/5"
                            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                        >
                            <div className="text-left">
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Summary Options</div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    {getSummaryTypeLabel(settings.summaryType)} • {capitalizeFirst(settings.summaryLength)}
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div className="p-3 border-t border-[var(--border-color)]">
                                {/* Minimum Text Length */}
                                <div className="mb-3">
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5">Minimum Text Length</div>
                                    <select
                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm cursor-pointer focus:outline-none focus:border-[var(--color-secondary)]"
                                        value={settings.minTextLength}
                                        onChange={(e) => handleSettingChange('minTextLength', Number(e.target.value))}
                                    >
                                        <option value={50}>50 characters</option>
                                        <option value={100}>100 characters</option>
                                        <option value={200}>200 characters</option>
                                        <option value={300}>300 characters</option>
                                        <option value={500}>500 characters</option>
                                    </select>
                                </div>

                                {/* Summary Type */}
                                <div className="mb-3">
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5">Summary Type</div>
                                    <select
                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm cursor-pointer focus:outline-none focus:border-[var(--color-secondary)]"
                                        value={settings.summaryType}
                                        onChange={(e) => handleSettingChange('summaryType', e.target.value as Settings['summaryType'])}
                                    >
                                        <option value="tl-dr">TL;DR - Quick summary in 2-3 sentences</option>
                                        <option value="key-points">Key Points - Bulleted list of main ideas</option>
                                        <option value="headline">Headline - Single line capture</option>
                                        <option value="teaser">Teaser - Engaging preview</option>
                                    </select>
                                </div>

                                {/* Summary Length */}
                                <div>
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5">Summary Length</div>
                                    <select
                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm cursor-pointer focus:outline-none focus:border-[var(--color-secondary)]"
                                        value={settings.summaryLength}
                                        onChange={(e) => handleSettingChange('summaryLength', e.target.value as Settings['summaryLength'])}
                                    >
                                        <option value="short">Short (~100 tokens)</option>
                                        <option value="medium">Medium (~250 tokens)</option>
                                        <option value="long">Long (~500 tokens)</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
