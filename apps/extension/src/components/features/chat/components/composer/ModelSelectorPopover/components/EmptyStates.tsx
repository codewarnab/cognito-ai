/**
 * Empty States Components
 * 
 * Empty states for no models and no search results
 */

import React from 'react';
import { Settings2 } from 'lucide-react';

interface NoModelsEnabledProps { }

export const NoModelsEnabled: React.FC<NoModelsEnabledProps> = () => {
    return (
        <div className="px-4 py-8 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-secondary flex items-center justify-center">
                <Settings2 size={18} className="text-muted-foreground" />
            </div>
            <p className="text-[13px] text-foreground/70 font-medium">No models enabled</p>
            <p className="text-[11px] text-muted-foreground mt-1">Configure providers to get started</p>
        </div>
    );
};

interface NoSearchResultsProps {
    query: string;
}

export const NoSearchResults: React.FC<NoSearchResultsProps> = ({ query }) => {
    return (
        <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-muted-foreground">No models match "{query}"</p>
        </div>
    );
};
