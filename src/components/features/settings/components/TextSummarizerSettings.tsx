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
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <FileText size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Text Summarizer
                </h2>
            </div>
            <div className="settings-card">
                {/* Enable/Disable Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Show on Text Selection</div>
                        <div className="settings-item-description">Display summarize button when selecting text on pages</div>
                    </div>
                    <Toggle
                        checked={settings.enabled}
                        onChange={handleToggleEnabled}
                    />
                </div>

                {/* Options Accordion - only show when enabled */}
                {settings.enabled && (
                    <div className="settings-item" style={{ display: 'block', padding: 0 }}>
                        <button
                            className="settings-item-header-button"
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
                                <div className="settings-item-title">Summary Options</div>
                                <div className="settings-item-description">
                                    {getSummaryTypeLabel(settings.summaryType)} • {capitalizeFirst(settings.summaryLength)}
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                {/* Minimum Text Length */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '6px' }}>Minimum Text Length</div>
                                    <select
                                        className="settings-select"
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
                                <div style={{ marginBottom: '12px' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '6px' }}>Summary Type</div>
                                    <select
                                        className="settings-select"
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
                                    <div className="settings-item-title" style={{ marginBottom: '6px' }}>Summary Length</div>
                                    <select
                                        className="settings-select"
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
