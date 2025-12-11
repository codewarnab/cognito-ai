/**
 * Voice Mode Components
 * 
 * Export all voice mode related components
 */

// Main components
export { default as VoiceModeUI } from './components/ElevenLabsVoiceModeUI';
export { default as AudioOrb3D } from './visualizations/AudioOrb3D';
export { VoicePoweredOrb } from './visualizations/VoicePoweredOrb';
export { default as VoiceControls } from './components/VoiceControls';
export { AudioAnalyser } from './utils/AudioAnalyser';

// UI components
export { VoiceModeStatusDisplay } from './components/VoiceModeStatus';
export { ErrorNotification, WarningNotification, SetupNotification } from './components/VoiceModeNotifications';
export { MicrophoneHelpPopover } from './components/MicrophoneHelpPopover';


// Custom hooks


// Types
export type { VoiceModeUIProps, VoiceModeState } from './types';

// Shaders
export * from './shaders/sphereShader';
export * from './shaders/backdropShader';
