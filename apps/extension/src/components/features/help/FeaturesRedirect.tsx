import React, { useEffect } from 'react';
import { openWebappRoute } from '@/constants/webapp';

interface FeaturesProps {
    onBack: () => void;
    onPromptClick?: (prompt: string) => void;
}

/**
 * Features redirect component.
 * Opens the webapp features page and navigates back.
 */
export const Features: React.FC<FeaturesProps> = ({ onBack }) => {
    useEffect(() => {
        // Open the webapp and go back immediately
        openWebappRoute('FEATURES');
        onBack();
    }, [onBack]);

    // Show a brief loading state while redirecting
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 bg-[var(--bg-primary)]">
            <div className="w-8 h-8 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
            <p className="text-sm text-[var(--text-secondary)]">Opening features page...</p>
        </div>
    );
};
