/**
 * ModeToggle - Component for switching between text and voice chat modes
 * 
 * Phase 7 Implementation:
 * - Toggle between text and voice modes
 * - Visual indication of active mode
 * - Disabled state during recording
 */

import React from 'react';
import './ModeToggle.css';

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
        <div className="mode-toggle">
            <button
                className={`mode-toggle-button ${mode === 'text' ? 'active' : ''}`}
                onClick={() => onModeChange('text')}
                disabled={disabled}
                aria-label="Text Mode"
                title="Switch to Text Mode"
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
                className={`mode-toggle-button ${mode === 'voice' ? 'active' : ''}`}
                onClick={() => onModeChange('voice')}
                disabled={disabled}
                aria-label="Voice Mode"
                title="Switch to Voice Mode"
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
