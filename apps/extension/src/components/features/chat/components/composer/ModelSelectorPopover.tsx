/**
 * Model Selector Popover Component
 * Shows current provider icon button that opens a popover for model selection.
 * Supports multiple AI providers (Gemini, Claude) with grouped model options.
 * Syncs with ProviderSetup model configuration.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Gemini } from '@assets/brands/integrations/Gemini';
import { ClaudeAI } from '@assets/brands/integrations/ClaudeAI';
import { Grok } from '@assets/brands/integrations/Grok';
import { OpenAI } from '@assets/brands/integrations/OpenAI';
import { VertexAI } from '@assets/brands/integrations/VertexAI';
import { getModelConfig, setModelConfig } from '@/utils/ai/modelSettings';
import {
    fetchEnabledModels,
    isModelEnabled,
    mapPopoverToConfig,
    mapConfigToPopover,
    type EnabledModel,
    type PopoverProviderType,
} from '@/utils/ai/modelSelectorUtils';
import { createLogger } from '~logger';
import type { RemoteModelType } from '@/ai/types/types';

const log = createLogger('ModelSelectorPopover', 'UI_CHAT_COMPONENTS');

/** Supported AI providers */
type AIProviderType = 'google' | 'vertex' | 'anthropic' | 'xai' | 'openai';

interface ProviderInfo {
    id: AIProviderType;
    name: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    color: string;
}

interface ModelOption {
    id: RemoteModelType;
    name: string;
    description: string;
    provider: AIProviderType;
}

const PROVIDERS: ProviderInfo[] = [
    {
        id: 'google',
        name: 'Google Gemini',
        icon: Gemini,
        color: '#4285F4',
    },
    {
        id: 'vertex',
        name: 'Vertex AI',
        icon: VertexAI,
        color: '#FBBC04',
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        icon: ClaudeAI,
        color: '#D97757',
    },
    {
        id: 'xai',
        name: 'xAI Grok',
        icon: Grok,
        color: '#FFFFFF',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        icon: OpenAI,
        color: '#10A37F',
    },
];

