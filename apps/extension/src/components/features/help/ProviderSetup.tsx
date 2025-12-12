import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
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

    const handleModelChange = async (newModel: RemoteModelType) => {
        setSelectedModel(newModel);
        try {
            await setModelConfig({ remoteModel: newModel });
            log.info('Model configuration saved automatically', { model: newModel });
            setNotification({
                type: 'success',
                message: `Model changed to ${newModel}`
            });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            log.error('Failed to save model config', error);
            setNotification({
                type: 'error',
                message: 'Failed to save model selection'
            });
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

    // Notification style classes based on type
    const getNotificationClasses = (type: 'success' | 'error' | 'info') => {
        const base = "py-3.5 px-4 rounded-[10px] text-sm border flex items-center gap-2.5 mb-6 backdrop-blur-[10px]";
        switch (type) {
            case 'success':
                return `${base} bg-green-500/[0.08] border-green-500/20 text-green-500`;
            case 'error':
                return `${base} bg-red-500/[0.08] border-red-500/20 text-red-500`;
            case 'info':
                return `${base} bg-[#4a6fa5]/[0.08] border-[#4a6fa5]/20 text-[#4a6fa5]`;
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[var(--bg-primary)] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-white/[0.06] py-4 px-6 max-[640px]:p-4">
                <div className="flex items-center gap-4">
                    <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-transparent border-none text-white/50 cursor-pointer transition-all duration-200 shrink-0 hover:bg-white/5 hover:text-white/90"
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-semibold text-white/95 m-0 leading-tight tracking-[-0.01em] max-[640px]:text-lg">AI Provider Setup</h1>
                        <p className="text-sm text-white/40 mt-1 mb-0 leading-normal font-normal">
                            Configure your api keys
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-8 px-6 max-w-[600px] mx-auto w-full max-[640px]:py-6 max-[640px]:px-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                {/* Notification */}
                {notification && (
                    <div className={getNotificationClasses(notification.type)}>
                        <span className="text-base shrink-0">
                            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
                        </span>
                        <span>{notification.message}</span>
                    </div>
                )}

                {/* Info banner when both providers are configured */}
                {bothProvidersConfigured && !notification && (
                    <div className="py-3.5 px-4 rounded-[10px] text-[13px] border border-purple-500/20 bg-purple-500/[0.08] text-purple-500 flex items-start gap-2.5 mb-6 backdrop-blur-[10px]">
                        <span className="text-base mt-0.5 shrink-0">ℹ</span>
                        <div className="flex-1 leading-relaxed">
                            <strong>Both providers configured!</strong>
                            <br />
                            <span className="text-xs opacity-90">
                                By default, Vertex AI will be used when both are available.
                                Select a provider below to manually override this preference.
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-8">
                    {/* Provider Selection */}
                    <div className="flex flex-col gap-2.5">
                        <label className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">AI Provider</label>
                        <div className="flex flex-col gap-3.5">
                            {/* Google AI Option */}
                            <label className={`flex items-start p-4.5 border-[1.5px] rounded-[10px] cursor-pointer bg-white/[0.02] transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.12] ${provider === 'google' ? 'border-[#4a6fa5] bg-[#4a6fa5]/[0.08]' : 'border-white/[0.08]'}`}>
                                <input
                                    type="radio"
                                    value="google"
                                    checked={provider === 'google'}
                                    onChange={() => setProvider('google')}
                                    className="mt-1 mr-3 cursor-pointer shrink-0"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-white/90 mb-1 text-[15px]">Google Generative AI</div>
                                    <div className="text-[13px] text-white/45 leading-normal">
                                        Use AI Studio API key (Free tier available)
                                    </div>
                                </div>
                            </label>

                            {/* Vertex AI Option */}
                            <label className={`flex items-start p-4.5 border-[1.5px] rounded-[10px] cursor-pointer bg-white/[0.02] transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.12] ${provider === 'vertex' ? 'border-[#4a6fa5] bg-[#4a6fa5]/[0.08]' : 'border-white/[0.08]'}`}>
                                <input
                                    type="radio"
                                    value="vertex"
                                    checked={provider === 'vertex'}
                                    onChange={() => setProvider('vertex')}
                                    className="mt-1 mr-3 cursor-pointer shrink-0"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-white/90 mb-1 text-[15px]">
                                        Google Vertex AI
                                    </div>
                                    <div className="text-[13px] text-white/45 leading-normal">
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
                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="google-api-key" className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">
                                    API Key
                                </label>
                                <div className="relative">
                                    <input
                                        id="google-api-key"
                                        type={showGoogleKey ? 'text' : 'password'}
                                        value={googleApiKey}
                                        onChange={(e) => setGoogleApiKeyState(e.target.value)}
                                        placeholder="Enter your Google AI Studio API key"
                                        disabled={isLoading || isSaving}
                                        className="w-full py-3.5 px-3.5 pr-16 rounded-[10px] border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer py-1 px-2 rounded transition-all duration-200 hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]"
                                    >
                                        {showGoogleKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Vertex AI Fields */}
                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="vertex-project-id" className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">
                                    Project ID *
                                </label>
                                <input
                                    id="vertex-project-id"
                                    type="text"
                                    value={vertexProjectId}
                                    onChange={(e) => setVertexProjectId(e.target.value)}
                                    placeholder="my-project-123"
                                    disabled={isLoading || isSaving}
                                    className="w-full py-3.5 px-3.5 rounded-[10px] border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="vertex-location" className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">
                                    Location *
                                </label>
                                <input
                                    id="vertex-location"
                                    type="text"
                                    value={vertexLocation}
                                    onChange={(e) => setVertexLocation(e.target.value)}
                                    placeholder="us-central1"
                                    disabled={isLoading || isSaving}
                                    className="w-full py-3.5 px-3.5 rounded-[10px] border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="vertex-client-email" className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">
                                    Client Email *
                                </label>
                                <input
                                    id="vertex-client-email"
                                    type="email"
                                    value={vertexClientEmail}
                                    onChange={(e) => setVertexClientEmail(e.target.value)}
                                    placeholder="service-account@project.iam.gserviceaccount.com"
                                    disabled={isLoading || isSaving}
                                    className="w-full py-3.5 px-3.5 rounded-[10px] border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="vertex-private-key" className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">
                                    Private Key *
                                </label>
                                <div className="relative">
                                    <textarea
                                        id="vertex-private-key"
                                        value={vertexPrivateKey}
                                        onChange={(e) => setVertexPrivateKey(e.target.value)}
                                        placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                        disabled={isLoading || isSaving}
                                        rows={showVertexKey ? 8 : 4}
                                        className={`w-full py-3.5 px-3.5 pr-16 rounded-[10px] border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs resize-y ${!showVertexKey ? 'blur-[4px]' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowVertexKey(!showVertexKey)}
                                        className="absolute right-2 top-2 text-xs text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer py-1 px-2 rounded transition-all duration-200 hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]"
                                    >
                                        {showVertexKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="vertex-private-key-id" className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">
                                    Private Key ID <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
                                </label>
                                <input
                                    id="vertex-private-key-id"
                                    type="text"
                                    value={vertexPrivateKeyId}
                                    onChange={(e) => setVertexPrivateKeyId(e.target.value)}
                                    placeholder="abc123def456..."
                                    disabled={isLoading || isSaving}
                                    className="w-full py-3.5 px-3.5 rounded-[10px] border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </>
                    )}

                    {/* Help Text */}
                    <div className="p-4 bg-white/[0.02] rounded-[10px] text-[13px] border border-white/[0.06] leading-relaxed">
                        {provider === 'google' ? (
                            <>
                                <p className="m-0 mb-2.5 text-white/70">
                                    <strong>How to get a Google AI API key:</strong>
                                </p>
                                <ol className="m-0 pl-5 text-white/50">
                                    <li className="mb-1">Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#1264FF] underline">Google AI Studio</a></li>
                                    <li className="mb-1">Sign in with your Google account</li>
                                    <li className="mb-1">Click "Create API Key" or "Get API Key"</li>
                                    <li className="mb-1">Copy the generated key and paste it above</li>
                                </ol>
                                <p className="mt-2 mb-0 text-[var(--text-tertiary)] text-xs">
                                    <em>The free tier includes generous quotas for personal use.</em>
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="m-0 mb-2.5 text-white/70">
                                    <strong>How to get Vertex AI credentials:</strong>
                                </p>
                                <ol className="m-0 pl-5 text-white/50">
                                    <li className="mb-1">Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-[#1264FF] underline">Google Cloud Console</a></li>
                                    <li className="mb-1">Navigate to "IAM & Admin" → "Service Accounts"</li>
                                    <li className="mb-1">Create a new service account with "Vertex AI User" role</li>
                                    <li className="mb-1">Create a JSON key and download it</li>
                                    <li className="mb-1">Copy values from the JSON file to the fields above</li>
                                </ol>
                                <p className="mt-2 mb-0 text-[var(--text-tertiary)] text-xs">
                                    <em>Ensure your GCP project has the Vertex AI API enabled.</em>
                                </p>
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3.5 justify-end pt-4 max-[640px]:flex-col">
                        {hasCurrentProviderConfig() && !notification && (
                            <button
                                onClick={handleRemove}
                                disabled={isSaving}
                                className="py-3 px-6 rounded-[10px] text-sm font-medium border-none cursor-pointer transition-all duration-200 border-[1.5px] border-red-500/30 bg-transparent text-red-500/85 hover:bg-red-500/[0.08] hover:border-red-500/50 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed max-[640px]:w-full"
                            >
                                Remove
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="py-3 px-6 rounded-[10px] text-sm font-medium border-none cursor-pointer transition-all duration-200 bg-[#4a6fa5] text-white hover:bg-[#5a7fb5] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(74,111,165,0.3)] disabled:opacity-40 disabled:cursor-not-allowed max-[640px]:w-full"
                        >
                            {isSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
