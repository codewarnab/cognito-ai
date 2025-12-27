'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryState } from 'nuqs';
import { Providers, type Config, type PresetProvider, type SpecialProvider, type ConfigProvider } from '@/components/aipanel';
import '@/components/aipanel/index.css';
import { cognitoProviders } from '@/lib/providers/presets';
import { cognitoLocales } from '@/lib/providers/locales';
import { extensionAPI } from '@/lib/extension-api';
import { testProvider } from '@/lib/providers/test';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDebounceFn } from 'ahooks';
import { useExtension } from '@/hooks/useExtension';
import { Header } from '@/components/shared/Header';

/**
 * Merge stored config with default providers.
 * Ensures all preset providers are present while preserving stored API keys and enabled status.
 */
function mergeConfigWithDefaults(storedConfig: Config | null): Config {
    const defaultConfig: Config = { providers: cognitoProviders };

    if (!storedConfig || !storedConfig.providers) {
        return defaultConfig;
    }

    // Create a map of stored providers by name for quick lookup
    const storedProviderMap = new Map<string, ConfigProvider>();
    storedConfig.providers.forEach(p => storedProviderMap.set(p.name, p));

    // Merge: use stored provider data if exists, otherwise use default
    const mergedProviders = cognitoProviders.map(defaultProvider => {
        const stored = storedProviderMap.get(defaultProvider.name);
        if (stored) {
            // Merge stored settings with default (stored takes priority)
            return {
                ...defaultProvider,
                ...stored,
                // Keep default models if stored has none
                models: stored.models?.length ? stored.models : defaultProvider.models,
            };
        }
        return defaultProvider;
    });

    return {
        ...storedConfig,
        providers: mergedProviders,
    };
}

export default function ProvidersPage() {
    const router = useRouter();
    const { isInstalled, isLoading: extensionLoading } = useExtension();
    const [config, setConfig] = useState<Config>({ providers: cognitoProviders });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // URL state for selected provider
    const [selectedProvider, setSelectedProvider] = useQueryState('provider', {
        defaultValue: '',
        shallow: false,
    });

    // Calculate initial tab index from URL provider name
    const initialTab = useMemo(() => {
        if (!selectedProvider || !config.providers) return 0;

        // Get enabled providers in order
        const enabledProviders = config.providers.filter(p => p.enabled);
        const providerIndex = enabledProviders.findIndex(p => p.name === selectedProvider);

        // Check for special tabs
        if (selectedProvider === 'disabled') {
            return enabledProviders.length;
        }

        return providerIndex >= 0 ? providerIndex : 0;
    }, [selectedProvider, config.providers]);

    // Handle tab change - update URL
    const handleTabChange = useCallback((tabIndex: number, providerName: string) => {
        setSelectedProvider(providerName);
    }, [setSelectedProvider]);

    // Auto-dismiss success notifications
    useEffect(() => {
        if (notification?.type === 'success') {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Load existing config from extension
    useEffect(() => {
        const loadConfig = async () => {
            // Wait for extension check to complete
            if (extensionLoading) return;

            // If extension not installed, stop loading
            if (!isInstalled) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await extensionAPI.getProvidersConfig();
                if (response.success && response.data) {
                    // Merge stored config with defaults to ensure all preset providers are visible
                    const mergedConfig = mergeConfigWithDefaults(response.data.config);
                    setConfig(mergedConfig);
                }
            } catch (error) {
                console.error('Failed to load config:', error);
                setNotification({ type: 'error', message: 'Failed to load existing configuration' });
            } finally {
                setIsLoading(false);
            }
        };
        loadConfig();
    }, [extensionLoading, isInstalled]);

    // Save config changes
    const saveConfig = async (newConfig: Config) => {
        try {
            setIsSaving(true);
            setNotification(null);
            const response = await extensionAPI.setProvidersConfig(newConfig);

            if (!response.success) {
                console.error('Failed to save config:', response.error);
                setNotification({ type: 'error', message: response.error || 'Failed to save configuration' });
            }
        } catch (error) {
            console.error('Failed to save config:', error);
            setNotification({ type: 'error', message: 'Failed to save configuration' });
        } finally {
            setIsSaving(false);
        }
    };

    // Debounced save
    const { run: debouncedSave } = useDebounceFn(
        (newConfig: Config) => {
            saveConfig(newConfig);
        },
        { wait: 1000 }
    );

    const handleChange = useCallback((newConfig: Config) => {
        setConfig(newConfig);
        debouncedSave(newConfig);
    }, [debouncedSave]);

    const handleTest = useCallback(async (provider: PresetProvider | SpecialProvider) => {
        return await testProvider(provider);
    }, []);

    // Show skeleton while checking extension status
    if (extensionLoading || isLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)]">
                <Header title="AI Providers" />
                <div className="container mx-auto max-w-3xl py-8 px-4">
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
                        {/* Provider tabs skeleton */}
                        <div className="flex gap-6 justify-center py-4 border-b border-[var(--border-color)]">
                            {[...Array(7)].map((_, i) => (
                                <div key={i} className="flex flex-col items-center gap-2">
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            ))}
                        </div>

                        <div className="p-6 space-y-6">
                            {/* API Key section */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>

                            {/* Models section */}
                            <div className="space-y-3">
                                <Skeleton className="h-4 w-14" />
                                <div className="border border-[var(--border-color)] rounded-lg divide-y divide-[var(--border-color)]">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex items-center justify-between p-4">
                                            <div className="space-y-2 flex-1">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-64" />
                                            </div>
                                            <Skeleton className="h-6 w-10 rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions section */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-14" />
                                <div className="flex gap-4">
                                    {[...Array(4)].map((_, i) => (
                                        <Skeleton key={i} className="h-8 w-24" />
                                    ))}
                                    <Skeleton className="h-8 w-28 ml-auto" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show extension not installed message
    if (!isInstalled) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)]">
                <Header title="AI Providers" />
                <div className="container mx-auto max-w-3xl py-8 px-4">
                    <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
                                <AlertCircle className="h-5 w-5 text-yellow-500" />
                                Extension Not Installed
                            </CardTitle>
                            <CardDescription className="text-[var(--text-secondary)]">
                                The Cognito AI extension must be installed to configure AI providers.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push("/")}>Go to Home</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            <Header title="AI Providers">
                {isSaving && (
                    <div className="flex items-center text-sm text-[var(--text-secondary)]">
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        Saving...
                    </div>
                )}
            </Header>

            <div className="container mx-auto max-w-3xl py-8 px-4">
                {/* Notification */}
                {notification && (
                    <Alert
                        variant={notification.type === 'success' ? 'success' : notification.type === 'error' ? 'destructive' : 'default'}
                        className="mb-6 animate-in fade-in slide-in-from-top-2"
                    >
                        {notification.type === 'success' && <CheckCircle className="h-4 w-4" />}
                        {notification.type === 'error' && <XCircle className="h-4 w-4" />}
                        {notification.type === 'info' && <Info className="h-4 w-4" />}
                        <AlertDescription>{notification.message}</AlertDescription>
                    </Alert>
                )}

                <Providers
                    config={config}
                    tab="between"
                    width="100%"
                    locales={cognitoLocales}
                    initialTab={initialTab}
                    onTabChange={handleTabChange}
                    onChange={handleChange}
                    onTest={handleTest}
                />
            </div>
        </div>
    );
}
