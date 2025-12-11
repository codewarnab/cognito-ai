import React, { useState, useEffect, useCallback } from 'react';
import {
    Globe,
    ChevronUp,
    ChevronDown,
    Key,
    ExternalLink,
    CheckCircle,
    XCircle,
    Loader2,
} from 'lucide-react';
import { createLogger } from '~logger';
import {
    getSearchSettings,
    saveSearchSettings,
    getSearchApiKeys,
    saveSearchApiKeys,
    DEFAULT_SEARCH_SETTINGS,
    type SearchSettings,
    type SearchApiKeys,
} from '@/utils/settings/searchSettings';
import { Toggle } from '@/components/shared/inputs/Toggle';

const log = createLogger('SearchSettingsSection', 'SETTINGS');

/** Provider configuration with signup URLs and key validation */
interface ProviderConfig {
    id: 'tavily';
    name: string;
    signupUrl: string;
    placeholder: string;
    keyPrefix: string;
    description: string;
}

const PROVIDERS: ProviderConfig[] = [
    {
        id: 'tavily',
        name: 'Tavily',
        signupUrl: 'https://tavily.com',
        placeholder: 'tvly-...',
        keyPrefix: 'tvly-',
        description: 'AI-optimized search API. 1000 free searches/month.',
    },
];

/** Test result state */
interface TestResult {
    provider: string;
    success: boolean;
    message: string;
}

