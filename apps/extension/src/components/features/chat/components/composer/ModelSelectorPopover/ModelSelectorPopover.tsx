/**
 * Model Selector Popover Component
 * 
 * Shows current provider icon button that opens a popover for model selection.
 * Split-panel layout with provider icons on left, models on right.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ModelSelectorPopoverProps } from './types';
import { useModelSelector } from './hooks/useModelSelector';
import {
    SearchInput,
    ProviderSidebar,
    ModelListPanel,
    NoModelsEnabled,
    NoSearchResults,
    ConfigureProvidersFooter,
} from './components';
import type { AIProviderType } from './types';

export const ModelSelectorPopover: React.FC<ModelSelectorPopoverProps> = ({
    className,
    isOpen: controlledIsOpen,
    onOpenChange
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen ?? internalIsOpen;
    const setIsOpen = onOpenChange ?? setInternalIsOpen;

    // Track which provider is being viewed in the right panel
    const [viewingProviderId, setViewingProviderId] = useState<AIProviderType | null>(null);

    const {
        // State
        selectedModelId,
        selectedProvider,
        isLoading,
        searchQuery,
        focusedIndex,
        currentModel,
        currentProviderInfo,
        modelsByProvider,

        // Setters
        setSearchQuery,
        setFocusedIndex,

        // Refs
        popoverRef,
        buttonRef,
        searchInputRef,
        itemRefs,

        // Handlers
        handleModelChange,
        handleKeyDown,
    } = useModelSelector({ isOpen, setIsOpen });

    const ProviderIcon = currentProviderInfo.icon;

    // Get the currently viewing provider group - default to selected provider or first available
    const effectiveViewingId = viewingProviderId || selectedProvider || modelsByProvider[0]?.id || null;
    const viewingProviderGroup = modelsByProvider.find(p => p.id === effectiveViewingId) || modelsByProvider[0] || null;

    // Auto-select first provider when popover opens
    useEffect(() => {
        if (isOpen && !viewingProviderId && modelsByProvider.length > 0) {
            setViewingProviderId(selectedProvider || modelsByProvider[0]?.id || null);
        }
    }, [isOpen, viewingProviderId, modelsByProvider, selectedProvider]);

    // Handle provider sidebar selection
    const handleProviderSidebarSelect = (providerId: AIProviderType) => {
        setViewingProviderId(providerId);
        setFocusedIndex(0);
    };

    // Filter models by search query across all providers when searching
    const filteredBySearch = searchQuery.trim()
        ? modelsByProvider.filter(p => p.models.length > 0)
        : modelsByProvider;

    return (
        <div className={`relative flex items-center ${className || ''}`} onKeyDown={handleKeyDown}>
            <button
                ref={buttonRef}
                type="button"
                className="model-selector-btn flex items-center gap-2 h-8 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] cursor-pointer transition-all duration-150 hover:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-(--color-primary,#3b82f6) focus-visible:outline-offset-2"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Current model: ${currentModel?.name || selectedModelId}. Click to change.`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <ProviderIcon className="w-4 h-4 shrink-0" />
                <span className="flex items-center gap-1 min-w-0">
                    <span className="text-[12px] font-medium text-white/90 whitespace-nowrap">
                        {currentProviderInfo.name}
                    </span>
                    <span className="text-white/40">·</span>
                    <span className="text-[12px] text-white/70 truncate max-w-[140px]">
                        {currentModel?.name || selectedModelId}
                    </span>
                </span>
                <ChevronDown
                    size={10}
                    className="ml-auto shrink-0 text-(--text-tertiary,#6b7280) transition-transform duration-150"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={popoverRef}
                        initial={{ opacity: 0, y: 8, scale: 0.96, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 8, scale: 0.96, filter: 'blur(6px)' }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="absolute bottom-[calc(100%+8px)] left-0 w-[300px] bg-popover border border-border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-1000 overflow-hidden"
                        role="listbox"
                        aria-label="Select AI model"
                    >
                        {/* Search Input - Full width at top */}
                        <SearchInput
                            value={searchQuery}
                            onChange={(value) => {
                                setSearchQuery(value);
                                setFocusedIndex(0);
                            }}
                            onKeyDown={handleKeyDown}
                            inputRef={searchInputRef}
                        />

                        {/* Empty state when no models are enabled */}
                        {modelsByProvider.length === 0 && !searchQuery && <NoModelsEnabled />}

                        {/* No search results */}
                        {filteredBySearch.length === 0 && searchQuery && (
                            <NoSearchResults query={searchQuery} />
                        )}

                        {/* Split Panel Layout */}
                        {modelsByProvider.length > 0 && (
                            <div className="flex h-[280px]">
                                {/* Left Sidebar - Provider Icons */}
                                <ProviderSidebar
                                    providers={modelsByProvider}
                                    selectedProviderId={searchQuery.trim() ? (modelsByProvider[0]?.id || null) : effectiveViewingId}
                                    onProviderSelect={handleProviderSidebarSelect}
                                />

                                {/* Right Panel - Model List */}
                                {searchQuery.trim() ? (
                                    // When searching, show all matching models
                                    <div className="flex-1 overflow-y-auto mcp-scrollable">
                                        {filteredBySearch.map(provider => (
                                            <div key={provider.id}>
                                                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
                                                    <provider.icon className="w-3 h-3 text-muted-foreground" />
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {provider.name}
                                                    </span>
                                                </div>
                                                {provider.models.map((model) => {
                                                    const isSelected = selectedModelId === model.id && selectedProvider === provider.id;
                                                    return (
                                                        <button
                                                            key={`${provider.id}-${model.id}`}
                                                            type="button"
                                                            onClick={() => handleModelChange(model.id, provider.id)}
                                                            disabled={isLoading}
                                                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                                                                }`}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <span className={`text-[12px] block truncate ${isSelected ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                                                                    {model.name}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground block truncate">
                                                                    {model.description}
                                                                </span>
                                                            </div>
                                                            {isSelected && (
                                                                <svg className="w-3.5 h-3.5 shrink-0 text-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={effectiveViewingId}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.12, ease: 'easeOut' }}
                                            className="flex-1 overflow-hidden"
                                        >
                                            <ModelListPanel
                                                providerGroup={viewingProviderGroup}
                                                selectedModelId={selectedModelId}
                                                selectedProvider={selectedProvider}
                                                isLoading={isLoading}
                                                focusedIndex={focusedIndex}
                                                itemRefs={itemRefs}
                                                onModelSelect={handleModelChange}
                                            />
                                        </motion.div>
                                    </AnimatePresence>
                                )}
                            </div>
                        )}

                        {/* Configure Providers Footer */}
                        <ConfigureProvidersFooter onClose={() => setIsOpen(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ModelSelectorPopover;
