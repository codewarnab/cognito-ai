/**
 * Streaming response types
 */

export interface StreamChunk {
    content: string;
    done: boolean;
    metadata?: {
        tokensUsed?: number;
        [key: string]: unknown;
    };
}

export type StreamCallback = (chunk: StreamChunk) => void;

export interface StreamOptions {
    signal?: AbortSignal;
    onChunk?: StreamCallback;
    onComplete?: () => void;
    onError?: (error: Error) => void;
}

export interface StreamController {
    abort(): void;
    pause(): void;
    resume(): void;
    isPaused: boolean;
    isAborted: boolean;
}
