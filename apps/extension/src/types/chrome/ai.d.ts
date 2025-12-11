/**
 * Type definitions for Chrome's Built-in AI APIs
 * Based on: https://github.com/explainers-by-googlers/prompt-api
 * 
 * These types eliminate the need for @ts-ignore comments when using Chrome AI APIs
 */

declare global {
    interface Window {
        ai?: {
            languageModel?: {
                capabilities(): Promise<AILanguageModelCapabilities>;
                create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
            };
            summarizer?: {
                capabilities(): Promise<AISummarizerCapabilities>;
                create(options?: AISummarizerCreateOptions): Promise<AISummarizer>;
            };
            translator?: {
                capabilities(): Promise<AITranslatorCapabilities>;
                create(options?: AITranslatorCreateOptions): Promise<AITranslator>;
            };
            writer?: {
                capabilities(): Promise<AIWriterCapabilities>;
                create(options?: AIWriterCreateOptions): Promise<AIWriter>;
            };
            rewriter?: {
                capabilities(): Promise<AIRewriterCapabilities>;
                create(options?: AIRewriterCreateOptions): Promise<AIRewriter>;
            };
        };
    }

    // Language Model Capabilities
    interface AILanguageModelCapabilities {
        available: 'readily' | 'after-download' | 'no';
        defaultTemperature?: number;
        defaultTopK?: number;
        maxTopK?: number;
    }

    // Language Model Options
    interface AILanguageModelCreateOptions {
        temperature?: number;
        topK?: number;
        systemPrompt?: string;
        initialPrompts?: Array<AIPromptMessage>;
        monitor?: (progress: AIModelDownloadProgress) => void;
        signal?: AbortSignal;
    }

    interface AIPromptMessage {
        role: 'system' | 'user' | 'assistant';
        content: string;
    }

    interface AIModelDownloadProgress {
        loaded: number;
        total: number;
    }

    // Language Model Interface
    interface AILanguageModel {
        prompt(input: string, options?: AILanguageModelPromptOptions): Promise<string>;
        promptStreaming(input: string, options?: AILanguageModelPromptOptions): ReadableStream<string>;
        countPromptTokens(input: string, options?: AILanguageModelPromptOptions): Promise<number>;
        maxTokens: number;
        tokensSoFar: number;
        tokensLeft: number;
        destroy(): void;
        clone(options?: AILanguageModelCloneOptions): Promise<AILanguageModel>;
    }

    interface AILanguageModelPromptOptions {
        signal?: AbortSignal;
    }

    interface AILanguageModelCloneOptions {
        signal?: AbortSignal;
    }

    // Summarizer Capabilities
    interface AISummarizerCapabilities {
        available: 'readily' | 'after-download' | 'no';
        languageAvailable(languageTag: string): Promise<'readily' | 'after-download' | 'no'>;
    }

    // Summarizer Options
    interface AISummarizerCreateOptions {
        type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline';
        format?: 'plain-text' | 'markdown';
        length?: 'short' | 'medium' | 'long';
        sharedContext?: string;
        monitor?: (progress: AIModelDownloadProgress) => void;
        signal?: AbortSignal;
    }

    // Summarizer Interface
    interface AISummarizer {
        summarize(text: string, options?: AISummarizeOptions): Promise<string>;
        summarizeStreaming(text: string, options?: AISummarizeOptions): ReadableStream<string>;
        destroy(): void;
    }

    interface AISummarizeOptions {
        context?: string;
        signal?: AbortSignal;
    }

    // Translator Capabilities
    interface AITranslatorCapabilities {
        available: 'readily' | 'after-download' | 'no';
        languagePairAvailable(
            sourceLanguage: string,
            targetLanguage: string
        ): Promise<'readily' | 'after-download' | 'no'>;
    }

    // Translator Options
    interface AITranslatorCreateOptions {
        sourceLanguage: string;
        targetLanguage: string;
        monitor?: (progress: AIModelDownloadProgress) => void;
        signal?: AbortSignal;
    }

    // Translator Interface
    interface AITranslator {
        translate(text: string, options?: AITranslateOptions): Promise<string>;
        translateStreaming(text: string, options?: AITranslateOptions): ReadableStream<string>;
        destroy(): void;
    }

    interface AITranslateOptions {
        signal?: AbortSignal;
    }

    // Writer Capabilities
    interface AIWriterCapabilities {
        available: 'readily' | 'after-download' | 'no';
    }

    // Writer Options
    interface AIWriterCreateOptions {
        tone?: 'formal' | 'neutral' | 'casual';
        format?: 'plain-text' | 'markdown';
        length?: 'short' | 'medium' | 'long';
        sharedContext?: string;
        monitor?: (progress: AIModelDownloadProgress) => void;
        signal?: AbortSignal;
    }

    // Writer Interface
    interface AIWriter {
        write(text: string, options?: AIWriteOptions): Promise<string>;
        writeStreaming(text: string, options?: AIWriteOptions): ReadableStream<string>;
        destroy(): void;
    }

    interface AIWriteOptions {
        context?: string;
        signal?: AbortSignal;
    }

    // Rewriter Capabilities
    interface AIRewriterCapabilities {
        available: 'readily' | 'after-download' | 'no';
    }

    // Rewriter Options
    interface AIRewriterCreateOptions {
        tone?: 'as-is' | 'more-formal' | 'more-casual';
        format?: 'as-is' | 'plain-text' | 'markdown';
        length?: 'as-is' | 'shorter' | 'longer';
        sharedContext?: string;
        monitor?: (progress: AIModelDownloadProgress) => void;
        signal?: AbortSignal;
    }

    // Rewriter Interface
    interface AIRewriter {
        rewrite(text: string, options?: AIRewriteOptions): Promise<string>;
        rewriteStreaming(text: string, options?: AIRewriteOptions): ReadableStream<string>;
        destroy(): void;
    }

    interface AIRewriteOptions {
        context?: string;
        signal?: AbortSignal;
    }
}

export { };
