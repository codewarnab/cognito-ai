import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { createLogger } from '~logger';
import { Toggle } from '@/components/shared/inputs/Toggle';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/primitives';
import {
    getSupermemoryApiKey,
    setSupermemoryApiKey,
    clearSupermemoryApiKey,
    isSupermemoryEnabled,
    setSupermemoryEnabled,
    validateSupermemoryApiKeyFormat,
    isAutoExtractionEnabled,
    setAutoExtractionEnabled,
    isContentMemoryEnabled,
    setContentMemoryEnabled,
} from '@/utils/supermemory';
import { Supermemory } from '@assets/brands/integrations/Supermemory';

const log = createLogger('SupermemorySettings', 'UI_SETTINGS');

const SUPERMEMORY_CONSOLE_URL = 'https://console.supermemory.ai/keys';

const AUTO_EXTRACTION_TOOLTIP = `When enabled, Cognito analyzes your conversations after you leave a chat and automatically extracts useful information like:

• Your preferences and working style
• Facts about projects you're working on
• Tools and technologies you use
• Searches and topics you're interested in
• Instructions you've given the AI

This information is securely saved to your Supermemory and helps Cognito provide more personalized assistance in future conversations.

Processing happens in the background and won't slow down your experience.`;

const CONTENT_MEMORY_TOOLTIP = `When enabled, Cognito learns from your interactions with content features:

• Summarizer: Learns what topics and content you read and research
• Writer: Learns what topics you write about and your writing contexts
• Rewriter: Learns your preferred writing styles and common transformations

Examples of insights captured:
- "User frequently researches React performance optimization"
- "User writes professional emails on Gmail"
- "User prefers concise, simplified writing"

Processing happens in the background and won't slow down these features.`;

type ConnectionStatus = 'not-configured' | 'connected' | 'invalid';

