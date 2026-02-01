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
        <div className="relative w-14 min-h-0 border-r border-white/[0.06] overflow-hidden">
            <div className="mcp-scrollable flex flex-col items-center gap-1.5 py-2 px-1.5 h-full overflow-y-auto overflow-x-hidden">
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
                                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 cursor-pointer ${isSelected
                                        ? 'bg-white/[0.08]'
                                        : 'opacity-50 hover:opacity-90 hover:bg-white/[0.04]'
                                        }`}
                                >
                                    <ProviderIcon className="w-5 h-5" />
                                    {/* Selection indicator */}
                                    {isSelected && (
                                        <div className="absolute -left-[1.5px] top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-white/60" />
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
        </div>
    );
};

export default ProviderSidebar;
