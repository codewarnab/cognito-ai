/**
 * Model Selector Popover Component
 * 
 * Shows current provider icon button that opens a popover for model selection.
 * REFACTORED: Now dynamically renders models from providersConfig.
 * No hardcoded model lists - whatever is enabled in the webapp shows here.
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ModelSelectorPopoverProps } from './types';
import { useModelSelector } from './hooks/useModelSelector';
import {
    SearchInput,
    ProviderGroup,
    NoModelsEnabled,
    NoSearchResults,
    ConfigureProvidersFooter,
} from './components';

export const ModelSelectorPopover: React.FC<ModelSelectorPopoverProps> = ({
    className,
    isOpen: controlledIsOpen,
    onOpenChange
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen ?? internalIsOpen;
    const setIsOpen = onOpenChange ?? setInternalIsOpen;

    const {
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
    } = useModelSelector({ isOpen, setIsOpen });

    const ProviderIcon = currentProviderInfo.icon;

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
                        {modelsByProvider.length === 0 && searchQuery && (
                            <NoSearchResults query={searchQuery} />
                        )}

                        {/* Scrollable model list */}
                        <div className="mcp-scrollable max-h-[280px] overflow-y-auto">
                            {/* Provider Groups - Dynamically generated */}
                            {modelsByProvider.map((providerGroup, groupIndex) => (
                                <ProviderGroup
                                    key={providerGroup.id}
                                    providerGroup={providerGroup}
                                    groupIndex={groupIndex}
                                    isExpanded={expandedProviders.has(providerGroup.id)}
                                    selectedModelId={selectedModelId}
                                    selectedProvider={selectedProvider}
                                    isLoading={isLoading}
                                    focusedIndex={focusedIndex}
                                    visibleItems={visibleItems}
                                    itemRefs={itemRefs}
                                    onToggle={toggleProvider}
                                    onModelSelect={handleModelChange}
                                />
                            ))}
                        </div>

                        {/* Configure Providers Footer */}
                        <ConfigureProvidersFooter onClose={() => setIsOpen(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ModelSelectorPopover;
