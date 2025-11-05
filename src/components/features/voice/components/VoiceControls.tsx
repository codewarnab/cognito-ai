/**
 * VoiceControls - Control buttons for voice mode
 * 
 * Phase 6 Implementation:
 * - Start/Stop/Reset buttons with proper states
 * - Visual feedback for recording state
 * - Disabled state handling
 */

import React from 'react';
import '../styles/VoiceControls.css';

export interface VoiceControlsProps {
    isRecording: boolean;
    onStart: () => void;
    onStop: () => void;
    onReset: () => void;
    disabled?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
    isRecording,
    onStart,
    onStop,
    onReset,
    disabled = false
}) => {
    return (
        <div className="voice-controls">
            {/* Reset Button */}
            <button
                className="voice-control-button voice-control-reset"
                onClick={onReset}
                disabled={disabled}
                title="Reset session"
                aria-label="Reset voice session"
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                        d="M14.5 5.5C13.3065 4.30653 11.6935 3.5 10 3.5C6.68629 3.5 4 6.18629 4 9.5C4 12.8137 6.68629 15.5 10 15.5C12.7614 15.5 15.0927 13.5927 15.7929 11"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M14.5 2.5V5.5H11.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <span>Reset</span>
            </button>

            {/* Start Button */}
            {!isRecording ? (
                <button
                    className="voice-control-button voice-control-start"
                    onClick={onStart}
                    disabled={disabled}
                    title="Start voice conversation"
                    aria-label="Start recording"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="8" fill="currentColor" />
                    </svg>
                    <span>Start</span>
                </button>
            ) : (
                /* Stop Button */
                <button
                    className="voice-control-button voice-control-stop"
                    onClick={onStop}
                    disabled={disabled}
                    title="Stop voice conversation"
                    aria-label="Stop recording"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="7" y="7" width="10" height="10" fill="currentColor" />
                    </svg>
                    <span>Stop</span>
                </button>
            )}
        </div>
    );
};

export default VoiceControls;