export const SupermemorySettings: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [status, setStatus] = useState<ConnectionStatus>('not-configured');
    const [isSaving, setIsSaving] = useState(false);
    const [autoExtraction, setAutoExtraction] = useState(false);
    const [contentMemory, setContentMemory] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [storedKey, storedEnabled, storedAutoExtraction, storedContentMemory] = await Promise.all([
                    getSupermemoryApiKey(),
                    isSupermemoryEnabled(),
                    isAutoExtractionEnabled(),
                    isContentMemoryEnabled(),
                ]);

                if (storedKey) {
                    setApiKey(storedKey);
                    setStatus(validateSupermemoryApiKeyFormat(storedKey) ? 'connected' : 'invalid');
                }
                setEnabled(storedEnabled);
                setAutoExtraction(storedAutoExtraction);
                setContentMemory(storedContentMemory);
            } catch (err) {
                log.error('Failed to load Supermemory settings', err);
            }
        };
        loadSettings();
    }, []);

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setApiKey(value);

        // Update status based on input
        if (!value.trim()) {
            setStatus('not-configured');
        } else if (validateSupermemoryApiKeyFormat(value)) {
            setStatus('connected');
        } else {
            setStatus('invalid');
        }
    };

    const handleApiKeyBlur = async () => {
        const trimmedKey = apiKey.trim();

        if (!trimmedKey) {
            // Clear the API key if empty
            try {
                await clearSupermemoryApiKey();
                setStatus('not-configured');
                // Disable Supermemory if no API key
                if (enabled) {
                    setEnabled(false);
                    await setSupermemoryEnabled(false);
                }
                log.info('Supermemory API key cleared');
            } catch (err) {
                log.error('Failed to clear Supermemory API key', err);
            }
            return;
        }

        if (!validateSupermemoryApiKeyFormat(trimmedKey)) {
            setStatus('invalid');
            return;
        }

        setIsSaving(true);
        try {
            await setSupermemoryApiKey(trimmedKey);
            setStatus('connected');
            log.info('Supermemory API key saved');
        } catch (err) {
            log.error('Failed to save Supermemory API key', err);
            setStatus('invalid');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnabledChange = async (checked: boolean) => {
        // Can only enable if we have a valid API key
        if (checked && status !== 'connected') {
            return;
        }

        setEnabled(checked);
        try {
            await setSupermemoryEnabled(checked);
            log.info('Supermemory enabled state changed', { enabled: checked });

            if (!checked) {
                // Disable auto-extraction and content memory if Supermemory is disabled
                if (autoExtraction) {
                    setAutoExtraction(false);
                    await setAutoExtractionEnabled(false);
                }
                if (contentMemory) {
                    setContentMemory(false);
                    await setContentMemoryEnabled(false);
                }
            } else {
                // Enable toggles by default when memory is enabled
                if (!autoExtraction) {
                    setAutoExtraction(true);
                    await setAutoExtractionEnabled(true);
                }
                if (!contentMemory) {
                    setContentMemory(true);
                    await setContentMemoryEnabled(true);
                }
            }
        } catch (err) {
            log.error('Failed to update Supermemory enabled state', err);
            // Revert on error
            setEnabled(!checked);
        }
    };

    const handleAutoExtractionChange = async (checked: boolean) => {
        // Can only enable if Supermemory is enabled and connected
        if (checked && (!enabled || status !== 'connected')) {
            return;
        }

        const previousValue = autoExtraction;
        setAutoExtraction(checked);
        try {
            await setAutoExtractionEnabled(checked);
            log.info('Auto-extraction enabled state changed', { enabled: checked });
        } catch (err) {
            log.error('Failed to update auto-extraction enabled state', err);
            // Revert on error
            setAutoExtraction(previousValue);
        }
    };

    const handleContentMemoryChange = async (checked: boolean) => {
        // Can only enable if Supermemory is enabled and connected
        if (checked && (!enabled || status !== 'connected')) {
            return;
        }

        const previousValue = contentMemory;
        setContentMemory(checked);
        try {
            await setContentMemoryEnabled(checked);
            log.info('Content memory enabled state changed', { enabled: checked });
        } catch (err) {
            log.error('Failed to update content memory enabled state', err);
            // Revert on error
            setContentMemory(previousValue);
        }
    };

    const getStatusDisplay = () => {
        switch (status) {
            case 'connected':
                return (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-success)',
                        fontSize: '12px'
                    }}>
                        <CheckCircle2 size={14} />
                        <span>Connected</span>
                    </div>
                );
            case 'invalid':
                return (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-error)',
                        fontSize: '12px'
                    }}>
                        <AlertCircle size={14} />
                        <span>Invalid API key</span>
                    </div>
                );
            default:
                return (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-warning)',
                        fontSize: '12px'
                    }}>
                        <AlertCircle size={14} />
                        <span>Not configured</span>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <span style={{ display: 'inline-flex', marginRight: 8, verticalAlign: 'text-bottom', color: 'var(--text-primary)' }}>
                        <Supermemory />
                    </span>
                    Supermemory
                </h2>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Enable Persistent Memory</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                            Let Cognito remember information across conversations
                        </div>
                    </div>
                    <div style={{ transform: 'scale(0.9)' }}>
                        <Toggle
                            checked={enabled}
                            onChange={handleEnabledChange}
                            disabled={status !== 'connected'}
                        />
                    </div>
                </div>

                {/* Auto-Extraction Toggle - only show when Supermemory is enabled */}
                {enabled && status === 'connected' && (
                    <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                        <div className="flex-1 mr-4">
                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Auto-Extract Conversation Insights
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label="Learn more about auto-extraction"
                                            className="bg-transparent border-none cursor-pointer p-0.5 flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                        >
                                            <HelpCircle size={14} />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        side="top"
                                        align="center"
                                        className="w-[280px] text-xs leading-relaxed whitespace-pre-line"
                                    >
                                        {AUTO_EXTRACTION_TOOLTIP}
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                                Automatically learn from your conversations
                            </div>
                        </div>
                        <div style={{ transform: 'scale(0.9)' }}>
                            <Toggle
                                checked={autoExtraction}
                                onChange={handleAutoExtractionChange}
                            />
                        </div>
                    </div>
                )}

                {/* Content Memory Toggle - only show when Supermemory is enabled */}
                {enabled && status === 'connected' && (
                    <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                        <div className="flex-1 mr-4">
                            <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Learn from Writing & Reading
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label="Learn more about content memory"
                                            className="bg-transparent border-none cursor-pointer p-0.5 flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                        >
                                            <HelpCircle size={14} />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        side="top"
                                        align="center"
                                        className="w-[280px] text-xs leading-relaxed whitespace-pre-line"
                                    >
                                        {CONTENT_MEMORY_TOOLTIP}
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">
                                Build memory from summarizer, writer, and rewriter usage
                            </div>
                        </div>
                        <div style={{ transform: 'scale(0.9)' }}>
                            <Toggle
                                checked={contentMemory}
                                onChange={handleContentMemoryChange}
                            />
                        </div>
                    </div>
                )}

                {/* API Key Input */}
                <div className="flex flex-col items-start gap-2 p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="w-full mr-0 mb-1" style={{ width: '100%' }}>
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">API Key</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                            Required for cloud-based memory persistence
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%'
                    }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--color-secondary)]"
                                value={apiKey}
                                onChange={handleApiKeyChange}
                                onBlur={handleApiKeyBlur}
                                placeholder="Enter your Supermemory API key"
                                style={{
                                    width: '100%',
                                    paddingRight: '36px',
                                    fontFamily: 'monospace',
                                    fontSize: '13px'
                                }}
                                disabled={isSaving}
                            />
                            <button
                                onClick={() => setShowApiKey(!showApiKey)}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-tertiary)'
                                }}
                                title={showApiKey ? 'Hide API key' : 'Show API key'}
                                type="button"
                            >
                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Status and Link */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        marginTop: '4px'
                    }}>
                        {getStatusDisplay()}
                        <a
                            href={SUPERMEMORY_CONSOLE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--text-link)',
                                fontSize: '12px',
                                textDecoration: 'none'
                            }}
                        >
                            Get API key
                            <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
