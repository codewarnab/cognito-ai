/**
 * Type definitions for Chrome's LanguageModel API
 * This API is used for local AI capabilities via window.LanguageModel and self.LanguageModel
 * 
 * These types eliminate the need for @ts-ignore comments when using Chrome LanguageModel API
 */

declare global {
    /**
     * Chrome LanguageModel API availability states
     */
    type LanguageModelAvailability =
        | 'available'
        | 'readily'
        | 'downloadable'
        | 'downloading'
        | 'downloaded'
        | 'no'
        | undefined;

    /**
     * Chrome LanguageModel session creation options
     */
    interface LanguageModelCreateOptions {
        topK?: number;
        temperature?: number;
        signal?: AbortSignal;
        systemInstruction?: string;
        monitor?: (monitor: DownloadMonitor) => void;
    }

    /**
     * Prompt options including response constraint for structured output
     */
    interface LanguageModelPromptOptions {
        signal?: AbortSignal;
        responseConstraint?: any; // JSON Schema for structured output
    }

    /**
     * Chrome LanguageModel session interface
     */
    interface LanguageModelSession {
        prompt(text: string, options?: LanguageModelPromptOptions): Promise<string>;
        promptStreaming(text: string, options?: LanguageModelPromptOptions): ReadableStream<string>;
        destroy(): void;
    }

    /**
     * Chrome LanguageModel API interface
     */
    interface LanguageModelAPI {
        availability(): Promise<LanguageModelAvailability>;
        create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
    }

    /**
     * Summarizer API availability states
     */
    type SummarizerAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available' | undefined;

    /**
     * Summarizer creation options including monitor for download progress
     */
    interface SummarizerCreateOptions {
        type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
        format?: 'markdown' | 'plain-text';
        length?: 'short' | 'medium' | 'long';
        monitor?: (monitor: DownloadMonitor) => void;
        signal?: AbortSignal;
    }

    /**
     * Download monitor for tracking model download progress
     */
    interface DownloadMonitor {
        addEventListener(event: 'downloadprogress', callback: (event: DownloadProgressEvent) => void): void;
        removeEventListener(event: 'downloadprogress', callback: (event: DownloadProgressEvent) => void): void;
    }

    /**
     * Download progress event
     */
    interface DownloadProgressEvent {
        loaded: number; // Progress as decimal (0.0 to 1.0)
        total?: number;
    }

    /**
     * Summarizer session interface
     */
    interface SummarizerSession {
        summarize(text: string): Promise<string>;
        destroy(): void;
    }

    /**
     * Summarizer API interface
     */
    interface SummarizerAPI {
        availability(): Promise<SummarizerAvailability>;
        create(options?: SummarizerCreateOptions): Promise<SummarizerSession>;
    }

    // Window interface extensions
    interface Window {
        LanguageModel?: LanguageModelAPI;
        Summarizer?: SummarizerAPI;
    }

    // Self interface extensions (for service workers and web workers)
    interface WorkerGlobalScope {
        LanguageModel?: LanguageModelAPI;
        Summarizer?: SummarizerAPI;
    }

    // Also add to global self
    var LanguageModel: LanguageModelAPI | undefined;
    var Summarizer: SummarizerAPI | undefined;
}

export { };
