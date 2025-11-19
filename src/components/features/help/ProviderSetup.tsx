import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { createLogger } from '@logger';
import {
    getProviderConfig,
    setGoogleApiKey,
    setVertexCredentials,
    clearGoogleApiKey,
    clearVertexCredentials,
    hasGoogleApiKey,
    hasVertexCredentials,
    setSelectedProvider,
} from '../../../utils/providerCredentials';
import type { AIProvider, VertexCredentials } from '../../../utils/providerTypes';
import { getModelConfig, setModelConfig } from '../../../utils/modelSettings';
import type { RemoteModelType } from '../../features/chat/types';
import './ProviderSetup.css';

const log = createLogger('ProviderSetup');
// TODO(@ui): when we add more than a couple of providers, update ProviderSetup to use a searchable combo-box instead of simple radio buttons so the selection stays manageable.
interface ProviderSetupProps {
    onBack: () => void;
    onConfigSaved?: () => void;
}

export const ProviderSetup: React.FC<ProviderSetupProps> = ({
    onBack,
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

    // Load existing configuration when component mounts
    useEffect(() => {
        loadConfig();
        loadModelConfig();
        setNotification(null);
    }, []);

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

            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            log.error('Failed to save provider configuration', error);
            setNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save configuration. Please try again.'
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            log.error('Failed to remove configuration', error);
            setNotification({ type: 'error', message: 'Failed to remove configuration. Please try again.' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <div className="provider-setup-container">
            {/* Header */}
            <div className="provider-setup-header">
                <div className="provider-setup-header-content">
                    <button
                        className="provider-setup-back-button"
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="provider-setup-header-text">
                        <h1 className="provider-setup-title">AI Provider Setup</h1>
                        <p className="provider-setup-subtitle">
                            Configure your AI provider to enable remote AI features
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="provider-setup-content">
                {/* Notification */}
                {notification && (
                    <div className={`provider-setup-notification provider-setup-notification-${notification.type}`}>
                        <span className="provider-setup-notification-icon">
                            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
                        </span>
                        <span>{notification.message}</span>
                    </div>
                )}

                {/* Info banner when both providers are configured */}
                {bothProvidersConfigured && !notification && (
                    <div className="provider-setup-info-banner">
                        <span className="provider-setup-info-icon">ℹ</span>
                        <div className="provider-setup-info-content">
                            <strong>Both providers configured!</strong>
                            <br />
                            <span className="provider-setup-info-text">
                                By default, Vertex AI will be used when both are available.
                                Select a provider below to manually override this preference.
                            </span>
                        </div>
                    </div>
                )}

                <div className="provider-setup-form">
                    {/* Provider Selection */}
                    <div className="provider-setup-section">
                        <label className="provider-setup-label">AI Provider</label>
                        <div className="provider-setup-options">
                            {/* Google AI Option */}
                            <label className={`provider-setup-option ${provider === 'google' ? 'provider-setup-option-selected' : ''}`}>
                                <input
                                    type="radio"
                                    value="google"
                                    checked={provider === 'google'}
                                    onChange={() => setProvider('google')}
                                />
                                <div className="provider-setup-option-content">
                                    <div className="provider-setup-option-title">Google Generative AI</div>
                                    <div className="provider-setup-option-description">
                                        Use AI Studio API key (Free tier available)
                                    </div>
                                </div>
                            </label>

                            {/* Vertex AI Option */}
                            <label className={`provider-setup-option ${provider === 'vertex' ? 'provider-setup-option-selected' : ''}`}>
                                <input
                                    type="radio"
                                    value="vertex"
                                    checked={provider === 'vertex'}
                                    onChange={() => setProvider('vertex')}
                                />
                                <div className="provider-setup-option-content">
                                    <div className="provider-setup-option-title">
                                        Google Vertex AI
                                    </div>
                                    <div className="provider-setup-option-description">
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
                            <div className="provider-setup-section">
                                <label htmlFor="google-api-key" className="provider-setup-label">
                                    API Key
                                </label>
                                <div className="provider-setup-input-wrapper">
                                    <input
                                        id="google-api-key"
                                        type={showGoogleKey ? 'text' : 'password'}
                                        value={googleApiKey}
                                        onChange={(e) => setGoogleApiKeyState(e.target.value)}
                                        placeholder="Enter your Google AI Studio API key"
                                        disabled={isLoading || isSaving}
                                        className="provider-setup-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                                        className="provider-setup-toggle-button"
                                    >
                                        {showGoogleKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Vertex AI Fields */}
                            <div className="provider-setup-section">
                                <label htmlFor="vertex-project-id" className="provider-setup-label">
                                    Project ID *
                                </label>
                                <input
                                    id="vertex-project-id"
                                    type="text"
                                    value={vertexProjectId}
                                    onChange={(e) => setVertexProjectId(e.target.value)}
                                    placeholder="my-project-123"
                                    disabled={isLoading || isSaving}
                                    className="provider-setup-input"
                                />
                            </div>

                            <div className="provider-setup-section">
                                <label htmlFor="vertex-location" className="provider-setup-label">
                                    Location *
                                </label>
                                <input
                                    id="vertex-location"
                                    type="text"
                                    value={vertexLocation}
                                    onChange={(e) => setVertexLocation(e.target.value)}
                                    placeholder="us-central1"
                                    disabled={isLoading || isSaving}
                                    className="provider-setup-input"
                                />
                            </div>

                            <div className="provider-setup-section">
                                <label htmlFor="vertex-client-email" className="provider-setup-label">
                                    Client Email *
                                </label>
                                <input
                                    id="vertex-client-email"
                                    type="email"
                                    value={vertexClientEmail}
                                    onChange={(e) => setVertexClientEmail(e.target.value)}
                                    placeholder="service-account@project.iam.gserviceaccount.com"
                                    disabled={isLoading || isSaving}
                                    className="provider-setup-input"
                                />
                            </div>

                            <div className="provider-setup-section">
                                <label htmlFor="vertex-private-key" className="provider-setup-label">
                                    Private Key *
                                </label>
                                <div className="provider-setup-input-wrapper">
                                    <textarea
                                        id="vertex-private-key"
                                        value={vertexPrivateKey}
                                        onChange={(e) => setVertexPrivateKey(e.target.value)}
                                        placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                        disabled={isLoading || isSaving}
                                        rows={showVertexKey ? 8 : 4}
                                        className={`provider-setup-textarea ${!showVertexKey ? 'provider-setup-textarea-blurred' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowVertexKey(!showVertexKey)}
                                        className="provider-setup-toggle-button provider-setup-toggle-button-top"
                                    >
                                        {showVertexKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            <div className="provider-setup-section">
                                <label htmlFor="vertex-private-key-id" className="provider-setup-label">
                                    Private Key ID <span className="provider-setup-label-optional">(optional)</span>
                                </label>
                                <input
                                    id="vertex-private-key-id"
                                    type="text"
                                    value={vertexPrivateKeyId}
                                    onChange={(e) => setVertexPrivateKeyId(e.target.value)}
                                    placeholder="abc123def456..."
                                    disabled={isLoading || isSaving}
                                    className="provider-setup-input"
                                />
                            </div>
                        </>
                    )}

                    {/* Model Selector */}
                    <div className="provider-setup-section">
                        <label htmlFor="model-selector" className="provider-setup-label">
                            Default Model
                        </label>
                        <select
                            id="model-selector"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value as RemoteModelType)}
                            className="provider-setup-select"
                        >
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                        </select>
                    </div>

                    {/* Help Text */}
                    <div className="provider-setup-help">
                        {provider === 'google' ? (
                            <>
                                <p className="provider-setup-help-title">
                                    <strong>How to get a Google AI API key:</strong>
                                </p>
                                <ol className="provider-setup-help-list">
                                    <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
                                    <li>Sign in with your Google account</li>
                                    <li>Click "Create API Key" or "Get API Key"</li>
                                    <li>Copy the generated key and paste it above</li>
                                </ol>
                                <p className="provider-setup-help-note">
                                    <em>The free tier includes generous quotas for personal use.</em>
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="provider-setup-help-title">
                                    <strong>How to get Vertex AI credentials:</strong>
                                </p>
                                <ol className="provider-setup-help-list">
                                    <li>Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                                    <li>Navigate to "IAM & Admin" → "Service Accounts"</li>
                                    <li>Create a new service account with "Vertex AI User" role</li>
                                    <li>Create a JSON key and download it</li>
                                    <li>Copy values from the JSON file to the fields above</li>
                                </ol>
                                <p className="provider-setup-help-note">
                                    <em>Ensure your GCP project has the Vertex AI API enabled.</em>
                                </p>
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="provider-setup-actions">
                        {hasCurrentProviderConfig() && !notification && (
                            <button
                                onClick={handleRemove}
                                disabled={isSaving}
                                className="provider-setup-button provider-setup-button-remove"
                            >
                                Remove
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="provider-setup-button provider-setup-button-primary"
                        >
                            {isSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
