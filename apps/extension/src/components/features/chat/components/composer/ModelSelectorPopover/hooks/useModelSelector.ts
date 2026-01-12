/**
 * Custom hook for Model Selector state and logic
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getModelConfig, setModelConfig } from '@/utils/ai/modelSettings';
import {
    fetchEnabledModels,
    mapPopoverToConfig,
    mapConfigToPopover,
    type EnabledModel,
    type PopoverProviderType,
} from '@/utils/ai/modelSelectorUtils';
import { createLogger } from '~logger';
import type { AIProviderType, ProviderGroup, VisibleItem } from '../types';
import { PROVIDERS, CONFIG_TO_POPOVER } from '../constants';

const log = createLogger('ModelSelectorPopover', 'UI_CHAT_COMPONENTS');

interface UseModelSelectorOptions {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export function useModelSelector({ isOpen, setIsOpen }: UseModelSelectorOptions) {
    const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3-flash-preview');
    const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('google');
    const [expandedProviders, setExpandedProviders] = useState<Set<AIProviderType>>(new Set(['google']));
    const [isLoading, setIsLoading] = useState(false);
    const [enabledModels, setEnabledModels] = useState<EnabledModel[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);

    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Toggle provider section expansion (only one at a time)
    const toggleProvider = useCallback((providerId: AIProviderType) => {
        setExpandedProviders(prev => {
            if (prev.has(providerId)) {
                return new Set();
            }
            return new Set([providerId]);
        });
    }, []);

    // Load current model from storage
    const loadModel = useCallback(async () => {
        try {
            const config = await getModelConfig();
            const storedProvider = config.remoteProvider
                ? (mapConfigToPopover(config.remoteProvider) || 'google')
                : 'google';
            setSelectedModelId(config.remoteModel);
            setSelectedProvider(storedProvider);
            setExpandedProviders(new Set([storedProvider]));
        } catch (error) {
            log.error('Failed to load model config', error);
        }
    }, []);

    // Load enabled models from providers config
    const loadEnabledModels = useCallback(async (forceRefresh = false) => {
        try {
            const models = await fetchEnabledModels(forceRefresh);
            setEnabledModels(models);
            log.debug('Loaded enabled models', { count: models.length, forceRefresh });
        } catch (error) {
            log.error('Failed to load enabled models', error);
        }
    }, []);

    // Initial load and storage change listener
    useEffect(() => {
        loadModel();
        loadEnabledModels();

        // Listen for storage changes to sync with ProviderSetup and webapp
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local') {
                // Sync model selection
                if (changes.ai_model_config) {
                    const newConfig = changes.ai_model_config.newValue;
                    if (newConfig?.remoteModel) {
                        const provider = newConfig.remoteProvider
                            ? (mapConfigToPopover(newConfig.remoteProvider) || 'google')
                            : 'google';
                        setSelectedModelId(newConfig.remoteModel);
                        setSelectedProvider(provider);
                        log.info('Model synced from storage', { model: newConfig.remoteModel, provider });
                    }
                }
                // Sync enabled models when webapp updates providersConfig
                if (changes.providersConfigLastUpdated) {
                    log.info('Providers config changed, refreshing enabled models with cache clear');
                    loadEnabledModels(true); // Force refresh to clear stale cache
                }
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, [loadModel, loadEnabledModels]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, setIsOpen]);

    // Handle model change
    const handleModelChange = useCallback(async (modelId: string, provider: AIProviderType) => {
        // Check if this exact model+provider is already selected
        if (modelId === selectedModelId && provider === selectedProvider) return;
        if (isLoading) return;

        setIsLoading(true);
        try {
            const configProvider = mapPopoverToConfig(provider as PopoverProviderType);
            await setModelConfig({ remoteModel: modelId as any, remoteProvider: configProvider });
            setSelectedModelId(modelId);
            setSelectedProvider(provider);
            log.info('Model changed', { model: modelId, provider, configProvider });
            setIsOpen(false);
        } catch (error) {
            log.error('Failed to save model config', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedModelId, selectedProvider, isLoading, setIsOpen]);

    // Find current model info from enabledModels
    const currentModel = enabledModels.find(m => m.id === selectedModelId);
    const currentProviderInfo = PROVIDERS.find(p => p.id === selectedProvider) ?? PROVIDERS[0]!;

    // Group enabled models by provider - DYNAMIC, no hardcoded list!
    // Filter by search query if present
    const modelsByProvider = useMemo((): ProviderGroup[] => {
        if (enabledModels.length === 0) {
            // No models loaded yet - show empty state
            return [];
        }

        const query = searchQuery.toLowerCase().trim();

        return PROVIDERS.map(provider => {
            // Filter enabled models for this provider
            let providerModels = enabledModels.filter(m => {
                const popoverProvider = CONFIG_TO_POPOVER[m.providerId];
                return popoverProvider === provider.id;
            });

            // Apply search filter if query exists
            if (query) {
                providerModels = providerModels.filter(m =>
                    m.name.toLowerCase().includes(query) ||
                    m.description.toLowerCase().includes(query)
                );
            }

            return {
                ...provider,
                models: providerModels,
            };
        }).filter(p => p.models.length > 0); // Hide providers with no enabled/matching models
    }, [enabledModels, searchQuery]);

    // Auto-expand all providers when searching
    useEffect(() => {
        if (searchQuery.trim()) {
            // Expand all providers that have matching models
            setExpandedProviders(new Set(modelsByProvider.map(p => p.id)));
        }
    }, [searchQuery, modelsByProvider]);

    // Focus search input when popover opens and reset focus
    useEffect(() => {
        if (isOpen) {
            setFocusedIndex(0);
            if (searchInputRef.current) {
                // Small delay to let animation start
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
        } else {
            setSearchQuery('');
        }
    }, [isOpen]);

    // Flatten visible items for navigation
    const visibleItems = useMemo((): VisibleItem[] => {
        const items: VisibleItem[] = [];
        modelsByProvider.forEach(p => {
            items.push({ type: 'provider', id: p.id, providerId: p.id, data: p });
            if (expandedProviders.has(p.id)) {
                p.models.forEach(m => {
                    items.push({ type: 'model', id: m.id, providerId: p.id, data: m });
                });
            }
        });
        return items;
    }, [modelsByProvider, expandedProviders]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, visibleItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter': {
                e.preventDefault();
                const item = visibleItems[focusedIndex];
                if (!item) return;

                if (item.type === 'provider') {
                    toggleProvider(item.providerId as AIProviderType);
                } else {
                    handleModelChange((item.data as EnabledModel).id, item.providerId as AIProviderType);
                }
                break;
            }
            case 'ArrowRight': {
                const item = visibleItems[focusedIndex];
                if (item?.type === 'provider' && !expandedProviders.has(item.providerId as AIProviderType)) {
                    toggleProvider(item.providerId as AIProviderType);
                }
                break;
            }
            case 'ArrowLeft': {
                const item = visibleItems[focusedIndex];
                if (item?.type === 'provider' && expandedProviders.has(item.providerId as AIProviderType)) {
                    toggleProvider(item.providerId as AIProviderType);
                }
                break;
            }
            case 'Escape':
                setIsOpen(false);
                break;
        }
    }, [isOpen, visibleItems, focusedIndex, toggleProvider, handleModelChange, expandedProviders, setIsOpen]);

    // Scroll focused item into view
    useEffect(() => {
        if (!isOpen) return;
        const focusedElement = itemRefs.current[focusedIndex];
        if (focusedElement) {
            focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [focusedIndex, isOpen]);

    return {
        // State
        selectedModelId,
        selectedProvider,
        expandedProviders,
        isLoading,
        searchQuery,
        focusedIndex,
        currentModel,
        currentProviderInfo,
        modelsByProvider,
        visibleItems,

        // Setters
        setSearchQuery,
        setFocusedIndex,

        // Refs
        popoverRef,
        buttonRef,
        searchInputRef,
        itemRefs,

        // Handlers
        toggleProvider,
        handleModelChange,
        handleKeyDown,
    };
}
