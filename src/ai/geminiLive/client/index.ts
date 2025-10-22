/**
 * Gemini Live Client Module
 * Exports all client components and types
 */

export { GeminiLiveClient } from './GeminiLiveClient';
export { GeminiLiveSessionManager } from './sessionManager';
export { GeminiLiveAudioHandler } from './audioHandler';
export { GeminiLiveMessageHandler } from './messageHandler';
export { GeminiLiveToolHandler } from './toolHandler';

export type {
    GeminiLiveClientConfig,
    GeminiLiveEventHandlers,
    ErrorRecoveryConfig
} from './config';

export { DEFAULT_CONFIG, HARDCODED_API_KEY } from './config';
