/**
 * Provider Group Component
 * 
 * Collapsible provider section with models
 */

import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AIProviderType, ProviderGroup as ProviderGroupType, VisibleItem } from '../types';
import { ModelItem } from './ModelItem';

interface ProviderGroupProps {
    providerGroup: ProviderGroupType;
    groupIndex: number;
    isExpanded: boolean;
    selectedModelId: string;
    selectedProvider: AIProviderType;
    isLoading: boolean;
    focusedIndex: number;
    visibleItems: VisibleItem[];
    itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
    onToggle: (providerId: AIProviderType) => void;
    onModelSelect: (modelId: string, provider: AIProviderType) => void;
}

export const ProviderGroup: React.FC<ProviderGroupProps> = ({
    providerGroup,
    groupIndex,
    isExpanded,
    selectedModelId,
    selectedProvider,
    isLoading,
    focusedIndex,
    visibleItems,
    itemRefs,
    onToggle,
    onModelSelect,
}) => {
    const GroupIcon = providerGroup.icon;
    const isUnavailable = !providerGroup.isAvailable;
    // Check if this provider group has the selected model
    // Use the provider group ID directly to ensure CLI providers don't show checkmarks for cloud providers
    const hasSelectedModel = providerGroup.models.some(
        m => m.id === selectedModelId && providerGroup.id === selectedProvider
    );

    // Calculate global index for this provider header
    const providerGlobalIndex = visibleItems.findIndex(
        item => item.type === 'provider' && item.id === providerGroup.id
    );
    const isFocused = providerGlobalIndex === focusedIndex;

    return (
        <div className={isUnavailable ? 'opacity-50' : ''}>
            {/* Provider Header - Clickable to expand/collapse */}
            <button
                type="button"
                ref={el => { itemRefs.current[providerGlobalIndex] = el; }}
                onClick={() => !isUnavailable && onToggle(providerGroup.id)}
                disabled={isUnavailable}
                title={isUnavailable ? `${providerGroup.name} is not installed or available` : undefined}
                className={`group flex items-center gap-2.5 w-full px-3 py-2.5 bg-transparent border-0 transition-all duration-200 ${isUnavailable ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.04]'} ${groupIndex > 0 ? 'border-t border-white/[0.06]' : ''} ${isFocused ? 'ring-1 ring-inset ring-white/10' : ''}`}
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
                {/* Show unavailable badge for CLI providers that aren't installed */}
                {isUnavailable && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 uppercase tracking-wider">
                        Not installed
                    </span>
                )}
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
                                // Calculate global index for this model
                                const modelGlobalIndex = visibleItems.findIndex(
                                    item => item.type === 'model' && item.id === model.id && item.providerId === providerGroup.id
                                );
                                const isModelFocused = modelGlobalIndex === focusedIndex;

                                return (
                                    <ModelItem
                                        key={`${providerGroup.id}-${model.id}`}
                                        model={model}
                                        providerColor={providerGroup.color}
                                        providerId={providerGroup.id}
                                        selectedModelId={selectedModelId}
                                        selectedProvider={selectedProvider}
                                        isLoading={isLoading}
                                        isFocused={isModelFocused}
                                        itemRef={el => { itemRefs.current[modelGlobalIndex] = el; }}
                                        onSelect={onModelSelect}
                                    />
                                );
                            })}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProviderGroup;
