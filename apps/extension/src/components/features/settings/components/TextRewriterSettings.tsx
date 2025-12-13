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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/primitives';

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
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <RefreshCw size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Text Rewriter
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Show on Text Selection</div>
                        <div className="text-xs text-[var(--text-secondary)]">Display rewrite tooltip when selecting text on pages</div>
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
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Rewrite Options</div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    Presets: {settings.showPresets ? 'on' : 'off'} • Min: {settings.minSelectionLength} chars
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                {/* Show Presets */}
                                <div className="flex items-center justify-between mb-3" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                    <div className="flex-1 mr-4">
                                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Show Preset Buttons</div>
                                        <div className="text-xs text-[var(--text-secondary)]">Display quick rewrite options (Shorter, Professional, etc.)</div>
                                    </div>
                                    <Toggle
                                        checked={settings.showPresets}
                                        onChange={(v) => handleSettingChange('showPresets', v)}
                                    />
                                </div>

                                {/* Minimum Selection Length */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5" style={{ marginBottom: '6px' }}>Minimum Selection Length</div>
                                    <Select
                                        value={String(settings.minSelectionLength)}
                                        onValueChange={(value: string) => handleSettingChange('minSelectionLength', Number(value))}
                                    >
                                        <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                            <SelectValue placeholder="Select minimum length" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                            <SelectItem value="5" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">5 characters</SelectItem>
                                            <SelectItem value="10" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">10 characters</SelectItem>
                                            <SelectItem value="20" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">20 characters</SelectItem>
                                            <SelectItem value="50" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">50 characters</SelectItem>
                                            <SelectItem value="100" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">100 characters</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                            <div className="text-xs text-[var(--text-secondary)]">Enable real-time web search for up-to-date rewrites</div>
                                        </div>
                                        <Toggle
                                            checked={settings.enableGoogleSearch}
                                            onChange={(v) => handleSettingChange('enableGoogleSearch', v)}
                                        />
                                    </div>

                                    {/* URL Context Tool */}
                                    <div className="flex items-center justify-between" style={{ padding: 0, border: 'none' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">URL Context</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Fetch and analyze content from URLs in the selected text</div>
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
