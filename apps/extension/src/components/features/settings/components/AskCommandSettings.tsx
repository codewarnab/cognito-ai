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
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <MessageCircleQuestion size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Ask Command
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Enable /ask Command</div>
                        <div className="text-xs text-[var(--text-secondary)]">Type /ask in any text field to ask AI questions</div>
                    </div>
                    <Toggle
                        checked={settings.enabled}
                        onChange={handleToggleEnabled}
                    />
                </div>

                {/* Options Accordion - only show when enabled */}
                {settings.enabled && (
                    <div className="block p-0" style={{ display: 'block', padding: 0 }}>
                        <button
                            type="button"
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
                                color: 'inherit',
                            }}
                        >
                            <div style={{ textAlign: 'left' }}>
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Ask Options</div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    Context: {getContextSummary()} • Max tokens: {settings.maxOutputTokens}
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                {/* Context Settings Section */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div className="text-[12px] font-medium text-[var(--text-primary)] opacity-70 mb-2 uppercase tracking-wide" style={{ marginBottom: '8px', opacity: 0.7, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Context Options
                                    </div>

                                    {/* Include Page Context */}
                                    <div className="flex items-center justify-between mb-3" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Include Page Context</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Send page title, URL, and domain with questions</div>
                                        </div>
                                        <Toggle
                                            checked={settings.includePageContext}
                                            onChange={(v) => handleSettingChange('includePageContext', v)}
                                        />
                                    </div>

                                    {/* Include Selected Text */}
                                    <div className="flex items-center justify-between mb-3" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Include Selected Text</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Use highlighted text on the page as context</div>
                                        </div>
                                        <Toggle
                                            checked={settings.includeSelectedText}
                                            onChange={(v) => handleSettingChange('includeSelectedText', v)}
                                        />
                                    </div>

                                    {/* Include Visible Content */}
                                    <div className="flex items-center justify-between mb-3" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Include Page Content</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Extract visible page text to help answer questions</div>
                                        </div>
                                        <Toggle
                                            checked={settings.includeVisibleContent}
                                            onChange={(v) => handleSettingChange('includeVisibleContent', v)}
                                        />
                                    </div>
                                </div>

                                {/* Max Output Tokens */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5" style={{ marginBottom: '6px' }}>Max Output Length</div>
                                    <select
                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-2.5 text-[var(--text-primary)] text-sm cursor-pointer focus:outline-none focus:border-[var(--color-secondary)]"
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
                                    <div className="text-[12px] font-medium text-[var(--text-primary)] opacity-70 mb-2 uppercase tracking-wide" style={{ marginBottom: '8px', opacity: 0.7, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Gemini Tools
                                    </div>

                                    {/* Google Search Tool */}
                                    <div className="flex items-center justify-between mb-3" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Google Search</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Enable real-time web search for up-to-date information</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableGoogleSearch}
                                            onChange={(v) => handleSettingChange('enableGoogleSearch', v)}
                                        />
                                    </div>

                                    {/* URL Context Tool */}
                                    <div className="flex items-center justify-between mb-3" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">URL Context</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Fetch and analyze content from URLs mentioned in prompts</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableUrlContext}
                                            onChange={(v) => handleSettingChange('enableUrlContext', v)}
                                        />
                                    </div>

                                    {/* Supermemory Search Tool */}
                                    <div className="flex items-center justify-between" style={{ padding: 0, border: 'none' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Memory Search</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Search your Supermemory knowledge base for answers</div>
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
