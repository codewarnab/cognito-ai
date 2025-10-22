/**
 * Gemini Live API Integration
 * 
 * This module provides real-time voice conversation capabilities
 * using the Gemini Live API with tool calling support.
 */

// Type exports
export * from './types';

// Client exports (from new modular structure)
export { GeminiLiveClient } from './client';
export { GeminiLiveClient as default } from './client';
export type {
    GeminiLiveClientConfig,
    GeminiLiveEventHandlers,
    ErrorRecoveryConfig
} from './client';

// Audio manager exports
export {
    AudioManager,
    AudioCapture,
    AudioPlayback,
    Analyser,
    type AudioCaptureOptions,
    type AudioPlaybackOptions,
    type AudioDataCallback
} from './audioManager';

// Tool converter exports
export {
    convertToolToLiveAPIFormat,
    convertAllTools,
    convertToolsFromMap,
    zodToLiveAPISchema,
    validateFunctionDeclaration
} from './toolConverter';

// Error handler exports
export {
    GeminiLiveErrorHandler,
    ErrorRecoveryManager,
    MicrophonePermissionHandler,
    WebSocketConnectionHandler,
    AudioContextHandler,
    ToolExecutionHandler,
    SidePanelLifecycleHandler,
    TabVisibilityHandler,
    ModeSwitchGuard,
    RecoveryStrategy
} from './errorHandler';
