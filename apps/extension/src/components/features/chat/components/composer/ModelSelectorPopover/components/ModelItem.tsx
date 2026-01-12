/**
 * Model Item Component
 * 
 * Individual model button in the selector popover
 */

import React from 'react';
import { Check } from 'lucide-react';
import type { EnabledModel } from '@/utils/ai/modelSelectorUtils';
import type { AIProviderType } from '../types';
import { CONFIG_TO_POPOVER } from '../constants';

interface ModelItemProps {
    model: EnabledModel;
    providerColor: string;
    providerId: AIProviderType;
    selectedModelId: string;
    selectedProvider: AIProviderType;
    isLoading: boolean;
    isFocused: boolean;
    itemRef: (el: HTMLButtonElement | null) => void;
    onSelect: (modelId: string, provider: AIProviderType) => void;
}

export const ModelItem: React.FC<ModelItemProps> = ({
    model,
    providerColor,
    providerId,
    selectedModelId,
    selectedProvider,
    isLoading,
    isFocused,
    itemRef,
    onSelect,
}) => {
    const modelProvider = CONFIG_TO_POPOVER[model.providerId];
    const isSelected = selectedModelId === model.id && selectedProvider === modelProvider;

    return (
        <button
            ref={itemRef}
            type="button"
            className={`group relative flex items-center justify-between w-full px-3 py-1.5 bg-transparent border-0 rounded-lg cursor-pointer transition-all duration-200 text-left hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:-outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-white/[0.08]' : ''} ${isFocused ? 'ring-1 ring-inset ring-white/10' : ''}`}
            onClick={() => onSelect(model.id, providerId)}
            disabled={isLoading}
            role="option"
            aria-selected={isSelected}
        >
            {/* Selected indicator bar */}
            {isSelected && (
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                    style={{ backgroundColor: providerColor }}
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
                    style={{ backgroundColor: `${providerColor}25` }}
                >
                    <Check size={12} style={{ color: providerColor }} />
                </div>
            )}
        </button>
    );
};

export default ModelItem;
