/**
 * Gemini Live API Integration
 * 
 * This module provides real-time voice conversation capabilities
 * using the Gemini Live API with tool calling support.
 */

export * from './types';
export {
    GeminiLiveClient as default,
    GeminiLiveClient,
    type GeminiLiveClientConfig,
    type GeminiLiveEventHandlers
} from './GeminiLiveClient';
export {
    AudioManager,
    AudioCapture,
    AudioPlayback,
    Analyser,
    type AudioCaptureOptions,
    type AudioPlaybackOptions,
    type AudioDataCallback
} from './audioManager';
export {
    convertToolToLiveAPIFormat,
    convertAllTools,
    convertToolsFromMap,
    zodToLiveAPISchema,
    validateFunctionDeclaration
} from './toolConverter';
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
    RecoveryStrategy,
    type ErrorRecoveryConfig
} from './errorHandler';
