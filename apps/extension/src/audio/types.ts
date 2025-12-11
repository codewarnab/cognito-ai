/**
 * Speech Recognition Types
 */

export type RecognitionState = 'idle' | 'recording' | 'processing' | 'error';

export interface SpeechRecognitionResult {
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  isFinal: boolean;
  confidence?: number;
}

export interface SpeechRecognitionError {
  error: string;
  message: string;
}

export interface UseSpeechRecognitionReturn {
  // State
  isRecording: boolean;
  state: RecognitionState;
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  isSupported: boolean;
  silenceTimeRemaining: number;
  
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetTranscript: () => void;
}

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  silenceTimeout?: number; // milliseconds
  onTranscriptChange?: (transcript: string) => void;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: SpeechRecognitionError) => void;
  onSilenceDetected?: () => void;
}

// Browser API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
