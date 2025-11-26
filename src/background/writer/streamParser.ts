/**
 * Gemini SSE Stream Parser
 * Parses Server-Sent Events (SSE) stream from Gemini API
 * 
 * This module provides a reusable async generator for parsing Gemini's
 * streaming response format, which uses SSE with JSON payloads.
 * 
 * SSE Format from Gemini:
 * data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
 * data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
 * data: [DONE]
 */

import { createLogger } from '~logger';

const log = createLogger('StreamParser', 'BACKGROUND');

/**
 * Parsed chunk from Gemini stream
 */
export interface ParsedChunk {
    text: string;
    finishReason?: string;
    safetyRatings?: Array<{
        category: string;
        probability: string;
    }>;
}

/**
 * Parse a single SSE line from Gemini response
 * Returns the text content if found, undefined otherwise
 */
export function parseSSELine(line: string): ParsedChunk | undefined {
    // Skip empty lines or non-data lines
    if (!line.startsWith('data: ')) {
        return undefined;
    }

    const data = line.slice(6).trim();

    // Check for end-of-stream marker
    if (data === '[DONE]') {
        return undefined;
    }

    // Skip empty data
    if (!data) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(data);

        // Extract text from Gemini response structure
        const candidate = parsed?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (text !== undefined) {
            return {
                text,
                finishReason: candidate?.finishReason,
                safetyRatings: candidate?.safetyRatings,
            };
        }
    } catch (error) {
        // Log malformed JSON for debugging but don't throw
        log.debug('Skipping malformed JSON in SSE line', { lineLength: line.length });
    }

    return undefined;
}

/**
 * Parse Gemini SSE stream into text chunks
 * 
 * @param response - Fetch Response object with SSE body
 * @yields Text chunks from the stream
 * 
 * @example
 * ```typescript
 * const response = await fetch(geminiUrl, options);
 * for await (const text of parseGeminiSSE(response)) {
 *   console.log('Chunk:', text);
 * }
 * ```
 */
export async function* parseGeminiSSE(
    response: Response
): AsyncGenerator<string, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body available for streaming');
    }

    log.debug('Starting SSE stream parsing');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                log.debug('Stream reader done');
                break;
            }

            // Append new data to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            log.debug('Received raw chunk', { chunkLength: chunk.length });

            // Process complete lines (SSE uses newline separators)
            const lines = buffer.split('\n');
            // Keep the last potentially incomplete line in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                log.debug('Processing SSE line', { line: trimmedLine.substring(0, 100) });
                const parsed = parseSSELine(trimmedLine);
                if (parsed?.text) {
                    log.debug('Yielding text chunk', { text: parsed.text.substring(0, 50) });
                    yield parsed.text;
                }
            }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
            log.debug('Processing remaining buffer', { buffer: buffer.substring(0, 100) });
            const parsed = parseSSELine(buffer.trim());
            if (parsed?.text) {
                log.debug('Yielding final text chunk', { text: parsed.text.substring(0, 50) });
                yield parsed.text;
            }
        }

        log.debug('SSE parsing complete');
    } finally {
        reader.releaseLock();
    }
}

/**
 * Parse Gemini SSE stream with full chunk information
 * Use this when you need access to finish reasons or safety ratings
 * 
 * @param response - Fetch Response object with SSE body
 * @yields ParsedChunk objects with text and metadata
 */
export async function* parseGeminiSSEWithMetadata(
    response: Response
): AsyncGenerator<ParsedChunk, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body available for streaming');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                const parsed = parseSSELine(trimmedLine);
                if (parsed) {
                    yield parsed;
                }
            }
        }

        // Process remaining buffer
        if (buffer.trim()) {
            const parsed = parseSSELine(buffer.trim());
            if (parsed) {
                yield parsed;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Collect all text from a Gemini SSE stream
 * Useful for non-streaming use cases where you need the complete response
 * 
 * @param response - Fetch Response object with SSE body
 * @returns Complete text from all chunks concatenated
 */
export async function collectGeminiSSE(response: Response): Promise<string> {
    let result = '';
    for await (const text of parseGeminiSSE(response)) {
        result += text;
    }
    return result;
}
