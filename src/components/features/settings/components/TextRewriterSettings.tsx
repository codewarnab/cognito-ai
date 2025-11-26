import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { createLogger } from '~logger';
import {
    getRewriteSettings,
    saveRewriteSettings,
    DEFAULT_REWRITE_SETTINGS,
    type RewriteSettings as Settings,
} from '@/utils/settings';
import { Toggle } from '@/components/shared/inputs/Toggle';

const log = createLogger('TextRewriterSettings');

export const TextRewriterSettings: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(DEFAULT_REWRITE_SETTINGS);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const loaded = await getRewriteSettings();
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
        await saveRewriteSettings(newSettings);
    };

    const handleSettingChange = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveRewriteSettings(newSettings);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <RefreshCw size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Text Rewriter
                </h2>
            </div>
            <div className="settings-card">
                {/* Enable/Disable Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Show on Text Selection</div>
                        <div className="settings-item-description">Display rewrite tooltip when selecting text on pages</div>
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
                                <div className="settings-item-title">Rewrite Options</div>
                                <div className="settings-item-description">
                                    Presets: {settings.showPresets ? 'on' : 'off'} • Min: {settings.minSelectionLength} chars
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                {/* Show Presets */}
                                <div className="settings-item" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                    <div className="settings-item-content">
                                        <div className="settings-item-title">Show Preset Buttons</div>
                                        <div className="settings-item-description">Display quick rewrite options (Shorter, Professional, etc.)</div>
                                    </div>
                                    <Toggle
                                        checked={settings.showPresets}
                                        onChange={(v) => handleSettingChange('showPresets', v)}
                                    />
                                </div>

                                {/* Minimum Selection Length */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '6px' }}>Minimum Selection Length</div>
                                    <select
                                        className="settings-select"
                                        value={settings.minSelectionLength}
                                        onChange={(e) => handleSettingChange('minSelectionLength', Number(e.target.value))}
                                    >
                                        <option value={5}>5 characters</option>
                                        <option value={10}>10 characters</option>
                                        <option value={20}>20 characters</option>
                                        <option value={50}>50 characters</option>
                                        <option value={100}>100 characters</option>
                                    </select>
                                </div>

                                {/* Gemini Tools Section */}
                                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '8px', opacity: 0.7, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Gemini Tools
                                    </div>

                                    {/* Google Search Tool */}
                                    <div className="settings-item" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="settings-item-content">
                                            <div className="settings-item-title">Google Search</div>
                                            <div className="settings-item-description">Enable real-time web search for up-to-date rewrites</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableGoogleSearch}
                                            onChange={(v) => handleSettingChange('enableGoogleSearch', v)}
                                        />
                                    </div>

                                    {/* URL Context Tool */}
                                    <div className="settings-item" style={{ padding: 0, border: 'none' }}>
                                        <div className="settings-item-content">
                                            <div className="settings-item-title">URL Context</div>
                                            <div className="settings-item-description">Fetch and analyze content from URLs in the selected text</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableUrlContext}
                                            onChange={(v) => handleSettingChange('enableUrlContext', v)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
