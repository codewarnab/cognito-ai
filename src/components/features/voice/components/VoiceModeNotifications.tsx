/**
 * VoiceModeNotifications - Error, warning, and setup notification components
 */

import React from 'react';
import { MicrophoneHelpPopover } from './MicrophoneHelpPopover';

interface ErrorNotificationProps {
    error: string;
    isMicrophoneError: boolean;
    showMicHelpPopover: boolean;
    onShowMicHelpPopover: (show: boolean) => void;
    onDismiss: () => void;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
    error,
    isMicrophoneError,
    showMicHelpPopover,
    onShowMicHelpPopover,
    onDismiss
}) => {
    return (
        <div className="voice-mode-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="13" r="1" fill="currentColor" />
            </svg>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ flex: 1 }}>{error}</span>
                {isMicrophoneError && (
                    <MicrophoneHelpPopover
                        open={showMicHelpPopover}
                        onOpenChange={onShowMicHelpPopover}
                    />
                )}
            </div>
            <button
                className="voice-mode-error-dismiss"
                onClick={onDismiss}
                aria-label="Dismiss error"
            >
                ×
            </button>
        </div>
    );
};

interface WarningNotificationProps {
    message: string;
    onDismiss: () => void;
}

export const WarningNotification: React.FC<WarningNotificationProps> = ({
    message,
    onDismiss
}) => {
    return (
        <div className="voice-mode-warning">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 3L2 17h16L10 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M10 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="14" r="1" fill="currentColor" />
            </svg>
            <span>{message}</span>
            <button
                className="voice-mode-error-dismiss"
                onClick={onDismiss}
                aria-label="Dismiss warning"
            >
                ×
            </button>
        </div>
    );
};

export const SetupNotification: React.FC = () => {
    return (
        <div className="voice-mode-setup-notification">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M10 2V5M10 15V18M18 10H15M5 10H2M16.364 3.636L14.243 5.757M5.757 14.243L3.636 16.364M16.364 16.364L14.243 14.243M5.757 5.757L3.636 3.636"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Please wait, we're still setting up things...</span>
        </div>
    );
};
