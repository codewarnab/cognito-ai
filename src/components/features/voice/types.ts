/**
 * Type definitions for Voice Mode components
 */

import type { VoiceModeStatus } from '../../../ai/geminiLive/types';

export interface VoiceModeUIProps {
    onBack?: () => void;
    apiKey: string;
    systemInstruction?: string;
}

export interface VoiceModeState {
    isRecording: boolean;
    status: VoiceModeStatus;
    error: string | null;
    isInitialized: boolean;
    warningMessage: string | null;
    isModelSpeaking: boolean;
    isUserSpeaking: boolean;
    isExecutingTools: boolean;
    showSetupNotification: boolean;
    isMicrophoneError: boolean;
}
