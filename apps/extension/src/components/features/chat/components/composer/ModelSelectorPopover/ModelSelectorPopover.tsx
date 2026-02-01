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
import { useSettingsStore, type SettingsState, useCliModeStore, type CliModeState } from '@/stores';
import { Cloud, Key } from 'lucide-react';

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

    const useBackendMode = useSettingsStore((s: SettingsState) => s.useBackendMode);
    const setUseBackendMode = useSettingsStore((s: SettingsState) => s.setUseBackendMode);

    // Check if CLI mode is active (Cloud toggle should be hidden in CLI mode)
    const isCliProviderSelected = useCliModeStore((s: CliModeState) => s.isCliProviderSelected);

    const showCloudToggle = !isCliProviderSelected;

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
        setFocusedIndex(-1);
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
                {useBackendMode ? (
                    <Cloud className="w-4 h-4 shrink-0 text-violet-400" />
                ) : (
                    <ProviderIcon className="w-4 h-4 shrink-0" />
                )}
                <span className="flex items-center gap-1 min-w-0">
                    <span className="text-[12px] font-medium text-white/90 whitespace-nowrap">
                        {useBackendMode ? 'Cloud Backend' : currentProviderInfo.name}
                    </span>
                    <span className="text-white/40">·</span>
                    <span className="text-[12px] text-white/70 truncate max-w-[140px]">
                        {useBackendMode ? 'Auto-selected' : (currentModel?.name || selectedModelId)}
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
                        className="absolute bottom-[calc(100%+8px)] left-0 w-[300px] max-h-[340px] bg-[#1a1a1f] border border-white/[0.08] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] z-1000 overflow-hidden flex flex-col"
                        role="listbox"
                        aria-label="Select AI model"
                    >
                        <div className="flex flex-col min-h-0 flex-1">
                            {useBackendMode ? (
                                // Cloud Mode View
                                <div className="p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto mcp-scrollable">
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                        <Cloud className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                                        <div className="flex flex-col gap-1">
                                            <div className="text-sm font-medium text-violet-100">Cloud Backend Active</div>
                                            <div className="text-xs text-muted-foreground leading-normal">
                                                Using Cognito&apos;s hosted API. No API key required.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-xs text-amber-500/90 font-medium bg-amber-500/10 px-2 py-1.5 rounded-md w-fit">
                                            <span>Rate limits apply</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Model selection is managed automatically by the backend in this mode.
                                        </div>
                                    </div>

                                    {showCloudToggle && (
                                        <button
                                            type="button"
                                            onClick={() => setUseBackendMode(false)}
                                            className="mt-2 flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer text-xs font-medium text-white/80"
                                        >
                                            <Key size={14} className="text-emerald-500" />
                                            Switch to BYOK Mode
                                        </button>
                                    )}
                                </div>
                            ) : (
                                // BYOK View (Standard)
                                <>
                                    {/* Search Input - Full width at top */}
                                    <SearchInput
                                        value={searchQuery}
                                        onChange={(value) => {
                                            setSearchQuery(value);
                                            setFocusedIndex(-1);
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
                                        <div className="flex flex-1 min-h-0">
                                            {/* Left Sidebar - Provider Icons */}
                                            <ProviderSidebar
                                                providers={modelsByProvider}
                                                selectedProviderId={searchQuery.trim() ? (modelsByProvider[0]?.id || null) : effectiveViewingId}
                                                onProviderSelect={handleProviderSidebarSelect}
                                            />

                                            {/* Right Panel - Model List */}
                                            {searchQuery.trim() ? (
                                                // When searching, show all matching models
                                                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mcp-scrollable py-1">
                                                    {filteredBySearch.map(provider => (
                                                        <div key={provider.id}>
                                                            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06]">
                                                                <provider.icon className="w-3 h-3" />
                                                                <span className="text-[10px] font-medium text-white/60">
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
                                                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-all duration-150 mx-1 w-[calc(100%-8px)] rounded-lg cursor-pointer ${isSelected
                                                                            ? 'bg-white/[0.08]'
                                                                            : 'hover:bg-white/[0.04]'
                                                                            }`}
                                                                    >
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className={`text-[12px] block truncate ${isSelected ? 'text-white font-medium' : 'text-white/85'}`}>
                                                                                {model.name}
                                                                            </span>
                                                                            <span className="text-[10px] text-white/45 block truncate">
                                                                                {model.description}
                                                                            </span>
                                                                        </div>
                                                                        {isSelected && (
                                                                            <svg className="w-3.5 h-3.5 shrink-0 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                                        className="flex-1 min-h-0 overflow-hidden flex"
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

                                </>
                            )}
                        </div>

                        <div className="shrink-0">
                            {/* Configure Providers Footer */}
                            <ConfigureProvidersFooter
                                onClose={() => setIsOpen(false)}
                                showCloudToggle={!useBackendMode && showCloudToggle}
                                onSwitchToCloudMode={() => setUseBackendMode(true)}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ModelSelectorPopover;
