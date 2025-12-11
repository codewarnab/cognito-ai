/**
 * Voice component types
 */

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceInputProps {
    onTranscript: (transcript: string) => void;
    onStart?: () => void;
    onStop?: () => void;
    onError?: (error: Error) => void;
    isActive: boolean;
    disabled?: boolean;
}

export interface VoiceRecordingState {
    isRecording: boolean;
    duration: number;
    audioLevel: number;
}

export interface VoiceVisualizationProps {
    audioLevel: number;
    isActive: boolean;
    state: VoiceState;
}

export interface VoiceSettings {
    autoStart?: boolean;
    autoStop?: boolean;
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
}