export const SearchSettingsSection: React.FC = () => {
    const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SEARCH_SETTINGS);
    const [apiKeys, setApiKeys] = useState<SearchApiKeys>({});
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loadAll = async () => {
            try {
                const [loadedSettings, loadedKeys] = await Promise.all([
                    getSearchSettings(),
                    getSearchApiKeys(),
                ]);
                setSettings(loadedSettings);
                setApiKeys(loadedKeys);
            } catch (error) {
                log.error('Failed to load search settings', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                setIsLoading(false);
            }
        };
        loadAll();
    }, []);

    // Save settings helper
    const updateSettings = useCallback(
        async (updates: Partial<SearchSettings>) => {
            const previousSettings = settings;
            const newSettings = { ...settings, ...updates };
            setSettings(newSettings);
            try {
                await saveSearchSettings(newSettings);
                log.debug('Settings saved', { updates });
            } catch (error) {
                log.error('Failed to save settings', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                setSettings(previousSettings);
            }
        },
        [settings]
    );

    // Save API key helper
    const updateApiKey = useCallback(
        async (provider: keyof SearchApiKeys, value: string) => {
            const previousKeys = apiKeys;
            const newKeys = { ...apiKeys, [provider]: value };
            setApiKeys(newKeys);
            try {
                await saveSearchApiKeys(newKeys);
                log.debug('API key saved', { provider });
                setTestResult(null);
            } catch (error) {
                log.error('Failed to save API key', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                setApiKeys(previousKeys);
            }
        },
        [apiKeys]
    );


    // Test API key connection
    const testConnection = useCallback(
        async (provider: ProviderConfig) => {
            const key = apiKeys[provider.id];
            if (!key) {
                setTestResult({
                    provider: provider.id,
                    success: false,
                    message: 'No API key entered',
                });
                return;
            }

            setIsTesting(true);
            setTestResult(null);

            try {
                const response = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: key,
                        query: 'test',
                        max_results: 1,
                        search_depth: 'basic',
                    }),
                });

                if (response.ok) {
                    setTestResult({
                        provider: provider.id,
                        success: true,
                        message: 'Connection successful!',
                    });
                } else {
                    setTestResult({
                        provider: provider.id,
                        success: false,
                        message:
                            response.status === 401
                                ? 'Invalid API key'
                                : `Error: ${response.status}`,
                    });
                }
            } catch (error) {
                setTestResult({
                    provider: provider.id,
                    success: false,
                    message: 'Connection failed. Check your network.',
                });
            } finally {
                setIsTesting(false);
            }
        },
        [apiKeys]
    );

    const handleOptionsToggle = () => {
        setIsOptionsOpen(!isOptionsOpen);
    };

    const handleApiKeysToggle = () => {
        setIsApiKeysOpen(!isApiKeysOpen);
    };

    const handleOptionsKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOptionsToggle();
        }
    };

    const handleApiKeysKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleApiKeysToggle();
        }
    };

    if (isLoading) {
        return (
            <div className="settings-section">
                <div
                    className="settings-card"
                    style={{ padding: '24px', textAlign: 'center' }}
                >
                    <Loader2
                        size={20}
                        className="animate-spin"
                        style={{ margin: '0 auto', animation: 'spin 1s linear infinite' }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <Globe
                        size={16}
                        style={{
                            display: 'inline',
                            marginRight: '8px',
                            verticalAlign: 'text-bottom',
                        }}
                    />
                    Web Search
                </h2>
            </div>

            <div className="settings-card">
                {/* Enable/Disable Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Enable Web Search</div>
                        <div className="settings-item-description">
                            Allow AI to search the web for current information
                        </div>
                    </div>
                    <Toggle
                        checked={settings.enabled}
                        onChange={(checked) => updateSettings({ enabled: checked })}
                    />
                </div>


                {/* Expandable sections only when enabled */}
                {settings.enabled && (
                    <>
                        {/* Search Options Accordion */}
                        <div
                            className="settings-item"
                            style={{ display: 'block', padding: 0 }}
                        >
                            <button
                                type="button"
                                onClick={handleOptionsToggle}
                                onKeyDown={handleOptionsKeyDown}
                                aria-expanded={isOptionsOpen}
                                aria-label="Toggle search options"
                                className="settings-item-header-button"
                            >
                                <div>
                                    <div className="settings-item-title">Search Options</div>
                                    <div className="settings-item-description">
                                        {settings.defaultSearchDepth} • {settings.maxResults}{' '}
                                        results
                                        {settings.includeImages ? ' • images' : ''}
                                    </div>
                                </div>
                                {isOptionsOpen ? (
                                    <ChevronUp size={16} />
                                ) : (
                                    <ChevronDown size={16} />
                                )}
                            </button>

                            {isOptionsOpen && (
                                <div
                                    style={{
                                        padding: '12px',
                                        borderTop: '1px solid var(--border-color)',
                                    }}
                                >
                                    {/* Search Depth */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label
                                            className="settings-item-title"
                                            style={{
                                                display: 'block',
                                                marginBottom: '6px',
                                            }}
                                            htmlFor="search-depth-select"
                                        >
                                            Default Search Depth
                                        </label>
                                        <select
                                            id="search-depth-select"
                                            className="settings-select"
                                            value={settings.defaultSearchDepth}
                                            onChange={(e) =>
                                                updateSettings({
                                                    defaultSearchDepth: e.target
                                                        .value as 'basic' | 'advanced',
                                                })
                                            }
                                            style={{ width: '100%' }}
                                        >
                                            <option value="basic">
                                                Basic - Faster, fewer results
                                            </option>
                                            <option value="advanced">
                                                Advanced - Thorough, more results
                                            </option>
                                        </select>
                                    </div>

                                    {/* Max Results */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label
                                            className="settings-item-title"
                                            style={{
                                                display: 'block',
                                                marginBottom: '6px',
                                            }}
                                            htmlFor="max-results-select"
                                        >
                                            Maximum Results
                                        </label>
                                        <select
                                            id="max-results-select"
                                            className="settings-select"
                                            value={settings.maxResults}
                                            onChange={(e) =>
                                                updateSettings({
                                                    maxResults: Number(e.target.value),
                                                })
                                            }
                                            style={{ width: '100%' }}
                                        >
                                            <option value={5}>5 results</option>
                                            <option value={10}>10 results (recommended)</option>
                                            <option value={15}>15 results</option>
                                            <option value={20}>20 results</option>
                                        </select>
                                    </div>

                                    {/* Include Images */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div className="settings-item-title">
                                                Include Images
                                            </div>
                                            <div className="settings-item-description">
                                                Show image results when available
                                            </div>
                                        </div>
                                        <Toggle
                                            checked={settings.includeImages}
                                            onChange={(checked) =>
                                                updateSettings({ includeImages: checked })
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                        </div>


                        {/* API Keys Accordion */}
                        <div
                            className="settings-item"
                            style={{ display: 'block', padding: 0 }}
                        >
                            <button
                                type="button"
                                onClick={handleApiKeysToggle}
                                onKeyDown={handleApiKeysKeyDown}
                                aria-expanded={isApiKeysOpen}
                                aria-label="Toggle API keys section"
                                className="settings-item-header-button"
                            >
                                <div>
                                    <div className="settings-item-title">
                                        <Key
                                            size={14}
                                            style={{
                                                display: 'inline',
                                                marginRight: '6px',
                                                verticalAlign: 'text-bottom',
                                            }}
                                        />
                                        API Key
                                    </div>
                                    <div className="settings-item-description">
                                        {apiKeys.tavily ? 'Configured ✓' : 'Not configured'}
                                    </div>
                                </div>
                                {isApiKeysOpen ? (
                                    <ChevronUp size={16} />
                                ) : (
                                    <ChevronDown size={16} />
                                )}
                            </button>

                            {isApiKeysOpen && (
                                <div
                                    style={{
                                        padding: '12px',
                                        borderTop: '1px solid var(--border-color)',
                                    }}
                                >
                                    {PROVIDERS.map((provider) => (
                                        <div key={provider.id} style={{ marginBottom: '16px' }}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '6px',
                                                }}
                                            >
                                                <label
                                                    className="settings-item-title"
                                                    htmlFor={`api-key-${provider.id}`}
                                                >
                                                    {provider.name} API Key
                                                </label>
                                                <a
                                                    href={provider.signupUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-secondary)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                    }}
                                                >
                                                    Get API key <ExternalLink size={10} />
                                                </a>
                                            </div>
                                            <div
                                                className="settings-item-description"
                                                style={{ marginBottom: '6px' }}
                                            >
                                                {provider.description}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    id={`api-key-${provider.id}`}
                                                    type="password"
                                                    className="settings-input"
                                                    placeholder={provider.placeholder}
                                                    value={apiKeys[provider.id] || ''}
                                                    onChange={(e) =>
                                                        updateApiKey(provider.id, e.target.value)
                                                    }
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => testConnection(provider)}
                                                    disabled={isTesting || !apiKeys[provider.id]}
                                                    className="settings-button"
                                                    aria-label={`Test ${provider.name} API key`}
                                                >
                                                    {isTesting ? (
                                                        <Loader2
                                                            size={12}
                                                            style={{
                                                                animation:
                                                                    'spin 1s linear infinite',
                                                            }}
                                                        />
                                                    ) : (
                                                        'Test'
                                                    )}
                                                </button>
                                            </div>

                                            {/* Test result display */}
                                            {testResult && testResult.provider === provider.id && (
                                                <div
                                                    style={{
                                                        marginTop: '8px',
                                                        padding: '8px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        background: testResult.success
                                                            ? 'rgba(34, 197, 94, 0.1)'
                                                            : 'rgba(239, 68, 68, 0.1)',
                                                        color: testResult.success
                                                            ? 'rgb(34, 197, 94)'
                                                            : 'rgb(239, 68, 68)',
                                                    }}
                                                >
                                                    {testResult.success ? (
                                                        <CheckCircle size={14} />
                                                    ) : (
                                                        <XCircle size={14} />
                                                    )}
                                                    {testResult.message}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SearchSettingsSection;
