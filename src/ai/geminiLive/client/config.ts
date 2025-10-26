/**
 * Configuration types and defaults for Gemini Live Client
 */

import type { LiveAPIError, VoiceModeStatus } from '../types';

/**
 * Event handlers for Gemini Live Client
 */
export interface GeminiLiveEventHandlers {
    onStatusChange?: (status: VoiceModeStatus) => void;
    onError?: (error: LiveAPIError) => void;
    onModelSpeaking?: (isSpeaking: boolean) => void;
    onUserSpeaking?: (isSpeaking: boolean) => void;
    onToolCall?: (toolName: string, args: any) => void;
    onToolResult?: (toolName: string, result: any) => void;
    onToolExecutionChange?: (isExecuting: boolean) => void;
}

/**
 * Error recovery configuration
 */
export interface ErrorRecoveryConfig {
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
    onRetry?: (attempt: number, delay: number, error: Error) => void;
    onFailure?: (error: Error) => void;
}

/**
 * Configuration options for GeminiLiveClient
 */
export interface GeminiLiveClientConfig {
    apiKey: string;
    model?: string;
    voiceName?: 'Aoede' | 'Orus' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Orion';
    systemInstruction?: string;
    enableTools?: boolean;
    eventHandlers?: GeminiLiveEventHandlers;
    errorRecoveryConfig?: ErrorRecoveryConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
    voiceName: 'Aoede' as const,
    enableTools: true,
    maxConnectionRetries: 3,
    maxContentLength: 50000, // ~50KB of text for tool responses
};
