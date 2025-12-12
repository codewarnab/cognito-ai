/**
 * ModeToggle - Component for switching between text and voice chat modes
 * 
 * Features:
 * - Toggle between text and voice modes
 * - Visual indication of active mode
 * - Disabled state during recording
 */

import React from 'react';

export type ChatMode = 'text' | 'voice';

export interface ModeToggleProps {
    mode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    disabled?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
    mode,
    onModeChange,
    disabled = false
}) => {
    return (
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg backdrop-blur-[10px] border border-white/10">
            <button
                className={`flex items-center gap-1.5 px-4 py-2 bg-transparent border-none rounded-md text-sm font-medium cursor-pointer transition-all duration-200 relative ${mode === 'text'
                        ? 'text-white bg-white/15 shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                        : 'text-white/60 hover:text-white/90 hover:bg-white/10 active:scale-[0.98]'
                    } disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:w-4 [&_svg]:h-4 [&_svg]:transition-all [&_svg]:duration-200 max-[480px]:[&_span]:hidden max-[480px]:px-3`}
                onClick={() => onModeChange('text')}
                disabled={disabled}
                aria-label="Text Mode"
                title="Switch to Text Mode"
                style={mode === 'text' ? {
                    '::before': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '6px',
                        padding: '1px',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        maskComposite: 'exclude',
                        pointerEvents: 'none'
                    }
                } as React.CSSProperties : undefined}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                        d="M2 3h12M2 8h12M2 13h12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
                <span>Text</span>
            </button>

            <button
                className={`flex items-center gap-1.5 px-4 py-2 bg-transparent border-none rounded-md text-sm font-medium cursor-pointer transition-all duration-200 relative ${mode === 'voice'
                        ? 'text-white bg-white/15 shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                        : 'text-white/60 hover:text-white/90 hover:bg-white/10 active:scale-[0.98]'
                    } disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:w-4 [&_svg]:h-4 [&_svg]:transition-all [&_svg]:duration-200 max-[480px]:[&_span]:hidden max-[480px]:px-3`}
                onClick={() => onModeChange('voice')}
                disabled={disabled}
                aria-label="Voice Mode"
                title="Switch to Voice Mode"
                style={mode === 'voice' ? {
                    '::before': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '6px',
                        padding: '1px',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        maskComposite: 'exclude',
                        pointerEvents: 'none'
                    }
                } as React.CSSProperties : undefined}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                        d="M8 1C6.89543 1 6 1.89543 6 3V8C6 9.10457 6.89543 10 8 10C9.10457 10 10 9.10457 10 8V3C10 1.89543 9.10457 1 8 1Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M4 7V8C4 10.2091 5.79086 12 8 12C10.2091 12 12 10.2091 12 8V7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M8 12V15M6 15H10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <span>Voice</span>
            </button>
        </div>
    );
};

export default ModeToggle;
