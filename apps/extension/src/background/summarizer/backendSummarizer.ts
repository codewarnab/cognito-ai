/**
 * Backend Summarizer Client
 * Routes summarize requests to Vercel backend instead of direct Gemini API
 * Supports Gemini built-in tools (URL context, Google Search grounding)
 */

import { createLogger } from '~logger';
import type { SummarizerOptions } from './geminiSummarizer';

const log = createLogger('BackendSummarizer', 'BACKGROUND');

const BACKEND_URL =
    import.meta.env.WXT_BACKEND_API_URL ||
    'https://youtube-transcript-generator-five.vercel.app';

export interface BackendSummarizeOptions extends Pick<SummarizerOptions, 'summaryType' | 'summaryLength' | 'pageContext'> {
    // Gemini built-in tools (Phase 6)
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}

export interface GroundingMetadata {
    webSearchQueries?: string[];
    searchEntryPoint?: { renderedContent?: string };
    groundingChunks?: Array<{ web?: { uri: string; title?: string } }>;
    groundingSupports?: Array<{
        segment: { text: string };
        groundingChunkIndices: number[];
    }>;
}

export interface BackendSummarizeStreamResult {
    text: string;
    groundingMetadata?: GroundingMetadata;
}

/**
 * Parse AI SDK stream format and yield text chunks
 * Also captures grounding metadata from data chunks (2: prefix)
 */
async function* parseAISDKStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    metadataRef: { groundingMetadata?: GroundingMetadata }
): AsyncGenerator<string, void, unknown> {
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('0:')) {
                // Text delta in AI SDK format
                try {
                    const text = JSON.parse(line.slice(2));
                    yield text;
                } catch {
                    // Skip malformed chunks
                }
            } else if (line.startsWith('2:')) {
                // Data chunk - may contain grounding metadata
                try {
                    const data = JSON.parse(line.slice(2));
                    if (Array.isArray(data) && data[0]?.groundingMetadata) {
                        metadataRef.groundingMetadata = data[0].groundingMetadata;
                    }
                } catch {
                    // Skip malformed data chunks
                }
            }
        }
    }
}

/**
 * Summarize text using backend (streaming)
 * Supports Gemini built-in tools for URL context and Google Search grounding
 */
export async function* summarizeWithBackend(
    text: string,
    options: BackendSummarizeOptions = { summaryType: 'tl-dr', summaryLength: 'medium' }
): AsyncGenerator<string, void, unknown> {
    const { enableUrlContext, enableGoogleSearch } = options;
    const hasTools = enableUrlContext || enableGoogleSearch;

    log.info('Summarizing with backend:', {
        textLength: text.length,
        summaryType: options.summaryType,
        summaryLength: options.summaryLength,
        hasTools,
        enableUrlContext,
        enableGoogleSearch,
    });

    const response = await fetch(`${BACKEND_URL}/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            summaryType: options.summaryType,
            summaryLength: options.summaryLength,
            pageContext: options.pageContext,
            enableUrlContext,
            enableGoogleSearch,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend error: ${response.status}`);
    }

    if (!response.body) {
        throw new Error('No response body from backend');
    }

    const metadataRef: { groundingMetadata?: GroundingMetadata } = {};
    const reader = response.body.getReader();
    yield* parseAISDKStream(reader, metadataRef);

    log.info('Backend summarization complete', { hadTools: hasTools });
}

/**
 * Summarize text using backend with full result including grounding metadata
 */
export async function summarizeWithBackendFull(
    text: string,
    options: BackendSummarizeOptions = { summaryType: 'tl-dr', summaryLength: 'medium' }
): Promise<BackendSummarizeStreamResult> {
    const { enableUrlContext, enableGoogleSearch } = options;

    log.info('Summarizing with backend (full):', {
        textLength: text.length,
        enableUrlContext,
        enableGoogleSearch,
    });

    const response = await fetch(`${BACKEND_URL}/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            summaryType: options.summaryType,
            summaryLength: options.summaryLength,
            pageContext: options.pageContext,
            enableUrlContext,
            enableGoogleSearch,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend error: ${response.status}`);
    }

    if (!response.body) {
        throw new Error('No response body from backend');
    }

    const chunks: string[] = [];
    const metadataRef: { groundingMetadata?: GroundingMetadata } = {};
    const reader = response.body.getReader();

    for await (const chunk of parseAISDKStream(reader, metadataRef)) {
        chunks.push(chunk);
    }

    return {
        text: chunks.join(''),
        groundingMetadata: metadataRef.groundingMetadata,
    };
}

/**
 * Non-streaming version
 */
export async function summarizeTextWithBackend(
    text: string,
    options: BackendSummarizeOptions = { summaryType: 'tl-dr', summaryLength: 'medium' }
): Promise<string> {
    const result = await summarizeWithBackendFull(text, options);
    return result.text;
}
