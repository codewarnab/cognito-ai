/**
 * VoiceModeStatus - Status indicator component
 */

import React from 'react';
import type { VoiceModeStatus } from '@/ai/geminiLive/types';

interface VoiceModeStatusProps {
    status: VoiceModeStatus;
    isExecutingTools: boolean;
}

export const VoiceModeStatusDisplay: React.FC<VoiceModeStatusProps> = ({
    status,
    isExecutingTools
}) => {
    return (
        <div className="voice-mode-status">
            <div className={`voice-mode-status-indicator ${status.toLowerCase().replace(/\.\.\./g, '')} ${isExecutingTools ? 'with-notice' : ''}`}>
                <div className="voice-mode-status-dot" />
                <span className="voice-mode-status-text">{status}</span>
                {isExecutingTools && (
                    <div className="voice-mode-inline-notice">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M8 1V4M8 12V15M15 8H12M4 8H1M13.657 2.343L11.536 4.464M4.464 11.536L2.343 13.657M13.657 13.657L11.536 11.536M4.464 4.464L2.343 2.343"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span className="notice-text">Audio input paused during action</span>
                    </div>
                )}
            </div>
        </div>
    );
};
