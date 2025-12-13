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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/primitives';

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
                                    <Select
                                        value={String(settings.minTextLength)}
                                        onValueChange={(value: string) => handleSettingChange('minTextLength', Number(value))}
                                    >
                                        <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                            <SelectValue placeholder="Select minimum length" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                            <SelectItem value="50" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">50 characters</SelectItem>
                                            <SelectItem value="100" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">100 characters</SelectItem>
                                            <SelectItem value="200" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">200 characters</SelectItem>
                                            <SelectItem value="300" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">300 characters</SelectItem>
                                            <SelectItem value="500" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">500 characters</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Summary Type */}
                                <div className="mb-3">
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5">Summary Type</div>
                                    <Select
                                        value={settings.summaryType}
                                        onValueChange={(value: Settings['summaryType']) => handleSettingChange('summaryType', value)}
                                    >
                                        <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                            <SelectValue placeholder="Select summary type" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                            <SelectItem value="tl-dr" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">TL;DR - Quick summary in 2-3 sentences</SelectItem>
                                            <SelectItem value="key-points" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Key Points - Bulleted list of main ideas</SelectItem>
                                            <SelectItem value="headline" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Headline - Single line capture</SelectItem>
                                            <SelectItem value="teaser" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Teaser - Engaging preview</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Summary Length */}
                                <div>
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5">Summary Length</div>
                                    <Select
                                        value={settings.summaryLength}
                                        onValueChange={(value: Settings['summaryLength']) => handleSettingChange('summaryLength', value)}
                                    >
                                        <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                            <SelectValue placeholder="Select summary length" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                            <SelectItem value="short" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Short (~100 tokens)</SelectItem>
                                            <SelectItem value="medium" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Medium (~250 tokens)</SelectItem>
                                            <SelectItem value="long" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Long (~500 tokens)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