const MODEL_OPTIONS: ModelOption[] = [
    // Google Gemini Models
    {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        description: 'Fast and efficient for most tasks',
        provider: 'google',
    },
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        description: 'Most capable model for complex tasks',
        provider: 'google',
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Advanced capabilities for complex tasks',
        provider: 'google',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Previous generation flash model',
        provider: 'google',
    },
    // Vertex AI Models (same Gemini models via Google Cloud)
    {
        id: 'gemini-2.5-pro' as RemoteModelType,
        name: 'Gemini 2.5 Pro',
        description: 'Via Google Cloud Vertex AI',
        provider: 'vertex',
    },
    {
        id: 'gemini-2.5-flash' as RemoteModelType,
        name: 'Gemini 2.5 Flash',
        description: 'Via Google Cloud Vertex AI',
        provider: 'vertex',
    },
    // Anthropic Claude Models
    {
        id: 'claude-sonnet-4-20250514' as RemoteModelType,
        name: 'Claude Sonnet 4',
        description: 'Latest Claude model, balanced performance',
        provider: 'anthropic',
    },
    {
        id: 'claude-3-5-sonnet-20241022' as RemoteModelType,
        name: 'Claude 3.5 Sonnet',
        description: 'Fast and intelligent',
        provider: 'anthropic',
    },
    {
        id: 'claude-3-5-haiku-20241022' as RemoteModelType,
        name: 'Claude 3.5 Haiku',
        description: 'Fastest Claude model',
        provider: 'anthropic',
    },
    // xAI Grok Models
    {
        id: 'grok-3' as RemoteModelType,
        name: 'Grok 3',
        description: 'Most capable Grok model',
        provider: 'xai',
    },
    {
        id: 'grok-3-mini' as RemoteModelType,
        name: 'Grok 3 Mini',
        description: 'Fast and efficient',
        provider: 'xai',
    },
    // OpenAI Models
    {
        id: 'gpt-4.1' as RemoteModelType,
        name: 'GPT-4.1',
        description: 'Most capable OpenAI model',
        provider: 'openai',
    },
    {
        id: 'gpt-4.1-mini' as RemoteModelType,
        name: 'GPT-4.1 Mini',
        description: 'Fast and cost-effective',
        provider: 'openai',
    },
];

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

    const [selectedModel, setSelectedModel] = useState<RemoteModelType>('gemini-3-flash-preview');
    const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('google');
    const [expandedProviders, setExpandedProviders] = useState<Set<AIProviderType>>(new Set(['google']));
    const [isLoading, setIsLoading] = useState(false);
    const [enabledModels, setEnabledModels] = useState<EnabledModel[]>([]);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Toggle provider section expansion (only one at a time)
    const toggleProvider = useCallback((providerId: AIProviderType) => {
        setExpandedProviders(prev => {
            // If already expanded, collapse it; otherwise expand only this one
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
            // Use stored provider if available, otherwise infer from MODEL_OPTIONS
            const storedProvider = config.remoteProvider
                ? (mapConfigToPopover(config.remoteProvider) || 'google')
                : (MODEL_OPTIONS.find(m => m.id === config.remoteModel)?.provider || 'google');
            setSelectedModel(config.remoteModel);
            setSelectedProvider(storedProvider);
            // Auto-expand the selected provider
            setExpandedProviders(new Set([storedProvider]));
        } catch (error) {
            log.error('Failed to load model config', error);
        }
    }, []);

    // Load enabled models from providers config
    const loadEnabledModels = useCallback(async () => {
        try {
            const models = await fetchEnabledModels();
            setEnabledModels(models);
            log.debug('Loaded enabled models', { count: models.length });
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
                            : (MODEL_OPTIONS.find(m => m.id === newConfig.remoteModel)?.provider || 'google');
                        setSelectedModel(newConfig.remoteModel);
                        setSelectedProvider(provider);
                        log.info('Model synced from storage', { model: newConfig.remoteModel, provider });
                    }
                }
                // Sync enabled models when webapp updates providersConfig
                if (changes.providersConfigLastUpdated) {
                    log.info('Providers config changed, refreshing enabled models');
                    loadEnabledModels();
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

    const handleModelChange = async (model: RemoteModelType, provider: AIProviderType) => {
        // Check if this exact model+provider is already selected
        if (model === selectedModel && provider === selectedProvider) return;
        if (isLoading) return;

        setIsLoading(true);
        try {
            const configProvider = mapPopoverToConfig(provider);
            await setModelConfig({ remoteModel: model, remoteProvider: configProvider });
            setSelectedModel(model);
            setSelectedProvider(provider);
            log.info('Model changed', { model, provider, configProvider });
            setIsOpen(false);
        } catch (error) {
            log.error('Failed to save model config', error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentModel = MODEL_OPTIONS.find(m => m.id === selectedModel && m.provider === selectedProvider);
    const currentProviderInfo = PROVIDERS.find(p => p.id === selectedProvider) ?? PROVIDERS[0]!;
    const ProviderIcon = currentProviderInfo.icon;

    // Filter and group models by provider based on enabled models from webapp
    const modelsByProvider = useMemo(() => {
        return PROVIDERS.map(provider => {
            const filteredModels = MODEL_OPTIONS
                .filter(m => m.provider === provider.id)
                .filter(m => {
                    // If no enabled models loaded yet, show all (fallback)
                    if (enabledModels.length === 0) return true;
                    // Check if this model+provider is enabled in webapp config
                    return isModelEnabled(enabledModels, m.id, provider.id as PopoverProviderType);
                });
            return {
                ...provider,
                models: filteredModels,
            };
        }).filter(p => p.models.length > 0); // Hide providers with no enabled models
    }, [enabledModels]);

    return (
        <div className={`relative flex items-center ${className || ''}`}>
            <button
                ref={buttonRef}
                type="button"
                className="model-selector-btn flex items-center gap-1 h-[26px] px-1.5 rounded-md bg-transparent border-0 cursor-pointer transition-all duration-150 opacity-70 hover:opacity-100 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-(--color-primary,#3b82f6) focus-visible:outline-offset-2 focus-visible:opacity-100"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Current model: ${currentModel?.name || selectedModel}. Click to change.`}
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
                        className="absolute bottom-[calc(100%+8px)] left-0 min-w-[200px] bg-(--bg-secondary,#0f172a) border border-(--border-color,rgba(255,255,255,0.1)) rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-1000 overflow-hidden"
                        role="listbox"
                        aria-label="Select AI model"
                    >
                        <div className="absolute -bottom-1.5 left-4 rotate-45 w-3 h-3 bg-(--bg-secondary,#0f172a) border-r border-b border-(--border-color,rgba(255,255,255,0.1))" />

                        {/* Provider Groups */}
                        {modelsByProvider.map((providerGroup, groupIndex) => {
                            const GroupIcon = providerGroup.icon;
                            const isExpanded = expandedProviders.has(providerGroup.id);
                            const hasSelectedModel = providerGroup.models.some(
                                m => m.id === selectedModel && providerGroup.id === selectedProvider
                            );

                            return (
                                <div key={providerGroup.id}>
                                    {/* Provider Header - Clickable to expand/collapse */}
                                    <button
                                        type="button"
                                        onClick={() => toggleProvider(providerGroup.id)}
                                        className={`flex items-center gap-2 w-full px-3 pt-2.5 pb-1.5 bg-transparent border-0 cursor-pointer transition-colors duration-150 hover:bg-white/[0.03] ${groupIndex > 0 ? 'border-t border-(--border-color,rgba(255,255,255,0.08))' : ''}`}
                                    >
                                        <motion.span
                                            animate={{ rotate: isExpanded ? 90 : 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="shrink-0"
                                            style={{ color: providerGroup.color, opacity: 0.7 }}
                                        >
                                            <ChevronRight size={12} />
                                        </motion.span>
                                        <GroupIcon className="w-3.5 h-3.5" style={{ opacity: 0.8 }} />
                                        <span
                                            className="text-[10px] font-semibold uppercase tracking-[0.5px] flex-1 text-left"
                                            style={{ color: providerGroup.color, opacity: 0.9 }}
                                        >
                                            {providerGroup.name}
                                        </span>
                                        {/* Show selected model indicator when collapsed */}
                                        {!isExpanded && hasSelectedModel && (
                                            <Check size={12} className="shrink-0" style={{ color: providerGroup.color }} />
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
                                                    stiffness: 180,
                                                    damping: 26,
                                                }}
                                                className="overflow-hidden"
                                            >
                                                <motion.div
                                                    initial={{ opacity: 0, y: 4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 4 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="px-1 pb-1"
                                                >
                                                    {providerGroup.models.map((model) => (
                                                        <button
                                                            key={`${providerGroup.id}-${model.id}`}
                                                            type="button"
                                                            className={`flex items-center justify-between w-full px-2.5 py-2 bg-transparent border-0 rounded-lg cursor-pointer transition-colors duration-150 text-left hover:bg-(--bg-tertiary,rgba(255,255,255,0.06)) focus-visible:outline-2 focus-visible:outline-(--color-primary,#3b82f6) focus-visible:-outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${selectedModel === model.id && selectedProvider === providerGroup.id ? 'bg-white/[0.06]' : ''}`}
                                                            onClick={() => handleModelChange(model.id, providerGroup.id)}
                                                            disabled={isLoading}
                                                            role="option"
                                                            aria-selected={selectedModel === model.id && selectedProvider === providerGroup.id}
                                                        >
                                                            <div className="flex flex-col gap-0">
                                                                <span className="text-[13px] font-medium text-(--text-primary,#ffffff)">{model.name}</span>
                                                                <span className="text-[10px] text-(--text-tertiary,#6b7280)">{model.description}</span>
                                                            </div>
                                                            {selectedModel === model.id && selectedProvider === providerGroup.id && (
                                                                <Check size={14} className="shrink-0" style={{ color: providerGroup.color }} />
                                                            )}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ModelSelectorPopover;
