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

const log = createLogger('ProviderSetup', 'UI_SETTINGS');
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
    const [selectedModel, setSelectedModel] = useState<RemoteModelType>('gemini-3-flash-preview');
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
                message: `${provider === 'google' ? 'Google AI' : 'Vertex AI'} configuration saved!`
            });

            // Notify parent that config was saved
            if (onConfigSaved) {
                onConfigSaved();
            }
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

            setNotification({ type: 'success', message: 'Configuration removed' });
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

    // Auto-dismiss notification after 3 seconds for success messages
    useEffect(() => {
        if (notification?.type === 'success') {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [notification]);

    return (
        <div className="flex flex-col h-screen bg-(--bg-primary) overflow-hidden">
            {/* Header with integrated actions */}
            <div className="sticky top-0 z-10 bg-(--bg-primary) border-b border-white/[0.06] py-3 px-6 max-[640px]:px-4">
                <div className="flex items-center gap-3">
                    <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-transparent border-none text-white/50 cursor-pointer transition-all duration-200 shrink-0 hover:bg-white/5 hover:text-white/90"
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-white/95 m-0 leading-tight tracking-[-0.01em]">AI Provider Setup</h1>
                    </div>
                    {/* Action buttons in header */}
                    <div className="flex items-center gap-2 shrink-0">
                        {hasCurrentProviderConfig() && (
                            <button
                                onClick={handleRemove}
                                disabled={isSaving}
                                className="py-2 px-3.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 border border-red-500/30 bg-transparent text-red-500/85 hover:bg-red-500/[0.08] hover:border-red-500/50 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Remove
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="py-2 px-4 rounded-lg text-xs font-medium border-none cursor-pointer transition-all duration-200 bg-[#4a6fa5] text-white hover:bg-[#5a7fb5] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Inline notification - fixed position below header */}
            {notification && (
                <div className="px-6 max-[640px]:px-4 pt-3 max-w-[600px] mx-auto w-full">
                    <div className={`py-2.5 px-3.5 rounded-lg text-sm border flex items-center gap-2 backdrop-blur-[10px] animate-in fade-in slide-in-from-top-2 duration-200 ${notification.type === 'success'
                        ? 'bg-green-500/8 border-green-500/20 text-green-500'
                        : notification.type === 'error'
                            ? 'bg-red-500/8 border-red-500/20 text-red-500'
                            : 'bg-[#4a6fa5]/8 border-[#4a6fa5]/20 text-[#4a6fa5]'
                        }`}>
                        <span className="text-sm shrink-0">
                            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
                        </span>
                        <span className="flex-1 text-[13px]">{notification.message}</span>
                        <button
                            onClick={() => setNotification(null)}
                            className="text-current opacity-60 hover:opacity-100 bg-transparent border-none cursor-pointer p-0.5 text-sm"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-5 px-6 max-w-[600px] mx-auto w-full max-[640px]:py-4 max-[640px]:px-4 [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.12] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
                {/* Info banner when both providers are configured */}
                {bothProvidersConfigured && (
                    <div className="py-3 px-3.5 rounded-lg text-[13px] border border-purple-500/20 bg-purple-500/[0.08] text-purple-500 flex items-start gap-2.5 mb-5 backdrop-blur-[10px]">
                        <span className="text-sm mt-0.5 shrink-0">ℹ</span>
                        <div className="flex-1 leading-relaxed">
                            <strong>Both providers configured!</strong> Vertex AI is used by default.
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-5">
                    {/* Provider Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="block text-[13px] font-medium text-white/60 tracking-[0.01em]">AI Provider</label>
                        <div className="flex gap-2.5">
                            {/* Google AI Option */}
                            <label className={`flex-1 flex items-center p-3.5 border-[1.5px] rounded-lg cursor-pointer bg-white/[0.02] transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.12] ${provider === 'google' ? 'border-[#4a6fa5] bg-[#4a6fa5]/8' : 'border-white/[0.08]'}`}>
                                <input
                                    type="radio"
                                    value="google"
                                    checked={provider === 'google'}
                                    onChange={() => setProvider('google')}
                                    className="mr-2.5 cursor-pointer shrink-0"
                                />
                                <div>
                                    <div className="font-medium text-white/90 text-[14px]">Google AI</div>
                                    <div className="text-[11px] text-white/45">Free tier available</div>
                                </div>
                            </label>

                            {/* Vertex AI Option */}
                            <label className={`flex-1 flex items-center p-3.5 border-[1.5px] rounded-lg cursor-pointer bg-white/[0.02] transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.12] ${provider === 'vertex' ? 'border-[#4a6fa5] bg-[#4a6fa5]/8' : 'border-white/[0.08]'}`}>
                                <input
                                    type="radio"
                                    value="vertex"
                                    checked={provider === 'vertex'}
                                    onChange={() => setProvider('vertex')}
                                    className="mr-2.5 cursor-pointer shrink-0"
                                />
                                <div>
                                    <div className="font-medium text-white/90 text-[14px]">Vertex AI</div>
                                    <div className="text-[11px] text-white/45">Service account</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Conditional Fields Based on Provider */}
                    {provider === 'google' ? (
                        <>
                            {/* Google API Key Input */}
                            <div className="flex flex-col gap-2">
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
                                        className="w-full py-3 px-3.5 pr-16 rounded-lg border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-(--text-tertiary) bg-transparent border-none cursor-pointer py-1 px-2 rounded transition-all duration-200 hover:text-(--text-primary) hover:bg-(--glass-bg-hover)"
                                    >
                                        {showGoogleKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Vertex AI Fields */}
                            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="vertex-project-id" className="block text-[12px] font-medium text-white/60">
                                        Project ID *
                                    </label>
                                    <input
                                        id="vertex-project-id"
                                        type="text"
                                        value={vertexProjectId}
                                        onChange={(e) => setVertexProjectId(e.target.value)}
                                        placeholder="my-project-123"
                                        disabled={isLoading || isSaving}
                                        className="w-full py-2.5 px-3 rounded-lg border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="vertex-location" className="block text-[12px] font-medium text-white/60">
                                        Location *
                                    </label>
                                    <input
                                        id="vertex-location"
                                        type="text"
                                        value={vertexLocation}
                                        onChange={(e) => setVertexLocation(e.target.value)}
                                        placeholder="us-central1"
                                        disabled={isLoading || isSaving}
                                        className="w-full py-2.5 px-3 rounded-lg border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="vertex-client-email" className="block text-[12px] font-medium text-white/60">
                                    Client Email *
                                </label>
                                <input
                                    id="vertex-client-email"
                                    type="email"
                                    value={vertexClientEmail}
                                    onChange={(e) => setVertexClientEmail(e.target.value)}
                                    placeholder="service-account@project.iam.gserviceaccount.com"
                                    disabled={isLoading || isSaving}
                                    className="w-full py-2.5 px-3 rounded-lg border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="vertex-private-key" className="block text-[12px] font-medium text-white/60">
                                    Private Key *
                                </label>
                                <div className="relative">
                                    <textarea
                                        id="vertex-private-key"
                                        value={vertexPrivateKey}
                                        onChange={(e) => setVertexPrivateKey(e.target.value)}
                                        placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                        disabled={isLoading || isSaving}
                                        rows={showVertexKey ? 6 : 3}
                                        className={`w-full py-2.5 px-3 pr-14 rounded-lg border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs resize-y ${!showVertexKey ? 'blur-[4px]' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowVertexKey(!showVertexKey)}
                                        className="absolute right-2 top-2 text-xs text-(--text-tertiary) bg-transparent border-none cursor-pointer py-1 px-2 rounded transition-all duration-200 hover:text-(--text-primary) hover:bg-(--glass-bg-hover)"
                                    >
                                        {showVertexKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="vertex-private-key-id" className="block text-[12px] font-medium text-white/60">
                                    Private Key ID <span className="text-(--text-tertiary) font-normal text-[11px]">(optional)</span>
                                </label>
                                <input
                                    id="vertex-private-key-id"
                                    type="text"
                                    value={vertexPrivateKeyId}
                                    onChange={(e) => setVertexPrivateKeyId(e.target.value)}
                                    placeholder="abc123def456..."
                                    disabled={isLoading || isSaving}
                                    className="w-full py-2.5 px-3 rounded-lg border-[1.5px] border-white/[0.08] text-sm bg-white/[0.02] text-white/90 transition-all duration-200 focus:outline-none focus:border-[#4a6fa5]/50 focus:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </>
                    )}

                    {/* Help Text - Collapsible */}
                    <details className="group">
                        <summary className="py-2.5 px-3.5 bg-white/[0.02] rounded-lg text-[13px] border border-white/[0.06] cursor-pointer list-none flex items-center gap-2 text-white/60 hover:bg-white/[0.04] transition-all">
                            <span className="text-[11px] transition-transform group-open:rotate-90">▶</span>
                            <span>How to get {provider === 'google' ? 'API key' : 'credentials'}</span>
                        </summary>
                        <div className="mt-2 p-3.5 bg-white/[0.02] rounded-lg text-[13px] border border-white/[0.06] leading-relaxed">
                            {provider === 'google' ? (
                                <>
                                    <ol className="m-0 pl-4 text-white/50 space-y-1">
                                        <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#1264FF] underline">Google AI Studio</a></li>
                                        <li>Sign in with your Google account</li>
                                        <li>Click "Create API Key" or "Get API Key"</li>
                                        <li>Copy and paste the key above</li>
                                    </ol>
                                    <p className="mt-2 mb-0 text-(--text-tertiary) text-xs">
                                        <em>The free tier includes generous quotas for personal use.</em>
                                    </p>
                                </>
                            ) : (
                                <>
                                    <ol className="m-0 pl-4 text-white/50 space-y-1">
                                        <li>Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-[#1264FF] underline">Google Cloud Console</a></li>
                                        <li>Navigate to "IAM & Admin" → "Service Accounts"</li>
                                        <li>Create a service account with "Vertex AI User" role</li>
                                        <li>Create a JSON key and download it</li>
                                        <li>Copy values from the JSON file above</li>
                                    </ol>
                                    <p className="mt-2 mb-0 text-(--text-tertiary) text-xs">
                                        <em>Ensure Vertex AI API is enabled in your project.</em>
                                    </p>
                                </>
                            )}
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
};
