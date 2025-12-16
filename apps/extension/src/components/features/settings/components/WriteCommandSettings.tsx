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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/primitives';

const log = createLogger('WriteCommandSettings', 'UI_SETTINGS');

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
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <PenLine size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Write Command
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Enable /write Command</div>
                        <div className="text-xs text-[var(--text-secondary)]">Type /write in any text field to generate AI content</div>
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
                                <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Writing Options</div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    Tone: {capitalizeFirst(settings.defaultTone)} • Context: {settings.includePageContext ? 'on' : 'off'}
                                </div>
                            </div>
                            {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isOptionsOpen && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ marginBottom: '12px' }}>
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5" style={{ marginBottom: '6px' }}>Default Tone</div>
                                    <Select
                                        value={settings.defaultTone}
                                        onValueChange={(value: Settings['defaultTone']) => handleSettingChange('defaultTone', value)}
                                    >
                                        <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                            <SelectValue placeholder="Select tone" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                            <SelectItem value="professional" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Professional - Clear and business-appropriate</SelectItem>
                                            <SelectItem value="casual" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Casual - Relaxed and conversational</SelectItem>
                                            <SelectItem value="formal" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Formal - Structured and official</SelectItem>
                                            <SelectItem value="friendly" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Friendly - Warm and approachable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                    <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5" style={{ marginBottom: '6px' }}>Max Output Length</div>
                                    <Select
                                        value={String(settings.maxOutputTokens)}
                                        onValueChange={(value: string) => handleSettingChange('maxOutputTokens', Number(value))}
                                    >
                                        <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                            <SelectValue placeholder="Select max length" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                            <SelectItem value="256" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Short (~256 tokens)</SelectItem>
                                            <SelectItem value="512" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Medium (~512 tokens)</SelectItem>
                                            <SelectItem value="1024" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Long (~1024 tokens)</SelectItem>
                                            <SelectItem value="2048" className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]">Extended (~2048 tokens)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Include Page Context */}
                                <div className="flex items-center justify-between mb-3" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
                                    <div className="flex-1 mr-4">
                                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Include Page Context</div>
                                        <div className="text-xs text-[var(--text-secondary)]">Use page title and URL to improve AI suggestions</div>
                                    </div>
                                    <Toggle
                                        checked={settings.includePageContext}
                                        onChange={(v) => handleSettingChange('includePageContext', v)}
                                    />
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
                                    <div className="flex items-center justify-between" style={{ padding: 0, border: 'none' }}>
                                        <div className="flex-1 mr-4">
                                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">URL Context</div>
                                            <div className="text-xs text-[var(--text-secondary)]">Fetch and analyze content from URLs mentioned in prompts</div>
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
