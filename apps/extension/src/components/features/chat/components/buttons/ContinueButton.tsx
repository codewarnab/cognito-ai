import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface ContinueButtonProps {
    onContinue: () => void;
    isLoading?: boolean;
}

/**
 * Compact continue button shown when AI stops due to tool call limit
 * Similar styling to tool call UI elements
 */
export const ContinueButton: React.FC<ContinueButtonProps> = ({ onContinue, isLoading }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="flex items-center justify-start gap-2 my-1.5 p-0 animate-in slide-in-from-bottom-2 duration-300">
            <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-normal cursor-pointer transition-all duration-200 select-none hover:not-disabled:bg-white/5 hover:not-disabled:border-[var(--border-color-hover)] active:not-disabled:bg-white/[0.08] active:not-disabled:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onContinue}
                disabled={isLoading}
                title="Continue iterating"
            >
                <span className="leading-none">Continue</span>
            </button>
            <div
                className="relative flex items-center justify-center w-5 h-5 text-[var(--text-secondary)] cursor-help transition-colors duration-200 hover:text-[var(--text-primary)]"
                title="How to increase limit"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <Info size={14} />
                {showTooltip && (
                    <div
                        className="absolute bottom-full left-[-20px] w-[280px] p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.3)] z-[1000] animate-in fade-in slide-in-from-bottom-1 duration-200"
                        style={{ transform: 'translateY(-12px)' }}
                    >
                        <strong className="block text-[var(--text-primary)] text-[13px] font-semibold mb-1.5">Max tool call limit reached</strong>
                        <p className="text-[var(--text-secondary)] text-xs leading-relaxed m-0">To increase the limit, go to Settings → AI Configuration → Maximum Tool Call Limit</p>
                        {/* Tooltip arrow */}
                        <div
                            className="absolute top-full left-[30px] w-0 h-0"
                            style={{
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid var(--border-color)'
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
