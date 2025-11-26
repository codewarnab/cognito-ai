import React, { useState, useEffect } from 'react';
import { PenLine, ChevronUp, ChevronDown } from 'lucide-react';
import { createLogger } from '~logger';
import {
    getWriteCommandSettings,
    saveWriteCommandSettings,
    DEFAULT_WRITE_SETTINGS,
    type WriteCommandSettings as Settings,
} from '@/utils/settings';
import { Toggle } from '@/components/shared/inputs/Toggle';

const log = createLogger('WriteCommandSettings');

export const WriteCommandSettings: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(DEFAULT_WRITE_SETTINGS);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const loaded = await getWriteCommandSettings();
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
        await saveWriteCommandSettings(newSettings);
    };

    const handleSettingChange = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveWriteCommandSettings(newSettings);
    };

    const capitalizeFirst = (str: string): string => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <PenLine size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Write Command
                </h2>
            </div>
            <div className="settings-card">
                {/* Enable/Disable Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Enable /write Command</div>
                        <div className="settings-item-description">Type /write in any text field to generate AI content</div>
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
                                <div className="settings-item-title">Writing Options</div>
                                <div className="settings-item-description">
                                    Tone: {capitalizeFirst(settings.defaultTone)} • Context: {settings.includePageContext ? 'on' : 'off'}
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                {/* Default Tone */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '6px' }}>Default Tone</div>
                                    <select
                                        className="settings-select"
                                        value={settings.defaultTone}
                                        onChange={(e) => handleSettingChange('defaultTone', e.target.value as Settings['defaultTone'])}
                                    >
                                        <option value="professional">Professional - Clear and business-appropriate</option>
                                        <option value="casual">Casual - Relaxed and conversational</option>
                                        <option value="formal">Formal - Structured and official</option>
                                        <option value="friendly">Friendly - Warm and approachable</option>
                                    </select>
                                </div>

                                {/* Max Output Tokens */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '6px' }}>Max Output Length</div>
                                    <select
                                        className="settings-select"
                                        value={settings.maxOutputTokens}
                                        onChange={(e) => handleSettingChange('maxOutputTokens', Number(e.target.value))}
                                    >
                                        <option value={256}>Short (~256 tokens)</option>
                                        <option value={512}>Medium (~512 tokens)</option>
                                        <option value={1024}>Long (~1024 tokens)</option>
                                        <option value={2048}>Extended (~2048 tokens)</option>
                                    </select>
                                </div>

                                {/* Include Page Context */}
                                <div className="settings-item" style={{ padding: 0, border: 'none' }}>
                                    <div className="settings-item-content">
                                        <div className="settings-item-title">Include Page Context</div>
                                        <div className="settings-item-description">Use page title and URL to improve AI suggestions</div>
                                    </div>
                                    <Toggle
                                        checked={settings.includePageContext}
                                        onChange={(v) => handleSettingChange('includePageContext', v)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
