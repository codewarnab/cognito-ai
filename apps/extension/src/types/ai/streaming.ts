/**
 * Streaming response types
 * 
 * Types for handling streaming AI responses with support for
 * chunked delivery, progress tracking, and stream control.
 */

/**
 * A single chunk of streamed content
 */
export interface StreamChunk {
    /** The text content of this chunk */
    content: string;
    /** Whether this is the final chunk */
    done: boolean;
    /** Optional metadata about the stream */
    metadata?: {
        /** Cumulative tokens used so far */
        tokensUsed?: number;
        /** Additional custom metadata */
        [key: string]: unknown;
    };
}

/** Callback invoked for each streamed chunk */
export type StreamCallback = (chunk: StreamChunk) => void;

/**
 * Options for configuring a streaming request
 */
export interface StreamOptions {
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
    /** Called for each chunk received */
    onChunk?: StreamCallback;
    /** Called when streaming completes successfully */
    onComplete?: () => void;
    /** Called if an error occurs during streaming */
    onError?: (error: Error) => void;
}

/**
 * Controller for managing an active stream
 * Provides methods to abort, pause, and resume streaming
 */
export interface StreamController {
    /** Abort the stream permanently */
    abort(): void;
    /** Pause the stream (can be resumed) */
    pause(): void;
    /** Resume a paused stream */
    resume(): void;
    /** Whether the stream is currently paused */
    isPaused: boolean;
    /** Whether the stream has been aborted */
    isAborted: boolean;
}
