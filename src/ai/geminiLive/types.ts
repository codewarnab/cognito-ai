/**
 * TypeScript type definitions for Gemini Live API
 * Based on @google/generative-ai SDK
 */

import type {
    FunctionDeclaration,
    Part,
    Content
} from '@google/generative-ai';

/**
 * Audio modality for Live API responses
 */
export enum Modality {
    AUDIO = 'AUDIO',
    TEXT = 'TEXT'
}

/**
 * Voice configuration for Live API
 */
export interface VoiceConfig {
    prebuiltVoiceConfig?: {
        voiceName: 'Aoede' | 'Orus' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Orion';
    };
}

/**
 * Speech configuration for Live API
 */
export interface SpeechConfig {
    voiceConfig?: VoiceConfig;
}

/**
 * Tool declaration wrapper for Live API
 */
export interface ToolDeclaration {
    functionDeclarations: FunctionDeclaration[];
}

/**
 * Configuration for Live API session
 */
export interface LiveSessionConfig {
    model: string;
    responseModalities?: Modality[];
    speechConfig?: SpeechConfig;
    tools?: ToolDeclaration[];
    systemInstruction?: string;
}

/**
 * Real-time input for audio streaming
 */
export interface RealtimeInput {
    media: {
        data: string; // Base64 encoded PCM audio
        mimeType: string; // e.g., 'audio/pcm;rate=16000'
    };
}

/**
 * Function call from AI
 */
export interface FunctionCall {
    id: string;
    name: string;
    args: Record<string, any>;
}

/**
 * Tool call message from Live API
 */
export interface ToolCall {
    functionCalls: FunctionCall[];
}

/**
 * Function response to send back
 */
export interface FunctionResponse {
    id: string;
    name: string;
    response: {
        result?: any;
        error?: string;
    };
}

/**
 * Tool response wrapper
 */
export interface ToolResponse {
    functionResponses: FunctionResponse[];
}

/**
 * Server content message parts
 */
export interface ModelTurn {
    parts: Part[];
}

/**
 * Server content in Live API message
 */
export interface ServerContent {
    modelTurn?: ModelTurn;
    interrupted?: boolean;
    generationComplete?: boolean;
    turnComplete?: boolean;
}

/**
 * Live API WebSocket message
 */
export interface LiveServerMessage {
    serverContent?: ServerContent;
    toolCall?: ToolCall;
    setupComplete?: boolean;
}

/**
 * Session callbacks
 */
export interface SessionCallbacks {
    onopen?: () => void;
    onmessage?: (message: LiveServerMessage) => void;
    onerror?: (error: Error) => void;
    onclose?: () => void;
}

/**
 * Live API session interface
 */
export interface LiveSession {
    sendRealtimeInput: (input: RealtimeInput) => Promise<void>;
    sendToolResponse: (response: ToolResponse) => Promise<void>;
    close: () => Promise<void>;
}

/**
 * Audio context state
 */
export type AudioContextState = 'suspended' | 'running' | 'closed';

/**
 * Recording state
 */
export type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

/**
 * Voice mode status
 */
export type VoiceModeStatus =
    | 'Ready'
    | 'Initializing...'
    | 'Connecting...'
    | 'Listening...'
    | 'Thinking...'
    | 'Speaking...'
    | 'Executing Action...'
    | 'Retrying...'
    | 'Error'
    | 'Disconnected';

/**
 * Audio format specifications
 */
export const AUDIO_CONFIG = {
    INPUT: {
        SAMPLE_RATE: 16000,
        CHANNELS: 1,
        BIT_DEPTH: 16,
        BUFFER_SIZE: 4096,
    },
    OUTPUT: {
        SAMPLE_RATE: 24000,
        CHANNELS: 1,
        BIT_DEPTH: 16,
    },
    MIME_TYPE: 'audio/pcm;rate=16000',
} as const;

/**
 * Available Gemini Live models
 */
export const GEMINI_LIVE_MODELS = {
    NATIVE_AUDIO: 'gemini-2.5-flash-native-audio-preview-09-2025',
    HALF_CASCADE: 'gemini-live-2.5-flash-preview',
} as const;

/**
 * Error types for Live API
 */
export enum LiveAPIErrorType {
    INITIALIZATION = 'INITIALIZATION',
    CONNECTION = 'CONNECTION',
    AUDIO_CAPTURE = 'AUDIO_CAPTURE',
    AUDIO_PLAYBACK = 'AUDIO_PLAYBACK',
    TOOL_EXECUTION = 'TOOL_EXECUTION',
    SESSION_CLOSED = 'SESSION_CLOSED',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * Live API error class
 */
export class LiveAPIError extends Error {
    constructor(
        public type: LiveAPIErrorType,
        message: string,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'LiveAPIError';
    }
}
