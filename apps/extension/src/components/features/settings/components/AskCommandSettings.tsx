/**
 * Ask Command Settings Component
 * Settings panel for /ask slash command feature
 */
import React, { useState, useEffect } from 'react';
import { MessageCircleQuestion, ChevronUp, ChevronDown } from 'lucide-react';
import { createLogger } from '~logger';
import {
    getAskCommandSettings,
    saveAskCommandSettings,
    DEFAULT_ASK_SETTINGS,
    type AskCommandSettings as Settings,
} from '@/utils/settings';
import { Toggle } from '@/components/shared/inputs/Toggle';

const log = createLogger('AskCommandSettings');

export const AskCommandSettings: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(DEFAULT_ASK_SETTINGS);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const loaded = await getAskCommandSettings();
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
        await saveAskCommandSettings(newSettings);
    };

    const handleSettingChange = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveAskCommandSettings(newSettings);
    };

    const getContextSummary = (): string => {
        const parts: string[] = [];
        if (settings.includePageContext) parts.push('Page');
        if (settings.includeSelectedText) parts.push('Selection');
        if (settings.includeVisibleContent) parts.push('Content');
        return parts.length > 0 ? parts.join(', ') : 'None';
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <MessageCircleQuestion size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Ask Command
                </h2>
            </div>
            <div className="settings-card">
                {/* Enable/Disable Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Enable /ask Command</div>
                        <div className="settings-item-description">Type /ask in any text field to ask AI questions</div>
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
                            type="button"
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
                                color: 'inherit',
                            }}
                        >
                            <div style={{ textAlign: 'left' }}>
                                <div className="settings-item-title">Ask Options</div>
                                <div className="settings-item-description">
                                    Context: {getContextSummary()} • Max tokens: {settings.maxOutputTokens}
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                {/* Context Settings Section */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '8px', opacity: 0.7, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Context Options
                                    </div>

                                    {/* Include Page Context */}
                                    <div className="settings-item" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="settings-item-content">
                                            <div className="settings-item-title">Include Page Context</div>
                                            <div className="settings-item-description">Send page title, URL, and domain with questions</div>
                                        </div>
                                        <Toggle
                                            checked={settings.includePageContext}
                                            onChange={(v) => handleSettingChange('includePageContext', v)}
                                        />
                                    </div>

                                    {/* Include Selected Text */}
                                    <div className="settings-item" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="settings-item-content">
                                            <div className="settings-item-title">Include Selected Text</div>
                                            <div className="settings-item-description">Use highlighted text on the page as context</div>
                                        </div>
                                        <Toggle
                                            checked={settings.includeSelectedText}
                                            onChange={(v) => handleSettingChange('includeSelectedText', v)}
                                        />
                                    </div>

                                    {/* Include Visible Content */}
                                    <div className="settings-item" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="settings-item-content">
                                            <div className="settings-item-title">Include Page Content</div>
                                            <div className="settings-item-description">Extract visible page text to help answer questions</div>
                                        </div>
                                        <Toggle
                                            checked={settings.includeVisibleContent}
                                            onChange={(v) => handleSettingChange('includeVisibleContent', v)}
                                        />
                                    </div>
                                </div>

                                {/* Max Output Tokens */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div className="settings-item-title" style={{ marginBottom: '6px' }}>Max Output Length</div>
                                    <select
                                        className="settings-select"
                                        value={settings.maxOutputTokens}
                                        onChange={(e) => handleSettingChange('maxOutputTokens', Number(e.target.value))}
                                    >
                                        <option value={512}>Short (~512 tokens)</option>
                                        <option value={1024}>Medium (~1024 tokens)</option>
                                        <option value={2048}>Long (~2048 tokens)</option>
                                        <option value={4096}>Extended (~4096 tokens)</option>
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
                                            <div className="settings-item-description">Enable real-time web search for up-to-date information</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableGoogleSearch}
                                            onChange={(v) => handleSettingChange('enableGoogleSearch', v)}
                                        />
                                    </div>

                                    {/* URL Context Tool */}
                                    <div className="settings-item" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="settings-item-content">
                                            <div className="settings-item-title">URL Context</div>
                                            <div className="settings-item-description">Fetch and analyze content from URLs mentioned in prompts</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableUrlContext}
                                            onChange={(v) => handleSettingChange('enableUrlContext', v)}
                                        />
                                    </div>

                                    {/* Supermemory Search Tool */}
                                    <div className="settings-item" style={{ padding: 0, border: 'none' }}>
                                        <div className="settings-item-content">
                                            <div className="settings-item-title">Memory Search</div>
                                            <div className="settings-item-description">Search your Supermemory knowledge base for answers</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableSupermemorySearch}
                                            onChange={(v) => handleSettingChange('enableSupermemorySearch', v)}
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
