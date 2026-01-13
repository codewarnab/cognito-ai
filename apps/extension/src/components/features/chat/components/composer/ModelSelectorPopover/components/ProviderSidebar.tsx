/**
 * Provider Sidebar Component
 * 
 * Vertical sidebar with provider icons for the split-panel model selector
 */

import React from 'react';
import type { AIProviderType, ProviderGroup } from '../types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/primitives/tooltip';

interface ProviderSidebarProps {
    providers: ProviderGroup[];
    selectedProviderId: AIProviderType | null;
    onProviderSelect: (providerId: AIProviderType) => void;
}

export const ProviderSidebar: React.FC<ProviderSidebarProps> = ({
    providers,
    selectedProviderId,
    onProviderSelect,
}) => {
    return (
        <div className="flex flex-col gap-0.5 py-2 px-1.5 border-r border-border bg-secondary/30 w-11">
            {/* Provider Icons */}
            {providers.map((provider) => {
                const ProviderIcon = provider.icon;
                const isSelected = selectedProviderId === provider.id;

                return (
                    <Tooltip key={provider.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => onProviderSelect(provider.id)}
                                className={`relative flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 cursor-pointer ${isSelected
                                    ? 'bg-accent'
                                    : 'hover:bg-accent/50 opacity-50 hover:opacity-80'
                                    }`}
                            >
                                <ProviderIcon className="w-4 h-4" />
                                {/* Selection indicator */}
                                {isSelected && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-foreground/60" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="z-[60]">
                            <p>{provider.name}</p>
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
};

export default ProviderSidebar;
