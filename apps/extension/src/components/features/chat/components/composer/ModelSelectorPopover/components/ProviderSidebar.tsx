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
        <div className="relative w-14 min-h-0 border-r border-border bg-secondary/30 overflow-hidden">
            <div className="mcp-scrollable flex flex-col items-center gap-3 py-2 px-1.5 h-full overflow-y-auto overflow-x-hidden">
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
                                    className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 cursor-pointer ${isSelected
                                        ? 'bg-accent'
                                        : 'hover:bg-accent/50 opacity-50 hover:opacity-80'
                                        }`}
                                >
                                    <ProviderIcon className="w-5 h-5" />
                                    {/* Selection indicator */}
                                    {isSelected && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r-full bg-foreground/60" />
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

            {/* Subtle fades to hint overflow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-secondary/60 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-secondary/60 to-transparent" />
        </div>
    );
};

export default ProviderSidebar;
