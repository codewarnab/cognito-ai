/**
 * Model Selector Popover Component
 * 
 * Shows current provider icon button that opens a popover for model selection.
 * REFACTORED: Now dynamically renders models from providersConfig.
 * No hardcoded model lists - whatever is enabled in the webapp shows here.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, Settings2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Gemini } from '@assets/brands/integrations/Gemini';
import { ClaudeAI } from '@assets/brands/integrations/ClaudeAI';
import { Grok } from '@assets/brands/integrations/Grok';
import { OpenAI } from '@assets/brands/integrations/OpenAI';
import { VertexAI } from '@assets/brands/integrations/VertexAI';
import { getModelConfig, setModelConfig } from '@/utils/ai/modelSettings';
import {
    fetchEnabledModels,
    mapPopoverToConfig,
    mapConfigToPopover,
    type EnabledModel,
    type PopoverProviderType,
} from '@/utils/ai/modelSelectorUtils';
import { createLogger } from '~logger';
import { WEBAPP_BASE_URL } from '@/constants/webapp';

const log = createLogger('ModelSelectorPopover', 'UI_CHAT_COMPONENTS');

/** Supported AI providers for display */
type AIProviderType = 'google' | 'vertex' | 'anthropic' | 'xai' | 'openai';

interface ProviderInfo {
    id: AIProviderType;
    configName: string; // Name in providersConfig (e.g., 'google_gemini')
    name: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    color: string;
}

// Provider display info with mapping to config names
const PROVIDERS: ProviderInfo[] = [
    {
        id: 'google',
        configName: 'google_gemini',
        name: 'Google Gemini',
        icon: Gemini,
        color: '#4285F4',
    },
    {
        id: 'vertex',
        configName: 'vertex',
        name: 'Vertex AI',
        icon: VertexAI,
        color: '#FBBC04',
    },
    {
        id: 'anthropic',
        configName: 'anthropic',
        name: 'Anthropic Claude',
        icon: ClaudeAI,
        color: '#D97757',
    },
    {
        id: 'xai',
        configName: 'xai',
        name: 'xAI Grok',
        icon: Grok,
        color: '#FFFFFF',
    },
    {
        id: 'openai',
        configName: 'openai',
        name: 'OpenAI',
        icon: OpenAI,
        color: '#10A37F',
    },
];

// Map config provider names to popover provider IDs
const CONFIG_TO_POPOVER: Record<string, AIProviderType> = {
    google_gemini: 'google',
    vertex: 'vertex',
    anthropic: 'anthropic',
    xai: 'xai',
    openai: 'openai',
};

interface ModelSelectorPopoverProps {
    className?: string;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
}

