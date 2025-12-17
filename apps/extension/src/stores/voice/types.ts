/**
 * Voice Mode Store Types
 */

export type VoiceConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type VoiceModeStatus =
  | 'Ready'
  | 'Initializing...'
  | 'Listening...'
  | 'Processing...'
  | 'Speaking...'
  | 'Error'
  | 'Retrying...';

export interface VoiceModeState {
  // Recording state (text mode voice input)
  isRecording: boolean;
  showRecordingPill: boolean;

  // ElevenLabs voice mode
  isVoiceModeActive: boolean;
  connectionStatus: VoiceConnectionStatus;
  isSpeaking: boolean;

  // Error state
  lastError: string | null;
  showSetupNotification: boolean;

  // Actions - Recording (text mode)
  setIsRecording: (recording: boolean) => void;
  setShowRecordingPill: (show: boolean) => void;
  handleRecordingChange: (recording: boolean) => void;

  // Actions - Voice Mode (ElevenLabs)
  setConnectionStatus: (status: VoiceConnectionStatus) => void;
  setIsVoiceModeActive: (active: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setLastError: (error: string | null) => void;
  setShowSetupNotification: (show: boolean) => void;

  // Actions - Reset
  resetVoiceMode: () => void;
}
