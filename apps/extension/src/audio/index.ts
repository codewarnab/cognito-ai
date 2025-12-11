/**
 * Audio Module Exports
 * Speech-to-text functionality
 */

export { useSpeechRecognition } from './useSpeechRecognition';
export { VoiceInput } from './VoiceInput';
export { 
  requestMicrophonePermission, 
  checkMicrophonePermission, 
  openMicrophoneSettings,
  requestMicrophoneWithUI 
} from './micPermission';
export type {
  RecognitionState,
  SpeechRecognitionResult,
  SpeechRecognitionError,
  UseSpeechRecognitionReturn,
  SpeechRecognitionOptions,
} from './types';
export type { MicPermissionResult } from './micPermission';
