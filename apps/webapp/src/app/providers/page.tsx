'use client';

import { useState, useEffect, useCallback } from "react";
import { useExtension } from "@/hooks/useExtension";
import { extensionAPI } from "@/lib/extension-api";
import { ProviderCard, GoogleSetup, VertexSetup, ProviderInstructions } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import Link from "next/link";
import type { AIProvider, VertexCredentials, GetProviderConfigResponse } from "@cognito/shared";

const DEFAULT_VERTEX_CREDENTIALS: VertexCredentials = {
    projectId: '',
    location: 'us-central1',
    clientEmail: '',
    privateKey: '',
    privateKeyId: '',
};

export default function ProvidersPage() {
    const { isInstalled, isLoading: isExtensionLoading } = useExtension();

    // State
    const [provider, setProvider] = useState<AIProvider>('google');
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [vertexCredentials, setVertexCredentials] = useState<VertexCredentials>(DEFAULT_VERTEX_CREDENTIALS);
    const [bothConfigured, setBothConfigured] = useState(false);

    // UI state
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // Load existing config on mount
    const loadConfig = useCallback(async () => {
        if (!isInstalled) return;

        try {
            setIsLoadingConfig(true);
            const response = await extensionAPI.getProviderConfig();

            if (response.success && response.data) {
                const data = response.data as GetProviderConfigResponse;

                if (data.config) {
                    setProvider(data.config.provider);

                    if (data.config.googleApiKey) {
                        setGoogleApiKey(data.config.googleApiKey);
                    }

                    if (data.config.vertexCredentials) {
                        setVertexCredentials(data.config.vertexCredentials);
                    }
                }

                setBothConfigured(data.hasGoogle && data.hasVertex);
            }
        } catch (error) {
            console.error('Failed to load provider config:', error);
            setNotification({ type: 'error', message: 'Failed to load existing configuration' });
        } finally {
            setIsLoadingConfig(false);
        }
    }, [isInstalled]);

    useEffect(() => {
        if (isInstalled) {
            loadConfig();
        } else if (isInstalled === false) {
            setIsLoadingConfig(false);
        }
    }, [isInstalled, loadConfig]);

    // Auto-dismiss success notifications
    useEffect(() => {
        if (notification?.type === 'success') {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Validation
    const validateFields = (): { valid: boolean; error?: string } => {
        if (provider === 'google') {
            if (!googleApiKey.trim()) {
                return { valid: false, error: 'Please enter an API key' };
            }
        } else {
            if (!vertexCredentials.projectId.trim()) {
                return { valid: false, error: 'Project ID is required' };
            }
            if (!vertexCredentials.location.trim()) {
                return { valid: false, error: 'Location is required' };
            }
            if (!vertexCredentials.clientEmail.trim()) {
                return { valid: false, error: 'Client Email is required' };
            }
            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(vertexCredentials.clientEmail)) {
                return { valid: false, error: 'Client Email format is invalid' };
            }
            if (!vertexCredentials.privateKey.trim()) {
                return { valid: false, error: 'Private Key is required' };
            }
            if (!vertexCredentials.privateKey.includes('BEGIN PRIVATE KEY')) {
                return { valid: false, error: 'Private Key format appears invalid' };
            }
        }
        return { valid: true };
    };

    const hasCurrentProviderConfig = () => {
        if (provider === 'google') {
            return googleApiKey.trim().length > 0;
        }
        return vertexCredentials.projectId.trim().length > 0 || vertexCredentials.clientEmail.trim().length > 0;
    };

    // Save handler
    const handleSave = async () => {
        const validation = validateFields();
        if (!validation.valid) {
            setNotification({ type: 'error', message: validation.error || 'Validation failed' });
            return;
        }

        try {
            setIsSaving(true);
            setNotification(null);

            const payload = provider === 'google'
                ? { provider: 'google' as const, googleApiKey: googleApiKey.trim() }
                : { provider: 'vertex' as const, vertexCredentials };

            const response = await extensionAPI.setProviderConfig(payload);

            if (response.success) {
                setNotification({
                    type: 'success',
                    message: `${provider === 'google' ? 'Google AI' : 'Vertex AI'} configuration saved!`
                });
                // Reload config to update bothConfigured state
                await loadConfig();
            } else {
                setNotification({
                    type: 'error',
                    message: response.error || 'Failed to save configuration'
                });
            }
        } catch (error) {
            console.error('Failed to save provider config:', error);
            setNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save configuration'
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Remove handler
    const handleRemove = async () => {
        try {
            setIsSaving(true);
            setNotification(null);

            const response = await extensionAPI.clearProviderConfig(provider);

            if (response.success) {
                if (provider === 'google') {
                    setGoogleApiKey('');
                } else {
                    setVertexCredentials(DEFAULT_VERTEX_CREDENTIALS);
                }
                setNotification({ type: 'success', message: 'Configuration removed' });
                await loadConfig();
            } else {
                setNotification({
                    type: 'error',
                    message: response.error || 'Failed to remove configuration'
                });
            }
        } catch (error) {
            console.error('Failed to remove provider config:', error);
            setNotification({
                type: 'error',
                message: 'Failed to remove configuration'
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Loading state
    if (isExtensionLoading || isLoadingConfig) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Extension not installed
    if (!isInstalled) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="text-center max-w-md">
                    <h1 className="text-2xl font-bold mb-4">Extension Not Found</h1>
                    <p className="text-muted-foreground mb-6">
                        Please install the Cognito AI Chrome extension to configure AI providers.
                    </p>
                    <Link href="/">
                        <Button variant="outline">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-background border-b">
                <div className="container mx-auto px-4 py-3 flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="cursor-pointer">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="text-lg font-semibold flex-1">AI Provider Setup</h1>
                    <div className="flex items-center gap-2">
                        {hasCurrentProviderConfig() && (
                            <Button
                                variant="outline"
                                onClick={handleRemove}
                                disabled={isSaving}
                                className="text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                            >
                                Remove
                            </Button>
                        )}
                        <Button onClick={handleSave} disabled={isSaving} className="cursor-pointer">
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="container mx-auto px-4 py-6 max-w-2xl">
                {/* Notification */}
                {notification && (
                    <Alert
                        variant={notification.type === 'success' ? 'success' : notification.type === 'error' ? 'destructive' : 'info'}
                        className="mb-6 animate-in fade-in slide-in-from-top-2"
                    >
                        {notification.type === 'success' && <CheckCircle className="h-4 w-4" />}
                        {notification.type === 'error' && <XCircle className="h-4 w-4" />}
                        {notification.type === 'info' && <Info className="h-4 w-4" />}
                        <AlertDescription>{notification.message}</AlertDescription>
                    </Alert>
                )}

                {/* Both providers configured info */}
                {bothConfigured && (
                    <Alert variant="info" className="mb-6">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Both providers configured!</strong> Vertex AI is used by default.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-6">
                    {/* Provider Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground">AI Provider</label>
                        <div className="flex gap-3">
                            <ProviderCard
                                provider="google"
                                selected={provider === 'google'}
                                onSelect={() => setProvider('google')}
                                title="Google AI"
                                description="Free tier available"
                                disabled={isSaving}
                            />
                            <ProviderCard
                                provider="vertex"
                                selected={provider === 'vertex'}
                                onSelect={() => setProvider('vertex')}
                                title="Vertex AI"
                                description="Service account"
                                disabled={isSaving}
                            />
                        </div>
                    </div>

                    {/* Conditional Fields */}
                    {provider === 'google' ? (
                        <GoogleSetup
                            apiKey={googleApiKey}
                            onApiKeyChange={setGoogleApiKey}
                            disabled={isSaving}
                        />
                    ) : (
                        <VertexSetup
                            credentials={vertexCredentials}
                            onCredentialsChange={setVertexCredentials}
                            disabled={isSaving}
                        />
                    )}

                    {/* Help Section */}
                    <ProviderInstructions provider={provider} />
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-sm text-muted-foreground border-t mt-8">
                © {new Date().getFullYear()} Cognito AI
            </footer>
        </div>
    );
}
