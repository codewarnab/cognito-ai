import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { createLogger } from '~logger';
import { Toggle } from '@/components/shared/inputs/Toggle';
import {
    getSupermemoryApiKey,
    setSupermemoryApiKey,
    clearSupermemoryApiKey,
    isSupermemoryEnabled,
    setSupermemoryEnabled,
    validateSupermemoryApiKeyFormat
} from '@/utils/supermemory';
import { Supermemory } from '@assets/brands/integrations/Supermemory';

const log = createLogger('SupermemorySettings');

const SUPERMEMORY_CONSOLE_URL = 'https://console.supermemory.ai/keys';

type ConnectionStatus = 'not-configured' | 'connected' | 'invalid';

export const SupermemorySettings: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [status, setStatus] = useState<ConnectionStatus>('not-configured');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [storedKey, storedEnabled] = await Promise.all([
                    getSupermemoryApiKey(),
                    isSupermemoryEnabled()
                ]);

                if (storedKey) {
                    setApiKey(storedKey);
                    setStatus(validateSupermemoryApiKeyFormat(storedKey) ? 'connected' : 'invalid');
                }
                setEnabled(storedEnabled);
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
        } catch (err) {
            log.error('Failed to update Supermemory enabled state', err);
            // Revert on error
            setEnabled(!checked);
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
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <span style={{ display: 'inline-flex', marginRight: 8, verticalAlign: 'text-bottom', color: 'var(--text-primary)' }}>
                        <Supermemory />
                    </span>
                    Supermemory
                </h2>
            </div>

            <div className="settings-card">
                {/* Enable Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Enable Persistent Memory</div>
                        <div className="settings-item-description">
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

                {/* API Key Input */}
                <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="settings-item-content" style={{ width: '100%' }}>
                        <div className="settings-item-title">API Key</div>
                        <div className="settings-item-description">
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
                                className="settings-input"
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
