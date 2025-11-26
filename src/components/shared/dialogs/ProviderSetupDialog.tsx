import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/primitives/dialog';
import { createLogger } from '~logger';
import {
    getProviderConfig,
    setGoogleApiKey,
    setVertexCredentials,
    clearGoogleApiKey,
    clearVertexCredentials,
    hasGoogleApiKey,
    hasVertexCredentials,
    setSelectedProvider,
} from '@/utils/credentials';
import type { AIProvider, VertexCredentials } from '@/utils/credentials';
import { getModelConfig, setModelConfig } from '@/utils/ai';
import type { RemoteModelType } from '../../features/chat/types';

const log = createLogger('ProviderSetupDialog');

interface ProviderSetupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfigSaved?: () => void;
}

export const ProviderSetupDialog: React.FC<ProviderSetupDialogProps> = ({
    isOpen,
    onClose,
    onConfigSaved,
}) => {
    const [provider, setProvider] = useState<AIProvider>('google');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
    const [selectedModel, setSelectedModel] = useState<RemoteModelType>('gemini-2.5-flash');
    const [bothProvidersConfigured, setBothProvidersConfigured] = useState(false);

    // Google AI fields
    const [googleApiKey, setGoogleApiKeyState] = useState('');
    const [showGoogleKey, setShowGoogleKey] = useState(false);

    // Vertex AI fields
    const [vertexProjectId, setVertexProjectId] = useState('');
    const [vertexLocation, setVertexLocation] = useState('us-central1');
    const [vertexClientEmail, setVertexClientEmail] = useState('');
    const [vertexPrivateKey, setVertexPrivateKey] = useState('');
    const [vertexPrivateKeyId, setVertexPrivateKeyId] = useState('');
    const [showVertexKey, setShowVertexKey] = useState(false);

    // Load existing configuration when dialog opens
    useEffect(() => {
        if (isOpen) {
            loadConfig();
            loadModelConfig();
            setNotification(null);
        }
    }, [isOpen]);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const config = await getProviderConfig();

            if (config) {
                setProvider(config.provider);

                if (config.googleApiKey) {
                    setGoogleApiKeyState(config.googleApiKey);
                }

                if (config.vertexCredentials) {
                    setVertexProjectId(config.vertexCredentials.projectId);
                    setVertexLocation(config.vertexCredentials.location);
                    setVertexClientEmail(config.vertexCredentials.clientEmail);
                    setVertexPrivateKey(config.vertexCredentials.privateKey);
                    setVertexPrivateKeyId(config.vertexCredentials.privateKeyId || '');
                }

                log.info('Loaded existing provider configuration', { provider: config.provider });
            }

            // Check if both providers are configured
            const hasGoogle = await hasGoogleApiKey();
            const hasVertex = await hasVertexCredentials();
            setBothProvidersConfigured(hasGoogle && hasVertex);

            if (hasGoogle && hasVertex) {
                log.info('Both providers are configured. Vertex AI will be used by default unless manually overridden.');
            }
        } catch (error) {
            log.error('Failed to load provider config', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadModelConfig = async () => {
        try {
            const config = await getModelConfig();
            setSelectedModel(config.remoteModel);
        } catch (error) {
            log.error('Failed to load model config', error);
        }
    };

    const validateFields = (): { valid: boolean; error?: string } => {
        if (provider === 'google') {
            if (!googleApiKey.trim()) {
                return { valid: false, error: 'Please enter an API key' };
            }
        } else {
            // Vertex AI validation
            if (!vertexProjectId.trim()) {
                return { valid: false, error: 'Project ID is required' };
            }
            if (!vertexLocation.trim()) {
                return { valid: false, error: 'Location is required' };
            }
            if (!vertexClientEmail.trim()) {
                return { valid: false, error: 'Client Email is required' };
            }
            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(vertexClientEmail)) {
                return { valid: false, error: 'Client Email format is invalid' };
            }
            if (!vertexPrivateKey.trim()) {
                return { valid: false, error: 'Private Key is required' };
            }
            if (!vertexPrivateKey.includes('BEGIN PRIVATE KEY')) {
                return { valid: false, error: 'Private Key format appears invalid' };
            }
        }
        return { valid: true };
    };

    const handleSave = async () => {
        // Validate fields
        const validation = validateFields();
        if (!validation.valid) {
            setNotification({ type: 'error', message: validation.error || 'Validation failed' });
            return;
        }

        try {
            setIsSaving(true);
            setNotification(null);

            if (provider === 'google') {
                await setGoogleApiKey(googleApiKey.trim());
                log.info('Google AI API key saved successfully');
            } else {
                const credentials: VertexCredentials = {
                    projectId: vertexProjectId.trim(),
                    location: vertexLocation.trim(),
                    clientEmail: vertexClientEmail.trim(),
                    privateKey: vertexPrivateKey.trim(),
                    privateKeyId: vertexPrivateKeyId.trim() || undefined,
                };
                await setVertexCredentials(credentials);
                log.info('Vertex AI credentials saved successfully');
            }

            // Save model configuration
            await setModelConfig({ remoteModel: selectedModel });

            // Set the selected provider explicitly (for manual override)
            await setSelectedProvider(provider);

            setNotification({
                type: 'success',
                message: `${provider === 'google' ? 'Google AI' : 'Vertex AI'} configuration saved successfully!`
            });

            // Notify parent that config was saved
            if (onConfigSaved) {
                onConfigSaved();
            }

            // Close dialog after a short delay to show success message
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (error) {
            log.error('Failed to save provider configuration', error);
            setNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save configuration. Please try again.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        try {
            setIsSaving(true);
            setNotification(null);

            if (provider === 'google') {
                await clearGoogleApiKey();
                setGoogleApiKeyState('');
                log.info('Google API key removed');
            } else {
                await clearVertexCredentials();
                setVertexProjectId('');
                setVertexLocation('us-central1');
                setVertexClientEmail('');
                setVertexPrivateKey('');
                setVertexPrivateKeyId('');
                log.info('Vertex credentials removed');
            }

            setNotification({ type: 'success', message: 'Configuration removed successfully' });
        } catch (error) {
            log.error('Failed to remove configuration', error);
            setNotification({ type: 'error', message: 'Failed to remove configuration. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    const hasCurrentProviderConfig = () => {
        if (provider === 'google') {
            return googleApiKey.trim().length > 0;
        } else {
            return vertexProjectId.trim().length > 0 || vertexClientEmail.trim().length > 0;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
                <DialogHeader>
                    <DialogTitle>AI Provider Setup</DialogTitle>
                    <DialogDescription>
                        Configure your AI provider to enable remote AI features.
                    </DialogDescription>
                </DialogHeader>

                {/* Notification */}
                {notification && (
                    <div
                        style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            border: '1px solid',
                            backgroundColor: notification.type === 'success'
                                ? 'rgba(76, 175, 80, 0.1)'
                                : notification.type === 'error'
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'rgba(74, 111, 165, 0.1)',
                            borderColor: notification.type === 'success'
                                ? 'rgba(76, 175, 80, 0.3)'
                                : notification.type === 'error'
                                    ? 'rgba(239, 68, 68, 0.3)'
                                    : 'rgba(74, 111, 165, 0.3)',
                            color: notification.type === 'success'
                                ? '#4caf50'
                                : notification.type === 'error'
                                    ? '#ef4444'
                                    : '#4a6fa5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>
                            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
                        </span>
                        <span>{notification.message}</span>
                    </div>
                )}

                {/* Info banner when both providers are configured */}
                {bothProvidersConfigured && !notification && (
                    <div
                        style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.8125rem',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            color: '#8b5cf6',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                        }}
                    >
                        <span style={{ fontSize: '1rem', marginTop: '0.125rem' }}>ℹ</span>
                        <div style={{ flex: 1, lineHeight: '1.5' }}>
                            <strong>Both providers configured!</strong>
                            <br />
                            <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                By default, Vertex AI will be used when both are available.
                                Select a provider above to manually override this preference.
                            </span>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Provider Selection */}
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                marginBottom: '0.75rem',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            AI Provider
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Google AI Option */}
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    padding: '1rem',
                                    border: `2px solid ${provider === 'google' ? '#4a6fa5' : 'var(--border-color)'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: provider === 'google' ? 'rgba(74, 111, 165, 0.05)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    if (provider !== 'google') {
                                        e.currentTarget.style.backgroundColor = 'var(--glass-bg-hover)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (provider !== 'google') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <input
                                    type="radio"
                                    value="google"
                                    checked={provider === 'google'}
                                    onChange={() => setProvider('google')}
                                    style={{
                                        marginTop: '0.25rem',
                                        marginRight: '0.75rem',
                                        cursor: 'pointer',
                                    }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                        Google Generative AI
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                                        Use AI Studio API key (Free tier available)
                                    </div>
                                </div>
                            </label>

                            {/* Vertex AI Option */}
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    padding: '1rem',
                                    border: `2px solid ${provider === 'vertex' ? '#4a6fa5' : 'var(--border-color)'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: provider === 'vertex' ? 'rgba(74, 111, 165, 0.05)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    if (provider !== 'vertex') {
                                        e.currentTarget.style.backgroundColor = 'var(--glass-bg-hover)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (provider !== 'vertex') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <input
                                    type="radio"
                                    value="vertex"
                                    checked={provider === 'vertex'}
                                    onChange={() => setProvider('vertex')}
                                    style={{
                                        marginTop: '0.25rem',
                                        marginRight: '0.75rem',
                                        cursor: 'pointer',
                                    }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                        Google Vertex AI
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                                        Use service account credentials from Google Cloud
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Conditional Fields Based on Provider */}
                    {provider === 'google' ? (
                        <>
                            {/* Google API Key Input */}
                            <div>
                                <label
                                    htmlFor="google-api-key"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    API Key
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="google-api-key"
                                        type={showGoogleKey ? 'text' : 'password'}
                                        value={googleApiKey}
                                        onChange={(e) => setGoogleApiKeyState(e.target.value)}
                                        placeholder="Enter your Google AI Studio API key"
                                        disabled={isLoading || isSaving}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            paddingRight: '4rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '0.875rem',
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'var(--border-color-focus)';
                                            e.target.style.background = 'var(--bg-quaternary)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'var(--border-color)';
                                            e.target.style.background = 'var(--bg-tertiary)';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                                        style={{
                                            position: 'absolute',
                                            right: '0.5rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-tertiary)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.color = 'var(--text-primary)';
                                            e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-tertiary)';
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        {showGoogleKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Vertex AI Fields */}
                            <div>
                                <label
                                    htmlFor="vertex-project-id"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    Project ID *
                                </label>
                                <input
                                    id="vertex-project-id"
                                    type="text"
                                    value={vertexProjectId}
                                    onChange={(e) => setVertexProjectId(e.target.value)}
                                    placeholder="my-project-123"
                                    disabled={isLoading || isSaving}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.875rem',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--border-color-focus)';
                                        e.target.style.background = 'var(--bg-quaternary)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border-color)';
                                        e.target.style.background = 'var(--bg-tertiary)';
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="vertex-location"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    Location *
                                </label>
                                <input
                                    id="vertex-location"
                                    type="text"
                                    value={vertexLocation}
                                    onChange={(e) => setVertexLocation(e.target.value)}
                                    placeholder="us-central1"
                                    disabled={isLoading || isSaving}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.875rem',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--border-color-focus)';
                                        e.target.style.background = 'var(--bg-quaternary)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border-color)';
                                        e.target.style.background = 'var(--bg-tertiary)';
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="vertex-client-email"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    Client Email *
                                </label>
                                <input
                                    id="vertex-client-email"
                                    type="email"
                                    value={vertexClientEmail}
                                    onChange={(e) => setVertexClientEmail(e.target.value)}
                                    placeholder="service-account@project.iam.gserviceaccount.com"
                                    disabled={isLoading || isSaving}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.875rem',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--border-color-focus)';
                                        e.target.style.background = 'var(--bg-quaternary)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border-color)';
                                        e.target.style.background = 'var(--bg-tertiary)';
                                    }}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="vertex-private-key"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    Private Key *
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <textarea
                                        id="vertex-private-key"
                                        value={vertexPrivateKey}
                                        onChange={(e) => setVertexPrivateKey(e.target.value)}
                                        placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                        disabled={isLoading || isSaving}
                                        rows={showVertexKey ? 8 : 4}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            paddingRight: '4rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '0.75rem',
                                            fontFamily: 'monospace',
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                            transition: 'all 0.2s ease',
                                            resize: 'vertical',
                                            filter: showVertexKey ? 'none' : 'blur(4px)',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'var(--border-color-focus)';
                                            e.target.style.background = 'var(--bg-quaternary)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'var(--border-color)';
                                            e.target.style.background = 'var(--bg-tertiary)';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowVertexKey(!showVertexKey)}
                                        style={{
                                            position: 'absolute',
                                            right: '0.5rem',
                                            top: '0.5rem',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-tertiary)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.color = 'var(--text-primary)';
                                            e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-tertiary)';
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        {showVertexKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="vertex-private-key-id"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        marginBottom: '0.5rem',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    Private Key ID <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
                                </label>
                                <input
                                    id="vertex-private-key-id"
                                    type="text"
                                    value={vertexPrivateKeyId}
                                    onChange={(e) => setVertexPrivateKeyId(e.target.value)}
                                    placeholder="abc123def456..."
                                    disabled={isLoading || isSaving}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.875rem',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--border-color-focus)';
                                        e.target.style.background = 'var(--bg-quaternary)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border-color)';
                                        e.target.style.background = 'var(--bg-tertiary)';
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {/* Model Selector */}
                    <div>
                        <label
                            htmlFor="model-selector"
                            style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                marginBottom: '0.5rem',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            Default Model
                        </label>
                        <div style={{ position: 'relative' }}>
                            <select
                                id="model-selector"
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value as RemoteModelType)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.875rem',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1.25rem',
                                    paddingRight: '2.5rem',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--border-color-focus)';
                                    e.target.style.background = 'var(--bg-quaternary)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border-color)';
                                    e.target.style.background = 'var(--bg-tertiary)';
                                }}
                            >
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                            </select>
                        </div>
                    </div>

                    {/* Help Text */}
                    <div
                        style={{
                            padding: '0.75rem',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '8px',
                            fontSize: '0.8125rem',
                            border: '1px solid var(--border-color)',
                            lineHeight: '1.5',
                        }}
                    >
                        {provider === 'google' ? (
                            <>
                                <p style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    <strong>How to get a Google AI API key:</strong>
                                </p>
                                <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-tertiary)' }}>
                                    <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#1264FF', textDecoration: 'underline' }}>Google AI Studio</a></li>
                                    <li>Sign in with your Google account</li>
                                    <li>Click "Create API Key" or "Get API Key"</li>
                                    <li>Copy the generated key and paste it above</li>
                                </ol>
                                <p style={{ margin: 0, marginTop: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                    <em>The free tier includes generous quotas for personal use.</em>
                                </p>
                            </>
                        ) : (
                            <>
                                <p style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    <strong>How to get Vertex AI credentials:</strong>
                                </p>
                                <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-tertiary)' }}>
                                    <li>Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" style={{ color: '#1264FF', textDecoration: 'underline' }}>Google Cloud Console</a></li>
                                    <li>Navigate to "IAM & Admin" → "Service Accounts"</li>
                                    <li>Create a new service account with "Vertex AI User" role</li>
                                    <li>Create a JSON key and download it</li>
                                    <li>Copy values from the JSON file to the fields above</li>
                                </ol>
                                <p style={{ margin: 0, marginTop: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                    <em>Ensure your GCP project has the Vertex AI API enabled.</em>
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    {hasCurrentProviderConfig() && !notification && (
                        <button
                            onClick={handleRemove}
                            disabled={isSaving}
                            className="dialog-button dialog-button-secondary"
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent',
                                color: 'rgba(239, 68, 68, 0.8)',
                                cursor: 'pointer',
                                opacity: isSaving ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isSaving) {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                    e.currentTarget.style.color = 'rgba(239, 68, 68, 1)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)';
                            }}
                        >
                            Remove
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="dialog-button dialog-button-secondary"
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--glass-bg)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            opacity: isSaving ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!isSaving) {
                                e.currentTarget.style.backgroundColor = 'var(--glass-bg-hover)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--glass-bg)';
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="dialog-button dialog-button-primary"
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            backgroundColor: '#4a6fa5',
                            color: 'white',
                            border: 'none',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!isSaving) {
                                e.currentTarget.style.backgroundColor = '#5a7fb5';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#4a6fa5';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