export const ModelSelectorPopover: React.FC<ModelSelectorPopoverProps> = ({
    className,
    isOpen: controlledIsOpen,
    onOpenChange
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen ?? internalIsOpen;
    const setIsOpen = onOpenChange ?? setInternalIsOpen;

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

    const handleModelChange = async (modelId: string, provider: AIProviderType) => {
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
    };

    // Find current model info from enabledModels
    const currentModel = enabledModels.find(m => m.id === selectedModelId);
    const currentProviderInfo = PROVIDERS.find(p => p.id === selectedProvider) ?? PROVIDERS[0]!;
    const ProviderIcon = currentProviderInfo.icon;

    // Group enabled models by provider - DYNAMIC, no hardcoded list!
    // Filter by search query if present
    const modelsByProvider = useMemo(() => {
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
    const visibleItems = useMemo(() => {
        const items: Array<{ type: 'provider' | 'model', id: string, providerId: string, data: any }> = [];
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
    const handleKeyDown = (e: React.KeyboardEvent) => {
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
                    handleModelChange(item.data.id, item.providerId as AIProviderType);
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
    };

    // Scroll focused item into view
    useEffect(() => {
        if (!isOpen) return;
        const focusedElement = itemRefs.current[focusedIndex];
        if (focusedElement) {
            focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [focusedIndex, isOpen]);

    return (
        <div className={`relative flex items-center ${className || ''}`} onKeyDown={handleKeyDown}>
            <button
                ref={buttonRef}
                type="button"
                className="model-selector-btn flex items-center gap-1 h-[26px] px-1.5 rounded-md bg-transparent border-0 cursor-pointer transition-all duration-150 opacity-70 hover:opacity-100 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-(--color-primary,#3b82f6) focus-visible:outline-offset-2 focus-visible:opacity-100"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Current model: ${currentModel?.name || selectedModelId}. Click to change.`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <ProviderIcon className="w-4 h-4" />
                <ChevronDown
                    size={10}
                    className="text-(--text-tertiary,#6b7280) transition-transform duration-150"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={popoverRef}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute bottom-[calc(100%+8px)] left-0 min-w-[240px] max-w-[280px] bg-gradient-to-b from-[#1a1f2e] to-[#0f172a] border border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset] z-1000 overflow-hidden backdrop-blur-xl"
                        role="listbox"
                        aria-label="Select AI model"
                    >
                        {/* Subtle glow effect at top */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                        {/* Arrow pointer */}
                        <div className="absolute -bottom-1.5 left-4 rotate-45 w-3 h-3 bg-[#0f172a] border-r border-b border-white/[0.08]" />

                        {/* Search Input */}
                        <div className="px-2.5 pt-2.5 pb-1.5">
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setFocusedIndex(0);
                                    }}
                                    placeholder="Search models..."
                                    className="w-full h-8 pl-8 pr-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                                    onKeyDown={handleKeyDown}
                                />
                            </div>
                        </div>

                        {/* Empty state when no models are enabled */}
                        {modelsByProvider.length === 0 && !searchQuery && (
                            <div className="px-4 py-8 text-center">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/[0.05] flex items-center justify-center">
                                    <Settings2 size={18} className="text-white/40" />
                                </div>
                                <p className="text-[13px] text-white/70 font-medium">No models enabled</p>
                                <p className="text-[11px] text-white/40 mt-1">Configure providers to get started</p>
                            </div>
                        )}

                        {/* No search results */}
                        {modelsByProvider.length === 0 && searchQuery && (
                            <div className="px-4 py-6 text-center">
                                <p className="text-[12px] text-white/50">No models match "{searchQuery}"</p>
                            </div>
                        )}

                        {/* Scrollable model list */}
                        <div className="mcp-scrollable max-h-[280px] overflow-y-auto">
                            {/* Provider Groups - Dynamically generated */}
                            {modelsByProvider.map((providerGroup, groupIndex) => {
                                const GroupIcon = providerGroup.icon;
                                const isExpanded = expandedProviders.has(providerGroup.id);
                                const hasSelectedModel = providerGroup.models.some(
                                    m => m.id === selectedModelId && CONFIG_TO_POPOVER[m.providerId] === selectedProvider
                                );

                                // Calculate global index for this provider header
                                const providerGlobalIndex = visibleItems.findIndex(item => item.type === 'provider' && item.id === providerGroup.id);
                                const isFocused = providerGlobalIndex === focusedIndex;

                                return (
                                    <div key={providerGroup.id}>
                                        {/* Provider Header - Clickable to expand/collapse */}
                                        <button
                                            type="button"
                                            ref={el => { itemRefs.current[providerGlobalIndex] = el; }}
                                            onClick={() => toggleProvider(providerGroup.id)}
                                            className={`group flex items-center gap-2.5 w-full px-3 py-2.5 bg-transparent border-0 cursor-pointer transition-all duration-200 hover:bg-white/[0.04] ${groupIndex > 0 ? 'border-t border-white/[0.06]' : ''} ${isFocused ? 'ring-1 ring-inset ring-white/10' : ''}`}
                                        >
                                            <motion.span
                                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="shrink-0 opacity-50 group-hover:opacity-80 transition-opacity"
                                                style={{ color: providerGroup.color }}
                                            >
                                                <ChevronRight size={12} />
                                            </motion.span>
                                            <GroupIcon className="w-4 h-4 shrink-0" style={{ opacity: 0.9 }} />
                                            <span
                                                className="text-[11px] font-semibold uppercase tracking-wider flex-1 text-left transition-colors"
                                                style={{ color: providerGroup.color, opacity: isExpanded ? 1 : 0.7 }}
                                            >
                                                {providerGroup.name}
                                            </span>
                                            {/* Show selected model indicator when collapsed */}
                                            {!isExpanded && hasSelectedModel && (
                                                <div
                                                    className="w-5 h-5 rounded-full flex items-center justify-center"
                                                    style={{ backgroundColor: `${providerGroup.color}20` }}
                                                >
                                                    <Check size={12} style={{ color: providerGroup.color }} />
                                                </div>
                                            )}
                                        </button>

                                        {/* Models for this provider - Animated collapse */}
                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: 'auto' }}
                                                    exit={{ height: 0 }}
                                                    transition={{
                                                        type: 'spring',
                                                        stiffness: 200,
                                                        damping: 28,
                                                    }}
                                                    className="overflow-hidden"
                                                >
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 4 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="px-1.5 pb-2"
                                                    >
                                                        {providerGroup.models.map((model) => {
                                                            const modelProvider = CONFIG_TO_POPOVER[model.providerId];
                                                            const isSelected = selectedModelId === model.id && selectedProvider === modelProvider;

                                                            // Calculate global index for this model
                                                            const modelGlobalIndex = visibleItems.findIndex(item => item.type === 'model' && item.id === model.id && item.providerId === providerGroup.id);
                                                            const isModelFocused = modelGlobalIndex === focusedIndex;

                                                            return (
                                                                <button
                                                                    key={`${providerGroup.id}-${model.id}`}
                                                                    ref={el => { itemRefs.current[modelGlobalIndex] = el; }}
                                                                    type="button"
                                                                    className={`group relative flex items-center justify-between w-full px-3 py-1.5 bg-transparent border-0 rounded-lg cursor-pointer transition-all duration-200 text-left hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:-outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-white/[0.08]' : ''} ${isModelFocused ? 'ring-1 ring-inset ring-white/10' : ''}`}
                                                                    onClick={() => handleModelChange(model.id, providerGroup.id)}
                                                                    disabled={isLoading}
                                                                    role="option"
                                                                    aria-selected={isSelected}
                                                                >
                                                                    {/* Selected indicator bar */}
                                                                    {isSelected && (
                                                                        <div
                                                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                                                                            style={{ backgroundColor: providerGroup.color }}
                                                                        />
                                                                    )}
                                                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                                        <span className={`text-[13px] font-medium truncate transition-colors ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                                                                            {model.name}
                                                                        </span>
                                                                        <span className="text-[10px] text-white/40 line-clamp-2 leading-tight">
                                                                            {model.description}
                                                                        </span>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <div
                                                                            className="shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center"
                                                                            style={{ backgroundColor: `${providerGroup.color}25` }}
                                                                        >
                                                                            <Check size={12} style={{ color: providerGroup.color }} />
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </motion.div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Configure Providers Footer */}
                        <div className="border-t border-white/[0.06]">
                            <button
                                type="button"
                                onClick={() => {
                                    // Open webapp providers page
                                    chrome.tabs.create({ url: `${WEBAPP_BASE_URL}/providers` });
                                    setIsOpen(false);
                                }}
                                className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-transparent border-0 cursor-pointer transition-all duration-200 hover:bg-white/[0.04] group"
                            >
                                <Settings2 size={13} className="text-white/40 group-hover:text-white/60 transition-colors" />
                                <span className="text-[11px] font-medium text-white/50 group-hover:text-white/70 transition-colors">
                                    Configure Providers
                                </span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ModelSelectorPopover;
